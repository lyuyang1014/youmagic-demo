// YM3D · host — website-only helper that mounts a YM3D scene into a container with a
// strict WebGL budget. A long page with ~12 3D sections must never hold more than a few
// live WebGL contexts (browsers drop the oldest beyond ~16). So each mount:
//   • creates its renderer lazily when the container comes within `margin` of the viewport,
//   • runs a rAF loop only while actually on screen,
//   • fully disposes (renderer + loseContext) when it goes far away (beyond `farMargin`),
//     and rebuilds next time — keep your LOGICAL state (sliders, stage index) outside.
//
// usage (inside a section module):
//   import * as THREE from 'three';
//   import * as S from '../ym3d/stage.mjs';
//   import { mount3D } from '../ym3d/host.mjs';
//   const m = mount3D(el, {
//     THREE, stageLib: S, dpr: 1.5, stageOpts: { fov: 30, transparent: true },
//     build(stage) { const dev = createDevice(THREE, {}); stage.scene.add(dev.object3d); return { dev }; },
//     frame(state, stage, t, dt) { state.dev.update({ t, turntable: t * 0.3 }); stage.orbit(view); stage.render(); },
//     dispose(state) { state.dev.dispose(); },
//   });
//   m.invalidate();   // request a redraw when paused (e.g. after a slider change)
//   m.pointer         // { x, y } in -1..1 while hovering, for parallax / drag
//   m.drag            // { azimuth, elevation } accumulated from pointer drag (if opts.draggable)

const live = new Set();

export function mount3D(container, opts) {
  const o = { dpr: 1.5, margin: '40% 0px', farMargin: '160% 0px', draggable: false, stageOpts: {}, fallback: null, ...opts };
  const { THREE, stageLib } = o;
  const canvas = document.createElement('canvas');
  canvas.className = 'ym3d-canvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(canvas);

  let stage = null, state = null, raf = 0, onScreen = false, t0 = 0, last = 0, dirty = true;
  const api = { pointer: { x: 0, y: 0, inside: false }, drag: { azimuth: 0, elevation: 0, active: false }, get stage() { return stage; }, get state() { return state; } };

  const size = () => { const r = container.getBoundingClientRect(); return { w: Math.max(2, Math.round(r.width)), h: Math.max(2, Math.round(r.height)) }; };
  const dpr = () => Math.min(o.dpr, window.devicePixelRatio || 1);

  function build() {
    if (stage) return;
    try {
      const { w, h } = size();
      stage = stageLib.createStage(THREE, canvas, { width: w, height: h, dpr: dpr(), ...o.stageOpts });
      state = o.build(stage) || {};
      live.add(api); dirty = true;
    } catch (err) {
      console.warn('[ym3d] WebGL unavailable', err); stage = null;
      if (o.fallback) o.fallback(container);
    }
  }
  function destroy() {
    if (!stage) return;
    stop();
    try { o.dispose?.(state); } catch (e) { /* ignore */ }
    try { stage.dispose(); stage.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    stage = null; state = null; live.delete(api);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!stage) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
    const t = (now - t0) / 1000;
    o.frame(state, stage, t, dt, api);
    dirty = false;
  }
  function start() { if (raf || !stage) return; last = 0; if (!t0) t0 = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  const near = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) build(); }, { rootMargin: o.margin });
  const far = new IntersectionObserver((es) => { for (const e of es) if (!e.isIntersecting) destroy(); }, { rootMargin: o.farMargin });
  const vis = new IntersectionObserver((es) => { for (const e of es) { onScreen = e.isIntersecting; if (onScreen) { build(); start(); } else stop(); } }, { rootMargin: '0px' });
  near.observe(container); far.observe(container); vis.observe(container);

  const ro = new ResizeObserver(() => { if (!stage) return; const { w, h } = size(); stage.renderer.setPixelRatio(dpr()); stage.setSize(w, h); dirty = true; if (!raf) o.frame(state, stage, (performance.now() - t0) / 1000, 0, api); });
  ro.observe(container);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (onScreen) start(); });

  // pointer / drag
  let px = 0, py = 0;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    api.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; api.pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1); api.pointer.inside = true;
    if (o.draggable && api.drag.active) { api.drag.azimuth -= (e.clientX - px) * 0.008; api.drag.elevation = Math.max(-0.6, Math.min(1.2, api.drag.elevation + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; dirty = true; }
  });
  canvas.addEventListener('pointerleave', () => { api.pointer.inside = false; });
  if (o.draggable) {
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', (e) => { api.drag.active = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
    const up = () => { api.drag.active = false; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }

  api.invalidate = () => { dirty = true; if (stage && !raf) o.frame(state, stage, (performance.now() - t0) / 1000, 0, api); };
  api.destroy = () => { near.disconnect(); far.disconnect(); vis.disconnect(); ro.disconnect(); destroy(); canvas.remove(); };
  api.canvas = canvas;
  return api;
}

export const liveCount = () => live.size;
