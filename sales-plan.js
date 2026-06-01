import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FC = { apiKey:"AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY", authDomain:"patek-s.firebaseapp.com", projectId:"patek-s", storageBucket:"patek-s.firebasestorage.app", messagingSenderId:"786016749285", appId:"1:786016749285:web:58538eec1cf7e72068b60c" };
const app  = initializeApp(FC);
const auth = getAuth(app);
const db   = getFirestore(app);

const pad  = n => String(n).padStart(2,'0');
const fmtN = n => (n != null && n !== '' && !isNaN(Number(n))) ? Number(n).toLocaleString('ko-KR') : '-';
const STAFF   = ['옥영세','엄인주','장용석','최혜지','이승범','형영지'];
const STATUSES = ['판매예정','컨펌필요','다음달 매출'];
const BADGE_CLASS = { '판매예정':'badge-sale','컨펌필요':'badge-confirm','다음달 매출':'badge-next' };

let curYear = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let rows = [];
let activeTab = '판매예정';
let chartMonths = [];
let unsubPlan = null;

/* ── 월 선택기 초기화 ── */
function initMonthSelect() {
  const sel = document.getElementById('month-select');
  sel.innerHTML = '';
  for (let y = curYear - 1; y <= curYear + 1; y++) {
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = `${y}-${pad(m)}`;
      opt.textContent = `${y}년 ${m}월`;
      if (y === curYear && m === curMonth) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  sel.addEventListener('change', () => {
    const [y, m] = sel.value.split('-');
    curYear = parseInt(y); curMonth = parseInt(m);
    updateLabels();
    loadMonth();
  });
}

function updateLabels() {
  const m = curMonth;
  document.getElementById('title-expected').textContent = `${m}월 예상 매출`;
  document.getElementById('title-lastyear').textContent = `작년 ${m}월 매출`;
  const qSel = document.getElementById('quarter-select');
  document.getElementById('quarter-label-text').textContent = qSel.value;
}

document.getElementById('quarter-select').addEventListener('change', () => {
  document.getElementById('quarter-label-text').textContent =
    document.getElementById('quarter-select').value;
  recalcQuarter();
});

/* ── Auth ── */
document.getElementById('login-btn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { alert('로그인 실패: '+e.message); }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, user => {
  document.getElementById('login-overlay').style.display = user ? 'none' : 'flex';
  if (user) { initMonthSelect(); updateLabels(); loadMonth(); }
});

/* ── 데이터 로드 ── */
function loadMonth() {
  if (unsubPlan) unsubPlan();
  const docId = `${curYear}-${pad(curMonth)}`;
  unsubPlan = onSnapshot(doc(db,'artifacts','patek-s','public','data','sales_dashboard',docId), snap => {
    applyData(snap.exists() ? snap.data() : null);
  });
}

function applyData(d) {
  const sv = (id, val) => { const el=document.getElementById(id); if(el) el.value = val??''; };
  sv('f-expectedSales',  d?.expectedSales);
  sv('f-lastYearSales',  d?.lastYearSales);
  sv('f-currentSales',   d?.currentSales);
  sv('f-goalRate',       d?.goalRate);
  sv('f-goalDays',       d?.goalDays);
  sv('f-dailyNeeded',    d?.dailyNeeded);
  sv('f-quarterGoal',    d?.quarterGoal);
  sv('f-quarterAchieved',d?.quarterAchieved);
  sv('f-mpdsCurrent',    d?.mpdsCurrent);
  sv('f-mpdsMin',        d?.mpdsMin ?? 30);
  sv('f-mpdsConfirmAdd', d?.mpdsConfirmAdd);
  sv('f-mpdsCarryover',  d?.mpdsCarryover);

  const qSel = document.getElementById('quarter-select');
  if (d?.quarterNum) { qSel.value = String(d.quarterNum); document.getElementById('quarter-label-text').textContent = d.quarterNum; }

  chartMonths = d?.chartMonths ?? [
    { month: `${curMonth-2<1?curMonth+10:curMonth-2}월`, amount: null },
    { month: `${curMonth-1<1?curMonth+11:curMonth-1}월`, amount: null },
    { month: `${curMonth}월`, amount: null }
  ];
  renderChart();
  renderChartInputs();

  rows = d?.rows ? JSON.parse(JSON.stringify(d.rows)) : [];
  renderTable();
  recalcAll();
}

/* ── 실시간 재계산 ── */
function recalcAll() {
  recalcRemaining();
  recalcGoalBar();
  recalcQuarter();
  recalcMpds();
}

function recalcRemaining() {
  const expected = parseFloat(document.getElementById('f-expectedSales').value) || 0;
  const current  = parseFloat(document.getElementById('f-currentSales').value) || 0;
  const remaining = expected - current;
  const el = document.getElementById('remaining-display');
  el.textContent = remaining.toLocaleString('ko-KR') + ' 원';
  el.className = 'sales-card-value ' + (remaining > 0 ? 'red' : 'green');
}

function recalcGoalBar() {
  const rate = parseFloat(document.getElementById('f-goalRate').value) || 0;
  const bar = document.getElementById('goal-bar');
  bar.style.width = Math.min(rate, 100) + '%';
  bar.textContent = rate + '%';
}

function recalcQuarter() {
  const goal     = parseFloat(document.getElementById('f-quarterGoal').value) || 0;
  const achieved = parseFloat(document.getElementById('f-quarterAchieved').value) || 0;
  const remaining = goal - achieved;
  const rate = goal > 0 ? ((achieved / goal) * 100).toFixed(1) : 0;
  document.getElementById('quarter-remaining-display').textContent = remaining.toLocaleString('ko-KR') + ' 원';
  document.getElementById('quarter-rate-display').textContent = rate + '%';
}

function recalcMpds() {
  const current  = parseFloat(document.getElementById('f-mpdsCurrent').value) || 0;
  const min      = parseFloat(document.getElementById('f-mpdsMin').value) || 30;
  const add      = parseFloat(document.getElementById('f-mpdsConfirmAdd').value) || 0;
  const carryover= parseFloat(document.getElementById('f-mpdsCarryover').value) || 0;
  const shortage = Math.max(0, min - current);
  const expected = current + add - carryover;

  document.getElementById('mpds-shortage').textContent = shortage + ' pcs';
  document.getElementById('mpds-shortage').className = shortage > 0 ? 'red' : 'green';
  document.getElementById('mpds-expected-display').textContent = expected + ' pcs';

  const statusEl = document.getElementById('mpds-status-text');
  const alertEl  = document.getElementById('mpds-alert-box');
  if (current >= min) {
    statusEl.textContent = '등록 가능'; statusEl.className = 'green';
    alertEl.style.background = '#e8f7ee'; alertEl.style.color = '#12934a';
    alertEl.textContent = '현재 MPDS 등록이 가능합니다.';
  } else {
    statusEl.textContent = '등록 불가'; statusEl.className = 'red';
    alertEl.style.background = '#fee2e2'; alertEl.style.color = '#dc2626';
    alertEl.textContent = `등록까지 ${shortage} pcs 부족합니다.`;
  }
}

/* ── 실시간 이벤트 ── */
['f-expectedSales','f-currentSales'].forEach(id => document.getElementById(id).addEventListener('input', recalcRemaining));
document.getElementById('f-goalRate').addEventListener('input', recalcGoalBar);
['f-quarterGoal','f-quarterAchieved'].forEach(id => document.getElementById(id).addEventListener('input', recalcQuarter));
['f-mpdsCurrent','f-mpdsMin','f-mpdsConfirmAdd','f-mpdsCarryover'].forEach(id => document.getElementById(id).addEventListener('input', recalcMpds));

/* ── 막대 차트 ── */
function renderChart() {
  const box = document.getElementById('chart-box');
  if (!chartMonths.length) return;
  const amounts = chartMonths.map(m => Number(m.amount) || 0);
  const maxAmt  = Math.max(...amounts, 1);
  const MAX_H   = 200;

  box.innerHTML = chartMonths.map((m, i) => {
    const h = Math.round((amounts[i] / maxAmt) * MAX_H);
    return `<div class="bar-item">
      <span class="bar-label-val">${amounts[i] > 0 ? (amounts[i]/1e8).toFixed(1)+'억' : '-'}</span>
      <div class="bar" style="height:${Math.max(h,4)}px;"></div>
      <strong>${m.month||''}</strong>
    </div>`;
  }).join('');
}

function renderChartInputs() {
  const wrap = document.getElementById('chart-inputs');
  wrap.innerHTML = chartMonths.map((m, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:#6b7280;">
      <span>${m.month||''}</span>
      <input type="number" placeholder="금액(원)" value="${m.amount||''}"
        oninput="window._chartAmt(${i},this.value)"
        style="width:120px;border:1px solid #ddd;border-radius:6px;padding:5px 8px;font-size:12px;text-align:right;outline:none;" />
    </div>`).join('');
}
window._chartAmt = (i, v) => {
  chartMonths[i].amount = v !== '' ? Number(v) : null;
  renderChart();
};

/* ── 테이블 ── */
function renderTable() {
  updateTabCounts();
  const tbody = document.getElementById('main-tbody');
  const filtered = rows.filter(r => (r.status || '판매예정') === activeTab);
  tbody.innerHTML = '';
  filtered.forEach((r, fi) => {
    const ri = rows.indexOf(r);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fi + 1}</td>
      <td><input class="td-edit" value="${esc(r.ref||'')}" oninput="rows[${ri}].ref=this.value" placeholder="Ref"/></td>
      <td><input class="td-edit" value="${esc(r.model||'')}" oninput="rows[${ri}].model=this.value" placeholder="모델명"/></td>
      <td><input class="td-edit" value="${esc(r.customer||'')}" oninput="rows[${ri}].customer=this.value" placeholder="고객명"/></td>
      <td><input class="td-edit right" type="number" value="${r.amount??''}" oninput="rows[${ri}].amount=this.value?Number(this.value):null;renderSummary();" placeholder="0"/></td>
      <td><input class="td-edit" type="number" value="${r.qty??''}" oninput="rows[${ri}].qty=this.value?Number(this.value):null;" placeholder="1" style="width:50px;"/></td>
      <td><input class="td-edit" type="month" value="${r.saleMonth||''}" oninput="rows[${ri}].saleMonth=this.value;" style="width:120px;"/></td>
      <td>
        <select class="staff-sel" oninput="rows[${ri}].status=this.value;renderTable();">
          ${STATUSES.map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input class="td-edit left" value="${esc(r.note||'')}" oninput="rows[${ri}].note=this.value" placeholder="비고"/></td>
      <td><button class="td-del" onclick="rows.splice(${ri},1);renderTable();">✕</button></td>`;
    tbody.appendChild(tr);
  });
  renderTfoot(filtered);
  renderSummary();
}

function renderTfoot(filtered) {
  const tfoot = document.getElementById('main-tfoot');
  const totAmt = filtered.reduce((s,r)=>s+(Number(r.amount)||0),0);
  const totQty = filtered.reduce((s,r)=>s+(Number(r.qty)||0),0);
  tfoot.innerHTML = `<tr>
    <td colspan="4">합계</td>
    <td>${fmtN(totAmt)}</td>
    <td>${totQty}</td>
    <td colspan="4"></td>
  </tr>`;
}

function updateTabCounts() {
  const cnt = { '판매예정':0,'컨펌필요':0,'다음달 매출':0 };
  rows.forEach(r => { const s = r.status||'판매예정'; if(cnt[s]!==undefined) cnt[s]++; });
  document.getElementById('cnt-sale').textContent    = `(${cnt['판매예정']})`;
  document.getElementById('cnt-confirm').textContent = `(${cnt['컨펌필요']})`;
  document.getElementById('cnt-next').textContent    = `(${cnt['다음달 매출']})`;
}

function renderSummary() {
  const tbody = document.getElementById('summary-tbody');
  const summary = {};
  STATUSES.forEach(s => { summary[s] = { qty:0, amount:0 }; });
  rows.forEach(r => {
    const s = r.status || '판매예정';
    if (summary[s]) {
      summary[s].qty    += Number(r.qty) || 0;
      summary[s].amount += Number(r.amount) || 0;
    }
  });
  const colors = { '판매예정':'green','컨펌필요':'orange','다음달 매출':'blue' };
  const totQty = Object.values(summary).reduce((s,v)=>s+v.qty,0);
  const totAmt = Object.values(summary).reduce((s,v)=>s+v.amount,0);
  tbody.innerHTML = STATUSES.map(s =>
    `<tr>
      <td class="${colors[s]}">${s}</td>
      <td>${summary[s].qty}</td>
      <td>${fmtN(summary[s].amount)} 원</td>
    </tr>`
  ).join('') + `<tr>
    <td><b>전체 합계</b></td><td><b>${totQty}</b></td><td><b>${fmtN(totAmt)} 원</b></td>
  </tr>`;
}

/* ── 탭 클릭 ── */
document.getElementById('tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeTab = tab.dataset.status;
  renderTable();
});

/* ── 행 추가 ── */
document.getElementById('add-row-btn').addEventListener('click', () => {
  rows.push({ ref:'', model:'', customer:'', amount:null, qty:1,
    saleMonth:`${curYear}-${pad(curMonth)}`, status: activeTab, note:'' });
  renderTable();
  document.getElementById('main-tbody').lastElementChild?.querySelector('.td-edit')?.focus();
});

/* ── 저장 ── */
async function saveData() {
  const gv = id => { const el=document.getElementById(id); return el?el.value.trim():''; };
  const gn = id => { const v=gv(id); return v!==''?Number(v):null; };

  const data = {
    expectedSales:   gn('f-expectedSales'),
    lastYearSales:   gn('f-lastYearSales'),
    currentSales:    gn('f-currentSales'),
    goalRate:        gn('f-goalRate'),
    goalDays:        gn('f-goalDays'),
    dailyNeeded:     gn('f-dailyNeeded'),
    quarterNum:      document.getElementById('quarter-select').value,
    quarterGoal:     gn('f-quarterGoal'),
    quarterAchieved: gn('f-quarterAchieved'),
    mpdsCurrent:     gn('f-mpdsCurrent'),
    mpdsMin:         gn('f-mpdsMin'),
    mpdsConfirmAdd:  gn('f-mpdsConfirmAdd'),
    mpdsCarryover:   gn('f-mpdsCarryover'),
    chartMonths: chartMonths.map(m => ({ month: m.month||'', amount: m.amount!=null?Number(m.amount):null })),
    rows: rows.map(r => ({
      ref:       r.ref||'',
      model:     r.model||'',
      customer:  r.customer||'',
      amount:    r.amount!=null?Number(r.amount):null,
      qty:       r.qty!=null?Number(r.qty):null,
      saleMonth: r.saleMonth||'',
      status:    r.status||'판매예정',
      note:      r.note||''
    })),
    updatedAt: new Date().toISOString()
  };

  const btns = [document.getElementById('save-btn'), document.getElementById('save-btn2')];
  btns.forEach(b => { if(b) b.textContent = '저장 중...'; });
  try {
    await setDoc(doc(db,'artifacts','patek-s','public','data','sales_dashboard',`${curYear}-${pad(curMonth)}`), data, {merge:true});
    btns.forEach(b => { if(b) b.textContent = '✔ 저장됨'; });
    setTimeout(() => btns.forEach(b => { if(b) b.textContent = '💾 저장하기'; }), 2000);
  } catch(e) {
    alert('저장 실패: '+e.message);
    btns.forEach(b => { if(b) b.textContent = '💾 저장하기'; });
  }
}
document.getElementById('save-btn').addEventListener('click', saveData);
document.getElementById('save-btn2').addEventListener('click', saveData);

/* ── 엑셀 ── */
document.getElementById('excel-btn').addEventListener('click', () => {
  if (!window.XLSX) { alert('라이브러리 로딩 중'); return; }
  const header = ['No.','Ref','모델명','고객명','금액','수량','예상매출월','상태','비고'];
  const data = rows.map((r,i) => [i+1, r.ref, r.model, r.customer, r.amount, r.qty, r.saleMonth, r.status, r.note]);
  const ws = window.XLSX.utils.aoa_to_sheet([header,...data]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, `${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb, `매출현황_${curYear}년${curMonth}월.xlsx`);
});

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
