(function(){
  function g(id){return document.getElementById(id)}
  function val(id){var e=g(id);return e?String(e.value||'').trim():''}
  function ph(v){return String(v||'').replace(/[^0-9]/g,'')}
  async function post(url,body,ms){var c=new AbortController();var t=setTimeout(function(){c.abort()},ms||8000);try{return await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal})}finally{clearTimeout(t)}}
  async function run(ev){
    var b=g('employeeLoginBtn');
    if(!b)return;
    ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    var old=b.textContent;b.disabled=true;b.textContent='인증코드 발급 중...';
    try{
      var name=val('empLoginName'), no=val('empLoginNo'), mobile=ph(val('empLoginPhone'));
      if(!name||!no||!mobile)throw Error('이름, 사번, 휴대폰 번호를 모두 입력해 주세요.');
      var res=await post('/api/octomo-start',{name:name,employeeNo:no,phone:mobile},8000);
      var data=await res.json().catch(function(){return{}});
      if(!res.ok)throw Error(data.error||'본인인증 시작 실패');
      window.__octomoLast=data;
      document.dispatchEvent(new CustomEvent('octomo-ready',{detail:data}));
      if(typeof octomoState!=='undefined')octomoState=data;
      if(typeof showOctomoBox==='function')showOctomoBox(data);
      else render(data);
    }catch(e){alert((e.name==='AbortError')?'인증 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.':(e.message||e));}
    finally{b.disabled=false;b.textContent=old;}
  }
  function render(data){
    var box=g('octomoVerifyBox');if(!box){box=document.createElement('div');box.id='octomoVerifyBox';var btn=g('employeeLoginBtn');btn.parentNode.insertBefore(box,btn.nextSibling)}
    var href='sms:'+String(data.receiverNumber||'').replace(/[^0-9]/g,'')+'?&body='+encodeURIComponent(data.code||'');
    box.style.display='block';box.style.marginTop='16px';box.style.padding='16px';box.style.border='1px solid #d9dee8';box.style.borderRadius='16px';box.style.background='#fff';
    box.innerHTML='<b>휴대폰 본인인증</b><p style="margin:8px 0 10px;color:#334155">문자 앱에서 전송만 눌러주세요.</p><div style="display:grid;grid-template-columns:90px 1fr;gap:6px;margin:8px 0"><div>수신번호</div><div><b>'+data.receiverNumber+'</b></div><div>인증코드</div><div style="font-size:24px;font-weight:800;letter-spacing:2px">'+data.code+'</div></div><a id="octomoSmsLink" href="'+href+'">(모바일) 문자 앱 열기</a><button class="primary full" id="octomoCheckBtn" type="button">전송 후 인증 확인</button>';
  }
  window.addEventListener('click',function(ev){var t=ev.target;if(t&&t.closest&&t.closest('#employeeLoginBtn'))run(ev)},true);
})();
