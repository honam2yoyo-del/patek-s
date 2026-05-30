import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FC = { apiKey:"AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY", authDomain:"patek-s.firebaseapp.com", projectId:"patek-s", storageBucket:"patek-s.firebasestorage.app", messagingSenderId:"786016749285", appId:"1:786016749285:web:58538eec1cf7e72068b60c" };
const app = initializeApp(FC);
const auth = getAuth(app);
const db   = getFirestore(app);
const gp   = new GoogleAuthProvider();

const HOLIDAYS = { "2026-01-01":"신정","2026-02-16":"설날연휴","2026-02-17":"설날","2026-02-18":"설날연휴","2026-03-01":"삼일절","2026-03-02":"대체공휴일","2026-05-05":"어린이날","2026-05-24":"부처님오신날","2026-05-25":"대체공휴일","2026-06-03":"지방선거","2026-06-06":"현충일","2026-08-15":"광복절","2026-08-17":"대체공휴일","2026-09-24":"추석연휴","2026-09-25":"추석","2026-09-26":"추석연휴","2026-09-28":"대체공휴일","2026-10-03":"개천절","2026-10-05":"대체공휴일","2026-10-09":"한글날","2026-12-25":"기독탄신일" };
const DNAMES = ['일','월','화','수','목','금','토'];
const DEF_ANNUAL = { '옥영세':15,'엄인주':13.5,'장용석':10.5,'최혜지':17,'이승범':6,'형영지':9 };
const DEF_TIME   = { '엄인주':0.5,'장용석':1.5,'최혜지':1.5,'형영지':0.5 };

let curYear=2026, curMonth=7;
let schedulesData={}, leaveRequests=[], calEvents=[], timeRequests=[], staffList=[];
let copiedValue=null, copiedEl=null;
function clearCopyMode() { if(copiedEl){copiedEl.classList.remove('cell-copied');copiedEl=null;} copiedValue=null; }

const pad = n => String(n).padStart(2,'0');
const getDays = (y,m) => new Date(y,m,0).getDate();
const ds = (y,m,d) => `${y}-${pad(m)}-${pad(d)}`;

/* ── 표시 코드 변환 ── */
function dispCode(raw) {
  const u = String(raw||'').trim().toUpperCase();
  if (!u || u==='/' || u==='휴' || u==='휴무') return '/';
  if (u==='A반' || u==='A반차' || u==='A반차') return 'A반';
  if (u==='B반' || u==='B반차') return 'B반';
  if (u==='A') return 'A';
  if (u==='B') return 'B';
  if (u==='C') return 'C';
  if (u==='연차'||u==='연') return '연';
  if (u==='경조'||u==='경') return '경';
  return raw || '/';
}

/* 저장용 코드로 역변환 */
function storeCode(disp) {
  const u = String(disp||'').trim().toUpperCase();
  if (u==='/' || !u) return '';
  if (u==='연') return '연차';
  if (u==='경') return '경조';
  if (u==='A반') return 'A반';
  if (u==='B반') return 'B반';
  return u; // A, B, C as-is
}

/* ── 렌더 ── */
function render() {
  const total = getDays(curYear, curMonth);
  const mKey  = `${curYear}-${pad(curMonth)}`;
  document.getElementById('month-title').textContent = `${curYear}년 ${curMonth}월`;

  const mDoc      = schedulesData[mKey] || {};
  const staffNames = mDoc.staffNames || Object.keys(DEF_ANNUAL);

  // calEvent map
  const calMap = {};
  calEvents.forEach(e => { calMap[e.date] = e; });

  // leave request matrix: name → day → type (requested)
  const reqM = {};
  staffNames.forEach(n => { reqM[n] = {}; });
  leaveRequests.forEach(req => {
    if (!reqM[req.name]) return;
    const s=new Date(req.startDate), e=new Date(req.endDate||req.startDate);
    for (let d=new Date(s); d<=e; d.setDate(d.getDate()+1))
      if (d.getFullYear()===curYear && d.getMonth()+1===curMonth)
        reqM[req.name][d.getDate()] = req.type;
  });

  // schedule matrix: name → day → code (admin-set)
  const schM = {};
  staffNames.forEach(n => {
    schM[n] = {};
    const uD = (mDoc.staffs||{})[n] || {};
    for (let d=1; d<=total; d++) schM[n][d] = uD[d]||uD[String(d)]||'';
  });

  // time used
  const tUsed = {};
  timeRequests.forEach(r => { tUsed[r.name] = (tUsed[r.name]||0)+(r.hours||0); });

  // staffMeta
  const sMeta = {};
  staffList.forEach(s => { sMeta[s.name] = { annual: s.annualLeave??DEF_ANNUAL[s.name]??15, time: s.timeAllowance??DEF_TIME[s.name]??0 }; });

  /* ── 헤더 행 1: 날짜 번호 ── */
  let thD = `<th class="s-annual" rowspan="2" style="background:#EDE0CB;">연차</th>
             <th class="s-name" rowspan="2" style="background:#EDE0CB;border-right:2px solid #C8B095 !important;">이름</th>`;
  let thW = '';
  for (let d=1; d<=total; d++) {
    const date = ds(curYear,curMonth,d);
    const dow  = new Date(curYear,curMonth-1,d).getDay();
    const isHol = !!HOLIDAYS[date];
    const cal   = calMap[date];
    const calType  = cal?.type || '';
    const isClosed = calType === '정기휴무';
    const isEvent  = calType !== '' && calType !== '정기휴무';
    const isSunday = dow===0;
    const isRed    = isHol || dow===0 || dow===6;
    const wSep     = isSunday ? ' week-sep' : '';
    const SCH_EV_BG = {'정기휴무':'#F2F2F2','행사':'#EEF8E6','판매일정':'#FFF4D6','고객':'#FFF4D6','교육':'#EAF3FF','기타':'#F4EEFB'};
    const colBg    = calType ? `background:${SCH_EV_BG[calType]||'#C3E19E'};` : '';
    const rCls     = isRed ? ' red-hdr' : '';
    thD += `<th class="th-d${wSep}${rCls}" style="${colBg}">${d}</th>`;
    thW += `<th class="th-w${wSep}${rCls}" style="${colBg}">${DNAMES[dow]}${isHol?'*':''}</th>`;
  }
  ['DO','A','B','C','사용연차','남은연차','시간찾기'].forEach(s => { thD += `<th class="th-sum" rowspan="2">${s}</th>`; });

  /* ── 데이터 행 ── */
  let rows = '';
  staffNames.forEach(name => {
    const meta = sMeta[name] || { annual: DEF_ANNUAL[name]??15, time: DEF_TIME[name]??0 };
    let cA=0, cB=0, cC=0, cAnn=0, cOff=0;
    let cells = '';

    for (let d=1; d<=total; d++) {
      const date  = ds(curYear,curMonth,d);
      const dow   = new Date(curYear,curMonth-1,d).getDay();
      const cal   = calMap[date];
      const calType2 = cal?.type || '';
      const isClosed = calType2 === '정기휴무';
      const isEvent  = calType2 !== '' && calType2 !== '정기휴무';
      const isSunday = dow===0;

      const schedVal = schM[name][d];   // admin-set or ''
      const reqVal   = reqM[name][d];   // requested or undefined

      let code='', isReq=false;
      if (schedVal && reqVal) {
        // 스케줄 데이터와 신청이 둘 다 있으면 → 신청 반영된 것 → 노란색
        code = schedVal; isReq = true;
      } else if (schedVal) {
        code = schedVal; isReq = false;  // 관리자 입력만 → 흰색
      } else if (reqVal) {
        code = reqVal;   isReq = true;   // 신청만 → 노란색
      }

      const disp = dispCode(code);
      const norm = disp.replace('반차','반').toUpperCase();
      if (norm==='A'||norm==='A반') cA++;
      else if (norm==='B'||norm==='B반') cB++;
      else if (norm==='C') cC++;
      else if (disp==='연') cAnn++;
      else cOff++;

      // 셀 스타일
      let dataClosed = isClosed ? ' data-caloff="1"' : '';
      let dataEvent  = isEvent ? ` data-evtype="${calType2}"` : '';
      let dataReq    = (!isClosed && !isEvent && isReq) ? ' data-req="1"' : '';
      const wSep = isSunday ? ' week-sep' : '';

      const slashCls = (disp === '/' && !isClosed && !isEvent) ? ' td-slash' : '';
      cells += `<td class="td-edit${wSep}${slashCls}" contenteditable="true" data-staff="${name}" data-day="${d}"${dataClosed}${dataEvent}${dataReq} onblur="normalizeCell(this)" onkeydown="handleKey(event,this)" onpaste="handlePaste(event)">${disp}</td>`;
    }

    const annual  = meta.annual;
    const annUsed = cAnn;
    const annRem  = (annual - annUsed).toFixed(1);
    const timeAlloc = meta.time || DEF_TIME[name] || 0;
    const timeRem   = Math.max(0, timeAlloc - (tUsed[name]||0));
    const timeDisp  = timeAlloc > 0 ? timeRem.toFixed(1) : '-';

    rows += `<tr>
      <td class="s-annual">${annual}</td>
      <td class="s-name">${name}</td>
      ${cells}
      <td class="td-sum" data-col="do">${cOff}</td>
      <td class="td-sum td-a" data-col="a">${cA}</td>
      <td class="td-sum td-b" data-col="b">${cB}</td>
      <td class="td-sum td-c" data-col="c">${cC}</td>
      <td class="td-sum" data-col="uann">${annUsed}.0</td>
      <td class="td-sum" data-col="rann" style="color:#2E7D32;">${annRem}</td>
      <td class="td-sum" data-col="time" style="color:#7A5200;">${timeDisp}</td>
    </tr>`;
  });

  document.getElementById('table-wrap').innerHTML =
    `<table class="sched" id="sched-table">
      <thead><tr>${thD}</tr><tr>${thW}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  renderFooter(staffNames, sMeta, tUsed);
  renderStats(staffNames, sMeta);
  // 법정공휴일 + 주말 합산 업데이트
  let holCount = 0;
  const offSet = new Set();
  for (let d=1; d<=total; d++) {
    const date = ds(curYear,curMonth,d);
    const dow  = new Date(curYear,curMonth-1,d).getDay();
    if (HOLIDAYS[date]) holCount++;
    if (dow===0 || dow===6 || HOLIDAYS[date]) offSet.add(d);
  }
  const hcEl = document.getElementById('holiday-count');
  if (hcEl) hcEl.textContent = `법정공휴일 ${offSet.size}일`;

  document.getElementById('loading').style.display='none';
  document.getElementById('table-wrap').style.display='block';
  document.getElementById('footer-area').style.display='flex';
  requestAnimationFrame(autoScaleTable);
}

/* ── 푸터 렌더 ── */
function renderFooter(staffNames, sMeta, tUsed) {
  // 지역(사유)
  const regionEl = document.getElementById('region-list');
  const regionList = leaveRequests.filter(req => {
    if (!req.region) return false;
    const s=new Date(req.startDate), e=new Date(req.endDate||req.startDate);
    const days = Math.ceil((e-s)/86400000)+1;
    if (days<3) return false;
    return (s.getFullYear()===curYear&&s.getMonth()+1===curMonth)||(e.getFullYear()===curYear&&e.getMonth()+1===curMonth);
  });
  if (regionList.length===0) {
    regionEl.innerHTML='<span class="no-data">없음</span>';
  } else {
    regionEl.innerHTML = regionList.map(r =>
      `<div>• <strong>${r.name}</strong> ${r.startDate}${r.endDate&&r.endDate!==r.startDate?` ~ ${r.endDate}`:''} <span style="color:#B4975A;">[${r.region}]</span></div>`
    ).join('');
  }

  // 시간찾기 잔여
  const timeArea = document.getElementById('time-remain-area');
  const chips = staffNames
    .map(n => { const alloc=(sMeta[n]?.time||DEF_TIME[n]||0); const rem=Math.max(0,alloc-(tUsed[n]||0)); return rem>0?{name:n,rem}:null; })
    .filter(Boolean);
  if (timeArea) {
    timeArea.innerHTML = chips.length===0
      ? '<span style="color:#bbb;font-size:12px;">없음</span>'
      : chips.map(c=>`<span class="time-chip">${c.name}: ${c.rem.toFixed(1)}h</span>`).join('');
  }
}

/* ── 직원별 현황 표 렌더 ── */
function renderStats(staffNames, sMeta) {
  const statsArea = document.getElementById('stats-area');
  if (!statsArea) return;

  const tUsed = {};
  timeRequests.forEach(r => { tUsed[r.name] = (tUsed[r.name]||0)+(r.hours||0); });

  function calcStats(allYear) {
    return staffNames.map(name => {
      let cA=0, cB=0, cC=0, cAnn=0, cWkOff=0;
      const mKey = `${curYear}-${pad(curMonth)}`;
      const docsToCheck = allYear
        ? Object.entries(schedulesData).filter(([k]) => k.startsWith(String(curYear)))
        : [[mKey, schedulesData[mKey]||{}]];
      docsToCheck.forEach(([key, docData]) => {
        const m = parseInt(key.split('-')[1]);
        const days = getDays(curYear, m);
        const uD = (docData.staffs||{})[name]||{};
        for (let d=1; d<=days; d++) {
          const dStr = ds(curYear, m, d);
          const dow = new Date(curYear, m-1, d).getDay();
          const isHol = !!HOLIDAYS[dStr];
          let code = uD[d]||uD[String(d)]||'';
          const lv = leaveRequests.find(r => r.name===name && dStr>=r.startDate && dStr<=(r.endDate||r.startDate));
          if (lv) code = lv.type;
          const u = String(code).trim().toUpperCase();
          if (u==='A'||u==='A반') cA++;
          else if (u==='B'||u==='B반') cB++;
          else if (u==='C') cC++;
          else if (u==='연차'||u==='연') cAnn++;
          else if (dow===0||dow===6||isHol) cWkOff++;
        }
      });
      const meta = sMeta[name]||{annual:DEF_ANNUAL[name]??15, time:DEF_TIME[name]||0};
      const annAlloc = meta.annual ?? DEF_ANNUAL[name] ?? 15;
      const annRemain = annAlloc - cAnn;
      const remain = Math.max(0, (meta.time||0)-(tUsed[name]||0));
      return { name, cA, cB, cC, cAnn, cWkOff, remain, annAlloc, annRemain };
    });
  }

  const monthStats = calcStats(false);
  const yearStats  = calcStats(true);

  const thS = 'padding:6px 8px;font-size:10px;font-weight:800;color:white;text-align:center;border-right:1px solid rgba(255,255,255,.2);white-space:nowrap;';
  const tdS = 'padding:5px 8px;font-size:11px;font-weight:600;text-align:center;border-bottom:1px solid #F0EFEA;';

  function buildTable(title, stats, headerBg) {
    const rows = stats.map(s => `
      <tr>
        <td class="stats-tbl" style="${tdS}text-align:left;font-weight:700;color:#333;">${s.name}</td>
        <td class="stats-tbl" style="${tdS}color:#555;">${s.annAlloc}</td>
        <td class="stats-tbl" style="${tdS}color:#B4975A;">${s.cAnn.toFixed(1)}</td>
        <td class="stats-tbl" style="${tdS}color:#2E7D32;">${s.annRemain.toFixed(1)}</td>
        <td class="stats-tbl" style="${tdS}color:#6E2626;">${s.cA}</td>
        <td class="stats-tbl" style="${tdS}color:#234B7A;">${s.cB}</td>
        <td class="stats-tbl" style="${tdS}color:#7A4F14;">${s.cC}</td>
        <td class="stats-tbl" style="${tdS}color:#555;">${s.cWkOff}</td>
      </tr>`).join('');
    return `
      <div style="flex:1;min-width:320px;">
        <div style="font-size:13px;font-weight:800;color:#333;margin-bottom:8px;">${title}</div>
        <div style="overflow-x:auto;border-radius:12px;border:1px solid #E8E4DB;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <table style="width:100%;border-collapse:collapse;min-width:300px;">
            <thead><tr style="background:${headerBg};">
              <th class="stats-tbl" style="${thS}text-align:left;">직원</th>
              <th class="stats-tbl" style="${thS}">총연차</th>
              <th class="stats-tbl" style="${thS}">사용</th>
              <th class="stats-tbl" style="${thS}">잔여</th>
              <th class="stats-tbl" style="${thS}">A</th>
              <th class="stats-tbl" style="${thS}">B</th>
              <th class="stats-tbl" style="${thS}">C</th>
              <th class="stats-tbl" style="${thS}border-right:none;">주말·공휴일</th>
            </tr></thead>
            <tbody style="background:white;">${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  statsArea.style.display = 'block';
  statsArea.innerHTML = `
    <div class="stats-wrap" style="display:flex;gap:16px;flex-wrap:wrap;">
      ${buildTable(`${curYear}년 누적 현황`, yearStats, '#7A6B5A')}
    </div>`;
}

/* ── 인라인 편집 ── */
window.normalizeCell = function(el) {
  const raw = el.textContent.trim();
  const norm = dispCode(raw);
  if (el.textContent !== norm) el.textContent = norm;
  const hasClosed = el.hasAttribute('data-caloff');
  const hasEvent  = el.hasAttribute('data-evtype');
  el.classList.toggle('td-slash', norm === '/' && !hasClosed && !hasEvent);
  updateRowSummary(el.closest('tr'));
};

window.handleKey = function(e, el) {
  if (e.key==='Enter') { e.preventDefault(); el.blur(); }
  if (e.key==='Escape') { e.preventDefault(); clearCopyMode(); el.blur(); }
  if (e.key==='Tab') {
    e.preventDefault(); el.blur();
    const cells=document.querySelectorAll('.td-edit');
    const idx=Array.from(cells).indexOf(el);
    if(cells[idx+(e.shiftKey?-1:1)]) cells[idx+(e.shiftKey?-1:1)].focus();
  }
  if (e.ctrlKey && e.key.toLowerCase()==='c') {
    copiedValue = el.textContent.trim();
    if(copiedEl) copiedEl.classList.remove('cell-copied');
    copiedEl = el; el.classList.add('cell-copied');
  }
  if (e.ctrlKey && e.key.toLowerCase()==='v' && copiedValue!==null) {
    e.preventDefault();
    el.textContent = copiedValue;
    normalizeCell(el);
    clearCopyMode();
  }
};

window.handlePaste = function(e) {
  e.preventDefault();
  const text = (e.clipboardData||window.clipboardData).getData('text/plain').trim();
  document.execCommand('insertText',false,text);
};

/* 화면 크기에 맞게 테이블 자동 축소 */
function autoScaleTable() {
  const wrap = document.getElementById('table-wrap');
  const tbl  = document.getElementById('sched-table');
  if (!wrap || !tbl) return;
  tbl.style.zoom = '';
  const ratio = (wrap.clientWidth - 4) / tbl.scrollWidth;
  tbl.style.zoom = ratio;   // 작으면 줄이고, 크면 늘려서 항상 꽉 채움
  wrap.style.overflowX = 'hidden';
}
window.addEventListener('resize', autoScaleTable);

/* 셀 포커스 시 텍스트 전체 선택 (엑셀처럼) */
document.getElementById('table-wrap').addEventListener('focus', function(e) {
  if (!e.target.classList.contains('td-edit')) return;
  const range = document.createRange();
  range.selectNodeContents(e.target);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}, true);

function updateRowSummary(tr) {
  if (!tr) return;
  const cells=tr.querySelectorAll('.td-edit');
  let cA=0,cB=0,cC=0,cAnn=0,cOff=0;
  cells.forEach(c=>{
    const v=dispCode(c.textContent);
    const u=v.toUpperCase();
    if(u==='A'||u==='A반') cA++;
    else if(u==='B'||u==='B반') cB++;
    else if(u==='C') cC++;
    else if(v==='연') cAnn++;
    else cOff++;
  });
  const annual = parseFloat(tr.querySelector('.s-annual')?.textContent)||15;
  const sums = tr.querySelectorAll('.td-sum');
  if(sums[0]) sums[0].textContent=cOff;
  if(sums[1]) sums[1].textContent=cA;
  if(sums[2]) sums[2].textContent=cB;
  if(sums[3]) sums[3].textContent=cC;
  if(sums[4]) sums[4].textContent=cAnn+'.0';
  if(sums[5]) sums[5].textContent=(annual-cAnn).toFixed(1);
}

/* ── 저장하기 ── */
document.getElementById('save-btn').addEventListener('click', async () => {
  const table = document.getElementById('sched-table');
  if (!table) return;
  const mKey  = `${curYear}-${pad(curMonth)}`;
  const mDoc  = schedulesData[mKey]||{};
  const staffNames = mDoc.staffNames || Object.keys(DEF_ANNUAL);
  const newStaffs = {};
  table.querySelectorAll('tbody tr').forEach(tr => {
    const nameEl = tr.querySelector('.s-name');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    newStaffs[name] = {};
    tr.querySelectorAll('.td-edit').forEach(td => {
      const day = td.dataset.day;
      const disp = td.textContent.trim();
      const stored = storeCode(disp);
      newStaffs[name][day] = stored;
    });
  });
  const now = new Date();
  const ts = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  try {
    await setDoc(doc(db,'artifacts','patek-s','public','data','schedules',mKey), {
      staffs: newStaffs, staffNames,
      lastUpdated: ts, updatedBy: auth.currentUser?.displayName||auth.currentUser?.email||'생성기'
    }, { merge: true });
    alert('✅ 저장됐습니다!');
  } catch(e) { alert('오류: '+e.message); }
});

/* ── 신청 반영하기 ── */
document.getElementById('apply-btn').addEventListener('click', () => {
  const mKey  = `${curYear}-${pad(curMonth)}`;
  const mDoc  = schedulesData[mKey]||{};
  const staffNames = mDoc.staffNames || Object.keys(DEF_ANNUAL);
  const calMap = {}; calEvents.forEach(e=>{ calMap[e.date]=e; });

  const items = leaveRequests.filter(req => {
    const s=new Date(req.startDate), e=new Date(req.endDate||req.startDate);
    return (s.getFullYear()===curYear&&s.getMonth()+1===curMonth)||(e.getFullYear()===curYear&&e.getMonth()+1===curMonth);
  });

  if (items.length===0) { alert(`${curYear}년 ${curMonth}월에 반영할 신청 내역이 없습니다.`); return; }

  const tbody = items.map(r=>{
    const s=new Date(r.startDate),e=new Date(r.endDate||r.startDate);
    const days=Math.ceil((e-s)/86400000)+1;
    const regionTxt = days>=3&&r.region ? `<td style="color:#B4975A;font-weight:800;">${r.region}</td>` : '<td style="color:#aaa;">-</td>';
    return `<tr><td style="font-weight:700;">${r.name}</td><td>${r.startDate}${r.endDate&&r.endDate!==r.startDate?`~${r.endDate}`:''}</td><td><span class="code-badge">${r.type}</span></td>${regionTxt}</tr>`;
  }).join('');

  document.getElementById('apply-desc').innerHTML = `<strong>${curYear}년 ${curMonth}월</strong> 신청 내역 <strong>${items.length}건</strong>을 근무표에 반영합니다.<br>기존 데이터는 신청 내용으로 <strong style="color:#C0392B;">덮어씌워집니다.</strong>`;
  document.getElementById('apply-list').innerHTML = `<table><thead><tr><th>이름</th><th>날짜</th><th>종류</th><th>지역(사유)</th></tr></thead><tbody>${tbody}</tbody></table>`;
  document.getElementById('apply-overlay').style.display='flex';

  // 데이터 저장용
  document.getElementById('apply-confirm-btn')._data = { items, mDoc, mKey, staffNames, calMap };
});
document.getElementById('apply-overlay').addEventListener('click', e=>{ if(e.target===document.getElementById('apply-overlay')) document.getElementById('apply-overlay').style.display='none'; });

document.getElementById('apply-confirm-btn').addEventListener('click', async () => {
  const btn = document.getElementById('apply-confirm-btn');
  const { items, mDoc, mKey, staffNames, calMap } = btn._data;
  btn.textContent='반영 중...'; btn.disabled=true;
  try {
    const newStaffs = JSON.parse(JSON.stringify(mDoc.staffs||{}));
    staffNames.forEach(n=>{ if(!newStaffs[n]) newStaffs[n]={}; });

    // 1. 스케줄 신청 반영
    items.forEach(req=>{
      if (!staffNames.includes(req.name)) return;
      const s=new Date(req.startDate), e=new Date(req.endDate||req.startDate);
      for (let d=new Date(s);d<=e;d.setDate(d.getDate()+1))
        if(d.getFullYear()===curYear&&d.getMonth()+1===curMonth)
          newStaffs[req.name][String(d.getDate())] = req.type;
    });

    const now=new Date();
    const ts=`${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    await setDoc(doc(db,'artifacts','patek-s','public','data','schedules',mKey), {
      staffs: newStaffs, staffNames,
      lastUpdated: ts, updatedBy: auth.currentUser?.displayName||auth.currentUser?.email||'생성기'
    }, { merge: true });

    document.getElementById('apply-overlay').style.display='none';
    alert(`✅ ${items.length}건이 근무표에 반영됐습니다.`);
  } catch(e) { alert('오류: '+e.message); }
  finally { btn.textContent='반영하기'; btn.disabled=false; }
});

/* ── 직원 설정 ── */
document.getElementById('settings-btn').addEventListener('click', ()=>{
  const mKey=`${curYear}-${pad(curMonth)}`;
  const names=(schedulesData[mKey]?.staffNames)||Object.keys(DEF_ANNUAL);
  document.getElementById('settings-tbody').innerHTML=names.map(n=>{
    const m=staffList.find(s=>s.name===n)||{};
    return `<tr><td style="font-weight:700;">${n}</td>
    <td><input type="number" step=".5" min="0" id="sa-${n}" value="${m.annualLeave??DEF_ANNUAL[n]??15}"/></td>
    <td><input type="number" step=".5" min="0" id="st-${n}" value="${m.timeAllowance??DEF_TIME[n]??0}"/></td></tr>`;
  }).join('');
  document.getElementById('settings-overlay').style.display='flex';
});
document.getElementById('settings-overlay').addEventListener('click',e=>{ if(e.target===document.getElementById('settings-overlay')) document.getElementById('settings-overlay').style.display='none'; });
document.getElementById('settings-save-btn').addEventListener('click', async ()=>{
  const mKey=`${curYear}-${pad(curMonth)}`;
  const names=(schedulesData[mKey]?.staffNames)||Object.keys(DEF_ANNUAL);
  await Promise.all(names.map(n=>{
    const s=staffList.find(x=>x.name===n);
    if(!s?.id) return;
    const annual=parseFloat(document.getElementById(`sa-${n}`)?.value||0);
    const time=parseFloat(document.getElementById(`st-${n}`)?.value||0);
    return updateDoc(doc(db,'users',s.id),{annualLeave:annual,timeAllowance:time});
  }).filter(Boolean));
  document.getElementById('settings-overlay').style.display='none';
  alert('저장됐습니다!');
});

/* ── 엑셀 내보내기 ── */
document.getElementById('export-btn').addEventListener('click', ()=>{
  if(!window.XLSX){alert('라이브러리 로딩 중');return;}
  const total=getDays(curYear,curMonth);
  const mKey=`${curYear}-${pad(curMonth)}`;
  const mDoc=schedulesData[mKey]||{};
  const names=mDoc.staffNames||Object.keys(DEF_ANNUAL);
  const sMeta={}; staffList.forEach(s=>{sMeta[s.name]={annual:s.annualLeave??DEF_ANNUAL[s.name]??15};});
  const reqM={}; names.forEach(n=>{reqM[n]={};});
  leaveRequests.forEach(req=>{ if(!reqM[req.name]) return; const s=new Date(req.startDate),e=new Date(req.endDate||req.startDate); for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)) if(d.getFullYear()===curYear&&d.getMonth()+1===curMonth) reqM[req.name][d.getDate()]=req.type; });
  const header=['연차','이름',...Array.from({length:total},(_,i)=>`${i+1}`),'DO','A','B','C','사용연차','남은연차'];
  const data=names.map(n=>{
    const annual=(sMeta[n]?.annual??DEF_ANNUAL[n]??15);
    const uD=(mDoc.staffs||{})[n]||{};
    let cA=0,cB=0,cC=0,cAnn=0,cOff=0;
    const cells=Array.from({length:total},(_,i)=>{
      const d=i+1; const sc=uD[d]||uD[String(d)]||''; const rq=reqM[n][d];
      const code=sc||(rq||''); const disp=dispCode(code);
      const u=disp.toUpperCase();
      if(u==='A'||u==='A반') cA++; else if(u==='B'||u==='B반') cB++; else if(u==='C') cC++; else if(disp==='연') cAnn++; else cOff++;
      return disp;
    });
    return [annual,n,...cells,cOff,cA,cB,cC,cAnn,(annual-cAnn).toFixed(1)];
  });
  const ws=window.XLSX.utils.aoa_to_sheet([header,...data]);
  const wb=window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb,ws,`${curYear}년${curMonth}월`);
  window.XLSX.writeFile(wb,`스케줄_${curYear}년${curMonth}월.xlsx`);
});

/* ── 월 네비 ── */
document.getElementById('prev-btn').addEventListener('click',()=>{curMonth--;if(curMonth<1){curMonth=12;curYear--;}render();});
document.getElementById('next-btn').addEventListener('click',()=>{curMonth++;if(curMonth>12){curMonth=1;curYear++;}render();});

/* ── Firebase 리스너 ── */
function startListeners() {
  onSnapshot(collection(db,'artifacts','patek-s','public','data','schedules'),snap=>{schedulesData={};snap.docs.forEach(d=>{schedulesData[d.id]=d.data();});render();});
  onSnapshot(collection(db,'artifacts','patek-s','public','data','leave_requests'),snap=>{leaveRequests=snap.docs.map(d=>({id:d.id,...d.data()}));render();});
  onSnapshot(collection(db,'artifacts','patek-s','public','data','cal_events'),snap=>{calEvents=snap.docs.map(d=>({id:d.id,...d.data()}));render();});
  onSnapshot(collection(db,'artifacts','patek-s','public','data','time_requests'),snap=>{timeRequests=snap.docs.map(d=>({id:d.id,...d.data()}));render();});
  onSnapshot(collection(db,'users'),snap=>{staffList=snap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.approved===true);render();});
}

/* ── 인증 ── */
onAuthStateChanged(auth,user=>{ if(user){document.getElementById('login-overlay').style.display='none';startListeners();}else{document.getElementById('login-overlay').style.display='flex';}});
document.getElementById('login-btn').addEventListener('click',async()=>{try{await signInWithPopup(auth,gp);}catch(e){if(e.code!=='auth/popup-closed-by-user')alert('로그인 오류: '+e.message);}});
document.getElementById('logout-btn').addEventListener('click',()=>signOut(auth));
