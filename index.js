    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getFirestore, collection, onSnapshot, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyCt7aQXA5eFdnDTMHlRhjPAkyH4b8UB6HY",
      authDomain: "patek-s.firebaseapp.com",
      projectId: "patek-s",
      storageBucket: "patek-s.firebasestorage.app",
      messagingSenderId: "786016749285",
      appId: "1:786016749285:web:58538eec1cf7e72068b60c",
      measurementId: "G-QZQYBJMFH8"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const provider = new GoogleAuthProvider();

    const CATEGORIES = {
        '매장': { bg: '#F9E5E2', text: '#D46B61' },
        '본사': { bg: '#E3EDFD', text: '#5A85DB' },
        'PP': { bg: '#FCE6C3', text: '#D69641' },
        '백화점': { bg: '#E5E5E5', text: '#7A7A7A' },
        '행사': { bg: '#EBE2FB', text: '#8E67C9' }
    };
    const CAL_EVENT_STYLES = {
        '판매일정': { bg: '#FFF3D8', border: '#E4B95D', text: '#7B4A00', dot: '#E4B95D' },
        '고객':     { bg: '#FFF3D8', border: '#E4B95D', text: '#7B4A00', dot: '#E4B95D' },
        '행사':     { bg: '#EEF8E8', border: '#9DCB75', text: '#4B7C2F', dot: '#7CB65C' },
        '교육':     { bg: '#EAF4FF', border: '#8DB8E8', text: '#27659A', dot: '#5B9AD6' },
        '정기휴무': { bg: '#F2F2F2', border: '#C9C9C9', text: '#555555', dot: '#C9C9C9' },
        '기타':     { bg: '#F5EDFA', border: '#C9AEDB', text: '#6A4A7C', dot: '#C9AEDB' },
    };
    window.calFilter = '전체';
    window.selectedCalDate = null;
    window.editingCalEventId = null;

    window.setCalFilter = function(filter) {
        window.calFilter = filter;
        document.querySelectorAll('.cal-filter-btn').forEach(btn => {
            const active = btn.dataset.filter === filter;
            btn.style.backgroundColor = active ? '#B8860B' : '#FFFFFF';
            btn.style.color = active ? '#FFFFFF' : '#2B1A12';
            btn.style.borderColor = active ? '#B8860B' : '#E0C897';
        });
        window.renderMainCalendar();
    };

    window.selectCalDate = function(dateStr) {
        window.selectedCalDate = dateStr;
        window.renderMainCalendar();
    };

    function calEvLabel(ev) {
        const isSales = ev.type === '판매일정' || ev.type === '고객';
        if (isSales) {
            const parts = [ev.time, ev.customerName, ev.modelName].filter(Boolean);
            return parts.length > 0 ? parts.join(' ') : (ev.reason || ev.type);
        }
        return ev.reason || ev.type;
    }

    function calTypeName(type) {
        return type === '고객' ? '판매일정' : type;
    }
    const MAX_READERS = 6;

    let currentUser = null;
    window.currentUserData = null; 
    window.staffList = []; 

    let unsubscribeNotices = null;
    let unsubscribeApproval = null;
    let unsubscribeAlbums = null;
    let unsubscribeSchedules = null;
    let unsubscribeLeaveRequests = null;
    let unsubscribeStaffs = null;
    let unsubscribeCalEvents = null;
    
    window.appNotices = [];
    window.noticeSearchQuery = '';
    window.noticeCategoryFilter = '전체';
    window.noticeSortType = 'registerDesc';
    window.selectedNoticeId = null;
    window.noticeEditCategory = '';
    
    window.albums = [];
    window.selectedAlbumIds = [];
    window.albumFilter = '전체';
    window.albumSearchQuery = '';
    window.albumForm = { id: '', files: [], category: '기타', title: '', ref: '', memo: '', imageUrl: '' };

    window.scheduleYear = 2026;
    window.scheduleMonth = 5;
    window.schedulesData = {}; 
    window.leaveRequests = []; 
    window.calEvents = []; 
    window.storeStaffs = ['옥영세', '엄인주', '장용석', '최혜지', '이승범', '형영지']; 
    
    window.leaveRangeStart = null;
    window.leaveRangeEnd = null;
    window.leaveType = '휴무';
    window.selectedCalEventDate = null;
    window.leaveHistoryYear = null;
    window.leaveHistoryMonth = null;
    window.scheduleEditSelectedStaff = null;
    window.scheduleEditChangedCells = {};
    window.scheduleEditSelectedDay = null;

    window.regProfileImageData = '';
    window.editProfileImageData = '';
    window.regPosition = '사원';
    window.editPosition = '사원';

    window.leaveTimeHours = null;

    window.timeRequests = [];
    let unsubscribeTimeRequests = null;
    window.timeRequestSelectedDate = null;
    window.timeRequestEditId = null;
    window.timeRequestEditHours = null;
    window.timeHistoryYear = null;
    window.timeHistoryMonth = null;

    const PUBLIC_HOLIDAYS_2026 = {
        "2026-01-01": "신정", "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴",
        "2026-03-01": "삼일절", "2026-03-02": "대체공휴일", "2026-05-05": "어린이날", "2026-05-24": "부처님오신날",
        "2026-05-25": "대체공휴일", "2026-06-03": "전국동시지방선거", "2026-06-06": "현충일", "2026-08-15": "광복절",
        "2026-08-17": "대체공휴일", "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴",
        "2026-09-28": "대체공휴일", "2026-10-03": "개천절", "2026-10-05": "대체공휴일", "2026-10-09": "한글날",
        "2026-12-25": "기독탄신일"
    };

    getRedirectResult(auth).then((result) => {
        if (result && result.user) {
            const loading = document.getElementById('loading-overlay');
            if(loading) loading.style.display = 'flex';
        }
    }).catch(error => {
        const loading = document.getElementById('loading-overlay');
        if (loading) loading.style.display = 'none';
        if (error.code === 'auth/unauthorized-domain') {
            window.showCustomAlert("구글 로그인 정책: 현재 주소가 승인된 도메인이 아닙니다.");
        } else {
            window.showCustomAlert("로그인 처리에 실패했습니다.\n" + error.message);
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            hideAllPages();
            const loading = document.getElementById('loading-overlay');
            if(loading) loading.style.display = 'flex';
            checkApproval(user);
        } else {
            currentUser = null;
            window.currentUserData = null;
            window.staffList = [];
            if(unsubscribeNotices) unsubscribeNotices();
            if(unsubscribeApproval) unsubscribeApproval();
            if(unsubscribeAlbums) unsubscribeAlbums();
            if(unsubscribeSchedules) unsubscribeSchedules();
            if(unsubscribeLeaveRequests) unsubscribeLeaveRequests();
            if(unsubscribeStaffs) unsubscribeStaffs();
            if(unsubscribeCalEvents) unsubscribeCalEvents();
            if(unsubscribeTimeRequests) unsubscribeTimeRequests();

            hideAllPages();
            const loginPage = document.getElementById('login-page');
            if(loginPage) loginPage.style.display = 'flex';
        }
    });

    function hideAllPages() {
        const pages = [
            'loading-overlay', 'login-page', 'register-page', 'pending-page',
            'app-container', 'page-notice-create', 'page-notice-detail',
            'page-album-modal', 'page-profile-modal', 'page-staff-modal',
            'page-cal-event-modal', 'page-schedule-edit-modal',
            'page-leave-calendar-modal', 'page-leave-history-modal',
            'page-my-schedule-modal', 'page-time-request-modal', 'page-time-history-modal',
            'staff-name-picker-overlay', 'page-schedule-generator', 'page-staff-stats-modal'
        ];
        pages.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function checkApproval(user) {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeApproval = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                window.currentUserData = data;
                if (!data.name || !data.empId) {
                    hideAllPages();
                    document.getElementById('register-page').style.display = 'flex';
                    window.regProfileImageData = '';
                    window.regPosition = '사원';
                    window.renderRegPosition();
                    document.getElementById('reg-profile-img-preview').classList.add('hidden');
                    document.getElementById('reg-profile-img-icon').classList.remove('hidden');
                } else if (data.approved === true) {
                    hideAllPages();
                    document.getElementById('app-container').style.display = 'flex'; 
                    fetchStaffs(); fetchNotices(); fetchAlbums(user); fetchSchedules(); fetchLeaveRequests(); fetchCalEvents(); fetchTimeRequests();
                    lucide.createIcons();
                } else {
                    hideAllPages();
                    document.getElementById('pending-page').style.display = 'flex';
                }
            } else {
                hideAllPages();
                document.getElementById('register-page').style.display = 'flex';
                window.regProfileImageData = '';
                window.regPosition = '사원';
                window.renderRegPosition();
            }
        }, (error) => {
            console.error("Firestore Error:", error);
            hideAllPages();
            window.showCustomAlert("데이터베이스 권한 오류가 발생했습니다.");
        });
    }

    function fetchStaffs() {
        const colRef = collection(db, 'users');
        unsubscribeStaffs = onSnapshot(colRef, (snapshot) => {
            window.staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.approved === true);
            if (document.getElementById('page-staff-modal').style.display === 'flex') {
                window.renderStaffList();
            }
        });
    }

    window.autoHyphenPhone = function(target) {
        let val = target.value.replace(/[^0-9]/g, '');
        let res = '';
        if(val.length < 4) res = val;
        else if(val.length < 7) res = val.substr(0, 3) + '-' + val.substr(3);
        else if(val.length < 11) res = val.substr(0, 3) + '-' + val.substr(3, 3) + '-' + val.substr(6);
        else res = val.substr(0, 3) + '-' + val.substr(3, 4) + '-' + val.substr(7);
        target.value = res;
    };

    window.getPositionTheme = function(pos) {
        if (pos === '점장') return { bg: '#45362E', text: '#FFFFFF', border: '#45362E' };
        if (pos === '부점장') return { bg: '#9A7B66', text: '#FFFFFF', border: '#9A7B66' };
        return { bg: '#FDFCFB', text: '#3A3532', border: '#D8D3CE' }; 
    };

    window.renderRegPosition = function() {
        document.querySelectorAll('.reg-pos-btn').forEach(btn => {
            const pos = btn.dataset.pos;
            const theme = window.getPositionTheme(pos);
            if (window.regPosition === pos) {
                btn.style.backgroundColor = theme.bg; btn.style.color = theme.text; btn.style.borderColor = theme.border;
            } else {
                btn.style.backgroundColor = '#FFFFFF'; btn.style.color = '#8A847E'; btn.style.borderColor = '#E5E5E5';
            }
        });
    };

    window.renderEditPosition = function() {
        document.querySelectorAll('.edit-pos-btn').forEach(btn => {
            const pos = btn.dataset.pos;
            const theme = window.getPositionTheme(pos);
            if (window.editPosition === pos) {
                btn.style.backgroundColor = theme.bg; btn.style.color = theme.text; btn.style.borderColor = theme.border;
            } else {
                btn.style.backgroundColor = '#FFFFFF'; btn.style.color = '#8A847E'; btn.style.borderColor = '#E5E5E5';
            }
        });
    };

    window.previewProfileImage = async function(input, previewId, iconId) {
        if (input.files && input.files[0]) {
            try {
                const base64Url = await compressImage(input.files[0]);
                const preview = document.getElementById(previewId);
                const icon = document.getElementById(iconId);
                preview.src = base64Url;
                preview.classList.remove('hidden');
                if(icon) icon.classList.add('hidden');
                
                if (previewId === 'reg-profile-img-preview') window.regProfileImageData = base64Url;
                if (previewId === 'edit-profile-img-preview') window.editProfileImageData = base64Url;
            } catch (err) { window.showCustomAlert("이미지를 처리할 수 없습니다."); }
        }
    };

    window.cancelRegistration = function() { signOut(auth).then(() => { hideAllPages(); document.getElementById('login-page').style.display = 'flex'; }); };

    window.submitRegistration = async function() {
        const name = document.getElementById('reg-name').value.trim();
        const empId = document.getElementById('reg-emp-id').value.trim();
        const birth = document.getElementById('reg-birth').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const emergency = document.getElementById('reg-emergency').value.trim();
        const relation = document.getElementById('reg-relation').value.trim();

        if (!name || !empId || !phone || !emergency || !relation) {
            window.showCustomAlert("모든 필수 항목(이름, 사번, 전화번호, 비상연락망, 관계)을 입력해 주세요."); return;
        }
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            await setDoc(doc(db, 'users', currentUser.uid), {
                approved: false, email: currentUser.email || '', name: name, empId: empId, position: window.regPosition || '사원',
                birth: birth, phone: phone, emergency: emergency, relation: relation, photoUrl: window.regProfileImageData || '',
                role: 'user', createdAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            window.showCustomAlert("프로필 등록 중 오류가 발생했습니다."); document.getElementById('loading-overlay').style.display = 'none';
        }
    };

    window.loginWithGoogle = async function() {
        document.getElementById('loading-overlay').style.display = 'flex';
        try { await signInWithPopup(auth, provider); } 
        catch (error) {
            if (error.code === 'auth/popup-closed-by-user') { document.getElementById('loading-overlay').style.display = 'none'; return; }
            if (error.code === 'auth/popup-blocked') {
                try { await signInWithRedirect(auth, provider); } 
                catch(redirectErr) { document.getElementById('loading-overlay').style.display = 'none'; window.showCustomAlert("로그인 중 오류가 발생했습니다.\n" + redirectErr.message); }
                return;
            }
            document.getElementById('loading-overlay').style.display = 'none';
            if (error.code === 'auth/unauthorized-domain') { window.showCustomAlert("구글 로그인 정책: 현재 주소가 승인된 도메인이 아닙니다."); } 
            else { window.showCustomAlert("로그인 중 오류가 발생했습니다.\n" + error.message); }
        }
    };

    window.logout = function() { window.showCustomConfirm("로그아웃 하시겠습니까?", () => { signOut(auth); }); };

    window.openStaffList = function() { window.renderStaffList(); document.getElementById('page-staff-modal').style.display = 'flex'; };
    window.closeStaffList = function() { document.getElementById('page-staff-modal').style.display = 'none'; };

    window.openImageViewer = function(url, e) {
        if (e) e.stopPropagation();
        const modal = document.getElementById('image-viewer-modal'); const img = document.getElementById('image-viewer-img');
        if (modal && img && url) { img.src = url; modal.style.display = 'flex'; }
    };
    window.closeImageViewer = function() {
        const modal = document.getElementById('image-viewer-modal'); const img = document.getElementById('image-viewer-img');
        if (modal && img) { modal.style.display = 'none'; img.src = ''; }
    };

    window.renderStaffList = function() {
        const container = document.getElementById('staff-list-content'); const countEl = document.getElementById('staff-count');
        container.innerHTML = '';
        
        const posOrder = { '점장': 1, '부점장': 2, '사원': 3 };
        const sorted = [...window.staffList].sort((a, b) => {
            const orderA = posOrder[a.position] || 99; const orderB = posOrder[b.position] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '');
        });

        if (countEl) countEl.innerText = `총 ${sorted.length}명`;

        sorted.forEach(staff => {
            const isMe = currentUser && staff.id === currentUser.uid;
            const theme = window.getPositionTheme(staff.position || '사원');
            let clickHandler = isMe ? `onclick="window.openProfile()"` : ''; let cursorClass = isMe ? 'cursor-pointer active:scale-[0.98]' : ''; let chevron = isMe ? `<div class="ml-1 shrink-0"><i data-lucide="chevron-right" class="w-4 h-4 text-[#AAA]"></i></div>` : '';
            const profileImgHtml = staff.photoUrl 
                ? `<img src="${staff.photoUrl}" onclick="window.openImageViewer('${staff.photoUrl}', event)" class="w-14 h-14 rounded-full object-cover border border-[#E8E4DB] shrink-0 ml-1 shadow-sm cursor-pointer active:scale-95 transition-transform" />`
                : `<div class="w-14 h-14 rounded-full bg-[#F8F6F0] border border-[#E8E4DB] flex items-center justify-center shrink-0 ml-1 text-[#C2BDB5] shadow-sm"><i data-lucide="user" class="w-6 h-6"></i></div>`;

            container.innerHTML += `
                <div ${clickHandler} class="bg-white rounded-[14px] border border-[#F0EFEA] p-2.5 flex items-center shadow-sm transition-transform ${cursorClass}">
                    <div class="w-[44px] shrink-0 flex justify-center mr-2"><span class="inline-flex items-center justify-center px-1 py-1 rounded-md text-[10px] font-bold w-full shadow-sm tracking-widest border" style="background-color: ${theme.bg}; color: ${theme.text}; border-color: ${theme.border};">${staff.position || '사원'}</span></div>
                    <div class="w-[48px] shrink-0 border-r border-[#F0EFEA] pr-2 flex flex-col justify-center gap-0.5"><div class="text-[13px] font-bold text-[#333] whitespace-nowrap overflow-visible">${staff.name || '-'}</div><div class="text-[10px] text-[#888] font-medium whitespace-nowrap overflow-visible">${staff.empId || '-'}</div></div>
                    <div class="flex-1 text-[10px] text-[#555] space-y-1 min-w-0 flex flex-col justify-center pl-2">
                        <div class="flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3 text-[#888] shrink-0"></i><span class="w-[42px] shrink-0 text-[#888] whitespace-nowrap">생년월일</span><span class="font-medium text-[#333] whitespace-nowrap tracking-tighter">${staff.birth || '-'}</span></div>
                        <div class="flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3 text-[#888] shrink-0"></i><span class="w-[42px] shrink-0 text-[#888] whitespace-nowrap">전화번호</span><span class="font-medium text-[#333] whitespace-nowrap tracking-tighter">${staff.phone || '-'}</span></div>
                        <div class="flex items-center gap-1"><i data-lucide="user" class="w-3 h-3 text-[#888] shrink-0"></i><span class="w-[42px] shrink-0 text-[#888] whitespace-nowrap">비상연락망</span><span class="font-medium text-[#333] whitespace-nowrap tracking-tighter">${staff.emergency || '-'}</span></div>
                        <div class="flex items-center gap-1"><i data-lucide="users" class="w-3 h-3 text-[#888] shrink-0"></i><span class="w-[42px] shrink-0 text-[#888] whitespace-nowrap">관계</span><span class="font-medium text-[#333] whitespace-nowrap tracking-tighter">${staff.relation || '-'}</span></div>
                    </div>
                    ${profileImgHtml} ${chevron}
                </div>
            `;
        });
        lucide.createIcons();
    };

    window.openProfile = function() {
        if (window.currentUserData) {
            document.getElementById('profile-name').value = window.currentUserData.name || ''; document.getElementById('profile-emp-id').value = window.currentUserData.empId || '';
            document.getElementById('profile-birth').value = window.currentUserData.birth || ''; document.getElementById('profile-phone').value = window.currentUserData.phone || '';
            document.getElementById('profile-emergency').value = window.currentUserData.emergency || ''; document.getElementById('profile-relation').value = window.currentUserData.relation || '';
            
            window.editPosition = window.currentUserData.position || '사원'; window.renderEditPosition();

            const preview = document.getElementById('edit-profile-img-preview'); const icon = document.getElementById('edit-profile-img-icon');
            if (window.currentUserData.photoUrl) {
                preview.src = window.currentUserData.photoUrl; preview.classList.remove('hidden'); icon.classList.add('hidden'); window.editProfileImageData = window.currentUserData.photoUrl;
            } else {
                preview.src = ''; preview.classList.add('hidden'); icon.classList.remove('hidden'); window.editProfileImageData = '';
            }
        }
        document.getElementById('page-profile-modal').style.display = 'flex'; lucide.createIcons();
    };

    window.closeProfile = function() { document.getElementById('page-profile-modal').style.display = 'none'; };

    window.submitProfileEdit = async function() {
        const name = document.getElementById('profile-name').value.trim(); const empId = document.getElementById('profile-emp-id').value.trim();
        const birth = document.getElementById('profile-birth').value.trim(); const phone = document.getElementById('profile-phone').value.trim();
        const emergency = document.getElementById('profile-emergency').value.trim(); const relation = document.getElementById('profile-relation').value.trim();

        if (!name || !empId || !phone || !emergency || !relation) { window.showCustomAlert("이름, 사번, 전화번호, 비상연락망, 관계는 필수입니다."); return; }
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                name, empId, position: window.editPosition || '사원', birth, phone, emergency, relation, photoUrl: window.editProfileImageData || '', updatedAt: new Date().toISOString()
            });
            window.showCustomAlert("프로필이 수정되었습니다."); closeProfile();
        } catch (e) { window.showCustomAlert("수정 중 오류가 발생했습니다."); } 
        finally { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    function fetchNotices() {
        const colRef = collection(db, 'notices');
        unsubscribeNotices = onSnapshot(colRef, (snapshot) => {
            window.appNotices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderNotices();
        });
    }

    function normalizeSearchText(v) { return String(v || '').toLowerCase().replace(/\s+/g, ''); }
    function getNoticeRegisterDate(n) { return n.registerDate || n.date || n.createdAt || ''; }
    function getNoticeDeadlineDate(n) { return n.deadlineDate || n.date || ''; }

    window.renderNotices = function() {
        const list = document.getElementById('notice-list-content'); if (!list) return; list.innerHTML = '';
        const rawQuery = String(window.noticeSearchQuery || '').trim();
        const queryTerms = rawQuery ? rawQuery.split(/\s+/).map(t => normalizeSearchText(t)).filter(Boolean) : [];
        let filtered = [...window.appNotices];

        if (queryTerms.length === 0) filtered = filtered.filter(n => n.completed !== true);
        if (queryTerms.length > 0) { filtered = filtered.filter(n => { const target = normalizeSearchText(`${n.title || ''} ${n.content || ''}`); return queryTerms.every(term => target.includes(term)); }); }
        if (window.noticeCategoryFilter !== '전체') filtered = filtered.filter(n => n.category === window.noticeCategoryFilter);

        filtered.sort((a, b) => {
            if (window.noticeSortType === 'registerDesc') return new Date(getNoticeRegisterDate(b) || '1970-01-01') - new Date(getNoticeRegisterDate(a) || '1970-01-01');
            return new Date(getNoticeDeadlineDate(a) || '9999-12-31') - new Date(getNoticeDeadlineDate(b) || '9999-12-31');
        });

        const countText = document.getElementById('notice-result-count');
        if (countText) countText.innerText = `${window.noticeCategoryFilter === '전체' ? '전체' : window.noticeCategoryFilter} ${filtered.length}`;

        if (filtered.length === 0) { list.innerHTML = '<div class="text-center text-[#999] py-8 text-sm">조건에 맞는 공지사항이 없습니다.</div>'; return; }

        filtered.forEach(notice => {
            const catStyle = CATEGORIES[notice.category] || CATEGORIES['매장'];
            const readCount = notice.readers ? notice.readers.length : 0; const isRead = notice.readers && currentUser && notice.readers.includes(currentUser.uid);
            const rDate = getNoticeRegisterDate(notice) || '-'; const dDate = getNoticeDeadlineDate(notice) || '-';
            const completedBadge = notice.completed === true ? `<span class="text-[10px] font-bold text-[#777] bg-[#EFEFEF] px-2 py-0.5 rounded-md shrink-0">완료</span>` : '';
            const cardBgClass = notice.completed === true ? 'bg-[#EEEEEE]' : 'bg-white'; const cardBorderClass = notice.completed === true ? 'border-[#D8D8D8]' : 'border-[#F0EFEA]';
            const titleTextClass = notice.completed === true ? 'text-[#777]' : 'text-[#333]'; const metaTextClass = notice.completed === true ? 'text-[#888]' : 'text-[#999]';
            const countTextClass = notice.completed === true ? 'text-[#777]' : (isRead ? 'text-[#B4975A]' : 'text-[#999]');

            list.innerHTML += `
                <div onclick="window.openNoticeDetail('${notice.id}')" class="${cardBgClass} p-3 rounded-2xl border ${cardBorderClass} shadow-sm cursor-pointer active:scale-[0.98] transition-transform mb-2.5">
                    <div class="flex items-center gap-3">
                        <div class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap" style="background-color: ${notice.completed === true ? '#DDDDDD' : catStyle.bg}; color: ${notice.completed === true ? '#666666' : catStyle.text};">${notice.category || '매장'}</div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 min-w-0"><div class="truncate text-[14px] font-semibold ${titleTextClass}">${notice.title || ''}</div>${completedBadge}</div>
                            <div class="text-[10px] ${metaTextClass} mt-0.5 font-medium truncate">등록 ${rDate} · 마감 ${dDate}</div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0"><span class="text-xs font-semibold ${countTextClass}">${readCount} / ${MAX_READERS}</span><i data-lucide="chevron-right" class="w-4 h-4 text-[#AAA]"></i></div>
                    </div>
                </div>
            `;
        });
        lucide.createIcons();
    };

    document.addEventListener('DOMContentLoaded', () => {
        const s = document.getElementById('notice-search-input');
        if (s) { s.addEventListener('input', (e) => { window.noticeSearchQuery = e.target.value; const c = document.getElementById('notice-search-clear'); if (c) c.style.display = window.noticeSearchQuery ? 'block' : 'none'; window.renderNotices(); }); }
        const aS = document.getElementById('album-search-input');
        if (aS) { aS.addEventListener('input', (e) => { window.albumSearchQuery = e.target.value; const c = document.getElementById('album-search-clear'); if (c) c.style.display = window.albumSearchQuery ? 'block' : 'none'; window.renderAlbums(); }); }
    });

    window.clearNoticeSearch = function() { document.getElementById('notice-search-input').value = ''; document.getElementById('notice-search-clear').style.display = 'none'; window.noticeSearchQuery = ''; window.renderNotices(); };

    function getNoticeFilterTheme(category) {
        if (category === '전체') return { bg: '#9C825A', text: '#FFFFFF', border: '#9C825A' };
        return CATEGORIES[category] ? { ...CATEGORIES[category], border: CATEGORIES[category].bg } : { bg: '#F2EFE8', text: '#8A847E', border: '#E8E4DB' };
    }

    function applyNoticeFilterButtonStyles() {
        document.querySelectorAll('.notice-filter-btn').forEach(btn => {
            const isActive = btn.dataset.category === window.noticeCategoryFilter; const theme = getNoticeFilterTheme(btn.dataset.category);
            btn.className = 'notice-filter-btn h-7 px-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-150';
            if (isActive) { btn.style.backgroundColor = theme.bg; btn.style.color = theme.text; btn.style.border = `1px solid ${theme.border}`; btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)'; } 
            else { btn.style.backgroundColor = 'transparent'; btn.style.color = '#8A847E'; btn.style.border = '1px solid transparent'; btn.style.boxShadow = 'none'; }
        });
    }

    window.setNoticeCategoryFilter = function(category) { window.noticeCategoryFilter = category; applyNoticeFilterButtonStyles(); window.renderNotices(); };
    window.setNoticeSortType = function(value) { window.noticeSortType = value; window.renderNotices(); };

    window.switchTab = function(tabId, btnElement) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById('page-' + tabId).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        btnElement.classList.add('active');
        const mySchedModal = document.getElementById('page-my-schedule-modal');
        if (mySchedModal && mySchedModal.style.display !== 'none') mySchedModal.style.display = 'none';
        if (tabId === 'notice') { applyNoticeFilterButtonStyles(); window.renderNotices(); }
        if (tabId === 'calendar') { window.renderMainCalendar(); }
    };

    window.openNoticeCreate = function() {
        document.getElementById('page-notice-create').style.display = 'flex'; document.getElementById('bottom-nav-bar').style.display = 'none';
        window.selectedCategory = ''; applyCreateCategoryStyles();
        document.getElementById('input-register-date').value = new Date().toISOString().split('T')[0]; document.getElementById('input-deadline-date').value = '';
        document.getElementById('input-title').value = ''; document.getElementById('input-content').value = '';
    };

    window.closeNoticeCreate = function() {
        document.getElementById('page-notice-create').style.display = 'none'; document.getElementById('bottom-nav-bar').style.display = 'grid';
        applyNoticeFilterButtonStyles(); window.renderNotices();
    };

    function applyCreateCategoryStyles() {
        document.querySelectorAll('.cat-btn').forEach(btn => {
            const isActive = window.selectedCategory === btn.dataset.category; const theme = CATEGORIES[btn.dataset.category] || { bg: '#F2EFE8', text: '#8A847E' };
            btn.className = 'cat-btn h-10 w-full rounded-xl text-[12px] font-bold border transition-all duration-150 whitespace-nowrap';
            if (isActive) { btn.style.backgroundColor = theme.bg; btn.style.color = theme.text; btn.style.border = `1.5px solid ${theme.text}`; btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)'; } 
            else { btn.style.backgroundColor = '#FFFFFF'; btn.style.color = '#8A847E'; btn.style.border = '1px solid #E5E5E5'; btn.style.boxShadow = 'none'; }
        });
    }

    window.selectCategory = function(catName) { window.selectedCategory = catName; applyCreateCategoryStyles(); };

    window.submitNotice = async function() {
        const registerDate = document.getElementById('input-register-date').value; const deadlineDate = document.getElementById('input-deadline-date').value;
        const title = document.getElementById('input-title').value.trim(); const content = document.getElementById('input-content').value.trim();
        if (!window.selectedCategory || !title || !registerDate || !deadlineDate) { window.showCustomAlert('카테고리, 제목, 날짜를 모두 입력해주세요.'); return; }
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            await addDoc(collection(db, 'notices'), {
                category: window.selectedCategory, registerDate, deadlineDate, date: registerDate, title, content,
                author: currentUser.uid, authorName: window.currentUserData?.name || '관리자', createdAt: new Date().toISOString(), readers: [], completed: false, completedAt: ''
            });
            closeNoticeCreate();
        } catch(e) { window.showCustomAlert('등록 실패'); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    function setNoticeDetailMode(mode) {
        const viewArea = document.getElementById('notice-detail-view-area'); const editArea = document.getElementById('notice-detail-edit-area');
        if (mode === 'edit') {
            viewArea.style.display = 'none'; editArea.style.display = 'block';
            document.getElementById('notice-detail-modal-title').innerText = '공지사항 수정'; document.getElementById('notice-detail-edit-btn').style.display = 'none';
            document.getElementById('notice-detail-save-btn').style.display = 'block'; document.getElementById('notice-detail-complete-btn').style.display = 'none'; document.getElementById('notice-detail-delete-btn').style.display = 'none';
            applyEditCategoryStyles();
        } else {
            viewArea.style.display = 'block'; editArea.style.display = 'none';
            document.getElementById('notice-detail-modal-title').innerText = '공지사항'; document.getElementById('notice-detail-edit-btn').style.display = 'flex';
            document.getElementById('notice-detail-save-btn').style.display = 'none'; document.getElementById('notice-detail-complete-btn').style.display = 'block'; document.getElementById('notice-detail-delete-btn').style.display = 'block';
        }
        lucide.createIcons();
    }

    function applyEditCategoryStyles() {
        document.querySelectorAll('.detail-cat-btn').forEach(btn => {
            const isActive = window.noticeEditCategory === btn.dataset.category; const theme = CATEGORIES[btn.dataset.category] || { bg: '#F2EFE8', text: '#8A847E' };
            btn.className = 'detail-cat-btn h-11 w-full rounded-xl text-sm font-semibold border transition-all duration-150 whitespace-nowrap';
            if (isActive) { btn.style.backgroundColor = theme.bg; btn.style.color = theme.text; btn.style.border = `1.5px solid ${theme.text}`; btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)'; } 
            else { btn.style.backgroundColor = '#FFFFFF'; btn.style.color = '#8A847E'; btn.style.border = '1px solid #E5E5E5'; btn.style.boxShadow = 'none'; }
        });
    }

    window.selectEditNoticeCategory = function(catName) { window.noticeEditCategory = catName; applyEditCategoryStyles(); };
    window.enterNoticeEditMode = function() { setNoticeDetailMode('edit'); };

    window.openNoticeDetail = async function(id) {
        try {
            const notice = window.appNotices.find(n => n.id === id); 
            if (!notice) return;

            window.selectedNoticeId = id; 
            document.getElementById('page-notice-detail').style.display = 'flex'; 
            document.getElementById('bottom-nav-bar').style.display = 'none';

            const catStyle = CATEGORIES[notice.category] || CATEGORIES['매장']; 
            const rDate = getNoticeRegisterDate(notice) || '-'; 
            const dDate = getNoticeDeadlineDate(notice) || '-';

            document.getElementById('view-notice-category').innerText = notice.category || '매장'; 
            document.getElementById('view-notice-category').style.backgroundColor = catStyle.bg; 
            document.getElementById('view-notice-category').style.color = catStyle.text;
            
            document.getElementById('view-notice-title').innerText = notice.title || ''; 
            document.getElementById('view-notice-content').innerText = notice.content || '';
            document.getElementById('view-notice-register-date').innerText = rDate; 
            document.getElementById('view-notice-deadline-date').innerText = dDate; 
            
            const readersCount = notice.readers ? notice.readers.length : 0;
            document.getElementById('view-notice-count').innerText = `${readersCount} / ${MAX_READERS}`;
            
            const vs = document.getElementById('view-notice-status');
            vs.innerText = notice.completed === true ? '완료된 공지' : '진행 중인 공지'; 
            vs.className = notice.completed === true ? 'text-xs font-bold text-[#777] bg-[#EFEFEF] px-2 py-1 rounded-md' : 'text-xs font-bold text-[#B4975A] bg-[#F8F3E7] px-2 py-1 rounded-md';

            window.noticeEditCategory = notice.category || '매장'; 
            applyEditCategoryStyles();

            document.getElementById('detail-edit-title').value = notice.title || ''; 
            document.getElementById('detail-edit-register-date').value = rDate === '-' ? '' : rDate;
            document.getElementById('detail-edit-deadline-date').value = dDate === '-' ? '' : dDate; 
            document.getElementById('detail-edit-content').value = notice.content || '';
            document.getElementById('detail-edit-count').innerText = `${readersCount} / ${MAX_READERS}`;

            setNoticeDetailMode('view');

            if (currentUser && currentUser.uid) {
                const currentReaders = notice.readers || [];
                if (!currentReaders.includes(currentUser.uid) && currentReaders.length < MAX_READERS) { 
                    currentReaders.push(currentUser.uid); 
                    await updateDoc(doc(db, 'notices', notice.id), { readers: currentReaders }); 
                    document.getElementById('view-notice-count').innerText = `${currentReaders.length} / ${MAX_READERS}`; 
                    document.getElementById('detail-edit-count').innerText = `${currentReaders.length} / ${MAX_READERS}`; 
                }
            }
            lucide.createIcons();
        } catch (error) {
            console.error("공지사항 열기 오류:", error);
            window.showCustomAlert("공지사항을 열 수 없습니다.");
        }
    };

    window.saveNoticeEdit = async function() {
        if (!window.selectedNoticeId) return;
        const category = window.noticeEditCategory; const registerDate = document.getElementById('detail-edit-register-date').value; const deadlineDate = document.getElementById('detail-edit-deadline-date').value;
        const title = document.getElementById('detail-edit-title').value.trim(); const content = document.getElementById('detail-edit-content').value.trim();
        if (!category || !title || !registerDate || !deadlineDate) { window.showCustomAlert('모두 입력해주세요.'); return; }
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            await updateDoc(doc(db, 'notices', window.selectedNoticeId), { category, registerDate, deadlineDate, date: registerDate, title, content, updatedAt: new Date().toISOString(), updatedBy: currentUser.uid });
            window.showCustomAlert('수정되었습니다.'); closeNoticeDetail();
        } catch(e) { window.showCustomAlert('수정 실패'); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    window.completeNotice = function() {
        if (!window.selectedNoticeId) return;
        window.showCustomConfirm('완료 처리하겠습니까?', async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try { await updateDoc(doc(db, 'notices', window.selectedNoticeId), { completed: true, completedAt: new Date().toISOString(), completedBy: currentUser.uid }); closeNoticeDetail(); } 
            catch(e) { window.showCustomAlert('실패'); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

    window.deleteNotice = function() {
        if (!window.selectedNoticeId) return;
        window.showCustomConfirm('삭제 하시겠습니까?', async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try { await deleteDoc(doc(db, 'notices', window.selectedNoticeId)); closeNoticeDetail(); } 
            catch(e) { window.showCustomAlert('삭제 실패'); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

    window.closeNoticeDetail = function() { window.selectedNoticeId = null; document.getElementById('page-notice-detail').style.display = 'none'; document.getElementById('bottom-nav-bar').style.display = 'grid'; applyNoticeFilterButtonStyles(); window.renderNotices(); };

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image(); img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > 1000) { h *= 1000 / w; w = 1000; } } else { if (h > 1000) { w *= 1000 / h; h = 1000; } }
                    canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.onerror = (e) => reject(e);
            }; reader.onerror = (e) => reject(e);
        });
    };

    const base64ToFile = async (dataUrl, filename) => { const res = await fetch(dataUrl); const blob = await res.blob(); return new File([blob], filename, { type: blob.type }); };

    function fetchAlbums(user) {
        if (!db) return;
        unsubscribeAlbums = onSnapshot(collection(db, 'artifacts', 'patek-s', 'users', user.uid, 'albums'), (snapshot) => {
            window.albums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.albums.sort((a, b) => new Date(b.date) - new Date(a.date)); window.renderAlbums();
        });
    }

    window.setAlbumFilter = function(category, btnElement) {
        window.albumFilter = category;
        document.querySelectorAll('.album-filter-btn').forEach(btn => btn.className = "album-filter-btn flex-1 py-1.5 rounded-lg text-[12px] font-sans whitespace-nowrap transition-colors border shadow-sm bg-white text-[#8A847E] border-[#E8E4DB]");
        btnElement.className = "album-filter-btn flex-1 py-1.5 rounded-lg text-[12px] font-sans whitespace-nowrap transition-colors border shadow-sm bg-[#8B7355] text-white border-[#8B7355] font-medium";
        window.renderAlbums();
    };

    window.clearAlbumSearch = function() {
        document.getElementById('album-search-input').value = ''; window.albumSearchQuery = '';
        document.getElementById('album-search-clear').style.display = 'none'; window.renderAlbums();
    };

    window.renderAlbums = function() {
        const list = document.getElementById('album-grid-content'); if (!list) return; list.innerHTML = '';
        const safeQuery = String(window.albumSearchQuery || '').toLowerCase().replace(/[\s-]/g, '');
        let filtered = window.albums.filter(a => window.albumFilter === '전체' || a.category === window.albumFilter);
        if (safeQuery) filtered = filtered.filter(a => String(a.title || '').toLowerCase().replace(/[\s-]/g, '').includes(safeQuery) || String(a.ref || '').toLowerCase().replace(/[\s-]/g, '').includes(safeQuery));
        if (filtered.length === 0) { list.innerHTML = `<div class="col-span-2 flex flex-col items-center justify-center py-20 text-[#A8A29D] font-serif text-sm">등록된 사진이 없습니다.</div>`; return; }

        filtered.forEach(album => {
            const isSelected = window.selectedAlbumIds.includes(album.id);
            const card = document.createElement('div');
            card.className = `relative rounded-xl overflow-hidden bg-white shadow-sm border flex flex-col transition-all cursor-pointer ${isSelected ? 'border-[#8B7355] ring-1 ring-[#8B7355]' : 'border-[#E8E4DB]'}`;
            card.onclick = (e) => {
                if (e.target.closest('.no-card-trigger')) return; 
                if (window.selectedAlbumIds.length > 0) window.toggleAlbumSelection(album.id); else window.openEditAlbum(album);
            };
            card.innerHTML = `
                <div class="relative w-full aspect-[4/3] bg-[#F2EFE8]"><img src="${album.imageUrl}" alt="${album.title}" class="w-full h-full object-cover" />
                    <div class="absolute top-2 left-2 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-md text-[10px] text-[#4A443F] font-bold shadow-sm">${album.category}</div>
                    <button class="no-card-trigger absolute top-2 right-2 w-7 h-7 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm text-[#4A443F] hover:text-[#8B7355] transition-colors" onclick="window.shareSingleAlbum('${album.id}', event)"><i data-lucide="share-2" class="w-3.5 h-3.5"></i></button>
                </div>
                <div class="flex justify-between items-center p-2.5 bg-white">
                    <div class="flex flex-col min-w-0 flex-1 leading-tight"><span class="text-[12px] font-semibold font-sans text-[#3A3532] truncate">${album.title}</span>${album.ref ? `<span class="text-[10px] font-sans text-[#999] truncate mt-0.5">${album.ref}</span>` : ''}</div>
                    <button class="no-card-trigger ml-2 shrink-0" onclick="window.toggleAlbumSelection('${album.id}')">
                        ${isSelected ? `<div class="text-[#8B7355]"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path></svg></div>` : `<div class="text-[#DCD6CC]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></div>`}
                    </button>
                </div>
            `;
            list.appendChild(card);
        });
        lucide.createIcons();
    };

    window.toggleAlbumSelection = function(id) {
        if (window.selectedAlbumIds.includes(id)) window.selectedAlbumIds = window.selectedAlbumIds.filter(v => v !== id); else window.selectedAlbumIds.push(id);
        window.updateMultiSelectActionBar(); window.renderAlbums();
    };
    window.clearAlbumSelection = function() { window.selectedAlbumIds = []; window.updateMultiSelectActionBar(); window.renderAlbums(); };
    window.updateMultiSelectActionBar = function() {
        const bar = document.getElementById('album-multi-action-bar');
        if (window.selectedAlbumIds.length > 0) { document.getElementById('album-selected-count-text').innerText = `${window.selectedAlbumIds.length}장 선택됨`; bar.style.display = 'flex'; } 
        else { bar.style.display = 'none'; }
    };

    window.openCreateAlbum = function() {
        window.albumForm = { id: '', files: [], category: '기타', title: '', ref: '', memo: '', imageUrl: '' };
        document.getElementById('album-modal-title').innerText = 'Upload Photo';
        document.getElementById('album-delete-btn-container').style.display = 'none';
        document.getElementById('album-form-title').value = ''; document.getElementById('album-form-ref').value = ''; document.getElementById('album-form-memo').value = '';
        window.setFormCategory('기타'); window.renderAlbumFormPreviews();
        document.getElementById('page-album-modal').style.display = 'flex';
    };

    window.openEditAlbum = function(album) {
        window.albumForm = { id: album.id, files: [], category: album.category, title: album.title, ref: album.ref || '', memo: album.memo || '', imageUrl: album.imageUrl };
        document.getElementById('album-modal-title').innerText = 'Edit Photo';
        document.getElementById('album-delete-btn-container').style.display = 'block';
        document.getElementById('album-form-title').value = window.albumForm.title; document.getElementById('album-form-ref').value = window.albumForm.ref; document.getElementById('album-form-memo').value = window.albumForm.memo;
        window.setFormCategory(window.albumForm.category); window.renderAlbumFormPreviews();
        document.getElementById('page-album-modal').style.display = 'flex';
    };

    window.closeAlbumModal = function() { document.getElementById('page-album-modal').style.display = 'none'; };

    window.setFormCategory = function(cat) {
        window.albumForm.category = cat;
        document.querySelectorAll('.album-form-cat-btn').forEach(btn => {
            btn.className = (btn.dataset.category === cat) ? "album-form-cat-btn flex-1 py-2.5 rounded-[8px] text-[13px] font-sans whitespace-nowrap transition-colors border shadow-sm bg-[#8B7355] text-white border-[#8B7355] font-medium" : "album-form-cat-btn flex-1 py-2.5 rounded-[8px] text-[13px] font-sans whitespace-nowrap transition-colors border shadow-sm bg-white text-[#8A847E] border-[#E8E4DB]";
        });
    };

    window.triggerAlbumFileSelect = function() { document.getElementById('album-file-input').click(); };
    window.handleAlbumFileChange = async function(e) {
        const files = Array.from(e.target.files); const combined = [...(window.albumForm.files || []), ...files];
        if (combined.length > 10) { window.showCustomAlert("최대 10장까지만 업로드 가능합니다."); window.albumForm.files = combined.slice(0, 10); } 
        else { window.albumForm.files = combined; }
        e.target.value = ''; window.renderAlbumFormPreviews();
    };
    window.removeFormFile = function(index) { window.albumForm.files.splice(index, 1); window.renderAlbumFormPreviews(); };

    window.renderAlbumFormPreviews = function() {
        const list = document.getElementById('album-preview-list'); list.innerHTML = '';
        if (window.albumForm.id && window.albumForm.imageUrl && (!window.albumForm.files || window.albumForm.files.length === 0)) {
            list.innerHTML = `<div class="relative w-full h-[180px] shrink-0 rounded-[14px] overflow-hidden border border-[#E8E4DB]"><img src="${window.albumForm.imageUrl}" class="h-full w-full object-contain bg-[#FDFBF7]" /></div>`;
            return;
        }
        if (window.albumForm.files && window.albumForm.files.length > 0) {
            window.albumForm.files.forEach((file, idx) => {
                const url = URL.createObjectURL(file);
                list.innerHTML += `<div class="relative w-28 h-28 shrink-0 rounded-[14px] overflow-hidden shadow-sm border border-[#E8E4DB]"><img src="${url}" class="w-full h-full object-cover" /><button type="button" onclick="window.removeFormFile(${idx})" class="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 leading-none flex items-center justify-center w-5 h-5"><i data-lucide="x" class="w-3.5 h-3.5"></i></button></div>`;
            });
        }
        if (!window.albumForm.id && (!window.albumForm.files || window.albumForm.files.length < 10)) {
            const isFirst = !window.albumForm.files || window.albumForm.files.length === 0;
            list.innerHTML += `<div onclick="window.triggerAlbumFileSelect()" class="shrink-0 border-[1.5px] border-dashed border-[#C2BDB5] rounded-[14px] flex flex-col items-center justify-center cursor-pointer hover:bg-[#FDFBF7] transition-colors ${isFirst ? 'w-full h-[180px]' : 'w-28 h-28'}"><i data-lucide="camera" class="${isFirst ? 'w-11 h-11' : 'w-7 h-7'} text-[#8B7355] mb-1"></i><p class="text-[#8A847E] font-sans text-[12px]">추가</p></div>`;
        }
        lucide.createIcons();
    };

    window.submitAlbumForm = async function() {
        if (!currentUser) return;
        const titleInput = document.getElementById('album-form-title').value.trim();
        const refInput = document.getElementById('album-form-ref').value.trim();
        const memoInput = document.getElementById('album-form-memo').value.trim();
        if (!titleInput) { window.showCustomAlert("사진명(제목)을 입력해주세요."); return; }

        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            if (window.albumForm.id) {
                let finalUrl = window.albumForm.imageUrl;
                if (window.albumForm.files && window.albumForm.files.length > 0) finalUrl = await compressImage(window.albumForm.files[0]);
                await updateDoc(doc(db, 'artifacts', 'patek-s', 'users', currentUser.uid, 'albums', window.albumForm.id), { title: titleInput, ref: refInput, memo: memoInput, category: window.albumForm.category, imageUrl: finalUrl });
                window.closeAlbumModal(); window.showCustomAlert("수정되었습니다.");
            } else {
                if (!window.albumForm.files || window.albumForm.files.length === 0) { window.showCustomAlert("사진을 추가해 주세요."); document.getElementById('loading-overlay').style.display = 'none'; return; }
                const promises = window.albumForm.files.map(async (file) => {
                    const base64Url = await compressImage(file);
                    await addDoc(collection(db, 'artifacts', 'patek-s', 'users', currentUser.uid, 'albums'), { imageUrl: base64Url, category: window.albumForm.category, title: titleInput, ref: refInput, memo: memoInput, date: new Date().toISOString().split('T')[0] });
                });
                await Promise.all(promises); window.closeAlbumModal(); window.showCustomAlert(`${window.albumForm.files.length}장이 저장되었습니다.`);
            }
        } catch (err) { window.showCustomAlert("오류가 발생했습니다."); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    window.deleteSingleAlbum = function() {
        window.showCustomConfirm("삭제하시겠습니까?", async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try { await deleteDoc(doc(db, 'artifacts', 'patek-s', 'users', currentUser.uid, 'albums', window.albumForm.id)); window.closeAlbumModal(); window.showCustomAlert("삭제되었습니다."); } 
            catch(e) { window.showCustomAlert("삭제 실패"); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

    window.deleteSelectedAlbums = function() {
        window.showCustomConfirm(`${window.selectedAlbumIds.length}장을 삭제하시겠습니까?`, async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try {
                const promises = window.selectedAlbumIds.map(id => deleteDoc(doc(db, 'artifacts', 'patek-s', 'users', currentUser.uid, 'albums', id)));
                await Promise.all(promises); window.selectedAlbumIds = []; window.updateMultiSelectActionBar(); window.showCustomAlert("일괄 삭제되었습니다.");
            } catch(e) { window.showCustomAlert("오류가 발생했습니다."); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

    window.shareSelectedAlbums = async function() {
        if (window.selectedAlbumIds.length === 0) return;
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            const filesArray = [];
            for (const id of window.selectedAlbumIds) {
                const album = window.albums.find(a => a.id === id);
                if (album && album.imageUrl) filesArray.push(await base64ToFile(album.imageUrl, `patek_${id}.jpg`));
            }
            document.getElementById('loading-overlay').style.display = 'none';
            if (navigator.canShare && navigator.canShare({ files: filesArray })) {
                await navigator.share({ files: filesArray }); window.selectedAlbumIds = []; window.updateMultiSelectActionBar(); window.renderAlbums();
            } else throw new Error("공유 미지원");
        } catch (error) {
            document.getElementById('loading-overlay').style.display = 'none'; if (error.name === 'AbortError') return;
            window.selectedAlbumIds.forEach(id => { const album = window.albums.find(a => a.id === id); if (album) { const link = document.createElement('a'); link.href = album.imageUrl; link.download = `patek_${id}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); } });
            window.showCustomAlert("기본 다운로드를 시작했습니다."); window.selectedAlbumIds = []; window.updateMultiSelectActionBar(); window.renderAlbums();
        }
    };

    window.shareSingleAlbum = async function(id, e) {
        e.stopPropagation(); document.getElementById('loading-overlay').style.display = 'flex';
        try {
            const album = window.albums.find(a => a.id === id);
            if (album && album.imageUrl) {
                const file = await base64ToFile(album.imageUrl, `patek_${id}.jpg`);
                document.getElementById('loading-overlay').style.display = 'none';
                if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
                else { const link = document.createElement('a'); link.href = album.imageUrl; link.download = `patek_${id}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
            }
        } catch (error) { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    function fetchSchedules() {
        if (!db) return;
        unsubscribeSchedules = onSnapshot(collection(db, 'artifacts', 'patek-s', 'public', 'data', 'schedules'), (snapshot) => {
            window.schedulesData = {}; snapshot.docs.forEach(doc => { window.schedulesData[doc.id] = doc.data(); }); window.renderScheduleSheet();
        });
    }

    function fetchLeaveRequests() {
        if (!db) return;
        unsubscribeLeaveRequests = onSnapshot(collection(db, 'artifacts', 'patek-s', 'public', 'data', 'leave_requests'), (snapshot) => {
            window.leaveRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
            window.renderScheduleSheet(); window.renderLeaveCalendar();
        });
    }

    function fetchCalEvents() {
        if (!db) return;
        unsubscribeCalEvents = onSnapshot(collection(db, 'artifacts', 'patek-s', 'public', 'data', 'cal_events'), (snapshot) => {
            window.calEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.renderMainCalendar(); window.renderLeaveCalendar(); window.renderScheduleSheet();
        });
    }

    function fetchTimeRequests() {
        if (!db) return;
        unsubscribeTimeRequests = onSnapshot(collection(db, 'artifacts', 'patek-s', 'public', 'data', 'time_requests'), (snapshot) => {
            window.timeRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            window.renderScheduleSheet();
            if (document.getElementById('page-my-schedule-modal')?.style.display === 'flex') window.renderMySchedule();
        });
    }

    window.adjustScheduleMonth = function(amount) {
        window.scheduleMonth += amount;
        if (window.scheduleMonth > 12) { window.scheduleMonth = 1; window.scheduleYear += 1; } 
        else if (window.scheduleMonth < 1) { window.scheduleMonth = 12; window.scheduleYear -= 1; }
        
        const textVal = `${window.scheduleYear}년 ${window.scheduleMonth}월`;
        const monthVal = `${window.scheduleYear}-${String(window.scheduleMonth).padStart(2, '0')}`;

        ['schedule-month-text', 'leave-month-text', 'main-cal-month-text'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = textVal; });
        ['schedule-month-picker', 'leave-month-picker', 'main-cal-month-picker'].forEach(id => { const el = document.getElementById(id); if (el) el.value = monthVal; });
        
        window.renderScheduleSheet(); window.renderLeaveCalendar(); window.renderMainCalendar();
    };
    
    window.handleMonthPicker = function(val) {
        if(!val) return; const [year, month] = val.split('-');
        window.scheduleYear = parseInt(year); window.scheduleMonth = parseInt(month);
        
        const textVal = `${window.scheduleYear}년 ${window.scheduleMonth}월`;
        ['schedule-month-text', 'leave-month-text', 'main-cal-month-text'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = textVal; });
        ['schedule-month-picker', 'leave-month-picker', 'main-cal-month-picker'].forEach(id => { const el = document.getElementById(id); if (el) el.value = val; });
        
        window.renderScheduleSheet(); window.renderLeaveCalendar(); window.renderMainCalendar();
    };

    function getDaysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

    window.openScheduleMonthPicker = function() {
        window.schedulePickerYear = window.scheduleYear; window.schedulePickerMode = 'month';
        renderScheduleMonthModal(); document.getElementById('schedule-month-modal').style.display = 'flex';
    };
    window.closeScheduleMonthPicker = function() { document.getElementById('schedule-month-modal').style.display = 'none'; };
    window.adjustSchedulePickerYear = function(amount) { window.schedulePickerYear = (window.schedulePickerYear || window.scheduleYear) + amount; renderScheduleMonthModal(); };
    window.openScheduleYearPicker = function() { window.schedulePickerMode = 'year'; renderScheduleMonthModal(); };
    window.selectSchedulePickerYear = function(year) { window.schedulePickerYear = year; window.schedulePickerMode = 'month'; renderScheduleMonthModal(); };
    window.selectSchedulePickerMonth = function(month) {
        const year = window.schedulePickerYear || window.scheduleYear;
        window.scheduleYear = year; window.scheduleMonth = month;
        const monthVal = `${year}-${String(month).padStart(2, '0')}`;
        ['schedule-month-picker', 'leave-month-picker', 'main-cal-month-picker'].forEach(id => { const el = document.getElementById(id); if (el) el.value = monthVal; });
        window.closeScheduleMonthPicker(); window.renderScheduleSheet(); window.renderLeaveCalendar(); window.renderMainCalendar();
    };

    function renderScheduleMonthModal() {
        const yearText = document.getElementById('schedule-picker-year-text'); const monthGrid = document.getElementById('schedule-picker-month-grid');
        if (!yearText || !monthGrid) return;
        const year = window.schedulePickerYear || window.scheduleYear; const mode = window.schedulePickerMode || 'month';
        yearText.innerText = `${year}년`; monthGrid.innerHTML = '';
        if (mode === 'year') {
            for (let y = year - 5; y < year + 7; y++) monthGrid.innerHTML += `<button onclick="window.selectSchedulePickerYear(${y})" class="py-3 rounded-xl text-[15px] font-bold border active:scale-95 transition-transform ${y === window.scheduleYear ? 'bg-[#B4975A] text-white border-[#B4975A]' : 'bg-white text-[#4A443F] border-[#E8E4DB]'}">${y}</button>`;
            return;
        }
        for (let m = 1; m <= 12; m++) monthGrid.innerHTML += `<button onclick="window.selectSchedulePickerMonth(${m})" class="py-3 rounded-xl text-[15px] font-bold border active:scale-95 transition-transform ${year === window.scheduleYear && m === window.scheduleMonth ? 'bg-[#B4975A] text-white border-[#B4975A]' : 'bg-white text-[#4A443F] border-[#E8E4DB]'}">${m}월</button>`;
    }

    window.renderMainCalendar = function() {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const container = document.getElementById('main-calendar-grid');
        if (!container) return;
        container.innerHTML = '';

        const filterKey = window.calFilter || '전체';
        const filterTypeMap = { '판매':['판매일정','고객'], '행사':['행사'], '교육':['교육'], '휴무':['정기휴무'], '기타':['기타'] };
        const FF = 'font-family:\'Malgun Gothic\',\'맑은 고딕\',sans-serif;';

        // 이번 달 전체 이벤트
        const monthEvents = (window.calEvents||[]).filter(e => {
            const [ey,em] = e.date.split('-').map(Number);
            return ey===year && em===month;
        });

        // 요약 카드
        const counts = {'판매일정':0,'행사':0,'교육':0,'정기휴무':0,'기타':0};
        monthEvents.forEach(e=>{ const k=calTypeName(e.type); if(counts[k]!==undefined) counts[k]++; });
        const summaryEl = document.getElementById('cal-summary-card');
        if (summaryEl) {
            const summaryItems = [
                {k:'정기휴무',label:'정기휴무',dot:'#C9C9C9'},
                {k:'판매일정',label:'판매일정',dot:'#E4B95D'},
                {k:'행사',label:'행사',dot:'#9DCB75'},
                {k:'교육',label:'교육',dot:'#8DB8E8'},
                {k:'기타',label:'기타',dot:'#C9AEDB'},
            ];
            summaryEl.innerHTML = summaryItems.map(i=>`
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;border-right:1px solid #F0E8D8;${FF}">
                    <div style="width:8px;height:8px;border-radius:50%;background:${i.dot};margin-bottom:3px;"></div>
                    <div style="font-size:22px;font-weight:600;color:#2B1A12;line-height:1.1;">${counts[i.k]}</div>
                    <div style="font-size:11px;color:#5A4A3A;margin-top:2px;">${i.label}</div>
                </div>`).join('');
        }

        // 필터 적용
        const filtered = filterKey==='전체' ? monthEvents
            : monthEvents.filter(e=>(filterTypeMap[filterKey]||[]).includes(e.type));

        // 일요일 시작 (Sunday=0)
        const firstDay = new Date(year, month-1, 1).getDay();
        const totalDays = getDaysInMonth(year, month);
        // 빈 셀 (일요일 시작이므로 firstDay 그대로)
        for (let i=0; i<firstDay; i++) {
            const empty = document.createElement('div');
            empty.style.cssText = 'min-height:82px;border-right:1px solid #E7D8C0;border-bottom:1px solid #E7D8C0;background:#FFFDF8;';
            container.appendChild(empty);
        }

        for (let d=1; d<=totalDays; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dow = new Date(year, month-1, d).getDay();
            const isHoliday = PUBLIC_HOLIDAYS_2026[dateStr] !== undefined;
            const dateColor = (isHoliday||dow===0) ? '#D32F2F' : dow===6 ? '#1976D2' : '#2B1A12';
            const isSelected = window.selectedCalDate === dateStr;

            // 판매일정 우선 정렬
            const dayEvs = filtered.filter(e=>e.date===dateStr)
                .sort((a,b)=>(a.type==='판매일정'||a.type==='고객')?-1:(b.type==='판매일정'||b.type==='고객')?1:0);
            const show = dayEvs.slice(0,2);
            const overflow = dayEvs.length-2;

            const tagsHtml = show.map(ev=>{
                const evS = CAL_EVENT_STYLES[ev.type]||CAL_EVENT_STYLES['기타'];
                const label = calEvLabel(ev);
                return `<div style="height:18px;border-radius:5px;padding:2px 4px;margin-top:3px;font-size:10.5px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid ${evS.border};background:${evS.bg};color:${evS.text};${FF}">${label}</div>`;
            }).join('') + (overflow>0?`<div style="font-size:9px;color:#8A6428;margin-top:2px;${FF}">+${overflow}</div>`:'');

            const cell = document.createElement('div');
            cell.style.cssText = `min-height:82px;padding:6px 4px;border-right:1px solid #E7D8C0;border-bottom:1px solid #E7D8C0;cursor:pointer;position:relative;overflow:hidden;box-sizing:border-box;${isSelected?'border:2px solid #B8860B;border-radius:8px;background:#FFFDF8;z-index:1;':'background:#FFFFFF;'}`;
            cell.onclick = () => window.selectCalDate(dateStr);
            cell.innerHTML = `<div style="font-size:15px;color:${dateColor};font-weight:${isSelected?'700':'400'};line-height:1;${FF}">${d}</div>${tagsHtml}`;
            container.appendChild(cell);
        }

        window.renderCalendarBottom();
    };

    window.openCalEventModal = function(dateStr, existingEvent) {
        window.selectedCalEventDate = dateStr;
        window.editingCalEventId = existingEvent ? existingEvent.id : null;
        document.getElementById('cal-event-date-text').innerText = dateStr;
        const getEl = id => { const el = document.getElementById(id); return el || { value:'' }; };
        if (existingEvent) {
            const t = existingEvent.type === '고객' ? '판매일정' : existingEvent.type;
            window.calEventType = t;
            getEl('cal-event-reason-input').value = existingEvent.reason || '';
            getEl('cal-event-time-input').value = existingEvent.time || '';
            getEl('cal-event-customer-input').value = existingEvent.customerName || '';
            getEl('cal-event-model-input').value = existingEvent.modelName || '';
            getEl('cal-event-assignee-input').value = existingEvent.assignee || '';
            getEl('cal-event-assignee2-input').value = existingEvent.assignee || '';
            document.getElementById('cal-event-delete-btn').style.display = (currentUser && currentUser.uid === existingEvent.uid) ? 'block' : 'none';
        } else {
            window.calEventType = '판매일정';
            ['cal-event-reason-input','cal-event-time-input','cal-event-customer-input',
             'cal-event-model-input','cal-event-assignee-input','cal-event-assignee2-input']
                .forEach(id => { getEl(id).value = ''; });
            document.getElementById('cal-event-delete-btn').style.display = 'none';
        }
        updateCalEventTypeUI();
        document.getElementById('page-cal-event-modal').style.display = 'flex';
    };

    window.closeCalEventModal = function() { document.getElementById('page-cal-event-modal').style.display = 'none'; };
    window.setCalEventType = function(type) { window.calEventType = type; updateCalEventTypeUI(); };

    function updateCalEventTypeUI() {
        const type = window.calEventType;
        document.querySelectorAll('.cal-type-btn').forEach(btn => {
            const btnType = btn.innerText.trim();
            const match = btnType === type || (btnType === '판매일정' && type === '고객');
            if (match) { const s = CAL_EVENT_STYLES[type] || CAL_EVENT_STYLES['기타']; btn.style.backgroundColor = s.bg; btn.style.color = s.text; btn.style.borderColor = s.border || s.bg; }
            else { btn.style.backgroundColor = '#FFFFFF'; btn.style.color = '#666666'; btn.style.borderColor = '#E5E5E5'; }
        });
        const salesFields = document.getElementById('cal-sales-fields');
        const reasonField = document.getElementById('cal-reason-field');
        const isSales = type === '판매일정' || type === '고객';
        if (salesFields) salesFields.style.display = isSales ? 'block' : 'none';
        if (reasonField) reasonField.style.display = isSales ? 'none' : 'block';
    }

    window.saveCalEvent = async function() {
        if (!currentUser) return;
        const isSales = window.calEventType === '판매일정' || window.calEventType === '고객';
        const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
        const reason = gv('cal-event-reason-input');
        const time = gv('cal-event-time-input');
        const customerName = gv('cal-event-customer-input');
        const modelName = gv('cal-event-model-input');
        const assignee = isSales ? gv('cal-event-assignee-input') : gv('cal-event-assignee2-input');
        if (!isSales && !reason) { window.showCustomAlert("달력에 표시될 내용을 입력해주세요."); return; }
        if (isSales && !customerName && !reason) { window.showCustomAlert("고객명 또는 내용을 입력해주세요."); return; }
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            const dateStr = window.selectedCalEventDate;
            const payload = { date: dateStr, type: window.calEventType, reason: reason || '',
                time, customerName, modelName, assignee,
                uid: currentUser.uid, name: window.currentUserData?.name || '관리자', updatedAt: new Date().toISOString() };
            const editId = window.editingCalEventId;
            if (editId) await updateDoc(doc(db, 'artifacts','patek-s','public','data','cal_events', editId), payload);
            else await addDoc(collection(db, 'artifacts','patek-s','public','data','cal_events'), payload);
            window.closeCalEventModal();
            window.showCustomAlert("일정이 저장되었습니다.");
        } catch(e) { window.showCustomAlert("저장 중 오류 발생"); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    window.deleteCalEvent = function() {
        const editId = window.editingCalEventId;
        window.showCustomConfirm("이 일정을 삭제하시겠습니까?", async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try {
                if (editId) await deleteDoc(doc(db,'artifacts','patek-s','public','data','cal_events', editId));
                window.closeCalEventModal();
            } catch(e) { window.showCustomAlert("삭제 실패"); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

    window.renderCalendarBottom = function() {
        const FF = "font-family:'Malgun Gothic','맑은 고딕',sans-serif;";
        const DOW = ['일','월','화','수','목','금','토'];

        // 선택된 날짜 카드
        const selCard = document.getElementById('cal-selected-card');
        if (selCard) {
            const dateStr = window.selectedCalDate;
            if (!dateStr) {
                selCard.innerHTML = `<div style="font-size:13px;font-weight:700;color:#2B1A12;margin-bottom:8px;${FF}">선택한 날짜 일정</div>
                    <div style="font-size:11px;color:#9E9085;${FF}">날짜를 선택하세요</div>`;
            } else {
                const dayEvs = (window.calEvents||[]).filter(e=>e.date===dateStr);
                const [,m,d] = dateStr.split('-');
                const dowStr = DOW[new Date(dateStr).getDay()];
                const dateLabel = `${parseInt(m)}월 ${parseInt(d)}일 (${dowStr})`;
                const addBtn = `<button onclick="window.openCalEventModal('${dateStr}',null)"
                    style="font-size:11px;font-weight:700;color:#A87924;border:1px solid #D8B98B;border-radius:8px;padding:4px 10px;background:#FFFFFF;cursor:pointer;${FF}">+ 추가</button>`;
                const evRows = dayEvs.length===0
                    ? `<div style="font-size:12px;color:#AAA;margin-top:6px;${FF}">일정 없음</div>`
                    : dayEvs.map(ev=>{
                        const evS = CAL_EVENT_STYLES[ev.type]||CAL_EVENT_STYLES['기타'];
                        const isSales = ev.type==='판매일정'||ev.type==='고객';
                        const badge = `<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;white-space:nowrap;background:${evS.bg};color:${evS.text};border:1px solid ${evS.border};${FF}">${calTypeName(ev.type)}</span>`;
                        const timeStr = ev.time || '';
                        const content = isSales ? [ev.customerName,ev.modelName].filter(Boolean).join(' ') : (ev.reason||'');
                        const assignee = ev.assignee ? `담당:${ev.assignee}` : '';
                        return `<div style="display:flex;align-items:center;gap:4px;padding:6px 0;border-bottom:1px solid #EFE3D2;min-height:32px;">
                            <div style="flex-shrink:0;">${badge}</div>
                            <div style="font-size:11px;color:#6E5A47;flex-shrink:0;white-space:nowrap;${FF}">${timeStr}</div>
                            <div style="font-size:11px;color:#2B1A12;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${FF}">${content}</div>
                            <div style="font-size:10px;color:#8A6428;flex-shrink:0;white-space:nowrap;${FF}">${assignee}</div>
                        </div>`;
                    }).join('');
                selCard.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                        <div style="font-size:13px;font-weight:700;color:#2B1A12;${FF}">선택한 날짜 일정</div>
                        ${addBtn}
                    </div>
                    <div style="font-size:15px;font-weight:600;color:#C21B1B;margin-bottom:6px;${FF}">${dateLabel}</div>
                    ${evRows}`;
            }
        }

        // 이번 주 주요 일정 카드
        const weekContent = document.getElementById('cal-week-content');
        if (weekContent) {
            const today = new Date();
            const sun = new Date(today); sun.setDate(today.getDate()-today.getDay());
            const sat = new Date(sun); sat.setDate(sun.getDate()+6);
            const fmt = dt=>`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
            const [sunStr, satStr] = [fmt(sun), fmt(sat)];
            const weekEvs = (window.calEvents||[])
                .filter(e=>e.date>=sunStr&&e.date<=satStr)
                .sort((a,b)=>(a.type==='판매일정'||a.type==='고객')?-1:(b.type==='판매일정'||b.type==='고객')?1:a.date.localeCompare(b.date))
                .slice(0,3);
            weekContent.innerHTML = weekEvs.length===0
                ? `<div style="font-size:12px;color:#AAA;${FF}">이번 주 일정 없음</div>`
                : weekEvs.map(ev=>{
                    const evS = CAL_EVENT_STYLES[ev.type]||CAL_EVENT_STYLES['기타'];
                    const [,em,ed] = ev.date.split('-');
                    const evDow = DOW[new Date(ev.date).getDay()];
                    const isSales = ev.type==='판매일정'||ev.type==='고객';
                    const content = isSales ? [ev.customerName,ev.modelName].filter(Boolean).join(' ') : (ev.reason||ev.type);
                    const timeStr = ev.time || (ev.type==='정기휴무'?'종일':'');
                    return `<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:10px;last-child:margin-bottom:0;">
                        <div style="width:8px;height:8px;border-radius:50%;background:${evS.dot||evS.border};margin-top:4px;flex-shrink:0;"></div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:12px;color:#6E5A47;margin-bottom:1px;${FF}">${parseInt(em)}/${parseInt(ed)} (${evDow}) ${content}</div>
                            <div style="font-size:11px;color:#9E9085;${FF}">${timeStr}</div>
                        </div>
                    </div>`;
                }).join('');
        }
    };

    window.triggerScheduleExcelUpload = function() { document.getElementById('schedule-excel-input').click(); };
    function normalizeScheduleCode(value) {
        const raw = String(value ?? '').trim().toUpperCase();
        if (!raw) return ''; 
        if (raw.startsWith('A')) return 'A'; if (raw.startsWith('B')) return 'B'; if (raw.startsWith('C')) return 'C';
        if (['연', '연차'].includes(raw)) return '연차'; 
        if (['/', '휴', '휴무', '경'].includes(raw)) return '휴무'; return '';
    }
    function parseScheduleYearMonth(workbook, sheetName, rows) {
        let raw = String(sheetName || '') + ' ' + (rows && rows[0] && rows[0][0] ? String(rows[0][0]) : '');
        let match = raw.match(/(20\d{2})\s*[.년\-/]\s*(\d{1,2})/); if (!match) match = raw.match(/(20\d{2}).*?(\d{1,2})\s*월/);
        const now = new Date(); return { year: match ? parseInt(match[1], 10) : window.scheduleYear || now.getFullYear(), month: match ? parseInt(match[2], 10) : window.scheduleMonth || (now.getMonth() + 1) };
    }

    window.handleScheduleExcelUpload = async function(event) {
        const file = event.target.files && event.target.files[0]; if (!file) return;
        const xlsx = window.XLSX; if (!xlsx) { window.showCustomAlert('라이브러리 로드 실패'); event.target.value = ''; return; }
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            const buffer = await file.arrayBuffer(); const workbook = xlsx.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0]; const sheet = workbook.Sheets[sheetName];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
            const { year, month } = parseScheduleYearMonth(workbook, sheetName, rows);
            const totalDays = getDaysInMonth(year, month);
            const headerRowIndex = rows.findIndex(row => row.some(cell => String(cell).trim() === '연차'));
            if (headerRowIndex === -1) throw new Error('엑셀에서 연차/날짜 헤더를 찾지 못했습니다.');
            const headerRow = rows[headerRowIndex]; const nameColIndex = 1; const dayColumns = [];
            headerRow.forEach((cell, colIndex) => { const day = parseInt(String(cell).replace(/[^0-9]/g, ''), 10); if (day >= 1 && day <= totalDays) dayColumns.push({ day, colIndex }); });
            if (dayColumns.length === 0) throw new Error('엑셀에서 날짜 열을 찾지 못했습니다.');

            const updatedStaffs = {}; const staffNames = [];
            for (let r = headerRowIndex + 2; r < rows.length; r++) {
                const staffName = String((rows[r] || [])[nameColIndex] || '').trim(); if (!staffName) continue;
                if (['평일', '주말', 'A', 'B', 'C'].includes(staffName) || /^[ABC]$/.test(staffName)) break;
                staffNames.push(staffName); updatedStaffs[staffName] = {};
                dayColumns.forEach(({ day, colIndex }) => { updatedStaffs[staffName][String(day)] = normalizeScheduleCode(rows[r][colIndex]); });
            }
            if (staffNames.length === 0) throw new Error('직원 이름 찾지 못함');

            const now = new Date(); const formattedDate = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;

            window.scheduleYear = year; window.scheduleMonth = month; window.storeStaffs = staffNames;
            const docRef = doc(db, 'artifacts', 'patek-s', 'public', 'data', 'schedules', currentMonthKey);
            await setDoc(docRef, { staffs: updatedStaffs, staffNames, lastUpdated: formattedDate, updatedBy: window.currentUserData?.name || '알 수 없음', sourceFileName: file.name }, { merge: true });

            window.handleMonthPicker(currentMonthKey); window.showCustomAlert(`${year}년 ${month}월 근무표 업로드 완료`);
        } catch (e) { window.showCustomAlert('엑셀 업로드 실패: ' + e.message); } 
        finally { event.target.value = ''; document.getElementById('loading-overlay').style.display = 'none'; }
    };

    window.deleteCurrentSchedule = function() {
        const currentMonthKey = `${window.scheduleYear}-${String(window.scheduleMonth).padStart(2, '0')}`;
        if (!window.schedulesData[currentMonthKey] || Object.keys(window.schedulesData[currentMonthKey]).length === 0) { window.showCustomAlert("삭제할 근무표가 없습니다."); return; }
        window.showCustomConfirm("근무표를 삭제하시겠습니까?", async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try { await deleteDoc(doc(db, 'artifacts', 'patek-s', 'public', 'data', 'schedules', currentMonthKey)); window.showCustomAlert("완전 삭제되었습니다."); } 
            catch(e) { window.showCustomAlert("삭제 실패"); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

    window.renderScheduleSheet = function() {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const totalDays = getDaysInMonth(year, month); const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthScheduleDoc = window.schedulesData[currentMonthKey];
        const staffData = monthScheduleDoc ? monthScheduleDoc.staffs : {};

        const metaInfo = document.getElementById('schedule-meta-info');
        if (metaInfo) {
            if (monthScheduleDoc && monthScheduleDoc.lastUpdated) metaInfo.innerHTML = `<span class="schedule-meta-line text-[9px] text-[#8A847E]">수정일: ${monthScheduleDoc.lastUpdated.split(' ')[0]}</span>`;
            else metaInfo.innerHTML = '<span class="schedule-meta-line text-[9px] text-[#A8A29D]">근무표 없음</span>';
        }

        const holidayInfo = document.getElementById('schedule-holiday-info');
        if (holidayInfo) {
            let holidayCount = 0;
            for (let d = 1; d <= totalDays; d++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayOfWeek = new Date(year, month - 1, d).getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6 || PUBLIC_HOLIDAYS_2026[dateStr]) holidayCount++;
            }
            holidayInfo.innerText = `(법정공휴일 : ${holidayCount}개)`;
        }

        const grid = document.getElementById('schedule-calendar-grid'); if (!grid) return; grid.innerHTML = '';
        ['일', '월', '화', '수', '목', '금', '토'].forEach((label, index) => {
            const labelColor = index === 0 ? 'text-[#B35C5C]' : (index === 6 ? 'text-[#4F74A8]' : 'text-[#6B5335]');
            grid.innerHTML += `<div class="h-10 flex items-center justify-center text-[13px] font-bold ${labelColor} border-b border-r border-[#E8D8BD] last:border-r-0 bg-[#FFFDF8]">${label}</div>`;
        });

        const firstDayShift = new Date(year, month - 1, 1).getDay();
        const totalCells = Math.ceil((firstDayShift + totalDays) / 7) * 7;

        const codeMeta = {
            'A': { bg: '#FAD7D5', text: '#6E2626', border: '#F0B9B7' },
            'B': { bg: '#D9E7FA', text: '#234B7A', border: '#BFD2EF' },
            'C': { bg: '#FFE7B8', text: '#7A4F14', border: '#F4D08C' }
        };

        const staffOrder = ['영세', '인주', '용석', '혜지', '승범', '영지'];

        const recentChanges = monthScheduleDoc ? (monthScheduleDoc.recentChanges || {}) : {};
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        function hasPersonRecentChange(staffName, day) {
            const sc = recentChanges[staffName] || {};
            const c = sc[day] || sc[String(day)];
            return c && c.at && c.at > sevenDaysAgo;
        }

        function compactName(name) {
            return String(name || '').trim().replace(/^옥/, '').replace(/^엄/, '').replace(/^장/, '').replace(/^최/, '').replace(/^이/, '').replace(/^형/, '');
        }

        function getDayGroups(day) {
            const groups = { A: [], B: [], C: [] };
            if (!staffData || Object.keys(staffData).length === 0) return groups;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const scheduleStaffs = (monthScheduleDoc && monthScheduleDoc.staffNames) ? monthScheduleDoc.staffNames : window.storeStaffs;
            scheduleStaffs.forEach(staffName => {
                const userDays = staffData[staffName] || {};
                let code = userDays[day] || userDays[String(day)] || '';
                let finalCode = ''; let isHalf = false;
                const leavesOnDay = window.leaveRequests.filter(r => r.name === staffName && dateStr >= r.startDate && dateStr <= r.endDate);
                let isRequested = false;
                if (leavesOnDay.length > 0) {
                    const req = leavesOnDay[0];
                    if (req.type === 'A' || req.type === 'A조') finalCode = 'A';
                    if (req.type === 'B' || req.type === 'B조') finalCode = 'B';
                    if (req.type === 'A반' || req.type === 'A반차') { finalCode = 'A'; isHalf = true; }
                    if (req.type === 'B반' || req.type === 'B반차') { finalCode = 'B'; isHalf = true; }
                    isRequested = true;
                } else {
                    let rawCode = String(code).trim().toUpperCase();
                    if (rawCode === 'A') finalCode = 'A';
                    if (rawCode === 'B') finalCode = 'B';
                    if (rawCode === 'C') finalCode = 'C';
                    if (rawCode === 'A반' || rawCode === 'A반차') { finalCode = 'A'; isHalf = true; }
                    if (rawCode === 'B반' || rawCode === 'B반차') { finalCode = 'B'; isHalf = true; }
                }
                if (finalCode === 'A' || finalCode === 'B' || finalCode === 'C') {
                    const changed = !isRequested && hasPersonRecentChange(staffName, day);
                    groups[finalCode].push({ name: compactName(staffName), fullName: staffName, isHalf, changed, isRequested });
                }
            });
            ['A', 'B', 'C'].forEach(c => {
                groups[c].sort((a, b) => {
                    let idxA = staffOrder.indexOf(a.name); let idxB = staffOrder.indexOf(b.name);
                    if(idxA === -1) idxA = 999; if(idxB === -1) idxB = 999;
                    return idxA - idxB;
                });
            });
            return groups;
        }

        for (let cell = 0; cell < totalCells; cell++) {
            const day = cell - firstDayShift + 1;
            if (day < 1 || day > totalDays) { grid.innerHTML += `<div class="min-h-[82px] border-r border-b border-[#E8D8BD] bg-[#FFFDF8]/60"></div>`; continue; }

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSunday = new Date(year, month - 1, day).getDay() === 0; const isSaturday = new Date(year, month - 1, day).getDay() === 6;
            const isHoliday = PUBLIC_HOLIDAYS_2026[dateStr] !== undefined;
            const dateColor = isHoliday || isSunday ? 'text-[#B35C5C]' : (isSaturday ? 'text-[#4F74A8]' : 'text-[#2F2924]');
            const groups = getDayGroups(day);

            const pills = ['A', 'B', 'C'].flatMap(code => {
                if (!groups[code] || groups[code].length === 0) return [];
                const meta = codeMeta[code];
                return groups[code].map(item => {
                    const reqClass = item.isRequested ? ' requested' : '';
                    const chgClass = item.changed ? ' changed' : '';
                    const halfText = item.isHalf ? `<span style="font-size:6px;opacity:.7;">(반)</span>` : '';
                    return `<div class="schedule-pill${reqClass}${chgClass} !py-[2px] !leading-[1.25]" style="background:${meta.bg}; color:${meta.text}; border-color:${meta.border};">${item.name}${halfText}</div>`;
                });
            }).join('');
            const dayTimeTotal = (window.timeRequests || []).filter(r => r.date === dateStr).reduce((s, r) => s + (r.hours || 0), 0);
            const dayTimeBadge = dayTimeTotal > 0 ? `<div class="day-time-badge">${dayTimeTotal}h</div>` : '';

            const events = window.calEvents.filter(e => e.date === dateStr);
            let calEventMarkup = '';
            if (events.length > 0) {
                const evS = CAL_EVENT_STYLES[events[0].type] || { bg: '#C3E19E', text: '#333333' };
                calEventMarkup = `<div class="text-[8px] font-bold px-1 py-[1.5px] rounded-[3px] shadow-sm text-center w-full mb-0.5 leading-tight break-words whitespace-normal" style="background-color:${evS.bg};color:${evS.text};">${events[0].reason || events[0].type}</div>`;
            }

            grid.innerHTML += `
                <div class="min-h-[82px] p-1 border-r border-b border-[#E8D8BD] bg-[#FFFDF8] flex flex-col relative overflow-hidden">
                    <div class="flex items-center justify-between mb-0.5 px-0.5">
                        <span class="text-[12px] font-semibold ${dateColor}">${day}</span>
                        ${isHoliday ? `<span class="text-[7.5px] font-bold text-[#B35C5C] truncate ml-1 leading-none pt-0.5">${PUBLIC_HOLIDAYS_2026[dateStr]}</span>` : ''}
                    </div>
                    ${calEventMarkup}
                    <div class="space-y-0.5 flex-1 flex flex-col justify-start overflow-y-auto no-scrollbar">${pills}</div>
                    ${dayTimeBadge}
                </div>
            `;
        }
        lucide.createIcons();
    };

    window.openScheduleEdit = function() {
        if (!currentUser) return;
        document.getElementById('edit-schedule-title').innerText = `${window.scheduleYear}년 ${window.scheduleMonth}월`;
        window.scheduleEditSelectedStaff = null;
        window.scheduleEditChangedCells = {};
        window.scheduleEditSelectedDay = null;
        window.renderScheduleEditStaffSelector();
        document.getElementById('page-schedule-edit-modal').style.display = 'flex';
        lucide.createIcons();
    };

    window.adjustEditScheduleMonth = function(amount) {
        window.adjustScheduleMonth(amount);
        window.scheduleEditChangedCells = {};
        window.scheduleEditSelectedDay = null;
        document.getElementById('edit-schedule-title').innerText = `${window.scheduleYear}년 ${window.scheduleMonth}월`;
        window.renderScheduleEditStaffSelector();
    };

    window.openStaffNamePicker = function() {
        const currentMonthKey = `${window.scheduleYear}-${String(window.scheduleMonth).padStart(2,'0')}`;
        const staffNames = (window.schedulesData[currentMonthKey] || {}).staffNames || window.storeStaffs;
        const list = document.getElementById('staff-name-picker-list');
        if (!list) return;
        list.innerHTML = staffNames.map(name => {
            const isSel = name === window.scheduleEditSelectedStaff;
            return `<button onclick="window.selectScheduleEditStaff('${name}'); window.closeStaffNamePicker();" class="w-full py-3 rounded-xl text-[14px] font-bold border transition-all active:scale-95 ${isSel ? 'bg-[#B4975A] text-white border-[#B4975A] shadow-md' : 'bg-white text-[#4A443F] border-[#E8E4DB] shadow-sm'}">${name}</button>`;
        }).join('');
        document.getElementById('staff-name-picker-overlay').style.display = 'flex';
    };

    window.closeStaffNamePicker = function() {
        document.getElementById('staff-name-picker-overlay').style.display = 'none';
    };

    window.renderScheduleEditStaffSelector = function() {
        const container = document.getElementById('edit-staff-rows-container');
        let html = `<div id="schedule-edit-grid-area">`;
        if (!window.scheduleEditSelectedStaff) {
            html += `<div class="flex flex-col items-center justify-center py-16 gap-4">
                <p class="text-[#999] text-sm">직원을 선택해주세요</p>
                <button onclick="window.openStaffNamePicker()" class="px-6 py-3 bg-[#B4975A] text-white rounded-xl text-[14px] font-bold shadow-md active:scale-95">직원 선택</button>
            </div>`;
        }
        html += `</div>`;
        container.innerHTML = html;
        if (window.scheduleEditSelectedStaff) window.renderScheduleEditGrid(window.scheduleEditSelectedStaff);
    };

    window.selectScheduleEditStaff = function(name) {
        window.scheduleEditSelectedStaff = name;
        window.scheduleEditSelectedDay = null;
        window.renderScheduleEditStaffSelector();
    };

    window.renderScheduleEditGrid = function(staffName) {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const totalDays = getDaysInMonth(year, month);
        const firstDow = new Date(year, month - 1, 1).getDay();
        const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;
        const staffData = (window.schedulesData[currentMonthKey] || {}).staffs || {};
        const userDays = staffData[staffName] || {};
        const changedDays = window.scheduleEditChangedCells[staffName] || {};
        const dayNames = ['일','월','화','수','목','금','토'];

        let html = `<div class="bg-white border border-[#E8E4DB] rounded-xl shadow-sm overflow-hidden">
            <div class="border-b border-[#F0EFEA] px-3 py-2.5 flex items-center gap-1">
                <button onclick="window.openStaffNamePicker()" class="flex items-center gap-1 text-[#B4975A] active:scale-95 transition-transform">
                    <span class="text-[14px] font-bold">${staffName}</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 shrink-0"></i>
                </button>
                <span class="text-[14px] font-medium text-[#8A847E]">의 근무표</span>
            </div>
            <div class="grid grid-cols-7 border-b border-[#E8E4DB]">`;
        dayNames.forEach((n, i) => {
            const c = i===0 ? 'text-[#E53935]' : (i===6 ? 'text-[#1E88E5]' : 'text-[#666]');
            html += `<div class="py-2 text-center text-[10px] font-bold ${c} bg-[#FFFDF8]">${n}</div>`;
        });
        html += `</div><div class="grid grid-cols-7">`;

        for (let i = 0; i < firstDow; i++) html += `<div class="min-h-[58px] bg-[#FFFDF8]/40 border-r border-b border-[#F0EFEA]"></div>`;

        for (let d = 1; d <= totalDays; d++) {
            const dow = new Date(year, month - 1, d).getDay();
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isHoliday = PUBLIC_HOLIDAYS_2026[dateStr] !== undefined;
            const rawVal = userDays[d] || userDays[String(d)] || '';
            const isChanged = !!changedDays[d];
            const isSelected = window.scheduleEditSelectedDay === d;
            const noRight = dow === 6 ? '' : 'border-r';
            const dc = (isHoliday || dow===0) ? 'text-[#E53935]' : (dow===6 ? 'text-[#1E88E5]' : 'text-[#2F2924]');
            const hlBg = (isChanged || isSelected) ? 'bg-[#EEF6FF]' : 'bg-white';
            const hlBorder = (isChanged || isSelected) ? 'border-[#3F9DF5]' : '';
            const isOff = !rawVal || rawVal === '/' || rawVal === '휴' || rawVal === '휴무';
            const opts = [
                {v:'',l:'휴무'},{v:'A',l:'A'},{v:'B',l:'B'},{v:'C',l:'C'},
                {v:'A반',l:'A반'},{v:'B반',l:'B반'},{v:'연차',l:'연차'}
            ].map(o => `<option value="${o.v}" ${(rawVal===o.v||(isOff&&o.v==='')?'selected':'')}>${o.l}</option>`).join('');

            html += `<div id="edit-day-cell-${d}" class="min-h-[58px] p-1 flex flex-col items-center ${noRight} border-b border-[#F0EFEA] ${hlBg} ${hlBorder}" style="${(isChanged||isSelected)?'border-color:#3F9DF5;':'' }">
                <span class="text-[10px] font-bold ${dc} mb-0.5">${d}</span>
                <select data-staff="${staffName}" data-day="${d}" onfocus="window.onScheduleEditFocus(${d})" onchange="window.onScheduleEditChange(this)" class="schedule-input-select w-full text-[9px] font-bold text-center outline-none bg-transparent border-0 appearance-none cursor-pointer rounded">${opts}</select>
            </div>`;
        }

        const lastDow = new Date(year, month - 1, totalDays).getDay();
        const trail = lastDow === 6 ? 0 : 6 - lastDow;
        for (let i = 0; i < trail; i++) html += `<div class="min-h-[58px] bg-[#FFFDF8]/40 ${i<trail-1?'border-r':''} border-b border-[#F0EFEA]"></div>`;
        html += `</div></div>`;
        document.getElementById('schedule-edit-grid-area').innerHTML = html;
    };

    window.onScheduleEditFocus = function(day) {
        const prevDay = window.scheduleEditSelectedDay;
        window.scheduleEditSelectedDay = day;
        const staffName = window.scheduleEditSelectedStaff;
        const changedDays = window.scheduleEditChangedCells[staffName] || {};
        [prevDay, day].forEach(d => {
            if (!d) return;
            const cell = document.getElementById(`edit-day-cell-${d}`);
            if (!cell) return;
            const active = !!changedDays[d] || d === day;
            cell.style.borderColor = active ? '#3F9DF5' : '#E5E5E5';
            cell.style.boxShadow = active ? '0 0 0 1.5px #3F9DF5' : 'none';
        });
    };

    window.onScheduleEditChange = function(selectEl) {
        const staff = selectEl.dataset.staff;
        const day = parseInt(selectEl.dataset.day);
        if (!window.scheduleEditChangedCells[staff]) window.scheduleEditChangedCells[staff] = {};
        window.scheduleEditChangedCells[staff][day] = true;
        window.scheduleEditSelectedDay = day;
        const cell = document.getElementById(`edit-day-cell-${day}`);
        if (cell) { cell.style.borderColor = '#3F9DF5'; cell.style.boxShadow = '0 0 0 1.5px #3F9DF5'; }
    };

    window.closeScheduleEdit = function() {
        document.getElementById('page-schedule-edit-modal').style.display = 'none';
    };

    window.saveScheduleSheet = async function() {
        if (!currentUser) return;
        const staffName = window.scheduleEditSelectedStaff;
        if (!staffName) { window.showCustomAlert("직원을 선택해주세요."); return; }
        document.getElementById('loading-overlay').style.display = 'flex';

        const year = window.scheduleYear;
        const month = window.scheduleMonth;
        const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;

        const selects = document.querySelectorAll('.schedule-input-select');
        const newDayData = {};
        selects.forEach(sel => { newDayData[sel.dataset.day] = sel.value; });

        const existingDoc = window.schedulesData[currentMonthKey] || {};
        const existingStaffs = existingDoc.staffs || {};
        const oldDays = existingStaffs[staffName] || {};
        const mergedStaffs = { ...existingStaffs, [staffName]: newDayData };

        const now = new Date();
        const formattedDate = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const recentChanges = existingDoc.recentChanges ? JSON.parse(JSON.stringify(existingDoc.recentChanges)) : {};
        recentChanges[staffName] = recentChanges[staffName] || {};
        Object.keys(newDayData).forEach(day => {
            const oldVal = oldDays[day] || oldDays[parseInt(day)] || '';
            const newVal = newDayData[day];
            if (oldVal !== newVal) recentChanges[staffName][day] = { from: oldVal, to: newVal, at: now.toISOString() };
        });

        try {
            const docRef = doc(db, 'artifacts', 'patek-s', 'public', 'data', 'schedules', currentMonthKey);
            await setDoc(docRef, {
                staffs: mergedStaffs,
                lastUpdated: formattedDate,
                updatedBy: window.currentUserData?.name || (currentUser ? (currentUser.displayName || currentUser.email) : '알 수 없음'),
                recentChanges
            }, { merge: true });
            window.closeScheduleEdit();
            window.showCustomAlert(`${staffName}의 ${year}년 ${month}월 근무표가 저장되었습니다.`);
        } catch(e) {
            console.error(e);
            window.showCustomAlert("근무표 저장 오류가 발생했습니다.");
        } finally {
            document.getElementById('loading-overlay').style.display = 'none';
        }
    };


    window.openMySchedule = function() {
        window.renderMySchedule();
        document.getElementById('page-my-schedule-modal').style.display = 'flex';
        lucide.createIcons();
    };

    window.closeMySchedule = function() {
        document.getElementById('page-my-schedule-modal').style.display = 'none';
    };

    function buildMyScheduleCalendarHtml(year, month, dayData) {
        const firstDow = new Date(year, month - 1, 1).getDay();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const codeMeta = {
            'A':   { bg: '#FAD7D5', text: '#6E2626', label: 'A' },
            'B':   { bg: '#D9E7FA', text: '#234B7A', label: 'B' },
            'C':   { bg: '#FFE7B8', text: '#7A4F14', label: 'C' },
            'A반': { bg: '#FAD7D5', text: '#6E2626', label: 'A반' },
            'B반': { bg: '#D9E7FA', text: '#234B7A', label: 'B반' },
            '연차': { bg: '#C8E6C9', text: '#2E7D32', label: '연차' },
        };
        let html = `<div class="bg-white border border-[#E8D8BD] rounded-2xl overflow-hidden shadow-sm mb-4"><div class="grid grid-cols-7 border-b border-[#E8D8BD]">`;
        dayNames.forEach((n, i) => {
            const c = i === 0 ? 'text-[#E53935]' : (i === 6 ? 'text-[#1E88E5]' : 'text-[#666]');
            html += `<div class="py-2 text-center text-[11px] font-bold ${c} bg-[#FFFDF8]">${n}</div>`;
        });
        html += `</div><div class="grid grid-cols-7">`;
        for (let i = 0; i < firstDow; i++) html += `<div class="min-h-[52px] bg-[#FFFDF8]/40 border-r border-b border-[#F0EFEA]"></div>`;
        dayData.forEach(({ d, dayOfWeek, isHoliday, code, isOff, calEv, timeHours }) => {
            const noRightBorder = dayOfWeek === 6 ? '' : 'border-r';
            const dc = (isHoliday || dayOfWeek === 0) ? 'text-[#E53935]' : (dayOfWeek === 6 ? 'text-[#1E88E5]' : 'text-[#333]');
            const meta = codeMeta[code];
            const badge = meta
                ? `<span class="inline-block text-[10.5px] font-bold px-1 py-[1px] rounded-[3px] mt-0.5 leading-tight" style="background:${meta.bg};color:${meta.text};">${meta.label}</span>`
                : `<span class="inline-block text-[10px] font-bold text-[#CCC] mt-0.5">휴무</span>`;
            const timeBadge = timeHours ? `<div class="text-[8px] font-bold rounded px-0.5 py-[1px] w-full text-left leading-tight mt-0.5" style="background:#F8F3E7;color:#B4975A;">${timeHours}h</div>` : '';
            let evBadge = '';
            if (calEv) {
                const evS = CAL_EVENT_STYLES[calEv.type] || { bg: '#C3E19E', text: '#333333' };
                evBadge = `<div class="text-[8px] font-bold rounded px-0.5 leading-tight mt-0.5 truncate w-full text-left" style="background-color:${evS.bg};color:${evS.text};">${calEv.reason || calEv.type}</div>`;
            }
            html += `<div class="min-h-[52px] p-[3px] flex flex-col items-start ${noRightBorder} border-b border-[#F0EFEA] bg-white"><span class="text-[11px] font-bold ${dc} leading-none mt-0.5">${d}</span>${badge}${timeBadge}${evBadge}</div>`;
        });
        const lastDow = dayData.length > 0 ? dayData[dayData.length - 1].dayOfWeek : 0;
        const trail = lastDow === 6 ? 0 : 6 - lastDow;
        for (let i = 0; i < trail; i++) html += `<div class="min-h-[52px] bg-[#FFFDF8]/40 ${i < trail - 1 ? 'border-r' : ''} border-b border-[#F0EFEA]"></div>`;
        html += `</div></div>`;
        return html;
    }

    function buildAnnualStatsHtml(year, userName) {
        const ANNUAL_TOTAL = 20;
        let annualA = 0, annualB = 0, annualC = 0, annualUsed = 0, annualWeekendOff = 0;
        const monthCounts = Array(12).fill(0);
        for (const [key, sdoc] of Object.entries(window.schedulesData || {})) {
            if (!key.startsWith(String(year))) continue;
            const m = parseInt(key.split('-')[1]) - 1;
            const uDays = ((sdoc.staffs || {})[userName] || {});
            const days = getDaysInMonth(year, m + 1);
            for (let d = 1; d <= days; d++) {
                const v = (uDays[d] || uDays[String(d)] || '').toUpperCase();
                const ds = `${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dow = new Date(year, m, d).getDay();
                const isHol = PUBLIC_HOLIDAYS_2026[ds] !== undefined;
                if (v === 'A' || v === 'A반') annualA++;
                else if (v === 'B' || v === 'B반') annualB++;
                else if (v === 'C') annualC++;
                else if (v === '연차') { annualUsed++; monthCounts[m]++; }
                else if (!v && (dow === 0 || dow === 6 || isHol)) annualWeekendOff++;
            }
        }
        (window.leaveRequests || []).forEach(r => {
            if (r.name !== userName || !r.startDate.startsWith(String(year))) return;
            const diff = Math.ceil((new Date(r.endDate||r.startDate) - new Date(r.startDate)) / 86400000) + 1;
            if (r.type === '연차') { annualUsed += diff; monthCounts[new Date(r.startDate).getMonth()] += diff; }
            else if (r.type === 'A' || r.type === 'A반') annualA += diff;
            else if (r.type === 'B' || r.type === 'B반') annualB += diff;
        });
        const annualRemain = Math.max(0, ANNUAL_TOTAL - annualUsed);

        const monthRow1 = Array.from({length:12},(_,i)=>`<td class="text-center text-[10px] font-bold text-[#666] py-1.5 px-0.5 border border-[#F0EFEA] bg-[#FFFDF8]">${i+1}월</td>`).join('');
        const monthRow2 = monthCounts.map((cnt,i)=>{
            const isCur = (i+1===window.scheduleMonth && year===window.scheduleYear);
            return `<td class="text-center text-[11px] font-bold py-1.5 border border-[#F0EFEA] ${isCur?'text-[#B4975A] bg-[#FBF6EC]':'text-[#333] bg-white'}">${cnt||0}</td>`;
        }).join('');

        return `<div class="bg-white rounded-2xl border border-[#F0EFEA] shadow-sm p-4 mb-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-[14px] font-bold text-[#3A3532]">연간 누적 현황</h3>
                <span class="text-[11px] font-bold text-[#B4975A] bg-[#F8F3E7] px-2 py-0.5 rounded">${year}년</span>
            </div>
            <div class="bg-[#FFFDF8] rounded-2xl border border-[#F0E8D0] p-3 mb-3">
                <div class="grid grid-cols-3 divide-x divide-[#F0E8D0]">
                    <div class="flex flex-col items-center px-2">
                        <span class="text-[9px] text-[#888] font-semibold mb-1">총 연차</span>
                        <span class="text-[22px] font-bold text-[#333]">${ANNUAL_TOTAL}</span>
                    </div>
                    <div class="flex flex-col items-center px-2">
                        <span class="text-[9px] text-[#888] font-semibold mb-1">사용연차</span>
                        <span class="text-[22px] font-bold text-[#B4975A]">${annualUsed}</span>
                    </div>
                    <div class="flex flex-col items-center px-2">
                        <span class="text-[9px] text-[#888] font-semibold mb-1">남은 연차</span>
                        <span class="text-[22px] font-bold text-[#2E7D32]">${annualRemain}</span>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-4 gap-1.5 mb-4">
                <div class="rounded-xl p-2.5 text-center border" style="background:#FAD7D5;border-color:#F0B9B7">
                    <div class="text-[9px] font-bold mb-0.5" style="color:#6E2626">A</div>
                    <div class="text-[18px] font-bold" style="color:#6E2626">${annualA}</div>
                </div>
                <div class="rounded-xl p-2.5 text-center border" style="background:#D9E7FA;border-color:#BFD2EF">
                    <div class="text-[9px] font-bold mb-0.5" style="color:#234B7A">B</div>
                    <div class="text-[18px] font-bold" style="color:#234B7A">${annualB}</div>
                </div>
                <div class="rounded-xl p-2.5 text-center border" style="background:#FFE7B8;border-color:#F4D08C">
                    <div class="text-[9px] font-bold mb-0.5" style="color:#7A4F14">C</div>
                    <div class="text-[18px] font-bold" style="color:#7A4F14">${annualC}</div>
                </div>
                <div class="rounded-xl p-2.5 text-center border bg-[#F2F2F2] border-[#E0E0E0]">
                    <div class="text-[9px] font-bold text-[#666] mb-0.5">주말·공휴</div>
                    <div class="text-[18px] font-bold text-[#666]">${annualWeekendOff}</div>
                </div>
            </div>
            <div class="border-t border-[#F0EFEA] pt-3">
                <div class="text-[10px] font-bold text-[#888] mb-2">월별 연차 현황</div>
                <div class="overflow-x-auto no-scrollbar">
                    <table class="w-full" style="min-width:360px;border-collapse:collapse;">
                        <tr>${monthRow1}</tr>
                        <tr>${monthRow2}</tr>
                    </table>
                </div>
            </div>
        </div>`;
    }

    window.renderMySchedule = function() {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const totalDays = getDaysInMonth(year, month);
        const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthScheduleDoc = window.schedulesData[currentMonthKey];
        const staffData = monthScheduleDoc ? (monthScheduleDoc.staffs || {}) : {};
        const userName = window.currentUserData?.name;

        const monthTitleEl = document.getElementById('my-schedule-month-title');
        if (monthTitleEl) monthTitleEl.innerText = `${year}년 ${month}월`;

        const container = document.getElementById('my-schedule-content');
        if (!container) return;

        const ANNUAL_TOTAL = 20;
        const userDays = (userName && staffData[userName]) ? staffData[userName] : {};
        const dayData = [];
        let monthAnnualUsed = 0, countA = 0, countB = 0, countWeekendOff = 0;

        const totalAllowance = window.currentUserData?.timeAllowance || 0;
        const usedTimeHours = (window.timeRequests || []).filter(r => r.name === userName).reduce((s,r) => s + (r.hours||0), 0);
        const remainingTimeHours = Math.max(0, totalAllowance - usedTimeHours);

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            const isHoliday = PUBLIC_HOLIDAYS_2026[dateStr] !== undefined;
            let code = userDays[d] || userDays[String(d)] || '';
            const leave = window.leaveRequests.find(r => r.name === userName && dateStr >= r.startDate && dateStr <= r.endDate);
            if (leave) code = leave.type;
            const isOff = !code || code === '' || code === '/' || code === '휴' || code === '휴무';
            if (code === 'A' || code === 'A반') countA++;
            else if (code === 'B' || code === 'B반') countB++;
            else if (code === '연차') monthAnnualUsed++;
            else if (isOff && (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday)) countWeekendOff++;
            const calEv = window.calEvents.find(e => e.date === dateStr);
            const timeReq = (window.timeRequests || []).find(r => r.name === userName && r.date === dateStr);
            dayData.push({ d, dayOfWeek, isHoliday, code, isOff, calEv, timeHours: timeReq?.hours || null });
        }

        let totalAnnualUsed = 0;
        for (const [key, sdoc] of Object.entries(window.schedulesData || {})) {
            if (!key.startsWith(String(year))) continue;
            const uDays = ((sdoc.staffs||{})[userName]||{});
            const m = parseInt(key.split('-')[1]);
            const days = getDaysInMonth(year, m);
            for (let d = 1; d <= days; d++) { if ((uDays[d]||uDays[String(d)]||'') === '연차') totalAnnualUsed++; }
        }
        (window.leaveRequests||[]).forEach(r => {
            if (r.name !== userName || r.type !== '연차' || !r.startDate.startsWith(String(year))) return;
            totalAnnualUsed += Math.ceil((new Date(r.endDate||r.startDate) - new Date(r.startDate)) / 86400000) + 1;
        });
        const annualRemain = Math.max(0, ANNUAL_TOTAL - totalAnnualUsed);

        const cardBase = 'bg-white rounded-xl shadow-sm border border-[#F0EFEA]';
        const statsHtml = `
            <div class="grid grid-cols-2 gap-2 mb-2">
                <div class="${cardBase} px-2.5 py-2 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-[#F8F3E7] flex items-center justify-center shrink-0"><i data-lucide="calendar-check" class="w-4 h-4 text-[#B4975A]"></i></div>
                    <div><div class="text-[9px] text-[#888] font-semibold leading-none mb-0.5">연차 사용</div><div class="text-[15px] font-bold text-[#333] leading-none">${monthAnnualUsed.toFixed(1)}<span class="text-[10px] font-semibold text-[#888] ml-0.5">일</span></div></div>
                </div>
                <div class="${cardBase} px-2.5 py-2 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-[#F8F3E7] flex items-center justify-center shrink-0"><i data-lucide="leaf" class="w-4 h-4 text-[#B4975A]"></i></div>
                    <div><div class="text-[9px] text-[#888] font-semibold leading-none mb-0.5">남은 연차</div><div class="text-[15px] font-bold text-[#333] leading-none">${annualRemain.toFixed(1)}<span class="text-[10px] font-semibold text-[#888] ml-0.5">일</span></div></div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-2">
                <div class="${cardBase} px-2.5 py-2 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-[#F2F2F2] flex items-center justify-center shrink-0"><i data-lucide="sun" class="w-4 h-4 text-[#888]"></i></div>
                    <div><div class="text-[9px] text-[#888] font-semibold leading-none mb-0.5">주말·공휴일</div><div class="text-[15px] font-bold text-[#333] leading-none">${countWeekendOff}<span class="text-[10px] font-semibold text-[#888] ml-0.5">회</span></div></div>
                </div>
                <div class="${cardBase} px-2.5 py-2 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-[#FFF9E6] flex items-center justify-center shrink-0"><i data-lucide="timer" class="w-4 h-4 text-[#B8860B]"></i></div>
                    <div><div class="text-[9px] text-[#888] font-semibold leading-none mb-0.5">시간찾기 잔여</div><div class="text-[15px] font-bold text-[#333] leading-none">${remainingTimeHours.toFixed(1)}<span class="text-[10px] font-semibold text-[#888] ml-0.5">시간</span></div></div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="${cardBase} px-2.5 py-2 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:#FAD7D5"><i data-lucide="user" class="w-4 h-4" style="color:#6E2626"></i></div>
                    <div><div class="text-[9px] text-[#888] font-semibold leading-none mb-0.5">A조</div><div class="text-[15px] font-bold leading-none" style="color:#6E2626">${countA}<span class="text-[10px] font-semibold text-[#888] ml-0.5">회</span></div></div>
                </div>
                <div class="${cardBase} px-2.5 py-2 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:#D9E7FA"><i data-lucide="user" class="w-4 h-4" style="color:#234B7A"></i></div>
                    <div><div class="text-[9px] text-[#888] font-semibold leading-none mb-0.5">B조</div><div class="text-[15px] font-bold leading-none" style="color:#234B7A">${countB}<span class="text-[10px] font-semibold text-[#888] ml-0.5">회</span></div></div>
                </div>
            </div>`;

        container.innerHTML = statsHtml + buildMyScheduleCalendarHtml(year, month, dayData) + buildAnnualStatsHtml(year, userName);
        lucide.createIcons();
    };

    window.openTimeRequestModal = function(dateStr) {
        window.timeRequestSelectedDate = dateStr || null;
        window.timeRequestEditId = null;
        window.timeRequestEditHours = null;
        document.getElementById('time-request-note-input').value = '';
        window.renderTimeRequestCalendar();
        window.renderTimeHoursButtons(null);
        window.updateTimeRequestRemaining();
        document.getElementById('page-time-request-modal').style.display = 'flex';
        lucide.createIcons();
    };

    window.closeTimeRequestModal = function() {
        document.getElementById('page-time-request-modal').style.display = 'none';
    };

    window.renderTimeRequestCalendar = function() {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const totalDays = getDaysInMonth(year, month);
        const firstDow = new Date(year, month - 1, 1).getDay();
        const container = document.getElementById('time-request-calendar-grid');
        if (!container) return; container.innerHTML = '';

        for (let i = 0; i < firstDow; i++) container.innerHTML += `<div class="min-h-[36px] bg-[#FAF9F5] border border-[#F0EFEA] rounded-md"></div>`;

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dow = new Date(year, month-1, d).getDay();
            const isHol = PUBLIC_HOLIDAYS_2026[dateStr] !== undefined;
            const isSelected = window.timeRequestSelectedDate === dateStr;
            const dc = (isHol||dow===0)?'text-[#E53935]':(dow===6?'text-[#1E88E5]':'text-[#333]');
            const bg = isSelected ? 'bg-[#B4975A] text-white' : 'bg-white hover:bg-[#F8F3E7]';
            const dateColor = isSelected ? 'text-white' : dc;
            container.innerHTML += `<div onclick="window.selectTimeRequestDate('${dateStr}')" class="min-h-[36px] flex flex-col items-center justify-center border border-[#F0EFEA] rounded-md cursor-pointer transition-all active:scale-95 ${bg}">
                <span class="text-[11px] font-bold ${dateColor}">${d}</span>
            </div>`;
        }
    };

    window.selectTimeRequestDate = function(dateStr) {
        window.timeRequestSelectedDate = dateStr;
        window.renderTimeRequestCalendar();
        window.updateTimeRequestRemaining();
    };

    window.renderTimeHoursButtons = function(selected) {
        const hoursOptions = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
        const container = document.getElementById('time-hours-buttons');
        if (!container) return;
        container.innerHTML = hoursOptions.map(h => {
            const isSel = selected === h;
            return `<button onclick="window.selectTimeHours(${h})" class="py-2 rounded-xl text-[12px] font-bold border transition-all active:scale-95 ${isSel ? 'bg-[#B4975A] text-white border-[#B4975A]' : 'bg-white text-[#4A443F] border-[#E8E4DB]'}">${h}</button>`;
        }).join('');
    };

    window.selectTimeHours = function(h) {
        window.timeRequestEditHours = h;
        window.renderTimeHoursButtons(h);
        window.updateTimeRequestRemaining();
    };

    window.updateTimeRequestRemaining = function() {
        const userName = window.currentUserData?.name;
        const totalAllowance = window.currentUserData?.timeAllowance || 0;
        const used = (window.timeRequests || []).filter(r => r.name === userName && r.id !== window.timeRequestEditId)
            .reduce((s, r) => s + (r.hours || 0), 0);
        const remaining = Math.max(0, totalAllowance - used);
        const el = document.getElementById('time-request-remaining');
        if (el) el.innerText = `잔여: ${remaining}시간 (전체: ${totalAllowance}시간)`;
        const el2 = document.getElementById('time-request-remaining-warning');
        if (el2) el2.style.display = (window.timeRequestEditHours && window.timeRequestEditHours > remaining) ? 'block' : 'none';
    };

    window.submitTimeRequest = async function() {
        if (!currentUser) return;
        if (!window.timeRequestSelectedDate) { window.showCustomAlert("날짜를 선택해주세요."); return; }
        if (!window.timeRequestEditHours) { window.showCustomAlert("시간을 선택해주세요."); return; }
        const userName = window.currentUserData?.name;
        const totalAllowance = window.currentUserData?.timeAllowance || 0;
        const used = (window.timeRequests || []).filter(r => r.name === userName && r.id !== window.timeRequestEditId)
            .reduce((s, r) => s + (r.hours || 0), 0);
        const remaining = Math.max(0, totalAllowance - used);
        if (window.timeRequestEditHours > remaining) { window.showCustomAlert(`잔여 시간(${remaining}시간)을 초과할 수 없습니다.`); return; }
        const note = document.getElementById('time-request-note-input').value.trim();
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            if (window.timeRequestEditId) {
                await updateDoc(doc(db, 'artifacts', 'patek-s', 'public', 'data', 'time_requests', window.timeRequestEditId), {
                    date: window.timeRequestSelectedDate, hours: window.timeRequestEditHours, note, updatedAt: new Date().toISOString()
                });
                window.showCustomAlert("수정되었습니다.");
            } else {
                await addDoc(collection(db, 'artifacts', 'patek-s', 'public', 'data', 'time_requests'), {
                    uid: currentUser.uid, name: userName, date: window.timeRequestSelectedDate,
                    hours: window.timeRequestEditHours, note, createdAt: new Date().toISOString()
                });
                window.showCustomAlert("신청이 완료되었습니다.");
            }
            window.closeTimeRequestModal();
        } catch(e) { window.showCustomAlert("오류가 발생했습니다."); }
        finally { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    window.openTimeHistoryModal = function() {
        if (!window.timeHistoryYear) window.timeHistoryYear = window.scheduleYear;
        if (!window.timeHistoryMonth) window.timeHistoryMonth = window.scheduleMonth;
        window.renderTimeHistoryList();
        document.getElementById('page-time-history-modal').style.display = 'flex';
        lucide.createIcons();
    };

    window.closeTimeHistoryModal = function() { document.getElementById('page-time-history-modal').style.display = 'none'; };

    window.adjustTimeHistoryMonth = function(amount) {
        window.timeHistoryMonth = (window.timeHistoryMonth || window.scheduleMonth) + amount;
        if (window.timeHistoryMonth > 12) { window.timeHistoryMonth = 1; window.timeHistoryYear = (window.timeHistoryYear || window.scheduleYear) + 1; }
        else if (window.timeHistoryMonth < 1) { window.timeHistoryMonth = 12; window.timeHistoryYear = (window.timeHistoryYear || window.scheduleYear) - 1; }
        window.renderTimeHistoryList(); lucide.createIcons();
    };

    window.renderTimeHistoryList = function() {
        const yr = window.timeHistoryYear || window.scheduleYear;
        const mo = window.timeHistoryMonth || window.scheduleMonth;
        const monthStr = `${yr}-${String(mo).padStart(2,'0')}`;
        const el = document.getElementById('time-history-month-text');
        if (el) el.innerText = `${yr}년 ${mo}월`;
        const userName = window.currentUserData?.name;
        const list = document.getElementById('time-history-list'); if (!list) return; list.innerHTML = '';
        const filtered = (window.timeRequests || []).filter(r => r.name === userName && r.date && r.date.startsWith(monthStr));
        filtered.sort((a,b) => (a.date||'').localeCompare(b.date||''));
        if (filtered.length === 0) { list.innerHTML = `<div class="text-center py-12 text-[#999] text-sm">이 달에는 신청 내역이 없습니다.</div>`; return; }
        filtered.forEach(req => {
            list.innerHTML += `<div class="bg-[#FCFBF9] p-4 rounded-xl border border-[#F0EFEA] shadow-sm flex justify-between items-center mb-3">
                <div>
                    <div class="text-sm font-bold text-[#333] mb-1">${req.date} <span class="text-[#B4975A] bg-[#F8F3E7] px-2 py-0.5 rounded text-[11px] ml-1 font-bold">${req.hours}시간</span></div>
                    ${req.note ? `<div class="text-xs text-[#999] font-medium italic">${req.note}</div>` : ''}
                </div>
                <div class="flex gap-2">
                    <button onclick="window.editTimeRequest('${req.id}')" class="p-2.5 text-[#B4975A] hover:bg-[#F8F3E7] rounded-lg transition-colors border border-[#E8D8C0] bg-white shadow-sm active:scale-95"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button onclick="window.deleteTimeRequest('${req.id}')" class="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100 bg-white shadow-sm active:scale-95"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>`;
        });
        lucide.createIcons();
    };

    window.editTimeRequest = function(id) {
        const req = (window.timeRequests || []).find(r => r.id === id);
        if (!req) return;
        window.timeRequestEditId = id;
        window.timeRequestSelectedDate = req.date;
        window.timeRequestEditHours = req.hours;
        document.getElementById('time-request-note-input').value = req.note || '';
        window.renderTimeRequestCalendar();
        window.renderTimeHoursButtons(req.hours);
        window.updateTimeRequestRemaining();
        document.getElementById('page-time-history-modal').style.display = 'none';
        document.getElementById('page-time-request-modal').style.display = 'flex';
        lucide.createIcons();
    };

    window.deleteTimeRequest = function(id) {
        window.showCustomConfirm("시간 찾기 신청을 취소하시겠습니까?", async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try { await deleteDoc(doc(db, 'artifacts', 'patek-s', 'public', 'data', 'time_requests', id)); window.renderTimeHistoryList(); window.showCustomAlert("취소되었습니다."); }
            catch(e) { window.showCustomAlert("취소 실패"); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

    window.openScheduleGenerator = function() {
        window.open('schedule.html', '_blank');
    };
    window.closeScheduleGenerator = function() {
        document.getElementById('page-schedule-generator').style.display = 'none';
    };
    window.renderScheduleGenerator = function() {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const totalDays = getDaysInMonth(year, month);
        const currentMonthKey = `${year}-${String(month).padStart(2,'0')}`;
        const monthScheduleDoc = window.schedulesData[currentMonthKey];
        const staffNames = (monthScheduleDoc && monthScheduleDoc.staffNames) ? monthScheduleDoc.staffNames : window.storeStaffs;
        const el = document.getElementById('schedule-generator-title');
        if (el) el.innerText = `${year}년 ${month}월 스케줄 생성기`;

        const matrix = {};
        staffNames.forEach(n => { matrix[n] = {}; });
        (window.leaveRequests || []).forEach(req => {
            if (!matrix[req.name]) return;
            const start = new Date(req.startDate); const end = new Date(req.endDate || req.startDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (d.getFullYear() === year && d.getMonth() + 1 === month) matrix[req.name][d.getDate()] = req.type;
            }
        });

        const codeMeta = {
            '휴무':{ bg:'#FFE146', text:'#555' }, 'A':{ bg:'#FAD7D5', text:'#6E2626' }, 'A반':{ bg:'#FAD7D5', text:'#6E2626' },
            'B':{ bg:'#D9E7FA', text:'#234B7A' }, 'B반':{ bg:'#D9E7FA', text:'#234B7A' },
            'C':{ bg:'#FFE7B8', text:'#7A4F14' }, '연차':{ bg:'#C8E6C9', text:'#2E7D32' }
        };

        const dayHeaders = Array.from({length:totalDays},(_,i)=>{
            const d=i+1; const ds=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dow=new Date(year,month-1,d).getDay(); const isHol=PUBLIC_HOLIDAYS_2026[ds]!==undefined;
            const c=(isHol||dow===0)?'#E53935':(dow===6?'#1E88E5':'#333');
            const dayName=['일','월','화','수','목','금','토'][dow];
            return `<th style="min-width:52px;padding:6px 2px;text-align:center;background:#F8F6F0;border:1px solid #E8D8BD;"><div style="font-size:13px;font-weight:700;color:${c};">${d}</div><div style="font-size:10px;color:${c};opacity:.7;">${dayName}</div></th>`;
        }).join('');

        const rows = staffNames.map(name => {
            const cells = Array.from({length:totalDays},(_,i)=>{
                const d=i+1; const code=matrix[name][d]||'';
                const meta=codeMeta[code];
                if(!code) return `<td style="min-width:52px;padding:4px 2px;border:1px solid #E8D8BD;background:white;"></td>`;
                return `<td style="min-width:52px;padding:4px 2px;border:1px solid #E8D8BD;background:${meta.bg};"><div style="font-size:11px;font-weight:800;text-align:center;color:${meta.text};">${code}</div></td>`;
            }).join('');
            return `<tr><td style="min-width:72px;padding:8px 10px;font-size:13px;font-weight:700;color:#333;white-space:nowrap;border:1px solid #E8D8BD;background:#FFFDF8;position:sticky;left:0;z-index:1;">${name}</td>${cells}</tr>`;
        }).join('');

        document.getElementById('schedule-generator-content').innerHTML = `
            <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
                <table style="border-collapse:collapse;min-width:${72+totalDays*52}px;">
                    <thead><tr>
                        <th style="min-width:72px;padding:8px 10px;text-align:left;font-size:12px;font-weight:700;background:#F8F6F0;border:1px solid #E8D8BD;position:sticky;left:0;z-index:2;color:#555;">직원</th>
                        ${dayHeaders}
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    };
    window.exportScheduleGenerator = function() {
        if (!window.XLSX) { window.showCustomAlert("엑셀 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요."); return; }
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const totalDays = getDaysInMonth(year, month);
        const currentMonthKey = `${year}-${String(month).padStart(2,'0')}`;
        const monthScheduleDoc = window.schedulesData[currentMonthKey];
        const staffNames = (monthScheduleDoc && monthScheduleDoc.staffNames) ? monthScheduleDoc.staffNames : window.storeStaffs;
        const matrix = {};
        staffNames.forEach(n => { matrix[n] = {}; });
        (window.leaveRequests || []).forEach(req => {
            if (!matrix[req.name]) return;
            const start = new Date(req.startDate); const end = new Date(req.endDate || req.startDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (d.getFullYear() === year && d.getMonth() + 1 === month) matrix[req.name][d.getDate()] = req.type;
            }
        });
        const header = ['직원', ...Array.from({length:totalDays},(_,i)=>`${i+1}일`)];
        const rows = staffNames.map(name => [name, ...Array.from({length:totalDays},(_,i)=>matrix[name][i+1]||'')]);
        const ws = window.XLSX.utils.aoa_to_sheet([header, ...rows]);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, `${year}년${month}월`);
        window.XLSX.writeFile(wb, `스케줄_${year}년${month}월.xlsx`);
    };

    window.openStaffStatsModal = function() {
        window.renderStaffStats();
        document.getElementById('page-staff-stats-modal').style.display = 'flex';
        lucide.createIcons();
    };
    window.closeStaffStatsModal = function() {
        document.getElementById('page-staff-stats-modal').style.display = 'none';
    };

    window.renderStaffStats = function() {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const mKey = `${year}-${String(month).padStart(2,'0')}`;
        const mDoc = window.schedulesData[mKey];
        const staffNames = (mDoc?.staffNames) || window.storeStaffs;
        const totalDays = getDaysInMonth(year, month);

        const hEl = document.getElementById('staff-stats-month-title');
        if (hEl) hEl.innerText = `${year}년 ${month}월`;

        function calcStats(sNames, allYears) {
            return sNames.map(name => {
                let cA=0,cB=0,cC=0,cAnn=0,cWkOff=0;
                const docsToCheck = allYears
                    ? Object.entries(window.schedulesData||{}).filter(([k])=>k.startsWith(String(year)))
                    : [[mKey, mDoc||{}]];
                docsToCheck.forEach(([key, doc]) => {
                    const m = parseInt(key.split('-')[1]);
                    const days = getDaysInMonth(year, m);
                    const uD = (doc.staffs||{})[name]||{};
                    for (let d=1; d<=days; d++) {
                        const ds = `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const dow = new Date(year,m-1,d).getDay();
                        const isHol = PUBLIC_HOLIDAYS_2026[ds] !== undefined;
                        let code = uD[d]||uD[String(d)]||'';
                        const lv = window.leaveRequests.find(r=>r.name===name&&ds>=r.startDate&&ds<=r.endDate);
                        if (lv) code = lv.type;
                        const u = String(code).trim().toUpperCase();
                        if(u==='A'||u==='A반') cA++;
                        else if(u==='B'||u==='B반') cB++;
                        else if(u==='C') cC++;
                        else if(u==='연차'||u==='연') cAnn++;
                        else if(dow===0||dow===6||isHol) cWkOff++;
                    }
                });
                const staffObj = window.staffList.find(s=>s.name===name)||{};
                const alloc = staffObj.timeAllowance ?? 0;
                const used = (window.timeRequests||[]).filter(r=>r.name===name).reduce((s,r)=>s+(r.hours||0),0);
                const remain = Math.max(0, alloc - used);
                const annAlloc = staffObj.annualLeave ?? 15;
                const annRemain = annAlloc - cAnn;
                return { name, cA, cB, cC, cAnn, cWkOff, remain, annAlloc, annRemain };
            });
        }

        const monthStats = calcStats(staffNames, false);
        const yearStats  = calcStats(staffNames, true);

        const thCls = 'px-2 py-2 text-[10px] font-bold text-white text-center whitespace-nowrap border-r border-white/20 last:border-r-0';
        const tdCls = 'px-2 py-2 text-[12px] font-semibold text-center border-b border-[#F0EFEA]';

        function buildTable(title, stats, bg, isYearly) {
            const rows = isYearly
                ? stats.map(s => `
                <tr class="hover:bg-[#FDFCF8]">
                    <td class="${tdCls} text-left font-bold text-[#333]">${s.name}</td>
                    <td class="${tdCls} text-[#555]">${s.annAlloc}</td>
                    <td class="${tdCls} text-[#B4975A]">${s.cAnn.toFixed(1)}</td>
                    <td class="${tdCls}" style="color:#2E7D32;">${s.annRemain.toFixed(1)}</td>
                    <td class="${tdCls}" style="color:#6E2626;">${s.cA}</td>
                    <td class="${tdCls}" style="color:#234B7A;">${s.cB}</td>
                    <td class="${tdCls}" style="color:#7A4F14;">${s.cC}</td>
                    <td class="${tdCls} text-[#555]">${s.cWkOff}</td>
                </tr>`).join('')
                : stats.map(s => `
                <tr class="hover:bg-[#FDFCF8]">
                    <td class="${tdCls} text-left font-bold text-[#333]">${s.name}</td>
                    <td class="${tdCls} text-[#B4975A]">${s.cAnn.toFixed(1)}</td>
                    <td class="${tdCls}" style="color:#6E2626;">${s.cA}</td>
                    <td class="${tdCls}" style="color:#234B7A;">${s.cB}</td>
                    <td class="${tdCls}" style="color:#7A4F14;">${s.cC}</td>
                    <td class="${tdCls} text-[#555]">${s.cWkOff}</td>
                    <td class="${tdCls} text-[#7A5200]">${s.remain>0?s.remain.toFixed(1)+'h':'-'}</td>
                </tr>`).join('');
            const headers = isYearly
                ? `<th class="${thCls} text-left">직원</th>
                   <th class="${thCls}">총연차</th>
                   <th class="${thCls}">사용</th>
                   <th class="${thCls}">잔여</th>
                   <th class="${thCls}">A조</th>
                   <th class="${thCls}">B조</th>
                   <th class="${thCls}">C조</th>
                   <th class="${thCls}">주말·공휴일<br>휴무</th>`
                : `<th class="${thCls} text-left">직원</th>
                   <th class="${thCls}">연차 사용</th>
                   <th class="${thCls}">A조</th>
                   <th class="${thCls}">B조</th>
                   <th class="${thCls}">C조</th>
                   <th class="${thCls}">주말·공휴일<br>휴무</th>
                   <th class="${thCls}">시간찾기</th>`;
            return `<div class="mb-5">
                <div class="text-[13px] font-bold text-[#333] mb-2">${title}</div>
                <div class="overflow-x-auto no-scrollbar rounded-xl border border-[#F0EFEA] shadow-sm">
                    <table class="w-full border-collapse" style="min-width:420px;">
                        <thead><tr style="background:${bg};">${headers}</tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
        }

        const container = document.getElementById('staff-stats-content');
        if (container) container.innerHTML =
            buildTable(`${year}년 ${month}월 현황`, monthStats, '#B4975A', false) +
            buildTable(`${year}년 누적 현황`, yearStats, '#7A6B5A', true);
    };

    window.openLeaveCalendarModal = function() {
        window.leaveRangeStart = null; window.leaveRangeEnd = null;
        document.getElementById('leave-reason-input').value = '';
        document.getElementById('leave-region-input').value = '';
        document.getElementById('leave-region-container').style.display = 'none'; 
        window.setLeaveType('휴무'); 
        window.renderLeaveCalendar();
        document.getElementById('page-leave-calendar-modal').style.display = 'flex';
    };

    window.closeLeaveCalendarModal = function() { document.getElementById('page-leave-calendar-modal').style.display = 'none'; };

    window.setLeaveType = function(type) {
        window.leaveType = type;
        window.leaveTimeHours = null;
        const colors = { '휴무':'#FFE146','A':'#FFC8CD','A반':'#FFC8CD','B':'#FFC8CD','B반':'#FFC8CD','시간찾기':'#B4975A' };
        document.querySelectorAll('.leave-type-btn').forEach(btn => {
            const btnType = btn.dataset.type || btn.innerText.trim();
            if (btnType === type) { btn.style.backgroundColor = colors[btnType]||'#B4975A'; btn.style.color = '#333333'; btn.style.borderColor = colors[btnType]||'#B4975A'; }
            else { btn.style.backgroundColor = '#FFFFFF'; btn.style.color = '#666666'; btn.style.borderColor = '#E5E5E5'; }
        });
        const hoursSection = document.getElementById('leave-time-hours-section');
        if (hoursSection) hoursSection.style.display = type === '시간찾기' ? 'block' : 'none';
        if (type === '시간찾기') renderLeaveHoursButtons(null);
    };

    function renderLeaveHoursButtons(selected) {
        const opts = [0.5,1.0,1.5,2.0,2.5,3.0,3.5,4.0];
        const grid = document.getElementById('leave-hours-grid');
        if (!grid) return;
        const userName = window.currentUserData?.name;
        const totalAllowance = window.staffList.find(s=>s.name===userName)?.timeAllowance || window.currentUserData?.timeAllowance || 0;
        const timeUsed = (window.timeRequests||[]).filter(r=>r.name===userName).reduce((s,r)=>s+(r.hours||0),0);
        const remaining = Math.max(0, totalAllowance - timeUsed);
        const remEl = document.getElementById('leave-hours-remain');
        if (remEl) remEl.textContent = `잔여: ${remaining.toFixed(1)}시간`;
        grid.innerHTML = opts.map(h => {
            const isSel = selected===h;
            const disabled = h > remaining ? 'opacity-50 cursor-not-allowed' : 'active:scale-95';
            return `<button onclick="window.selectLeaveHours(${h})" class="py-2 rounded-xl text-[12px] font-bold border transition-all ${disabled} ${isSel?'bg-[#B4975A] text-white border-[#B4975A]':'bg-white text-[#4A443F] border-[#E8E4DB]'}" ${h>remaining?'disabled':''} >${h}</button>`;
        }).join('') + `<button onclick="window.selectLeaveHoursCustom()" class="py-2 rounded-xl text-[12px] font-bold border transition-all active:scale-95 col-span-2 ${selected==='custom'?'bg-[#B4975A] text-white border-[#B4975A]':'bg-white text-[#4A443F] border-[#E8E4DB]'}">직접입력</button>`;
    }

    window.selectLeaveHours = function(h) {
        window.leaveTimeHours = h;
        document.getElementById('leave-hours-custom-wrap').style.display = 'none';
        renderLeaveHoursButtons(h);
    };
    window.selectLeaveHoursCustom = function() {
        window.leaveTimeHours = 'custom';
        document.getElementById('leave-hours-custom-wrap').style.display = 'block';
        renderLeaveHoursButtons('custom');
    };

    window.renderLeaveCalendar = function() {
        const year = window.scheduleYear; const month = window.scheduleMonth;
        const container = document.getElementById('leave-calendar-grid'); if (!container) return; container.innerHTML = '';
        const totalDays = getDaysInMonth(year, month);
        const firstDayShift = new Date(year, month - 1, 1).getDay() === 0 ? 6 : new Date(year, month - 1, 1).getDay() - 1;

        for (let i = 0; i < firstDayShift; i++) container.innerHTML += `<div class="min-h-[70px] bg-[#FAF9F5] border border-[#F0EFEA]"></div>`;

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            const isHoliday = PUBLIC_HOLIDAYS_2026[dateStr] !== undefined;

            const matchedRequests = window.leaveRequests.filter(r => dateStr >= r.startDate && dateStr <= r.endDate);
            const calEventsOnDay = window.calEvents.filter(e => e.date === dateStr);

            let dayTextClass = isHoliday ? "text-[#D81B60]" : (dayOfWeek === 0 ? "text-red-500" : (dayOfWeek === 6 ? "text-blue-500" : "text-[#333]"));
            
            let cellBg = "bg-white";
            let calEvBg2 = '';
            if (calEventsOnDay.length > 0) {
                const leEvS = CAL_EVENT_STYLES[calEventsOnDay[0].type] || { bg: '#C3E19E', text: '#333333' };
                calEvBg2 = leEvS.bg;
                dayTextClass = leEvS.text === '#FFFFFF' ? 'text-white' : 'text-[#333]';
            } else if (window.leaveRangeStart && window.leaveRangeEnd) {
                if (dateStr >= window.leaveRangeStart && dateStr <= window.leaveRangeEnd) cellBg = "bg-[#DDEBFF]";
            } else if (window.leaveRangeStart && dateStr === window.leaveRangeStart) {
                cellBg = "bg-[#DDEBFF]";
            }

            let overbookedBg = matchedRequests.length >= 3 ? "bg-[#FFE5E5]" : ""; 

            let staffNamesMarkup = "";
            
            if (calEventsOnDay.length > 0) {
                staffNamesMarkup += `<div class="text-[8px] font-bold rounded px-0.5 py-[1px] w-full text-center leading-tight mt-[2px] whitespace-nowrap overflow-hidden" style="color:${(CAL_EVENT_STYLES[calEventsOnDay[0].type]||{text:'#333333'}).text};">${calEventsOnDay[0].reason || calEventsOnDay[0].type}</div>`;
            }

            matchedRequests.forEach(req => {
                const regionSuffix = (dateStr === req.startDate && req.region) ? ` (${req.region})` : '';
                let bgColor = '#FFE146'; if (req.type !== '휴무') bgColor = '#FFC8CD';
                let shortName = String(req.name || '').trim(); if (shortName.length >= 3) shortName = shortName.slice(-2);
                let displayText = `${shortName} ${req.type === '휴무' ? '' : req.type}${regionSuffix}`;
                staffNamesMarkup += `<div class="text-[8px] font-bold rounded px-0.5 py-[1px] w-full text-center leading-tight mt-[2px] shadow-sm whitespace-nowrap overflow-hidden text-[#333333]" style="background-color: ${bgColor};">${displayText}</div>`;
            });

            const dayCell = document.createElement('div');
            let finalBg = calEvBg2 ? '' : (cellBg !== "bg-white" ? cellBg : (overbookedBg || "bg-white hover:bg-slate-50"));

            dayCell.className = `min-h-[70px] h-full p-1 border border-[#F0EFEA] flex flex-col items-center justify-start cursor-pointer transition-colors relative ${finalBg}`;
            if (calEvBg2) dayCell.style.backgroundColor = calEvBg2;
            dayCell.onclick = () => window.handleLeaveCalendarCellClick(dateStr);

            dayCell.innerHTML = `
                <div class="w-full flex justify-between shrink-0">
                    <span class="text-xs font-bold ${dayTextClass}">${d}</span>
                    ${isHoliday ? `<span class="text-[8px] text-[#D81B60] truncate font-sans ml-1 mt-0.5">${PUBLIC_HOLIDAYS_2026[dateStr]}</span>` : ''}
                </div>
                <div class="w-full flex-1 flex flex-col justify-end mt-1 gap-[1px]">
                    ${staffNamesMarkup}
                </div>
            `;
            container.appendChild(dayCell);
        }
    };

    window.handleLeaveCalendarCellClick = function(dateStr) {
        if (!window.leaveRangeStart || (window.leaveRangeStart && window.leaveRangeEnd)) {
            window.leaveRangeStart = dateStr; window.leaveRangeEnd = null;
            document.getElementById('leave-region-container').style.display = 'none'; 
        } else {
            if (dateStr < window.leaveRangeStart) { window.leaveRangeStart = dateStr; window.leaveRangeEnd = null; document.getElementById('leave-region-container').style.display = 'none'; } 
            else {
                window.leaveRangeEnd = dateStr;
                const diffDays = Math.ceil((new Date(window.leaveRangeEnd) - new Date(window.leaveRangeStart)) / (1000 * 60 * 60 * 24)) + 1;
                document.getElementById('leave-region-container').style.display = diffDays >= 3 ? 'block' : 'none';
            }
        }
        window.renderLeaveCalendar();
    };

    window.submitLeaveRequest = async function() {
        if (!currentUser) return;
        if (!window.leaveRangeStart) { window.showCustomAlert("날짜를 선택해주세요."); return; }

        // ── 시간찾기 분기 ──
        if (window.leaveType === '시간찾기') {
            let hours = window.leaveTimeHours;
            if (hours === 'custom') {
                const customVal = parseFloat(document.getElementById('leave-hours-custom-input')?.value || '0');
                if (!customVal || customVal <= 0) { window.showCustomAlert("시간을 입력해주세요."); return; }
                hours = customVal;
            }
            if (!hours) { window.showCustomAlert("시간을 선택해주세요."); return; }
            const userName = window.currentUserData?.name || '미인증';
            const totalAllowance = window.staffList.find(s=>s.name===userName)?.timeAllowance || window.currentUserData?.timeAllowance || 0;
            const timeUsed = (window.timeRequests||[]).filter(r=>r.name===userName).reduce((s,r)=>s+(r.hours||0),0);
            const remaining = Math.max(0, totalAllowance - timeUsed);
            if (hours > remaining) { window.showCustomAlert(`잔여 시간(${remaining}시간)을 초과할 수 없습니다.`); return; }
            const note = document.getElementById('leave-reason-input').value.trim();
            document.getElementById('loading-overlay').style.display = 'flex';
            try {
                await addDoc(collection(db, 'artifacts', 'patek-s', 'public', 'data', 'time_requests'), {
                    uid: currentUser.uid, name: userName, date: window.leaveRangeStart, hours, note, createdAt: new Date().toISOString()
                });
                window.showCustomAlert("시간찾기 신청이 완료됐습니다.");
                window.leaveRangeStart = null; window.leaveRangeEnd = null;
                window.leaveTimeHours = null;
                document.getElementById('leave-reason-input').value = '';
                document.getElementById('leave-time-hours-section').style.display = 'none';
                window.setLeaveType('휴무');
                window.renderLeaveCalendar();
            } catch(e) { window.showCustomAlert("오류 발생"); }
            finally { document.getElementById('loading-overlay').style.display = 'none'; }
            return;
        }

        // ── 일반 스케줄 신청 ──
        const reason = document.getElementById('leave-reason-input').value.trim();
        const startDate = window.leaveRangeStart; const endDate = window.leaveRangeEnd || window.leaveRangeStart;
        const diffDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const region = document.getElementById('leave-region-input').value.trim();
        if (diffDays >= 3 && !region) { window.showCustomAlert("지역을 입력하세요"); return; }
        document.getElementById('loading-overlay').style.display = 'flex';
        try {
            await addDoc(collection(db, 'artifacts', 'patek-s', 'public', 'data', 'leave_requests'), {
                name: window.currentUserData?.name || '미인증', uid: currentUser.uid, startDate, endDate, type: window.leaveType, reason, region: region || '', createdAt: new Date().toISOString()
            });
            window.showCustomAlert("신청이 완료됐습니다.");
            window.leaveRangeStart = null; window.leaveRangeEnd = null;
            document.getElementById('leave-reason-input').value = ''; document.getElementById('leave-region-input').value = '';
            document.getElementById('leave-region-container').style.display = 'none';
            window.renderLeaveCalendar();
        } catch(e) { window.showCustomAlert("오류 발생"); }
        finally { document.getElementById('loading-overlay').style.display = 'none'; }
    };

    window.openLeaveHistoryModal = function() {
        if (!window.leaveHistoryYear) window.leaveHistoryYear = window.scheduleYear;
        if (!window.leaveHistoryMonth) window.leaveHistoryMonth = window.scheduleMonth;
        window.renderLeaveHistoryList();
        document.getElementById('page-leave-history-modal').style.display = 'flex'; lucide.createIcons();
    };

    window.adjustLeaveHistoryMonth = function(amount) {
        window.leaveHistoryMonth = (window.leaveHistoryMonth || window.scheduleMonth) + amount;
        if (window.leaveHistoryMonth > 12) { window.leaveHistoryMonth = 1; window.leaveHistoryYear = (window.leaveHistoryYear || window.scheduleYear) + 1; }
        else if (window.leaveHistoryMonth < 1) { window.leaveHistoryMonth = 12; window.leaveHistoryYear = (window.leaveHistoryYear || window.scheduleYear) - 1; }
        window.renderLeaveHistoryList(); lucide.createIcons();
    };

    window.renderLeaveHistoryList = function() {
        const yr = window.leaveHistoryYear || window.scheduleYear;
        const mo = window.leaveHistoryMonth || window.scheduleMonth;
        const monthStr = `${yr}-${String(mo).padStart(2, '0')}`;
        const monthTextEl = document.getElementById('leave-history-month-text');
        if (monthTextEl) monthTextEl.innerText = `${yr}년 ${mo}월`;
        const listContainer = document.getElementById('leave-history-list'); listContainer.innerHTML = '';
        const filtered = window.leaveRequests.filter(req => req.startDate && req.startDate.startsWith(monthStr));
        filtered.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-12 text-[#999] text-sm">이 달에는 신청 내역이 없습니다.</div>`;
        } else {
            const cMap = { '휴무': 'bg-[#FFE146] text-[#333]', 'A': 'bg-[#FFC8CD] text-[#333]', 'A반': 'bg-[#FFC8CD] text-[#333]', 'B': 'bg-[#FFC8CD] text-[#333]', 'B반': 'bg-[#FFC8CD] text-[#333]' };
            filtered.forEach(req => {
                const diffDays = Math.ceil((new Date(req.endDate) - new Date(req.startDate)) / (1000 * 60 * 60 * 24)) + 1;
                const canDelete = currentUser && currentUser.uid === req.uid;
                const badgeClass = cMap[req.type || '휴무'] || 'bg-gray-200 text-gray-800';
                listContainer.innerHTML += `
                    <div class="bg-[#FCFBF9] p-4 rounded-xl border border-[#F0EFEA] shadow-sm flex justify-between items-center mb-3">
                        <div class="min-w-0 flex-1 pr-2">
                            <div class="flex items-center gap-2 mb-1.5 flex-wrap"><span class="text-sm font-bold text-[#333]">${req.name}</span><span class="text-[10px] px-2 py-0.5 rounded font-bold ${badgeClass}">${req.type || '휴무'}</span><span class="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded font-bold">${diffDays}일간</span>${req.region ? `<span class="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">${req.region}</span>` : ''}</div>
                            <div class="text-xs text-[#666] font-medium leading-relaxed">${req.startDate} ~ ${req.endDate}</div>
                            ${req.reason ? `<div class="text-xs text-[#999] mt-1 font-medium italic">사유: ${req.reason}</div>` : ''}
                        </div>
                        ${canDelete ? `<button onclick="window.deleteLeaveRequest('${req.id}')" class="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100 flex-shrink-0 bg-white shadow-sm active:scale-95"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                    </div>`;
            });
        }
        lucide.createIcons();
    };

    window.closeLeaveHistoryModal = function() { document.getElementById('page-leave-history-modal').style.display = 'none'; };

    window.deleteLeaveRequest = function(id) {
        window.showCustomConfirm("신청을 취소하시겠습니까?", async () => {
            document.getElementById('loading-overlay').style.display = 'flex';
            try { await deleteDoc(doc(db, 'artifacts', 'patek-s', 'public', 'data', 'leave_requests', id)); window.renderLeaveHistoryList(); window.showCustomAlert("취소되었습니다."); }
            catch(e) { window.showCustomAlert("취소 실패"); } finally { document.getElementById('loading-overlay').style.display = 'none'; }
        });
    };

