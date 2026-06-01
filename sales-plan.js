import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FC = { apiKey:"AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY", authDomain:"patek-s.firebaseapp.com", projectId:"patek-s", storageBucket:"patek-s.firebasestorage.app", messagingSenderId:"786016749285", appId:"1:786016749285:web:58538eec1cf7e72068b60c" };
const app  = initializeApp(FC);
const auth = getAuth(app);
const db   = getFirestore(app);
const gp   = new GoogleAuthProvider();

const pad = n => String(n).padStart(2, '0');
let curYear = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let planData = null;
let unsubPlan = null;
let rows = [];   // { ref, price, currentPlan, carryover, color }

/* ── 포맷 ── */
const fmt = n => (n != null && n !== '' && !isNaN(n)) ? Number(n).toLocaleString('ko-KR') : '-';

/* ── Auth ── */
document.getElementById('login-btn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, gp); } catch(e) { alert('로그인 실패: ' + e.message); }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  document.getElementById('login-overlay').style.display = user ? 'none' : 'flex';
  if (user) loadMonth();
});

/* ── 월 이동 ── */
document.getElementById('prev-btn').addEventListener('click', () => { curMonth--; if(curMonth<1){curMonth=12;curYear--;} loadMonth(); });
document.getElementById('next-btn').addEventListener('click', () => { curMonth++; if(curMonth>12){curMonth=1;curYear++;} loadMonth(); });

function loadMonth() {
  document.getElementById('month-title').textContent = `${curYear}년 ${curMonth}월`;
  const docId = `${curYear}-${pad(curMonth)}`;
  if (unsubPlan) unsubPlan();
  unsubPlan = onSnapshot(doc(db, 'artifacts', 'patek-s', 'public', 'data', 'sales_plans', docId), snap => {
    planData = snap.exists() ? snap.data() : null;
    applyToForm(planData);
    renderTable();
  });
}

/* ── 폼에 데이터 적용 ── */
function applyToForm(d) {
  const m = curMonth;
  document.getElementById('page-title').textContent      = `${m}월 매출 계획`;
  document.getElementById('confirmed-label').textContent = `${m}월 확정 매출`;
  document.getElementById('qty-label').textContent       = `${m}월 예상 Qty`;

  const sv = (id, val) => { const el = document.getElementById(id); if(el) el.value = (val != null) ? val : ''; };
  sv('prev-month-text',      d?.prevMonthText       ?? '');
  sv('remaining-target-text',d?.remainingTargetText ?? '');
  sv('report-date',          d?.reportDate          ?? new Date().toISOString().split('T')[0]);
  sv('month-sales-amount',   d?.monthSalesAmount    ?? '');
  sv('month-sales-qty',      d?.monthSalesQty       ?? '');
  sv('special-note',         d?.specialNote         ?? '');
  sv('special-note-amount',  d?.specialNoteAmount   ?? '');
  sv('prev-year-sales',      d?.prevYearSales       ?? '');
  sv('confirmed-amount',     d?.confirmedAmount     ?? '');
  sv('prev-year-confirmed',  d?.prevYearConfirmed   ?? '');
  sv('expected-qty',         d?.expectedQty         ?? '');
  sv('prev-year-qty',        d?.prevYearQty         ?? '');
  sv('footer-notes-text',    d?.footerNotes         ?? '');

  rows = d?.rows ? JSON.parse(JSON.stringify(d.rows)) : [];
}

/* ── 테이블 렌더 ── */
function renderTable() {
  const tbody = document.getElementById('plan-tbody');
  tbody.innerHTML = '';

  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.className = `row-${r.color || 'default'}`;
    tr.innerHTML = `
      <td class="col-ref"><div class="td-edit" contenteditable="true" data-idx="${idx}" data-field="ref" onblur="window.cellBlur(this)">${esc(r.ref||'')}</div></td>
      <td class="col-price"><div class="td-edit price-input" contenteditable="true" data-idx="${idx}" data-field="price" onblur="window.cellBlur(this)">${r.price != null && r.price !== '' ? Number(r.price).toLocaleString('ko-KR') : ''}</div></td>
      <td class="col-cur"><div class="td-edit" contenteditable="true" data-idx="${idx}" data-field="currentPlan" onblur="window.cellBlur(this)">${esc(r.currentPlan||'')}</div></td>
      <td class="col-car"><div class="td-edit" contenteditable="true" data-idx="${idx}" data-field="carryover" onblur="window.cellBlur(this)">${esc(r.carryover||'')}</div></td>
      <td class="col-act">
        <select class="color-select" data-idx="${idx}" onchange="window.changeRowColor(this)">
          <option value="default" ${(r.color||'default')==='default'?'selected':''}>기본</option>
          <option value="blue"    ${r.color==='blue'?'selected':''}>파랑</option>
          <option value="red"     ${r.color==='red'?'selected':''}>빨강</option>
        </select>
        <button class="del-btn" onclick="window.deleteRow(${idx})">✕</button>
      </td>`;
    tbody.appendChild(tr);
  });

  renderTotals();
}

function renderTotals() {
  const tfoot = document.getElementById('plan-tfoot');
  let totPrice = 0, totCurQty = 0, totCarQty = 0;
  let curAmtArr = [], carAmtArr = [];

  rows.forEach(r => {
    const p = parseFloat(String(r.price||'').replace(/,/g,'')) || 0;
    totPrice += p;
    if (r.currentPlan && r.currentPlan.trim()) totCurQty++;
    if (r.carryover  && r.carryover.trim())   totCarQty++;
    if (r.currentPlan && r.currentPlan.trim()) curAmtArr.push(p);
    if (r.carryover   && r.carryover.trim())  carAmtArr.push(p);
  });

  const curTotal = curAmtArr.reduce((s,v)=>s+v,0);
  const carTotal = carAmtArr.reduce((s,v)=>s+v,0);

  tfoot.innerHTML = `
    <tr class="total-row">
      <td><strong>Amount</strong></td>
      <td>${fmt(totPrice)}</td>
      <td>${fmt(curTotal)}</td>
      <td>${fmt(carTotal)}</td>
      <td></td>
    </tr>
    <tr class="total-row">
      <td><strong>Qty</strong></td>
      <td>${rows.length}</td>
      <td>${totCurQty}</td>
      <td>${totCarQty}</td>
      <td></td>
    </tr>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── 셀 편집 ── */
window.cellBlur = function(el) {
  const idx   = parseInt(el.dataset.idx);
  const field = el.dataset.field;
  if (idx < 0 || idx >= rows.length) return;
  let val = el.innerText.trim();
  if (field === 'price') {
    val = val.replace(/,/g, '');
    const n = parseFloat(val);
    rows[idx][field] = isNaN(n) ? '' : n;
    el.innerText = isNaN(n) ? '' : n.toLocaleString('ko-KR');
  } else {
    rows[idx][field] = val;
  }
  renderTotals();
};

window.changeRowColor = function(sel) {
  const idx = parseInt(sel.dataset.idx);
  rows[idx].color = sel.value;
  renderTable();
};

window.deleteRow = function(idx) {
  rows.splice(idx, 1);
  renderTable();
};

/* ── 행 추가 ── */
document.getElementById('add-row-btn').addEventListener('click', () => {
  rows.push({ ref:'', price:'', currentPlan:'', carryover:'', color:'default' });
  renderTable();
  const tbody = document.getElementById('plan-tbody');
  const last  = tbody.lastElementChild;
  if (last) last.querySelector('.td-edit').focus();
});

/* ── 저장 ── */
document.getElementById('save-btn').addEventListener('click', saveData);

async function saveData() {
  const gv = id => { const el=document.getElementById(id); return el ? el.value.trim() : ''; };
  const gn = id => { const v=gv(id); return v!=='' ? Number(v) : null; };

  const docId  = `${curYear}-${pad(curMonth)}`;
  const docRef = doc(db, 'artifacts', 'patek-s', 'public', 'data', 'sales_plans', docId);
  const data = {
    prevMonthText:       gv('prev-month-text'),
    remainingTargetText: gv('remaining-target-text'),
    reportDate:          gv('report-date'),
    monthSalesAmount:    gn('month-sales-amount'),
    monthSalesQty:       gn('month-sales-qty'),
    specialNote:         gv('special-note'),
    specialNoteAmount:   gn('special-note-amount'),
    prevYearSales:       gn('prev-year-sales'),
    confirmedAmount:     gn('confirmed-amount'),
    prevYearConfirmed:   gn('prev-year-confirmed'),
    expectedQty:         gn('expected-qty'),
    prevYearQty:         gn('prev-year-qty'),
    footerNotes:         gv('footer-notes-text'),
    rows: rows.map(r => ({
      ref:         r.ref         || '',
      price:       (r.price !== '' && r.price != null) ? Number(String(r.price).replace(/,/g,'')) : null,
      currentPlan: r.currentPlan || '',
      carryover:   r.carryover   || '',
      color:       r.color       || 'default'
    })),
    updatedAt: new Date().toISOString()
  };

  const btn = document.getElementById('save-btn');
  btn.textContent = '저장 중...';
  try {
    await setDoc(docRef, data, { merge: true });
    btn.textContent = '✔ 저장됨';
    setTimeout(() => { btn.textContent = '💾 저장'; }, 2000);
  } catch(e) {
    alert('저장 실패: ' + e.message);
    btn.textContent = '💾 저장';
  }
}

/* ── 엑셀 내보내기 ── */
document.getElementById('export-btn').addEventListener('click', () => {
  if (!window.XLSX) { alert('엑셀 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }
  const header = ['Ref.', '판매가', '당월 결제 예정', '이월 예정(컨펌전)'];
  const data = rows.map(r => [
    r.ref || '',
    (r.price !== '' && r.price != null) ? Number(String(r.price).replace(/,/g,'')) : '',
    r.currentPlan || '',
    r.carryover   || ''
  ]);
  const totPrice = rows.reduce((s,r)=>s+(parseFloat(String(r.price||'').replace(/,/g,''))||0),0);
  data.push(['Amount', totPrice, '', '']);
  data.push(['Qty', rows.length, rows.filter(r=>r.currentPlan?.trim()).length, rows.filter(r=>r.carryover?.trim()).length]);

  const ws = window.XLSX.utils.aoa_to_sheet([header, ...data]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, `${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb, `매출계획_${curYear}년${curMonth}월.xlsx`);
});

/* 초기 로드 */
loadMonth();
