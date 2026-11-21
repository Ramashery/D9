/* Ленивые видео: на первом экране грузится только hero (в разметке),
   остальные ~13 роликов получают src, когда секция подходит к экрану,
   и ставятся на паузу, когда уходят далеко (экономия CPU/батареи). */
(function(){
  var vids = [].slice.call(document.querySelectorAll('video[data-src]'));
  if(!vids.length) return;

  // Режим экономии трафика: не качаем фоновые ролики вообще
  var c = navigator.connection;
  if(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;

  function play(v){ var p = v.play(); if(p && p.catch) p.catch(function(){}); }

  function load(v){
    if(!v.dataset.src) return;
    v.src = v.dataset.src;
    v.removeAttribute('data-src');
    v.load();
    if(v.hasAttribute('data-autoplay')) play(v);
  }

  if(!('IntersectionObserver' in window)){ vids.forEach(load); return; }

  // 1) подгрузка заранее — за ~1.5 экрана до появления
  var loader = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting) return;
      loader.unobserve(en.target);
      (en.target.__videos || [en.target]).forEach(load);
    });
  }, { rootMargin: '150% 0px' });

  // 2) play/pause по видимости
  var player = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      var v = en.target;
      if(en.isIntersecting){ if(v.src) play(v); } else if(!v.paused){ v.pause(); }
    });
  }, { rootMargin: '25% 0px' });

  vids.forEach(function(v){
    var forId = v.getAttribute('data-lazy-for');
    if(forId){
      // оверлей-«takeover» фиксирован на экране: грузим по приближению его секции
      var sec = document.getElementById(forId);
      if(sec){ (sec.__videos = sec.__videos || []).push(v); loader.observe(sec); return; }
    }
    loader.observe(v);
    if(v.hasAttribute('data-autoplay')) player.observe(v);
  });
})();
