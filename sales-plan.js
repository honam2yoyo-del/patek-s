import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FC = { apiKey:"AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY", authDomain:"patek-s.firebaseapp.com", projectId:"patek-s", storageBucket:"patek-s.firebasestorage.app", messagingSenderId:"786016749285", appId:"1:786016749285:web:58538eec1cf7e72068b60c" };
const app  = initializeApp(FC);
const auth = getAuth(app);
const db   = getFirestore(app);

const pad  = n => String(n).padStart(2,'0');
const fmtW = n => (n != null && !isNaN(Number(n))) ? Number(n).toLocaleString('ko-KR') + ' 원' : '- 원';
const fmtN = n => (n != null && !isNaN(Number(n))) ? Number(n).toLocaleString('ko-KR') : '-';

const STATUSES   = ['판매예정','컨펌예정','이월예정','잔여재고','AS'];
const BADGE_MAP  = { '판매예정':'badge-sale','컨펌예정':'badge-confirm','이월예정':'badge-carry','잔여재고':'badge-rest','AS':'badge-as' };

let curYear  = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let rows     = [];
let chartData = [];
let activeFilters = new Set(['전체']);
let unsubPlan = null;

/* ────────── 월 선택기 ────────── */
function initMonthSelect() {
  const sel = document.getElementById('monthSelect');
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
    const [y,m] = sel.value.split('-');
    curYear = parseInt(y); curMonth = parseInt(m);
    updateMonthLabels();
    loadMonth();
  });
}

function updateMonthLabels() {
  const m = curMonth;
  document.getElementById('expectedTitle').textContent = `${m}월 예상 매출`;
  document.getElementById('lastYearTitle').textContent = `작년 ${m}월 매출`;
  document.getElementById('quarterLabelText').textContent = document.getElementById('quarterSelect').value;
  // 에비뉴엘 모달 labels
  document.getElementById('avenueLabel1').textContent = `${m-2<1?m+10:m-2}월`;
  document.getElementById('avenueLabel2').textContent = `${m-1<1?m+11:m-1}월`;
  document.getElementById('avenueLabel3').textContent = `${m}월`;
}

document.getElementById('quarterSelect').addEventListener('change', () => {
  document.getElementById('quarterLabelText').textContent = document.getElementById('quarterSelect').value;
  recalcQuarter();
});

/* ────────── Auth ────────── */
document.getElementById('login-btn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { alert('로그인 실패: '+e.message); }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, user => {
  document.getElementById('login-overlay').style.display = user ? 'none' : 'flex';
  if (user) { initMonthSelect(); updateMonthLabels(); loadMonth(); }
});

/* ────────── 데이터 로드 ────────── */
function loadMonth() {
  if (unsubPlan) unsubPlan();
  const docId = `${curYear}-${pad(curMonth)}`;
  unsubPlan = onSnapshot(doc(db,'artifacts','patek-s','public','data','sales_dashboard',docId), snap => {
    applyData(snap.exists() ? snap.data() : null);
  });
}

function applyData(d) {
  const sv = (id, val) => { const el=document.getElementById(id); if(el) el.value = val??''; };
  sv('f-expectedSales',   d?.expectedSales);
  sv('f-expectedPcs',     d?.expectedPcs);
  sv('f-lastYearSales',   d?.lastYearSales);
  sv('f-lastYearPcs',     d?.lastYearPcs);
  sv('f-currentSales',    d?.currentSales);
  sv('f-currentPcs',      d?.currentPcs);
  sv('f-totalGoalAmount', d?.totalGoalAmount);
  sv('f-totalGoalRate',   d?.totalGoalRate);
  sv('f-centumGoalAmount',d?.centumGoalAmount);
  sv('f-centumGoalRate',  d?.centumGoalRate);
  sv('f-avenueGoalAmount',d?.avenueGoalAmount);
  sv('f-avenueGoalRate',  d?.avenueGoalRate);
  sv('f-quarterGoal',     d?.quarterGoal);
  sv('f-quarterPrevTotal',d?.quarterPrevTotal);
  sv('f-mpdsMin',         d?.mpdsMin ?? 30);
  sv('f-mpdsCurrent',     d?.mpdsCurrent);
  sv('f-mpdsIncoming',    d?.mpdsIncoming);
  if (d?.quarterNum) { document.getElementById('quarterSelect').value = String(d.quarterNum); document.getElementById('quarterLabelText').textContent = d.quarterNum; }

  chartData = d?.chartData ?? [
    { label:`${curMonth-2<1?curMonth+10:curMonth-2}월`, pcs:null, amount:null },
    { label:`${curMonth-1<1?curMonth+11:curMonth-1}월`, pcs:null, amount:null },
    { label:`${curMonth}월 (현재)`,                     pcs:null, amount:null }
  ];
  renderChart();
  renderChartInputs();

  rows = d?.rows ? JSON.parse(JSON.stringify(d.rows)) : [];
  renderTable();
  recalcAll();
}

/* ────────── 재계산 ────────── */
function recalcAll() {
  recalcRemain();
  recalcGoalProgress();
  recalcTotalRemain();
  recalcQuarter();
  recalcMpds();
}

function gn(id) { const el=document.getElementById(id); return el && el.value!=='' ? Number(el.value) : 0; }

function recalcRemain() {
  const expected = gn('f-expectedSales');
  const current  = gn('f-currentSales');
  const expectedPcs = gn('f-expectedPcs');
  const currentPcs  = gn('f-currentPcs');
  const remSales = expected - current;
  const remPcs   = expectedPcs - currentPcs;
  const el = document.getElementById('remainDisplay');
  el.innerHTML = `<span>${fmtN(remSales)}</span>원&nbsp;<span class="kpi-pcs">(${remPcs} pcs)</span>`;
  el.className = 'kpi-value ' + (remSales > 0 ? 'red' : 'green');
}

function recalcGoalProgress() {
  const rate = gn('f-totalGoalRate');
  const bar  = document.getElementById('mainProgressBar');
  const txt  = document.getElementById('mainGoalRateText');
  bar.style.width = Math.min(rate, 100) + '%';
  bar.textContent = rate + '%';
  txt.textContent = rate + '%';
}

function recalcTotalRemain() {
  const total    = gn('f-totalGoalAmount');
  const centum   = gn('f-centumGoalAmount');
  const avenue   = gn('f-avenueGoalAmount');
  const achieved = centum + avenue;
  const remain   = total - achieved;
  document.getElementById('totalRemainDisplay').textContent = fmtW(remain > 0 ? remain : 0);
}

function recalcQuarter() {
  const goal     = gn('f-quarterGoal');
  const prevTotal = gn('f-quarterPrevTotal');
  const current  = gn('f-currentSales');
  const achieved = prevTotal + current;
  const remain   = goal - achieved;
  const rate     = goal > 0 ? (achieved / goal * 100).toFixed(1) : '0.0';
  document.getElementById('quarterAchievedDisplay').textContent = fmtW(achieved);
  document.getElementById('quarterRemainDisplay').textContent   = fmtW(remain > 0 ? remain : 0);
  document.getElementById('quarterRateDisplay').textContent     = rate + '%';
}

function recalcMpds() {
  const min      = gn('f-mpdsMin');
  const current  = gn('f-mpdsCurrent');
  const incoming = gn('f-mpdsIncoming');
  const shortage = Math.max(min - current, 0);
  const expected = current + incoming;
  const shortEl  = document.getElementById('mpdsShortText');
  shortEl.textContent = shortage;
  shortEl.className = shortage > 0 ? 'red' : 'green';
  document.getElementById('mpdsExpectedText').textContent = expected;
}

/* 입력 이벤트 연결 */
['f-expectedSales','f-currentSales','f-expectedPcs','f-currentPcs'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcAll));
['f-totalGoalRate'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcGoalProgress));
['f-totalGoalAmount','f-centumGoalAmount','f-avenueGoalAmount'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcTotalRemain));
['f-quarterGoal','f-quarterPrevTotal'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcQuarter));
['f-mpdsMin','f-mpdsCurrent','f-mpdsIncoming'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcMpds));

/* ────────── 차트 ────────── */
const MAX_BAR_H = 200;
function renderChart() {
  const wrap   = document.getElementById('chartWrap');
  const amounts = chartData.map(d => Number(d.amount) || 0);
  const maxAmt  = Math.max(...amounts, 1);

  wrap.innerHTML = '<div class="chart-unit">(억 원)</div>' + chartData.map((d, i) => {
    const h = Math.round((amounts[i] / maxAmt) * MAX_BAR_H);
    const aStr = amounts[i] > 0 ? Number(amounts[i]).toLocaleString('ko-KR') : '-';
    const pStr = d.pcs ? `(${d.pcs} pcs)` : '';
    return `<div class="bar-item">
      <div class="bar-meta"><div>${pStr}</div><div>${aStr}</div></div>
      <div class="bar" style="height:${Math.max(h,4)}px;"></div>
      <div class="bar-month">${d.label||''}</div>
    </div>`;
  }).join('');
}

function renderChartInputs() {
  const row = document.getElementById('chartEditRow');
  row.innerHTML = chartData.map((d, i) => `
    <div class="chart-edit-item">
      <span>${d.label||''}</span>
      <input type="number" placeholder="금액(원)" value="${d.amount||''}"
        oninput="window._ca(${i},'amount',this.value)" />
      <input type="number" placeholder="PCS" value="${d.pcs||''}" style="width:60px;"
        oninput="window._ca(${i},'pcs',this.value)" />
    </div>`).join('');
}
window._ca = (i, key, v) => { chartData[i][key] = v!==''?Number(v):null; renderChart(); };

/* ────────── 재고 테이블 ────────── */
function renderTable() {
  updateTabCounts();
  const tbody   = document.getElementById('inventoryTbody');
  const filtered = activeFilters.has('전체') ? rows : rows.filter(r => activeFilters.has(r.status));
  tbody.innerHTML = '';

  filtered.forEach((r) => {
    const ri  = rows.indexOf(r);
    const badge = BADGE_MAP[r.status] || 'badge-rest';
    const tr = document.createElement('tr');
    tr.dataset.status = r.status || '';
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-amount="${r.amount||0}" data-qty="1"/></td>
      <td style="color:#9CA3AF">${ri+1}</td>
      <td><input class="td-edit" value="${esc(r.ref||'')}" oninput="rows[${ri}].ref=this.value" placeholder="REF."/></td>
      <td><input class="td-edit" type="number" value="${r.amount??''}" oninput="rows[${ri}].amount=this.value?Number(this.value):null;this.closest('td').previousElementSibling.previousElementSibling.querySelector('.row-check').dataset.amount=this.value||0;updateSelectedTotal();renderSummary();" placeholder="0"/> 원</td>
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
  const total = filtered.reduce((s,r)=>s+(Number(r.amount)||0),0);
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
  const summary = {};
  ['전체', ...STATUSES].forEach(s => { summary[s] = {qty:0,amount:0}; });
  rows.forEach(r => {
    const s = r.status || '잔여재고';
    if (summary[s] !== undefined) { summary[s].qty++; summary[s].amount += Number(r.amount)||0; }
    summary['전체'].qty++; summary['전체'].amount += Number(r.amount)||0;
  });
  const colors = { '전체':'black','판매예정':'green','컨펌예정':'orange','이월예정':'blue','잔여재고':'black','AS':'red' };
  const labels = { '전체':'전체재고','판매예정':'판매예정','컨펌예정':'컨펌예정','이월예정':'이월예정','잔여재고':'잔여재고','AS':'AS' };
  document.getElementById('summaryTbody').innerHTML = ['전체',...STATUSES].map(s =>
    `<tr><td class="${colors[s]}">${labels[s]}</td><td>${summary[s].qty} pcs</td><td>${fmtW(summary[s].amount)}</td></tr>`
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
  let qty=0, amount=0;
  document.querySelectorAll('.row-check:checked').forEach(cb => {
    qty++;
    amount += Number(cb.dataset.amount)||0;
  });
  document.getElementById('selectedQty').textContent    = qty + ' pcs';
  document.getElementById('selectedAmount').textContent = fmtW(amount);
}

/* ── 에비뉴엘 모달 ── */
function updateAvenueTotal() {
  const total = [1,2,3].reduce((s,i)=>s+(Number(document.getElementById(`avenueMonth${i}`).value)||0),0);
  document.getElementById('avenueTotalText').textContent = fmtW(total);
}
[1,2,3].forEach(i => document.getElementById(`avenueMonth${i}`).addEventListener('input', updateAvenueTotal));
document.getElementById('avenueOpen').addEventListener('click', () => {
  document.getElementById('avenueModal').classList.add('show');
  updateAvenueTotal();
});
document.getElementById('avenueClose').addEventListener('click', () => document.getElementById('avenueModal').classList.remove('show'));
document.getElementById('avenueModal').addEventListener('click', e => { if(e.target===document.getElementById('avenueModal')) document.getElementById('avenueModal').classList.remove('show'); });
document.getElementById('avenueApply').addEventListener('click', () => {
  const total = [1,2,3].reduce((s,i)=>s+(Number(document.getElementById(`avenueMonth${i}`).value)||0),0);
  document.getElementById('f-avenueGoalAmount').value = total;
  recalcTotalRemain();
  document.getElementById('avenueModal').classList.remove('show');
});

/* ────────── 저장 ────────── */
async function saveData() {
  const gv = id => { const el=document.getElementById(id); return el?el.value.trim():''; };
  const gnv = id => { const v=gv(id); return v!==''?Number(v):null; };

  const data = {
    expectedSales:   gnv('f-expectedSales'),
    expectedPcs:     gnv('f-expectedPcs'),
    lastYearSales:   gnv('f-lastYearSales'),
    lastYearPcs:     gnv('f-lastYearPcs'),
    currentSales:    gnv('f-currentSales'),
    currentPcs:      gnv('f-currentPcs'),
    totalGoalAmount: gnv('f-totalGoalAmount'),
    totalGoalRate:   gnv('f-totalGoalRate'),
    centumGoalAmount:gnv('f-centumGoalAmount'),
    centumGoalRate:  gnv('f-centumGoalRate'),
    avenueGoalAmount:gnv('f-avenueGoalAmount'),
    avenueGoalRate:  gnv('f-avenueGoalRate'),
    quarterNum:      document.getElementById('quarterSelect').value,
    quarterGoal:     gnv('f-quarterGoal'),
    quarterPrevTotal:gnv('f-quarterPrevTotal'),
    mpdsMin:         gnv('f-mpdsMin'),
    mpdsCurrent:     gnv('f-mpdsCurrent'),
    mpdsIncoming:    gnv('f-mpdsIncoming'),
    chartData: chartData.map(d => ({ label:d.label||'', pcs:d.pcs, amount:d.amount })),
    rows: rows.map(r => ({
      ref:      r.ref||'',
      amount:   r.amount!=null?Number(r.amount):null,
      customer: r.customer||'',
      saleDate: r.saleDate||'',
      status:   r.status||'판매예정',
      note:     r.note||''
    })),
    updatedAt: new Date().toISOString()
  };

  const btns = ['save-btn','save-btn2'].map(id=>document.getElementById(id));
  btns.forEach(b=>{if(b) b.textContent='저장 중...';});
  try {
    await setDoc(doc(db,'artifacts','patek-s','public','data','sales_dashboard',`${curYear}-${pad(curMonth)}`), data, {merge:true});
    btns.forEach(b=>{if(b) b.textContent='✔ 저장됨';});
    setTimeout(()=>btns.forEach(b=>{if(b) b.textContent='💾 저장하기';}), 2000);
  } catch(e) {
    alert('저장 실패: '+e.message);
    btns.forEach(b=>{if(b) b.textContent='💾 저장하기';});
  }
}
document.getElementById('save-btn').addEventListener('click', saveData);
document.getElementById('save-btn2').addEventListener('click', saveData);

/* ────────── 엑셀 ────────── */
document.getElementById('excelBtn').addEventListener('click', () => {
  if (!window.XLSX) { alert('라이브러리 로딩 중입니다.'); return; }
  const header = ['No.','REF.','금액','고객명','예상 매출일','상태','비고'];
  const data = rows.map((r,i)=>[i+1,r.ref,r.amount,r.customer,r.saleDate,r.status,r.note]);
  const ws = window.XLSX.utils.aoa_to_sheet([header,...data]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, `${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb, `매출현황_${curYear}년${curMonth}월.xlsx`);
});

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

loadMonth();
