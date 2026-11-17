  // ============================================================
  // Scroll progress engine — publishes a 0→1 CSS var per [data-progress]
  // element as it travels through the viewport. CSS reads it via
  // scale/translate for a continuous grow-in reveal. The page no longer
  // fires native 'scroll' events (see the heavy-scroll engine below),
  // so this just exposes an update function that engine calls every frame.
  // ============================================================
  window.__updateProgressVars = (function(){
    function clamp(v){ return Math.min(1, Math.max(0, v)); }

    function computeProgress(el, finishPct){
      var rect = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var finishY = (finishPct / 100) * vh; // element's top reaches this point → progress = 1
      return clamp((vh - rect.top) / (vh - finishY));
    }

    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-progress]'));

    var lastVals = [];
    return function update(){
      var vh = window.innerHeight, vals = new Array(nodes.length), i, el;
      for(i = 0; i < nodes.length; i++){            // phase 1: reads only
        el = nodes[i];
        var finishPct = parseFloat(el.dataset.progressFinish);
        if(isNaN(finishPct)) finishPct = 25;
        var rect = el.getBoundingClientRect();
        vals[i] = clamp((vh - rect.top) / (vh - (finishPct / 100) * vh)).toFixed(4);
      }
      for(i = 0; i < nodes.length; i++){            // phase 2: writes only, skip unchanged
        if(lastVals[i] === vals[i]) continue;
        lastVals[i] = vals[i];
        nodes[i].style.setProperty(nodes[i].dataset.progressVar || '--progress', vals[i]);
      }
    };
  })();

  // ============================================================
  // Services / Why-Romaha media alignment — computes static resting-position
  // offsets (desktop only) so:
  //   • accent-left's top sits a small gap below the label text
  //   • the square's center aligns with accent-left's bottom
  //   • accent-right's top aligns with the square's center
  // These are separate from the scroll-progress entrance animation;
  // both are combined in the CSS translate() for each element.
  // ============================================================
  (function(){
    var GAP = 20;        // px, gap between label text and accent-left
    var CARD_GAP = 28;   // px, gap between a shifted text column and the box below it

    function align(root){
      var label = root.querySelector('.dossier__label');
      var accL = root.querySelector('.media-accent--left');
      var accR = root.querySelector('.media-accent--right');
      var square = root.querySelector('.media-block');
      var card1 = root.querySelector('.ga-card1');
      var card3 = root.querySelector('.ga-card3');
      if(!label || !accL || !accR || !square) return;

      var isDesktop = window.matchMedia('(min-width: 861px)').matches;
      if(!isDesktop){
        accL.style.setProperty('--shift-left', '0px');
        accR.style.setProperty('--shift-right', '0px');
        square.style.setProperty('--shift-square', '0px');
        if(card1) card1.style.setProperty('--shift-card1', '0px');
        if(card3) card3.style.setProperty('--shift-card3', '0px');
        return;
      }

      // Reset before measuring so stale offsets don't skew the read.
      accL.style.setProperty('--shift-left', '0px');
      accR.style.setProperty('--shift-right', '0px');
      square.style.setProperty('--shift-square', '0px');
      if(card1) card1.style.setProperty('--shift-card1', '0px');
      if(card3) card3.style.setProperty('--shift-card3', '0px');

      // The entrance animation's own scale/translate (driven by
      // --progress-*) is still live at measurement time and shifts/shrinks
      // the boxes, which corrupts getBoundingClientRect(). Neutralize it
      // on all three elements for the duration of the read, then restore,
      // so we measure their true static (resting) layout position.
      var els = [accL, accR, square];
      var prevScale = els.map(function(el){ return el.style.scale; });
      var prevTranslate = els.map(function(el){ return el.style.translate; });
      els.forEach(function(el){
        el.style.setProperty('scale', '1');
        el.style.setProperty('translate', '0px 0px');
      });

      var labelBottom = label.getBoundingClientRect().bottom;
      var accLRect = accL.getBoundingClientRect();
      var shiftLeft = (labelBottom + GAP) - accLRect.top;

      var newAccLBottom = accLRect.bottom + shiftLeft;

      var sqRect = square.getBoundingClientRect();
      var shiftSquare = (newAccLBottom - sqRect.height / 2) - sqRect.top;

      var accRRect = accR.getBoundingClientRect();
      var shiftRight = newAccLBottom - accRRect.top;

      // "01" / "03" text columns: pull each down until its own bottom
      // sits CARD_GAP above the top edge of the box it now sits over
      // (the square's / accent-right's fully shifted, max-scale resting
      // position, i.e. the same targets just computed above) — never up
      // past its natural spot, so it can't ride up over the row above it.
      if(card1){
        var finalSquareTop = sqRect.top + shiftSquare;
        var card1Rect = card1.getBoundingClientRect();
        var shiftCard1 = Math.max(0, (finalSquareTop - CARD_GAP) - card1Rect.bottom);
        card1.style.setProperty('--shift-card1', shiftCard1 + 'px');
      }
      if(card3){
        var finalAccRTop = newAccLBottom;
        var card3Rect = card3.getBoundingClientRect();
        var shiftCard3 = Math.max(0, (finalAccRTop - CARD_GAP) - card3Rect.bottom);
        card3.style.setProperty('--shift-card3', shiftCard3 + 'px');
      }

      // The shifted composition can extend past the grid's own natural
      // (untransformed) bottom edge — translate repositions boxes
      // visually but never changes the container's layout height, so
      // without this the next section could sit underneath the shifted
      // accent-right block. Reserve that overflow as real margin.
      var naturalBottom = Math.max(accLRect.bottom, sqRect.bottom, accRRect.bottom);
      var visualBottom = Math.max(
        accLRect.bottom + shiftLeft,
        sqRect.bottom + shiftSquare,
        accRRect.bottom + shiftRight
      );
      var bottomOverflow = Math.max(0, visualBottom - naturalBottom);

      // Restore the entrance transform now that measuring is done.
      els.forEach(function(el, i){
        el.style.scale = prevScale[i];
        el.style.translate = prevTranslate[i];
      });

      accL.style.setProperty('--shift-left', shiftLeft + 'px');
      square.style.setProperty('--shift-square', shiftSquare + 'px');
      accR.style.setProperty('--shift-right', shiftRight + 'px');

      var dossier = root.querySelector('.dossier--services, .dossier--why, .dossier--process');
      if(dossier) dossier.style.setProperty('--comp-bottom-space', bottomOverflow + 'px');
    }

    function alignAll(){
      ['#services', '#why', '#process'].forEach(function(sel){
        var section = document.querySelector(sel);
        if(section) align(section);
      });
    }

    var resizeTimer;
    function scheduleAlign(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(alignAll, 120);
    }

    window.addEventListener('load', alignAll);
    window.addEventListener('resize', scheduleAlign);
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(alignAll); }
    document.addEventListener('DOMContentLoaded', alignAll);
  })();


  // Background video loop with fade
  (function () {
    var video = document.getElementById('bgVideo');
    var FADE_DURATION = 1.2;
    var PAUSE_DURATION = 1000;
    var fadeStarted = false;

    function playFromStart() {
      video.currentTime = 0;
      video.play();
      requestAnimationFrame(function () {
        video.classList.add('bg-video-active');
      });
    }

    video.addEventListener('loadeddata', function () {
      video.play();
      requestAnimationFrame(function () {
        video.classList.add('bg-video-active');
      });
    });

    video.addEventListener('timeupdate', function () {
      var timeLeft = video.duration - video.currentTime;
      if (timeLeft <= FADE_DURATION && timeLeft > 0 && !fadeStarted) {
        fadeStarted = true;
        video.classList.remove('bg-video-active');
      }
    });

    video.addEventListener('ended', function () {
      video.pause();
      video.classList.remove('bg-video-active');
      fadeStarted = false;
      setTimeout(function () {
        playFromStart();
      }, PAUSE_DURATION);
    });
  })();

  // ============================================================
  // HEAVY (inertial) SCROLL
  // Native scrolling is disabled (html/body overflow:hidden). Instead,
  // wheel/touch/key input moves a TARGET scroll value and #scroll-container
  // eases toward it every frame via translate3d — the technique used by
  // the "желаемый скролл" reference, tuned to the same weight as the
  // site-wide engine in main.js and the even-heavier profile scroller in
  // about.js: exponential easing normalized to elapsed time (dt), so it
  // feels the same on a 60Hz and a 120Hz screen, plus device-pixel
  // snapping so settled text doesn't shimmer. The same loop also drives
  // the per-media parallax (желаемый парралакс) and the entrance
  // scale-in (--progress-*), since those no longer get native scroll
  // events either.
  // ============================================================
  (function(){
    var scrollContainer = document.getElementById('scroll-container');
    if(!scrollContainer) return;

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var EASE_60 = reduceMotion ? 1 : 0.05; // share of the remaining distance covered per 60fps frame — lower = heavier/more viscous (about.js's own "viscous" profile scroller uses 0.04)
    var TOUCH_GAIN = 1.6;                  // finger px -> target px, same weight as about.js's viscous scroller
    var FLING_MS = 220, FLING_MIN = 0.1, FLING_MAX = 1300; // release velocity (px/ms) carries the target a little further

    var targetScrollY = 0;
    var currentScrollY = 0;
    var maxScroll = 0;
    var raf = null, last = 0;

    function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

    function calculateDimensions(){
      if(typeof updateRevealClearance === 'function') updateRevealClearance();
      var contentHeight = scrollContainer.scrollHeight;
      maxScroll = Math.max(0, contentHeight - window.innerHeight);
      targetScrollY = clamp(targetScrollY, 0, maxScroll);
      updateRevealLockStart();
      updateHeroLayout();
      updateSqLayout(true);
      sortGates();
      updateRevealTopOffset();
      cacheGeometry();
      if(typeof updateSq === 'function'){ updateSq(); kick(); }
    }

    // ---- Scroll-jacked video reveals (sections 01, 02, 03) ----
    // Each section with a .section-reveal box gets its own gate. Scrolling
    // down, the page travels to the gate, then further input opens the video
    // (grows from its top-right corner) and assembles the label letters
    // instead of moving the page; after full opening a short hold is
    // swallowed, then the page continues. Scrolling up reverses everything.
    // Reveals are processed in document order (down) / reverse order (up).
    var revealMQ = window.matchMedia('(max-width: 860px)');
    var revealDesktopMQ = window.matchMedia('(min-width: 861px)');
    var REVEAL_DISTANCE = 460; // was 1840 — 4x faster total: media window opening + text assembly
    var MOBILE_REVEAL_START_OFFSET = 80;
    var REVEAL_HOLD = 130; // was 520 — scaled down 4x together with REVEAL_DISTANCE
    var REVEAL_ARRIVE_TOL = 40;
    var REVEAL_TITLE_GAP = 28;
    var AW = 24, AH = 58, LIGHT_ON = 0.52, LIGHT_OFF = 0.44;

    function splitIntoChars(el){
      if(!el || el.__split) return;
      el.__split = true;
      var text = el.textContent;
      el.textContent = '';
      text.split(/(\s+)/).forEach(function(part){
        if(part === '') return;
        if(/^\s+$/.test(part)){ el.appendChild(document.createTextNode(part)); return; }
        var wordSpan = document.createElement('span');
        wordSpan.className = '-s-word';
        for(var i = 0; i < part.length; i++){
          var charSpan = document.createElement('span');
          charSpan.className = '-s-char';
          charSpan.textContent = part[i];
          charSpan.style.setProperty('--char-random', (Math.random() * 20 - 10).toFixed(3));
          wordSpan.appendChild(charSpan);
        }
        el.appendChild(wordSpan);
      });
    }

    var reveals = ['services', 'why', 'process'].map(function(id){
      var section = document.getElementById(id);
      var el = section ? section.querySelector('.section-reveal') : null;
      if(!el) return null;
      var r = {
        section: section, el: el,
        label: section.querySelector('.dossier__label'),
        dossier: section.querySelector('.dossier'),
        wrap: section.querySelector('.wrap'),
        title: section.querySelector('.section__title'),
        video: el.querySelector('video'),
        frame: el.querySelector('.section-reveal__frame'),
        progress: 0, display: 0, completed: false, lockStart: 0, hold: 0,
        chars: [], broken: false
      };
      if(r.label){
        splitIntoChars(r.label.querySelector('b'));
        splitIntoChars(r.label.querySelector('.dossier__label-text'));
        r.chars = Array.prototype.slice.call(r.label.querySelectorAll('.-s-char'));
      }
      r.canvas = document.createElement('canvas');
      r.canvas.width = AW; r.canvas.height = AH;
      r.ctx = r.canvas.getContext('2d', { willReadFrequently: true });
      if(r.video){
        r.video.addEventListener('error', function(){
          if(r.video.getAttribute('crossorigin') !== null){
            r.video.removeAttribute('crossorigin');
            r.video.setAttribute('src', r.video.getAttribute('src'));
            r.video.load();
            var pp = r.video.play(); if(pp && pp.catch) pp.catch(function(){});
            r.broken = true;
            r.section.classList.add('no-sample');
          }
        });
      }
      return r;
    }).filter(Boolean);


    // ---- Square video takeover gates (sections 01, 02, 03) ----
    // Same gate model as the reveals above. Scrolling down, the page travels
    // to the point where a section's square video reaches its max size (its
    // --progress-square hits 1), then the page is PINNED and input drives
    // three phases instead of moving the page:
    //   grow (SQ_GROW px)  ->  column 04 scrolls (computed px)  ->  shrink (SQ_SHRINK px)
    // After the shrink the video is the square again and the pin is released.
    // Scrolling up reverses everything. q.display (0..1) is the smoothed
    // position along the whole sequence; fa / fb are the phase boundaries.
    // Each section has its own overlay (.sq-takeover[data-sq-for]) with its
    // own copy of the video and its own column 04 text.
    var SQ_GROW = 700, SQ_SHRINK = 700;   // px of scroll input per phase
    var SQ_DIM = 0.55;                    // darkening of the fullscreen video
    var SQ_TEXT_VH = 2.4, SQ_TEXT_MIN = 1800;   // length of the pinned-text phase: max(1800px, 2.4 x viewport height)
    var sqList = [];
    [].slice.call(document.querySelectorAll('.sq-takeover[data-sq-for]')).forEach(function(el){
      var section = document.getElementById(el.getAttribute('data-sq-for'));
      var block = section ? section.querySelector('.media-block') : null;
      var vid = el.querySelector('video'), col = el.querySelector('.sq-col');
      if(!block || !vid || !col) return;
      var q = {
        block: block, el: el, vid: vid, dim: el.querySelector('.sq-takeover__dim'), col: col,
        progress: 0, display: 0, completed: false, hold: 0,
        holdMax: 0, dist: SQ_GROW + 1500 + SQ_SHRINK, waitDisplay: true,
        fa: 0.25, fb: 0.75, colH: 600,
        lockStart: 1e9, x: 0, y: 0, w: 0, h: 0, on: false
      };
      // pinned text: every piece of column 04 is its own block (title parts,
      // lead, rule, list items) laid out on the grid and driven by the scroll
      var wrapB = function(el){ el.classList.add('sq-b'); return { el: el, last: '' }; };
      var numEl = col.querySelector('.sq-col__num');
      q.num   = numEl ? wrapB(numEl) : null;
      q.parts = [].slice.call(col.querySelectorAll('.sq-t')).map(wrapB);
      var leadEl = col.querySelector('.sq-col__text');
      q.lead  = leadEl ? wrapB(leadEl) : null;
      q.rule  = col.querySelector('.sq-rule');
      q.ruleLast = -1;
      q.items = [].slice.call(col.querySelectorAll('.sq-it')).map(wrapB);
      sqList.push(q);
    });


    // ---- Hero gate: the hero is PINNED at the top. The title is revealed by the
    // intro animation on open (see the HERO INTRO script); scroll input then
    // blurs everything out and the hero is released. Same gate model as the square
    // takeovers: the page doesn't move while heroG.progress goes 0 -> 1.
    var HERO_VH = 1.8, HERO_MIN = 1500;      // pinned length: max(1500px, 1.8 x viewport height)
    var heroG = { progress: 0, display: 0, completed: false, hold: 0, holdMax: 0,
                  dist: HERO_MIN, waitDisplay: true, lockStart: 0 };
    var heroEl = document.querySelector('.hero');
    var heroWords = [].slice.call(document.querySelectorAll('.hero__title .hw')).map(function(el){ return { el: el, last: '' }; });
    var heroDivider = heroEl ? { el: heroEl.querySelector('.hero__divider'), last: '' } : null;
    var heroRow = heroEl ? { el: heroEl.querySelector('.hero__footer-row'), last: '' } : null;
    if(heroEl && heroWords.length) heroEl.classList.add('hero-gated');
    function updateHeroLayout(){ heroG.dist = Math.max(HERO_MIN, Math.round(HERO_VH * window.innerHeight)); }
    function heroPut(blk, a, out, scaleX){
      if(!blk || !blk.el) return;
      var p = smooth01(a), op = p * (1 - out);
      var bl = reduceMotion ? 0 : (1 - p) * 12 + out * 10;
      var ty = reduceMotion ? 0 : (1 - p) * 26 - out * 14;
      var key = op.toFixed(3) + '|' + bl.toFixed(1) + '|' + ty.toFixed(1);
      if(key === blk.last) return;
      blk.last = key;
      blk.el.style.opacity = op.toFixed(3);
      blk.el.style.filter = bl > 0.05 ? 'blur(' + bl.toFixed(1) + 'px)' : 'none';
      blk.el.style.transform = scaleX ? 'scaleX(' + p.toFixed(3) + ')' : 'translate3d(0,' + ty.toFixed(1) + 'px,0)';
    }
    function updateHero(){
      if(!heroWords.length) return;
      var t = heroG.display, i, n = heroWords.length;
      var out = smooth01((t - 0.04) / 0.80);                 // scroll gradually blurs everything out
      for(i = 0; i < n; i++) heroPut(heroWords[i], 1, out);  // words are already in place
      heroPut(heroDivider, 1, out, true);
      heroPut(heroRow, 1, out);
    }

    var gates = reveals.concat(sqList);
    function sortGates(){ gates.sort(function(a, b){ return a.lockStart - b.lockStart; }); }
    function sqEngaged(q){ return (q.progress > 0 && q.progress < 1) || (q.display > 0.0005 && q.display < 0.9995); }

    // Static (resting) geometry of each square inside #scroll-container and of
    // its column 04. offset* ignore the entrance scale/translate, so the
    // block's --shift-square is added by hand; at progress 1 its scale is 1.
    // full === false skips the (costlier) per-word measuring.
    function updateSqLayout(full){
      var vh = window.innerHeight;
      sqList.forEach(function(q){
        if(sqEngaged(q)) return;                // never move a gate mid-takeover
        var x = 0, y = 0, n = q.block;
        while(n && n !== scrollContainer){ x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
        var shift = parseFloat(q.block.style.getPropertyValue('--shift-square')) || 0;
        var finish = parseFloat(q.block.dataset.progressFinish);
        if(isNaN(finish)) finish = 25;
        q.x = x; q.y = y + shift;
        q.w = q.block.offsetWidth; q.h = q.block.offsetHeight;
        q.lockStart = q.y - (finish / 100) * vh;

        if(full !== false){
          q.colH = q.col.offsetHeight;
        }
        var travel = Math.max(SQ_TEXT_MIN, Math.round(SQ_TEXT_VH * vh));   // pinned text phase, 1:1 with scroll input
        q.dist = SQ_GROW + travel + SQ_SHRINK;
        q.fa = SQ_GROW / q.dist;
        q.fb = (SQ_GROW + travel) / q.dist;
      });
    }

    function revealOn(){ return reveals.length > 0 && (revealMQ.matches || revealDesktopMQ.matches); }

    // Adaptive label colour: letters over light parts of the video turn dark.
    function updateAdaptive(r){
      if(!r.video || !r.chars.length) return;
      var p = r.display, i;
      var active = revealOn() && p > 0.01 && r.video.readyState >= 2 && !r.broken;
      if(!active){
        for(i = 0; i < r.chars.length; i++){
          if(r.chars[i].__light){ r.chars[i].__light = false; r.chars[i].classList.remove('on-light'); }
        }
        return;
      }
      var vw = r.video.videoWidth, vh = r.video.videoHeight;
      if(!vw || !vh) return;
      var boxAspect = AW / AH, vidAspect = vw / vh, sx = 0, sy = 0, sw = vw, sh = vh;
      if(vidAspect > boxAspect){ sw = vh * boxAspect; sx = (vw - sw) / 2; }
      else { sh = vw / boxAspect; sy = (vh - sh) / 2; }
      var data;
      try{
        r.ctx.drawImage(r.video, sx, sy, sw, sh, 0, 0, AW, AH);
        data = r.ctx.getImageData(0, 0, AW, AH).data;
      }catch(err){
        r.broken = true; r.section.classList.add('no-sample'); return;
      }
      var b = r.el.getBoundingClientRect();
      var fr = r.frame.getBoundingClientRect();
      var x0 = b.right - b.width * p, y0 = b.top;
      var visH = b.height * p;
      var n = r.chars.length, rects = new Array(n), j;
      for(j = 0; j < n; j++) rects[j] = r.chars[j].getBoundingClientRect();   // all reads first
      var changes = [];
      for(j = 0; j < n; j++){
        var el = r.chars[j], rc = rects[j];
        var cx = (rc.left + rc.right) / 2, cy = (rc.top + rc.bottom) / 2;
        var light = false;
        if(cx >= x0 && cx <= b.right && cy >= y0 && cy <= y0 + visH && fr.width > 0 && fr.height > 0){
          var u = Math.min(AW - 1, Math.max(0, Math.floor((cx - fr.left) / fr.width * AW)));
          var v = Math.min(AH - 1, Math.max(0, Math.floor((cy - fr.top) / fr.height * AH)));
          var sum = 0, cnt = 0;
          for(var dy = -1; dy <= 1; dy++){
            for(var dx = -1; dx <= 1; dx++){
              var uu = u + dx, vv = v + dy;
              if(uu < 0 || vv < 0 || uu >= AW || vv >= AH) continue;
              var k = (vv * AW + uu) * 4;
              sum += (0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]) / 255;
              cnt++;
            }
          }
          var lum = sum / cnt;
          light = el.__light ? lum > LIGHT_OFF : lum > LIGHT_ON;
        }
        if(el.__light !== light) changes.push(el, light);
      }
      for(j = 0; j < changes.length; j += 2){                                  // then all writes
        changes[j].__light = changes[j + 1];
        changes[j].classList.toggle('on-light', changes[j + 1]);
      }
    }
    var adaptTick = 0, touchingNow = false;
    window.addEventListener('touchstart', function(){ touchingNow = true; }, { passive: true });
    window.addEventListener('touchend', function(){ touchingNow = false; }, { passive: true });
    window.addEventListener('touchcancel', function(){ touchingNow = false; }, { passive: true });
    setInterval(function(){
      // one reveal per tick (staggered) and only if its video box is on screen
      adaptTick = (adaptTick + 1) % reveals.length;
      var r = reveals[adaptTick];
      var b = r.el.getBoundingClientRect();
      var onScreen = b.bottom > 0 && b.top < window.innerHeight;
      if(!onScreen){ if(r.__wasOn){ r.__wasOn = false; updateAdaptiveOff(r); } return; }
      r.__wasOn = true;
      // skip while the page is in fast motion: keeps the scroll frames clean
      if(Math.abs(targetScrollY - currentScrollY) > 1.5 || touchingNow) return;
      updateAdaptive(r);
    }, 90);
    function updateAdaptiveOff(r){
      for(var i = 0; i < r.chars.length; i++){
        if(r.chars[i].__light){ r.chars[i].__light = false; r.chars[i].classList.remove('on-light'); }
      }
    }

    function updateRevealLockStart(){
      reveals.forEach(function(r){
        if(revealDesktopMQ.matches && r.dossier){
          var dRect = r.dossier.getBoundingClientRect();
          r.lockStart = dRect.top + currentScrollY - window.innerHeight * 0.5;
        } else if(r.label){
          var rect = r.label.getBoundingClientRect();
          r.lockStart = rect.bottom + currentScrollY - window.innerHeight + MOBILE_REVEAL_START_OFFSET;
        } else {
          r.lockStart = r.section.offsetTop;
        }
      });
    }

    // Keeps the tall reveal video (top-right, absolutely positioned) from
    // running over the accent videos below it on tablet-width portrait screens.
    var REVEAL_CLEAR_GAP = 24;
    function updateRevealClearance(){
      if(typeof reveals === 'undefined') return;
      reveals.forEach(function(r){
        if(!r || !r.dossier) return;
        if(!revealMQ.matches){ r.dossier.style.removeProperty('--reveal-clear'); return; }
        var accR = r.dossier.querySelector('.media-accent--right');
        if(!accR) return;
        r.dossier.style.setProperty('--reveal-clear', '0px');   // measure the un-pushed layout
        // offsetTop / offsetHeight ignore the scale/translate entrance animations
        var revealBottom = r.el.offsetTop + r.el.offsetHeight;
        var clear = Math.max(0, revealBottom + REVEAL_CLEAR_GAP - accR.offsetTop);
        r.dossier.style.setProperty('--reveal-clear', Math.ceil(clear) + 'px');
      });
    }

    function updateRevealTopOffset(){
      reveals.forEach(function(r){
        if(!revealDesktopMQ.matches || !r.wrap || !r.title){
          r.el.style.removeProperty('--reveal-top-offset');
          return;
        }
        var titleBottom = r.title.getBoundingClientRect().bottom;
        var wrapTop = r.wrap.getBoundingClientRect().top;
        r.el.style.setProperty('--reveal-top-offset', ((titleBottom - wrapTop) + REVEAL_TITLE_GAP).toFixed(1) + 'px');
      });
    }

    function setRevealProgress(r, p){ r.progress = clamp(p, 0, 1); kick(); }
    function holdOf(r){ return r.holdMax != null ? r.holdMax : REVEAL_HOLD; }
    function distOf(r){ return r.dist || REVEAL_DISTANCE; }

    function stepDown(r, delta){
      if(delta <= 0) return delta;
      var H = holdOf(r), D = distOf(r);
      if(!r.completed){
        var toGate = r.lockStart - targetScrollY;
        if(toGate > 0){
          var move = Math.min(delta, toGate);
          targetScrollY = clamp(targetScrollY + move, 0, maxScroll);
          delta -= move;
        }
        if(delta > 0 && targetScrollY >= r.lockStart - 0.5 && currentScrollY < r.lockStart - REVEAL_ARRIVE_TOL){
          delta = 0;
        }
        if(delta > 0 && targetScrollY >= r.lockStart - 0.5){
          var remaining = (1 - r.progress) * D;
          var consume = Math.min(delta, remaining);
          setRevealProgress(r, r.progress + consume / D);
          delta -= consume;
          if(r.progress >= 1) r.completed = true;
        }
      }
      // fullscreen takeover: stay pinned until the video has visually finished growing
      if(delta > 0 && r.completed && r.waitDisplay && r.display < 0.98 && targetScrollY <= r.lockStart + 0.5){
        delta = 0;
      }
      if(delta > 0 && r.completed && r.hold < H && targetScrollY <= r.lockStart + 0.5){
        if(r.display < 0.95){ delta = 0; }
      }
      if(delta > 0 && r.completed && r.hold < H && targetScrollY <= r.lockStart + 0.5){
        var holdTake = Math.min(delta, H - r.hold);
        r.hold += holdTake;
        delta -= holdTake;
        if(r.hold >= H) delta = 0;
      }
      return delta;
    }

    function stepUp(r, delta){
      if(delta >= 0) return delta;
      var D = distOf(r);
      if((r.progress > 0 || r.hold > 0) && targetScrollY > r.lockStart + 0.5){
        var moveUp = Math.min(-delta, targetScrollY - r.lockStart);
        targetScrollY = clamp(targetScrollY - moveUp, 0, maxScroll);
        delta += moveUp;
      }
      if((r.hold > 0 || r.progress > 0) && targetScrollY <= r.lockStart + 0.5 && currentScrollY > r.lockStart + REVEAL_ARRIVE_TOL){
        delta = 0;
      }
      if(delta < 0 && r.hold > 0 && targetScrollY <= r.lockStart + 0.5){
        var holdBack = Math.min(-delta, r.hold);
        r.hold -= holdBack;
        delta += holdBack;
      }
      if(delta < 0 && r.progress > 0 && targetScrollY <= r.lockStart + 0.5){
        var consumeUp = Math.min(-delta, r.progress * D);
        setRevealProgress(r, r.progress - consumeUp / D);
        delta += consumeUp;
        if(r.progress < 1){ r.completed = false; r.hold = 0; }
      }
      if(delta < 0 && r.progress <= 0 && r.display > 0.02 && targetScrollY <= r.lockStart + 0.5){
        delta = 0;
      }
      return delta;
    }

    function handleScrollInput(delta){
      if(delta === 0 || window.__heroIntro) return;      // intro in progress: input only skips it
      var i;
      if(revealOn()){
        if(!sqList.some(sqEngaged)){ updateSqLayout(false); sortGates(); }
        if(delta > 0){ for(i = 0; i < gates.length; i++) delta = stepDown(gates[i], delta); }
        else { for(i = gates.length - 1; i >= 0; i--) delta = stepUp(gates[i], delta); }
      }
      targetScrollY = clamp(targetScrollY + delta, 0, maxScroll);
    }

    // After a jump (anchor link / Home / End): gates above the new position
    // count as already opened, gates below as closed.
    function syncRevealsToTarget(){
      updateSqLayout(true);
      sortGates();
      gates.forEach(function(r){
        if(r.lockStart < targetScrollY - 1){ r.progress = 1; r.completed = true; r.hold = holdOf(r); }
        else { r.progress = 0; r.completed = false; r.hold = 0; }
      });
      kick();
    }

    // ---- Pull-down-to-reload, at the very top, on touch ----
    // Real browser pull-to-refresh can't fire here: it needs the document
    // itself to be the scroller, and html/body are overflow:hidden so this
    // engine can drive #scroll-container instead. So the same gesture is
    // rebuilt by hand: while already at the top, a downward drag rubber-
    // bands the whole container a little (visual confirmation the pull
    // registered) and past a threshold it reloads the page — release
    // before the threshold and it springs back with no reload.
    var PULL_THRESHOLD = 76;  // px of actual finger travel to trigger reload
    var PULL_MAX = 130;       // px, visual cap on the rubber-band offset
    var PULL_RESISTANCE = 0.5;
    var pullOffset = 0, pullOffsetTarget = 0;
    var pulling = false, pullStartY = 0, reloadTriggered = false;

    // ---- Media parallax (mirrors the "желаемый парралакс" reference) ----
    var mediaNodes = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]')).map(function(el){
      return { el: el, frame: el.querySelector('.media-window__frame') };
    }).filter(function(m){ return m.frame; });

    var OVERFLOW_FRACTION = 0.2; // matches the 10%/10% top/bottom in CSS

    var appliedY = 0;
    function cacheGeometry(){
      mediaNodes.forEach(function(m){
        var r = m.el.getBoundingClientRect();
        m.top = r.top + appliedY; m.h = r.height; m.last = null;
      });
      reveals.forEach(function(rv){
        var r = rv.el.getBoundingClientRect();
        rv.top = r.top + appliedY; rv.h = r.height; rv.last = null;
      });
    }
    function parallaxFor(n, y, vh){
      var t = n.top - y;                                   // current viewport top, no layout read
      if(t > vh + 60 || t + n.h < -60) return;             // off screen: skip
      var tt = 2 * ((t + n.h * 0.5) / vh - 0.5);
      var off = Math.round(-0.4 * OVERFLOW_FRACTION * n.h * tt * 10) / 10;
      if(off === n.last) return;
      n.last = off;
      n.frame.style.transform = 'translate3d(0,' + off + 'px,0)';
    }
    function updateMediaParallax(y){
      var vh = window.innerHeight, i;
      for(i = 0; i < reveals.length; i++) if(reveals[i].frame) parallaxFor(reveals[i], y, vh);
      for(i = 0; i < mediaNodes.length; i++) parallaxFor(mediaNodes[i], y, vh);
    }

    // Drives the fixed takeover layer from sq.display (position along the
    // whole sequence). e = how "full" the video is (0 = the square's own box,
    // 1 = whole viewport), t = progress of column 04's scroll. No layout reads:
    // the square's resting box and the word positions are cached in sq.*.
    function smooth01(x){ x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }

    function updateSq(){ sqList.forEach(updateSqOne); }

    function updateSqOne(sq){
      var d = sq.display;
      var on = d > 0.0005 && d < 0.9995;   // at 0 and 1 the real square is back in place

      if(on !== sq.on){
        sq.on = on;
        sq.el.classList.toggle('is-on', on);
        sq.block.style.visibility = on ? 'hidden' : '';   // original square steps aside
        if(on){
          var src = sq.block.querySelector('video');
          try{
            if(src && sq.vid.readyState >= 1 && Math.abs(sq.vid.currentTime - src.currentTime) > 0.15) sq.vid.currentTime = src.currentTime;
          }catch(err){}
          var pp = sq.vid.play(); if(pp && pp.catch) pp.catch(function(){});
        } else {
          sq.vid.pause();
          sq.col.style.visibility = 'hidden';
        }
      }
      if(!on) return;

      var vw = window.innerWidth, vh = window.innerHeight;
      var A = sq.fa, B = sq.fb;
      var e = smooth01(d / A) * (1 - smooth01((d - B) / (1 - B)));
      var t = Math.min(1, Math.max(0, (d - A) / (B - A)));

      var by = sq.y - appliedY;
      var st = sq.el.style;
      st.left   = (sq.x * (1 - e)).toFixed(2) + 'px';
      st.top    = (by * (1 - e)).toFixed(2) + 'px';
      st.width  = (sq.w + (vw - sq.w) * e).toFixed(2) + 'px';
      st.height = (sq.h + (vh - sq.h) * e).toFixed(2) + 'px';

      // match the square's own parallax crop (its frame is 120% tall) and relax it to plain cover
      var pn = null, j;
      for(j = 0; j < mediaNodes.length; j++){ if(mediaNodes[j].el === sq.block){ pn = mediaNodes[j]; break; } }
      var k2 = 1 - e, par = (pn && pn.last) || 0;
      sq.vid.style.top = (-10 * k2).toFixed(2) + '%';
      sq.vid.style.height = (100 + 20 * k2).toFixed(2) + '%';
      sq.vid.style.transform = 'translate3d(0,' + (par * k2).toFixed(2) + 'px,0)';
      if(sq.dim) sq.dim.style.opacity = (SQ_DIM * e).toFixed(3);

      // column 04: PINNED text laid out on the hero-style grid. The scroll
      // drives a blur choreography (t = 0..1 over the whole text phase):
      //   .02-.24 number + title parts blur in, one level after another
      //   .20-.32 lead      .30-.42 rule is drawn
      //   .38-.84 the four points land one by one (stair-step); the newest
      //           is sharp, earlier ones soften (depth of field)
      //   .86-.94 everything comes into focus    .96-1 blur out
      var colOn = t > 0 && t < 1;
      sq.col.style.visibility = colOn ? 'visible' : 'hidden';
      if(!colOn) return;

      var availH = vh - 96 - 32;
      var cy = Math.max(96, (vh - sq.colH) / 2);
      if(sq.colH > availH){                       // tall layout on small screens: drift it up a little
        cy = 96 - (sq.colH - availH) * smooth01((t - 0.3) / 0.5);
      }
      sq.col.style.transform = 'translate3d(0,' + cy.toFixed(1) + 'px,0)';

      var out = smooth01((t - 0.96) / 0.04);                 // exit
      var fin = smooth01((t - 0.86) / 0.08);                 // all sharp
      var dim = 1 - 0.55 * smooth01((t - 0.38) / 0.12) * (1 - fin);   // head softens once the points start
      sq.col.style.opacity = (1 - out).toFixed(3);

      function put(blk, appear, soften){
        if(!blk) return;
        var a = smooth01(appear), m = 1 - soften;               // a: presence, m: focus 0..1
        var op = a * (0.3 + 0.7 * m);
        var bl = reduceMotion ? 0 : (1 - a) * 12 + soften * 4 + out * 10;
        var ty = reduceMotion ? 0 : (1 - a) * 26 - out * 14;
        var key = op.toFixed(3) + '|' + bl.toFixed(1) + '|' + ty.toFixed(1);
        if(key === blk.last) return;
        blk.last = key;
        blk.el.style.opacity = op.toFixed(3);
        blk.el.style.filter = bl > 0.05 ? 'blur(' + bl.toFixed(1) + 'px)' : 'none';
        blk.el.style.transform = 'translate3d(0,' + ty.toFixed(1) + 'px,0)';
      }
      var softHead = (1 - dim) / 0.55 * 0.5;                  // 0..0.5 -> mild blur on head blocks
      put(sq.num, (t - 0.02) / 0.10, softHead * 0.5);
      for(j = 0; j < sq.parts.length; j++) put(sq.parts[j], (t - (0.02 + j * 0.06)) / 0.10, softHead);
      put(sq.lead, (t - 0.20) / 0.12, softHead);
      if(sq.rule){
        var rl = Math.round(smooth01((t - 0.30) / 0.12) * 1000) / 1000;
        if(rl !== sq.ruleLast){ sq.ruleLast = rl; sq.rule.style.transform = 'scaleX(' + rl + ')'; }
      }
      var n = sq.items.length;
      for(j = 0; j < n; j++){
        var st = 0.38 + j * 0.12;
        var next = (j < n - 1) ? smooth01((t - (st + 0.12)) / 0.08) : 0;   // "past" once the next point appears
        put(sq.items[j], (t - st) / 0.10, next * (1 - fin));
      }
    }

    function kick(){ if(raf === null){ last = 0; raf = requestAnimationFrame(animate); } }

    function animate(now){
      var dt = last ? Math.min(50, now - last) : 16.667;
      last = now;
      var k = 1 - Math.pow(1 - EASE_60, dt / 16.667);

      var diff = targetScrollY - currentScrollY;
      if(Math.abs(diff) < 0.1) currentScrollY = targetScrollY; else currentScrollY += diff * k;

      sqList.forEach(function(q){
        var sd = q.progress - q.display;
        if(Math.abs(sd) < 0.0015) q.display = q.progress; else q.display += sd * (k * 1.2);
      });

      var hd = heroG.progress - heroG.display;
      if(Math.abs(hd) < 0.0015) heroG.display = heroG.progress; else heroG.display += hd * (k * 1.2);

      var pullDiff = pullOffsetTarget - pullOffset;
      if(Math.abs(pullDiff) < 0.1) pullOffset = pullOffsetTarget; else pullOffset += pullDiff * k;

      reveals.forEach(function(r){
        var rd = r.progress - r.display;
        if(Math.abs(rd) < 0.0015) r.display = r.progress; else r.display += rd * (k * 1.2);
        if(r.display !== r.written){
          r.written = r.display;
          var v = r.display.toFixed(4);
          r.el.style.setProperty('--reveal-progress', v);
          r.section.style.setProperty('--reveal-progress', v);
        }
      });

      var dpr = window.devicePixelRatio || 1;
      var y = Math.round((currentScrollY - pullOffset) * dpr) / dpr;
      scrollContainer.style.transform = 'translate3d(0,' + (-y).toFixed(2) + 'px,0)';

      if(window.__updateProgressVars) window.__updateProgressVars();
      appliedY = y;
      updateMediaParallax(y);
      updateSq();
      updateHero();

      if(heroG.display !== heroG.progress || currentScrollY !== targetScrollY || pullOffset !== pullOffsetTarget || reveals.some(function(r){ return r.display !== r.progress; }) || sqList.some(function(q){ return q.display !== q.progress; })){
        raf = requestAnimationFrame(animate);
      } else {
        raf = null; last = 0;
      }
    }

    function contactOpen(){ return document.documentElement.classList.contains('contact-open'); }
    window.addEventListener('wheel', function(e){
      if(contactOpen()) return;          // let the form scroll natively
      e.preventDefault();
      handleScrollInput(e.deltaY);
      kick();
    }, { passive: false });

    var touchY = 0, touchVelocity = 0, touchLastT = 0;
    window.addEventListener('touchstart', function(e){
      if(e.touches.length !== 1 || contactOpen()) return;
      touchY = e.touches[0].clientY;
      pullStartY = touchY;
      pulling = currentScrollY <= 0.5 && heroG.progress <= 0.001;
      reloadTriggered = false;
      touchVelocity = 0;
      touchLastT = performance.now();
    }, { passive: true });

    window.addEventListener('touchmove', function(e){
      if(!e.touches.length || contactOpen()) return;
      var y = e.touches[0].clientY;

      if(pulling){
        if(reloadTriggered){ if(e.cancelable) e.preventDefault(); return; }
        var raw = y - pullStartY; // positive = finger dragged down
        if(raw <= 0){
          pulling = false; // finger reversed upward: hand off to normal scrolling below
        } else {
          if(e.cancelable) e.preventDefault();
          pullOffsetTarget = Math.min(PULL_MAX, raw * PULL_RESISTANCE);
          kick();
          if(raw >= PULL_THRESHOLD){
            reloadTriggered = true;
            setTimeout(function(){ window.location.reload(); }, 80);
          }
          touchY = y;
          return;
        }
      }

      var now = performance.now();
      var dt = Math.max(1, now - touchLastT);
      var deltaY = (touchY - y) * TOUCH_GAIN;
      touchVelocity = touchVelocity * 0.7 + (deltaY / dt) * 0.3; // smoothed release velocity, gained-px/ms
      touchLastT = now;
      handleScrollInput(deltaY);
      touchY = y;
      if(e.cancelable) e.preventDefault();
      kick();
    }, { passive: false });

    function touchEnd(){
      if(pulling && !reloadTriggered){
        pullOffsetTarget = 0; // spring back
      } else if(!pulling){
        var v = (performance.now() - touchLastT > 80) ? 0 : touchVelocity; // finger rested before lifting: no fling
        if(Math.abs(v) > FLING_MIN) handleScrollInput(Math.max(-FLING_MAX, Math.min(FLING_MAX, v * FLING_MS)));
      }
      pulling = false;
      kick();
    }
    window.addEventListener('touchend', touchEnd, { passive: true });
    window.addEventListener('touchcancel', touchEnd, { passive: true });

    // Keyboard scrolling (space/page/arrow/home/end) so the page stays
    // navigable without a wheel or touch surface.
    window.addEventListener('keydown', function(e){
      if(contactOpen()) return;
      var vh = window.innerHeight;
      var step = null;
      switch(e.key){
        case 'ArrowDown': step = 80; break;
        case 'ArrowUp': step = -80; break;
        case 'PageDown': step = vh * 0.9; break;
        case 'PageUp': step = -vh * 0.9; break;
        case ' ': step = e.shiftKey ? -vh * 0.9 : vh * 0.9; break;
        case 'Home': targetScrollY = 0; syncRevealsToTarget(); return;
        case 'End': targetScrollY = maxScroll; syncRevealsToTarget(); return;
        default: return;
      }
      if(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      handleScrollInput(step);
      kick();
    }, { passive: false });

    // Internal anchor links (#top, #services, ...) jump by moving the
    // target scroll position instead of relying on native anchor scroll.
    document.addEventListener('click', function(e){
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if(!a) return;
      var id = a.getAttribute('href').slice(1);
      if(!id) return;
      var target = document.getElementById(id);
      if(!target) return;
      e.preventDefault();
      var rect = target.getBoundingClientRect();
      targetScrollY = clamp(currentScrollY + rect.top, 0, maxScroll);
      syncRevealsToTarget();
    });

    window.addEventListener('resize', calculateDimensions);
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(calculateDimensions); }
    window.addEventListener('load', calculateDimensions);

    calculateDimensions();
    updateHero();
    kick();
  })();