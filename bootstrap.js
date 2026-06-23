(async function(){
  const B='75ba7842df61f6563d3089f82dbe10d183b11aa6';
  const U='https://api.github.com/repos/gyeongseop97/sewonsignmanager/git/blobs/'+B;
  function dec(x){const r=atob(String(x||'').replace(/\n/g,''));const b=new Uint8Array(r.length);for(let i=0;i<r.length;i++)b[i]=r.charCodeAt(i);return new TextDecoder().decode(b)}
  function js(x){const s=document.createElement('script');s.textContent=x;document.head.appendChild(s)}
  function fixTabs(){function tab(id){document.querySelectorAll('[data-login-tab]').forEach(b=>b.classList.toggle('active',b.dataset.loginTab===id));document.querySelectorAll('.login-panel').forEach(p=>p.classList.toggle('active',p.id===id))}document.querySelectorAll('[data-login-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.loginTab))}
  try{const r=await fetch(U);const d=await r.json();js(dec(d.content));setTimeout(fixTabs,600)}catch(e){alert('앱 초기화 실패: '+(e.message||e))}
})();
