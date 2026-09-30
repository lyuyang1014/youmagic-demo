// HERITAGE — brand trust story (DA p.6): SINCE 1995 as extruded, bevelled 3D numerals in the brand
// gradient metal (ym3d/dataviz.mjs createDigits3D) that stand up and roll into place on slot-machine drums
// as you scroll (pinned on desktop), with camera depth + pointer parallax, a specular glint when they land
// and a re-roll on hover/tap; Tsinghua gate re-drawn as live line-art (edge-detected in-browser from the
// brochure image), abstract patent-document motif, and a factual milestone timeline.
// The CSS odometer below stays in the DOM as the layout box for the 3D numerals and as the no-WebGL fallback.
import * as THREE from 'three';
import * as S from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createDigits3D } from '../ym3d/dataviz.mjs';
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

// host.mjs workaround (library issue): mount3D rebuilds on the SAME canvas after destroy() called
// forceContextLoss(), so the second build fails ("WebGL unavailable", lost context) and the fallback fires.
// Re-mount on a fresh canvas right after each far-away dispose; pointer listeners live on the container.
function mountFresh(container, opts) {
  const h = { m: null, get canvas() { return h.m?.canvas; }, get state() { return h.m?.state; }, invalidate() { h.m?.invalidate(); } };
  const make = () => {
    const m = mount3D(container, {
      ...opts,
      dispose(s) { opts.dispose?.(s); setTimeout(() => { if (h.m === m) { m.destroy(); make(); } }, 0); },
    });
    h.m = m;
  };
  make();
  return h;
}

const GATE = 'assets/img/tsinghua-gate.webp';

// deterministic pseudo-random for the abstract document outlines
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** abstract patent-document outline (no text) — kind 'cert' = ornate certificate, 'doc' = form sheet */
function docSVG(kind, seed) {
  const r = rng(seed * 7919 + 13);
  let s = `<svg viewBox="0 0 210 297" aria-hidden="true" focusable="false"><rect class="p" x="2" y="2" width="206" height="293" rx="3"/>`;
  const ln = (x1, y, len, w = 1.4, o = 0.55) => `<path d="M${x1} ${y}h${len.toFixed(1)}" stroke-width="${w}" opacity="${o}"/>`;
  if (kind === 'cert') {
    s += `<rect x="11" y="11" width="188" height="275" rx="2" opacity=".55"/><rect x="15" y="15" width="180" height="267" rx="1.5" opacity=".3"/>`;
    for (const [cx, cy] of [[15, 15], [195, 15], [15, 282], [195, 282]]) s += `<circle cx="${cx}" cy="${cy}" r="6" opacity=".45"/>`;
    s += `<circle cx="105" cy="44" r="12" opacity=".8"/><circle cx="105" cy="44" r="6.5" opacity=".5"/>`;
    s += `<rect x="62" y="66" width="86" height="7" rx="3.5" class="f" opacity=".55"/>`;
    s += ln(82, 84, 46, 1.2, 0.4);
    for (let y = 104; y <= 206; y += 10.5) s += ln(30, y, 90 + r() * 60);
    s += `<circle cx="152" cy="238" r="21" class="seal"/><circle cx="152" cy="238" r="15.5" class="seal" stroke-dasharray="2 2.6" opacity=".7"/>`;
    s += ln(34, 250, 58, 1, 0.45) + ln(34, 262, 40, 1, 0.3);
  } else {
    s += `<rect x="18" y="18" width="116" height="16" rx="2" opacity=".5"/>`;
    s += `<rect x="158" y="16" width="30" height="30" rx="1.5" opacity=".7"/>`;
    for (const [x, y] of [[161, 19], [179, 19], [161, 37]]) s += `<rect x="${x}" y="${y}" width="6" height="6" class="f" opacity=".6"/>`;
    let bx = 20;
    while (bx < 110) { const w = r() < 0.4 ? 2.2 : 0.9; s += `<rect x="${bx.toFixed(1)}" y="44" width="${w}" height="12" class="f" opacity=".5"/>`; bx += w + 1.2 + r() * 1.6; }
    s += ln(20, 70, 170, 0.8, 0.3);
    for (let y = 84; y <= 230; y += 9.5) s += ln(20 + (r() < 0.2 ? 12 : 0), y, 60 + r() * 110, 1.2, 0.45);
    s += `<circle cx="150" cy="252" r="19" class="seal"/><circle cx="150" cy="252" r="13" class="seal" opacity=".6"/>`;
  }
  return s + '</svg>';
}

// stage documents (desktop positions in % of the stage; z = depth factor for parallax)
const STAGE_DOCS = [
  { kind: 'cert', l: 3, t: 14, w: 13.5, rot: -13, z: 0.55, c: 'v' },
  { kind: 'doc', l: 9, t: 58, w: 11, rot: 7, z: 1, c: 'm' },
  { kind: 'doc', l: -3, t: 66, w: 12, rot: -5, z: 0.35, c: 's' },
  { kind: 'cert', r: 3, t: 12, w: 13, rot: 11, z: 0.8, c: 'm' },
  { kind: 'doc', r: 10, t: 54, w: 10.5, rot: -8, z: 1, c: 'v' },
  { kind: 'cert', r: -2.5, t: 66, w: 12.5, rot: 5, z: 0.4, c: 's' },
];

export default {
  id: 'heritage',
  nav: '源起',
  async init(root, ctx) {
    const { gsap, ScrollTrigger, lib, data, reduced } = ctx;
    const H = data.heritage;
    const P = data.product;
    const Y = String(H.since);
    const LOOPS = [1, 1, 2, 3];

    const odoHTML = Y.split('').map((dg, i) => {
      const seq = ['&nbsp;'];
      for (let l = 0; l < LOOPS[i]; l++) for (let k = 0; k < 10; k++) seq.push(k);
      for (let k = 0; k <= +dg; k++) seq.push(k);
      return `<span class="her__d" style="--i:${i}"><span class="her__s" data-end="${seq.length - 1}">${seq.map((v) => `<span>${v}</span>`).join('')}</span></span>`;
    }).join('');

    // Only what the sources state: the brochure prints “YOUMAGIC 高能单极射频技术 · SINCE 1995 · 清华大学 ·
    // “八五”国家科技攻关项目” side by side (DA p.6) but says nothing about how they relate — so no invented history
    // (“由此起步”, “持续深耕” …) is written here (KB §9).
    const MILESTONES = [
      {
        k: '01 · SINCE', big: Y, title: [H.lines[0], H.lines[1]],
        text: `彩页原文：“${P.brand} ${P.tech}技术 · SINCE ${Y}”，并列出${H.lines[0]}与${H.lines[1]}。`,
        chips: H.motto.flatMap((m) => m.split(' ')), src: '产品彩页 第 6 页',
      },
      {
        k: '02 · CLINICAL', big: String(data.study.n), u: '例', title: ['多中心随机对照临床试验'],
        text: `${data.study.design.slice(0, 5).join('、')}，${data.study.design[5]}；随访 6 个月（${data.study.followUpDays} 天）。结论：${data.study.conclusion}`,
        chips: data.study.centers, src: '使用说明书 第 32–33 页 · 产品彩页 第 5 页',
      },
      {
        k: '03 · REGISTRATION', big: '2024', title: ['第三类医疗器械注册证'],
        text: `${P.regNo} · ${P.name}。适用范围：${P.indication.replace(/^本产品/, '')}`,
        chips: [P.type], src: '使用说明书 第 1、4、6 页（年份与管理类别依注册证编号规则）',
      },
    ];

    root.innerHTML = `
<div class="her__stage">
  <div class="her__3d" aria-hidden="true"></div>
  <div class="her__bg" aria-hidden="true">
    <div class="her__glow"></div>
    <canvas class="her__gate" width="1235" height="568"></canvas>
    <div class="her__docs">${STAGE_DOCS.map((d, i) => `
      <div class="her__doc her__doc--${d.c}" style="${d.l !== undefined ? `left:${d.l}%` : `right:${d.r}%`};top:${d.t}%;--w:${d.w}vw;--rot:${d.rot}deg;--z:${d.z}">
        <div class="her__doc-in">${docSVG(d.kind, i + 3)}</div>
      </div>`).join('')}
    </div>
  </div>
  <div class="her__center">
    <span class="eyebrow">01 · HERITAGE</span>
    <p class="her__kick"><b>${P.brand}</b><span>${P.tech}技术</span></p>
    <div class="her__year" role="img" aria-label="SINCE ${Y}" title="悬停或轻点，年份再滚动一次">
      <span class="her__since" aria-hidden="true">SINCE</span>
      <span class="her__odo" aria-hidden="true">${odoHTML}</span>
    </div>
    <h2 class="her__uni">${H.lines[0]}</h2>
    <p class="her__proj">${H.lines[1]}</p>
    <p class="her__motto"><span>${H.motto[0]}</span><i></i><span>${H.motto[1]}</span></p>
  </div>
</div>

<div class="wrap her__body">
  <div class="her__pillars">
    <article class="her__pillar card" data-reveal>
      <div class="her__pillar-art her__arch" aria-hidden="true">
        <svg viewBox="0 0 240 150"><path class="a6" d="M4 144h232"/><path class="a1" d="M24 144V60h54v84M162 144V60h54v84"/><path class="a2" d="M14 60h212M18 60V46h204v14M24 46V30h54v16M162 46V30h54v16M78 46V38h84v8"/><path class="a4" d="M33 144V74h8v70M59 144V74h8v70M173 144V74h8v70M199 144V74h8v70M30 74h40M170 74h40"/><path class="a3" d="M92 144v-40a28 28 0 0 1 56 0v40M84 144V92M156 144V92"/><path class="a5" d="M100 66h40v12h-40zM110 72h0M120 72h0M130 72h0"/></svg>
      </div>
      <p class="her__pk mono">FOUNDATION · 国家工程</p>
      <h3 class="her__ph">${H.motto[0].split(' ')[0]}<br><span class="grad-text">${H.motto[0].split(' ')[1]}</span></h3>
      <p class="her__pt">品牌彩页标注：${H.lines[0]} · ${H.lines[1]} · SINCE ${Y}。</p>
      <p class="tag-src">来源：产品彩页 第 6 页</p>
    </article>
    <article class="her__pillar card" data-reveal>
      <div class="her__pillar-art her__fan" aria-hidden="true">
        ${[0, 1, 2, 3, 4].map((i) => `<div class="her__fan-card her__doc--${['s', 'v', 'm', 'v', 's'][i]}" style="--k:${i - 2}">${docSVG(i % 2 ? 'doc' : 'cert', 40 + i)}</div>`).join('')}
      </div>
      <p class="her__pk mono">IP · R&amp;D · 知识产权</p>
      <h3 class="her__ph">${H.motto[1].split(' ')[0]}<br><span class="grad-text">${H.motto[1].split(' ')[1]}</span></h3>
      <p class="her__pt">彩页背景可见实用新型专利证书、外观设计专利等知识产权文件。</p>
      <div class="her__fan-row"><button class="btn her__fan-btn" type="button" aria-pressed="false">展开文件</button><span class="micro">图形为抽象示意，不含证书内容</span></div>
      <p class="tag-src">来源：产品彩页 第 6 页（背景文件）</p>
    </article>
  </div>

  <div class="her__tlw">
    <header class="her__tlh" data-reveal>
      <span class="eyebrow">MILESTONES</span>
      <h3 class="h2">三个关键节点</h3>
      <p class="her__tll">品牌标注年份 · 注册临床试验 · 医疗器械注册证 —— 均摘自产品彩页与使用说明书原文。</p>
    </header>
    <div class="her__tl">
      <div class="her__track" aria-hidden="true"><i class="her__fill"></i><i class="her__spark"></i></div>
      <ol>
        ${MILESTONES.map((m, i) => `
        <li class="her__ms" style="--i:${i}">
          <span class="her__dot" aria-hidden="true"><i></i></span>
          <div class="her__card card">
            <p class="her__mk mono">${m.k}</p>
            <p class="her__big num">${m.big}${m.u ? `<small>${m.u}</small>` : ''}</p>
            <h4 class="her__mt">${m.title.map((t) => `<span>${t}</span>`).join('')}</h4>
            <p class="her__mx">${m.text}</p>
            ${m.chips ? `<p class="her__chips">${m.chips.map((c) => `<span class="chip">${c}</span>`).join('')}</p>` : ''}
            <p class="tag-src">来源：${m.src}</p>
          </div>
        </li>`).join('')}
      </ol>
    </div>
    <a class="her__next" href="#core7"><span>继续探索 · 七项核心技术</span><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></a>
  </div>
  <p class="disclaimer her__disc">${data.disclaimers.brochure}</p>
</div>`;

    const $ = (s) => root.querySelector(s);
    const $$ = (s) => [...root.querySelectorAll(s)];
    const stage = $('.her__stage');
    const strips = $$('.her__s');
    const gate = $('.her__gate');
    const docs = $$('.her__doc');

    /* ---------- odometer ---------- */
    const ends = strips.map((s) => +s.dataset.end);
    const odo = { p: reduced ? 1 : 0 };
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const spin = strips.map(() => ({ v: 0 })); // extra full turn for the hover re-roll
    const d3 = { p: reduced ? 1 : 0, spin: 1, glint: -1, out: 0, mx: 0, my: 0, tx: 0, ty: 0 };
    let m3 = null;
    const setOdo = (p) => {
      d3.p = p;
      m3?.invalidate();
      strips.forEach((s, i) => {
        const a = i * 0.07;
        const x = lib.clamp((p - a) / (1 - 0.21));
        const idx = Math.max(0, easeOut(x) * ends[i] - spin[i].v * 10);
        s.style.transform = `translate3d(0,${(-idx).toFixed(4)}em,0)`;
      });
    };

    // hover / tap the year once it has landed → the drums spin one more turn and land again
    const yearEl = $('.her__year');
    let spinning = false;
    const glint = () => { if (!reduced) gsap.fromTo(d3, { glint: 0 }, { glint: 1, duration: 1.5, ease: 'power2.inOut', overwrite: 'auto', onComplete: () => { d3.glint = -1; } }); };
    const reroll = () => {
      if (reduced || spinning || odo.p < 0.999) return;
      spinning = true;
      // 3D drums: one extra full turn per reel (stopping left → right), then a glint sweep
      gsap.fromTo(d3, { spin: 0 }, { spin: 1, duration: 1.8, ease: 'power2.out', onComplete: glint });
      spin.forEach((o, i) => gsap.fromTo(o, { v: 1 }, {
        v: 0, duration: 1.1 + i * 0.18, ease: 'power3.out', onUpdate: () => setOdo(odo.p),
        onComplete: () => { if (i === spin.length - 1) spinning = false; },
      }));
    };
    yearEl.addEventListener('pointerenter', reroll);
    yearEl.addEventListener('click', reroll);

    /* ---------- gate line-art (edge detection of the brochure image) ---------- */
    buildGate(gate).catch(() => gate.classList.add('is-fallback'));

    /* ---------- pointer parallax on the documents ---------- */
    if (!reduced && window.matchMedia('(hover: hover)').matches) {
      const bg = $('.her__docs');
      let tx = 0, ty = 0, mx = 0, my = 0, raf = 0;
      const step = () => {
        mx += (tx - mx) * 0.08; my += (ty - my) * 0.08;
        bg.style.setProperty('--mx', mx.toFixed(4));
        bg.style.setProperty('--my', my.toFixed(4));
        raf = Math.abs(tx - mx) + Math.abs(ty - my) > 0.001 ? requestAnimationFrame(step) : 0;
      };
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(step);
      });
      stage.addEventListener('pointerleave', () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(step); });
    }

    /* ---------- patent fan ---------- */
    const fan = $('.her__fan');
    const fanBtn = $('.her__fan-btn');
    const setFan = (on) => { fan.classList.toggle('is-open', on); fanBtn.setAttribute('aria-pressed', String(on)); fanBtn.textContent = on ? '收起文件' : '展开文件'; };
    fanBtn.addEventListener('click', () => setFan(!fan.classList.contains('is-open')));
    const fanCard = fan.closest('.her__pillar');
    fanCard.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') fan.classList.add('is-hover'); });
    fanCard.addEventListener('pointerleave', () => fan.classList.remove('is-hover'));

    /* ---------- cursor spotlight on cards ---------- */
    $$('.her__card, .her__pillar').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--sx', `${e.clientX - r.left}px`);
        c.style.setProperty('--sy', `${e.clientY - r.top}px`);
      });
    });

    /* ---------- arch icon draws itself when seen ---------- */
    const arch = $('.her__arch');
    const stopArch = lib.whenVisible(arch, () => { arch.classList.add('is-drawn'); stopArch(); }, null, '-15% 0px');

    /* ---------- timeline ---------- */
    const fill = $('.her__fill');
    const tlEl = $('.her__tl');
    const nodes = $$('.her__ms');
    // each node lights exactly when the fill reaches it (horizontal ≥760 px, vertical below)
    let marks = [0.02, 0.36, 0.7];
    const measureTL = () => {
      const horiz = window.matchMedia('(min-width: 760px)').matches;
      const len = horiz ? tlEl.offsetWidth : tlEl.offsetHeight;
      if (len) marks = nodes.map((n) => Math.max(0.02, (horiz ? n.offsetLeft : n.offsetTop + 22) / len));
    };
    const setTL = (p) => {
      fill.style.setProperty('--p', p.toFixed(4));
      nodes.forEach((n, i) => n.classList.toggle('is-on', p >= marks[i] - 0.005));
      tlEl.classList.toggle('is-done', p >= 0.99);
    };

    /* ---------- 3D numerals (one WebGL context via mount3D; fonts first, per the YM3D host rules) ---------- */
    const host = $('.her__3d');
    const odoEl = $('.her__odo');
    const FOV = 26, EL0 = 0.05, AZ0 = 0.14;
    const fit = { r: 8, ox: 0, oy: 0, w: 0, h: 0, dirty: true };
    const _v = new THREE.Vector3(), _sz = new THREE.Vector2();
    let stillKey = '';
    const ease = (x) => { x = lib.clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    const proj = (cam, w, h, x, y, z) => { _v.set(x, y, z).project(cam); return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h }; };
    function computeFit(stg, digits, w, h) {
      const cam = stg.camera, hr = host.getBoundingClientRect(), dr = odoEl.getBoundingClientRect();
      const rect = { x: dr.left - hr.left, y: dr.top - hr.top, w: dr.width, h: dr.height };
      const W3 = digits.measure(Y);
      cam.clearViewOffset();
      let r = (W3 * h) / (2 * Math.max(40, rect.w) * Math.tan((FOV * Math.PI) / 360));
      for (let k = 0; k < 3; k++) {
        stg.orbit({ target: [0, 0.5, 0], radius: r, azimuth: AZ0, elevation: EL0, fov: FOV });
        cam.updateMatrixWorld();
        const a = proj(cam, w, h, -W3 / 2, 0.5, 0), b = proj(cam, w, h, W3 / 2, 0.5, 0);
        r *= (b.x - a.x) / Math.max(40, rect.w * 0.97);
      }
      stg.orbit({ target: [0, 0.5, 0], radius: r, azimuth: AZ0, elevation: EL0, fov: FOV });
      cam.updateMatrixWorld();
      const c = proj(cam, w, h, 0, 0.5, 0);
      Object.assign(fit, { r, ox: c.x - (rect.x + rect.w / 2), oy: c.y - (rect.y + rect.h * 0.5), w, h, dirty: false });
    }
    const start3D = () => {
      m3 = mountFresh(host, {
        THREE, stageLib: precompileLib(S), dpr: 1.5, margin: '60% 0px',
        stageOpts: { fov: FOV, transparent: true, exposure: 1.05, envViolet: 0.8 },
        build(stg) {
          const { key, rim, fill } = stg.lights;
          key.intensity = 2.3; key.position.set(3, 5, 6); key.castShadow = false;
          rim.intensity = 2.2; rim.position.set(-5, 2, -4);
          fill.intensity = 0.45;
          const mint = new THREE.PointLight(S.BRAND.mint, 6, 12, 1.5); mint.position.set(-3.2, -0.6, 2.4); stg.scene.add(mint);
          const vio = new THREE.PointLight(S.BRAND.violet, 8, 12, 1.5); vio.position.set(3.4, 1.8, 1.6); stg.scene.add(vio);
          const digits = createDigits3D(THREE, { material: 'brand', size: 1, maxChars: 4, text: Y, spins: 1, stagger: 0.16, depth: 0.3, bevel: 0.026, castShadow: false });
          stg.scene.add(digits.object3d);
          root.classList.add('is-3d');
          fit.dirty = true; stillKey = '';
          return { digits };
        },
        frame(s, stg, t) {
          stg.renderer.getSize(_sz);
          const w = _sz.x, h = _sz.y;
          if (fit.dirty || w !== fit.w || h !== fit.h) computeFit(stg, s.digits, w, h);
          // parallax out: once the (un-pinned) stage scrolls away the numerals tilt back into depth
          if (!reduced) { const r = stage.getBoundingClientRect(); d3.out = lib.clamp(-r.top / Math.max(1, r.height)); }
          const k = reduced ? 1 : ease(d3.p);
          if (reduced) { const key2 = `${w}x${h}|${fit.r.toFixed(3)}`; if (key2 === stillKey) return; stillKey = key2; }
          const e = 0.06;
          d3.mx += (d3.tx - d3.mx) * e; d3.my += (d3.ty - d3.my) * e;
          const p = reduced ? 1 : d3.p;
          const reveal = lib.clamp(p / 0.3), roll = lib.clamp((p - 0.05) / 0.95);
          const landed = roll >= 1 && d3.spin >= 1;
          const P = {
            t, text: Y, reveal, glint: d3.glint >= 0 ? d3.glint : null, float: landed && !reduced ? 0.012 : 0,
            rollFrom: d3.spin < 1 ? Y : '0000', roll: d3.spin < 1 ? d3.spin : roll,
          };
          s.digits.update(P);
          const o = d3.out;
          const az = lerp(0.72, AZ0, k) + d3.mx * 0.13 - o * 0.1;
          const el = lerp(-0.26, EL0, k) - d3.my * 0.07 + o * 0.32;
          const rad = fit.r * lerp(1.5, 1, k) * (1 + o * 0.35);
          stg.orbit({ target: [0, 0.5, 0], radius: rad, azimuth: az, elevation: el, fov: FOV });
          stg.camera.setViewOffset(w, h, fit.ox, fit.oy + o * h * 0.08, w, h);
          stg.render();
        },
        dispose(s) { s?.digits.dispose(); },
        fallback: () => root.classList.add('no-gl'),
      });
    };
    const lerp = lib.lerp;
    Promise.all([document.fonts?.load('600 40px Montserrat'), document.fonts?.load('500 40px Montserrat')])
      .catch(() => {}).then(start3D);
    lib.onResize(() => { fit.dirty = true; m3?.invalidate(); });
    if (!reduced) {
      stage.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = stage.getBoundingClientRect();
        d3.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; d3.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
      stage.addEventListener('pointerleave', () => { d3.tx = d3.ty = 0; });
    }

    if (reduced) {
      setOdo(1); setTL(1);
      gate.style.setProperty('--r', '1.2');
      root.classList.add('is-static');
      return;
    }
    setOdo(0);
    setTL(0);

    /* ---------- stage choreography ---------- */
    const mm = gsap.matchMedia();
    // odometer progress reached while the stage is still sliding in (desktop) — the drums are already
    // spinning when the pin engages, so the stage never sits empty; the pinned part lands them on 1995
    const PRE = 0.34;
    const intro = (tl, at = 0, preroll = false) => {
      if (preroll) tl.fromTo(odo, { p: 0 }, { p: PRE, duration: 0.8, ease: 'none', immediateRender: false, onUpdate: () => setOdo(odo.p) }, at + 0.2);
      return tl
      .fromTo($('.her__kick'), { opacity: 0, y: 24, letterSpacing: '0.6em' }, { opacity: 1, y: 0, letterSpacing: '0.34em', duration: 0.6, ease: 'power2.out' }, at + 0.1)
      .fromTo($('.her__since'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, at)
      .fromTo($('.her__glow'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.out' }, at + 0.05)
      .fromTo(docs, {
        opacity: 0,
        x: (i) => (STAGE_DOCS[i].l !== undefined ? -1 : 1) * 160 * STAGE_DOCS[i].z,
        y: (i) => 120 * STAGE_DOCS[i].z,
        rotate: (i) => STAGE_DOCS[i].rot * 1.8,
      }, { opacity: 1, x: 0, y: 0, rotate: 0, duration: 0.9, ease: 'power2.out', stagger: 0.04 }, at + 0.1);
    };
    const reveal = (tl, at = 0, from = 0) => tl
      .fromTo(odo, { p: from }, { p: 1, duration: 1, ease: 'none', immediateRender: false, onUpdate: () => setOdo(odo.p) }, at)
      .add(() => { if (!spinning) glint(); }, at + 1)
      .fromTo(gate, { '--r': 0 }, { '--r': 1.25, duration: 1.1, ease: 'power1.inOut' }, at + 0.05)
      .fromTo($('.her__uni'), { opacity: 0, y: 40, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'power3.out' }, at + 0.62)
      .fromTo($('.her__proj'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, at + 0.72)
      .fromTo($('.her__motto'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, at + 0.84)
      .to({}, { duration: 0.25 });
    mm.add('(min-width: 760px)', () => {
      // as the stage slides in: documents gather, glow and SINCE appear
      intro(gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 85%', end: 'top 5%', scrub: 0.8 } }), 0, true);
      // pinned: the drums roll on to 1995, the gate is drawn, the words land
      reveal(gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top top', end: '+=130%', pin: true, pinSpacing: true, scrub: 0.8 } }), 0, PRE);
      // documents keep drifting (parallax) after the pin
      gsap.to(docs, { yPercent: (i) => -40 * STAGE_DOCS[i].z, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true } });
      return () => { odo.p = 0; setOdo(0); };
    });
    mm.add('(max-width: 759px)', () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 70%', end: 'bottom 65%', scrub: 0.6 } });
      intro(tl, 0);
      reveal(tl, 0);
      return () => { odo.p = 0; setOdo(0); };
    });

    // the travelling spark is a CSS loop — freeze it while the timeline is off-screen
    lib.whenVisible(tlEl, () => tlEl.classList.remove('is-off'), () => tlEl.classList.add('is-off'), '10% 0px');

    // created after the stage pin so its positions include the pin spacing
    ScrollTrigger.create({
      trigger: tlEl, start: 'top 80%', end: 'bottom 75%',
      onRefresh: (s) => { measureTL(); setTL(s.progress); },
      onUpdate: (s) => setTL(s.progress),
    });
  },
};

/* ================= line-art from the (white-background) gate image ================= */
async function buildGate(canvas) {
  const img = new Image();
  img.decoding = 'async';
  img.src = GATE;
  await img.decode();
  await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1200 }) : setTimeout(r, 60)));
  const w = img.naturalWidth, h = img.naturalHeight;
  const work = document.createElement('canvas');
  work.width = w; work.height = h;
  const g = work.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, w, h).data;
  const n = w * h;
  const L = new Float32Array(n), T = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = (0.299 * src[j] + 0.587 * src[j + 1] + 0.114 * src[j + 2]) / 255;
  const K = [1, 4, 6, 4, 1];
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += K[k + 2] * L[o + Math.min(w - 1, Math.max(0, x + k))];
      T[o + x] = s / 16;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += K[k + 2] * T[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      B[y * w + x] = s / 16;
    }
  }
  const out = g.createImageData(w, h);
  const o = out.data;
  const c1 = [67, 230, 168], c2 = [150, 110, 255];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = B[i - w + 1] + 2 * B[i + 1] + B[i + w + 1] - B[i - w - 1] - 2 * B[i - 1] - B[i + w - 1];
      const gy = B[i + w - 1] + 2 * B[i + w] + B[i + w + 1] - B[i - w - 1] - 2 * B[i - w] - B[i - w + 1];
      const m = Math.sqrt(gx * gx + gy * gy);
      // stronger threshold where the brochure's faint certificate text bleeds into the crop
      const thr = y < h * 0.185 || (x > w * 0.86 && y < h * 0.34) || (x < w * 0.05 && y < h * 0.55) ? 0.22 : 0.045;
      const a = Math.pow(Math.min(1, Math.max(0, (m - thr) / 0.26)), 0.85);
      if (a <= 0) continue;
      const t = x / w;
      const q = i * 4;
      o[q] = c1[0] + (c2[0] - c1[0]) * t;
      o[q + 1] = c1[1] + (c2[1] - c1[1]) * t;
      o[q + 2] = c1[2] + (c2[2] - c1[2]) * t;
      o[q + 3] = a * 255 * (0.35 + 0.65 * Math.min(1, y / (h * 0.5)));
    }
  }
  g.clearRect(0, 0, w, h);
  g.putImageData(out, 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  try { ctx.filter = 'blur(5px)'; } catch { /* no canvas filter support */ }
  ctx.globalAlpha = 0.55;
  ctx.drawImage(work, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.drawImage(work, 0, 0);
  canvas.classList.add('is-ready');
}
