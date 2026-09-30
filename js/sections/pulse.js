// #pulse — 闪脉冲技术 + 动态脉冲技术
// src: DA p.2（核心技术 01/02 原文）· IFU p.9（脉冲时间 0.7–1.5 s，一个脉冲对应 0.1 秒）
//      IFU p.15（“启动”三阶段：治疗前冷却 → 射频传送 → 治疗后冷却；制冷档位随能量水平自动匹配）
//      IFU p.4（皮下组织较薄部位：颧骨、下颌、颞部、前额需减低能量；不可用于眼部）
//      IFU p.21–22（升档疼痛且能量密度过低 → 增加脉冲时间；舒适范围内可升档；最低增量；热感反馈 2.0–3.0）
// Everything thermal on this page is a schematic model (原理示意) — no tissue temperatures are claimed.

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
    const slices = Array.from({ length: 10 }, (_, i) => `
      <g class="pl-slice">
        <rect x="${300 + i * 60 + 2}" y="84" width="56" height="152" rx="10" fill="url(#plRFv)"/>
        <path d="${sinePath(300 + i * 60 + 8, 160, 44, 44, 3.5)}" class="pl-carrier"/>
        <text x="${330 + i * 60}" y="110" class="pl-sn">${i + 1}</text>
        <text x="${330 + i * 60}" y="296" class="pl-sl">100ms</text>
      </g>`).join('');
    const frost = (x0) => Array.from({ length: 12 }, (_, i) => `<circle class="pl-frost" cx="${x0 + 14 + ((i * 37) % 136)}" cy="${128 + ((i * 23) % 64)}" r="${1.4 + (i % 3) * 0.8}" style="animation-delay:${(-i * 0.37).toFixed(2)}s"/>`).join('');
    const ticks = Array.from({ length: 11 }, (_, i) => `<line x1="${300 + i * 60}" x2="${300 + i * 60}" y1="262" y2="${i % 5 === 0 ? 274 : 269}"/>`).join('');

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
          <div class="pl-bigtype num" aria-hidden="true">100<small>ms</small></div>
          <svg class="pl-ribbon" viewBox="0 0 1200 320" role="img" aria-label="一发治疗示意：治疗前冷却，随后 1.0 秒射频被切分为 10 个 100 毫秒窄脉冲，之后为治疗后冷却">
            <defs>
              <linearGradient id="plRF" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#6a3fd0"/><stop offset=".55" stop-color="#8a5cf0"/><stop offset="1" stop-color="#43e6a8"/></linearGradient>
              <linearGradient id="plRFv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b79bff"/><stop offset=".45" stop-color="#8a5cf0"/><stop offset="1" stop-color="#3b1f6e"/></linearGradient>
              <linearGradient id="plCool" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7fd4ff" stop-opacity=".85"/><stop offset="1" stop-color="#7fd4ff" stop-opacity=".12"/></linearGradient>
              <linearGradient id="plScan" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
              <clipPath id="plClip"><rect x="296" y="80" width="608" height="160" rx="12"/></clipPath>
            </defs>
            <line class="pl-axis" x1="60" x2="1140" y1="262" y2="262"/>
            <g class="pl-ticks">${ticks}</g>
            <text class="pl-tl" x="300" y="296" text-anchor="middle">0</text>
            <text class="pl-tl" x="900" y="296" text-anchor="middle">1.0 s</text>
            <g class="pl-br">
              <path d="M300 60 V50 H900 V60" class="pl-brk"/>
              <text x="600" y="36" text-anchor="middle" class="pl-br-a">脉冲时间 1.0 s</text>
              <text x="600" y="36" text-anchor="middle" class="pl-br-b">10 × 100 ms</text>
            </g>
            <g class="pl-coolg">
              <rect x="96" y="112" width="164" height="96" rx="14" fill="url(#plCool)"/>
              ${frost(96)}
              <text x="178" y="96" text-anchor="middle" class="pl-ph">治疗前冷却</text>
            </g>
            <g class="pl-coolg">
              <rect x="940" y="112" width="164" height="96" rx="14" fill="url(#plCool)"/>
              ${frost(940)}
              <text x="1022" y="96" text-anchor="middle" class="pl-ph">治疗后冷却</text>
            </g>
            <path class="pl-arrow" d="M265 160 h17 m-6 -6 l6 6 l-6 6"/>
            <path class="pl-arrow" d="M918 160 h17 m-6 -6 l6 6 l-6 6"/>
            <g class="pl-block">
              <rect x="300" y="80" width="600" height="160" rx="16" fill="url(#plRF)"/>
              <path d="${sinePath(312, 160, 576, 52, 30)}" class="pl-carrier"/>
              <text x="600" y="168" text-anchor="middle" class="pl-bt">射频传送 · 1 发</text>
            </g>
            <g class="pl-slices">${slices}</g>
            <rect class="pl-scan" x="280" y="80" width="80" height="160" fill="url(#plScan)" clip-path="url(#plClip)"/>
          </svg>
        </div>
        <p class="note pl-story__note">来源：使用说明书 第 9 页（脉冲时间 0.7–1.5 s，一个脉冲对应 0.1 秒）、第 15 页（“启动”模式三阶段）。冷却阶段宽度为示意。</p>
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

    setupStory(root.querySelector('.pl-story'), ctx);
    setupScope(root.querySelector('.pl-scope'), ctx);
    setupDyn(root.querySelector('.pl-dyn'), ctx);
  },
};

/* ---------- helpers ---------- */
function sinePath(x, yc, w, a, cycles) {
  const n = Math.max(12, Math.round(cycles * 12));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.min(1, t * 8, (1 - t) * 8);
    d += (i ? 'L' : 'M') + (x + t * w).toFixed(1) + ' ' + (yc - Math.sin(t * cycles * Math.PI * 2) * a * env).toFixed(1);
  }
  return d;
}

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
   1 · pinned story: 1 发 → 10 × 100 ms → 冷却/射频/冷却
   ========================================================= */
function setupStory(el, ctx) {
  const { gsap, ScrollTrigger } = ctx;
  const q = (s) => el.querySelector(s), qa = (s) => [...el.querySelectorAll(s)];
  const steps = qa('.pl-steps li');
  const setStep = (i) => steps.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.classList.toggle('is-past', k < i); });
  const block = q('.pl-block'), slices = qa('.pl-slice'), cools = qa('.pl-coolg'), arrows = qa('.pl-arrow');
  const sliceRects = slices.map((s) => s.querySelector('rect')), sliceWaves = slices.map((s) => s.querySelector('path'));
  const tls = qa('.pl-tl');
  const big = q('.pl-bigtype'), la = q('.pl-br-a'), lb = q('.pl-br-b'), scan = q('.pl-scan');

  const build = () => {
    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: 'power2.inOut' },
      onUpdate() {
        const t = tl.time();
        setStep(t < 1.15 ? 0 : t < 3.05 ? 1 : 2);
        const bar = steps.map((s) => s.querySelector('i'));
        bar[0].style.transform = `scaleX(${clamp(t / 1.15, 0, 1)})`;
        bar[1].style.transform = `scaleX(${clamp((t - 1.15) / 1.9, 0, 1)})`;
        bar[2].style.transform = `scaleX(${clamp((t - 3.05) / 1.0, 0, 1)})`;
      },
    });
    gsap.set(slices, { opacity: 0 });
    gsap.set(cools, { opacity: 0 });
    gsap.set(arrows, { opacity: 0 });
    gsap.set(lb, { opacity: 0 });
    gsap.set(scan, { opacity: 0 });
    tl.to({}, { duration: 0.7 })
      .fromTo(big, { opacity: 0.25, scale: 0.94 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out' }, 0.6)
      .to(slices, { opacity: 1, duration: 0.3, stagger: 0.06 }, 0.8)
      .to(block, { opacity: 0, duration: 0.5 }, 1.1)
      .to(sliceRects, { attr: { x: (i) => 300 + i * 60 + 7, width: 46 }, duration: 0.9, ease: 'expo.out' }, 1.35)
      .to(sliceWaves, { scaleX: 0.8, transformOrigin: '50% 50%', duration: 0.9, ease: 'expo.out' }, 1.35)
      .to(tls, { opacity: 0, duration: 0.3 }, 1.0)
      .to(la, { opacity: 0, duration: 0.25 }, 1.2)
      .to(lb, { opacity: 1, duration: 0.3 }, 1.4)
      .fromTo(scan, { attr: { x: 250 }, opacity: 0 }, { attr: { x: 880 }, opacity: 1, duration: 1.2, ease: 'none' }, 1.9)
      .to(scan, { opacity: 0, duration: 0.2 }, 2.95)
      .fromTo(cools[0], { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.9, ease: 'expo.out' }, 3.1)
      .fromTo(cools[1], { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.9, ease: 'expo.out' }, 3.25)
      .to(arrows, { opacity: 1, duration: 0.4, stagger: 0.12 }, 3.5)
      .to({}, { duration: 0.8 });
    return tl;
  };

  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 760px)', mob: '(max-width: 759px)' }, (c) => {
    el.querySelector('.pl-ribbon').setAttribute('viewBox', c.conditions.mob ? '80 22 1040 292' : '0 0 1200 320');
    const tl = build();
    if (ctx.reduced) { tl.progress(1); return; }
    if (c.conditions.desk) {
      ScrollTrigger.create({ trigger: el, start: 'top top', end: '+=150%', pin: true, pinSpacing: true, scrub: 0.7, animation: tl });
    } else {
      tl.timeScale(1.25);
      ScrollTrigger.create({ trigger: el, start: 'top 72%', once: true, onEnter: () => tl.play() });
    }
    return () => tl.kill();
  });
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
  rP.addEventListener('input', () => { S.p = Math.round(+rP.value * 10) / 10; onParam(true); });
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
