// #pulse — 闪脉冲技术 + 动态脉冲技术
// src: DA p.2（核心技术 01/02 原文）· IFU p.9（脉冲时间 0.7–1.5 s，一个脉冲对应 0.1 秒）
//      IFU p.15（“启动”三阶段：治疗前冷却 → 射频传送 → 治疗后冷却；制冷档位随能量水平自动匹配）
//      IFU p.4（皮下组织较薄部位：颧骨、下颌、颞部、前额需减低能量；不可用于眼部）
//      IFU p.21–22（升档疼痛且能量密度过低 → 增加脉冲时间；舒适范围内可升档；最低增量；热感反馈 2.0–3.0）
// Everything thermal on this page is a schematic model (原理示意) — no tissue temperatures are claimed.
// 3D: the pinned story is a YM3D createPulseTrain3D scene (one WebGL context via mount3D). Scroll drives
// build-in → close-up on the 100 ms slabs → a camera glide that follows the playhead along the shot → pull-back.
// The pulse-time slider (0.7–1.5 s → 7–15 × 100 ms) drives `pulses` and stays in sync with the oscilloscope.

import * as THREE from 'three';
import * as S3 from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createPulseTrain3D, projectAnchor } from '../ym3d/dataviz.mjs';
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

/* host.mjs work-around (library issue, reported by integration QA): when a mount goes far off-screen the host calls
   renderer.forceContextLoss() and on the way back rebuilds on the SAME canvas, whose context is still lost → createStage
   throws ("reading 'precision'") and the fallback fires for good. Each build therefore renders into a fresh sibling canvas
   under the host's own canvas, which stays on top (context-less, transparent) as the pointer / drag layer. */
const freshStageLib = (YM) => ({
  ...YM,
  createStage(THREE_, canvas, opts) {
    canvas.__ymRC?.remove();
    const c = document.createElement('canvas');
    c.className = 'ym3d-rc';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    canvas.parentNode.insertBefore(c, canvas);
    canvas.__ymRC = c;
    return YM.createStage(THREE_, c, opts);
  },
});

const T_LEAD = 0.08, T_PRE = 0.3, T_POST = 0.34, T_TAIL = 0.2;
const T_MAX = T_LEAD + T_PRE + 1.5 + T_POST + T_TAIL;
const DT = 0.004;
const GAP_ON = 0.86; // visual on-fraction of each 100 ms sub-pulse (schematic)
const SIG = 0.2; // schematic tissue-response fluctuation per energy quantum

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function rng32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
const f1 = (v) => (Math.round(v * 10 + 1e-6) / 10).toFixed(1);
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace';
const SANS = '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif';

function shotTimes(p) {
  const pre0 = T_LEAD, rf0 = pre0 + T_PRE, rf1 = rf0 + p, post1 = rf1 + T_POST;
  return { pre0, rf0, rf1, post1, end: post1 + T_TAIL };
}

/* ---------- schematic thermal model (dimensionless) ---------- */
function simulate(st, lib, seed) {
  const r = rng32(seed);
  const tm = shotTimes(st.p);
  const n = Math.round(st.p * 10);
  const allowed = lib.isAllowed(st.lv, st.p);
  const P = lib.levelPower(st.lv) / 175;
  const q = () => 1 + clamp(gauss(r) * SIG, -0.45, 0.45);
  const gains = st.mode === 'flash' ? Array.from({ length: n }, q) : [q()];
  const len = Math.ceil(tm.end / DT) + 1;
  const Td = new Float32Array(len), Te = new Float32Array(len), Ti = new Float32Array(len);
  const coolT = -(0.12 + 0.075 * st.cool);
  const KD = 1.12, KE = 0.55, HC = 9, LD = 0.1;
  let td = 0, te = 0, tt = 0, ti = 0;
  for (let k = 0; k < len; k++) {
    const t = k * DT;
    const spray = allowed && ((t >= tm.pre0 && t < tm.rf0) || (t >= tm.rf1 && t < tm.post1));
    let u = 0, gn = 1;
    if (allowed && t >= tm.rf0 && t < tm.rf1) {
      const rel = t - tm.rf0;
      const i = Math.min(n - 1, Math.floor(rel / 0.1 + 1e-6));
      if (st.mode === 'flash') { const ph = (rel - i * 0.1) / 0.1; u = ph < GAP_ON ? 1 / GAP_ON : 0; gn = gains[i]; }
      else { u = 1; gn = gains[0]; }
    }
    tt += (spray ? (coolT - tt) / 0.05 : (0 - tt) / 0.9) * DT;
    td += (KD * P * u * gn - LD * td) * DT;
    ti += (KD * P * u - LD * ti) * DT;
    te += (KE * P * u * gn - HC * (te - tt)) * DT;
    Td[k] = td; Te[k] = te; Ti[k] = ti;
  }
  return { tm, n, allowed, P, Td, Te, Ti, len, cool: st.cool, mode: st.mode };
}

/* ---------- scenarios for 动态脉冲 (IFU p.4, p.21–22) ---------- */
const SCN = [
  {
    key: 'pain', title: '升档时患者疼痛，但能量密度仍偏低', short: '升档疼痛',
    quote: '如果增加功率档位患者疼痛，但此时能量密度过低，则可通过增加脉冲时间来增加能量密度。', src: '使用说明书 第 21 页',
    start: { lv: 3, p: 0.7 }, fb: 1.4, aux: 'fb',
    steps: [
      { t: '起点 3.0 档 × 0.7 s = 13.1 J/cm²，低于推荐区（16.6–31.3）' },
      { t: '按 0.5 档单步升档 3.0 → 3.5（14.9 J/cm²，仍低于推荐区）：患者反馈疼痛', to: { lv: 3.5, p: 0.7 }, kind: 'try', fb: 4.2 },
      { t: '退回 3.0 档', to: { lv: 3, p: 0.7 }, kind: 'back', fb: 1.4, hold: 0.6 },
      { t: '改为延长脉冲时间 0.7 → 1.0 s（7 → 10 个 100 ms 脉冲）', to: { lv: 3, p: 1.0 }, kind: 'ok', fb: 2.5 },
      { t: '18.8 J/cm² 进入推荐区“中”，反馈回到 2.0–3.0；制冷强度自动切换为“中”的默认档 2', done: true },
    ],
  },
  {
    key: 'thin', title: '皮下组织较薄部位', short: '较薄部位', sub: '颧骨 · 下颌 · 颞部 · 前额',
    quote: '在皮下组织较薄部位（颧骨、下颌、颞部、前额）需减低能量。', src: '使用说明书 第 4 页',
    start: { lv: 4.5, p: 1.0 }, aux: 'face',
    steps: [
      { t: '常规部位 4.5 档 × 1.0 s = 26.3 J/cm²（较高）' },
      { t: '移至颧骨、下颌、颞部、前额等皮下组织较薄部位', zone: true },
      { t: '方案一：调低功率档位 4.5 → 3.5，得 21.3 J/cm²（中）', to: { lv: 3.5, p: 1.0 }, kind: 'ok' },
      { t: '方案二：缩短脉冲时间 1.0 → 0.8 s，得 21.0 J/cm²（中）', alt: { lv: 4.5, p: 0.8 }, done: true },
    ],
  },
  {
    key: 'boost', title: '舒适范围内，希望加强治疗效果', short: '加强效果',
    quote: '如果选定的功率档位在舒适程度范围内，想要加强治疗效果，可以增加功率档位，并保证患者反馈容易忍受。调整时应以最低的增量增加。', src: '使用说明书 第 21–22 页',
    start: { lv: 3, p: 1.0 }, fb: 1.6, aux: 'fb',
    steps: [
      { t: '起点 3.0 档 × 1.0 s = 18.8 J/cm²，反馈温热' },
      { t: '按 0.5 档单步升至 3.5 → 21.3 J/cm²', to: { lv: 3.5, p: 1.0 }, kind: 'ok', fb: 2.1 },
      { t: '升至 4.0 → 23.8 J/cm²', to: { lv: 4, p: 1.0 }, kind: 'ok', fb: 2.5 },
      { t: '升至 4.5 → 26.3 J/cm²（较高），制冷强度自动匹配默认档', to: { lv: 4.5, p: 1.0 }, kind: 'ok', fb: 2.9 },
      { t: '反馈保持在 2.0–3.0 之间，以此参数完成整个部位', done: true },
    ],
  },
];

export default {
  id: 'pulse',
  nav: '脉冲技术',
  async init(root, ctx) {
    const { lib, data } = ctx;
    const flash = data.core7[0], dyn = data.core7[1];
    const heat = data.protocol.heatScale;
    const mixHex = (a, b, t) => '#' + [0, 2, 4].map((o) => Math.round(parseInt(a.slice(1 + o, 3 + o), 16) * (1 - t) + parseInt(b.slice(1 + o, 3 + o), 16) * t).toString(16).padStart(2, '0')).join('');
    const pills = Array.from({ length: 15 }, (_, i) => `<i style="--c:${mixHex('#8a5cf0', '#43e6a8', i / 14)}"></i>`).join('');

    root.innerHTML = `
    <div class="wrap">
      <header class="sec-head">
        <span class="eyebrow">05 · PULSE TECHNOLOGY</span>
        <h2 class="h1">把一发能量，切成 <span class="grad-text num">100 ms</span> 的细密节拍</h2>
        <p class="lead">两项核心技术决定能量<em>如何</em>被送达：<b>${flash.title}</b>——“${flash.text}”；<b>${dyn.title}</b>——“${dyn.text}”。</p>
      </header>
    </div>

    <div class="pl-story">
      <div class="wrap pl-story__in">
        <ol class="pl-steps" aria-label="一发治疗的构成">
          <li class="is-on"><span class="pl-steps__n num">01</span><b>1 发 = 1 次射频能量脉冲</b><span>脉冲时间 0.7 – 1.5 s，步进 0.1 s</span><i></i></li>
          <li><span class="pl-steps__n num">02</span><b>以 100 ms 为单元切分</b><span>一个脉冲对应 0.1 秒 · 1.0 s = 10 个窄脉冲</span><i></i></li>
          <li><span class="pl-steps__n num">03</span><b>冷却 · 射频 · 冷却</b><span>治疗前冷却 → 射频传送 → 治疗后冷却</span><i></i></li>
        </ol>
        <div class="pl-stage">
          <div class="pl-3d" role="img" aria-label="三维示意：一发治疗 = 治疗前冷却（冰块）→ 10 个 100 毫秒射频脉冲（发光薄片）→ 治疗后冷却；上方两条带为真皮、表皮温度的原理示意">
            <div class="pl-lbls" aria-hidden="true">
              <span class="pl-lb pl-lb--rf" data-a="rf"><b class="num pl-lb__n">10</b> × 100 ms = <b class="num pl-lb__s">1.0</b> s</span>
              <span class="pl-lb pl-lb--unit" data-a="pulseFirst">1 个脉冲 = <b class="num">100</b> ms</span>
              <span class="pl-lb pl-lb--d" data-a="dermis">真皮层 · 逐级升温</span>
              <span class="pl-lb pl-lb--e" data-a="epidermis">表皮层 · 冷却保护</span>
            </div>
          </div>
          <span class="chip pl-3d__sim">原理示意 · 温度带为示意</span>
          <div class="pl-hud" aria-hidden="true">
            <span class="pl-hud__ph" data-ph="0">治疗前冷却</span>
            <span class="pl-hud__ph" data-ph="1">射频 <b class="num pl-hud__k">0</b> / <b class="num pl-hud__n">10</b> × 100 ms</span>
            <span class="pl-hud__ph" data-ph="2">治疗后冷却</span>
            <i class="pl-hud__bar"><i></i></i>
          </div>
          <div class="pl-3d__ctl">
            <label class="pl-3d__f">
              <span class="pl-3d__k">脉冲时间</span>
              <input class="range pl-3d__r" type="range" min="0.7" max="1.5" step="0.1" value="1.0" aria-label="脉冲时间（秒），决定 100 毫秒脉冲个数">
              <output class="pl-3d__o" aria-live="polite"><b class="num">1.0</b> s · <b class="num">10</b> × 100 ms</output>
            </label>
            <span class="micro pl-3d__hint">拖动可旋转视角</span>
          </div>
        </div>
        <p class="note pl-story__note">来源：使用说明书 第 9 页（脉冲时间 0.7–1.5 s，一个脉冲对应 0.1 秒）、第 15 页（“启动”模式三阶段）。冷却块长度、温度带形状为示意；${data.disclaimers.sim}</p>
      </div>
    </div>

    <div class="wrap">
      <div class="pl-scope card" data-reveal>
        <div class="pl-scope__top">
          <div class="pl-scope__ttl">
            <span class="pl-live" aria-hidden="true"><i></i>LIVE</span>
            <h3 class="h3">闪脉冲示波器</h3>
            <span class="chip pl-simchip">原理示意</span>
          </div>
          <div class="pl-scope__modes">
            <div class="seg pl-mode" role="group" aria-label="脉冲方式">
              <button type="button" data-mode="flash" aria-pressed="true">100ms 闪脉冲</button>
              <button type="button" data-mode="long" aria-pressed="false">单一长脉冲（对比示意）</button>
            </div>
            <button type="button" class="btn pl-slow" aria-pressed="false">慢放 ×¼</button>
          </div>
        </div>
        <div class="pl-scope__body">
          <div class="pl-screen">
            <canvas class="pl-cv" role="img" aria-label="示波器：制冷剂喷射、射频包络与真皮、表皮温度示意曲线"></canvas>
            <div class="legend pl-legend">
              <span><i style="background:var(--cool)"></i>CH1 制冷剂喷射</span>
              <span><i style="background:linear-gradient(90deg,var(--violet),var(--mint))"></i>CH2 射频包络</span>
              <span><i style="background:var(--heat-5)"></i>真皮温升</span>
              <span><i style="background:#cfeeff"></i>表皮温度</span>
              <span><i class="pl-lg-ghost"></i>余辉 · 近 6 发叠加</span>
            </div>
          </div>
          <aside class="pl-ctrl" aria-label="示波器参数">
            <div class="pl-n">
              <div class="pl-n__big"><span class="num pl-n__v" aria-live="polite">10</span><span class="pl-n__x">× 100 ms</span></div>
              <div class="pl-pills" aria-hidden="true">${pills}</div>
              <p class="micro pl-n__cap">每发脉冲数 = 脉冲时间 ÷ 0.1 s</p>
            </div>
            <label class="field">
              <span class="field__row"><span class="field__label">脉冲时间</span><span class="field__val pl-v-p">1.0 s</span></span>
              <input class="range pl-r-p" type="range" min="0.7" max="1.5" step="0.1" value="1.0" aria-label="脉冲时间（秒）">
            </label>
            <label class="field">
              <span class="field__row"><span class="field__label">功率档位</span><span class="field__val pl-v-lv">4.0 档 · 95 W</span></span>
              <input class="range pl-r-lv" type="range" min="0.5" max="8" step="0.5" value="4" aria-label="功率档位">
            </label>
            <div class="field">
              <span class="field__row"><span class="field__label">制冷强度</span><span class="field__val pl-v-c">默认 2 · 可选 1–3</span></span>
              <div class="seg pl-cool" role="group" aria-label="制冷强度">
                ${[1, 2, 3, 4].map((c) => `<button type="button" data-c="${c}" aria-pressed="false">${c}</button>`).join('')}
              </div>
            </div>
            <div class="pl-read">
              <div><span class="pl-read__k">能量密度</span><span class="pl-read__v"><b class="num pl-o-d">23.8</b><small>J/cm²</small></span><span class="chip pl-o-band"><i></i><em>中</em></span></div>
              <div><span class="pl-read__k">单发能量 P × t</span><span class="pl-read__v"><b class="num pl-o-e">95</b><small>J</small></span></div>
            </div>
            <p class="pl-warn" role="status" hidden>该组合为限制输出区（能量输出表空白格）</p>
            <div class="pl-spread">
              <span class="pl-read__k">升温轨迹离散度（示意）</span>
              <div class="pl-spread__bar"><i></i></div>
              <span class="micro pl-spread__lab">集中 ⟷ 分散</span>
            </div>
          </aside>
        </div>
        <div class="pl-scope__foot">
          <p class="small pl-howto">读图：CH1 先喷射制冷剂（治疗前冷却）；CH2 射频以 <b class="pl-howto-n">10</b> 个 100 ms 窄脉冲逐个送出；CH3 真皮温度以细小台阶逐级抬升，表皮在冷却作用下被压低；射频结束后再次喷射（治疗后冷却）。切换“单一长脉冲”，对比多发叠加后的轨迹集中程度。</p>
          <p class="disclaimer">原理示意：温度曲线为无量纲示意模型，组织对每个能量单元的响应设为随机波动；“单一长脉冲”为假设性对照，不代表任何具体产品。${data.disclaimers.sim}</p>
          <p class="note">参数与规则来源：使用说明书 第 9 页（功率档位 0.5–8，步进 0.5；制冷强度 1–4；脉冲时间 0.7–1.5 s）、第 15 页（能量水平与默认制冷档位）、第 31 页（能量输出表，功率 × 时间 ÷ 4.0 cm²）。</p>
        </div>
      </div>

      <div class="pl-dyn">
        <header class="pl-dyn__head" data-reveal>
          <span class="eyebrow">DYNAMIC PULSE</span>
          <h3 class="h2">${dyn.title}：因肤调节<span class="grad-text">长短脉冲</span></h3>
          <p class="lead">能量 = 功率 × 时间。同一能量密度，既可以“短而强”，也可以“长而缓”——沿着<em>等能量密度线</em>，在功率档位与脉冲时间之间自由换算。选择一个临床情景，看参数如何按使用说明书的逻辑移动。</p>
        </header>
        <div class="pl-dyn__grid">
          <div class="pl-dyn__side card" data-reveal>
            <div class="pl-scn" role="group" aria-label="临床情景">
              ${SCN.map((s, i) => `<button type="button" class="pl-scn__b" data-i="${i}" aria-pressed="false"><span class="num">0${i + 1}</span><b>${s.title}</b>${s.sub ? `<em>${s.sub}</em>` : ''}</button>`).join('')}
            </div>
            <blockquote class="pl-quote"><p class="pl-quote__t"></p><cite class="tag-src pl-quote__s"></cite></blockquote>
            <ol class="pl-seq" aria-live="polite"></ol>
            <div class="pl-free">
              <div class="pl-free__hd"><b>自己试试</b><button type="button" class="btn pl-lock" aria-pressed="false">锁定能量密度</button></div>
              <label class="field">
                <span class="field__row"><span class="field__label">脉冲时间</span><span class="field__val pl-fv-p">1.0 s</span></span>
                <input class="range pl-fr-p" type="range" min="0.7" max="1.5" step="0.1" value="1.0" aria-label="动态脉冲：脉冲时间">
              </label>
              <p class="micro pl-free__hint">点击地形图任意格点选择组合（键盘：聚焦地形图后用方向键）；锁定后拖动脉冲时间，功率档位会自动换算以保持能量密度。</p>
            </div>
          </div>
          <div class="pl-dyn__main card" data-reveal>
            <div class="pl-plane">
              <div class="pl-plane__hd">
                <span class="pl-read__k">能量密度地形图 · 功率档位 × 脉冲时间</span>
                <span class="legend pl-plane__lg">
                  ${lib.BANDS.map((b) => `<span><i style="background:${b.color}"></i>${b.label}</span>`).join('')}
                  <span><i class="pl-lg-hatch"></i>限制输出</span>
                  <span><i class="pl-lg-iso"></i>等能量密度线</span>
                </span>
              </div>
              <canvas class="pl-pcv" tabindex="0" role="img" aria-label="能量密度地形图：横轴脉冲时间 0.7 到 1.5 秒，纵轴功率档位 0.5 到 8，按能量水平着色"></canvas>
              <p class="pl-plane__msg" role="status"></p>
            </div>
            <div class="pl-dyn__row">
              <div class="pl-rectwrap">
                <span class="pl-read__k">长短脉冲 · 面积 = 单发能量</span>
                <svg class="pl-rect" viewBox="0 0 380 190" role="img" aria-label="脉冲矩形：高度为功率，宽度为时间，面积为单发能量">
                  <defs><linearGradient id="plRectG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8a5cf0" stop-opacity=".75"/><stop offset="1" stop-color="#43e6a8" stop-opacity=".25"/></linearGradient></defs>
                  <g class="pl-rect__ax">
                    <line x1="44" x2="44" y1="18" y2="154"/><line x1="44" x2="370" y1="154" y2="154"/>
                    ${[0, 50, 100, 150].map((w) => `<text x="38" y="${154 - (w / 180) * 130 + 4}" text-anchor="end">${w}</text>`).join('')}
                    ${[0, 0.5, 1.0, 1.5].map((s) => `<text x="${44 + s * 200}" y="170" text-anchor="middle">${s === 0 ? '0' : s.toFixed(1) + ' s'}</text>`).join('')}
                    <text x="6" y="12" class="pl-rect__u">W</text>
                  </g>
                  <rect class="pl-rect__ghost" x="44" y="100" width="100" height="54"/>
                  <rect class="pl-rect__cur" x="44" y="100" width="200" height="54" fill="url(#plRectG)"/>
                  <g class="pl-rect__sl"></g>
                  <text class="pl-rect__lab" x="50" y="92">95 W × 1.0 s = 95 J</text>
                </svg>
              </div>
              <div class="pl-aux">
                <div class="pl-fb" data-aux="fb">
                  <span class="pl-read__k">患者热感反馈 <em>（情景示意）</em></span>
                  <div class="pl-fb__scale">
                    <div class="pl-fb__bar"><div class="pl-fb__target"></div><div class="pl-fb__needle"><i></i></div></div>
                    <ul class="pl-fb__lab">${heat.map((h, i) => `<li><b class="num">${i}</b>${h}</li>`).reverse().join('')}</ul>
                  </div>
                  <span class="micro">目标区间 ${data.protocol.feedbackTarget.replace('将患者热感反馈保持在 ', '')}（使用说明书 第 21 页）</span>
                </div>
                <div class="pl-face" data-aux="face" hidden>
                  <span class="pl-read__k">需减低能量的部位</span>
                  ${faceSVG(data.protocol.lowerEnergyZones)}
                  <span class="micro">不可用于眼部（眶缘内区域）· 使用说明书 第 4 页</span>
                </div>
              </div>
            </div>
            <div class="pl-dread" aria-live="polite">
              <div><span class="pl-read__k">功率档位</span><b class="num pl-d-lv">3.0</b><small class="pl-d-w">75 W</small></div>
              <div><span class="pl-read__k">脉冲时间</span><b class="num pl-d-p">0.8</b><small class="pl-d-n">s · 8 个脉冲</small></div>
              <div><span class="pl-read__k">能量密度</span><b class="num pl-d-d">15.0</b><small>J/cm²</small><span class="chip pl-d-band"><i></i><em>低</em></span></div>
              <div><span class="pl-read__k">默认制冷</span><b class="num pl-d-c">1</b><small class="pl-d-cr">可选 1–2</small></div>
            </div>
          </div>
        </div>
        <p class="disclaimer pl-dyn__disc">情景为依据使用说明书操作逻辑编排的示意，患者反馈数值为情景设定；实际参数须由经培训合格的医务人员结合皮肤厚度、治疗区域解剖结构与患者反馈决定。用户始终负责选择适当、安全的能量密度（使用说明书 第 22 页）。</p>
      </div>
    </div>`;

    // one pulse time shared by the 3D story slider and the oscilloscope slider
    const scope = setupScope(root.querySelector('.pl-scope'), ctx);
    const story = setupStory(root.querySelector('.pl-story'), ctx, { p: 1.0, onP: (p) => scope.setP(p) });
    scope.onP = (p) => story.setP(p);
    setupDyn(root.querySelector('.pl-dyn'), ctx);
  },
};

/* ---------- helpers ---------- */
function faceSVG(zones) {
  const [zyg, jaw, temple, forehead] = zones; // 颧骨、下颌、颞部、前额
  return `<svg class="pl-facesvg" viewBox="0 0 240 250" role="img" aria-label="面部示意：${zones.join('、')}为需减低能量部位，眼部禁用">
    <defs><pattern id="plNoGo" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#e05a6a" stroke-width="1.4" stroke-opacity=".7"/></pattern></defs>
    <path class="pl-face__o" d="M120 16 C70 16 50 58 50 108 C50 146 60 180 82 204 C98 222 110 232 120 232 C130 232 142 222 158 204 C180 180 190 146 190 108 C190 58 170 16 120 16 Z"/>
    <path class="pl-face__f" d="M120 116 L114 152 Q120 158 126 152"/>
    <path class="pl-face__f" d="M104 184 Q120 192 136 184"/>
    <g class="pl-zone" data-z="forehead"><ellipse cx="120" cy="62" rx="50" ry="19"/><text x="120" y="66" text-anchor="middle">${forehead}</text></g>
    <g class="pl-zone" data-z="temple"><ellipse cx="58" cy="100" rx="9" ry="20"/><ellipse cx="182" cy="100" rx="9" ry="20"/><text x="30" y="84" text-anchor="middle">${temple}</text><text x="210" y="84" text-anchor="middle">${temple}</text></g>
    <g class="pl-zone" data-z="zyg"><ellipse cx="78" cy="142" rx="17" ry="10"/><ellipse cx="162" cy="142" rx="17" ry="10"/><text x="30" y="150" text-anchor="middle">${zyg}</text><text x="210" y="150" text-anchor="middle">${zyg}</text></g>
    <g class="pl-zone" data-z="jaw"><path d="M72 192 Q120 252 168 192" fill="none" stroke-width="11" stroke-linecap="round"/><text x="120" y="246" text-anchor="middle">${jaw}</text></g>
    <g class="pl-nogo"><ellipse cx="96" cy="112" rx="18" ry="10" fill="url(#plNoGo)"/><ellipse cx="144" cy="112" rx="18" ry="10" fill="url(#plNoGo)"/><text x="120" y="99" text-anchor="middle">眼部禁用</text></g>
  </svg>`;
}

/* =========================================================
   1 · pinned 3D story: 1 发 → N × 100 ms → 冷却/射频/冷却
   YM3D createPulseTrain3D in one mount3D context. Desktop: pinned, scroll-scrubbed camera
   (build-in → close-up on the slabs → glide that follows the playhead → pull-back), then an
   idle loop of the shot. Mobile: no pin, looping shot. Reduced motion: a single still.
   ========================================================= */
const V = (target, radius, azimuth, elevation) => ({ target: [...target], radius, azimuth, elevation });
function mixCam(a, b, k, out) {
  for (let i = 0; i < 3; i++) out.target[i] = a.target[i] + (b.target[i] - a.target[i]) * k;
  out.radius = a.radius + (b.radius - a.radius) * k;
  out.azimuth = a.azimuth + (b.azimuth - a.azimuth) * k;
  out.elevation = a.elevation + (b.elevation - a.elevation) * k;
  return out;
}
const copyCam = (a, out) => mixCam(a, a, 0, out);
/** YM3D fx/halo materials use AdditiveBlending with gl_FragColor.a = 1, which also ADDS alpha: on a transparent
    stage every glow quad turns into an opaque dark square. Re-map them to add colour only (alpha untouched);
    with the default premultiplied canvas the glow then composites additively over the page. */
function additiveKeepsAlpha(THREE, root) {
  root.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      if (m.blending !== THREE.AdditiveBlending) continue;
      Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      m.needsUpdate = true;
    }
  });
}
let _fonts = null;
const fontsReady = () => (_fonts ||= Promise.all(['600 40px Montserrat', '500 40px Montserrat'].map((f) => document.fonts?.load(f))).catch(() => {}));

function setupStory(el, ctx, shared) {
  const { gsap, ScrollTrigger } = ctx;
  const { clamp: cl, seg, ease } = S3;
  const q = (s) => el.querySelector(s), qa = (s) => [...el.querySelectorAll(s)];
  const steps = qa('.pl-steps li'), bars = steps.map((s) => s.querySelector('i'));
  const box = q('.pl-3d'), range = q('.pl-3d__r'), outP = q('.pl-3d__o');
  const nEl = q('.pl-lb__n'), sEl = q('.pl-lb__s');
  const reduced = !!ctx.reduced;
  const st = { p: reduced ? 1 : 0, pT: reduced ? 1 : 0, story: false, N: shared.p * 10, Nt: shared.p * 10, loopT: 0, rev: reduced ? 1 : 0, dirty: true, step: -1, bars: [-1, -1, -1], w: 0, h: 0, px: 0, py: 0 };
  let m = null;

  /* ---- pulse-time slider (shared with the oscilloscope) ---- */
  const showP = (p) => {
    const n = Math.round(p * 10);
    outP.innerHTML = `<b class="num">${p.toFixed(1)}</b> s · <b class="num">${n}</b> × 100 ms`;
    range.value = String(p); range.style.setProperty('--p', ((p - 0.7) / 0.8) * 100 + '%');
    nEl.textContent = String(n); sEl.textContent = p.toFixed(1);
  };
  function setP(p) {
    p = Math.round(cl(p, 0.7, 1.5) * 10) / 10;
    st.Nt = Math.round(p * 10); showP(p); st.dirty = true;
    if (reduced) st.N = st.Nt;
    m?.invalidate();
  }
  range.addEventListener('input', () => { setP(+range.value); shared.onP?.(Math.round(+range.value * 10) / 10); });
  showP(shared.p);

  /* ---- steps (01 · 02 · 03) ---- */
  const setSteps = (i, b0, b1, b2) => {
    if (i !== st.step) { steps.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.classList.toggle('is-past', k < i); }); st.step = i; }
    [b0, b1, b2].forEach((b, k) => { const v = Math.round(b * 200) / 200; if (v !== st.bars[k]) { st.bars[k] = v; bars[k].style.transform = `scaleX(${v})`; } });
  };

  /* ---- camera keyframes (orbit params; x of C/D follows the shot layout) ---- */
  const CAM = {
    A: V([0, 0.42, 0], 9.4, -0.04, 0.7),
    B: V([0, 0.66, 0.05], 4.9, -0.34, 0.28),
    C: V([0, 0.52, 0.1], 3.9, -0.6, 0.13),
    D: V([0, 0.86, 0.05], 4.9, -0.42, 0.19),
    E: V([0, 0.84, 0.05], 5.3, -0.3, 0.25),
    M: V([0, 0.8, 0.05], 6.5, -0.6, 0.32), // mobile / narrow hero
  };
  const cam = V([0, 0, 0], 1, 0, 0), ca = V([0, 0, 0], 1, 0, 0), cb = V([0, 0, 0], 1, 0, 0);
  const LL = {};
  const shotDur = (N) => 2.3 + N * 0.12;
  const HOLD = 1.3;

  /* ---- DOM labels stuck to component anchors ---- */
  const LB = qa('.pl-lb').map((n) => ({ el: n, a: n.dataset.a, out: {}, on: false, tx: '' }));
  const ALIGN = { rf: [-0.5, -1, 0, -14], pulseFirst: [-0.5, -1, 0, -12], dermis: [0, -0.5, 14, 0], epidermis: [0, -0.5, 14, 0] };
  /* HUD: phase readout of the playhead (pre-cool · RF k/N · post-cool) */
  const hud = q('.pl-hud'), hudPh = qa('.pl-hud__ph'), hudK = q('.pl-hud__k'), hudN = q('.pl-hud__n'), hudBar = q('.pl-hud__bar > i');
  const H = { ph: -2, k: -1, n: -1, bar: -1 };
  function setHud(on, ph, k, n, f) {
    hud.classList.toggle('is-on', on);
    if (ph !== H.ph) { H.ph = ph; hudPh.forEach((e, i) => { e.classList.toggle('is-on', i === ph); e.classList.toggle('is-done', i < ph); }); }
    if (k !== H.k) { H.k = k; hudK.textContent = String(k); }
    if (n !== H.n) { H.n = n; hudN.textContent = String(n); }
    const b = Math.round(f * 400) / 400; if (b !== H.bar) { H.bar = b; hudBar.style.transform = `scaleX(${b})`; }
  }

  function frame(state, stage, t, dt, api) {
    const { comp } = state;
    const cv = stage.renderer.domElement, w = cv.clientWidth, h = cv.clientHeight;
    if (w !== st.w || h !== st.h) { st.w = w; st.h = h; st.dirty = true; }
    if (reduced && !st.dirty) return;
    st.dirty = false;
    const k6 = 1 - Math.exp(-dt * 6);
    st.p = reduced ? 1 : st.p + (st.pT - st.p) * (1 - Math.exp(-dt * 7));
    st.N = reduced || Math.abs(st.Nt - st.N) < 0.003 ? st.Nt : st.N + (st.Nt - st.N) * k6;
    const N = st.N, L = comp.layout(N, LL);
    const narrow = w / Math.max(1, h) < 1.25;
    const asp = w / Math.max(1, h), fit = narrow ? Math.max(1, Math.pow(1.05 / Math.max(0.4, asp), 0.7)) : Math.max(1, Math.pow(1.8 / Math.max(0.4, asp), 0.72));
    let reveal = 1, flow = 1, ribbons = 1, showRF = true, showUnit = false;
    const p = st.p;

    if (!reduced && st.story && p < 0.995) {
      /* scroll-scrubbed story */
      st.inLoop = false;
      reveal = seg(p, 0, 0.2, ease.out); st.rev = Math.max(st.rev, reveal);
      flow = cl((p - 0.46) / 0.42);
      ribbons = seg(p, 0.42, 0.49, ease.linear); // temperature ribbons (and their head beads) only once the shot runs
      const head = L.x0 + flow * L.total;
      copyCam(CAM.C, ca); ca.target[0] = L.rf0 + 0.5;
      copyCam(CAM.D, cb); cb.target[0] = head;
      if (p < 0.2) mixCam(CAM.A, CAM.B, ease.inOut(p / 0.2), cam);
      else if (p < 0.33) copyCam(CAM.B, cam);
      else if (p < 0.46) mixCam(CAM.B, ca, ease.inOut((p - 0.33) / 0.13), cam);
      else if (p < 0.88) mixCam(ca, cb, ease.inOut((p - 0.46) / 0.1), cam);
      else { cb.target[0] = L.x1; mixCam(cb, CAM.E, ease.inOut((p - 0.88) / 0.12), cam); }
      showRF = p < 0.47 || p > 0.9; showUnit = p > 0.36 && p < 0.47;
      const i = p < 0.3 ? 0 : p < 0.46 ? 1 : 2;
      setSteps(i, cl(p / 0.3), cl((p - 0.3) / 0.16), cl((p - 0.46) / 0.44));
    } else if (!reduced) {
      /* idle loop of the shot (after the story, and the whole time on mobile) */
      if (!st.inLoop) { st.inLoop = true; st.loopT = shotDur(N); } // enter on the finished shot (hold), then replay
      st.rev = Math.min(1, st.rev + dt / 2.2);
      reveal = ease.out(st.rev);
      if (st.rev >= 1) st.loopT += dt;
      const dur = shotDur(N), u = st.loopT % (dur + HOLD);
      if (u < dur) flow = u / dur;
      else { flow = 1; ribbons = 1 - seg(u - dur, HOLD - 0.45, HOLD, ease.linear); }
      const head = L.x0 + flow * L.total;
      copyCam(narrow ? CAM.M : CAM.E, cam);
      cam.target[0] = head * (narrow ? 0.14 : 0.16);
      cam.azimuth += 0.05 * Math.sin(t * 0.21);
      setSteps(2, 1, 1, 1);
    } else {
      copyCam(narrow ? CAM.M : CAM.E, cam);
      setSteps(2, 1, 1, 1);
    }
    cam.radius *= fit;
    // integration QA: the ribbon head beads + halos sat at the start of the (still empty) ribbons as a stray glowing
    // orb above the pre-cool block before the playhead moved (story p 0.42–0.46, and at every loop restart) —
    // fade the ribbons in with the first few % of the playhead so the bead appears as the "pen" that draws them.
    ribbons *= seg(flow, 0, 0.045, ease.linear);

    // pointer parallax + drag orbit (drag springs back when released)
    if (!reduced) {
      st.px += ((api.pointer.inside ? api.pointer.x : 0) - st.px) * k6 * 0.5;
      st.py += ((api.pointer.inside ? api.pointer.y : 0) - st.py) * k6 * 0.5;
      if (!api.drag.active) { const d = Math.exp(-dt * 1.1); api.drag.azimuth *= d; api.drag.elevation *= d; }
      cam.azimuth += cl(api.drag.azimuth * 0.6, -1.2, 1.2) + st.px * 0.07;
      cam.elevation = cl(cam.elevation + api.drag.elevation * 0.6 - st.py * 0.035, 0.02, 1.15);
    }

    comp.update({ t: reduced ? 1.2 : t, pulses: N, reveal, flow, ribbons, labels: 1 });
    stage.orbit(cam);
    stage.render();

    /* labels */
    const cam3 = stage.camera;
    const vis = { rf: showRF && reveal > 0.85, pulseFirst: showUnit, dermis: ribbons > 0.6 && flow > 0.16, epidermis: ribbons > 0.6 && flow > 0.16 };
    if (narrow && vis.dermis) vis.rf = false; // small screens: one set of labels at a time
    {
      const hx = L.x0 + flow * L.total, n = Math.round(N);
      const ph = hx < L.rf0 ? 0 : hx <= L.rf1 ? 1 : 2;
      const k = ph === 0 ? 0 : ph === 2 ? n : Math.min(n, Math.floor((hx - L.rf0) / 0.16) + 1);
      setHud(!reduced && reveal > 0.9 && flow > 0.001 && flow < 0.999, ph, k, n, flow);
    }
    for (const l of LB) {
      const o = projectAnchor(THREE, comp.anchors[l.a], cam3, w, h, l.out);
      const on = !!vis[l.a] && o.visible && o.x > 8 && o.x < w - 8 && o.y > 8 && o.y < h - 8;
      if (on !== l.on) { l.on = on; l.el.classList.toggle('is-on', on); }
      if (on) {
        let [ax, ay, dx, dy] = ALIGN[l.a];
        if (dx > 0 && o.x > w * 0.62) { ax = -1; dx = -dx; } // flip side-labels inward near the right edge
        l.el.style.transform = `translate3d(${(o.x + dx).toFixed(1)}px, ${(o.y + dy).toFixed(1)}px, 0) translate(${ax * 100}%, ${ay * 100}%)`;
      }
    }
  }

  fontsReady().then(() => {
    m = mount3D(box, {
      THREE, stageLib: precompileLib(freshStageLib(S3)), dpr: 1.5, draggable: !reduced,
      stageOpts: { fov: 30, transparent: true, exposure: 1.05 },
      build(stage) {
        const comp = createPulseTrain3D(THREE, {});
        additiveKeepsAlpha(THREE, comp.object3d); // transparent stage: glows must not write alpha (see note below)
        stage.scene.add(comp.object3d);
        const k = stage.lights.key;
        Object.assign(k.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2 }); k.shadow.camera.updateProjectionMatrix();
        st.dirty = true;
        return { comp };
      },
      frame,
      dispose(s) { s?.comp?.dispose(); },
      fallback(c) { c.classList.add('is-nogl'); },
    });
  });

  /* ---- scroll: pinned story on desktop ---- */
  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 760px)', mob: '(max-width: 759px)' }, (c) => {
    if (reduced || !c.conditions.desk) { st.story = false; st.dirty = true; return; }
    st.story = true;
    const trig = ScrollTrigger.create({ trigger: el, start: 'top top', end: '+=240%', pin: true, pinSpacing: true, onUpdate: (s) => { st.pT = s.progress; } });
    st.pT = trig.progress;
    return () => { trig.kill(); st.story = false; };
  });

  return { setP };
}

/* =========================================================
   2 · oscilloscope
   ========================================================= */
function setupScope(el, ctx) {
  const { lib, gsap } = ctx;
  const q = (s) => el.querySelector(s), qa = (s) => [...el.querySelectorAll(s)];
  const cv = q('.pl-cv');
  const g = cv.getContext('2d');
  const S = { lv: 4, p: 1.0, cool: 2, mode: 'flash', speed: 1 };
  let L = null, W = 0, H = 0, dpr = 1;
  let seed = 7, shot = null, ghosts = [], tau = 0, hold = 0;
  const parts = [];

  const layout = () => {
    const f = lib.fitCanvas(cv);
    W = f.cssW; H = f.cssH; dpr = f.dpr;
    const mob = W < 620;
    const x0 = mob ? 8 : 92, x1 = W - (mob ? 8 : 20);
    const top = mob ? 34 : 38, bottom = H - (mob ? 28 : 30);
    const gap = mob ? 8 : 12, avail = bottom - top - gap * 2;
    const hC = avail * 0.17, hR = avail * 0.33, hT = avail * 0.5;
    L = { mob, x0, x1, top, bottom, c: [top, top + hC], r: [top + hC + gap, top + hC + gap + hR], t: [top + hC + hR + gap * 2, bottom] };
  };
  const X = (t) => L.x0 + (t / T_MAX) * (L.x1 - L.x0);

  const ghostFill = () => {
    ghosts = [];
    for (let i = 0; i < 5; i++) ghosts.push(simulate(S, lib, seed++));
  };
  const newShot = (keep) => {
    if (keep && shot) { ghosts.push(shot); if (ghosts.length > 5) ghosts.shift(); }
    shot = simulate(S, lib, seed++);
    tau = 0; hold = 0;
  };

  /* ---------- drawing ---------- */
  const heatGrad = (y0, y1) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, lib.heatCSS(0.95)); gr.addColorStop(0.45, lib.heatCSS(0.78)); gr.addColorStop(1, lib.heatCSS(0.5));
    return gr;
  };
  const yT = (v) => { const [a, b] = L.t; const h = b - a; return b - 0.3 * h - v * 0.62 * h; };

  function trace(arr, upto, stroke, width, alpha) {
    const n = Math.min(arr.length, Math.floor(upto / DT) + 1);
    if (n < 2) return;
    g.globalAlpha = alpha; g.strokeStyle = stroke; g.lineWidth = width;
    g.beginPath();
    const step = L.mob ? 2 : 1;
    for (let k = 0; k < n; k += step) { const x = X(k * DT), y = yT(arr[k]); k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.lineTo(X((n - 1) * DT), yT(arr[n - 1]));
    g.stroke(); g.globalAlpha = 1;
  }

  function segments(sh) {
    const { tm, n } = sh;
    if (!sh.allowed) return [];
    if (sh.mode === 'long') return [[tm.rf0, tm.rf1]];
    return Array.from({ length: n }, (_, i) => [tm.rf0 + i * 0.1 + 0.004, tm.rf0 + i * 0.1 + 0.1 * GAP_ON]);
  }

  function draw() {
    if (!shot || !L) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const { tm } = shot;
    const upto = tau;

    // phase windows
    const band = (a, b, col) => { g.fillStyle = col; g.fillRect(X(a), L.top - 8, X(b) - X(a), L.bottom - L.top + 8); };
    if (shot.allowed) {
      band(tm.pre0, tm.rf0, 'rgba(127,212,255,0.055)');
      band(tm.rf1, tm.post1, 'rgba(127,212,255,0.055)');
      band(tm.rf0, tm.rf1, 'rgba(138,92,240,0.06)');
    } else band(tm.pre0, tm.post1, 'rgba(224,90,106,0.04)');

    // grid (0.1 s = 1 division)
    g.lineWidth = 1;
    for (let k = 0; k * 0.1 <= T_MAX + 1e-6; k++) {
      const x = Math.round(X(k * 0.1)) + 0.5;
      g.strokeStyle = k % 5 === 0 ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.035)';
      g.beginPath(); g.moveTo(x, L.top); g.lineTo(x, L.bottom); g.stroke();
    }
    for (const [a, b] of [L.c, L.r, L.t]) {
      g.strokeStyle = 'rgba(255,255,255,0.09)';
      g.strokeRect(Math.round(L.x0) + 0.5, Math.round(a) + 0.5, Math.round(L.x1 - L.x0), Math.round(b - a));
    }

    // phase labels (top)
    g.font = `500 ${L.mob ? 10 : 11}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const lab = (a, b, txt, col) => { g.fillStyle = col; g.fillText(txt, (X(a) + X(b)) / 2, L.top - (L.mob ? 12 : 14)); };
    if (shot.allowed) {
      lab(tm.pre0, tm.rf0, L.mob ? '前冷却' : '治疗前冷却', '#9edfff');
      lab(tm.rf1, tm.post1, L.mob ? '后冷却' : '治疗后冷却', '#9edfff');
      lab(tm.rf0, tm.rf1, '射频传送', '#c9b6ff');
    } else lab(tm.pre0, tm.post1, '限制输出区 · 该组合不可选择', '#e0a0a8');

    // lane titles
    g.textAlign = 'left';
    const lt = (y, a, b) => {
      if (L.mob) { g.font = `500 9.5px ${MONO}`; g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillText(a, L.x0 + 6, y + 13); return; }
      g.font = `500 10px ${MONO}`; g.fillStyle = 'rgba(255,255,255,0.38)'; g.fillText(a, 14, y + 16);
      g.font = `400 12px ${SANS}`; g.fillStyle = 'rgba(236,234,244,0.8)'; g.fillText(b, 14, y + 34);
    };
    lt(L.c[0], 'CH1', '制冷剂');
    lt(L.r[0], 'CH2', '射频');
    lt(L.t[0], 'CH3', '温度');
    if (!L.mob) { g.font = `400 10.5px ${SANS}`; g.fillStyle = 'rgba(169,166,186,0.6)'; g.fillText('（示意）', 14, L.t[0] + 52); }

    drawCool(upto);
    drawRF(upto);
    drawTemp(upto);

    // playhead
    if (!ctx.reduced) {
      const x = X(upto);
      const gr = g.createLinearGradient(0, L.top, 0, L.bottom);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - 0.75, L.top, 1.5, L.bottom - L.top);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x - 10, L.top, 10, L.bottom - L.top);
    }

    // footer readout
    g.font = `500 ${L.mob ? 9.5 : 10.5}px ${MONO}`; g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.42)';
    const inRF = upto >= tm.rf0 && upto < tm.rf1 && shot.allowed;
    const phase = !shot.allowed ? 'INHIBITED  限制输出' : upto < tm.pre0 ? 'STANDBY' : upto < tm.rf0 ? 'PRE-COOL' : upto < tm.rf1 ? (shot.mode === 'flash' ? `RF  ${Math.min(shot.n, Math.floor((upto - tm.rf0) / 0.1) + 1)}/${shot.n} × 100ms` : 'RF  CONTINUOUS') : upto < tm.post1 ? 'POST-COOL' : 'DONE';
    g.fillStyle = inRF ? '#c9b6ff' : shot.allowed ? 'rgba(255,255,255,0.42)' : '#e0a0a8';
    g.fillText(phase, L.x0 + (L.mob ? 6 : 0), H - 9);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillText(`${S.speed < 1 ? '×0.25  ' : ''}0.1 s / div`, L.x1, H - 9);
  }

  function drawCool(upto) {
    const [a, b] = L.c, h = b - a, base = b - 6;
    const amp = (h - 14) * (0.35 + 0.16 * shot.cool);
    const { tm } = shot;
    const wins = shot.allowed ? [[tm.pre0, tm.rf0], [tm.rf1, tm.post1]] : [];
    const path = (lim) => {
      g.beginPath(); g.moveTo(X(0), base);
      if (!wins.length) { g.lineTo(X(Math.min(lim, tm.end)), base); return; }
      for (const [s, e] of wins) {
        if (s > lim) break;
        const ee = Math.min(e, lim);
        g.lineTo(X(s), base); g.lineTo(X(s), base - amp); g.lineTo(X(ee), base - amp);
        if (ee === e) g.lineTo(X(e), base);
      }
      g.lineTo(X(Math.min(lim, shot.tm.end)), lim >= wins[1][1] || lim < wins[0][0] || (lim >= wins[0][1] && lim < wins[1][0]) ? base : base - amp);
    };
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(127,212,255,0.22)'; path(shot.tm.end); g.stroke();
    g.save();
    g.lineWidth = 1.8; g.strokeStyle = '#7fd4ff'; g.shadowColor = 'rgba(127,212,255,0.8)'; g.shadowBlur = 8; path(upto); g.stroke();
    g.restore();
    for (const [s, e] of wins) {
      if (upto <= s) continue;
      const ee = Math.min(e, upto);
      const gr = g.createLinearGradient(0, base - amp, 0, base);
      gr.addColorStop(0, 'rgba(127,212,255,0.28)'); gr.addColorStop(1, 'rgba(127,212,255,0.02)');
      g.fillStyle = gr; g.fillRect(X(s), base - amp, X(ee) - X(s), amp);
    }
    // particles
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      g.globalAlpha = Math.max(0, p.life) * 0.8;
      g.fillStyle = '#bfeaff';
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function stepParticles(dt) {
    const { tm } = shot;
    const spraying = shot.allowed && ((tau >= tm.pre0 && tau < tm.rf0) || (tau >= tm.rf1 && tau < tm.post1));
    if (spraying && hold <= 0) {
      const [a, b] = L.c, base = b - 6, amp = (b - a - 14) * (0.35 + 0.16 * shot.cool);
      const nEmit = Math.round(shot.cool * (L.mob ? 1.2 : 2.2) * S.speed + Math.random());
      for (let i = 0; i < nEmit; i++) {
        parts.push({ x: X(tau) - Math.random() * 10, y: base - amp * Math.random(), vx: 8 + Math.random() * 40, vy: -10 - Math.random() * 40, r: 0.6 + Math.random() * 1.6, life: 0.6 + Math.random() * 0.5 });
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 26 * dt; p.life -= dt * 1.1;
      if (p.life <= 0 || p.y < L.c[0] - 6) parts.splice(i, 1);
    }
    if (parts.length > 420) parts.splice(0, parts.length - 420);
  }

  function drawRF(upto) {
    const [a, b] = L.r, h = b - a, yc = a + h * 0.52;
    const A = (h * 0.5 - 12) * (0.22 + 0.78 * shot.P);
    const segs = segments(shot);
    const { tm } = shot;
    // centre line
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(L.x0, yc); g.lineTo(L.x1, yc); g.stroke(); g.setLineDash([]);
    if (!shot.allowed) {
      g.font = `500 12px ${SANS}`; g.textAlign = 'center'; g.fillStyle = '#e0a0a8';
      g.fillText('该组合为限制输出区 · 不启动冷却与射频', (X(tm.pre0) + X(tm.post1)) / 2, yc + 4);
      return;
    }
    const hgr = g.createLinearGradient(X(tm.rf0), 0, X(tm.rf1), 0);
    hgr.addColorStop(0, '#8a5cf0'); hgr.addColorStop(1, '#43e6a8');
    const f = L.mob ? 45 : 85; // visual carrier cycles per second (not to scale)
    for (let i = 0; i < segs.length; i++) {
      const [s, e] = segs[i];
      const x0 = X(s), x1 = X(e);
      // planned outline (future)
      g.strokeStyle = 'rgba(201,182,255,0.16)'; g.lineWidth = 1;
      g.strokeRect(x0 + 0.5, yc - A + 0.5, x1 - x0 - 1, 2 * A - 1);
      if (upto <= s) continue;
      const ee = Math.min(e, upto), xe = X(ee);
      // body
      g.globalAlpha = 0.16; g.fillStyle = hgr; g.fillRect(x0, yc - A, xe - x0, 2 * A); g.globalAlpha = 1;
      // carrier
      g.strokeStyle = hgr; g.lineWidth = 1.1; g.beginPath();
      const dur = ee - s, nS = Math.max(4, Math.ceil(dur * f * 10));
      for (let k = 0; k <= nS; k++) {
        const t = (k / nS) * dur;
        const env = Math.min(1, t / 0.006, (e - s - t) / 0.006);
        const y = yc - Math.sin(2 * Math.PI * f * t) * A * 0.92 * Math.max(0, env);
        k ? g.lineTo(X(s + t), y) : g.moveTo(X(s + t), y);
      }
      g.stroke();
      // envelope
      g.save(); g.shadowColor = 'rgba(160,120,255,0.9)'; g.shadowBlur = 10; g.strokeStyle = hgr; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(x0, yc); g.lineTo(x0, yc - A); g.lineTo(xe, yc - A); if (ee === e) g.lineTo(xe, yc);
      g.moveTo(x0, yc); g.lineTo(x0, yc + A); g.lineTo(xe, yc + A); if (ee === e) g.lineTo(xe, yc);
      g.stroke(); g.restore();
    }
    // sub-pulse indices + bracket
    g.textAlign = 'center';
    if (shot.mode === 'flash') {
      const w = X(0.1) - X(0);
      if (w > 15) {
        g.font = `500 ${w > 26 ? 9.5 : 8}px ${MONO}`;
        for (let i = 0; i < shot.n; i++) {
          const cx = X(tm.rf0 + i * 0.1 + 0.05 * GAP_ON);
          const lit = upto > tm.rf0 + i * 0.1;
          g.fillStyle = lit ? 'rgba(236,234,244,0.85)' : 'rgba(255,255,255,0.22)';
          g.fillText(String(i + 1), cx, a + 12);
        }
      }
    }
    const by = b - 3;
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(X(tm.rf0), by - 5); g.lineTo(X(tm.rf0), by); g.lineTo(X(tm.rf1), by); g.lineTo(X(tm.rf1), by - 5); g.stroke();
    g.font = `500 ${L.mob ? 9.5 : 10.5}px ${MONO}`; g.fillStyle = 'rgba(236,234,244,0.75)';
    const txt = shot.mode === 'flash' ? `${shot.n} × 100 ms = ${S.p.toFixed(1)} s` : `单一长脉冲 ${S.p.toFixed(1)} s`;
    const tw = g.measureText(txt).width + 12, cx = (X(tm.rf0) + X(tm.rf1)) / 2;
    g.fillStyle = 'rgba(13,13,22,0.92)'; g.fillRect(cx - tw / 2, by - 8, tw, 14);
    g.fillStyle = 'rgba(236,234,244,0.8)'; g.font = shot.mode === 'flash' ? `500 ${L.mob ? 9.5 : 10.5}px ${MONO}` : `500 ${L.mob ? 9.5 : 10.5}px ${SANS}`;
    g.fillText(txt, cx, by + 3);
  }

  function drawTemp(upto) {
    const [a, b] = L.t;
    const base = yT(0);
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.setLineDash([3, 5]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(L.x0, base); g.lineTo(L.x1, base); g.stroke(); g.setLineDash([]);
    g.font = `500 9.5px ${MONO}`; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillText('BASELINE', L.x1 - 4, base - 5);
    // ideal (noise-free) ramp
    g.setLineDash([5, 5]); trace(shot.Ti, shot.tm.end, 'rgba(255,244,214,0.5)', 1, 0.55); g.setLineDash([]);
    // ghosts
    const hg = heatGrad(a, base);
    for (let i = 0; i < ghosts.length; i++) trace(ghosts[i].Td, ghosts[i].tm.end, hg, 1.2, 0.12 + i * 0.045);
    // epidermis
    g.save(); g.shadowColor = 'rgba(127,212,255,0.8)'; g.shadowBlur = 8;
    trace(shot.Te, upto, '#cfeeff', 1.8, 0.95); g.restore();
    // dermis
    g.save(); g.shadowColor = 'rgba(255,170,80,0.85)'; g.shadowBlur = 12;
    trace(shot.Td, upto, hg, 2.4, 1); g.restore();
    // heads + labels
    const k = Math.min(shot.len - 1, Math.floor(upto / DT));
    const xh = X(k * DT);
    const dot = (y, col) => { g.fillStyle = col; g.beginPath(); g.arc(xh, y, 3.2, 0, Math.PI * 2); g.fill(); };
    const yd = yT(shot.Td[k]), ye = yT(shot.Te[k]);
    dot(yd, lib.heatCSS(0.9)); dot(ye, '#cfeeff');
    g.textAlign = 'left'; g.font = `500 ${L.mob ? 10 : 11}px ${SANS}`;
    const lx = Math.min(xh + 8, L.x1 - 30);
    g.fillStyle = lib.heatCSS(0.92); g.fillText('真皮', lx, Math.min(yd - 6, ye - 14));
    g.fillStyle = '#cfeeff'; g.fillText('表皮', lx, Math.max(ye + 15, yd + 18));
  }

  /* ---------- controls ---------- */
  const rP = q('.pl-r-p'), rL = q('.pl-r-lv'), coolBtns = qa('.pl-cool button');
  const vP = q('.pl-v-p'), vL = q('.pl-v-lv'), vC = q('.pl-v-c'), nV = q('.pl-n__v'), pillEls = qa('.pl-pills i');
  const oD = q('.pl-o-d'), oE = q('.pl-o-e'), oBand = q('.pl-o-band'), warn = q('.pl-warn'), spread = q('.pl-spread__bar i'), howN = q('.pl-howto-n');
  const pillsBox = q('.pl-pills'), nX = q('.pl-n__x'), nCap = q('.pl-n__cap');
  let lastN = 10;

  const pct = (r) => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');

  function sync(resetCool) {
    const allowed = lib.isAllowed(S.lv, S.p);
    const d = lib.density(S.lv, S.p), band = lib.bandOf(d);
    if (resetCool && allowed) S.cool = band.coolDefault;
    if (allowed && !band.coolRange.includes(S.cool)) S.cool = band.coolDefault;
    const n = Math.round(S.p * 10);
    vP.textContent = S.p.toFixed(1) + ' s';
    vL.textContent = `${S.lv.toFixed(1)} 档 · ${lib.levelPower(S.lv)} W`;
    vC.textContent = allowed ? `默认 ${band.coolDefault} · 可选 ${band.coolRange[0]}–${band.coolRange[band.coolRange.length - 1]}` : '—';
    coolBtns.forEach((b) => {
      const c = +b.dataset.c;
      const ok = allowed && band.coolRange.includes(c);
      b.disabled = !ok; b.setAttribute('aria-pressed', String(allowed && c === S.cool));
      b.classList.toggle('is-default', allowed && c === band.coolDefault);
    });
    const isLong = S.mode === 'long';
    nV.textContent = isLong ? '1' : String(n); howN.textContent = String(n);
    nX.textContent = isLong ? `× ${S.p.toFixed(1)} s` : '× 100 ms';
    nCap.textContent = isLong ? '对比示意：同样时长，不切分为 100 ms 单元' : '每发脉冲数 = 脉冲时间 ÷ 0.1 s';
    pillsBox.classList.toggle('is-long', S.mode === 'long');
    pillEls.forEach((p, i) => p.classList.toggle('is-on', i < n));
    if (n > lastN && !ctx.reduced) gsap.fromTo(pillEls.slice(lastN, n), { scale: 0.2 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.04 });
    if (n !== lastN && !isLong && !ctx.reduced) gsap.fromTo(nV, { y: n > lastN ? 10 : -10, opacity: 0.2 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
    lastN = n;
    oD.textContent = allowed ? d.toFixed(1) : '—';
    oE.textContent = allowed ? String(Math.round(lib.levelPower(S.lv) * S.p)) : '—';
    oBand.style.color = allowed ? band.hex : 'var(--text-3)';
    oBand.querySelector('em').textContent = allowed ? band.label : '限制';
    oD.style.color = allowed ? band.hex : 'var(--text-3)';
    warn.hidden = allowed;
    const rel = S.mode === 'flash' ? 1 / Math.sqrt(n) : 1;
    spread.style.transform = `scaleX(${allowed ? 0.08 + 0.92 * rel : 0})`;
    spread.style.background = S.mode === 'flash' ? 'var(--mint)' : 'var(--lv-mid)';
    pct(rP); pct(rL);
  }

  const onParam = (resetCool) => { sync(resetCool); ghostFill(); newShot(false); if (ctx.reduced) { tau = shot.tm.end; draw(); } };
  const api = { onP: null, setP(p) { p = Math.round(p * 10) / 10; if (p === S.p) return; S.p = p; rP.value = String(p); onParam(true); } };
  rP.addEventListener('input', () => { S.p = Math.round(+rP.value * 10) / 10; onParam(true); api.onP?.(S.p); });
  rL.addEventListener('input', () => { S.lv = Math.round(+rL.value * 2) / 2; onParam(true); });
  coolBtns.forEach((b) => b.addEventListener('click', () => { S.cool = +b.dataset.c; onParam(false); }));
  qa('.pl-mode button').forEach((b) => b.addEventListener('click', () => {
    S.mode = b.dataset.mode;
    qa('.pl-mode button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onParam(false);
  }));
  const slow = q('.pl-slow');
  slow.addEventListener('click', () => {
    S.speed = S.speed === 1 ? 0.25 : 1;
    slow.setAttribute('aria-pressed', String(S.speed < 1));
  });

  layout();
  sync(false);
  ghostFill();
  newShot(false);
  if (ctx.reduced) { tau = shot.tm.end; draw(); }
  else {
    lib.visibleLoop(cv, (dt) => {
      if (!L) return;
      if (hold > 0) { hold -= dt; if (hold <= 0) newShot(true); }
      else { tau += dt * S.speed; if (tau >= shot.tm.end) { tau = shot.tm.end; hold = 0.9; } }
      stepParticles(dt);
      draw();
    });
  }
  lib.onResize(() => { layout(); draw(); });
  document.fonts?.ready.then(() => draw());
  return api;
}

/* =========================================================
   3 · 动态脉冲: P–t 能量密度地形图 + 长短脉冲矩形 + 情景
   ========================================================= */
function setupDyn(el, ctx) {
  const { lib, gsap } = ctx;
  const q = (s) => el.querySelector(s), qa = (s) => [...el.querySelectorAll(s)];
  const cv = q('.pl-pcv'), g = cv.getContext('2d');
  const field = document.createElement('canvas');
  const msg = q('.pl-plane__msg');
  let L = null, W = 0, H = 0, dpr = 1;
  const cur = { lv: SCN[0].start.lv, p: SCN[0].start.p };
  let prev = null; // previous setting (ghost rectangle)
  const trail = [];
  let alt = null, altK = 0, iso = null, hover = null;
  let tl = null, locked = null;
  const fb = { v: 1.4 };
  const DUR = (x) => (ctx.reduced ? 0.001 : x);

  const snapLv = (v) => clamp(Math.round(v * 2) / 2, 0.5, 8);
  const snapP = (v) => clamp(Math.round(v * 10) / 10, 0.7, 1.5);
  const layout = () => {
    const f = lib.fitCanvas(cv);
    W = f.cssW; H = f.cssH; dpr = f.dpr;
    const mob = W < 520;
    L = { mob, x0: mob ? 44 : 58, x1: W - (mob ? 10 : 18), y0: 12, y1: H - (mob ? 38 : 42) };
    renderField();
  };
  const X = (p) => L.x0 + ((p - 0.65) / 0.9) * (L.x1 - L.x0);
  const Y = (lv) => L.y1 - ((lv - 0.25) / 8) * (L.y1 - L.y0);
  const iX = (x) => 0.65 + ((x - L.x0) / (L.x1 - L.x0)) * 0.9;
  const iY = (y) => 0.25 + ((L.y1 - y) / (L.y1 - L.y0)) * 8;
  const Dc = (lv, p) => ((15 + 20 * lv) * p) / 4;
  const minP = (lv) => (lv < 0.75 ? 0.95 : lv < 1.25 ? 0.85 : lv < 1.75 ? 0.75 : 0);
  const EDGES = [16.35, 23.85, 31.35];

  function renderField() {
    field.width = cv.width; field.height = cv.height;
    const fg = field.getContext('2d');
    const img = fg.createImageData(field.width, field.height), d = img.data;
    const cols = lib.BANDS.map((b) => lib.hexToRgb(b.hex));
    const lo = [3, 16.35, 23.85, 31.35], hi = [16.35, 23.85, 31.35, 38.85];
    const hatch = 9 * dpr;
    for (let py = 0; py < field.height; py++) {
      const yy = py / dpr;
      if (yy < L.y0 || yy > L.y1) continue;
      const lv = iY(yy);
      for (let px = 0; px < field.width; px++) {
        const xx = px / dpr;
        if (xx < L.x0 || xx > L.x1) continue;
        const p = iX(xx), D = Dc(lv, p), o = (py * field.width + px) * 4;
        if (D > 38.85 || p < minP(lv)) {
          const on = (px + py) % hatch < 1.1 * dpr;
          d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = on ? 26 : 5;
          continue;
        }
        const bi = D <= 16.35 ? 0 : D <= 23.85 ? 1 : D <= 31.35 ? 2 : 3;
        const fr = clamp((D - lo[bi]) / (hi[bi] - lo[bi]), 0, 1);
        const c = cols[bi];
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = (0.07 + 0.17 * fr) * 255;
      }
    }
    fg.putImageData(img, 0, 0);
  }

  function contour(D, style, width, dash) {
    g.strokeStyle = style; g.lineWidth = width; g.setLineDash(dash || []);
    g.beginPath();
    let started = false;
    for (let p = 0.65; p <= 1.551; p += 0.005) {
      const lv = (4 * D / p - 15) / 20;
      if (lv < 0.25 || lv > 8.25) { started = false; continue; }
      const x = X(p), y = Y(lv);
      started ? g.lineTo(x, y) : g.moveTo(x, y); started = true;
    }
    g.stroke(); g.setLineDash([]);
  }

  function draw() {
    if (!L) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(field, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // frame + ticks
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
    g.strokeRect(L.x0 + 0.5, L.y0 + 0.5, L.x1 - L.x0 - 1, L.y1 - L.y0 - 1);
    g.font = `500 ${L.mob ? 9 : 10}px ${MONO}`; g.fillStyle = 'rgba(169,166,186,0.75)'; g.textAlign = 'center';
    for (const p of lib.PULSES) {
      const x = X(p);
      g.fillText(p.toFixed(1), x, L.y1 + 14);
      if (!L.mob || Math.round(p * 10) % 2 === 1) { g.fillStyle = 'rgba(111,108,130,0.8)'; g.fillText(`${Math.round(p * 10)}×`, x, L.y1 + 26); g.fillStyle = 'rgba(169,166,186,0.75)'; }
    }
    g.textAlign = 'right';
    for (const lv of [0.5, 2, 4, 6, 8]) {
      const y = Y(lv);
      g.fillText(lv.toFixed(1), L.x0 - 8, y + 3);
      if (!L.mob) { g.fillStyle = 'rgba(111,108,130,0.8)'; g.fillText(`${lib.levelPower(lv)}W`, L.x0 - 8, y + 14); g.fillStyle = 'rgba(169,166,186,0.75)'; }
    }
    g.save(); g.translate(L.mob ? 10 : 12, (L.y0 + L.y1) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center';
    g.font = `400 ${L.mob ? 10 : 11}px ${SANS}`; g.fillStyle = 'rgba(169,166,186,0.8)'; g.fillText('功率档位', 0, 0); g.restore();
    g.textAlign = 'right'; g.font = `400 ${L.mob ? 10 : 11}px ${SANS}`; g.fillStyle = 'rgba(169,166,186,0.8)';
    g.fillText('脉冲时间 s · 脉冲数 →', L.x1, H - 2);

    // band edges + limit
    EDGES.forEach((D, i) => contour(D, i === 1 ? 'rgba(255,255,255,0.14)' : 'rgba(67,230,168,0.55)', i === 1 ? 1 : 1.4, i === 1 ? [] : [6, 4]));
    contour(38.8, 'rgba(255,255,255,0.4)', 1, [2, 3]);
    if (!L.mob) {
      g.font = `500 10px ${MONO}`; g.fillStyle = 'rgba(255,255,255,0.45)'; g.textAlign = 'left';
      g.fillText('38.8 上限', X(1.18) + 4, Y((4 * 38.8 / 1.18 - 15) / 20) - 4);
      g.fillStyle = 'rgba(67,230,168,0.85)'; g.textAlign = 'right';
      g.fillText('推荐区 16.6–31.3', L.x1 - 6, Y((4 * 16.35 / 1.5 - 15) / 20) + 15);
    }
    // discrete combos
    for (const lv of lib.LEVELS) for (const p of lib.PULSES) {
      const x = X(p), y = Y(lv);
      if (!lib.isAllowed(lv, p)) { g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x + 2, y + 2); g.moveTo(x + 2, y - 2); g.lineTo(x - 2, y + 2); g.stroke(); continue; }
      g.fillStyle = lib.bandOf(lib.density(lv, p)).hex; g.globalAlpha = 0.8;
      g.beginPath(); g.arc(x, y, L.mob ? 1.6 : 2.1, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
    // band labels
    g.font = `500 ${L.mob ? 10 : 11}px ${SANS}`; g.textAlign = 'center';
    const bl = [[0.85, 1.75, 0], [1.3, 2.6, 1], [1.12, 4.4, 2], [0.92, 7.0, 3]];
    for (const [p, lv, bi] of bl) {
      const b = lib.BANDS[bi]; const x = X(p), y = Y(lv);
      g.fillStyle = 'rgba(7,7,12,0.55)'; const w = g.measureText(b.label).width + 12; g.fillRect(x - w / 2, y - 10, w, 16);
      g.fillStyle = b.hex; g.fillText(b.label, x, y + 2);
    }
    // iso-density through current / locked
    const dNow = Dc(cur.lv, cur.p);
    const isoD = locked ?? dNow;
    contour(isoD, 'rgba(255,255,255,0.75)', 1.4, [1, 0]);
    g.save(); g.globalAlpha = 0.25; contour(isoD, '#ffffff', 5); g.restore();
    // trail
    for (const s of trail) drawSeg(s);
    // alt option
    if (alt && altK > 0) {
      const a = { lv: SCN[1].start.lv, p: SCN[1].start.p };
      drawSeg({ a, b: alt, kind: 'alt', k: altK });
      if (altK >= 1) ring(alt, lib.bandOf(lib.density(alt.lv, alt.p)).hex, 0.75, '方案二');
    }
    // hover
    if (hover && !tl?.isActive()) {
      const ok = lib.isAllowed(hover.lv, hover.p);
      g.strokeStyle = ok ? 'rgba(255,255,255,0.6)' : 'rgba(224,90,106,0.8)'; g.lineWidth = 1;
      g.beginPath(); g.arc(X(hover.p), Y(hover.lv), 7, 0, Math.PI * 2); g.stroke();
      const t = ok ? `${hover.lv.toFixed(1)} × ${hover.p.toFixed(1)} s = ${lib.density(hover.lv, hover.p).toFixed(1)}` : '限制输出区';
      g.font = `500 10.5px ${MONO}`; g.textAlign = 'left';
      const tw = g.measureText(t).width + 10; let tx = X(hover.p) + 10, ty = Y(hover.lv) - 12;
      if (tx + tw > L.x1) tx = X(hover.p) - 10 - tw;
      g.fillStyle = 'rgba(7,7,12,0.85)'; g.fillRect(tx, ty - 11, tw, 16);
      g.fillStyle = ok ? '#eceaf4' : '#f0a0aa'; g.fillText(t, tx + 5, ty + 1);
    }
    // current dot
    const band = lib.bandOf(Dc(cur.lv, cur.p));
    const x = X(cur.p), y = Y(cur.lv);
    const gr = g.createRadialGradient(x, y, 0, x, y, 26);
    gr.addColorStop(0, hexA(band.hex, 0.55)); gr.addColorStop(1, hexA(band.hex, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = band.hex; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke();
    // iso label
    g.font = `500 ${L.mob ? 9.5 : 10.5}px ${MONO}`; g.textAlign = 'left';
    const lab = `${locked != null ? '锁定 ' : ''}${f1(isoD)} J/cm²`;
    const lp = clamp(cur.p + (cur.p > 1.2 ? -0.26 : 0.1), 0.7, 1.45), llv = (4 * isoD / lp - 15) / 20;
    if (llv > 0.4 && llv < 8.1) {
      const lx = X(lp), ly = Y(llv) - 10, tw = g.measureText(lab).width + 10;
      g.fillStyle = 'rgba(7,7,12,0.8)'; g.fillRect(lx - 2, ly - 11, tw, 16);
      g.fillStyle = '#fff'; g.fillText(lab, lx + 3, ly + 1);
    }
  }
  function ring(pt, col, a, label) {
    const x = X(pt.p), y = Y(pt.lv);
    g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([3, 3]);
    g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    g.font = `500 10.5px ${SANS}`; g.fillStyle = col; g.textAlign = 'right'; g.fillText(label, x - 14, y + 4);
  }
  function drawSeg(s) {
    const ax = X(s.a.p), ay = Y(s.a.lv), bx = X(s.b.p), by = Y(s.b.lv);
    const k = s.k;
    if (k <= 0) return;
    const ex = ax + (bx - ax) * k, ey = ay + (by - ay) * k;
    const col = s.kind === 'try' ? '#f0603f' : s.kind === 'back' ? 'rgba(240,96,63,0.45)' : s.kind === 'alt' ? 'rgba(67,230,168,0.6)' : '#43e6a8';
    const off = s.kind === 'back' ? 7 : 0;
    g.strokeStyle = col; g.lineWidth = s.kind === 'ok' ? 2.4 : 1.8;
    g.setLineDash(s.kind === 'ok' ? [] : [5, 4]);
    g.beginPath(); g.moveTo(ax + off, ay); g.lineTo(ex + off, ey); g.stroke(); g.setLineDash([]);
    if (k > 0.2) {
      const ang = Math.atan2(ey - ay, ex - ax);
      g.fillStyle = col; g.beginPath();
      g.moveTo(ex + off, ey); g.lineTo(ex + off - 8 * Math.cos(ang - 0.45), ey - 8 * Math.sin(ang - 0.45)); g.lineTo(ex + off - 8 * Math.cos(ang + 0.45), ey - 8 * Math.sin(ang + 0.45)); g.fill();
    }
    if (s.kind === 'try' && k >= 1) {
      g.font = `600 11px ${SANS}`; g.textAlign = 'left'; g.fillStyle = '#f0603f';
      g.fillText('疼痛', bx + 13, by + 4);
    }
  }
  const hexA = (hex, a) => { const [r, gg, b] = lib.hexToRgb(hex); return `rgba(${r},${gg},${b},${a})`; };

  /* ---------- rectangle + readouts ---------- */
  const rc = q('.pl-rect__cur'), rg = q('.pl-rect__ghost'), rsl = q('.pl-rect__sl'), rlab = q('.pl-rect__lab');
  const RX = (s) => 44 + s * 200, RH = (w) => (w / 180) * 130;
  const dLv = q('.pl-d-lv'), dW = q('.pl-d-w'), dP = q('.pl-d-p'), dN = q('.pl-d-n'), dD = q('.pl-d-d'), dBand = q('.pl-d-band'), dC = q('.pl-d-c'), dCr = q('.pl-d-cr');
  const fp = q('.pl-fr-p'), fv = q('.pl-fv-p');
  function readouts() {
    const lv = snapLv(cur.lv), p = snapP(cur.p);
    const Pw = 15 + 20 * cur.lv;
    rc.setAttribute('width', Math.max(0, RX(cur.p) - 44).toFixed(1));
    rc.setAttribute('height', RH(Pw).toFixed(1)); rc.setAttribute('y', (154 - RH(Pw)).toFixed(1));
    if (prev) {
      const pw = lib.levelPower(prev.lv);
      rg.setAttribute('width', Math.max(0, RX(prev.p) - 44).toFixed(1)); rg.setAttribute('height', RH(pw).toFixed(1)); rg.setAttribute('y', (154 - RH(pw)).toFixed(1));
      rg.style.opacity = '1';
    } else rg.style.opacity = '0';
    const n = Math.round(p * 10);
    let sl = '';
    for (let i = 1; i < Math.round(cur.p * 10 + 0.49); i++) { const x = RX(i * 0.1); if (x < RX(cur.p) - 2) sl += `<line x1="${x}" x2="${x}" y1="${154 - RH(Pw) + 3}" y2="151"/>`; }
    rsl.innerHTML = sl;
    const E = Math.round(lib.levelPower(lv) * p);
    rlab.textContent = `${lib.levelPower(lv)} W × ${p.toFixed(1)} s = ${E} J`;
    const topW = prev ? Math.max(Pw, lib.levelPower(prev.lv)) : Pw;
    rlab.setAttribute('y', Math.max(14, 154 - RH(topW) - 8).toFixed(1));
    const ok = lib.isAllowed(lv, p);
    const d = lib.density(lv, p), band = lib.bandOf(d);
    dLv.textContent = lv.toFixed(1); dW.textContent = `${lib.levelPower(lv)} W`;
    dP.textContent = p.toFixed(1); dN.textContent = `s · ${n} 个脉冲`;
    dD.textContent = ok ? d.toFixed(1) : '—'; dD.style.color = ok ? band.hex : '';
    dBand.style.color = ok ? band.hex : 'var(--text-3)'; dBand.querySelector('em').textContent = ok ? band.label : '限制';
    dC.textContent = ok ? band.coolDefault : '—';
    dCr.textContent = ok ? `可选 ${band.coolRange[0]}–${band.coolRange[band.coolRange.length - 1]}` : '';
    fp.value = p; fv.textContent = p.toFixed(1) + ' s'; fp.style.setProperty('--p', ((p - 0.7) / 0.8) * 100 + '%');
  }
  const render = () => { draw(); readouts(); };

  /* ---------- feedback gauge + face ---------- */
  const needle = q('.pl-fb__needle'), target = q('.pl-fb__target');
  target.style.bottom = (2 / 5) * 100 + '%'; target.style.height = (1 / 5) * 100 + '%';
  const drawFb = () => {
    needle.style.bottom = (clamp(fb.v, 0, 5) / 5) * 100 + '%';
    const inT = fb.v >= 2 && fb.v <= 3;
    needle.classList.toggle('is-ok', inT); needle.classList.toggle('is-hot', fb.v > 3.2);
  };
  const auxFb = q('[data-aux="fb"]'), auxFace = q('[data-aux="face"]');
  const setAux = (k) => { auxFb.hidden = k !== 'fb'; auxFace.hidden = k !== 'face'; };
  const zones = (on) => qa('.pl-zone').forEach((z, i) => {
    z.classList.toggle('is-on', on);
    z.style.transitionDelay = on ? `${i * 0.12}s` : '0s';
  });

  /* ---------- scenario player ---------- */
  const scnBtns = qa('.pl-scn__b'), seq = q('.pl-seq'), qt = q('.pl-quote__t'), qs = q('.pl-quote__s');
  let items = [];
  function play(i) {
    tl?.kill(); moveTw?.kill(); locked = null; lockBtn.setAttribute('aria-pressed', 'false'); lockBtn.textContent = '锁定能量密度';
    const sc = SCN[i];
    scnBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    qt.textContent = '“' + sc.quote + '”'; qs.textContent = '— ' + sc.src;
    seq.innerHTML = sc.steps.map((s) => `<li>${s.t}</li>`).join('');
    items = [...seq.children];
    trail.length = 0; alt = null; altK = 0; prev = null; zones(false); setAux(sc.aux); auxFb.classList.remove('is-idle');
    cur.lv = sc.start.lv; cur.p = sc.start.p; fb.v = sc.fb ?? 0; drawFb(); render();
    const act = (k) => items.forEach((li, j) => { li.classList.toggle('is-on', j === k); li.classList.toggle('is-done', j < k); });
    tl = gsap.timeline({ delay: DUR(0.4) });
    let pos = { ...sc.start };
    sc.steps.forEach((st, k) => {
      tl.call(() => act(k));
      if (st.zone) tl.call(() => zones(true));
      if (st.to) {
        const seg = { a: { ...pos }, b: { ...st.to }, kind: st.kind, k: 0 };
        const from = { ...pos };
        const to = { ...st.to };
        tl.call(() => { if (!trail.includes(seg)) trail.push(seg); prev = { lv: from.lv, p: from.p }; });
        // one tween drives both the moving dot and the arrow so the final frame is never stale
        const step = () => { cur.lv = from.lv + (to.lv - from.lv) * seg.k; cur.p = from.p + (to.p - from.p) * seg.k; render(); };
        tl.to(seg, { k: 1, duration: DUR(1.1), ease: 'power3.inOut', onUpdate: step, onComplete: step }, '>');
        pos = { ...st.to };
      }
      if (st.fb != null) tl.to(fb, { v: st.fb, duration: DUR(0.8), ease: 'power2.out', onUpdate: drawFb }, st.to ? `<${DUR(0.4)}` : '>');
      if (st.alt) {
        tl.call(() => { alt = st.alt; });
        const ak = { v: 0 };
        tl.to(ak, { v: 1, duration: DUR(1), ease: 'power3.inOut', onUpdate() { altK = ak.v; draw(); }, onComplete() { altK = 1; draw(); } });
      }
      tl.to({}, { duration: DUR(st.hold ?? 1.5) });
      if (st.done) tl.call(() => items.forEach((li) => li.classList.add('is-done')));
    });
    tl.call(() => { items.forEach((li) => li.classList.remove('is-on')); items[items.length - 1]?.classList.add('is-on'); });
  }
  scnBtns.forEach((b) => b.addEventListener('click', () => { started = true; play(+b.dataset.i); }));

  /* ---------- free play ---------- */
  const lockBtn = q('.pl-lock');
  const stopScn = () => {
    started = true; // user took over before the autoplay fired
    if (tl) { tl.kill(); tl = null; }
    scnBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    trail.length = 0; alt = null; altK = 0; zones(false);
    items.forEach((li) => li.classList.remove('is-on'));
    auxFb.classList.add('is-idle'); // patient feedback is scenario-only; dim it during free play
  };
  let moveTw = null;
  const moveTo = (lv, p) => {
    if (!lib.isAllowed(lv, p)) { flash(`${lv.toFixed(1)} 档 × ${p.toFixed(1)} s 为限制输出区（能量输出表空白格）`); return false; }
    prev = { lv: snapLv(cur.lv), p: snapP(cur.p) };
    moveTw?.kill();
    moveTw = gsap.to(cur, { lv, p, duration: DUR(0.55), ease: 'power3.out', onUpdate: render });
    return true;
  };
  let msgT = 0;
  const flash = (t) => { msg.textContent = t; msg.classList.add('is-on'); clearTimeout(msgT); msgT = setTimeout(() => msg.classList.remove('is-on'), 2400); };
  lockBtn.addEventListener('click', () => {
    stopScn();
    const on = locked == null;
    locked = on ? lib.density(snapLv(cur.lv), snapP(cur.p)) : null;
    lockBtn.setAttribute('aria-pressed', String(on));
    lockBtn.textContent = on ? `已锁定 ${locked.toFixed(1)} J/cm²` : '锁定能量密度';
    draw();
  });
  fp.addEventListener('input', () => {
    stopScn();
    const p = snapP(+fp.value);
    if (locked != null) {
      let best = null, bd = 1e9;
      for (const lv of lib.LEVELS) {
        if (!lib.isAllowed(lv, p)) continue;
        const dd = Math.abs(lib.density(lv, p) - locked);
        if (dd < bd - 1e-9) { bd = dd; best = lv; }
      }
      if (best != null) moveTo(best, p);
    } else if (!moveTo(snapLv(cur.lv), p)) readouts();
  });
  const ptPos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const { x, y } = ptPos(e);
    if (x < L.x0 || x > L.x1 || y < L.y0 || y > L.y1) { if (hover) { hover = null; draw(); } return; }
    const h = { lv: snapLv(iY(y)), p: snapP(iX(x)) };
    if (!hover || h.lv !== hover.lv || h.p !== hover.p) { hover = h; draw(); }
  });
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  cv.addEventListener('click', (e) => {
    const { x, y } = ptPos(e);
    if (x < L.x0 - 6 || x > L.x1 + 6 || y < L.y0 - 6 || y > L.y1 + 6) return;
    stopScn();
    const lv = snapLv(iY(y)), p = snapP(iX(x));
    if (locked != null) { locked = null; lockBtn.setAttribute('aria-pressed', 'false'); lockBtn.textContent = '锁定能量密度'; }
    moveTo(lv, p);
  });
  cv.addEventListener('keydown', (e) => {
    const k = e.key;
    let lv = snapLv(cur.lv), p = snapP(cur.p);
    if (k === 'ArrowUp') lv += 0.5; else if (k === 'ArrowDown') lv -= 0.5;
    else if (k === 'ArrowRight') p += 0.1; else if (k === 'ArrowLeft') p -= 0.1; else return;
    e.preventDefault(); stopScn();
    moveTo(snapLv(lv), snapP(p));
  });

  let started = false;
  layout();
  play(0);
  tl.pause(0);
  lib.whenVisible(q('.pl-dyn__grid'), () => { if (!started) { started = true; tl?.play(); } }, null, '-20% 0px');
  lib.onResize(() => { layout(); draw(); });
  document.fonts?.ready.then(() => draw());
}
