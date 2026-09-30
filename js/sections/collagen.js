// #collagen — 胶原新生 (DA p.4 · 动物研究)
// Three.js fibre field scrubbed along a time axis (治疗前 → 即刻 → 第 4 周 → 第 12 周).
// Fibre COUNTS follow DATA.charts.collagen (ratio vs week 0, values read off the brochure chart ≈).
// The immediate thermal contraction is a principle schematic (原理示意).

const TL = { pre: 0.08, now: 0.22, w4: 0.6 }; // progress keyframes on the time axis
const N1 = 9, N3 = 16;                       // baseline fibre counts (visual scale only)

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const weekOf = (p) => (p < TL.now ? 0 : p < TL.w4 ? (4 * (p - TL.now)) / (TL.w4 - TL.now) : 4 + (8 * (p - TL.w4)) / (1 - TL.w4));

export default {
  id: 'collagen',
  nav: '胶原新生',
  async init(root, ctx) {
    const { gsap, ScrollTrigger, lib, data } = ctx;
    const reduced = !!ctx.reduced;
    const C = data.charts.collagen; // { weeks:[0,4,12], type1:[…], type3:[…] }
    const lerpPts = (arr, w) => {
      const W = C.weeks;
      if (w <= W[0]) return arr[0];
      for (let i = 0; i < W.length - 1; i++) if (w <= W[i + 1]) return arr[i] + ((arr[i + 1] - arr[i]) * (w - W[i])) / (W[i + 1] - W[i]);
      return arr[arr.length - 1];
    };
    const pct = (v) => Math.round((v - 1) * 100);
    const I_12 = C.type1[2], III_12 = C.type3[2];

    root.innerHTML = `
      <div class="wrap">
        <header class="sec-head">
          <span class="eyebrow">04 · COLLAGEN · 动物研究</span>
          <h2 class="h1" data-reveal>促生<span class="grad-text">双重胶原蛋白</span></h2>
          <p class="lead" data-reveal><b>Ⅰ 型和 Ⅲ 型胶原同步提升。</b>沿时间轴滚动——从射频热作用后的即刻变化，到第 4 周、第 12 周的胶原新生；三维纤维的数量随彩页动物研究的胶原相对含量曲线同步增长。</p>
        </header>
      </div>

      <div class="cg-stage">
        <div class="wrap wrap--wide cg-grid">
          <div class="cg-scene">
            <div class="cg-orb" aria-hidden="true"></div>
            <canvas class="cg-canvas" role="img" aria-label="胶原纤维三维示意：Ⅰ 型粗纤维束与 Ⅲ 型细纤维随时间轴生长"></canvas>
            <div class="cg-hud cg-hud--tl">
              <span class="cg-when"><b class="cg-when__big">治疗前</b><small class="cg-when__sub">基线 · 第 0 周</small></span>
              <span class="cg-sim">原理示意 · 胶原受热收缩</span>
            </div>
            <div class="cg-hud cg-hud--tr">
              <span class="cg-key"><i class="k1"></i>Ⅰ 型 · 粗纤维束</span>
              <span class="cg-key"><i class="k3"></i>Ⅲ 型 · 细纤维</span>
              <button class="cg-key cg-key--new" type="button" aria-pressed="true"><i class="kn"></i>标记新生纤维</button>
            </div>
            <div class="cg-axis">
              <div class="cg-axis__top">
                <button class="cg-play" type="button" aria-label="播放时间轴" aria-pressed="false"><svg class="i-play" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z"/></svg><svg class="i-pause" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z"/></svg></button>
                <div class="cg-axis__track">
                  <i class="cg-axis__fill"></i><i class="cg-axis__knob"></i>
                  ${[['治疗前', 0], ['即刻', (TL.pre + TL.now) / 2], ['第 4 周', TL.w4], ['第 12 周', 1]].map(([l, p]) => `<button class="cg-tick" type="button" data-p="${p}" style="left:${p * 100}%"><i></i><span>${l}</span></button>`).join('')}
                  <input class="cg-axis__range" type="range" min="0" max="1000" value="0" aria-label="时间轴：治疗前至第 12 周" />
                </div>
              </div>
            </div>
          </div>

          <aside class="cg-side">
            <div class="card cg-chart">
              <div class="cg-chart__head">
                <span class="cg-chart__t">胶原相对含量</span>
                <span class="micro">以第 0 周为 1 · 数值 ≈ 估读</span>
              </div>
              <svg class="viz cg-svg" viewBox="0 0 420 250" role="img" aria-label="Ⅰ 型与 Ⅲ 型胶原相对含量随时间变化曲线（约值）：第 4 周 ≈${C.type1[1]} 与 ≈${C.type3[1]}，第 12 周 ≈${C.type1[2]} 与 ≈${C.type3[2]}"></svg>
              <div class="legend cg-legend"><span><i style="background:var(--green)"></i>Type Ⅰ collagen</span><span><i style="background:var(--violet)"></i>Type Ⅲ collagen</span></div>
            </div>
            <div class="cg-types">
              <div class="card cg-type cg-type--1">
                <span class="cg-type__k">Ⅰ 型胶原</span>
                <span class="cg-type__v"><i class="cg-type__ap" aria-hidden="true">≈</i><span class="num cg-v1">1.00</span><small>×</small></span>
                <span class="cg-type__at micro">第 0 周 · 基线</span>
                <span class="cg-type__d">“塑形紧致<br>恢复皮肤弹性”</span>
              </div>
              <div class="card cg-type cg-type--3">
                <span class="cg-type__k">Ⅲ 型胶原</span>
                <span class="cg-type__v"><i class="cg-type__ap" aria-hidden="true">≈</i><span class="num cg-v3">1.00</span><small>×</small></span>
                <span class="cg-type__at micro">第 0 周 · 基线</span>
                <span class="cg-type__d">“亮白嘭弹<br>重现细腻柔嫩”</span>
              </div>
            </div>
            <p class="note cg-note">*数据来源于：实验猪切片研究（彩页 第 4 页）。曲线数值由图表估读（≈）；三维纤维数量按曲线比例示意，即刻收缩为原理示意。卡片引号内为彩页对胶原类型的描述，非本产品适应症（本产品适应症：${data.product.indicationShort}）。${data.disclaimers.sim}</p>
          </aside>
        </div>
      </div>

      <div class="wrap cg-histo">
        <div class="cg-histo__head">
          <div>
            <span class="eyebrow">HISTOLOGY · H&amp;E</span>
            <h3 class="h2" data-reveal>组织学评估</h3>
          </div>
          <p class="cg-quote" data-reveal>“YOUMAGIC 医学专家团队通过对组织学评估观察，科学证实单极射频对真皮层胶原再生有显著的效果。”<span class="tag-src">— 彩页 第 4 页 · 动物研究</span></p>
        </div>
        <div class="cg-switch">
          <span class="micro">对比时间点</span>
          <div class="seg" role="group" aria-label="对比时间点（左侧为治疗前）">
            <button type="button" data-t="before" aria-pressed="false">治疗前</button>
            <button type="button" data-t="4w" aria-pressed="false">治疗后 4 周</button>
            <button type="button" data-t="12w" aria-pressed="true">治疗后 12 周</button>
          </div>
          <span class="micro cg-switch__hint">拖动分隔线对比 · 左侧为治疗前</span>
        </div>
        <div class="cg-cmps">
          ${[
            ['he200', '胶原蛋白含量显著增加', 'H&amp;E 标准染色，×200'],
            ['he2', '胶原蛋白厚度明显增加', 'H&amp;E 标准染色，×2'],
          ].map(([set, t, s]) => `
          <figure class="cg-cmp" data-set="${set}" data-reveal>
            <div class="cg-cmp__frame" style="--x:50%">
              <img class="cg-cmp__a" src="assets/img/${set}-before.webp" alt="${t}：治疗前，${s.replace('&amp;', '&')}" width="484" height="254" loading="lazy" decoding="async" />
              <div class="cg-cmp__b"><img src="assets/img/${set}-12w.webp" alt="${t}：治疗后 12 周，${s.replace('&amp;', '&')}" width="484" height="254" loading="lazy" decoding="async" /></div>
              <span class="cg-cmp__lab cg-cmp__lab--a">治疗前</span>
              <span class="cg-cmp__lab cg-cmp__lab--b">治疗后 12 周</span>
              <div class="cg-cmp__bar" aria-hidden="true"><i><svg viewBox="0 0 20 12"><path d="M7 1 2 6l5 5M13 1l5 5-5 5"/></svg></i></div>
              <input class="cg-cmp__range" type="range" min="0" max="100" value="50" aria-label="${t}：拖动对比分隔线" />
            </div>
            <figcaption><b>${t}</b><span class="mono">${s}</span></figcaption>
          </figure>`).join('')}
        </div>
        <p class="note">*数据来源于：实验猪切片研究（彩页 第 4 页）。动物实验结果仅供专业人士参考，不直接代表人体临床效果。</p>
      </div>`;

    const $ = (s) => root.querySelector(s);
    const $$ = (s) => [...root.querySelectorAll(s)];
    const stage = $('.cg-stage');
    const scene3 = $('.cg-scene');
    const canvas = $('.cg-canvas');
    const range = $('.cg-axis__range');
    const fill = $('.cg-axis__fill'), knob = $('.cg-axis__knob');
    const ticks = $$('.cg-tick');
    const whenBig = $('.cg-when__big'), whenSub = $('.cg-when__sub');
    const v1 = $('.cg-v1'), v3 = $('.cg-v3');
    const at1 = $('.cg-type--1 .cg-type__at'), at3 = $('.cg-type--3 .cg-type__at');

    const st = { p: reduced ? 1 : 0, target: reduced ? 1 : 0, markNew: true, px: 0, py: 0, ppx: 0, ppy: 0 };

    /* ---------------- chart ---------------- */
    const svgEl = $('.cg-svg');
    const VW = 420;
    let VH = 250, X, Y, line1, line3, head, pts, dot1, dot3, phase;
    const s = (tag, a, parent = svgEl) => lib.svg(tag, a, parent);
    function buildChart(vh) {
      VH = Math.round(vh);
      svgEl.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
      svgEl.replaceChildren();
      const yb = VH - 36, yt = 22;
      X = (w) => 50 + (w / 12) * 350; Y = (v) => yb - (v / 2) * (yb - yt);
      for (let v = 0; v <= 2.001; v += 0.5) {
        s('line', { x1: 50, x2: 400, y1: Y(v), y2: Y(v), class: 'gridline' });
        s('text', { x: 36, y: Y(v) + 4, 'text-anchor': 'end' }).textContent = v.toFixed(1);
      }
      for (let w = 0; w <= 12; w += 2) s('text', { x: X(w), y: yb + 18, 'text-anchor': 'middle' }).textContent = w;
      s('line', { x1: 50, x2: 400, y1: Y(0), y2: Y(0), class: 'cg-axisline' });
      s('text', { x: 225, y: yb + 34, 'text-anchor': 'middle', class: 'cg-axt' }).textContent = '时间（周）';
      phase = s('rect', { x: X(0), y: Y(2) - 4, width: 0, height: Y(0) - Y(2) + 4, class: 'cg-band' });
      s('path', { d: `M${C.weeks.map((w, i) => `${X(w)},${Y(C.type1[i])}`).join('L')}`, class: 'cg-ghost' });
      s('path', { d: `M${C.weeks.map((w, i) => `${X(w)},${Y(C.type3[i])}`).join('L')}`, class: 'cg-ghost' });
      line1 = s('path', { class: 'cg-line cg-line--1' });
      line3 = s('path', { class: 'cg-line cg-line--3' });
      head = s('line', { y1: Y(2) - 4, y2: Y(0), class: 'cg-head' });
      pts = C.weeks.map((w, i) => {
        const g = s('g', { class: 'cg-pt', 'data-w': w });
        s('circle', { cx: X(w), cy: Y(C.type1[i]), r: 4.2, class: 'cg-pt--1' }, g);
        s('circle', { cx: X(w), cy: Y(C.type3[i]), r: 4.2, class: 'cg-pt--3' }, g);
        if (i > 0) {
          const tx = X(w) - (i === 2 ? 4 : 0), anchor = i === 2 ? 'end' : 'middle';
          s('text', { x: tx, y: Y(C.type1[i]) - 10, 'text-anchor': anchor, class: 'cg-lab cg-lab--1' }, g).textContent = `≈${C.type1[i].toFixed(2)}`;
          s('text', { x: tx, y: Y(C.type3[i]) + 18, 'text-anchor': anchor, class: 'cg-lab cg-lab--3' }, g).textContent = `≈${C.type3[i].toFixed(2)}`;
        }
        return g;
      });
      dot1 = s('circle', { r: 5.5, class: 'cg-dot cg-dot--1' });
      dot3 = s('circle', { r: 5.5, class: 'cg-dot cg-dot--3' });
    }
    buildChart(250);
    // pinned desktop: let the chart take the side column's spare height (no dead space under the cards)
    let chartW = 0, chartH = 0;
    const chartRO = new ResizeObserver(() => {
      const r = svgEl.getBoundingClientRect();
      const pinned = root.classList.contains('cg-pinned');
      if (r.width > 50) svgEl.style.setProperty('--cg-fs', Math.max(11, 9.5 / (r.width / VW)).toFixed(1) + 'px'); // keep axis text ≥ 9.5 px on narrow columns
      const want = pinned && r.width > 50 && r.height > 50 ? lib.clamp((VW * r.height) / r.width, 250, 460) : 250;
      if (Math.abs(r.width - chartW) < 1 && Math.abs(r.height - chartH) < 1 && Math.abs(want - VH) < 2) return;
      chartW = r.width; chartH = r.height;
      if (Math.abs(want - VH) >= 2) { buildChart(want); updateUI(st.p, true); }
    });
    chartRO.observe(svgEl);

    let lastShown = -1;
    function updateUI(p) {
      const w = weekOf(p);
      const path = (arr) => {
        let d = `M${X(0)},${Y(arr[0])}`;
        for (let i = 1; i < C.weeks.length; i++) {
          if (C.weeks[i] <= w) d += `L${X(C.weeks[i])},${Y(arr[i])}`;
          else { d += `L${X(w)},${Y(lerpPts(arr, w))}`; break; }
        }
        return d;
      };
      line1.setAttribute('d', path(C.type1)); line3.setAttribute('d', path(C.type3));
      head.setAttribute('x1', X(w)); head.setAttribute('x2', X(w));
      dot1.setAttribute('cx', X(w)); dot1.setAttribute('cy', Y(lerpPts(C.type1, w)));
      dot3.setAttribute('cx', X(w)); dot3.setAttribute('cy', Y(lerpPts(C.type3, w)));
      phase.setAttribute('width', Math.max(0, X(w) - X(0)));
      pts.forEach((g) => g.classList.toggle('is-on', +g.dataset.w <= w + 0.05));
      // measured point readouts (only values that exist on the chart)
      const k = w >= 11.95 ? 2 : w >= 3.95 ? 1 : 0;
      if (k !== lastShown) {
        const prev = lastShown; lastShown = k;
        const lbl = ['第 0 周 · 基线', '第 4 周 · 测量点', '第 12 周 · 测量点'][k];
        at1.textContent = at3.textContent = lbl;
        const from1 = prev < 0 ? C.type1[k] : C.type1[prev], from3 = prev < 0 ? C.type3[k] : C.type3[prev];
        if (reduced || prev < 0) { v1.textContent = C.type1[k].toFixed(2); v3.textContent = C.type3[k].toFixed(2); }
        else {
          const o = { a: from1, b: from3 };
          gsap.to(o, { a: C.type1[k], b: C.type3[k], duration: 0.8, ease: 'power3.out', overwrite: true, onUpdate: () => { v1.textContent = o.a.toFixed(2); v3.textContent = o.b.toFixed(2); } });
        }
        root.querySelectorAll('.cg-type').forEach((c) => c.classList.toggle('is-up', k > 0));
        root.querySelector('.cg-type--1').dataset.pct = k ? `≈ +${pct(C.type1[k])}%` : '';
        root.querySelector('.cg-type--3').dataset.pct = k ? `≈ +${pct(C.type3[k])}%` : '';
      }
      // time label
      let big, sub;
      if (p < TL.pre) { big = '治疗前'; sub = '基线 · 第 0 周'; }
      else if (p < TL.now) { big = '治疗即刻'; sub = '射频热作用后'; }
      else { big = `第 ${Math.max(1, Math.round(w))} 周`; sub = '治疗后 · 胶原新生'; }
      if (whenBig.textContent !== big) whenBig.textContent = big;
      if (whenSub.textContent !== sub) whenSub.textContent = sub;
      root.classList.toggle('cg-is-now', p >= TL.pre * 0.6 && p < TL.now + 0.06);
      fill.style.transform = `scaleX(${p})`;
      knob.style.left = p * 100 + '%';
      if (document.activeElement !== range) range.value = Math.round(p * 1000);
      ticks.forEach((t) => t.classList.toggle('is-past', +t.dataset.p <= p + 0.001));
    }

    /* ---------------- three.js scene ---------------- */
    let three = null;
    try { three = await buildScene(); } catch (err) { console.warn('[collagen] WebGL unavailable', err); root.classList.add('cg-nogl'); }

    async function buildScene() {
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/addons/RoomEnvironment.js');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.fog = new THREE.Fog(0xeef2ee, 14, 27);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0.3, 17);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe3d8, 0.65));
      const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(5, 8, 7); scene.add(key);
      const rim = new THREE.DirectionalLight(0xc6b4ff, 0.9); rim.position.set(-6, -3, -5); scene.add(rim);

      const U = { uContract: { value: 0 }, uTime: { value: 0 } };
      const patch = (m) => {
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uContract = U.uContract; sh.uniforms.uTime = U.uTime;
          sh.vertexShader = 'uniform float uContract;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            float cc = uContract;
            transformed.x *= 1.0 - 0.12 * cc;
            transformed.y += sin(transformed.x * 2.6 + transformed.z * 1.3) * 0.13 * cc;
            transformed.z += cos(transformed.x * 1.9 + transformed.y) * 0.08 * cc;
            transformed.y += sin(transformed.x * 0.55 + uTime * 0.5) * 0.05;`);
        };
        return m;
      };
      const HEAT = new THREE.Color('#ff7040');
      const mk = (o) => patch(new THREE.MeshPhysicalMaterial({ roughness: 0.34, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.3, sheen: 0.8, sheenRoughness: 0.45, ...o }));
      const M = {
        i: mk({ color: '#237a58', sheenColor: new THREE.Color('#9ff5d0'), emissive: HEAT, emissiveIntensity: 0 }),
        iii: mk({ color: '#8467e6', sheenColor: new THREE.Color('#e3d9ff'), emissive: HEAT, emissiveIntensity: 0 }),
        iNew: mk({ color: '#0fb97c', sheenColor: new THREE.Color('#d7fff0'), emissive: new THREE.Color('#43e6a8'), emissiveIntensity: 0.32 }),
        iiiNew: mk({ color: '#8a4dff', sheenColor: new THREE.Color('#ffffff'), emissive: new THREE.Color('#8a5cf0'), emissiveIntensity: 0.4 }),
      };

      const world = new THREE.Group();
      world.rotation.set(0.12, 0.38, -0.1);
      scene.add(world);
      const rnd = mulberry(21);
      const LEN = 22;
      const centerline = (y, z, tilt, wav) => {
        const P = []; const a1 = rnd() * 6.28, a2 = rnd() * 6.28, amp = wav * (0.6 + rnd() * 0.6);
        for (let k = 0; k <= 8; k++) {
          const u = k / 8, x = -LEN / 2 + LEN * u;
          P.push(new THREE.Vector3(x, y + Math.sin(u * 5.5 + a1) * amp + tilt * x, z + Math.cos(u * 4.2 + a2) * amp * 0.8));
        }
        return new THREE.CatmullRomCurve3(P, false, 'centripetal');
      };
      const helix = (curve, r, turns, k, n) => {
        const fr = curve.computeFrenetFrames(n, false); const P = [];
        for (let i = 0; i <= n; i++) {
          const u = i / n, p = curve.getPointAt(u), th = turns * u * Math.PI * 2 + (k * Math.PI * 2) / 3;
          P.push(p.clone().addScaledVector(fr.normals[i], Math.cos(th) * r).addScaledVector(fr.binormals[i], Math.sin(th) * r));
        }
        return new THREE.CatmullRomCurve3(P);
      };
      const fibres1 = [], fibres3 = [];
      const total1 = Math.ceil(N1 * C.type1[C.type1.length - 1]), total3 = Math.ceil(N3 * C.type3[C.type3.length - 1]);
      // Type Ⅰ: thick triple-helix bundles, roughly parallel (dermal bundles)
      for (let i = 0; i < total1; i++) {
        const isNew = i >= N1;
        const y = isNew ? -1.9 + rnd() * 3.8 : -1.9 + (3.8 * (i + 0.5)) / N1 + (rnd() - 0.5) * 0.3;
        const z = -2.8 + rnd() * 3.6;
        const cl = centerline(y, z, (rnd() - 0.5) * 0.12, 0.28);
        const rev = rnd() < 0.5;
        const meshes = [];
        const segs = 260, rad = 7;
        for (let k = 0; k < 3; k++) {
          let hc = helix(cl, 0.1, LEN / 1.5, k, 300);
          if (rev) hc = new THREE.CatmullRomCurve3(hc.points.slice().reverse());
          const geo = new THREE.TubeGeometry(hc, segs, 0.052, rad, false);
          const mesh = new THREE.Mesh(geo, isNew ? M.iNew : M.i);
          world.add(mesh); meshes.push(mesh);
        }
        fibres1.push({ meshes, isNew, per: segs * rad * 6, g: isNew ? 0 : 1 });
      }
      // Type Ⅲ: fine, more wavy, more varied directions (reticular)
      for (let i = 0; i < total3; i++) {
        const isNew = i >= N3;
        const cl = centerline(-2.1 + rnd() * 4.2, -3 + rnd() * 4.2, (rnd() - 0.5) * 0.22, 0.55);
        let curve = cl;
        if (rnd() < 0.5) curve = new THREE.CatmullRomCurve3(cl.points.slice().reverse());
        const segs = 150, rad = 5;
        const geo = new THREE.TubeGeometry(curve, segs, 0.024, rad, false);
        const mesh = new THREE.Mesh(geo, isNew ? M.iiiNew : M.iii);
        mesh.rotation.x = (rnd() - 0.5) * 0.4; mesh.rotation.y = (rnd() - 0.5) * 0.5;
        world.add(mesh);
        fibres3.push({ meshes: [mesh], isNew, per: segs * rad * 6, g: isNew ? 0 : 1 });
      }
      // ground substance motes + heat sparks
      const mote = (n, size, color, opacity, spread) => {
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * spread[0]; pos[i * 3 + 1] = (rnd() - 0.5) * spread[1]; pos[i * 3 + 2] = (rnd() - 0.5) * spread[2]; }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ size, color, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
        const pts = new THREE.Points(geo, mat); world.add(pts); return pts;
      };
      const motes = mote(420, 0.05, '#8fb9a6', 0.5, [20, 7, 7]);
      const sparks = mote(220, 0.075, '#f0603f', 0, [14, 5.5, 4.5]);
      sparks.material.blending = THREE.AdditiveBlending;

      function setGrowth(list, n) {
        list.forEach((f, i) => {
          if (!f.isNew) return;
          const g = Math.min(1, Math.max(0, n - i));
          if (g === f.g) return;
          f.g = g;
          for (const m of f.meshes) { m.visible = g > 0.002; m.geometry.setDrawRange(0, Math.floor(g * f.per / 6) * 6); }
        });
      }
      function resize() {
        const r = canvas.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.fov = r.width / r.height < 1 ? 35 : 30;
        camera.updateProjectionMatrix();
      }
      function frame(t) {
        const p = st.p;
        const w = weekOf(p);
        setGrowth(fibres1, N1 * lerpPts(C.type1, w));
        setGrowth(fibres3, N3 * lerpPts(C.type3, w));
        const contract = sstep(TL.pre - 0.03, TL.pre + 0.07, p) * (1 - sstep(TL.now - 0.02, TL.now + 0.14, p));
        const glow = sstep(TL.pre - 0.03, TL.pre + 0.05, p) * (1 - sstep(TL.now - 0.06, TL.now + 0.08, p));
        U.uContract.value = contract; U.uTime.value = t;
        M.i.emissiveIntensity = glow * 0.55; M.iii.emissiveIntensity = glow * 0.55;
        // "mark new fibres": existing fibres go quiet, newly formed ones take the vivid brand colours
        const mk = st.markNew && p > TL.now;
        M.i.color.set(mk ? '#6f9585' : '#237a58'); M.iii.color.set(mk ? '#a49dc4' : '#8467e6');
        M.iNew.color.set(mk ? '#0fb97c' : '#237a58'); M.iiiNew.color.set(mk ? '#8a4dff' : '#8467e6');
        M.iNew.emissiveIntensity = mk ? 0.32 : 0; M.iiiNew.emissiveIntensity = mk ? 0.4 : 0;
        sparks.material.opacity = glow * 0.9;
        const sp = sparks.geometry.attributes.position;
        if (glow > 0.01) { for (let i = 0; i < sp.count; i++) { let y = sp.getY(i) + 0.012; if (y > 2.8) y = -2.8; sp.setY(i, y); } sp.needsUpdate = true; }
        motes.rotation.y = t * 0.02;
        st.ppx += (st.px - st.ppx) * 0.05; st.ppy += (st.py - st.ppy) * 0.05;
        world.rotation.y = 0.38 + Math.sin(t * 0.18) * 0.05 + st.ppx * 0.14;
        world.rotation.x = 0.12 + st.ppy * 0.08;
        camera.position.z = 17 - 2.2 * sstep(0.2, 1, p);
        camera.position.x = st.ppx * 0.4; camera.position.y = 0.3 - st.ppy * 0.25;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }
      resize();
      return { resize, frame, renderer };
    }

    /* ---------------- interaction ---------------- */
    let pinST = null;
    const playBtn = $('.cg-play');
    let playTw = null, scrollTw = null;
    const setPlaying = (on) => {
      playBtn.classList.toggle('is-playing', on);
      playBtn.setAttribute('aria-pressed', String(on));
      playBtn.setAttribute('aria-label', on ? '暂停时间轴' : '播放时间轴');
    };
    const stopPlay = () => { playTw?.kill(); scrollTw?.kill(); playTw = scrollTw = null; setPlaying(false); };
    const goTo = (p, instant, dur) => {
      p = lib.clamp(p);
      if (pinST) {
        const y = pinST.start + (pinST.end - pinST.start) * p;
        if (instant) { if (ctx.lenis) ctx.lenis.scrollTo(y, { immediate: true }); else window.scrollTo({ top: y, behavior: 'auto' }); return; }
        // play through the pinned scroll range at a readable pace (user scroll still interrupts it)
        const o = { y: window.scrollY };
        scrollTw?.kill();
        return (scrollTw = gsap.to(o, {
          y, duration: dur || 1.2, ease: dur ? 'none' : 'power2.inOut',
          onUpdate: () => { if (ctx.lenis) ctx.lenis.scrollTo(o.y, { immediate: true }); else window.scrollTo(0, o.y); },
          onComplete: () => { if (playTw === scrollTw) { playTw = null; setPlaying(false); } scrollTw = null; },
        }));
      } else {
        st.target = p; if (instant || reduced) st.p = p;
        if (reduced) renderOnce();
      }
    };
    ticks.forEach((b) => b.addEventListener('click', () => { stopPlay(); goTo(+b.dataset.p); }));
    range.addEventListener('input', () => { stopPlay(); goTo(range.value / 1000, true); });
    playBtn.addEventListener('click', () => {
      if (playTw) { stopPlay(); return; }
      const from = st.target > 0.98 ? 0 : st.target;
      setPlaying(true);
      if (pinST) {
        if (from === 0 && st.target > 0.98) goTo(0, true);
        playTw = goTo(1, false, Math.max(1.5, 8 * (1 - from)));
        return;
      }
      st.target = from; st.p = from;
      const o = { v: from };
      playTw = gsap.to(o, { v: 1, duration: 7 * (1 - from), ease: 'none', onUpdate: () => { st.target = o.v; if (reduced) { st.p = o.v; renderOnce(); } }, onComplete: () => { playTw = null; setPlaying(false); } });
    });
    // any manual wheel / touch scroll takes over from a pinned "play"
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, (e) => {
      if (!(playTw || scrollTw) || !pinST || e.target?.closest?.('.cg-axis')) return;
      if (ev === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) return;
      stopPlay();
    }, { passive: true }));
    $('.cg-key--new').addEventListener('click', (e) => {
      st.markNew = !st.markNew; e.currentTarget.setAttribute('aria-pressed', String(st.markNew));
      if (reduced) renderOnce();
    });
    scene3.addEventListener('pointermove', (e) => {
      const r = scene3.getBoundingClientRect();
      st.px = ((e.clientX - r.left) / r.width) * 2 - 1; st.py = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    scene3.addEventListener('pointerleave', () => { st.px = 0; st.py = 0; });

    const mm = gsap.matchMedia();
    mm.add('(min-width: 1000px) and (min-height: 700px)', () => {
      if (reduced) return;
      root.classList.add('cg-pinned');
      requestAnimationFrame(() => three?.resize());
      pinST = ScrollTrigger.create({
        trigger: stage, start: 'top top', end: '+=200%', pin: true, pinSpacing: true, anticipatePin: 1,
        onUpdate: (self) => { st.target = self.progress; },
      });
      return () => { pinST?.kill(); pinST = null; root.classList.remove('cg-pinned'); requestAnimationFrame(() => three?.resize()); };
    });
    // non-pinned: play the time axis once when the scene first comes into view
    if (!reduced) {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting) && !pinST && st.target < 0.01) { io.disconnect(); if (!playTw) playBtn.click(); }
        else if (pinST) io.disconnect();
      }, { threshold: 0.55 });
      io.observe(scene3);
    }

    const ro = new ResizeObserver(() => { three?.resize(); if (reduced) renderOnce(); });
    ro.observe(canvas);

    function renderOnce() { updateUI(st.p); three?.frame(0); }
    if (reduced) { updateUI(1); requestAnimationFrame(renderOnce); }
    else {
      updateUI(0);
      let lastP = -1;
      lib.visibleLoop(scene3, (dt, t) => {
        st.p += (st.target - st.p) * Math.min(1, dt * 7);
        if (Math.abs(st.target - st.p) < 0.0004) st.p = st.target;
        if (Math.abs(st.p - lastP) > 1e-5) { updateUI(st.p); lastP = st.p; }
        three?.frame(t);
      });
    }

    /* ---------------- histology compare ---------------- */
    const LABEL = { before: '治疗前', '4w': '治疗后 4 周', '12w': '治疗后 12 周' };
    const cmps = $$('.cg-cmp');
    const imgsToLoad = [];
    function setTime(tk) {
      $$('.cg-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === tk)));
      cmps.forEach((fig) => {
        const set = fig.dataset.set, frame = fig.querySelector('.cg-cmp__frame');
        const img = fig.querySelector('.cg-cmp__b img');
        const src = `assets/img/${set}-${tk === 'before' ? 'before' : tk}.webp`;
        if (!img.src.endsWith(src)) {
          img.style.opacity = '0';
          const pre = new Image(); pre.src = src;
          pre.decode?.().catch(() => {}).finally(() => { img.src = src; img.alt = img.alt.replace(/：[^，]+，/, `：${LABEL[tk]}，`); img.style.opacity = '1'; });
        }
        frame.classList.toggle('is-single', tk === 'before');
        fig.querySelector('.cg-cmp__lab--b').textContent = LABEL[tk];
      });
    }
    $$('.cg-switch button').forEach((b) => b.addEventListener('click', () => setTime(b.dataset.t)));
    cmps.forEach((fig) => {
      const frame = fig.querySelector('.cg-cmp__frame');
      const rng = fig.querySelector('.cg-cmp__range');
      const set = (x) => { x = lib.clamp(x, 2, 98); frame.style.setProperty('--x', x + '%'); rng.value = x; };
      let drag = false;
      const pos = (e) => { const r = frame.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
      frame.addEventListener('pointerdown', (e) => { if (frame.classList.contains('is-single')) return; drag = true; frame.setPointerCapture(e.pointerId); set(pos(e)); frame.classList.add('is-drag'); });
      frame.addEventListener('pointermove', (e) => { if (drag) set(pos(e)); });
      const end = () => { drag = false; frame.classList.remove('is-drag'); };
      frame.addEventListener('pointerup', end); frame.addEventListener('pointercancel', end);
      rng.addEventListener('input', () => set(+rng.value));
      imgsToLoad.push(...fig.querySelectorAll('img'));
      // hint: sweep the divider once when it first comes into view
      if (!reduced) {
        const io = new IntersectionObserver((es) => {
          if (!es.some((e) => e.isIntersecting)) return;
          io.disconnect();
          const o = { x: 82 };
          gsap.to(o, { x: 50, duration: 1.6, ease: 'expo.out', delay: 0.3, onUpdate: () => { if (!drag) set(o.x); } });
        }, { threshold: 0.5 });
        io.observe(frame);
      }
    });
    // frames have fixed aspect ratios, so lazy-loaded images never change layout — no ScrollTrigger.refresh needed
    // (a global refresh here fired mid-scroll, right below the pinned scene).
  },
};
