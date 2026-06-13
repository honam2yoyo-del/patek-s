import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


const FC = { apiKey:"AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY", authDomain:"patek-s.firebaseapp.com", projectId:"patek-s", storageBucket:"patek-s.firebasestorage.app", messagingSenderId:"786016749285", appId:"1:786016749285:web:58538eec1cf7e72068b60c" };
const app  = initializeApp(FC);
const auth = getAuth(app);
const db   = getFirestore(app);

const pad  = n => String(n).padStart(2,'0');
const fmtW = n => (n != null && !isNaN(Number(n))) ? Number(n).toLocaleString('ko-KR') + ' 원' : '- 원';
const fmtN = n => (n != null && !isNaN(Number(n))) ? Number(n).toLocaleString('ko-KR') : '-';

function fmtInput(n) {
  if (n == null || n === '') return '';
  const num = Number(String(n).replace(/,/g,''));
  return isNaN(num) ? '' : num.toLocaleString('ko-KR');
}

function parseNum(s) {
  if (s == null || s === '') return null;
  const n = Number(String(s).replace(/,/g,''));
  return isNaN(n) ? null : n;
}

window.parseNum = parseNum;

window.fmtNum = function(el) {
  const raw = String(el.value).replace(/[^0-9]/g,'');
  el.value = raw !== '' ? Number(raw).toLocaleString('ko-KR') : '';
  if (el.classList.contains('kpi-pcs-num')) {
    el.style.width = Math.max(2, el.value.length || 1) + 'ch';
  }
};

const STATUSES  = ['판매예정','컨펌예정','이월예정','AS','잔여재고','기타','판매완료','등록','선수금','반품'];
const STATUS_DISPLAY = {
  '판매예정':'판매 예정','컨펌예정':'컨펌 예정','이월예정':'이월 예정',
  '잔여재고':'잔여 재고','AS':'AS','기타':'기타(이동)','판매완료':'판매 완료','등록':'MPDS 등록 중','선수금':'선수금','반품':'반품'
};
const BADGE_MAP = {
  '판매예정':'badge-sale','컨펌예정':'badge-confirm','이월예정':'badge-carry',
  '잔여재고':'badge-rest','AS':'badge-as','기타':'badge-rest','판매완료':'badge-done',
  '등록':'badge-reg','선수금':'badge-advance','반품':'badge-refund'
};
const IS_NO_PCS = () => false; // 선수금 포함 모든 상태 pcs 집계
const pcsLabel  = n => (n === 1 ? '1 pc' : (n || 0) + ' pcs');

function canonicalStatus(s) {
  const m = {'판매 예정':'판매예정','컨펌 예정':'컨펌예정','이월 예정':'이월예정','잔여 재고':'잔여재고','판매 완료':'판매완료'};
  const t = String(s||'').trim();
  return m[t] || (STATUSES.includes(t) ? t : '잔여재고');
}

function statusSelClass(s) {
  return {'판매예정':'s-sale','컨펌예정':'s-confirm','이월예정':'s-carry','잔여재고':'s-rest','AS':'s-as','기타':'s-etc','판매완료':'s-done','등록':'s-reg','선수금':'s-advance','반품':'s-refund'}[s]||'s-rest';
}

let curYear  = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let rows     = [];
let activeFilters = new Set(['전체']);
let searchQuery   = '';
let unsubPlan = null;
let unsubInventory = null;

// 지점 연간 데이터 (인메모리)
let avenueData = {}; // m1..m12: 금액, m1_pcs..m12_pcs: pcs
let centumData = {};
let prevYearCentumData = {}; // 전년도 센텀 데이터 (비교용)
let prevYearAvenueData = {}; // 전년도 에비뉴엘 데이터 (작년 매출 자동 채우기용)
let showPrevYear = false;    // 전년 비교 토글 상태

// 목표 달성률 데이터
let goalRateData = { total: 0, centum: 0, avenue: 0 };

// 현재 로그인 사용자 이름 캐시
let _currentUserName = '';

// Collection 설정 + 직원 목록 캐시
const DEFAULT_LINES = [
  { name: 'Grand Complications', refs: ['5320G-011','5327G-001','5327R-001','7140G-001','7140R-001','5236P-011','5160/500R-001','6159G-001','5270J-001','5204G-010','5370R-001','5373P-001','6104R-001','5322G-001','5260/1455R-001','5260/355R-001','7040/250G-001','5178G-012','7047G-001','5303R-001','5304/301R-001','5308G-001','5374G-001','5531G-001','6002R-001','6301P-001','6300GR-001','27000M-001'] },
  { name: 'Complications', refs: ['5328G-001','5212A-001','5205G-013','5205R-011','5396G-017','5396R-016','4946G-001','4946R-001','4947/1A-001','4948R-001','5235/50R-001','5326G-001','5172G-001','5172G-010','5905/1A-001','5905R-010','5961R-010','5961P-001','5224R-001','5524G-010','5524R-001','5231G-001','5330G-001','5930P-001','7129J-001','5935A-001','7130G-016','5924G-001','5924G-010','7121/200G-001','5180/1R-001','5249R-001'] },
  { name: 'Calatrava', refs: ['5088/100P-001','5226G-001','5227G-015','5227J-001','6007G-001','6007G-010','6007G-011','6119G-001','6119R-001','6196P-001','7200/50G-001','7200/50G-012'] },
  { name: 'Gondolo', refs: ['7042/100R-010','7042/100G-010','4962/200R-010'] },
  { name: 'Golden Ellipse', refs: ['5738/1R-001','5738P-001','5738R-001','5738/51G-001','5738G-001','3738/100G-014'] },
  { name: 'Cubitus', refs: ['5822P-001','5821/1AR-001','5821/1A-001','7128/1G-001','7128/1R-001','5840P-001'] },
  { name: 'Nautilus', refs: ['5712/1R-001','5726/1A-014','5726A-001','5811/1G-001','5811/1460G-001','5740/1G-001','5980/1400G-010','5980/1400R-011','5980/60G-001','5990/1A-011','5990/1R-001','5990/1400G-001','7010/1G-013','7010/1R-013','7010G-013','7010R-013','7118/1A-001','7118/1A-011','7118/1200A-001','7118/1200A-011','7118/1R-001','7118/1R-010','7118/1200R-001','7118/1200R-010','7118/1300R-001','7118/1450G-001','7118/1450R-001','5723/1R-001','5723/1R-010','5723/112R-001','5711/110P-001','5711/111P-001','5711/112P-001','5811/1G-001','5810/1G-001','5610/1P-001','5810G-001','958G-001'] },
  { name: 'Aquanaut', refs: ['5167A-001','5167R-001','5164G-001','5164R-001','5168G-001','5168G-010','5968A-001','5968G-001','5968G-010','5968R-001','5072R-001','5261R-001','5267/200A-001','5267/200A-010','5267/200A-011','5268/200R-010','5268/461G-001','5269R-001','7968/300R-001'] },
  { name: 'Twenty~4', refs: ['7300/1200A-001','7300/1200A-010','7300/1200A-011','7300/1200R-001','7300/1200R-010','4910/1200A-001','4910/1200A-010','4910/1200A-011','7340/1R-001','7340/1R-010'] },
  { name: 'Pocket Watches', refs: ['973J-001','980G-010','980J-011','980R-001','983J-001'] },
  { name: 'Rare Handcrafts', refs: ['5531G-010','5278/50R-010','5278/50R-011','5738/50G-041','5738/50G-042','5738/50J-010','5738/50J-012','5738/50R-010','5738/50R-021','5077/100R-068','5077/210R-001','5077/356R-001','5077/357G-001','5177G-056','5177G-057','5177J-001','5177R-001','992/173J-001','992/190G-001','995/141G-001','999/100G-001','10045M-001','10046M-001','20192M-001','20196M-001','20199M-001','20200M-001','20201M-001','22000M-001'] }
];
let _lineConfig = [];
let _staffList  = [];

async function loadLineConfig() {
  try {
    const snap = await getDoc(doc(db,'artifacts','patek-s','public','data','lineConfig'));
    _lineConfig = snap.exists() ? (snap.data().lines || []) : [];
  } catch(e) { _lineConfig = []; }
}
async function loadStaffList() {
  try {
    const snap = await getDocs(collection(db,'users'));
    _staffList = snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.approved);
    // 현재 로그인 사용자 이름 자동 추출
    const uid = auth.currentUser?.uid;
    const me  = _staffList.find(u => u.id === uid);
    _currentUserName = me?.name || me?.displayName || auth.currentUser?.displayName || '';
  } catch(e) { _staffList = []; }
}
function getLineForRef(ref) {
  if (!ref) return '';
  const r    = ref.toLowerCase();
  const pool = _lineConfig.length > 0 ? _lineConfig : DEFAULT_LINES;
  for (const l of pool) {
    if ((l.refs||[]).some(x => x.toLowerCase() === r)) return l.name;
  }
  return '';
}
// 수동 입력 저장값 우선 유지 플래그
let _manualSalesLock = { expectedSales: false, currentSales: false };

/* ────────── 달력 월 피커 ────────── */
let pickerYear      = curYear;
let pickerMode      = 'month';
let pickerYearStart = Math.floor(curYear / 10) * 10;

function getQuarterNum(month) { return Math.ceil(month / 3); }
function curQuarter() { return getQuarterNum(curMonth); }
function quarterMonths(q) { const s=(q-1)*3+1; return [s,s+1,s+2]; }

function updateQuarterBadge() {
  const el = document.getElementById('quarterBadge');
  if (el) el.textContent = `${getQuarterNum(curMonth)}분기`;
}

function renderPickerGrid() {
  const label = document.getElementById('pickerYearLabel');
  const grid  = document.getElementById('pickerMonthGrid');
  grid.innerHTML = '';
  if (pickerMode === 'year') {
    label.textContent = `${pickerYearStart} ~ ${pickerYearStart + 11}`;
    for (let y = pickerYearStart; y < pickerYearStart + 12; y++) {
      const btn = document.createElement('button');
      btn.className = 'mpp-month' + (y === pickerYear ? ' sel' : '');
      btn.textContent = `${y}년`;
      btn.onclick = () => { pickerYear = y; pickerMode = 'month'; renderPickerGrid(); };
      grid.appendChild(btn);
    }
  } else {
    label.textContent = `${pickerYear}년`;
    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.className = 'mpp-month' + (pickerYear === curYear && m === curMonth ? ' sel' : '');
      btn.textContent = `${m}월`;
      btn.onclick = () => selectMonth(pickerYear, m);
      grid.appendChild(btn);
    }
  }
}

function selectMonth(year, month) {
  curYear = year; curMonth = month;
  document.getElementById('monthPickerLabel').textContent = `${year}년 ${month}월`;
  document.getElementById('monthPickerPopup').style.display = 'none';
  updateQuarterBadge();
  updateMonthLabels();
  loadMonth();
}

function initMonthPicker() {
  pickerYear = curYear;
  document.getElementById('monthPickerLabel').textContent = `${curYear}년 ${curMonth}월`;
  updateQuarterBadge();
  document.getElementById('monthPickerBtn').addEventListener('click', e => {
    e.stopPropagation();
    pickerYear = curYear; pickerMode = 'month';
    renderPickerGrid();
    const popup = document.getElementById('monthPickerPopup');
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('pickerYearLabel').addEventListener('click', e => {
    e.stopPropagation();
    if (pickerMode === 'month') { pickerMode = 'year'; pickerYearStart = Math.floor(pickerYear / 10) * 10; }
    else { pickerMode = 'month'; }
    renderPickerGrid();
  });
  document.getElementById('prevYearBtn').addEventListener('click', e => {
    e.stopPropagation();
    if (pickerMode === 'year') { pickerYearStart -= 12; } else { pickerYear--; }
    renderPickerGrid();
  });
  document.getElementById('nextYearBtn').addEventListener('click', e => {
    e.stopPropagation();
    if (pickerMode === 'year') { pickerYearStart += 12; } else { pickerYear++; }
    renderPickerGrid();
  });
  document.addEventListener('click', () => {
    const p = document.getElementById('monthPickerPopup');
    if (p) p.style.display = 'none';
  });
  document.getElementById('monthPickerWrap').addEventListener('click', e => e.stopPropagation());
}

function updateMonthLabels() {
  const m = curMonth;
  document.getElementById('expectedTitle').textContent = `${m}월 예상 매출`;
  document.getElementById('lastYearTitle').textContent = `작년 ${m}월 매출`;
  const qtLabel = document.getElementById('quarterLabelText');
  if (qtLabel) qtLabel.textContent = getQuarterNum(m);
  const qGoalLabel = document.getElementById('qGoalLabel');
  if (qGoalLabel) qGoalLabel.textContent = `${getQuarterNum(m)}분기 목표`;
  const ctQGoalLabel = document.getElementById('ct-qGoalLabel');
  if (ctQGoalLabel) ctQGoalLabel.textContent = `${getQuarterNum(m)}분기 목표`;
  updateQuarterBadge();
}

/* ────────── Auth ────────── */
document.getElementById('login-btn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { alert('로그인 실패: '+e.message); }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, user => {
  if (!user) { document.getElementById('login-overlay').style.display = 'flex'; return; }
  getDoc(doc(db, 'users', user.uid)).then(snap => {
    if (snap.exists() && snap.data().approved === true) {
      document.getElementById('login-overlay').style.display = 'none';
      initMonthPicker(); updateMonthLabels(); loadMonth(); loadLineConfig(); loadStaffList();
    } else {
      document.getElementById('login-overlay').style.display = 'flex';
      signOut(auth);
    }
  }).catch(() => { document.getElementById('login-overlay').style.display = 'flex'; signOut(auth); });
});

/* ────────── 지점 모달 초기화 ────────── */
function initBranchModals() {
  ['av','ct'].forEach(prefix => {
    for (let q = 1; q <= 4; q++) {
      const containerId = prefix === 'av' ? `av-months-${q}` : `ct-months-${q}`;
      const container = document.getElementById(containerId);
      if (!container) continue;
      const months = quarterMonths(q);
      container.innerHTML = months.map(m => `
        <div class="av-month-row">
          <label>${m}월</label>
          <input id="${prefix}-m${m}" type="text" inputmode="numeric" placeholder="금액"
            oninput="window.fmtNum(this);window.calcBranchSub('${prefix}')"/>
          <input id="${prefix}-p${m}" type="text" inputmode="numeric" placeholder="pcs"
            class="pcs-input" oninput="window.fmtNum(this);window.calcBranchSub('${prefix}')"/>
        </div>
      `).join('');
    }
  });
}

window.calcBranchSub = function(prefix) {
  let yearAmt = 0, yearPcs = 0;
  for (let q = 1; q <= 4; q++) {
    let sub = 0, pcs = 0;
    quarterMonths(q).forEach(m => {
      sub += parseNum(document.getElementById(`${prefix}-m${m}`)?.value) || 0;
      pcs += parseNum(document.getElementById(`${prefix}-p${m}`)?.value) || 0;
    });
    const subEl = document.getElementById(`${prefix}-sub-${q}`);
    if (subEl) subEl.innerHTML = `합계: ${fmtN(sub)} 원<br>PCS: ${pcs}`;
    yearAmt += sub; yearPcs += pcs;
  }
  const totKey = prefix === 'av' ? 'avenueTotalText' : 'centumTotalText';
  const totEl = document.getElementById(totKey);
  if (totEl) totEl.textContent = `${fmtN(yearAmt)} 원 / ${yearPcs} PCS`;
};

/* ────────── 분기 목표 데이터 (분기당 1회 입력, 같은 분기 3개월 공유) ────────── */
function quarterGoalDocId(year, month) {
  return `${year}-Q${getQuarterNum(month)}`;
}

async function loadQuarterGoalData() {
  const qid = quarterGoalDocId(curYear, curMonth);
  try {
    const snap = await getDoc(doc(db,'artifacts','patek-s','public','data','quarter_goals',qid));
    if (snap.exists()) {
      const d = snap.data();
      goalRateData = {
        total:  d.totalGoalAmount  ?? 0,
        centum: d.centumGoalAmount ?? 0,
        avenue: d.avenueGoalAmount ?? 0
      };
    } else {
      goalRateData = { total: 0, centum: 0, avenue: 0 };
    }
  } catch(e) {
    goalRateData = { total: 0, centum: 0, avenue: 0 };
  }
  updateGoalDisplay();
  recalcQuarter();
}

function saveQuarterGoalData() {
  const qid = quarterGoalDocId(curYear, curMonth);
  const data = {
    totalGoalAmount:  goalRateData.total  || null,
    centumGoalAmount: goalRateData.centum || null,
    avenueGoalAmount: goalRateData.avenue || null,
    updatedAt: new Date().toISOString()
  };
  setDoc(doc(db,'artifacts','patek-s','public','data','quarter_goals',qid), data, {merge:true})
    .catch(e => console.error('quarter goal save:', e));
}

/* ────────── 데이터 로드 ────────── */
function loadMonth() {
  if (unsubPlan)      unsubPlan();
  if (unsubInventory) unsubInventory();
  goalRateData = { total: 0, centum: 0, avenue: 0 };
  const docId = `${curYear}-${pad(curMonth)}`;
  unsubPlan = onSnapshot(doc(db,'artifacts','patek-s','public','data','sales_dashboard',docId), snap => {
    applyData(snap.exists() ? snap.data() : null);
  });
  // 재고 목록 실시간 연동 (재고·MPDS 페이지 변경도 즉시 반영)
  unsubInventory = onSnapshot(doc(db,'artifacts','patek-s','public','data','inventory',docId), snap => {
    rows = snap.exists()
      ? (snap.data().rows||[]).map(r => {
          const normalized = {...r, status: canonicalStatus(r.status)};
          // Collection이 저장 안 된 row는 REF로 자동 매칭
          if (!normalized.line) normalized.line = getLineForRef(normalized.ref);
          return normalized;
        })
      : [];
    renderTable();
  });
  // 작년 같은 달 현재 매출 → 작년 월 매출 필드에 자동 반영
  // inventory에서 직접 계산(판매완료+선수금), fallback으로 sales_dashboard.currentSales 사용
  const prevDocId = `${curYear - 1}-${pad(curMonth)}`;
  Promise.all([
    getDoc(doc(db,'artifacts','patek-s','public','data','inventory', prevDocId)),
    getDoc(doc(db,'artifacts','patek-s','public','data','sales_dashboard', prevDocId))
  ]).then(([invSnap, dashSnap]) => {
    const lyEl    = document.getElementById('f-lastYearSales');
    const lyPcsEl = document.getElementById('f-lastYearPcs');
    let filled = false;
    if (invSnap.exists()) {
      const prevRows  = invSnap.data().rows || [];
      const completed = prevRows.filter(r => r.status === '판매완료' || r.status === '판매 완료');
      const advances  = prevRows.filter(r => r.status === '선수금');
      const refunds   = prevRows.filter(r => r.status === '반품');
      const totalAmt  = [...completed, ...advances, ...refunds].reduce((s,r) => s+(Number(r.amount)||0), 0);
      const donePcs   = completed.length;
      if (totalAmt !== 0 || donePcs > 0) {
        if (lyEl)    lyEl.value    = totalAmt > 0 ? fmtInput(totalAmt) : '';
        if (lyPcsEl) { lyPcsEl.value = donePcs > 0 ? String(donePcs) : ''; lyPcsEl.style.width = Math.max(2, lyPcsEl.value.length||1)+'ch'; }
        filled = true;
      }
    }
    if (!filled) {
      const d = dashSnap.exists() ? dashSnap.data() : null;
      if (lyEl)    lyEl.value    = d?.currentSales != null ? fmtInput(d.currentSales) : '';
      if (lyPcsEl) { lyPcsEl.value = d?.currentPcs != null ? String(d.currentPcs) : ''; lyPcsEl.style.width = Math.max(2, lyPcsEl.value.length||1)+'ch'; }
    }
    recalcRemain();
  }).catch(() => {});
  loadBranchDataForYear(curYear);
  loadQuarterGoalData();
}

async function loadBranchDataForYear(year) {
  try {
    const [avSnap, ctSnap, prevCtSnap, prevAvSnap] = await Promise.all([
      getDoc(doc(db,'artifacts','patek-s','public','data','avenue_annual',String(year))),
      getDoc(doc(db,'artifacts','patek-s','public','data','centum_annual',String(year))),
      getDoc(doc(db,'artifacts','patek-s','public','data','centum_annual',String(year - 1))),
      getDoc(doc(db,'artifacts','patek-s','public','data','avenue_annual',String(year - 1)))
    ]);
    avenueData         = avSnap.exists()     ? avSnap.data()     : {};
    centumData         = ctSnap.exists()     ? ctSnap.data()     : {};
    prevYearCentumData = prevCtSnap.exists() ? prevCtSnap.data() : {};
    prevYearAvenueData = prevAvSnap.exists() ? prevAvSnap.data() : {};
  } catch(e) {
    avenueData = {}; centumData = {}; prevYearCentumData = {}; prevYearAvenueData = {};
  }
  renderChart();
  recalcQuarter();
  autoFillEmptyFields(); // 브랜치 데이터 로드 후 빈 필드 자동 채우기
}

function applyData(d) {
  const sv = (id, val) => {
    const el = document.getElementById(id); if (!el) return;
    el.value = (el.type === 'text' && val != null) ? fmtInput(val) : (val ?? '');
  };
  sv('f-mpdsMin',       d?.mpdsMin ?? 30);
  sv('f-mpdsCurrent',   d?.mpdsCurrent);
  sv('f-mpdsIncoming',  d?.mpdsIncoming);

  // 예상 매출은 항상 재고의 판매예정 항목에서 자동 계산
  _manualSalesLock.expectedSales = false;
  // 현재 매출은 항상 rows(판매완료+선수금)에서 자동 계산
  _manualSalesLock.currentSales = false;

  // goalRateData는 loadQuarterGoalData()에서 별도 로드 (분기 공유)
  // rows는 inventory onSnapshot에서 별도 관리 (재고 목록 양방향 연동)
  recalcAll();
  autoFillEmptyFields();
}

/* ────────── 재계산 ────────── */
function recalcAll() {
  recalcRemain();
  updateGoalDisplay();
  recalcQuarter();
}

function autoFillEmptyFields() {
  recalcRemain();
}

function gn(id) {
  const el = document.getElementById(id);
  if (!el || el.value === '') return 0;
  const n = Number(String(el.value).replace(/,/g,''));
  return isNaN(n) ? 0 : n;
}

function recalcRemain() {
  const expected    = gn('f-expectedSales');
  const current     = gn('f-currentSales');
  const expectedPcs = gn('f-expectedPcs');
  const currentPcs  = gn('f-currentPcs');
  const remSales    = expected - current;
  const remPcs      = expectedPcs - currentPcs;
  const color = remSales > 0 ? '#ff0000' : '#009844';
  const numEl  = document.getElementById('remain-num');
  const unitEl = document.getElementById('remain-unit');
  const pcsEl  = document.getElementById('remain-pcs-row');
  if (numEl)  { numEl.textContent  = fmtN(remSales); numEl.style.color  = color; }
  if (unitEl) { unitEl.style.color = color; }
  if (pcsEl)  { pcsEl.textContent  = `(${remPcs} pcs)`; }
}

function updateGoalDisplay() {
  // goalRateData: 목표(target) 값
  const { total, centum: centumTarget, avenue: avenueTarget } = goalRateData;

  // 현재 분기 월별 달성 합계 (센텀·에비뉴엘 모달 데이터 기준)
  const q = curQuarter();
  const months = quarterMonths(q);
  const centumAchieved = months.reduce((s, m) => s + (Number(centumData[`m${m}`]) || 0), 0);
  const avenueAchieved = months.reduce((s, m) => s + (Number(avenueData[`m${m}`]) || 0), 0);
  const totalAchieved  = centumAchieved + avenueAchieved;

  const setDisp = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // 2열: 월별 입력 합산 달성액
  setDisp('centumGoalAmountDisp', centumAchieved ? fmtW(centumAchieved) : '-');
  setDisp('avenueGoalAmountDisp', avenueAchieved ? fmtW(avenueAchieved) : '-');
  setDisp('totalGoalAmountDisp',  totalAchieved  ? fmtW(totalAchieved)  : '-');

  // 3열: 각 목표 대비 달성률
  const centumRate = centumTarget > 0 ? (centumAchieved / centumTarget * 100).toFixed(1) + '%' : '-';
  const avenueRate = avenueTarget > 0 ? (avenueAchieved / avenueTarget * 100).toFixed(1) + '%' : '-';
  const totalRate  = total > 0        ? (totalAchieved  / total         * 100).toFixed(1) + '%' : '-';
  setDisp('centumGoalRateDisp', centumRate);
  setDisp('avenueGoalRateDisp', avenueRate);
  setDisp('totalGoalRateDisp',  totalRate);

  // 인라인 목표 입력 필드 동기화 (억 단위)
  const qtInput = document.getElementById('qt-total-inline');
  if (qtInput && document.activeElement !== qtInput) {
    qtInput.value = total ? parseFloat((total / 100000000).toFixed(4)) : '';
  }

  // 목표 달성률 프로그레스 바 (전체 기준)
  const overallRate = total > 0 ? totalAchieved / total * 100 : 0;
  const r   = Math.min(overallRate, 100);
  const bar = document.getElementById('mainProgressBar');
  const txt = document.getElementById('mainGoalRateText');
  if (bar) { bar.style.width = r + '%'; bar.textContent = overallRate.toFixed(1) + '%'; }
  if (txt) txt.textContent = overallRate.toFixed(1) + '%';

  // 총 남은 금액 = 전체 목표 - 달성액
  const remain = total - totalAchieved;
  const remEl  = document.getElementById('totalRemainDisplay');
  if (remEl) remEl.textContent = fmtW(Math.max(remain, 0));
}

function recalcQuarter() {
  const q       = curQuarter();
  const months  = quarterMonths(q);
  const achieved    = months.reduce((s, m) => s + (Number(centumData[`m${m}`])      || 0), 0);
  const achievedPcs = months.reduce((s, m) => s + (Number(centumData[`m${m}_pcs`])  || 0), 0);
  const centumTarget = goalRateData.centum || 0;
  const remain  = centumTarget - achieved;
  const rateStr = centumTarget > 0 ? (achieved / centumTarget * 100).toFixed(1) : '0.0';
  const setDisp = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setDisp('quarterGoalRateDisplay',  rateStr + '%');
  setDisp('quarterAchievedDisplay',  fmtW(achieved));
  setDisp('quarterRemainDisplay',    fmtW(Math.max(remain, 0)));
  setDisp('quarterAccumPcsDisplay',  achievedPcs + ' pcs');

  // 센텀 목표 현황의 N분기 목표 인라인 입력 동기화
  const ctInput = document.getElementById('qt-centum-inline');
  if (ctInput && document.activeElement !== ctInput) {
    ctInput.value = centumTarget ? parseFloat((centumTarget / 100000000).toFixed(4)) : '';
  }
}

function recalcMpds() {
  const min      = gn('f-mpdsMin');
  const current  = gn('f-mpdsCurrent');
  const incoming = gn('f-mpdsIncoming');
  const shortage = Math.max(min - current, 0);
  const expected = current + incoming;
  const shortEl  = document.getElementById('mpdsShortText');
  shortEl.textContent = shortage;
  shortEl.className   = shortage > 0 ? 'red' : 'green';
  document.getElementById('mpdsExpectedText').textContent = expected;
}

/* ────────── 차트 (자동 계산) ────────── */
function getChartData() {
  const q      = curQuarter();
  const months = quarterMonths(q);
  // 센텀 데이터만 사용
  return months.map(m => ({
    label:  m === curMonth ? `${m}월 (현재)` : `${m}월`,
    amount: Number(centumData[`m${m}`]) || 0,
    pcs:    Number(centumData[`m${m}_pcs`]) || 0
  }));
}

const MAX_BAR_H = 200;

// 전년 비교 토글
window.togglePrevYear = function() {
  showPrevYear = !showPrevYear;
  const btn = document.getElementById('prevYearToggle');
  if (btn) {
    if (showPrevYear) {
      btn.textContent = '올해만 보기';
      btn.style.background = '#075bd8'; btn.style.color = '#fff'; btn.style.borderColor = '#075bd8';
    } else {
      btn.textContent = '전년 비교';
      btn.style.background = '#fff'; btn.style.color = '#111827'; btn.style.borderColor = '#d9e0ea';
    }
  }
  renderChart();
};

function calcBarH(amt, maxAmt) {
  if (!amt) return 4;
  return Math.max(Math.round((amt / maxAmt) * MAX_BAR_H), 6);
}

function renderChart() {
  const data    = getChartData();
  const wrap    = document.getElementById('chartWrap');
  if (!wrap) return;
  const amounts = data.map(d => d.amount);
  const q = curQuarter();
  const months = quarterMonths(q);

  const growthLabel = (cur, prev) => {
    if (!prev) return '';
    const r = (cur - prev) / prev * 100;
    const s = (r >= 0 ? '+' : '') + r.toFixed(1) + '%';
    const c = r >= 0 ? '#059669' : '#dc2626';
    return `<div style="font-size:10px;font-weight:800;color:${c};margin-top:2px;">${s}</div>`;
  };

  if (showPrevYear) {
    // 전년도 같은 분기 데이터
    const prevAmounts = months.map(m => Number(prevYearCentumData[`m${m}`]) || 0);
    const maxAmt = Math.max(...amounts, ...prevAmounts, 1);

    const legend = `<div style="position:absolute;top:0;right:4px;display:flex;gap:8px;font-size:10px;font-weight:700;color:#374151;">
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:10px;height:10px;background:#2d86ff;display:inline-block;border-radius:2px;flex-shrink:0;"></span>${curYear}년</span>
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:10px;height:10px;background:#9ca3af;display:inline-block;border-radius:2px;flex-shrink:0;"></span>${curYear-1}년</span>
    </div>`;

    wrap.innerHTML = '<div class="chart-unit">(천 원)</div>' + legend + data.map((d, i) => {
      const h  = calcBarH(amounts[i], maxAmt);
      const ph = calcBarH(prevAmounts[i], maxAmt);
      const disp     = amounts[i]     > 0 ? Math.round(amounts[i]     / 1000).toLocaleString('ko-KR') : '-';
      const prevDisp = prevAmounts[i] > 0 ? Math.round(prevAmounts[i] / 1000).toLocaleString('ko-KR') : '-';
      return `<div class="bar-item" style="min-width:70px;">
        <div class="bar-meta" style="line-height:1.3;">
          <div style="color:#0058d6;font-size:11px;font-weight:800;">${disp}</div>
          <div style="color:#9ca3af;font-size:10px;font-weight:700;">${prevDisp}</div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:3px;justify-content:center;">
          <div style="width:26px;height:${h}px;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#2d86ff 0%,#0058d6 100%);"></div>
          <div style="width:26px;height:${ph}px;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#c4c9d4 0%,#9ca3af 100%);"></div>
        </div>
        <div class="bar-month">${d.label||''}</div>
        ${growthLabel(amounts[i], prevAmounts[i])}
      </div>`;
    }).join('');

  } else {
    // 단독 모드
    const prevAmounts = months.map(m => Number(prevYearCentumData[`m${m}`]) || 0);
    const maxAmt = Math.max(...amounts, 1);
    wrap.innerHTML = '<div class="chart-unit">(천 원)</div>' + data.map((d, i) => {
      const h       = calcBarH(amounts[i], maxAmt);
      const dispAmt = amounts[i] > 0 ? Math.round(amounts[i] / 1000).toLocaleString('ko-KR') : '-';
      const pStr    = d.pcs ? `(${d.pcs} pcs)` : '';
      return `<div class="bar-item">
        <div class="bar-meta"><div>${pStr}</div><div>${dispAmt}</div></div>
        <div class="bar" style="height:${h}px;"></div>
        <div class="bar-month">${d.label||''}</div>
        ${growthLabel(amounts[i], prevAmounts[i])}
      </div>`;
    }).join('');
  }
}

/* ────────── 에비뉴엘 모달 (연도 선택 가능) ────────── */
let avModalYear = curYear;
let ctModalYear = curYear;
const modalBranchCache = {}; // { 'av-2025': {...}, 'ct-2024': {...} }

async function loadBranchModalData(prefix, year) {
  const key = `${prefix}-${year}`;
  if (modalBranchCache[key]) return modalBranchCache[key];
  const colName = prefix === 'av' ? 'avenue_annual' : 'centum_annual';
  try {
    const snap = await getDoc(doc(db,'artifacts','patek-s','public','data',colName,String(year)));
    const data = snap.exists() ? snap.data() : {};
    modalBranchCache[key] = data;
    return data;
  } catch(e) { return {}; }
}

function fillBranchModal(prefix, data) {
  const isCur = (prefix === 'av' ? avModalYear : ctModalYear) === curYear;
  const cq = curQuarter();
  for (let q = 1; q <= 4; q++) {
    const hdr = document.getElementById(`${prefix === 'av' ? 'av' : 'ct'}-qtr-hdr-${q}`);
    if (hdr) hdr.className = `av-qtr-hdr${(isCur && q === cq) ? ' cur' : ''}`;
  }
  for (let m = 1; m <= 12; m++) {
    const amtEl = document.getElementById(`${prefix}-m${m}`);
    const pcsEl = document.getElementById(`${prefix}-p${m}`);
    if (amtEl) amtEl.value = fmtInput(data[`m${m}`]);
    if (pcsEl) pcsEl.value = fmtInput(data[`m${m}_pcs`]);
  }
  window.calcBranchSub(prefix);
}

async function openBranchModal(prefix) {
  const yr = prefix === 'av' ? avModalYear : ctModalYear;
  const labelId = prefix === 'av' ? 'avenueYearLabel' : 'centumYearLabel';
  const modalId = prefix === 'av' ? 'avenueModal' : 'centumModal';
  document.getElementById(labelId).textContent = yr;
  // 현재 연도면 메모리 데이터 사용, 다른 연도면 Firebase에서 로드
  let data;
  if (yr === curYear) {
    data = prefix === 'av' ? avenueData : centumData;
  } else {
    data = await loadBranchModalData(prefix, yr);
  }
  fillBranchModal(prefix, data);
  document.getElementById(modalId).classList.add('show');
}

window.changeAvYear = async function(delta) {
  avModalYear += delta;
  document.getElementById('avenueYearLabel').textContent = avModalYear;
  let data;
  if (avModalYear === curYear) data = avenueData;
  else data = await loadBranchModalData('av', avModalYear);
  fillBranchModal('av', data);
};

window.changeCtYear = async function(delta) {
  ctModalYear += delta;
  document.getElementById('centumYearLabel').textContent = ctModalYear;
  let data;
  if (ctModalYear === curYear) data = centumData;
  else data = await loadBranchModalData('ct', ctModalYear);
  fillBranchModal('ct', data);
};

document.getElementById('avenueOpen').addEventListener('click', () => {
  avModalYear = curYear;
  openBranchModal('av');
});
document.getElementById('avenueClose').addEventListener('click', () =>
  document.getElementById('avenueModal').classList.remove('show'));

document.getElementById('avenueApply').addEventListener('click', () => {
  const yr = avModalYear;
  const saveObj = { updatedAt: new Date().toISOString() };
  const newData = {};
  for (let m = 1; m <= 12; m++) {
    const amt = parseNum(document.getElementById(`av-m${m}`)?.value);
    const pcs = parseNum(document.getElementById(`av-p${m}`)?.value);
    saveObj[`m${m}`]     = amt;
    saveObj[`m${m}_pcs`] = pcs;
    newData[`m${m}`]     = amt || 0;
    newData[`m${m}_pcs`] = pcs || 0;
  }
  modalBranchCache[`av-${yr}`] = newData;
  if (yr === curYear) { avenueData = newData; renderChart(); recalcQuarter(); }
  document.getElementById('avenueModal').classList.remove('show');
  setDoc(doc(db,'artifacts','patek-s','public','data','avenue_annual',String(yr)), saveObj, {merge:true})
    .catch(e => console.error('avenue save:', e));
});

/* ────────── 센텀 모달 (연도 선택 가능) ────────── */
document.getElementById('centumOpen').addEventListener('click', () => {
  ctModalYear = curYear;
  openBranchModal('ct');
});
document.getElementById('centumClose').addEventListener('click', () =>
  document.getElementById('centumModal').classList.remove('show'));

document.getElementById('centumApply').addEventListener('click', () => {
  const yr = ctModalYear;
  const saveObj = { updatedAt: new Date().toISOString() };
  const newData = {};
  for (let m = 1; m <= 12; m++) {
    const amt = parseNum(document.getElementById(`ct-m${m}`)?.value);
    const pcs = parseNum(document.getElementById(`ct-p${m}`)?.value);
    saveObj[`m${m}`]     = amt;
    saveObj[`m${m}_pcs`] = pcs;
    newData[`m${m}`]     = amt || 0;
    newData[`m${m}_pcs`] = pcs || 0;
  }
  modalBranchCache[`ct-${yr}`] = newData;
  if (yr === curYear) {
    centumData = newData;
    renderChart();
    recalcQuarter();
    const sync = { updatedAt: new Date().toISOString() };
    for (let m = 1; m <= 12; m++) { sync[`m${m}`] = newData[`m${m}`]; sync[`m${m}_pcs`] = newData[`m${m}_pcs`]; }
    setDoc(doc(db,'artifacts','patek-s','public','data','centum_annual',String(yr)), sync, {merge:true})
      .catch(e => console.error('centum-sync:', e));
  } else {
    setDoc(doc(db,'artifacts','patek-s','public','data','centum_annual',String(yr)), saveObj, {merge:true})
      .catch(e => console.error('centum save:', e));
  }
  document.getElementById('centumModal').classList.remove('show');
});

/* ────────── 분기 목표 인라인 입력 (억 단위) ────────── */
window.onQtCentumChange = function(val) {
  const 억 = parseFloat(val) || 0;
  goalRateData.centum = Math.round(억 * 100000000);
  updateGoalDisplay();
  recalcQuarter();
  saveQuarterGoalData();
};

window.onQtTotalChange = function(val) {
  const 억 = parseFloat(val) || 0;
  goalRateData.total = Math.round(억 * 100000000);
  updateGoalDisplay();
  recalcQuarter();
  saveQuarterGoalData();
};

/* ────────── 목표 달성률 모달 ────────── */
window.calcGoalRate = function() {
  // 달성률 표시 제거됨 — 메인 화면에서 표시
};

document.getElementById('goalRateOpen').addEventListener('click', () => {
  document.getElementById('gm-total').value  = fmtInput(goalRateData.total  || null);
  document.getElementById('gm-centum').value = fmtInput(goalRateData.centum || null);
  document.getElementById('gm-avenue').value = fmtInput(goalRateData.avenue || null);
  window.calcGoalRate();
  document.getElementById('goalRateModal').classList.add('show');
});

document.getElementById('goalRateClose').addEventListener('click', () =>
  document.getElementById('goalRateModal').classList.remove('show'));

document.getElementById('goalRateApply').addEventListener('click', () => {
  const total  = parseNum(document.getElementById('gm-total')?.value)  || 0;
  const centum = parseNum(document.getElementById('gm-centum')?.value) || 0;
  const avenue = parseNum(document.getElementById('gm-avenue')?.value) || 0;
  const rate   = total > 0 ? (centum + avenue) / total * 100 : 0;

  goalRateData = { total, centum, avenue };

  updateGoalDisplay();
  recalcQuarter();
  saveQuarterGoalData(); // 분기 문서에 저장 → 같은 분기 다른 달에서도 자동 반영
  document.getElementById('goalRateModal').classList.remove('show');
});

/* ────────── 매출 표 정렬 상태 ────────── */
let saleSortKey = '';
let saleSortDir = 0; // 0=기본 1=오름차순 -1=내림차순

const SALE_SORT_COLS = ['ref','serial','amount','customer','saleDate'];
function saleUpdateSortIcons() {
  SALE_SORT_COLS.forEach(k => {
    const el = document.getElementById('ssi-' + k);
    if (!el) return;
    if (k !== saleSortKey || saleSortDir === 0) el.innerHTML = '<span style="font-size:13px;color:#9ca3af;margin-left:3px;line-height:1;">↕</span>';
    else if (saleSortDir === 1)                 el.innerHTML = '<span style="font-size:13px;color:#075bd8;margin-left:3px;line-height:1;font-weight:700;">▲</span>';
    else                                        el.innerHTML = '<span style="font-size:13px;color:#075bd8;margin-left:3px;line-height:1;font-weight:700;">▼</span>';
  });
}
window.saleSortBy = function(key) {
  if (saleSortKey !== key) { saleSortKey = key; saleSortDir = 1; }
  else if (saleSortDir === 1)  saleSortDir = -1;
  else if (saleSortDir === -1) { saleSortKey = ''; saleSortDir = 0; }
  else                          saleSortDir = 1;
  saleUpdateSortIcons();
  renderTable();
};

/* ────────── 재고 테이블 ────────── */
function renderTable() {
  updateTabCounts();
  saleUpdateSortIcons();
  const tbody    = document.getElementById('inventoryTbody');
  const q = searchQuery.trim().toLowerCase();
  let filtered = activeFilters.has('전체') ? rows : rows.filter(r => activeFilters.has(r.status));
  if (q) filtered = filtered.filter(r =>
    (r.customer||'').toLowerCase().includes(q) ||
    (r.ref||'').toLowerCase().includes(q) ||
    (r.serial||'').toLowerCase().includes(q)
  );
  if (saleSortKey && saleSortDir !== 0) {
    const dir = saleSortDir;
    filtered.sort((a, b) => {
      if (saleSortKey === 'amount')   return ((Number(a.amount)||0) - (Number(b.amount)||0)) * dir;
      if (saleSortKey === 'saleDate') { const da=(a.saleDate||''), db=(b.saleDate||''); return da.localeCompare(db) * dir; }
      return ((a[saleSortKey]||'').toString().toLowerCase()).localeCompare(((b[saleSortKey]||'').toString().toLowerCase()), 'ko-KR', {numeric:true}) * dir;
    });
  }
  tbody.innerHTML = '';

  filtered.forEach((r) => {
    const ri    = rows.indexOf(r);
    const amtFmt = fmtInput(r.amount) || '';
    const tr    = document.createElement('tr');
    tr.dataset.status = r.status || '';
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-amount="${r.amount||0}" data-status="${r.status||''}"/></td>
      <td><input class="td-edit" value="${esc(r.ref||'')}" oninput="window.invSet(${ri},'ref',this.value)" placeholder="REF."/></td>
      <td><input class="td-edit" value="${esc(r.serial||'')}" oninput="window.invSet(${ri},'serial',this.value)" placeholder="Serial"/></td>
      <td><input class="td-edit" type="text" inputmode="numeric" value="${r.qty??1}" oninput="window.invSet(${ri},'qty',+this.value||1)" placeholder="1" style="text-align:center;width:100%;"/></td>
      <td><div class="amt-cell">
        <input class="td-edit amt" type="text" inputmode="numeric" value="${amtFmt}"
          oninput="window.invSetAmt(${ri},this)"
          placeholder="0"/>
        <span class="amt-unit">원</span>
      </div></td>
      <td><input class="td-edit" value="${esc(r.customer||'')}" oninput="window.invSet(${ri},'customer',this.value)" placeholder="고객명"/></td>
      <td><input class="td-edit" value="${esc(r.saleDate||'')}" oninput="window.invSet(${ri},'saleDate',this.value)" placeholder="예: 6/28"/></td>
      <td class="editable-cell" onclick="window.invStatusDD(event,${ri})">
        <span class="status-sel ${statusSelClass(r.status)}" style="pointer-events:none;">${STATUS_DISPLAY[r.status]||r.status||'잔여재고'}</span>
      </td>
      <td><input class="td-edit" value="${esc(r.note||'')}" oninput="window.invSet(${ri},'note',this.value)" placeholder="비고"/></td>`;
    tbody.appendChild(tr);
  });

  renderTfoot(filtered);
  renderSummary();
  bindCheckboxes();
  updateSelectedTotal();
  autoCalcFromInventory();
  autoCalcCurrentSales();
}

function renderTfoot(filtered) {
  const total = filtered.reduce((s,r) => s + (Number(r.amount)||0), 0);
  const pcs   = filtered.filter(r => !IS_NO_PCS(r.status)).length;
  const filterLabel = activeFilters.has('전체') ? '전체' : [...activeFilters].map(f => STATUS_DISPLAY[f]||f).join('+');
  document.getElementById('inventoryTfoot').innerHTML = `<tr>
    <td colspan="2">${filterLabel} 합계</td>
    <td></td>
    <td></td>
    <td>${fmtW(total)}</td>
    <td colspan="4">${pcsLabel(pcs)}</td>
  </tr>`;
}

const SALES_PILL_CLASS = {
  '전체':'active','등록':'active-blue','판매예정':'active-green','컨펌예정':'active-orange',
  '이월예정':'active-blue','AS':'active-red','기타':'active-purple',
  '잔여재고':'active-black','판매완료':'active-teal','선수금':'active-cyan','반품':'active-refund'
};
function updateTabCounts() {
  document.querySelectorAll('.filter-pill').forEach(tab => {
    const f = tab.dataset.filter;
    if (f === '전체') return;
    const displayName = STATUS_DISPLAY[f] || f;
    const cnt = rows.filter(r => r.status === f).length;
    tab.textContent = `${displayName} (${cnt})`;
  });
}

function renderSummary() {
  // 요청 순서: 전체 재고, 판매 완료, 선수금, 반품, 판매 예정, 컨펌 예정, 이월 예정, 잔여 재고, AS, 기타, MPDS 등록 중
  const ORDER  = ['전체','판매완료','선수금','반품','판매예정','컨펌예정','이월예정','잔여재고','AS','기타','등록'];
  const LABELS = { '전체':'전체 재고','판매완료':'판매 완료','선수금':'선수금','반품':'반품','판매예정':'판매 예정','컨펌예정':'컨펌 예정','이월예정':'이월 예정','잔여재고':'잔여 재고','AS':'AS','기타':'기타(이동)','등록':'MPDS 등록 중' };
  const COLORS = { '전체':'black','판매완료':'amber','선수금':'black','반품':'refund','판매예정':'green','컨펌예정':'orange','이월예정':'blue','잔여재고':'black','AS':'red','기타':'black','등록':'blue' };
  const TD = 'style="text-align:center;padding:11px 12px;"';

  const summary = {};
  ORDER.forEach(s => { summary[s] = { qty:0, amount:0 }; });
  rows.forEach(r => {
    const s   = r.status || '잔여재고';
    const pcs = IS_NO_PCS(s) ? 0 : 1;
    const amt = Number(r.amount)||0;
    if (summary[s] !== undefined) { summary[s].qty += pcs; summary[s].amount += amt; }
    else { summary['기타'].qty += pcs; summary['기타'].amount += amt; }
    summary['전체'].qty += pcs; summary['전체'].amount += amt;
  });
  document.getElementById('summaryTbody').innerHTML = ORDER.map(s => {
    const qtyDisp = pcsLabel(summary[s].qty);
    return `<tr><td ${TD} class="${COLORS[s]}">${LABELS[s]}</td><td ${TD}>${qtyDisp}</td><td ${TD}>${fmtW(summary[s].amount)}</td></tr>`;
  }).join('');
}

/* ── 판매예정 + 판매완료 + 선수금 합산 → 예상 매출 자동 반영 ── */
function autoCalcFromInventory() {
  if (_manualSalesLock.expectedSales) { recalcRemain(); return; }
  const filtered = rows.filter(r => r.status === '판매예정' || r.status === '판매완료' || r.status === '선수금');
  const totalAmt = filtered.reduce((s, r) => s + (Number(r.amount)||0), 0);
  const totalPcs = filtered.length;
  const salesEl = document.getElementById('f-expectedSales');
  const pcsEl   = document.getElementById('f-expectedPcs');
  if (salesEl && document.activeElement !== salesEl) {
    salesEl.value = totalAmt > 0 ? totalAmt.toLocaleString('ko-KR') : '';
  }
  if (pcsEl && document.activeElement !== pcsEl) {
    pcsEl.value = totalPcs > 0 ? String(totalPcs) : '';
    pcsEl.style.width = Math.max(2, pcsEl.value.length || 1) + 'ch';
  }
  recalcRemain();
}

/* ── 판매완료 + 선수금 합산 (반품 차감) → 현재 매출 자동 반영 ── */
function autoCalcCurrentSales() {
  if (_manualSalesLock.currentSales) { recalcRemain(); return; }
  const completed = rows.filter(r => r.status === '판매완료');
  const advances  = rows.filter(r => r.status === '선수금');
  const refunds   = rows.filter(r => r.status === '반품');
  const totalAmt  = [...completed, ...advances, ...refunds].reduce((s, r) => s + (Number(r.amount)||0), 0);
  const donePcs   = completed.length;
  const advPcs    = advances.length;
  const refPcs    = refunds.length;
  const salesEl   = document.getElementById('f-currentSales');
  const pcsEl     = document.getElementById('f-currentPcs');
  const pcsDisp   = document.getElementById('currentPcsDisplay');
  if (salesEl && document.activeElement !== salesEl) {
    salesEl.value = totalAmt !== 0 ? totalAmt.toLocaleString('ko-KR') : '';
  }
  if (pcsEl) {
    pcsEl.value = donePcs > 0 ? String(donePcs) : '';
  }
  if (pcsDisp) {
    const parts = [];
    if (donePcs > 0) parts.push(pcsLabel(donePcs));
    if (advPcs  > 0) parts.push(`선수금 ${pcsLabel(advPcs)}`);
    if (refPcs  > 0) parts.push(`반품 ${pcsLabel(refPcs)}`);
    pcsDisp.textContent = parts.length ? `(${parts.join(' · ')})` : '(-)';
  }
  recalcRemain();
}

/* ── inline 핸들러용 window 노출 (module scope → global scope 접근) ── */
window.invSet = function(ri, key, val) {
  if (!rows[ri]) return;
  rows[ri][key] = val;
  // REF 입력 시 Collection 자동 매칭
  if (key === 'ref' && val) {
    const matched = getLineForRef(val);
    if (matched) rows[ri].line = matched;
  }
  window.markDirty && window.markDirty();
};
window.invSetAmt = function(ri, el) {
  window.fmtNum(el);
  el.size = Math.max(3, el.value.length) + 1;
  if (rows[ri]) rows[ri].amount = parseNum(el.value);
  const cb = el.closest('tr') && el.closest('tr').querySelector('.row-check');
  if (cb) cb.dataset.amount = parseNum(el.value) || 0;
  updateSelectedTotal();
  renderSummary();
  autoCalcFromInventory();
  autoCalcCurrentSales();
  window.markDirty && window.markDirty();
};
let _invDD = null;
function closeInvDD() { if (_invDD) { _invDD.remove(); _invDD = null; } }
window.invStatusDD = function(e, ri) {
  e.stopPropagation();
  closeInvDD();
  const rect = e.currentTarget.getBoundingClientRect();
  const dd = document.createElement('div');
  dd.className = 'inline-dd';
  STATUSES.forEach(s => {
    const opt = document.createElement('div');
    opt.className = 'inline-dd-opt' + (rows[ri] && rows[ri].status === s ? ' active' : '');
    opt.textContent = STATUS_DISPLAY[s] || s;
    opt.onclick = ev => {
      ev.stopPropagation();
      closeInvDD();
      if (!rows[ri]) return;
      if (s === '판매완료' || s === '선수금') {
        showSaleCompleteDialog(ri, s);
      } else {
        rows[ri].status = s;
        renderTable();
        window.markDirty && window.markDirty();
      }
    };
    dd.appendChild(opt);
  });
  document.body.appendChild(dd);
  _invDD = dd;
  dd.style.top  = Math.min(rect.bottom + 4, window.innerHeight - dd.offsetHeight - 8) + 'px';
  dd.style.left = Math.max(4, rect.left + (rect.width - dd.offsetWidth) / 2) + 'px';
  setTimeout(() => {
    document.addEventListener('click', function h() { closeInvDD(); document.removeEventListener('click', h); }, { once: true });
  }, 0);
};
window.invChStatus = function(ri, val, el) {
  if (rows[ri]) rows[ri].status = val;
  el.className = 'status-sel ' + statusSelClass(val);
  renderTable();
  window.markDirty && window.markDirty();
};

/* ── 판매 완료 입력 다이얼로그 ── */
function showSaleCompleteDialog(ri, targetStatus) {
  const r    = rows[ri];
  if (!r) return;
  const status   = targetStatus || '판매완료';
  const autoLine = getLineForRef(r.ref) || r.line || '';
  const modal    = document.getElementById('saleCompleteModal');
  if (!modal) return;

  // 다이얼로그 타이틀·색상·버튼 동적 변경
  const isAdv     = status === '선수금';
  const color     = isAdv ? '#0891b2' : '#d97706';
  const titleEl   = modal.querySelector('div[style*="font-size:18px"]');
  const confirmBtn= document.getElementById('scConfirm');
  if (titleEl)    { titleEl.textContent = isAdv ? '✔ 선수금 등록' : '✔ 판매 완료 등록'; titleEl.style.color = color; }
  if (confirmBtn) confirmBtn.style.background = color;

  // 직원 select 채우기
  const selEl = document.getElementById('scSalesperson');
  if (selEl) {
    selEl.innerHTML = '<option value="">선택 안 함</option>' +
      _staffList.map(u => {
        const name = u.name || u.displayName || u.email || u.id;
        return `<option value="${name}">${name}</option>`;
      }).join('');
    selEl.value = r.salesperson || _currentUserName || '';
  }
  document.getElementById('scRegion').value = r.region || '';
  document.getElementById('scLine').value   = autoLine;
  const today = new Date();
  document.getElementById('scDate').value   = r.saleCompletedDate || `${today.getFullYear()}.${today.getMonth()+1}.${today.getDate()}`;

  modal.style.display = 'flex';

  document.getElementById('scCancel').onclick = () => { modal.style.display = 'none'; };
  document.getElementById('scConfirm').onclick = () => {
    const region = (document.getElementById('scRegion')?.value || '').trim();
    const staff  = document.getElementById('scSalesperson')?.value || '';
    const date   = (document.getElementById('scDate')?.value || '').trim();
    const line   = document.getElementById('scLine')?.value || autoLine;
    if (!date)   { alert('판매일을 입력해 주세요.'); return; }
    if (!region) { alert('지역을 입력해 주세요.'); return; }
    if (!staff)  { alert('판매 직원을 선택해 주세요.'); return; }
    if (!line)   { alert('Collection 정보가 없습니다. 설정에서 Collection을 먼저 등록해 주세요.'); return; }
    r.status            = status;
    r.region            = region;
    r.salesperson       = staff;
    r.line              = line;
    r.saleCompletedDate = date;
    modal.style.display = 'none';
    renderTable();
    window.markDirty && window.markDirty();
  };
}
window.showSaleCompleteDialog = showSaleCompleteDialog;

/* ── 현재 매출 리스트 패널 ── */
window.openSalesList = function() {
  const panel = document.getElementById('salesListPanel');
  if (!panel) return;
  const lbl = document.getElementById('slpMonthLabel');
  if (lbl) lbl.textContent = `${curYear}년 ${curMonth}월`;
  panel.style.display = 'block';
  buildSlpFilters();
  window.renderSalesList();
};
window.closeSalesList = function() {
  const panel = document.getElementById('salesListPanel');
  if (panel) panel.style.display = 'none';
};

function getSlpRows() {
  return rows.filter(r => r.status === '판매완료' || r.status === '선수금');
}

function buildSlpFilters() {
  const slpRows = getSlpRows();
  const regions   = ['전체', ...new Set(slpRows.map(r => r.region||'미입력').filter(Boolean))];
  const lines     = ['전체', ...new Set(slpRows.map(r => r.line||'미분류').filter(Boolean))];
  const staffList = ['전체', ...new Set(slpRows.map(r => r.salesperson||'미입력').filter(Boolean))];

  const buildOpts = (arr, el) => {
    const s = document.getElementById(el);
    if (!s) return;
    const cur = s.value || '전체';
    s.innerHTML = arr.map(v => `<option value="${v}">${v}</option>`).join('');
    s.value = arr.includes(cur) ? cur : '전체';
  };
  buildOpts(regions,   'slpRegionFilter');
  buildOpts(lines,     'slpLineFilter');
  buildOpts(staffList, 'slpStaffFilter');
}

window.resetSlpFilters = function() {
  ['slpSearch','slpRegionFilter','slpLineFilter','slpStaffFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT') el.value = '';
    else el.value = '전체';
  });
  window.renderSalesList();
};

window.renderSalesList = function() {
  const kw     = (document.getElementById('slpSearch')?.value||'').toLowerCase().trim();
  const region = document.getElementById('slpRegionFilter')?.value || '전체';
  const line   = document.getElementById('slpLineFilter')?.value   || '전체';
  const staff  = document.getElementById('slpStaffFilter')?.value  || '전체';

  let list = getSlpRows();
  if (kw)           list = list.filter(r => [(r.customer||''),(r.ref||''),(r.serial||'')].some(v=>v.toLowerCase().includes(kw)));
  if (region !== '전체') list = list.filter(r => (r.region||'미입력') === region);
  if (line   !== '전체') list = list.filter(r => (r.line||'미분류')   === line);
  if (staff  !== '전체') list = list.filter(r => (r.salesperson||'미입력') === staff);

  const doneList = list.filter(r => r.status === '판매완료');
  const advList  = list.filter(r => r.status === '선수금');
  const totalAmt = list.reduce((s,r)=>s+(Number(r.amount)||0), 0);

  const qtyEl = document.getElementById('slpTotalQty');
  if (qtyEl) {
    const doneN = doneList.length;
    const advN  = advList.length;
    if (advN === 0) qtyEl.textContent = pcsLabel(doneN);
    else qtyEl.textContent = `${pcsLabel(doneN)} (선수금 ${pcsLabel(advN)})`;
  }
  const amtEl = document.getElementById('slpTotalAmt');
  if (amtEl) amtEl.textContent = fmtW(totalAmt);

  const tbody = document.getElementById('slpTbody');
  if (tbody) {
    tbody.innerHTML = list.map((r, i) => {
      const isAdv   = r.status === '선수금';
      const dateStr = r.saleCompletedDate || r.saleDate || '-';
      return `<tr style="border-bottom:1px solid #f0f2f6;${isAdv?'background:#f0fdff;':''}">
        <td style="padding:9px 14px;font-size:13px;text-align:center;color:#6b7280;">${i+1}</td>
        <td style="padding:9px 14px;font-size:13px;text-align:center;">${esc(dateStr)}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:700;">${esc(r.ref||'-')}</td>
        <td style="padding:9px 14px;font-size:13px;color:#6b7280;">${esc(r.serial||'-')}</td>
        <td style="padding:9px 14px;font-size:13px;text-align:right;font-weight:700;">${fmtW(r.amount)}</td>
        <td style="padding:9px 14px;font-size:13px;">${esc(r.customer||'-')}</td>
        <td style="padding:9px 14px;font-size:13px;">${esc(r.region||'-')}</td>
        <td style="padding:9px 14px;font-size:13px;">${esc(r.line||'-')}</td>
        <td style="padding:9px 14px;font-size:13px;color:#6b7280;">${esc(r.note||'-')}${isAdv?'<span style="margin-left:6px;background:#cffafe;color:#0891b2;font-size:11px;font-weight:900;padding:1px 6px;border-radius:10px;">선수금</span>':''}</td>
        <td style="padding:9px 14px;font-size:13px;">${esc(r.salesperson||'-')}</td>
      </tr>`;
    }).join('');
  }

  // Collection별 요약
  const lineStat = {};
  doneList.forEach(r => {
    const k = r.line || '미분류';
    if (!lineStat[k]) lineStat[k] = {qty:0,amt:0};
    lineStat[k].qty++; lineStat[k].amt += Number(r.amount)||0;
  });
  const lsBody = document.getElementById('slpLineSummaryBody');
  if (lsBody) {
    lsBody.innerHTML = Object.entries(lineStat).sort((a,b)=>b[1].qty-a[1].qty).map(([k,v]) =>
      `<tr style="border-bottom:1px solid #f0f2f6;">
        <td style="padding:8px 14px;font-size:13px;font-weight:700;">${esc(k)}</td>
        <td style="padding:8px 14px;font-size:13px;text-align:right;">${pcsLabel(v.qty)}</td>
        <td style="padding:8px 14px;font-size:13px;text-align:right;font-weight:700;">${fmtW(v.amt)}</td>
      </tr>`
    ).join('') || '<tr><td colspan="3" style="padding:12px 14px;text-align:center;color:#9ca3af;font-size:13px;">데이터 없음</td></tr>';
  }

  // 지역별 요약
  const regionStat = {};
  doneList.forEach(r => {
    const k = r.region || '미입력';
    if (!regionStat[k]) regionStat[k] = {qty:0,amt:0};
    regionStat[k].qty++; regionStat[k].amt += Number(r.amount)||0;
  });
  const rsBody = document.getElementById('slpRegionSummaryBody');
  if (rsBody) {
    rsBody.innerHTML = Object.entries(regionStat).sort((a,b)=>b[1].qty-a[1].qty).map(([k,v]) =>
      `<tr style="border-bottom:1px solid #f0f2f6;">
        <td style="padding:8px 14px;font-size:13px;font-weight:700;">${esc(k)}</td>
        <td style="padding:8px 14px;font-size:13px;text-align:right;">${pcsLabel(v.qty)}</td>
        <td style="padding:8px 14px;font-size:13px;text-align:right;font-weight:700;">${fmtW(v.amt)}</td>
      </tr>`
    ).join('') || '<tr><td colspan="3" style="padding:12px 14px;text-align:center;color:#9ca3af;font-size:13px;">데이터 없음</td></tr>';
  }
};

window.exportSalesListExcel = function() {
  if (!window.XLSX) { alert('XLSX 라이브러리 로딩 중입니다.'); return; }
  const list = getSlpRows();
  const headers = ['No','판매일','REF.','Serial','금액','고객명','지역','Collection','비고','판매 직원','구분'];
  const data = list.map((r,i) => [
    i+1,
    r.saleCompletedDate||r.saleDate||'',
    r.ref||'', r.serial||'',
    r.amount||0, r.customer||'',
    r.region||'', r.line||'',
    r.note||'', r.salesperson||'',
    r.status === '선수금' ? '선수금' : '판매 완료'
  ]);
  const ws = window.XLSX.utils.aoa_to_sheet([headers,...data]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, `판매내역_${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb, `판매내역_${curYear}년${curMonth}월.xlsx`);
};
window.invDelRow = function(ri) {
  rows.splice(ri, 1);
  renderTable();
  window.markDirty && window.markDirty();
};

/* ── 탭 필터 (복수 선택) ── */
function applySalesPillClasses() {
  document.querySelectorAll('.filter-pill').forEach(p => {
    const f = p.dataset.filter;
    const on = activeFilters.has(f);
    p.className = 'filter-pill' + (on ? ' ' + (SALES_PILL_CLASS[f] || 'active') : '');
  });
}
window.invSearch = function(val) {
  searchQuery = val;
  renderTable();
};

document.getElementById('tabsBar').addEventListener('click', e => {
  const pill = e.target.closest('.filter-pill');
  if (!pill) return;
  const f = pill.dataset.filter;
  if (f === '전체') {
    activeFilters = new Set(['전체']);
  } else {
    activeFilters.delete('전체');
    activeFilters.has(f) ? activeFilters.delete(f) : activeFilters.add(f);
    if (activeFilters.size === 0) activeFilters.add('전체');
  }
  applySalesPillClasses();
  renderTable();
});

/* ── 체크박스 ── */
function bindCheckboxes() {
  document.querySelectorAll('.row-check').forEach(cb => cb.addEventListener('change', updateSelectedTotal));
  document.getElementById('checkAll').addEventListener('change', function() {
    document.querySelectorAll('.row-check').forEach(cb => { cb.checked = this.checked; });
    updateSelectedTotal();
  });
}

function updateSelectedTotal() {
  let qty = 0, amount = 0;
  document.querySelectorAll('.row-check:checked').forEach(cb => {
    if (!IS_NO_PCS(cb.dataset.status)) qty++;
    amount += Number(cb.dataset.amount)||0;
  });
  document.getElementById('selectedQty').textContent    = pcsLabel(qty);
  document.getElementById('selectedAmount').textContent = fmtW(amount);
}

/* ── 행 추가 / 선택 삭제 / 전체 삭제 ── */
const addRowBtn = document.getElementById('addRowBtn');
if (addRowBtn) {
  addRowBtn.addEventListener('click', () => {
    rows.push({ ref:'', serial:'', amount:null, customer:'', saleDate:'', status:'판매예정', note:'' });
    renderTable();
    window.markDirty && window.markDirty();
  });
}

const delSelBtn = document.getElementById('delSelBtn');
if (delSelBtn) {
  delSelBtn.addEventListener('click', () => {
    const checked = document.querySelectorAll('#inventoryTbody .row-check:checked');
    if (checked.length === 0) { alert('삭제할 행을 선택해주세요.'); return; }
    if (!confirm(`선택한 ${checked.length}건을 삭제하시겠습니까?`)) return;
    const filtered = activeFilters.has('전체') ? rows : rows.filter(r => activeFilters.has(r.status));
    const toDelete = new Set();
    checked.forEach(cb => {
      const tr  = cb.closest('tr');
      const idx = [...tr.parentElement.children].indexOf(tr);
      if (filtered[idx]) toDelete.add(rows.indexOf(filtered[idx]));
    });
    rows = rows.filter((_, i) => !toDelete.has(i));
    renderTable();
    window.markDirty && window.markDirty();
  });
}

const delAllBtn = document.getElementById('delAllBtn');
if (delAllBtn) {
  delAllBtn.addEventListener('click', () => {
    if (rows.length === 0) { alert('삭제할 데이터가 없습니다.'); return; }
    if (!confirm(`전체 ${rows.length}건을 모두 삭제하시겠습니까?`)) return;
    rows = [];
    renderTable();
    window.markDirty && window.markDirty();
  });
}

/* ── 매출→MPDS 동기화 (REF. 기준) ── */
const SALES_TO_MPDS_STATUS = {
  '판매예정':'판매예정','컨펌예정':'컨펌예정','이월예정':'이월예정',
  '판매완료':'판매 완료','잔여재고':'잔여 재고',
  'AS':'AS','기타':'기타','등록':'등록','선수금':'선수금','반품':'잔여 재고'
};
async function syncSalesToMpds(invRows) {
  const docId = `${curYear}-${pad(curMonth)}`;
  try {
    const snap = await getDoc(doc(db,'artifacts','patek-s','public','data','mpds',docId));
    if (!snap.exists()) return;
    const mpdsInv = (snap.data().inventory||[]).map(r=>({...r}));
    let changed = false;
    invRows.forEach(inv => {
      if (!inv.ref) return;
      const idx = mpdsInv.findIndex(m=>(m.ref||'').toLowerCase()===(inv.ref||'').toLowerCase());
      if (idx < 0) return;
      const ns = SALES_TO_MPDS_STATUS[inv.status];
      if (ns && mpdsInv[idx].status !== ns) { mpdsInv[idx].status = ns; changed = true; }
      if (inv.serial !== undefined && mpdsInv[idx].serial !== inv.serial) { mpdsInv[idx].serial = inv.serial||''; changed = true; }
      if (inv.amount != null && mpdsInv[idx].amount !== Number(inv.amount)) { mpdsInv[idx].amount = Number(inv.amount); changed = true; }
      if (inv.note !== undefined && mpdsInv[idx].note !== inv.note) { mpdsInv[idx].note = inv.note||''; changed = true; }
    });
    if (changed) await setDoc(doc(db,'artifacts','patek-s','public','data','mpds',docId),
      { inventory:mpdsInv, updatedAt:new Date().toISOString() }, {merge:true});
  } catch(e) { console.error('syncSalesToMpds:', e); }
}

/* ── 판매 완료 → 동향 보고(sales_reports) 자동 연동 ── */
async function syncSalesToReport(invRows) {
  const docId   = `${curYear}-${pad(curMonth)}`;
  const done    = invRows.filter(r => r.status === '판매완료' || r.status === '판매 완료');

  // 라인별 집계
  const lineMap = {};
  done.forEach(r => {
    const k = r.line || '미분류';
    if (!lineMap[k]) lineMap[k] = { line:k, qty:0, amount:0, yoy:0 };
    lineMap[k].qty++;
    lineMap[k].amount += Number(r.amount)||0;
  });

  // 지역별 집계
  const regionMap = {};
  done.forEach(r => {
    const k = r.region || '미입력';
    if (!regionMap[k]) regionMap[k] = { region:k, qty:0, amount:0 };
    regionMap[k].qty++;
    regionMap[k].amount += Number(r.amount)||0;
  });

  const salesListData = {
    lineData:   Object.values(lineMap).sort((a,b) => b.qty - a.qty),
    regionData: Object.values(regionMap).sort((a,b) => b.qty - a.qty),
    salesRaw: done.map(r => {
      let m = curMonth;
      const d = r.saleCompletedDate || r.saleDate || '';
      if (d) { const p = new Date(d); if (!isNaN(p.getTime())) m = p.getMonth() + 1; }
      return { line: r.line || '기타', region: r.region || '기타', amount: Number(r.amount) || 0, month: m };
    }),
    totalQty:   done.length,
    totalAmount: done.reduce((s,r)=>s+(Number(r.amount)||0),0),
    updatedAt:  new Date().toISOString()
  };

  try {
    await setDoc(doc(db,'artifacts','patek-s','public','data','sales_reports',docId),
      { salesListData }, {merge:true});
  } catch(e) { console.error('syncSalesToReport:', e); }
}

/* ────────── 저장 ────────── */
async function saveData() {
  const gv  = id => { const el=document.getElementById(id); return el?el.value.trim():''; };
  const gnv = id => { const v=gv(id).replace(/,/g,''); return v!==''?Number(v):null; };

  const data = {
    expectedSales:   gnv('f-expectedSales'),
    expectedPcs:     gnv('f-expectedPcs'),
    lastYearSales:   gnv('f-lastYearSales'),
    lastYearPcs:     gnv('f-lastYearPcs'),
    currentSales:    gnv('f-currentSales'),
    currentPcs:      gnv('f-currentPcs'),
    quarterNum:      getQuarterNum(curMonth),
    mpdsMin:         gnv('f-mpdsMin'),
    mpdsCurrent:     gnv('f-mpdsCurrent'),
    mpdsIncoming:    gnv('f-mpdsIncoming'),
    updatedAt: new Date().toISOString()
  };

  // 재고 목록과 공유: rows는 inventory 컬렉션에 별도 저장
  const invData = {
    rows: rows.map(r => ({
      ref:               r.ref||'',
      serial:            r.serial||'',
      qty:               r.qty != null ? Number(r.qty) : 1,
      amount:            r.amount != null ? Number(r.amount) : null,
      customer:          r.customer||'',
      saleDate:          r.saleDate||'',
      status:            r.status||'판매예정',
      note:              r.note||'',
      region:            r.region||'',
      salesperson:       r.salesperson||'',
      line:              r.line||'',
      saleCompletedDate: r.saleCompletedDate||''
    })),
    updatedAt: new Date().toISOString()
  };

  const btn = document.getElementById('save-btn');
  if (btn) btn.textContent = '저장 중...';
  try {
    await Promise.all([
      setDoc(doc(db,'artifacts','patek-s','public','data','sales_dashboard',`${curYear}-${pad(curMonth)}`), data, {merge:true}),
      setDoc(doc(db,'artifacts','patek-s','public','data','inventory',`${curYear}-${pad(curMonth)}`), invData, {merge:true})
    ]);
    syncSalesToMpds(invData.rows); // REF. 기준으로 MPDS에도 반영
    syncSalesToReport(invData.rows);  // 판매 완료 → 동향 보고 자동 연동

    // 차트용 centum_annual 자동 동기화 (현재 월 실적 → 그래프 연동)
    const cSales = data.currentSales, cPcs = data.currentPcs;
    if (cSales !== null || cPcs !== null) {
      // centumData 메모리 즉시 업데이트 (센텀 모달이 바로 열려도 최신값 반영)
      if (cSales !== null) centumData[`m${curMonth}`]     = cSales;
      if (cPcs   !== null) centumData[`m${curMonth}_pcs`] = cPcs;
      renderChart();
      updateGoalDisplay();
      recalcQuarter();
      // Firebase 백그라운드 저장
      const sync = { updatedAt: new Date().toISOString() };
      if (cSales !== null) sync[`m${curMonth}`]     = cSales;
      if (cPcs   !== null) sync[`m${curMonth}_pcs`] = cPcs;
      setDoc(doc(db,'artifacts','patek-s','public','data','centum_annual',String(curYear)), sync, {merge:true})
        .catch(e => console.error('centum-sync:', e));
    }

    if (btn) btn.textContent = '✔ 저장됨';
    window.markClean && window.markClean();
    setTimeout(() => { if (btn) btn.textContent = '💾 저장하기'; }, 2000);
  } catch(e) {
    alert('저장 실패: '+e.message);
    if (btn) btn.textContent = '💾 저장하기';
  }
}
document.getElementById('save-btn').addEventListener('click', saveData);

/* ────────── 엑셀 ────────── */
document.getElementById('excelBtn').addEventListener('click', () => {
  if (!window.XLSX) { alert('라이브러리 로딩 중입니다.'); return; }
  const header = ['REF.','Serial','금액','고객명','예상 판매일','상태','비고'];
  const data   = rows.map(r => [r.ref, r.serial, r.amount, r.customer, r.saleDate, STATUS_DISPLAY[r.status]||r.status, r.note]);
  const ws = window.XLSX.utils.aoa_to_sheet([header,...data]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, `${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb, `매출현황_${curYear}년${curMonth}월.xlsx`);
});

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ────────── CSV 업로드 ────────── */
window.openCsvUpload = function() {
  const inp = document.getElementById('csvFileInput');
  if (inp) inp.click();
};

function parseCsvLine(line) {
  const res = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
    else cur += c;
  }
  res.push(cur);
  return res;
}

function csvTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

function csvParseAmount(str) {
  const s = String(str||'').replace(/\s/g,'');
  if (!s || s === '-') return 0;
  const n = Number(s.replace(/,/g,''));
  return isNaN(n) ? 0 : n;
}

let _csvOverlay = null;
function showCsvOverlay(msg) {
  if (!_csvOverlay) {
    _csvOverlay = document.createElement('div');
    _csvOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:"Malgun Gothic",Arial,sans-serif;';
    _csvOverlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:28px 36px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.25);min-width:300px;"><div id="_csvMsg" style="font-size:16px;font-weight:900;color:#111827;margin-bottom:6px;"></div><div style="font-size:13px;color:#6b7280;font-weight:600;">잠시만 기다려 주세요...</div></div>';
    document.body.appendChild(_csvOverlay);
  }
  document.getElementById('_csvMsg').textContent = msg;
  _csvOverlay.style.display = 'flex';
}
function updateCsvOverlay(msg) { const el = document.getElementById('_csvMsg'); if (el) el.textContent = msg; }
function hideCsvOverlay() { if (_csvOverlay) _csvOverlay.style.display = 'none'; }

async function processCsvImport(file) {
  showCsvOverlay('파일 읽는 중...');
  let text;
  try { text = await file.text(); } catch(e) { hideCsvOverlay(); alert('파일 읽기 실패: ' + e.message); return; }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) { hideCsvOverlay(); alert('데이터가 없습니다.'); return; }

  const importRows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols          = parseCsvLine(lines[i]);
    if (cols.length < 6) continue;
    const saleDateRaw   = cols[0].trim();
    const ref           = cols[1].trim();
    const serialRaw     = (cols[2] || '').trim();
    const qtyRaw        = (cols[3] || '1').trim();
    const amountRaw     = cols[4] || '';
    const customer      = (cols[5] || '').trim();
    const regionRaw     = (cols[6] || '').trim();
    const collectionRaw = (cols[7] || '').trim();
    if (!saleDateRaw || !ref) continue;
    const dm = saleDateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dm) continue;
    const ym         = `${dm[1]}-${dm[2]}`;
    const serial     = serialRaw.replace(/^[-\s]+$/, '').trim();
    const qty        = Math.max(1, parseInt(qtyRaw) || 1);
    const isAdv      = serial === '';
    const amount     = csvParseAmount(amountRaw);
    const isRefund   = amount < 0;
    const region     = regionRaw.slice(0, 2);
    const collection = csvTitleCase(collectionRaw);
    const status     = isRefund ? '반품' : (isAdv ? '선수금' : '판매완료');
    const note       = isRefund ? '반품' : (isAdv ? '선수금' : '');
    importRows.push({ ym, saleDate: saleDateRaw, ref, serial, qty, amount, customer, region, collection, status, note });
  }

  if (importRows.length === 0) { hideCsvOverlay(); alert('유효한 데이터가 없습니다.'); return; }

  await loadLineConfig();

  // Collection 관리에 없는 REF 파악
  const refToAdd = {};
  importRows.forEach(r => {
    if (!getLineForRef(r.ref) && r.collection) {
      const key = r.collection.toLowerCase();
      if (!refToAdd[key]) refToAdd[key] = { name: r.collection, refs: new Set() };
      refToAdd[key].refs.add(r.ref);
    }
  });
  const newRefCount = Object.values(refToAdd).reduce((s,v) => s + v.refs.size, 0);
  const monthList   = [...new Set(importRows.map(r => r.ym))].sort();

  hideCsvOverlay();
  const confirmMsg = `총 ${importRows.length}개 항목 / ${monthList.length}개 월\n` +
    (newRefCount > 0 ? `새 REF. ${newRefCount}개 → Collection 관리 자동 등록\n` : '') +
    '\n저장하시겠습니까?';
  if (!confirm(confirmMsg)) return;

  showCsvOverlay('Collection 업데이트 중...');

  // lineConfig에 새 REF 추가
  if (Object.keys(refToAdd).length > 0) {
    const pool    = _lineConfig.length > 0 ? _lineConfig : DEFAULT_LINES;
    const updated = pool.map(l => ({ name: l.name, refs: [...(l.refs||[])] }));
    Object.values(refToAdd).forEach(({ name, refs }) => {
      const idx = updated.findIndex(l => l.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0) refs.forEach(ref => { if (!updated[idx].refs.includes(ref)) updated[idx].refs.push(ref); });
      else updated.push({ name, refs: [...refs] });
    });
    _lineConfig = updated;
    try {
      await setDoc(doc(db,'artifacts','patek-s','public','data','lineConfig'),
        { lines: updated, updatedAt: new Date().toISOString() }, { merge: true });
    } catch(e) { console.error('lineConfig 업데이트 실패:', e); }
  }

  // 월별 그룹화
  const byMonth = {};
  importRows.forEach(r => { (byMonth[r.ym] = byMonth[r.ym] || []).push(r); });

  let saved = 0;
  for (const ym of monthList) {
    updateCsvOverlay(`저장 중... (${saved + 1}/${monthList.length}) — ${ym}`);
    try {
      const snap     = await getDoc(doc(db,'artifacts','patek-s','public','data','inventory',ym));
      const existing = snap.exists() ? (snap.data().rows||[]) : [];

      const newRows = byMonth[ym].map(r => ({
        ref: r.ref, serial: r.serial, qty: r.qty||1, amount: r.amount, customer: r.customer,
        saleDate: r.saleDate, saleCompletedDate: r.saleDate,
        status: r.status, note: r.note, region: r.region,
        line: getLineForRef(r.ref) || r.collection, salesperson: ''
      }));

      // 중복 제거 (ref+serial+saleCompletedDate+amount 동일하면 스킵)
      const merged = [...existing];
      newRows.forEach(nr => {
        const dup = existing.some(e =>
          e.ref === nr.ref && e.serial === nr.serial &&
          e.saleCompletedDate === nr.saleCompletedDate && Number(e.amount) === Number(nr.amount)
        );
        if (!dup) merged.push(nr);
      });

      await setDoc(doc(db,'artifacts','patek-s','public','data','inventory',ym),
        { rows: merged, updatedAt: new Date().toISOString() }, { merge: true });

      // sales_dashboard.currentSales 업데이트 (전년 대비 연동)
      const done = merged.filter(r => r.status === '판매완료');
      const adv  = merged.filter(r => r.status === '선수금');
      const currentSales = [...done, ...adv].reduce((s,r) => s+(Number(r.amount)||0), 0);
      await setDoc(doc(db,'artifacts','patek-s','public','data','sales_dashboard',ym),
        { currentSales, currentPcs: done.length, updatedAt: new Date().toISOString() }, { merge: true });

      // sales_reports 업데이트 (동향 보고 연동)
      const lineMap = {}, regionMap = {};
      done.forEach(r => {
        const lk = r.line||'미분류';
        if (!lineMap[lk]) lineMap[lk] = { line:lk, qty:0, amount:0, yoy:0 };
        lineMap[lk].qty++; lineMap[lk].amount += Number(r.amount)||0;
        const rk = r.region||'미입력';
        if (!regionMap[rk]) regionMap[rk] = { region:rk, qty:0, amount:0 };
        regionMap[rk].qty++; regionMap[rk].amount += Number(r.amount)||0;
      });
      const mo = Number(ym.split('-')[1]);
      await setDoc(doc(db,'artifacts','patek-s','public','data','sales_reports',ym), {
        salesListData: {
          lineData:    Object.values(lineMap),
          regionData:  Object.values(regionMap),
          salesRaw:    done.map(r => ({ line:r.line||'기타', region:r.region||'기타', amount:Number(r.amount)||0, month:mo })),
          totalQty:    done.length,
          totalAmount: done.reduce((s,r) => s+(Number(r.amount)||0), 0),
          updatedAt:   new Date().toISOString()
        }
      }, { merge: true });

      saved++;
    } catch(e) { console.error(`${ym} 저장 실패:`, e); }
  }

  hideCsvOverlay();
  alert(`✅ ${saved}개 월 저장 완료 (총 ${importRows.length}개 항목)`);
  loadMonth();
}

// CSV 파일 input 이벤트 연결
{
  const _ci = document.getElementById('csvFileInput');
  if (_ci) _ci.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (f) await processCsvImport(f);
    e.target.value = '';
  });
}

/* ────────── 초기화 ────────── */
initBranchModals();
loadMonth();
