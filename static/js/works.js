/* Каталог кейсов (/works): слайдер (01) + галерея (02). Единый файл.
   Собран из модулей движка референса (ease, config, mobile, text, stepper, ruler, scroll, gl, data, gallery) и main.
   Зависимость: gsap (static/js/vendor/gsap.min.js, подключается раньше). Данные слайдов: <script id="works-data"> из layouts/works/list.html. */
(() => {
'use strict';

// ───────────── ease ─────────────
const __ease = (() => {
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (sx(mid) < x) lo = mid;
        else hi = mid;
      }
      return sy((lo + hi) / 2);
    };
  }

  const o6 = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
  return { bezier, o6 };
})();

// ───────────── config ─────────────
const __config = (() => {
  const DEFAULTS = {
    transition: {
      distortionStrength: 0.4,
      rgbShift: 0,
      distortionScale: 0.28,
    },
    scroll: {
      wheel: 0.8,
      touch: 4,
      snapDelay: 0.1,
      lerp: 0.1,
    },
    gallery: {
      ease: 0.07,
      wheel: 0.0252,
      wheelScale: 0.556,
      drag: 0.05,
      curve: 152,
      curveFlat: 0.4,
      latency: 0.12,
      latencyMax: 3,
      latencyEase: 0.07,
      wheelEnd: 0.15,
      snap: 0.155,
      cameraZ: 600,
      segments: 100,
    },
    zoom: {
      duration: 1.8,
    },
    stepper: {
      lead: 0.6,
      leadEase: 'expo.out',
      trail: 0.8,
      trailEase: 'expo.out',
      trailDelay: 0.08,
      lines: 0.7,
      linesEase: 'expo.out',
    },
    sound: {
      file: 'App Interface Button 2.wav',
      volume: 0.2,
    },
    hover: {
      mouse: 0.07,
      area: 0.05,
      dmax: 1.8,
      winGl: 4.14214,
    },
  };
  const OVERLAY = { color: [0, 0, 0], opacity: 0.4 };   // чёрный фон сайта

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  return { DEFAULTS, OVERLAY, cloneDefaults };
})();

// ───────────── mobile ─────────────
const __mobile = (() => {
  const MOBILE = window.matchMedia('(max-width: 600px)');

  const isMobile = () => MOBILE.matches;
  return { isMobile };
})();

// ───────────── text ─────────────
const __text = (() => {
  const kernCanvas = document.createElement('canvas').getContext('2d');
  function kerning(font, a, b) {
    kernCanvas.font = font;
    if ('fontKerning' in kernCanvas) kernCanvas.fontKerning = 'normal';
    const m = (s) => kernCanvas.measureText(s).width;
    return (m(a + b) - m(a) - m(b)) / 100;
  }

  function splitChars(parent, text, fontFamily, weight = 700) {
    const font = `${weight} 100px "${fontFamily}"`;
    const chars = [...text.toUpperCase()];
    parent.textContent = '';
    return chars.map((char, i) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = char === ' ' ? ' ' : char;
      const next = chars[i + 1];
      if (next) {
        const k = kerning(font, char, next);
        if (Math.abs(k) > 0.0001) span.style.marginRight = `${k}em`;
      }
      parent.appendChild(span);
      return span;
    });
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  class ScrubText {
    constructor(index, count) {
      this.index = index;
      this.count = count;
      this.titleChars = [];
      this.lines = [];
      this.lastU = null;
    }

    addTitleLine(chars) {
      this.titleChars.push(...chars);
    }

    addLine(el) {
      this.lines.push(el);
    }

    relative(position) {
      const n = this.count;
      let u = (((position - this.index) % n) + n) % n;
      if (u >= n / 2) u -= n;
      return u;
    }

    update(position) {
      const u = this.relative(position);

      const hidden = Math.abs(u) >= 0.5;
      if (hidden && this.lastU !== null && Math.abs(this.lastU) >= 0.5 && Math.sign(u) === Math.sign(this.lastU)) return;
      this.lastU = u;

      const lineY = Math.max(-200, Math.min(200, -u * 200));
      for (const el of this.lines) el.style.transform = `translate3d(0, ${lineY}%, 0)`;

      const titleY = u >= 0 ? -110 * clamp01(u / 0.5) : 110 * (1 - clamp01((u + 0.5) / 0.5));
      const t = `translate3d(0, ${titleY}%, 0)`;
      for (const el of this.titleChars) el.style.transform = t;
    }
  }
  return { splitChars, ScrubText };
})();

// ───────────── stepper ─────────────
const __stepper = (() => {
  const { gsap } = window;

  const SQUARE = 12;
  const LINE = 1;
  const GAP = 4;

  const pad = (n) => String(n).padStart(3, '0');

  class Stepper {
    constructor(root, count, params) {
      this.params = params;
      this.count = count;
      this.current = root.querySelector('[data-stepper-current]');
      root.querySelector('[data-stepper-count]').textContent = pad(count);
      const steps = root.querySelector('[data-stepper-steps]');

      this.lines = Array.from({ length: count }, () => {
        const line = document.createElement('span');
        line.className = 'stepper-line';
        steps.appendChild(line);
        return { el: line, x: 0 };
      });
      this.square = document.createElement('span');
      this.square.className = 'stepper-square';
      steps.appendChild(this.square);
      this.edges = { left: 0, right: SQUARE };

      this.index = -1;
      this.set(0, false);
    }

    x(i, active) {
      return i * (LINE + GAP) + (i > active ? SQUARE - LINE : 0);
    }

    draw() {
      const { left, right } = this.edges;
      this.square.style.setProperty('--left', left);
      this.square.style.setProperty('--width', right - left);
      this.lines.forEach((line) => line.el.style.setProperty('--x', line.x));
    }

    set(index, animate = true) {
      if (index === this.index) return;
      const from = this.index;
      this.index = index;
      this.current.textContent = pad(index + 1);

      const left = this.x(index, index);
      const right = left + SQUARE;
      const p = this.params;

      if (!animate || from < 0) {
        this.edges.left = left;
        this.edges.right = right;
        this.lines.forEach((line, i) => (line.x = this.x(i, index)));
        this.draw();
        return;
      }

      const forward = index > from;
      const lead = { duration: p.lead, ease: p.leadEase, overwrite: 'auto', onUpdate: () => this.draw() };
      const trail = { duration: p.trail, ease: p.trailEase, delay: p.trailDelay, overwrite: 'auto', onUpdate: () => this.draw() };
      gsap.to(this.edges, { ...(forward ? lead : trail), right });
      gsap.to(this.edges, { ...(forward ? trail : lead), left });
      this.lines.forEach((line, i) => {
        gsap.to(line, { x: this.x(i, index), duration: p.lines, ease: p.linesEase, overwrite: 'auto', onUpdate: () => this.draw() });
      });
    }
  }
  return { Stepper };
})();

// ───────────── ruler ─────────────
const __ruler = (() => {
  const PITCH = 60;
  const SMALL = [12, 24, 36, 48];
  const REACH = 3;
  const LEFT = 0.6;
  const RIGHT = 0.4;

  const numberOpacity = (d) => Math.min(1, Math.max(0, d <= 0 ? 1 + d * (1 - LEFT) : 1 - d * (1 - RIGHT)));

  const pad = (n) => String(n).padStart(2, '0');
  const mod = (n, m) => ((n % m) + m) % m;

  class Ruler {
    constructor(root, count) {
      this.count = count;
      this.track = root.querySelector('[data-ruler-track]');
      this.items = new Map();
      this.current = null;
    }

    item(i) {
      let item = this.items.get(i);
      if (item) return item;
      const el = document.createElement('div');
      el.className = 'ruler-item';
      const number = document.createElement('span');
      number.className = 'mono ruler-number';
      number.textContent = pad(mod(i, this.count) + 1);
      el.appendChild(number);
      const numberEl = number;
      const tick = document.createElement('span');
      tick.className = 'ruler-tick ruler-tick--work';
      el.appendChild(tick);
      SMALL.forEach((x) => {
        const t = document.createElement('span');
        t.className = 'ruler-tick';
        t.style.setProperty('--x', x);
        el.appendChild(t);
      });
      this.track.appendChild(el);
      item = { el, number: numberEl };
      this.items.set(i, item);
      return item;
    }

    update(position) {
      const base = Math.floor(position);
      const keep = new Set();
      for (let i = base - REACH; i <= base + REACH + 1; i++) {
        keep.add(i);
        const item = this.item(i);
        item.el.style.setProperty('--pos', (i - position) * PITCH);
        item.number.style.opacity = numberOpacity(i - position);
      }
      this.items.forEach((item, i) => {
        if (keep.has(i)) return;
        item.el.remove();
        this.items.delete(i);
      });
      const current = Math.round(position);
      if (current !== this.current) {
        if (this.items.has(this.current)) this.items.get(this.current).el.classList.remove('is-current');
        this.items.get(current).el.classList.add('is-current');
        this.current = current;
      }
    }
  }
  return { Ruler };
})();

// ───────────── scroll ─────────────
const __scroll = (() => {
  const lerp = (a, b, t) => (1 - t) * a + t * b;

  class SlideScroll {
    constructor(params, count) {
      this.params = params;
      this.count = count;
      this.target = 0;
      this.current = 0;
      this.enabled = true;
      this.touchY = null;
      this.timer = null;

      window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
      window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });
      window.addEventListener('touchend', () => this.onTouchEnd());
    }

    get step() {
      return (window.innerHeight * this.count) / (this.count - 1);
    }

    onWheel(e) {
      e.preventDefault();
      if (!this.enabled) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 30;
      this.target += (dy * this.params.wheel) / this.step;
      this.scheduleSnap();
    }

    onTouchStart(e) {
      if (!this.enabled) return;
      this.touchY = e.touches[0].clientY;
    }

    onTouchMove(e) {
      if (!this.enabled || this.touchY === null) return;
      const y = e.touches[0].clientY;
      this.target -= ((y - this.touchY) * this.params.touch) / this.step;
      this.touchY = y;
    }

    onTouchEnd() {
      if (this.touchY === null) return;
      this.touchY = null;
      this.scheduleSnap();
    }

    scheduleSnap() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => (this.target = Math.round(this.target)), this.params.snapDelay * 1000);
    }

    jump(index) {
      clearTimeout(this.timer);
      this.touchY = null;
      this.target = this.current = index;
    }

    update() {
      this.current = lerp(this.current, this.target, this.params.lerp);
      if (Math.abs(this.target - this.current) < 1e-4) this.current = this.target;
    }

    get position() {
      return this.current;
    }
  }
  return { SlideScroll };
})();

// ───────────── gl ─────────────
const __gl = (() => {
  const VERTEX = `
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
  }`;

  const FRAGMENT = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform sampler2D uTexture2;
  uniform sampler2D uDisplacement;
  uniform vec2 uRes;
  uniform vec2 uAspect;
  uniform vec2 uAspect2;
  uniform float uZoom;
  uniform float uZoom2;
  uniform float uProgress;

  uniform float uStrength;
  uniform float uRgbShift;
  uniform float uScale;

  uniform vec3 uOverlayColor;
  uniform float uOverlayOpacity;

  uniform float uExtra;

  varying vec2 vUv;

  vec2 getFitUv(vec2 uv, vec2 containerSize, vec2 textureSize, float zoom)
  {
      float containerAspect = containerSize.x / containerSize.y;
      float textureAspect = textureSize.x / textureSize.y;

      float wider = step(containerAspect, textureAspect);
      vec2 coverScale = mix(
          vec2(1.0, textureAspect / containerAspect),
          vec2(containerAspect / textureAspect, 1.0),
          wider
      );

      return (uv - 0.5) * coverScale / zoom + 0.5;
  }

  vec4 sampleRepeat(sampler2D tex, vec2 uv)
  {
      return texture2D(tex, fract(uv));
  }

  void main()
  {
      vec2 uv = vUv;
      vec3 outputColor;

      if (uProgress < 0.001) {
          vec2 fit = getFitUv(uv, uRes, uAspect, uZoom * (1.0 + uExtra));
          outputColor = texture2D(uTexture, fit).rgb;
      } else {
          float disp = texture2D(uDisplacement, uv).r;

          disp = mix(
              disp,
              disp * (sin(uv.y * 10.0 + uProgress * 6.28) * 0.5 + 0.5),
              0.3
          );

          vec2 uv0 = getFitUv(uv, uRes, uAspect, uZoom);
          vec2 uv1 = getFitUv(uv, uRes, uAspect2, uZoom2);

          float scaleEffect = 1.0 + uProgress * (1.0 - uProgress) * uScale;
          vec2 center = vec2(0.5);

          vec2 distortedUV0 =
              (uv0 - center) / scaleEffect +
              center +
              uProgress * disp * uStrength * vec2(1.0, 0.5);

          vec2 distortedUV1 =
              (uv1 - center) * scaleEffect +
              center -
              (1.0 - uProgress) * disp * uStrength * vec2(1.0, 0.5);

          float rgbOffset = uProgress * (1.0 - uProgress) * uRgbShift;

          vec3 tex0 = vec3(
              sampleRepeat(uTexture, distortedUV0 + vec2(rgbOffset, 0.0)).r,
              sampleRepeat(uTexture, distortedUV0).g,
              sampleRepeat(uTexture, distortedUV0 - vec2(rgbOffset, 0.0)).b
          );

          vec3 tex1 = vec3(
              sampleRepeat(uTexture2, distortedUV1 + vec2(rgbOffset, 0.0)).r,
              sampleRepeat(uTexture2, distortedUV1).g,
              sampleRepeat(uTexture2, distortedUV1 - vec2(rgbOffset, 0.0)).b
          );

          outputColor = mix(tex0, tex1, smoothstep(0.0, 1.0, uProgress));
      }

      outputColor = mix(outputColor, uOverlayColor, uOverlayOpacity);

      gl_FragColor = vec4(outputColor, 1.0);
  }`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram(gl, vertex, fragment) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const { name } = gl.getActiveUniform(program, i);
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  }

  class Renderer {
    constructor(canvas, { overlay }) {
      this.canvas = canvas;
      const options = { antialias: false, alpha: true, premultipliedAlpha: false };
      const gl = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
      if (!gl) throw new Error('WebGL is not supported');
      this.gl = gl;

      const { program, uniforms } = createProgram(gl, VERTEX, FRAGMENT);
      gl.useProgram(program);
      this.program = program;
      this.uniforms = uniforms;

      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      this.quadPosition = gl.getAttribLocation(program, 'position');

      gl.clearColor(0, 0, 0, 1);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      this.blank = this.createTexture();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));

      gl.uniform1i(this.uniforms.uTexture, 0);
      gl.uniform1i(this.uniforms.uTexture2, 1);
      gl.uniform1i(this.uniforms.uDisplacement, 2);
      gl.uniform3fv(this.uniforms.uOverlayColor, overlay.color);
      gl.uniform1f(this.uniforms.uOverlayOpacity, overlay.opacity);

      this.resize();
    }

    createTexture(wrap) {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap || gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap || gl.CLAMP_TO_EDGE);
      return texture;
    }

    setDisplacement(image) {
      const gl = this.gl;
      this.displacement = this.createTexture(gl.REPEAT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    }

    upload(media) {
      const gl = this.gl;
      if (!media.texture) media.texture = this.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, media.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, media.el);
      media.uploaded = true;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    setParams(p) {
      const gl = this.gl;
      const u = this.uniforms;
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
      gl.useProgram(this.program);
      gl.uniform1f(u.uStrength, p.distortionStrength * motion);
      gl.uniform1f(u.uRgbShift, p.rgbShift * motion);
      gl.uniform1f(u.uScale, p.distortionScale * motion);
    }

    clear(transparent = false) {
      const gl = this.gl;
      if (transparent) gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (transparent) gl.clearColor(0, 0, 0, 1);
    }

    render({ from, to, progress, extra = 0 }) {
      const gl = this.gl;
      const u = this.uniforms;
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(this.quadPosition);
      gl.vertexAttribPointer(this.quadPosition, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, (from.uploaded && from.texture) || this.blank);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, (to.uploaded && to.texture) || this.blank);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.displacement || this.blank);

      gl.uniform2f(u.uRes, this.width, this.height);
      gl.uniform2f(u.uAspect, from.width, from.height);
      gl.uniform2f(u.uAspect2, to.width, to.height);
      gl.uniform1f(u.uZoom, from.zoom);
      gl.uniform1f(u.uZoom2, to.zoom);
      gl.uniform1f(u.uProgress, progress);
      gl.uniform1f(u.uExtra, extra);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.activeTexture(gl.TEXTURE0);
    }
  }
  return { createProgram, Renderer };
})();

// ───────────── data ─────────────
const __data = (() => {
  // Слайды берутся из разметки Hugo (<script id="works-data" type="application/json">),
  // которую list.html собирает из data/<lang>/works_slides.json.
  const raw = JSON.parse(document.getElementById('works-data').textContent);

  const TITLE_LINE = 89.6; // высота строки заголовка в дизайн-пикселях (112px * 0.8)
  const GAP = 38.8; // расстояние от заголовка до строки с мета-данными

  const SLIDES = raw.slides.map((s) => {
    const lines = s.title.length;
    const height = lines * TITLE_LINE;
    const top = -(height + GAP) / 2; // группа «заголовок + мета» по центру экрана
    return {
      title: s.title,
      category: s.type,
      type: s.type,
      year: s.year,
      services: s.services,
      url: s.url || '',
      layout: { title: top, meta: top + height + GAP },
      media: { type: 'video', src: s.video, width: 1920, height: 1080 }, // размер уточняется после загрузки
      zoom: 1,
      work: null,
    };
  });

  const meta = (slide) => `${slide.type} — ${slide.year}`;
  const PRELOADER_TILES = [];
  return { SLIDES, meta, PRELOADER_TILES };
})();

// ───────────── preloader ─────────────
const __preloader = (() => {
  const { bezier } = __ease;
  function maskUI(elements) {
    return elements.map((el) => {
      const inner = document.createElement('span');
      inner.className = 'ui-in';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
      el.classList.add('ui-mask');
      gsap.set(inner, { yPercent: 110 });
      return inner;
    });
  }

  function revealUI(inners, delay, onDone) {
    const n = inners.length;
    const total = 1.5 / (1 - (n - 1) * 0.05);
    gsap.to(inners, {
      yPercent: 0,
      duration: 1.5,
      ease: 'expo.out',
      delay,
      stagger: total * 0.05,
      onComplete: () => {
        inners.forEach((inner) => {
          if (gsap.getProperty(inner, 'yPercent') === 0) inner.parentElement.classList.remove('ui-mask');
        });
        if (onDone) onDone();
      },
    });
  }
  return { maskUI, revealUI };
})();

// ───────────── gallery ─────────────
const __gallery = (() => {
  const { bezier } = __ease;
  const { createProgram } = __gl;
  const { meta } = __data;
  const { isMobile } = __mobile;
  const { gsap } = window;

  const EASE_ZOOM = bezier(0.87, 0, 0.13, 1);
  const EASE_SPHERE = bezier(1, 0, 1, 1);
  const EASE_HIDE = bezier(0.15, 0, 0.65, 0);
  const EASE_SHOW = bezier(0.16, 1, 0.3, 1);
  const SPHERE = { gallery: -250, slider: 400 };
  const bell = (t) => {
    const i = Math.abs(t - 0.5) / 0.5;
    return i > 1 ? 0 : 1 - i * i * (3 - 2 * i);
  };
  function factor() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const wh = w / h;
    if (wh > 1) {
      if (w >= 1200) return 16 / 9 < wh ? h / 810 : w / 1440;
      return 1125 / 675 < wh ? h / 675 : w / 1125;
    }
    if (w >= 700) return 750 / 1073 < wh ? h / 1073 : w / 750;
    return 375 / 629 < wh ? h / 629 : w / 375;
  }

  const CARD = { w: 348, h: 226, gap: 12 };
  const PAGE = [0, 0, 0];                                   // фон сайта
  const GREEN = [243 / 255, 241 / 255, 236 / 255];           // --ink сайта
  const DIVIDER = {
    top: 42,
    bottom: 55,
    color: PAGE.map((a, i) => a * 0.9 + Math.abs(a - GREEN[i]) * 0.1),
    draw: 1.4,
  };
  const LABEL_GAP = 12;

  const TOUCH = {
    world: 2 * Math.tan((25 * Math.PI) / 180) * 8,
    side: 96,
    height: 4,
    gap: 0.1,
    drag: 0.012 * 0.4,
    swipe: 30,
    tap: 5,
    snap: { duration: 0.35, ease: 'power2.out' },
  };

  const CARD_VERTEX = `
  attribute vec2 position;
  attribute vec2 uv;

  uniform mat4 uProjection;
  uniform float uCameraZ;
  uniform vec4 uRect; 
  uniform vec2 uSphere; 
  uniform float uCurve; 
  uniform float uCurveFlat; 

  varying vec2 vUv;
  varying vec2 vFlat;

  float j(float t) {
      float p = 2. * t * t;
      return t < .5 ? p : -p + (4. * t) - 1.;
  }

  void main() {
      vec3 pos = vec3(position, 0.0);

      vUv = uv;
      vFlat = position * uRect.zw + uRect.xy;
      if (uSphere.x > 0.) pos.z += j(1. - min(length(vFlat), uSphere.x) / uSphere.x) * uSphere.y;
      vec3 world = vec3(pos.xy * uRect.zw + uRect.xy, pos.z);
      world.z += j(abs((abs(world.x) - uCurveFlat) / uCurveFlat)) * uCurve;
      gl_Position = uProjection * vec4(world.xy, world.z - uCameraZ, 1.0);
  }`;

  const CARD_FRAGMENT = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec4 uRect;
  uniform vec2 uAspect;
  uniform float uZoom;
  uniform vec3 uOverlayColor;
  uniform float uOverlayOpacity;

  uniform vec2 uMouse;
  uniform vec2 uGlPerPx;
  uniform float uTime;
  uniform float uArea;
  uniform float uAreaMax;

  varying vec2 vUv;
  varying vec2 vFlat;

  float z(in vec2 q) { return fract(sin(dot(q.xy, vec2(12.9898, 78.233))) * 43758.5453123); }

  float y(vec2 q) {
      vec2 i = floor(q);
      vec2 f = fract(q);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(z(i + vec2(0.0, 0.0)), z(i + vec2(1.0, 0.0)), u.x), mix(z(i + vec2(0.0, 1.0)), z(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float x(in vec2 q) {
      float v = 0.0;
      float a = 0.5;
      vec2 k = vec2(100.0);
      mat2 r = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
      for (int i = 0; i < 5; ++i) {
          v += a * y(q);
          q = r * q * 2.0 + k;
          a *= 0.5;
      }
      return v;
  }

  vec2 getFitUv(vec2 uv, vec2 containerSize, vec2 textureSize, float zoom)
  {
      float containerAspect = containerSize.x / containerSize.y;
      float textureAspect = textureSize.x / textureSize.y;

      float wider = step(containerAspect, textureAspect);
      vec2 coverScale = mix(
          vec2(1.0, textureAspect / containerAspect),
          vec2(containerAspect / textureAspect, 1.0),
          wider
      );

      return (uv - 0.5) * coverScale / zoom + 0.5;
  }

  void main()
  {
      vec2 t = getFitUv(vUv, uRect.zw, uAspect, uZoom);
      vec3 color = texture2D(uTexture, t).rgb;

      vec2 v = vFlat * uGlPerPx - uMouse;
      float e = sqrt((v.x * v.x) + (v.y * v.y));
      float f = uAreaMax * uArea;
      if (e < f) {
          vec2 w = vec2(t) * 20.0;
          float n = x(w + vec2(x(w + 1.0 * vec2(x(w)) + vec2(1.7, 9.2) + 0.15 * uTime / 1.8))) * (4.0 * e / f);
          vec4 i = texture2D(uTexture, t + y(t * 20.0 - uTime / 5.0) / 70.0);
          color = mix(i.rgb + 0.09, color, step(0.5, (n * n * n + .6 * n * n + .5 * n)));
      }

      gl_FragColor = vec4(mix(color, uOverlayColor, uOverlayOpacity), 1.0);
  }`;

  function planeGeometry(segments) {
    const vertices = [];
    const indices = [];
    for (let j = 0; j <= segments; j++) {
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const v = j / segments;
        vertices.push(u - 0.5, v - 0.5, u, v);
      }
    }
    const row = segments + 1;
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * row + i;
        indices.push(a, a + 1, a + row, a + row, a + 1, a + row + 1);
      }
    }
    return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
  }

  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }

  const lerp = (a, b, t) => (1 - t) * a + t * b;

  const UNITS_PER_CARD = 10;
  const IS_FIREFOX = /firefox/i.test(navigator.userAgent);

  class Gallery {
    constructor({ renderer, media, slides, params, zoomParams, hoverParams, overlay, labelsRoot }) {
      this.renderer = renderer;
      this.gl = renderer.gl;
      this.media = media;
      this.slides = slides;
      this.count = slides.length;
      this.params = params;
      this.zoomParams = zoomParams;
      this.hoverParams = hoverParams;
      this.overlay = overlay;

      this.currentX = 0;
      this.lastX = 0;
      this.offX = 0;
      this.onX = 0;
      this.isDragging = false;
      this.latency = 0;
      this.enabled = false;
      this.wheelTimer = null;
      this.snapTarget = null;

      this.zoom = { value: 0, center: 0, t: 0, sphere: 0, sphereEase: 0 };
      this.opening = null;
      this.divider = { p: 1 };
      this.visible = false;

      this.mouse = null;
      this.areas = new Map();

      this.touch = null;

      this.initGL();
      this.buildLabels(labelsRoot);
      this.layout();
      this.bindEvents();
    }

    initGL() {
      const gl = this.gl;
      this.card = createProgram(gl, CARD_VERTEX, CARD_FRAGMENT);
      this.card.position = gl.getAttribLocation(this.card.program, 'position');
      this.card.uv = gl.getAttribLocation(this.card.program, 'uv');

      const geometry = planeGeometry(this.params.segments);
      this.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
      this.indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
      this.indexCount = geometry.indices.length;

      gl.useProgram(this.card.program);
      gl.uniform1i(this.card.uniforms.uTexture, 0);
      gl.uniform3fv(this.card.uniforms.uOverlayColor, this.overlay.color);
    }

    buildLabels(root) {
      this.hovered = -1;
      this.labels = this.slides.map((slide) => {
        const el = document.createElement('div');
        el.className = 'blend h3 gallery-label';
        const parts = [slide.title.join(' '), isMobile() ? slide.category : meta(slide)].map((text) => {
          const mask = document.createElement('span');
          mask.className = 'line';
          const inner = document.createElement('span');
          inner.className = 'line-inner';
          inner.textContent = text;
          mask.appendChild(inner);
          el.appendChild(mask);
          return inner;
        });
        gsap.set(parts, { yPercent: 100 });
        root.appendChild(el);
        return { el, parts, wrap: 0, shown: false };
      });
    }

    showLabel(index, wrap) {
      const label = this.labels[index];
      label.wrap = wrap;
      label.shown = true;
      gsap.to(label.parts, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 1 / 15, overwrite: true });
    }

    hideLabel(index) {
      const label = this.labels[index];
      label.shown = false;
      gsap.to(label.parts, { yPercent: 100, duration: 1, ease: 'power4.out', stagger: 1 / 15, overwrite: true });
    }

    setHovered(index, wrap) {
      this.hoveredWrap = wrap;
      if (index === this.hovered) return;
      if (this.hovered >= 0) this.hideLabel(this.hovered);
      this.hovered = index;
      if (index >= 0) this.showLabel(index, wrap);
    }

    layout() {
      const oldSlot = this.slot;
      if (isMobile()) {
        const u = window.innerHeight / TOUCH.world;
        this.unit = u;
        this.px = window.innerWidth / 375;
        this.cardW = window.innerWidth - TOUCH.side;
        this.cardH = TOUCH.height * u;
        this.slot = this.cardW + TOUCH.gap * u;
      } else {
        const px = Math.min(Math.max(window.innerWidth, 1440), 2560) / 1440;
        this.unit = 0;
        this.px = px;
        this.cardW = CARD.w * px;
        this.cardH = CARD.h * px;
        this.slot = (CARD.w + CARD.gap) * px;
      }
      this.total = this.slot * this.count;
      if (oldSlot) {
        const k = this.slot / oldSlot;
        this.currentX *= k;
        this.lastX *= k;
        this.offX *= k;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const fov = 2 * Math.atan(h / 2 / this.params.cameraZ);
      this.projection = perspective(fov, w / h, 10, 1000);
    }

    bindEvents() {
      window.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
      window.addEventListener('mousedown', (e) => e.button === 0 && !this.unit && this.onDown(e.clientX, e.target));
      window.addEventListener('mousemove', (e) => !this.unit && this.onMove(e.clientX, e.clientY));
      window.addEventListener('mouseup', () => !this.unit && this.onUp());
      window.addEventListener(
        'touchstart',
        (e) => (this.unit ? this.onTouchStart(e.touches[0], e.target) : this.onDown(e.touches[0].clientX, e.target)),
        { passive: true },
      );
      window.addEventListener('touchmove', (e) => (this.unit ? this.onTouchMove(e.touches[0]) : this.onMove(e.touches[0].clientX, null)), {
        passive: true,
      });
      window.addEventListener('touchend', (e) => (this.unit ? this.onTouchEnd(e.changedTouches[0]) : this.onUp()));
      this.pointer = null;
    }

    onTouchStart(p, target) {
      if (!this.enabled || (target && target.closest && target.closest('[data-ui]'))) return;
      if (this.snapTween) this.snapTween.kill();
      this.snapTarget = null;
      this.touch = { x: p.clientX, y: p.clientY, index: Math.round(this.currentX / this.slot), from: this.currentX };
    }

    onTouchMove(p) {
      const t = this.touch;
      if (!t || !this.enabled) return;
      this.currentX = t.from + (p.clientX - t.x) * TOUCH.drag * this.unit;
    }

    onTouchEnd(p) {
      const t = this.touch;
      if (!t) return;
      this.touch = null;
      if (!this.enabled) return;
      const dx = p.clientX - t.x;
      if (Math.abs(dx) <= TOUCH.tap && this.onOpen) {
        const hit = this.cardAt(t.x, t.y);
        if (hit && this.onOpen(hit.i + hit.wrap * this.count)) return;
      }
      let index = t.index;
      if (dx > TOUCH.swipe) index += 1;
      else if (dx < -TOUCH.swipe) index -= 1;
      this.snapTween = gsap.to(this, { currentX: index * this.slot, ...TOUCH.snap, overwrite: true });
    }

    cardAt(px, py) {
      const x = px - window.innerWidth / 2;
      const y = py - window.innerHeight / 2;
      if (Math.abs(y) > this.cardH / 2) return null;
      for (let i = 0; i < this.count; i++) {
        for (const wrap of this.wraps(i)) {
          if (Math.abs(x - this.cardX(i, wrap)) <= this.cardW / 2) return { i, wrap };
        }
      }
      return null;
    }

    onWheel(e) {
      if (!this.enabled) return;
      const x = e.wheelDeltaX || -e.deltaX;
      const y = e.wheelDeltaY || -e.deltaY;
      let d = Math.abs(x) >= Math.abs(y) ? x : y;
      if (IS_FIREFOX && e.deltaMode === 1) d *= 60;
      d *= this.params.wheelScale;
      this.snapTarget = null;
      this.currentX += ((this.params.wheel * d) / UNITS_PER_CARD) * this.slot;
      this.offX = this.currentX;
      clearTimeout(this.wheelTimer);
      this.wheelTimer = setTimeout(() => this.onWheelEnd(), this.params.wheelEnd * 1000);
    }

    onWheelEnd() {
      this.startSnap();
    }

    startSnap() {
      this.snapTarget = -Math.round(-this.currentX / this.slot) * this.slot;
    }

    onDown(x, target) {
      if (!this.enabled || (target && target.closest && target.closest('[data-ui]'))) return;
      this.snapTarget = null;
      this.isDragging = true;
      this.onX = x;
      this.offX = this.currentX;
    }

    onMove(x, y) {
      if (y !== null) this.pointer = { x, y };
      if (!this.isDragging) return;
      this.currentX = this.offX + ((x - this.onX) * this.params.drag * this.slot) / UNITS_PER_CARD;
    }

    onUp() {
      if (!this.isDragging) return;
      this.isDragging = false;
      const moved = this.currentX !== this.offX;
      this.offX = this.currentX;
      if (!moved && this.hovered >= 0 && this.onOpen && this.onOpen(this.hovered + this.hoveredWrap * this.count)) return;
      this.startSnap();
    }

    get position() {
      return -this.lastX / this.slot;
    }

    cardRect(index) {
      const x = index * this.slot + this.lastX;
      return {
        x: window.innerWidth / 2 + x - this.cardW / 2,
        y: (window.innerHeight - this.cardH) / 2,
        w: this.cardW,
        h: this.cardH,
      };
    }

    setPosition(index) {
      clearTimeout(this.wheelTimer);
      if (this.snapTween) this.snapTween.kill();
      this.touch = null;
      this.prevX = undefined;
      this.snapTarget = null;
      this.isDragging = false;
      this.currentX = this.lastX = this.offX = -index * this.slot;
      this.latency = 0;
    }

    cardX(i, wrap) {
      return i * this.slot + this.lastX + wrap * this.total;
    }

    wraps(i) {
      const reach = window.innerWidth / 2 + this.cardW / 2;
      const base = Math.round(-(i * this.slot + this.lastX) / this.total);
      return [base - 1, base, base + 1].filter((w) => Math.abs(this.cardX(i, w)) < reach);
    }

    visibleMedia() {
      if (!this.visible) return [];
      return this.media.filter((m, i) => this.wraps(i).length > 0 || this.zoom.value < 1);
    }

    runZoom(to, onComplete) {
      const z = this.zoomParams;
      const from = this.zoom.value;
      const camera = window.innerHeight / 2 / Math.tan((22.5 * Math.PI) / 180);
      const end = (to === 1 ? SPHERE.gallery : SPHERE.slider) * factor() * (this.params.cameraZ / camera);
      const start = this.zoom.sphere;
      this.zoom.sphereEase = 0;
      gsap.fromTo(
        this.zoom,
        { t: 0 },
        {
          t: 1,
          duration: z.duration,
          ease: 'none',
          overwrite: true,
          onUpdate: () => {
            const t = this.zoom.t;
            this.zoom.value = from + (to - from) * EASE_ZOOM(t);
            const s = EASE_SPHERE(bell(t));
            if (Math.abs(s - this.zoom.sphereEase) < 0.5 || t === 0) {
              this.zoom.sphereEase = s;
              this.zoom.sphere = (t < 0.5 ? start : 0) + (end - (t < 0.5 ? start : 0)) * s;
            }
          },
          onComplete,
        },
      );
    }

    zoomOut(index, onComplete) {
      this.setPosition(index);
      this.zoom.center = index;
      this.visible = true;
      this.runZoom(1, onComplete);
    }

    showAt(index) {
      this.setPosition(index);
      Object.assign(this.zoom, { value: 1, center: index, t: 1, sphere: 0, sphereEase: 0 });
      this.visible = true;
    }

    resetZoom() {
      gsap.killTweensOf(this.zoom);
      Object.assign(this.zoom, { value: 0, t: 0, sphere: 0, sphereEase: 0 });
      this.visible = false;
    }

    zoomIn(onComplete, index = Math.round(this.position)) {
      this.enabled = false;
      this.isDragging = false;
      clearTimeout(this.wheelTimer);
      if (this.snapTween) this.snapTween.kill();
      this.touch = null;
      this.prevX = undefined;
      this.snapTarget = null;
      this.currentX = this.offX = -index * this.slot;
      this.zoom.center = index;
      this.hideLabels();
      this.runZoom(0, () => {
        this.visible = false;
        onComplete();
      });
      return index;
    }

    hideLabels() {
      const index = this.hovered;
      this.hovered = -1;
      if (index < 0) return;
      const label = this.labels[index];
      label.shown = false;
      gsap.to(label.parts, {
        yPercent: -110,
        duration: 0.7,
        ease: EASE_HIDE,
        overwrite: true,
        onComplete: () => gsap.set(label.parts, { yPercent: 100 }),
      });
    }

    update(dt) {
      if (!this.visible) return;
      const frames = dt / (1000 / 60);
      const damp = (a, b, t) => a + (b - a) * (1 - Math.pow(1 - t, frames));
      if (this.snapTarget !== null) {
        this.currentX = damp(this.currentX, this.snapTarget, this.params.snap);
        if (Math.abs(this.snapTarget - this.currentX) < 0.01) {
          this.currentX = this.offX = this.snapTarget;
          this.snapTarget = null;
        }
        this.offX = this.currentX;
      }
      let lag;
      if (this.unit) {
        const step = this.prevX === undefined || frames <= 0 ? 0 : (this.currentX - this.prevX) / frames;
        this.prevX = this.lastX = this.currentX;
        lag = (step * (1 - this.params.ease)) / this.params.ease;
      } else {
        this.lastX = damp(this.lastX, this.currentX, this.params.ease);
        if (Math.abs(this.currentX - this.lastX) < 0.01) this.lastX = this.currentX;
        lag = this.currentX - this.lastX;
      }
      const units = (lag / this.slot) * UNITS_PER_CARD;
      this.latency = damp(this.latency, Math.min(Math.abs(this.params.latency * units), this.params.latencyMax), this.params.latencyEase);

      if (this.unit) this.updateCentre();
      else this.updateHover();
      this.updateLabels();
      this.updateAreas(frames);
    }

    updateCentre() {
      if (!this.enabled || this.zoom.value < 1) {
        if (this.hovered >= 0 && !this.enabled) this.setHovered(-1);
        return;
      }
      if (this.touch || (this.snapTween && this.snapTween.isActive())) return;
      const centre = Math.round(this.position);
      const i = ((centre % this.count) + this.count) % this.count;
      this.setHovered(i, Math.round((centre - i) / this.count));
    }

    updateAreas(frames) {
      const damp = (a, b, t) => a + (b - a) * (1 - Math.pow(1 - t, frames));
      const p = this.pointer;
      if (p) {
        if (!this.mouse) this.mouse = { x: p.x, y: p.y };
        this.mouse.x = damp(this.mouse.x, p.x, this.hoverParams.mouse);
        this.mouse.y = damp(this.mouse.y, p.y, this.hoverParams.mouse);
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cards = this.cards();
      cards.forEach(({ key }) => !this.areas.has(key) && this.areas.set(key, { targ: 0, curr: 0, currR: 0 }));
      this.areas.forEach((area, key) => {
        const card = cards.find((c) => c.key === key);
        let inside = false;
        if (card && p && this.enabled) {
          const [cx, cy, cw, ch] = card.rect;
          const left = w / 2 + cx - cw / 2;
          const top = h / 2 - cy - ch / 2;
          inside = p.x >= left && p.x <= left + cw && p.y >= top && p.y <= top + ch;
        }
        area.targ = inside ? 1 : 0;
        area.curr = damp(area.curr, area.targ, this.hoverParams.area);
        area.currR = Math.round(area.curr * 100) / 100;
        if (!card && area.currR === 0) this.areas.delete(key);
      });
    }

    updateHover() {
      if (!this.enabled || !this.pointer || this.zoom.value < 1) {
        if (this.hovered >= 0 && !this.enabled) this.setHovered(-1);
        return;
      }
      const hit = this.cardAt(this.pointer.x, this.pointer.y);
      this.setHovered(hit ? hit.i : -1, hit ? hit.wrap : 0);
    }

    updateLabels() {
      const below = window.innerHeight / 2 + this.cardH / 2;
      this.labels.forEach((label, i) => {
        if (!label.shown && gsap.getProperty(label.parts[label.parts.length - 1], 'yPercent') >= 100) return;
        const top = below + (this.unit ? TOUCH.gap * this.unit : LABEL_GAP * this.px);
        const left = window.innerWidth / 2 + this.cardX(i, label.wrap) - this.cardW / 2;
        label.el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        label.el.style.width = `${this.cardW}px`;
      });
    }

    zoomRect(i, wrap) {
      const e = this.zoom.value;
      const k = i + wrap * this.count - this.zoom.center;
      let x = this.cardX(i, wrap);
      if (k === 0) {
        return [x * e, 0, lerp(window.innerWidth, this.cardW, e), lerp(window.innerHeight, this.cardH, e)];
      }
      x += Math.sign(k) * (2 * Math.abs(k) + 1) * this.slot * (1 - e);
      return [x, 0, this.cardW, this.cardH];
    }

    cards() {
      const e = this.zoom.value;
      const list = [];
      const centre = ((this.zoom.center % this.count) + this.count) % this.count;
      for (let i = 0; i < this.count; i++) {
        const wraps = e < 1 ? [Math.round((this.zoom.center - i) / this.count)] : this.wraps(i);
        wraps.forEach((wrap) => {
          const key = i + wrap * this.count;
          const rect = e < 1 ? this.zoomRect(i, wrap) : [this.cardX(i, wrap), 0, this.cardW, this.cardH];
          if (this.opening && e >= 1) {
            const k = key - this.opening.index;
            if (k === 0) return;
            const end = Math.sign(k) * (3 * Math.abs(k) + 1) * this.slot;
            rect[0] = lerp(rect[0], end, this.opening.spread);
          }
          list.push({ i, key, rect, centre: e < 1 && i === centre });
        });
      }
      return list.sort((a, b) => a.centre - b.centre);
    }

    revealDivider() {
      gsap.fromTo(this.divider, { p: 0 }, { p: 1, duration: DIVIDER.draw, ease: EASE_SHOW, overwrite: true });
    }

    dividerBox() {
      const c = window.innerHeight / 2;
      const top = DIVIDER.top * this.px;
      const bottom = window.innerHeight - DIVIDER.bottom * this.px;
      const p = this.divider.p;
      return { x: Math.round(window.innerWidth / 2 - 0.5), top: c - (c - top) * p, bottom: c + (bottom - c) * p };
    }

    drawDivider() {
      if (this.opening && !this.opening.reveal) return;
      const gl = this.gl;
      const k = gl.canvas.width / window.innerWidth;
      const { top, bottom } = this.dividerBox();
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.round((window.innerWidth / 2 - 0.5) * k), Math.round((window.innerHeight - bottom) * k), Math.max(1, Math.round(k)), Math.round((bottom - top) * k));
      gl.clearColor(...DIVIDER.color, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.clearColor(...PAGE, 1);
      gl.disable(gl.SCISSOR_TEST);
    }

    render(now) {
      if (!this.visible) return;
      this.drawDivider();
      const gl = this.gl;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const e = this.zoom.value;

      const u = this.card.uniforms;
      gl.useProgram(this.card.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.enableVertexAttribArray(this.card.position);
      gl.vertexAttribPointer(this.card.position, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(this.card.uv);
      gl.vertexAttribPointer(this.card.uv, 2, gl.FLOAT, false, 16, 8);
      gl.uniformMatrix4fv(u.uProjection, false, this.projection);
      gl.uniform1f(u.uCameraZ, this.params.cameraZ);
      const camera = h / 2 / Math.tan((22.5 * Math.PI) / 180);
      gl.uniform1f(u.uCurve, this.params.curve * (h / 1080) * this.latency * (this.params.cameraZ / camera) * e);
      gl.uniform1f(u.uCurveFlat, this.params.curveFlat * w);
      gl.activeTexture(gl.TEXTURE0);

      const hp = this.hoverParams;
      const mouse = this.mouse || { x: -1e4, y: -1e4 };
      gl.uniform2f(u.uGlPerPx, hp.winGl / w, hp.winGl / h);
      gl.uniform2f(u.uMouse, (mouse.x - w / 2) * (hp.winGl / w), (h / 2 - mouse.y) * (hp.winGl / h));
      gl.uniform1f(u.uTime, now / 300);
      gl.uniform1f(u.uAreaMax, hp.dmax);

      this.cards().forEach(({ i, key, rect, centre }) => {
        const m = this.media[i];
        gl.bindTexture(gl.TEXTURE_2D, (m.uploaded && m.texture) || this.renderer.blank);
        gl.uniform4f(u.uRect, rect[0], rect[1], rect[2], rect[3]);
        gl.uniform2f(u.uSphere, Math.abs(this.zoom.sphere) > 0.01 ? rect[2] : 0, this.zoom.sphere);
        gl.uniform2f(u.uAspect, m.width, m.height);
        gl.uniform1f(u.uZoom, centre ? lerp(m.zoom, 1, e) : 1);
        gl.uniform1f(u.uOverlayOpacity, centre ? lerp(this.overlay.opacity, 0, e) : 0);
        const area = this.areas.get(key);
        gl.uniform1f(u.uArea, area ? area.currR : 0);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
      });
    }
  }
  return { EASE_ZOOM, EASE_SPHERE, EASE_HIDE, EASE_SHOW, SPHERE, bell, factor, DIVIDER, Gallery };
})();

// ───────────── main ─────────────
// Каталог кейсов: 01 — слайдер, 02 — галерея (движок референса herasymenkox.com, адаптирован под сайт).
// Убрано: звук, орбита (режим 03), прелоадер-плитки, оверлей открытия кейса, часы, переходы-вуаль.
// Клик по карточке ведёт на страницу кейса Hugo (slide.url), если она существует.
const { cloneDefaults, OVERLAY } = __config;
const { meta, SLIDES } = __data;
const { EASE_HIDE, EASE_SHOW, Gallery } = __gallery;
const { bezier } = __ease;
const { Renderer } = __gl;
const { maskUI, revealUI } = __preloader;
const { SlideScroll } = __scroll;
const { Ruler } = __ruler;
const { Stepper } = __stepper;
const { ScrubText, splitChars } = __text;
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

})();
