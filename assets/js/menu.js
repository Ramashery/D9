/* Меню: открытие/закрытие, фокус, Esc, запоминание языка. Без библиотек. */
(function(){
  var menu = document.getElementById('mnMenu');
  var openBtn = document.getElementById('mnOpen');
  var closeBtn = document.getElementById('mnClose');
  if(!menu || !openBtn || !closeBtn) return;
  var root = document.documentElement, last = null;

  function isOpen(){ return menu.classList.contains('is-open'); }
  function open(){
    last = document.activeElement;
    menu.classList.add('is-open'); root.classList.add('menu-open');
    openBtn.setAttribute('aria-expanded','true');
    setTimeout(function(){ closeBtn.focus({preventScroll:true}); }, 60);
  }
  function close(restoreFocus){
    menu.classList.remove('is-open'); root.classList.remove('menu-open');
    openBtn.setAttribute('aria-expanded','false');
    if(restoreFocus !== false) (last || openBtn).focus({preventScroll:true});
  }
  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', function(){ close(); });

  document.addEventListener('keydown', function(e){
    if(!isOpen()) return;
    if(e.key === 'Escape'){ close(); return; }
    if(e.key !== 'Tab') return;                       // не выпускаем фокус из меню
    var f = [].slice.call(menu.querySelectorAll('a[href],button')).filter(function(n){ return n.offsetParent !== null; });
    if(!f.length) return;
    var a = f[0], z = f[f.length-1];
    if(e.shiftKey && document.activeElement === a){ e.preventDefault(); z.focus(); }
    else if(!e.shiftKey && document.activeElement === z){ e.preventDefault(); a.focus(); }
  });

  // ссылка на текущую страницу / якорь — просто закрыть меню
  menu.addEventListener('click', function(e){
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    var lang = a.getAttribute('data-lang');
    if(lang){ try{ localStorage.setItem('lang', lang); }catch(_){} }
    if(a.pathname === location.pathname && a.origin === location.origin) close(false);
  });

  // возврат по «Назад» (bfcache) не должен показывать открытое меню
  window.addEventListener('pageshow', function(){ if(isOpen()) close(false); });
})();
