(function(){
  'use strict';
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // selector -> mode. Long copy animates by word, short headings by letter.
  var targets = [
    ['.section__title', 'chars'],
    ['.card__title', 'words'],
    ['.card__text', 'words', true]
  ];

  function build(el, mode, soft){
    if(soft) el.classList.add('ta-soft');
    var text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    if(el.querySelector('.hw')){
      // pre-split title: each .hw span is one animated unit, layout stays intact
      var hws = [].slice.call(el.querySelectorAll('.hw'));
      hws.forEach(function(u, i){ u.classList.add('ta-unit'); u.style.setProperty('--i', i); });
      var st = Math.min(80, 1000 / hws.length);
      el.style.setProperty('--stagger', st.toFixed(1) + 'ms');
      el.__taDuration = hws.length * st + 1000;
      el.setAttribute('aria-label', text);
      el.classList.add('ta-ready');
      return;
    }
    el.textContent = '';
    var frag = document.createDocumentFragment();
    var words = text.split(' '), units = [], idx = 0;
    words.forEach(function(w, wi){
      var wordSpan = document.createElement('span');
      wordSpan.className = 'ta-word';
      wordSpan.setAttribute('aria-hidden', 'true');
      var parts = mode === 'chars' ? w.split('') : [w];
      parts.forEach(function(p){
        var u = document.createElement('span');
        u.className = 'ta-unit';
        u.style.setProperty('--i', idx++);
        u.textContent = p;
        wordSpan.appendChild(u);
        units.push(u);
      });
      frag.appendChild(wordSpan);
      if(wi < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    el.appendChild(frag);
    // total stagger capped so long paragraphs still finish in about a second
    var stagger = Math.min(mode === 'chars' ? 45 : 55, 1000 / Math.max(1, units.length));
    el.style.setProperty('--stagger', stagger.toFixed(1) + 'ms');
    el.__taDuration = units.length * stagger + 1000;
    el.classList.add('ta-ready');
  }

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add('ta-in');
      setTimeout(function(){ el.classList.add('ta-done'); }, el.__taDuration);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(function(t){
    document.querySelectorAll(t[0]).forEach(function(el){
      build(el, t[1], t[2]);
      io.observe(el);
    });
  });
})();
