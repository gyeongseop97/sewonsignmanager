(async function(){
  try{
    var h='https://raw.githubusercontent.com/';
    var p='gyeongseop97/sewonsignmanager/494d503165374d896da2ed155476aadd8fa6b8b1/app.js';
    var res=await fetch(h+p,{cache:'no-store'});
    if(!res.ok) throw new Error('load failed');
    var code=await res.text();
    var s=document.createElement('script');
    s.textContent=code;
    document.head.appendChild(s);
  }catch(e){
    alert('초기화 실패: '+(e.message||e));
  }
})();
