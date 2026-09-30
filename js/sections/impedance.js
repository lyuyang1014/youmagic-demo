// #impedance — AI 能量匹配技术
// src: DA p.2 (标题与原文“AI 智能匹配阻抗网络，补偿能量输出更精准有效”)
//      IFU p.5  输出功率误差不大于设定值的 ±20%
//      IFU p.7  治疗仪持续监测输出功率、输出能量、脉冲时间和阻抗测量值
//      IFU p.25 E603 阻抗异常 · 请检查回路是否良好连接
//      IFU p.30 射频能量 6.78 MHz ± 3%；阻抗测量 75–350 Ω ± 20%
//      IFU p.31 额定负载 100–250 Ω；图12 负载与功率关系（data.loadCurve）
//      IFU p.32 图13 能量设置与功率关系（0.5 → 25 W … 8 → 175 W，每 0.5 档 +10 W）

const C = { mint: '#43e6a8', violet: '#8a5cf0', lilac: '#b79bff', warn: '#f0603f', text: '#eceaf4', t2: '#a9a6ba', t3: '#6f6c82', line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.16)' };
const R_REF = 150;           // 对比示意：恒压输出在 150 Ω 时与设定功率相等（假设）
const PERIOD = 1.35;         // s per simulated shot (slowed for readability)
const RF_ON = [0.16, 0.66];  // fraction of the shot cycle with RF on (pre-cool → RF → post-cool)
const TAU = Math.PI * 2;
const onceVisible = (el, fn, threshold = 0.2) => { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold }); io.observe(el); };
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const withA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const mono = (s) => `${s}px "JetBrains Mono", ui-monospace, monospace`;
const sans = (s, w = 400) => `${w} ${s}px "Noto Sans SC", "PingFang SC", system-ui, sans-serif`;

export default {
  id: 'impedance',
  nav: 'AI 能量匹配',
  async init(root, ctx) {
    const { gsap, lib, data, reduced } = ctx;
    const LC = data.loadCurve;
    const PSET = { full: 175, half: 95 };
    const S = { mode: 'full', cmp: false, playing: !reduced, R: 162, cursor: 180, shot: 0, lv: 12 };
    const fullAt = (r) => interp(LC.load, LC.full, r);
    const halfAt = (r) => interp(LC.load, LC.half, r);
    const matchedAt = (r) => (S.mode === 'full' ? fullAt(r) : halfAt(r));
    const cvAt = (r) => (PSET[S.mode] * R_REF) / r; // P = V²/R with V² = Pset·R_REF

    root.innerHTML = `
      <div class="wrap imp">
        <header class="sec-head">
          <span class="eyebrow" data-reveal>07 · AI ENERGY MATCHING</span>
          <h2 class="h1" data-reveal>AI 能量匹配技术</h2>
          <p class="lead" data-reveal><em class="imp-em">AI 智能匹配阻抗网络</em>，补偿能量输出更精准有效。</p>
          <p class="imp-sub" data-reveal>治疗仪持续监测<b>输出功率</b>、<b>输出能量</b>、<b>脉冲时间</b>和<b>阻抗测量值</b>。在额定负载 100–250 Ω 范围内，全功率输出保持在 175 W。<span class="tag-src">说明书 第 7、31 页</span></p>
        </header>

        <div class="imp-bar" data-reveal>
          <div class="seg" role="group" aria-label="功率模式（图12 两条曲线）">
            <button type="button" data-mode="full" aria-pressed="true">全功率 175 W</button>
            <button type="button" data-mode="half" aria-pressed="false">半功率 95 W</button>
          </div>
          <button type="button" class="btn imp-cmp" aria-pressed="false"><i class="imp-cmp__sw" aria-hidden="true"></i>对比：未匹配 恒压输出<span class="imp-tag">原理示意</span></button>
          <button type="button" class="btn imp-play" aria-pressed="${S.playing}"><span class="imp-play__i" aria-hidden="true"></span><span class="imp-play__t">${S.playing ? '暂停' : '播放'}</span></button>
          <span class="imp-count mono" aria-live="off">SHOT <b>000</b></span>
        </div>

        <div class="imp-main">
          <div class="imp-live card" data-reveal>
            <div class="imp-live__head"><span class="imp-dot" aria-hidden="true"></span>实时匹配演示<span class="imp-tag">原理示意</span></div>
            <div class="imp-live__grid">
              <div class="imp-io imp-io--in">
                <div class="imp-k">组织阻抗 · 本发</div>
                <div class="imp-big num"><span data-r>—</span><small>Ω</small></div>
                <div class="imp-tissue"><canvas aria-hidden="true"></canvas></div>
                <span class="micro imp-tissue__cap">每一发接触的组织状态不同（示意）</span>
                <div class="imp-meter" aria-hidden="true">
                  <div class="imp-meter__band"></div><div class="imp-meter__mk"></div>
                  <span class="imp-meter__l mono">75</span><span class="imp-meter__m mono">100–250 Ω</span><span class="imp-meter__r mono">350</span>
                </div>
              </div>
              <div class="imp-net" aria-hidden="true">
                <svg viewBox="0 0 80 200" class="imp-net__svg"></svg>
                <span class="micro">AI 匹配<br>阻抗网络</span>
              </div>
              <div class="imp-io imp-io--out">
                <div class="imp-k">输出功率 · 设定 <b data-set>175</b> W</div>
                <div class="imp-big num imp-big--out"><span data-w>175</span><small>W</small></div>
                <div class="imp-gauge"><canvas aria-hidden="true"></canvas></div>
                <div class="imp-lock"><span class="imp-lock__i" aria-hidden="true"></span><span>输出稳定于设定功率</span></div>
                <div class="imp-ghost"><i aria-hidden="true"></i>未匹配 恒压（示意）：<b data-g>—</b> W</div>
              </div>
            </div>
            <div class="imp-scope">
              <canvas aria-hidden="true"></canvas>
              <div class="imp-scope__lg legend">
                <span><i style="background:${C.lilac}"></i>阻抗 Ω（逐发变化）</span>
                <span><i style="background:${C.mint}"></i>输出功率 W（射频脉冲）</span>
                <span class="imp-lg-cmp"><i style="background:${C.warn}"></i>未匹配 恒压（示意）</span>
              </div>
            </div>
          </div>

          <figure class="imp-chart card" data-reveal>
            <figcaption class="imp-chart__cap">
              <span class="imp-chart__t">负载与功率关系</span>
              <span class="tag-src">说明书 第 31 页 图12</span>
            </figcaption>
            <svg class="imp-svg viz" viewBox="0 0 600 404" role="img" aria-label="负载与功率关系图：全功率在 100–250 Ω 保持 175 W，75 Ω 为 140 W，300 Ω 为 150 W，350 Ω 为 130 W；半功率在 75–350 Ω 保持 95 W。"></svg>
            <div class="imp-read" aria-live="polite">
              <div class="imp-read__i"><span class="imp-read__k">负载</span><span class="imp-read__v num" data-c="r">180</span><span class="imp-read__u">Ω</span><span class="imp-read__s" data-c="rs"></span></div>
              <div class="imp-read__i"><span class="imp-read__k"><i class="sw sw--full"></i>全功率</span><span class="imp-read__v num" data-c="f">175</span><span class="imp-read__u">W</span></div>
              <div class="imp-read__i"><span class="imp-read__k"><i class="sw sw--half"></i>半功率</span><span class="imp-read__v num" data-c="h">95</span><span class="imp-read__u">W</span></div>
              <div class="imp-read__i imp-read__i--cmp"><span class="imp-read__k"><i class="sw sw--cmp"></i>恒压（示意）</span><span class="imp-read__v num" data-c="g">—</span><span class="imp-read__u">W</span></div>
            </div>
            <p class="micro imp-hint">拖动游标（或聚焦后用 ← →）查看任意负载下的输出功率；数据点之间为线性连接，“≈” 表示插值读数。</p>
          </figure>
        </div>

        <div class="imp-row2">
          <figure class="imp-lv card" data-reveal>
            <figcaption class="imp-chart__cap">
              <span class="imp-chart__t">能量设置与功率关系</span>
              <span class="tag-src">说明书 第 32 页 图13</span>
            </figcaption>
            <div class="imp-lv__read" aria-live="polite">
              <div><span class="imp-read__k">能量强度</span><span class="imp-lv__big num" data-l="lv">6.0</span></div>
              <div class="imp-lv__arrow" aria-hidden="true">→</div>
              <div><span class="imp-read__k">输出功率</span><span class="imp-lv__big num" data-l="w">135</span><span class="imp-read__u">W</span></div>
              <div class="imp-lv__step"><span class="mono">+10 W</span><span class="micro">每 0.5 档</span></div>
            </div>
            <svg class="imp-lvsvg viz" viewBox="0 0 640 300" role="img" aria-label="能量强度 0.5 至 8，输出功率 25 W 至 175 W，线性，每 0.5 档增加 10 W"></svg>
            <label class="imp-scrub">
              <span class="visually-hidden">能量强度</span>
              <input class="range" type="range" min="0" max="15" step="1" value="${S.lv - 1}" aria-label="能量强度" />
            </label>
          </figure>

          <div class="imp-specs">
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">6.78<small>MHz</small></div><div class="imp-spec__k">射频频率 ± 3%</div><span class="tag-src">说明书 第 30 页</span></div>
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">75–350<small>Ω</small></div><div class="imp-spec__k">阻抗测量范围 ± 20%</div><span class="tag-src">说明书 第 30 页</span></div>
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">100–250<small>Ω</small></div><div class="imp-spec__k">各输出模式额定负载范围</div><span class="tag-src">说明书 第 31 页</span></div>
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">≤ ±20<small>%</small></div><div class="imp-spec__k">输出功率误差（相对设定值）</div><span class="tag-src">说明书 第 5 页</span></div>
            <div class="imp-spec imp-spec--wide imp-why card" data-reveal>
              <div class="imp-spec__k">为什么要做阻抗匹配？<span class="imp-tag">原理示意</span></div>
              <p>不同部位、皮肤含水量与接触状态都会让组织阻抗逐发变化。若输出电压保持不变，输出功率将按 <span class="mono">P = V² / R</span> 随阻抗起伏；说明书图12 显示，在额定负载 100–250 Ω 内，全功率输出保持在 175 W。</p>
            </div>
            <div class="imp-spec imp-spec--wide card" data-reveal>
              <div class="imp-spec__k">持续监测</div>
              <ul class="imp-mon">${['输出功率', '输出能量', '脉冲时间', '阻抗测量值'].map((x) => `<li><i aria-hidden="true"></i>${x}</li>`).join('')}</ul>
              <p class="micro">阻抗异常时触摸屏显示故障代码 <b class="mono">E603</b>（请检查回路是否良好连接）。<span class="tag-src">说明书 第 7、25 页</span></p>
            </div>
          </div>
        </div>

        <p class="note">图12、图13 曲线数值取自使用说明书；“未匹配 恒压输出”曲线按 P = V² / R 绘制（假设 150 Ω 时与设定功率相等），仅用于对比说明阻抗补偿的意义，并非任何实际设备数据。实时演示中的阻抗数值为随机生成的原理示意。</p>
        <p class="disclaimer">${data.disclaimers.sim}</p>
      </div>`;

    const $ = (s) => root.querySelector(s);
    const el = {
      r: $('[data-r]'), w: $('[data-w]'), set: $('[data-set]'), g: $('[data-g]'), count: $('.imp-count b'),
      meterMk: $('.imp-meter__mk'), live: $('.imp-live'), ghost: $('.imp-ghost'),
      seg: [...root.querySelectorAll('.imp-bar .seg button')], cmp: $('.imp-cmp'), play: $('.imp-play'),
      rd: { r: $('[data-c="r"]'), rs: $('[data-c="rs"]'), f: $('[data-c="f"]'), h: $('[data-c="h"]'), g: $('[data-c="g"]') },
    };

    /* =============== 图12 chart =============== */
    const svgEl = $('.imp-svg');
    const G = { l: 46, r: 18, t: 30, b: 64, W: 600, H: 404, x0: 58, x1: 367, yMax: 225 };
    const X = (r) => G.l + ((r - G.x0) / (G.x1 - G.x0)) * (G.W - G.l - G.r);
    const Y = (p) => G.H - G.b - (p / G.yMax) * (G.H - G.t - G.b);
    const Rof = (x) => G.x0 + ((x - G.l) / (G.W - G.l - G.r)) * (G.x1 - G.x0);
    const S_ = (tag, a, p) => lib.svg(tag, a, p);
    (function buildChart() {
      const defs = S_('defs', {}, svgEl);
      defs.innerHTML = `
        <clipPath id="imp-clip"><rect x="${G.l}" y="${G.t - 6}" width="${G.W - G.l - G.r}" height="${G.H - G.t - G.b + 6}"/></clipPath>
        <linearGradient id="imp-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.mint}" stop-opacity=".10"/><stop offset="1" stop-color="${C.mint}" stop-opacity=".02"/></linearGradient>
        <filter id="imp-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
      const gGrid = S_('g', { class: 'axis' }, svgEl);
      for (let p = 0; p <= 200; p += 25) {
        S_('line', { x1: G.l, x2: G.W - G.r, y1: Y(p), y2: Y(p), class: p % 50 ? 'gridline gridline--minor' : 'gridline' }, gGrid);
        if (p % 50 === 0) S_('text', { x: G.l - 8, y: Y(p) + 4, 'text-anchor': 'end' }, gGrid).textContent = p;
      }
      LC.load.forEach((r) => {
        S_('line', { x1: X(r), x2: X(r), y1: G.H - G.b, y2: G.H - G.b + 5, stroke: 'rgba(255,255,255,.25)' }, gGrid);
        S_('text', { x: X(r), y: G.H - G.b + 20, 'text-anchor': 'middle' }, gGrid).textContent = r;
      });
      S_('line', { x1: G.l, x2: G.W - G.r, y1: Y(0), y2: Y(0), stroke: 'rgba(255,255,255,.25)' }, gGrid);
      S_('text', { x: G.l - 8, y: G.t - 14, 'text-anchor': 'start', class: 'imp-axlab' }, gGrid).textContent = '输出功率 (W)';
      S_('text', { x: G.W - G.r + 2, y: G.H - G.b + 20, 'text-anchor': 'start', class: 'imp-axlab' }, gGrid).textContent = 'Ω';
      // rated load band
      S_('rect', { x: X(100), y: G.t - 6, width: X(250) - X(100), height: Y(0) - G.t + 6, fill: 'url(#imp-band)', class: 'imp-band' }, svgEl);
      S_('line', { x1: X(100), x2: X(100), y1: G.t - 6, y2: Y(0), class: 'imp-band-edge' }, svgEl);
      S_('line', { x1: X(250), x2: X(250), y1: G.t - 6, y2: Y(0), class: 'imp-band-edge' }, svgEl);
      S_('text', { x: (X(100) + X(250)) / 2, y: G.t + 10, 'text-anchor': 'middle', class: 'imp-band-t' }, svgEl).textContent = '额定负载 100–250 Ω';
      // measurement range bracket
      const by = G.H - 20;
      S_('path', { d: `M${X(75)} ${by - 5}V${by}H${X(350)}V${by - 5}`, class: 'imp-bracket' }, svgEl);
      S_('text', { x: (X(75) + X(350)) / 2, y: by + 16, 'text-anchor': 'middle', class: 'imp-bracket-t' }, svgEl).textContent = '阻抗测量范围 75–350 Ω ± 20%';
    })();

    const gCurves = S_('g', { 'clip-path': 'url(#imp-clip)' }, svgEl);
    const pts = (arr) => LC.load.map((r, i) => `${X(r)},${Y(arr[i])}`).join(' ');
    // comparison curve (P = V²/R)
    const cmpPath = S_('path', { class: 'imp-c imp-c--cmp', d: '' }, gCurves);
    const half = S_('polyline', { class: 'imp-c imp-c--half', points: pts(LC.half) }, gCurves);
    const full = S_('polyline', { class: 'imp-c imp-c--full', points: pts(LC.full) }, gCurves);
    const dotsG = S_('g', {}, svgEl);
    const mkDots = (arr, cls) => LC.load.map((r, i) => S_('circle', { cx: X(r), cy: Y(arr[i]), r: 4.2, class: `imp-pt ${cls}` }, dotsG));
    const fullDots = mkDots(LC.full, 'imp-pt--full');
    const halfDots = mkDots(LC.half, 'imp-pt--half');
    const valLabels = S_('g', { class: 'imp-vlab' }, svgEl);
    LC.load.forEach((r, i) => {
      const first = i === 0; // 75 Ω: label above-left so the rising segment to 100 Ω doesn't run through it
      S_('text', { x: X(r) + (first ? 4 : 0), y: Y(LC.full[i]) - (first ? 10 : 12), 'text-anchor': first ? 'end' : 'middle', class: 'imp-vl imp-vl--full' }, valLabels).textContent = LC.full[i];
    });
    S_('text', { x: X(350) + 6, y: Y(95) - 10, 'text-anchor': 'end', class: 'imp-vl imp-vl--half' }, valLabels).textContent = '95';
    const cmpLab = S_('text', { class: 'imp-cmp-lab', x: 0, y: G.t - 14, 'text-anchor': 'start' }, svgEl);
    const shotsG = S_('g', { class: 'imp-shots' }, svgEl);
    // cursor
    const cur = S_('g', { class: 'imp-cur', tabindex: '0', role: 'slider', 'aria-label': '负载游标', 'aria-valuemin': '75', 'aria-valuemax': '350' }, svgEl);
    const curLine = S_('line', { y1: G.t - 6, y2: Y(0), class: 'imp-cur__l' }, cur);
    const curFull = S_('circle', { r: 6, class: 'imp-cur__p imp-cur__p--full' }, cur);
    const curHalf = S_('circle', { r: 5, class: 'imp-cur__p imp-cur__p--half' }, cur);
    const curCmp = S_('circle', { r: 5, class: 'imp-cur__p imp-cur__p--cmp' }, cur);
    const curTagG = S_('g', { class: 'imp-cur__tag' }, cur);
    const curTagR = S_('rect', { x: -30, y: 0, width: 60, height: 22, rx: 11 }, curTagG); void curTagR;
    const curTagT = S_('text', { x: 0, y: 15, 'text-anchor': 'middle' }, curTagG);
    const knob = S_('g', { class: 'imp-cur__knob' }, cur);
    S_('circle', { r: 11 }, knob);
    S_('path', { d: 'M-3 -4v8M0 -4v8M3 -4v8' }, knob);

    let kChart = 1;
    function drawCmpCurve() {
      let d = '';
      for (let r = 60; r <= 368; r += 2) { const p = cvAt(r); d += `${d ? 'L' : 'M'}${X(r).toFixed(1)} ${Y(Math.min(p, G.yMax + 40)).toFixed(1)}`; }
      cmpPath.setAttribute('d', d);
      const p100 = cvAt(100), p350 = cvAt(350);
      cmpLab.setAttribute('x', G.l + 92);
      cmpLab.textContent = `恒压（示意）：100 Ω → ${Math.round(p100)} W${p100 > G.yMax ? '（超出坐标）' : ''} · 350 Ω → ${Math.round(p350)} W`;
    }

    function setCursor(r, fromUser) {
      r = Math.round(cl(r, 75, 350));
      S.cursor = r;
      const x = X(r);
      curLine.setAttribute('x1', x); curLine.setAttribute('x2', x);
      const pf = fullAt(r), ph = halfAt(r), pc = cvAt(r);
      curFull.setAttribute('cx', x); curFull.setAttribute('cy', Y(pf));
      curHalf.setAttribute('cx', x); curHalf.setAttribute('cy', Y(ph));
      curCmp.setAttribute('cx', x); curCmp.setAttribute('cy', Y(Math.min(pc, G.yMax)));
      knob.setAttribute('transform', `translate(${x} ${Y(0)}) scale(${Math.min(1.6, kChart)})`);
      curTagT.textContent = `${r} Ω`;
      const tx = cl(x, G.l + 32 * kChart, G.W - G.r - 32 * kChart);
      curTagG.setAttribute('transform', `translate(${tx} ${Y(0) + 14 + 8 * kChart}) scale(${kChart})`);
      cur.setAttribute('aria-valuenow', String(r));
      cur.setAttribute('aria-valuetext', `${r} 欧姆，全功率 ${fmtP(r, LC.full)} 瓦`);
      const inBand = r >= 100 && r <= 250;
      el.rd.r.textContent = r;
      el.rd.rs.textContent = inBand ? '额定负载内' : '额定负载外';
      el.rd.rs.classList.toggle('is-out', !inBand);
      el.rd.f.textContent = fmtP(r, LC.full);
      el.rd.h.textContent = fmtP(r, LC.half);
      el.rd.g.textContent = Math.round(pc);
      if (fromUser) root.style.setProperty('--imp-cur', '1');
    }
    function fmtP(r, arr) {
      const v = interp(LC.load, arr, r);
      const i = LC.load.findIndex((x) => x >= r);
      const exact = LC.load.includes(r) || (i > 0 && arr[i] === arr[i - 1]);
      return (exact ? '' : '≈') + Math.round(v);
    }
    // dragging
    const toR = (e) => {
      const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      return Rof(p.x);
    };
    let dragging = false;
    svgEl.addEventListener('pointerdown', (e) => { dragging = true; svgEl.setPointerCapture(e.pointerId); setCursor(toR(e), true); cur.focus({ preventScroll: true }); });
    svgEl.addEventListener('pointermove', (e) => { if (dragging) setCursor(toR(e), true); });
    const end = () => { dragging = false; };
    svgEl.addEventListener('pointerup', end); svgEl.addEventListener('pointercancel', end);
    cur.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -25, PageUp: 25 }[e.key];
      if (e.key === 'Home') { setCursor(75, true); e.preventDefault(); }
      else if (e.key === 'End') { setCursor(350, true); e.preventDefault(); }
      else if (d) { setCursor(S.cursor + d, true); e.preventDefault(); }
    });

    // shot markers on the chart
    function chartShot(r) {
      const pm = matchedAt(r), pc = cvAt(r);
      const g = S_('g', { class: 'imp-shot' }, shotsG);
      if (S.cmp) {
        S_('line', { x1: X(r), x2: X(r), y1: Y(pm), y2: Y(Math.min(pc, G.yMax)), class: 'imp-shot__err' }, g);
        S_('circle', { cx: X(r), cy: Y(Math.min(pc, G.yMax)), r: 4, class: 'imp-shot__g' }, g);
      }
      S_('circle', { cx: X(r), cy: Y(pm), r: 5, class: 'imp-shot__m' }, g);
      gsap.fromTo(g, { opacity: 1 }, { opacity: 0, duration: 5.5, ease: 'power1.in', delay: 0.6, onComplete: () => g.remove() });
      gsap.from(g.querySelectorAll('circle'), { attr: { r: 0 }, duration: 0.5, ease: 'back.out(3)' });
      while (shotsG.childNodes.length > 14) shotsG.firstChild.remove();
    }

    /* =============== mode / compare / play =============== */
    function applyMode() {
      el.seg.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
      root.classList.toggle('imp--half', S.mode === 'half');
      el.set.textContent = PSET[S.mode];
      tweenNum(el.w, PSET[S.mode]);
      drawCmpCurve();
      setCursor(S.cursor);
      still();
    }
    function applyCmp() {
      el.cmp.setAttribute('aria-pressed', String(S.cmp));
      root.classList.toggle('imp--cmp', S.cmp);
      if (!reduced && S.cmp) {
        const len = cmpPath.getTotalLength();
        gsap.fromTo(cmpPath, { strokeDasharray: `${len}`, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', onComplete: () => { cmpPath.style.strokeDasharray = ''; } });
      }
      still();
    }
    el.seg.forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.mode; applyMode(); }));
    el.cmp.addEventListener('click', () => { S.cmp = !S.cmp; applyCmp(); });
    el.play.addEventListener('click', () => {
      S.playing = !S.playing;
      if (S.playing) ensureLoop(); else still();
      el.play.setAttribute('aria-pressed', String(S.playing));
      el.play.querySelector('.imp-play__t').textContent = S.playing ? '暂停' : '播放';
    });
    const numT = new WeakMap();
    function tweenNum(node, v, dec = 0) {
      if (reduced) { node.textContent = v.toFixed(dec); return; }
      const o = numT.get(node) || { v: parseFloat(node.textContent) || 0 };
      numT.set(node, o);
      gsap.to(o, { v, duration: 0.45, ease: 'power3.out', overwrite: true, onUpdate: () => (node.textContent = o.v.toFixed(dec)) });
    }

    /* =============== network svg =============== */
    const net = $('.imp-net__svg');
    const layers = [[60, 140], [40, 100, 160], [70, 130], [100]];
    const nx = [10, 32, 54, 74];
    const edges = [];
    for (let a = 0; a < layers.length - 1; a++) for (const y1 of layers[a]) for (const y2 of layers[a + 1]) {
      edges.push(S_('path', { d: `M${nx[a]} ${y1}C${nx[a] + 10} ${y1} ${nx[a + 1] - 10} ${y2} ${nx[a + 1]} ${y2}`, class: 'imp-e', style: `--d:${a * 0.12}s` }, net));
    }
    const nodesSvg = [];
    layers.forEach((ys, a) => ys.forEach((y) => nodesSvg.push(S_('circle', { cx: nx[a], cy: y, r: a === 3 ? 4.5 : 3.4, class: 'imp-n', style: `--d:${a * 0.12}s` }, net))));
    function netPulse() {
      if (reduced) return;
      net.classList.remove('is-pulse'); void net.getBBox(); net.classList.add('is-pulse');
    }

    /* =============== live canvases =============== */
    const tissueCv = $('.imp-tissue canvas'), gaugeCv = $('.imp-gauge canvas'), scopeCv = $('.imp-scope canvas');
    let fT = null, fG = null, fS = null;
    const fit = () => { fT = lib.fitCanvas(tissueCv); fG = lib.fitCanvas(gaugeCv); fS = lib.fitCanvas(scopeCv); };
    fit();
    const hist = [];      // {R, t0}
    let simT = 0, phase = 0, prevR = S.R, rBlend = 1, ghostNeedle = PSET.full, needle = PSET.full;
    const nextR = () => {
      // bounded random walk inside the rated load range (原理示意)
      let r = S.R + (Math.random() - 0.5) * 90;
      if (Math.random() < 0.18) r = 110 + Math.random() * 130;
      return cl(r, 104, 246);
    };
    function newShot() {
      prevR = S.R; S.R = nextR(); rBlend = 0; S.shot++;
      hist.push({ R: S.R, t0: simT });
      while (hist.length > 12) hist.shift();
      tweenNum(el.r, S.R);
      el.count.textContent = String(S.shot % 1000).padStart(3, '0');
      const pos = (S.R - 75) / (350 - 75);
      el.meterMk.style.left = `${(pos * 100).toFixed(1)}%`;
      el.g.textContent = Math.round(cvAt(S.R));
      netPulse();
      chartShot(S.R);
    }

    const cells = Array.from({ length: 46 }, (_, i) => ({ x: hash(i * 1.7), y: hash(i * 2.9 + 4), r: 0.07 + 0.05 * hash(i * 5.3) }));
    function drawTissue(t) {
      const { cssW: w, cssH: h, dpr } = fT; if (w < 2) return;
      const c = tissueCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const k = cl((S.R - 100) / 150), kp = cl((prevR - 100) / 150), b = cl(rBlend);
      const mix = kp + (k - kp) * b;
      const s = S.shot, sp = s - 1;
      const col = (m) => { const a = [127, 212, 255], v = [160, 124, 255]; return a.map((x, i) => Math.round(x + (v[i] - x) * m)); };
      const [r0, g0, b0] = col(mix);
      // tip plate (top)
      const inRF = phase >= RF_ON[0] && phase < RF_ON[1];
      c.fillStyle = inRF ? withA(C.mint, 0.9) : 'rgba(255,196,94,0.55)';
      if (inRF) { c.shadowColor = C.mint; c.shadowBlur = 14; }
      c.fillRect(w * 0.18, 0, w * 0.64, 4); c.shadowBlur = 0;
      cells.forEach((cc, i) => {
        const jx = (hash(i + s * 7.1) - hash(i + sp * 7.1)) * b + hash(i + sp * 7.1);
        const jy = (hash(i * 3 + s * 3.3) - hash(i * 3 + sp * 3.3)) * b + hash(i * 3 + sp * 3.3);
        const x = (cc.x + (jx - 0.5) * 0.06) * w;
        const y = 8 + (cc.y + (jy - 0.5) * 0.06) * (h - 10);
        const rr = cc.r * w * (0.8 + 0.4 * ((hash(i + s) - hash(i + sp)) * b + hash(i + sp))) * (0.85 + 0.3 * (1 - mix));
        const gr = c.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, `rgba(${r0},${g0},${b0},${0.28 + (inRF ? 0.12 : 0)})`);
        gr.addColorStop(0.7, `rgba(${r0},${g0},${b0},0.08)`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
        c.strokeStyle = `rgba(${r0},${g0},${b0},0.22)`; c.lineWidth = 0.8; c.beginPath(); c.arc(x, y, rr * 0.62, 0, TAU); c.stroke();
      });
      if (inRF) {
        // current lines from the tip into tissue
        const u = (phase - RF_ON[0]) / (RF_ON[1] - RF_ON[0]);
        for (let i = 0; i < 9; i++) {
          const x = w * (0.22 + 0.07 * i);
          const len = h * (0.35 + 0.5 * hash(i + s));
          const yy = ((simT * 90 + i * 23) % len); // simT only advances while playing → frozen when paused
          c.fillStyle = withA(C.mint, 0.5 * (1 - yy / len) * Math.sin(Math.PI * u));
          c.fillRect(x, 6 + yy, 1.4, 6);
        }
      }
    }
    function drawGauge() {
      const { cssW: w, cssH: h, dpr } = fG; if (w < 2) return;
      const c = gaugeCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h - 12, R = Math.min(w * 0.42, h - 34), MAX = 350;
      const ang = (p) => Math.PI + (cl(p, 0, MAX) / MAX) * Math.PI;
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 8; c.beginPath(); c.arc(cx, cy, R, Math.PI, TAU); c.stroke();
      // tolerance band ±20% around setpoint (IFU p.5)
      const set = PSET[S.mode];
      c.strokeStyle = withA(C.mint, 0.18); c.lineWidth = 8; c.lineCap = 'butt';
      c.beginPath(); c.arc(cx, cy, R, ang(set * 0.8), ang(set * 1.2)); c.stroke();
      c.lineCap = 'round';
      c.strokeStyle = withA(C.mint, 0.85); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, Math.PI, ang(needle)); c.stroke();
      for (let p = 0; p <= MAX; p += 50) {
        const a = ang(p), major = p % 100 === 0 || p === 350;
        c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); c.lineTo(cx + Math.cos(a) * (R - (major ? 20 : 16)), cy + Math.sin(a) * (R - (major ? 20 : 16))); c.stroke();
        if (major && p !== 350) { c.font = mono(9); c.fillStyle = C.t3; c.textAlign = 'center'; c.fillText(String(p), cx + Math.cos(a) * (R - 31), cy + Math.sin(a) * (R - 31) + 3); }
      }
      if (S.cmp) {
        const a = ang(ghostNeedle);
        c.setLineDash([4, 4]); c.strokeStyle = C.warn; c.lineWidth = 2;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86); c.stroke(); c.setLineDash([]);
      }
      const a = ang(needle);
      c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.shadowColor = C.mint; c.shadowBlur = 14;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); c.stroke(); c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 4.5, 0, TAU); c.fill();
      c.font = mono(9); c.fillStyle = withA(C.mint, 0.8); c.textAlign = 'center';
      c.fillText('±20%', cx + Math.cos(ang(set)) * (R + 12), cy + Math.sin(ang(set)) * (R + 12) + 3);
    }
    function drawScope() {
      const { cssW: w, cssH: h, dpr } = fS; if (w < 2) return;
      const c = scopeCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const L = 46, Rr = w - 10, win = 7.5 * PERIOD;
      const tx = (tt) => Rr - ((simT - tt) / win) * (Rr - L);
      const mid = h * 0.46;
      // lanes
      const lr = { t: 10, b: mid - 10 }, lp = { t: mid + 6, b: h - 16 };
      const yR = (r) => lr.b - ((r - 75) / (275 - 75)) * (lr.b - lr.t);
      const pMax = PSET[S.mode] * 1.55; // setpoint at ~65% of the lane; unmatched ghost pulses (≤ ~1.45×) still fit
      const yP = (p) => lp.b - (cl(p, 0, pMax) / pMax) * (lp.b - lp.t);
      c.fillStyle = 'rgba(183,155,255,0.06)'; c.fillRect(L, yR(250), Rr - L, yR(100) - yR(250));
      c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath();
      c.moveTo(L, yP(0) + 0.5); c.lineTo(Rr, yP(0) + 0.5); c.moveTo(L, mid + 0.5); c.lineTo(Rr, mid + 0.5); c.stroke();
      c.font = mono(9); c.fillStyle = C.t3; c.textAlign = 'right';
      c.fillText('250 Ω', L - 6, yR(250) + 3); c.fillText('100 Ω', L - 6, yR(100) + 3);
      c.fillText(`${PSET[S.mode]} W`, L - 6, yP(PSET[S.mode]) + 3); c.fillText('0', L - 6, yP(0) + 3);
      c.setLineDash([2, 3]); c.strokeStyle = withA(C.mint, 0.25); c.beginPath(); c.moveTo(L, yP(PSET[S.mode])); c.lineTo(Rr, yP(PSET[S.mode])); c.stroke(); c.setLineDash([]);
      c.save(); c.beginPath(); c.rect(L, 0, Rr - L, h); c.clip();
      // impedance steps
      c.strokeStyle = C.lilac; c.lineWidth = 1.6; c.beginPath();
      hist.forEach((s, i) => {
        const x0 = tx(s.t0), x1 = i < hist.length - 1 ? tx(hist[i + 1].t0) : tx(simT);
        const y = yR(s.R);
        if (i === 0) c.moveTo(x0, y); else c.lineTo(x0, y);
        c.lineTo(x1, y);
      });
      c.stroke();
      hist.forEach((s) => { c.fillStyle = C.lilac; c.beginPath(); c.arc(tx(s.t0), yR(s.R), 2.2, 0, TAU); c.fill(); });
      // power pulses
      hist.forEach((s) => {
        const a = s.t0 + RF_ON[0] * PERIOD, b = Math.min(simT, s.t0 + RF_ON[1] * PERIOD);
        if (b <= a) return;
        const x0 = tx(a), x1 = tx(b);
        const pm = S.mode === 'full' ? fullAt(s.R) : halfAt(s.R);
        c.fillStyle = withA(C.mint, 0.22); c.fillRect(x0, yP(pm), x1 - x0, yP(0) - yP(pm));
        c.strokeStyle = C.mint; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x0, yP(0)); c.lineTo(x0, yP(pm)); c.lineTo(x1, yP(pm)); c.lineTo(x1, yP(0)); c.stroke();
        if (S.cmp) {
          const pc = cvAt(s.R);
          c.setLineDash([3, 3]); c.strokeStyle = C.warn; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(x0 + 2, yP(0)); c.lineTo(x0 + 2, yP(pc)); c.lineTo(x1 - 2, yP(pc)); c.lineTo(x1 - 2, yP(0)); c.stroke(); c.setLineDash([]);
        }
      });
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.moveTo(Rr + 0.5, 6); c.lineTo(Rr + 0.5, h - 12); c.stroke();
      c.font = sans(10); c.textAlign = 'left';
      c.fillStyle = 'rgba(7,7,12,0.7)'; c.fillRect(L + 2, lr.t - 1, 30, 15); c.fillRect(L + 2, lp.t - 1, 30, 15);
      c.fillStyle = C.lilac; c.fillText('阻抗', L + 6, lr.t + 10); c.fillStyle = C.mint; c.fillText('功率', L + 6, lp.t + 10);
    }

    function frame(dt, t) {
      if (S.playing) {
        simT += dt; phase += dt / PERIOD;
        if (phase >= 1) { phase -= 1; newShot(); }
      }
      if (dt === 0) { rBlend = 1; needle = PSET[S.mode]; ghostNeedle = cvAt(S.R); } // static redraw → end state
      rBlend = Math.min(1, rBlend + dt * 2.5);
      needle += (PSET[S.mode] - needle) * Math.min(1, dt * 6);
      ghostNeedle += (cvAt(S.R) - ghostNeedle) * Math.min(1, dt * 5);
      drawTissue(t); drawGauge(); drawScope();
    }
    // reduced motion: no rAF loop until the visitor explicitly presses 播放; static redraws on every state change
    let loopCtl = null;
    const ensureLoop = () => { if (!loopCtl) loopCtl = lib.visibleLoop($('.imp-main'), frame); };
    const still = () => { if (!loopCtl) frame(0, 0); };
    lib.onResize(() => { fit(); still(); });
    document.fonts?.ready.then(() => { fit(); still(); });

    // seed a few shots so the scope isn't empty on first view
    for (let i = 0; i < 6; i++) hist.push({ R: (S.R = nextR()), t0: i * PERIOD });
    phase = 0.3; simT = 5 * PERIOD + phase * PERIOD; // the 6th seeded shot is the one in progress
    el.r.textContent = Math.round(S.R);
    el.meterMk.style.left = `${(((S.R - 75) / 275) * 100).toFixed(1)}%`;
    el.g.textContent = Math.round(cvAt(S.R));

    frame(0, 0);
    if (!reduced) ensureLoop(); // pauses off-screen; shots advance only while playing

    drawCmpCurve();
    setCursor(S.cursor);
    applyMode();

    // draw-in of the real curves
    if (!reduced) {
      [full, half].forEach((pl) => {
        const len = polyLen(pl);
        pl.style.strokeDasharray = `${len}`; pl.style.strokeDashoffset = `${len}`;
      });
      gsap.set([...fullDots, ...halfDots], { attr: { r: 0 } });
      gsap.set(valLabels, { opacity: 0 });
      onceVisible(svgEl, () => {
        {
          const tl = gsap.timeline();
          tl.to(full, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
            .to(half, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.25)
            .to(fullDots, { attr: { r: 4.2 }, duration: 0.4, stagger: 0.08, ease: 'back.out(3)' }, 0.5)
            .to(halfDots, { attr: { r: 4.2 }, duration: 0.4, stagger: 0.06, ease: 'back.out(3)' }, 0.7)
            .to(valLabels, { opacity: 1, duration: 0.6 }, 1.1)
            .fromTo(cur, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.2)
            .add(() => { if (!root.style.getPropertyValue('--imp-cur')) sweepCursor(); }, 1.4);
        }
      }, 0.3);
    }
    function sweepCursor() {
      const o = { r: S.cursor };
      gsap.timeline()
        .to(o, { r: 80, duration: 1.2, ease: 'power2.inOut', onUpdate: () => setCursor(o.r) })
        .to(o, { r: 340, duration: 2.2, ease: 'power2.inOut', onUpdate: () => setCursor(o.r) })
        .to(o, { r: 180, duration: 1.2, ease: 'power2.inOut', onUpdate: () => setCursor(o.r) });
    }

    /* =============== 图13 level → power =============== */
    const lvSvg = $('.imp-lvsvg');
    const LV = lib.LEVELS;
    const H13 = { l: 46, r: 18, t: 30, b: 40, W: 640, H: 300 };
    const lx = (i) => H13.l + (i / 15) * (H13.W - H13.l - H13.r);
    const ly = (p) => H13.H - H13.b - (p / 200) * (H13.H - H13.t - H13.b);
    const gA = S_('g', { class: 'axis' }, lvSvg);
    for (let p = 0; p <= 200; p += 40) {
      S_('line', { x1: H13.l, x2: H13.W - H13.r, y1: ly(p), y2: ly(p), class: 'gridline' }, gA);
      S_('text', { x: H13.l - 8, y: ly(p) + 4, 'text-anchor': 'end' }, gA).textContent = p;
    }
    LV.forEach((lv, i) => { if (i % 2 === 1 || i === 0) S_('text', { x: lx(i), y: H13.H - H13.b + 18, 'text-anchor': 'middle', class: i === 0 ? 'imp-x0' : '' }, gA).textContent = lv % 1 ? lv : lv.toFixed(0); });
    S_('text', { x: H13.l - 8, y: H13.t - 14, 'text-anchor': 'start', class: 'imp-axlab imp-axlab--y' }, gA).textContent = '输出功率 (W)';
    S_('text', { x: H13.W - H13.r, y: H13.H - 6, 'text-anchor': 'end', class: 'imp-axlab imp-axlab--x' }, gA).textContent = '能量强度';
    const bars = LV.map((lv, i) => S_('rect', { x: lx(i) - 7, width: 14, y: ly(lib.levelPower(lv)), height: ly(0) - ly(lib.levelPower(lv)), rx: 3, class: 'imp-lvbar' }, lvSvg));
    const lvLine = S_('polyline', { points: LV.map((lv, i) => `${lx(i)},${ly(lib.levelPower(lv))}`).join(' '), class: 'imp-lvline' }, lvSvg);
    const lvDots = LV.map((lv, i) => S_('circle', { cx: lx(i), cy: ly(lib.levelPower(lv)), r: 3.2, class: 'imp-lvdot' }, lvSvg));
    const lvLabs = LV.map((lv, i) => {
      const tt = S_('text', { x: lx(i), y: ly(lib.levelPower(lv)) - 10, 'text-anchor': 'middle', class: `imp-lvlab${lv % 1 ? ' imp-lvlab--half' : ''}` }, lvSvg);
      tt.textContent = lib.levelPower(lv); return tt;
    });
    const riser = S_('path', { class: 'imp-riser', d: '' }, lvSvg);
    const riserT = S_('text', { class: 'imp-riser-t', 'text-anchor': 'start' }, lvSvg);
    const lvMk = S_('g', { class: 'imp-lvmk' }, lvSvg);
    S_('line', { x1: 0, x2: 0, y1: 0, y2: 0, class: 'imp-lvmk__l' }, lvMk);
    S_('line', { class: 'imp-lvmk__h' }, lvMk);
    S_('circle', { r: 8, class: 'imp-lvmk__halo' }, lvMk);
    S_('circle', { r: 5, class: 'imp-lvmk__c' }, lvMk);
    const range = $('.imp-scrub input');
    const lvRead = { lv: $('[data-l="lv"]'), w: $('[data-l="w"]') };
    const mk = { i: S.lv - 1 };
    function placeLv(fi) {
      const i0 = Math.floor(fi), f = fi - i0, i1 = Math.min(15, i0 + 1);
      const p = lib.levelPower(LV[i0]) + (lib.levelPower(LV[i1]) - lib.levelPower(LV[i0])) * f;
      const x = lx(fi), y = ly(p);
      const [l, hl, halo, c] = lvMk.children;
      l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', y); l.setAttribute('y2', ly(0));
      hl.setAttribute('x1', H13.l); hl.setAttribute('x2', x); hl.setAttribute('y1', y); hl.setAttribute('y2', y);
      halo.setAttribute('cx', x); halo.setAttribute('cy', y); c.setAttribute('cx', x); c.setAttribute('cy', y);
    }
    function setLv(i, animate = true) {
      i = cl(Math.round(i), 0, 15);
      S.lv = i + 1;
      range.value = String(i);
      range.style.setProperty('--p', `${(i / 15) * 100}%`);
      bars.forEach((b, j) => b.classList.toggle('is-on', j <= i));
      lvDots.forEach((d, j) => d.classList.toggle('is-cur', j === i));
      lvLabs.forEach((d, j) => d.classList.toggle('is-cur', j === i));
      lvRead.lv.textContent = LV[i].toFixed(1);
      tweenNum(lvRead.w, lib.levelPower(LV[i]));
      if (i > 0) {
        const xa = lx(i - 1), xb = lx(i), ya = ly(lib.levelPower(LV[i - 1])), yb = ly(lib.levelPower(LV[i]));
        riser.setAttribute('d', `M${xa} ${ya}H${xb}V${yb}`);
        riserT.setAttribute('x', xb + 8); riserT.setAttribute('y', (ya + yb) / 2 + 4);
        riserT.textContent = '+10 W';
      } else { riser.setAttribute('d', ''); riserT.textContent = ''; }
      if (animate && !reduced) gsap.to(mk, { i, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: () => placeLv(mk.i) });
      else { mk.i = i; placeLv(i); }
    }
    range.addEventListener('input', () => setLv(+range.value));
    let lvDrag = false;
    const lvFromEvt = (e) => {
      const pt = lvSvg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(lvSvg.getScreenCTM().inverse());
      return ((p.x - H13.l) / (H13.W - H13.l - H13.r)) * 15;
    };
    lvSvg.addEventListener('pointerdown', (e) => { lvDrag = true; lvSvg.setPointerCapture(e.pointerId); setLv(lvFromEvt(e)); });
    lvSvg.addEventListener('pointermove', (e) => { if (lvDrag) setLv(lvFromEvt(e)); });
    lvSvg.addEventListener('pointerup', () => (lvDrag = false));
    lvSvg.addEventListener('pointercancel', () => (lvDrag = false));
    setLv(S.lv - 1, false);
    // keep SVG text at a constant on-screen size (viewBox is scaled on narrow screens)
    function scaleSvgText() {
      kChart = G.W / Math.max(1, svgEl.getBoundingClientRect().width);
      svgEl.style.setProperty('--k', kChart.toFixed(3));
      svgEl.classList.toggle('is-narrow', kChart > 1.4);
      const k2 = H13.W / Math.max(1, lvSvg.getBoundingClientRect().width);
      lvSvg.style.setProperty('--k', k2.toFixed(3));
      lvSvg.classList.toggle('is-narrow', k2 > 1.4);
      setCursor(S.cursor);
    }
    scaleSvgText();
    lib.onResize(scaleSvgText);
    if (!reduced) {
      const len = polyLen(lvLine);
      lvLine.style.strokeDasharray = `${len}`; lvLine.style.strokeDashoffset = `${len}`;
      gsap.set(bars, { scaleY: 0, transformOrigin: '50% 100%' });
      gsap.set(lvLabs, { opacity: 0 });
      onceVisible(lvSvg, () => {
        {
          gsap.timeline()
            .to(bars, { scaleY: 1, duration: 0.7, stagger: 0.04, ease: 'expo.out' })
            .to(lvLine, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.1)
            .to(lvLabs, { opacity: 1, duration: 0.3, stagger: 0.03 }, 0.5)
            .add(() => { const o = { i: 0 }; gsap.fromTo(o, { i: 0 }, { i: 11, duration: 1.6, ease: 'power2.inOut', onUpdate: () => setLv(o.i, false) }); }, 0.6);
        }
      }, 0.3);
    }
  },
};

function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) { const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * f; }
  }
  return ys[ys.length - 1];
}
function polyLen(pl) {
  const p = pl.getAttribute('points').trim().split(/\s+/).map((s) => s.split(',').map(Number));
  let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}
