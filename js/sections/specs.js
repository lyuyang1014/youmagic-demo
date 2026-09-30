// #specs — 技术参数
// 3D product anatomy (YM3D createDevice): the YM5-G1 console explodes on scroll (结构示意) with its holstered
// YM5-H1 handpiece; numbered hotspots are DOM buttons projected from the model's anchors, each one flies the
// camera to its part (drag to orbit). Handpiece control-button mini simulator drives the 3D buttons + screen.
// Then count-up spec sheet (data.specs), level→power ruler (lib.levelPower), components table (data.components).
import * as THREE from 'three';
import * as S3 from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createDevice } from '../ym3d/device.mjs';
import { createStudioFloor } from '../ym3d/dataviz.mjs';
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

/* hotspots → device anchors. n = outward normal in device space ('hp:' = handpiece space) for back-face fading.
   view = camera when the hotspot is opened (az/el radians, r metres), ex = minimum explode, roll = handpiece roll
   about its own axis (keeps the cable attachment fixed) so the part faces the camera. */
const HOTS = [
  {
    g: 'dev', a: 'screen', n: [0, 0, 1], hl: 'screen', view: { az: -0.3, el: 0.06, r: 1.15 }, t: '触摸屏', en: 'TOUCHSCREEN', src: '使用说明书 第 8–9 页',
    d: '通过交互式触摸屏访问所有治疗仪控制：系统状态栏、治疗发数与参数状态（发数 · 累计能量 · 阻值 · 功率）、一次性使用治疗头端类型显示，以及功率档位、制冷强度、脉冲时间的 [+] [−] 调节。',
  },
  {
    g: 'dev', a: 'power', n: [0, 0, 1], hl: 'power', view: { az: -0.28, el: 0.14, r: 0.95 }, boot: true, t: '主机控制开关', en: 'MAIN CONTROL SWITCH', src: '使用说明书 第 8 页',
    d: '按主机控制开关将低电压接入治疗仪并开机：开关亮起、屏幕启动，治疗仪执行启动程序验证功能，自检后完成启动。',
  },
  {
    g: 'dev', a: 'handpiece', hl: 'handpiece', view: { az: -0.52, el: 0.1, r: 0.95 }, t: '治疗手具总成', en: 'HANDPIECE · YM5-H1', src: '使用说明书 第 7、10 页',
    d: '治疗须通过治疗手具启动：手具传送射频能量以选择性加热组织，同时以传导方式冷却表皮；治疗仪通过治疗手具控制制冷剂递送。手具线缆 2.0 m。',
  },
  {
    g: 'dev', a: 'can', internal: true, ex: 1, view: { az: -1.3, el: 0.16, r: 1.25 }, t: '制冷剂罐 R134a', en: 'CRYOGEN · 结构示意', src: '使用说明书 第 7、12、15 页',
    d: '制冷剂（R134a 型）递送到治疗头端电极的非患者侧，以传导方式冷却皮肤表面；治疗仪通过治疗手具控制制冷剂递送。图中罐体与管路的位置、外形为结构示意，非实际内部布局。',
  },
  {
    g: 'dev', a: 'rf', internal: true, ex: 1, view: { az: -1.1, el: 0.06, r: 1.35 }, t: '射频输出', en: 'RF OUTPUT · 结构示意', src: '使用说明书 第 6、9、30 页',
    d: '单极电容耦合射频 6.78 MHz ± 3%；输出功率 25 – 175 W（能量强度 0.5 – 8，每 0.5 档 +10 W）；输出功率误差不大于设定值的 ±20%。图中内部模块为结构示意，非实际电路布局。',
  },
  {
    g: 'dev', a: 'io', n: [0, 0, -1], view: { az: 2.7, el: 0.1, r: 1.25 }, t: '电源输入', en: 'MAINS INPUT', src: '使用说明书 第 6–8、30 页',
    d: '交流电额定输入 220 V~，50 Hz，500 VA；电源线 3.0 m。I 类设备 · BF 型应用部分 · 连续运行。',
  },
  {
    g: 'hp', a: 'enable', n: 'hp:0,0,1', ex: 1, roll: 0, view: { az: -0.62, el: 0.08, r: 0.5 }, t: '使能按钮', en: 'ENABLE BUTTON', src: '使用说明书 第 10、15 页',
    d: '按一下使能按钮，治疗仪开启冷却功能并将制冷剂递送到手具；按住进入“预备”，适当接触后转入“启动”；松开即终止“启动”模式并中断射频传送。',
  },
  {
    g: 'hp', a: 'nose', ex: 1, roll: -0.6, view: { az: -0.75, el: 0.22, r: 0.4 }, t: '内置触发开关', en: 'BUILT-IN TRIGGER', src: '使用说明书 第 10 页',
    d: '按下使能按钮，治疗仪进入射频准备发射状态；下压治疗头（触发开关）传递射频能量。松开使能按钮或抬起治疗头（解除开关），射频停止输出。',
  },
  {
    g: 'hp', a: 'electrode', n: 'hp:0,1,0', ex: 1, roll: -0.4, hl: 'tip', view: { az: -0.72, el: 0.5, r: 0.36 }, t: '一次性使用治疗头端', en: 'YM5-TP4-900', src: '使用说明书 第 7、10–11、19 页',
    d: '安装在治疗手具前端，型号 YM5-TP4-900：治疗面积 4.0 cm² · 900 发 · 铜、聚酰亚胺。仅供一名患者使用，请勿重复使用或重新处理；几何形状仅允许单向插入；安装后其类型与可用发数显示在触摸屏上；使用前以 75% 酒精清洁并检查电极表面。',
  },
  {
    g: 'hp', a: 'controls', n: 'hp:0,0,-1', ex: 1, roll: Math.PI, view: { az: -0.62, el: 0.08, r: 0.5 }, ctl: true, t: '控制按钮 R / − / M / +', en: 'CONTROL BUTTONS', src: '使用说明书 第 10 页',
    d: '位于手具另一侧近线缆端。“M”选择要调整的参数（选定参数在触摸屏显示为绿色），[+] [−] 调整，按“M”确认或稍后自动确认；“R”快速切换到上一次的治疗参数设置。',
  },
];
const OVERVIEW = { az: -0.52, el: 0.13, azEx: -1.02, elEx: 0.2 };

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

function build3D(container, V, { reduced, onFrame }) {
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), vEye = new THREE.Vector3(), q = new THREE.Quaternion(), qRoll = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const cam = { tx: 0, ty: 0.7, tz: 0.1, r: 4, az: OVERVIEW.az, el: OVERVIEW.el, init: false };
  return mount3D(container, {
    THREE, stageLib: precompileLib(freshCanvasStages(S3)), dpr: 1.5, draggable: true,
    stageOpts: { fov: 30, background: 0x0a0a11, exposure: 1.0 },
    fallback: (el) => el.classList.add('is-fallback'),
    build(stage) {
      const { scene, lights } = stage;
      lights.key.shadow.camera.left = -1.3; lights.key.shadow.camera.right = 1.3; lights.key.shadow.camera.top = 1.8; lights.key.shadow.camera.bottom = -0.8;
      lights.key.position.set(2.2, 4.2, 3.2); lights.key.target.position.set(0, 0.6, 0); scene.add(lights.key.target);
      lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.camera.updateProjectionMatrix();
      lights.rim.intensity = 1.0;
      const floor = createStudioFloor(THREE, { radius: 3.2, color: 0x16161f, fade: 0.7 }); scene.add(floor.object3d);
      const dev = createDevice(THREE, {}); scene.add(dev.object3d);
      // violet studio bloom behind the product
      const glowTex = S3.glowTexture(THREE);
      const bloom = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6a3fd0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      bloom.position.set(0, 0.8, -1.4); bloom.scale.setScalar(4.2); bloom.renderOrder = -2; scene.add(bloom);
      // extra anchors: internal cryogen canister (internals group space) and the handpiece nose (tip interface)
      const can = new THREE.Object3D(); can.position.set(0, 0.96, -0.11); dev.parts.internals.add(can);
      const nose = new THREE.Object3D(); nose.position.set(0, -0.004, 0); dev.parts.handpiece.add(nose);
      return { cv: stage.renderer.domElement, dev, floor, bloom, glowTex, extra: { can, nose }, sv: {}, pts: HOTS.map(() => ({ x: 0, y: 0, vis: 0 })), dim: { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, vis: 0 }, lastW: 0, lastH: 0, roll: 0 };
    },
    frame(s, stage, t, dt, api) {
      const size = stage.renderer.getSize(new THREE.Vector2()), W = size.x, H = size.y;
      const resized = W !== s.lastW || H !== s.lastH; s.lastW = W; s.lastH = H;
      if (reduced && !V.needs && !resized) return;
      V.needs = false;
      const now = performance.now() / 1000, tt = reduced ? 0 : t;
      const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
      const h = V.cur >= 0 ? HOTS[V.cur] : null;
      // explode: scroll / toggle, raised to the hotspot's minimum
      const exT = Math.max(V.exT, h?.ex ?? 0);
      V.ex += (exT - V.ex) * (reduced ? 1 : 1 - Math.exp(-dt * 2.6)); if (Math.abs(exT - V.ex) < 1e-4) V.ex = exT;
      // screen state (power hotspot plays the boot sequence)
      let screen = 'treatment';
      if (V.bootT > 0) { const b = now - V.bootT; screen = b < 0.45 ? 'off' : b < 2.8 ? 'boot' : 'treatment'; if (b > 3) V.bootT = 0; }
      Object.assign(s.sv, V.sv);
      const hlKey = (V.hover >= 0 ? HOTS[V.hover].hl : null) || h?.hl || null;
      const btn = V.btn && now - V.btnT < 0.35 ? V.btn : null;
      s.dev.update({ t: tt, explode: V.ex, screen, screenValues: s.sv, rimGlow: 0.75, highlight: hlKey, buttonPress: btn, buttonPressAmount: btn ? Math.sin(Math.min(1, (now - V.btnT) / 0.35) * Math.PI) : 0 });
      // roll the handpiece about its own axis (tail stays put, so the cable still meets it)
      const rollT = h?.roll ?? 0; s.roll += (rollT - s.roll) * k;
      if (Math.abs(s.roll) > 1e-4) { const hp = s.dev.parts.handpiece; qRoll.setFromAxisAngle(Y, s.roll * Math.min(1, V.ex * 1.5)); hp.quaternion.multiply(qRoll); }
      s.dev.object3d.updateMatrixWorld(true);
      // camera target (live anchor for the open hotspot)
      const exE = S3.ease.inOut(V.ex);
      let tx, ty, tz, r, az, el;
      const aspect = W / Math.max(1, H), halfV = Math.tan((30 * Math.PI) / 360);
      if (h) {
        anchorOf(s, h, v3); tx = v3.x; ty = v3.y; tz = v3.z;
        r = h.view.r * (aspect < 1 ? 1.25 / Math.max(0.55, aspect) : 1); az = h.view.az; el = h.view.el;
      } else {
        const port = aspect < 1; // phones: a more frontal exploded view keeps the composition tall rather than wide
        const hw = S3.lerp(0.6, port ? 0.66 : 0.95, exE), hh = S3.lerp(0.72, port ? 0.9 : 0.86, exE); // half extents of the composition
        r = Math.max(hh / halfV, hw / (halfV * aspect)) * (port ? 1.02 : 1.1);
        tx = S3.lerp(0, port ? -0.06 : -0.12, exE); ty = S3.lerp(0.66, 0.8, exE); tz = S3.lerp(0.04, 0.12, exE);
        az = S3.lerp(OVERVIEW.az, port ? -0.66 : OVERVIEW.azEx, exE) + V.scrollAz; el = S3.lerp(OVERVIEW.el, OVERVIEW.elEx, exE);
      }
      // leave room for the docked popover (desktop: part slides right of centre; phone: part rises above the sheet)
      if (h && V.popSide) {
        const shift = r * halfV * (aspect >= 1 ? 0.62 * aspect * 0.42 : 0);
        const rx = Math.cos(az), rz = -Math.sin(az);
        tx -= rx * shift; tz -= rz * shift;
        if (aspect < 1) ty -= r * halfV * 0.35;
      }
      if (!cam.init || reduced) { Object.assign(cam, { tx, ty, tz, r, az, el, init: true }); }
      else {
        cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k; cam.r += (r - cam.r) * k;
        let da = az - cam.az; da = Math.atan2(Math.sin(da), Math.cos(da)); cam.az += da * k; cam.el += (el - cam.el) * k;
      }
      const px = api.pointer.inside && !api.drag.active ? api.pointer.x * 0.05 : 0, py = api.pointer.inside && !api.drag.active ? api.pointer.y * 0.03 : 0;
      stage.camera.near = Math.max(0.01, cam.r * 0.05); stage.camera.updateProjectionMatrix();
      stage.orbit({ target: [cam.tx, cam.ty, cam.tz], radius: cam.r, azimuth: cam.az + api.drag.azimuth + px, elevation: S3.clamp(cam.el + api.drag.elevation + py, -0.35, 1.25) });
      s.bloom.material.opacity = 0.22 + 0.08 * exE;
      stage.render();
      // project hotspots (with back-face fade) + the height dimension line
      const camPos = stage.camera.position;
      HOTS.forEach((hs, i) => {
        const p = s.pts[i]; anchorOf(s, hs, v3);
        let vis = 1;
        if (hs.internal) vis = S3.clamp((V.ex - 0.55) / 0.3);
        // handpiece detail hotspots only while the camera is on the handpiece; console hotspots hide during that close-up
        const hpFocus = h && (h.g === 'hp' || h.a === 'handpiece');
        if (hs.g === 'hp') vis *= hpFocus ? S3.clamp((V.ex - 0.6) / 0.3) : 0;
        else if (hpFocus && hs.a !== 'handpiece') vis = 0;
        if (hs.n) {
          const nn = typeof hs.n === 'string' ? hs.n.slice(3).split(',').map(Number) : hs.n;
          v3b.set(nn[0], nn[1], nn[2]);
          if (typeof hs.n === 'string') { s.dev.parts.handpiece.getWorldQuaternion(q); v3b.applyQuaternion(q); }
          const d = v3b.dot(vEye.copy(camPos).sub(v3).normalize());
          vis *= S3.clamp((d + 0.05) / 0.3);
        }
        v3.project(stage.camera);
        p.x = (v3.x * 0.5 + 0.5) * W; p.y = (-v3.y * 0.5 + 0.5) * H;
        p.vis = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 ? vis : 0;
      });
      const dm = s.dim; dm.vis = h ? 0 : S3.clamp(1 - V.ex * 8);
      if (dm.vis > 0) {
        v3.set(-0.44, 0, 0.02).project(stage.camera); dm.a.x = (v3.x * 0.5 + 0.5) * W; dm.a.y = (-v3.y * 0.5 + 0.5) * H;
        v3.set(-0.44, 1.285, 0.02).project(stage.camera); dm.b.x = (v3.x * 0.5 + 0.5) * W; dm.b.y = (-v3.y * 0.5 + 0.5) * H;
      }
      onFrame(s.pts, dm, W, H);
    },
    dispose(s) { s.cv.dataset.ymLost = '1'; s.dev.dispose(); s.floor.dispose(); s.bloom.material.dispose(); s.glowTex.dispose(); },
  });
  function anchorOf(s, h, out) {
    if (h.a === 'can' || h.a === 'nose') { const o = s.extra[h.a]; o.updateWorldMatrix(true, false); return out.setFromMatrixPosition(o.matrixWorld); }
    return s.dev.anchor(h.a, out);
  }
}

const IMG = 'assets/img/';

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
  id: 'specs',
  nav: '技术参数',
  async init(root, ctx) {
    const { lib, data: D, gsap, reduced } = ctx;
    const S = D.specs;
    const eMin = lib.density(0.5, 1.0), eMax = Math.max(...lib.LEVELS.flatMap((lv) => lib.PULSES.filter((p) => lib.isAllowed(lv, p)).map((p) => lib.density(lv, p))));

    const GROUPS = [
      { t: '射频输出', en: 'RF OUTPUT', rows: [
        ['射频能量', S.rfFreq, 1], ['输出功率', S.power, 1], ['阻抗测量', S.impedance, 1], ['额定负载', S.ratedLoad, 1],
        ['基本性能', S.powerAccuracy, 0], ['最大峰值电压', S.maxPeakVoltage, 1],
      ] },
      { t: '治疗参数', en: 'TREATMENT PARAMETERS', rows: [
        ['能量强度', S.energyLevel, 1], ['制冷强度', S.cooling, 1], ['脉冲时间', S.pulse, 1],
        ['能量密度范围', `${eMin.toFixed(1)} – ${eMax.toFixed(1)} J/cm²`, 1], ['治疗头端', `YM5-TP4-900 · 4.0 cm² · 900 发`, 0],
      ] },
      { t: '电气与安全', en: 'ELECTRICAL · SAFETY', rows: [
        ['交流电额定输入', S.input, 1], ['运行模式', S.mode, 0], ['防电击', S.shock, 0], ['防潮等级', S.ip, 0],
        ['符合标准', S.standards.join('<br>'), 0],
      ] },
      { t: '机械与环境', en: 'MECHANICAL · ENVIRONMENT', rows: [
        ['尺寸', S.size, 1], ['重量', S.weight, 1],
        ['线缆长度', `电源线 ${S.cables.power} · 手具 ${S.cables.handpiece} · 中性电极 ${S.cables.electrode}`, 1],
        ['操作条件', S.operating, 1],
        ['使用有效期', `主机 ${S.lifetime.host} · 一次性使用治疗头端 ${S.lifetime.tip}`, 1],
      ] },
    ];

    const wrapNums = (str) => str.replace(/(\d+(?:\.\d+)?)/g, (m) => `<span class="sp-n" data-v="${m}">${m}</span>`);

    const hot = (h, i) => `
      <button type="button" class="sp-hot" data-i="${i}" aria-expanded="false" aria-controls="sp-pop" aria-label="${i + 1}. ${h.t}">
        <span class="sp-hot__n mono">${i + 1}</span>
      </button>`;

    root.innerHTML = `
    <div class="wrap">
      <span class="sec-num" aria-hidden="true">13</span>
      <header class="sec-head">
        <span class="eyebrow">13 · SPECIFICATIONS</span>
        <h2 class="h1">技术<span class="grad-text">参数</span></h2>
        <p class="lead">主机、治疗手具与一次性使用治疗头端的结构与规格。向下滚动，主机分层展开；点击编号，镜头飞向对应部件并查看功能说明（可拖动旋转）。参数均摘自产品使用说明书。</p>
      </header>

      <div class="sp-anat">
        <div class="sp-stage" role="group" aria-label="YM5 射频皮肤治疗仪三维结构图：主机 YM5-G1 与治疗手具 YM5-H1，可拖动旋转">
          <div class="sp-hots">${HOTS.map(hot).join('')}</div>
          <svg class="sp-lines" aria-hidden="true"><line class="sp-lead" x1="0" y1="0" x2="0" y2="0"/><g class="sp-dimg"><line class="sp-dimln" x1="0" y1="0" x2="0" y2="0"/><line class="sp-dimt sp-dimt--a" x1="0" y1="0" x2="0" y2="0"/><line class="sp-dimt sp-dimt--b" x1="0" y1="0" x2="0" y2="0"/></g></svg>
          <span class="sp-dimlab mono" aria-hidden="true">1285 mm</span>
          <div class="sp-cap"><span class="mono">YM5-G1</span>主机<i></i><span class="mono">YM5-H1</span>治疗手具总成</div>
          <span class="sp-tag mono" aria-live="polite">结构示意 · 内部部件与分离位置为示意</span>
          <div class="seg sp-view" role="group" aria-label="视图">
            <button type="button" data-ex="0" aria-pressed="true">整机</button><button type="button" data-ex="1" aria-pressed="false">爆炸图</button>
          </div>
          <button type="button" class="btn sp-back" hidden><span aria-hidden="true">←</span> 返回整机</button>
          <span class="sp-drag micro" aria-hidden="true">拖动旋转</span>
          <img class="sp-fb" src="${IMG}device.webp" alt="YM5 射频皮肤治疗仪主机正面 3/4 视图" hidden />

        </div>

        <div class="sp-pop card--glass" id="sp-pop" role="region" aria-live="polite" hidden>
          <button type="button" class="sp-pop__x" aria-label="关闭">×</button>
          <span class="sp-pop__en mono"></span>
          <h3 class="sp-pop__t"></h3>
          <p class="sp-pop__d"></p>
          <div class="sp-ctl" hidden>
            <div class="sp-ctl__scr" aria-live="polite">
              <div class="sp-ctl__p" data-k="level"><span>功率档位</span><b class="num"></b></div>
              <div class="sp-ctl__p" data-k="cooling"><span>制冷强度</span><b class="num"></b></div>
              <div class="sp-ctl__p" data-k="pulse"><span>脉冲时间</span><b class="num"></b></div>
              <div class="sp-ctl__e mono"></div>
            </div>
            <div class="sp-ctl__keys">
              <button type="button" class="sp-key sp-key--r" data-key="R" aria-label="R 调用上一次参数">R</button>
              <span class="sp-key__pill">
                <button type="button" class="sp-key" data-key="-" aria-label="减少">−</button>
                <button type="button" class="sp-key" data-key="M" aria-label="M 选择参数">M</button>
                <button type="button" class="sp-key" data-key="+" aria-label="增加">+</button>
              </span>
            </div>
            <p class="sp-ctl__msg micro"></p>
          </div>
          <span class="tag-src sp-pop__src"></span>
        </div>

        <ol class="sp-legend" data-reveal>
          <li class="sp-legend__g mono">主机 YM5-G1</li>
          ${HOTS.map((h, i) => (h.g === 'dev' ? `<li><button type="button" data-i="${i}"><span class="mono">${i + 1}</span>${h.t}${h.internal ? '<em>示意</em>' : ''}</button></li>` : '')).join('')}
          <li class="sp-legend__g mono">治疗手具 YM5-H1</li>
          ${HOTS.map((h, i) => (h.g === 'hp' ? `<li><button type="button" data-i="${i}"><span class="mono">${i + 1}</span>${h.t}</button></li>` : '')).join('')}
        </ol>
      </div>

      <div class="sp-hero">
        <div class="sp-stat" data-reveal><span class="sp-stat__k">射频频率 · ± 3%</span><span class="sp-stat__v num"><b data-to="6.78" data-d="2">6.78</b><small>MHz</small></span></div>
        <div class="sp-stat" data-reveal><span class="sp-stat__k">输出功率 · 能量强度 0.5–8</span><span class="sp-stat__v num"><em>25–</em><b data-to="175" data-d="0">175</b><small>W</small></span></div>
        <div class="sp-stat" data-reveal><span class="sp-stat__k">治疗面积 · YM5-TP4-900</span><span class="sp-stat__v num"><b data-to="4.0" data-d="1">4.0</b><small>cm²</small></span></div>
        <div class="sp-stat" data-reveal><span class="sp-stat__k">每个一次性使用治疗头端</span><span class="sp-stat__v num"><b data-to="900" data-d="0">900</b><small>发</small></span></div>
      </div>

      <div class="sp-sheet">
        ${GROUPS.map((g) => `
          <section class="sp-group" data-reveal>
            <header class="sp-group__h"><h3>${g.t}</h3><span class="mono">${g.en}</span></header>
            <dl class="sp-rows">
              ${g.rows.map(([k, v, c]) => `<div class="sp-row"><dt>${k}</dt><dd class="${c ? 'mono' : ''}">${c ? wrapNums(v) : v}</dd></div>`).join('')}
            </dl>
          </section>`).join('')}

        <section class="sp-group sp-ruler" data-reveal>
          <header class="sp-group__h"><h3>能量强度 → 输出功率</h3><span class="mono">LEVEL · POWER · 16 STEPS</span></header>
          <div class="sp-ruler__body">
            <div class="sp-ruler__chart">
              <div class="sp-bars" aria-hidden="true">
                ${lib.LEVELS.map((lv) => `<i data-lv="${lv}" style="--h:${lib.levelPower(lv) / 175}"></i>`).join('')}
              </div>
              <div class="sp-bars__x mono" aria-hidden="true">${lib.LEVELS.map((lv) => `<span>${lv % 1 ? '' : lv}</span>`).join('')}</div>
              <input class="range sp-ruler__in" type="range" min="0.5" max="8" step="0.5" value="${D.screenRef.level}" aria-label="能量强度档位" />
            </div>
            <div class="sp-ruler__read">
              <span class="field__label">能量强度</span>
              <span class="sp-ruler__lv num"></span>
              <span class="field__label">输出功率</span>
              <span class="sp-ruler__w num"></span>
              <p class="small">每 0.5 档 +10 W<br />额定负载 ${S.ratedLoad}</p>
            </div>
          </div>
          <p class="note">拖动滑块或在柱上悬停查看 · 来源：使用说明书 第 9、30–31 页</p>
        </section>
      </div>

      <div class="sp-comp" data-reveal>
        <header class="sp-group__h"><h3>组成与配件</h3><span class="mono">COMPONENTS</span></header>
        <div class="sp-table" role="table" aria-label="治疗仪组件与配件">
          <div class="sp-tr sp-tr--h" role="row"><span role="columnheader">部件</span><span role="columnheader">型号</span><span role="columnheader">材质</span><span role="columnheader">与患者接触</span><span role="columnheader">说明</span></div>
          ${D.components.map((c) => `
            <div class="sp-tr" role="row">
              <span role="cell" class="sp-td--name">${c.name}</span>
              <span role="cell" class="mono" data-l="型号">${c.model}</span>
              <span role="cell" data-l="材质">${c.material || '—'}</span>
              <span role="cell" data-l="与患者接触" class="${c.contact ? '' : 'is-empty'}">${c.contact ? `<i class="sp-contact${c.contact === '是' ? ' is-yes' : ''}"></i>${c.contact}` : '—'}</span>
              <span role="cell" class="sp-td--note${c.note ? '' : ' is-empty'}" data-l="说明">${c.note || '—'}</span>
            </div>`).join('')}
        </div>
        <p class="note">治疗仪只能与制造商提供的组件和配件配套使用。中性电极片型号 GBS-Db1131a；制冷剂罐 R134a 型。来源：使用说明书 第 7 页</p>
      </div>
    </div>`;

    /* ---------- 3D anatomy: logical view state (survives WebGL context dispose / rebuild) ---------- */
    const V = {
      cur: -1, hover: -1, ex: reduced ? 1 : 0, exT: reduced ? 1 : 0, scrollAz: 0, bootT: 0, btn: null, btnT: 0, popSide: false, needs: true,
      sv: { level: D.screenRef.level, cooling: D.screenRef.cooling, pulse: D.screenRef.pulse, shots: D.screenRef.shots, shotsTotal: D.screenRef.total, energyKJ: D.screenRef.energyKJ, ohm: D.screenRef.ohm, watt: D.screenRef.watt, status: 'ready', selected: null },
    };
    const anat = root.querySelector('.sp-anat');
    const stageEl = root.querySelector('.sp-stage');
    const pop = root.querySelector('.sp-pop');
    const hots = [...root.querySelectorAll('.sp-hot')];
    const legendBtns = [...root.querySelectorAll('.sp-legend button')];
    const ctlBox = pop.querySelector('.sp-ctl');
    const viewBtns = [...root.querySelectorAll('.sp-view button')];
    const backBtn = root.querySelector('.sp-back');
    const lead = root.querySelector('.sp-lead'), dimG = root.querySelector('.sp-dimg'), dimLab = root.querySelector('.sp-dimlab');
    const dimLn = root.querySelector('.sp-dimln'), dimTa = root.querySelector('.sp-dimt--a'), dimTb = root.querySelector('.sp-dimt--b');
    const tag = root.querySelector('.sp-tag');
    const isMobile = () => window.innerWidth < 900;
    let cur = -1;
    const hotVis = HOTS.map(() => -1);
    let tagOn = null, dimOn = null, exOn = null;
    const setAttr = (el, a) => { for (const k in a) el.setAttribute(k, a[k].toFixed ? a[k].toFixed(1) : a[k]); };
    function onFrame(pts, dm, W, H) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], b = hots[i], vis = i === cur ? 1 : p.vis;
        b.style.translate = `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`; // (translate, not transform: composes with the CSS `scale` states)
        const q = vis < 0.05 ? 0 : vis > 0.95 ? 1 : Math.round(vis * 10) / 10;
        if (q !== hotVis[i]) { hotVis[i] = q; b.style.opacity = q; b.style.pointerEvents = q > 0.4 ? 'auto' : 'none'; b.tabIndex = q > 0.4 ? 0 : -1; }
      }
      // leader from the docked popover to the open hotspot
      if (cur >= 0 && !pop.hidden && !isMobile()) {
        const p = pts[cur], pr = pop.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
        const x1 = pr.right - sr.left, y1 = Math.min(Math.max(pr.top - sr.top + 36, p.y), pr.bottom - sr.top - 24);
        setAttr(lead, { x1, y1, x2: p.x - 14, y2: p.y }); lead.style.opacity = 1;
      } else lead.style.opacity = 0;
      // 1285 mm height dimension (assembled overview only)
      const dOn = dm.vis > 0.02;
      if (dOn !== dimOn) { dimOn = dOn; dimG.style.opacity = dimLab.style.opacity = dOn ? 1 : 0; }
      if (dOn) {
        dimG.style.opacity = dimLab.style.opacity = dm.vis;
        setAttr(dimLn, { x1: dm.a.x, y1: dm.a.y, x2: dm.b.x, y2: dm.b.y });
        setAttr(dimTa, { x1: dm.a.x - 6, y1: dm.a.y, x2: dm.a.x + 6, y2: dm.a.y });
        setAttr(dimTb, { x1: dm.b.x - 6, y1: dm.b.y, x2: dm.b.x + 6, y2: dm.b.y });
        dimLab.style.transform = `translate3d(${((dm.a.x + dm.b.x) / 2 - 10).toFixed(1)}px, ${((dm.a.y + dm.b.y) / 2).toFixed(1)}px, 0) translate(-100%, -50%)`;
      }
      const tOn = V.ex > 0.25;
      if (tOn !== tagOn) { tagOn = tOn; tag.classList.toggle('is-on', tOn); }
      const eOn = V.exT > 0.5;
      if (eOn !== exOn) { exOn = eOn; viewBtns.forEach((b) => b.setAttribute('aria-pressed', String((+b.dataset.ex === 1) === eOn))); }
    }
    const m3 = build3D(stageEl, V, { reduced, onFrame });
    const redraw = () => { V.needs = true; m3.invalidate(); };
    m3.canvas.setAttribute('aria-hidden', 'true');
    new MutationObserver(() => { if (stageEl.classList.contains('is-fallback')) root.querySelector('.sp-fb').hidden = false; }).observe(stageEl, { attributes: true, attributeFilter: ['class'] });

    /* scroll: assembled → exploded (+ a slow orbit); the 整机 / 爆炸图 toggle takes over until the stage leaves */
    let manual = false;
    if (!reduced) {
      scrollTrack(stageEl, (r, vh) => (0.78 * vh - r.top) / (0.66 * vh), (p) => {
        if (manual) return;
        const e = S3.smooth(p), az = S3.lerp(-0.22, 0, p);
        if (Math.abs(e - V.exT) > 1e-4 || Math.abs(az - V.scrollAz) > 1e-4) { V.exT = e; V.scrollAz = az; redraw(); }
      });
    }
    new IntersectionObserver(([e]) => { if (!e.isIntersecting) manual = false; }).observe(stageEl);
    viewBtns.forEach((b) => b.addEventListener('click', () => { manual = true; if (cur >= 0) close(); V.exT = +b.dataset.ex; redraw(); }));

    /* ---------- hotspots & popover ---------- */
    function open(i) {
      if (cur === i) { close(); return; }
      cur = i; V.cur = i;
      const h = HOTS[i];
      pop.querySelector('.sp-pop__en').textContent = `${String(i + 1).padStart(2, '0')} · ${h.en}`;
      pop.querySelector('.sp-pop__t').textContent = h.t;
      pop.querySelector('.sp-pop__d').textContent = h.d;
      pop.querySelector('.sp-pop__src').textContent = '来源：' + h.src;
      ctlBox.hidden = !h.ctl;
      V.sv.selected = h.ctl ? selK : null;
      if (h.boot && !reduced) V.bootT = performance.now() / 1000;
      pop.hidden = false; V.popSide = true;
      hots.forEach((b) => { const on = +b.dataset.i === i; b.classList.toggle('is-on', on); b.setAttribute('aria-expanded', String(on)); });
      legendBtns.forEach((b) => b.classList.toggle('is-on', +b.dataset.i === i));
      anat.classList.add('has-pop'); backBtn.hidden = false;
      if (!reduced) { gsap.to(m3.drag, { azimuth: 0, elevation: 0, duration: 1.2, ease: 'power3.inOut' }); gsap.fromTo(pop, { opacity: 0, y: 8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' }); }
      else { m3.drag.azimuth = 0; m3.drag.elevation = 0; }
      redraw();
    }
    function close() {
      cur = -1; V.cur = -1; pop.hidden = true; V.popSide = false; V.sv.selected = null; anat.classList.remove('has-pop'); backBtn.hidden = true;
      hots.forEach((b) => { b.classList.remove('is-on'); b.setAttribute('aria-expanded', 'false'); });
      legendBtns.forEach((b) => b.classList.remove('is-on'));
      redraw();
    }
    const hoverOn = (i) => { V.hover = i; redraw(); }, hoverOff = () => { V.hover = -1; redraw(); };
    [...hots, ...legendBtns].forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); open(+b.dataset.i); });
      b.addEventListener('pointerenter', () => hoverOn(+b.dataset.i)); b.addEventListener('pointerleave', hoverOff);
      b.addEventListener('focus', () => hoverOn(+b.dataset.i)); b.addEventListener('blur', hoverOff);
    });
    pop.querySelector('.sp-pop__x').addEventListener('click', close);
    backBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', (e) => { if (cur >= 0 && !anat.contains(e.target)) close(); });
    anat.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur >= 0) { const i = cur; close(); hots[i]?.focus(); } });
    lib.whenVisible(anat, () => anat.classList.add('is-live'), () => anat.classList.remove('is-live'));

    /* ---------- handpiece control-button mini simulator (交互示意) ---------- */
    const scr = ctlBox.querySelector('.sp-ctl__scr');
    const msg = ctlBox.querySelector('.sp-ctl__msg');
    const P = { level: D.screenRef.level, cooling: 0, pulse: D.screenRef.pulse };
    P.cooling = lib.bandOf(lib.density(P.level, P.pulse)).coolDefault;
    let prev = { ...P }, dirty = false, selK = 'level', confirmT = null;
    const KEYS = ['level', 'cooling', 'pulse'];
    const fmt = { level: (v) => v.toFixed(1), cooling: (v) => String(v), pulse: (v) => v.toFixed(1) };
    const paintCtl = () => {
      scr.querySelectorAll('.sp-ctl__p').forEach((el) => {
        el.querySelector('b').textContent = fmt[el.dataset.k](P[el.dataset.k]);
        el.classList.toggle('is-sel', el.dataset.k === selK);
      });
      const e = lib.density(P.level, P.pulse), b = lib.bandOf(e);
      scr.querySelector('.sp-ctl__e').innerHTML = `${lib.levelPower(P.level)} W · <span style="color:${b.key === 'max' ? '#ef6a80' : b.hex}">${e.toFixed(1)} J/cm² · ${b.label}</span>`;
      // mirror onto the 3D console screen (selected parameter shows green, as on the device)
      Object.assign(V.sv, { level: P.level, cooling: P.cooling, pulse: P.pulse, watt: lib.levelPower(P.level), selected: cur >= 0 && HOTS[cur].ctl ? selK : null });
      redraw();
    };
    const say = (t) => { msg.textContent = t; };
    const scheduleConfirm = () => { clearTimeout(confirmT); confirmT = setTimeout(() => { if (dirty) { dirty = false; say('已自动确认'); } }, 2600); };
    ctlBox.querySelector('.sp-ctl__keys').addEventListener('click', (e) => {
      const k = e.target.closest('.sp-key')?.dataset.key; if (!k) return;
      V.btn = { R: 'R', M: 'M', '+': 'plus', '-': 'minus' }[k]; V.btnT = performance.now() / 1000; // 3D button press
      if (k === 'M') {
        if (dirty) { dirty = false; clearTimeout(confirmT); say('M：已确认修改'); }
        else { selK = KEYS[(KEYS.indexOf(selK) + 1) % 3]; say(`M：选定「${{ level: '功率档位', cooling: '制冷强度', pulse: '脉冲时间' }[selK]}」（触摸屏显示为绿色）`); }
      } else if (k === 'R') {
        [P.level, P.cooling, P.pulse, prev.level, prev.cooling, prev.pulse] = [prev.level, prev.cooling, prev.pulse, P.level, P.cooling, P.pulse];
        dirty = false; say('R：切换到上一次的治疗参数设置');
      } else {
        const d = k === '+' ? 1 : -1;
        const before = { ...P };
        if (selK === 'cooling') {
          const rng = lib.bandOf(lib.density(P.level, P.pulse)).coolRange;
          const nv = P.cooling + d;
          if (!rng.includes(nv)) { say(`制冷强度在当前能量水平可选 ${rng.join('、')}`); paintCtl(); return; }
          P.cooling = nv; say(`制冷强度 ${d > 0 ? '+' : '−'}1`);
        } else {
          const step = selK === 'level' ? 0.5 : 0.1;
          const nv = Math.round((P[selK] + d * step) * 10) / 10;
          const lv = selK === 'level' ? nv : P.level, pu = selK === 'pulse' ? nv : P.pulse;
          const inRange = selK === 'level' ? nv >= 0.5 && nv <= 8 : nv >= 0.7 && nv <= 1.5;
          if (!inRange || !lib.isAllowed(lv, pu)) { say(!inRange ? '已到调节范围端点' : '该组合不在能量输出表内 · 限制输出'); paintCtl(); return; }
          P[selK] = nv;
          P.cooling = lib.bandOf(lib.density(P.level, P.pulse)).coolDefault;
          say(`${selK === 'level' ? '功率档位 ±0.5' : '脉冲时间 ±0.1 s'} · 制冷自动调至默认 ${P.cooling}`);
        }
        if (!dirty) { prev = before; dirty = true; }
        scheduleConfirm();
      }
      paintCtl();
    });
    paintCtl(); say('交互示意：按 M 选择参数，+ / − 调整，R 调用上一次参数');

    /* ---------- count-ups ---------- */
    root.querySelectorAll('.sp-stat b[data-to]').forEach((el) => lib.countOnView(el, +el.dataset.to, { decimals: +el.dataset.d, duration: 1.8 }));
    root.querySelectorAll('.sp-group').forEach((g) => {
      const ns = [...g.querySelectorAll('.sp-n')];
      if (!ns.length || reduced) return;
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        ns.forEach((n, i) => {
          const v = n.dataset.v, dec = (v.split('.')[1] || '').length;
          lib.countUp(n, +v, { decimals: dec, duration: 1.3, delay: i * 0.03 });
        });
      }, { threshold: 0.3 });
      io.observe(g);
    });

    /* ---------- hover glow (cursor-following) ---------- */
    root.querySelectorAll('.sp-row, .sp-tr:not(.sp-tr--h), .sp-stat').forEach((row) => {
      row.addEventListener('pointermove', (e) => {
        const r = row.getBoundingClientRect();
        row.style.setProperty('--mx', e.clientX - r.left + 'px');
        row.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });

    /* ---------- level → power ruler ---------- */
    const rin = root.querySelector('.sp-ruler__in');
    const rLv = root.querySelector('.sp-ruler__lv'), rW = root.querySelector('.sp-ruler__w');
    const bars = [...root.querySelectorAll('.sp-bars i')];
    const setLv = (lv) => {
      rin.value = lv; rin.style.setProperty('--p', ((lv - 0.5) / 7.5) * 100 + '%');
      bars.forEach((b) => { const v = +b.dataset.lv; b.classList.toggle('is-on', v === lv); b.classList.toggle('is-le', v <= lv); });
      rLv.innerHTML = `${lv.toFixed(1)}<small>档</small>`; rW.innerHTML = `${lib.levelPower(lv)}<small>W</small>`;
    };
    rin.addEventListener('input', () => setLv(+rin.value));
    const barsEl = root.querySelector('.sp-bars');
    barsEl.addEventListener('pointermove', (e) => {
      const r = barsEl.getBoundingClientRect();
      const i = Math.max(0, Math.min(15, Math.floor(((e.clientX - r.left) / r.width) * 16)));
      setLv(lib.LEVELS[i]);
    });
    setLv(+rin.value);
    if (!reduced) {
      gsap.from(bars, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.9, ease: 'expo.out', stagger: 0.03, scrollTrigger: { trigger: barsEl, start: 'top 85%', once: true } });
    }
  },
};
