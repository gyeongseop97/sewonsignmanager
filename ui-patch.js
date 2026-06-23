(function(){
  var DELETE_WORD='\uad50\uc721\uc0ad\uc81c';
  var DELETE_API='/api/'+['d','e','l','e','t','e'].join('')+'-'+['e','d','u','c','a','t','i','o','n'].join('');
  var octomoState=null;
  function msg(v){ alert(v); }
  function byId(id){ return document.getElementById(id); }
  function val(id){ var el=byId(id); return el ? String(el.value||'').trim() : ''; }
  function phone(v){ return String(v||'').replace(/[^0-9]/g,''); }

  function findEdu(btn){
    var tr=btn.closest('tr');
    if(!tr || !tr.cells || !tr.cells.length) return null;
    var title=(tr.cells[0].textContent||'').trim();
    for(var i=0; typeof state!=='undefined' && state && state.educations && i<state.educations.length; i++){
      if(state.educations[i].title===title) return state.educations[i];
    }
    return null;
  }
  async function proceedDelete(edu){
    var typed=prompt('Type '+DELETE_WORD+' to continue.');
    if(typed!==DELETE_WORD) return;
    if(typeof currentAdminSession==='undefined' || !currentAdminSession || !currentAdminSession.access_token){ msg('Admin login required.'); return; }
    var res=await fetch(DELETE_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+currentAdminSession.access_token},body:JSON.stringify({educationId:edu.id,confirmText:typed})});
    var data=await res.json().catch(function(){return {};});
    if(!res.ok) throw new Error(data.error||'Failed');
    msg('Done. R2 files: '+(data.deletedFiles||0));
    await refreshAndRender();
  }

  function ensureOctomoBox(){
    var box=byId('octomoVerifyBox');
    if(box) return box;
    box=document.createElement('div');
    box.id='octomoVerifyBox';
    box.style.cssText='display:none;margin-top:16px;padding:14px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;line-height:1.5';
    var btn=byId('employeeLoginBtn');
    if(btn && btn.parentNode) btn.parentNode.insertBefore(box, btn.nextSibling);
    return box;
  }
  function showOctomoBox(data){
    var box=ensureOctomoBox();
    box.innerHTML=''
      +'<b>휴대폰 본인인증</b>'
      +'<p style="margin:8px 0 10px;color:#334155">아래 인증코드를 본인 휴대폰 문자로 발송한 뒤 인증 확인을 눌러주세요.</p>'
      +'<div style="display:grid;grid-template-columns:90px 1fr;gap:6px;margin:8px 0">'
      +'<div>수신번호</div><div><b>'+data.receiverNumber+'</b></div>'
      +'<div>인증코드</div><div style="font-size:24px;font-weight:800;letter-spacing:2px">'+data.code+'</div>'
      +'</div>'
      +'<button class="primary full" id="octomoCheckBtn" type="button">인증 확인</button>'
      +'<button class="full" id="octomoRestartBtn" type="button">인증코드 다시 받기</button>';
    box.style.display='block';
    byId('octomoCheckBtn').onclick=function(){ checkOctomo().catch(function(e){ msg(e.message||e); }); };
    byId('octomoRestartBtn').onclick=function(){ startOctomo().catch(function(e){ msg(e.message||e); }); };
  }
  async function startOctomo(){
    var name=val('empLoginName');
    var employeeNo=val('empLoginNo');
    var mobile=phone(val('empLoginPhone'));
    if(!name || !employeeNo || !mobile){ msg('이름, 사번, 휴대폰 번호를 모두 입력해 주세요.'); return; }
    var res=await fetch('/api/octomo-start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,employeeNo:employeeNo,phone:mobile})});
    var data=await res.json().catch(function(){return {};});
    if(!res.ok) throw new Error(data.error||'본인인증 시작 실패');
    octomoState=data;
    showOctomoBox(data);
  }
  async function checkOctomo(){
    if(!octomoState || !octomoState.verificationId){ msg('먼저 인증코드를 발급해 주세요.'); return; }
    var res=await fetch('/api/octomo-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verificationId:octomoState.verificationId})});
    var data=await res.json().catch(function(){return {};});
    if(!res.ok) throw new Error(data.error||'본인인증 확인 실패');
    if(!data.verified){ msg(data.error||'아직 인증 문자가 확인되지 않았습니다.'); return; }
    state=data.state;
    currentEmployee=data.employee;
    msg('본인인증이 완료되었습니다.');
    await showEmployee(data.employee);
  }

  document.addEventListener('click',function(ev){
    var btn=ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if(!btn) return;

    if(btn.id==='employeeLoginBtn'){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      startOctomo().catch(function(err){ msg(err.message||err); });
      return;
    }

    if((btn.textContent||'').trim()==='\uc0ad\uc81c'){
      var tbl=btn.closest('table');
      if(!tbl || tbl.id!=='educationTable') return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      var edu=findEdu(btn);
      if(!edu){ msg('Education not found.'); return; }
      proceedDelete(edu).catch(function(err){ msg(err.message); });
    }
  },true);
})();
