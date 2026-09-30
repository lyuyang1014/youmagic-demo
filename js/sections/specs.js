// #specs — 技术参数
// Product anatomy with hotspots (IFU p.7 图1, p.10 图4), handpiece control-button mini simulator,
// count-up spec sheet (data.specs), level→power ruler (lib.levelPower), components table (data.components).

const IMG = 'assets/img/';

// hotspot positions are % of the image box
const HOTS = [
  {
    fig: 'dev', x: 63.5, y: 19.5, t: '触摸屏', en: 'TOUCHSCREEN', src: '使用说明书 第 8–9 页',
    d: '通过交互式触摸屏访问所有治疗仪控制：系统状态栏、治疗发数与参数状态（发数 · 累计能量 · 阻值 · 功率）、一次性使用治疗头端类型显示，以及功率档位、制冷强度、脉冲时间的 [+] [−] 调节。',
  },
  {
    fig: 'dev', x: 61.5, y: 30.6, t: '主机控制开关', en: 'MAIN CONTROL SWITCH', src: '使用说明书 第 8 页',
    d: '按主机控制开关将低电压接入治疗仪并开机：开关亮起、屏幕启动，治疗仪执行启动程序验证功能，自检后完成启动。',
  },
  {
    fig: 'dev', x: 49.2, y: 35.2, t: '一次性使用治疗头端', en: 'DISPOSABLE TIP', src: '使用说明书 第 7、10–11 页',
    d: '安装在治疗手具前端，型号 YM5-TP4-900；安装后其类型与可用发数显示在触摸屏上。细节见右侧手具图。',
  },
  {
    fig: 'dev', x: 50.5, y: 43.5, t: '治疗手具总成', en: 'HANDPIECE · YM5-H1', src: '使用说明书 第 7、10 页',
    d: '治疗须通过治疗手具启动：手具传送射频能量以选择性加热组织，同时以传导方式冷却表皮；治疗仪通过治疗手具控制制冷剂递送。手具线缆 2.0 m。',
  },
  {
    fig: 'hp', x: 43.5, y: 45.5, t: '使能按钮', en: 'ENABLE BUTTON', src: '使用说明书 第 10、15 页',
    d: '按一下使能按钮，治疗仪开启冷却功能并将制冷剂递送到手具；按住进入“预备”，适当接触后转入“启动”；松开即终止“启动”模式并中断射频传送。',
  },
  {
    fig: 'hp', x: 27, y: 71, t: '内置触发开关', en: 'BUILT-IN TRIGGER', src: '使用说明书 第 10 页',
    d: '按下使能按钮，治疗仪进入射频准备发射状态；下压治疗头（触发开关）传递射频能量。松开使能按钮或抬起治疗头（解除开关），射频停止输出。',
  },
  {
    fig: 'hp', x: 9.5, y: 88, t: '一次性使用治疗头端', en: 'YM5-TP4-900', src: '使用说明书 第 10–11、19 页',
    d: '治疗面积 4.0 cm² · 900 发 · 铜、聚酰亚胺。仅供一名患者使用，请勿重复使用或重新处理；几何形状仅允许单向插入；使用前以 75% 酒精清洁并检查电极表面。',
  },
  {
    fig: 'hp', x: 80, y: 15, t: '控制按钮 R / − / M / +', en: 'CONTROL BUTTONS', src: '使用说明书 第 10 页', ctl: true,
    d: '位于手具另一侧近线缆端。“M”选择要调整的参数（选定参数在触摸屏显示为绿色），[+] [−] 调整，按“M”确认或稍后自动确认；“R”快速切换到上一次的治疗参数设置。',
  },
];

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
      <button type="button" class="sp-hot" data-i="${i}" style="left:${h.x}%;top:${h.y}%" aria-expanded="false" aria-controls="sp-pop" aria-label="${i + 1}. ${h.t}">
        <span class="sp-hot__n mono">${i + 1}</span>
      </button>`;

    root.innerHTML = `
    <div class="wrap">
      <span class="sec-num" aria-hidden="true">13</span>
      <header class="sec-head">
        <span class="eyebrow">13 · SPECIFICATIONS</span>
        <h2 class="h1">技术<span class="grad-text">参数</span></h2>
        <p class="lead">主机、治疗手具与一次性使用治疗头端的结构与规格。点击编号查看各部件功能说明；参数均摘自产品使用说明书。</p>
      </header>

      <div class="sp-anat">
        <div class="sp-figs" data-reveal>
          <figure class="sp-fig sp-fig--dev">
            <div class="sp-img" style="aspect-ratio:496/1186">
              <img src="${IMG}device.webp" alt="YM5 射频皮肤治疗仪主机正面 3/4 视图" decoding="async" draggable="false" />
              ${HOTS.map((h, i) => (h.fig === 'dev' ? hot(h, i) : '')).join('')}
              <span class="sp-dim" aria-hidden="true"><i></i><b class="mono">1285 mm</b></span>
            </div>
            <figcaption><span class="mono">YM5-G1</span>主机</figcaption>
          </figure>
          <figure class="sp-fig sp-fig--hp">
            <div class="sp-img" style="aspect-ratio:707/716">
              <img src="${IMG}handpiece.webp" alt="治疗手具总成与一次性使用治疗头端特写" decoding="async" draggable="false" />
              ${HOTS.map((h, i) => (h.fig === 'hp' ? hot(h, i) : '')).join('')}
            </div>
            <figcaption><span class="mono">YM5-H1</span>治疗手具总成</figcaption>
          </figure>
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
          ${HOTS.map((h, i) => (h.fig === 'dev' ? `<li><button type="button" data-i="${i}"><span class="mono">${i + 1}</span>${h.t}</button></li>` : '')).join('')}
          <li class="sp-legend__g mono">治疗手具 YM5-H1</li>
          ${HOTS.map((h, i) => (h.fig === 'hp' ? `<li><button type="button" data-i="${i}"><span class="mono">${i + 1}</span>${h.t}</button></li>` : '')).join('')}
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

    /* ---------- hotspots & popover ---------- */
    const anat = root.querySelector('.sp-anat');
    const pop = root.querySelector('.sp-pop');
    const hots = [...root.querySelectorAll('.sp-hot')];
    const legendBtns = [...root.querySelectorAll('.sp-legend button')];
    const ctlBox = pop.querySelector('.sp-ctl');
    let cur = -1;
    const isMobile = () => window.innerWidth < 900;

    function place() {
      if (cur < 0 || isMobile()) { pop.style.left = pop.style.top = ''; return; }
      const h = hots.find((b) => +b.dataset.i === cur);
      const a = anat.getBoundingClientRect(), r = h.getBoundingClientRect();
      const cx = r.left + r.width / 2 - a.left, cy = r.top + r.height / 2 - a.top;
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      const right = cx + 28 + pw < a.width - 8;
      const x = right ? cx + 28 : Math.max(8, cx - 28 - pw);
      const y = Math.min(Math.max(8, cy - 40), a.height - ph - 8);
      pop.style.left = x + 'px'; pop.style.top = y + 'px';
      pop.dataset.side = right ? 'r' : 'l';
      pop.style.setProperty('--ay', Math.min(Math.max(18, cy - y), ph - 18) + 'px');
    }
    function open(i) {
      if (cur === i) { close(); return; }
      cur = i;
      const h = HOTS[i];
      pop.querySelector('.sp-pop__en').textContent = `${String(i + 1).padStart(2, '0')} · ${h.en}`;
      pop.querySelector('.sp-pop__t').textContent = h.t;
      pop.querySelector('.sp-pop__d').textContent = h.d;
      pop.querySelector('.sp-pop__src').textContent = '来源：' + h.src;
      ctlBox.hidden = !h.ctl;
      pop.hidden = false;
      hots.forEach((b) => { const on = +b.dataset.i === i; b.classList.toggle('is-on', on); b.setAttribute('aria-expanded', String(on)); });
      legendBtns.forEach((b) => b.classList.toggle('is-on', +b.dataset.i === i));
      anat.classList.add('has-pop');
      place();
      if (!reduced) gsap.fromTo(pop, { opacity: 0, y: 8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' });
    }
    function close() {
      cur = -1; pop.hidden = true; anat.classList.remove('has-pop');
      hots.forEach((b) => { b.classList.remove('is-on'); b.setAttribute('aria-expanded', 'false'); });
      legendBtns.forEach((b) => b.classList.remove('is-on'));
    }
    hots.forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); open(+b.dataset.i); }));
    legendBtns.forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); open(+b.dataset.i); }));
    pop.querySelector('.sp-pop__x').addEventListener('click', close);
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', (e) => { if (cur >= 0 && !anat.contains(e.target)) close(); });
    anat.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur >= 0) { const i = cur; close(); hots.find((b) => +b.dataset.i === i)?.focus(); } });
    lib.onResize(place);
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
    };
    const say = (t) => { msg.textContent = t; };
    const scheduleConfirm = () => { clearTimeout(confirmT); confirmT = setTimeout(() => { if (dirty) { dirty = false; say('已自动确认'); } }, 2600); };
    ctlBox.querySelector('.sp-ctl__keys').addEventListener('click', (e) => {
      const k = e.target.closest('.sp-key')?.dataset.key; if (!k) return;
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

    // images affect the anatomy layout height → refresh triggers once they are in
    Promise.all([...root.querySelectorAll('.sp-img img')].map((im) => (im.decode ? im.decode().catch(() => {}) : null)))
      .then(() => ctx.ScrollTrigger?.refresh());
  },
};
