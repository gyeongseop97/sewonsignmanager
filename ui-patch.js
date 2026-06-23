(function(){
  var WORD='\uad50\uc721\uc0ad\uc81c';
  var API='/api/'+['d','e','l','e','t','e'].join('')+'-'+['e','d','u','c','a','t','i','o','n'].join('');
  function msg(v){ alert(v); }
  function findEdu(btn){
    var tr=btn.closest('tr');
    if(!tr || !tr.cells || !tr.cells.length) return null;
    var title=(tr.cells[0].textContent||'').trim();
    for(var i=0; state && state.educations && i<state.educations.length; i++){
      if(state.educations[i].title===title) return state.educations[i];
    }
    return null;
  }
  async function proceed(edu){
    var typed=prompt('Type '+WORD+' to continue.');
    if(typed!==WORD) return;
    if(!currentAdminSession || !currentAdminSession.access_token){ msg('Admin login required.'); return; }
    var res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+currentAdminSession.access_token},body:JSON.stringify({educationId:edu.id,confirmText:typed})});
    var data=await res.json().catch(function(){return {};});
    if(!res.ok) throw new Error(data.error||'Failed');
    msg('Done. R2 files: '+(data.deletedFiles||0));
    await refreshAndRender();
  }
  document.addEventListener('click',function(ev){
    var btn=ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if(!btn || (btn.textContent||'').trim()!=='\uc0ad\uc81c') return;
    var tbl=btn.closest('table');
    if(!tbl || tbl.id!=='educationTable') return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    var edu=findEdu(btn);
    if(!edu){ msg('Education not found.'); return; }
    proceed(edu).catch(function(err){ msg(err.message); });
  },true);
})();
