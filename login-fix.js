(function(){
  function g(id){return document.getElementById(id)}
  function tab(id){document.querySelectorAll('[data-login-tab]').forEach(function(b){b.classList.toggle('active',b.dataset.loginTab===id)});document.querySelectorAll('.login-panel').forEach(function(p){p.classList.toggle('active',p.id===id)})}
  window.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('[data-login-tab]').forEach(function(b){b.addEventListener('click',function(){tab(b.dataset.loginTab)},true)});
    if(g('adminLoginBtn'))g('adminLoginBtn').addEventListener('click',function(){if(typeof authSignIn==='function'){document.dispatchEvent(new CustomEvent('sewonAdminLogin'))}},true);
    if(g('employeeLoginBtn'))g('employeeLoginBtn').addEventListener('click',function(){if(typeof normalizeText==='function'){document.dispatchEvent(new CustomEvent('sewonEmployeeLogin'))}},true);
  });
})();
