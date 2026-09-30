// #mechanism — 作用机制
// A real-time, physically-motivated (coarse, relative) RF tissue cross-section:
//   1) electric potential ∇·(σ∇V)=0 solved by red-black SOR (warm-started, chunked off the main frame budget)
//   2) Joule heating q = σ|E|² from face currents, scaled by the power level
//   3) transient heat diffusion + perfusion + conductive surface cooling from the cryogen-cooled electrode
// Every temperature is RELATIVE and schematic (原理示意). Device facts come from DATA / IFU pages cited inline.

/* ------------------------------------------------------------------ */
/* physics model                                                        */
/* ------------------------------------------------------------------ */
const NX = 180, NY = 110, GW = NX + 2, GH = NY + 2, GN = GW * GH;
const AXIS = 90;
const EPI = 0, DERM = 1, FAT = 2, SEPT = 3, FASC = 4, MUS = 5;
// relative tissue parameters (general RF / bio-heat science, schematic — NOT device data)
const SIGMA = [0.34, 0.3, 0.03, 0.35, 0.5, 0.65]; // electrical conductivity @ MHz (relative)
const KTH = [0.85, 1, 0.5, 0.95, 0.95, 1];        // thermal diffusivity (relative)
const PERF = [0.02, 0.07, 0.02, 0.04, 0.05, 0.09]; // perfusion washout (1/s, relative)
const GC = 0.035; // capacitive coupling of the electrode face (relative)
const MODES = {
  // monopolar: one electrode (tip) — return through the body to the neutral pad (bottom boundary at 0 V).
  // Solved as an axisymmetric r–z slice so current spreads like it would in 3-D.
  // `ramp` grades the capacitive coupling from the rim inwards (cells, base fraction) so the heated zone under the
  // wide tip reads as an even plateau instead of two rim hot-spots (schematic tuning, not device data).
  mono: { electrodes: [{ x0: 52, x1: 128, v: 1 }], ground: true, axi: AXIS, ramp: [26, 0.12] },
  // bipolar comparison: two surface electrodes, no return pad
  bi: { electrodes: [{ x0: 62, x1: 84, v: 1 }, { x0: 96, x1: 118, v: -1 }], ground: false, ramp: [11, 0.22] },
};
const PRE = 0.5, POST = 0.7;           // schematic phase lengths (sim seconds)
const SLOW = 0.5;                      // slow-motion factor during a shot
const D0 = 10, HC = 28, GAIN = 2.5;    // diffusion, electrode contact conductance, heating gain
const coolTarget = (c) => -(0.45 + 0.2 * c); // colder with higher 制冷强度 (IFU p.9: 数值越大…温度越低)
const coolRate = (c) => 3 + 1.2 * c;         // faster with higher 制冷强度 (IFU p.9: …降温速率越快)

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class TissueSim {
  constructor(seed = 7) {
    this.rand = mulberry(seed);
    this.tissue = new Uint8Array(GN).fill(255);
    this.bEpi = new Float32Array(NX); this.bDerm = new Float32Array(NX); this.bFat = new Float32Array(NX);
    this.septa = [];
    this.buildAnatomy();
    this.T = new Float32Array(GN); this.Tn = new Float32Array(GN);
    this.maxT = 0; this.minT = 0;
    this.fields = {};
    this.buildThermal();
  }
  idx(x, y) { return (y + 1) * GW + (x + 1); }
  buildAnatomy() {
    const r = this.rand;
    for (let x = 0; x < NX; x++) {
      this.bEpi[x] = 4.3 + 0.9 * Math.sin(x * 0.42) + 0.4 * Math.sin(x * 0.17 + 1.3);
      this.bDerm[x] = 29 + 2.2 * Math.sin(x * 0.045 + 0.7) + 1.1 * Math.sin(x * 0.19);
      this.bFat[x] = 78 + 3 * Math.sin(x * 0.038 + 2) + 1.4 * Math.sin(x * 0.12);
    }
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      let t;
      if (y < this.bEpi[x]) t = EPI;
      else if (y < this.bDerm[x]) t = DERM;
      else if (y < this.bFat[x]) t = FAT;
      else if (y < this.bFat[x] + 2.6) t = FASC;
      else t = MUS;
      this.tissue[this.idx(x, y)] = t;
    }
    // fibrous septa: wavy vertical strands dermis → SMAS, cross-linked into lobules
    const strands = [];
    let x0 = 4 + r() * 6;
    while (x0 < NX - 3) {
      if (Math.abs(x0 - AXIS) < 5) { x0 += 6; continue; } // keep the symmetry axis clean
      const pts = []; const steps = 7; let x = x0;
      const yTop = this.bDerm[Math.min(NX - 1, Math.max(0, Math.round(x)))] - 1.5;
      for (let k = 0; k <= steps; k++) {
        const xi = Math.min(NX - 1, Math.max(0, Math.round(x)));
        const yb = this.bFat[xi] + 1;
        pts.push([x, yTop + (yb - yTop) * (k / steps)]);
        x += (r() - 0.5) * 7;
      }
      strands.push(pts);
      x0 += 13 + r() * 7;
    }
    const polys = [...strands];
    for (let s = 0; s < strands.length - 1; s++) {
      const a = strands[s], b = strands[s + 1];
      const nb = 1 + (r() < 0.6 ? 1 : 0);
      for (let k = 0; k < nb; k++) {
        const ka = 1 + Math.floor(r() * (a.length - 2));
        const kb = Math.max(1, Math.min(b.length - 2, ka + (r() < 0.5 ? -1 : 1) * (r() < 0.5 ? 1 : 0)));
        const pa = a[ka], pb = b[kb];
        polys.push([pa, [(pa[0] + pb[0]) / 2 + (r() - 0.5) * 3, (pa[1] + pb[1]) / 2 + (r() - 0.5) * 6], pb]);
      }
    }
    this.septa = polys;
    const R = 1.05;
    for (const pl of polys) for (let k = 0; k < pl.length - 1; k++) {
      const [ax, ay] = pl[k], [bx, by] = pl[k + 1];
      const minx = Math.max(0, Math.floor(Math.min(ax, bx) - 2)), maxx = Math.min(NX - 1, Math.ceil(Math.max(ax, bx) + 2));
      const miny = Math.max(0, Math.floor(Math.min(ay, by) - 2)), maxy = Math.min(NY - 1, Math.ceil(Math.max(ay, by) + 2));
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
        const qx = ax + t * dx - px, qy = ay + t * dy - py;
        if (qx * qx + qy * qy < R * R) { const i = this.idx(x, y); if (this.tissue[i] === FAT) this.tissue[i] = SEPT; }
      }
    }
  }
  /** conductance stencil + warm start for one electrode configuration */
  prepare(key) {
    const m = MODES[key];
    const cE = new Float32Array(GN), cW = new Float32Array(GN), cN = new Float32Array(GN), cS = new Float32Array(GN), inv = new Float32Array(GN);
    const V = new Float32Array(GN);
    const sg = (i) => SIGMA[this.tissue[i]];
    const hm = (a, b) => (2 * a * b) / (a + b);
    const wf = (xf) => (m.axi == null ? 1 : Math.max(0.5, Math.abs(xf - m.axi)));
    const wC = new Float32Array(NX), wFx = new Float32Array(NX + 1);
    for (let x = 0; x < NX; x++) wC[x] = wf(x + 0.5);
    for (let x = 0; x <= NX; x++) wFx[x] = wf(x);
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      const i = this.idx(x, y), s = sg(i);
      if (x < NX - 1) cE[i] = hm(s, sg(i + 1)) * wFx[x + 1];
      if (x > 0) cW[i] = hm(s, sg(i - 1)) * wFx[x];
      if (y < NY - 1) cS[i] = hm(s, sg(i + GW)) * wC[x]; else if (m.ground) cS[i] = 2 * s * wC[x];
      if (y > 0) cN[i] = hm(s, sg(i - GW)) * wC[x];
      else for (const e of m.electrodes) if (x >= e.x0 && x < e.x1) {
        const d = Math.min(x - e.x0, e.x1 - 1 - x);
        cN[i] = GC * (m.ramp[1] + (1 - m.ramp[1]) * sstep(0, m.ramp[0], d)) * wC[x]; // graded edge coupling (limits edge crowding)
        V[i - GW] = e.v;
      }
      const sum = cE[i] + cW[i] + cN[i] + cS[i];
      inv[i] = sum > 0 ? 1 / sum : 0;
    }
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) V[this.idx(x, y)] = m.ground ? 0.12 * (1 - y / NY) : 0;
    return (this.fields[key] = { key, m, cE, cW, cN, cS, inv, V, wC, wFx, iters: 0, done: false, maxd: 1, ready: false });
  }
  /** n red-black SOR sweeps; returns true once converged */
  iterate(f, n, omega = 1.94, tol = 1e-6) {
    const { cE, cW, cN, cS, inv, V } = f;
    let maxd = 0;
    for (let it = 0; it < n; it++) {
      maxd = 0;
      for (let c = 0; c < 2; c++) {
        for (let y = 1; y <= NY; y++) {
          const end = y * GW + NX;
          for (let i = y * GW + 1 + ((y + c) & 1); i <= end; i += 2) {
            const d = omega * ((cE[i] * V[i + 1] + cW[i] * V[i - 1] + cN[i] * V[i - GW] + cS[i] * V[i + GW]) * inv[i] - V[i]);
            V[i] += d;
            if (d > maxd) maxd = d; else if (-d > maxd) maxd = -d;
          }
        }
      }
      f.iters++;
      if (maxd < tol) { f.done = true; break; }
    }
    f.maxd = maxd;
    return f.done;
  }
  /** Joule heat, current density, spawn distribution, equipotential range */
  derive(f) {
    const { cE, cW, cN, cS, V, m, wC, wFx } = f;
    const Q = new Float32Array(GN), Jx = new Float32Array(GN), Jy = new Float32Array(GN), Jm = new Float32Array(GN);
    let vmin = 1e9, vmax = -1e9;
    for (let y = 1; y <= NY; y++) for (let x = 1; x <= NX; x++) {
      const i = y * GW + x, v = V[i];
      const dE = v - V[i + 1], dW = V[i - 1] - v, dS = v - V[i + GW], dN = V[i - GW] - v;
      let q = 0.5 * (cE[i] * dE * dE + cW[i] * dW * dW + cS[i] * dS * dS);
      if (y > 1) q += 0.5 * cN[i] * dN * dN;
      Q[i] = q / wC[x - 1];
      Jx[i] = 0.5 * ((cE[i] * dE) / wFx[x] + (cW[i] * dW) / wFx[x - 1]);
      Jy[i] = (0.5 * (cS[i] * dS + cN[i] * dN)) / wC[x - 1];
      Jm[i] = Math.hypot(Jx[i], Jy[i]);
      if (v < vmin) vmin = v; if (v > vmax) vmax = v;
    }
    const qs = Q.filter((v) => v > 0).sort();
    const qref = qs[Math.floor(qs.length * 0.995)] || 1;
    const Qn = new Float32Array(GN);
    for (let i = 0; i < GN; i++) Qn[i] = Math.min(Q[i] / qref, 1.6);
    const js = Jm.filter((v) => v > 0).sort();
    const jref = js[Math.floor(js.length * 0.97)] || 1;
    const src = []; let acc = 0;
    for (const e of m.electrodes) if (e.v > 0) for (let x = e.x0; x < e.x1; x++) {
      const i = GW + x + 1; acc += (cN[i] * (e.v - V[i])) / wC[x]; src.push([x, acc]);
    }
    Object.assign(f, { Qn, Jx, Jy, Jm, jref, src, srcTotal: acc, vmin, vmax, ready: true });
    return f;
  }
  buildThermal() {
    const dE = new Float32Array(GN), dW = new Float32Array(GN), dN = new Float32Array(GN), dS = new Float32Array(GN), perf = new Float32Array(GN);
    const k = (i) => KTH[this.tissue[i]];
    const hm = (a, b) => (2 * a * b) / (a + b);
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      const i = this.idx(x, y);
      if (x < NX - 1) dE[i] = hm(k(i), k(i + 1));
      if (x > 0) dW[i] = hm(k(i), k(i - 1));
      if (y < NY - 1) dS[i] = hm(k(i), k(i + GW)); else dS[i] = k(i); // deep body at baseline
      if (y > 0) dN[i] = hm(k(i), k(i - GW));
      perf[i] = PERF[this.tissue[i]];
    }
    this.th = { dE, dW, dN, dS, perf };
  }
  /** advance temperature by dt (sim s). o = { f, heat (≥0), contact, Te, h } */
  step(dt, o) {
    const { dE, dW, dN, dS, perf } = this.th;
    const hc = o.contact ? o.h : 0;
    const nsub = Math.max(1, Math.ceil((dt * (4 * D0 + hc)) / 0.8));
    const h = dt / nsub;
    const Qn = o.f && o.heat > 0 ? o.f.Qn : null, G = o.heat, dec = o.decay || 0;
    const els = o.contact && o.f ? o.f.m.electrodes : null;
    let T = this.T, Tn = this.Tn, mx = 0, mn = 0;
    for (let s = 0; s < nsub; s++) {
      mx = 0; mn = 0;
      for (let y = 1; y <= NY; y++) {
        const row = y * GW;
        for (let x = 1; x <= NX; x++) {
          const i = row + x, t = T[i];
          const lap = dE[i] * (T[i + 1] - t) + dW[i] * (T[i - 1] - t) + dS[i] * (T[i + GW] - t) + (y > 1 ? dN[i] * (T[i - GW] - t) : 0);
          let v = t + h * (D0 * lap - (perf[i] + dec) * t);
          if (Qn) v += h * G * Qn[i];
          Tn[i] = v;
          if (v > mx) mx = v; else if (v < mn) mn = v;
        }
      }
      if (els && hc > 0) for (const e of els) for (let x = e.x0; x < e.x1; x++) { const i = GW + x + 1; Tn[i] += h * hc * (o.Te - Tn[i]); }
      const tmp = T; T = Tn; Tn = tmp;
    }
    this.T = T; this.Tn = Tn; this.maxT = mx; this.minT = mn;
  }
  reset() { this.T.fill(0); this.Tn.fill(0); this.maxT = this.minT = 0; }
  sampleT(gx, gy) {
    const x = Math.min(NX - 1.001, Math.max(0, gx - 0.5)), y = Math.min(NY - 1.001, Math.max(0, gy - 0.5));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const i = (y0 + 1) * GW + x0 + 1, T = this.T;
    return (T[i] * (1 - fx) + T[i + 1] * fx) * (1 - fy) + (T[i + GW] * (1 - fx) + T[i + GW + 1] * fx) * fy;
  }
  tissueAt(gx, gy) { return this.tissue[this.idx(Math.min(NX - 1, Math.max(0, gx | 0)), Math.min(NY - 1, Math.max(0, gy | 0)))]; }
}

/** marching squares on a padded grid field → segment list in grid coords (cell centres at +0.5) */
function contour(F, level, out, n0 = 0) {
  let n = n0;
  const cap = out.length - 8;
  for (let y = 0; y < NY - 1; y++) {
    for (let x = 0; x < NX - 1; x++) {
      const i = (y + 1) * GW + x + 1;
      const a = F[i], b = F[i + 1], c = F[i + GW + 1], d = F[i + GW];
      const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const e = (k) => {
        switch (k) {
          case 0: return [x + 0.5 + (level - a) / (b - a), y + 0.5];
          case 1: return [x + 1.5, y + 0.5 + (level - b) / (c - b)];
          case 2: return [x + 0.5 + (level - d) / (c - d), y + 1.5];
          default: return [x + 0.5, y + 0.5 + (level - a) / (d - a)];
        }
      };
      const segs = MS[idx];
      for (let s = 0; s < segs.length && n < cap; s++) {
        const p = e(segs[s][0]), q = e(segs[s][1]);
        out[n++] = p[0]; out[n++] = p[1]; out[n++] = q[0]; out[n++] = q[1];
      }
    }
  }
  return n;
}
const MS = { 1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[3, 0], [2, 1]], 6: [[0, 2]], 7: [[3, 0]], 8: [[3, 0]], 9: [[0, 2]], 10: [[0, 1], [3, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]] };

/* ------------------------------------------------------------------ */
/* copy                                                                 */
/* ------------------------------------------------------------------ */
const STEPS = [
  {
    k: '01', tag: '6.78 MHz ± 3%', title: '单极 · 电容耦合 · 6.78 MHz',
    body: 'YOUMAGIC 是一种<b>单极电容耦合射频</b>皮肤治疗仪，射频频率 <b>6.78 MHz ± 3%</b>。一次性治疗头端（铜、聚酰亚胺）贴合皮肤，把高频交变电场耦合进组织——每秒约 678 万个周期。',
    extra: '<p class="mx-step__hint">画面：<i class="mx-key mx-key--equi"></i>等势线与电荷往复振荡（原理示意）</p>',
    src: '来源：使用说明书 第 6、7、30 页',
  },
  {
    k: '02', tag: '闭合回路', title: '经组织回流，闭合射频回路',
    body: '单极模式只有一个治疗电极。电流自治疗头端进入皮肤、向深处发散并穿过组织，经人体回流至贴于腰部或身体两侧的<b>中性电极片</b>，闭合射频能量的回路；治疗仪持续监测其接触质量，异常时停止治疗。',
    extra: 'BODY',
    src: '来源：使用说明书 第 11、18 页',
  },
  {
    k: '03', tag: '组织阻抗产热', title: '阻抗产热 · 选择性加热',
    body: '射频电流流经具有阻抗的组织，电能转化为热（焦耳热 q = σ|E|²）。说明书描述治疗手具“用于传送射频能量以<b>选择性加热组织</b>，同时以传导方式冷却表皮”。截面中，电流倾向沿导电性较高的纤维隔进入皮下（原理示意）。',
    extra: '<p class="mx-step__hint">画面：<i class="mx-key mx-key--q"></i>产热分布 q 叠加 · 自动演示发射</p>',
    src: '来源：使用说明书 第 10 页（引文）',
  },
  {
    k: '04', tag: 'R134a 冷却', title: '冷却 → 射频 → 冷却',
    body: '每个射频能量脉冲分三个阶段：<b>治疗前冷却 → 射频传送 → 治疗后冷却</b>。R134a 制冷剂被递送到治疗头端电极的<b>非患者侧</b>，冷却该表面，以让患者感到舒适并尽量减少皮肤表面过热的可能性。制冷强度 1–4，数值越大，降温速率越快、温度越低。',
    extra: '<button class="btn mx-nocool" type="button" aria-pressed="false">原理对比：关闭表皮冷却</button>',
    src: '来源：使用说明书 第 9、12、15 页',
  },
  {
    k: '05', tag: '胶原', title: '热作用于真皮胶原',
    body: '本产品利用射频热效应<b>减轻面部轻、中度皮肤皱纹</b>。热量作用于真皮与纤维隔中的胶原纤维（画面中受热胶原高亮，原理示意）；彩页动物研究显示，治疗后 4 周、12 周 Ⅰ 型与 Ⅲ 型胶原同步提升。',
    extra: '<a class="btn btn--primary mx-next" href="#collagen">胶原新生 <span aria-hidden="true">↓</span></a>',
    src: '来源：使用说明书 第 4 页 · 彩页 第 4 页',
  },
];

const BODY_SVG = `
<svg class="mx-body" viewBox="0 0 166 150" aria-hidden="true">
  <circle cx="54" cy="22" r="14" class="mx-body__line"/>
  <path d="M54 36 L54 42 M28 56 Q54 42 80 56 L84 104 Q54 112 24 104 Z M28 58 L14 100 M80 58 L94 100 M38 108 L34 148 M70 108 L74 148" class="mx-body__line"/>
  <path d="M62 24 C 86 40, 88 70, 72 92" class="mx-body__flow"/>
  <circle cx="62" cy="24" r="4" class="mx-body__tip"/>
  <rect x="64" y="88" width="16" height="10" rx="2" class="mx-body__pad"/>
  <path d="M68 24 L96 16" class="mx-body__lead"/><text x="99" y="19" class="mx-body__t">治疗头端</text>
  <path d="M82 93 L96 104" class="mx-body__lead"/><text x="99" y="104" class="mx-body__t">中性电极片</text>
  <text x="99" y="118" class="mx-body__t mx-body__t--s">腰部/身体两侧</text>
</svg>`;

const PROBES = [
  { name: '表皮', color: '#7fd4ff' },
  { name: '真皮', color: '#ffc45e' },
  { name: '纤维隔', color: '#e27ab8' },
];

/* ------------------------------------------------------------------ */
export default {
  id: 'mechanism',
  nav: '作用机制',
  async init(root, ctx) {
    const { gsap, ScrollTrigger, lib, data } = ctx;
    const reduced = !!ctx.reduced;
    const { clamp } = lib;
    const B = lib.BANDS;

    root.innerHTML = `
      <div class="wrap">
        <header class="sec-head">
          <span class="eyebrow">03 · MECHANISM</span>
          <h2 class="h1" data-reveal>向深处加热，<span class="grad-text mx-nw">为表皮降温</span></h2>
          <p class="lead" data-reveal>一个实时求解的皮肤截面：电势场由迭代求解器算出，焦耳热与热扩散逐帧计算。调节功率档位、制冷强度与脉冲时间，按下「发射」，观察<b class="hl">治疗前冷却 → 射频传送 → 治疗后冷却</b>的全过程；拖动探针，读取任意位置的相对温升。</p>
        </header>
      </div>
      <div class="mx-stage">
        <div class="wrap wrap--wide mx-grid">
          <div class="mx-story">
            <div class="mx-prog" role="tablist" aria-label="作用机制步骤">
              ${STEPS.map((s, i) => `<button class="mx-prog__b" role="tab" type="button" id="mx-tab-${i}" aria-controls="mx-panel-${i}" data-i="${i}" aria-selected="${i === 0}" aria-label="步骤 ${s.k} ${s.title}"><span class="mono">${s.k}</span><i><b></b></i></button>`).join('')}
            </div>
            <div class="mx-steps">
              ${STEPS.map((s, i) => `
              <article class="mx-step${i === 0 ? ' is-on' : ''}" data-i="${i}" role="tabpanel" id="mx-panel-${i}" aria-labelledby="mx-tab-${i}">
                <span class="mx-step__tag mono">${s.k} · ${s.tag}</span>
                <h3 class="h3">${s.title}</h3>
                <p class="mx-step__body">${s.body}</p>
                ${s.extra === 'BODY' ? `<div class="mx-step__row">${BODY_SVG}<button class="btn mx-tobi" type="button">对比：双极射频 →</button></div>` : s.extra}
                <span class="tag-src">${s.src}</span>
              </article>`).join('')}
            </div>
            <div class="mx-side card">
              <div class="mx-side__head"><span class="micro">探针 · 单次脉冲相对温升</span>
                <span class="mx-probes">${PROBES.map((p, i) => `<button type="button" class="mx-probe" data-p="${i}" style="--pc:${p.color}" aria-label="${p.name}探针（可在画面中拖动，或用方向键移动）"><i></i>${p.name}<b class="mono">+0.00</b></button>`).join('')}</span>
              </div>
              <canvas class="mx-scope__c" aria-hidden="true"></canvas>
              <div class="mx-side__foot">
                <div class="mx-legend">
                  <span class="micro">相对温升 · 原理示意</span>
                  <div class="mx-scale" aria-hidden="true"></div>
                  <div class="mx-scale__l"><span>冷却</span><span>0</span><span>高</span></div>
                </div>
                <p class="disclaimer mx-side__disc">${data.disclaimers.sim}</p>
                <div class="mx-views" role="group" aria-label="显示图层">
                  <button class="mx-view" type="button" data-v="equi" aria-pressed="true"><i></i>等势线</button>
                  <button class="mx-view" type="button" data-v="flow" aria-pressed="true"><i></i>电流路径</button>
                  <button class="mx-view" type="button" data-v="iso" aria-pressed="true"><i></i>等温线</button>
                  <button class="mx-view" type="button" data-v="q" aria-pressed="false"><i></i>产热分布</button>
                </div>
              </div>
            </div>
          </div>
          <div class="mx-viz">
            <div class="mx-cv">
              <canvas class="mx-canvas" aria-label="皮肤截面射频加热实时模拟（原理示意）" role="img"></canvas>
              <div class="mx-hud mx-hud--tl"><span class="mx-status" aria-live="polite">电场求解中…</span><span class="mx-sub mono">原理示意 · 非等比例<span class="mx-clock"></span></span></div>
              <div class="mx-hud mx-hud--bl"><span class="mx-flag mx-flag--nocool">原理对比：无表皮冷却 · 表皮温升明显升高</span><span class="mx-flag mx-flag--bi">原理对比示意：双极 · 电流集中于两电极间浅层</span></div>
              <div class="mx-hud mx-hud--tr">
                <span class="mx-freq mono"><svg viewBox="0 0 40 12" aria-hidden="true"><path class="mx-freq__w" d=""/></svg>6.78 MHz ± 3%</span>
                <div class="seg mx-mode" role="group" aria-label="射频模式">
                  <button type="button" data-mode="mono" aria-pressed="true">单极</button>
                  <button type="button" data-mode="bi" aria-pressed="false">双极 · 对比</button>
                </div>
              </div>
            </div>
            <div class="mx-ctrl card card--glass">
              <div class="seg mx-mode mx-mode--dock" role="group" aria-label="射频模式">
                <button type="button" data-mode="mono" aria-pressed="true">单极 · YOUMAGIC</button>
                <button type="button" data-mode="bi" aria-pressed="false">双极 · 对比示意</button>
              </div>
              <label class="field">
                <span class="field__row"><span class="field__label">功率档位</span><span class="field__val"><b class="mx-v-lv">5.0</b> · <span class="mx-v-w">115</span> W</span></span>
                <input class="range mx-r-lv" type="range" min="0.5" max="8" step="0.5" value="5" aria-label="功率档位" />
              </label>
              <div class="field">
                <span class="field__row"><span class="field__label">制冷强度</span><span class="field__val mx-v-coolhint">默认 2</span></span>
                <div class="seg mx-cool" role="group" aria-label="制冷强度">
                  ${[1, 2, 3, 4].map((c) => `<button type="button" data-c="${c}" aria-pressed="false">${c}</button>`).join('')}
                </div>
              </div>
              <label class="field">
                <span class="field__row"><span class="field__label">脉冲时间</span><span class="field__val"><b class="mx-v-p">1.0</b> s · <span class="mx-v-n">10</span> 脉冲</span></span>
                <input class="range mx-r-p" type="range" min="0.7" max="1.5" step="0.1" value="1" aria-label="脉冲时间" />
              </label>
              <div class="mx-go">
              <div class="mx-dens" aria-live="polite">
                <span class="field__label">能量密度</span>
                <span class="mx-dens__row"><span class="mx-dens__v num">28.8</span><span class="micro">J/cm²</span></span>
                <span class="chip mx-dens__band"><i></i><span>较高</span></span>
              </div>
              <button class="mx-fire" type="button"><b>发射</b><small>模拟一个射频能量脉冲</small></button>
              </div>
              <div class="mx-tl" aria-hidden="true">
                <span data-ph="pre">治疗前冷却</span><span data-ph="rf">射频传送 <em class="mono">1.0 s</em></span><span data-ph="post">治疗后冷却</span>
                <i class="mx-tl__head"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="wrap">
        <p class="disclaimer mx-disc"><b>原理示意</b> · ${data.disclaimers.sim} 组织电导率、热参数为相对值，截面非等比例；时间轴为示意（射频阶段按所选脉冲时间，慢放 ×½）。能量密度 = 功率 × 脉冲时间 ÷ 4.0 cm²（治疗头端 YM5-TP4-900），空白组合不在能量输出表内（使用说明书 第 31 页）；制冷强度默认值与可选范围见第 22 页。临床操作：同一部位治疗最多不超过 6 次，每次间隔应大于 60 s（第 20 页）。</p>
      </div>`;

    /* ---------- refs ---------- */
    const $ = (s) => root.querySelector(s);
    const $$ = (s) => [...root.querySelectorAll(s)];
    const stage = $('.mx-stage');
    const canvas = $('.mx-canvas');
    const cv = $('.mx-cv');
    const g = canvas.getContext('2d');
    const scopeC = $('.mx-scope__c');
    const sg = scopeC.getContext('2d');
    const elStatus = $('.mx-status'), elClock = $('.mx-clock');
    const stepEls = $$('.mx-step'), progBtns = $$('.mx-prog__b');
    const fireBtn = $('.mx-fire');
    const phaseEls = $$('.mx-tl span');
    const tlHead = $('.mx-tl__head');
    const probeBtns = $$('.mx-probe');
    const freqPath = $('.mx-freq__w');
    { let d = ''; for (let x = 0; x <= 40; x++) d += (x ? 'L' : 'M') + x + ' ' + (6 + Math.sin(x * 0.9) * 3).toFixed(2); freqPath.setAttribute('d', d); }

    /* ---------- sim ---------- */
    const sim = new TissueSim(7);
    const lut = lib.heatLUT();

    // state
    const S = {
      mode: 'mono', lv: 5, pulse: 1.0, cool: 2, noCool: false,
      view: { equi: true, flow: true, iso: true, q: false },
      phase: 'idle', phaseT: 0, Te: 0, step: 0, userLock: false, autoWait: 0,
      flowMode: 'osc', collagen: 0, returnGlow: 0, qAlpha: 0, equiAlpha: 1, flowAlpha: 0,
      dirty: true, scope: [], scopeDur: 0, shotCount: 0,
    };
    const probes = [
      { x: AXIS - 13.5, y: 1.6 },
      { x: AXIS - 13.5, y: 15 },
      { x: AXIS - 20, y: 48 },
    ];
    // put the septa probe onto the nearest septum
    {
      let best = null, bd = 1e9;
      for (let y = 40; y < 62; y++) for (let x = 55; x < 88; x++) if (sim.tissueAt(x, y) === SEPT) {
        const d = (x - 72) ** 2 + (y - 50) ** 2; if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; }
      }
      if (best) { probes[2].x = best[0]; probes[2].y = best[1]; }
    }

    // progressive field solve (keeps each chunk ~10 ms, warm-started from a smooth guess)
    const solveQueue = ['mono', 'bi'];
    const eqSegs = { mono: null, bi: null };
    function buildEquipotentials(key) {
      const f = sim.fields[key];
      const out = new Float32Array(60000); let n = 0;
      const lo = f.vmin, hi = f.vmax;
      const levels = key === 'mono' ? 13 : 12;
      for (let k = 1; k <= levels; k++) {
        const lv = lo + ((hi - lo) * k) / (levels + 1);
        n = contour(f.V, lv, out, n);
      }
      eqSegs[key] = out.subarray(0, n);
    }
    function solveChunk() {
      const key = solveQueue[0];
      if (!key) return;
      const f = sim.fields[key] || sim.prepare(key);
      const t0 = performance.now();
      while (performance.now() - t0 < 9 && !f.done && f.iters < 6000) sim.iterate(f, 20);
      if (f.done || f.iters >= 6000) {
        sim.derive(f); buildEquipotentials(key); buildQImage(key);
        solveQueue.shift();
        if (key === S.mode) { seedParticles(true); setStatus(); }
      } else if (key === S.mode) setStatus();
      S.dirty = true;
      if (solveQueue.length) setTimeout(solveChunk, 0);
      else if (reduced) presetReducedState();
    }
    const field = () => { const f = sim.fields[S.mode]; return f && f.ready ? f : null; };

    /* ---------- particles ---------- */
    const NP = window.innerWidth < 700 ? 360 : 600;
    const P = { x: new Float32Array(NP), y: new Float32Array(NP), bx: new Float32Array(NP), by: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP), age: new Float32Array(NP), ph: new Float32Array(NP) };
    const prand = mulberry(99);
    function sampleJ(f, x, y, out) {
      const gx = Math.min(NX - 1.001, Math.max(0, x - 0.5)), gy = Math.min(NY - 1.001, Math.max(0, y - 0.5));
      const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
      const i = (y0 + 1) * GW + x0 + 1;
      const bl = (A) => (A[i] * (1 - fx) + A[i + 1] * fx) * (1 - fy) + (A[i + GW] * (1 - fx) + A[i + GW + 1] * fx) * fy;
      out[0] = bl(f.Jx); out[1] = bl(f.Jy);
    }
    const jv = [0, 0];
    function spawn(f, k) {
      const r = prand() * f.srcTotal;
      let lo = 0, hi = f.src.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (f.src[mid][1] < r) lo = mid + 1; else hi = mid; }
      P.x[k] = f.src[lo][0] + prand(); P.y[k] = 0.15 + prand() * 0.4; P.age[k] = 0; P.ph[k] = prand() * 6.283;
    }
    function spawnOsc(f, k) {
      // anywhere, weighted by √|J| (rejection sampling)
      for (let tries = 0; tries < 40; tries++) {
        const x = prand() * NX, y = prand() * NY;
        const i = sim.idx(x | 0, y | 0);
        if (prand() < Math.sqrt(f.Jm[i] / f.jref)) { P.bx[k] = P.x[k] = x; P.by[k] = P.y[k] = y; P.ph[k] = prand() * 6.283; return; }
      }
      P.bx[k] = P.x[k] = AXIS + (prand() - 0.5) * 60; P.by[k] = P.y[k] = prand() * 30;
    }
    function advect(f, k, dt) {
      sampleJ(f, P.x[k], P.y[k], jv);
      const m = Math.hypot(jv[0], jv[1]) + 1e-9;
      const sp = 44 * clamp(Math.sqrt(m / f.jref), 0.1, 2.4);
      P.vx[k] = (jv[0] / m) * sp; P.vy[k] = (jv[1] / m) * sp;
      P.x[k] += P.vx[k] * dt; P.y[k] += P.vy[k] * dt; P.age[k] += dt;
    }
    function seedParticles(warm) {
      const f = field(); if (!f) return;
      for (let k = 0; k < NP; k++) {
        if (S.flowMode === 'osc') { spawnOsc(f, k); continue; }
        spawn(f, k);
        if (warm) { const n = (prand() * 90) | 0; for (let s = 0; s < n; s++) { advect(f, k, 1 / 30); if (dead(k)) { spawn(f, k); break; } } }
      }
    }
    function dead(k) {
      const x = P.x[k], y = P.y[k];
      if (x < 0 || x > NX || y > NY - 0.3 || P.age[k] > 7) return true;
      if (y < 0.12) return true; // left through an electrode (bipolar return)
      return false;
    }

    /* ---------- canvas layout ---------- */
    let L = null;
    const base = document.createElement('canvas');
    const heatC = document.createElement('canvas'); heatC.width = NX; heatC.height = NY;
    const hctx = heatC.getContext('2d');
    const heatImg = hctx.createImageData(NX, NY);
    const bloom1 = document.createElement('canvas'); bloom1.width = 60; bloom1.height = 37;
    const bloom2 = document.createElement('canvas'); bloom2.width = 24; bloom2.height = 15;
    const b1 = bloom1.getContext('2d'), b2 = bloom2.getContext('2d');
    const qImgs = {};
    const strokes = []; // dermal collagen fibres (grid coords) for the heated-collagen overlay
    {
      const r = mulberry(5);
      while (strokes.length < 240) {
        const x = 2 + r() * (NX - 4), y = 5 + r() * 26;
        const xi = x | 0;
        if (y < sim.bEpi[xi] + 1.2 || y > sim.bDerm[xi] - 1) continue;
        strokes.push({ x, y, a: (r() - 0.5) * 0.7, l: 3 + r() * 5, c: r() * 6.28 });
      }
    }
    function buildQImage(key) {
      const f = sim.fields[key];
      const c = document.createElement('canvas'); c.width = NX; c.height = NY;
      const cx = c.getContext('2d'); const im = cx.createImageData(NX, NY);
      for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
        const q = Math.sqrt(Math.min(1, f.Qn[sim.idx(x, y)])); const li = (q * 255) | 0; const p = (y * NX + x) * 4;
        im.data[p] = lut[li * 3]; im.data[p + 1] = lut[li * 3 + 1]; im.data[p + 2] = lut[li * 3 + 2]; im.data[p + 3] = Math.min(255, q * 300);
      }
      cx.putImageData(im, 0, 0); qImgs[key] = c;
    }

    function layout() {
      const fc = lib.fitCanvas(canvas, S.lowQ ? 1 : 2);
      if (fc.cssW < 10 || fc.cssH < 10) return false;
      const narrow = fc.cssW < 620;
      const strip = narrow ? 62 : 112;
      const headH = narrow ? clamp(fc.cssH * 0.24, 84, 112) : clamp(fc.cssH * 0.17, 56, 116);
      const footH = narrow ? 22 : 28;
      L = { dpr: fc.dpr, W: fc.cssW, H: fc.cssH, strip, headH, footH, narrow, tx: 0, ty: headH, tw: fc.cssW - strip, th: fc.cssH - headH - footH };
      L.sx = L.tw / NX; L.sy = L.th / NY;
      cv.style.setProperty('--strip', strip + 'px');
      cv.classList.toggle('is-narrow', narrow);
      buildBase();
      const sc = lib.fitCanvas(scopeC);
      S.scopeSize = sc;
      S.dirty = true;
      return true;
    }
    const X = (gx) => L.tx + gx * L.sx;
    const Y = (gy) => L.ty + gy * L.sy;

    function bandPath(c, top, bot) {
      c.beginPath();
      c.moveTo(X(0), typeof top === 'number' ? Y(top) : Y(top[0]));
      for (let x = 0; x < NX; x++) c.lineTo(X(x + 0.5), typeof top === 'number' ? Y(top) : Y(top[x]));
      c.lineTo(X(NX), typeof top === 'number' ? Y(top) : Y(top[NX - 1]));
      c.lineTo(X(NX), typeof bot === 'number' ? Y(bot) : Y(bot[NX - 1]));
      for (let x = NX - 1; x >= 0; x--) c.lineTo(X(x + 0.5), typeof bot === 'number' ? Y(bot) : Y(bot[x]));
      c.lineTo(X(0), typeof bot === 'number' ? Y(bot) : Y(bot[0]));
      c.closePath();
    }
    function buildBase() {
      base.width = canvas.width; base.height = canvas.height;
      const c = base.getContext('2d');
      c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      const r = mulberry(3);
      // head area
      const hg = c.createLinearGradient(0, 0, 0, L.headH);
      hg.addColorStop(0, '#07070c'); hg.addColorStop(1, '#0d0c16');
      c.fillStyle = hg; c.fillRect(0, 0, L.W, L.H);
      const fasc = Float32Array.from(sim.bFat, (v) => v + 2.6);
      // muscle / SMAS
      c.fillStyle = '#22101a'; bandPath(c, fasc, NY); c.fill();
      c.save(); bandPath(c, fasc, NY); c.clip();
      c.strokeStyle = 'rgba(255,120,140,0.07)'; c.lineWidth = 1;
      for (let y = 0; y < NY; y += 2.2) { c.beginPath(); for (let x = 0; x <= NX; x += 6) { const yy = Y(y + Math.sin(x * 0.07 + y) * 0.6); x ? c.lineTo(X(x), yy) : c.moveTo(X(x), yy); } c.stroke(); }
      c.restore();
      c.fillStyle = '#3a2331'; bandPath(c, sim.bFat, fasc); c.fill();
      // fat + adipocytes
      c.fillStyle = '#16140f'; bandPath(c, sim.bDerm, sim.bFat); c.fill();
      c.save(); bandPath(c, sim.bDerm, sim.bFat); c.clip();
      const cell = Math.max(3.2, Math.min(L.sx, L.sy) * 2.1);
      for (let y = Y(26); y < Y(84); y += cell * 1.55) for (let x = 0; x < L.tw; x += cell * 1.55) {
        const px = x + (r() - 0.5) * cell * 0.7, py = y + (r() - 0.5) * cell * 0.7;
        c.beginPath(); c.arc(px, py, cell * (0.62 + r() * 0.2), 0, 6.283);
        c.fillStyle = 'rgba(255,226,160,0.028)'; c.fill();
        c.strokeStyle = 'rgba(255,226,160,0.075)'; c.lineWidth = 0.8; c.stroke();
      }
      c.restore();
      // dermis + collagen texture
      const dg = c.createLinearGradient(0, Y(4), 0, Y(31));
      dg.addColorStop(0, '#251729'); dg.addColorStop(1, '#1b1220');
      c.fillStyle = dg; bandPath(c, sim.bEpi, sim.bDerm); c.fill();
      c.save(); bandPath(c, sim.bEpi, sim.bDerm); c.clip();
      c.lineCap = 'round';
      const nF = Math.round((L.tw * (L.sy * 26)) / 90);
      for (let k = 0; k < nF; k++) {
        const gx = r() * NX, gy = 4 + r() * 28, a = (r() - 0.5) * 0.9, l = (2 + r() * 5) * L.sx;
        c.strokeStyle = `rgba(214,170,220,${0.04 + r() * 0.08})`; c.lineWidth = 0.5 + r() * 0.9;
        c.beginPath(); c.moveTo(X(gx), Y(gy));
        c.quadraticCurveTo(X(gx) + Math.cos(a) * l * 0.5, Y(gy) + Math.sin(a) * l * 0.5 + (r() - 0.5) * 3, X(gx) + Math.cos(a) * l, Y(gy) + Math.sin(a) * l);
        c.stroke();
      }
      c.restore();
      // epidermis
      const eg = c.createLinearGradient(0, Y(0), 0, Y(5.5));
      eg.addColorStop(0, '#4d3d5c'); eg.addColorStop(1, '#342840');
      c.fillStyle = eg; bandPath(c, 0, sim.bEpi); c.fill();
      c.save(); bandPath(c, 0, sim.bEpi); c.clip();
      for (let k = 0; k < L.tw * 0.9; k++) { c.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; c.fillRect(r() * L.tw, Y(0.5) + r() * (L.sy * 5), 1.2, 1.2); }
      c.restore();
      c.strokeStyle = 'rgba(236,226,255,0.45)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(X(0), Y(0) + 0.5); c.lineTo(X(NX), Y(0) + 0.5); c.stroke();
      // septa
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [w, col] of [[Math.max(1.4, 1.15 * L.sx), 'rgba(150,130,190,0.20)'], [Math.max(0.6, 0.3 * L.sx), 'rgba(230,220,255,0.22)']]) {
        c.lineWidth = w; c.strokeStyle = col;
        for (const pl of sim.septa) { c.beginPath(); pl.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.stroke(); }
      }
      // depth strip background
      const sx0 = L.tw;
      c.fillStyle = '#0a0a12'; c.fillRect(sx0, 0, L.strip, L.H);
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(sx0 + 0.5, 0); c.lineTo(sx0 + 0.5, L.H); c.stroke();
      // return-path band at the bottom
      c.fillStyle = '#0b0a12'; c.fillRect(0, L.ty + L.th, L.tw, L.footH);
    }

    /* ---------- drawing ---------- */
    const segBuf = new Float32Array(4 * 24000);
    const fontMono = (px, w = 400) => `${w} ${px}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    const fontSans = (px, w = 400) => `${w} ${px}px "Noto Sans SC", "PingFang SC", system-ui, sans-serif`;
    let isoCache = { n: 0, t: -1 };

    function strokeSegs(buf, n) {
      g.beginPath();
      for (let k = 0; k < n; k += 4) { g.moveTo(X(buf[k]), Y(buf[k + 1])); g.lineTo(X(buf[k + 2]), Y(buf[k + 3])); }
      g.stroke();
    }

    function paintHeat() {
      const T = sim.T, d = heatImg.data;
      for (let y = 0; y < NY; y++) {
        const row = (y + 1) * GW + 1;
        for (let x = 0; x < NX; x++) {
          const t = T[row + x], p = (y * NX + x) * 4;
          if (t > 0.004) {
            const u = t >= 1 ? 1 : Math.pow(t, 0.8), li = ((u * 255) | 0) * 3;
            d[p] = lut[li]; d[p + 1] = lut[li + 1]; d[p + 2] = lut[li + 2]; d[p + 3] = Math.min(1, t * 1.7) * 238;
          } else if (t < -0.004) {
            const a = Math.min(1, -t * 2.4);
            d[p] = 127; d[p + 1] = 212; d[p + 2] = 255; d[p + 3] = a * 210;
          } else d[p + 3] = 0;
        }
      }
      hctx.putImageData(heatImg, 0, 0);
    }

    function draw(t) {
      if (!L) return;
      const f = field();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(base, 0, 0);
      g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      g.save();
      g.beginPath(); g.rect(L.tx, L.ty, L.tw, L.th); g.clip();
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';

      // heat-source overlay
      if (S.qAlpha > 0.01 && qImgs[S.mode]) {
        g.globalAlpha = S.qAlpha * 0.85; g.globalCompositeOperation = 'lighter';
        g.drawImage(qImgs[S.mode], L.tx, L.ty, L.tw, L.th);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
      // temperature
      const active = sim.maxT > 0.004 || sim.minT < -0.004;
      if (active) {
        paintHeat();
        g.drawImage(heatC, L.tx, L.ty, L.tw, L.th);
        b1.clearRect(0, 0, 60, 37); b1.drawImage(heatC, 0, 0, 60, 37);
        b2.clearRect(0, 0, 24, 15); b2.drawImage(bloom1, 0, 0, 24, 15);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.42; g.drawImage(bloom1, L.tx - 6, L.ty - 6, L.tw + 12, L.th + 12);
        if (!S.lowQ) { g.globalAlpha = 0.34; g.drawImage(bloom2, L.tx - 20, L.ty - 20, L.tw + 40, L.th + 40); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
      // heated collagen (contracting fibres)
      if (active && sim.maxT > 0.2) {
        const emph = 0.5 + S.collagen * 0.8;
        g.lineCap = 'round';
        g.beginPath();
        for (const s of strokes) {
          const v = sim.sampleT(s.x, s.y); if (v < 0.28) continue;
          const k = sstep(0.28, 0.8, v), l = s.l * (1 - 0.35 * k) * L.sx;
          const x0 = X(s.x), y0 = Y(s.y), ca = Math.cos(s.a) * l * 0.5, sa = Math.sin(s.a) * l * 0.5;
          const wob = Math.sin(t * 3 + s.c) * k * 1.4;
          g.moveTo(x0 - ca, y0 - sa); g.quadraticCurveTo(x0, y0 + wob, x0 + ca, y0 + sa);
        }
        g.strokeStyle = `rgba(210,255,236,${0.45 * emph})`; g.lineWidth = 1.1 + S.collagen * 0.7; g.stroke();
      }
      // equipotentials
      const eq = eqSegs[S.mode];
      if (eq && S.equiAlpha > 0.01) {
        const pulse = S.flowMode === 'osc' ? 0.65 + 0.35 * Math.sin(t * 5) : 1;
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(160,130,255,${0.22 * S.equiAlpha * pulse})`; g.lineWidth = 3.2; strokeSegs(eq, eq.length);
        g.strokeStyle = `rgba(206,192,255,${0.6 * S.equiAlpha * pulse})`; g.lineWidth = 1; strokeSegs(eq, eq.length);
        g.globalCompositeOperation = 'source-over';
      }
      // isotherms
      if (active && S.view.iso) {
        if (isoCache.t !== S.frameNo) {
          let n = 0; isoCache.lv = [];
          for (const lv of [0.25, 0.5, 0.75]) { const n0 = n; n = contour(sim.T, lv, segBuf, n); isoCache.lv.push([n0, n]); }
          const n0 = n; n = contour(sim.T, -0.2, segBuf, n); isoCache.lv.push([n0, n]);
          isoCache.n = n; isoCache.t = S.frameNo;
        }
        const st = [[0.22, 0.8], [0.4, 1], [0.62, 1.2]];
        isoCache.lv.forEach(([a, b], j) => {
          if (b <= a) return;
          if (j === 3) { g.strokeStyle = 'rgba(127,212,255,0.75)'; g.lineWidth = 1; g.setLineDash([2, 3]); }
          else { g.strokeStyle = `rgba(255,244,214,${st[j][0]})`; g.lineWidth = st[j][1]; }
          g.beginPath();
          for (let k = a; k < b; k += 4) { g.moveTo(X(segBuf[k]), Y(segBuf[k + 1])); g.lineTo(X(segBuf[k + 2]), Y(segBuf[k + 3])); }
          g.stroke(); g.setLineDash([]);
        });
      }
      // current particles
      if (f && S.flowAlpha > 0.01) {
        g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        const col = S.mode === 'mono' ? '120,255,210' : '196,170,255';
        const osc = S.flowMode === 'osc';
        const cnt = osc ? Math.min(NP, 280) : S.lowQ ? NP >> 1 : NP;
        const passes = osc ? [[4, 0.16], [1.6, 0.85]] : [[3, 0.1], [1.1, 0.7]];
        // three depth buckets so the return current fades out below the SMAS
        for (let bkt = 0; bkt < 3; bkt++) {
          const fade = bkt === 0 ? 1 : bkt === 1 ? 0.45 : 0.16;
          for (const [w, a] of passes) {
            g.beginPath();
            for (let k = 0; k < cnt; k++) {
              let x = P.x[k], y = P.y[k], tx, ty;
              if (osc) {
                if (bkt) break;
                sampleJ(f, P.bx[k], P.by[k], jv);
                const m = Math.hypot(jv[0], jv[1]) + 1e-9, amp = 1.2 * clamp(Math.sqrt(m / f.jref), 0.25, 1.3);
                const s = Math.sin(t * 7 + P.ph[k]), c = Math.cos(t * 7 + P.ph[k]);
                x = P.bx[k] + (jv[0] / m) * s * amp; y = P.by[k] + (jv[1] / m) * s * amp;
                tx = x - (jv[0] / m) * c * amp * 0.35; ty = y - (jv[1] / m) * c * amp * 0.35;
              } else {
                const b = y < 80 ? 0 : y < 95 ? 1 : 2;
                if (b !== bkt) continue;
                tx = x - P.vx[k] * 0.045; ty = y - P.vy[k] * 0.045;
              }
              g.moveTo(X(x), Y(y)); g.lineTo(X(tx), Y(ty));
            }
            g.strokeStyle = `rgba(${col},${a * fade * S.flowAlpha})`; g.lineWidth = w; g.stroke();
          }
        }
        g.globalCompositeOperation = 'source-over';
      }
      g.restore();

      drawReturnBand(t, f);
      drawHead(t);
      drawLabels();
      if (L.narrow) { // the HUD sub-line is hidden on narrow canvases — keep the 原理示意 tag on the picture itself
        g.font = fontSans(9.5); g.textAlign = 'right'; g.textBaseline = 'alphabetic';
        g.fillStyle = 'rgba(7,7,12,0.55)'; const tw = g.measureText('原理示意 · 非等比例').width;
        g.fillRect(L.tw - tw - 12, L.ty + L.th - 20, tw + 8, 15);
        g.fillStyle = 'rgba(206,202,222,0.85)'; g.fillText('原理示意 · 非等比例', L.tw - 8, L.ty + L.th - 9);
        g.textAlign = 'left';
      }
      drawProbes();
      drawStrip();
      if (!f) {
        g.fillStyle = 'rgba(7,7,12,0.35)'; g.fillRect(L.tx, L.ty, L.tw, L.th);
      }
    }

    function drawReturnBand(t, f) {
      const y0 = L.ty + L.th, h = L.footH;
      const on = S.mode === 'mono';
      const glow = S.returnGlow;
      if (on && glow > 0.01) {
        const gr = g.createLinearGradient(0, y0 - 30, 0, y0 + h);
        gr.addColorStop(0, 'rgba(138,92,240,0)'); gr.addColorStop(1, `rgba(138,92,240,${0.5 * glow})`);
        g.fillStyle = gr; g.fillRect(0, y0 - 30, L.tw, 30 + h);
        // travelling dashes = return current
        g.strokeStyle = `rgba(200,180,255,${0.7 * glow})`; g.lineWidth = 1.5; g.setLineDash([6, 10]); g.lineDashOffset = -t * 40;
        g.beginPath(); g.moveTo(0, y0 + 1.5); g.lineTo(L.tw, y0 + 1.5); g.stroke(); g.setLineDash([]);
      }
      g.fillStyle = on ? `rgba(220,210,255,${0.55 + 0.4 * glow})` : 'rgba(200,190,230,0.55)';
      g.font = L.narrow ? fontSans(9.5) : fontSans(11.5);
      g.textBaseline = 'middle'; g.textAlign = 'center';
      g.fillText(on ? (L.narrow ? '↓ 经人体回流至中性电极片 · 闭合回路' : '↓  电流经人体组织回流至中性电极片（腰部 / 身体两侧）· 闭合射频回路')
        : (L.narrow ? '双极：两电极间浅层回路（对比示意）' : '双极（对比示意）：电流在两电极之间形成浅层回路，无回流电极片'), L.tw / 2, y0 + h / 2 + 1);
      g.textAlign = 'left';
    }

    function drawHead(t) {
      const m = MODES[S.mode];
      const sy = L.ty; // skin surface
      const e0 = X(m.electrodes[0].x0), e1 = X(m.electrodes[m.electrodes.length - 1].x1);
      const pad = L.narrow ? 7 : 14;
      const hx0 = e0 - pad, hx1 = e1 + pad, top = Math.max(6, sy - L.headH * (L.narrow ? 0.5 : 0.6));
      const inContact = S.phase === 'pre' || S.phase === 'rf' || S.phase === 'post';
      const lift = inContact ? 0 : 0; // tip rests on skin in the schematic
      // handpiece body (silver) entering from above
      const nw = Math.min(150, (hx1 - hx0) * 0.34), ncx = (hx0 + hx1) / 2;
      const ng = g.createLinearGradient(ncx - nw / 2, 0, ncx + nw / 2, 0);
      ng.addColorStop(0, '#6f737b'); ng.addColorStop(0.28, '#e9ebef'); ng.addColorStop(0.5, '#c9cdd4'); ng.addColorStop(1, '#5d6068');
      g.fillStyle = ng;
      g.beginPath();
      g.moveTo(ncx - nw * 0.4, -2); g.lineTo(ncx + nw * 0.4, -2);
      g.quadraticCurveTo(ncx + nw * 0.5, top - 4, ncx + nw * 0.62, top + 2);
      g.lineTo(ncx - nw * 0.62, top + 2);
      g.quadraticCurveTo(ncx - nw * 0.5, top - 4, ncx - nw * 0.4, -2);
      g.closePath(); g.fill();
      // tip housing (black, satin) with a bronze-rimmed treatment face like the real handpiece head
      const hg = g.createLinearGradient(0, top, 0, sy);
      hg.addColorStop(0, '#262634'); hg.addColorStop(0.45, '#15151f'); hg.addColorStop(1, '#0a0a10');
      g.fillStyle = hg;
      rr(hx0, top + lift, hx1 - hx0, sy - top - lift, 10, true);
      g.strokeStyle = 'rgba(201,205,212,0.32)'; g.lineWidth = 1; g.stroke();
      const gloss = g.createLinearGradient(hx0, 0, hx1, 0);
      gloss.addColorStop(0, 'rgba(255,255,255,0)'); gloss.addColorStop(0.3, 'rgba(255,255,255,0.16)'); gloss.addColorStop(0.7, 'rgba(255,255,255,0.05)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gloss; g.beginPath(); g.moveTo(hx0 + 10, top + 1.5); g.lineTo(hx1 - 10, top + 1.5); g.stroke();
      // cavity behind the electrode (where the cryogen is sprayed)
      const cx0 = hx0 + pad * 0.7, cx1 = hx1 - pad * 0.7, cy0 = top + (sy - top) * 0.28, cy1 = sy - 7;
      const cg2 = g.createLinearGradient(0, cy0, 0, cy1);
      cg2.addColorStop(0, '#040407'); cg2.addColorStop(1, '#0d0c16');
      g.fillStyle = cg2; rr(cx0, cy0, cx1 - cx0, cy1 - cy0, 6, true);
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.stroke();
      // cryogen feed line + nozzle
      const nozX = (cx0 + cx1) / 2;
      g.strokeStyle = S.spray > 0.05 ? `rgba(127,212,255,${0.35 + 0.5 * S.spray})` : 'rgba(154,160,170,0.45)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(nozX, top - 2); g.lineTo(nozX, cy0 - 1); g.stroke();
      g.fillStyle = '#a3a8b2'; g.beginPath(); g.moveTo(nozX - 6, cy0 - 2); g.lineTo(nozX + 6, cy0 - 2); g.lineTo(nozX + 3, cy0 + 5); g.lineTo(nozX - 3, cy0 + 5); g.closePath(); g.fill();
      // part label inside the cavity while idle (IFU p.7 / DATA.components)
      if (!L.narrow && S.spray < 0.3 && cx1 - cx0 > 240) {
        g.globalAlpha = 1 - S.spray / 0.3;
        g.font = fontSans(10.5); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(169,166,186,0.6)';
        g.fillText(S.mode === 'mono' ? '一次性使用治疗头端 YM5-TP4-900 · 4.0 cm²' : '双极电极（对比示意）', nozX, (cy0 + 6 + cy1) / 2 + 1);
        g.globalAlpha = 1; g.textAlign = 'left';
      }
      // cryogen spray onto the NON-patient side of the electrode (IFU p.12)
      const spray = S.spray;
      const noz = [nozX, cy0 + 2];
      if (spray > 0.01) {
        const sg2 = g.createLinearGradient(0, cy0, 0, cy1);
        sg2.addColorStop(0, `rgba(127,212,255,${0.55 * spray})`); sg2.addColorStop(1, `rgba(127,212,255,${0.12 * spray})`);
        g.fillStyle = sg2;
        g.beginPath(); g.moveTo(noz[0] - 3, cy0 + 5); g.lineTo(noz[0] + 3, cy0 + 5); g.lineTo(cx1 - 6, cy1); g.lineTo(cx0 + 6, cy1); g.closePath(); g.fill();
        g.fillStyle = `rgba(210,240,255,${0.85 * spray})`;
        for (let k = 0; k < 36; k++) {
          const u = ((k * 0.618 + t * 1.7) % 1), a = ((k * 0.377) % 1) - 0.5;
          const px = noz[0] + a * (cx1 - cx0 - 14) * u, py = cy0 + 6 + (cy1 - cy0 - 8) * u;
          g.fillRect(px, py, 1.6, 1.6);
        }
      }
      // electrodes: copper face on polyimide film
      const rf = S.phase === 'rf' ? 1 : 0;
      for (const e of m.electrodes) {
        const a = X(e.x0), b = X(e.x1);
        if (rf) { g.shadowColor = S.mode === 'mono' ? 'rgba(67,230,168,0.9)' : 'rgba(170,140,255,0.9)'; g.shadowBlur = 16 + 6 * Math.sin(t * 30); }
        const eg = g.createLinearGradient(a, 0, b, 0);
        eg.addColorStop(0, '#b8793a'); eg.addColorStop(0.5, '#f3c77a'); eg.addColorStop(1, '#b8793a');
        g.fillStyle = eg; g.fillRect(a, sy - 6, b - a, 4);
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(214,150,52,0.75)'; g.fillRect(a - 2, sy - 2, b - a + 4, 2);
        if (S.mode === 'bi') { g.fillStyle = '#fff'; g.font = fontMono(11, 500); g.textAlign = 'center'; g.fillText(e.v > 0 ? '+' : '−', (a + b) / 2, cy0 + 12); g.textAlign = 'left'; }
      }
      // frost on the electrode back when cold
      if (S.Te < -0.05 && !S.noCool) {
        g.fillStyle = `rgba(127,212,255,${Math.min(0.8, -S.Te * 0.9)})`;
        for (const e of m.electrodes) g.fillRect(X(e.x0), sy - 8, X(e.x1) - X(e.x0), 2);
      }
      // callouts
      if (!L.narrow) {
        g.font = fontSans(11); g.textBaseline = 'middle';
        g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1;
        const ly = sy - 15;
        g.beginPath(); g.moveTo(noz[0] - 7, cy0 + 2); g.lineTo(hx0 - 6, cy0 + 2); g.lineTo(hx0 - 16, ly); g.stroke();
        g.textAlign = 'right'; g.fillStyle = spray > 0.05 ? '#7fd4ff' : 'rgba(236,234,244,0.62)';
        g.fillText('R134a 制冷剂 → 电极非患者侧', hx0 - 21, ly);
        g.beginPath(); g.moveTo(e1 - 4, sy - 4); g.lineTo(hx1 + 16, ly); g.stroke();
        g.textAlign = 'left'; g.fillStyle = 'rgba(236,234,244,0.62)';
        g.fillText(S.mode === 'mono' ? '治疗头端电极 · 铜 / 聚酰亚胺' : '双极电极对（对比示意）', hx1 + 21, ly);
      }
    }
    function rr(x, y, w, h, r, fill) {
      g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
      if (fill) g.fill();
    }

    function drawLabels() {
      const labels = [[2.3, '表皮', 'EPIDERMIS'], [17, '真皮', 'DERMIS'], [53, '皮下脂肪 · 纤维隔', 'FAT · SEPTA'], [94, 'SMAS · 肌层', 'SMAS · MUSCLE']];
      g.textBaseline = 'middle'; g.textAlign = 'left';
      for (const [gy, zh, en] of labels) {
        const y = Y(gy);
        g.font = fontSans(L.narrow ? 9.5 : 11.5, 500);
        const w = g.measureText(zh).width;
        g.fillStyle = 'rgba(7,7,12,0.55)'; g.fillRect(6, y - 8, w + (L.narrow ? 8 : 70), 16);
        g.fillStyle = 'rgba(236,234,244,0.86)'; g.fillText(zh, 10, y);
        if (!L.narrow) { g.font = fontMono(8.5); g.fillStyle = 'rgba(169,166,186,0.6)'; g.fillText(en, 14 + w, y + 0.5); }
      }
    }

    function drawProbes() {
      probes.forEach((p, i) => {
        const x = X(p.x), y = Y(p.y), col = PROBES[i].color;
        const v = sim.sampleT(p.x, p.y);
        g.strokeStyle = col; g.lineWidth = 1.4;
        g.beginPath(); g.arc(x, y, 6.5, 0, 6.283); g.stroke();
        g.beginPath(); g.moveTo(x - 11, y); g.lineTo(x - 4, y); g.moveTo(x + 4, y); g.lineTo(x + 11, y); g.moveTo(x, y - 11); g.lineTo(x, y - 4); g.moveTo(x, y + 4); g.lineTo(x, y + 11); g.stroke();
        if (S.dragging === i) { g.fillStyle = col + '33'; g.beginPath(); g.arc(x, y, 14, 0, 6.283); g.fill(); }
        const txt = `${PROBES[i].name} ${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
        g.font = fontMono(L.narrow ? 9 : 10.5, 500);
        const w = g.measureText(txt).width + 10;
        const lx = x + 14 + w > L.tw ? x - 14 - w : x + 14;
        g.fillStyle = 'rgba(7,7,12,0.78)'; g.fillRect(lx, y - 9, w, 18);
        g.fillStyle = col; g.fillRect(lx, y - 9, 2, 18);
        g.fillStyle = '#eceaf4'; g.textBaseline = 'middle'; g.fillText(txt, lx + 6, y + 0.5);
      });
    }

    const prof = new Float32Array(NY);
    function drawStrip() {
      const x0 = L.tw + 1, w = L.strip - 1;
      const pad = L.narrow ? 6 : 12;
      const ax0 = x0 + pad, ax1 = x0 + w - pad;
      const vmin = -1, vmax = 1.2;
      const PX = (v) => ax0 + ((v - vmin) / (vmax - vmin)) * (ax1 - ax0);
      // title
      g.fillStyle = 'rgba(169,166,186,0.9)'; g.font = fontSans(L.narrow ? 9 : 11, 500); g.textBaseline = 'alphabetic';
      g.textAlign = 'center';
      g.fillText(L.narrow ? '深度温升' : '中心轴 · 深度', x0 + w / 2, L.ty - (L.narrow ? 22 : 30));
      g.font = fontMono(L.narrow ? 8 : 9); g.fillStyle = 'rgba(111,108,130,0.9)';
      g.fillText(L.narrow ? 'ΔT 相对' : '相对温升 ΔT', x0 + w / 2, L.ty - (L.narrow ? 10 : 14));
      // layer boundaries (at the probe column)
      const cxs = [AXIS - 16, AXIS - 12, AXIS - 8, AXIS + 8, AXIS + 12, AXIS + 16];
      const mean = (arr) => cxs.reduce((a, c) => a + arr[c], 0) / cxs.length;
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
      for (const b of [mean(sim.bEpi), mean(sim.bDerm), mean(sim.bFat)]) { g.beginPath(); g.moveTo(x0, Y(b)); g.lineTo(x0 + w, Y(b)); g.stroke(); }
      // zero axis
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(PX(0), L.ty); g.lineTo(PX(0), L.ty + L.th); g.stroke();
      // ticks
      g.font = fontMono(8.5); g.fillStyle = 'rgba(111,108,130,0.9)'; g.textAlign = 'center';
      g.fillText('0', PX(0), L.ty + L.th + 12);
      if (!L.narrow) { g.fillText('冷', PX(-0.8), L.ty + L.th + 12); g.fillText('热', PX(1), L.ty + L.th + 12); }
      g.textAlign = 'left';
      // profile
      const T = sim.T;
      let pk = 0, pky = 0;
      for (let y = 0; y < NY; y++) {
        let s = 0; for (const c of cxs) s += T[(y + 1) * GW + c + 1];
        prof[y] = s / cxs.length;
        if (prof[y] > pk) { pk = prof[y]; pky = y; }
      }
      // fill
      g.beginPath(); g.moveTo(PX(0), Y(0.5));
      for (let y = 0; y < NY; y++) g.lineTo(PX(clamp(prof[y], vmin, vmax)), Y(y + 0.5));
      g.lineTo(PX(0), Y(NY - 0.5)); g.closePath();
      const fg = g.createLinearGradient(PX(vmin), 0, PX(vmax), 0);
      fg.addColorStop(0, 'rgba(127,212,255,0.55)'); fg.addColorStop((0 - vmin) / (vmax - vmin), 'rgba(127,212,255,0.05)');
      fg.addColorStop((0 - vmin) / (vmax - vmin) + 0.001, 'rgba(184,48,122,0.15)'); fg.addColorStop(1, 'rgba(255,196,94,0.7)');
      g.fillStyle = fg; g.fill();
      g.beginPath();
      for (let y = 0; y < NY; y++) { const px = PX(clamp(prof[y], vmin, vmax)), py = Y(y + 0.5); y ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.strokeStyle = '#fff4d6'; g.lineWidth = 1.3; g.stroke();
      if (pk > 0.08) {
        const px = PX(Math.min(pk, vmax)), py = Y(pky + 0.5);
        g.fillStyle = '#ffc45e'; g.beginPath(); g.arc(px, py, 3, 0, 6.283); g.fill();
        if (!L.narrow) { g.font = fontSans(10); g.fillStyle = '#ffc45e'; g.textAlign = 'right'; g.fillText('峰值', px - 6, py - 7 < L.ty + 10 ? py + 14 : py - 7); g.textAlign = 'left'; }
      }
      const ep = prof[2];
      if (ep < -0.05 && !L.narrow) {
        g.font = fontMono(9); g.fillStyle = '#7fd4ff'; g.fillText('表皮冷却', ax0, Y(2) + 12);
      }
    }

    /* ---------- probe scope ---------- */
    function drawScope() {
      const sc = S.scopeSize; if (!sc) return;
      const w = sc.cssW, h = sc.cssH;
      sg.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
      sg.clearRect(0, 0, w, h);
      const dur = S.scopeDur || PRE + S.pulse + POST;
      const x = (tt) => 26 + (tt / dur) * (w - 32);
      const vmin = -1, vmax = 1.2;
      const y = (v) => 6 + (1 - (v - vmin) / (vmax - vmin)) * (h - 20);
      // phase bands
      const bands = [[0, PRE, 'rgba(127,212,255,0.07)'], [PRE, PRE + (S.scopePulse || S.pulse), 'rgba(138,92,240,0.12)'], [PRE + (S.scopePulse || S.pulse), dur, 'rgba(127,212,255,0.07)']];
      for (const [a, b, c] of bands) { sg.fillStyle = c; sg.fillRect(x(a), 4, x(b) - x(a), h - 16); }
      sg.strokeStyle = 'rgba(255,255,255,0.14)'; sg.lineWidth = 1;
      sg.beginPath(); sg.moveTo(26, y(0)); sg.lineTo(w - 6, y(0)); sg.stroke();
      sg.font = fontMono(9); sg.fillStyle = 'rgba(111,108,130,0.95)'; sg.textBaseline = 'middle';
      sg.fillText('0', 12, y(0)); sg.fillText('+1', 6, y(1)); sg.fillText('−1', 6, y(-1) - 2);
      sg.textBaseline = 'alphabetic'; sg.textAlign = 'center';
      sg.fillText('预冷', x(PRE / 2), h - 2); sg.fillText('射频', x(PRE + (S.scopePulse || S.pulse) / 2), h - 2); sg.fillText('后冷', x(dur - POST / 2), h - 2);
      sg.textAlign = 'left';
      if (!S.scope.length) {
        sg.fillStyle = 'rgba(169,166,186,0.7)'; sg.font = fontSans(11);
        sg.textAlign = 'center'; sg.fillText('按「发射」记录三个探针的相对温升', w / 2, h / 2 - 4); sg.textAlign = 'left';
        return;
      }
      for (let pi = 0; pi < 3; pi++) {
        sg.beginPath();
        S.scope.forEach((s, k) => { const px = x(s[0]), py = y(clamp(s[pi + 1], vmin, vmax)); k ? sg.lineTo(px, py) : sg.moveTo(px, py); });
        sg.strokeStyle = PROBES[pi].color; sg.lineWidth = 1.6; sg.stroke();
      }
      if (S.phase === 'pre' || S.phase === 'rf' || S.phase === 'post') {
        const last = S.scope[S.scope.length - 1];
        sg.strokeStyle = 'rgba(255,255,255,0.4)'; sg.beginPath(); sg.moveTo(x(last[0]), 4); sg.lineTo(x(last[0]), h - 12); sg.stroke();
      }
    }

    /* ---------- controller ---------- */
    const phaseLen = (ph) => (ph === 'pre' ? PRE : ph === 'rf' ? S.pulse : ph === 'post' ? POST : 0);
    const PH_LABEL = { idle: '就绪', pre: '治疗前冷却', rf: '射频传送中', post: '治疗后冷却', relax: '组织恢复（加速显示）' };
    function setStatus() {
      const f = sim.fields[S.mode];
      let s;
      if (!f || !f.ready) s = `电场求解中 · SOR 迭代 ${f ? f.iters : 0}`;
      else s = PH_LABEL[S.phase];
      if (elStatus.textContent !== s) elStatus.textContent = s;
      root.dataset.phase = S.phase;
      phaseEls.forEach((li) => li.classList.toggle('is-on', li.dataset.ph === S.phase));
    }
    function fire(user) {
      if (!field()) return;
      if (!lib.isAllowed(S.lv, S.pulse)) return;
      if (user) S.userLock = true;
      S.phase = 'pre'; S.phaseT = 0; S.scope = []; S.scopeDur = PRE + S.pulse + POST; S.scopePulse = S.pulse; S.shotT = 0; S.lastSample = 0;
      S.shotCount++;
      if (S.flowMode !== 'rf' && S.step >= 2) S.flowMode = 'rf';
      if (reduced) { runHeadless(); return; }
      setStatus();
    }
    function heatGain() { return GAIN * (lib.levelPower(S.lv) / 175); }
    function physicsStep(dt) {
      // dt = real seconds; returns sim seconds advanced
      const inShot = S.phase === 'pre' || S.phase === 'rf' || S.phase === 'post';
      const speed = inShot ? SLOW : S.phase === 'relax' ? 3 : 1.5;
      let sdt = dt * speed;
      const f = field();
      // electrode temperature: sprayed during pre/post, drifts back during RF, warms when lifted
      const spraying = !S.noCool && (S.phase === 'pre' || S.phase === 'post');
      if (spraying) S.Te += sdt * coolRate(S.cool) * (coolTarget(S.cool) - S.Te);
      else if (S.phase === 'rf') S.Te += sdt * 0.6 * (0 - S.Te);
      else S.Te += sdt * 1.5 * (0 - S.Te);
      S.spray += ((spraying ? 1 : 0) - S.spray) * Math.min(1, dt * 10);
      const quiet = !inShot && sim.maxT < 0.003 && sim.minT > -0.003;
      if (f && !quiet) {
        sim.step(sdt, { f, heat: S.phase === 'rf' ? heatGain() : 0, contact: inShot, Te: S.noCool ? 0 : S.Te, h: S.noCool ? 0 : HC, decay: inShot ? 0 : 0.45 });
      } else if (quiet && (sim.maxT !== 0 || sim.minT !== 0)) sim.reset();
      if (inShot) {
        S.phaseT += sdt; S.shotT += sdt;
        if (!S.lastSample || S.shotT - S.lastSample > 0.02) {
          S.lastSample = S.shotT;
          S.scope.push([S.shotT, ...probes.map((p) => sim.sampleT(p.x, p.y))]);
        }
        if (S.phaseT >= phaseLen(S.phase)) {
          S.phaseT = 0;
          S.phase = S.phase === 'pre' ? 'rf' : S.phase === 'rf' ? 'post' : 'relax';
          if (S.phase === 'relax') { S.lastSample = 0; S.relaxT = 0; }
          setStatus();
        }
      } else if (S.phase === 'relax') {
        S.relaxT += sdt;
        if (sim.maxT < 0.06 && sim.minT > -0.06 || S.relaxT > 30) { S.phase = 'idle'; setStatus(); }
      }
      return sdt;
    }
    function runHeadless() {
      // reduced motion: compute the full shot instantly and show the end-of-RF state
      sim.reset(); S.Te = 0;
      const dt = 1 / 60;
      S.phase = 'pre'; S.phaseT = 0; S.shotT = 0; S.lastSample = 0;
      let snap = null;
      for (let k = 0; k < 2000 && S.phase !== 'relax'; k++) {
        const was = S.phase; physicsStep(dt / SLOW);
        if (was === 'rf' && S.phase === 'post') snap = Float32Array.from(sim.T);
      }
      if (snap) { sim.T.set(snap); let mx = 0, mn = 0; for (const v of snap) { if (v > mx) mx = v; if (v < mn) mn = v; } sim.maxT = mx; sim.minT = mn; }
      S.phase = 'idle'; S.Te = 0; S.spray = 0; setStatus();
      S.dirty = true; render();
    }
    function presetReducedState() {
      if (!reduced) return;
      if (S.step < 2) { S.equiAlpha = 1; } else fire(false);
      render();
    }

    /* ---------- story steps ---------- */
    function setStep(i, why) {
      i = clamp(i | 0, 0, STEPS.length - 1);
      if (i === S.step && why !== 'init') return;
      const prev = S.step;
      S.step = i; S.userLock = false; S.autoWait = 0.6;
      progBtns.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.classList.toggle('is-done', k < i); });
      stepEls.forEach((el, k) => {
        const on = k === i;
        el.classList.toggle('is-on', on);
        if (on && !reduced && why !== 'init') gsap.fromTo(el.children, { y: prev < i ? 18 : -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.05, ease: 'expo.out', overwrite: true });
      });
      // step presets drive the simulation
      const v = S.view;
      if (i === 0) { v.equi = true; v.flow = true; v.iso = true; v.q = false; S.flowMode = 'osc'; S.collagen = 0; }
      if (i === 1) { v.equi = false; v.flow = true; v.iso = true; v.q = false; S.flowMode = 'flow'; S.collagen = 0; }
      if (i === 2) { v.equi = false; v.flow = true; v.iso = true; v.q = true; S.flowMode = 'rf'; S.collagen = 0; }
      if (i === 3) { v.equi = false; v.flow = true; v.iso = true; v.q = false; S.flowMode = 'rf'; S.collagen = 0; }
      if (i === 4) { v.equi = false; v.flow = false; v.iso = true; v.q = false; S.flowMode = 'rf'; S.collagen = 1; }
      if (i < 2 && S.mode === 'bi' && why !== 'init') setMode('mono');
      if (i !== 3 && S.noCool) setNoCool(false);
      syncViews();
      seedParticles(true);
      if (reduced) { if (i >= 2) fire(false); else { sim.reset(); render(); } }
      S.dirty = true;
    }
    progBtns.forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (pinST) {
        const y = pinST.start + (pinST.end - pinST.start) * ((i + 0.5) / STEPS.length);
        if (ctx.lenis) ctx.lenis.scrollTo(y, { duration: 1.1 }); else window.scrollTo({ top: y, behavior: 'smooth' });
      } else setStep(i, 'click');
    }));
    root.querySelector('.mx-tobi')?.addEventListener('click', () => { setMode(S.mode === 'bi' ? 'mono' : 'bi'); S.userLock = false; });
    root.querySelector('.mx-next')?.addEventListener('click', (e) => { e.preventDefault(); ctx.scrollTo('#collagen'); });
    const noCoolBtn = root.querySelector('.mx-nocool');
    function setNoCool(on) {
      S.noCool = on; noCoolBtn?.setAttribute('aria-pressed', String(on));
      root.classList.toggle('mx-is-nocool', on); S.dirty = true;
      if (reduced) fire(false);
    }
    noCoolBtn?.addEventListener('click', () => { setNoCool(!S.noCool); S.userLock = false; if (S.phase === 'idle') S.autoWait = 0.2; });

    /* ---------- controls ---------- */
    const rLv = $('.mx-r-lv'), rP = $('.mx-r-p');
    const coolBtns = $$('.mx-cool button');
    const modeBtns = $$('.mx-mode button');
    const viewBtns = $$('.mx-view');
    function setMode(m) {
      if (S.mode === m) return;
      S.mode = m;
      modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
      root.classList.toggle('mx-is-bi', m === 'bi');
      root.querySelector('.mx-tobi') && (root.querySelector('.mx-tobi').textContent = m === 'bi' ? '← 回到单极' : '对比：双极射频 →');
      sim.reset(); S.phase = 'idle'; S.scope = [];
      seedParticles(true); setStatus(); S.dirty = true;
      if (reduced) { if (S.step >= 2) fire(false); else render(); }
    }
    modeBtns.forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.mode); S.userLock = true; }));
    function syncViews() {
      viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(!!S.view[b.dataset.v])));
    }
    viewBtns.forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.v; S.view[k] = !S.view[k]; syncViews(); S.dirty = true;
      if (k === 'flow' && S.view.flow && S.flowMode === 'rf' && S.phase === 'idle') { /* shows during RF */ }
      if (reduced) render();
    }));
    function updateParams(resetCool) {
      const dens = lib.density(S.lv, S.pulse), band = lib.bandOf(dens), ok = lib.isAllowed(S.lv, S.pulse);
      if (resetCool) S.cool = band.coolDefault; // device behaviour: power/pulse change → default cooling (IFU p.22)
      if (!band.coolRange.includes(S.cool)) S.cool = band.coolDefault;
      $('.mx-v-lv').textContent = S.lv.toFixed(1);
      $('.mx-v-w').textContent = lib.levelPower(S.lv);
      $('.mx-v-p').textContent = S.pulse.toFixed(1);
      $('.mx-v-n').textContent = Math.round(S.pulse * 10);
      $('.mx-v-coolhint').textContent = `默认 ${band.coolDefault}`;
      $('.mx-v-coolhint').title = `当前能量区间「${band.label}」可选制冷强度 ${band.coolRange[0]}–${band.coolRange[band.coolRange.length - 1]}（使用说明书 第 22 页）`;
      coolBtns.forEach((b) => {
        const c = +b.dataset.c; b.disabled = !band.coolRange.includes(c) || !ok;
        b.setAttribute('aria-pressed', String(c === S.cool));
      });
      const dv = $('.mx-dens__v'); dv.textContent = ok ? dens.toFixed(1) : '—';
      const chip = $('.mx-dens__band');
      chip.style.color = ok ? band.hex : 'var(--text-3)';
      chip.querySelector('span').textContent = ok ? band.label : '不在能量输出表内';
      fireBtn.disabled = !ok;
      fireBtn.querySelector('small').textContent = ok ? '模拟一个射频能量脉冲' : '该组合为能量输出表空白项';
      for (const r of [rLv, rP]) r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
      phaseEls[0].style.flexGrow = PRE; phaseEls[1].style.flexGrow = S.pulse; phaseEls[2].style.flexGrow = POST;
      phaseEls[1].querySelector('em').textContent = S.pulse.toFixed(1) + ' s';
    }
    rLv.addEventListener('input', () => { S.lv = +rLv.value; S.userLock = true; updateParams(true); });
    rP.addEventListener('input', () => { S.pulse = Math.round(+rP.value * 10) / 10; S.userLock = true; updateParams(true); if (S.phase === 'idle') S.scopeDur = 0; S.dirty = true; });
    coolBtns.forEach((b) => b.addEventListener('click', () => { S.cool = +b.dataset.c; S.userLock = true; updateParams(false); }));
    fireBtn.addEventListener('click', () => fire(true));

    /* ---------- probes: pointer + keyboard ---------- */
    function hitProbe(ev) {
      const r = canvas.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      let best = -1, bd = 26 * 26;
      probes.forEach((p, i) => { const d = (X(p.x) - x) ** 2 + (Y(p.y) - y) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    }
    function moveProbe(i, clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      probes[i].x = clamp((clientX - r.left - L.tx) / L.sx, 1, NX - 1);
      probes[i].y = clamp((clientY - r.top - L.ty) / L.sy, 0.6, NY - 1);
      S.dirty = true; if (reduced) render();
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (!L) return;
      const i = hitProbe(e); if (i < 0) return;
      S.dragging = i; canvas.setPointerCapture(e.pointerId); e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (S.dragging == null) { if (L) canvas.style.cursor = hitProbe(e) >= 0 ? 'grab' : ''; return; }
      canvas.style.cursor = 'grabbing';
      moveProbe(S.dragging, e.clientX, e.clientY);
    });
    const endDrag = () => { S.dragging = null; S.dirty = true; };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('touchstart', (e) => { if (L && e.touches.length === 1 && hitProbe(e.touches[0]) >= 0) e.preventDefault(); }, { passive: false });
    probeBtns.forEach((b) => b.addEventListener('keydown', (e) => {
      const i = +b.dataset.p, p = probes[i];
      const d = e.shiftKey ? 5 : 1.5;
      const k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
      if (!k) return;
      e.preventDefault(); p.x = clamp(p.x + k[0], 1, NX - 1); p.y = clamp(p.y + k[1], 0.6, NY - 1); S.dirty = true; if (reduced) render();
    }));

    /* ---------- loop ---------- */
    let frameNo = 0, lastUi = 0;
    let slow = 0;
    function tick(dt, t) {
      frameNo++; S.frameNo = frameNo;
      // adaptive quality: sustained slow frames → DPR 1, lighter bloom, fewer particles
      if (!S.lowQ) { slow = dt > 0.04 ? slow + 1 : Math.max(0, slow - 2); if (slow > 45) { S.lowQ = true; layout(); } }
      physicsStep(dt);
      const f = field();
      // eased view mixes
      const k = Math.min(1, dt * 5);
      const inRF = S.phase === 'rf';
      const flowTarget = !S.view.flow ? 0 : S.flowMode === 'osc' || S.flowMode === 'flow' ? 1 : inRF ? 1 : S.phase === 'pre' || S.phase === 'post' ? 0.15 : 0;
      S.flowAlpha += (flowTarget - S.flowAlpha) * k;
      S.equiAlpha += ((S.view.equi ? 1 : 0) - S.equiAlpha) * k;
      S.qAlpha += ((S.view.q ? (S.phase === 'idle' || S.phase === 'pre' ? 1 : 0.35) : 0) - S.qAlpha) * k;
      S.returnGlow += ((S.mode === 'mono' && (S.step === 1 || inRF) ? 1 : 0) - S.returnGlow) * k;
      // particles
      if (f && S.flowAlpha > 0.01 && S.flowMode !== 'osc') {
        for (let p = 0; p < NP; p++) { advect(f, p, dt * (inRF || S.flowMode === 'flow' ? 1 : 0.4)); if (dead(p)) spawn(f, p); }
      }
      // auto demo
      if (!S.userLock && STEP_AUTO[S.step] && S.phase === 'idle' && f) {
        S.autoWait -= dt;
        if (S.autoWait <= 0) { fire(false); S.autoWait = 1.4; }
      }
      draw(t);
      if (t - lastUi > 0.05) {
        lastUi = t;
        drawScope();
        probeBtns.forEach((b, i) => { const v = sim.sampleT(probes[i].x, probes[i].y); b.querySelector('b').textContent = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2); });
        const inShot = S.phase === 'pre' || S.phase === 'rf' || S.phase === 'post';
        elClock.textContent = inShot ? `t = ${S.shotT.toFixed(2)} s` : '';
        const pr = inShot ? clamp(S.shotT / (PRE + S.scopePulse + POST)) : S.phase === 'relax' ? 1 : 0;
        tlHead.style.left = (pr * 100).toFixed(2) + '%';
        tlHead.style.opacity = inShot ? 1 : 0;
        fireBtn.classList.toggle('is-firing', inShot);
        // frequency glyph
        let d = ''; for (let x = 0; x <= 40; x += 1) d += (x ? 'L' : 'M') + x + ' ' + (6 + Math.sin(x * 0.9 - t * (inRF ? 30 : 6)) * (inRF ? 4.5 : 2.5)).toFixed(2);
        freqPath.setAttribute('d', d);
        root.classList.toggle('mx-is-rf', inRF);
        setStatus();
      }
    }
    const STEP_AUTO = [false, false, true, true, true];
    function snapMix() {
      S.equiAlpha = S.view.equi ? 1 : 0; S.qAlpha = S.view.q ? 1 : 0; S.flowAlpha = 0; S.returnGlow = 0; S.spray = 0;
    }
    function render() { if (!L && !layout()) return; if (reduced) snapMix(); S.frameNo = ++frameNo; draw(0); drawScope(); probeBtns.forEach((b, i) => { const v = sim.sampleT(probes[i].x, probes[i].y); b.querySelector('b').textContent = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2); }); }

    /* ---------- pin / responsive ---------- */
    let pinST = null;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1000px) and (min-height: 740px)', () => {
      if (reduced) return;
      root.classList.add('mx-pinned');
      requestAnimationFrame(() => layout());
      pinST = ScrollTrigger.create({
        trigger: stage, start: 'top top', end: '+=230%', pin: true, pinSpacing: true, anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress;
          setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)), 'scroll');
          progBtns.forEach((b, k) => b.style.setProperty('--f', clamp(p * STEPS.length - k)));
        },
      });
      return () => { pinST?.kill(); pinST = null; root.classList.remove('mx-pinned'); progBtns.forEach((b) => b.style.removeProperty('--f')); requestAnimationFrame(() => layout()); };
    });

    const ro = new ResizeObserver(() => { layout(); if (reduced) render(); });
    ro.observe(cv); ro.observe(scopeC);

    // QA hook (non-enumerable, automated browsers only): lets headless screenshots fast-forward the simulation
    if (navigator.webdriver) Object.defineProperty(root, '__mx', { value: { S, sim, probes, fire, setStep, setMode, draw: (t) => draw(t), layout, advance(sec) { const n = Math.round(sec * 60); for (let k = 0; k < n; k++) { physicsStep(1 / 60); const f = field(); if (f && S.flowMode !== 'osc') for (let p = 0; p < NP; p++) { advect(f, p, 1 / 60); if (dead(p)) spawn(f, p); } } S.flowAlpha = S.phase === 'rf' || S.flowMode !== 'rf' ? 1 : 0; S.qAlpha = S.view.q ? 1 : 0; S.equiAlpha = S.view.equi ? 1 : 0; draw(performance.now() / 1000); drawScope(); } } });

    /* ---------- boot ---------- */
    S.spray = 0;
    updateParams(false);
    syncViews();
    setStep(0, 'init');
    layout();
    setStatus();
    setTimeout(solveChunk, 30);
    if (!reduced) lib.visibleLoop(stage, tick);
    else render();
  },
};
