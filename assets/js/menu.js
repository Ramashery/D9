/* Меню: открытие/закрытие, фокус, Esc, запоминание языка. Без библиотек. */
(function(){
  var menu = document.getElementById('mnMenu');
  var openBtn = document.getElementById('mnOpen');
  var closeBtn = document.getElementById('mnClose');
  if(!menu || !openBtn || !closeBtn) return;
  var root = document.documentElement, last = null;

  // видео в углу панели: грузим только при первом открытии меню, на паузу — когда меню закрыто
  var vid = menu.querySelector('.mn-menu__video video');
  var conn = navigator.connection;
  var skipVideo = !vid || !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
  var calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var stopTimer = 0;
  function startVideo(){
    if(skipVideo) return;
    clearTimeout(stopTimer);
    if(!vid.dataset.ready){
      [].forEach.call(vid.querySelectorAll('source[data-src]'), function(s){ s.src = s.getAttribute('data-src'); s.removeAttribute('data-src'); });
      vid.dataset.ready = '1'; vid.load();
    }
    if(calm) return;                                   // при «уменьшить анимацию» — только первый кадр
    var p = vid.play(); if(p && p.catch) p.catch(function(){});
  }
  function stopVideo(){
    if(skipVideo) return;
    stopTimer = setTimeout(function(){ if(!isOpen()) vid.pause(); }, 1300);  // после того как панель уехала (закрытие 1.25s)
  }

  function isOpen(){ return menu.classList.contains('is-open'); }
  function open(){
    last = document.activeElement;
    menu.classList.add('is-open'); root.classList.add('menu-open');
    openBtn.setAttribute('aria-expanded','true');
    startVideo();
    setTimeout(function(){ closeBtn.focus({preventScroll:true}); }, 60);
  }
  function close(restoreFocus){
    menu.classList.remove('is-open'); root.classList.remove('menu-open');
    openBtn.setAttribute('aria-expanded','false');
    stopVideo();
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
