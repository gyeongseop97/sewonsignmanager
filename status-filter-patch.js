// v1.7 patch: use one select as the output basis (전체 / 회차별) and keep legacy exportMode hidden.
(function(){
  function syncExportMode(){
    const sessionSelect = document.getElementById('statusSessionSelect');
    const exportMode = document.getElementById('exportMode');
    if(exportMode && sessionSelect){
      exportMode.value = sessionSelect.value ? 'session' : 'all';
    }
  }
  function normalizeStatusSessionSelect(){
    const select = document.getElementById('statusSessionSelect');
    if(!select) return;
    if(select.options.length){
      select.options[0].textContent = '전체';
    }
    syncExportMode();
  }
  function enhanceStatusControls(){
    const exportMode = document.getElementById('exportMode');
    if(exportMode){
      const wrap = exportMode.closest('div');
      if(wrap) wrap.classList.add('hidden');
    }
    const sessionSelect = document.getElementById('statusSessionSelect');
    if(sessionSelect){
      const label = sessionSelect.closest('div')?.querySelector('label');
      if(label) label.textContent = '출력 기준';
      sessionSelect.addEventListener('change', syncExportMode, true);
      const observer = new MutationObserver(normalizeStatusSessionSelect);
      observer.observe(sessionSelect, { childList:true });
      normalizeStatusSessionSelect();
    }
    ['exportExcelBtn','exportPdfBtn','exportPendingBtn'].forEach(id=>{
      document.getElementById(id)?.addEventListener('click', syncExportMode, true);
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>setTimeout(enhanceStatusControls, 0));
  } else {
    setTimeout(enhanceStatusControls, 0);
  }
})();
