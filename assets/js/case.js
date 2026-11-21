/* Страница кейса: тот же «тяжёлый» инерционный скролл, что и на главной (engine.js), плюс
   боковая панель с подсветкой раздела, параллакс медиа, автозапуск видео и появление блоков.
   Нативная прокрутка отключена: #scroll-container двигается через translate3d. */
(() => {
  'use strict';

  const container = document.getElementById('scroll-container');
  if (!container || !document.querySelector('[data-case]')) return;

  const html = document.documentElement;
  html.classList.add('case-js');

  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---- параметры скролла — те же, что в engine.js главной ----
  const EASE_60 = reduce ? 1 : 0.05; // доля оставшегося пути за кадр 60fps: меньше = тяжелее
  const TOUCH_GAIN = 1.6; // пиксели пальца -> пиксели прокрутки
  const FLING_MS = 220, FLING_MIN = 0.1, FLING_MAX = 1300; // «бросок» после отпускания пальца
  const PULL_THRESHOLD = 76, PULL_MAX = 130, PULL_RESISTANCE = 0.5; // pull-to-reload сверху (нативный отключён)
  const ANCHOR_OFFSET = 80; // отступ при переходе по ссылкам содержания (под верхней панелью)

  let target = 0, current = 0, max = 0;
  let raf = null, last = 0;
  let pullOffset = 0, pullTarget = 0, pulling = false, pullStartY = 0, reloadTriggered = false;
  let applied = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const blocked = () => html.classList.contains('contact-open') || html.classList.contains('menu-open');

  // ---- геометрия ----
  const side = document.querySelector('[data-side]');
  const sideLinks = [...document.querySelectorAll('[data-spy-link]')];
  const spyEls = [...document.querySelectorAll('[data-spy]')].map((el) => ({ el, id: el.id, top: 0 }));
  const media = [...document.querySelectorAll('[data-parallax]')].map((el) => ({ el, frame: el.querySelector('[data-frame]'), top: 0, h: 0, last: null }));
  const footerEl = document.querySelector('.footer');
  let footerTop = 0;
  let activeId = null;

  function cacheGeometry() {
    media.forEach((m) => {
      const r = m.el.getBoundingClientRect();
      m.top = r.top + applied;
      m.h = r.height;
      m.last = null;
    });
    spyEls.forEach((s) => (s.top = s.el.getBoundingClientRect().top + applied));
    footerTop = footerEl ? footerEl.getBoundingClientRect().top + applied : container.scrollHeight;
  }

  function measure() {
    max = Math.max(0, container.scrollHeight - window.innerHeight);
    target = clamp(target, 0, max);
    cacheGeometry();
    kick();
  }

  // ---- параллакс (та же формула, что у главной: [data-parallax] с запасом 10% сверху и снизу) ----
  const OVERFLOW_FRACTION = 0.2;
  function parallax(y, vh) {
    if (reduce) return;
    for (const m of media) {
      if (!m.frame) continue;
      const t = m.top - y;
      if (t > vh + 60 || t + m.h < -60) continue;
      const tt = 2 * ((t + m.h * 0.5) / vh - 0.5);
      const off = Math.round(-0.4 * OVERFLOW_FRACTION * m.h * tt * 10) / 10;
      if (off === m.last) continue;
      m.last = off;
      m.frame.style.transform = `translate3d(0,${off}px,0)`;
    }
  }

  // ---- боковая панель: прижата к низу контента, когда в кадр въезжает футер ----
  let lastShift = null;
  function sidebar(y, vh) {
    if (!side) return;
    const shift = Math.min(0, footerTop - y - vh);
    if (shift === lastShift) return;
    lastShift = shift;
    side.style.transform = `translate3d(0,${shift.toFixed(2)}px,0)`;
  }

  // ---- подсветка текущего раздела в содержании ----
  function spy(y, vh) {
    if (!spyEls.length) return;
    const line = y + vh * 0.38;
    let id = spyEls[0].id;
    for (const s of spyEls) if (s.top <= line) id = s.id;
    if (y <= 2) id = spyEls[0].id;
    if (id === activeId) return;
    activeId = id;
    sideLinks.forEach((a) => {
      const on = a.dataset.spyLink === id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  // ---- кадр ----
  function kick() {
    if (raf === null) {
      last = 0;
      raf = requestAnimationFrame(animate);
    }
  }
  function animate(now) {
    const dt = last ? Math.min(50, now - last) : 16.667;
    last = now;
    const k = 1 - Math.pow(1 - EASE_60, dt / 16.667); // нормализовано по времени: одинаково на 60 и 120 Гц

    const diff = target - current;
    current = Math.abs(diff) < 0.1 ? target : current + diff * k;
    const pd = pullTarget - pullOffset;
    pullOffset = Math.abs(pd) < 0.1 ? pullTarget : pullOffset + pd * k;

    const dpr = window.devicePixelRatio || 1;
    const y = Math.round((current - pullOffset) * dpr) / dpr; // привязка к физическим пикселям: текст не «дрожит»
    container.style.transform = `translate3d(0,${(-y).toFixed(2)}px,0)`;
    applied = y;

    const vh = window.innerHeight;
    parallax(y, vh);
    sidebar(y, vh);
    spy(y, vh);

    if (current !== target || pullOffset !== pullTarget) raf = requestAnimationFrame(animate);
    else {
      raf = null;
      last = 0;
    }
  }

  function scrollBy(delta) {
    if (!delta) return;
    target = clamp(target + delta, 0, max);
    kick();
  }

  // ---- колесо ----
  window.addEventListener(
    'wheel',
    (e) => {
      if (blocked()) return; // форма контактов / меню прокручиваются сами
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      scrollBy(e.deltaY * unit);
    },
    { passive: false },
  );

  // ---- касание: инерция, бросок, pull-to-reload ----
  let touchY = 0, touchVelocity = 0, touchLastT = 0;
  window.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1 || blocked()) return;
      touchY = e.touches[0].clientY;
      pullStartY = touchY;
      pulling = current <= 0.5;
      reloadTriggered = false;
      touchVelocity = 0;
      touchLastT = performance.now();
    },
    { passive: true },
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      if (!e.touches.length || blocked()) return;
      const y = e.touches[0].clientY;
      if (pulling) {
        if (reloadTriggered) {
          if (e.cancelable) e.preventDefault();
          return;
        }
        const raw = y - pullStartY; // >0 — палец тянут вниз
        if (raw <= 0) pulling = false;
        else {
          if (e.cancelable) e.preventDefault();
          pullTarget = Math.min(PULL_MAX, raw * PULL_RESISTANCE);
          kick();
          if (raw >= PULL_THRESHOLD) {
            reloadTriggered = true;
            setTimeout(() => window.location.reload(), 80);
          }
          touchY = y;
          return;
        }
      }
      const now = performance.now();
      const dt = Math.max(1, now - touchLastT);
      const deltaY = (touchY - y) * TOUCH_GAIN;
      touchVelocity = touchVelocity * 0.7 + (deltaY / dt) * 0.3;
      touchLastT = now;
      scrollBy(deltaY);
      touchY = y;
      if (e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  function touchEnd() {
    if (pulling && !reloadTriggered) pullTarget = 0;
    else if (!pulling) {
      const v = performance.now() - touchLastT > 80 ? 0 : touchVelocity; // палец успел замереть — без броска
      if (Math.abs(v) > FLING_MIN) scrollBy(clamp(v * FLING_MS, -FLING_MAX, FLING_MAX));
    }
    pulling = false;
    kick();
  }
  window.addEventListener('touchend', touchEnd, { passive: true });
  window.addEventListener('touchcancel', touchEnd, { passive: true });

  // ---- клавиатура ----
  window.addEventListener(
    'keydown',
    (e) => {
      if (blocked() || e.metaKey || e.ctrlKey || e.altKey) return;
      const vh = window.innerHeight;
      let step = null;
      switch (e.key) {
        case 'ArrowDown': step = 80; break;
        case 'ArrowUp': step = -80; break;
        case 'PageDown': step = vh * 0.9; break;
        case 'PageUp': step = -vh * 0.9; break;
        case ' ': step = e.shiftKey ? -vh * 0.9 : vh * 0.9; break;
        case 'Home': target = 0; kick(); return;
        case 'End': target = max; kick(); return;
        default: return;
      }
      if (document.activeElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement.tagName) && e.key === ' ') return;
      if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      scrollBy(step);
    },
    { passive: false },
  );

  // ---- якорные ссылки (содержание, #top в футере) ----
  document.addEventListener('click', (e) => {
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    if (id === 'top') {
      e.preventDefault();
      target = 0;
      kick();
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    target = clamp(current + el.getBoundingClientRect().top - ANCHOR_OFFSET, 0, max);
    kick();
  });

  // ---- видео кейса: грузим и играем только то, что в кадре; кнопка паузы запоминается ----
  // Управляем ТОЛЬКО своими роликами (data-case-src). Видео футера ([data-src]) ведёт lazymedia.js — ровно как на главной.
  const videos = [...document.querySelectorAll('video[data-case-src]')];
  const inView = new Set();
  const playIfAllowed = (v) => {
    if (v.dataset.userPaused) return;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };
  const vio = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting) {
          inView.add(v);
          if (!v.src) {
            v.src = v.dataset.caseSrc;
            v.preload = 'auto';
          }
          playIfAllowed(v);
        } else {
          inView.delete(v);
          v.pause();
        }
      });
    },
    { rootMargin: '300px 0px' },
  );
  videos.forEach((v) => vio.observe(v));

  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    const v = btn.parentElement.querySelector('video');
    if (!v) return;
    btn.addEventListener('click', () => {
      if (v.dataset.userPaused) {
        delete v.dataset.userPaused;
        v.play().catch(() => {});
        btn.classList.remove('is-paused');
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', btn.dataset.labelPause);
      } else {
        v.dataset.userPaused = '1';
        v.pause();
        btn.classList.add('is-paused');
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', btn.dataset.labelPlay);
      }
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach((v) => v.pause());
    else inView.forEach(playIfAllowed); // вернулись на вкладку — продолжаем то, что в кадре
  });

  // ---- появление блоков ----
  const rio = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        rio.unobserve(en.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  document.querySelectorAll('.rv').forEach((el) => rio.observe(el));

  // ---- старт ----
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('load', measure);
  measure();
  spy(0, window.innerHeight);
  kick();
})();
