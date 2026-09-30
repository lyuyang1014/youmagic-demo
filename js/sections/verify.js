// #verify — 5+4 激活验真技术
// 3D (YM3D createHandpiece + createLock54): the real handpiece and disposable tip are the hero. The flow steps drive
// the tip insert (one-way key, visible on the model), then the holographic 5+4 lock forms around the tip for
// 扫码激活 / 验真 (scan → 五端 nodes, code digits → 四维 rings, confirm → verified). The anti-counterfeit chips replay
// the check in 3D and reject with a red, shaking lock + fault code. Scroll intro: a verified lock hero shot.
// src: DA p.2   “5+4 激活验真技术 — 五端激活+四维验真，全方位杜绝假货”（原文引用；不解释 5 端 / 4 维的具体含义）
//      IFU p.10 一次性使用治疗头端仅供一名患者使用，请勿重复使用或尝试重新处理
//      IFU p.11 头端安装到治疗手具上后，其类型将在触摸屏上显示；YM5-TP4-900，治疗面积 4.0 cm²
//      IFU p.19 成功连接后触摸屏显示头端类型，包括可用的射频能量脉冲次数
//      IFU p.12 验真界面：扫描激活界面二维码 → 输入验证激活码 → 确认后进入治疗界面；一旦激活，需在规定的时间段内完成治疗发数
//      IFU p.13 图7 激活界面（请激活治疗头 / 请输入激活码 / 二维码 / 型号 YM5-TP4-900 / 发数 900 / 日期 20220425 / 删除 / 5–9 · 0–4 / 取消 / 确认）；图8 治疗界面
//      IFU p.19 头端几何形状仅允许沿一个方向插入；默认参数 功率档位 2、制冷强度 1、脉冲时间 1.0
//      IFU p.24 故障代码表（E202 E203 E301 E302 E303 E304 E306 及解除措施）
//      IFU p.30 一次性使用治疗头端使用有效期 3 年 · IFU p.33 “请勿重复使用”标识
import * as THREE from 'three';
import * as S3 from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createHandpiece } from '../ym3d/device.mjs';
import { createLock54, projectAnchor } from '../ym3d/dataviz.mjs';
// Integration QA — scroll jank: the first frame of a freshly built view compiled every shader synchronously
// (≈100–220 ms freeze mid-scroll). Views are built well before they enter the viewport, so start a parallel
// (KHR_parallel_shader_compile) compile right after build(); by the first on-screen frame the programs are ready.
const precompileLib = (lib) => ({
  ...lib,
  createStage(T, canvas, opts) {
    const st = lib.createStage(T, canvas, opts);
    queueMicrotask(() => { try { st.renderer.compileAsync(st.scene, st.camera).catch(() => {}); } catch (e) { /* lost context */ } });
    return st;
  },
});

// 故障解除措施 — src: IFU p.24（data.faults 仅含说明，这里补全原表“故障解除措施”列）
const REMEDY = { E202: '请检查是否是正品治疗头', E203: '请更换新治疗头', E301: '请更换新治疗头', E302: '请更换新治疗头', E303: '疑似回充头请更换', E304: '疑似回充头请更换', E306: '请重试或更换治疗头' };
const SCEN = [
  { label: '正品新头', code: null },
  { label: '已在别处使用过', code: 'E301' },
  { label: '疑似回充头（有激活记录）', code: 'E303' },
  { label: '疑似回充头（有写入记录）', code: 'E304' },
  { label: '使用超时', code: 'E302' },
  { label: '已耗尽', code: 'E203' },
  { label: '无法识别', code: 'E202' },
  { label: '激活失败', code: 'E306' },
];
const DEMO = '582047'; // 演示激活码（虚构）
const onceVisible = (el, fn, threshold = 0.2) => { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold }); io.observe(el); };

const TIP_SVG = `<svg viewBox="0 0 120 120" class="vf-tipsvg" aria-hidden="true">
  <defs>
    <linearGradient id="vf-t-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d93c7"/><stop offset="1" stop-color="#34507a"/></linearGradient>
    <linearGradient id="vf-t-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c4468"/><stop offset="1" stop-color="#16243a"/></linearGradient>
    <linearGradient id="vf-t-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b5d8e"/><stop offset="1" stop-color="#1f3354"/></linearGradient>
    <linearGradient id="vf-t-au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd98a"/><stop offset=".5" stop-color="#d9973c"/><stop offset="1" stop-color="#9a5e1c"/></linearGradient>
  </defs>
  <path d="M60 16 L100 36 L60 56 L20 36Z" fill="url(#vf-t-top)" opacity=".95"/>
  <path d="M20 36 L60 56 L60 102 L20 82Z" fill="url(#vf-t-l)" opacity=".95"/>
  <path d="M60 56 L100 36 L100 82 L60 102Z" fill="url(#vf-t-r)" opacity=".95"/>
  <path d="M65 61 L95 46 L95 79 L65 94Z" fill="url(#vf-t-au)"/>
  <path d="M71 63 L89 54 L89 75 L71 84Z" fill="#6b3f10" opacity=".75"/>
  <path d="M73 66 L87 59 M73 70 L87 63 M73 74 L87 67 M73 78 L87 71" stroke="#e9b66a" stroke-width=".8" opacity=".8"/>
  <path d="M60 16 L100 36 L60 56 L20 36Z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".8"/>
</svg>`;
const GEAR = '<svg viewBox="0 0 24 24" class="vf-gear" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5-.02-.7 2-1.6-2-3.4-2.4.9a8 8 0 0 0-1.2-.7L16.5 4h-4l-.4 2.5c-.4.2-.8.4-1.2.7l-2.4-.9-2 3.4 2 1.6a8 8 0 0 0 0 1.4l-2 1.6 2 3.4 2.4-.9c.4.3.8.5 1.2.7l.4 2.5h4l.4-2.5c.4-.2.8-.4 1.2-.7l2.4.9 2-3.4-2-1.6.02-.7Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

/* ---- decorative QR (not a real code) ---- */
function qrSVG(seed = 7) {
  const N = 25, m = Array.from({ length: N }, () => Array(N).fill(0));
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) m[y][x] = rnd() > 0.52 ? 1 : 0;
  const finder = (ox, oy) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      const edge = x === 0 || x === 6 || y === 0 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      m[Y][X] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (edge || core) ? 1 : 0;
    }
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  for (let i = 8; i < N - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) m[18 + y][18 + x] = Math.max(Math.abs(x), Math.abs(y)) !== 1 ? 1 : 0;
  let d = '';
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      if (m[y][x]) { const x0 = x; while (x < N && m[y][x]) x++; d += `M${x0} ${y}h${x - x0}v1h${x0 - x}z`; } else x++;
    }
  }
  return `<svg viewBox="-2 -2 29 29" class="vf-qrsvg" shape-rendering="crispEdges" aria-hidden="true"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><path d="${d}" fill="#0b0d12"/></svg>`;
}

/* ================= 3D: YM5-H1 handpiece + YM5-TP4-900 tip + holographic 5+4 lock =================
   One mount3D context. The logical state V (tip insert, key rotation, lock progress / verified / reject,
   camera mode, intro) lives outside the WebGL objects, so a context dispose + rebuild restores the scene.
   Lock54 (tip:false) is scaled around the real tip face; its plane is perpendicular to the handpiece axis. */
const AX = { az: -0.38, el: 0.5 };                       // handpiece axis direction A (tip points up-left, towards camera)
const LOCK_S = 0.054;                                    // Lock54 units → metres (outer ring ≈ 7 cm around a 2.7 cm tip)
const RED = new THREE.Color(0xff3b4e);
const dirOf = (az, el, out = new THREE.Vector3()) => out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));

/** tint every colour the lock draws toward red, preserving intensity. Colours the library rewrites each update() are
    re-based every frame; colours it never rewrites are restored from their base first, so the tint never accumulates. */
function lockTinter(root) {
  const refs = [], insts = [], tmp = new THREE.Color();
  root.traverse((o) => {
    const m = o.material;
    if (m) {
      if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isColor) refs.push({ c: v, base: v.clone(), last: new THREE.Color(), has: false }); }
      if (m.isMeshBasicMaterial && m.color) refs.push({ c: m.color, base: m.color.clone(), last: new THREE.Color(), has: false });
    }
    if (o.isInstancedMesh && o.instanceColor) insts.push(o);
  });
  return (amt) => {
    for (const r of refs) {
      if (r.has && r.c.equals(r.last)) r.c.copy(r.base); else r.base.copy(r.c);
      if (amt > 0.001) { const l = Math.max(r.c.r, r.c.g, r.c.b); r.c.lerp(tmp.setRGB(RED.r * l, RED.g * l, RED.b * l), amt); }
      r.last.copy(r.c); r.has = true;
    }
    if (amt > 0.001) for (const im of insts) {
      const a = im.instanceColor.array;
      for (let i = 0; i < a.length; i += 3) { const l = Math.max(a[i], a[i + 1], a[i + 2]); a[i] += (RED.r * l - a[i]) * amt; a[i + 1] += (RED.g * l - a[i + 1]) * amt; a[i + 2] += (RED.b * l - a[i + 2]) * amt; }
      im.instanceColor.needsUpdate = true;
    }
  };
}

/* host.mjs workaround (library bug, reported): after mount3D disposes a view it calls forceContextLoss() on its canvas and
   later rebuilds on the SAME canvas, whose context stays lost → createStage throws → permanent fallback. This stageLib
   wrapper renders into a fresh canvas underneath the (now blank, still event-receiving) original one when that happens. */
function freshCanvasStages(stageLib) {
  let live = null;
  return {
    ...stageLib,
    createStage(THREE_, canvas, opts) {
      let c = canvas;
      if (canvas.dataset.ymLost) {
        c = document.createElement('canvas'); c.className = canvas.className; c.style.cssText = canvas.style.cssText; c.setAttribute('aria-hidden', 'true');
        canvas.style.opacity = '0'; canvas.parentNode.insertBefore(c, canvas);
        if (live && live !== canvas) live.remove();
      }
      live = c;
      return stageLib.createStage(THREE_, c, opts);
    },
  };
}

function buildVerify3D(container, V, { reduced, onFrame }) {
  const A = dirOf(AX.az, AX.el), v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
  const cam = { tx: 0, ty: 0, tz: 0, r: 0.6, az: 0, el: 0, init: false };
  return mount3D(container, {
    THREE, stageLib: precompileLib(freshCanvasStages(S3)), dpr: 1.5, draggable: true,
    stageOpts: { fov: 28, background: 0x09090f, exposure: 1.02, envViolet: 0.6 },
    fallback: (el) => el.classList.add('is-fallback'),
    build(stage) {
      const { scene, lights } = stage;
      lights.key.position.set(1.6, 2.4, 2.2); lights.key.intensity = 1.8; lights.key.shadow.mapSize.set(1024, 1024);
      lights.rim.position.set(-2, 1.2, -1.6); lights.rim.intensity = 2.0;
      const glowTex = S3.glowTexture(THREE);
      const glow = (c, s, o, pos) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); sp.scale.setScalar(s); sp.position.copy(pos); sp.renderOrder = -5; scene.add(sp); return sp; };
      const backV = glow(0x6a3fd0, 0.9, 0.3, v3.copy(A).multiplyScalar(-0.2).add(v3b.set(0, 0, -0.25)));
      const backM = glow(0x2bae7e, 0.45, 0.12, v3.set(0, 0, -0.12));
      // handpiece: local +Y → A, tip interface at the world origin
      const hp = createHandpiece(THREE, { cable: true });
      const hpG = new THREE.Group(); hpG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), A); hpG.add(hp.object3d); scene.add(hpG);
      // lock: perpendicular to A, centred just in front of the tip face (face ≈ 0.024 m along A when seated)
      const lock = createLock54(THREE, { tip: false });
      const lockG = new THREE.Group(); lockG.add(lock.object3d); scene.add(lockG);
      const lockC = v3b.copy(A).multiplyScalar(0.013); // just behind the tip face, so the rings wrap the tip
      lockG.position.copy(lockC); lockG.lookAt(v3.copy(lockC).add(A));
      const tint = lockTinter(lock.object3d);
      // rejection ✕ (lock units, in front of the tip face)
      const xMat = new THREE.MeshPhysicalMaterial({ color: 0xff4d64, emissive: 0xff3b4e, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.2, clearcoat: 1 });
      const xG = new THREE.Group(); xG.position.z = 0.34; lock.object3d.add(xG);
      const barGeo = new THREE.BoxGeometry(0.42, 0.075, 0.06);
      [Math.PI / 4, -Math.PI / 4].forEach((r) => { const b = new THREE.Mesh(barGeo, xMat); b.rotation.z = r; xG.add(b); });
      // red / mint pulse at the nose (insert feedback)
      const noseBad = glow(0xff3b4e, 0.09, 0, v3.copy(A).multiplyScalar(0.004)); noseBad.renderOrder = 30; noseBad.material.depthTest = false;
      const noseOk = glow(0x43e6a8, 0.075, 0, v3.copy(A).multiplyScalar(0.004)); noseOk.renderOrder = 30; noseOk.material.depthTest = false;
      return { cv: stage.renderer.domElement, hp, hpG, lock, lockG, lockC: lockC.clone(), tint, xG, xMat, barGeo, noseBad, noseOk, backV, backM, glowTex, anchors: {}, lastW: 0, lastH: 0, pts: {} };
    },
    frame(s, stage, t, dt, api) {
      const size = stage.renderer.getSize(new THREE.Vector2()), W = size.x, H = size.y;
      const resized = W !== s.lastW || H !== s.lastH; s.lastW = W; s.lastH = H;
      if (reduced && !V.needs && !resized) return;
      V.needs = false;
      const now = performance.now() / 1000, tt = reduced ? 0 : t, k = reduced ? 1 : 1 - Math.exp(-dt * 3);
      // blend: flow ↔ sim (modeK) and the scroll intro (hero shot of a verified lock)
      V.modeK += ((V.mode === 'sim' ? 1 : 0) - V.modeK) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
      const mk = S3.smooth(V.modeK), ik = V.touched ? 0 : S3.smooth(V.intro);
      const F = V.flow, M = V.sim;
      const ins = S3.lerp(S3.lerp(F.k, 1, mk), 1, ik);
      const prog = S3.lerp(S3.lerp(F.progress, M.progress, mk), 1, ik);
      const ver = S3.lerp(S3.lerp(F.verified, M.verified, mk), 1, ik);
      const rej = S3.lerp(F.reject, M.reject, mk) * (1 - ik);
      const lockOn = Math.max(S3.lerp(F.lockOn, 1, mk), ik);
      const q = S3.lerp(F.q, Math.round(F.q / 4) * 4, Math.max(mk, ik));
      // handpiece + tip (key rotation override: aligned when q is a multiple of 4 quarter-turns)
      s.hp.update({ t: tt, tipInsert: ins, highlight: F.hl && mk < 0.5 && ik < 0.5 ? 'tip' : null });
      s.hp.parts.tipHolder.rotation.y = -q * Math.PI / 2;
      // lock
      s.lockG.visible = lockOn > 0.002;
      s.lockG.scale.setScalar(LOCK_S);
      s.lock.object3d.scale.setScalar(Math.max(0.001, 0.5 + 0.5 * S3.ease.backOut(lockOn)));
      s.lock.update({ t: tt, progress: prog, verified: ver });
      s.tint(rej);
      const xk = S3.ease.backOut(S3.clamp(rej * 1.4));
      s.xG.visible = xk > 0.01; s.xG.scale.setScalar(Math.max(0.001, xk)); s.xG.rotation.z = (1 - xk) * 0.8;
      // rejection shake (lock) — decays after each reject trigger
      const sh = reduced ? 0 : 0.0035 * Math.exp(-(now - V.shakeT) * 3.5) * (rej > 0.2 ? 1 : 0);
      s.lockG.position.copy(s.lockC); s.lockG.position.x += sh * Math.sin(now * 61); s.lockG.position.y += sh * 0.6 * Math.cos(now * 47);
      // insert feedback
      s.noseBad.material.opacity = F.bad * (1 - mk); s.noseOk.material.opacity = F.ok * 0.7 * (1 - mk);
      stage.scene.updateMatrixWorld();
      // camera: install (side, whole handpiece) ↔ lock (head-on, lock fills) ↔ hero (intro, slow sway)
      const aspect = W / Math.max(1, H), halfV = Math.tan((28 * Math.PI) / 360), fit = Math.min(halfV, halfV * aspect);
      const camK = S3.smooth(Math.max(V.camK, mk, ik));
      const rLock = (0.104 / fit) * (aspect < 0.8 ? 1.04 : aspect < 1.3 && aspect > 0.95 ? 1.1 : 1.0), rInst = (0.17 / fit) * (aspect < 0.8 ? 1.05 : 1);
      // install view target: between the floating tip and the nose, nudged down the body
      const it = v3.copy(A).multiplyScalar(-0.035);
      let tx = S3.lerp(it.x, s.lockC.x, camK), ty = S3.lerp(it.y, s.lockC.y, camK), tz = S3.lerp(it.z, s.lockC.z, camK);
      let r = S3.lerp(rInst, rLock, camK) * (1 + 0.16 * ik);
      let az = S3.lerp(AX.az + 1.22, AX.az + 0.34, camK) + ik * 0.22 * Math.sin(tt * 0.25);
      let el = S3.lerp(0.18, AX.el - 0.16, camK);
      if (!cam.init || reduced) Object.assign(cam, { tx, ty, tz, r, az, el, init: true });
      else { cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k; cam.r += (r - cam.r) * k; cam.az += (az - cam.az) * k; cam.el += (el - cam.el) * k; }
      const px = api.pointer.inside && !api.drag.active ? api.pointer.x * 0.06 : 0, py = api.pointer.inside && !api.drag.active ? api.pointer.y * 0.04 : 0;
      stage.camera.near = 0.01; stage.camera.updateProjectionMatrix();
      stage.orbit({ target: [cam.tx, cam.ty, cam.tz], radius: cam.r, azimuth: cam.az + api.drag.azimuth + px, elevation: S3.clamp(cam.el + api.drag.elevation + py, -0.6, 1.3) });
      stage.render();
      // DOM overlay anchors
      const P = s.pts, pr = (name, obj, out) => { const o = P[name] || (P[name] = {}); projectAnchor(THREE, obj, stage.camera, W, H, o); return o; };
      pr('window', s.hp.anchor('window', v3), 0); pr('latch', s.hp.anchor('latch', v3), 0); pr('nose', v3.set(0, 0, 0).applyMatrix4(s.hpG.matrixWorld), 0);
      pr('node0', s.lock.anchors.node0); pr('ring3', s.lock.anchors.ring3); pr('check', s.lock.anchors.check); pr('lock', s.lockG);
      onFrame(P, { ins, lockOn, prog, ver, rej, mk, ik, q }, W, H);
    },
    dispose(s) { s.cv.dataset.ymLost = '1'; s.hp.dispose(); s.lock.dispose(); s.xMat.dispose(); s.barGeo.dispose(); [s.noseBad, s.noseOk, s.backV, s.backM].forEach((sp) => sp.material.dispose()); s.glowTex.dispose(); },
  });
}

/** scroll progress read straight from the element's rect (robust to layout shifts above that leave cached
    ScrollTrigger positions stale); rAF-throttled, only while the element is near the viewport. */
function scrollTrack(el, calc, fn) {
  let raf = 0, near = false;
  const tick = () => { raf = 0; const r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, calc(r, window.innerHeight)))); };
  const req = () => { if (near && !raf) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { near = e.isIntersecting; tick(); }, { rootMargin: '80% 0px' }).observe(el);
  window.addEventListener('scroll', req, { passive: true }); window.addEventListener('resize', req);
}

export default {
  id: 'verify',
  nav: '激活验真',
  async init(root, ctx) {
    const { gsap, lib, data, reduced } = ctx;
    const faultText = Object.fromEntries(data.faults.filter((f) => f.group === 'auth').map((f) => [f.code, f.text.split(' · ')[0]]));
    const tip = data.components.find((c) => c.model === 'YM5-TP4-900');
    const D = data.defaults;

    root.innerHTML = `
      <div class="wrap vf">
        <div class="vf-grid">
          <div class="vf-col3d">
            <div class="vf-stage card">
              <div class="vf-stage__head"><span class="vf-stage__t">治疗手具 · 一次性使用治疗头端</span><span class="mono vf-stage__m">${tip.model}</span></div>
              <div class="vf-slot vf-slot--flow">
                <div class="vf-gl" role="img" aria-label="三维示意：治疗手具 YM5-H1 与一次性使用治疗头端 YM5-TP4-900；头端单向插入，5+4 激活验真图形在头端周围生成">
                  <img class="vf-fallback" src="assets/img/handpiece.webp" alt="治疗手具与一次性使用治疗头端" hidden />
                  <svg class="vf-keyln" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"/></svg>
                  <span class="vf-mk vf-mk--tip" aria-hidden="true"></span>
                  <span class="vf-mk vf-mk--hp" aria-hidden="true"><em>单向键位</em></span>
                  <span class="vf-lab vf-lab--5 mono" aria-hidden="true"><b>五端激活</b><i class="vf-lab__v">0 / 5</i></span>
                  <span class="vf-lab vf-lab--4 mono" aria-hidden="true"><b>四维验真</b><i class="vf-lab__v">0 / 4</i></span>
                  <span class="vf-badge" aria-hidden="true"></span>
                  <span class="vf-tag mono">原理示意 · 模型与键位为示意</span>
                  <span class="vf-phase mono" aria-live="polite"></span>
                  <span class="vf-drag micro" aria-hidden="true">拖动旋转</span>
                  <div class="vf-flash" aria-hidden="true"></div>
                </div>
              </div>
              <p class="vf-hint" aria-live="polite">旋转头端，使倒角与手具接口对齐，然后插入。</p>
              <div class="vf-stage__ctl">
                <button type="button" class="btn vf-rot"><span aria-hidden="true">↻</span> 旋转 90°</button>
                <button type="button" class="btn btn--primary vf-ins">插入治疗头</button>
              </div>
              <p class="micro vf-stage__note">三维模型、键位与验真图形为示意；说明书原文：“一次性使用治疗头端的几何形状仅允许沿一个方向插入”。</p>
            </div>
          </div>

          <div class="vf-colR">
            <header class="sec-head vf-head">
              <span class="eyebrow" data-reveal>08 · AUTHENTICATION</span>
              <h2 class="h1" data-reveal>5+4 激活验真技术</h2>
              <p class="lead vf-claim" data-reveal><em>五端</em>激活+<em>四维</em>验真，全方位杜绝假货</p>
              <p class="vf-sub" data-reveal>每一个一次性使用治疗头端都需在治疗仪上<b>扫码激活</b>后才能进入治疗界面，且<b>仅供一名患者使用</b>。下面按说明书流程完整走一遍。<span class="tag-src">说明书 第 10–13、19 页 · 彩页 第 2 页</span></p>
            </header>

            <ol class="vf-steps" data-reveal>
              ${[
                ['安装头端', '头端几何形状仅允许沿一个方向插入', '第 19 页'],
                ['自动识别', '安装后触摸屏显示头端类型与可用发数', '第 11、19 页'],
                ['扫码激活', '验证程序扫描二维码，输入激活码并确认', '第 12 页'],
                ['进入治疗', '激活后需在规定的时间段内完成治疗发数', '第 12 页'],
              ].map(([t, d, p], i) => `<li class="vf-step" data-i="${i}"><span class="vf-step__n num">${i + 1}</span><div><div class="vf-step__t">${t}</div><div class="vf-step__d">${d}</div><span class="tag-src">说明书 ${p}</span></div></li>`).join('')}
            </ol>

            <div class="vf-right">
              <div class="vf-device">
                <div class="vf-screen" data-state="boot" tabindex="0" aria-label="触摸屏激活界面（复刻说明书图7）">
                  <div class="vf-scr vf-scr--boot">
                    <div class="vf-logo">YŌUMAGIC</div>
                    <div class="vf-boot"><span>发布版本： V 1</span><span class="vf-boot__msg">系统自检中<i>.</i><i>.</i><i>.</i></span></div>
                  </div>
                  <div class="vf-scr vf-scr--act">
                    <div class="vf-scr__top"><span class="vf-logo vf-logo--s">YŌUMAGIC</span>${GEAR}</div>
                    <div class="vf-act">
                      <div class="vf-act__l">
                        <div class="vf-act__title">请激活治疗头</div>
                        <div class="vf-act__sub">请输入激活码</div>
                        <div class="vf-ped"><div class="vf-ped__tip">${TIP_SVG}</div><div class="vf-ped__empty">等待安装<br>治疗头</div></div>
                        <div class="vf-act__type"><span class="mono">YM5-TP4-900</span> · 可用 <b>900</b> 发</div>
                      </div>
                      <div class="vf-act__r">
                        <div class="vf-qrrow">
                          <div class="vf-qr">${qrSVG(11)}<div class="vf-qr__mask">安装后<br>显示</div><div class="vf-laser"></div></div>
                          <dl class="vf-info"><div><dt>型号</dt><dd>YM5-TP4-900</dd></div><div><dt>发数</dt><dd>900</dd></div><div><dt>日期</dt><dd>20220425</dd></div></dl>
                        </div>
                        <div class="vf-inrow"><div class="vf-input mono" aria-live="polite" aria-label="激活码输入框"><span class="vf-input__v"></span><i class="vf-caret"></i></div><button type="button" class="vf-k vf-k--w" data-k="del">删除</button></div>
                        <div class="vf-keys">${['5', '6', '7', '8', '9', '0', '1', '2', '3', '4'].map((n) => `<button type="button" class="vf-k" data-k="${n}">${n}</button>`).join('')}</div>
                        <div class="vf-acts"><button type="button" class="vf-k vf-k--w" data-k="cancel">取消</button><button type="button" class="vf-k vf-k--w vf-k--ok" data-k="ok">确认</button></div>
                      </div>
                    </div>
                  </div>
                  <div class="vf-scr vf-scr--treat">
                    <div class="vf-scr__top"><span class="vf-logo vf-logo--s">YŌUMAGIC</span>${GEAR}</div>
                    <div class="vf-tr">
                      <div class="vf-act__l">
                        <div class="vf-act__title">待治疗</div>
                        <div class="vf-act__sub">请检查制冷剂罐和中性电极片</div>
                        <div class="vf-ped is-on"><div class="vf-ped__tip">${TIP_SVG}</div></div>
                      </div>
                      <div class="vf-tr__r">
                        <div class="vf-tr__stats">
                          <div><span>治疗发数</span><b class="num">0 / 900</b></div>
                          <div><span>累计能量(KJ)</span><b class="num">0.00</b></div>
                          <div><span>阻值(Ω)</span><b class="num">—</b></div>
                          <div><span>功率(W)</span><b class="num">—</b></div>
                        </div>
                        <div class="vf-tr__params">
                          <div class="vf-tr__dens"><span>能量密度</span><b class="num">${lib.density(D.level, D.pulse).toFixed(1)}</b></div>
                          ${[['功率档位', D.level.toFixed(1)], ['制冷强度', String(D.cooling)], ['脉冲时间', D.pulse.toFixed(1)]].map(([k, v]) => `<div class="vf-tr__p"><i>+</i><span>${k}</span><b class="num">${v}</b><i>−</i></div>`).join('')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="vf-toast" role="status"></div>
                </div>
              </div>
              <div class="vf-phone" aria-hidden="true">
                <div class="vf-phone__bar"><span>验证程序</span><i></i></div>
                <div class="vf-phone__view">${qrSVG(11)}<div class="vf-phone__scan"></div><span class="vf-c vf-c1"></span><span class="vf-c vf-c2"></span><span class="vf-c vf-c3"></span><span class="vf-c vf-c4"></span></div>
                <div class="vf-phone__st micro">正在识别二维码…</div>
              </div>
              <div class="vf-codecard" aria-live="polite" hidden>
                <div class="vf-codecard__ic" aria-hidden="true"><i></i></div>
                <div class="vf-codecard__b">
                  <div class="micro">验证程序 · 已识别 <span class="mono">YM5-TP4-900 · 900 发</span></div>
                  <div class="vf-codecard__row"><span class="micro">激活码（演示，虚构）</span><span class="mono vf-codecard__code">${DEMO.slice(0, 3)} ${DEMO.slice(3)}</span></div>
                </div>
                <button type="button" class="btn vf-codecard__fill">一键填入</button>
              </div>
              <div class="vf-under">
                <button type="button" class="btn vf-scan" disabled><span class="vf-scan__i" aria-hidden="true"></span>用验证程序扫码</button>
                <button type="button" class="btn vf-reset">重置演示</button>
                <span class="micro vf-under__src">触摸屏界面复刻自说明书 图6–图8（第 12–13 页）</span>
              </div>
            </div>

            <div class="vf-sim card" data-reveal>
              <div class="vf-sim__l">
                <div class="vf-sim__eyebrow mono">ANTI-COUNTERFEIT · 模拟</div>
                <h3 class="h3">防伪校验模拟</h3>
                <p class="small">选择一种治疗头状态，看治疗仪会给出什么提示——左侧三维验真图形同步演示。故障代码与处理措施摘自说明书故障代码表。</p>
                <div class="vf-chips" role="group" aria-label="治疗头状态">
                  ${SCEN.map((s, i) => `<button type="button" class="vf-chip${s.code ? '' : ' vf-chip--ok'}" data-i="${i}" aria-pressed="false"><i aria-hidden="true"></i>${s.label}</button>`).join('')}
                </div>
              </div>
              <div class="vf-slot vf-slot--sim" aria-hidden="true"></div>
              <div class="vf-con" aria-live="polite">
                <div class="vf-con__bar"><i></i><i></i><i></i><span class="mono">YM5 · 治疗头校验</span></div>
                <div class="vf-con__body">
                  <div class="vf-con__lines mono"></div>
                  <div class="vf-con__verdict"></div>
                </div>
              </div>
              <div class="vf-codes">
                <div class="vf-codes__t">故障代码 · 治疗头</div>
                ${Object.keys(REMEDY).map((c) => `<div class="vf-code" data-c="${c}"><b class="mono">${c}</b><span>${faultText[c]}</span></div>`).join('')}
                <span class="tag-src">说明书 第 24 页</span>
              </div>
            </div>
          </div>
        </div>

        <div class="vf-foot">
          <div class="vf-foot__sym" data-reveal>
            <svg viewBox="0 0 64 64" aria-label="请勿重复使用标识"><circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" stroke-width="3"/><text x="32" y="42" text-anchor="middle" font-size="30" font-family="Montserrat, sans-serif" fill="currentColor">2</text><line x1="13" y1="51" x2="51" y2="13" stroke="currentColor" stroke-width="3"/></svg>
            <div><b>仅供一名患者使用</b><p class="small">制造商提供的一次性使用治疗头端仅供一名患者使用。请勿重复使用或尝试重新处理；用于多名患者会造成患者之间微生物交叉污染的风险。</p><span class="tag-src">说明书 第 10、33 页</span></div>
          </div>
          <div class="vf-foot__stats">
            <div class="stat" data-reveal><div class="stat__v num" data-count="900">900<span class="stat__u">发</span></div><div class="stat__k">每个头端的治疗计数</div></div>
            <div class="stat" data-reveal><div class="stat__v num">4.0<span class="stat__u">cm²</span></div><div class="stat__k">治疗面积</div></div>
            <div class="stat" data-reveal><div class="stat__v num">1<span class="stat__u">名患者</span></div><div class="stat__k">单一患者使用</div></div>
            <div class="stat" data-reveal><div class="stat__v num">${data.specs.lifetime.tip.replace(/\s*年/, '')}<span class="stat__u">年</span></div><div class="stat__k">头端使用有效期</div></div>
          </div>
        </div>
        <p class="note">激活码为演示用虚构数字，二维码为装饰图形；“五端激活 + 四维验真”为彩页原文，其具体实现以厂家资料为准。本页仅演示说明书所述的安装—识别—扫码激活—进入治疗流程及故障提示。</p>
      </div>`;

    const $ = (s) => root.querySelector(s);
    const screen = $('.vf-screen'), toastEl = $('.vf-toast'), inputV = $('.vf-input__v');
    const steps = [...root.querySelectorAll('.vf-step')];
    const hint = $('.vf-hint'), btnRot = $('.vf-rot'), btnIns = $('.vf-ins'), btnScan = $('.vf-scan'), btnReset = $('.vf-reset');
    const phone = $('.vf-phone'), flash = $('.vf-flash');
    const S = { state: 'boot', installed: false, scanned: false, code: '', quarter: 1, busy: false, activated: false, gen: 0 };

    /* ---------------- 3D logical state ---------------- */
    const V = {
      mode: 'flow', modeK: 0, intro: reduced ? 0 : 1, touched: !!reduced, camK: 0, shakeT: -9, needs: true,
      flow: { k: 0, q: S.quarter, lockOn: 0, progress: 0, verified: 0, reject: 0, bad: 0, ok: 0, hl: false },
      sim: { progress: 0, verified: 0, reject: 0 },
    };
    const gl = $('.vf-gl');
    const mkTip = $('.vf-mk--tip'), mkHp = $('.vf-mk--hp'), keyLn = $('.vf-keyln line');
    const lab5 = $('.vf-lab--5'), lab4 = $('.vf-lab--4'), lab5v = lab5.querySelector('.vf-lab__v'), lab4v = lab4.querySelector('.vf-lab__v');
    const badge = $('.vf-badge'), phaseEl = $('.vf-phase');
    const cls = (el, c, on) => { if (el.classList.contains(c) !== on) el.classList.toggle(c, on); };
    const place = (el, p, dx = 0, dy = 0) => { el.style.transform = `translate3d(${(p.x + dx).toFixed(1)}px, ${(p.y + dy).toFixed(1)}px, 0)`; };
    let last5 = -1, last4 = -1, lastBadge = '';
    function onFrame(P, st, W, H) {
      // one-way key markers (tip key window ↔ handpiece latch) while the tip is off
      const keyOn = st.ins < 0.9 && st.mk < 0.5 && st.ik < 0.5;
      cls(gl, 'show-key', keyOn);
      if (keyOn) {
        place(mkTip, P.window); place(mkHp, P.latch);
        keyLn.setAttribute('x1', P.window.x.toFixed(1)); keyLn.setAttribute('y1', P.window.y.toFixed(1)); keyLn.setAttribute('x2', P.latch.x.toFixed(1)); keyLn.setAttribute('y2', P.latch.y.toFixed(1));
        cls(gl, 'key-ok', ((Math.round(V.flow.q) % 4) + 4) % 4 === 0 && Math.abs(V.flow.q - Math.round(V.flow.q)) < 0.08);
      }
      // 5 + 4 counters on the lock
      const lockLab = st.lockOn > 0.6;
      cls(gl, 'show-lock', lockLab);
      if (lockLab) {
        const side = P.node0.y < 78; cls(lab5, 'is-side', side); // too close to the top chips → sit beside the node
        place(lab5, P.node0, 0, side ? 0 : -18); place(lab4, P.ring3);
        const n5 = Math.min(5, Math.floor((st.prog - 0.03) / 0.085 + 0.35 + 1e-6)), n4 = Math.min(4, Math.max(0, Math.floor((st.prog - 0.5) / 0.115 + 0.13 + 1e-6)));
        const a5 = st.prog >= 0.99 || st.ver > 0.5 ? 5 : Math.max(0, n5), a4 = st.ver > 0.5 || st.prog >= 0.99 ? 4 : n4;
        if (a5 !== last5) { last5 = a5; lab5v.textContent = `${a5} / 5`; cls(lab5, 'is-full', a5 === 5); }
        if (a4 !== last4) { last4 = a4; lab4v.textContent = `${a4} / 4`; cls(lab4, 'is-full', a4 === 4); }
      }
      // verdict badge
      const b = st.rej > 0.5 ? badgeText : st.ver > 0.6 ? 'ok' : '';
      if (b !== lastBadge) {
        lastBadge = b;
        badge.className = 'vf-badge' + (b === 'ok' ? ' is-ok' : b ? ' is-bad' : '');
        badge.innerHTML = b === 'ok' ? '<i>✓</i>验真通过' : b ? `<i>!</i><b class="mono">${b}</b>${faultText[b] || ''}` : '';
      }
      if (b) badge.style.transform = `translate3d(${P.lock.x.toFixed(1)}px, ${Math.min(H - 30, P.lock.y + (P.lock.y - P.node0.y) * 0.92 + 58).toFixed(1)}px, 0)`; // under the lock
      // flash position follows the nose
      flash.style.setProperty('--fx', `${P.nose.x.toFixed(0)}px`); flash.style.setProperty('--fy', `${P.nose.y.toFixed(0)}px`);
    }
    let badgeText = '';
    const m3 = buildVerify3D(gl, V, { reduced, onFrame });
    new MutationObserver(() => { if (gl.classList.contains('is-fallback')) gl.querySelector('.vf-fallback').hidden = false; }).observe(gl, { attributes: true, attributeFilter: ['class'] });
    const redraw = () => { V.needs = true; m3.invalidate(); };
    const tw = (target, vars) => { if (reduced) { Object.assign(target, Object.fromEntries(Object.entries(vars).filter(([k]) => !['duration', 'ease', 'delay', 'onComplete', 'overwrite'].includes(k)))); vars.onComplete?.(); redraw(); return null; } return gsap.to(target, { overwrite: 'auto', ...vars, onUpdate: redraw }); };
    const touch = () => { if (!V.touched) { V.touched = true; } setMode('flow'); };
    const PHASE = ['01 · 安装头端', '02 · 自动识别', '03 · 扫码激活', '04 · 进入治疗'];
    let flowHint = '';
    function setMode(m) {
      if (m !== V.mode) {
        if (m === 'sim') { flowHint = hint.textContent; hint.textContent = '防伪校验模拟：三维验真图形同步演示所选治疗头状态（红色 = 治疗仪拒绝）。'; }
        else if (flowHint) { hint.textContent = flowHint; flowHint = ''; }
      }
      V.mode = m; gl.dataset.mode = m; phaseEl.textContent = m === 'sim' ? 'SIM · 防伪校验模拟' : PHASE[Math.min(3, curStep)]; redraw();
    }

    /* ---------------- steps ---------------- */
    let curStep = 0;
    function setStep(n) {
      curStep = n;
      steps.forEach((s, i) => { s.classList.toggle('is-done', i < n); s.classList.toggle('is-cur', i === n); });
      if (V.mode === 'flow') phaseEl.textContent = PHASE[Math.min(3, n)];
      V.camK = n >= 2 ? 1 : 0; // camera turns head-on once the lock is in play
      V.flow.hl = n === 1;
      redraw();
    }
    setStep(0);
    function say(t) { if (V.mode === 'sim') { flowHint = t; return; } hint.textContent = t; if (!reduced) gsap.fromTo(hint, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.4 }); }

    /* ---------------- screen ---------------- */
    function setScreen(st) { S.state = st; screen.dataset.state = st; }
    let toastT = 0;
    function toast(html, kind = 'info', ms = 2600) {
      toastEl.innerHTML = html; toastEl.className = `vf-toast is-show vf-toast--${kind}`;
      clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-show'), ms);
    }
    const codeProgress = () => 0.5 + (0.46 * S.code.length) / 6; // digits fill the 四维 rings
    function renderInput() {
      inputV.textContent = S.code.replace(/(\d{3})(?=\d)/, '$1 ');
      if (S.scanned && !S.activated) tw(V.flow, { progress: codeProgress(), duration: 0.45, ease: 'power2.out' });
    }
    function press(k) {
      if (S.state !== 'act' || S.busy) return;
      touch();
      if (!S.installed) { toast('请先在左侧安装一次性使用治疗头端', 'info'); return; }
      if (/^\d$/.test(k)) { if (S.code.length < 6) S.code += k; }
      else if (k === 'del') S.code = S.code.slice(0, -1);
      else if (k === 'cancel') S.code = '';
      else if (k === 'ok') return confirm();
      renderInput();
    }
    function rejectFlow() {
      V.shakeT = performance.now() / 1000; badgeText = 'E306';
      if (reduced) { V.flow.reject = 1; redraw(); setTimeout(() => { V.flow.reject = 0; redraw(); }, 2000); return; }
      gsap.timeline({ onUpdate: redraw }).to(V.flow, { reject: 1, duration: 0.18 }).to(V.flow, { reject: 0, duration: 0.6, delay: 1.5 });
    }
    function confirm() {
      if (!S.code) { toast('请输入激活码', 'info'); return; }
      if (S.code === DEMO) {
        S.busy = true; S.activated = true;
        const g = S.gen;
        toast('<b>激活成功</b> · 进入治疗界面', 'ok', 1800);
        setStep(3);
        tw(V.flow, { progress: 1, duration: 0.4 }); tw(V.flow, { verified: 1, duration: 1.3, delay: 0.25, ease: 'power2.out' });
        if (!reduced) gsap.to(codeCard, { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: -14, duration: 0.6, delay: 0.6, ease: 'power3.inOut', onComplete: () => { codeCard.hidden = true; gsap.set(codeCard, { clearProps: 'all' }); } });
        else codeCard.hidden = true;
        setTimeout(() => {
          if (g !== S.gen) return;
          setScreen('treat'); S.busy = false; setStep(4);
          say('已进入治疗界面。头端一旦激活，需在规定的时间段内完成治疗发数。');
        }, reduced ? 0 : 1100);
        return;
      }
      toast(`<b class="mono">E306</b> ${faultText.E306} · ${REMEDY.E306}`, 'err', 3200);
      if (!reduced) gsap.fromTo('.vf-input', { x: 0 }, { duration: 0.45, keyframes: { x: [0, -8, 8, -5, 5, 0] }, ease: 'none' });
      rejectFlow();
      S.code = ''; renderInput();
    }
    root.querySelectorAll('.vf-k').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    screen.addEventListener('keydown', (e) => {
      if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
      else if (e.key === 'Enter') { press('ok'); e.preventDefault(); }
      else if (e.key === 'Escape') { press('cancel'); }
    });

    // boot → activation screen when first visible
    const boot = () => {
      if (S.state !== 'boot') return;
      setTimeout(() => { if (S.state === 'boot') { setScreen('act'); } }, reduced ? 0 : 1700);
    };
    if (reduced) boot();
    else onceVisible(screen, boot, 0.35);

    /* ---------------- scan (五端: the five nodes light while the phone reads the QR) ---------------- */
    btnScan.addEventListener('click', () => {
      if (!S.installed || S.busy || S.activated) return;
      touch();
      S.busy = true; btnScan.disabled = true;
      const g = S.gen;
      phone.classList.add('is-show', 'is-scanning'); phone.setAttribute('aria-hidden', 'false');
      screen.classList.add('is-scanning');
      setStep(2);
      tw(V.flow, { progress: 0.47, duration: 1.8, ease: 'none' });
      say('验证程序正在扫描触摸屏上的二维码…');
      const done = () => {
        if (g !== S.gen) return;
        S.scanned = true; S.busy = false;
        phone.classList.remove('is-show', 'is-scanning'); phone.setAttribute('aria-hidden', 'true');
        screen.classList.remove('is-scanning');
        codeCard.hidden = false;
        if (!reduced) gsap.fromTo(codeCard, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
        say(`已获取激活码。在触摸屏键盘输入 ${DEMO.slice(0, 3)} ${DEMO.slice(3)}（或点“一键填入”），再按“确认”。`);
      };
      if (reduced) done(); else setTimeout(done, 1900);
    });
    const codeCard = $('.vf-codecard');
    codeCard.querySelector('.vf-codecard__fill').addEventListener('click', () => {
      if (S.state !== 'act' || S.busy || !S.scanned) return;
      S.code = ''; renderInput();
      const g = S.gen;
      [...DEMO].forEach((d, i) => setTimeout(() => { if (g === S.gen) press(d); }, reduced ? 0 : 110 * (i + 1)));
    });

    /* ---------------- install (3D one-way key) ---------------- */
    const aligned = () => ((S.quarter % 4) + 4) % 4 === 0;
    btnRot.addEventListener('click', () => {
      if (S.installed || S.busy) return;
      touch();
      S.quarter += 1;
      tw(V.flow, { q: S.quarter, duration: 0.6, ease: 'back.out(1.6)' });
      say(aligned() ? '倒角已对齐接口——现在可以插入。' : '倒角未对齐，继续旋转。');
    });
    function insert3D(ok) {
      return new Promise((res) => {
        if (reduced) { if (ok) { V.flow.k = 1; } redraw(); res(); return; }
        const F = V.flow;
        if (!ok) {
          gsap.timeline({ onUpdate: redraw, onComplete: res })
            .to(F, { k: 0.55, duration: 0.5, ease: 'power2.in' })
            .to(F, { bad: 1, duration: 0.08 }, '>-0.02')
            .to(F, { q: S.quarter + 0.08, duration: 0.08, yoyo: true, repeat: 3, ease: 'none' }, '<')
            .to(F, { k: 0, duration: 0.7, ease: 'power3.out' }, '>0.05')
            .to(F, { bad: 0, duration: 0.6 }, '<');
          return;
        }
        gsap.timeline({ onUpdate: redraw })
          .to(F, { k: 1, duration: 1.15, ease: 'none' })
          .add(res, 0.95)
          .to(F, { ok: 1, duration: 0.12 }, 1.0)
          .to(F, { ok: 0, duration: 1.1 }, '>');
      });
    }
    btnIns.addEventListener('click', async () => {
      if (S.installed || S.busy) return;
      touch();
      S.busy = true;
      const ok = aligned(), g = S.gen;
      await insert3D(ok);
      if (g !== S.gen) return; // 重置演示 pressed mid-insert
      S.busy = false;
      if (!ok) {
        say('插不进去：头端几何形状仅允许沿一个方向插入。请旋转对齐后再试。');
        if (!reduced) { flash.classList.remove('is-bad', 'is-ok'); void flash.offsetWidth; flash.classList.add('is-bad'); }
        return;
      }
      if (!reduced) { flash.classList.remove('is-bad', 'is-ok'); void flash.offsetWidth; flash.classList.add('is-ok'); }
      S.installed = true;
      root.classList.add('vf--installed');
      btnRot.disabled = true; btnIns.disabled = true; btnIns.textContent = '已安装';
      if (S.state === 'boot') setScreen('act');
      screen.classList.add('is-tip');
      setStep(1);
      tw(V.flow, { lockOn: 1, duration: 0.9, delay: 0.5, ease: 'power2.out' });
      setTimeout(() => { if (g === S.gen && S.installed && !S.scanned && curStep === 1) setStep(2); }, reduced ? 0 : 1600);
      btnScan.disabled = false;
      say('已安装。触摸屏显示头端类型 YM5-TP4-900 与可用发数 900，下一步：扫码激活。');
    });

    btnReset.addEventListener('click', () => {
      Object.assign(S, { installed: false, scanned: false, code: '', quarter: 1, busy: false, activated: false, gen: S.gen + 1 });
      if (!reduced) { gsap.killTweensOf(codeCard); gsap.killTweensOf(V.flow); }
      gsap.set(codeCard, { clearProps: 'all' });
      root.classList.remove('vf--installed');
      screen.classList.remove('is-tip', 'is-scanning');
      phone.classList.remove('is-show', 'is-scanning'); phone.setAttribute('aria-hidden', 'true');
      codeCard.hidden = true;
      btnRot.disabled = false; btnIns.disabled = false; btnIns.textContent = '插入治疗头'; btnScan.disabled = true;
      inputV.textContent = ''; setScreen('act'); setStep(0);
      touch();
      tw(V.flow, { k: 0, q: 1, lockOn: 0, progress: 0, verified: 0, reject: 0, bad: 0, ok: 0, duration: 0.9, ease: 'power3.inOut' });
      say('旋转头端，使倒角与手具接口对齐，然后插入。');
    });

    /* ---------------- scroll: intro hero (verified lock) → install view; sim card in view → sim mode ---------------- */
    const wide = window.matchMedia('(min-width: 1101px)');
    if (!reduced) {
      // desktop: the sticky stage turns from the hero to the install view as the steps come up;
      // phones / tablets: as the stage itself scrolls up into its reading position
      scrollTrack($('.vf-steps'), (r, vh) => (0.64 * vh - r.top) / (0.34 * vh), (p) => { if (wide.matches && Math.abs(1 - p - V.intro) > 1e-4) { V.intro = 1 - p; redraw(); } });
      scrollTrack($('.vf-stage'), (r, vh) => (0.55 * vh - r.top) / (0.43 * vh), (p) => { if (!wide.matches && Math.abs(1 - p - V.intro) > 1e-4) { V.intro = 1 - p; redraw(); } });
    }
    const simCard = $('.vf-sim');
    const slotFlow = $('.vf-slot--flow'), slotSim = $('.vf-slot--sim');
    let simSeen = false;
    const moveGL = (slot) => { if (gl.parentElement !== slot) slot.appendChild(gl); };
    new IntersectionObserver(([e]) => { simSeen = e.isIntersecting; setMode(simSeen ? 'sim' : 'flow'); }, { rootMargin: '-38% 0px -38% 0px' }).observe(simCard);
    // phones / tablets: the 3D view travels into the sim card while it is on screen (one WebGL context)
    const flowVis = { v: true };
    new IntersectionObserver(([e]) => { flowVis.v = e.isIntersecting; syncSlot(); }, { threshold: 0.05 }).observe(slotFlow);
    new IntersectionObserver(([e]) => { syncSlot(e.isIntersecting); }, { threshold: 0.05 }).observe(slotSim);
    function syncSlot(simVis) {
      if (wide.matches) { moveGL(slotFlow); return; }
      if (simVis === true && !flowVis.v) moveGL(slotSim);
      else if (flowVis.v) moveGL(slotFlow);
    }
    wide.addEventListener?.('change', () => syncSlot());

    /* ---------------- anti-counterfeit simulator ---------------- */
    const lines = $('.vf-con__lines'), verdict = $('.vf-con__verdict');
    const chips = [...root.querySelectorAll('.vf-chip')], codeRows = [...root.querySelectorAll('.vf-code')];
    let run = 0, simTl = null;
    async function simulate(i, user = true) {
      const my = ++run, sc = SCEN[i];
      if (user) setMode('sim');
      chips.forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)));
      codeRows.forEach((r) => r.classList.remove('is-hit'));
      verdict.className = 'vf-con__verdict'; verdict.innerHTML = '';
      lines.innerHTML = '';
      // 3D: nodes light while reading the tip, rings fill while checking; reject = red + shake + ✕ + fault code
      simTl?.kill(); badgeText = sc.code || '';
      const M = V.sim;
      Object.assign(M, { progress: 0, verified: 0, reject: 0 }); redraw();
      if (!reduced) {
        simTl = gsap.timeline({ onUpdate: redraw })
          .to(M, { progress: 0.47, duration: 0.84, ease: 'none' })
          .to(M, { progress: sc.code ? (sc.code === 'E306' ? 0.9 : 0.62) : 1, duration: 0.62, ease: 'power1.inOut' });
      }
      const L = [
        '› 检测到治疗头接入',
        '› 读取头端信息',
        sc.code === 'E306' ? '› 提交激活码' : '› 校验中',
      ];
      const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
      for (let k = 0; k < L.length; k++) {
        if (my !== run) return;
        const row = document.createElement('div');
        row.className = 'vf-con__ln';
        row.innerHTML = `<span>${L[k]}</span><i class="vf-con__dots"></i><b></b>`;
        lines.appendChild(row);
        await wait(420);
        if (my !== run) return;
        row.querySelector('b').textContent = k < L.length - 1 || !sc.code ? 'OK' : '!';
        row.classList.add(k < L.length - 1 || !sc.code ? 'is-ok' : 'is-bad');
      }
      await wait(200);
      if (my !== run) return;
      if (!sc.code) {
        verdict.classList.add('is-ok');
        verdict.innerHTML = `<div class="vf-v__icon" aria-hidden="true">✓</div><div><div class="vf-v__code">校验通过</div><div class="vf-v__msg">进入激活界面 · 扫码输入激活码后开始治疗</div></div>`;
        if (reduced) Object.assign(M, { progress: 1, verified: 1 }); else simTl.to(M, { verified: 1, duration: 1.1, ease: 'power2.out' });
      } else {
        verdict.classList.add('is-bad');
        verdict.innerHTML = `<div class="vf-v__icon" aria-hidden="true">!</div><div><div class="vf-v__code mono">${sc.code}</div><div class="vf-v__msg">${faultText[sc.code]}</div><div class="vf-v__fix">${REMEDY[sc.code]}</div></div>`;
        codeRows.find((r) => r.dataset.c === sc.code)?.classList.add('is-hit');
        V.shakeT = performance.now() / 1000;
        if (reduced) Object.assign(M, { progress: sc.code === 'E306' ? 0.9 : 0.62, reject: 1 }); else simTl.to(M, { reject: 1, duration: 0.2 });
      }
      redraw();
      if (!reduced) gsap.fromTo(verdict, { opacity: 0, y: 12, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out' });
    }
    chips.forEach((c, i) => c.addEventListener('click', () => simulate(i)));
    onceVisible(simCard, () => { if (run === 0) simulate(2, false); }, 0.35);
    setMode('flow');
  },
};
