(function(){
  function isMobile(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'') || (window.matchMedia&&window.matchMedia('(pointer: coarse)').matches&&window.innerWidth<=900)}
  function styleLink(){var a=document.getElementById('octomoSmsLink');if(!a)return;a.textContent='(모바일) 문자 앱 열기';a.style.display='flex';a.style.alignItems='center';a.style.justifyContent='center';a.style.minHeight='50px';a.style.marginTop='14px';a.style.borderRadius='12px';a.style.background='#43cb3b';a.style.border='1px solid #43cb3b';a.style.color='#fff';a.style.textDecoration='none';a.style.fontWeight='900';a.style.boxShadow='0 8px 18px rgba(67,203,59,.22)';a.style.fontSize='15px'}
  function apply(){
    var box=document.getElementById('octomoVerifyBox');
    if(!box)return;
    styleLink();
    if(!isMobile()){
      var link=document.getElementById('octomoSmsLink');
      if(link)link.style.display='none';
    }
    var qrList=box.querySelectorAll('#octomoQr,.octomo-qr-card');
    for(var i=1;i<qrList.length;i++){
      if(qrList[i]&&qrList[i].parentNode)qrList[i].parentNode.removeChild(qrList[i]);
    }
  }
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',apply);
  setInterval(apply,1000);
})();
