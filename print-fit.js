(function(){
  function fit(w){try{if(!w||!w.document||!w.document.head)return;var s=w.document.createElement('style');s.textContent='td{overflow:hidden!important}td img{display:block!important;width:100%!important;height:24px!important;max-height:24px!important;object-fit:contain!important;margin:0 auto!important}td:nth-child(6){padding:2px 4px!important;height:34px!important;max-height:34px!important;overflow:hidden!important}';w.document.head.appendChild(s)}catch(e){}}
  var old=window.open;
  window.open=function(){var w=old.apply(window,arguments);setTimeout(function(){fit(w)},80);setTimeout(function(){fit(w)},220);return w};
})();
