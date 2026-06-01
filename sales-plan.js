import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FC = { apiKey:"AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY", authDomain:"patek-s.firebaseapp.com", projectId:"patek-s", storageBucket:"patek-s.firebasestorage.app", messagingSenderId:"786016749285", appId:"1:786016749285:web:58538eec1cf7e72068b60c" };
const app  = initializeApp(FC);
const auth = getAuth(app);
const db   = getFirestore(app);
const gp   = new GoogleAuthProvider();

const pad = n => String(n).padStart(2,'0');
let curYear = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let rows = [];
let unsubPlan = null;

const fmt = n => (n != null && n !== '' && !isNaN(Number(n))) ? Number(n).toLocaleString('ko-KR') : '';

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
document.getElementById('prev-btn').addEventListener('click', () => {
  curMonth--; if(curMonth < 1){ curMonth = 12; curYear--; } loadMonth();
});
document.getElementById('next-btn').addEventListener('click', () => {
  curMonth++; if(curMonth > 12){ curMonth = 1; curYear++; } loadMonth();
});

function loadMonth() {
  document.getElementById('month-title').textContent = `${curYear}년 ${curMonth}월`;
  if (unsubPlan) unsubPlan();
  const docId  = `${curYear}-${pad(curMonth)}`;
  const docRef = doc(db, 'artifacts', 'patek-s', 'public', 'data', 'sales_plans', docId);
  unsubPlan = onSnapshot(docRef, snap => {
    applyToForm(snap.exists() ? snap.data() : null);
    renderTable();
  });
}

/* ── 폼 적용 ── */
function applyToForm(d) {
  const m = curMonth;
  const sv = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ''; };

  document.getElementById('doc-title-input').value    = d?.title ?? `${m}월 매출 계획`;
  document.getElementById('confirmed-label').textContent = `${m}월 확정 매출`;
  document.getElementById('qty-label').textContent       = `${m}월 예상 Qty`;

  sv('prev-month-text',       d?.prevMonthText);
  sv('remaining-target-text', d?.remainingTargetText);
  sv('report-date',           d?.reportDate ?? new Date().toISOString().split('T')[0]);
  sv('month-sales-amount',    d?.monthSalesAmount);
  sv('month-sales-qty',       d?.monthSalesQty);
  sv('special-note',          d?.specialNote);
  sv('special-note-amount',   d?.specialNoteAmount);
  sv('prev-year-sales',       d?.prevYearSales);
  sv('confirmed-amount',      d?.confirmedAmount);
  sv('prev-year-confirmed',   d?.prevYearConfirmed);
  sv('expected-qty',          d?.expectedQty);
  sv('prev-year-qty',         d?.prevYearQty);
  sv('footer-notes',          d?.footerNotes);

  rows = d?.rows ? JSON.parse(JSON.stringify(d.rows)) : [];
}

/* ── 테이블 렌더 ── */
function renderTable() {
  const tbody = document.getElementById('plan-tbody');
  tbody.innerHTML = '';

  rows.forEach((r, idx) => {
    const priceDisp = (r.price != null && r.price !== '') ? Number(String(r.price).replace(/,/g,'')).toLocaleString('ko-KR') : '';
    const tr = document.createElement('tr');
    tr.className = `row-${r.color || 'default'}`;
    tr.innerHTML = `
      <td class="col-ref">
        <div class="cell-edit" contenteditable="true" data-idx="${idx}" data-field="ref" onblur="window._cb(this)">${esc(r.ref||'')}</div>
      </td>
      <td class="col-price price-cell">
        <div class="cell-edit" contenteditable="true" data-idx="${idx}" data-field="price" onblur="window._cb(this)" style="text-align:right">${esc(priceDisp)}</div>
      </td>
      <td class="col-cur">
        <div class="cell-edit" contenteditable="true" data-idx="${idx}" data-field="currentPlan" onblur="window._cb(this)">${esc(r.currentPlan||'')}</div>
      </td>
      <td class="col-car">
        <div class="cell-edit" contenteditable="true" data-idx="${idx}" data-field="carryover" onblur="window._cb(this)">${esc(r.carryover||'')}</div>
      </td>
      <td class="col-act">
        <select class="color-sel" data-idx="${idx}" onchange="window._cc(this)">
          <option value="default" ${(r.color||'default')==='default'?'selected':''}>기본</option>
          <option value="blue"    ${r.color==='blue'?'selected':''}>파랑</option>
          <option value="red"     ${r.color==='red'?'selected':''}>빨강</option>
        </select>
        <button class="del-btn" onclick="window._dr(${idx})">✕</button>
      </td>`;
    tbody.appendChild(tr);
  });

  renderTotals();
}

function renderTotals() {
  const tfoot = document.getElementById('plan-tfoot');
  let totPrice = 0, curAmt = 0, carAmt = 0, curQty = 0, carQty = 0;

  rows.forEach(r => {
    const p = parseFloat(String(r.price||'').replace(/,/g,'')) || 0;
    totPrice += p;
    if (r.currentPlan && r.currentPlan.trim()) { curAmt += p; curQty++; }
    if (r.carryover   && r.carryover.trim())   { carAmt += p; carQty++; }
  });

  tfoot.innerHTML = `
    <tr class="total-row">
      <td class="col-ref"><strong>Amount</strong></td>
      <td class="col-price" style="text-align:right">${fmt(totPrice)}</td>
      <td class="col-cur"   style="text-align:right">${fmt(curAmt)}</td>
      <td class="col-car"   style="text-align:right">${fmt(carAmt)}</td>
      <td class="col-act"></td>
    </tr>
    <tr class="total-row">
      <td class="col-ref"><strong>Qty</strong></td>
      <td class="col-price" style="text-align:right">${rows.length}</td>
      <td class="col-cur"   style="text-align:right">${curQty}</td>
      <td class="col-car"   style="text-align:right">${carQty}</td>
      <td class="col-act"></td>
    </tr>`;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── 셀 편집 콜백 ── */
window._cb = function(el) {
  const idx = parseInt(el.dataset.idx);
  const fld = el.dataset.field;
  if (idx < 0 || idx >= rows.length) return;
  let val = el.innerText.trim();
  if (fld === 'price') {
    const n = parseFloat(val.replace(/,/g,''));
    rows[idx][fld] = isNaN(n) ? '' : n;
    el.innerText = isNaN(n) ? '' : n.toLocaleString('ko-KR');
  } else {
    rows[idx][fld] = val;
  }
  renderTotals();
};

window._cc = function(sel) {
  rows[parseInt(sel.dataset.idx)].color = sel.value;
  renderTable();
};

window._dr = function(idx) {
  rows.splice(idx, 1);
  renderTable();
};

/* ── 행 추가 ── */
document.getElementById('add-row-btn').addEventListener('click', () => {
  rows.push({ ref:'', price:'', currentPlan:'', carryover:'', color:'default' });
  renderTable();
  const last = document.getElementById('plan-tbody').lastElementChild;
  if (last) last.querySelector('.cell-edit').focus();
});

/* ── 저장 ── */
document.getElementById('save-btn').addEventListener('click', saveData);

async function saveData() {
  const gv = id => { const el = document.getElementById(id); return el ? (el.value ?? el.textContent ?? '').toString().trim() : ''; };
  const gn = id => { const v = gv(id); return v !== '' ? Number(v) : null; };

  const docId  = `${curYear}-${pad(curMonth)}`;
  const docRef = doc(db, 'artifacts', 'patek-s', 'public', 'data', 'sales_plans', docId);

  const data = {
    title:               gv('doc-title-input'),
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
    footerNotes:         gv('footer-notes'),
    rows: rows.map(r => ({
      ref:         r.ref || '',
      price:       (r.price !== '' && r.price != null) ? Number(String(r.price).replace(/,/g,'')) : null,
      currentPlan: r.currentPlan || '',
      carryover:   r.carryover   || '',
      color:       r.color       || 'default'
    })),
    updatedAt: new Date().toISOString()
  };

  const btn = document.getElementById('save-btn');
  const orig = btn.textContent;
  btn.textContent = '저장 중...';
  try {
    await setDoc(docRef, data, { merge: true });
    btn.textContent = '✔ 저장됨';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch(e) {
    alert('저장 실패: ' + e.message);
    btn.textContent = orig;
  }
}

/* ── 엑셀 내보내기 ── */
document.getElementById('export-btn').addEventListener('click', () => {
  if (!window.XLSX) { alert('엑셀 라이브러리 로딩 중입니다.'); return; }
  const header = ['Ref.','판매가','당월 결제 예정','이월 예정(컨펌전)'];
  const data = rows.map(r => [
    r.ref || '',
    (r.price != null && r.price !== '') ? Number(String(r.price).replace(/,/g,'')) : '',
    r.currentPlan || '',
    r.carryover   || ''
  ]);
  const totP = rows.reduce((s,r)=>s+(parseFloat(String(r.price||'').replace(/,/g,''))||0),0);
  data.push(['Amount', totP, '', '']);
  data.push(['Qty', rows.length, rows.filter(r=>r.currentPlan?.trim()).length, rows.filter(r=>r.carryover?.trim()).length]);
  const ws = window.XLSX.utils.aoa_to_sheet([header, ...data]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, `${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb, `매출계획_${curYear}년${curMonth}월.xlsx`);
});

loadMonth();
