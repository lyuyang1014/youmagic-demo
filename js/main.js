// App bootstrap: smooth scroll, global chrome, section modules, reveal system.
import * as lib from './lib.js';
import { DATA } from './data.js';

import hero from './sections/hero.js';
import heritage from './sections/heritage.js';
import core7 from './sections/core7.js';
import mechanism from './sections/mechanism.js';
import skinlab from './sections/skinlab.js';
import collagen from './sections/collagen.js';
import pulse from './sections/pulse.js';
import consoleSec from './sections/console.js';
import impedance from './sections/impedance.js';
import verify from './sections/verify.js';
import protocol from './sections/protocol.js';
import clinical from './sections/clinical.js';
import results from './sections/results.js';
import safety from './sections/safety.js';
import specs from './sections/specs.js';
import footer from './sections/footer.js';

const MODULES = [hero, heritage, core7, mechanism, skinlab, collagen, pulse, consoleSec, impedance, verify, protocol, clinical, results, safety, specs, footer];

const { gsap, ScrollTrigger } = window;
const root = document.documentElement;
const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (isReduced) root.classList.add('reduced');
root.classList.remove('no-js');

gsap.registerPlugin(ScrollTrigger);
if (window.SplitText) gsap.registerPlugin(window.SplitText);

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!isReduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
export const scrollTo = (target) => {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -40, duration: 1.4 });
  else el.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth' });
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); scrollTo(id); }
});

/* ---------- section modules ---------- */
const ctx = { gsap, ScrollTrigger, lib, data: DATA, scrollTo, reduced: isReduced, get lenis() { return lenis; } };

async function boot() {
  for (const m of MODULES) {
    const el = document.getElementById(m.id);
    if (!el) { console.warn('missing section', m.id); continue; }
    try { await m.init(el, ctx); }
    catch (err) { console.error(`[section ${m.id}]`, err); }
  }
  setupReveal();
  setupChrome();
  await document.fonts?.ready;
  ScrollTrigger.refresh();
  requestAnimationFrame(() => document.querySelector('.loader')?.classList.add('is-done'));
  proGate();
}

/* ---------- professional-audience gate (医疗器械广告合规：仅供专业人士) ---------- */
function proGate() {
  let ok = false;
  try { ok = localStorage.getItem('ym-pro-ok') === '1'; } catch (e) { /* storage blocked */ }
  if (ok || navigator.webdriver || new URLSearchParams(location.search).has('pro')) return;
  const el = document.createElement('div');
  el.className = 'progate';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'progate-t');
  el.innerHTML = `<div class="progate__card">
      <div class="logo">YŌUMAGIC<sup>®</sup></div>
      <h2 id="progate-t" class="h3">本网站内容仅供医疗机构及医疗专业人士参阅</h2>
      <p class="small">YM5 射频皮肤治疗仪（${DATA.product.regNo}）为医疗器械，须在医疗机构中由有资质的医务人员经培训合格后使用。禁忌内容或者注意事项详见说明书。</p>
      <div class="progate__btns">
        <button class="btn btn--primary" data-ok>我是医疗专业人士，继续浏览</button>
        <button class="btn" data-no>我不是</button>
      </div>
      <p class="micro progate__msg" hidden>感谢关注。本网站内容面向医疗专业人士，如需了解治疗，请咨询正规医疗机构的医生。</p>
    </div>`;
  document.body.appendChild(el);
  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
  const okBtn = el.querySelector('[data-ok]');
  okBtn.focus();
  okBtn.addEventListener('click', () => {
    try { localStorage.setItem('ym-pro-ok', '1'); } catch (e) { /* ignore */ }
    el.classList.add('is-out');
    document.documentElement.style.overflow = '';
    lenis?.start();
    setTimeout(() => el.remove(), 600);
  });
  el.querySelector('[data-no]').addEventListener('click', () => {
    el.querySelector('.progate__msg').hidden = false;
    el.querySelector('.progate__btns').hidden = true;
  });
}

/* ---------- [data-reveal] system ---------- */
function setupReveal() {
  const items = gsap.utils.toArray('[data-reveal]');
  if (isReduced) { gsap.set(items, { opacity: 1, y: 0, scale: 1 }); return; }
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
}

/* ---------- top bar, rail, progress ---------- */
function setupChrome() {
  const bar = document.querySelector('.topbar');
  const prog = document.querySelector('.progress');
  const rail = document.querySelector('.rail');
  const sections = MODULES.filter((m) => m.nav).map((m) => ({ id: m.id, label: m.nav }));

  // build nav + rail from module metadata
  const nav = document.querySelector('.topnav');
  for (const s of sections) {
    nav?.insertAdjacentHTML('beforeend', `<a href="#${s.id}" data-nav="${s.id}">${s.label}</a>`);
    rail?.insertAdjacentHTML('beforeend', `<a href="#${s.id}" data-nav="${s.id}" aria-label="${s.label}"><span>${s.label}</span></a>`);
  }
  const links = document.querySelectorAll('[data-nav]');
  for (const s of sections) {
    ScrollTrigger.create({
      trigger: '#' + s.id, start: 'top 50%', end: 'bottom 50%',
      onToggle: (st) => { if (st.isActive) links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === s.id)); },
    });
  }
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      const y = st.scroll();
      prog && (prog.style.transform = `scaleX(${st.progress})`);
      bar?.classList.toggle('is-solid', y > 40);
      bar?.classList.toggle('is-hidden', y > 600 && y > lastY + 2);
      if (y < lastY - 2) bar?.classList.remove('is-hidden');
      lastY = y;
    },
  });
}

boot();
