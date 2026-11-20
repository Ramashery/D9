// Каталог кейсов: 01 — слайдер, 02 — галерея (движок референса herasymenkox.com, адаптирован под сайт).
// Убрано: звук, орбита (режим 03), прелоадер-плитки, оверлей открытия кейса, часы, переходы-вуаль.
// Клик по карточке ведёт на страницу кейса Hugo (slide.url), если она существует.
import { cloneDefaults, OVERLAY } from './config.js';
import { meta, SLIDES } from './data.js';
import { EASE_HIDE, EASE_SHOW, Gallery } from './gallery.js';
import { bezier } from './ease.js';
import { Renderer } from './gl.js';
import { maskUI, revealUI } from './preloader.js';
import { SlideScroll } from './scroll.js';
import { Ruler } from './ruler.js';
import { Stepper } from './stepper.js';
import { ScrubText, splitChars } from './text.js';

const { gsap } = window;
const COUNT = SLIDES.length;
const mod = (n) => ((n % COUNT) + COUNT) % COUNT;
const html = document.documentElement;

const params = cloneDefaults();
const MEDIA_WAIT = 3000;

// шрифт заголовков берём у сайта (--display), чтобы кернинг считался по реальному шрифту
const rootStyle = getComputedStyle(html);
const DISPLAY_FAMILY = (rootStyle.getPropertyValue('--display').split(',')[0] || 'Inter').replace(/['"]/g, '').trim();
const TITLE_WEIGHT = 800;

const textsRoot = document.querySelector('[data-texts]');

function line(className, text) {
  const outer = document.createElement('span');
  outer.className = `line ${className}`;
  const mid = document.createElement('span');
  mid.className = 'line-mid';
  outer.appendChild(mid);
  if (text === null) return { outer, mid };
  const inner = document.createElement('span');
  inner.className = 'line-inner';
  inner.textContent = text;
  mid.appendChild(inner);
  return { outer, mid, inner };
}

function block(tag, className, top) {
  const el = document.createElement(tag);
  el.className = `blend ${className}`;
  el.style.setProperty('--y', top);
  textsRoot.appendChild(el);
  return el;
}

// ширина самой длинной строки заголовка в em (для подгонки размера под экран: у Inter слова уже, чем у шрифта референса)
const measureCtx = document.createElement('canvas').getContext('2d');
function titleFit(lines) {
  measureCtx.font = `${TITLE_WEIGHT} 100px "${DISPLAY_FAMILY}"`;
  const widths = lines.map((l) => measureCtx.measureText(l.toUpperCase()).width / 100 - 0.04 * [...l].length);
  return Math.max(...widths, 1);
}

function buildTexts() {
  return SLIDES.map((slide, index) => {
    const text = new ScrubText(index, COUNT);
    text.titleMids = [];
    text.lineMids = [];

    const fit = titleFit(slide.title).toFixed(3);
    const title = block('h2', 'slide-title', slide.layout.title);
    title.style.setProperty('--fit', fit);
    slide.title.forEach((value) => {
      const { outer, mid } = line('title-line', null);
      title.appendChild(outer);
      text.addTitleLine(splitChars(mid, value, DISPLAY_FAMILY, TITLE_WEIGHT));
      text.titleMids.push(mid);
    });

    const l = line('', meta(slide));
    const metaEl = block('p', 'slide-meta', slide.layout.meta);
    metaEl.style.setProperty('--fit', fit);
    metaEl.appendChild(l.outer);
    text.addLine(l.inner);
    text.lineMids.push(l.mid);

    return text;
  });
}

const INTRO = { from: 140, duration: 1.5, ease: 'expo.out' };
function introReveal(text, titleDelay = 0.1) {
  const { from, duration, ease } = INTRO;
  gsap.fromTo(text.lineMids, { yPercent: from }, { yPercent: 0, duration, ease, stagger: 0.05 });
  gsap.fromTo(text.titleMids, { yPercent: from }, { yPercent: 0, duration, ease, stagger: 0.04, delay: titleDelay });
}

function hideTexts(text, onComplete) {
  gsap.to([...text.lineMids, ...text.titleMids], { yPercent: -110, duration: 0.7, ease: EASE_HIDE, overwrite: true, onComplete });
}

function showTexts(text) {
  gsap.fromTo(text.lineMids, { yPercent: 110 }, { yPercent: 0, duration: 1.4, ease: EASE_SHOW, stagger: 0.05, delay: 0.8, overwrite: true });
  gsap.fromTo(text.titleMids, { yPercent: 110 }, { yPercent: 0, duration: 1.4, ease: EASE_SHOW, stagger: 0.04, delay: 0.8, overwrite: true });
}

function loadMedia(slide) {
  const { media } = slide;
  const item = { width: media.width, height: media.height, zoom: slide.zoom, uploaded: false, isVideo: true };
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous'; // нужен для загрузки кадров видео в WebGL-текстуру
  video.src = media.src;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  item.el = video;
  // реальные пропорции видео — для корректного cover-кадрирования в шейдере
  video.addEventListener(
    'loadedmetadata',
    () => {
      if (video.videoWidth) {
        item.width = video.videoWidth;
        item.height = video.videoHeight;
      }
    },
    { once: true },
  );
  item.ready = new Promise((resolve) => {
    if (video.readyState >= 2) resolve();
    else video.addEventListener('loadeddata', resolve, { once: true });
  });
  return item;
}

function play(item) {
  const p = item.el.play();
  if (p && p.catch) p.catch(() => {});
}

function pauseAndRewind(item) {
  item.el.pause();
  try {
    item.el.currentTime = 0;
  } catch {}
}

class Transition {
  constructor(media) {
    this.media = media;
    this.from = 0;
    this.to = null;
    this.progress = 0;
    this.active = new Set([0]);
  }

  playOnly(index) {
    this.active = new Set([index]);
    this.media.forEach((m, i) => (i === index ? play(m) : pauseAndRewind(m)));
  }

  update(position) {
    const base = Math.floor(position);
    this.from = mod(base);
    this.progress = position - base;
    this.to = this.progress > 0 ? mod(base + 1) : null;

    const active = new Set([this.from]);
    if (this.to !== null) active.add(this.to);
    active.forEach((i) => {
      if (this.active.has(i)) return;
      const m = this.media[i];
      try {
        m.el.currentTime = 0;
      } catch {}
      play(m);
    });
    this.active.forEach((i) => !active.has(i) && pauseAndRewind(this.media[i]));
    this.active = active;
  }

  get output() {
    const from = this.media[this.from];
    const next = this.to !== null ? this.media[this.to] : from;
    const to = next.uploaded ? next : from;
    return { from, to, progress: this.progress };
  }
}

// курсор «View case»: следует за мышью, в слайдере виден везде, в галерее выключен
function initCursor() {
  const el = document.querySelector('[data-cursor]');
  const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
  const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
  const scaleX = gsap.quickTo(el, 'scaleX', { duration: 0.4, ease: 'power3' });
  const scaleY = gsap.quickTo(el, 'scaleY', { duration: 0.4, ease: 'power3' });
  const scale = (v) => (scaleX(v), scaleY(v));
  gsap.set(el, { scaleX: 0, scaleY: 0, xPercent: -50, yPercent: -50 });

  const cursor = { enabled: true };
  let placed = false;
  let overUi = false;
  window.addEventListener('mousemove', (e) => {
    if (placed) {
      x(e.clientX);
      y(e.clientY);
    } else {
      placed = true;
      gsap.set(el, { x: e.clientX, y: e.clientY });
    }
    overUi = Boolean(e.target.closest('[data-ui], .mn-nav, .mn-menu'));
    scale(overUi || !cursor.enabled ? 0 : 1);
  });
  document.documentElement.addEventListener('mouseleave', () => scale(0));
  cursor.setEnabled = (on) => {
    cursor.enabled = on;
    if (!on) scale(0);
    else if (placed && !overUi) scale(1);
  };
  cursor.setLabel = (text) => {
    if (el.textContent !== text) el.textContent = text;
  };
  return cursor;
}

function maskOf(el) {
  let inner = el.querySelector(':scope > .ui-in');
  if (!inner) {
    inner = document.createElement('span');
    inner.className = 'ui-in';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
  }
  el.classList.add('ui-mask');
  return inner;
}

async function boot() {
  const canvas = document.querySelector('[data-gl]');
  const renderer = new Renderer(canvas, { overlay: OVERLAY });
  renderer.setParams(params.transition);

  const media = SLIDES.map((s) => loadMedia(s));
  const displacement = new Image();
  displacement.src = canvas.dataset.noise;

  await document.fonts.ready;
  const texts = buildTexts();
  gsap.set([...texts[0].lineMids, ...texts[0].titleMids], { yPercent: INTRO.from });
  texts.forEach((t) => t.update(0));
  const cursor = initCursor();

  const scroll = new SlideScroll(params.scroll, COUNT);
  const transition = new Transition(media);
  const gallery = new Gallery({
    renderer,
    media,
    slides: SLIDES,
    params: params.gallery,
    zoomParams: params.zoom,
    hoverParams: params.hover,
    overlay: OVERLAY,
    labelsRoot: document.querySelector('[data-gallery]'),
  });
  const stepperEl = document.querySelector('[data-stepper]');
  const stepper = new Stepper(stepperEl, COUNT, params.stepper);
  const rulerEl = document.querySelector('[data-ruler]');
  const ruler = new Ruler(rulerEl, COUNT);
  let shown = 0;
  const step = (index) => {
    stepper.set(index);
    shown = index;
  };
  gsap.set(maskOf(rulerEl), { yPercent: 110 });

  // нумерация внизу: левая и правая цифры + полоска выезжают отдельно
  const pgnLeft = stepperEl.querySelector('[data-stepper-current]');
  const pgnMiddle = stepperEl.querySelector('[data-stepper-steps]');
  const pgnRight = stepperEl.querySelector('[data-stepper-count]');
  [pgnLeft, pgnRight].forEach((el) => {
    const mask = document.createElement('span');
    mask.className = 'pgn-mask';
    el.parentElement.insertBefore(mask, el);
    mask.appendChild(el);
  });
  const EXIT_UI = { duration: 0.9, ease: bezier(0.64, 0, 0.12, 1) };
  function pgn(action) {
    const show = action === 'show';
    const tween = show ? { duration: 1.5, ease: 'expo.out' } : EXIT_UI;
    if (show) {
      gsap.set(pgnLeft, { xPercent: -110 });
      gsap.set(pgnRight, { xPercent: 110 });
      gsap.set(pgnMiddle, { scaleX: 0 });
    }
    gsap.to(pgnLeft, { xPercent: show ? 0 : -110, ...tween, overwrite: true });
    gsap.to(pgnRight, { xPercent: show ? 0 : 110, ...tween, overwrite: true });
    gsap.to(pgnMiddle, { scaleX: show ? 1 : 0, ...tween, overwrite: true });
  }

  let busy = false;
  let queuedView = null;
  const view = {
    mode: 'slider',
    get busy() {
      return busy;
    },
    set busy(value) {
      busy = value;
      if (value || !queuedView) return;
      const mode = queuedView;
      queuedView = null;
      gsap.delayedCall(0, () => setView(mode));
    },
  };

  // ждём первое видео и текстуру искажения (но не дольше MEDIA_WAIT)
  play(media[0]);
  await Promise.race([
    Promise.all([displacement.decode().catch(() => {}), media[0].ready]),
    new Promise((resolve) => setTimeout(resolve, MEDIA_WAIT)),
  ]);
  renderer.setDisplacement(displacement);
  texts.forEach((t) => t.update(scroll.position));

  // ---------- вступление ----------
  gsap.set(canvas, { opacity: 1 });
  const uiInners = maskUI([...document.querySelectorAll('[data-ui]')]);
  const afterFrames = (n, fn) => (n ? requestAnimationFrame(() => afterFrames(n - 1, fn)) : fn());
  afterFrames(3, () => {
    html.classList.add('works-ready');
    introReveal(texts[0], 0.15);
    revealUI(uiInners, 0.2);
    pgn('show');
  });

  window.addEventListener('resize', () => {
    renderer.resize();
    gallery.layout();
  });

  const sliderTexts = document.querySelectorAll('.slide-title, .slide-meta');
  const switchButtons = document.querySelectorAll('[data-view]');

  function markSwitch(mode) {
    const current = queuedView || mode;
    switchButtons.forEach((b) => {
      const on = b.dataset.view === current;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  function hideBottom(el) {
    gsap.to(maskOf(el), { yPercent: -110, duration: 0.7, ease: EASE_HIDE, overwrite: true });
  }

  function showBottom(el) {
    const inner = maskOf(el);
    gsap.fromTo(
      inner,
      { yPercent: 110 },
      {
        yPercent: 0,
        duration: 1.4,
        ease: EASE_SHOW,
        delay: 0.8,
        overwrite: true,
        onComplete: () => gsap.getProperty(inner, 'yPercent') === 0 && el.classList.remove('ui-mask'),
      },
    );
  }

  function swapBottom(out, inEl) {
    hideBottom(out);
    showBottom(inEl);
  }

  async function setView(mode) {
    if (view.busy) {
      queuedView = mode;
      markSwitch(mode);
      return;
    }
    if (mode === view.mode) return;
    view.mode = mode;
    view.busy = true;
    markSwitch(mode);

    if (mode === 'gallery') {
      // слайдер -> галерея: видео сжимается в карточку, остальные «выезжают» по бокам
      scroll.enabled = false;
      const index = Math.round(scroll.target);
      scroll.jump(index);
      transition.update(index);
      cursor.setEnabled(false);
      const text = texts[mod(index)];
      hideTexts(text, () => {
        gsap.set(sliderTexts, { autoAlpha: 0 });
        gsap.set([...text.lineMids, ...text.titleMids], { yPercent: 0 });
      });
      swapBottom(stepperEl, rulerEl);
      media.forEach(play);
      gallery.zoomOut(index, () => {
        gallery.enabled = true;
        view.busy = false;
      });
    } else {
      // галерея -> слайдер
      const index = gallery.zoomIn(() => {
        transition.update(index);
        transition.playOnly(mod(index));
        scroll.enabled = true;
        cursor.setEnabled(true);
        view.busy = false;
      });
      scroll.jump(index);
      texts.forEach((t) => t.update(index));
      const text = texts[mod(index)];
      gsap.set([...text.lineMids, ...text.titleMids], { yPercent: 110 });
      gsap.set(sliderTexts, { autoAlpha: 1 });
      showTexts(text);
      swapBottom(rulerEl, stepperEl);
    }
  }

  switchButtons.forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      setView(b.dataset.view);
    }),
  );

  // ---------- переход на страницу кейса ----------
  const caseOf = (index) => SLIDES[mod(index)];
  function openCase(index) {
    const slide = caseOf(index);
    if (!slide.url) return false;
    window.location.href = slide.url;
    return true;
  }
  gallery.onOpen = (index) => {
    if (view.mode !== 'gallery' || view.busy) return false;
    return openCase(index);
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-ui], .mn-nav, .mn-menu')) return;
    if (view.mode !== 'slider' || view.busy) return;
    openCase(Math.round(scroll.target));
  });

  // подпись курсора зависит от того, есть ли у слайда страница кейса
  const labelCase = document.querySelector('[data-cursor]').dataset.case;
  const labelSoon = document.querySelector('[data-cursor]').dataset.soon;

  // пока открыто меню сайта — не листаем каталог
  let resume = null;
  new MutationObserver(() => {
    const open = html.classList.contains('menu-open');
    if (open && !resume) {
      resume = { scroll: scroll.enabled, gallery: gallery.enabled, cursor: cursor.enabled };
      scroll.enabled = false;
      gallery.enabled = false;
      cursor.setEnabled(false);
    } else if (!open && resume) {
      if (!view.busy) {
        scroll.enabled = resume.scroll;
        gallery.enabled = resume.gallery;
      }
      cursor.setEnabled(resume.cursor);
      resume = null;
    }
  }).observe(html, { attributes: true, attributeFilter: ['class'] });

  // ---------- кадр ----------
  function syncGalleryVideos() {
    const visible = new Set(gallery.visibleMedia());
    media.forEach((m) => {
      if (visible.has(m)) {
        if (m.el.paused) play(m);
      } else if (!m.el.paused) {
        m.el.pause();
      }
    });
    return visible;
  }

  function uploadVideo(m) {
    if (!m || m.el.readyState < 2) return;
    if (m.uploaded && m.el.currentTime === m.lastTime) return;
    m.lastTime = m.el.currentTime;
    renderer.upload(m);
  }

  let last = performance.now();
  let lastLabel = '';
  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;

    scroll.update();
    gallery.update(dt);
    renderer.clear();

    if (gallery.visible) {
      if (view.mode === 'gallery') syncGalleryVideos();
      gallery.visibleMedia().forEach(uploadVideo);
      gallery.render(now);
      step(mod(Math.round(gallery.position)));
      ruler.update(gallery.position);
    } else {
      const raw = scroll.position;
      texts.forEach((t) => t.update(raw));
      transition.update(raw);
      uploadVideo(media[transition.from]);
      if (transition.to !== null) uploadVideo(media[transition.to]);
      renderer.render({ ...transition.output, extra: 0 });
      step(mod(Math.round(raw)));

      const label = caseOf(Math.round(raw)).url ? labelCase : labelSoon;
      if (label !== lastLabel) {
        lastLabel = label;
        cursor.setLabel(label);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  // нет WebGL или что-то пошло не так — показываем простой список кейсов
  console.error(err);
  html.classList.add('works-fallback');
});
