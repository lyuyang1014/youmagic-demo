// #clinical — 临床数据 (light "lab" theme, modelled on 彩页 p.3)
// Facts: DATA.study (使用说明书 p.32–33) + DATA.charts (彩页 p.3). Estimated values (GAIS, FWCS 跨级) are always labelled “≈ 估读”.
// Comparator is only ever referred to as “对照器械（已上市单极射频治疗系统）/ 对照组”.

const COL = { ym: '#1f7a57', ctl: '#a4aaa7' };
const GAIS_C = ['#0f5c3d', '#2e9e6a', '#8fd0a8', '#c9cecb', '#c0694e'];
const SHIFT_YM = ['#0f5c3d', '#2e9e6a', '#8fd0a8']; // >3分, 2分, 1分
const SHIFT_CT = ['#4f5552', '#878d8a', '#c3c8c5'];
// src: 彩页 p.3 — FWCS 评分原则示意为 1–9 分（3×3 照片 1分…9分）；入组 3–6 分
const FWCS_MAX = 9;
// src: 使用说明书 p.32 — 评价时间点：治疗后第 30、90、180 天
const DAYS = [30, 90, 180];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt2 = (v) => v.toFixed(2);

export default {
  id: 'clinical',
  nav: '临床数据',
  async init(root, ctx) {
    const { data } = ctx;
    const S = data.study, C = data.charts;

    root.innerHTML = `
<div class="cl-strip" aria-hidden="true"><span>临床研究</span></div>
<div class="wrap">
  <header class="sec-head">
    <span class="eyebrow">10 · CLINICAL EVIDENCE</span>
    <h2 class="h1"><span class="grad-text num cl-hero-n">${S.n}</span> 例注册临床研究</h2>
    <p class="lead">YOUMAGIC 高能单极射频，用于减轻面部轻、中度皮肤皱纹。注册临床试验以对照器械（已上市单极射频治疗系统）为对照，采用${S.design.slice(0, 5).join('、')}的非劣效性设计，随访 6 个月（${S.followUpDays} 天）。</p>
  </header>

  <div class="cl-stats" data-reveal>
    <div class="cl-stat"><span class="cl-stat__v num" data-count="${S.n}">${S.n}</span><span class="cl-stat__u">例</span><span class="cl-stat__k">入选受试者</span></div>
    <div class="cl-stat"><span class="cl-stat__v num" data-count="${S.centers.length}">${S.centers.length}</span><span class="cl-stat__u">家</span><span class="cl-stat__k">医学临床中心</span></div>
    <div class="cl-stat"><span class="cl-stat__v num" data-count="${S.followUpDays}">${S.followUpDays}</span><span class="cl-stat__u">天</span><span class="cl-stat__k">随访时间（6 个月）</span></div>
    <div class="cl-stat"><span class="cl-stat__v num" data-count="${DAYS.length}">${DAYS.length}</span><span class="cl-stat__u">个</span><span class="cl-stat__k">评价时间点 · 第 ${DAYS.join(' / ')} 天</span></div>
  </div>

  <section class="cl-design card" data-reveal aria-label="研究设计">
    <div class="cl-design__head">
      <p class="cl-kicker"><span class="mono">STUDY DESIGN</span>研究设计</p>
      <ul class="cl-tags">${S.design.map((d, i) => `<li style="--i:${i}"><i></i>${d}</li>`).join('')}</ul>
    </div>
    <div class="cl-flow">
      <div class="cl-node cl-node--in">
        <span class="cl-node__k mono">ENROLL</span>
        <b><span class="num">${S.n}</span> 例入组</b>
        <small>FWCS 3–6 分<br>Fitzpatrick II–V 型<br>30–60 周岁 · 性别不限</small>
      </div>
      <div class="cl-rand" title="随机分组"><span class="mono">R</span><em>随机</em></div>
      <div class="cl-lanes">
        <div class="cl-pair">
        ${['ym', 'ctl'].map((k) => `
        <div class="cl-lane cl-lane--${k}">
          <div class="cl-lane__name"><i></i><b>${k === 'ym' ? 'YOUMAGIC 组' : '对照组'}</b><span>${k === 'ym' ? '高能单极射频' : '对照器械 · 已上市单极射频治疗系统'}</span></div>
          <div class="cl-lane__track">
            <span class="cl-lane__line"></span>
            <span class="cl-lane__flow"><i></i><i></i><i></i></span>
            ${DAYS.map((d) => `<span class="cl-lane__dot" style="left:${(d / 180) * 100}%"></span>`).join('')}
          </div>
        </div>`).join('')}
        </div>
        <div class="cl-axis mono"><span style="left:0">D0</span>${DAYS.map((d, i) => `<span style="left:${(d / 180) * 100}%">D${d}<em>${['1 个月', '3 个月', '6 个月'][i]}</em></span>`).join('')}</div>
      </div>
      <div class="cl-node cl-node--out">
        <span class="cl-node__k mono">BLINDED ASSESSMENT</span>
        <b>盲法评价</b>
        <small>面部皱纹改善有效率<br>FWCS 皱纹评分</small>
        <span class="cl-node__ni">非劣效性检验</span>
      </div>
    </div>
    <div class="cl-crit">
      <div class="cl-critem">
        <p class="cl-critem__k">FWCS 皱纹评分 <span class="mono">1–${FWCS_MAX}</span></p>
        <div class="cl-scale cl-scale--fwcs">${Array.from({ length: FWCS_MAX }, (_, i) => `<span class="${i + 1 >= 3 && i + 1 <= 6 ? 'on' : ''}">${i + 1}</span>`).join('')}</div>
        <p class="cl-critem__v">入组 <b>3 – 6 分</b></p>
      </div>
      <div class="cl-critem">
        <p class="cl-critem__k">Fitzpatrick 皮肤分级 <span class="mono">I–VI</span></p>
        <div class="cl-scale cl-scale--fitz">${['I', 'II', 'III', 'IV', 'V', 'VI'].map((r, i) => `<span class="${i >= 1 && i <= 4 ? 'on' : ''}" style="--t:${i}"><em>${r}</em></span>`).join('')}</div>
        <p class="cl-critem__v">入组 <b>II – V 型</b><span class="micro">（色块为示意）</span></p>
      </div>
      <div class="cl-critem">
        <p class="cl-critem__k">年龄 <span class="mono">岁</span></p>
        <div class="cl-scale cl-scale--age"><i class="band"></i>${[20, 30, 40, 50, 60, 70].map((a) => `<span style="left:${((a - 20) / 50) * 100}%">${a}</span>`).join('')}</div>
        <p class="cl-critem__v">入组 <b>30 – 60 周岁</b> · 性别不限</p>
      </div>
      <div class="cl-critem cl-critem--ep">
        <p class="cl-critem__k">评价指标</p>
        <ol class="cl-ep">
          <li><b>面部皱纹改善有效率</b><span>治疗后第 30、90、180 天</span></li>
          <li><b>FWCS 皱纹评分</b><span>治疗后第 30、90、180 天</span></li>
        </ol>
      </div>
    </div>
    <p class="tag-src">来源：使用说明书 第 32 页（15. 临床试验数据）· FWCS 评分原则：产品彩页 第 3 页</p>
  </section>

  <section class="cl-verdict" data-reveal aria-label="研究结论">
    <div class="cl-verdict__mark" aria-hidden="true">
      <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29"/><path d="M19 33l9 9 17-19"/></svg>
    </div>
    <div class="cl-verdict__body">
      <p class="cl-verdict__k mono">CONCLUSION · 研究结论</p>
      <p class="cl-verdict__t">治疗后第 30、90、180 天面部皱纹改善有效率及 FWCS 皱纹评分等，<span class="cl-verdict__hl">均非劣于对照器械<svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8C60 3 140 2 298 6"/></svg></span>，治疗效果与对照器械差异无统计学意义。</p>
      <p class="tag-src">来源：使用说明书 第 32–33 页 · 前瞻性、多中心、随机、平行对照、盲法评价、非劣效性设计</p>
    </div>
  </section>

  <section class="cl-centers" data-reveal aria-label="临床中心">
    <div class="cl-centers__head">
      <p class="cl-kicker"><span class="mono">MULTICENTER</span>四大医学临床中心</p>
      <p class="small">多中心入组 · 统一方案 · 盲法评价</p>
    </div>
    <div class="cl-centers__row">
      <svg class="cl-centers__link" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 1000 10"><line x1="125" y1="5" x2="875" y2="5"/><line class="pulse" x1="125" y1="5" x2="875" y2="5"/></svg>
      ${S.centers.map((c, i) => `
      <figure class="cl-center" style="--i:${i}">
        <div class="cl-seal">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring" cx="60" cy="60" r="57"/><circle class="ring2" cx="60" cy="60" r="57"/></svg>
          <img src="assets/img/center-${i + 1}.webp" alt="${esc(c)} 院徽" width="180" height="182" loading="lazy" decoding="async">
        </div>
        <figcaption><span class="mono">0${i + 1}</span>${esc(c)}</figcaption>
      </figure>`).join('')}
    </div>
    <p class="tag-src">来源：产品彩页 第 5 页</p>
  </section>

  <section class="cl-charts" aria-label="临床数据图表">
    <div class="cl-charts__head" data-reveal>
      <p class="cl-kicker"><span class="mono">DATA</span>数据呈现</p>
      <h3 class="h2">逐项查看两组数据</h3>
      <div class="cl-ni">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>
        <p>以下为注册临床研究中两组的数值呈现（彩页第 3 页）。本研究为<b>非劣效性设计</b>：结论为 YOUMAGIC 各评价指标均非劣于对照器械、治疗效果差异无统计学意义；图中数值差异不代表统计学优效。</p>
      </div>
      <div class="legend cl-legend"><span><i style="background:${COL.ym}"></i>YOUMAGIC</span><span><i style="background:${COL.ctl}"></i>对照组（已上市单极射频治疗系统）</span></div>
    </div>

    <div class="cl-group">
      <div class="cl-group__head" data-reveal><span class="cl-group__l num">A</span><div><h4 class="h3">面部皱纹改善有效率 · GAIS 全局美容效果评价</h4><p class="small">依据盲评结果；治疗后 1、3、6 个月</p></div></div>

      <figure class="cl-fig card" id="cl-fig-eff" data-reveal>
        <div class="cl-fig__main">
          <div class="cl-fig__bar">
            <figcaption><b>总有效率</b><span class="cl-badge cl-badge--print">印刷数值</span></figcaption>
            <div class="seg cl-axis-tog" role="group" aria-label="纵轴范围"><button type="button" data-axis="full" aria-pressed="true">完整坐标 0–100%</button><button type="button" data-axis="zoom" aria-pressed="false">放大 50–100%</button></div>
          </div>
          <div class="cl-chart" data-h="300"></div>
          <p class="cl-fig__note micro cl-zoomnote" hidden>放大视图纵轴自 50% 起（同彩页），柱高差异被放大，请以数值为准。</p>
          <details class="cl-table"><summary>查看数据表</summary>
            <table><thead><tr><th>组别</th>${C.efficacy.months.map((m) => `<th>${m}</th>`).join('')}</tr></thead>
            <tbody><tr><td>YOUMAGIC</td>${C.efficacy.youmagic.map((v) => `<td>${fmt2(v)}%</td>`).join('')}</tr><tr><td>对照组</td>${C.efficacy.control.map((v) => `<td>${fmt2(v)}%</td>`).join('')}</tr></tbody></table>
          </details>
        </div>
        <aside class="cl-fig__aside">
          <p class="cl-def"><b>有效率</b>${esc(C.efficacyDef.replace(/^有效率：/, ''))}</p>
          <p class="cl-def cl-def--muted">3 个月的有效率与下方 GAIS 分值占比中 “≤ 3 分” 部分对应——可在该图切换 “按有效率合并” 查看。</p>
          <span class="cl-ni-chip">非劣效性设计 · 差异无统计学意义</span>
        </aside>
      </figure>

      <figure class="cl-fig card" id="cl-fig-gais" data-reveal>
        <div class="cl-fig__main">
          <div class="cl-fig__bar">
            <figcaption><b>GAIS 分值占比 · 3 个月</b><span class="cl-badge cl-badge--est">≈ 估读</span></figcaption>
            <div class="seg" role="group" aria-label="显示方式"><button type="button" data-mode="seg" aria-pressed="true">按分值</button><button type="button" data-mode="merge" aria-pressed="false">按有效率合并（≤ 3 分）</button></div>
          </div>
          <div class="legend cl-gais-legend">${C.gaisScale.map((t, i) => `<span data-g="${i}"><i style="background:${GAIS_C[i]}"></i>${i + 1} 分</span>`).join('')}</div>
          <div class="cl-chart" data-h="190"></div>
          <details class="cl-table"><summary>查看数据表</summary>
            <table><thead><tr><th>组别</th>${C.gais.scores.map((s) => `<th>${s}</th>`).join('')}<th>≤ 3 分（有效率）</th></tr></thead>
            <tbody><tr><td>YOUMAGIC</td>${C.gais.youmagic.map((v) => `<td>≈ ${v}%</td>`).join('')}<td>${fmt2(C.efficacy.youmagic[1])}%</td></tr><tr><td>对照组</td>${C.gais.control.map((v) => `<td>≈ ${v}%</td>`).join('')}<td>${fmt2(C.efficacy.control[1])}%</td></tr></tbody></table>
            <p class="micro">分值占比为柱高估读（约 ±1.5 个百分点）；“≤ 3 分”列为彩页印刷的 3 个月总有效率。</p>
          </details>
        </div>
        <aside class="cl-fig__aside">
          <p class="cl-def-k">全局美容效果评价（GAIS 评分）</p>
          <table class="cl-gais-tbl"><thead><tr><th>分级</th><th>全局美容效果</th></tr></thead>
            <tbody>${C.gaisScale.map((t, i) => `<tr data-g="${i}"><td><i style="background:${GAIS_C[i]}"></i>${i + 1}</td><td>${t}</td></tr>`).join('')}</tbody></table>
          <p class="cl-def cl-def--muted">GAIS ≤ 3 分（改善非常明显 / 改善明显 / 有一定程度改善）计为有效。</p>
        </aside>
      </figure>
    </div>

    <div class="cl-group">
      <div class="cl-group__head" data-reveal><span class="cl-group__l num">B</span><div><h4 class="h3">FWCS 皱纹等级评价</h4><p class="small">Fitzpatrick 皱纹量表（FWCS）；筛选期入组 3–6 分</p></div></div>

      <figure class="cl-fig card" id="cl-fig-shift" data-reveal>
        <div class="cl-fig__main">
          <div class="cl-fig__bar">
            <figcaption><b>FWCS 与基线相比跨级分数占比</b><span class="cl-badge cl-badge--est">≈ 估读</span></figcaption>
            <div class="seg" role="group" aria-label="显示方式"><button type="button" data-mode="seg" aria-pressed="true">按跨级分数</button><button type="button" data-mode="total" aria-pressed="false">总跨级率</button></div>
          </div>
          <div class="legend cl-shift-legend">
            ${C.fwcsShift.keys.map((k, i) => `<span><i style="background:${SHIFT_YM[i]}"></i><i style="background:${SHIFT_CT[i]};margin-left:-4px"></i>跨级 ${k}</span>`).join('')}
            <span class="micro">绿色 = YOUMAGIC · 灰色 = 对照组</span>
          </div>
          <div class="cl-chart" data-h="320"></div>
          <details class="cl-table"><summary>查看数据表</summary>
            <table><thead><tr><th>时间</th><th>组别</th>${C.fwcsShift.keys.map((k) => `<th>${k}</th>`).join('')}<th>合计</th></tr></thead>
            <tbody>${C.fwcsShift.months.map((m, i) => ['youmagic', 'control'].map((g) => { const a = C.fwcsShift[g][i]; return `<tr><td>${m}</td><td>${g === 'youmagic' ? 'YOUMAGIC' : '对照组'}</td>${a.map((v) => `<td>≈ ${v}%</td>`).join('')}<td>≈ ${+(a[0] + a[1] + a[2]).toFixed(1)}%</td></tr>`; }).join('')).join('')}</tbody></table>
            <p class="micro">数值为柱高估读（合计约 ±2.5、分段约 ±1.5 个百分点）。</p>
          </details>
        </div>
        <aside class="cl-fig__aside">
          <p class="cl-def"><b>跨级分数</b>= 基线期的分值 − 随访时间的分值</p>
          <p class="cl-def"><b>跨级分数占比</b>跨级的差值分数所对应的例数 / 每组总例数</p>
          <p class="cl-def cl-def--muted">意义：跨级分值越大说明改善效果越明显。</p>
          <div class="cl-calc" aria-label="跨级分数计算示例">
            <p class="cl-def-k">算一算</p>
            <div class="cl-calc__row"><span>基线期</span><button type="button" data-c="b" data-d="-1" aria-label="基线期分值减一">−</button><b class="num" data-v="b">5</b><button type="button" data-c="b" data-d="1" aria-label="基线期分值加一">+</button></div>
            <div class="cl-calc__row"><span>随访时</span><button type="button" data-c="f" data-d="-1" aria-label="随访分值减一">−</button><b class="num" data-v="f">3</b><button type="button" data-c="f" data-d="1" aria-label="随访分值加一">+</button></div>
            <div class="cl-ladder" aria-hidden="true">${Array.from({ length: FWCS_MAX }, (_, i) => `<span data-s="${i + 1}">${i + 1}</span>`).join('')}<i class="cl-ladder__span"></i></div>
            <p class="cl-calc__out" aria-live="polite"></p>
          </div>
        </aside>
      </figure>

      <figure class="cl-fig card" id="cl-fig-mean" data-reveal>
        <div class="cl-fig__main">
          <div class="cl-fig__bar">
            <figcaption><b>FWCS 皱纹评分均值</b><span class="cl-badge cl-badge--print">印刷数值</span></figcaption>
            <div class="seg" role="group" aria-label="纵轴范围"><button type="button" data-axis="zoom" aria-pressed="true">放大 3.6–4.8</button><button type="button" data-axis="full" aria-pressed="false">量表全程 1–9</button></div>
          </div>
          <div class="cl-chart" data-h="300"></div>
          <p class="cl-fig__note micro cl-zoomnote">放大视图纵轴自 3.6 起（量表为 1–9 分），两组差异被放大，请以数值为准。</p>
          <details class="cl-table"><summary>查看数据表</summary>
            <table><thead><tr><th>组别</th>${C.fwcs.points.map((p) => `<th>${p}</th>`).join('')}</tr></thead>
            <tbody><tr><td>YOUMAGIC</td>${C.fwcs.youmagic.map((v) => `<td>${fmt2(v)}</td>`).join('')}</tr><tr><td>对照组</td>${C.fwcs.control.map((v) => `<td>${fmt2(v)}</td>`).join('')}</tr></tbody></table>
            <p class="micro">悬停提示中的“较筛选期”变化量由印刷数值计算。</p>
          </details>
        </div>
        <aside class="cl-fig__aside">
          <p class="cl-def"><b>FWCS 评分</b>分值越低表示皱纹越轻；两组筛选期均值相近（${fmt2(C.fwcs.youmagic[0])} / ${fmt2(C.fwcs.control[0])}）。</p>
          <p class="cl-def cl-def--muted">两组在 1、3、6 个月的均值均低于筛选期。结论见上方：各随访时间点 FWCS 评分均非劣于对照器械，差异无统计学意义。</p>
          <span class="cl-ni-chip">非劣效性设计 · 差异无统计学意义</span>
        </aside>
      </figure>
    </div>
  </section>

  <footer class="cl-foot">
    <p class="disclaimer">*数据来源于：YOUMAGIC 临床注册非劣性临床研究（产品彩页 第 3 页）。研究设计、入组标准、评价指标与结论：使用说明书 第 32–33 页（15. 临床试验数据）。对照器械为已上市单极射频治疗系统。</p>
    <p class="disclaimer">≈ 估读：彩页未印刷 GAIS 分值占比与 FWCS 跨级分数占比的具体数值，图中数值依柱高读取（合计约 ±2.5、分段约 ±1.5 个百分点），仅用于示意分布。本研究为非劣效性设计，图中两组数值差异不代表统计学优效。${esc(data.disclaimers.pro)}</p>
  </footer>
</div>`;

    initIntro(root, ctx);
    const tip = makeTooltip();
    effChart(root.querySelector('#cl-fig-eff'), ctx, tip);
    gaisChart(root.querySelector('#cl-fig-gais'), ctx, tip);
    shiftChart(root.querySelector('#cl-fig-shift'), ctx, tip);
    meanChart(root.querySelector('#cl-fig-mean'), ctx, tip);
    initCalc(root.querySelector('#cl-fig-shift .cl-calc'));

    // images → refresh triggers once their layout is final
    const imgs = [...root.querySelectorAll('.cl-center img')];
    Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })))).then(() => ctx.ScrollTrigger.refresh());
  },
};

/* ------------------------------------------------------------------ */
function initIntro(root, ctx) {
  const { gsap, lib } = ctx;
  root.querySelectorAll('.cl-stat__v').forEach((el) => lib.countOnView(el, +el.dataset.count, { duration: 1.6 }));
  const design = root.querySelector('.cl-design');
  const verdict = root.querySelector('.cl-verdict');
  const centers = root.querySelector('.cl-centers');
  const flowOn = [design, verdict, centers];
  // CSS-driven reveal states (lines draw, seals ring, underline) + pause flow particles off-screen
  flowOn.forEach((el) => lib.whenVisible(el, () => el.classList.add('is-in', 'is-live'), () => el.classList.remove('is-live'), '-12% 0px'));
  if (ctx.reduced) flowOn.forEach((el) => el.classList.add('is-in'));
  // hover lift on seals
  root.querySelectorAll('.cl-center').forEach((f) => {
    f.addEventListener('pointerenter', () => !ctx.reduced && gsap.to(f.querySelector('img'), { rotate: 8, scale: 1.04, duration: 0.6, ease: 'expo.out' }));
    f.addEventListener('pointerleave', () => !ctx.reduced && gsap.to(f.querySelector('img'), { rotate: 0, scale: 1, duration: 0.8, ease: 'expo.out' }));
  });
}

/* ------------------------------------------------------------------ */
/* tooltip (one shared, positioned in viewport)                        */
function makeTooltip() {
  const el = document.createElement('div');
  el.className = 'cl-tip';
  el.setAttribute('role', 'tooltip');
  document.getElementById('clinical').appendChild(el);
  let raf = 0;
  return {
    show(rows, x, y) {
      el.replaceChildren();
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = 'cl-tip__row' + (r.head ? ' is-head' : '');
        if (r.color) { const k = document.createElement('i'); k.style.background = r.color; row.appendChild(k); }
        const v = document.createElement('b'); v.textContent = r.v ?? ''; row.appendChild(v);
        const l = document.createElement('span'); l.textContent = r.l ?? ''; row.appendChild(l);
        el.appendChild(row);
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const sec = document.getElementById('clinical').getBoundingClientRect();
        const w = el.offsetWidth, h = el.offsetHeight;
        let lx = x - sec.left - w / 2, ly = y - sec.top - h - 14;
        lx = Math.max(8, Math.min(sec.width - w - 8, lx));
        if (y - h - 14 < 70) ly = y - sec.top + 18;
        el.style.transform = `translate(${lx}px, ${ly}px)`;
        el.classList.add('is-on');
      });
    },
    hide() { cancelAnimationFrame(raf); el.classList.remove('is-on'); },
  };
}

/* ------------------------------------------------------------------ */
/* chart scaffold: width-responsive SVG, animate-in once on view       */
function scaffold(fig, ctx, build) {
  const { lib } = ctx;
  const host = fig.querySelector('.cl-chart');
  const H = () => (host.clientWidth < 520 ? Math.round(+host.dataset.h * 0.86) : +host.dataset.h);
  let w = 0, api = null, shown = !!ctx.reduced;
  const render = () => {
    w = host.clientWidth;
    if (w < 160) { w = 0; return; } // not laid out yet — wait for a resize
    host.replaceChildren();
    const svg = lib.svg('svg', { class: 'viz cl-svg', width: w, height: H(), viewBox: `0 0 ${w} ${H()}` });
    host.appendChild(svg);
    api = build(svg, w, H());
    api.layout(false, !shown);
  };
  render();
  if (!shown) lib.whenVisible(host, () => { if (shown) return; if (!api) render(); shown = true; api?.layout(true, false, true); }, null, '-18% 0px');
  lib.onResize(() => { if (host.clientWidth !== w) render(); });
  return { relayout: () => api?.layout(shown && !ctx.reduced, !shown) };
}
const setA = (gsap, el, attrs, anim, o = {}) => {
  if (anim) gsap.to(el, { attr: attrs, duration: o.d ?? 1.1, delay: o.delay ?? 0, ease: o.ease ?? 'expo.out', overwrite: 'auto' });
  else { gsap.killTweensOf(el); for (const k in attrs) el.setAttribute(k, attrs[k]); }
};
function yTicks(g, lib, { x0, x1, y, ticks, fmt }) {
  g.replaceChildren();
  for (const t of ticks) {
    const yy = y(t);
    lib.svg('line', { class: 'gridline', x1: x0, x2: x1, y1: yy, y2: yy }, g);
    const tx = lib.svg('text', { x: x0 - 8, y: yy + 3.5, 'text-anchor': 'end' }, g);
    tx.textContent = fmt(t);
  }
}
function bindTip(svg, tip, rowsFor) {
  const on = (e) => {
    const m = e.target.closest?.('[data-tip]');
    if (!m) return tip.hide();
    const r = m.getBoundingClientRect();
    const x = e.clientX ?? r.left + r.width / 2;
    const y = e.type === 'focusin' ? r.top : Math.min(e.clientY, r.top + 30);
    tip.show(rowsFor(m), e.type === 'focusin' ? r.left + r.width / 2 : x, y);
    svg.querySelectorAll('.is-hot').forEach((x) => x.classList.remove('is-hot'));
    (m._bar || m).classList.add('is-hot');
  };
  const off = () => { tip.hide(); svg.querySelectorAll('.is-hot').forEach((x) => x.classList.remove('is-hot')); };
  svg.addEventListener('pointermove', on);
  svg.addEventListener('pointerleave', off);
  svg.addEventListener('focusin', on);
  svg.addEventListener('focusout', off);
}

/* ------------------------------------------------------------------ */
/* Fig 1 — 总有效率 grouped bars (printed)                              */
function effChart(fig, ctx, tip) {
  const { gsap, lib, data } = ctx;
  const E = data.charts.efficacy;
  let axis = 'full';
  const note = fig.querySelector('.cl-zoomnote');
  const chart = scaffold(fig, ctx, (svg, W, H) => {
    const m = { l: 44, r: 10, t: 28, b: 42 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, base = m.t + ph;
    const clip = 'cl-eff-clip-' + Math.random().toString(36).slice(2, 7);
    const defs = lib.svg('defs', {}, svg);
    lib.svg('rect', { x: m.l, y: 0, width: pw, height: base }, lib.svg('clipPath', { id: clip }, defs));
    const gT = lib.svg('g', { class: 'axis' }, svg);
    const gB = lib.svg('g', { 'clip-path': `url(#${clip})` }, svg);
    const gL = lib.svg('g', {}, svg);
    lib.svg('line', { class: 'cl-base', x1: m.l, x2: m.l + pw, y1: base, y2: base }, svg);
    const band = pw / E.months.length;
    const bw = Math.min(26, band * 0.24), gap = Math.max(6, Math.min(10, band * 0.06));
    const bars = [];
    E.months.forEach((mo, i) => {
      const gc = m.l + band * (i + 0.5);
      const xl = lib.svg('text', { x: gc, y: base + 22, 'text-anchor': 'middle', class: 'cl-xl' }, svg);
      xl.textContent = mo;
      [['youmagic', COL.ym, 'YOUMAGIC'], ['control', COL.ctl, '对照组']].forEach(([k, c, name], j) => {
        const x = j === 0 ? gc - gap / 2 - bw : gc + gap / 2;
        const v = E[k][i];
        const r = lib.svg('rect', { x, width: bw, rx: 4, fill: c, class: 'cl-bar', tabindex: 0, 'data-tip': '', 'aria-label': `${name} ${mo} ${fmt2(v)}%` }, gB);
        r._d = { v, name, mo, c };
        const hit = lib.svg('rect', { x: x - gap / 2, width: bw + gap, y: m.t, height: ph, fill: 'transparent', 'data-tip': '' }, gB);
        hit._d = r._d;
        hit._bar = r;
        const t = lib.svg('text', { x: j === 0 ? gc - 1 : gc + 1, 'text-anchor': j === 0 ? 'end' : 'start', class: 'cl-vl' + (j === 0 ? ' is-ym' : '') }, gL);
        t.textContent = fmt2(v);
        bars.push({ r, t, v });
      });
    });
    bindTip(svg, tip, (el) => [{ v: `${fmt2(el._d.v)}%`, l: `${el._d.name} · ${el._d.mo}`, color: el._d.c }, { v: '', l: '总有效率 · 印刷数值' }]);
    return {
      layout(anim, zero, intro) {
        const [d0, d1] = axis === 'full' ? [0, 100] : [50, 100];
        const y = (v) => m.t + ph * (1 - (v - d0) / (d1 - d0));
        yTicks(gT, lib, { x0: m.l, x1: m.l + pw, y, ticks: axis === 'full' ? [0, 25, 50, 75, 100] : [50, 60, 70, 80, 90, 100], fmt: (t) => t + '%' });
        bars.forEach((b, i) => {
          const top = zero ? base : y(b.v);
          const o = { delay: intro ? 0.08 * i : 0 };
          setA(gsap, b.r, { y: top, height: base - top + 6 }, anim, o);
          setA(gsap, b.t, { y: top - 8 }, anim, o);
          if (anim && intro) gsap.fromTo(b.t, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.5 + 0.08 * i });
          else b.t.style.opacity = zero ? 0 : 1;
        });
      },
    };
  });
  fig.querySelectorAll('[data-axis]').forEach((b) => b.addEventListener('click', () => {
    axis = b.dataset.axis;
    fig.querySelectorAll('[data-axis]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    note.hidden = axis !== 'zoom';
    chart.relayout();
  }));
}

/* ------------------------------------------------------------------ */
/* Fig 2 — GAIS 3-month 100% stacked (≈ estimated)                      */
function gaisChart(fig, ctx, tip) {
  const { gsap, lib, data } = ctx;
  const G = data.charts.gais, E = data.charts.efficacy, scale = data.charts.gaisScale;
  let mode = 'seg';
  const rowsTbl = [...fig.querySelectorAll('.cl-gais-tbl tr[data-g]')];
  const legs = [...fig.querySelectorAll('.cl-gais-legend [data-g]')];
  const hl = (g) => { rowsTbl.forEach((r) => r.classList.toggle('is-hot', +r.dataset.g === g || (g === 'eff' && +r.dataset.g < 3))); legs.forEach((r) => r.classList.toggle('is-hot', +r.dataset.g === g)); };
  const chart = scaffold(fig, ctx, (svg, W, H) => {
    const narrow = W < 480;
    const m = { l: narrow ? 84 : 96, r: 14, t: 14, b: 34 };
    const pw = W - m.l - m.r;
    const bh = 26, avail = H - m.t - m.b, rowGap = Math.min(36, avail - bh * 2), off = m.t + (avail - bh * 2 - rowGap) / 2;
    const gT = lib.svg('g', { class: 'axis' }, svg);
    const x = (p) => m.l + (pw * p) / 100;
    for (const t of [0, 25, 50, 75, 100]) {
      lib.svg('line', { class: 'gridline', x1: x(t), x2: x(t), y1: m.t - 4, y2: H - m.b + 4 }, gT);
      const tx = lib.svg('text', { x: x(t), y: H - m.b + 20, 'text-anchor': t === 0 ? 'start' : t === 100 ? 'end' : 'middle' }, gT);
      tx.textContent = t + '%';
    }
    const rows = [['youmagic', 'YOUMAGIC'], ['control', '对照组']].map(([k, name], ri) => {
      const y = off + ri * (bh + rowGap);
      const lab = lib.svg('text', { x: m.l - 12, y: y + bh / 2 + 4, 'text-anchor': 'end', class: 'cl-rowl' }, svg);
      lab.textContent = name;
      const segs = G[k].map((v, gi) => {
        const r = lib.svg('rect', { y, height: bh, rx: 3, fill: GAIS_C[gi], class: 'cl-seg', tabindex: v > 0 ? 0 : -1, 'data-tip': '', 'aria-label': `${name} ${gi + 1}分 约${v}%` }, svg);
        r._d = { k, name, gi, v };
        const t = lib.svg('text', { y: y + bh / 2 + 4, 'text-anchor': 'middle', class: 'cl-inl' + (gi < 2 ? ' is-dark' : '') }, svg);
        return { r, t, v, gi };
      });
      return { k, name, y, segs };
    });
    bindTip(svg, tip, (el) => {
      const d = el._d;
      if (mode === 'merge' && d.gi <= 2) return [{ v: `${fmt2(E[d.k][1])}%`, l: `${d.name} · GAIS ≤ 3 分（有效）`, color: COL.ym }, { v: '', l: '3 个月总有效率 · 印刷数值' }];
      const derived = d.gi === 3 && (mode === 'merge' || d.k === 'control');
      const v = derived ? `${fmt2(100 - E[d.k][1])}%` : `≈ ${d.v}%`;
      return [{ v, l: `${d.name} · ${d.gi + 1} 分 ${scale[d.gi]}`, color: GAIS_C[d.gi] }, { v: '', l: derived ? `由印刷有效率推算（100 − ${fmt2(E[d.k][1])}）` : '柱高估读 ±1.5' }];
    });
    svg.addEventListener('pointermove', (e) => { const m2 = e.target.closest?.('[data-tip]'); hl(m2 ? (mode === 'merge' && m2._d.gi <= 2 ? 'eff' : m2._d.gi) : -1); });
    svg.addEventListener('pointerleave', () => hl(-1));
    return {
      layout(anim, zero, intro) {
        rows.forEach((row, ri) => {
          const vals = mode === 'merge' ? [E[row.k][1], 0, 0, +(100 - E[row.k][1]).toFixed(2), 0] : G[row.k];
          let acc = 0;
          row.segs.forEach((s, gi) => {
            const v = vals[gi];
            const x0 = x(zero ? 0 : acc), wv = zero ? 0 : Math.max(0, (pw * v) / 100 - (v > 0 ? 2 : 0));
            acc += v;
            const o = { delay: intro ? 0.12 * gi + 0.1 * ri : 0, d: 1.2 };
            setA(gsap, s.r, { x: x0, width: wv, fill: mode === 'merge' && gi === 0 ? COL.ym : GAIS_C[gi] }, anim, o);
            const label = mode === 'merge' && gi === 0 ? `${fmt2(v)}%` : v >= 0.5 ? `≈${v}%` : '';
            const fits = wv > label.length * 7 + 12;
            s.t.textContent = fits ? label : '';
            s.t.classList.toggle('is-dark', mode === 'merge' ? gi === 0 : gi < 2);
            setA(gsap, s.t, { x: x0 + wv / 2 }, anim, o);
            s.t.style.opacity = zero ? 0 : 1;
            if (anim && intro) gsap.fromTo(s.t, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.6 + 0.12 * gi });
          });
        });
      },
    };
  });
  fig.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    fig.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fig.classList.toggle('is-merge', mode === 'merge');
    hl(mode === 'merge' ? 'eff' : -1);
    chart.relayout();
  }));
}

/* ------------------------------------------------------------------ */
/* Fig 3 — FWCS 跨级分数占比 stacked columns (≈ estimated)              */
function shiftChart(fig, ctx, tip) {
  const { gsap, lib, data } = ctx;
  const F = data.charts.fwcsShift;
  let mode = 'seg';
  scaffoldShift();
  function scaffoldShift() {
    const chart = scaffold(fig, ctx, (svg, W, H) => {
      const m = { l: 44, r: 10, t: 26, b: W < 520 ? 34 : 50 };
      const pw = W - m.l - m.r, ph = H - m.t - m.b, base = m.t + ph;
      const y = (v) => m.t + ph * (1 - v / 80);
      const gT = lib.svg('g', { class: 'axis' }, svg);
      yTicks(gT, lib, { x0: m.l, x1: m.l + pw, y, ticks: [0, 20, 40, 60, 80], fmt: (t) => t + '%' });
      lib.svg('line', { class: 'cl-base', x1: m.l, x2: m.l + pw, y1: base, y2: base }, svg);
      const band = pw / F.months.length;
      const bw = Math.min(26, band * 0.24), gap = Math.max(8, Math.min(16, band * 0.1));
      const cols = [];
      F.months.forEach((mo, i) => {
        const gc = m.l + band * (i + 0.5);
        const xl = lib.svg('text', { x: gc, y: base + (W < 520 ? 22 : 38), 'text-anchor': 'middle', class: 'cl-xl' }, svg);
        xl.textContent = mo;
        [['youmagic', 'YOUMAGIC', SHIFT_YM], ['control', '对照组', SHIFT_CT]].forEach(([k, name, ramp], j) => {
          const x = j === 0 ? gc - gap / 2 - bw : gc + gap / 2;
          if (W >= 520) { const gl = lib.svg('text', { x: x + bw / 2, y: base + 16, 'text-anchor': 'middle', class: 'cl-gl' }, svg); gl.textContent = j === 0 ? 'YOUMAGIC' : '对照组'; }
          const vals = F[k][i];
          const total = +(vals[0] + vals[1] + vals[2]).toFixed(1);
          const segs = vals.map((v, si) => {
            const r = lib.svg('rect', { x, width: bw, rx: 3, fill: ramp[si], class: 'cl-seg', tabindex: v > 0 ? 0 : -1, 'data-tip': '', 'aria-label': `${name} ${mo} 跨级${F.keys[si]} 约${v}%` }, svg);
            r._d = { name, mo, v, si, total, c: ramp[si] };
            return { r, v, si };
          });
          const t = lib.svg('text', { x: x + bw / 2, 'text-anchor': 'middle', class: 'cl-vl' + (j === 0 ? ' is-ym' : '') }, svg);
          t.textContent = `≈${total}`;
          cols.push({ segs, t, total, ramp, i, j });
        });
      });
      bindTip(svg, tip, (el) => {
        const d = el._d;
        if (mode === 'total') return [{ v: `≈ ${d.total}%`, l: `${d.name} · ${d.mo} · 总跨级率`, color: d.c }, { v: '', l: '柱高估读 ±2.5' }];
        return [{ v: `≈ ${d.v}%`, l: `${d.name} · ${d.mo} · 跨级 ${F.keys[d.si]}`, color: d.c }, { v: `≈ ${d.total}%`, l: '该组合计（估读）' }];
      });
      return {
        layout(anim, zero, intro) {
          cols.forEach((c, ci) => {
            let acc = 0;
            c.segs.forEach((s) => {
              const v = mode === 'total' ? (s.si === 0 ? c.total : 0) : s.v;
              const y1 = zero ? base : y(acc + v), y0 = zero ? base : y(acc);
              acc += v;
              const h = Math.max(0, y0 - y1 - (v > 0 && s.si < 2 && mode === 'seg' ? 2 : 0));
              const o = { delay: intro ? 0.06 * ci + 0.1 * s.si : 0 };
              setA(gsap, s.r, { y: y1, height: h, fill: mode === 'total' && s.si === 0 ? c.ramp[1] : c.ramp[s.si] }, anim, o);
            });
            const top = zero ? base : y(c.total);
            setA(gsap, c.t, { y: top - 8 }, anim, { delay: intro ? 0.06 * ci : 0 });
            c.t.style.opacity = zero ? 0 : 1;
            if (anim && intro) gsap.fromTo(c.t, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.7 + 0.06 * ci });
          });
        },
      };
    });
    fig.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      fig.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      chart.relayout();
    }));
  }
}

/* ------------------------------------------------------------------ */
/* Fig 4 — FWCS 均值 line (printed)                                     */
function meanChart(fig, ctx, tip) {
  const { gsap, lib, data } = ctx;
  const F = data.charts.fwcs;
  let axis = 'zoom';
  const note = fig.querySelector('.cl-zoomnote');
  const chart = scaffold(fig, ctx, (svg, W, H) => {
    const m = { l: 40, r: W < 520 ? 44 : 64, t: 24, b: 40 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, base = m.t + ph;
    const xs = F.points.map((_, i) => m.l + 18 + ((pw - 36) * i) / (F.points.length - 1));
    const gT = lib.svg('g', { class: 'axis' }, svg);
    F.points.forEach((p, i) => { const t = lib.svg('text', { x: xs[i], y: base + 24, 'text-anchor': 'middle', class: 'cl-xl' }, svg); t.textContent = p; });
    const cross = lib.svg('line', { class: 'cl-cross', y1: m.t - 6, y2: base, x1: -10, x2: -10 }, svg);
    const series = [['youmagic', 'YOUMAGIC', COL.ym], ['control', '对照组', COL.ctl]].map(([k, name, c]) => {
      const path = lib.svg('path', { class: 'cl-line', stroke: c }, svg);
      const dots = F[k].map(() => lib.svg('circle', { r: 4.5, fill: c, class: 'cl-dot' }, svg));
      const end = lib.svg('text', { class: 'cl-endl', 'text-anchor': 'start' }, svg);
      return { k, name, c, path, dots, end, vals: F[k] };
    });
    // hit columns for crosshair (bigger than the marks)
    const colW = (pw - 36) / (F.points.length - 1);
    const hits = F.points.map((p, i) => {
      const r = lib.svg('rect', { x: xs[i] - colW / 2, y: m.t - 10, width: colW, height: ph + 10, fill: 'transparent', tabindex: 0, 'data-tip': '', 'aria-label': `${p}：YOUMAGIC ${fmt2(F.youmagic[i])}，对照组 ${fmt2(F.control[i])}` }, svg);
      r._i = i;
      return r;
    });
    bindTip(svg, tip, (el) => {
      const i = el._i;
      cross.setAttribute('x1', xs[i]); cross.setAttribute('x2', xs[i]); cross.classList.add('on');
      series.forEach((s) => s.dots.forEach((d, j) => d.classList.toggle('is-hot', j === i)));
      const rows = [{ head: true, v: F.points[i], l: '' }];
      series.forEach((s) => rows.push({ v: fmt2(s.vals[i]), l: s.name + (i ? `  较筛选期 ${(s.vals[i] - s.vals[0]).toFixed(2)}` : ''), color: s.c }));
      return rows;
    });
    svg.addEventListener('pointerleave', () => { cross.classList.remove('on'); series.forEach((s) => s.dots.forEach((d) => d.classList.remove('is-hot'))); });
    svg.addEventListener('focusout', () => cross.classList.remove('on'));
    let drawn = false;
    return {
      layout(anim, zero, intro) {
        const [d0, d1] = axis === 'zoom' ? [3.6, 4.8] : [1, 9];
        const y = (v) => m.t + ph * (1 - (v - d0) / (d1 - d0));
        yTicks(gT, lib, { x0: m.l, x1: m.l + pw, y, ticks: axis === 'zoom' ? [3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8] : [1, 3, 5, 7, 9], fmt: (t) => (axis === 'zoom' ? t.toFixed(1) : String(t)) });
        series.forEach((s, si) => {
          const pts = s.vals.map((v, i) => [xs[i], y(v)]);
          const d = 'M' + pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L');
          if (anim && drawn) gsap.to(s.path, { attr: { d }, duration: 1, ease: 'expo.out' });
          else s.path.setAttribute('d', d);
          s.dots.forEach((dot, i) => setA(gsap, dot, { cx: pts[i][0], cy: pts[i][1] }, anim && drawn, { d: 1 }));
          // end labels only when they don't collide
          const other = series[1 - si];
          const gapPx = Math.abs(y(s.vals[3]) - y(other ? other.vals[3] : 0));
          s.end.textContent = gapPx > 13 || !other ? fmt2(s.vals[3]) : '';
          setA(gsap, s.end, { x: pts[3][0] + 10, y: pts[3][1] + 4 }, anim && drawn, { d: 1 });
          if (zero) { s.path.style.strokeDasharray = '2000'; s.path.style.strokeDashoffset = '2000'; s.dots.forEach((dd) => (dd.style.opacity = 0)); s.end.style.opacity = 0; }
          else if (intro && anim) {
            gsap.fromTo(s.path, { strokeDashoffset: 2000 }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', delay: 0.15 * si, onComplete: () => { s.path.style.strokeDasharray = ''; } });
            gsap.fromTo(s.dots, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.3, delay: 0.25 + 0.15 * si });
            gsap.fromTo(s.end, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 1.4 });
          } else { s.path.style.strokeDasharray = ''; s.path.style.strokeDashoffset = ''; s.dots.forEach((dd) => (dd.style.opacity = 1)); s.end.style.opacity = 1; }
        });
        if (!zero) drawn = true;
      },
    };
  });
  fig.querySelectorAll('[data-axis]').forEach((b) => b.addEventListener('click', () => {
    axis = b.dataset.axis;
    fig.querySelectorAll('[data-axis]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    note.hidden = axis !== 'zoom';
    chart.relayout();
  }));
}

/* ------------------------------------------------------------------ */
/* 跨级分数 calculator                                                   */
function initCalc(box) {
  const st = { b: 5, f: 3 };
  const lim = { b: [3, 6], f: [1, FWCS_MAX] }; // baseline limited to the enrolment range 3–6
  const out = box.querySelector('.cl-calc__out');
  const span = box.querySelector('.cl-ladder__span');
  const steps = [...box.querySelectorAll('.cl-ladder span')];
  const upd = () => {
    box.querySelector('[data-v="b"]').textContent = st.b;
    box.querySelector('[data-v="f"]').textContent = st.f;
    box.querySelectorAll('[data-c]').forEach((b) => { const k = b.dataset.c, n = st[k] + +b.dataset.d; b.disabled = n < lim[k][0] || n > lim[k][1]; });
    const d = st.b - st.f;
    steps.forEach((s) => { const v = +s.dataset.s; s.className = v === st.b ? 'is-b' : v === st.f ? 'is-f' : ''; });
    const lo = Math.min(st.b, st.f), hi = Math.max(st.b, st.f);
    span.style.left = ((lo - 1) / FWCS_MAX) * 100 + '%';
    span.style.width = ((hi - lo + 1) / FWCS_MAX) * 100 + '%';
    span.classList.toggle('is-neg', d <= 0);
    out.innerHTML = d > 0 ? `跨级分数 = ${st.b} − ${st.f} = <b>${d} 分</b>` : `跨级分数 = ${st.b} − ${st.f} = <b>${d} 分</b>（未跨级）`;
  };
  box.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.c, n = st[k] + +b.dataset.d;
    if (n < lim[k][0] || n > lim[k][1]) return;
    st[k] = n; upd();
  }));
  upd();
}
