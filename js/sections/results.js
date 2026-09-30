// #results — 案例效果
// (1) synced frontal + profile time-lapse scrubber  (2) before/after compare sliders  (3) VISIA panel
// src: DA p.5 (photos, labels, VISIA ages, disclaimers). No values beyond data.js.

const IMG = 'assets/img/';

const TL = [
  { key: 'before', label: '治疗前', en: 'BASELINE' },
  { key: 'immediate', label: '治疗即刻', en: 'IMMEDIATE' },
  { key: '1m', label: '1 个月', en: 'MONTH 01' },
  { key: '3m', label: '3 个月', en: 'MONTH 03' },
  { key: '6m', label: '6 个月', en: 'MONTH 06' },
];
const VIEWS = [
  { key: 'front', label: '正面' },
  { key: 'profile', label: '侧面' },
];
const CHEEK = [
  { key: '1m', label: '1 个月' },
  { key: '3m', label: '3 个月' },
  { key: '6m', label: '6 个月' },
];
// sub-captions describe the camera view only (DA p.5 prints no region/side labels)
const PAIRS = [
  { key: 'lowerface', title: '下面部', sub: '正面 · 治疗前 / 治疗后' },
  { key: 'forehead', title: '额部', sub: '正面 · 治疗前 / 治疗后' },
  { key: 'jaw', title: '面颊 · 下颌缘', sub: '3/4 侧面 · 治疗前 / 治疗后' },
];
// VISIA map names are printed on the thumbnails themselves (DA p.5)
const VISIA_A = ['斑点', '皱纹', '纹理', '毛孔'];
const VISIA_B = ['紫外线色斑', '棕色斑', '红色区', '紫质'];

const AGE_MIN = 22, AGE_MAX = 38;

export default {
  id: 'results',
  nav: '案例效果',
  async init(root, ctx) {
    const { lib, data: D, gsap, reduced } = ctx;
    const { clamp } = lib;
    const ind = '*' + D.disclaimers.individual.replace(/。$/, '');
    const V = D.visia;

    /* ---------------- markup ---------------- */
    const frame = (v) => `
      <figure class="rs-frame" data-view="${v.key}">
        ${TL.map((t, i) => `<img src="${IMG}ba-${v.key}-${t.key}.webp" alt="${v.label} · ${t.label}（眼部已遮挡）" decoding="async" ${i ? 'aria-hidden="true"' : ''} draggable="false" />`).join('')}
        <figcaption class="rs-frame__cap">
          <span class="rs-frame__view mono">${v.label} · ${v.key === 'front' ? 'FRONTAL' : 'PROFILE'}</span>
        </figcaption>
        <span class="rs-frame__stamp" aria-hidden="true"><b class="rs-stamp__lab">治疗前</b><i class="mono rs-stamp__en">BASELINE</i></span>
      </figure>`;

    const baFrame = (key, before, afters, ratio, tagR) => `
      <div class="rs-ba" style="--x:50%; aspect-ratio:${ratio}" data-ba>
        <img class="rs-ba__img" src="${IMG}${before}" alt="治疗前" draggable="false" decoding="async" />
        <div class="rs-ba__after">
          ${afters.map((a, i) => `<img class="rs-ba__img${i ? '' : ' is-on'}" src="${IMG}${a.src}" alt="${a.label}" draggable="false" decoding="async" data-k="${a.key}" />`).join('')}
        </div>
        <span class="rs-ba__tag rs-ba__tag--l">治疗前</span>
        <span class="rs-ba__tag rs-ba__tag--r">${tagR}</span>
        <div class="rs-ba__line" aria-hidden="true"></div>
        <div class="rs-ba__knob" role="slider" tabindex="0" aria-label="${key} 前后对比分界" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="50%">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>`;

    const ticks = [];
    for (let a = AGE_MIN; a <= AGE_MAX; a++) ticks.push(a);

    root.innerHTML = `
    <div class="wrap">
      <span class="sec-num" aria-hidden="true">11</span>
      <header class="sec-head">
        <span class="eyebrow">11 · CASE RESULTS</span>
        <h2 class="h1"><span class="grad-text">六个月</span>连续随访影像</h2>
        <p class="lead">正面与侧面影像覆盖治疗前、治疗即刻及 1 / 3 / 6 个月随访节点；另附局部部位前后对比与 VISIA 皮肤检测结果。拖动时间轴与对比线，逐一查看每个节点。</p>
      </header>

      <div class="rs-bar" data-reveal="fade">
        <span class="rs-bar__t">仅供专业人士交流使用</span>
        <span class="rs-bar__d">${ind}</span>
      </div>

      <!-- (1) time-lapse -->
      <div class="rs-tl" data-reveal>
        <div class="rs-tl__top">
          <div>
            <h3 class="h3">时间轴 · 正面与侧面同步</h3>
            <p class="small">拖动时间轴或在影像上横向滑动，两组影像同步交叉淡化。</p>
          </div>
          <div class="rs-tl__btns">
            <div class="seg rs-viewseg" role="group" aria-label="视图">
              <button type="button" data-vm="both" aria-pressed="true">双视图</button>
              <button type="button" data-vm="front" aria-pressed="false">正面</button>
              <button type="button" data-vm="profile" aria-pressed="false">侧面</button>
            </div>
            <button type="button" class="btn rs-hold" aria-describedby="rs-hold-tip">
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 2.8v14.4" stroke="currentColor" stroke-width="1.4"/><path d="M10 2.8a7.2 7.2 0 0 0 0 14.4z" fill="currentColor" opacity=".55"/></svg>
              按住对比治疗前
            </button>
            <button type="button" class="btn rs-play" aria-pressed="false">
              <svg class="i-play" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5l9 5.5-9 5.5z" fill="currentColor"/></svg>
              <svg class="i-pause" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.5h2.6v11H6zM11.4 4.5H14v11h-2.6z" fill="currentColor"/></svg>
              <span class="rs-play__t">自动播放</span>
            </button>
          </div>
        </div>
        <span id="rs-hold-tip" class="sr-only">按住时显示治疗前影像，松开恢复当前节点</span>

        <div class="rs-stage" data-vm="both">
          ${VIEWS.map(frame).join('')}
        </div>

        <div class="rs-track" role="slider" tabindex="0" aria-label="随访时间轴" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0" aria-valuetext="治疗前">
          <div class="rs-track__rail"><i class="rs-track__fill"></i></div>
          ${TL.map((t, i) => `
            <span class="rs-node" data-i="${i}" style="--i:${i}">
              <span class="rs-node__thumb"><img src="${IMG}ba-front-${t.key}.webp" alt="" aria-hidden="true" draggable="false" /></span>
              <span class="rs-node__lab">${t.label}</span>
            </span>`).join('')}
          <span class="rs-track__thumb" aria-hidden="true"></span>
        </div>

        <div class="rs-tl__foot">
          <span class="mono micro rs-tl__idx" aria-live="polite">01 / 05 · 治疗前</span>
          <span class="disclaimer">${ind} · 来源：产品彩页 第 5 页</span>
        </div>
      </div>

      <!-- (2) compare sliders -->
      <div class="rs-cmp">
        <article class="rs-cheek card" data-reveal>
          <div class="rs-cheek__media">
            ${baFrame('面颊', 'ba-cheek-before.webp', CHEEK.map((c) => ({ ...c, src: `ba-cheek-${c.key}.webp` })), '4 / 5', '1 个月')}
          </div>
          <div class="rs-cheek__side">
            <span class="eyebrow">SERIES · 4 TIMEPOINTS</span>
            <h3 class="h2">面颊 · 连续随访</h3>
            <p class="small">同一部位 4 个时间节点。选择随访节点，再拖动分界线与治疗前对照。</p>
            <div class="seg rs-cheek__tabs" role="group" aria-label="随访节点">
              ${CHEEK.map((c, i) => `<button type="button" data-k="${c.key}" aria-pressed="${i === 0}">${c.label}</button>`).join('')}
            </div>
            <div class="rs-strip" aria-hidden="true">
              ${[{ key: 'before', label: '治疗前' }, ...CHEEK].map((c, i) => `
                <button type="button" tabindex="-1" class="rs-strip__it${i === 0 ? ' is-base' : ''}${i === 1 ? ' is-on' : ''}" data-k="${c.key}">
                  <img src="${IMG}ba-cheek-${c.key}.webp" alt="" draggable="false" /><span>${c.label}</span>
                </button>`).join('')}
            </div>
            <p class="disclaimer">${ind}</p>
          </div>
        </article>

        <div class="rs-pairs">
          ${PAIRS.map((p) => `
            <article class="rs-pair card" data-reveal>
              ${baFrame(p.title, `ba-${p.key}-before.webp`, [{ key: 'after', label: '治疗后', src: `ba-${p.key}-after.webp` }], '16 / 10', '治疗后')}
              <div class="rs-pair__meta">
                <h4 class="rs-pair__t">${p.title}</h4>
                <span class="micro">${p.sub}</span>
              </div>
            </article>`).join('')}
        </div>
        <p class="disclaimer rs-cmp__d">${ind} · 拖动分界线或使用键盘方向键对比 · 来源：产品彩页 第 5 页</p>
      </div>

      <!-- (3) VISIA -->
      <div class="rs-visia card" data-reveal>
        <div class="rs-visia__age">
         <div class="rs-visia__head">
          <span class="eyebrow">VISIA® SKIN ANALYSIS</span>
          <h3 class="h2 rs-visia__t">VISIA 皮肤检测 · 前后对照</h3>
          <div class="rs-ages">
            <div class="rs-age">
              <span class="rs-age__k">您的实际年龄</span>
              <span class="rs-age__v num">${V.actualAge}</span>
            </div>
            <div class="rs-age rs-age--tru">
              <span class="rs-age__k">您的 TruSkin Age<sup>®</sup></span>
              <span class="rs-age__v num"><b class="rs-tru" aria-live="polite">${V.before}</b><span class="rs-age__from mono">${V.before} → ${V.after}</span></span>
            </div>
          </div>

          <div class="rs-ruler" aria-hidden="true">
            <div class="rs-ruler__scale">
              ${ticks.map((a) => `<i class="${a % 5 === 0 ? 'is-major' : ''}" style="--a:${(a - AGE_MIN) / (AGE_MAX - AGE_MIN)}">${a % 5 === 0 ? `<em>${a}</em>` : ''}</i>`).join('')}
            </div>
            <span class="rs-ruler__gap"></span>
            <span class="rs-ruler__act" style="--a:${(V.actualAge - AGE_MIN) / (AGE_MAX - AGE_MIN)}"><b>实际 ${V.actualAge}</b></span>
            <span class="rs-ruler__tru"><b class="mono">TruSkin <span class="rs-tru2">${V.before}</span></b></span>
          </div>
         </div>

          <div class="rs-visia__ctl">
            <div class="seg rs-vseg" role="group" aria-label="检测时间">
              <button type="button" data-s="before" aria-pressed="true">治疗前</button>
              <button type="button" data-s="after" aria-pressed="false">治疗后</button>
            </div>
            <label class="field rs-wipe">
              <span class="field__row"><span class="field__label">同步擦除对比（8 张检测图）</span><span class="field__val rs-wipe__v">治疗前</span></span>
              <input class="range" type="range" min="0" max="100" step="1" value="0" aria-label="治疗后影像覆盖比例" />
            </label>
          </div>
          <p class="note">*数据来自 VISIA 皮肤检测仪<br />${ind} · 来源：产品彩页 第 5 页</p>
        </div>

        <div class="rs-maps" style="--w:0%">
          ${[...VISIA_A.map((n, i) => ({ n, a: `A${i + 1}`, b: `A${i + 5}` })), ...VISIA_B.map((n, i) => ({ n, a: `B${i + 1}`, b: `B${i + 5}` }))].map((m) => `
            <figure class="rs-map">
              <div class="rs-map__img">
                <img src="${IMG}visia-${m.a}.webp" alt="VISIA ${m.n} · 治疗前" decoding="async" draggable="false" />
                <img class="rs-map__after" src="${IMG}visia-${m.b}.webp" alt="VISIA ${m.n} · 治疗后" decoding="async" draggable="false" />
              </div>
              <figcaption>${m.n}</figcaption>
            </figure>`).join('')}
          <div class="rs-maps__legend micro"><span><i class="l-a"></i>左：治疗后</span><span><i class="l-b"></i>右：治疗前</span></div>
        </div>
      </div>
    </div>`;

    /* ---------------- (1) time-lapse ---------------- */
    const stage = root.querySelector('.rs-stage');
    const track = root.querySelector('.rs-track');
    const fill = track.querySelector('.rs-track__fill');
    const tThumb = track.querySelector('.rs-track__thumb');
    const nodes = [...track.querySelectorAll('.rs-node')];
    const idxEl = root.querySelector('.rs-tl__idx');
    const frames = [...stage.querySelectorAll('.rs-frame')].map((f) => ({
      el: f,
      imgs: [...f.querySelectorAll('img')],
      lab: f.querySelector('.rs-stamp__lab'),
      en: f.querySelector('.rs-stamp__en'),
    }));
    const playBtn = root.querySelector('.rs-play');
    const holdBtn = root.querySelector('.rs-hold');

    // preload & decode every frame so the crossfade never flashes
    const allImgs = [...root.querySelectorAll('img')];
    Promise.all(allImgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null))).then(() => ctx.ScrollTrigger?.refresh());

    const S = { pos: 0, shown: -1, holding: false };
    function paint(p) {
      const i0 = Math.min(3, Math.floor(p)), f = p - i0;
      for (const fr of frames) {
        fr.imgs.forEach((im, i) => {
          let o = 0, z = 0;
          if (i === i0) { o = 1; z = 1; } else if (i === i0 + 1) { o = f; z = 2; }
          im.style.opacity = o; im.style.zIndex = z;
        });
      }
      const near = Math.round(p);
      if (near !== S.shown) {
        S.shown = near;
        const t = TL[near];
        for (const fr of frames) {
          fr.lab.textContent = t.label; fr.en.textContent = t.en;
          if (!reduced) gsap.fromTo(fr.lab.parentNode, { y: 8, opacity: 0.2 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
        }
        nodes.forEach((n, i) => n.classList.toggle('is-on', i === near));
        nodes.forEach((n, i) => n.classList.toggle('is-past', i < near));
        if (!S.holding) {
          track.setAttribute('aria-valuenow', near);
          track.setAttribute('aria-valuetext', t.label);
          idxEl.textContent = `0${near + 1} / 05 · ${t.label}`;
        }
      }
      track.style.setProperty('--p', p / 4);
    }
    const render = () => paint(S.holding ? 0 : S.pos);
    render();

    let tween = null;
    function goTo(i, dur = 0.75) {
      i = clamp(Math.round(i), 0, 4);
      tween?.kill();
      if (reduced) { S.pos = i; render(); return; }
      tween = gsap.to(S, { pos: i, duration: dur, ease: 'power3.out', onUpdate: render });
    }

    // autoplay
    let playing = false, visible = false, dwell = null;
    function step() {
      const cur = Math.round(S.pos), next = cur >= 4 ? 0 : cur + 1;
      tween?.kill();
      tween = gsap.to(S, {
        pos: next, duration: next === 0 ? 1.3 : 1.1, ease: 'power2.inOut', onUpdate: render,
        onComplete: () => { dwell = gsap.delayedCall(next === 4 ? 2.4 : 1.5, step); },
      });
    }
    function stopAuto() { dwell?.kill(); dwell = null; if (playing) tween?.kill(); }
    function setPlaying(v) {
      playing = v;
      playBtn.setAttribute('aria-pressed', String(v));
      playBtn.querySelector('.rs-play__t').textContent = v ? '暂停' : '自动播放';
      if (v && visible) { dwell?.kill(); dwell = gsap.delayedCall(0.5, step); } else stopAuto();
    }
    playBtn.addEventListener('click', () => setPlaying(!playing));
    let autoStarted = false;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !autoStarted && !reduced) { autoStarted = true; setPlaying(true); return; }
      if (visible && playing && !dwell && !tween?.isActive()) dwell = gsap.delayedCall(0.6, step);
      if (!visible) { dwell?.kill(); dwell = null; tween?.pause(); } else tween?.resume();
    }, { threshold: 0.35 });
    io.observe(stage);

    // any manual scrub cancels autoplay for good (incl. the one-time auto-start on first view)
    const userTakeover = () => { autoStarted = true; if (playing) setPlaying(false); };

    // scrub on the track
    const posFromX = (x) => { const r = track.getBoundingClientRect(); const pad = r.width * 0.1; return clamp((x - r.left - pad) / (r.width - pad * 2)) * 4; };
    let dragT = false;
    track.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      userTakeover(); dragT = true; tween?.kill();
      track.setPointerCapture(e.pointerId); track.classList.add('is-drag');
      S.pos = posFromX(e.clientX); render();
    });
    track.addEventListener('pointermove', (e) => { if (!dragT) return; S.pos = posFromX(e.clientX); render(); });
    const endT = () => { if (!dragT) return; dragT = false; track.classList.remove('is-drag'); goTo(S.pos, 0.5); };
    track.addEventListener('pointerup', endT);
    track.addEventListener('pointercancel', endT);
    track.addEventListener('keydown', (e) => {
      const cur = Math.round(S.pos);
      const map = { ArrowRight: cur + 1, ArrowUp: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur - 1, Home: 0, End: 4, PageUp: cur + 1, PageDown: cur - 1 };
      if (e.key in map) { e.preventDefault(); userTakeover(); goTo(map[e.key]); }
    });

    // horizontal swipe on the images scrubs as well (vertical page scroll preserved via touch-action)
    let dragS = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      dragS = { x: e.clientX, p: S.pos, moved: false };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragS) return;
      const dx = e.clientX - dragS.x;
      if (!dragS.moved && Math.abs(dx) < 6) return;
      if (!dragS.moved) { dragS.moved = true; userTakeover(); tween?.kill(); stage.classList.add('is-drag'); }
      S.pos = clamp(dragS.p + (dx / stage.clientWidth) * 4 * 1.25, 0, 4); render();
    });
    const endS = () => { if (!dragS) return; const m = dragS.moved; dragS = null; stage.classList.remove('is-drag'); if (m) goTo(S.pos, 0.5); };
    stage.addEventListener('pointerup', endS);
    stage.addEventListener('pointercancel', endS);

    // press-and-hold: flash back to baseline
    const hold = (on) => {
      if (S.holding === on) return;
      S.holding = on; holdBtn.classList.toggle('is-active', on); stage.classList.toggle('is-hold', on);
      if (on) { dwell?.kill(); dwell = null; tween?.pause(); }
      else if (playing && visible) { if (tween && tween.paused()) tween.resume(); else dwell = gsap.delayedCall(0.8, step); }
      S.shown = -1; render();
    };
    holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); holdBtn.setPointerCapture(e.pointerId); hold(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => holdBtn.addEventListener(ev, () => hold(false)));
    holdBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); hold(true); } });
    holdBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') hold(false); });
    holdBtn.addEventListener('blur', () => hold(false));

    // view mode (mainly for phones)
    const vseg = root.querySelector('.rs-viewseg');
    vseg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      vseg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      stage.dataset.vm = b.dataset.vm;
    });

    /* ---------------- (2) compare sliders ---------------- */
    function makeBA(el) {
      const knob = el.querySelector('.rs-ba__knob');
      let v = 50, drag = false;
      const set = (nv) => {
        v = clamp(nv, 0, 100);
        el.style.setProperty('--x', v + '%');
        knob.setAttribute('aria-valuenow', Math.round(v));
        knob.setAttribute('aria-valuetext', `治疗前占 ${Math.round(v)}%`);
      };
      const fromX = (x) => { const r = el.getBoundingClientRect(); return ((x - r.left) / r.width) * 100; };
      let hint = null;
      el.addEventListener('pointerdown', (e) => {
        if (e.button) return;
        hint?.kill(); drag = true; el.classList.add('is-drag');
        el.setPointerCapture(e.pointerId); set(fromX(e.clientX));
      });
      el.addEventListener('pointermove', (e) => drag && set(fromX(e.clientX)));
      const end = () => { drag = false; el.classList.remove('is-drag'); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      knob.addEventListener('keydown', (e) => {
        const s = e.shiftKey ? 10 : 4;
        const m = { ArrowLeft: v - s, ArrowDown: v - s, ArrowRight: v + s, ArrowUp: v + s, Home: 0, End: 100, PageDown: v - 20, PageUp: v + 20 };
        if (e.key in m) { e.preventDefault(); hint?.kill(); set(m[e.key]); }
      });
      // one-time "wiggle" hint when it first comes into view
      if (!reduced) {
        const o = new IntersectionObserver(([en]) => {
          if (!en.isIntersecting) return;
          o.disconnect();
          const p = { v: 50 };
          hint = gsap.timeline({ delay: 0.35 + Math.random() * 0.25, onUpdate: () => set(p.v) })
            .to(p, { v: 24, duration: 0.7, ease: 'power2.inOut' })
            .to(p, { v: 72, duration: 0.9, ease: 'power2.inOut' })
            .to(p, { v: 50, duration: 0.6, ease: 'power3.out' });
        }, { threshold: 0.7 });
        o.observe(el);
      }
      set(50);
      return { set };
    }
    root.querySelectorAll('[data-ba]').forEach(makeBA);

    // cheek timepoint tabs
    const cheek = root.querySelector('.rs-cheek');
    const cheekBA = cheek.querySelector('[data-ba]');
    const cheekImgs = [...cheekBA.querySelectorAll('.rs-ba__after img')];
    const cheekTag = cheekBA.querySelector('.rs-ba__tag--r');
    const cheekTabs = [...cheek.querySelectorAll('.rs-cheek__tabs button')];
    const strip = [...cheek.querySelectorAll('.rs-strip__it')];
    const pickCheek = (k) => {
      const c = CHEEK.find((x) => x.key === k); if (!c) return;
      cheekImgs.forEach((im) => im.classList.toggle('is-on', im.dataset.k === k));
      cheekTabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
      strip.forEach((s) => s.classList.toggle('is-on', s.dataset.k === k));
      cheekTag.textContent = c.label;
      if (!reduced) gsap.fromTo(cheekTag, { opacity: 0, x: 6 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' });
    };
    cheekTabs.forEach((b) => b.addEventListener('click', () => pickCheek(b.dataset.k)));
    strip.forEach((s) => s.addEventListener('click', () => pickCheek(s.dataset.k)));

    /* ---------------- (3) VISIA ---------------- */
    const maps = root.querySelector('.rs-maps');
    const wipe = root.querySelector('.rs-wipe input');
    const wipeV = root.querySelector('.rs-wipe__v');
    const vsegBtns = [...root.querySelectorAll('.rs-vseg button')];
    const tru = root.querySelector('.rs-tru');
    const tru2 = root.querySelector('.rs-tru2');
    const ruler = root.querySelector('.rs-ruler');
    const vis = root.querySelector('.rs-visia');
    const A = (age) => (age - AGE_MIN) / (AGE_MAX - AGE_MIN);
    const W = { w: 0 }, age = { v: V.before };
    let side = 'before';
    const paintAge = () => {
      const n = Math.round(age.v);
      tru.textContent = n; tru2.textContent = n;
      ruler.style.setProperty('--t', A(age.v));
      ruler.style.setProperty('--gap', Math.max(0, A(V.actualAge) - A(age.v)));
      vis.classList.toggle('is-younger', n < V.actualAge);
    };
    const paintWipe = () => {
      maps.style.setProperty('--w', W.w + '%');
      maps.classList.toggle('is-mid', W.w > 0.5 && W.w < 99.5);
      wipe.value = W.w; wipe.style.setProperty('--p', W.w + '%');
      wipeV.textContent = W.w < 0.5 ? '治疗前' : W.w > 99.5 ? '治疗后' : `治疗后 ${Math.round(W.w)}%`;
    };
    const setSide = (s, animateAge = true) => {
      if (s === side) return;
      side = s;
      vsegBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === s)));
      const target = s === 'after' ? V.after : V.before;
      if (reduced || !animateAge) { age.v = target; paintAge(); }
      else gsap.to(age, { v: target, duration: 1.4, ease: 'power2.inOut', onUpdate: paintAge, overwrite: true });
    };
    let wt = null;
    const wipeTo = (w, dur = 1.1) => {
      wt?.kill();
      if (reduced) { W.w = w; paintWipe(); return; }
      wt = gsap.to(W, { w, duration: dur, ease: 'power3.inOut', onUpdate: paintWipe });
    };
    vsegBtns.forEach((b) => b.addEventListener('click', () => { const s = b.dataset.s; setSide(s); wipeTo(s === 'after' ? 100 : 0); }));
    wipe.addEventListener('input', () => {
      wt?.kill(); vIntro?.kill();
      W.w = +wipe.value; paintWipe();
      setSide(W.w >= 50 ? 'after' : 'before');
    });
    paintAge(); paintWipe();

    // intro: on first view sweep the wipe and count TruSkin Age down 32 → 27
    let vIntro = null;
    if (!reduced) {
      const o = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        o.disconnect();
        vIntro = gsap.delayedCall(0.6, () => { setSide('after'); wipeTo(100, 1.6); });
      }, { threshold: 0.45 });
      o.observe(vis);
    } else { setSide('after', false); W.w = 100; paintWipe(); }
  },
};
