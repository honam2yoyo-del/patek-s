import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FC = { apiKey:"AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY", authDomain:"patek-s.firebaseapp.com", projectId:"patek-s", storageBucket:"patek-s.firebasestorage.app", messagingSenderId:"786016749285", appId:"1:786016749285:web:58538eec1cf7e72068b60c" };
const app  = initializeApp(FC);
const auth = getAuth(app);
const db   = getFirestore(app);

const pad = n => String(n).padStart(2,'0');
const fmt = n => (n != null && n !== '' && !isNaN(Number(n))) ? Number(n).toLocaleString('ko-KR') : '-';
const fmtK = n => { // 억 단위 축약
  if (!n || isNaN(n)) return '-';
  n = Number(n);
  if (n >= 1e8) return (n/1e8).toFixed(1).replace(/\.0$/,'') + '억원';
  return n.toLocaleString('ko-KR') + '원';
};

const STAFF = ['옥영세','엄인주','장용석','최혜지','이승범','형영지'];
const STATUSES = { confirmed:'컨펌완료', progress:'진행중', pending:'대기', cancel:'취소' };
const STATUS_BADGE = {
  '컨펌완료':'badge-blue','진행중':'badge-green','대기':'badge-amber','취소':'badge-red',
  '':'badge-gray'
};

let curYear  = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let curRows  = []; // 당월 확정 테이블
let carRows  = []; // 이월 예정 테이블
let unsubPlan = null;

/* ── Auth ── */
document.getElementById('login-btn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { alert('로그인 실패: '+e.message); }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, user => {
  document.getElementById('login-overlay').style.display = user ? 'none' : 'flex';
  if (user) loadMonth();
});

/* ── 월 이동 ── */
document.getElementById('prev-btn').addEventListener('click', () => {
  curMonth--; if(curMonth<1){curMonth=12;curYear--;} loadMonth();
});
document.getElementById('next-btn').addEventListener('click', () => {
  curMonth++; if(curMonth>12){curMonth=1;curYear++;} loadMonth();
});

function loadMonth() {
  const label = `${curYear}년 ${curMonth}월`;
  document.getElementById('month-title').textContent = label;
  document.getElementById('topbar-sub').textContent  = `${label} 매출 현황`;
  document.getElementById('cur-table-title').textContent = `${curMonth}월 확정 판매 관리`;
  document.getElementById('car-table-title').textContent = `${curMonth}월 이월 예정 (컨펌전)`;

  if (unsubPlan) unsubPlan();
  const docId  = `${curYear}-${pad(curMonth)}`;
  unsubPlan = onSnapshot(doc(db,'artifacts','patek-s','public','data','sales_dashboard',docId), snap => {
    applyToForm(snap.exists() ? snap.data() : null);
  });
}

/* ── 폼 적용 ── */
function applyToForm(d) {
  const sv = (id,val) => { const el=document.getElementById(id); if(el) el.value = val??''; };

  sv('kpi-confirmed',  d?.confirmedAmount);
  sv('kpi-accum',      d?.accumAmount);
  sv('kpi-prev-year',  d?.prevYearAmount);
  sv('goal-rate',      d?.goalRate);
  sv('goal-time',      d?.goalTime);
  sv('goal-remain-amt',d?.goalRemainAmt);
  sv('mpds-possible',  d?.mpdsPossible);
  sv('mpds-actual',    d?.mpdsActual);
  sv('est-pcs',        d?.estPcs);
  sv('prev-pcs',       d?.prevPcs);
  sv('notes-input',    d?.notes);
  sv('quarter-label-input', d?.quarterNum ?? '2');

  updateKpiRemaining();
  updateGoalBar();
  renderQuarterRows(d?.quarterStores ?? [
    { name:'센텀',    goal: d?.centumGoal??null,  accum: d?.centumAccum??null,  rate: d?.centumRate??null,  color:'#2563EB' },
    { name:'에비뉴엘', goal: d?.avenuelGoal??null, accum: d?.avenuelAccum??null, rate: d?.avenuelRate??null, color:'#7C3AED' }
  ]);

  const prevPcs = document.getElementById('kpi-prev-pcs');
  if (prevPcs) prevPcs.textContent = d?.prevPcs ?? '-';
  const accumPcs = document.getElementById('kpi-accum-pcs');
  if (accumPcs) accumPcs.textContent = d?.accumPcs ?? '-';

  curRows = d?.curRows ? JSON.parse(JSON.stringify(d.curRows)) : [];
  carRows = d?.carRows ? JSON.parse(JSON.stringify(d.carRows)) : [];
  renderCurTable();
  renderCarTable();
}

/* KPI 남은 목표 자동 계산 */
function updateKpiRemaining() {
  const confirmed = parseFloat(document.getElementById('kpi-confirmed').value) || 0;
  const accum     = parseFloat(document.getElementById('kpi-accum').value) || 0;
  const remaining = confirmed - accum;
  const el = document.getElementById('kpi-remaining-display');
  if (el) {
    el.textContent = remaining >= 0 ? fmtK(remaining) : '초과';
    el.className = 'kpi-value ' + (remaining >= 0 ? 'kpi-green' : 'kpi-amber');
  }
}
document.getElementById('kpi-confirmed').addEventListener('input', updateKpiRemaining);
document.getElementById('kpi-accum').addEventListener('input', updateKpiRemaining);

/* Goal bar */
function updateGoalBar() {
  const rate = parseFloat(document.getElementById('goal-rate').value) || 0;
  const bar  = document.getElementById('goal-bar');
  if (bar) bar.style.width = Math.min(rate, 100) + '%';
}
document.getElementById('goal-rate').addEventListener('input', updateGoalBar);

/* ── 분기 목표 행 렌더 ── */
window._qtrStores = [];
function renderQuarterRows(stores) {
  window._qtrStores = stores;
  const container = document.getElementById('quarter-rows');
  if (!container) return;
  container.innerHTML = '';
  stores.forEach((s, idx) => {
    const rate = s.rate ?? 0;
    const div = document.createElement('div');
    div.className = 'qtr-row';
    div.innerHTML = `
      <div class="qtr-name">${s.name}</div>
      <div class="qtr-bar-wrap"><div class="qtr-bar-fill" style="width:${Math.min(rate,100)}%;background:${s.color};"></div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
        <input class="qtr-val" type="number" placeholder="달성률%" step="0.1" value="${s.rate??''}"
          oninput="window._qtrStores[${idx}].rate=this.value?Number(this.value):null;this.closest('.qtr-row').querySelector('.qtr-bar-fill').style.width=Math.min(this.value||0,100)+'%';"
          style="width:60px;border-bottom:1px dashed #ddd;" />
        <span style="font-size:10px;color:#9CA3AF;white-space:nowrap;">
          누적 <input type="number" placeholder="0" value="${s.accum??''}"
            oninput="window._qtrStores[${idx}].accum=this.value?Number(this.value):null;"
            style="width:90px;background:transparent;border:none;border-bottom:1px dashed #ddd;outline:none;font-size:10px;color:#9CA3AF;text-align:right;"/>원
        </span>
      </div>`;
    container.appendChild(div);
  });
}

/* ── 당월 확정 테이블 ── */
function renderCurTable() {
  const tbody = document.getElementById('cur-tbody');
  tbody.innerHTML = '';
  curRows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-ctr" style="color:#9CA3AF">${idx+1}</td>
      <td><input class="dt-edit" value="${esc(r.ref||'')}" oninput="curRows[${idx}].ref=this.value" placeholder="Ref."/></td>
      <td><input class="dt-edit" value="${esc(r.customer||'')}" oninput="curRows[${idx}].customer=this.value" placeholder="고객명"/></td>
      <td class="td-ctr"><input class="dt-edit" type="number" value="${r.qty??''}" oninput="curRows[${idx}].qty=this.value?Number(this.value):null;renderCurTotals();" style="width:40px;text-align:center;" placeholder="1"/></td>
      <td class="td-num"><input class="dt-edit" type="number" value="${r.price??''}" oninput="curRows[${idx}].price=this.value?Number(this.value):null;renderCurTotals();" style="text-align:right;" placeholder="0"/></td>
      <td><input class="dt-edit" type="date" value="${r.saleDate||''}" oninput="curRows[${idx}].saleDate=this.value" style="width:100px;"/></td>
      <td>
        <select class="staff-sel" oninput="curRows[${idx}].manager=this.value">
          <option value="">-</option>
          ${STAFF.map(s=>`<option value="${s}" ${r.manager===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="staff-sel" oninput="curRows[${idx}].status=this.value;renderCurTable();">
          ${Object.values(STATUSES).map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
          <option value="" ${!r.status?'selected':''}>-</option>
        </select>
      </td>
      <td><input class="dt-edit" value="${esc(r.note||'')}" oninput="curRows[${idx}].note=this.value" placeholder="메모"/></td>
      <td><button class="dt-del" onclick="curRows.splice(${idx},1);renderCurTable();">✕</button></td>`;
    tbody.appendChild(tr);
  });
  renderCurTotals();
}
function renderCurTotals() {
  const tfoot = document.getElementById('cur-tfoot');
  const totQty   = curRows.reduce((s,r)=>s+(Number(r.qty)||0),0);
  const totPrice = curRows.reduce((s,r)=>s+(Number(r.price)||0),0);
  tfoot.innerHTML = `<tr class="sum-row">
    <td colspan="3" style="text-align:left;font-weight:700;">합계</td>
    <td class="td-ctr">${totQty}</td>
    <td class="td-num">${fmt(totPrice)}</td>
    <td colspan="5"></td>
  </tr>`;
}
document.getElementById('add-cur-btn').addEventListener('click', () => {
  curRows.push({ref:'',customer:'',qty:null,price:null,saleDate:'',manager:'',status:'진행중',note:''});
  renderCurTable();
  document.getElementById('cur-tbody').lastElementChild?.querySelector('.dt-edit')?.focus();
});

/* ── 이월 예정 테이블 ── */
function renderCarTable() {
  const tbody = document.getElementById('car-tbody');
  tbody.innerHTML = '';
  carRows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-ctr" style="color:#9CA3AF">${idx+1}</td>
      <td><input class="dt-edit" value="${esc(r.ref||'')}" oninput="carRows[${idx}].ref=this.value" placeholder="Ref."/></td>
      <td><input class="dt-edit" value="${esc(r.customer||'')}" oninput="carRows[${idx}].customer=this.value" placeholder="고객명"/></td>
      <td class="td-num"><input class="dt-edit" type="number" value="${r.price??''}" oninput="carRows[${idx}].price=this.value?Number(this.value):null;renderCarTotals();" style="text-align:right;" placeholder="0"/></td>
      <td>
        <select class="staff-sel" oninput="carRows[${idx}].manager=this.value">
          <option value="">-</option>
          ${STAFF.map(s=>`<option value="${s}" ${r.manager===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input class="dt-edit" value="${esc(r.note||'')}" oninput="carRows[${idx}].note=this.value" placeholder="메모"/></td>
      <td><button class="dt-del" onclick="carRows.splice(${idx},1);renderCarTable();">✕</button></td>`;
    tbody.appendChild(tr);
  });
  renderCarTotals();
}
function renderCarTotals() {
  const tfoot = document.getElementById('car-tfoot');
  const totPrice = carRows.reduce((s,r)=>s+(Number(r.price)||0),0);
  tfoot.innerHTML = `<tr class="sum-row">
    <td colspan="3" style="text-align:left;font-weight:700;">합계</td>
    <td class="td-num">${fmt(totPrice)}</td>
    <td colspan="3"></td>
  </tr>`;
}
document.getElementById('add-car-btn').addEventListener('click', () => {
  carRows.push({ref:'',customer:'',price:null,manager:'',note:''});
  renderCarTable();
  document.getElementById('car-tbody').lastElementChild?.querySelector('.dt-edit')?.focus();
});

/* ── 저장 ── */
document.getElementById('save-btn').addEventListener('click', saveData);
async function saveData() {
  const gv = id => { const el=document.getElementById(id); return el?el.value.trim():''; };
  const gn = id => { const v=gv(id); return v!==''?Number(v):null; };

  const data = {
    confirmedAmount: gn('kpi-confirmed'),
    accumAmount:     gn('kpi-accum'),
    prevYearAmount:  gn('kpi-prev-year'),
    goalRate:        gn('goal-rate'),
    goalTime:        gv('goal-time'),
    goalRemainAmt:   gn('goal-remain-amt'),
    mpdsPossible:    gn('mpds-possible'),
    mpdsActual:      gn('mpds-actual'),
    estPcs:          gn('est-pcs'),
    prevPcs:         gn('prev-pcs'),
    notes:           gv('notes-input'),
    quarterNum:      gv('quarter-label-input'),
    quarterStores:   window._qtrStores || [],
    curRows: curRows.map(r=>({
      ref:r.ref||'', customer:r.customer||'',
      qty: r.qty!=null?Number(r.qty):null,
      price: r.price!=null?Number(r.price):null,
      saleDate:r.saleDate||'', manager:r.manager||'',
      status:r.status||'', note:r.note||''
    })),
    carRows: carRows.map(r=>({
      ref:r.ref||'', customer:r.customer||'',
      price: r.price!=null?Number(r.price):null,
      manager:r.manager||'', note:r.note||''
    })),
    updatedAt: new Date().toISOString()
  };

  const btn  = document.getElementById('save-btn');
  const orig = btn.textContent;
  btn.textContent = '저장 중...';
  try {
    await setDoc(
      doc(db,'artifacts','patek-s','public','data','sales_dashboard',`${curYear}-${pad(curMonth)}`),
      data, {merge:true}
    );
    btn.textContent = '✔ 저장됨';
    setTimeout(()=>{ btn.textContent = orig; }, 2000);
  } catch(e) {
    alert('저장 실패: '+e.message);
    btn.textContent = orig;
  }
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

loadMonth();
