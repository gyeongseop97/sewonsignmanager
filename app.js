const DEFAULT_CONSENT = '본인은 본 교육자료 및 교육내용을 확인하였으며, 본 전자서명이 교육 이수 확인을 위한 본인의 서명으로 사용되는 것에 동의합니다.';
const LS_KEY = 'education_signature_manager_v1';
const ADMIN_ID = 'admin';
const ADMIN_PASSWORD = '1234';
const LEGAL_EDU_TYPES = [
  '산업안전보건교육',
  '직장 내 괴롭힘 예방교육',
  '성희롱 예방교육',
  '개인정보보호교육',
  '장애인 인식개선교육',
  '퇴직연금교육',
  '소방안전교육',
  '응급처치교육',
  '기타/수시교육 직접입력'
];

let state = loadState();
let currentEmployee = null;
let selectedSignEducationId = null;
let signaturePad = null;
let targetDraftKey = null;
let targetDraftSelection = new Set();
let editingEducationId = null;
let editingSessionId = null;

function uid(prefix='id'){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function nowIso(){ return new Date().toISOString(); }
function formatDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return iso;
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function todayDate(){
  const d = new Date(); const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function loadState(){
  const saved = localStorage.getItem(LS_KEY);
  if(saved){
    try { return JSON.parse(saved); } catch(e) { console.warn(e); }
  }
  return { employees: [], educations: [], sessions: [], targets: [], signatures: [] };
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function normalizePhone(v){ return String(v ?? '').replace(/[^0-9]/g,''); }
function normalizeText(v){ return String(v ?? '').trim(); }
function normalizeWorkType(v){
  const raw = normalizeText(v);
  if(raw === '주간') return '1반';
  if(raw === '야간') return '2반';
  if(raw === '상시' || raw === '기타') return '주간 정취';
  if(['1반','2반','주간 정취'].includes(raw)) return raw;
  return raw || '주간 정취';
}
function migrateWorkTypeLabels(){
  let changed = false;
  state.employees.forEach(e=>{ const next = normalizeWorkType(e.shift_type); if(e.shift_type !== next){ e.shift_type = next; changed = true; } });
  state.sessions.forEach(s=>{
    const raw = normalizeText(s.target_shift);
    const next = raw === '전체' || raw === '보충' || raw === '선택대상' ? raw : normalizeWorkType(raw);
    if(s.target_shift !== next){ s.target_shift = next; changed = true; }
  });
  state.educations.forEach(e=>{
    if(!e.period_detail){
      if(e.period === '월간') e.period_detail = '1월';
      else if(e.period === '분기') e.period_detail = '1분기';
      else if(e.period === '반기') e.period_detail = '상반기';
      else if(e.period === '수시') e.period_detail = '수시';
      else e.period_detail = '연간';
      changed = true;
    }
  });
  if(changed) saveState();
}
function migrateTargetsToSessionLevel(){
  let changed = false;
  state.targets.forEach(t=>{
    if(t.session_id) return;
    const sessions = state.sessions.filter(s=>s.education_id===t.education_id);
    const emp = getEmp(t.employee_id);
    let targetSession = sessions.find(s=>emp && normalizeWorkType(s.target_shift)===emp.shift_type) || sessions[0];
    if(targetSession){ t.session_id = targetSession.id; changed = true; }
  });
  if(changed) saveState();
}
function maskPhone(v){
  const p = normalizePhone(v);
  if(p.length < 8) return p;
  return `${p.slice(0,3)}-****-${p.slice(-4)}`;
}
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function alertMsg(msg){ alert(msg); }
function getEdu(id){ return state.educations.find(x=>x.id===id); }
function getEmp(id){ return state.employees.find(x=>x.id===id); }
function getSession(id){ return state.sessions.find(x=>x.id===id); }
function currentEduType(){
  const sel = document.getElementById('eduTypeSelect');
  const custom = document.getElementById('eduTypeCustom');
  if(!sel) return '';
  if(sel.value === '기타/수시교육 직접입력') return normalizeText(custom?.value || '');
  return sel.value || '';
}

function formTargetKey(){
  if(editingSessionId) return `session:${editingSessionId}`;
  const existingSession = currentFormSession();
  if(existingSession) return `session:${existingSession.id}`;
  return `newsession:${buildEducationTitle()}:${getSessionNoValue() || '1차'}`;
}
function setEducationEditMode(educationId=null, sessionId=null){
  editingEducationId = educationId;
  editingSessionId = sessionId;
  updateEducationEditBanner();
}
function updateEducationEditBanner(){
  const banner = document.getElementById('educationEditBanner');
  const saveBtn = document.getElementById('saveIntegratedEducationBtn');
  if(!banner || !saveBtn) return;
  if(editingEducationId){
    const edu = getEdu(editingEducationId);
    const ses = editingSessionId ? getSession(editingSessionId) : null;
    banner.classList.remove('hidden');
    banner.innerHTML = `<b>수정 모드</b> · ${escapeHtml(edu?.title || '')}${ses ? ` · ${escapeHtml(ses.session_no || '')} 회차 수정 중` : ' · 교육 내용/대상자 수정 중'}<br><span>저장하면 교육 정보, 해당 회차 정보, 해당 회차의 대상자 명단이 수정됩니다. 신규 등록은 아래 ‘신규 교육 등록’ 버튼을 눌러주세요.</span>`;
    saveBtn.textContent = editingSessionId ? '교육/회차/대상자 수정 저장' : '교육 기본정보 수정 저장';
  } else {
    banner.classList.add('hidden');
    banner.textContent = '';
    saveBtn.textContent = '교육/회차/대상자 저장';
  }
}
function clearSessionFields(){
  ['sessionDate','sessionLocation','sessionStart','sessionEnd','sessionNoCustom'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const sn = document.getElementById('sessionNo'); if(sn) sn.value='1차';
  const ss = document.getElementById('sessionStatus'); if(ss) ss.value='서명가능';
  updateSessionTitlePreview();
}
function setSessionNoControl(value){
  const sel = document.getElementById('sessionNo');
  const custom = document.getElementById('sessionNoCustom');
  if(!sel) return;
  const options = Array.from(sel.options).map(o=>o.value);
  if(options.includes(value)){
    sel.value = value;
    if(custom) custom.value = '';
  } else {
    sel.value = '직접입력';
    if(custom) custom.value = value || '';
  }
  updateSessionTitlePreview();
}
function periodDetailOptions(period){
  if(period === '월간') return Array.from({length:12},(_,i)=>`${i+1}월`);
  if(period === '분기') return ['1분기','2분기','3분기','4분기'];
  if(period === '반기') return ['상반기','하반기'];
  if(period === '연간') return ['연간'];
  if(period === '수시') return ['수시'];
  return [''];
}
function updatePeriodDetailOptions(){
  const periodEl = document.getElementById('eduPeriod');
  const detailEl = document.getElementById('eduPeriodDetail');
  if(!periodEl || !detailEl) return;
  const prev = detailEl.value;
  const opts = periodDetailOptions(periodEl.value);
  detailEl.innerHTML = opts.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if(opts.includes(prev)) detailEl.value = prev;
}
function buildEducationTitle(){
  const year = normalizeText(document.getElementById('eduYear')?.value || new Date().getFullYear());
  const type = currentEduType();
  const detail = normalizeText(document.getElementById('eduPeriodDetail')?.value || '');
  const parts = [`${year}년`];
  if(detail && detail !== '연간') parts.push(detail);
  if(detail === '연간') parts.push('연간');
  if(type) parts.push(type);
  return parts.join(' ').trim();
}
function updateEducationTitlePreview(){
  const customWrap = document.getElementById('eduTypeCustomWrap');
  const typeSel = document.getElementById('eduTypeSelect');
  if(customWrap && typeSel) customWrap.classList.toggle('hidden', typeSel.value !== '기타/수시교육 직접입력');
  updatePeriodDetailOptions();
  const titleEl = document.getElementById('eduTitle');
  if(titleEl) titleEl.value = buildEducationTitle();
  updateSessionTitlePreview();
}
function initEduTypeOptions(){
  const sel = document.getElementById('eduTypeSelect');
  if(!sel) return;
  sel.innerHTML = LEGAL_EDU_TYPES.map((v,i)=>`<option value="${escapeHtml(v)}" ${i===0?'selected':''}>${escapeHtml(v)}</option>`).join('');
}
function getSessionNoValue(){
  const sel = document.getElementById('sessionNo');
  const custom = document.getElementById('sessionNoCustom');
  if(!sel) return '';
  if(sel.value === '직접입력') return normalizeText(custom?.value || '');
  return sel.value;
}
function sessionFullTitle(edu, session){
  if(!edu) return '';
  const no = normalizeText(session?.session_no || '');
  if(!no) return edu.title;
  if(String(edu.title||'').includes(`(${no})`)) return edu.title;
  return `${edu.title} (${no})`;
}
function updateSessionTitlePreview(){
  const preview = document.getElementById('sessionTitlePreview');
  if(!preview) return;
  const edu = { title: buildEducationTitle() };
  const no = getSessionNoValue() || '1차';
  const session = { session_no: no };
  preview.value = sessionFullTitle(edu, session);
  const customWrap = document.getElementById('sessionNoCustomWrap');
  const noSel = document.getElementById('sessionNo');
  if(customWrap && noSel) customWrap.classList.toggle('hidden', noSel.value !== '직접입력');
}
function sessionsByEdu(educationId){ return state.sessions.filter(s=>s.education_id===educationId); }
function targetsBySession(sessionId){ return state.targets.filter(t=>t.session_id===sessionId); }
function targetEmployeeIdsForSession(sessionId){ return new Set(targetsBySession(sessionId).map(t=>t.employee_id)); }
function targetEmployeeIdsForEdu(educationId){
  return new Set(state.targets.filter(t=>t.education_id===educationId).map(t=>t.employee_id));
}
function targetsByEdu(educationId){
  return [...targetEmployeeIdsForEdu(educationId)].map(employee_id=>({ education_id:educationId, employee_id, target_status:'대상' }));
}
function signaturesByEdu(educationId){ return state.signatures.filter(s=>s.education_id===educationId); }
function signatureFor(educationId, employeeId){ return state.signatures.find(s=>s.education_id===educationId && s.employee_id===employeeId); }
function signatureForSession(sessionId, employeeId){ return state.signatures.find(s=>s.session_id===sessionId && s.employee_id===employeeId); }
function sessionLabel(session){
  if(!session) return '';
  const no = normalizeText(session.session_no || '');
  const name = normalizeText(session.session_name || '');
  if(!name || name === no) return no;
  return `${no} ${name}`.trim();
}
function currentFormSession(){
  if(editingSessionId) return getSession(editingSessionId);
  if(editingEducationId && !editingSessionId) return null;
  const edu = currentFormEducation();
  const no = getSessionNoValue();
  if(!edu || !no) return null;
  return state.sessions.find(s=>s.education_id===edu.id && s.session_no===no) || null;
}

function showLogin(){
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('employeeDashboard').classList.add('hidden');
}
function showAdmin(){
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');
  document.getElementById('employeeDashboard').classList.add('hidden');
  renderAllAdmin();
}
function showEmployee(emp){
  currentEmployee = emp;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('employeeDashboard').classList.remove('hidden');
  document.getElementById('loggedEmployeeName').textContent = `${emp.name} 님`;
  document.getElementById('loggedEmployeeMeta').textContent = `${emp.department || '-'} · ${emp.employee_no}`;
  renderMyEducations();
}

function initTabs(){
  document.querySelectorAll('[data-login-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-login-tab]').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.login-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.loginTab).classList.add('active');
    });
  });
}
function initNav(){
  document.querySelectorAll('.nav[data-view]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.nav[data-view]').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('#adminDashboard .view').forEach(v=>v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.view).classList.add('active');
      renderAllAdmin();
    });
  });
}

function renderAllAdmin(){
  fillEducationSelects();
  renderEmployees();
  renderEducations();
  renderSessions();
  renderTargetDeptOptions();
  renderTargets();
  renderStatus();
}

function initLogins(){
  document.getElementById('adminLoginBtn').addEventListener('click',()=>{
    const id = document.getElementById('adminId').value.trim();
    const pw = document.getElementById('adminPassword').value;
    if(id === ADMIN_ID && pw === ADMIN_PASSWORD) showAdmin();
    else alertMsg('관리자 ID 또는 비밀번호가 맞지 않습니다.');
  });
  document.getElementById('employeeLoginBtn').addEventListener('click',()=>{
    const name = normalizeText(document.getElementById('empLoginName').value);
    const no = normalizeText(document.getElementById('empLoginNo').value);
    const phone = normalizePhone(document.getElementById('empLoginPhone').value);
    const emp = state.employees.find(e => normalizeText(e.name)===name && normalizeText(e.employee_no)===no && normalizePhone(e.phone_number)===phone && e.employment_status !== '퇴사');
    if(!emp) return alertMsg('직원 정보가 일치하지 않거나 퇴사 상태입니다. 관리자에게 문의해 주세요.');
    showEmployee(emp);
  });
  document.getElementById('adminLogoutBtn').addEventListener('click', showLogin);
  document.getElementById('employeeLogoutBtn').addEventListener('click',()=>{ currentEmployee = null; showLogin(); });
}

function employeeRowFromObject(row){
  const employee_no = normalizeText(row['사번'] ?? row['employee_no'] ?? row['Employee No'] ?? row['NO'] ?? row['No']);
  const name = normalizeText(row['이름'] ?? row['성명'] ?? row['name'] ?? row['Name']);
  const department = normalizeText(row['부서'] ?? row['department'] ?? row['Department']);
  const phone_number = normalizePhone(row['휴대폰번호'] ?? row['휴대폰 번호'] ?? row['전화번호'] ?? row['phone_number'] ?? row['Phone']);
  const shift_type = normalizeWorkType(row['근무형태'] ?? row['근무조'] ?? row['shift_type'] ?? row['Shift'] ?? '주간 정취');
  const employment_status = normalizeText(row['재직상태'] ?? row['employment_status'] ?? row['Status'] ?? '재직') || '재직';
  const hire_date = normalizeText(row['입사일'] ?? row['hire_date'] ?? '');
  const resign_date = normalizeText(row['퇴사일'] ?? row['resign_date'] ?? '');
  return { employee_no, name, department, phone_number, shift_type, employment_status, hire_date, resign_date };
}

function importEmployeesFromRows(rows){
  let added = 0, updated = 0, skipped = 0;
  rows.forEach(raw=>{
    const r = employeeRowFromObject(raw);
    if(!r.employee_no || !r.name || !r.department || !r.phone_number){ skipped++; return; }
    const existing = state.employees.find(e=>e.employee_no === r.employee_no);
    if(existing){ Object.assign(existing, r, { updated_at: nowIso() }); updated++; }
    else { state.employees.push({ id: uid('emp'), ...r, created_at: nowIso(), updated_at: nowIso() }); added++; }
  });
  saveState(); renderAllAdmin();
  alertMsg(`직원 업로드 완료\n추가: ${added}명\n업데이트: ${updated}명\n건너뜀: ${skipped}건`);
}

function initEmployeeActions(){
  document.getElementById('importEmployeesBtn').addEventListener('click',()=>{
    const file = document.getElementById('employeeExcel').files[0];
    if(!file) return alertMsg('업로드할 엑셀 파일을 선택해 주세요.');
    const reader = new FileReader();
    reader.onload = e => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
      importEmployeesFromRows(rows);
    };
    reader.readAsArrayBuffer(file);
  });

  document.getElementById('downloadEmployeeTemplateBtn').addEventListener('click',()=>{
    const rows = [
      { 사번:'10001', 이름:'김OO', 부서:'조립반', 휴대폰번호:'01012345678', 근무형태:'1반', 재직상태:'재직', 입사일:'2026-01-01', 퇴사일:'' },
      { 사번:'10002', 이름:'이OO', 부서:'품질보증반', 휴대폰번호:'01098765432', 근무형태:'2반', 재직상태:'재직', 입사일:'2026-01-01', 퇴사일:'' },
      { 사번:'10003', 이름:'박OO', 부서:'관리팀', 휴대폰번호:'01011112222', 근무형태:'주간 정취', 재직상태:'재직', 입사일:'2026-01-01', 퇴사일:'' }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employee_upload_template.xlsx');
  });

  document.getElementById('addEmployeeBtn').addEventListener('click',()=>{
    const employee_no = normalizeText(document.getElementById('newEmpNo').value);
    const name = normalizeText(document.getElementById('newEmpName').value);
    const department = normalizeText(document.getElementById('newEmpDept').value);
    const phone_number = normalizePhone(document.getElementById('newEmpPhone').value);
    const shift_type = normalizeWorkType(document.getElementById('newEmpShift').value);
    if(!employee_no || !name || !department || !phone_number) return alertMsg('사번, 이름, 부서, 휴대폰번호를 모두 입력해 주세요.');
    if(state.employees.some(e=>e.employee_no===employee_no)) return alertMsg('이미 등록된 사번입니다.');
    state.employees.push({ id:uid('emp'), employee_no, name, department, phone_number, shift_type, employment_status:'재직', hire_date:'', resign_date:'', created_at:nowIso(), updated_at:nowIso() });
    saveState(); renderAllAdmin();
    ['newEmpNo','newEmpName','newEmpDept','newEmpPhone'].forEach(id=>document.getElementById(id).value='');
  });

  ['employeeSearch','employeeStatusFilter','employeeShiftFilter'].forEach(id=>document.getElementById(id).addEventListener('input',renderEmployees));
}

function filteredEmployees(prefix='employee'){
  const search = normalizeText(document.getElementById(`${prefix}Search`)?.value || '').toLowerCase();
  const status = document.getElementById(`${prefix}StatusFilter`)?.value ?? (document.getElementById(`${prefix}OnlyActive`)?.value ?? '');
  const shift = document.getElementById(`${prefix}ShiftFilter`)?.value ?? '';
  const dept = document.getElementById(`${prefix}DeptFilter`)?.value ?? '';
  return state.employees.filter(e=>{
    const hay = `${e.employee_no} ${e.name} ${e.department}`.toLowerCase();
    if(search && !hay.includes(search)) return false;
    if(status && e.employment_status !== status) return false;
    if(shift && e.shift_type !== shift) return false;
    if(dept && e.department !== dept) return false;
    return true;
  });
}

function renderEmployees(){
  const rows = filteredEmployees('employee');
  const table = document.getElementById('employeeTable');
  table.innerHTML = `<thead><tr><th>사번</th><th>이름</th><th>부서</th><th>휴대폰</th><th>근무형태</th><th>상태</th><th>관리</th></tr></thead><tbody></tbody>`;
  const tb = table.querySelector('tbody');
  rows.forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(e.employee_no)}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.department)}</td><td class="phone-mask">${escapeHtml(maskPhone(e.phone_number))}</td><td>${escapeHtml(e.shift_type||'')}</td><td><span class="pill ${e.employment_status==='재직'?'ok':'no'}">${escapeHtml(e.employment_status||'')}</span></td><td></td>`;
    const td = tr.lastElementChild;
    const toggle = document.createElement('button'); toggle.className='action-btn'; toggle.textContent = e.employment_status==='퇴사'?'재직처리':'퇴사처리';
    toggle.onclick = () => { e.employment_status = e.employment_status==='퇴사'?'재직':'퇴사'; e.resign_date = e.employment_status==='퇴사'?todayDate():''; e.updated_at=nowIso(); saveState(); renderAllAdmin(); };
    const del = document.createElement('button'); del.className='action-btn'; del.textContent='완전삭제';
    del.onclick = () => {
      const hasHistory = state.signatures.some(s=>s.employee_id===e.id) || state.targets.some(t=>t.employee_id===e.id);
      if(hasHistory) return alertMsg('교육 대상/서명 이력이 있어 완전삭제할 수 없습니다. 퇴사처리를 사용해 주세요.');
      if(confirm('정말 삭제하시겠습니까?')){ state.employees = state.employees.filter(x=>x.id!==e.id); saveState(); renderAllAdmin(); }
    };
    td.append(toggle, del);
    tb.appendChild(tr);
  });
}

function initEducationActions(){
  initEduTypeOptions();
  const consent = document.getElementById('eduConsent');
  if(consent) consent.value = DEFAULT_CONSENT;
  updateEducationTitlePreview();
  ['eduTypeSelect','eduTypeCustom','eduYear','eduPeriod','eduPeriodDetail'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('input', ()=>{ syncTargetDraftFromDom(); if(!editingEducationId) targetDraftKey=null; updateEducationTitlePreview(); renderTargets(); });
      el.addEventListener('change', ()=>{ syncTargetDraftFromDom(); if(!editingEducationId) targetDraftKey=null; updateEducationTitlePreview(); renderTargets(); });
    }
  });
  const saveIntegrated = document.getElementById('saveIntegratedEducationBtn');
  if(saveIntegrated) saveIntegrated.addEventListener('click', saveIntegratedEducation);
  const clearBtn = document.getElementById('clearEducationFormBtn');
  if(clearBtn) clearBtn.addEventListener('click', clearEducationForm);
  const newBtn = document.getElementById('newEducationBtn');
  if(newBtn) newBtn.addEventListener('click', ()=>clearEducationForm(true));
}
function currentFormEducation(){
  if(editingEducationId) return getEdu(editingEducationId);
  const title = buildEducationTitle();
  return state.educations.find(e=>e.title === title);
}
function ensureTargetDraftForCurrentEducation(){
  const key = formTargetKey();
  if(targetDraftKey === key) return;
  syncTargetDraftFromDom();
  const existingSession = currentFormSession();
  targetDraftSelection = new Set(existingSession ? targetsBySession(existingSession.id).map(t=>t.employee_id) : []);
  targetDraftKey = key;
}
function syncTargetDraftFromDom(){
  const table = document.getElementById('targetTable');
  if(!table || !targetDraftKey) return;
  table.querySelectorAll('tbody input[type=checkbox]').forEach(ch=>{
    if(ch.checked) targetDraftSelection.add(ch.value);
    else targetDraftSelection.delete(ch.value);
  });
}
function getOrCreateEducationFromForm(){
  updateEducationTitlePreview();
  const title = normalizeText(document.getElementById('eduTitle')?.value || '');
  const education_type = currentEduType();
  if(!education_type) throw new Error('법정교육 구분 또는 수시/기타 교육명을 입력해 주세요.');
  if(!title) throw new Error('교육명이 자동 생성되지 않았습니다. 선택값을 확인해 주세요.');
  let edu = editingEducationId ? getEdu(editingEducationId) : state.educations.find(e=>e.title === title);
  if(editingEducationId && !edu) throw new Error('수정할 교육을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.');
  const duplicate = state.educations.find(e=>e.title === title && e.id !== (edu?.id || ''));
  if(duplicate) throw new Error('동일한 교육명이 이미 등록되어 있습니다. 연도, 주기, 세부 주기 또는 회차를 확인해 주세요.');
  const payload = {
    title,
    education_type,
    year: normalizeText(document.getElementById('eduYear').value),
    period: document.getElementById('eduPeriod').value,
    period_detail: document.getElementById('eduPeriodDetail').value,
    summary: document.getElementById('eduSummary').value.trim(),
    consent_text: document.getElementById('eduConsent').value.trim() || DEFAULT_CONSENT,
    status: edu?.status || '진행',
    updated_at: nowIso()
  };
  if(edu){ Object.assign(edu, payload); }
  else { edu = { id: uid('edu'), ...payload, status:'진행', created_at: nowIso() }; state.educations.push(edu); }
  return edu;
}
function saveIntegratedEducation(){
  syncTargetDraftFromDom();
  let edu;
  try { edu = getOrCreateEducationFromForm(); }
  catch(err){ return alertMsg(err.message); }

  const session_no = getSessionNoValue() || `${sessionsByEdu(edu.id).length+1}차`;
  const education_date = document.getElementById('sessionDate').value;
  const start_time = document.getElementById('sessionStart').value;
  const end_time = document.getElementById('sessionEnd').value;
  const location = normalizeText(document.getElementById('sessionLocation').value);
  const status = document.getElementById('sessionStatus').value;

  const hasActualSessionInput = !!(education_date || start_time || end_time || location);
  if(editingEducationId && !editingSessionId && !hasActualSessionInput){
    saveState(); clearEducationForm(true); renderAllAdmin();
    return alertMsg(`교육 기본정보가 수정되었습니다.\n${edu.title}`);
  }

  let savedSession = null;
  if(editingSessionId){
    savedSession = getSession(editingSessionId);
    if(!savedSession) return alertMsg('수정할 회차를 찾을 수 없습니다.');
  } else {
    savedSession = state.sessions.find(s=>s.education_id===edu.id && s.session_no===session_no) || null;
  }

  if(!education_date) return alertMsg('교육일자를 입력해 주세요.');

  if(savedSession){
    Object.assign(savedSession, {
      education_id: edu.id, session_no, session_name: session_no, education_date,
      start_time, end_time, location, target_shift:'선택대상', status, updated_at:nowIso()
    });
  } else {
    savedSession = {
      id: uid('ses'), education_id: edu.id, session_no, session_name: session_no,
      education_date, start_time, end_time, location, target_shift: '선택대상', status,
      created_at: nowIso(), updated_at: nowIso()
    };
    state.sessions.push(savedSession);
  }

  const signedEmployeeIds = new Set(state.signatures.filter(s=>s.session_id===savedSession.id).map(s=>s.employee_id));
  let keptSignedCount = 0;
  signedEmployeeIds.forEach(id=>{
    if(!targetDraftSelection.has(id)){
      targetDraftSelection.add(id);
      keptSignedCount++;
    }
  });
  state.targets = state.targets.filter(t=>t.session_id !== savedSession.id);
  [...targetDraftSelection].forEach(employeeId=>{
    state.targets.push({ id:uid('tar'), education_id:edu.id, session_id:savedSession.id, employee_id:employeeId, target_status:'대상', created_at:nowIso() });
  });
  const selectedTargetCount = targetDraftSelection.size;
  saveState();
  const savedEduId = edu.id;
  const savedSessionId = savedSession.id;
  clearEducationForm(true);
  renderAllAdmin();
  const statusSel = document.getElementById('statusEducationSelect'); if(statusSel) statusSel.value = savedEduId;
  fillStatusSessionSelect();
  const statusSessionSel = document.getElementById('statusSessionSelect'); if(statusSessionSel) statusSessionSel.value = savedSessionId;
  const sessionSel = document.getElementById('sessionEducationSelect'); if(sessionSel) sessionSel.value = savedEduId;
  renderSessions(); renderStatus();
  let msg = `저장되었습니다.\n${sessionFullTitle(edu, savedSession)}\n회차별 대상자: ${selectedTargetCount}명`;
  if(keptSignedCount) msg += `\n\n해당 회차에 서명 이력이 있는 ${keptSignedCount}명은 증빙 보존을 위해 대상자에서 제외하지 않고 유지했습니다.`;
  alertMsg(msg);
}

function clearEducationForm(resetEdit=true){
  document.getElementById('eduTypeSelect').value = LEGAL_EDU_TYPES[0];
  document.getElementById('eduTypeCustom').value = '';
  document.getElementById('eduYear').value = new Date().getFullYear();
  document.getElementById('eduPeriod').value = '연간';
  updatePeriodDetailOptions();
  document.getElementById('eduPeriodDetail').value = '연간';
  document.getElementById('eduSummary').value='';
  document.getElementById('eduConsent').value = DEFAULT_CONSENT;
  clearSessionFields();
  targetDraftKey = null;
  targetDraftSelection = new Set();
  if(resetEdit) setEducationEditMode(null, null);
  updateEducationTitlePreview();
  renderTargets();
}
function renderEducations(){
  const table = document.getElementById('educationTable');
  table.innerHTML = `<thead><tr><th>교육명</th><th>구분</th><th>연도</th><th>주기</th><th>세부</th><th>회차</th><th>대상</th><th>상태</th><th>관리</th></tr></thead><tbody></tbody>`;
  const tb = table.querySelector('tbody');
  state.educations.forEach(e=>{
    const tr = document.createElement('tr');
    const sessionCount = state.sessions.filter(s=>s.education_id===e.id).length;
    const targetCount = targetEmployeeIdsForEdu(e.id).size;
    tr.innerHTML = `<td>${escapeHtml(e.title)}</td><td>${escapeHtml(e.education_type||'')}</td><td>${escapeHtml(e.year||'')}</td><td>${escapeHtml(e.period||'')}</td><td>${escapeHtml(e.period_detail||'')}</td><td>${sessionCount}</td><td>${targetCount}</td><td><span class="pill">${escapeHtml(e.status||'')}</span></td><td></td>`;
    const td = tr.lastElementChild;
    const load = document.createElement('button'); load.className='action-btn'; load.textContent='수정';
    load.onclick=()=>loadEducationToForm(e.id);
    const close = document.createElement('button'); close.className='action-btn'; close.textContent=e.status==='마감'?'진행처리':'마감';
    close.onclick=()=>{ e.status=e.status==='마감'?'진행':'마감'; e.updated_at=nowIso(); saveState(); renderAllAdmin(); };
    const del = document.createElement('button'); del.className='action-btn'; del.textContent='삭제';
    del.onclick=()=>{
      if(state.signatures.some(s=>s.education_id===e.id)) return alertMsg('서명 이력이 있어 삭제할 수 없습니다. 마감 처리해 주세요.');
      if(confirm('교육과 연결된 회차/대상자 정보를 삭제하시겠습니까?')){
        state.educations=state.educations.filter(x=>x.id!==e.id);
        state.sessions=state.sessions.filter(x=>x.education_id!==e.id);
        state.targets=state.targets.filter(x=>x.education_id!==e.id);
        targetDraftKey=null; targetDraftSelection=new Set();
        saveState(); renderAllAdmin();
      }
    };
    td.append(load, close, del); tb.appendChild(tr);
  });
}
function loadEducationToForm(educationId){
  const e = getEdu(educationId); if(!e) return;
  setEducationEditMode(e.id, null);
  if(LEGAL_EDU_TYPES.includes(e.education_type)){
    document.getElementById('eduTypeSelect').value = e.education_type;
    document.getElementById('eduTypeCustom').value = '';
  } else {
    document.getElementById('eduTypeSelect').value = '기타/수시교육 직접입력';
    document.getElementById('eduTypeCustom').value = e.education_type || '';
  }
  document.getElementById('eduYear').value = e.year || new Date().getFullYear();
  document.getElementById('eduPeriod').value = e.period || '연간';
  updatePeriodDetailOptions();
  document.getElementById('eduPeriodDetail').value = e.period_detail || '연간';
  document.getElementById('eduSummary').value = e.summary || '';
  document.getElementById('eduConsent').value = e.consent_text || DEFAULT_CONSENT;
  clearSessionFields();
  targetDraftKey = null;
  updateEducationTitlePreview();
  renderTargets();
  const sel = document.getElementById('sessionEducationSelect'); if(sel) sel.value=e.id;
  renderSessions();
  document.querySelector('[data-view="educationManageView"]')?.click();
}
function loadSessionToForm(sessionId){
  const s = getSession(sessionId); if(!s) return;
  loadEducationToForm(s.education_id);
  setEducationEditMode(s.education_id, s.id);
  setSessionNoControl(s.session_no || '1차');
  document.getElementById('sessionDate').value = s.education_date || '';
  document.getElementById('sessionLocation').value = s.location || '';
  document.getElementById('sessionStart').value = s.start_time || '';
  document.getElementById('sessionEnd').value = s.end_time || '';
  document.getElementById('sessionStatus').value = s.status || '서명가능';
  updateSessionTitlePreview();
}
function fillEducationSelects(){
  const selects = ['sessionEducationSelect','statusEducationSelect'];
  selects.forEach(id=>{
    const sel = document.getElementById(id);
    if(!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    state.educations.forEach(e=>{
      const opt = document.createElement('option'); opt.value=e.id; opt.textContent=`${e.title}`; sel.appendChild(opt);
    });
    if(prev && state.educations.some(e=>e.id===prev)) sel.value=prev;
  });
  fillStatusSessionSelect();
}
function initSessionActions(){
  ['sessionNo','sessionNoCustom','sessionDate','sessionLocation','sessionStart','sessionEnd','sessionStatus'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.addEventListener('input', ()=>{ syncTargetDraftFromDom(); targetDraftKey=null; updateSessionTitlePreview(); renderTargets(); }); el.addEventListener('change', ()=>{ syncTargetDraftFromDom(); targetDraftKey=null; updateSessionTitlePreview(); renderTargets(); }); }
  });
  const sessionSel = document.getElementById('sessionEducationSelect');
  if(sessionSel) sessionSel.addEventListener('change', renderSessions);
  updateSessionTitlePreview();
}
function renderSessions(){
  const eduId = document.getElementById('sessionEducationSelect')?.value;
  const table = document.getElementById('sessionTable');
  if(!table) return;
  table.innerHTML = `<thead><tr><th>회차별 교육명</th><th>교육일자</th><th>시간</th><th>장소</th><th>대상</th><th>서명</th><th>상태</th><th>관리</th></tr></thead><tbody></tbody>`;
  const tb = table.querySelector('tbody');
  state.sessions.filter(s=>!eduId || s.education_id===eduId).sort((a,b)=>(a.education_date||'').localeCompare(b.education_date||'')).forEach(s=>{
    const tr = document.createElement('tr');
    const targetCount = targetsBySession(s.id).length;
    const signedCount = state.signatures.filter(x=>x.session_id===s.id).length;
    tr.innerHTML = `<td>${escapeHtml(sessionFullTitle(getEdu(s.education_id), s))}</td><td>${escapeHtml(s.education_date||'')}</td><td>${escapeHtml((s.start_time||'') + (s.end_time?`~${s.end_time}`:''))}</td><td>${escapeHtml(s.location||'')}</td><td>${targetCount}</td><td>${signedCount}</td><td><span class="pill ${s.status==='서명가능'?'ok':(s.status==='마감'?'no':'warn')}">${escapeHtml(s.status||'')}</span></td><td></td>`;
    const td = tr.lastElementChild;
    const edit = document.createElement('button'); edit.className='action-btn'; edit.textContent='수정/대상자';
    edit.onclick=()=>loadSessionToForm(s.id);
    td.appendChild(edit);
    ['예정','서명가능','마감'].forEach(st=>{
      const btn = document.createElement('button'); btn.className='action-btn'; btn.textContent=st;
      btn.onclick=()=>{ s.status=st; s.updated_at=nowIso(); saveState(); renderAllAdmin(); };
      td.appendChild(btn);
    });
    const del = document.createElement('button'); del.className='action-btn'; del.textContent='삭제';
    del.onclick=()=>{
      if(state.signatures.some(x=>x.session_id===s.id)) return alertMsg('해당 회차에 서명 이력이 있어 삭제할 수 없습니다.');
      if(confirm('회차와 해당 회차의 대상자 정보를 삭제하시겠습니까?')){ state.sessions=state.sessions.filter(x=>x.id!==s.id); state.targets=state.targets.filter(x=>x.session_id!==s.id); saveState(); renderAllAdmin(); }
    };
    td.appendChild(del); tb.appendChild(tr);
  });
}

function renderTargetDeptOptions(){
  const sel = document.getElementById('targetDeptFilter');
  if(!sel) return;
  const prev = sel.value;
  const depts = [...new Set(state.employees.map(e=>e.department).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">전체부서</option>' + depts.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  if(depts.includes(prev)) sel.value=prev;
}
function initTargetActions(){
  ['targetSearch','targetDeptFilter','targetShiftFilter','targetOnlyActive'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('input',()=>{ syncTargetDraftFromDom(); renderTargets(); });
  });
  const bind = (id, fn)=>{ const el=document.getElementById(id); if(el) el.addEventListener('click', fn); };
  bind('selectAllFilteredBtn',()=>{ ensureTargetDraftForCurrentEducation(); targetFilteredEmployees().forEach(e=>targetDraftSelection.add(e.id)); renderTargets(); });
  bind('deselectAllFilteredBtn',()=>{ ensureTargetDraftForCurrentEducation(); targetFilteredEmployees().forEach(e=>targetDraftSelection.delete(e.id)); renderTargets(); });
  bind('selectShift1Btn',()=>selectWorkTypeTargets('1반'));
  bind('selectShift2Btn',()=>selectWorkTypeTargets('2반'));
  bind('selectDayFixedBtn',()=>selectWorkTypeTargets('주간 정취'));
  bind('clearAllTargetsBtn',()=>{ ensureTargetDraftForCurrentEducation(); if(confirm('현재 교육의 선택 대상자를 모두 해제하시겠습니까?')){ targetDraftSelection.clear(); renderTargets(); } });
}
function selectWorkTypeTargets(workType){
  ensureTargetDraftForCurrentEducation();
  state.employees.filter(e=>e.shift_type===workType && e.employment_status==='재직').forEach(e=>targetDraftSelection.add(e.id));
  renderTargets();
}
function targetFilteredEmployees(){
  const search = normalizeText(document.getElementById('targetSearch')?.value || '').toLowerCase();
  const dept = document.getElementById('targetDeptFilter')?.value || '';
  const shift = document.getElementById('targetShiftFilter')?.value || '';
  const status = document.getElementById('targetOnlyActive')?.value || '';
  return state.employees.filter(e=>{
    const hay = `${e.employee_no} ${e.name} ${e.department}`.toLowerCase();
    if(search && !hay.includes(search)) return false;
    if(dept && e.department !== dept) return false;
    if(shift && e.shift_type !== shift) return false;
    if(status && e.employment_status !== status) return false;
    return true;
  });
}
function renderTargets(){
  ensureTargetDraftForCurrentEducation();
  const rows = targetFilteredEmployees();
  const table = document.getElementById('targetTable');
  if(!table) return;
  const existingEdu = currentFormEducation();
  const existingSession = currentFormSession();
  table.innerHTML = `<thead><tr><th>선택</th><th>사번</th><th>이름</th><th>부서</th><th>근무형태</th><th>상태</th><th>해당 회차 서명상태</th></tr></thead><tbody></tbody>`;
  const tb = table.querySelector('tbody');
  rows.forEach(e=>{
    const sig = existingSession ? signatureForSession(existingSession.id, e.id) : (existingEdu ? signatureFor(existingEdu.id, e.id) : null);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="checkbox" value="${e.id}" ${targetDraftSelection.has(e.id)?'checked':''}></td><td>${escapeHtml(e.employee_no)}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.department)}</td><td>${escapeHtml(e.shift_type||'')}</td><td>${escapeHtml(e.employment_status||'')}</td><td>${sig?'<span class="pill ok">완료</span>':'<span class="pill no">미완료</span>'}</td>`;
    tr.querySelector('input').addEventListener('change', ev=>{
      if(ev.target.checked) targetDraftSelection.add(e.id);
      else targetDraftSelection.delete(e.id);
    });
    tb.appendChild(tr);
  });
}

function initStatusActions(){
  ['statusEducationSelect','exportMode','statusSessionSelect','statusFilter'].forEach(id=>document.getElementById(id).addEventListener('change', renderStatus));
  document.getElementById('statusEducationSelect').addEventListener('change',()=>{ fillStatusSessionSelect(); renderStatus(); });
  document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);
  document.getElementById('exportPdfBtn').addEventListener('click', openPrintableSignatureSheet);
  document.getElementById('exportPendingBtn').addEventListener('click', exportPendingCsv);
}
function fillStatusSessionSelect(){
  const eduId = document.getElementById('statusEducationSelect')?.value;
  const sel = document.getElementById('statusSessionSelect');
  if(!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">전체 회차</option>';
  state.sessions.filter(s=>s.education_id===eduId).forEach(s=>{
    const opt = document.createElement('option'); opt.value=s.id; opt.textContent=`${sessionLabel(s)} (${s.education_date||''})`; sel.appendChild(opt);
  });
  if(prev && state.sessions.some(s=>s.id===prev)) sel.value=prev;
}
function statusRows(){
  const eduId = document.getElementById('statusEducationSelect').value;
  const filter = document.getElementById('statusFilter').value;
  const mode = document.getElementById('exportMode').value;
  const selectedSessionId = document.getElementById('statusSessionSelect').value;
  if(!eduId) return [];
  let targetRecords;
  if(mode === 'session' && selectedSessionId){
    targetRecords = targetsBySession(selectedSessionId);
  } else {
    targetRecords = targetsByEdu(eduId);
  }
  return targetRecords.map(t=>{
    const emp = getEmp(t.employee_id);
    if(!emp) return null;
    let sig = null;
    if(mode === 'session' && selectedSessionId){
      sig = signatureForSession(selectedSessionId, emp.id);
    } else {
      sig = signatureFor(eduId, emp.id);
    }
    const ses = sig ? getSession(sig.session_id) : null;
    return { employee: emp, signature: sig, session: ses };
  }).filter(Boolean).filter(r=>{
    if(filter==='completed') return !!r.signature;
    if(filter==='pending') return !r.signature;
    return true;
  });
}

function renderStatus(){
  fillStatusSessionSelect();
  const eduId = document.getElementById('statusEducationSelect').value;
  const mode = document.getElementById('exportMode').value;
  const selectedSessionId = document.getElementById('statusSessionSelect').value;
  const targetRecords = eduId ? ((mode==='session' && selectedSessionId) ? targetsBySession(selectedSessionId) : targetsByEdu(eduId)) : [];
  const totalTargets = targetRecords.length;
  const completed = eduId ? targetRecords.filter(t=> (mode==='session' && selectedSessionId) ? signatureForSession(selectedSessionId,t.employee_id) : signatureFor(eduId,t.employee_id)).length : 0;
  const rows = statusRows();
  const basis = (mode==='session' && selectedSessionId) ? `회차별 · ${sessionLabel(getSession(selectedSessionId))}` : '전체 통합';
  document.getElementById('statusStats').innerHTML = `<div class="stat">기준 ${basis}</div><div class="stat">대상 ${totalTargets}명</div><div class="stat">완료 ${completed}명</div><div class="stat">미완료 ${Math.max(totalTargets-completed,0)}명</div><div class="stat">현재표시 ${rows.length}명</div>`;
  const table = document.getElementById('statusTable');
  table.innerHTML = `<thead><tr><th>NO</th><th>부서</th><th>사번</th><th>이름</th><th>이수회차</th><th>서명</th><th>서명일시</th></tr></thead><tbody></tbody>`;
  const tb = table.querySelector('tbody');
  rows.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(r.employee.department)}</td><td>${escapeHtml(r.employee.employee_no)}</td><td>${escapeHtml(r.employee.name)}</td><td>${r.session?escapeHtml(sessionLabel(r.session)):'<span class="pill no">미완료</span>'}</td><td>${r.signature?`<img class="signature-img" src="${r.signature.signature_image_url}" />`:''}</td><td>${formatDateTime(r.signature?.signed_at)}</td>`;
    tb.appendChild(tr);
  });
}

function renderMyEducations(){
  const list = document.getElementById('myEducationList');
  list.innerHTML = '';
  document.getElementById('signaturePanel').classList.add('hidden');
  const eduIds = [...new Set(state.targets.filter(t=>t.employee_id===currentEmployee.id).map(t=>t.education_id))];
  const myTargets = eduIds.map(id=>getEdu(id)).filter(Boolean).filter(e=>e.status !== '마감');
  if(myTargets.length===0){ list.innerHTML = '<div class="panel">현재 서명 가능한 교육이 없습니다.</div>'; return; }
  myTargets.forEach(edu=>{
    const sig = signatureFor(edu.id, currentEmployee.id);
    const targetSessionIds = new Set(state.targets.filter(t=>t.education_id===edu.id && t.employee_id===currentEmployee.id).map(t=>t.session_id));
    const sessions = sessionsByEdu(edu.id).filter(s=>s.status==='서명가능' && targetSessionIds.has(s.id));
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>${escapeHtml(edu.title)}</h3><p class="hint">${escapeHtml(edu.education_type||'')} · ${escapeHtml(edu.year||'')} · ${escapeHtml(edu.period||'')} ${escapeHtml(edu.period_detail||'')}</p><p>${sig?'<span class="pill ok">서명 완료</span>':'<span class="pill no">미서명</span>'} <span class="pill">서명 가능 회차 ${sig?0:sessions.length}개</span></p>`;
    const btn = document.createElement('button'); btn.className='primary'; btn.textContent = sig ? '서명 내용 확인' : '교육 확인 및 서명';
    btn.onclick=()=>openSignaturePanel(edu.id);
    card.appendChild(btn); list.appendChild(card);
  });
}

function openSignaturePanel(educationId){
  selectedSignEducationId = educationId;
  const edu = getEdu(educationId);
  const sig = signatureFor(educationId, currentEmployee.id);
  document.getElementById('signaturePanel').classList.remove('hidden');
  document.getElementById('signEduTitle').textContent = edu.title;
  document.getElementById('signEduMeta').textContent = `${edu.education_type||''} · ${edu.year||''} · ${edu.period||''} ${edu.period_detail||''}`;
  document.getElementById('signEduSummary').textContent = edu.summary || '등록된 교육 요약내용이 없습니다.';
  document.getElementById('consentText').textContent = edu.consent_text || DEFAULT_CONSENT;
  document.getElementById('consentCheck').checked = !!sig;
  const sel = document.getElementById('signSessionSelect'); sel.innerHTML='';
  const targetSessionIds = new Set(state.targets.filter(t=>t.education_id===educationId && t.employee_id===currentEmployee.id).map(t=>t.session_id));
  const availableSessions = sessionsByEdu(educationId).filter(s=> (s.status==='서명가능' && targetSessionIds.has(s.id)) || (sig && sig.session_id===s.id));
  availableSessions.forEach(s=>{
    const opt = document.createElement('option'); opt.value=s.id; opt.textContent=`${sessionFullTitle(edu, s)} · ${s.education_date||''} ${s.start_time||''}~${s.end_time||''} · ${s.location||''}`; sel.appendChild(opt);
  });
  if(sig){ sel.value = sig.session_id; }
  initSignatureCanvas(sig?.signature_image_url);
  document.getElementById('submitSignatureBtn').disabled = !!sig;
  document.getElementById('submitSignatureBtn').textContent = sig ? '이미 제출 완료' : '서명 제출';
  document.getElementById('clearSignatureBtn').disabled = !!sig;
  document.getElementById('consentCheck').disabled = !!sig;
  document.getElementById('signSessionSelect').disabled = !!sig;
  document.getElementById('signaturePanel').scrollIntoView({behavior:'smooth',block:'start'});
}

function initSignatureCanvas(existingImage){
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let drawing = false, hasInk = false;
  function pos(evt){
    const rect = canvas.getBoundingClientRect();
    const e = evt.touches ? evt.touches[0] : evt;
    return { x:(e.clientX-rect.left)*(canvas.width/rect.width), y:(e.clientY-rect.top)*(canvas.height/rect.height) };
  }
  function start(evt){ if(existingImage) return; drawing=true; hasInk=true; const p=pos(evt); ctx.beginPath(); ctx.moveTo(p.x,p.y); evt.preventDefault(); }
  function move(evt){ if(!drawing || existingImage) return; const p=pos(evt); ctx.lineTo(p.x,p.y); ctx.stroke(); evt.preventDefault(); }
  function end(){ drawing=false; }
  canvas.onmousedown=start; canvas.onmousemove=move; window.onmouseup=end;
  canvas.ontouchstart=start; canvas.ontouchmove=move; canvas.ontouchend=end;
  signaturePad = { canvas, ctx, hasInk:()=>hasInk || !!existingImage, clear:()=>{ if(existingImage) return; ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); hasInk=false; }, dataUrl:()=>canvas.toDataURL('image/png') };
  if(existingImage){
    const img = new Image(); img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height); img.src=existingImage;
  }
}
function initSignatureActions(){
  document.getElementById('clearSignatureBtn').addEventListener('click',()=>signaturePad?.clear());
  document.getElementById('closeSignaturePanelBtn').addEventListener('click',()=>document.getElementById('signaturePanel').classList.add('hidden'));
  document.getElementById('submitSignatureBtn').addEventListener('click',()=>{
    if(!selectedSignEducationId || !currentEmployee) return;
    if(signatureFor(selectedSignEducationId,currentEmployee.id)) return alertMsg('이미 제출된 서명은 수정할 수 없습니다.');
    const sessionId = document.getElementById('signSessionSelect').value;
    if(!sessionId) return alertMsg('서명 가능한 교육 회차가 없습니다.');
    if(!targetsBySession(sessionId).some(t=>t.employee_id===currentEmployee.id)) return alertMsg('해당 회차의 교육 대상자가 아닙니다. 관리자에게 문의해 주세요.');
    if(!document.getElementById('consentCheck').checked) return alertMsg('전자서명 동의 문구에 체크해 주세요.');
    if(!signaturePad?.hasInk()) return alertMsg('서명을 입력해 주세요.');
    state.signatures.push({
      id: uid('sig'), education_id:selectedSignEducationId, session_id:sessionId, employee_id:currentEmployee.id,
      consent_checked:true, signature_image_url: signaturePad.dataUrl(), signed_at:nowIso(),
      ip_address:'browser-local', device_info:navigator.userAgent
    });
    saveState(); alertMsg('서명이 제출되었습니다.'); renderMyEducations();
  });
}

async function exportExcel(){
  if(!window.ExcelJS) return alertMsg('ExcelJS 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  const eduId = document.getElementById('statusEducationSelect').value;
  if(!eduId) return alertMsg('교육을 선택해 주세요.');
  const edu = getEdu(eduId);
  const mode = document.getElementById('exportMode').value;
  const selectedSessionId = document.getElementById('statusSessionSelect').value;
  const rows = statusRows();
  const selectedSession = selectedSessionId ? getSession(selectedSessionId) : null;
  const exportTitle = (mode==='session' && selectedSession) ? sessionFullTitle(edu, selectedSession) : edu.title;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Education Signature Manager';
  const ws = wb.addWorksheet('Signature Sheet', { pageSetup:{paperSize:9, orientation:'portrait', fitToPage:true, fitToWidth:1, fitToHeight:0, margins:{left:0.3,right:0.3,top:0.5,bottom:0.5,header:0.2,footer:0.2}} });
  ws.columns = [
    {key:'no', width:6}, {key:'dept', width:20}, {key:'empno', width:14}, {key:'name', width:14}, {key:'session', width:22}, {key:'signature', width:24}, {key:'signedAt', width:22}
  ];
  ws.mergeCells('A1:G1'); ws.getCell('A1').value = '서명부'; ws.getCell('A1').font={bold:true,size:18}; ws.getCell('A1').alignment={horizontal:'center'};
  ws.mergeCells('A2:G2'); ws.getCell('A2').value = `교육명: ${exportTitle}`;
  ws.mergeCells('A3:G3'); ws.getCell('A3').value = `교육구분: ${edu.education_type||''} / 연도: ${edu.year||''} / 주기: ${edu.period||''}`;
  let infoLine = '출력기준: 전체 통합';
  if(mode==='session' && selectedSessionId){ const ses=getSession(selectedSessionId); infoLine=`출력기준: 회차별 / ${sessionLabel(ses)} / ${ses?.education_date||''} ${ses?.start_time||''}~${ses?.end_time||''} / ${ses?.location||''}`; }
  ws.mergeCells('A4:G4'); ws.getCell('A4').value = infoLine;
  ws.addRow([]);
  const headerRow = ws.addRow(['NO','부서','사번','이름','이수회차','서명','서명일시']);
  headerRow.font={bold:true}; headerRow.height=22;
  headerRow.eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEFF3F8'}}; cell.border=thinBorder(); cell.alignment={horizontal:'center',vertical:'middle'}; });
  const startRow = ws.lastRow.number + 1;
  rows.forEach((r,idx)=>{
    const row = ws.addRow([idx+1, r.employee.department, r.employee.employee_no, r.employee.name, r.session?sessionLabel(r.session):'미완료', '', formatDateTime(r.signature?.signed_at)]);
    row.height = 48;
    row.eachCell(cell=>{ cell.border=thinBorder(); cell.alignment={horizontal:'center',vertical:'middle'}; });
    if(r.signature?.signature_image_url){
      const imageId = wb.addImage({ base64:r.signature.signature_image_url, extension:'png' });
      const rowNumber = startRow + idx;
      ws.addImage(imageId, { tl:{ col:5.15, row:rowNumber-0.85 }, ext:{ width:145, height:42 }, editAs:'oneCell' });
    }
  });
  ws.eachRow(row=>row.eachCell(cell=>{ cell.font = {...(cell.font||{}), name:'Malgun Gothic'}; }));
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), safeFileName(`signature_sheet_${exportTitle}.xlsx`));
}
function thinBorder(){ return { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }; }
function safeFileName(name){ return name.replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_'); }

function openPrintableSignatureSheet(){
  const eduId = document.getElementById('statusEducationSelect').value;
  if(!eduId) return alertMsg('교육을 선택해 주세요.');
  const edu = getEdu(eduId);
  const rows = statusRows();
  const mode = document.getElementById('exportMode').value;
  const selectedSessionId = document.getElementById('statusSessionSelect').value;
  let infoLine = '전체 통합 서명부';
  const selectedSession = selectedSessionId ? getSession(selectedSessionId) : null;
  const exportTitle = (mode==='session' && selectedSession) ? sessionFullTitle(edu, selectedSession) : edu.title;
  if(mode==='session' && selectedSessionId){ const ses=getSession(selectedSessionId); infoLine=`회차별 서명부 · ${sessionLabel(ses)} · ${ses?.education_date||''} ${ses?.start_time||''}~${ses?.end_time||''} · ${ses?.location||''}`; }
  const perPage = 18;
  const pages = [];
  for(let i=0;i<rows.length;i+=perPage) pages.push(rows.slice(i,i+perPage));
  const htmlPages = (pages.length?pages:[[]]).map((page,pi)=>`
    <section class="print-page">
      <h1>서명부</h1>
      <div class="meta"><p><b>교육명:</b> ${escapeHtml(exportTitle)}</p><p><b>교육구분:</b> ${escapeHtml(edu.education_type||'')} / <b>연도:</b> ${escapeHtml(edu.year||'')} / <b>주기:</b> ${escapeHtml(edu.period||'')}</p><p><b>출력기준:</b> ${escapeHtml(infoLine)}</p></div>
      <table><thead><tr><th>NO</th><th>부서</th><th>사번</th><th>이름</th><th>이수회차</th><th>서명</th><th>서명일시</th></tr></thead><tbody>
      ${page.map((r,idx)=>`<tr><td>${pi*perPage+idx+1}</td><td>${escapeHtml(r.employee.department)}</td><td>${escapeHtml(r.employee.employee_no)}</td><td>${escapeHtml(r.employee.name)}</td><td>${r.session?escapeHtml(sessionLabel(r.session)):'미완료'}</td><td>${r.signature?`<img src="${r.signature.signature_image_url}" />`:''}</td><td>${formatDateTime(r.signature?.signed_at)}</td></tr>`).join('')}
      </tbody></table>
      <div class="page-no">${pi+1} / ${pages.length||1}</div>
    </section>`).join('');
  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Signature Sheet</title><style>
    @page{size:A4;margin:12mm} body{font-family:Arial,'Malgun Gothic',sans-serif;color:#111} .print-page{page-break-after:always} h1{text-align:center;margin:0 0 12px;font-size:22px}.meta{font-size:12px;margin-bottom:10px}.meta p{margin:3px 0} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #222;padding:6px;text-align:center;vertical-align:middle;font-size:11px;height:38px} th{background:#eee} td:nth-child(2){text-align:left} img{max-width:120px;max-height:34px}.page-no{text-align:right;margin-top:8px;font-size:11px;color:#555}@media print{.print-page:last-child{page-break-after:auto}}
    </style></head><body>${htmlPages}<script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  win.document.close();
}
function exportPendingCsv(){
  const eduId = document.getElementById('statusEducationSelect').value;
  if(!eduId) return alertMsg('교육을 선택해 주세요.');
  const edu = getEdu(eduId);
  const mode = document.getElementById('exportMode').value;
  const selectedSessionId = document.getElementById('statusSessionSelect').value;
  const targetRecords = (mode==='session' && selectedSessionId) ? targetsBySession(selectedSessionId) : targetsByEdu(eduId);
  const rows = targetRecords.map(t=>getEmp(t.employee_id)).filter(Boolean).filter(e=> (mode==='session' && selectedSessionId) ? !signatureForSession(selectedSessionId,e.id) : !signatureFor(eduId,e.id));
  const header = ['교육명','출력기준','부서','사번','이름','휴대폰번호','근무형태'];
  const basis = (mode==='session' && selectedSessionId) ? sessionFullTitle(edu, getSession(selectedSessionId)) : '전체 통합';
  const csvRows = [header, ...rows.map(e=>[edu.title,basis,e.department,e.employee_no,e.name,e.phone_number,e.shift_type])];
  const csv = '\ufeff' + csvRows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  saveAs(blob, safeFileName(`pending_employees_${edu.title}_${basis}.csv`));
}


function initReset(){
  document.getElementById('resetAllBtn').addEventListener('click',()=>{
    if(confirm('전체 데이터가 삭제됩니다. 정말 초기화하시겠습니까?')){
      localStorage.removeItem(LS_KEY); state = loadState(); renderAllAdmin();
    }
  });
}
function initDemoDataIfEmpty(){
  if(state.employees.length || state.educations.length) return;
  const e1 = {id:uid('emp'), employee_no:'10001', name:'김OO', department:'조립반', phone_number:'01012345678', shift_type:'1반', employment_status:'재직', hire_date:'', resign_date:'', created_at:nowIso(), updated_at:nowIso()};
  const e2 = {id:uid('emp'), employee_no:'10002', name:'이OO', department:'품질보증반', phone_number:'01098765432', shift_type:'2반', employment_status:'재직', hire_date:'', resign_date:'', created_at:nowIso(), updated_at:nowIso()};
  const e3 = {id:uid('emp'), employee_no:'10003', name:'박OO', department:'관리팀', phone_number:'01011112222', shift_type:'주간 정취', employment_status:'재직', hire_date:'', resign_date:'', created_at:nowIso(), updated_at:nowIso()};
  const edu = {id:uid('edu'), title:'2026년 1분기 산업안전보건교육', education_type:'산업안전보건교육', year:'2026', period:'분기', period_detail:'1분기', summary:'- 산업재해 예방 기본수칙\n- 보호구 착용 기준\n- 지게차 및 중량물 취급 시 주의사항\n- 비상상황 보고 및 대피 절차', consent_text:DEFAULT_CONSENT, status:'진행', created_at:nowIso(), updated_at:nowIso()};
  const s1 = {id:uid('ses'), education_id:edu.id, session_no:'1차', session_name:'1반교육', education_date:todayDate(), start_time:'10:00', end_time:'11:00', location:'본관 교육장', target_shift:'1반', status:'서명가능', created_at:nowIso(), updated_at:nowIso()};
  const s2 = {id:uid('ses'), education_id:edu.id, session_no:'2차', session_name:'2반교육', education_date:todayDate(), start_time:'20:00', end_time:'21:00', location:'본관 교육장', target_shift:'2반', status:'서명가능', created_at:nowIso(), updated_at:nowIso()};
  state.employees.push(e1,e2,e3); state.educations.push(edu); state.sessions.push(s1,s2);
  state.targets.push({id:uid('tar'), education_id:edu.id, session_id:s1.id, employee_id:e1.id, target_status:'대상', created_at:nowIso()},{id:uid('tar'), education_id:edu.id, session_id:s2.id, employee_id:e2.id, target_status:'대상', created_at:nowIso()},{id:uid('tar'), education_id:edu.id, session_id:s1.id, employee_id:e3.id, target_status:'대상', created_at:nowIso()});
  saveState();
}

function boot(){
  migrateWorkTypeLabels();
  migrateTargetsToSessionLevel();
  initTabs(); initNav(); initLogins(); initEmployeeActions(); initEducationActions(); updateEducationEditBanner(); initSessionActions(); initTargetActions(); initStatusActions(); initSignatureActions(); initReset(); initDemoDataIfEmpty(); showLogin();
}
boot();
