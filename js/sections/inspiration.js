// #inspiration — 设计灵感 · 取意清华园 (DESIGN ORIGIN)
// Client brief: “这个设备外观设计理念是从清华门来的灵感 —— 从清华门、清华紫到设备外观的过渡”.
// One WebGL scene (ym3d/gate.mjs createGateMorph + device.mjs createDevice, one context via mount3D):
//   white 3D 二校门 → 清华紫 #660874 floods the doorway → the arch outline lifts off and morphs point-for-point into
//   the YM5 console's stadium rim + round screen ring → the stone dissolves → the real console scans in (brand violet).
// Desktop (≥760 × ≥600): the stage is pinned (section total 260vh) and scroll progress u drives
//   gate.sequence(u) · gate.deviceBlend() (device rim / screen, host key & rim light multipliers) · gate.cameraAt(u).
// Mobile / short screens: not pinned — the sequence plays by itself once the stage is in view (tap to pause / resume /
//   replay; tap a beat to jump to it). Replay + drag-to-orbit are offered only in the end state.
// Reduced motion: the end state (still frame, drag allowed) + a static 3-frame strip rendered once from the same scene.
// The DOM copy (3 beats, 清华紫 → 设备紫 colour chip) is synced to u. The inspiration story is the brand's own statement.
import * as THREE from 'three';
import * as S from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createDevice } from '../ym3d/device.mjs';
import { createGateMorph, gateSequence } from '../ym3d/gate.mjs';

// host.mjs workaround (library issue, same as heritage / core7 / hero): mount3D rebuilds on the SAME canvas after its
// far-away destroy() called forceContextLoss(), so the second build fails. Re-mount on a fresh canvas right after each
// far-away dispose; pointer listeners live on the container.
function mountFresh(container, opts) {
  const h = { m: null, get canvas() { return h.m?.canvas; }, get state() { return h.m?.state; }, invalidate() { h.m?.invalidate(); } };
  const make = () => {
    const m = mount3D(container, {
      ...opts,
      dispose(s) { opts.dispose?.(s); setTimeout(() => { if (h.m === m) { m.destroy(); make(); } }, 0); },
    });
    h.m = m;
  };
  make();
  return h;
}
// Kick off every program right after build() so the first on-screen frame doesn't freeze the scroll while ~40
// programs (stone dissolve, outline shells, embers, device scan-in) compile. renderer.compile() only issues
// compile/link (status is read lazily, KHR_parallel_shader_compile compiles in the background) — unlike
// compileAsync() it leaves no polling timer behind, which throws (“reading 'isReady'”) if the mount is disposed
// before every program is ready.
const precompileLib = (lib) => ({
  ...lib,
  createStage(T, canvas, opts) {
    const st = lib.createStage(T, canvas, opts);
    queueMicrotask(() => { try { if (!st.renderer.getContext().isContextLost()) st.renderer.compile(st.scene, st.camera); } catch (e) { /* lost context */ } });
    return st;
  },
});

const TP = '#660874'; // 清华紫 (Tsinghua purple, gate.mjs TSINGHUA_PURPLE)
const DV = '#8a5cf0'; // 设备紫 (brand / device violet, DESIGN.md)
const BEATS = [
  { k: '01', title: '二校门的拱门轮廓', text: '清华园二校门的半圆拱门与门洞轮廓，是 YM5 主机外观的设计起点。', from: 0, to: 0.28 },
  { k: '02', title: '化作机身与屏幕的线条', text: '拱门的弧线被提炼为主机正面的跑道形轮廓，与圆形屏幕的外环。', from: 0.28, to: 0.58 },
  { k: '03', title: '清华紫，化作点亮机身的光', text: '清华紫过渡为设备紫，成为勾勒机身与屏幕的光。', from: 0.58, to: 1 },
];
const STRIP_U = [0.2, 0.52, 1]; // reduced-motion 3-frame strip
const BEAT_VIEW = [0, 0.42, 1];   // beat button (pinned): scroll to the frame that shows it best
const BEAT_PLAY = [0, 0.3, 0.6];  // beat button (not pinned): play on from there
const HOLD0 = 0.05, HOLD1 = 0.17; // desktop pin: a short white-gate hold, then an end-state hold for replay / orbit
const KEY_I = 2.7, RIM_I = 0.9;   // device-hero light values (fx3d/gate.html), scaled by deviceBlend().stageKey / .stageRim
const T_STILL = 3.2;              // deterministic time for still frames (reduced motion)
const PLAY_DESK = 8, PLAY_MOB = 9; // seconds for a replay / the mobile auto-play

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const RGB_TP = hex2rgb(TP), RGB_DV = hex2rgb(DV);

/* simple line icons: no-WebGL fallback + base layer of the reduced-motion strip */
const ICON = {
  gate: '<path class="d" d="M8 142H112M14 142V54H106V142M10 54V42H110V54M18 42V28H48V42M72 42V28H102V42M24 142V64M96 142V64"/><path class="k" d="M44 142V88a16 16 0 0 1 32 0V142"/>',
  morph: '<path class="d f" d="M14 142V54H106V142M44 142V88a16 16 0 0 1 32 0V142"/><path class="k" d="M44 56a16 16 0 0 1 32 0V120a16 16 0 0 1-32 0Z"/><circle class="k" cx="60" cy="56" r="11.5"/>',
  device: '<path class="d" d="M42 132V52a18 18 0 0 1 36 0V132Z"/><path class="k" d="M46 52a14 14 0 0 1 28 0V122a14 14 0 0 1-28 0Z"/><circle class="k" cx="60" cy="52" r="10.5"/><ellipse class="d" cx="60" cy="140" rx="26" ry="5"/>',
};
const icon = (k) => `<svg viewBox="0 0 120 150" aria-hidden="true" focusable="false">${ICON[k]}</svg>`;

export default {
  id: 'inspiration',
  nav: '设计灵感',
  async init(root, ctx) {
    const { gsap, ScrollTrigger, reduced } = ctx;

    root.innerHTML = `
<div class="ins__stage">
  <header class="ins__head">
    <span class="eyebrow">DESIGN ORIGIN · 设计灵感</span>
    <h2 class="h2 ins__h">取意<span class="ins__tp">清华园</span>，<br>化作机身线条</h2>
    <p class="ins__lead">YM5 主机的外观设计理念，源自清华园二校门。</p>
  </header>

  <div class="ins__gl">
    <div class="ins__cv" aria-hidden="true"></div>
    <div class="ins__fb" aria-hidden="true">${icon('gate')}<span class="ins__fb-arrow"></span>${icon('device')}</div>
    <div class="ins__shade" aria-hidden="true"></div>
    <p class="ins__cap" aria-hidden="true"><span class="num">01</span><span>${BEATS[0].title}</span></p>
    <div class="ins__bar" aria-hidden="true"><i></i></div>
    <div class="ins__end">
      <span class="ins__hint" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4"/></svg>拖动旋转</span>
      <button class="btn ins__play" type="button"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path class="i-re" d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v2.8h-2.8"/><path class="i-pl" d="M5 3.5v9l7-4.5z"/><path class="i-pa" d="M5 3.5v9M11 3.5v9"/></svg><span>重播</span></button>
    </div>
  </div>

  <ol class="ins__beats">
    ${BEATS.map((b, i) => `
    <li class="ins__beat" data-i="${i}" style="--p:0">
      <button class="ins__bt" type="button" aria-current="false"><span class="ins__bn num">${b.k}</span><span class="ins__bh">${b.title}</span></button>
      <p class="ins__bp">${b.text}</p>
      ${i === 2 ? `
      <div class="ins__chip" role="img" aria-label="清华紫 ${TP} 过渡为设备紫 ${DV}">
        <span class="ins__sw"><i style="background:${TP}"></i><b>清华紫</b><code class="mono">${TP}</code></span>
        <span class="ins__ramp"><i class="ins__mk"></i></span>
        <span class="ins__sw"><i style="background:${DV}"></i><b>设备紫</b><code class="mono">${DV}</code></span>
      </div>` : ''}
    </li>`).join('')}
  </ol>

  <p class="ins__note">设计灵感说明来自品牌方；三维画面为设计示意。</p>
  <p class="ins__sr" aria-live="polite"></p>
</div>
${reduced ? `
<div class="wrap ins__strip">
  ${BEATS.map((b, i) => `
  <figure class="ins__fr">
    <div class="ins__frv">${icon(['gate', 'morph', 'device'][i])}<canvas aria-hidden="true"></canvas></div>
    <figcaption><span class="num">${b.k}</span>${b.title}</figcaption>
  </figure>`).join('')}
</div>` : ''}`;

    const $ = (s) => root.querySelector(s);
    const $$ = (s) => [...root.querySelectorAll(s)];
    const stageEl = $('.ins__stage'), glEl = $('.ins__gl'), cvEl = $('.ins__cv');
    const headEl = $('.ins__head'), beatsEl = $('.ins__beats'), beatEls = $$('.ins__beat');
    const capEl = $('.ins__cap'), capNum = capEl.children[0], capTxt = capEl.children[1];
    const barEl = $('.ins__bar i'), playBtn = $('.ins__play'), playLbl = playBtn.querySelector('span');
    const srEl = $('.ins__sr'), chipEl = $('.ins__chip');
    const strip = $$('.ins__fr').map((fig, i) => ({ fig, cv: fig.querySelector('canvas'), u: STRIP_U[i] }));
    if (reduced) root.classList.add('is-reduced');

    /* ---------------- state: u (0..1) from scroll (pinned) or from the player (mobile / replay) ---------------- */
    const mqPin = window.matchMedia('(min-width: 760px) and (min-height: 600px)');
    const mqSide = window.matchMedia('(min-width: 1000px) and (min-height: 600px) and (min-aspect-ratio: 6/5)');
    let pinned = mqPin.matches;
    let uScroll = 0;
    const play = { on: false, u: reduced ? 1 : 0, tw: null, base: 0, started: false, autoPaused: false };
    const curU = () => (reduced ? 1 : pinned ? (play.on ? play.u : uScroll) : play.u);
    const isPlaying = () => !!(play.tw && play.tw.isActive());
    const isEnd = (u) => u >= 0.985 && !isPlaying();

    /* ---------------- DOM sync (called on u change, never from the render loop) ---------------- */
    let activeBeat = -1, lastEnd = null, lastHex = '';
    const hexOf = (k) => '#' + RGB_TP.map((c, i) => Math.round(c + (RGB_DV[i] - c) * k).toString(16).padStart(2, '0')).join('');
    function syncDOM() {
      const u = curU();
      const i = u < BEATS[1].from ? 0 : u < BEATS[2].from ? 1 : 2;
      if (i !== activeBeat) {
        activeBeat = i;
        beatEls.forEach((el, j) => {
          el.classList.toggle('is-on', j === i);
          el.classList.toggle('is-done', j < i);
          el.querySelector('.ins__bt').setAttribute('aria-current', j === i ? 'step' : 'false');
        });
        capNum.textContent = BEATS[i].k; capTxt.textContent = BEATS[i].title;
        if (!reduced) srEl.textContent = `${BEATS[i].k} · ${BEATS[i].title}`;
      }
      beatEls.forEach((el, j) => el.style.setProperty('--p', clamp((u - BEATS[j].from) / (BEATS[j].to - BEATS[j].from)).toFixed(3)));
      // chip: hue shift of the outline (gate.mjs: seg(morph, .45, 1)) + the console lighting up (reveal)
      const q = gateSequence(u);
      const hueK = smooth((q.morph - 0.45) / 0.55);
      const k = clamp(0.45 * hueK + 0.55 * q.reveal);
      chipEl.style.setProperty('--k', k.toFixed(3));
      const hx = hexOf(k);
      if (hx !== lastHex) { chipEl.style.setProperty('--hc', hx); lastHex = hx; }
      barEl.style.transform = `scaleX(${u.toFixed(4)})`;
      const end = isEnd(u);
      if (end !== lastEnd) {
        lastEnd = end;
        root.classList.toggle('is-end', end);
        cvEl.classList.toggle('is-drag', end);
      }
      syncButton(u);
    }
    function syncButton(u = curU()) {
      let mode = 'replay';
      if (!pinned && !reduced) mode = isPlaying() ? 'pause' : u >= 0.999 ? 'replay' : 'play';
      playBtn.dataset.mode = mode;
      playLbl.textContent = mode === 'pause' ? '暂停' : mode === 'play' ? (u > 0.001 ? '继续' : '播放') : '重播';
      playBtn.setAttribute('aria-label', mode === 'replay' ? '重播设计灵感动画' : `${playLbl.textContent}设计灵感动画`);
    }

    /* ---------------- player (mobile sequence, desktop replay) ---------------- */
    function playFrom(from, dur) {
      play.tw?.kill();
      play.on = true; play.started = true; play.u = from; play.base = uScroll;
      play.tw = gsap.to(play, {
        u: 1, duration: dur * (1 - from), ease: 'none',
        onUpdate: syncDOM,
        onComplete: () => { play.tw = null; if (pinned) play.on = false; syncDOM(); },
      });
      syncDOM();
    }
    function stopPlay() { play.tw?.kill(); play.tw = null; if (pinned) play.on = false; syncDOM(); }
    playBtn.addEventListener('click', () => {
      if (reduced) return;
      const mode = playBtn.dataset.mode;
      if (mode === 'pause') { play.tw?.pause(); play.autoPaused = false; syncButton(); return; }
      if (mode === 'play' && play.tw) { play.tw.resume(); syncButton(); return; }
      if (mode === 'play') { playFrom(play.u >= 0.999 ? 0 : play.u, PLAY_MOB); return; }
      drag.az = drag.el = 0;
      playFrom(0, pinned ? PLAY_DESK : PLAY_MOB);
    });

    // beats are buttons: desktop → scroll to that part of the pinned sequence; mobile → play from that beat
    let pinST = null;
    beatEls.forEach((el, i) => el.querySelector('.ins__bt').addEventListener('click', () => {
      if (reduced) return;
      if (pinned && pinST) {
        stopPlay();
        const T = HOLD0 + 1 + HOLD1;
        const y = pinST.start + ((HOLD0 + BEAT_VIEW[i]) / T) * (pinST.end - pinST.start);
        if (ctx.lenis) ctx.lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
      } else if (!pinned) playFrom(BEAT_PLAY[i], PLAY_MOB);
    }));

    /* ---------------- layout → where the scene sits inside the canvas (view offset + zoom) ---------------- */
    const view = { cx: 0, cy: 0, k: 1, w: 0, h: 0 };
    function measure() {
      const g = cvEl.getBoundingClientRect();
      if (g.width < 2 || g.height < 2) return;
      let cx = g.width / 2, cy = g.height / 2, k = 1;
      if (pinned && mqSide.matches) {
        // copy column on the left → centre the scene in the free area to its right
        const colR = Math.max(headEl.getBoundingClientRect().right, beatsEl.getBoundingClientRect().right) - g.left;
        const free = Math.max(200, g.width - colR - 40);
        cx = colR + 24 + free / 2; cy = g.height * 0.55;
        k = Math.max(1.14, (0.9 * g.height) / free); // a little wider than the 16:9 reference: headroom under the top bar
      } else if (pinned) {
        // headline on top, beats at the bottom → scene in between, zoomed out to fit
        const top = headEl.getBoundingClientRect().bottom - g.top, bot = beatsEl.getBoundingClientRect().top - g.top;
        const free = Math.max(160, bot - top);
        cy = (top + bot) / 2;
        k = clamp((0.86 * g.height) / free, 1, 2.2);
        glEl.style.setProperty('--ey', `${Math.max(top, bot - 44).toFixed(1)}px`);
      } else {
        // the sequence camera is framed for 16:9 (vertical fov 30°): a portrait box needs to pull back so the gate
        // and the ember cloud of the morph keep their margins left and right
        k = clamp(g.height / g.width, 1.1, 1.6);
      }
      Object.assign(view, { cx, cy, k, w: g.width, h: g.height });
      glEl.style.setProperty('--cx', `${cx.toFixed(1)}px`);
      glEl.style.setProperty('--cy', `${cy.toFixed(1)}px`);
      m3?.invalidate();
    }

    /* ---------------- drag-to-orbit (end state only) ---------------- */
    const drag = { on: false, id: -1, x: 0, y: 0, az: 0, el: 0 };
    cvEl.addEventListener('pointerdown', (e) => {
      if (!isEnd(curU()) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag.on = true; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
      try { cvEl.setPointerCapture(e.pointerId); } catch (err) { /* capture unsupported */ }
      cvEl.classList.add('is-grab');
    });
    cvEl.addEventListener('pointermove', (e) => {
      if (!drag.on || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      drag.az = clamp(drag.az - dx * 0.0075, -1.35, 1.35);
      if (e.pointerType === 'mouse') drag.el = clamp(drag.el + dy * 0.004, -0.14, 0.42);
      m3?.invalidate();
    });
    const dragUp = (e) => { if (!drag.on || e.pointerId !== drag.id) return; drag.on = false; cvEl.classList.remove('is-grab'); };
    cvEl.addEventListener('pointerup', dragUp);
    cvEl.addEventListener('pointercancel', dragUp);
    cvEl.addEventListener('dblclick', () => { drag.az = drag.el = 0; m3?.invalidate(); });

    /* ---------------- 3D scene ---------------- */
    let m3 = null, stripDone = false, noGL = false;
    const _sz = new THREE.Vector2();
    function build(stg) {
      const small = !pinned || window.innerWidth < 760;
      const { scene } = stg;
      stg.renderer.domElement.setAttribute('aria-hidden', 'true');
      const key = stg.lights.key;
      // camera-left sequence → key from the right (fx3d/gate.html) models the columns and the console
      key.position.set(2.5, 4.1, 3.7); key.color.set(0xfff3e6); key.target.position.set(0, 0.8, 0); scene.add(key.target);
      Object.assign(key.shadow.camera, { left: -1.9, right: 1.9, top: 2.0, bottom: -1.4, near: 1, far: 14 });
      key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.022;
      if (small) key.shadow.mapSize.set(1024, 1024);
      stg.lights.fill.intensity = 0.2;
      // dark satin floor that dissolves into the stage (alphaMap is read from the GREEN channel → opaque grey levels)
      const fc = document.createElement('canvas'); fc.width = fc.height = 256;
      const g2 = fc.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, 256, 256);
      const gr = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
      [[0, 255], [0.28, 190], [0.5, 70], [0.72, 12], [1, 0]].forEach(([o, v]) => gr.addColorStop(o, `rgb(${v},${v},${v})`));
      g2.fillStyle = gr; g2.fillRect(0, 0, 256, 256);
      const floorTex = new THREE.CanvasTexture(fc);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 96).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.82, metalness: 0, alphaMap: floorTex, transparent: true, envMapIntensity: 0.3 }));
      floor.receiveShadow = true; scene.add(floor);
      scene.fog = new THREE.Fog(0x07070c, 8.4, 14); // melts the far floor into the backdrop at every camera u

      const dev = createDevice(THREE, { screenRes: small ? 768 : 1024, detail: small ? 'low' : 'high', internals: false, back: !small });
      scene.add(dev.object3d);
      const gate = createGateMorph(THREE, { deviceDims: dev.dims, detail: small ? 'low' : 'high', embers: small ? 800 : 1400 });
      scene.add(gate.object3d);
      gate.placeDevice(dev.object3d);
      gate.bindDevice(dev); // scan-in shader on the console's own materials; pixel-identical to the plain device at reveal 1
      root.classList.add('is-3d');
      if (reduced) requestAnimationFrame(() => m3?.invalidate()); // still frame + strip even before the loop starts
      return {
        dev, gate, floor, floorTex, still: '',
        seq: {}, blend: {}, cam: { target: [0, 0, 0] },
        orb: { target: [0, 0, 0], radius: 4, azimuth: 0, elevation: 0, fov: 30 },
        dp: { t: 0, rimGlow: 0.6, screen: 'logo' },
      };
    }
    function applyScene(s, stg, u, t, daz, del, k) {
      const seq = s.gate.sequence(u, s.seq); seq.t = t;
      s.gate.update(seq);
      const b = s.gate.deviceBlend(seq, s.blend);
      s.dev.object3d.visible = b.visible;
      s.dp.t = t; s.dp.rimGlow = b.rimGlow; s.dp.screen = b.screen;
      s.dev.update(s.dp); // turntable / explode / float stay 0 during the handoff (rest pose = morph target)
      stg.lights.key.intensity = KEY_I * b.stageKey;
      stg.lights.rim.intensity = RIM_I * b.stageRim;
      const c = s.gate.cameraAt(u, s.cam), o = s.orb;
      o.target = c.target; o.radius = c.radius * k; o.azimuth = c.azimuth + daz; o.elevation = c.elevation + del; o.fov = c.fov;
      stg.orbit(o);
      // distance fog is tuned for the reference camera radius: scale it with the host zoom, or a pulled-back camera
      // (tablet / phone framing) greys out the white stone
      const f = stg.scene.fog; if (f) { f.near = 8.4 * k; f.far = 14 * k; }
    }
    function renderStrip(s, stg) {
      const r = stg.renderer, cam = stg.camera, glc = r.domElement;
      r.getSize(_sz); const W = _sz.x, H = _sz.y;
      let ok = 0;
      for (const f of strip) {
        const b = f.cv.getBoundingClientRect();
        const w = Math.round(Math.min(640, b.width)), h = Math.round(Math.min(640, b.height));
        if (w < 40 || h < 40) continue;
        stg.setSize(w, h); cam.clearViewOffset();
        applyScene(s, stg, f.u, T_STILL, 0, 0, Math.max(1, (0.84 * h) / w));
        stg.render();
        f.cv.width = glc.width; f.cv.height = glc.height;
        f.cv.getContext('2d').drawImage(glc, 0, 0);
        f.fig.classList.add('is-ready'); ok++;
      }
      stg.setSize(W, H);
      stripDone = ok === strip.length;
    }
    function frame(s, stg, t, dt) {
      stg.renderer.getSize(_sz);
      const w = _sz.x, h = _sz.y;
      if (Math.abs(w - view.w) > 1 || Math.abs(h - view.h) > 1) measure();
      if (reduced && !stripDone && strip.length) { renderStrip(s, stg); s.still = ''; }
      const u = curU();
      if (!isEnd(u) && !drag.on && dt > 0) { const d = 1 - Math.exp(-dt * 3.5); drag.az -= drag.az * d; drag.el -= drag.el * d; }
      if (reduced) {
        const key = `${w}x${h}|${view.cx.toFixed(1)}|${view.cy.toFixed(1)}|${view.k.toFixed(3)}|${drag.az.toFixed(4)}|${drag.el.toFixed(4)}`;
        if (key === s.still) return;
        s.still = key;
      }
      applyScene(s, stg, u, reduced ? T_STILL : t, drag.az, drag.el, view.k);
      stg.camera.setViewOffset(w, h, w / 2 - view.cx * (w / Math.max(1, view.w)), h / 2 - view.cy * (h / Math.max(1, view.h)), w, h);
      stg.render();
    }
    function dispose(s) {
      if (!s) return;
      s.gate.dispose(); s.dev.dispose();
      s.floor.removeFromParent(); s.floor.geometry.dispose(); s.floor.material.dispose(); s.floorTex.dispose();
    }
    const start3D = () => {
      m3 = mountFresh(cvEl, {
        THREE, stageLib: precompileLib(S), dpr: 1.5, margin: '70% 0px', farMargin: '170% 0px',
        stageOpts: { fov: 30, exposure: 1.0 },
        build, frame, dispose,
        fallback: () => {
          noGL = true; root.classList.add('no-gl'); root.classList.remove('is-3d');
          if (!pinned && !reduced) { stopPlay(); play.u = 1; play.started = true; syncDOM(); } // nothing to play: show the whole story
        },
      });
      measure();
    };
    // the 清華園 plaque is a canvas texture in a Kai face: load it before the gate is created (YM3D host rule),
    // without holding up the rest of the page's boot
    const fontsReady = Promise.race([
      Promise.all(['bold 100px "Kaiti SC"', 'bold 100px "STKaiti"'].map((f) => document.fonts?.load(f))),
      new Promise((r) => setTimeout(r, 1200)),
    ]).catch(() => {});
    fontsReady.then(start3D);

    ctx.lib.onResize(measure);
    ScrollTrigger.addEventListener('refresh', measure);

    if (reduced) { syncDOM(); return; }

    /* ---------------- choreography ---------------- */
    const mm = gsap.matchMedia();
    mm.add({ pin: '(min-width: 760px) and (min-height: 600px)', flow: '(max-width: 759px), (max-height: 599px)' }, (c) => {
      pinned = !!c.conditions.pin;
      stopPlay(); play.on = false; play.u = noGL ? 1 : 0; play.started = noGL; uScroll = 0; drag.az = drag.el = 0;
      root.classList.toggle('is-pin', pinned);
      root.classList.toggle('is-flow', !pinned);
      if (pinned) {
        const prox = { u: 0 };
        const tl = gsap.timeline({
          onUpdate: () => {
            uScroll = prox.u;
            if (play.on && Math.abs(uScroll - play.base) > 0.012) stopPlay(); // the visitor scrolled: scroll owns u again
            syncDOM();
          },
          scrollTrigger: { trigger: stageEl, start: 'top top', end: '+=160%', pin: true, pinSpacing: true, scrub: 0.6, anticipatePin: 1 },
        });
        tl.to({}, { duration: HOLD0 })
          .fromTo(prox, { u: 0 }, { u: 1, duration: 1, ease: 'none', immediateRender: false })
          .to({}, { duration: HOLD1 });
        pinST = tl.scrollTrigger;
        syncDOM(); requestAnimationFrame(measure);
        return () => { pinST = null; };
      }
      // not pinned: the sequence plays by itself once the stage is well in view; pauses when it leaves
      const io = new IntersectionObserver((es) => {
        for (const e of es) {
          if (e.intersectionRatio >= 0.6) {
            if (noGL) return;
            if (!play.started) playFrom(0, PLAY_MOB);
            else if (play.autoPaused && play.tw) { play.autoPaused = false; play.tw.resume(); syncButton(); }
          } else if (e.intersectionRatio < 0.25 && isPlaying()) { play.tw.pause(); play.autoPaused = true; syncButton(); }
        }
      }, { threshold: [0, 0.25, 0.6] });
      io.observe(glEl);
      syncDOM(); requestAnimationFrame(measure);
      return () => { io.disconnect(); };
    });
  },
};
