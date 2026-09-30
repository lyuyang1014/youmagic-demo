// Shared helpers for every section module. Keep dependency-free (gsap is global).

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
export const smooth = (t) => t * t * (3 - 2 * t);
export const reduced = () => document.documentElement.classList.contains('reduced');

/** html`...` → DocumentFragment ; single root → that element */
export function html(strings, ...vals) {
  const t = document.createElement('template');
  t.innerHTML = strings.reduce((acc, s, i) => acc + s + (i < vals.length ? (vals[i] ?? '') : ''), '').trim();
  return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
}

/** create an SVG element with attributes */
export function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

/** Run `enter` when el is on screen, `leave` when it goes off (for pausing rAF loops). */
export function whenVisible(el, enter, leave, rootMargin = '10% 0px') {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? enter : leave)?.();
  }, { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/** rAF loop that only runs while `el` is visible. fn(dt seconds, t seconds). returns controller */
export function visibleLoop(el, fn) {
  let raf = 0, last = 0, running = false, t = 0;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now; t += dt;
    fn(dt, t);
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  whenVisible(el, start, stop, '15% 0px');
  return { start, stop, get running() { return running; } };
}

/** Size a canvas to its CSS box × devicePixelRatio. Returns {w,h,dpr}. Call on resize. */
export function fitCanvas(canvas, maxDpr = 2) {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr, cssW: r.width, cssH: r.height };
}

export function onResize(fn) {
  let id = 0;
  const h = () => { cancelAnimationFrame(id); id = requestAnimationFrame(fn); };
  window.addEventListener('resize', h);
  return () => window.removeEventListener('resize', h);
}

/* ---------- colour scales ---------- */
const HEAT = ['#0b1030', '#2a1548', '#6a2a8c', '#b8307a', '#f0603f', '#ffc45e', '#fff4d6'].map(hexToRgb);
export function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/** t in [0,1] → [r,g,b] on the brand heat scale */
export function heatRGB(t) {
  t = clamp(t) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(t)), f = t - i;
  const a = HEAT[i], b = HEAT[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const heatCSS = (t) => { const [r, g, b] = heatRGB(t); return `rgb(${r | 0},${g | 0},${b | 0})`; };
/** 256-entry Uint8 LUT (RGB) for fast canvas painting */
export function heatLUT() {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const c = heatRGB(i / 255); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  return lut;
}

/* ---------- number animation ---------- */
export function countUp(el, to, { from = 0, decimals = 0, duration = 1.6, suffix = '', delay = 0 } = {}) {
  const o = { v: from };
  const fmt = (v) => v.toFixed(decimals) + suffix;
  if (reduced() || !window.gsap) { el.textContent = fmt(to); return; }
  el.textContent = fmt(from);
  return window.gsap.to(o, { v: to, duration, delay, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)) });
}

/** countUp that fires when element scrolls into view (once) */
export function countOnView(el, to, opts = {}) {
  const fmt = (v) => v.toFixed(opts.decimals || 0) + (opts.suffix || '');
  el.textContent = fmt(opts.from || 0);
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); countUp(el, to, opts); }
  }, { threshold: 0.4 });
  io.observe(el);
}

/* ---------- YM5 energy model (IFU §7.5 / §14) ---------- */
export const LEVELS = Array.from({ length: 16 }, (_, i) => (i + 1) * 0.5); // 0.5 … 8
export const PULSES = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
export const TIP_AREA = 4.0; // cm², YM5-TP4-900
export const levelPower = (lv) => 15 + 20 * lv; // 0.5→25 W … 8→175 W (+10 W / 0.5 step)
const r1 = (v) => Math.round(v * 10 + 1e-9) / 10;
export const density = (lv, p) => r1((levelPower(lv) * p) / TIP_AREA); // J/cm²
const MIN_PULSE = { 0.5: 1.0, 1: 0.9, 1.5: 0.8 };
/** matches the blank cells of the IFU energy output table */
export const isAllowed = (lv, p) => p + 1e-9 >= (MIN_PULSE[lv] ?? 0.7) && density(lv, p) <= 38.8 + 1e-9;
export const BANDS = [
  { key: 'low', label: '低', min: 6.3, max: 16.3, color: 'var(--lv-low)', hex: '#3fbf7f', coolRange: [1, 2], coolDefault: 1 },
  { key: 'mid', label: '中', min: 16.4, max: 23.8, color: 'var(--lv-mid)', hex: '#f2a44b', coolRange: [1, 2, 3], coolDefault: 2 },
  { key: 'high', label: '较高', min: 23.9, max: 31.3, color: 'var(--lv-high)', hex: '#e27ab8', coolRange: [2, 3, 4], coolDefault: 2 },
  { key: 'max', label: '高', min: 31.4, max: 38.8, color: 'var(--lv-max)', hex: '#b0283e', coolRange: [2, 3, 4], coolDefault: 3 },
];
export const bandOf = (e) => BANDS.find((b) => e <= b.max + 1e-9) || BANDS[3];
