// #protocol — 治疗流程：六步旅程 · 网格规划演练台 · 患者反馈教练 · 关键操作要点
// Facts: DATA.protocol / DATA.defaults (使用说明书 p.4, p.18–23). Extra facts are cited inline with // src:.

// src: IFU p.21 — 建议参数：能量密度目标 16.6–31.3 J/cm²（中、较高区域）
const TARGET_D = [16.6, 31.3];
// src: IFU p.15 — 每传送一次射频能量脉冲，显示的治疗发数会递减一次；DATA.components 头端 900 发
const TIP_SHOTS = 900;
const SPEED = 20; // demo clock: 1 real second = 20 demo seconds (clearly labelled in UI)
const CELL = 40; // 1 cm = 20 SVG units → 2 cm × 2 cm = 4 cm² cell
const X0 = 60, Y0 = 100, NCOL = 7, NROW = 10;
const EYES = [[144, 244], [256, 244]];
const EYE_R = [46, 32];

const ZONES = {
  forehead: { t: '前额', en: 'FOREHEAD', kind: 'thin' },
  temple: { t: '颞部', en: 'TEMPORAL', kind: 'thin' },
  zygoma: { t: '颧骨', en: 'ZYGOMATIC', kind: 'thin' },
  cheek: { t: '面颊', en: 'CHEEK', kind: 'norm' },
  jaw: { t: '下颌', en: 'MANDIBLE', kind: 'thin' },
  eye: { t: '眼部', en: 'NO-GO ZONE', kind: 'nogo' },
};
const ZONE_ORDER = ['forehead', 'temple', 'zygoma', 'cheek', 'jaw', 'eye'];

/* ---------------- face line art (viewBox 0 0 400 520, 20 units = 1 cm) ---------------- */
const HEAD = 'M200 470C234 470 264 452 285 420C301 396 313 370 319 342C325 314 331 288 333 260C335 232 336 206 334 180C330 100 272 48 200 48C128 48 70 100 66 180C64 206 65 232 67 260C69 288 75 314 81 342C87 370 99 396 115 420C136 452 166 470 200 470Z';
const SKIN = 'M66 200C72 150 108 112 160 104C180 101 192 104 200 110C208 104 220 101 240 104C292 112 328 150 334 200C336 222 335 242 333 260C331 288 325 314 319 342C313 370 301 396 285 420C264 452 234 470 200 470C166 470 136 452 115 420C99 396 87 370 81 342C75 314 69 288 67 260C65 242 64 222 66 200Z';
const HAIRLINE = 'M66 200C72 150 108 112 160 104C180 101 192 104 200 110C208 104 220 101 240 104C292 112 328 150 334 200';
const FACE_ART = `
  <path class="art art--head" d="${HEAD}"/>
  <path class="art art--hairline" d="${HAIRLINE}"/>
  <g class="art art--hair">
    <path d="M196 56C150 62 108 92 90 150"/><path d="M198 76C160 80 124 104 108 134"/><path d="M199 92C174 94 150 100 132 112"/>
    <path d="M204 56C250 62 292 92 310 150"/><path d="M202 76C240 80 276 104 292 134"/><path d="M201 92C226 94 250 100 268 112"/>
    <path d="M200 50C200 70 200 88 200 106"/>
  </g>
  <g class="art art--ear">
    <path d="M333 236C346 224 360 230 360 252C360 276 352 298 336 312"/><path d="M341 248C350 251 350 266 344 280"/>
    <path d="M67 236C54 224 40 230 40 252C40 276 48 298 64 312"/><path d="M59 248C50 251 50 266 56 280"/>
  </g>
  <g class="art art--neck"><path d="M134 450C140 478 140 500 132 520"/><path d="M266 450C260 478 260 500 268 520"/></g>
  <g class="art art--brow"><path d="M108 214C122 202 148 198 178 208"/><path d="M292 214C278 202 252 198 222 208"/></g>
  <g class="art art--eye">
    <path d="M118 246C130 256 158 256 170 244"/><path d="M282 246C270 256 242 256 230 244"/>
    <path class="thin" d="M120 238C134 230 156 230 168 236"/><path class="thin" d="M280 238C266 230 244 230 232 236"/>
    <path class="thin" d="M126 251l-3 5M136 254l-1.5 5.5M147 255l0 5.5M158 253l1.5 5.5M166 249l3 5M274 251l3 5M264 254l1.5 5.5M253 255l0 5.5M242 253l-1.5 5.5M234 249l-3 5"/>
  </g>
  <g class="art art--nose">
    <path d="M190 222C192 256 190 286 182 306"/><path class="thin" d="M212 252C212 274 214 292 218 304"/>
    <path d="M178 312C172 322 180 330 190 328C194 334 206 334 210 328C220 330 228 322 222 312"/>
  </g>
  <g class="art art--lip">
    <path d="M166 380C176 374 188 368 200 374C212 368 224 374 234 380"/><path d="M166 380C182 386 218 386 234 380"/><path class="thin" d="M172 384C186 400 214 400 228 384"/>
  </g>
  <g class="art art--contour">
    <path d="M86 300C104 290 124 288 142 296"/><path d="M314 300C296 290 276 288 258 296"/>
    <path d="M178 322C166 338 162 356 168 374"/><path d="M222 322C234 338 238 356 232 374"/><path d="M186 446C194 450 206 450 214 446"/>
  </g>`;

/* ---------------- small helpers ---------------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function smoothPath(pts, closed = true) {
  const n = pts.length, g = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d + (closed ? 'Z' : '');
}
const BODY_R = [[65, 37], [66, 45], [76, 48], [86, 51], [93, 59], [96, 74], [99, 94], [102, 112], [104, 128], [104, 139], [99, 141], [96, 130], [93, 113], [91, 95], [88, 80], [82, 96], [81, 108], [84, 122], [85, 138], [83, 160], [80, 186], [79, 208], [78, 226], [81, 235], [69, 236], [68, 226], [67, 206], [66, 184], [63, 158], [60, 150]];
const BODY = smoothPath([...BODY_R, ...BODY_R.slice(0, -1).reverse().map(([x, y]) => [120 - x, y])]);
const bodySVG = (extra = '') => `
  <svg class="pr-body" viewBox="0 0 120 244" aria-hidden="true">
    <ellipse class="pr-body__head" cx="60" cy="21" rx="12.5" ry="15"/>
    <path class="pr-body__shape" d="${BODY}"/>
    <path class="pr-body__hip" d="M40 128C50 134 70 134 80 128"/>
    <rect class="pr-body__pad" x="73" y="108" width="10" height="14" rx="2.5"/>
    ${extra}
  </svg>`;
function pip(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inEye = (x, y) => EYES.some(([ex, ey]) => ((x - ex) / EYE_R[0]) ** 2 + ((y - ey) / EYE_R[1]) ** 2 <= 1);
function zoneOf(cx, cy) {
  const dx = Math.abs(cx - 200);
  if (cy >= 395) return dx < 30 && cy < 420 ? null : 'jaw';
  if (dx < 30) return cy < 215 ? 'forehead' : null;
  if (cy < 222) return dx >= 100 ? 'temple' : 'forehead';
  if (cy < 262) return dx >= 100 ? 'temple' : 'zygoma';
  if (cy < 340) return dx >= 60 ? 'zygoma' : 'cheek';
  return 'cheek';
}
function dialSVG() {
  const R = 64, C = 86, pt = (deg) => [C + R * Math.cos((deg * Math.PI) / 180), C + R * Math.sin((deg * Math.PI) / 180)];
  let segs = '';
  for (let i = 0; i < 6; i++) {
    const a0 = -90 + i * 60 + 5, a1 = -90 + (i + 1) * 60 - 5, [x0, y0] = pt(a0), [x1, y1] = pt(a1), [tx, ty] = [C + (R + 17) * Math.cos(((a0 + a1) / 2) * Math.PI / 180), C + (R + 17) * Math.sin(((a0 + a1) / 2) * Math.PI / 180)];
    segs += `<path class="seg" d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}"/><text class="segn" x="${tx.toFixed(1)}" y="${(ty + 3.5).toFixed(1)}" text-anchor="middle">${i + 1}</text>`;
  }
  return `<svg viewBox="0 0 172 172" aria-hidden="true"><circle class="trk" cx="${C}" cy="${C}" r="${R}"/>${segs}<circle class="hand" cx="${C}" cy="${C - R}" r="4.5"/><text class="gap" x="${C}" y="${C - 26}" text-anchor="middle">间隔 &gt; 60 s</text><text class="big" x="${C}" y="${C + 12}" text-anchor="middle">6</text><text class="sm" x="${C}" y="${C + 32}" text-anchor="middle">次 / 同一部位</text></svg>`;
}
const fmtClock = (s) => { s = Math.floor(s); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/* ---------------- phases (IFU p.18–23) ---------------- */
function phases(P, D) {
  return [
    { n: '01', en: 'PATIENT PREP', t: '治疗前准备', src: '使用说明书 第 18 页', illus: 'body', steps: P.prep,
      warn: ['中性电极片不要放在肩部、颈部、头部区域、腿部或手臂上', '不使用局部注射、肿胀麻醉或神经阻滞技术管理患者舒适度'] },
    { n: '02', en: 'DEVICE READY', t: '治疗仪准备', src: '使用说明书 第 18–19 页', illus: 'ready', steps: P.device,
      note: `默认安全参数：功率档位 ${D.level} · 制冷强度 ${D.cooling} · 脉冲时间 ${D.pulse.toFixed(1)}`,
      warn: ['始终备有替代制冷剂罐'] },
    { n: '03', en: 'GRID PLANNING', t: '治疗规划', src: '使用说明书 第 19–20 页', illus: 'grid',
      steps: ['准备记号笔或 4 cm² 正方形排列的皮肤标记纸', '按治疗头大小 4 cm²，在面部绘制紧密排列的正方形网格，覆盖预期治疗区域', '在网格区域内逐格进行治疗'],
      warn: [P.limits] },
    { n: '04', en: 'DELIVERY', t: '传送治疗', src: '使用说明书 第 15、20 页', illus: 'pulse',
      steps: ['戴一次性手套，用 75% 医用酒精清洁治疗头端', '治疗部位足量涂敷耦合剂，治疗期间重复涂敷', '手具与皮肤表面垂直，按使能开关进入“预备”模式', '以适当压力将头端均匀按压皮肤；压力过低时停止射频传送', '传送完成后将头端抬离皮肤'],
      warn: ['能量发出时保持手具垂直，避免提前离开治疗部位，防止引起电弧导致表皮烫伤'] },
    { n: '05', en: 'ASSESS & ADJUST', t: '评估与调整', src: '使用说明书 第 20–22 页', illus: 'gauge',
      steps: ['目视检查治疗部位，询问患者热感与舒适度', `将热感反馈保持在 2.0 – 3.0`, '治疗过度 → 减小功率档位或加大制冷强度', '舒适且想加强效果 → 增加功率档位', '加功率疼痛但能量密度过低 → 增加脉冲时间'],
      warn: ['应谨慎选择功率档位和脉冲时间的组合，过高的能量密度可能有导致不良结果的风险'] },
    { n: '06', en: 'WRAP-UP', t: '治疗结束', src: '使用说明书 第 23 页', illus: 'end',
      steps: ['去掉皮肤上的耦合剂', '断开并轻轻取下中性电极片，检查放置部位皮肤', '按电源按钮关闭治疗仪', '拆除一次性使用治疗头端，按法规弃置', '电源开关由 1 调至 0，断开网电源'] },
  ];
}

function illus(kind) {
  switch (kind) {
    case 'body': return `<div class="pr-ill pr-ill--body">${bodySVG()}<div class="pr-ill__cap"><b>中性电极片</b><span>腰部或身体两侧<br>（髋关节以上）</span></div></div>`;
    case 'ready': return `<div class="pr-ill pr-ill--ready">${['制冷剂罐', '治疗手具', '治疗头端', '中性电极片'].map((t, i) => `<span style="--d:${i * 0.35}s"><i></i>${t}</span>`).join('')}<em class="mono">READY</em></div>`;
    case 'grid': {
      let lines = '';
      for (let i = 1; i < 6; i++) lines += `<path style="--d:${i * 0.08}s" d="M${i * 20} 0V120M0 ${i * 20}H120"/>`;
      return `<div class="pr-ill pr-ill--grid"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><clipPath id="pr-illclip"><ellipse cx="60" cy="62" rx="42" ry="54"/></clipPath></defs><ellipse class="o" cx="60" cy="62" rx="42" ry="54"/><g clip-path="url(#pr-illclip)">${lines}</g><rect class="c" x="40" y="60" width="20" height="20" rx="2"/></svg><div class="pr-ill__cap"><b class="num">2 × 2 cm</b><span>= 4 cm² · 与治疗头端面积一致</span></div></div>`;
    }
    case 'pulse': return `<div class="pr-ill pr-ill--pulse"><div class="bar"><span class="c">治疗前冷却</span><span class="h">射频传送</span><span class="c">治疗后冷却</span><i class="head"></i></div><div class="pr-ill__cap"><span>“启动”模式下，每个射频能量脉冲包括三个阶段</span></div></div>`;
    case 'gauge': return `<div class="pr-ill pr-ill--gauge"><div class="scale">${[0, 1, 2, 3, 4, 5].map((v) => `<span>${v}</span>`).join('')}<b class="band"></b><i class="mk"></i></div><div class="pr-ill__cap"><b class="num">2.0 – 3.0</b><span>热感反馈目标区间</span></div></div>`;
    case 'end': return `<div class="pr-ill pr-ill--end"><div class="sw"><span class="num">1</span><i></i><span class="num">0</span></div><div class="pr-ill__cap"><b>断开网电源</b><span>紧急状态下可拔电源线或按压开关代替正常关机</span></div></div>`;
  }
  return '';
}

/* ======================================================================= */
export default {
  id: 'protocol',
  nav: '治疗流程',
  async init(root, ctx) {
    const { data } = ctx;
    const P = data.protocol, D = data.defaults;
    const PH = phases(P, D);

    root.innerHTML = `
<div class="pr-glow" aria-hidden="true"></div>
<div class="wrap">
  <header class="sec-head">
    <span class="eyebrow">09 · PROTOCOL</span>
    <h2 class="h1">六步规范流程<br><span class="grad-text">每一格</span>都有章可循</h2>
    <p class="lead">依据使用说明书第 18–23 页：从患者准备、设备就绪，到 4 cm² 网格规划、逐格传送与热感反馈调整——把操作规范变成可以亲手演练的交互。</p>
  </header>
</div>

<div class="pr-journey">
  <div class="wrap">
    <div class="pr-jhead" data-reveal>
      <p class="pr-kicker"><span class="mono">JOURNEY</span>治疗流程 · 六个阶段</p>
      <p class="micro pr-jhint">滚动或点按节点浏览 →</p>
      <div class="pr-jnav"><button type="button" data-step="-1" aria-label="上一步"><svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5"/></svg></button><button type="button" data-step="1" aria-label="下一步"><svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg></button></div>
    </div>
    <div class="pr-railwrap" data-reveal>
      <ol class="pr-rail">
        ${PH.map((p, i) => `<li><button class="pr-rail__node" type="button" data-i="${i}" aria-label="第 ${i + 1} 步：${p.t}"><span class="pr-rail__dot"></span><span class="pr-rail__n mono">${p.n}</span><span class="pr-rail__t">${p.t}</span></button></li>`).join('')}
      </ol>
      <div class="pr-rail__bar" aria-hidden="true"><i></i></div>
      <p class="pr-rail__cur" aria-live="polite"></p>
    </div>
  </div>
  <div class="pr-viewport" data-reveal="fade">
    <div class="pr-track">
      ${PH.map((p, i) => `
      <article class="pr-card" data-i="${i}">
        <div class="pr-card__top">
          <span class="pr-card__num num">${p.n}</span>
          <div><span class="pr-card__en mono">${p.en}</span><h3 class="h3">${p.t}</h3></div>
        </div>
        ${illus(p.illus)}
        <ol class="pr-steps">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${p.note ? `<p class="pr-note mono">${esc(p.note)}</p>` : ''}
        ${(p.warn || []).map((w) => `<p class="pr-warn"><i aria-hidden="true"></i>${esc(w)}</p>`).join('')}
        <span class="tag-src">来源：${p.src}</span>
      </article>`).join('')}
    </div>
  </div>
</div>

<div class="wrap pr-block" id="pr-planner">
  <div class="pr-bhead" data-reveal>
    <p class="pr-kicker"><span class="mono">PLAYGROUND · 01</span>治疗规划演练台</p>
    <h3 class="h2">在面部画出 <span class="grad-text num">4 cm²</span> 网格，逐格传送</h3>
    <p class="small">每格 2 cm × 2 cm，与一次性使用治疗头端（YM5-TP4-900，4.0 cm²）面积一致。点按格子模拟一次射频能量脉冲；每格记录次数、自动执行“同一部位不超过 6 次、间隔大于 60 s”的规则。</p>
  </div>
  <div class="pr-plan">
    <div class="pr-stage card" data-reveal>
      <div class="pr-stage__bar">
        <div class="seg" role="group" aria-label="视图">
          <button type="button" data-view="grid" aria-pressed="true">网格视图</button>
          <button type="button" data-view="heat" aria-pressed="false">累计热图</button>
        </div>
        <div class="pr-clock mono" aria-label="演示时钟"><i></i><span class="pr-clock__t">T+ 00:00</span><em>演示时钟 ×${SPEED}</em></div>
      </div>
      <div class="pr-face">
        <svg class="pr-face__svg" viewBox="0 0 400 520" tabindex="0" role="application" aria-label="面部网格规划：方向键移动，回车传送一次">
          <defs>
            <radialGradient id="prf-skinfill" cx="50%" cy="46%" r="60%"><stop offset="0" stop-color="#8a5cf0" stop-opacity=".16"/><stop offset=".7" stop-color="#2bae7e" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
            <clipPath id="prf-skinclip"><path d="${SKIN}"/></clipPath>
            <pattern id="prf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(255,77,94,.08)"/><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,77,94,.55)" stroke-width="1.2"/></pattern>
            <filter id="prf-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="11"/></filter>
            <linearGradient id="prf-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7dc9c"/><stop offset=".5" stop-color="#c79a4b"/><stop offset="1" stop-color="#fbe7b5"/></linearGradient>
          </defs>
          <path class="pr-skin" d="${SKIN}"/>
          <g class="pr-art">${FACE_ART}</g>
          <g clip-path="url(#prf-skinclip)"><g class="pr-heatlayer"></g></g>
          <g class="pr-lattice" clip-path="url(#prf-skinclip)"></g>
          <g class="pr-eyes">
            ${EYES.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${EYE_R[0]}" ry="${EYE_R[1]}"/>`).join('')}
          </g>
          <g class="pr-zones"></g>
          <g class="pr-cells"></g>
          <g class="pr-labels"></g>
          <g class="pr-tipwrap"><g class="pr-tip" opacity="0"><rect class="pr-tip__rim" x="-3" y="-3" width="46" height="46" rx="7"/><rect class="pr-tip__face" x="3" y="3" width="34" height="34" rx="3" fill="rgba(127,212,255,0)"/><rect class="pr-tip__heat" x="3" y="3" width="34" height="34" rx="3" opacity="0"/></g></g>
          <rect class="pr-kbd" x="0" y="0" width="40" height="40" rx="4" opacity="0"/>
          <g class="pr-scale" transform="translate(24 486)"><rect x="0" y="-14" width="40" height="40" rx="3"/><path d="M0 34H40M0 30V38M40 30V38"/><text x="20" y="50" text-anchor="middle">2 cm</text><text x="48" y="10">4 cm²</text></g>
        </svg>
        <p class="pr-toast" role="status" aria-live="polite"></p>
      </div>
      <div class="pr-legend">
        <span class="micro">格内累计次数</span>
        <div class="pr-legend__bar"><i></i></div>
        <div class="pr-legend__ticks mono"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div>
        <span class="pr-legend__nogo micro"><i></i>眼部禁区</span>
      </div>
    </div>

    <aside class="pr-side">
      <div class="pr-chips" role="group" aria-label="面部分区" data-reveal>
        ${ZONE_ORDER.map((z) => `<button type="button" class="pr-chip pr-chip--${ZONES[z].kind}" data-zone="${z}" aria-pressed="false"><i></i>${z === 'eye' ? '眼部禁区' : ZONES[z].t}</button>`).join('')}
      </div>
      <div class="pr-insp card" data-reveal aria-live="polite">
        <div class="pr-insp__head"><span class="pr-insp__en mono">SELECT A ZONE</span><span class="pr-insp__tag"></span></div>
        <h4 class="pr-insp__t h3">悬停或点按面部分区</h4>
        <p class="pr-insp__txt small">查看各分区的能量指引。说明书指出：皮下组织较薄部位需减低能量；眼部为禁用区域。</p>
        <p class="pr-insp__meta mono micro"></p>
        <span class="tag-src pr-insp__src">来源：使用说明书 第 4 页</span>
      </div>
      <div class="pr-stats" data-reveal>
        <div><span class="num pr-stat" data-s="cells">0</span><span class="micro">已治疗格 / <b data-s="total">0</b></span></div>
        <div><span class="num pr-stat" data-s="shots">0</span><span class="micro">累计发数</span></div>
        <div><span class="num pr-stat" data-s="tip">${TIP_SHOTS}</span><span class="micro">头端剩余 / ${TIP_SHOTS} 发</span></div>
      </div>
      <div class="pr-phase card" data-reveal>
        <div class="pr-phase__row"><span class="micro">脉冲阶段</span><span class="pr-phase__st mono">准备就绪</span></div>
        <div class="pr-phase__bar"><span data-p="0">治疗前冷却</span><span data-p="1">射频传送</span><span data-p="2">治疗后冷却</span></div>
        <div class="pr-rulesmini">
          <div><b class="num">≤ 6</b><span class="micro">同一部位次数上限</span></div>
          <div><b class="num">&gt; 60 s</b><span class="micro">同一部位每次间隔</span></div>
        </div>
      </div>
      <div class="pr-actions" data-reveal>
        <button type="button" class="btn btn--primary pr-auto" aria-pressed="false"><span class="pr-auto__ic" aria-hidden="true"></span><span class="pr-auto__t">自动逐格一遍</span></button>
        <button type="button" class="btn pr-reset">重置</button>
      </div>
      <p class="disclaimer pr-disc">分区与网格为示意图（原理示意），演示时钟已加速 ×${SPEED}；热图表示累计治疗次数，非组织温度。实际治疗须遵循使用说明书，并由经培训合格的医务人员操作。${esc(data.disclaimers.sim)}</p>
    </aside>
  </div>
</div>

<div class="wrap pr-block" id="pr-coach">
  <div class="pr-bhead" data-reveal>
    <p class="pr-kicker"><span class="mono">PLAYGROUND · 02</span>患者反馈教练</p>
    <h3 class="h2">让热感停在 <span class="grad-text num">2.0 – 3.0</span></h3>
    <p class="small">拖动量表上的指针，记录患者报告的热感与冷感；教练按说明书第 21–22 页给出调整建议，并可一键应用到参数上（能量密度按说明书能量输出表精确计算）。</p>
  </div>
  <div class="pr-coach">
    <div class="pr-gauges card" data-reveal>
      <div class="pr-gauges__row">
        <figure class="pr-gauge" data-kind="heat"></figure>
        <figure class="pr-gauge" data-kind="cold"></figure>
      </div>
      <p class="pr-gauges__hint micro">拖动指针或聚焦后按方向键调整 · 步进 0.5<br>图 11.2 中 2、3 两级合并标注为“很凉”（同说明书）</p>
    </div>
    <div class="pr-coachcard card" data-reveal>
      <div class="pr-cc__status"><span class="pr-cc__badge"></span><span class="pr-cc__read mono"></span></div>
      <h4 class="pr-cc__title h3"></h4>
      <p class="pr-cc__rec"></p>
      <div class="pr-cc__acts"></div>
      <div class="pr-cc__scen" role="group" aria-label="情境">
        <span class="micro">情境</span>
        <button type="button" class="pr-tog" data-scen="want" aria-pressed="false">舒适，想加强效果</button>
        <button type="button" class="pr-tog" data-scen="pain" aria-pressed="false">增加功率档位时患者疼痛</button>
      </div>
      <div class="pr-params">
        <div class="pr-param" data-k="level"><span class="pr-param__k">功率档位</span><button type="button" class="pr-pm" data-d="-1" aria-label="减小功率档位">−</button><span class="pr-param__v num"></span><button type="button" class="pr-pm" data-d="1" aria-label="增加功率档位">+</button></div>
        <div class="pr-param" data-k="pulse"><span class="pr-param__k">脉冲时间</span><button type="button" class="pr-pm" data-d="-1" aria-label="减少脉冲时间">−</button><span class="pr-param__v num"></span><button type="button" class="pr-pm" data-d="1" aria-label="增加脉冲时间">+</button></div>
        <div class="pr-param" data-k="cooling"><span class="pr-param__k">制冷强度</span><button type="button" class="pr-pm" data-d="-1" aria-label="减小制冷强度">−</button><span class="pr-param__v num"></span><button type="button" class="pr-pm" data-d="1" aria-label="增加制冷强度">+</button></div>
      </div>
      <div class="pr-dens">
        <div class="pr-dens__v"><span class="num pr-dens__n">0</span><span class="pr-dens__u">J/cm²</span><span class="pr-dens__band chip"><i></i><b></b></span></div>
        <div class="pr-dens__strip"><div class="pr-dens__segs"></div><div class="pr-dens__target"><span>建议区间 16.6 – 31.3</span></div><i class="pr-dens__mk"></i></div>
        <div class="pr-dens__ticks mono"><span>6.3</span><span>16.3</span><span>23.8</span><span>31.3</span><span>38.8</span></div>
      </div>
      <p class="pr-cc__log small" aria-live="polite"></p>
      <span class="tag-src">来源：使用说明书 第 19、21–22 页（图 11.1 / 11.2、能量输出表）</span>
      <p class="disclaimer pr-cc__disc">演练用途，建议文字摘自使用说明书。用户始终负责选择适当、安全的能量密度；实际参数须由经培训合格的医务人员结合患者情况判断。</p>
    </div>
  </div>
</div>

<div class="wrap pr-block" id="pr-rules">
  <div class="pr-bhead" data-reveal>
    <p class="pr-kicker"><span class="mono">KEY RULES</span>关键操作要点</p>
    <h3 class="h2">四件每一次都要做对的事</h3>
  </div>
  <div class="pr-rules">
    <article class="pr-rule card" data-reveal>
      <div class="pr-rule__vis pr-rv-timer">${dialSVG()}</div>
      <h4 class="h3">同一部位 ≤ 6 次</h4>
      <p class="small">同一部位的治疗最多不超过 6 次，每次间隔应至少大于 60 s。可在上方演练台中查看每一格的累计次数与间隔计时。</p>
      <span class="tag-src">来源：使用说明书 第 20 页</span>
    </article>
    <article class="pr-rule card" data-reveal>
      <div class="pr-rule__vis pr-rv-pad">
        ${bodySVG(`
          <g class="pr-hs" role="button" tabindex="0" data-ok="1" data-t="腰部 / 身体两侧（髋关节以上）" aria-label="腰侧"><circle cx="78" cy="115" r="9"/></g>
          <g class="pr-hs" role="button" tabindex="0" data-ok="1" data-t="腰部 / 身体两侧（髋关节以上）" aria-label="另一侧腰侧"><circle cx="42" cy="115" r="9"/></g>
          <g class="pr-hs" role="button" tabindex="0" data-ok="0" data-t="头部区域" aria-label="头部"><circle cx="60" cy="20" r="9"/></g>
          <g class="pr-hs" role="button" tabindex="0" data-ok="0" data-t="颈部" aria-label="颈部"><circle cx="60" cy="43" r="7"/></g>
          <g class="pr-hs" role="button" tabindex="0" data-ok="0" data-t="肩部" aria-label="肩部"><circle cx="32" cy="55" r="8"/></g>
          <g class="pr-hs" role="button" tabindex="0" data-ok="0" data-t="手臂" aria-label="手臂"><circle cx="99" cy="98" r="8"/></g>
          <g class="pr-hs" role="button" tabindex="0" data-ok="0" data-t="腿部" aria-label="腿部"><circle cx="47" cy="196" r="9"/></g>`)}
        <p class="pr-rv-pad__out mono" aria-live="polite">点按身体部位试试</p>
      </div>
      <h4 class="h3">中性电极片的位置</h4>
      <p class="small">贴于血管丰富、平坦、无毛发、干燥的腰部或身体两侧（髋关节以上），整片完全接触皮肤；不要贴在肩部、颈部、头部、腿部或手臂上。</p>
      <span class="tag-src">来源：使用说明书 第 18 页</span>
    </article>
    <article class="pr-rule card" data-reveal>
      <div class="pr-rule__vis pr-rv-gel">
        <div class="pr-rv-gel__tip"></div>
        <div class="pr-rv-gel__gel"><i></i><i></i><i></i></div>
        <div class="pr-rv-gel__skin"></div>
        <p class="pr-rv-gel__st mono" aria-live="polite">耦合剂充足</p>
        <button type="button" class="pr-rv-gel__btn">重涂耦合剂</button>
      </div>
      <h4 class="h3">耦合剂：足量、全程</h4>
      <p class="small">治疗前在目标部位足量涂敷，整个治疗期间重复涂敷；目视变干或呈粘胶/凝胶状时，清洁后重新涂敷。</p>
      <span class="tag-src">来源：使用说明书 第 20 页</span>
    </article>
    <article class="pr-rule card" data-reveal>
      <div class="pr-rule__vis pr-rv-press">
        <svg viewBox="0 0 200 130" aria-hidden="true">
          <line class="skin" x1="10" y1="112" x2="190" y2="112"/>
          <g class="hp"><rect class="body" x="84" y="10" width="32" height="70" rx="14"/><rect class="head" x="80" y="78" width="40" height="20" rx="4"/><rect class="face" x="82" y="96" width="36" height="4" rx="1"/></g>
          <g class="arcs"><path d="M100 40A60 60 0 0 1 150 70"/></g>
          <text class="deg" x="150" y="36">0°</text>
        </svg>
        <div class="pr-rv-press__ctl">
          <label class="field"><span class="field__row"><span class="field__label">倾角</span><span class="field__val pr-rv-ang">0°</span></span><input class="range pr-rv-range" type="range" min="-30" max="30" step="1" value="0" aria-label="手具倾角"></label>
          <div class="seg" role="group" aria-label="接触压力"><button type="button" data-press="low" aria-pressed="false">压力不足</button><button type="button" data-press="ok" aria-pressed="true">压力适当</button></div>
        </div>
        <p class="pr-rv-press__st mono" aria-live="polite"></p>
      </div>
      <h4 class="h3">垂直按压 · 适当压力</h4>
      <p class="small">手具与皮肤表面保持垂直；治疗仪感测到头端适当接触后才传送射频能量脉冲，接触压力太低会停止正在传送的射频能量。</p>
      <span class="tag-src">来源：使用说明书 第 15、20 页</span>
    </article>
  </div>
  <p class="disclaimer pr-rules__disc" data-reveal>以上图示为原理示意：耦合剂变干速度、倾角判定阈值等动画参数仅用于演示，不代表设备实际判定逻辑；操作以使用说明书为准。</p>
</div>`;

    initJourney(root, ctx, PH);
    initPlanner(root, ctx);
    initCoach(root, ctx);
    initRules(root, ctx);
  },
};

/* ======================================================================= */
/* Journey — pinned horizontal timeline (desktop) / snap carousel (mobile)  */
function initJourney(root, ctx, PH) {
  const { gsap, ScrollTrigger } = ctx;
  const sec = root.querySelector('.pr-journey');
  const viewport = sec.querySelector('.pr-viewport');
  const track = sec.querySelector('.pr-track');
  const cards = [...track.children];
  const nodes = [...sec.querySelectorAll('.pr-rail__node')];
  const bar = sec.querySelector('.pr-rail__bar i');
  const cur = sec.querySelector('.pr-rail__cur');
  let active = -1, st = null, target = -1, targetT = 0;

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
    nodes.forEach((n, k) => {
      n.classList.toggle('is-active', k === i);
      n.classList.toggle('is-past', k < i);
      if (k === i) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current');
    });
    cur.textContent = `${PH[i].n} · ${PH[i].t}`;
    sec.querySelectorAll('.pr-jnav button').forEach((b) => { b.disabled = (+b.dataset.step < 0 && i === 0) || (+b.dataset.step > 0 && i === cards.length - 1); });
  };
  const setProgress = (p) => { bar.style.transform = `scaleX(${Math.max(0.0001, p)})`; };
  ctx.lib.whenVisible(sec, () => sec.classList.add('is-live'), () => sec.classList.remove('is-live'));
  setActive(0);
  setProgress(0);

  const padL = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
  const goTo = (i) => {
    if (st) {
      const y = st.start + (st.end - st.start) * (i / (cards.length - 1)) + 2;
      if (ctx.lenis) ctx.lenis.scrollTo(y, { duration: 1.2 });
      else window.scrollTo({ top: y, behavior: ctx.reduced ? 'auto' : 'smooth' });
    } else {
      // remember the destination so rapid ‹ › taps during a smooth scroll step from it, not from an intermediate card
      target = i;
      clearTimeout(targetT);
      targetT = setTimeout(() => { target = -1; sync(); }, 1400);
      viewport.scrollTo({ left: cards[i].offsetLeft - padL(), behavior: ctx.reduced ? 'auto' : 'smooth' });
      setActive(i);
    }
  };
  nodes.forEach((n, i) => n.addEventListener('click', () => goTo(i)));
  const navBtns = [...sec.querySelectorAll('.pr-jnav button')];
  navBtns.forEach((b) => b.addEventListener('click', () => goTo(Math.max(0, Math.min(cards.length - 1, (target >= 0 ? target : active) + +b.dataset.step)))));
  cards.forEach((c, i) => c.addEventListener('click', () => { if (i !== active) goTo(i); }));

  const sync = () => {
    if (st) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    setProgress(max > 0 ? viewport.scrollLeft / max : 0);
    const x = viewport.scrollLeft + padL();
    let best = 0, bd = Infinity;
    cards.forEach((c, k) => { const d = Math.abs(c.offsetLeft - x); if (d < bd) { bd = d; best = k; } });
    if (viewport.scrollLeft >= max - 4) best = cards.length - 1;
    if (target >= 0) { if (best !== target) return; target = -1; }
    setActive(best);
  };
  viewport.addEventListener('scroll', sync, { passive: true });

  if (ctx.reduced) return;
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1000px) and (min-height: 700px)', () => {
    sec.classList.add('is-pin');
    // if the pinned stage can't fit the viewport (short / narrow screens), drop the card illustrations
    const fit = () => {
      sec.classList.remove('is-tight');
      const pad = parseFloat(getComputedStyle(sec).paddingTop) || 0;
      const need = pad + [...sec.children].reduce((h, c) => { const cs = getComputedStyle(c); return h + c.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0); }, 0);
      sec.classList.toggle('is-tight', need > window.innerHeight - 8);
    };
    fit();
    ScrollTrigger.addEventListener('refreshInit', fit);
    const dist = () => Math.max(0, track.offsetWidth - viewport.clientWidth);
    const tween = gsap.to(track, { x: () => -dist(), ease: 'none' });
    st = ScrollTrigger.create({
      trigger: sec,
      start: 'top top',
      end: () => '+=' + Math.round(Math.min(Math.max(dist() * 1.15, window.innerHeight * 0.9), window.innerHeight * 2.2)),
      pin: true,
      pinSpacing: true,
      scrub: 0.7,
      animation: tween,
      invalidateOnRefresh: true,
      onUpdate: (s) => { setProgress(s.progress); setActive(Math.round(s.progress * (cards.length - 1))); },
    });
    return () => { st = null; ScrollTrigger.removeEventListener('refreshInit', fit); sec.classList.remove('is-pin', 'is-tight'); gsap.set(track, { x: 0 }); };
  });
}

/* ======================================================================= */
/* Planner — SVG face grid with per-cell pass counter + interval rule        */
function initPlanner(root, ctx) {
  const { gsap, lib, data } = ctx;
  const P = data.protocol;
  const host = root.querySelector('.pr-plan');
  const svgEl = host.querySelector('.pr-face__svg');
  const skinEl = svgEl.querySelector('.pr-skin');
  const heatG = svgEl.querySelector('.pr-heatlayer');
  const latG = svgEl.querySelector('.pr-lattice');
  const zonesG = svgEl.querySelector('.pr-zones');
  const cellsG = svgEl.querySelector('.pr-cells');
  const labelsG = svgEl.querySelector('.pr-labels');
  const tip = svgEl.querySelector('.pr-tip');
  const tipWrap = svgEl.querySelector('.pr-tipwrap');
  const tipHeat = tip.querySelector('.pr-tip__heat');
  const tipFace = tip.querySelector('.pr-tip__face');
  const kbdRect = svgEl.querySelector('.pr-kbd');
  const toastEl = host.querySelector('.pr-toast');
  const clockT = host.querySelector('.pr-clock__t');
  const phaseSt = host.querySelector('.pr-phase__st');
  const phaseSegs = [...host.querySelectorAll('.pr-phase__bar span')];
  const insp = host.querySelector('.pr-insp');
  const chips = [...host.querySelectorAll('.pr-chip')];
  const autoBtn = host.querySelector('.pr-auto');
  const stat = (k) => host.querySelector(`[data-s="${k}"]`);

  // --- sample the skin outline into a polygon
  const L = skinEl.getTotalLength();
  const poly = [];
  for (let i = 0; i < 240; i++) { const p = skinEl.getPointAtLength((L * i) / 240); poly.push([p.x, p.y]); }

  // --- lattice (2 cm grid) clipped to the skin
  let ld = '';
  for (let c = 0; c <= NCOL; c++) ld += `M${X0 + c * CELL} 60V500`;
  for (let r = 0; r <= NROW; r++) ld += `M40 ${Y0 + r * CELL}H360`;
  lib.svg('path', { d: ld }, latG);

  // --- cells
  const cells = [];
  for (let r = 0; r < NROW; r++) {
    for (let c = 0; c < NCOL; c++) {
      const x = X0 + c * CELL, y = Y0 + r * CELL;
      let inSkin = 0, inOrb = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const px = x + (CELL * (1 + 2 * i)) / 6, py = y + (CELL * (1 + 2 * j)) / 6;
        if (pip(poly, px, py)) inSkin++;
        if (inEye(px, py)) inOrb++;
      }
      if (inSkin < 5) continue;
      const nogo = inOrb >= 2;
      const zone = nogo ? 'eye' : zoneOf(x + 20, y + 20);
      if (!zone) continue;
      cells.push({ r, c, x, y, cx: x + 20, cy: y + 20, zone, nogo, passes: 0, last: -1e9, cd: false });
    }
  }
  const CIRC = 2 * Math.PI * 11;
  cells.forEach((cell, idx) => {
    cell.heat = lib.svg('rect', { x: cell.x + 0.5, y: cell.y + 0.5, width: 39, height: 39, rx: 3, class: 'pr-heat', fill: 'transparent', opacity: 0 }, heatG);
    const g = lib.svg('g', { class: 'pr-cell pr-cell--' + cell.zone + (cell.nogo ? ' is-nogo' : ''), 'data-i': idx, transform: `translate(${cell.x} ${cell.y})` }, cellsG);
    lib.svg('rect', { class: 'pr-cell__bg', x: 1, y: 1, width: 38, height: 38, rx: 3 }, g);
    if (cell.nogo) {
      lib.svg('path', { class: 'pr-cell__x', d: 'M15 15L25 25M25 15L15 25' }, g);
    } else {
      cell.cdEl = lib.svg('circle', { class: 'pr-cell__cd', cx: 20, cy: 17, r: 11, 'stroke-dasharray': CIRC.toFixed(2), 'stroke-dashoffset': CIRC.toFixed(2), transform: 'rotate(-90 20 17)' }, g);
      cell.txt = lib.svg('text', { class: 'pr-cell__n', x: 20, y: 21.5, 'text-anchor': 'middle' }, g);
      cell.pips = [];
      for (let k = 0; k < 6; k++) cell.pips.push(lib.svg('circle', { class: 'pr-pip', cx: 7.5 + k * 5, cy: 33, r: 1.5 }, g));
    }
    cell.g = g;
  });
  const treatable = cells.filter((c) => !c.nogo);
  stat('total').textContent = treatable.length;

  // --- zone outlines + labels (outline = union boundary of its cells)
  const zoneEls = {};
  for (const z of ZONE_ORDER) {
    const zc = cells.filter((c) => c.zone === z);
    if (!zc.length) continue;
    const set = new Set(zc.map((c) => c.r * 100 + c.c));
    let d = '';
    for (const c of zc) {
      if (!set.has((c.r - 1) * 100 + c.c)) d += `M${c.x} ${c.y}h40`;
      if (!set.has((c.r + 1) * 100 + c.c)) d += `M${c.x} ${c.y + 40}h40`;
      if (!set.has(c.r * 100 + c.c - 1)) d += `M${c.x} ${c.y}v40`;
      if (!set.has(c.r * 100 + c.c + 1)) d += `M${c.x + 40} ${c.y}v40`;
    }
    const path = lib.svg('path', { class: `pr-zone pr-zone--${ZONES[z].kind}`, d }, zonesG);
    // labels: bilateral zones get one per side
    const groups = ['forehead', 'jaw'].includes(z) ? [zc] : [zc.filter((c) => c.cx < 200), zc.filter((c) => c.cx > 200)];
    const labs = [];
    for (const gcells of groups) {
      if (!gcells.length) continue;
      let lx = gcells.reduce((s, c) => s + c.cx, 0) / gcells.length;
      let ly = gcells.reduce((s, c) => s + c.cy, 0) / gcells.length;
      if (z === 'forehead') ly = Math.min(...gcells.map((c) => c.y)) - 6;
      if (z === 'eye') ly = Math.min(...gcells.map((c) => c.y)) - 6;
      if (z === 'jaw') ly = Math.max(...gcells.map((c) => c.y + 40)) + 16;
      if (z === 'temple') { lx = lx < 200 ? 30 : 370; ly -= 26; }
      if (z === 'zygoma') { lx = lx < 200 ? 30 : 370; ly += 4; }
      if (z === 'cheek') { lx = lx < 200 ? Math.min(...gcells.map((c) => c.x)) - 4 : Math.max(...gcells.map((c) => c.x + 40)) + 4; ly += 10; }
      const lg = lib.svg('g', { class: `pr-lab pr-lab--${ZONES[z].kind}`, transform: `translate(${lx.toFixed(1)} ${ly.toFixed(1)})` }, labelsG);
      const label = z === 'eye' ? '禁区' : ZONES[z].t;
      const w = label.length * 11 + 14;
      const anchor = z === 'cheek' ? (lx < 200 ? 'end' : 'start') : 'middle';
      const rx0 = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0;
      lib.svg('rect', { x: rx0, y: -10, width: w, height: 18, rx: 9 }, lg);
      const t = lib.svg('text', { x: rx0 + w / 2, y: 3.5, 'text-anchor': 'middle' }, lg);
      t.textContent = label;
      labs.push(lg);
    }
    zoneEls[z] = { path, labs, cells: zc };
  }

  // --- state
  let demoT = 0, shots = 0, curZone = null, lockZone = null, kbd = -1, auto = null, lastClockS = -1;
  const setStat = (k, v) => { stat(k).textContent = v; };
  const updStats = () => {
    setStat('cells', treatable.filter((c) => c.passes > 0).length);
    setStat('shots', shots);
    setStat('tip', TIP_SHOTS - shots);
  };

  const setZone = (z) => {
    if (z === curZone) return;
    curZone = z;
    for (const [k, v] of Object.entries(zoneEls)) {
      const on = k === z;
      v.path.classList.toggle('is-on', on);
      v.labs.forEach((l) => l.classList.toggle('is-on', on));
    }
    svgEl.classList.toggle('has-zone', !!z);
    cells.forEach((c) => c.g.classList.toggle('in-zone', c.zone === z));
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === z)));
    renderInsp(z);
  };
  const renderInsp = (z) => {
    const q = (s) => insp.querySelector(s);
    insp.dataset.kind = z ? ZONES[z].kind : '';
    if (!z) {
      q('.pr-insp__en').textContent = 'SELECT A ZONE';
      q('.pr-insp__tag').textContent = '';
      q('.pr-insp__t').textContent = '悬停或点按面部分区';
      q('.pr-insp__txt').textContent = '查看各分区的能量指引。说明书指出：皮下组织较薄部位需减低能量；眼部为禁用区域。';
      q('.pr-insp__meta').textContent = `可治疗 ${treatable.length} 格 ≈ ${treatable.length * 4} cm² · 禁区 ${cells.length - treatable.length} 格`;
      q('.pr-insp__src').textContent = '来源：使用说明书 第 4 页';
      return;
    }
    const Z = ZONES[z], zc = zoneEls[z]?.cells || [];
    q('.pr-insp__en').textContent = Z.en;
    q('.pr-insp__tag').textContent = Z.kind === 'thin' ? '皮下组织较薄 · 需减低能量' : Z.kind === 'nogo' ? '禁用区域' : '按反馈调整能量';
    q('.pr-insp__t').textContent = z === 'eye' ? '眼部禁区' : Z.t;
    if (Z.kind === 'thin') {
      q('.pr-insp__txt').textContent = `在皮下组织较薄部位（${P.lowerEnergyZones.join('、')}）需减低能量。另：治疗浅表神经区域时，用户应特别注意患者的热反馈，并考虑调低功率档位或脉冲时间以调低能量密度。`;
      q('.pr-insp__src').textContent = '来源：使用说明书 第 4、22 页';
    } else if (Z.kind === 'nogo') {
      q('.pr-insp__txt').textContent = `本产品${P.noGo}。`;
      q('.pr-insp__src').textContent = '来源：使用说明书 第 4 页';
    } else {
      q('.pr-insp__txt').textContent = '整个治疗期间，需要经常根据皮肤厚度、治疗区域解剖结构和患者反馈的变化调整能量强度设置；保持热感反馈 2.0 – 3.0。';
      q('.pr-insp__src').textContent = '来源：使用说明书 第 21–22 页';
    }
    if (Z.kind === 'nogo') q('.pr-insp__meta').textContent = `${zc.length} 格被锁定 · 眶缘内区域`;
    else {
      const done = zc.filter((c) => c.passes > 0).length, sum = zc.reduce((s, c) => s + c.passes, 0);
      q('.pr-insp__meta').textContent = `${zc.length} 格 ≈ ${zc.length * 4} cm² · 已治疗 ${done} 格 · 共 ${sum} 发`;
    }
  };
  renderInsp(null);

  let toastTimer = 0;
  const toast = (kind, msg) => {
    toastEl.dataset.kind = kind;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  };

  const paint = (c) => {
    const p = c.passes;
    c.heat.setAttribute('fill', lib.heatCSS(0.28 + (0.72 * p) / 6));
    c.heat.setAttribute('opacity', p ? (0.42 + 0.09 * p).toFixed(2) : 0);
    c.txt.textContent = p ? String(p) : '';
    c.pips.forEach((pp, k) => pp.classList.toggle('on', k < p));
    c.g.classList.toggle('is-max', p >= 6);
    c.g.classList.toggle('is-done', p > 0);
  };

  // pulse animation: 预冷 → 射频 → 后冷 (IFU p.15)
  let tl = null, pending = null;
  const setPhase = (i) => {
    phaseSegs.forEach((s, k) => s.classList.toggle('on', k === i));
    phaseSt.textContent = i < 0 ? '准备就绪' : ['启动 · 治疗前冷却', '启动 · 射频传送', '启动 · 治疗后冷却'][i];
  };
  const animatePulse = (c, fn) => {
    tl?.kill();
    pending?.();
    let fired = false;
    const done = () => { if (fired) return; fired = true; pending = null; fn(); };
    pending = done;
    tipWrap.setAttribute('transform', `translate(${c.x} ${c.y})`);
    if (ctx.reduced) { done(); setPhase(-1); return; }
    const o = { a: 0 };
    tl = gsap.timeline({ onComplete: () => setPhase(-1) });
    tl.set(tip, { attr: { opacity: 1 } })
      .fromTo(tip, { scale: 1.25, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.18, ease: 'power3.out' })
      .call(() => setPhase(0))
      .fromTo(tipFace, { attr: { fill: 'rgba(127,212,255,0)' } }, { attr: { fill: 'rgba(127,212,255,.75)' }, duration: 0.16 })
      .call(() => setPhase(1))
      .fromTo(tipHeat, { attr: { opacity: 0 } }, { attr: { opacity: 0.95 }, duration: 0.22, ease: 'power2.in' })
      .call(done)
      .to(tipHeat, { attr: { opacity: 0 }, duration: 0.2 })
      .call(() => setPhase(2))
      .to(o, { a: 1, duration: 0.18 })
      .to(tip, { attr: { opacity: 0 }, duration: 0.25 })
      .set(tipFace, { attr: { fill: 'rgba(127,212,255,0)' } });
  };

  const deliver = (c, quiet = false) => {
    if (!c) return false;
    if (c.nogo) { toast('nogo', `禁区：本产品${P.noGo}`); flash(c); return false; }
    if (c.passes >= 6) { if (!quiet) { toast('max', '该格已达 6 次：同一部位的治疗最多不超过 6 次'); flash(c); } return false; }
    const since = demoT - c.last;
    if (c.passes > 0 && since <= 60) {
      if (!quiet) { toast('wait', `间隔未满：同一部位每次间隔应大于 60 s，该格还需等待 ${Math.max(1, Math.ceil(60 - since))} s（演示时钟）`); flash(c); }
      return false;
    }
    c.passes++;
    c.last = demoT;
    c.cd = c.passes < 6;
    shots++;
    animatePulse(c, () => { paint(c); if (curZone) renderInsp(curZone); });
    updStats();
    if (!quiet) {
      const Z = ZONES[c.zone];
      toast(Z.kind === 'thin' ? 'thin' : 'ok', `${Z.t} · 第 ${c.passes} 次${Z.kind === 'thin' ? ' · 皮下组织较薄，需减低能量' : ''}${c.passes >= 6 ? ' · 已达上限' : ''}`);
    }
    return true;
  };
  const flash = (c) => {
    clearTimeout(c.shakeT);
    c.g.classList.remove('is-shake');
    void c.g.getBoundingClientRect(); // restart the CSS animation
    c.g.classList.add('is-shake');
    c.shakeT = setTimeout(() => c.g.classList.remove('is-shake'), 700);
  };

  // --- pointer
  const cellFrom = (e) => { const g = e.target.closest?.('.pr-cell'); return g ? cells[+g.dataset.i] : null; };
  cellsG.addEventListener('pointerover', (e) => { const c = cellFrom(e); if (c) setZone(c.zone); });
  svgEl.addEventListener('pointerleave', () => setZone(lockZone));
  cellsG.addEventListener('click', (e) => {
    const c = cellFrom(e);
    if (!c) return;
    lockZone = c.zone;
    setZone(c.zone);
    kbd = cells.indexOf(c);
    deliver(c);
  });
  chips.forEach((b) => {
    const z = b.dataset.zone;
    b.addEventListener('pointerenter', () => setZone(z));
    b.addEventListener('pointerleave', () => setZone(lockZone));
    b.addEventListener('focus', () => setZone(z));
    b.addEventListener('blur', () => setZone(lockZone));
    b.addEventListener('click', () => { lockZone = lockZone === z ? null : z; setZone(lockZone); });
  });

  // --- keyboard: arrows move a cursor between cells, Enter/Space delivers
  const moveKbd = (dr, dc) => {
    const from = cells[kbd] || cells.find((c) => c.zone === 'forehead') || cells[0];
    if (kbd < 0) { kbd = cells.indexOf(from); }
    else {
      let best = null, bd = Infinity;
      for (const c of cells) {
        const r = c.r - from.r, cc = c.c - from.c;
        if ((dr && Math.sign(r) !== dr) || (dc && Math.sign(cc) !== dc)) continue;
        const d = dr ? Math.abs(r) * 10 + Math.abs(cc) : Math.abs(cc) * 10 + Math.abs(r);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) kbd = cells.indexOf(best);
    }
    const c = cells[kbd];
    kbdRect.setAttribute('x', c.x); kbdRect.setAttribute('y', c.y); kbdRect.setAttribute('opacity', 1);
    lockZone = c.zone; setZone(c.zone);
  };
  svgEl.addEventListener('keydown', (e) => {
    const map = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (map[e.key]) { e.preventDefault(); moveKbd(...map[e.key]); }
    else if ((e.key === 'Enter' || e.key === ' ') && cells[kbd]) { e.preventDefault(); deliver(cells[kbd]); }
  });
  svgEl.addEventListener('focus', () => { if (kbd < 0 && svgEl.matches(':focus-visible')) moveKbd(0, 0); });
  svgEl.addEventListener('blur', () => kbdRect.setAttribute('opacity', 0));

  // --- view toggle
  const viewBtns = [...host.querySelectorAll('[data-view]')];
  viewBtns.forEach((b) => b.addEventListener('click', () => {
    const heat = b.dataset.view === 'heat';
    viewBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    svgEl.classList.toggle('is-heatview', heat);
    if (heat) heatG.setAttribute('filter', 'url(#prf-blur)'); else heatG.removeAttribute('filter');
  }));

  // --- auto sweep (serpentine, row by row)
  const order = () => {
    const rows = [...new Set(treatable.map((c) => c.r))].sort((a, b) => a - b);
    return rows.flatMap((r, i) => treatable.filter((c) => c.r === r).sort((a, b) => (i % 2 ? b.c - a.c : a.c - b.c)));
  };
  const setAuto = (on) => {
    auto = on ? { list: order(), i: 0, acc: 0.3 } : null;
    autoBtn.setAttribute('aria-pressed', String(on));
    autoBtn.querySelector('.pr-auto__t').textContent = on ? '暂停演示' : '自动逐格一遍';
  };
  autoBtn.addEventListener('click', () => setAuto(!auto));
  host.querySelector('.pr-reset').addEventListener('click', () => {
    setAuto(false);
    cells.forEach((c) => { if (!c.nogo) { c.passes = 0; c.last = -1e9; c.cd = false; paint(c); c.cdEl.style.opacity = 0; c.g.classList.remove('is-cool'); } });
    shots = 0; updStats(); renderInsp(curZone);
    toast('ok', '已重置：所有格子归零');
  });
  const stepAuto = () => {
    while (auto && auto.i < auto.list.length) {
      const c = auto.list[auto.i++];
      if (c.passes >= 6) continue;
      if (c.passes > 0 && demoT - c.last <= 60) continue;
      deliver(c, true);
      setZone(c.zone);
      return;
    }
    if (auto) {
      const first = auto.list[0];
      const gap = first && first.passes > 0 ? Math.floor(demoT - first.last) : -1;
      const allMax = treatable.every((c) => c.passes >= 6);
      setAuto(false); setZone(lockZone);
      toast(allMax ? 'max' : 'ok', allMax ? '所有格均已达 6 次上限' : gap > 60 ? `逐格一遍完成：回到首格时已间隔 ${gap} s（演示时钟），大于 60 s` : '逐格一遍完成：间隔未满 60 s 的格子已自动跳过');
    }
  };

  lib.whenVisible(host, () => host.classList.add('is-live'), () => host.classList.remove('is-live'));
  // --- loop: demo clock, cooldown rings, auto sweep (paused off-screen)
  lib.visibleLoop(host, (dt) => {
    demoT += dt * SPEED;
    const s = Math.floor(demoT);
    if (s !== lastClockS) { lastClockS = s; clockT.textContent = `T+ ${fmtClock(demoT)}`; }
    for (const c of treatable) {
      if (!c.cd) continue;
      const rem = 60 - (demoT - c.last);
      if (rem <= 0) { c.cd = false; c.cdEl.style.opacity = 0; c.g.classList.remove('is-cool'); continue; }
      c.cdEl.style.opacity = 1;
      c.cdEl.setAttribute('stroke-dashoffset', (CIRC * (1 - rem / 60)).toFixed(2));
      c.g.classList.add('is-cool');
    }
    if (auto) { auto.acc += dt; if (auto.acc >= 0.34) { auto.acc = 0; stepAuto(); } }
  });

  // intro: draw zone outlines softly once visible
  if (!ctx.reduced) {
    lib.whenVisible(svgEl, () => {
      if (svgEl.dataset.intro) return;
      svgEl.dataset.intro = '1';
      gsap.from(cellsG.querySelectorAll('.pr-cell'), { opacity: 0, duration: 0.6, stagger: { each: 0.012, from: 'center' }, ease: 'power2.out' });
      gsap.from(svgEl.querySelectorAll('.art path'), { opacity: 0, duration: 1.2, stagger: 0.02, ease: 'power2.out' });
    }, null, '-10% 0px');
  }
}

/* ======================================================================= */
/* Coach — IFU 图11.1/11.2 gauges + rule engine (IFU p.21–22)                */
function initCoach(root, ctx) {
  const { gsap, lib, data } = ctx;
  const P = data.protocol, D = data.defaults;
  const box = root.querySelector('#pr-coach');
  const cc = box.querySelector('.pr-coachcard');
  const q = (s) => cc.querySelector(s);
  const st = { heat: 1.5, cold: 1, level: D.level, pulse: D.pulse, cooling: D.cooling, want: false, pain: false };
  const r1 = (v) => Math.round(v * 10) / 10;
  const dens = () => lib.density(st.level, st.pulse);
  const band = () => lib.bandOf(dens());

  // ---- gauges
  const gauges = {};
  const mkGauge = (fig) => {
    const heat = fig.dataset.kind === 'heat';
    const labels = heat ? P.heatScale : P.coolScale;
    const max = labels.length - 1;
    const YA = 392, YB = 100;
    const yOf = (v) => YA - (v / max) * (YA - YB);
    const gid = 'pr-g-' + fig.dataset.kind;
    const stops = heat
      ? [0, 0.2, 0.4, 0.6, 0.8, 1].map((o) => `<stop offset="${o}" stop-color="${lib.heatCSS(0.98 - o * 0.86)}"/>`).join('')
      : `<stop offset="0" stop-color="#eef9ff"/><stop offset=".35" stop-color="#7fd4ff"/><stop offset=".75" stop-color="#2a5a8c"/><stop offset="1" stop-color="#0b1030"/>`;
    let ticks = '';
    for (let v = 0; v <= max; v++) {
      const y = yOf(v);
      const inBand = heat && (v === 2 || v === 3);
      ticks += `<line class="tk" x1="92" x2="100" y1="${y}" y2="${y}"/><text class="n" x="68" y="${y + 4}" text-anchor="middle">${v}</text>`;
      if (!heat && (v === 2 || v === 3)) continue;
      ticks += `<text class="lb${inBand ? ' is-band' : ''}" x="106" y="${y + 4.5}">${labels[v]}</text>`;
    }
    if (!heat) ticks += `<path class="brk" d="M103 ${yOf(3)}h5v${yOf(2) - yOf(3)}h-5"/><text class="lb" x="113" y="${(yOf(2) + yOf(3)) / 2 + 4.5}">${labels[2]}</text>`;
    const band = heat ? `<rect class="band" x="45" y="${yOf(3)}" width="46" height="${yOf(2) - yOf(3)}" rx="5"/><text class="bandlb" x="106" y="${(yOf(2) + yOf(3)) / 2 + 4}">目标 2.0–3.0</text>` : '';
    fig.innerHTML = `
      <svg viewBox="0 0 200 420" role="slider" tabindex="0" aria-label="${heat ? '热感反馈' : '冷感反馈'}" aria-valuemin="0" aria-valuemax="${max}">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs>
        <path class="arrow" fill="url(#${gid})" d="M48 74V398Q48 408 58 408H78Q88 408 88 398V74H102L68 12L34 74Z"/>
        <path class="gloss" d="M54 80V396"/>
        ${band}${ticks}
        <g class="mk"><line x1="42" x2="94" y1="0" y2="0"/><rect x="2" y="-12" width="36" height="24" rx="12"/><text x="20" y="4.5" text-anchor="middle">0</text><path d="M38 -5L45 0L38 5Z"/></g>
      </svg>
      <figcaption><b>${heat ? '图 11.1' : '图 11.2'}</b>${heat ? '治疗强度热感反馈量表' : '表皮冷感反馈量表'}</figcaption>`;
    const svg = fig.querySelector('svg');
    const mk = svg.querySelector('.mk');
    const mkT = mk.querySelector('text');
    const key = heat ? 'heat' : 'cold';
    const desc = (v) => Number.isInteger(v) ? labels[v] : `${labels[Math.floor(v)]}–${labels[Math.ceil(v)]}`.replace(/(.+)–\1/, '$1');
    const set = (v, anim) => {
      v = lib.clamp(Math.round(v * 2) / 2, 0, max);
      st[key] = v;
      mkT.textContent = v.toFixed(1);
      svg.setAttribute('aria-valuenow', v);
      svg.setAttribute('aria-valuetext', `${v.toFixed(1)} ${desc(v)}`);
      const y = yOf(v);
      if (anim && !ctx.reduced) gsap.to(mk, { attr: { transform: `translate(0 ${y})` }, duration: 0.35, ease: 'power3.out' });
      else mk.setAttribute('transform', `translate(0 ${y})`);
      svg.classList.toggle('in-band', heat && v >= 2 && v <= 3);
      update();
    };
    const fromEvt = (e) => {
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
      return ((YA - pt.y) / (YA - YB)) * max;
    };
    let drag = false;
    svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); set(fromEvt(e), true); });
    svg.addEventListener('pointermove', (e) => { if (drag) set(fromEvt(e), false); });
    const end = () => { drag = false; };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('keydown', (e) => {
      const d = { ArrowUp: 0.5, ArrowRight: 0.5, ArrowDown: -0.5, ArrowLeft: -0.5 }[e.key];
      if (d) { e.preventDefault(); set(st[key] + d, true); }
    });
    gauges[key] = { set, desc };
  };

  // ---- parameters (exact IFU energy table via lib)
  const canSet = (lv, p) => lv >= 0.5 && lv <= 8 && p >= 0.7 - 1e-9 && p <= 1.5 + 1e-9 && lib.isAllowed(lv, p);
  const change = (k, d) => {
    if (k === 'level') { const n = st.level + 0.5 * d; if (!canSet(n, st.pulse)) return false; st.level = n; st.cooling = band().coolDefault; }
    else if (k === 'pulse') { const n = r1(st.pulse + 0.1 * d); if (!canSet(st.level, n)) return false; st.pulse = n; st.cooling = band().coolDefault; }
    else { const n = st.cooling + d; if (!band().coolRange.includes(n)) return false; st.cooling = n; }
    return true;
  };
  const can = (k, d) => {
    if (k === 'level') return canSet(st.level + 0.5 * d, st.pulse);
    if (k === 'pulse') return canSet(st.level, r1(st.pulse + 0.1 * d));
    return band().coolRange.includes(st.cooling + d);
  };
  const LABEL = { level: '功率档位', pulse: '脉冲时间', cooling: '制冷强度' };
  const fmtV = (k) => (k === 'level' ? `${st.level.toFixed(1)}（${lib.levelPower(st.level)} W）` : k === 'pulse' ? `${st.pulse.toFixed(1)} s` : `${st.cooling}`);
  const htmlV = (k) => (k === 'level' ? `${st.level.toFixed(1)}<small>${lib.levelPower(st.level)} W</small>` : k === 'pulse' ? `${st.pulse.toFixed(1)}<small>s</small>` : `${st.cooling}<small>档</small>`);
  cc.querySelectorAll('.pr-param').forEach((row) => {
    const k = row.dataset.k;
    row.querySelectorAll('.pr-pm').forEach((b) => b.addEventListener('click', () => {
      const before = fmtV(k);
      if (change(k, +b.dataset.d)) { log(`${LABEL[k]} ${before} → ${fmtV(k)}`); update(); bump(); }
    }));
  });

  // band strip
  const segs = q('.pr-dens__segs');
  const DMIN = 6.3, DMAX = 38.8, pct = (v) => ((v - DMIN) / (DMAX - DMIN)) * 100;
  segs.innerHTML = lib.BANDS.map((b, i) => `<span style="left:${pct(i ? lib.BANDS[i - 1].max : DMIN)}%;right:${100 - pct(b.max)}%;background:${b.color}" title="${b.label}"></span>`).join('');
  q('.pr-dens__ticks').querySelectorAll('span').forEach((sp) => { sp.style.left = pct(+sp.textContent) + '%'; });
  const tgt = q('.pr-dens__target');
  tgt.style.left = pct(TARGET_D[0]) + '%';
  tgt.style.right = 100 - pct(TARGET_D[1]) + '%';

  const logEl = q('.pr-cc__log');
  const log = (msg) => { logEl.textContent = msg + ' · 请再次询问患者热感反馈。'; };
  const bump = () => { if (!ctx.reduced) gsap.fromTo(q('.pr-dens__n'), { scale: 1.12 }, { scale: 1, duration: 0.5, ease: 'expo.out' }); };

  // ---- rule engine (IFU p.21–22)
  const ACT = {
    'level-': { t: '减小功率档位', k: 'level', d: -1 },
    'cool+': { t: '加大制冷强度', k: 'cooling', d: 1 },
    'level+': { t: '增加功率档位 +0.5 档', k: 'level', d: 1 },
    'pulse+': { t: '增加脉冲时间 0.1 s', k: 'pulse', d: 1 },
  };
  const advise = () => {
    const h = st.heat, d = dens();
    if (h > 3) return { kind: 'over', badge: '过热', title: '热感高于目标区间', rec: '如果选定的功率档位导致治疗过度，应减小功率档位，或加大制冷强度（以 1 步距），直至获得满意的结果。', acts: ['level-', 'cool+'] };
    if (st.pain) {
      if (d < TARGET_D[0]) return { kind: 'tune', badge: '换一种方式', title: '加功率疼痛，但能量密度过低', rec: `当前能量密度 ${d.toFixed(1)} J/cm² 低于建议区间下限 ${TARGET_D[0]}。如果增加功率档位患者疼痛，但此时能量密度过低，可通过增加脉冲时间（0.1 s 步距）来增加能量密度。`, acts: ['pulse+'] };
      return { kind: 'ok', badge: '已达区间', title: '能量密度已在建议区间内', rec: `当前能量密度 ${d.toFixed(1)} J/cm² 不低于建议区间下限 ${TARGET_D[0]}，“增加脉冲时间”的规则不适用；请以热感反馈为准，保持在 2.0 – 3.0。`, acts: [] };
    }
    if (h >= 2) {
      if (st.want) return { kind: 'ok', badge: '目标区间', title: '舒适，且希望加强治疗效果', rec: '如果选定的功率档位在舒适程度范围内，想要加强治疗效果，可以增加功率档位（按 0.5 档步进逐级增加），并保证患者反馈容易忍受。', acts: ['level+'] };
      return { kind: 'ok', badge: '目标区间', title: '热感处于 2.0 – 3.0', rec: '达到所需效果后，继续以选定的能量强度、制冷强度和脉冲时间传送射频能量，直到完成整个部位的治疗。', acts: [] };
    }
    return { kind: 'low', badge: '低于目标', title: '热感低于目标区间', rec: '热感反馈应保持在 2.0 – 3.0。选定的功率档位在舒适程度范围内时，若需加强治疗效果，可以增加功率档位（按 0.5 档步进逐级增加），并保证患者反馈容易忍受。', acts: ['level+'] };
  };

  const update = () => {
    if (!gauges.heat || !gauges.cold) return;
    const a = advise();
    cc.dataset.kind = a.kind;
    q('.pr-cc__badge').textContent = a.badge;
    q('.pr-cc__read').textContent = `热感 ${st.heat.toFixed(1)} ${gauges.heat.desc(st.heat)} · 冷感 ${st.cold.toFixed(1)} ${gauges.cold.desc(st.cold)}`;
    q('.pr-cc__title').textContent = a.title;
    q('.pr-cc__rec').textContent = a.rec;
    const acts = q('.pr-cc__acts');
    acts.innerHTML = '';
    for (const id of a.acts) {
      const A = ACT[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn pr-act';
      const ok = can(A.k, A.d);
      b.disabled = !ok;
      b.innerHTML = `<span>应用：${A.t}</span>`;
      if (!ok) b.title = '该组合在能量输出表中不可用，或已到达该能量水平的制冷强度范围';
      b.addEventListener('click', () => {
        const before = fmtV(A.k);
        if (change(A.k, A.d)) { log(`已应用：${LABEL[A.k]} ${before} → ${fmtV(A.k)}`); update(); bump(); }
      });
      acts.appendChild(b);
    }
    // params
    cc.querySelectorAll('.pr-param').forEach((row) => {
      const k = row.dataset.k;
      row.querySelector('.pr-param__v').innerHTML = htmlV(k);
      const [m, p] = row.querySelectorAll('.pr-pm');
      m.disabled = !can(k, -1);
      p.disabled = !can(k, 1);
    });
    const dd = dens(), b = band();
    q('.pr-dens__n').textContent = dd.toFixed(1);
    const chip = q('.pr-dens__band');
    chip.style.setProperty('--c', b.hex);
    chip.querySelector('b').textContent = `能量水平 · ${b.label} · 默认制冷 ${b.coolDefault}`;
    q('.pr-dens__mk').style.left = pct(dd) + '%';
    cc.querySelectorAll('[data-scen]').forEach((t) => t.setAttribute('aria-pressed', String(st[t.dataset.scen])));
  };

  cc.querySelectorAll('[data-scen]').forEach((t) => t.addEventListener('click', () => {
    const k = t.dataset.scen;
    st[k] = !st[k];
    if (st[k]) st[k === 'want' ? 'pain' : 'want'] = false;
    update();
  }));

  box.querySelectorAll('.pr-gauge').forEach(mkGauge);
  gauges.heat.set(st.heat, false);
  gauges.cold.set(st.cold, false);
  logEl.textContent = `默认安全参数：功率档位 ${D.level} · 制冷强度 ${D.cooling} · 脉冲时间 ${D.pulse.toFixed(1)}（使用说明书 第 19 页）。`;
}

/* ======================================================================= */
/* Rules — 电极片位置 · 耦合剂 · 垂直按压                                      */
function initRules(root, ctx) {
  const { gsap, lib } = ctx;
  const box = root.querySelector('#pr-rules');

  // 1) interval timeline: light up pips when in view
  const timer = box.querySelector('.pr-rv-timer');
  const tSegs = [...timer.querySelectorAll('.seg')];
  const hand = timer.querySelector('.hand');
  const big = timer.querySelector('.big');
  const paintDial = (n, deg) => {
    tSegs.forEach((sg, i) => { sg.classList.toggle('on', i < n); sg.classList.toggle('last', n === 6 && i === 5); });
    hand.setAttribute('transform', `rotate(${deg} 86 86)`);
    big.textContent = String(Math.max(n, 1));
  };
  if (ctx.reduced) paintDial(6, 0);
  else {
    // one lap = one pass on the same site; each lap stands for an interval > 60 s (principle illustration)
    lib.visibleLoop(timer, (dt, t) => {
      const cyc = t % 8.4;
      const n = Math.min(6, Math.floor(cyc / 1.2) + 1);
      paintDial(n, cyc < 7.2 ? (cyc / 7.2) * 360 : 0);
    });
  }

  // 2) neutral electrode hotspots
  const out = box.querySelector('.pr-rv-pad__out');
  const padVis = box.querySelector('.pr-rv-pad');
  box.querySelectorAll('.pr-hs').forEach((h) => {
    const act = () => {
      const ok = h.dataset.ok === '1';
      box.querySelectorAll('.pr-hs').forEach((x) => x.classList.remove('is-sel'));
      h.classList.add('is-sel');
      padVis.dataset.st = ok ? 'ok' : 'no';
      out.textContent = ok ? `可以：${h.dataset.t}` : `不可以：${h.dataset.t}`;
    };
    h.addEventListener('click', act);
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });

  // 3) coupling gel thins over time → reapply
  const gel = box.querySelector('.pr-rv-gel');
  const gelSt = gel.querySelector('.pr-rv-gel__st');
  const gelBtn = gel.querySelector('.pr-rv-gel__btn');
  let gelT = 0, gelOn = false;
  const refill = () => {
    gel.classList.remove('is-dry');
    gel.classList.add('is-fresh');
    gelSt.textContent = '耦合剂充足';
    clearTimeout(gelT);
    requestAnimationFrame(() => requestAnimationFrame(() => gel.classList.remove('is-fresh')));
    if (!ctx.reduced) gelT = setTimeout(() => { gel.classList.add('is-dry'); gelSt.textContent = '已变干 → 清洁后重新涂敷'; }, 9000);
  };
  gelBtn.addEventListener('click', refill);
  lib.whenVisible(gel, () => { if (!gelOn) { gelOn = true; refill(); } });

  // 4) perpendicular + pressure
  const press = box.querySelector('.pr-rv-press');
  const hp = press.querySelector('.hp');
  const range = press.querySelector('.pr-rv-range');
  const angEl = press.querySelector('.pr-rv-ang');
  const degT = press.querySelector('.deg');
  const stEl = press.querySelector('.pr-rv-press__st');
  let pressure = 'ok';
  const upd = () => {
    const a = +range.value;
    range.style.setProperty('--p', ((a + 30) / 60) * 100 + '%');
    angEl.textContent = `${a > 0 ? '+' : ''}${a}°`;
    degT.textContent = `${Math.abs(a)}°`;
    const lift = pressure === 'low' ? -10 : 0;
    hp.setAttribute('transform', `translate(0 ${lift}) rotate(${a} 100 100)`);
    const vertical = Math.abs(a) <= 2;
    let s, k;
    if (pressure === 'low') { s = '接触压力太低 → 停止射频传送'; k = 'no'; }
    else if (!vertical) { s = '未垂直 → 请保持手具垂直'; k = 'warn'; }
    else { s = '接触良好 · 可传送射频能量脉冲'; k = 'ok'; }
    press.dataset.st = k;
    stEl.textContent = s;
  };
  range.addEventListener('input', upd);
  press.querySelectorAll('[data-press]').forEach((b) => b.addEventListener('click', () => {
    pressure = b.dataset.press;
    press.querySelectorAll('[data-press]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    upd();
  }));
  upd();
}
