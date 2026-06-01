import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// 재고 상태 순서: 전체 재고, 판매 예정, 컨펌 예정, 이월 예정, AS, 잔여 재고
const STATUSES  = ['판매예정','컨펌예정','이월예정','AS','잔여재고'];
const BADGE_MAP = { '판매예정':'badge-sale','컨펌예정':'badge-confirm','이월예정':'badge-carry','잔여재고':'badge-rest','AS':'badge-as' };

let curYear  = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let rows     = [];
let activeFilters = new Set(['전체']);
let unsubPlan = null;

// 지점 연간 데이터 (인메모리)
let avenueData = {}; // m1..m12: 금액, m1_pcs..m12_pcs: pcs
let centumData = {};

// 목표 달성률 데이터
let goalRateData = { total: 0, centum: 0, avenue: 0, rate: 0 };

/* ────────── 달력 월 피커 ────────── */
let pickerYear = curYear;

function getQuarterNum(month) { return Math.ceil(month / 3); }
function curQuarter() { return getQuarterNum(curMonth); }
function quarterMonths(q) { const s=(q-1)*3+1; return [s,s+1,s+2]; }

function updateQuarterBadge() {
  const el = document.getElementById('quarterBadge');
  if (el) el.textContent = `${getQuarterNum(curMonth)}분기`;
}

function renderPickerGrid() {
  document.getElementById('pickerYearLabel').textContent = `${pickerYear}년`;
  const grid = document.getElementById('pickerMonthGrid');
  grid.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    const btn = document.createElement('button');
    btn.className = 'mpp-month' + (pickerYear === curYear && m === curMonth ? ' sel' : '');
    btn.textContent = `${m}월`;
    btn.onclick = () => selectMonth(pickerYear, m);
    grid.appendChild(btn);
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
    pickerYear = curYear;
    renderPickerGrid();
    const popup = document.getElementById('monthPickerPopup');
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('prevYearBtn').addEventListener('click', e => { e.stopPropagation(); pickerYear--; renderPickerGrid(); });
  document.getElementById('nextYearBtn').addEventListener('click', e => { e.stopPropagation(); pickerYear++; renderPickerGrid(); });
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
  document.getElementById('quarterLabelText').textContent = getQuarterNum(m);
  updateQuarterBadge();
}

/* ────────── Auth ────────── */
document.getElementById('login-btn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { alert('로그인 실패: '+e.message); }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, user => {
  document.getElementById('login-overlay').style.display = user ? 'none' : 'flex';
  if (user) { initMonthPicker(); updateMonthLabels(); loadMonth(); }
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

/* ────────── 데이터 로드 ────────── */
function loadMonth() {
  if (unsubPlan) unsubPlan();
  const docId = `${curYear}-${pad(curMonth)}`;
  unsubPlan = onSnapshot(doc(db,'artifacts','patek-s','public','data','sales_dashboard',docId), snap => {
    applyData(snap.exists() ? snap.data() : null);
  });
  loadBranchDataForYear(curYear);
}

async function loadBranchDataForYear(year) {
  try {
    const [avSnap, ctSnap] = await Promise.all([
      getDoc(doc(db,'artifacts','patek-s','public','data','avenue_annual',String(year))),
      getDoc(doc(db,'artifacts','patek-s','public','data','centum_annual',String(year)))
    ]);
    avenueData = avSnap.exists() ? avSnap.data() : {};
    centumData = ctSnap.exists() ? ctSnap.data() : {};
  } catch(e) {
    avenueData = {}; centumData = {};
  }
  renderChart();
  recalcQuarter();
}

function applyData(d) {
  const sv = (id, val) => {
    const el = document.getElementById(id); if (!el) return;
    el.value = (el.type === 'text' && val != null) ? fmtInput(val) : (val ?? '');
  };
  sv('f-expectedSales', d?.expectedSales);
  sv('f-expectedPcs',   d?.expectedPcs);
  sv('f-lastYearSales', d?.lastYearSales);
  sv('f-lastYearPcs',   d?.lastYearPcs);
  sv('f-currentSales',  d?.currentSales);
  sv('f-currentPcs',    d?.currentPcs);
  sv('f-quarterGoal',   d?.quarterGoal);
  sv('f-mpdsMin',       d?.mpdsMin ?? 30);
  sv('f-mpdsCurrent',   d?.mpdsCurrent);
  sv('f-mpdsIncoming',  d?.mpdsIncoming);

  // pcs 입력 너비 초기화
  ['f-expectedPcs','f-lastYearPcs','f-currentPcs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(2, el.value.length || 1) + 'ch';
  });

  goalRateData = {
    total:  d?.totalGoalAmount ?? 0,
    centum: d?.centumGoalAmount ?? 0,
    avenue: d?.avenueGoalAmount ?? 0,
    rate:   d?.totalGoalRate ?? 0
  };
  updateGoalDisplay();

  rows = d?.rows ? JSON.parse(JSON.stringify(d.rows)) : [];
  renderTable();
  recalcAll();
}

/* ────────── 재계산 ────────── */
function recalcAll() {
  recalcRemain();
  updateGoalDisplay();
  recalcQuarter();
  recalcMpds();
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
  const el = document.getElementById('remainDisplay');
  el.innerHTML = `<span>${fmtN(remSales)}</span>&nbsp;원&nbsp;<span style="font-size:14px;font-weight:700;">(${remPcs} pcs)</span>`;
  el.style.color = remSales > 0 ? '#ff0000' : '#009844';
}

function updateGoalDisplay() {
  const { total, centum, avenue, rate } = goalRateData;

  const setDisp = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setDisp('totalGoalAmountDisp',  total  ? fmtW(total)  : '-');
  setDisp('totalGoalRateDisp',    rate   ? rate.toFixed(1)+'%' : '-');
  setDisp('centumGoalAmountDisp', centum ? fmtW(centum) : '-');
  setDisp('avenueGoalAmountDisp', avenue ? fmtW(avenue) : '-');
  const centumRate = total > 0 ? (centum / total * 100).toFixed(1)+'%' : '-';
  const avenueRate = total > 0 ? (avenue / total * 100).toFixed(1)+'%' : '-';
  setDisp('centumGoalRateDisp', centumRate);
  setDisp('avenueGoalRateDisp', avenueRate);

  const r = Math.min(rate, 100);
  const bar = document.getElementById('mainProgressBar');
  const txt = document.getElementById('mainGoalRateText');
  if (bar) { bar.style.width = r + '%'; bar.textContent = rate.toFixed(1) + '%'; }
  if (txt) txt.textContent = rate.toFixed(1) + '%';

  const remain = total - (centum + avenue);
  const remEl = document.getElementById('totalRemainDisplay');
  if (remEl) remEl.textContent = fmtW(Math.max(remain, 0));
}

function recalcQuarter() {
  const goal    = gn('f-quarterGoal');
  const q       = curQuarter();
  const months  = quarterMonths(q);
  const achieved = months.reduce((s, m) => {
    return s + (Number(avenueData[`m${m}`]) || 0) + (Number(centumData[`m${m}`]) || 0);
  }, 0);
  const remain = goal - achieved;
  const rateStr = goal > 0 ? (achieved / goal * 100).toFixed(1) : '0.0';
  const setDisp = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setDisp('quarterAchievedDisplay', fmtW(achieved));
  setDisp('quarterRemainDisplay',   fmtW(Math.max(remain, 0)));
  setDisp('quarterRateDisplay',     rateStr + '%');
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
  return months.map(m => ({
    label:  m === curMonth ? `${m}월 (현재)` : `${m}월`,
    amount: (Number(avenueData[`m${m}`]) || 0) + (Number(centumData[`m${m}`]) || 0),
    pcs:    (Number(avenueData[`m${m}_pcs`]) || 0) + (Number(centumData[`m${m}_pcs`]) || 0)
  }));
}

const MAX_BAR_H = 200;
function renderChart() {
  const data    = getChartData();
  const wrap    = document.getElementById('chartWrap');
  if (!wrap) return;
  const amounts = data.map(d => Number(d.amount) || 0);
  const maxAmt  = Math.max(...amounts, 1);

  wrap.innerHTML = '<div class="chart-unit">(억 원)</div>' + data.map((d, i) => {
    const h    = Math.round((amounts[i] / maxAmt) * MAX_BAR_H);
    const aStr = amounts[i] > 0 ? Number(amounts[i]).toLocaleString('ko-KR') : '-';
    const pStr = d.pcs ? `(${d.pcs} pcs)` : '';
    return `<div class="bar-item">
      <div class="bar-meta"><div>${pStr}</div><div>${aStr}</div></div>
      <div class="bar" style="height:${Math.max(h,4)}px;"></div>
      <div class="bar-month">${d.label||''}</div>
    </div>`;
  }).join('');
}

/* ────────── 에비뉴엘 모달 ────────── */
document.getElementById('avenueOpen').addEventListener('click', () => {
  const yr = curYear;
  document.getElementById('avenueYearLabel').textContent = yr;
  const cq = curQuarter();
  for (let q = 1; q <= 4; q++) {
    document.getElementById(`av-qtr-hdr-${q}`).className = `av-qtr-hdr${q === cq ? ' cur' : ''}`;
  }
  for (let m = 1; m <= 12; m++) {
    const amtEl = document.getElementById(`av-m${m}`);
    const pcsEl = document.getElementById(`av-p${m}`);
    if (amtEl) amtEl.value = fmtInput(avenueData[`m${m}`]);
    if (pcsEl) pcsEl.value = fmtInput(avenueData[`m${m}_pcs`]);
  }
  window.calcBranchSub('av');
  document.getElementById('avenueModal').classList.add('show');
});

document.getElementById('avenueClose').addEventListener('click', () =>
  document.getElementById('avenueModal').classList.remove('show'));
document.getElementById('avenueModal').addEventListener('click', e => {
  if (e.target === document.getElementById('avenueModal'))
    document.getElementById('avenueModal').classList.remove('show');
});

document.getElementById('avenueApply').addEventListener('click', async () => {
  const yr = curYear;
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
  avenueData = newData;
  try {
    await setDoc(doc(db,'artifacts','patek-s','public','data','avenue_annual',String(yr)), saveObj, {merge:true});
  } catch(e) { /* 저장 실패해도 반영 */ }
  renderChart();
  recalcQuarter();
  document.getElementById('avenueModal').classList.remove('show');
});

/* ────────── 센텀 모달 ────────── */
document.getElementById('centumOpen').addEventListener('click', () => {
  const yr = curYear;
  document.getElementById('centumYearLabel').textContent = yr;
  const cq = curQuarter();
  for (let q = 1; q <= 4; q++) {
    document.getElementById(`ct-qtr-hdr-${q}`).className = `av-qtr-hdr${q === cq ? ' cur' : ''}`;
  }
  for (let m = 1; m <= 12; m++) {
    const amtEl = document.getElementById(`ct-m${m}`);
    const pcsEl = document.getElementById(`ct-p${m}`);
    if (amtEl) amtEl.value = fmtInput(centumData[`m${m}`]);
    if (pcsEl) pcsEl.value = fmtInput(centumData[`m${m}_pcs`]);
  }
  window.calcBranchSub('ct');
  document.getElementById('centumModal').classList.add('show');
});

document.getElementById('centumClose').addEventListener('click', () =>
  document.getElementById('centumModal').classList.remove('show'));
document.getElementById('centumModal').addEventListener('click', e => {
  if (e.target === document.getElementById('centumModal'))
    document.getElementById('centumModal').classList.remove('show');
});

document.getElementById('centumApply').addEventListener('click', async () => {
  const yr = curYear;
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
  centumData = newData;
  try {
    await setDoc(doc(db,'artifacts','patek-s','public','data','centum_annual',String(yr)), saveObj, {merge:true});
  } catch(e) { /* 저장 실패해도 반영 */ }
  renderChart();
  recalcQuarter();
  document.getElementById('centumModal').classList.remove('show');
});

/* ────────── 목표 달성률 모달 ────────── */
window.calcGoalRate = function() {
  const total  = parseNum(document.getElementById('gm-total')?.value)  || 0;
  const centum = parseNum(document.getElementById('gm-centum')?.value) || 0;
  const avenue = parseNum(document.getElementById('gm-avenue')?.value) || 0;
  const rate   = total > 0 ? (centum + avenue) / total * 100 : 0;
  const el     = document.getElementById('gm-rate-text');
  if (el) el.textContent = rate.toFixed(1) + '%';
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
document.getElementById('goalRateModal').addEventListener('click', e => {
  if (e.target === document.getElementById('goalRateModal'))
    document.getElementById('goalRateModal').classList.remove('show');
});

document.getElementById('goalRateApply').addEventListener('click', () => {
  const total  = parseNum(document.getElementById('gm-total')?.value)  || 0;
  const centum = parseNum(document.getElementById('gm-centum')?.value) || 0;
  const avenue = parseNum(document.getElementById('gm-avenue')?.value) || 0;
  const rate   = total > 0 ? (centum + avenue) / total * 100 : 0;

  goalRateData = { total, centum, avenue, rate };

  // 분기 목표에도 동기화
  const qGoalEl = document.getElementById('f-quarterGoal');
  if (qGoalEl && total > 0) { qGoalEl.value = fmtInput(total); }

  updateGoalDisplay();
  recalcQuarter();
  document.getElementById('goalRateModal').classList.remove('show');
});

/* ────────── 재고 테이블 ────────── */
function renderTable() {
  updateTabCounts();
  const tbody    = document.getElementById('inventoryTbody');
  const filtered = activeFilters.has('전체') ? rows : rows.filter(r => activeFilters.has(r.status));
  tbody.innerHTML = '';

  filtered.forEach((r) => {
    const ri    = rows.indexOf(r);
    const badge = BADGE_MAP[r.status] || 'badge-rest';
    const tr    = document.createElement('tr');
    tr.dataset.status = r.status || '';
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-amount="${r.amount||0}" data-qty="1"/></td>
      <td style="color:#9CA3AF">${ri+1}</td>
      <td><input class="td-edit" value="${esc(r.ref||'')}" oninput="rows[${ri}].ref=this.value" placeholder="REF."/></td>
      <td><input class="td-edit" type="text" inputmode="numeric" value="${fmtInput(r.amount)}" oninput="window.fmtNum(this);rows[${ri}].amount=parseNum(this.value);this.closest('tr').querySelector('.row-check').dataset.amount=parseNum(this.value)||0;updateSelectedTotal();renderSummary();" placeholder="0"/> 원</td>
      <td><input class="td-edit" value="${esc(r.customer||'')}" oninput="rows[${ri}].customer=this.value" placeholder="고객명"/></td>
      <td><input class="td-edit" value="${esc(r.saleDate||'')}" oninput="rows[${ri}].saleDate=this.value" placeholder="예: 6/28(목)"/></td>
      <td>
        <select class="status-sel" oninput="rows[${ri}].status=this.value;renderTable();">
          ${STATUSES.map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input class="td-edit" value="${esc(r.note||'')}" oninput="rows[${ri}].note=this.value" placeholder="비고"/></td>
      <td><button class="td-del" onclick="rows.splice(${ri},1);renderTable();">✕</button></td>`;
    tbody.appendChild(tr);
  });

  renderTfoot(filtered);
  renderSummary();
  bindCheckboxes();
  updateSelectedTotal();
}

function renderTfoot(filtered) {
  const total = filtered.reduce((s,r) => s + (Number(r.amount)||0), 0);
  const filterLabel = activeFilters.has('전체') ? '전체' : [...activeFilters].join('+');
  document.getElementById('inventoryTfoot').innerHTML = `<tr>
    <td colspan="3">${filterLabel} 합계</td>
    <td>${fmtW(total)}</td>
    <td colspan="5">${filtered.length} pcs</td>
  </tr>`;
}

function updateTabCounts() {
  document.querySelectorAll('.tab').forEach(tab => {
    const f = tab.dataset.filter;
    if (f === '전체') return;
    const cnt = rows.filter(r => r.status === f).length;
    tab.textContent = `${f} (${cnt})`;
  });
}

function renderSummary() {
  const ORDER  = ['전체','판매예정','컨펌예정','이월예정','AS','잔여재고'];
  const LABELS = { '전체':'전체 재고','판매예정':'판매 예정','컨펌예정':'컨펌 예정','이월예정':'이월 예정','잔여재고':'잔여 재고','AS':'AS' };
  const COLORS = { '전체':'black','판매예정':'green','컨펌예정':'orange','이월예정':'blue','잔여재고':'black','AS':'red' };

  const summary = {};
  ORDER.forEach(s => { summary[s] = { qty:0, amount:0 }; });
  rows.forEach(r => {
    const s = r.status || '잔여재고';
    if (summary[s] !== undefined) { summary[s].qty++; summary[s].amount += Number(r.amount)||0; }
    summary['전체'].qty++; summary['전체'].amount += Number(r.amount)||0;
  });
  document.getElementById('summaryTbody').innerHTML = ORDER.map(s =>
    `<tr><td class="${COLORS[s]}">${LABELS[s]}</td><td>${summary[s].qty} pcs</td><td>${fmtW(summary[s].amount)}</td></tr>`
  ).join('');
}

/* ── 탭 필터 (복수 선택) ── */
document.getElementById('tabsBar').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const f = tab.dataset.filter;

  if (f === '전체') {
    activeFilters = new Set(['전체']);
  } else {
    activeFilters.delete('전체');
    if (activeFilters.has(f)) {
      activeFilters.delete(f);
      if (activeFilters.size === 0) activeFilters.add('전체');
    } else {
      activeFilters.add(f);
    }
  }
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', activeFilters.has(t.dataset.filter))
  );
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
    qty++; amount += Number(cb.dataset.amount)||0;
  });
  document.getElementById('selectedQty').textContent    = qty + ' pcs';
  document.getElementById('selectedAmount').textContent = fmtW(amount);
}

/* ── 새 행 추가 버튼 (하단 바에 있을 경우 대비) ── */
const addRowBtn = document.getElementById('addRowBtn');
if (addRowBtn) {
  addRowBtn.addEventListener('click', () => {
    rows.push({ ref:'', amount:null, customer:'', saleDate:'', status:'판매예정', note:'' });
    renderTable();
  });
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
    quarterGoal:     gnv('f-quarterGoal'),
    mpdsMin:         gnv('f-mpdsMin'),
    mpdsCurrent:     gnv('f-mpdsCurrent'),
    mpdsIncoming:    gnv('f-mpdsIncoming'),
    totalGoalAmount: goalRateData.total  || null,
    totalGoalRate:   goalRateData.rate   || null,
    centumGoalAmount:goalRateData.centum || null,
    avenueGoalAmount:goalRateData.avenue || null,
    rows: rows.map(r => ({
      ref:      r.ref||'',
      amount:   r.amount != null ? Number(r.amount) : null,
      customer: r.customer||'',
      saleDate: r.saleDate||'',
      status:   r.status||'판매예정',
      note:     r.note||''
    })),
    updatedAt: new Date().toISOString()
  };

  const btns = ['save-btn','save-btn2'].map(id => document.getElementById(id));
  btns.forEach(b => { if (b) b.textContent = '저장 중...'; });
  try {
    await setDoc(doc(db,'artifacts','patek-s','public','data','sales_dashboard',`${curYear}-${pad(curMonth)}`), data, {merge:true});
    btns.forEach(b => { if (b) b.textContent = '✔ 저장됨'; });
    setTimeout(() => btns.forEach(b => { if (b) b.textContent = '💾 저장하기'; }), 2000);
  } catch(e) {
    alert('저장 실패: '+e.message);
    btns.forEach(b => { if (b) b.textContent = '💾 저장하기'; });
  }
}
document.getElementById('save-btn').addEventListener('click', saveData);
document.getElementById('save-btn2').addEventListener('click', saveData);

/* ────────── 엑셀 ────────── */
document.getElementById('excelBtn').addEventListener('click', () => {
  if (!window.XLSX) { alert('라이브러리 로딩 중입니다.'); return; }
  const header = ['No.','REF.','금액','고객명','예상 매출일','상태','비고'];
  const data   = rows.map((r,i) => [i+1, r.ref, r.amount, r.customer, r.saleDate, r.status, r.note]);
  const ws = window.XLSX.utils.aoa_to_sheet([header,...data]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, `${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb, `매출현황_${curYear}년${curMonth}월.xlsx`);
});

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ────────── 초기화 ────────── */
initBranchModals();
loadMonth();
