// #safety — 多重安全设计
// 3D shield (YM3D createShieldRings3D): 7 documented protection layers (operator → skin) as nested glowing rings
// around the skin core. Scroll explodes the gyroscope into a stacked tower (one labelled plate per layer);
// selecting a layer lights its ring; fault-scenario injection sends a wave inward that stops (red, shaking)
// at the intercepting layer. Then contraindications & side effects.
// Facts: IFU p.4–5, 7, 10–12, 14–20, 24–25 (printed pages).
import * as THREE from 'three';
import * as S3 from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createShieldRings3D, projectAnchor } from '../ym3d/dataviz.mjs';
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

// src: IFU p.24–25 故障代码表「故障解除措施」列
const FIX = {
  E104: '请接入制冷剂罐', E203: '请更换新治疗头', E301: '请更换新治疗头', E302: '请更换新治疗头',
  E403: '请检查电极片连接', E406: '请检查人体连接', E503: '请按压手柄大按键或检查制冷剂罐是否已空',
  E603: '请检查回路是否良好连接', E605: '请重试', E628: '请稍等或降低档位后重试',
};

// outer → inner (index 0 = outermost ring)
const LAYERS = [
  {
    id: 'people', name: '专业资质与培训', short: '资质培训', en: 'QUALIFIED OPERATORS', src: '使用说明书 第 4、16 页',
    pts: [
      '须由具有相关医学知识的医务人员（临床医生、护士、技师）使用，并可提供医师执业证书、护士证或技师证',
      '另需经过制造商专业培训，经培训人员确认合格后方可操作',
      '培训仅由制造商授权人员提供；设备由制造商售后服务部门或授权经销商技术人员安装',
    ],
    mini: 'people', faults: [], scen: [],
  },
  {
    id: 'tip', name: '一次性使用治疗头端', short: '一次性头端', en: 'SINGLE-PATIENT TIP', src: '使用说明书 第 10–12、19 页',
    pts: [
      '治疗头端仅供一名患者使用，请勿重复使用或尝试重新处理，避免患者之间微生物交叉污染',
      '仅可使用制造商提供的治疗头端；几何形状仅允许沿一个方向插入',
      '每个头端提供固定治疗计数（900 发）；激活后需在规定时间段内完成治疗发数',
    ],
    mini: 'tip', faults: ['E203', 'E301', 'E302'], scen: [],
  },
  {
    id: 'limit', name: '能量组合限制输出', short: '限制输出', en: 'OUTPUT LIMITS · SAFE DEFAULTS', src: '使用说明书 第 14–15、19 页',
    pts: [
      '为保证安全和避免无效治疗，过低和过高的功率与能量密度组合会被限制输出（下表空白单元格）',
      '首次治疗前给出默认安全参数：功率档位 2 · 制冷强度 1 · 脉冲时间 1.0 s',
      '调节功率档位或脉冲时间时，制冷档位自动调节到该能量水平的默认档位',
    ],
    mini: 'table', faults: [], scen: [{ id: 'lim', label: '尝试 8 档 × 1.5 s', title: '限制输出', text: '该组合不在能量输出表内，治疗仪不输出' }],
  },
  {
    id: 'circuit', name: '回路与接地检测', short: '回路检测', en: 'RETURN-PATH MONITORING', src: '使用说明书 第 11、18–19、25 页',
    pts: [
      '中性电极片为一次性分散电极，闭合射频回路；治疗仪持续监测其接触质量，存在可能导致运行障碍的情况时停止治疗',
      '中性电极片连接无效时，治疗仪提示“电极回路连接不佳”',
      '检测到接地回路时提示检查人体连接；治疗期间须确保患者不接触接地的金属部件',
    ],
    mini: 'loop', faults: ['E403', 'E406'], scen: [],
  },
  {
    id: 'monitor', name: '持续监测输出', short: '持续监测', en: 'CONTINUOUS MONITORING', src: '使用说明书 第 5、7、24–25 页',
    pts: [
      '治疗仪持续监测输出功率、输出能量、脉冲时间和阻抗测量值',
      '产品基本性能：输出功率误差不大于设定值的 ±20%',
      '检测到可中断治疗的情况（如阻抗异常、功率异常、温度过高）时，显示故障代码',
    ],
    mini: 'tol', faults: ['E603', 'E605', 'E628'], scen: [],
  },
  {
    id: 'touch', name: '接触感应触发', short: '接触触发', en: 'CONTACT-SENSED DELIVERY', src: '使用说明书 第 10、15、20 页',
    pts: [
      '按住使能按钮进入“预备”；治疗头端适当接触治疗部位、且施加的力在预定范围内，才会传送射频能量脉冲',
      '治疗期间如感测到皮肤接触压力太低，会停止正在传送的射频能量',
      '松开使能按钮或抬起治疗头，射频停止输出',
    ],
    mini: 'touch', faults: [], scen: [{ id: 'lowp', label: '接触压力过低', title: '停止射频', text: '感测到接触压力太低，停止正在传送的射频能量' }],
  },
  {
    id: 'cool', name: '三阶段制冷', short: '三阶段制冷', en: '3-PHASE CRYOGEN COOLING', src: '使用说明书 第 7、12、15–16 页',
    pts: [
      '每个射频能量脉冲包括三个阶段：治疗前冷却 → 射频传送 → 治疗后冷却',
      '制冷剂（R134a）递送到头端电极的非患者侧，以传导方式冷却皮肤表面，尽量减少表面过热的可能性',
      '如果射频脉冲被中断，松开使能按钮并保持头端与组织接触，进入治疗后冷却',
    ],
    mini: 'cool', faults: ['E104', 'E503'], scen: [],
  },
];

const SIDE = [ // IFU p.4–5, condensed wording
  ['灼伤', '皮肤浅中层产热可造成灼伤及随后的水泡、结痂；形成瘢痕的可能性很小'],
  ['表面不规则', '通常于治疗后 1 个月以上出现，建议出现后监测六个月'],
  ['感觉改变', '如麻木、刺痛或暂时性麻痹，通常很快消失，偶可持续数周'],
  ['团块或结节', '主要见于颈部区域，通常在一两周内自行消失'],
  ['色素沉着', '通常在几个月内逐渐消失'],
  ['瘀伤', '罕见，通常在几天内消散'],
  ['红斑', '轻度红斑通常在几个小时内消失；罕见情况下可持续数周'],
  ['肿胀', '通常在 5 天内消失，也可能持续数周'],
  ['瘙痒', '偶有轻至中度、短暂性痒感'],
  ['单纯疱疹', '罕见；既往感染过单纯疱疹病毒的区域可能发作'],
];

/* ---------- 3D geometry of the shield (createShieldRings3D defaults) ----------
   layer k (0 = outermost, operator) ↔ ring i = 6 − k (0 = innermost). Radii / stack heights mirror the factory
   defaults (r0 0.42, dr 0.185, gap 0.34) so the wave and the DOM labels line up with the rings. */
const NL = 7, R0 = 0.42, DR = 0.185, GAP = 0.34, CORE_R = 0.2, SKIN_Y = (NL - 1) / 2 * GAP + 0.2;
const ringR = (k) => R0 + (NL - 1 - k) * DR;
const ringY = (k) => (k - (NL - 1) / 2) * GAP; // tower height of layer k (outer at the bottom, skin on top)
/** wave position u: −1 outside · k = layer k · 7 = skin core → radius (nested) / height (tower) */
function waveR(u) {
  if (u <= 0) return ringR(0) - u * 0.3;
  if (u >= NL) return CORE_R;
  const k = Math.floor(u), f = u - k;
  return S3.lerp(ringR(k), k + 1 >= NL ? CORE_R + 0.04 : ringR(k + 1), f);
}
function waveY(u) {
  if (u <= 0) return ringY(0) + u * 0.34;
  if (u >= NL) return SKIN_Y;
  const k = Math.floor(u), f = u - k;
  return S3.lerp(ringY(k), k + 1 >= NL ? SKIN_Y : ringY(k + 1), f);
}
const CORE_COL = { idle: 0x6d5aa6, cool: 0x7fd4ff, heat: 0xf0603f, fault: 0xff4d64, done: 0x43e6a8 };
const CORE_I = { idle: 0.25, cool: 1.15, heat: 1.35, fault: 1.0, done: 0.8 };

const VS = 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }';
const addMat = (uniforms, fs, extra = {}) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, ...extra });
/** additive fresnel shell */
const fresnelMat = (color) => addMat({ uCol: { value: new THREE.Color(color) }, uO: { value: 0 }, uP: { value: 2.4 } },
  'uniform vec3 uCol; uniform float uO; uniform float uP; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uP); gl_FragColor = vec4(uCol * (f * 1.25 + 0.05) * uO, 1.0); }');
/** flat glowing band around radius 1 (scale the mesh to the wanted radius) */
const bandMat = (color, w = 0.035) => addMat({ uCol: { value: new THREE.Color(color) }, uO: { value: 0 }, uW: { value: w } },
  'uniform vec3 uCol; uniform float uO; uniform float uW; varying vec3 vP; void main(){ float d = length(vP.xy) - 1.0; float a = exp(-pow(d / uW, 2.0)) + exp(-pow(d / (uW * 4.0), 2.0)) * 0.3; gl_FragColor = vec4(uCol * a * uO, 1.0); }');
/** soft disc (skin surface plate on top of the tower) */
const discMat = (color) => addMat({ uCol: { value: new THREE.Color(color) }, uO: { value: 0 } },
  'uniform vec3 uCol; uniform float uO; varying vec3 vP; void main(){ float r = length(vP.xy); float a = 0.28 * smoothstep(1.0, 0.2, r) + exp(-pow((r - 0.96) / 0.05, 2.0)) * 0.9; gl_FragColor = vec4(uCol * a * uO, 1.0); }');

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

function buildShield3D(container, V, { reduced, onLabels }) {
  let W = 2, H = 2;
  return mount3D(container, {
    THREE, stageLib: precompileLib(freshCanvasStages(S3)), dpr: 1.5, draggable: true,
    stageOpts: { fov: 30, background: 0x09090f, exposure: 1.05, envViolet: 0.55 },
    fallback: (el) => el.classList.add('is-fallback'),
    build(stage) {
      stage.lights.key.intensity = 1.6; stage.lights.rim.intensity = 2.2;
      const shield = createShieldRings3D(THREE, {});
      const root = new THREE.Group(); root.add(shield.object3d); stage.scene.add(root);
      const rings = shield.object3d.children.filter((o) => o.isGroup); // ring groups, index = ring i (0 = innermost)
      const fx = new THREE.Group(); stage.scene.add(fx);
      // selected-layer and fault overlays (thin torus + flat glow band, transform copied from the ring group)
      const torusGeo = new THREE.TorusGeometry(1, 0.012, 10, 220), bandGeo = new THREE.RingGeometry(0.82, 1.18, 200, 1);
      const mkOverlay = (color, tubeK) => {
        const g = new THREE.Group(); g.matrixAutoUpdate = false;
        const tm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const torus = new THREE.Mesh(torusGeo, tm); torus.userData.tubeK = tubeK; g.add(torus);
        const bm = bandMat(color, 0.03); const band = new THREE.Mesh(bandGeo, bm); band.renderOrder = 6; g.add(band);
        fx.add(g); return { g, torus, tm, bm };
      };
      const selO = mkOverlay(0xd9fff0, 1), faultO = mkOverlay(0xff4d64, 1.8);
      // wave: fresnel shell (nested) + flat climbing band (tower)
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), fresnelMat(0x43e6a8)); shell.renderOrder = 7; fx.add(shell);
      const climb = new THREE.Mesh(bandGeo, bandMat(0x43e6a8, 0.03)); climb.rotation.x = -Math.PI / 2; climb.renderOrder = 7; fx.add(climb);
      // skin core glow (nested) + skin plate (tower)
      const coreShell = new THREE.Mesh(new THREE.SphereGeometry(CORE_R * 1.12, 48, 32), fresnelMat(CORE_COL.idle)); coreShell.material.uniforms.uP.value = 1.6; fx.add(coreShell);
      const glowTex = S3.glowTexture(THREE);
      // studio backdrop: soft violet / mint bloom behind the shield (opaque canvas → additive glows stay clean)
      const back = new THREE.Group(); stage.scene.add(back);
      [[0x8a5cf0, 7.5, 0.34], [0x43e6a8, 3.6, 0.16]].forEach(([c, sc, o]) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
        sp.scale.setScalar(sc); sp.renderOrder = -10; back.add(sp);
      });
      const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: CORE_COL.idle, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      fx.add(coreGlow);
      const skin = new THREE.Mesh(new THREE.CircleGeometry(1, 96), discMat(CORE_COL.idle)); skin.rotation.x = -Math.PI / 2; skin.scale.setScalar(0.34); skin.position.y = SKIN_Y; fx.add(skin);
      const skinRing = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      skinRing.rotation.x = -Math.PI / 2; skinRing.scale.set(0.34, 0.34, 0.5); skinRing.position.y = SKIN_Y; fx.add(skinRing);
      return { cv: stage.renderer.domElement, shield, root, rings, fx, back, selO, faultO, shell, climb, coreShell, coreGlow, skin, skinRing, glowTex, geos: [torusGeo, bandGeo], levels: new Array(NL).fill(0), col: new THREE.Color(), colT: new THREE.Color(CORE_COL.idle), coreI: CORE_I.idle, lastW: 0, lastH: 0, pa: {} };
    },
    frame(s, stage, t, dt, api) {
      const size = stage.renderer.getSize(new THREE.Vector2()); W = size.x; H = size.y;
      const resized = W !== s.lastW || H !== s.lastH; s.lastW = W; s.lastH = H;
      if (reduced && !V.needs && !resized) return;
      V.needs = false;
      const now = performance.now() / 1000, tt = reduced ? 1.4 : t;
      const k1 = reduced ? 1 : 1 - Math.exp(-dt * 5);
      V.ex += (V.exT - V.ex) * k1; if (Math.abs(V.exT - V.ex) < 1e-4) V.ex = V.exT;
      const ex = V.ex, exE = S3.ease.inOut(ex), intro = V.intro;
      // per-layer light levels
      for (let k = 0; k < NL; k++) {
        let lv = 0.4;
        if (V.passT[k] >= 0) lv = 0.66 + 0.34 * Math.exp(-(now - V.passT[k]) * 2.4);
        if (V.faultK != null && k > V.faultK) lv = 0.03;
        if (k === V.faultK) lv = 0.08;
        if (k === V.sel && k !== V.faultK) lv = Math.min(1, lv + 0.4);
        s.levels[NL - 1 - k] = lv * (0.25 + 0.75 * intro);
      }
      s.shield.update({ t: tt, explode: ex, levels: s.levels });
      // fault ring shake (position is re-set by update() every frame, so the offset never accumulates)
      const fk = V.faultK;
      if (fk != null && !reduced) {
        const a = 0.045 * Math.exp(-(now - V.faultT) * 3.2);
        const g = s.rings[NL - 1 - fk]; g.position.x += a * Math.sin(now * 57); g.position.z += a * 0.6 * Math.cos(now * 43);
      }
      s.root.scale.setScalar(0.88 + 0.12 * intro); s.root.rotation.y = (1 - intro) * -0.9;
      s.root.updateMatrixWorld(true);
      // overlays
      const place = (o, k, on, pulse) => {
        o.g.visible = on > 0.002;
        if (!o.g.visible) return;
        o.g.matrix.copy(s.rings[NL - 1 - k].matrixWorld); const R = ringR(k);
        o.torus.scale.set(R, R, o.torus.userData.tubeK); o.tm.opacity = on * pulse;
        o.g.children[1].scale.setScalar(R); o.bm.uniforms.uO.value = on * pulse * 0.9;
      };
      V.selOn += ((V.sel != null && V.sel !== fk ? 1 : 0) - V.selOn) * k1;
      V.faultOn += ((fk != null ? 1 : 0) - V.faultOn) * k1;
      if (V.sel != null) place(s.selO, V.sel, V.selOn * intro, 0.55 + 0.25 * Math.sin(tt * 3.2));
      else s.selO.g.visible = false;
      if (fk != null) place(s.faultO, fk, V.faultOn, 0.85 + 0.15 * Math.sin(tt * 9));
      else s.faultO.g.visible = false;
      // wave
      const wo = V.waveO, R = waveR(V.u);
      s.shell.visible = wo * (1 - exE) > 0.002; s.shell.scale.setScalar(R); s.shell.material.uniforms.uO.value = wo * (1 - exE) * 0.8;
      s.climb.visible = wo * exE > 0.002; s.climb.scale.setScalar(R); s.climb.position.y = waveY(V.u) * exE; s.climb.material.uniforms.uO.value = wo * exE * 1.4;
      // skin core / plate
      s.colT.setHex(CORE_COL[V.core] || CORE_COL.idle); s.col.lerp(s.colT, k1 * 1.4 > 1 ? 1 : k1 * 1.4);
      s.coreI += ((CORE_I[V.core] ?? 0.3) - s.coreI) * k1;
      const cs = Math.max(0, 1 - exE);
      s.coreShell.visible = s.coreGlow.visible = cs > 0.01;
      s.coreShell.scale.setScalar(cs); s.coreShell.material.uniforms.uCol.value.copy(s.col); s.coreShell.material.uniforms.uO.value = s.coreI * intro;
      s.coreGlow.scale.setScalar(1.25 * cs * (0.8 + 0.25 * s.coreI)); s.coreGlow.material.color.copy(s.col); s.coreGlow.material.opacity = Math.min(1, 0.55 * s.coreI) * intro;
      s.skin.visible = s.skinRing.visible = exE > 0.01;
      s.skin.material.uniforms.uCol.value.copy(s.col); s.skin.material.uniforms.uO.value = exE * (0.45 + 0.6 * s.coreI);
      s.skinRing.material.color.copy(s.col); s.skinRing.material.opacity = exE * 0.9;
      // camera: nested gyroscope → tower (higher, looking down on the plates); tower shifted left so labels fit on the right
      const aspect = W / Math.max(1, H), halfV = Math.tan((30 * Math.PI) / 360), fitH = Math.min(halfV, halfV * aspect);
      const objR = S3.lerp(1.72, 1.62, exE), labelRoom = S3.lerp(0.0, aspect < 0.9 ? 0.55 : 0.75, exE);
      const radius = (objR + labelRoom * 0.55) / fitH * S3.lerp(1.2, 1.08, exE);
      const az = S3.lerp(0.32, 0.5, exE) + api.drag.azimuth, el = S3.clamp(S3.lerp(0.26, 0.5, exE) + api.drag.elevation, -0.5, 1.2);
      const rx = Math.cos(az), rz = -Math.sin(az); // camera right vector
      const tx = labelRoom * rx * 0.62, tz = labelRoom * rz * 0.62, ty = S3.lerp(0, 0.18, exE);
      const px = (api.pointer.inside ? api.pointer.x : 0) * 0.06, py = (api.pointer.inside ? api.pointer.y : 0) * 0.04;
      stage.orbit({ target: [tx, ty, tz], radius, azimuth: az + px, elevation: el + py });
      stage.render();
      // DOM labels
      const cam = stage.camera, pa = s.pa;
      for (let k = 0; k < NL; k++) { const p = projectAnchor(THREE, s.shield.anchors['ring' + (NL - 1 - k)], cam, W, H, pa['r' + k] || (pa['r' + k] = {})); p.k = k; }
      projectAnchor(THREE, s.shield.anchors.core, cam, W, H, pa.core || (pa.core = {}));
      pa.W = W; onLabels(pa, ex);
    },
    dispose(s) { s.cv.dataset.ymLost = '1'; s.shield.dispose(); s.back.traverse((o) => { if (o.material) o.material.dispose(); }); s.fx.traverse((o) => { if (o.material) o.material.dispose(); }); s.shell.geometry.dispose(); s.coreShell.geometry.dispose(); s.skin.geometry.dispose(); s.geos.forEach((g) => g.dispose()); s.glowTex.dispose(); },
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
  id: 'safety',
  nav: '安全设计',
  async init(root, ctx) {
    const { lib, data: D, gsap, reduced } = ctx;
    const faultText = Object.fromEntries(D.faults.map((f) => [f.code, f.text.split(' · ')[0]]));
    const num = (k) => String(k + 1).padStart(2, '0');

    /* ---------- 3D shield stage (DOM part: labels + fallback rings) ---------- */
    const shield = `
      <div class="sf-stage" role="group" aria-label="七层安全设计三维示意：由外到内为操作者到皮肤表面">
        <div class="sf-fb" aria-hidden="true">${LAYERS.map((_, k) => `<i style="--k:${k}"></i>`).join('')}</div>
        <div class="sf-labs">
          ${LAYERS.map((L, k) => `<button type="button" class="sf-lab" data-k="${k}" tabindex="-1" aria-label="${num(k)} ${L.name}"><span class="sf-lab__in"><b class="mono">${num(k)}</b>${L.short}<em class="sf-lab__f mono"></em></span></button>`).join('')}
          <div class="sf-corelab" aria-live="polite"><b class="sf-core__t1">皮肤表面</b><span class="sf-core__t2 mono">SKIN</span></div>
        </div>
        <span class="sf-tag mono">原理示意 · SIMULATION</span>
        <div class="seg sf-view" role="group" aria-label="视图">
          <button type="button" data-ex="0" aria-pressed="true">嵌套</button><button type="button" data-ex="1" aria-pressed="false">分层展开</button>
        </div>
        <span class="sf-drag micro" aria-hidden="true">拖动旋转</span>
      </div>`;

    /* ---------- per-layer mini widgets ---------- */
    const minis = {
      people: () => `
        <div class="sf-creds">
          ${['医师执业证书', '护士证', '技师证'].map((t) => `<span class="sf-cred"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="11" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 13h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>${t}</span>`).join('<i class="sf-or">或</i>')}
          <span class="sf-plus">+</span>
          <span class="sf-cred sf-cred--ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.8 11.8l2.2 2.2 4.2-4.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>制造商培训 · 确认合格</span>
        </div>`,
      tip: () => `
        <div class="sf-tipstats">
          <div><b class="num">1</b><span>名患者 / 头端</span></div>
          <div><b class="num">900</b><span>发 / 头端</span></div>
          <div><b class="num">4.0</b><span>cm² 治疗面积</span></div>
        </div>`,
      table: () => {
        const cells = lib.LEVELS.map((lv) => `
          <span class="sf-et__lv mono">${lv % 1 ? lv.toFixed(1) : lv}</span>
          ${lib.PULSES.map((p) => {
            const ok = lib.isAllowed(lv, p);
            const e = lib.density(lv, p);
            const b = ok ? lib.bandOf(e) : null;
            const def = lv === D.defaults.level && p === D.defaults.pulse;
            return `<span class="sf-et__c${ok ? '' : ' is-x'}${def ? ' is-def' : ''}" data-lv="${lv}" data-p="${p}" ${b ? `style="--c:${b.hex}"` : ''}></span>`;
          }).join('')}`).join('');
        return `
          <div class="sf-et">
            <div class="sf-et__grid" role="img" aria-label="能量输出表：16 个功率档位 × 9 个脉冲时间，空白为限制输出">
              <span class="sf-et__corner mono">档\\s</span>
              ${lib.PULSES.map((p) => `<span class="sf-et__h mono">${p.toFixed(1)}</span>`).join('')}
              ${cells}
            </div>
            <div class="sf-et__side">
              <div class="sf-et__read" aria-live="polite"></div>
              <div class="legend sf-et__legend">
                ${lib.BANDS.map((b) => `<span><i style="background:${b.hex}"></i>${b.label}</span>`).join('')}
                <span><i class="sf-hatch"></i>限制输出</span>
              </div>
            </div>
          </div>`;
      },
      loop: () => `
        <svg class="sf-loop" viewBox="0 0 360 150" aria-label="射频回路示意：主机、手具头端、患者、中性电极片" role="img">
          <path class="sf-loop__wire" d="M70 40 H190 M282 110 H70"/>
          <path class="sf-loop__flow" d="M70 40 H190 M282 110 H70"/>
          <rect class="sf-loop__box" x="14" y="22" width="56" height="106" rx="12"/>
          <text x="42" y="72" text-anchor="middle">主机</text><text x="42" y="88" text-anchor="middle" class="sf-loop__s">YM5-G1</text>
          <rect class="sf-loop__tip" x="190" y="28" width="30" height="24" rx="5"/>
          <text x="205" y="20" text-anchor="middle" class="sf-loop__s">治疗头端</text>
          <rect class="sf-loop__body" x="222" y="30" width="118" height="92" rx="40"/>
          <text x="282" y="72" text-anchor="middle">患者</text>
          <rect class="sf-loop__pad" x="282" y="98" width="40" height="24" rx="5"/>
          <text x="302" y="142" text-anchor="middle" class="sf-loop__s">中性电极片</text>
          <g class="sf-loop__x"><circle cx="276" cy="110" r="9"/><path d="M271.5 105.5l9 9M280.5 105.5l-9 9"/></g>
          <text x="128" y="32" text-anchor="middle" class="sf-loop__s">手具线缆 2.0 m</text>
          <text x="180" y="102" text-anchor="middle" class="sf-loop__s">接触质量监测</text>
        </svg>`,
      tol: () => `
        <div class="sf-tol">
          <div class="sf-chan">${['输出功率', '输出能量', '脉冲时间', '阻抗'].map((t) => `<span class="chip"><i></i>${t}</span>`).join('')}</div>
          <label class="field">
            <span class="field__row"><span class="field__label">设定功率档位</span><span class="field__val sf-tol__v"></span></span>
            <input class="range sf-tol__in" type="range" min="0.5" max="8" step="0.5" value="${D.screenRef.level}" aria-label="功率档位" />
          </label>
          <div class="sf-tol__bar" aria-hidden="true"><span class="sf-tol__band"></span><span class="sf-tol__set"></span></div>
          <div class="sf-tol__axis mono" aria-hidden="true"><span>0 W</span><span>210 W</span></div>
          <p class="sf-tol__txt small" aria-live="polite"></p>
        </div>`,
      touch: () => `
        <div class="sf-touch">
          <div class="sf-touch__ctl">
            <button type="button" class="btn sf-touch__en" aria-pressed="false">使能按钮 · 未按下</button>
            <label class="field">
              <span class="field__row"><span class="field__label">接触压力</span><span class="field__val sf-touch__pv">未接触</span></span>
              <input class="range sf-touch__p" type="range" min="0" max="100" value="0" aria-label="接触压力（示意）" />
              <span class="sf-touch__zones mono" aria-hidden="true"><i>过低</i><i class="is-ok">预定范围</i><i>过高</i></span>
            </label>
          </div>
          <div class="sf-touch__st" aria-live="polite"><span class="sf-led"></span><b class="sf-touch__s1">准备就绪</b><span class="sf-touch__s2 small">按住使能按钮进入“预备”</span></div>
          <p class="micro">原理示意：压力阈值仅为示意，非设备实际数值。</p>
        </div>`,
      cool: () => `
        <div class="sf-cool">
          <div class="sf-cool__bar">
            <span data-ph="0">治疗前冷却</span><span data-ph="1">射频传送</span><span data-ph="2">治疗后冷却</span>
            <i class="sf-cool__head" aria-hidden="true"></i>
          </div>
          <div class="sf-cool__row">
            <button type="button" class="btn sf-cool__go"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5l9 5.5-9 5.5z" fill="currentColor"/></svg>播放一个脉冲</button>
            <span class="micro">射频传送时长 = 脉冲时间 0.7 – 1.5 s；各阶段宽度为示意</span>
          </div>
        </div>`,
    };

    const chipFor = (code) => `<button type="button" class="sf-fault" data-code="${code}"><b class="mono">${code}</b>${faultText[code]}</button>`;
    const chipScen = (s) => `<button type="button" class="sf-fault sf-fault--scen" data-scen="${s.id}"><b class="mono">SIM</b>${s.label}</button>`;

    const panels = LAYERS.map((L, k) => `
      <div class="sf-panel" data-k="${k}" id="sf-panel-${k}" role="tabpanel" aria-labelledby="sf-tab-${k}" ${k ? 'hidden' : ''}>
        <div class="sf-panel__head">
          <span class="sf-panel__n num">${num(k)}</span>
          <div><h3 class="h3">${L.name}</h3><span class="mono micro sf-panel__en">${L.en}</span></div>
        </div>
        <ul class="sf-pts">${L.pts.map((p) => `<li>${p}</li>`).join('')}</ul>
        ${L.mini ? `<div class="sf-mini" data-mini="${L.mini}">${minis[L.mini]()}</div>` : ''}
        ${L.faults.length || L.scen.length ? `
          <div class="sf-faults">
            <span class="micro">点击模拟情景 →</span>
            ${L.faults.map(chipFor).join('')}${L.scen.map(chipScen).join('')}
          </div>` : ''}
        <span class="tag-src">来源：${L.src}</span>
      </div>`).join('');

    root.innerHTML = `
    <div class="wrap">
      <span class="sec-num" aria-hidden="true">12</span>
      <header class="sec-head">
        <span class="eyebrow">12 · SAFETY BY DESIGN</span>
        <h2 class="h1">多重<span class="grad-text">安全设计</span></h2>
        <p class="lead">从操作者资质到皮肤表面，说明书记载的防护措施按层级排列为七个环。向下滚动，七环逐层展开；点击任一环查看细节；选择故障情景，观察系统在哪一层拦截。</p>
      </header>

      <div class="sf-main">
        <div class="sf-shield" data-reveal="scale">
          ${shield}
          <div class="sf-sim">
            <button type="button" class="btn btn--primary sf-run"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5l9 5.5-9 5.5z" fill="currentColor"/></svg>模拟一次正常脉冲</button>
            <p class="sf-status small" aria-live="polite">7 层防护 · 选择右侧故障情景可观察拦截位置</p>
          </div>
          <p class="disclaimer sf-simnote">原理示意 · 层级划分为便于理解的归纳，非设备内部架构。${D.disclaimers.sim}</p>
        </div>

        <div class="sf-detail" data-reveal>
          <div class="sf-tabs" role="tablist" aria-label="安全设计层级" aria-orientation="vertical">
            ${LAYERS.map((L, k) => `
              <button type="button" role="tab" class="sf-tab" id="sf-tab-${k}" data-k="${k}" aria-selected="${k === 0}" aria-controls="sf-panel-${k}" tabindex="${k ? -1 : 0}">
                <span class="sf-tab__n mono">${num(k)}</span><span class="sf-tab__t">${L.name}</span>
                <span class="sf-tab__codes mono">${L.faults.join(' ')}</span>
              </button>`).join('')}
          </div>
          <div class="sf-panels">${panels}</div>
        </div>
      </div>

      <div class="sf-care">
        <header class="sf-care__head" data-reveal>
          <span class="eyebrow">CONTRAINDICATIONS · PRECAUTIONS</span>
          <h3 class="h2">禁忌证与注意事项</h3>
        </header>
        <div class="sf-care__grid">
          <article class="card sf-contra" data-reveal>
            <span class="sf-care__ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.8 18.2L18.2 5.8" stroke="currentColor" stroke-width="1.5"/></svg></span>
            <h4 class="sf-care__t">禁忌证</h4>
            <p>${D.disclaimers.contraindication}</p>
            <span class="tag-src">来源：使用说明书 第 4 页</span>
          </article>
          <article class="card sf-prec" data-reveal>
            <span class="sf-care__ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 10v4.5M12 16.8v.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
            <h4 class="sf-care__t">重要患者安全信息</h4>
            <ul class="sf-prec__list">
              <li><b>眼部禁用</b><span>${D.protocol.noGo}</span></li>
              <li><b>较薄部位减低能量</b><span>皮下组织较薄部位（${D.protocol.lowerEnergyZones.join('、')}）需减低能量</span></li>
              <li><b>保留热感反馈</b><span>治疗过程中不要使用镇静剂、局部阻滞剂或麻醉性止痛药，会影响被治疗者对热感的反馈，增加不良事件的风险</span></li>
              <li><b>皮肤状况</b><span>有皮肤相关疾病的患者应首先咨询专业医生后确定是否可使用；面部如有灼伤、水泡、伤口、感染，不适合治疗</span></li>
            </ul>
            <span class="tag-src">来源：使用说明书 第 4 页</span>
          </article>
        </div>
        <article class="card sf-se" data-reveal>
          <div class="sf-se__head">
            <h4 class="sf-care__t">常见副作用</h4>
            <p class="small">治疗过程中常见的副作用为<b>轻度至中度疼痛</b>，通常为暂时性且局限于治疗区域；罕见情况下患者报告过治疗区域短暂性疼痛，可持续数月之久。说明书列出的治疗后常见副作用包括：</p>
          </div>
          <ol class="sf-se__list">
            ${SIDE.map(([t, d], i) => `<li><span class="mono sf-se__n">${String(i + 1).padStart(2, '0')}</span><b>${t}</b><span class="sf-se__d">${d}</span></li>`).join('')}
          </ol>
          <p class="note">如上述情况仍未改变，请停止使用并就医治疗。来源：使用说明书 第 4–5 页（措辞有简化）</p>
        </article>
      </div>
    </div>`;


    /* ---------- 3D view state (logical; survives WebGL context dispose / rebuild) ---------- */
    const V = {
      sel: 0, ex: 0, exT: 0, intro: reduced ? 1 : 0, u: -1, waveO: 0, passT: new Array(NL).fill(-1),
      faultK: null, faultT: 0, core: 'idle', selOn: 0, faultOn: 0, needs: true,
    };
    const stageEl = root.querySelector('.sf-stage');
    const labEls = [...root.querySelectorAll('.sf-lab')];
    const labF = labEls.map((b) => b.querySelector('.sf-lab__f'));
    const coreLab = root.querySelector('.sf-corelab');
    const t1 = root.querySelector('.sf-core__t1');
    const t2 = root.querySelector('.sf-core__t2');
    const viewBtns = [...root.querySelectorAll('.sf-view button')];
    let labMode = '';
    const labFlip = [], labCrowd = [], placed = [];
    function onLabels(pa, ex) {
      const tower = ex > 0.82;
      const mode = `${tower}|${V.sel}|${V.faultK}`;
      if (mode !== labMode) {
        labMode = mode;
        labEls.forEach((b, k) => {
          const on = tower || k === V.sel || k === V.faultK;
          b.classList.toggle('is-on', on); b.classList.toggle('is-sel', k === V.sel); b.classList.toggle('is-fault', k === V.faultK);
          b.tabIndex = -1;
        });
        stageEl.classList.toggle('is-tower', tower);
        viewBtns.forEach((b) => b.setAttribute('aria-pressed', String((+b.dataset.ex === 1) === (V.exT > 0.5))));
      }
      for (let k = 0; k < NL; k++) {
        const p = pa['r' + k], flip = p.x > pa.W - 150;
        if (flip !== labFlip[k]) { labFlip[k] = flip; labEls[k].classList.toggle('is-flip', flip); }
        labEls[k].style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      }
      // integration QA: orbiting the tower to a steep angle made the plate anchors converge and the labels piled up on
      // each other — hide any label that would overlap one already placed (the selected / fault layer is placed first)
      let np = 0;
      const pri = Number.isInteger(V.faultK) ? V.faultK : Number.isInteger(V.sel) ? V.sel : 0;
      for (let i = 0; i < NL; i++) {
        const k = i === 0 ? pri : i <= pri ? i - 1 : i;
        const p = pa['r' + k], x0 = labFlip[k] ? p.x - 134 : p.x + 14, x1 = x0 + 120; // pill ≈ 120 × 26 px beside the dot
        const c = pa.core; // core status pill (tower): centred above its anchor, ≈ 100 × 40 px
        let crowd = tower && x1 > c.x - 50 && x0 < c.x + 50 && p.y + 13 > c.y - 48 && p.y - 13 < c.y - 6;
        if (tower && !crowd) for (let j = 0; j < np; j++) { const q = placed[j]; if (Math.abs(q.y - p.y) < 27 && q.x1 > x0 && q.x0 < x1) { crowd = true; break; } }
        if (!crowd) { const q = placed[np] || (placed[np] = {}); q.y = p.y; q.x0 = x0; q.x1 = x1; np++; }
        if (crowd !== labCrowd[k]) { labCrowd[k] = crowd; labEls[k].classList.toggle('is-crowd', crowd); }
      }
      const c = pa.core;
      coreLab.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
      coreLab.classList.toggle('is-tower', tower);
    }
    const m3 = buildShield3D(stageEl, V, { reduced, onLabels });
    const redraw = () => { V.needs = true; m3.invalidate(); };

    /* scroll: nested gyroscope → stacked tower (manual toggle overrides until the section leaves the viewport) */
    let manual = false;
    const mainEl = root.querySelector('.sf-main');
    const desk = () => window.innerWidth > 1000;
    if (!reduced) {
      scrollTrack(mainEl, (r, vh) => (desk() ? (0.22 * vh - r.top) / Math.max(1, r.height - 0.7 * vh) : (0.75 * vh - r.top) / (0.43 * vh)),
        (p) => { if (!manual && Math.abs(S3.smooth(p) - V.exT) > 1e-4) { V.exT = S3.smooth(p); redraw(); } });
    }
    new IntersectionObserver(([e]) => { if (!e.isIntersecting) manual = false; }).observe(mainEl);
    viewBtns.forEach((b) => b.addEventListener('click', () => { manual = true; V.exT = +b.dataset.ex; labMode = ''; redraw(); }));

    /* ---------- selection ---------- */
    const tabs = [...root.querySelectorAll('.sf-tab')];
    const panelEls = [...root.querySelectorAll('.sf-panel')];
    let sel = 0, refreshId = 0, faultK = null;
    function select(k, focus = false) {
      if (faultK != null && faultK !== k) { resetSim(); status.textContent = IDLE_MSG; }
      sel = k; V.sel = k; labMode = ''; redraw();
      tabs.forEach((t, i) => { t.setAttribute('aria-selected', String(i === k)); t.tabIndex = i === k ? 0 : -1; });
      panelEls.forEach((p, i) => { p.hidden = i !== k; });
      if (focus) tabs[k].focus();
      if (window.innerWidth < 1000) { clearTimeout(refreshId); refreshId = setTimeout(() => ctx.ScrollTrigger?.refresh(), 120); }
      if (!reduced) gsap.fromTo(panelEls[k].children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: 'power3.out', overwrite: true });
    }
    tabs.forEach((t) => t.addEventListener('click', () => select(+t.dataset.k)));
    root.querySelector('.sf-tabs').addEventListener('keydown', (e) => {
      const m = { ArrowDown: sel + 1, ArrowRight: sel + 1, ArrowUp: sel - 1, ArrowLeft: sel - 1, Home: 0, End: LAYERS.length - 1 };
      if (e.key in m) { e.preventDefault(); select((m[e.key] + LAYERS.length) % LAYERS.length, true); }
    });
    labEls.forEach((b) => b.addEventListener('click', () => select(+b.dataset.k)));
    tabs.forEach((t) => {
      t.addEventListener('pointerenter', () => labEls[+t.dataset.k].classList.add('is-hover'));
      t.addEventListener('pointerleave', () => labEls[+t.dataset.k].classList.remove('is-hover'));
    });

    lib.whenVisible(root, () => root.classList.add('is-live'), () => root.classList.remove('is-live'));

    /* ---------- pulse / fault simulation ---------- */
    const IDLE_MSG = '7 层防护 · 选择右侧故障情景可观察拦截位置';
    const status = root.querySelector('.sf-status');
    const loopEl = root.querySelector('.sf-loop');
    let tl = null;
    const setCore = (st, a, b) => { V.core = st === 'done' ? 'done' : st; coreLab.dataset.st = st; t1.textContent = a; t2.textContent = b; redraw(); };
    const resetSim = () => {
      tl?.kill(); faultK = null; V.faultK = null; V.passT.fill(-1); V.waveO = 0; V.u = -1;
      labF.forEach((f) => { f.textContent = ''; });
      loopEl?.classList.remove('is-break');
      setCore('idle', '皮肤表面', 'SKIN'); labMode = '';
    };
    function run(stopK = null, info = null) {
      resetSim(); faultK = stopK;
      const target = stopK == null ? NL : stopK;
      if (stopK != null && LAYERS[stopK].id === 'circuit' && info?.code === 'E403') loopEl?.classList.add('is-break');
      const passTo = (u) => { const now = performance.now() / 1000; for (let k = 0; k < Math.min(target, NL); k++) if (u >= k && V.passT[k] < 0) V.passT[k] = now; };
      const endState = () => {
        if (stopK == null) {
          setCore('done', '脉冲完成', 'COMPLETE');
          status.innerHTML = '<b>7 / 7</b> 层条件满足 → 治疗前冷却 → 射频传送 → 治疗后冷却';
        } else {
          V.faultK = stopK; V.faultT = performance.now() / 1000; labMode = '';
          labF[stopK].textContent = info.code || 'SIM';
          setCore('fault', info.code || info.title, '射频停止');
          status.innerHTML = `<b class="sf-alert">第 ${num(stopK)} 层拦截</b> · ${info.code ? `${info.code} ${faultText[info.code]}` : info.text}${info.code ? ` · 解除措施：${FIX[info.code]}` : ''}`;
        }
        redraw();
      };
      if (reduced) { passTo(target); endState(); return; }
      const w = { u: -1 };
      status.textContent = '逐层检查中…';
      tl = gsap.timeline();
      tl.to(V, { waveO: 1, duration: 0.25 })
        .to(w, { u: target, duration: 0.55 + target * 0.24, ease: 'power1.in', onUpdate: () => { V.u = w.u; passTo(w.u); } }, 0);
      if (stopK == null) {
        tl.to(V, { waveO: 0, duration: 0.3 })
          .add(() => { setCore('cool', '治疗前冷却', 'PRE-COOL'); status.textContent = '7 / 7 层通过 · 治疗前冷却'; })
          .to({}, { duration: 0.8 })
          .add(() => { setCore('heat', '射频传送', 'RF ON'); status.textContent = '射频传送'; })
          .to({}, { duration: 1.0 })
          .add(() => { setCore('cool', '治疗后冷却', 'POST-COOL'); status.textContent = '治疗后冷却'; })
          .to({}, { duration: 0.8 })
          .add(endState);
      } else {
        tl.add(endState).to(V, { waveO: 0, duration: 0.5, delay: 0.1 });
      }
    }
    root.querySelector('.sf-run').addEventListener('click', () => run());
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.sf-fault'); if (!b) return;
      const k = +b.closest('.sf-panel').dataset.k;
      if (b.dataset.code) run(k, { code: b.dataset.code });
      else { const s = LAYERS[k].scen.find((x) => x.id === b.dataset.scen); run(k, s); }
      const r = stageEl.getBoundingClientRect();
      const vh = window.innerHeight, fits = r.height < vh - 90;
      if (r.top < 70 || (fits && r.bottom > vh - 10) || r.top > vh * 0.45) {
        const y = Math.round(window.scrollY + r.top - Math.max(76, (vh - r.height) / 2));
        if (ctx.lenis && !ctx.lenis.isStopped) ctx.lenis.scrollTo(y, { duration: 1 }); else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      }
    });
    resetSim();
    select(0);
    if (!reduced) {
      // build-in: rings spin up and light from the outside in, then one normal pulse runs
      const o = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        o.disconnect();
        gsap.to(V, { intro: 1, duration: 1.8, ease: 'expo.out' });
        gsap.delayedCall(1.2, () => run());
      }, { threshold: 0.45 });
      o.observe(stageEl);
    }

    /* ---------- mini: energy table ---------- */
    const et = root.querySelector('.sf-et');
    if (et) {
      const read = et.querySelector('.sf-et__read');
      const show = (lv, p) => {
        const ok = lib.isAllowed(lv, p), W = lib.levelPower(lv), e = lib.density(lv, p);
        const isDef = lv === D.defaults.level && p === D.defaults.pulse;
        if (!ok) {
          read.innerHTML = `<span class="mono">档位 ${lv} · ${W} W × ${p.toFixed(1)} s</span><b class="sf-alert">限制输出</b><span class="small">该组合不在能量输出表内</span>`;
        } else {
          const b = lib.bandOf(e);
          read.innerHTML = `<span class="mono">档位 ${lv} · ${W} W × ${p.toFixed(1)} s${isDef ? ' · 默认' : ''}</span><b style="color:${b.key === 'max' ? '#ef6a80' : b.hex}">${e.toFixed(1)} <small>J/cm²</small></b><span class="small">能量水平 ${b.label} · 默认制冷 ${b.coolDefault}（可选 ${b.coolRange.join('、')}）</span>`;
        }
      };
      let lastCell = null;
      const pick = (c) => {
        if (!c || !c.dataset.lv) return;
        lastCell?.classList.remove('is-hot'); c.classList.add('is-hot'); lastCell = c;
        show(+c.dataset.lv, +c.dataset.p);
      };
      et.querySelector('.sf-et__grid').addEventListener('pointerover', (e) => pick(e.target.closest('.sf-et__c')));
      et.querySelector('.sf-et__grid').addEventListener('click', (e) => pick(e.target.closest('.sf-et__c')));
      pick(et.querySelector('.sf-et__c.is-def'));
    }

    /* ---------- mini: ±20% tolerance ---------- */
    const tol = root.querySelector('.sf-tol');
    if (tol) {
      const inp = tol.querySelector('.sf-tol__in');
      const MAXW = 210;
      const upd = () => {
        const lv = +inp.value, P = lib.levelPower(lv), lo = P * 0.8, hi = P * 1.2;
        inp.style.setProperty('--p', ((lv - 0.5) / 7.5) * 100 + '%');
        tol.querySelector('.sf-tol__v').textContent = `${lv.toFixed(1)} 档 · ${P} W`;
        tol.style.setProperty('--lo', lo / MAXW); tol.style.setProperty('--hi', hi / MAXW); tol.style.setProperty('--set', P / MAXW);
        tol.querySelector('.sf-tol__txt').innerHTML = `设定 <b>${P} W</b> 时，输出功率应在 <b>${lo.toFixed(0)} – ${hi.toFixed(0)} W</b> 之内（设定值 ±20%）`;
      };
      inp.addEventListener('input', upd); upd();
    }

    /* ---------- mini: contact sensing ---------- */
    const touch = root.querySelector('.sf-touch');
    if (touch) {
      const en = touch.querySelector('.sf-touch__en');
      const pr = touch.querySelector('.sf-touch__p');
      const pv = touch.querySelector('.sf-touch__pv');
      const s1 = touch.querySelector('.sf-touch__s1'), s2 = touch.querySelector('.sf-touch__s2');
      const LO = 38, HI = 78; // illustrative thresholds only (原理示意)
      let delivering = false, stopMsg = null;
      const upd = () => {
        const held = en.getAttribute('aria-pressed') === 'true';
        const p = +pr.value;
        const on = held && p >= LO && p <= HI;
        pr.style.setProperty('--p', p + '%');
        pv.textContent = p === 0 ? '未接触' : p < LO ? '过低' : p <= HI ? '预定范围内' : '过高';
        if (delivering && !on) stopMsg = !held ? ['射频停止', '已松开使能按钮'] : p < LO ? ['停止射频传送', '感测到接触压力太低'] : ['停止射频传送', '施加的力超出预定范围'];
        if (on || p === 0) stopMsg = null;
        delivering = on;
        touch.dataset.st = on ? 'on' : stopMsg ? 'stop' : held ? 'arm' : 'idle';
        const [a, b] = on ? ['启动 · 射频传送中', '适当接触，且压力在预定范围内']
          : stopMsg ? stopMsg
          : !held ? ['准备就绪', '按住使能按钮进入“预备”']
          : p > HI ? ['预备 · 不传送', '施加的力须在预定范围内']
          : ['预备', '等待治疗头端适当接触治疗部位'];
        s1.textContent = a; s2.textContent = b;
      };
      en.addEventListener('click', () => {
        const v = en.getAttribute('aria-pressed') !== 'true';
        if (v) stopMsg = null;
        en.setAttribute('aria-pressed', String(v));
        en.textContent = v ? '使能按钮 · 按住中' : '使能按钮 · 未按下';
        upd();
      });
      pr.addEventListener('input', upd);
      upd();
    }

    /* ---------- mini: 3-phase cooling ---------- */
    const cool = root.querySelector('.sf-cool');
    if (cool) {
      const segs = [...cool.querySelectorAll('.sf-cool__bar span')];
      const head = cool.querySelector('.sf-cool__head');
      let ct = null;
      const mark = (x) => {
        cool.style.setProperty('--h', x);
        const ph = x <= 0 ? -1 : x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : x < 1 ? 2 : -1;
        segs.forEach((s, i) => s.classList.toggle('is-on', i === ph));
      };
      cool.querySelector('.sf-cool__go').addEventListener('click', () => {
        ct?.kill();
        if (reduced) { segs.forEach((s) => s.classList.add('is-on')); return; }
        const o = { x: 0 }; head.style.opacity = 1;
        ct = gsap.to(o, { x: 1, duration: 3, ease: 'none', onUpdate: () => mark(o.x), onComplete: () => { gsap.to(head, { opacity: 0, duration: 0.4 }); mark(1); } });
      });
      mark(0);
    }
  },
};
