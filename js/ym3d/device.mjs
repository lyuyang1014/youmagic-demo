// YM3D · device — procedural, product-render-grade models of the YOUMAGIC YM5 system
//   主机 YM5-G1 (console) · 治疗手具 YM5-H1 (handpiece) · 一次性使用治疗头端 YM5-TP4-900 (disposable tip)
//
// Contract (see README.md): ES module, NO imports, THREE (r170) injected, update(params) is a pure,
// deterministic function of params (no clocks / Math.random / rAF), no per-frame geometry allocation.
// Tiny helpers (clamp/ease/seg/rng) mirror stage.mjs 1:1 so this file stays import-free.
// Units: metres. +Y up, console front panel faces +Z, origin = floor centre under the tower.
// Proportions: IFU 600 × 480 × 1285 mm + IFU photos 图1/图2 + brochure renders → Ø620 disc base, tower 320 wide ×
// 420 deep (≈500 incl. the holstered handpiece), 1285 tall. Look follows the renders (device.webp / DA p1–2).
//
// ───────────────────────────────── createDevice(THREE, opts) ─────────────────────────────────
// opts: { detail:'high'|'low' ('high'), contactShadow:true, internals:true (exploded-view internals),
//         back:true (rear details), screenRes:1600 (UI canvas width; display aspect 1.48), castShadow:true,
//         studio:true (product materials use a built-in procedural HDR studio envMap; false → scene.environment),
//         envMap (explicit Texture override, or null), envViolet 1 (violet accent strip in the studio env) }
//   (the same studio/envMap/envViolet opts apply to createHandpiece / createTip)
// → { object3d, update(params), dispose(), parts, anchor(name, out?), anchorNames, handpiece, dims }
// update(params) — every field optional, missing → default (so the call is pure):
//   t            seconds (drives highlight pulse, float bob, firing UI, mist)                 0
//   turntable    rotation about Y, radians                                                  0
//   explode      0..1 exploded anatomy (base stays, rest lifts; shell → back, panel/screen/handpiece → front, tip separates,
//                internals 原理示意 revealed: chassis, RF module, PCB, R134a canister, lines)            0
//   screen       'logo' | 'treatment' | 'activate' | 'boot' | 'off'                         'logo'
//   screenValues { level 6.0, cooling 1, pulse 1.0, density (auto = (15+20·lv)·pulse/4; a level/pulse pair outside the
//                  IFU energy table (lib.js isAllowed) shows the grey '超出能量表 · 已锁定' readout instead), shots 586,
//                  shotsTotal 900, energyKJ 12.25, ohm 109, watt (auto = 15+20·lv),
//                  status 'done'|'ready'|'standby'|'firing', selected null|'level'|'cooling'|'pulse' (green, per IFU "M") }
//   rimGlow      0..1 violet rim light strip intensity                                      0.6
//   highlight    null | 'screen'|'handpiece'|'tip'|'base'|'badge'|'bracket'|'handles'|'panel'|'power'|'shell'|'cables'
//                → subtle violet fresnel pulse on that part                                  null
//   float        0..1 hover (lifts + bobs, contact shadow widens)                            0
//   tipInsert, enablePressed, electrodeGlow, cooling, buttonPress — forwarded to the holstered handpiece (1,0,0,0,null)
// parts: { root, float, turntable, base, shell, shellMesh, rim, front, panel, spill, bracket, badge, screen, display,
//   screenDisc, power, handpiece (group), handpieceParts, tip, cableA, cables[], internals, shadow, screenCanvas }
// anchor(name, out?) → world Vector3 (call after update; pass `out` to avoid allocation). names: see anchorNames
//   screen, power, bracket, handpiece, enable, controls, tip, electrode, badge, cables, rim, rimLeft, handle, handleRight,
//   shell, top, panel, base, caster, back, cryogen, io, internals, rf
//
// ─────────────────────────────── createHandpiece(THREE, opts) ────────────────────────────────
// Handpiece alone, close-up quality. Local frame: axis +Y, tip end up, y=0 = tip interface, 使能按钮 faces +Z,
// control cluster ([R] + [− M +]) faces −Z near the cable end, tip latch / slot key on −X.
// opts: { detail:'high', cable:true (trailing cable), tip:true }
// → { object3d, update(params), dispose(), parts, anchor(name,out?), anchorNames, tip }
// update(params):
//   t 0 · tipInsert 0..1 (1) — tip rotates into key alignment, slides along the axis, clicks in with a tiny overshoot
//   enablePressed 0..1 (0) · buttonPress null|'R'|'M'|'minus'|'plus' · buttonPressAmount 0..1 (1)
//   electrodeGlow 0..1 (0) RF firing glow on the gold face · cooling 0..1 (0) frost + cool mist on the face
//   highlight null|'enable'|'controls'|'tip'|'electrode'|'body'
// anchors: tip, electrode, window, enable, controls, R, M, minus, plus, waist, tail, latch, cable
//
// ──────────────────────────────── createTip(THREE, opts) ─────────────────────────────────────
// Disposable tip YM5-TP4-900 alone: glossy black rounded-square cap, 2.0 × 2.0 cm (4.0 cm²) gold/copper
// polyimide electrode with etched pattern, side key window (inserts one way only). Local: axis +Y, face at y=0.030.
// → { object3d, update({ t, electrodeGlow, cooling, spin }), dispose(), parts, anchor, anchorNames }

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const seg = (t, a, b, e = easeInOut) => e(clamp((t - a) / Math.max(1e-6, b - a)));
/** update() hardening: reused scratch copy of params with NaN / ±Infinity numbers → undefined (defaults apply) */
function finiteParams(src, dst) {
  for (const k in dst) dst[k] = undefined;
  if (src) for (const k in src) { const v = src[k]; dst[k] = typeof v === 'number' && !Number.isFinite(v) ? undefined : v; }
  return dst;
}
function rng(seed = 1) { // mulberry32 (identical to stage.mjs)
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const COL = {
  violet: 0x8a5cf0, rim: 0x6a4896, badge: 0x4d2673, navy: 0x1e222d, mint: 0x43e6a8, cool: 0x7fd4ff,
  lv: ['#3fbf7f', '#f2a44b', '#e27ab8', '#b0283e'],
};

/* ═══════════════════════════════ dimensions ═══════════════════════════════ */
const DIM = (() => {
  const d = { W: 0.32, D: 0.42, H: 1.285, R: 0.16, yTop: 1.125, yBot: 0.33, lipW: 0.014, lipRo: 0.0105, lipRi: 0.003, recess: 0.026, fil: 0.004 };
  d.zf = d.D / 2; d.zP = d.zf - d.recess; d.Rp = d.R - d.lipW - d.fil; // panel radius
  d.Rs = d.R - d.lipW - 0.0045; // screen disc radius
  d.screenT = 0.007;
  d.kx = d.Rp / 0.156; // front-panel layout below is authored for a 0.156 half-width panel and scaled
  const X = (v) => v * d.kx;
  d.display = [2 * d.Rs * 0.8, 2 * d.Rs * 0.8 / 1.48];
  d.power = [0, 0.912];
  d.bracket = { cx: X(0.003), cy: 0.834, w: X(0.282), h: 0.052, depth: 0.044, bevel: 0.0055 };
  d.bracketFront = d.zP + 2 * d.bracket.bevel + d.bracket.depth; // z of bracket front face
  d.hp = [X(-0.1), 0.891, d.bracketFront + 0.0255];
  d.acc = [X(0.108), 0.849]; d.glands = [X(-0.03), X(0.058)]; // handpiece origin (tip interface) in holster
  d.badge = { y: 0.29, r: X(0.075), face: d.zP + 0.032, t: 0.011 };
  d.handleY = 1.08;
  d.hpScale = 1.1; // brochure renders show the holstered handpiece ≈ 0.9 × panel width
  return d;
})();

/* ═══════════════════════════════ small utilities ═══════════════════════════════ */
function registry() {
  const geos = new Set(), mats = new Set(), texs = new Set();
  return {
    g(x) { geos.add(x); return x; }, m(x) { mats.add(x); return x; }, t(x) { texs.add(x); return x; },
    dispose() { geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose()); geos.clear(); mats.clear(); texs.clear(); },
  };
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(THREE, reg, c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return reg.t(t);
}
// monotone cubic interpolation (no overshoot) → f(x)
function pchip(pairs) {
  const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]), n = xs.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
// flip triangle winding if it disagrees with the supplied vertex normals
function orient(geo) {
  const idx = geo.index.array, p = geo.attributes.position.array, n = geo.attributes.normal.array;
  let sum = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    sum += fx * (n[a] + n[b] + n[c]) + fy * (n[a + 1] + n[b + 1] + n[c + 1]) + fz * (n[a + 2] + n[b + 2] + n[c + 2]);
  }
  if (sum < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.index.needsUpdate = true; }
  return geo;
}
function indexed(THREE, pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
  return g;
}

/* ─── stadium loop (front-view pill outline), clockwise from top centre ─── */
function stadiumLoop(R, yTop, yBot, nArc = 64, nStr = 10) {
  const pts = [];
  const P = (x, y, nx, ny) => pts.push({ x, y, nx, ny, s: 0 });
  const arc = (cy, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P(R * Math.cos(a), cy + R * Math.sin(a), Math.cos(a), Math.sin(a)); } };
  const line = (x, y0, y1, n, nx) => { for (let i = 1; i < n; i++) P(x, y0 + (y1 - y0) * i / n, nx, 0); };
  const q = nArc >> 1;
  arc(yTop, Math.PI / 2, 0, q); line(R, yTop, yBot, nStr, 1);
  arc(yBot, 0, -Math.PI, nArc); line(-R, yBot, yTop, nStr, -1);
  arc(yTop, Math.PI, Math.PI / 2, q);
  let s = 0; for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); pts[i].s = s; }
  return pts;
}
/* ─── cross-section profile builder (u = outward offset from the loop, z = depth) ─── */
function profile() {
  const p = [];
  const api = {
    pt(u, z, nu, nz) { p.push({ u, z, nu, nz, v: 0 }); return api; },
    arc(cu, cz, r, a0, a1, n, concave = false) {
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, c = Math.cos(a), s = Math.sin(a); p.push({ u: cu + r * c, z: cz + r * s, nu: concave ? -c : c, nz: concave ? -s : s, v: 0 }); }
      return api;
    },
    done() { let v = 0; for (let i = 1; i < p.length; i++) { v += Math.hypot(p[i].u - p[i - 1].u, p[i].z - p[i - 1].z); p[i].v = v; } return p; },
  };
  return api;
}
function sweepGeometry(THREE, loop, prof, uvScale = [1, 1]) {
  const N = loop.length, M = prof.length;
  const pos = new Float32Array(N * M * 3), nor = new Float32Array(N * M * 3), uv = new Float32Array(N * M * 2);
  let k = 0, q = 0;
  for (let i = 0; i < N; i++) {
    const L = loop[i];
    for (let j = 0; j < M; j++) {
      const P = prof[j];
      pos[k] = L.x + L.nx * P.u; pos[k + 1] = L.y + L.ny * P.u; pos[k + 2] = P.z;
      const nl = Math.hypot(L.nx * P.nu, L.ny * P.nu, P.nz) || 1;
      nor[k] = L.nx * P.nu / nl; nor[k + 1] = L.ny * P.nu / nl; nor[k + 2] = P.nz / nl; k += 3;
      uv[q++] = L.s * uvScale[0]; uv[q++] = P.v * uvScale[1];
    }
  }
  const idx = [];
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < M - 1; j++) { const a = i * M + j, b = (i + 1) * M + j, c = b + 1, d = a + 1; idx.push(a, b, d, b, c, d); }
  return orient(indexed(THREE, pos, nor, uv, idx));
}

/* ─── tube with parallel-transport frames; set() refills in place (no allocation) ─── */
function makeTube(THREE, n, radial, { rx = 0.003, ry = rx, sq = 2, up = [0, 0, 1], dynamic = false } = {}) {
  const R1 = radial + 1, V = (n + 1) * R1;
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= radial; j++) { uv[(i * R1 + j) * 2] = i / n; uv[(i * R1 + j) * 2 + 1] = j / radial; }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * R1 + j, b = (i + 1) * R1 + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const cs = []; const e = 2 / sq;
  for (let j = 0; j <= radial; j++) {
    const th = (j / radial) * TAU, c = Math.cos(th), s = Math.sin(th);
    const sp = (v, k) => Math.sign(v) * Math.pow(Math.abs(v), k);
    let nx = sp(c, 2 - e) / rx, ny = sp(s, 2 - e) / ry; const l = Math.hypot(nx, ny) || 1;
    cs.push([rx * sp(c, e), ry * sp(s, e), nx / l, ny / l]);
  }
  const geo = indexed(THREE, pos, nor, uv, idx);
  if (dynamic) { geo.attributes.position.setUsage(THREE.DynamicDrawUsage); geo.attributes.normal.setUsage(THREE.DynamicDrawUsage); }
  let flipChecked = false;
  function set(P) { // P: array of n+1 {x,y,z}
    let Nx = 0, Ny = 0, Nz = 0;
    for (let i = 0; i <= n; i++) {
      const A = P[Math.max(0, i - 1)], B = P[Math.min(n, i + 1)];
      let tx = B.x - A.x, ty = B.y - A.y, tz = B.z - A.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      if (i === 0) { Nx = up[0]; Ny = up[1]; Nz = up[2]; let d = Nx * tx + Ny * ty + Nz * tz; if (Math.abs(d) > 0.95) { Nx = 1; Ny = 0; Nz = 0; d = tx; } Nx -= tx * d; Ny -= ty * d; Nz -= tz * d; }
      else { const d = Nx * tx + Ny * ty + Nz * tz; Nx -= tx * d; Ny -= ty * d; Nz -= tz * d; }
      const nl = Math.hypot(Nx, Ny, Nz) || 1; Nx /= nl; Ny /= nl; Nz /= nl;
      const Bx = ty * Nz - tz * Ny, By = tz * Nx - tx * Nz, Bz = tx * Ny - ty * Nx;
      const p = P[i];
      for (let j = 0; j <= radial; j++) {
        const [a, b, na, nb] = cs[j], k = (i * R1 + j) * 3;
        pos[k] = p.x + Nx * a + Bx * b; pos[k + 1] = p.y + Ny * a + By * b; pos[k + 2] = p.z + Nz * a + Bz * b;
        nor[k] = Nx * na + Bx * nb; nor[k + 1] = Ny * na + By * nb; nor[k + 2] = Nz * na + Bz * nb;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
    if (!flipChecked) { orient(geo); flipChecked = true; }
    geo.computeBoundingSphere();
  }
  return { geometry: geo, set };
}
function curvePoints(THREE, pts, n, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension);
  const out = []; for (let i = 0; i <= n; i++) out.push(c.getPoint(i / n)); return out;
}
function staticTube(THREE, reg, pts, n, radial, opts) { const t = makeTube(THREE, n, radial, opts); t.set(curvePoints(THREE, pts, n)); return reg.g(t.geometry); }

/* ─── lathe helper (points = [[r, y], …] bottom→top, outward normals) ─── */
function lathe(THREE, reg, pts, seg = 64, phiStart = 0, phiLen = TAU) {
  return reg.g(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg, phiStart, phiLen));
}
function roundRectShape(THREE, w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function stadiumShape(THREE, R, yTop, yBot) {
  const s = new THREE.Shape(); s.moveTo(R, yBot); s.lineTo(R, yTop); s.absarc(0, yTop, R, 0, Math.PI, false);
  s.lineTo(-R, yBot); s.absarc(0, yBot, R, Math.PI, TAU, false); return s;
}

/* ─── conformal raised pad (button) hugging a lathe body r(y); phi=0 → +Z ─── */
function padGeometry(THREE, reg, rOf, { yc, phi = 0, halfLen, halfW, height, edge, nA = 56, crown = 0.15, sink = 0.00035 }) {
  const a = Math.max(0, halfLen - halfW), round = a < 1e-6;
  const nArc = round ? nA / 2 : Math.round(nA * 0.3), nS = round ? 0 : Math.round(nA * 0.2), nK = 2 * (nArc + nS);
  const ds = [0, 0.05, 0.14, 0.27, 0.43, 0.6, 0.8, 1].map((f) => f * edge);
  for (let k = 1; k <= 3; k++) ds.push(edge + (halfW * 0.985 - edge) * k / 3);
  const outline = (k, rho) => {
    if (k < nArc) { const al = (k / nArc) * Math.PI; return [rho * Math.cos(al), a + rho * Math.sin(al)]; }
    k -= nArc; if (k < nS) return [-rho, a - 2 * a * k / nS];
    k -= nS; if (k < nArc) { const al = Math.PI + (k / nArc) * Math.PI; return [rho * Math.cos(al), -a + rho * Math.sin(al)]; }
    k -= nArc; return [rho, -a + 2 * a * k / nS];
  };
  const V = ds.length * nK, pos = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = [];
  let q = 0;
  for (let r = 0; r < ds.length; r++) {
    const d = ds[r], rho = halfW - d;
    const hgt = r === 0 ? -sink : d < edge ? height * Math.sqrt(1 - Math.pow(1 - d / edge, 2)) : height * (1 + crown * (d - edge) / Math.max(1e-6, halfW - edge));
    for (let k = 0; k < nK; k++) {
      const [w, yl] = outline(k, rho), y = yc + yl, rr = rOf(y), ang = phi + w / rr, rad = rr + hgt;
      pos[q * 3] = rad * Math.sin(ang); pos[q * 3 + 1] = y; pos[q * 3 + 2] = rad * Math.cos(ang);
      uv[q * 2] = (w + halfW) / (2 * halfW); uv[q * 2 + 1] = (yl + halfLen) / (2 * halfLen); q++;
    }
  }
  for (let r = 0; r < ds.length - 1; r++) for (let k = 0; k < nK; k++) {
    const a0 = r * nK + k, b0 = (r + 1) * nK + k, a1 = r * nK + (k + 1) % nK, b1 = (r + 1) * nK + (k + 1) % nK; idx.push(a0, b0, a1, b0, b1, a1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the dome faces outward (radial direction at pad centre)
  const n = g.attributes.normal.array, c = ((ds.length - 2) * nK) * 3; const dot = n[c] * Math.sin(phi) + n[c + 2] * Math.cos(phi);
  if (dot < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return reg.g(g);
}

/* ─── rounded-square ring stack (tip cap) ─── */
function roundedSquareStack(THREE, reg, rows, { a0, rc0, nC = 8 }) {
  const ringN = 4 * (nC + 1) + 1, V = rows.length * ringN;
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = [];
  const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  let q = 0;
  for (let i = 0; i < rows.length; i++) {
    const [y, a] = rows[i]; const rc = Math.max(0.0008, rc0 - (a0 - a)), c = a - rc;
    const A = rows[Math.max(0, i - 1)], B = rows[Math.min(rows.length - 1, i + 1)];
    let dy = B[0] - A[0], da = B[1] - A[1]; const l = Math.hypot(dy, da) || 1; const cr = dy / l, sy = -da / l;
    let s = 0, px0 = null, pz0 = null;
    for (let k = 0; k < ringN; k++) {
      const kk = k === ringN - 1 ? 0 : k, corner = Math.floor(kk / (nC + 1)), j = kk % (nC + 1);
      const al = corner * Math.PI / 2 + (j / nC) * Math.PI / 2, ca = Math.cos(al), sa = Math.sin(al);
      const px = C[corner][0] * c + rc * ca, pz = C[corner][1] * c + rc * sa;
      if (px0 !== null) s += Math.hypot(px - px0, pz - pz0); px0 = px; pz0 = pz;
      pos[q * 3] = px; pos[q * 3 + 1] = y; pos[q * 3 + 2] = pz;
      nor[q * 3] = ca * cr; nor[q * 3 + 1] = sy; nor[q * 3 + 2] = sa * cr;
      uv[q * 2] = s * 20; uv[q * 2 + 1] = y * 20; q++;
    }
  }
  for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < ringN - 1; k++) { const a = i * ringN + k, b = (i + 1) * ringN + k; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return reg.g(orient(indexed(THREE, pos, nor, uv, idx)));
}
function roundedSquareShape(THREE, a, rc) { return roundRectShape(THREE, 2 * a, 2 * a, rc); }

/* ═══════════════════════════════ 2D canvas art ═══════════════════════════════ */
const FONT_CN = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
const FONT_NUM = '"Helvetica Neue","Avenir Next","PingFang SC",Arial,sans-serif';
const WM = [['Y', 0.9], ['O', 1.0], ['U', 0.84], ['M', 1.1], ['A', 1.02], ['G', 1.0], ['I', 0], ['C', 0.94]];
function wordmarkWidth(H, weight = 0.085, tracking = 0.26) { let w = 0; WM.forEach(([, a], i) => { w += (a || weight) * H + (i ? tracking * H : 0); }); return w; }
/** YŌUMAGIC geometric wordmark drawn with strokes (font-independent → deterministic, crisp at any size) */
function drawWordmark(g, cx, cy, H, color = '#fff', weight = 0.085, tracking = 0.26, align = 'center') {
  const w = H * weight, i = w / 2, total = wordmarkWidth(H, weight, tracking);
  let x = align === 'left' ? cx : cx - total / 2; const y = cy - H / 2;
  g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'miter'; g.miterLimit = 2.2;
  for (const [ch, adv] of WM) {
    const W = (adv || weight) * H; g.beginPath();
    switch (ch) {
      case 'Y': g.moveTo(x + i, y); g.lineTo(x + W / 2, y + 0.5 * H); g.lineTo(x + W - i, y); g.moveTo(x + W / 2, y + 0.5 * H); g.lineTo(x + W / 2, y + H); break;
      case 'O': g.arc(x + W / 2, y + H / 2, H / 2 - i, 0, TAU); g.moveTo(x + W / 2 - 0.27 * H, y - 0.2 * H); g.lineTo(x + W / 2 + 0.27 * H, y - 0.2 * H); break;
      case 'U': g.moveTo(x + i, y); g.lineTo(x + i, y + H - W / 2); g.arc(x + W / 2, y + H - W / 2, W / 2 - i, Math.PI, 0, true); g.lineTo(x + W - i, y); break;
      case 'M': g.moveTo(x + i, y + H); g.lineTo(x + i, y + i * 0.5); g.lineTo(x + W / 2, y + 0.82 * H); g.lineTo(x + W - i, y + i * 0.5); g.lineTo(x + W - i, y + H); break;
      case 'A': { g.moveTo(x + i * 0.4, y + H); g.lineTo(x + W / 2, y + i * 0.3); g.lineTo(x + W - i * 0.4, y + H); const f = 0.68, xl = x + (W / 2) * (1 - f) + i * 0.4, xr = x + W - (W / 2) * (1 - f) - i * 0.4; g.moveTo(xl, y + f * H); g.lineTo(xr, y + f * H); break; }
      case 'G': g.arc(x + W / 2, y + H / 2, H / 2 - i, -0.29 * Math.PI, 0, true); g.lineTo(x + W / 2 + 0.02 * H, y + H / 2); break;
      case 'I': g.moveTo(x + W / 2, y); g.lineTo(x + W / 2, y + H); break;
      case 'C': g.arc(x + W / 2, y + H / 2, H / 2 - i, -0.29 * Math.PI, 0.29 * Math.PI, true); break;
    }
    g.stroke(); x += W + tracking * H;
  }
  g.restore();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function gearIcon(g, cx, cy, r, color) {
  g.save(); g.strokeStyle = color; g.lineWidth = r * 0.16; g.beginPath();
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * TAU, tooth = (Math.floor(k / 3) % 2) ? 1 : 0.8; const rr0 = r * tooth; const x = cx + rr0 * Math.cos(a), y = cy + rr0 * Math.sin(a); k ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.36, 0, TAU); g.stroke(); g.restore();
}
function uiBackground(g, W, H) {
  const bg = g.createLinearGradient(0, 0, W * 0.3, H); bg.addColorStop(0, '#262d39'); bg.addColorStop(1, '#191d25');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.035; g.fillStyle = '#fff';
  for (const [x0, w] of [[0.18, 0.1], [0.46, 0.05], [0.62, 0.14]]) { g.beginPath(); g.moveTo(W * x0, 0); g.lineTo(W * (x0 + w), 0); g.lineTo(W * (x0 + w - 0.22), H); g.lineTo(W * (x0 - 0.22), H); g.closePath(); g.fill(); }
  g.restore();
}
function drawHaloTip(g, cx, cy, R, glow = 0, t = 0) {
  const rg = g.createRadialGradient(cx - R * 0.15, cy - R * 0.25, R * 0.05, cx, cy, R);
  rg.addColorStop(0, 'rgba(92,112,140,0.55)'); rg.addColorStop(0.6, 'rgba(46,58,76,0.5)'); rg.addColorStop(1, 'rgba(30,37,48,0.05)');
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(150,175,205,0.22)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * 0.985, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(150,175,205,0.08)'; g.beginPath(); g.arc(cx, cy, R * 0.8, 0, TAU); g.stroke();
  if (glow > 0) {
    g.save(); g.strokeStyle = `rgba(67,230,168,${0.25 + 0.55 * glow})`; g.lineWidth = 6; g.shadowColor = '#43e6a8'; g.shadowBlur = 28;
    g.beginPath(); g.arc(cx, cy, R * 0.985, -Math.PI / 2, -Math.PI / 2 + TAU * ((t * 0.9) % 1 || 1)); g.stroke(); g.restore();
  }
  // isometric tip block (blue translucent cap + gold electrode face), as in IFU 图7/图8
  g.save(); g.translate(cx, cy + R * 0.05); g.rotate(-0.5);
  const w = R * 0.62, h = R * 0.56, d = R * 0.2;
  const body = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); body.addColorStop(0, 'rgba(120,170,235,0.95)'); body.addColorStop(0.5, 'rgba(52,98,168,0.95)'); body.addColorStop(1, 'rgba(26,52,98,0.95)');
  g.fillStyle = 'rgba(90,140,210,0.9)'; g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(-w / 2 + d, -h / 2 - d * 0.7); g.lineTo(w / 2 + d, -h / 2 - d * 0.7); g.lineTo(w / 2, -h / 2); g.closePath(); g.fill();
  g.fillStyle = body; rr(g, -w / 2, -h / 2, w, h, R * 0.08); g.fill();
  g.strokeStyle = 'rgba(200,225,255,0.35)'; g.lineWidth = 2; rr(g, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, R * 0.06); g.stroke();
  const gold = g.createLinearGradient(w / 2, -h / 2, w / 2 + d, h / 2); gold.addColorStop(0, '#f6d58a'); gold.addColorStop(0.5, '#b8812e'); gold.addColorStop(1, '#e9bf6a');
  g.fillStyle = gold; g.beginPath(); g.moveTo(w / 2, -h / 2); g.lineTo(w / 2 + d, -h / 2 - d * 0.7); g.lineTo(w / 2 + d, h / 2 - d * 0.7); g.lineTo(w / 2, h / 2); g.closePath(); g.fill();
  g.fillStyle = 'rgba(60,34,8,0.85)'; g.beginPath(); g.moveTo(w / 2 + d * 0.22, -h / 2 + h * 0.12); g.lineTo(w / 2 + d * 0.78, -h / 2 + h * 0.12 - d * 0.55); g.lineTo(w / 2 + d * 0.78, h / 2 - h * 0.12 - d * 0.55); g.lineTo(w / 2 + d * 0.22, h / 2 - h * 0.12); g.closePath(); g.fill();
  if (glow > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,180,90,${0.6 * glow})`; g.fill(); }
  g.restore();
}
function drawQR(g, x, y, S, seed = 0x5a11) {
  const n = 25, m = S / n, r = rng(seed);
  g.fillStyle = '#f4f6f8'; g.fillRect(x - m, y - m, S + 2 * m, S + 2 * m); g.fillStyle = '#10141a';
  const finder = (i, j) => (i >= 0 && i < 7 && j >= 0 && j < 7) ? ((i === 0 || i === 6 || j === 0 || j === 6) || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) : null;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    let on = finder(i, j) ?? finder(i, j - (n - 7)) ?? finder(i - (n - 7), j);
    const inF = (i < 8 && j < 8) || (i < 8 && j >= n - 8) || (i >= n - 8 && j < 8);
    if (on === null) on = inF ? false : (i === 6 || j === 6) ? ((i + j) % 2 === 0) : r() < 0.48;
    if (on) g.fillRect(x + j * m, y + i * m, m + 0.5, m + 0.5);
  }
}
function bandOf(e) { return e <= 16.3 ? 0 : e <= 23.8 ? 1 : e <= 31.3 ? 2 : 3; }
const SV_DEF = { level: 6.0, cooling: 1, pulse: 1.0, density: null, shots: 586, shotsTotal: 900, energyKJ: 12.25, ohm: 109, watt: null, status: 'done', selected: null };
function drawScreen(g, W, H, state, sv, t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const S = W / 1600; // layout designed at 1600×1000
  if (state === 'off') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
  if (state === 'boot') {
    g.fillStyle = '#030305'; g.fillRect(0, 0, W, H); drawWordmark(g, W / 2, H * 0.45, 92 * S, '#f2f4f7', 0.07);
    g.fillStyle = '#8b93a1'; g.font = `300 ${24 * S}px ${FONT_CN}`; g.fillText('发布版本：V1', W / 2, H * 0.84); g.fillText('系统自检中…', W / 2, H * 0.89); return;
  }
  if (state === 'logo') {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#29303b'); bg.addColorStop(1, '#1d222b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    drawWordmark(g, W / 2, H * 0.515, 132 * S, '#f5f7fa', 0.075, 0.27); return;
  }
  uiBackground(g, W, H);
  g.translate(0, (H - 1000 * S) / 2); // layout authored at 1600×1000, centred vertically
  drawWordmark(g, 40 * S, 48 * S, 30 * S, '#dfe5ee', 0.085, 0.27, 'left');
  gearIcon(g, W - 58 * S, 50 * S, 20 * S, '#aeb8c6');
  const lbl = (txt, x, y, col = '#98a3b3', size = 25) => { g.fillStyle = col; g.font = `400 ${size * S}px ${FONT_CN}`; g.fillText(txt, x * S, y * S); };
  const num = (txt, x, y, col = '#eef2f8', size = 46) => { g.fillStyle = col; g.font = `300 ${size * S}px ${FONT_NUM}`; g.fillText(txt, x * S, y * S); };
  if (state === 'activate') {
    g.fillStyle = '#4b5667'; rr(g, 372 * S, 128 * S, 80 * S, 6 * S, 3 * S); g.fill();
    g.fillStyle = '#e8edf5'; g.font = `300 ${48 * S}px ${FONT_CN}`; g.fillText('请激活治疗头', 412 * S, 214 * S);
    lbl('请输入激活码', 412, 300, '#aab4c3', 27);
    drawHaloTip(g, 412 * S, 690 * S, 225 * S, 0, t);
    drawQR(g, 955 * S, 180 * S, 225 * S);
    g.textAlign = 'left'; lbl('型号  YM5-TP4-900', 1215, 232, '#c7cfdb', 26); lbl('发数  900', 1215, 296, '#c7cfdb', 26); lbl('日期  20220425', 1215, 360, '#c7cfdb', 26); g.textAlign = 'center';
    g.fillStyle = '#d9dee6'; rr(g, 955 * S, 552 * S, 215 * S, 60 * S, 6 * S); g.fill();
    const key = (x, y, w, h, txt, fill = '#3f6b93') => { g.fillStyle = fill; rr(g, x * S, y * S, w * S, h * S, 7 * S); g.fill(); g.fillStyle = '#eef4fb'; g.font = `400 ${28 * S}px ${FONT_CN}`; g.fillText(txt, (x + w / 2) * S, (y + h / 2 + 1) * S); };
    key(1215, 552, 215, 60, '删除', '#4a78a3');
    const xs = [955, 1050, 1145, 1240, 1335]; ['5', '6', '7', '8', '9'].forEach((k, i) => key(xs[i], 650, 80, 72, k)); ['0', '1', '2', '3', '4'].forEach((k, i) => key(xs[i], 745, 80, 72, k));
    key(955, 855, 215, 64, '取消', '#4a78a3'); key(1215, 855, 215, 64, '确认', '#4a78a3');
    return;
  }
  // treatment (IFU 图8)
  const lv = sv.level, pulse = sv.pulse, watt = sv.watt ?? (15 + 20 * lv), dens = sv.density ?? Math.round(((15 + 20 * lv) * pulse / 4) * 10 + 1e-9) / 10;
  const st = { done: ['治疗完成', '请开始下一次治疗'], ready: ['准备就绪', ''], standby: ['预备', ''], firing: ['输出中', '能量输出中…，请保持静止'] }[sv.status] || ['治疗完成', '请开始下一次治疗'];
  g.fillStyle = '#4b5667'; rr(g, 372 * S, 128 * S, 80 * S, 6 * S, 3 * S); g.fill();
  g.fillStyle = sv.status === 'firing' ? '#7ff0c4' : '#e8edf5'; g.font = `300 ${50 * S}px ${FONT_CN}`; g.fillText(st[0], 412 * S, 214 * S);
  if (st[1]) lbl(st[1], 412, 300, '#aab4c3', 27);
  const firing = sv.status === 'firing' ? 1 : 0;
  drawHaloTip(g, 412 * S, 690 * S, 225 * S, firing, t);
  lbl('治疗发数', 958, 196); lbl('累计能量(KJ)', 1258, 196); lbl('阻值(Ω)', 958, 345); lbl('功率(W)', 1258, 345);
  num(`${sv.shots} / ${sv.shotsTotal}`, 958, 262); num(Number(sv.energyKJ).toFixed(2), 1258, 262); num(String(sv.ohm), 958, 410); num(String(Math.round(watt)), 1258, 410);
  const cols = [[1008, '功率档位', lv.toFixed(1), 'level'], [1205, '制冷强度', String(sv.cooling), 'cooling'], [1402, '脉冲时间', pulse.toFixed(1), 'pulse']];
  for (const [x, l, v, k] of cols) {
    const sel = sv.selected === k, c = sel ? '#43e6a8' : null;
    for (const [yy, sym] of [[612, '+'], [872, '−']]) {
      const gr = g.createLinearGradient(0, (yy - 34) * S, 0, (yy + 34) * S); gr.addColorStop(0, '#7cc0ea'); gr.addColorStop(1, '#4b8fc2');
      g.fillStyle = gr; g.beginPath(); g.arc(x * S, yy * S, 34 * S, 0, TAU); g.fill();
      g.strokeStyle = '#f4f8fc'; g.lineWidth = 5 * S; g.beginPath(); g.moveTo((x - 13) * S, yy * S); g.lineTo((x + 13) * S, yy * S);
      if (sym === '+') { g.moveTo(x * S, (yy - 13) * S); g.lineTo(x * S, (yy + 13) * S); } g.stroke();
    }
    lbl(l, x, 708, c || '#98a3b3', 24); num(v, x, 770, c || '#eef2f8', 42);
  }
  // lib.js isAllowed(): a (level, pulse) pair outside the IFU energy table is locked by the device — never show it as a valid band
  const onGrid = Math.abs(lv * 2 - Math.round(lv * 2)) < 1e-6 && lv >= 0.5 - 1e-9 && lv <= 8 + 1e-9 && Math.abs(pulse * 10 - Math.round(pulse * 10)) < 1e-6 && pulse >= 0.7 - 1e-9 && pulse <= 1.5 + 1e-9;
  const allowed = sv.density != null || (onGrid && pulse + 1e-9 >= ({ 0.5: 1.0, 1: 0.9, 1.5: 0.8 }[lv] ?? 0.7) && dens <= 38.8 + 1e-9);
  const band = bandOf(dens), bc = allowed ? COL.lv[band] : '#6b7280';
  g.fillStyle = 'rgba(255,255,255,0.05)'; rr(g, 690 * S, 836 * S, 250 * S, 118 * S, 59 * S); g.fill();
  g.strokeStyle = bc; g.globalAlpha = 0.85; g.lineWidth = 3 * S; rr(g, 690 * S, 836 * S, 250 * S, 118 * S, 59 * S); g.stroke(); g.globalAlpha = 1;
  lbl(allowed ? '能量密度目标(J/cm²)' : '超出能量表 · 已锁定', 815, 872, allowed ? '#98a3b3' : '#c9a0a8', 19); num(allowed ? dens.toFixed(1) : '— —', 815, 922, allowed ? '#f3f6fa' : '#8a93a3', 40);
  g.fillStyle = bc; g.beginPath(); g.arc(716 * S, 922 * S, 7 * S, 0, TAU); g.fill();
}

/* ─── textures ─── */
function makeTextures(THREE, reg) {
  const T = {};
  { // brushed aluminium roughness (streaks along canvas X = along the perimeter)
    const c = canvas(1024, 512), g = c.getContext('2d'), r = rng(7);
    g.fillStyle = 'rgb(236,236,236)'; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 6000; i++) { const y = r() * 512, x = r() * 1024, l = 40 + r() * 700, v = 185 + (r() * 70) | 0; g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = 0.6 + r() * 0.9; g.beginPath(); g.moveTo(x - l / 2, y); g.lineTo(x + l / 2, y); g.stroke(); }
    T.brushed = canvasTex(THREE, reg, c, { srgb: false, repeat: true });
  }
  { // soft round contact shadow
    const c = canvas(256, 256), g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0.78)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); T.shadow = canvasTex(THREE, reg, c);
  }
  { // 1-D falloff (bright at v=0) for rim-light spill ribbons
    const c = canvas(4, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.12, '#9a9a9a'); gr.addColorStop(0.4, '#303030'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128); T.falloff = canvasTex(THREE, reg, c, { srgb: false });
  }
  { // radial glow
    const c = canvas(256, 256), g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); T.glow = canvasTex(THREE, reg, c);
  }
  { // soft puff (mist)
    const c = canvas(128, 128), g = c.getContext('2d'), r = rng(31);
    for (let i = 0; i < 9; i++) { const x = 40 + r() * 48, y = 40 + r() * 48, rad = 22 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    T.puff = canvasTex(THREE, reg, c);
  }
  { // badge face: violet disc + wordmark
    const S = 1024, c = canvas(S, S), g = c.getContext('2d');
    const gr = g.createRadialGradient(S * 0.42, S * 0.36, S * 0.05, S / 2, S / 2, S * 0.52); gr.addColorStop(0, '#6a3aa6'); gr.addColorStop(0.55, '#522a85'); gr.addColorStop(1, '#3d1f66');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 6; g.beginPath(); g.arc(S / 2, S / 2, S * 0.47, 0, TAU); g.stroke();
    drawWordmark(g, S / 2, S * 0.53, 64, '#f4f1fb', 0.08, 0.27);
    T.badge = canvasTex(THREE, reg, c);
  }
  { // power button icon
    const S = 256, c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#17191f'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#c9ced8'; g.lineCap = 'round'; g.lineWidth = 12; g.beginPath(); g.arc(S / 2, S / 2 + 6, 58, -Math.PI / 2 + 0.55, -Math.PI / 2 - 0.55 + TAU); g.stroke();
    g.beginPath(); g.moveTo(S / 2, S / 2 - 70); g.lineTo(S / 2, S / 2 - 8); g.stroke();
    g.strokeStyle = 'rgba(200,205,215,0.35)'; g.lineWidth = 4; g.beginPath(); g.arc(S / 2, S / 2, 118, 0, TAU); g.stroke();
    T.power = canvasTex(THREE, reg, c);
  }
  { // electrode: gold frame + amber polyimide + etched copper pad grid (4.0 cm² active square)
    const S = 1024, c = canvas(S, S), g = c.getContext('2d'), e = canvas(S, S), ge = e.getContext('2d');
    const gold = g.createLinearGradient(0, 0, S, S); gold.addColorStop(0, '#f3d692'); gold.addColorStop(0.45, '#b98a38'); gold.addColorStop(0.7, '#e4bd6c'); gold.addColorStop(1, '#9c6d24');
    g.fillStyle = gold; g.fillRect(0, 0, S, S);
    // metalness (B) / roughness (G) map: frame + copper pads metallic, polyimide film glossy dielectric
    const mr = canvas(S, S), gm = mr.getContext('2d'); gm.fillStyle = 'rgb(0,80,255)'; gm.fillRect(0, 0, S, S);
    const m = 62; const am = g.createRadialGradient(S * 0.42, S * 0.38, 20, S / 2, S / 2, S * 0.72); am.addColorStop(0, '#9a5e1c'); am.addColorStop(0.6, '#6e3e0e'); am.addColorStop(1, '#4a2708');
    g.fillStyle = am; g.fillRect(m, m, S - 2 * m, S - 2 * m); gm.fillStyle = 'rgb(0,60,0)'; gm.fillRect(m, m, S - 2 * m, S - 2 * m);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
    const cell = 28, gap = 6, x0 = m + 40, n = Math.floor((S - 2 * x0) / cell);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = x0 + i * cell, y = x0 + j * cell;
      g.fillStyle = '#d58a4c'; g.fillRect(x, y, cell - gap, cell - gap);
      g.fillStyle = 'rgba(255,220,160,0.35)'; g.fillRect(x, y, cell - gap, 3);
      gm.fillStyle = 'rgb(0,95,235)'; gm.fillRect(x, y, cell - gap, cell - gap);
      ge.fillStyle = '#fff'; ge.fillRect(x + 1, y + 1, cell - gap - 2, cell - gap - 2);
    }
    g.strokeStyle = '#e8b06a'; g.lineWidth = 8; g.strokeRect(m + 20, m + 20, S - 2 * m - 40, S - 2 * m - 40);
    gm.strokeStyle = 'rgb(0,80,255)'; gm.lineWidth = 8; gm.strokeRect(m + 20, m + 20, S - 2 * m - 40, S - 2 * m - 40);
    ge.strokeStyle = '#fff'; ge.lineWidth = 8; ge.strokeRect(m + 20, m + 20, S - 2 * m - 40, S - 2 * m - 40);
    const sh = g.createLinearGradient(0, 0, S, S * 0.7); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(0.7, 'rgba(255,240,200,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.1)');
    g.fillStyle = sh; g.fillRect(0, 0, S, S);
    T.electrode = canvasTex(THREE, reg, c); T.electrodeE = canvasTex(THREE, reg, e); T.electrodeMR = canvasTex(THREE, reg, mr, { srgb: false });
  }
  { // frost crystals
    const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(99);
    for (let i = 0; i < 1500; i++) {
      const x = r() * S, y = r() * S, dx = Math.min(x, S - x, y, S - y) / (S / 2), a = (0.25 + 0.75 * (1 - dx)) * (0.3 + r() * 0.7);
      g.fillStyle = `rgba(255,255,255,${a * 0.8})`; g.beginPath(); g.arc(x, y, 0.8 + r() * 2.2, 0, TAU); g.fill();
      if (r() < 0.25) { g.strokeStyle = `rgba(235,248,255,${a * 0.6})`; g.lineWidth = 1; const an = r() * TAU, l = 6 + r() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke(); }
    }
    T.frost = canvasTex(THREE, reg, c);
  }
  { // square glow for firing electrode
    const S = 256, c = canvas(S, S), g = c.getContext('2d');
    g.shadowColor = '#fff'; g.shadowBlur = 40; g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.4);
    g.shadowBlur = 80; g.fillRect(S * 0.32, S * 0.32, S * 0.36, S * 0.36);
    T.squareGlow = canvasTex(THREE, reg, c);
  }
  { // tip key window (slot key)
    const c = canvas(128, 160), g = c.getContext('2d');
    g.fillStyle = '#060607'; g.fillRect(0, 0, 128, 160);
    g.strokeStyle = 'rgba(140,150,165,0.55)'; g.lineWidth = 5; g.strokeRect(22, 30, 84, 100);
    g.fillStyle = 'rgba(70,80,95,0.6)'; g.fillRect(36, 46, 56, 44);
    T.window = canvasTex(THREE, reg, c);
  }
  { // PCB for internals
    const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(5);
    g.fillStyle = '#141a1e'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(201,164,90,0.55)' : 'rgba(138,92,240,0.45)'; g.lineWidth = 2 + r() * 2; g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let k = 0; k < 3; k++) { if (r() < 0.5) x = r() * S; else y = r() * S; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(201,164,90,0.8)'; g.beginPath(); g.arc(r() * S, r() * S, 3 + r() * 3, 0, TAU); g.fill(); }
    T.pcb = canvasTex(THREE, reg, c);
  }
  return T;
}
function iconTex(THREE, reg, kind) {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#1b1d22'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#d7dbe2'; g.fillStyle = '#d7dbe2'; g.lineWidth = 16; g.lineCap = 'round';
  g.translate(S / 2, S / 2); g.rotate(-Math.PI / 2); // glyphs read upright with the handpiece lying tip-left
  if (kind === 'minus') { g.beginPath(); g.moveTo(-44, 0); g.lineTo(44, 0); g.stroke(); }
  else if (kind === 'plus') { g.beginPath(); g.moveTo(-44, 0); g.lineTo(44, 0); g.moveTo(0, -44); g.lineTo(0, 44); g.stroke(); }
  else { g.font = `600 ${kind === 'R' ? 130 : 120}px ${FONT_NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind, 0, 6); }
  return canvasTex(THREE, reg, c);
}

/* ─── product studio environment: procedural HDR equirect (half-float), auto-PMREM'd by three ───
   Big soft side boxes + overhead box + thin back rims + a violet accent, dark front/floor so front-facing
   gloss (screen, panel) stays clean. Deterministic; built once per factory call. */
function studioEnvTexture(THREE, reg, { violet = 1 } = {}) {
  const W = 512, H = 256, data = new Uint16Array(W * H * 4), toH = THREE.DataUtils.toHalfFloat;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  // [phiC, thetaC, halfW, halfH, soft, intensity, r, g, b, vGrad, hGrad]
  const PI = Math.PI;
  const boxes = [
    [0.93 * PI, 0.56, 0.27 * PI, 0.46, 0.2, 1.25, 1, 1, 1, 0.7, 0.55],   // left wall softbox (brighter at top & toward the front)
    [0.04 * PI, 0.56, 0.22 * PI, 0.46, 0.2, 0.85, 0.95, 0.97, 1.0, 0.7, -0.55], // right wall softbox
    [0.5 * PI, 0.62, 0.1 * PI, 0.16, 0.1, 0.55, 1, 1, 1, 0],         // upper front fill (screen sheen)
    [-0.72 * PI, 0.35, 0.03 * PI, 0.62, 0.05, 3.2, 1, 1, 1, 0],       // back-left rim strip
    [-0.28 * PI, 0.35, 0.03 * PI, 0.62, 0.05, 2.6, 1, 1, 1, 0],       // back-right rim strip
    [-0.12 * PI, -0.04, 0.025 * PI, 0.12, 0.04, 1.1 * violet, 0.54, 0.36, 0.94, 0], // violet edge accent
    [0.66 * PI, -0.06, 0.08 * PI, 0.05, 0.06, 0.35, 1, 0.86, 0.7, 0],  // warm floor kicker
  ];
  for (let j = 0; j < H; j++) {
    const th = ((j + 0.5) / H - 0.5) * PI, y = Math.sin(th), ct = Math.cos(th);
    for (let i = 0; i < W; i++) {
      const ph = ((i + 0.5) / W - 0.5) * TAU;
      let v = y < 0 ? lerp(0.13, 0.05, sm(0, -0.6, y)) : lerp(0.13, 0.085, sm(0, 0.7, y));
      // dark flag in front (keeps front-facing gloss — screen, panel, badge — clean) and behind
      const fr = Math.abs(wrap(ph - 0.5 * PI)), bk = Math.abs(wrap(ph + 0.5 * PI));
      v *= 1 - 0.8 * (1 - sm(0.12 * PI, 0.3 * PI, fr)) * (1 - sm(0.35, 0.7, Math.abs(th)));
      v *= 1 - 0.5 * (1 - sm(0.1 * PI, 0.3 * PI, bk));
      let r = v, g = v, b = v * 1.06;
      const top = 2.0 * sm(1.0, 1.2, th); r += top; g += top; b += top;
      for (const [pc, tc, hw, hh, so, I, cr, cg, cb, vg, hg = 0] of boxes) {
        const sp = wrap(ph - pc), dp = Math.abs(sp) * Math.max(0.25, ct), dt = Math.abs(th - tc);
        const m = (1 - sm(hw - so, hw + so, dp)) * (1 - sm(hh - so, hh + so, dt));
        if (m <= 0) continue;
        const k = I * m * (1 - vg + vg * clamp((th - (tc - hh)) / (2 * hh))) * (1 - Math.abs(hg) * clamp((Math.sign(hg) * sp / hw + 1) / 2));
        r += k * cr; g += k * cg; b += k * cb;
      }
      const o = (j * W + i) * 4; data[o] = toH(r); data[o + 1] = toH(g); data[o + 2] = toH(b); data[o + 3] = toH(1);
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true;
  return reg.t(t);
}
/** damp + desaturate punctual-light speculars (host key/rim lights) on product metals, so coloured
    stage lights can't wash the silver; image-based reflections stay untouched. */
const productEnv = (THREE, reg, o) => (o.envMap !== undefined ? o.envMap : o.studio === false ? null : studioEnvTexture(THREE, reg, { violet: o.envViolet ?? 1 }));
function tameDirect(mat, k = 0.4, sat = 0.3) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDirK = { value: k }; sh.uniforms.uDirSat = { value: sat };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDirK; uniform float uDirSat;')
      .replace('#include <aomap_fragment>', `{ vec3 ds = reflectedLight.directSpecular; reflectedLight.directSpecular = mix(vec3(dot(ds, vec3(0.3333))), ds, uDirSat) * uDirK;
        #ifdef USE_CLEARCOAT
          clearcoatSpecularDirect = mix(vec3(dot(clearcoatSpecularDirect, vec3(0.3333))), clearcoatSpecularDirect, uDirSat) * uDirK;
        #endif
        }
        #include <aomap_fragment>`);
  };
  mat.customProgramCacheKey = () => `ym3d-tame-${k}-${sat}`;
  return mat;
}

/** studio light fall-off on a large flat metal panel: an env map is infinitely far away, so a flat side reflects
    one uniform tone (reads as white plastic). Scale the image-based light by object-space height instead —
    brighter toward the top, darker toward the base, like the product renders (device.webp: ≈246 → ≈192). */
function studioFalloff(mat, y0, y1, lo, hi) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vYmFall;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vYmFall = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vYmFall;')
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      { float kF = mix(${lo.toFixed(3)}, ${hi.toFixed(3)}, smoothstep(${y0.toFixed(3)}, ${y1.toFixed(3)}, vYmFall));
        radiance *= kF; iblIrradiance *= kF;
        #ifdef USE_CLEARCOAT
          clearcoatRadiance *= kF;
        #endif
      }`);
  };
  mat.customProgramCacheKey = () => prevKey() + `|fall${y0}${y1}${lo}${hi}`;
  return mat;
}

/* ─── materials ─── */
function makeMaterials(THREE, T, reg, env = null) {
  const P = (o) => reg.m(new THREE.MeshPhysicalMaterial(env ? { envMap: env, ...o } : o));
  const M = {};
  M.alu = P({ color: 0xd3d6db, metalness: 1, roughness: 0.32, roughnessMap: T.brushed, anisotropy: 0.25, clearcoat: 0.35, clearcoatRoughness: 0.14, envMapIntensity: 1.15 });
  M.aluBar = P({ color: 0xdfe2e6, metalness: 0.92, roughness: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  M.chrome = P({ color: 0xdcdfe4, metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 1.0 });
  M.navy = P({ color: 0x262b39, metalness: 0.05, roughness: 0.58, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.6, side: THREE.DoubleSide });
  M.navyBack = P({ color: 0x16181f, metalness: 0.1, roughness: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  M.rim = P({ color: 0x5c3a8e, metalness: 0.1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, emissive: COL.violet, emissiveIntensity: 0.3, envMapIntensity: 0.8 });
  M.rimBack = P({ color: 0x4e3570, metalness: 0.15, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1, emissive: COL.violet, emissiveIntensity: 0.06 });
  M.gloss = P({ color: 0x0a0a0d, metalness: 0.0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.8 });
  M.satin = P({ color: 0x121317, metalness: 0.05, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.7 });
  M.baseMat = P({ color: 0x0c0d10, metalness: 0.1, roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.22, envMapIntensity: 0.55 });
  M.rubber = P({ color: 0x0c0c0e, metalness: 0, roughness: 0.62 });
  M.hub = P({ color: 0x5a5e66, metalness: 0.8, roughness: 0.35 });
  M.cable = P({ color: 0x8f949b, metalness: 0.0, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: 0xffffff, sheenRoughness: 0.5 });
  M.grey = P({ color: 0x9aa0a8, metalness: 0.05, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  M.greyDark = P({ color: 0x5d636c, metalness: 0.05, roughness: 0.35, clearcoat: 0.6 });
  M.badge = P({ color: 0xffffff, map: T.badge, metalness: 0.1, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  M.power = P({ color: 0xffffff, map: T.power, emissive: 0xffffff, emissiveMap: T.power, emissiveIntensity: 0.15, roughness: 0.25, clearcoat: 1 });
  M.pad = P({ color: 0x1a1c21, metalness: 0.0, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2, emissive: COL.violet, emissiveIntensity: 0 });
  M.tipBlack = P({ color: 0x08080a, metalness: 0.0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 });
  M.cavity = P({ color: 0x050506, roughness: 0.7 });
  M.anod = P({ color: 0x2c3038, metalness: 0.8, roughness: 0.42 });
  M.gold = P({ color: 0xd8b060, metalness: 1, roughness: 0.22 });
  M.electrode = P({ color: 0xffffff, map: T.electrode, metalness: 1, roughness: 1, metalnessMap: T.electrodeMR, roughnessMap: T.electrodeMR, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xff9a40, emissiveMap: T.electrodeE, emissiveIntensity: 0, envMapIntensity: 1.3 });
  M.window = P({ color: 0xffffff, map: T.window, roughness: 0.1, clearcoat: 1 });
  M.screenGlass = P({ color: 0x000000, roughness: 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.9 });
  M.internal = P({ color: 0x2b2f37, metalness: 0.7, roughness: 0.42 });
  M.liner = P({ color: 0x1b1d23, metalness: 0.3, roughness: 0.7 });
  M.pcb = P({ color: 0xffffff, map: T.pcb, roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveMap: T.pcb, emissiveIntensity: 0.25 });
  M.can = P({ color: 0xc9ced6, metalness: 1, roughness: 0.28, clearcoat: 0.5 });
  M.canBand = P({ color: 0x7fd4ff, metalness: 0.3, roughness: 0.3, emissive: 0x7fd4ff, emissiveIntensity: 0.25 });
  for (const k of ['alu', 'aluBar', 'chrome', 'can', 'hub', 'gold', 'anod']) tameDirect(M[k], 0.4, 0.3);
  studioFalloff(M.alu, 0.2, 1.28, 0.6, 1.0); // console shell only (object-space metres, floor → top)
  M.led = reg.m(new THREE.MeshBasicMaterial({ color: 0x9d7bff }));
  M.ledGreen = reg.m(new THREE.MeshBasicMaterial({ color: 0x43e6a8 }));
  M.spill = reg.m(new THREE.MeshBasicMaterial({ color: COL.violet, map: T.falloff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  return M;
}

/* ─── fresnel highlight overlay ─── */
function fresnelMat(THREE, reg, color = 0xb89cff) {
  return reg.m(new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 0 }, uPush: { value: 0.0009 } },
    vertexShader: `uniform float uPush; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 p = position + normal*uPush; vec3 n = normal;
        #ifdef USE_INSTANCING
          p = (instanceMatrix*vec4(p,1.0)).xyz; n = mat3(instanceMatrix)*n;
        #endif
        vec4 mv = modelViewMatrix*vec4(p,1.0); vN = normalize(normalMatrix*n); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4); gl_FragColor = vec4(uColor*(f*1.15+0.05)*uI, 1.0); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
}
function addOverlay(THREE, mat, root) {
  const list = [];
  root.traverse((m) => { if (m.isMesh && !m.userData.noHL && m.material && !m.material.isShaderMaterial && m.material.blending !== THREE.AdditiveBlending) list.push(m); });
  for (const m of list) {
    const o = m.isInstancedMesh ? new THREE.InstancedMesh(m.geometry, mat, m.count) : new THREE.Mesh(m.geometry, mat);
    if (m.isInstancedMesh) o.instanceMatrix = m.instanceMatrix;
    o.renderOrder = 20; o.visible = false; o.userData.noHL = true; o.raycast = () => {}; m.add(o);
  }
  return { mat, set(i) { mat.uniforms.uI.value = i; const v = i > 1e-4; for (const m of list) m.children.forEach((c) => { if (c.material === mat) c.visible = v; }); } };
}

/* ─── instanced billboards (mist) ─── */
function billboards(THREE, reg, n, map, color, blending = null) {
  const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const off = new Float32Array(n * 3), sc = new Float32Array(n), al = new Float32Array(n);
  g.setAttribute('iOffset', new THREE.InstancedBufferAttribute(off, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iScale', new THREE.InstancedBufferAttribute(sc, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iAlpha', new THREE.InstancedBufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = n; reg.g(g); base.dispose();
  const mat = reg.m(new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `attribute vec3 iOffset; attribute float iScale; attribute float iAlpha; varying vec2 vUv; varying float vA;
      void main(){ vUv = uv; vA = iAlpha; vec4 mv = modelViewMatrix*vec4(iOffset,1.0); mv.xy += position.xy*iScale; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uColor; varying vec2 vUv; varying float vA;
      void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(uColor, t.a*vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, ...(blending ? { blending } : {}),
  }));
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 15; mesh.userData.noHL = true;
  return { mesh, off, sc, al, touch() { g.attributes.iOffset.needsUpdate = true; g.attributes.iScale.needsUpdate = true; g.attributes.iAlpha.needsUpdate = true; } };
}

/* ═══════════════════════════════ TIP (YM5-TP4-900) ═══════════════════════════════ */
const TIP = { a: 0.0135, rc: 0.0045, L: 0.030, face: 0.0112, elec: 0.0205, inserted: 0.006 };
function buildTip(THREE, reg, M, T) {
  const group = new THREE.Group(); group.name = 'tip';
  const rows = [[0.0, 0.0126], [0.0012, 0.0131], [0.0028, 0.0135], [0.0215, 0.0135], [0.025, 0.01335], [0.0275, 0.0129], [0.0292, 0.0122], [0.0300, TIP.face + 0.0002]];
  const cap = new THREE.Mesh(roundedSquareStack(THREE, reg, rows, { a0: TIP.a, rc0: TIP.rc, nC: 10 }), M.tipBlack); cap.castShadow = true; group.add(cap);
  const faceGeo = reg.g(new THREE.ShapeGeometry(roundedSquareShape(THREE, TIP.face + 0.0002, Math.max(0.001, TIP.rc - (TIP.a - TIP.face))), 10)); faceGeo.rotateX(-Math.PI / 2); faceGeo.translate(0, TIP.L, 0);
  group.add(new THREE.Mesh(faceGeo, M.tipBlack));
  const rearGeo = reg.g(new THREE.ShapeGeometry(roundedSquareShape(THREE, 0.0126, 0.0036), 8)); rearGeo.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(rearGeo, M.cavity));
  const eg = reg.g(new THREE.PlaneGeometry(TIP.elec, TIP.elec)); eg.rotateX(-Math.PI / 2); eg.translate(0, TIP.L + 0.00025, 0);
  const electrode = new THREE.Mesh(eg, M.electrode); group.add(electrode);
  const fg = reg.g(new THREE.PlaneGeometry(TIP.elec * 1.05, TIP.elec * 1.05)); fg.rotateX(-Math.PI / 2); fg.translate(0, TIP.L + 0.0005, 0);
  const frostMat = reg.m(new THREE.MeshBasicMaterial({ map: T.frost, color: 0xe6f6ff, transparent: true, opacity: 0, depthWrite: false }));
  const frost = new THREE.Mesh(fg, frostMat); frost.userData.noHL = true; frost.renderOrder = 12; group.add(frost);
  const gg = reg.g(new THREE.PlaneGeometry(0.05, 0.05)); gg.rotateX(-Math.PI / 2); gg.translate(0, TIP.L + 0.0007, 0);
  const glowMat = reg.m(new THREE.MeshBasicMaterial({ map: T.squareGlow, color: 0xffb35c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const glowPlane = new THREE.Mesh(gg, glowMat); glowPlane.userData.noHL = true; glowPlane.renderOrder = 13; group.add(glowPlane);
  const bloomMat = reg.m(new THREE.SpriteMaterial({ map: T.glow, color: 0xff9a50, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const bloom = new THREE.Sprite(bloomMat); bloom.position.set(0, TIP.L + 0.004, 0); bloom.scale.set(0.09, 0.09, 1); bloom.userData.noHL = true; bloom.renderOrder = 14; group.add(bloom);
  const wg = reg.g(new THREE.PlaneGeometry(0.0092, 0.0112)); wg.rotateY(-Math.PI / 2); wg.translate(-TIP.a - 0.00006, 0.0138, 0);
  group.add(new THREE.Mesh(wg, M.window));
  const NM = 44, mist = billboards(THREE, reg, NM, T.puff, 0x9fdcff, THREE.AdditiveBlending); group.add(mist.mesh);
  const mistSeeds = []; { const r = rng(404); for (let i = 0; i < NM; i++) { const a = r() * TAU; mistSeeds.push([Math.cos(a), Math.sin(a), r(), r() * TAU, 0.6 + r() * 0.8, 0.4 + r() * 0.6]); } }
  const anchors = {};
  const A = (name, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); o.name = 'anchor:' + name; group.add(o); anchors[name] = o; };
  A('tip', 0, 0.015, 0); A('electrode', 0, TIP.L + 0.001, 0); A('window', -TIP.a - 0.001, 0.0138, 0);
  function update(p) {
    const t = p.t || 0, glow = clamp(p.electrodeGlow || 0), cool = clamp(p.cooling || 0);
    M.electrode.emissiveIntensity = glow * 1.7;
    glowMat.opacity = glow * 0.45; bloomMat.opacity = glow * 0.4; bloom.visible = glowPlane.visible = glow > 1e-4;
    frostMat.opacity = cool * 0.9; frost.visible = cool > 1e-4;
    mist.mesh.visible = cool > 1e-4;
    if (mist.mesh.visible) {
      for (let i = 0; i < NM; i++) {
        const [cx, cz, ph, ang, sp, sz] = mistSeeds[i]; const f = ((t * 0.28 * sp + ph) % 1 + 1) % 1, rad = 0.004 + f * 0.024;
        mist.off[i * 3] = cx * rad + Math.sin(ang + t * 1.7) * 0.0015 * f;
        mist.off[i * 3 + 1] = TIP.L + 0.0015 + f * 0.012 + Math.sin(ang * 2 + t) * 0.001;
        mist.off[i * 3 + 2] = cz * rad + Math.cos(ang + t * 1.3) * 0.0015 * f;
        mist.sc[i] = (0.005 + f * 0.016) * sz; mist.al[i] = cool * 0.32 * Math.pow(Math.sin(Math.PI * f), 1.2);
      }
      mist.touch();
    }
  }
  return { group, anchors, update, meshes: { cap, electrode, frost, glowPlane }, electrode };
}
export function createTip(THREE, opts = {}) {
  const reg = registry(), T = makeTextures(THREE, reg), env = productEnv(THREE, reg, opts), M = makeMaterials(THREE, T, reg, env);
  const tip = buildTip(THREE, reg, M, T), root = new THREE.Group(), _pp = {}; root.name = 'YM5-TP4-900'; root.add(tip.group);
  return {
    object3d: root, parts: { tip: tip.group, electrode: tip.meshes.electrode }, anchorNames: Object.keys(tip.anchors),
    update(p = {}) { p = finiteParams(p, _pp); tip.group.rotation.y = p.spin || 0; tip.update(p); },
    anchor(name, out = new THREE.Vector3()) { const o = tip.anchors[name]; if (!o) return null; o.updateWorldMatrix(true, false); return out.setFromMatrixPosition(o.matrixWorld); },
    dispose() { root.removeFromParent(); reg.dispose(); },
  };
}

/* ═══════════════════════════════ HANDPIECE (YM5-H1) ═══════════════════════════════ */
const HP_BODY = [[-0.212, 0.0090], [-0.2085, 0.0103], [-0.203, 0.0126], [-0.193, 0.0154], [-0.180, 0.0171], [-0.168, 0.0177], [-0.155, 0.0173], [-0.139, 0.0158], [-0.121, 0.0144], [-0.104, 0.0149], [-0.087, 0.0166], [-0.068, 0.0182], [-0.044, 0.0190], [-0.024, 0.0189], [-0.012, 0.0186]];
const HP = { rOf: pchip(HP_BODY), tail: -0.2505 };
function buildHandpiece(THREE, reg, M, T, { detail = 'high' } = {}) {
  const segs = detail === 'high' ? 96 : 48, group = new THREE.Group(); group.name = 'handpiece';
  const rOf = HP.rOf;
  const prof = [];
  for (let i = 0; i <= 70; i++) { const y = lerp(-0.212, -0.012, i / 70); prof.push([rOf(y), y]); }
  prof.push([0.01825, -0.0111], [0.01775, -0.0104], [0.01772, -0.0094], [0.0182, -0.0087], [0.01848, -0.0078], [0.0185, -0.0042], [0.01835, -0.0018], [0.01795, -0.0006], [0.0174, 0], [0.0170, 0.0], [0.01665, -0.0002], [0.01655, -0.0012]);
  const body = new THREE.Mesh(lathe(THREE, reg, prof, segs), M.chrome); body.castShadow = true; body.receiveShadow = true; group.add(body);
  // bore + cavity floor (order top→down then inward ⇒ normals face into the bore)
  const cav = new THREE.Mesh(lathe(THREE, reg, [[0.0165, -0.001], [0.0165, -0.0092], [0.01, -0.0093], [0.0, -0.0094]], 48), M.cavity); group.add(cav);
  // tail strain relief (black, ribbed)
  const tail = [];
  for (let i = 0; i <= 64; i++) {
    const y = lerp(-0.2505, -0.2085, i / 64), f = (y + 0.2505) / 0.042;
    const base = lerp(0.0036, 0.0091, Math.pow(f, 1.25)), rib = f < 0.82 ? 0.00045 * Math.pow(0.5 + 0.5 * Math.cos(TAU * (y + 0.2505) / 0.0052), 4) : 0;
    tail.push([base + rib, y]);
  }
  const tailM = new THREE.Mesh(lathe(THREE, reg, tail, 40), M.satin); tailM.castShadow = true; group.add(tailM);
  // nose spigot (visible when tip removed): dark anodized rounded square + gold contact pins + key tab on −X
  const spig = new THREE.Mesh(roundedSquareStack(THREE, reg, [[-0.009, 0.0098], [0.0028, 0.0098], [0.0036, 0.0093]], { a0: 0.0098, rc0: 0.003, nC: 6 }), M.anod); group.add(spig);
  const spTop = reg.g(new THREE.ShapeGeometry(roundedSquareShape(THREE, 0.0093, 0.0025), 6)); spTop.rotateX(-Math.PI / 2); spTop.translate(0, 0.0036, 0); group.add(new THREE.Mesh(spTop, M.anod));
  const pinG = reg.g(new THREE.CylinderGeometry(0.0011, 0.0011, 0.0016, 12));
  const pins = new THREE.InstancedMesh(pinG, M.gold, 4); { const m4 = new THREE.Matrix4(); [[-0.004, -0.004], [0.004, -0.004], [-0.004, 0.004], [0.004, 0.004]].forEach(([x, z], i) => { m4.makeTranslation(x, 0.0042, z); pins.setMatrixAt(i, m4); }); } group.add(pins);
  const key = new THREE.Mesh(reg.g(new THREE.BoxGeometry(0.0026, 0.009, 0.0048)), M.anod); key.position.set(-0.0109, -0.0025, 0); group.add(key);
  // latch lever (black) on −X that clicks into the tip's key window
  const latchG = new THREE.Group(); latchG.position.set(-0.0186, -0.021, 0); group.add(latchG);
  const lt = makeTube(THREE, 24, 10, { rx: 0.0013, ry: 0.0034, sq: 3, up: [0, 0, 1] });
  lt.set(curvePoints(THREE, [[0, 0, 0], [-0.0009, 0.009, 0], [-0.0007, 0.018, 0], [0.0022, 0.027, 0], [0.0042, 0.0325, 0]], 24)); reg.g(lt.geometry);
  const latch = new THREE.Mesh(lt.geometry, M.satin); latch.castShadow = true; latchG.add(latch);
  // 使能按钮 (enable) — long dark pill on +Z
  const enableMat = M.pad.clone(); reg.m(enableMat);
  const enable = new THREE.Mesh(padGeometry(THREE, reg, rOf, { yc: -0.057, phi: 0, halfLen: 0.0235, halfW: 0.0058, height: 0.0016, edge: 0.0015 }), enableMat); enable.castShadow = true; group.add(enable);
  // control cluster on −Z: [R] + pill [− M +]
  const rMat = M.pad.clone(); rMat.color.set(0xffffff); rMat.map = iconTex(THREE, reg, 'R'); rMat.emissiveMap = rMat.map; rMat.emissive.set(COL.mint); reg.m(rMat);
  const btnR = new THREE.Mesh(padGeometry(THREE, reg, rOf, { yc: -0.1515, phi: Math.PI, halfLen: 0.0043, halfW: 0.0043, height: 0.0013, edge: 0.0012, nA: 48 }), rMat); group.add(btnR);
  const pill = new THREE.Mesh(padGeometry(THREE, reg, rOf, { yc: -0.1815, phi: Math.PI, halfLen: 0.0165, halfW: 0.0058, height: 0.0009, edge: 0.001 }), M.pad); group.add(pill);
  const rOf2 = (y) => rOf(y) + 0.00085;
  const mini = {};
  [['minus', -0.1705], ['M', -0.1815], ['plus', -0.1925]].forEach(([k, yc]) => {
    const m = M.pad.clone(); m.color.set(0xffffff); m.map = iconTex(THREE, reg, k); m.emissiveMap = m.map; m.emissive.set(COL.mint); reg.m(m);
    mini[k] = new THREE.Mesh(padGeometry(THREE, reg, rOf2, { yc, phi: Math.PI, halfLen: 0.0036, halfW: 0.0036, height: 0.0007, edge: 0.0007, nA: 40, sink: 0.0002 }), m); group.add(mini[k]);
  });
  const buttons = { R: btnR, ...mini };
  // tip (inserted, slides along +Y)
  const tipHolder = new THREE.Group(); group.add(tipHolder);
  const tip = buildTip(THREE, reg, M, T); tipHolder.add(tip.group);
  // click flash ring at the interface
  const flashMat = reg.m(new THREE.SpriteMaterial({ map: T.glow, color: 0xc7b3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flash = new THREE.Sprite(flashMat); flash.scale.set(0.07, 0.07, 1); flash.position.set(0, 0.002, 0); flash.userData.noHL = true; flash.renderOrder = 14; group.add(flash);
  const anchors = { ...tip.anchors };
  const A = (name, x, y, z, parent = group) => { const o = new THREE.Object3D(); o.position.set(x, y, z); o.name = 'anchor:' + name; parent.add(o); anchors[name] = o; };
  const rAt = (y) => rOf(y) + 0.002;
  A('enable', 0, -0.057, rAt(-0.057)); A('controls', 0, -0.172, -rAt(-0.172)); A('R', 0, -0.1515, -rAt(-0.1515));
  A('minus', 0, -0.1705, -rAt(-0.1705)); A('M', 0, -0.1815, -rAt(-0.1815)); A('plus', 0, -0.1925, -rAt(-0.1925));
  A('waist', 0, -0.121, rAt(-0.121)); A('tail', 0, -0.23, 0); A('latch', -0.021, -0.01, 0); A('cable', 0, HP.tail, 0); A('body', 0, -0.1, 0);
  const tipMeshes = tip.group, bodyParts = [body, tailM, enable, btnR, pill, latch, ...Object.values(mini)];
  function update(p) {
    const t = p.t || 0, k = clamp(p.tipInsert ?? 1);
    const s = seg(k, 0, 0.86), q = clamp((k - 0.86) / 0.14);
    let off = 0.075 * (1 - s); if (k > 0.86) off -= 0.0011 * Math.sin(q * Math.PI * 2.2) * Math.exp(-3.2 * q) * (1 - q);
    off += p.tipGap || 0;
    tipHolder.position.y = -TIP.inserted + off;
    tipHolder.rotation.y = (Math.PI / 2) * (1 - seg(k, 0.06, 0.46));
    latchG.rotation.z = -0.32 * seg(k, 0.7, 0.84) * (1 - seg(k, 0.86, 0.91, easeOut));
    const fl = k > 0.86 && k < 1 ? Math.exp(-5 * q) * (1 - q) : 0; flashMat.opacity = fl * 0.9; flash.visible = fl > 1e-3;
    tip.update(p);
    const ep = clamp(p.enablePressed || 0);
    enable.position.set(0, 0, -0.0007 * ep); enableMat.emissiveIntensity = ep * 0.55;
    const which = p.buttonPress || null, amt = clamp(p.buttonPressAmount ?? 1);
    for (const key in buttons) { const b = buttons[key], on = key === which ? amt : 0; b.position.set(0, 0, 0.0006 * on); b.material.emissiveIntensity = on * 0.9; }
  }
  return { group, anchors, update, tip, tipHolder, bodyParts, tipMeshes, buttons, meshes: { body, tail: tailM, enable, pill, btnR, latch } };
}
export function createHandpiece(THREE, opts = {}) {
  const o = { detail: 'high', cable: true, ...opts };
  const reg = registry(), T = makeTextures(THREE, reg), env = productEnv(THREE, reg, opts), M = makeMaterials(THREE, T, reg, env);
  const hp = buildHandpiece(THREE, reg, M, T, o), root = new THREE.Group(), _pp = {}; root.name = 'YM5-H1'; root.add(hp.group);
  if (o.cable) {
    const cg = staticTube(THREE, reg, [[0, HP.tail + 0.001, 0], [0, -0.3, 0], [0.004, -0.37, -0.012], [0.02, -0.45, -0.04], [0.05, -0.54, -0.08], [0.08, -0.64, -0.11]], 80, 14, { rx: 0.0033 });
    const cable = new THREE.Mesh(cg, M.cable); cable.castShadow = true; hp.group.add(cable); hp.bodyParts.push(cable);
  }
  const hl = {};
  const mk = (key, meshes) => { const mat = fresnelMat(THREE, reg); const list = meshes.map((m) => addOverlay(THREE, mat, m)); hl[key] = { set(i) { list.forEach((l) => l.set(i)); } }; };
  mk('enable', [hp.meshes.enable]); mk('controls', [hp.meshes.pill, hp.meshes.btnR, ...Object.values(hp.buttons)]);
  mk('tip', [hp.tip.group]); mk('electrode', [hp.tip.meshes.electrode]); mk('body', [hp.meshes.body]);
  return {
    object3d: root, tip: hp.tip, anchorNames: Object.keys(hp.anchors),
    parts: { body: hp.meshes.body, tail: hp.meshes.tail, enable: hp.meshes.enable, controls: hp.meshes.pill, buttons: hp.buttons, latch: hp.meshes.latch, tip: hp.tip.group, tipHolder: hp.tipHolder, electrode: hp.tip.meshes.electrode },
    update(p = {}) {
      p = finiteParams(p, _pp);
      hp.update(p);
      const pulse = 0.55 + 0.45 * Math.sin((p.t || 0) * TAU * 0.9);
      for (const k in hl) hl[k].set(p.highlight === k ? pulse : 0);
    },
    anchor(name, out = new THREE.Vector3()) { const a = hp.anchors[name]; if (!a) return null; a.updateWorldMatrix(true, false); return out.setFromMatrixPosition(a.matrixWorld); },
    dispose() { root.removeFromParent(); reg.dispose(); },
  };
}

/* ═══════════════════════════════ CONSOLE (YM5-G1) ═══════════════════════════════ */
export function createDevice(THREE, opts = {}) {
  const o = { detail: 'high', contactShadow: true, internals: true, back: true, screenRes: 1600, castShadow: true, ...opts };
  const hi = o.detail !== 'low';
  const reg = registry(), T = makeTextures(THREE, reg), env = productEnv(THREE, reg, opts), M = makeMaterials(THREE, T, reg, env);
  const d = DIM, { R, yTop, yBot, zf, zP, lipW } = d;
  const root = new THREE.Group(); root.name = 'YM5-G1';
  const floatG = new THREE.Group(), turnG = new THREE.Group(); root.add(floatG); floatG.add(turnG);
  const G = (name) => { const g = new THREE.Group(); g.name = name; turnG.add(g); return g; };
  const baseG = G('base'), shellG = G('shell'), frontG = G('front'), screenG = G('screen'), hpG = G('handpiece'), internalsG = G('internals'), cableG = G('cableA');
  const anchors = {};
  const A = (name, parent, x, y, z) => { const a = new THREE.Object3D(); a.name = 'anchor:' + name; a.position.set(x, y, z); parent.add(a); anchors[name] = a; };
  const mesh = (geo, mat, parent, { cast = true, recv = false } = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast && o.castShadow; m.receiveShadow = recv; parent.add(m); return m; };
  const nArc = hi ? 96 : 56;

  /* ── shell: brushed aluminium band swept around the stadium, rounded front/back lips ── */
  const loop = stadiumLoop(R, yTop, yBot, nArc, 10);
  const shellProf = profile()
    .arc(-lipW + d.lipRi, zf - d.lipRi, d.lipRi, Math.PI, Math.PI / 2, 5)
    .arc(-d.lipRo, zf - d.lipRo, d.lipRo, Math.PI / 2, 0, 12)
    .pt(0, zf * 0.33, 1, 0).pt(0, -zf * 0.33, 1, 0)
    .arc(-d.lipRo, -zf + d.lipRo, d.lipRo, 0, -Math.PI / 2, 12)
    .arc(-lipW + d.lipRi, -zf + d.lipRi, d.lipRi, -Math.PI / 2, -Math.PI, 5).done();
  const shell = mesh(reg.g(sweepGeometry(THREE, loop, shellProf, [1.6, 14])), M.alu, shellG, { recv: true });
  // violet recess walls (front = glowing light strip, back = dim)
  const wallF = profile().pt(-lipW, zf - d.lipRi, -1, 0).arc(-lipW - d.fil, zP + d.fil, d.fil, 0, -Math.PI / 2, 5, true).pt(-lipW - d.fil - 0.002, zP - 0.0003, 0, 1).done();
  const rimF = mesh(reg.g(sweepGeometry(THREE, loop, wallF)), M.rim, shellG, { recv: true });
  const wallB = profile().pt(-lipW, -(zf - d.lipRi), -1, 0).arc(-lipW - d.fil, -(zP + d.fil), d.fil, 0, Math.PI / 2, 5, true).pt(-lipW - d.fil - 0.002, -zP + 0.0003, 0, -1).done();
  mesh(reg.g(sweepGeometry(THREE, loop, wallB)), M.rimBack, shellG);
  // inner liner (only ever seen in the exploded view): dark matte, facing the tower axis
  const liner = profile().pt(-lipW - 0.0006, zP - 0.001, -1, 0).pt(-lipW - 0.0006, -zP + 0.001, -1, 0).done();
  mesh(reg.g(sweepGeometry(THREE, loop, liner)), M.liner, shellG, { cast: false });
  // handles: satin towel bars on violet stand-offs
  for (const sx of [-1, 1]) {
    const y = d.handleY, off = 0.03, x0 = sx * (R - 0.004), xb = sx * (R + off), z1 = 0.118, z2 = -0.15, rb = 0.017;
    const pts = [];
    pts.push([x0, y, z1]); pts.push([sx * (R + off - rb), y, z1]);
    for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([sx * (R + off - rb + rb * Math.sin(a)), y, z1 - rb + rb * Math.cos(a)]); }
    for (let i = 1; i < 6; i++) pts.push([xb, y, lerp(z1 - rb, z2 + rb, i / 6)]);
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([sx * (R + off - rb + rb * Math.cos(a)), y, z2 + rb - rb * Math.sin(a)]); }
    pts.push([x0, y, z2]);
    const tb = makeTube(THREE, pts.length - 1, 24, { rx: 0.0125, ry: 0.0048, sq: 3.6, up: [0, 1, 0] });
    tb.set(pts.map((p) => ({ x: p[0], y: p[1], z: p[2] }))); reg.g(tb.geometry);
    const bar = mesh(tb.geometry, M.aluBar, shellG); bar.name = sx < 0 ? 'handleLeft' : 'handleRight';
    const mg = reg.g(new THREE.BoxGeometry(0.016, 0.026, 0.011)); mg.translate(0, 0, 0);
    for (const z of [z1, z2]) { const m = mesh(mg, M.rim, shellG); m.position.set(sx * (R + 0.006), y, z); m.name = 'handleMount'; }
  }
  A('handle', shellG, -(R + 0.047), d.handleY, -0.015); A('handleRight', shellG, R + 0.047, d.handleY, -0.015);
  A('rim', shellG, R - lipW, 0.72, zf - 0.006); A('rimLeft', shellG, -(R - lipW), 0.72, zf - 0.006);
  A('shell', shellG, -R, 0.7, 0); A('top', shellG, 0, d.H, 0);

  /* ── rear: dark panel, semicircular grille, cryogen bay cover, mains I/O ── */
  if (o.back) {
    const bp = reg.g(new THREE.ShapeGeometry(stadiumShape(THREE, d.Rp + 0.0005, yTop, yBot), 48)); bp.rotateY(Math.PI); bp.translate(0, 0, -zP);
    mesh(bp, M.navyBack, shellG, { cast: false, recv: true });
    const slots = [], slotG = reg.g(new THREE.BoxGeometry(1, 1, 1));
    for (let i = 0; i < 7; i++) { const y = yTop + 0.018 + i * 0.016, half = Math.sqrt(Math.max(0, (d.Rp - 0.02) ** 2 - (y - yTop) ** 2)) * 0.82; if (half > 0.02) slots.push([y, half]); }
    const grille = new THREE.InstancedMesh(slotG, M.rubber, slots.length); const m4 = new THREE.Matrix4();
    slots.forEach(([y, h], i) => { m4.compose(new THREE.Vector3(0, y, -zP - 0.0008), new THREE.Quaternion(), new THREE.Vector3(2 * h, 0.0065, 0.002)); grille.setMatrixAt(i, m4); });
    shellG.add(grille);
    const cov = reg.g(new THREE.ExtrudeGeometry(roundRectShape(THREE, 0.15, 0.19, 0.02), { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 12 }));
    cov.rotateY(Math.PI); cov.translate(0, 0.955, -zP - 0.0015); mesh(cov, M.navyBack, shellG);
    const grip = reg.g(new THREE.ExtrudeGeometry(roundRectShape(THREE, 0.064, 0.013, 0.0065), { depth: 0.004, bevelEnabled: false }));
    grip.rotateY(Math.PI); grip.translate(0, 1.025, -zP - 0.005); mesh(grip, M.rubber, shellG);
    const io = reg.g(new THREE.ExtrudeGeometry(roundRectShape(THREE, 0.13, 0.1, 0.01), { depth: 0.002, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2 }));
    io.rotateY(Math.PI); io.translate(0, 0.40, -zP - 0.001); mesh(io, M.anod, shellG);
    const inlet = mesh(reg.g(new THREE.BoxGeometry(0.03, 0.024, 0.01)), M.rubber, shellG); inlet.position.set(0.03, 0.40, -zP - 0.006);
    const sw = mesh(reg.g(new THREE.BoxGeometry(0.016, 0.026, 0.01)), M.rubber, shellG); sw.position.set(-0.025, 0.405, -zP - 0.007);
    const led = mesh(reg.g(new THREE.SphereGeometry(0.0022, 12, 8)), M.ledGreen, shellG, { cast: false }); led.position.set(-0.025, 0.428, -zP - 0.004);
    const fuse = mesh(reg.g(new THREE.CylinderGeometry(0.0065, 0.0065, 0.008, 20)).rotateX(Math.PI / 2), M.rubber, shellG); fuse.position.set(-0.025, 0.372, -zP - 0.005);
    A('back', shellG, 0, 0.8, -zf); A('cryogen', shellG, 0, 0.955, -zP - 0.006); A('io', shellG, 0, 0.40, -zP - 0.008);
  }

  /* ── front panel assembly ── */
  const panelGeo = reg.g(new THREE.ShapeGeometry(stadiumShape(THREE, d.Rp + 0.0005, yTop, yBot), 64)); panelGeo.translate(0, 0, zP);
  const panel = mesh(panelGeo, M.navy, frontG, { cast: false, recv: true }); panel.name = 'panel';
  const spillProf = profile().pt(-lipW - d.fil - 0.0002, zP + 0.0006, 0, 1).pt(-lipW - d.fil - 0.05, zP + 0.0006, 0, 1).done();
  const spill = new THREE.Mesh(reg.g(sweepGeometry(THREE, loop, spillProf, [1, 1 / 0.0498])), M.spill); spill.renderOrder = 5; spill.userData.noHL = true; frontG.add(spill);
  // power button
  const pwrGeo = lathe(THREE, reg, [[0.0108, 0], [0.0108, 0.0028], [0.0103, 0.0038], [0.0094, 0.0043], [0, 0.0045]], 48); pwrGeo.rotateX(Math.PI / 2);
  const pwrRing = mesh(pwrGeo, M.satin, frontG); pwrRing.position.set(d.power[0], d.power[1], zP);
  const pwrFace = reg.g(new THREE.CircleGeometry(0.0092, 48)); const pwr = mesh(pwrFace, M.power, frontG, { cast: false }); pwr.position.set(d.power[0], d.power[1], zP + 0.00455);
  A('power', frontG, d.power[0], d.power[1], zP + 0.005);
  // holster bracket
  const b = d.bracket;
  const brGeo = reg.g(new THREE.ExtrudeGeometry(roundRectShape(THREE, b.w, b.h, b.h / 2), { depth: b.depth, bevelEnabled: true, bevelThickness: b.bevel, bevelSize: b.bevel, bevelSegments: hi ? 6 : 3, curveSegments: hi ? 24 : 12 }));
  const bracket = mesh(brGeo, M.satin, frontG, { recv: true }); bracket.position.set(b.cx, b.cy, zP + b.bevel); bracket.name = 'bracket';
  A('bracket', frontG, b.cx + 0.05, b.cy, d.bracketFront);
  // handpiece cradle clip
  { const cx = d.hp[0], cz = d.hp[2], y = b.cy + 0.004, rr0 = 0.0238, pts = [];
    for (let i = 0; i <= 40; i++) { const a = 0.78 * Math.PI + (i / 40) * (1.44 * Math.PI); pts.push({ x: cx + rr0 * Math.cos(a), y, z: cz + rr0 * Math.sin(a) }); }
    const tb = makeTube(THREE, 40, 14, { rx: 0.0042, ry: 0.0026, sq: 3, up: [0, 1, 0] }); tb.set(pts); reg.g(tb.geometry); mesh(tb.geometry, M.satin, frontG); }
  // grey accessory in the right bay
  const accG = new THREE.Group(); accG.position.set(d.acc[0], d.acc[1], d.bracketFront + 0.009); frontG.add(accG);
  { const ag = reg.g(new THREE.ExtrudeGeometry(roundRectShape(THREE, 0.024, 0.06, 0.006), { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 3 })); ag.translate(0, 0, -0.006);
    mesh(ag, M.grey, accG);
    const win = reg.g(new THREE.ExtrudeGeometry(roundRectShape(THREE, 0.014, 0.022, 0.003), { depth: 0.001, bevelEnabled: false })); win.translate(0, 0.012, 0.0062); mesh(win, M.greyDark, accG);
    for (let i = 0; i < 3; i++) { const l = mesh(reg.g(new THREE.BoxGeometry(0.012, 0.0012, 0.0008)), M.greyDark, accG, { cast: false }); l.position.set(0, -0.008 - i * 0.004, 0.0063); }
    const neck = mesh(reg.g(new THREE.CylinderGeometry(0.0042, 0.0052, 0.012, 20)), M.greyDark, accG); neck.position.set(0, -0.036, 0.0); }
  // cable glands under the bracket
  const glands = [[d.glands[0], b.cy - b.h / 2 - b.bevel + 0.001], [d.glands[1], b.cy - b.h / 2 - b.bevel + 0.001]];
  for (const [x, y] of glands) { const gg = lathe(THREE, reg, [[0.0035, -0.02], [0.0062, -0.017], [0.0072, -0.012], [0.0078, -0.004], [0.0082, 0.0], [0.0, 0.0005]], 28); const gm = mesh(gg, M.satin, frontG); gm.position.set(x, y, zP + 0.026); }
  // badge / cable reel
  const bd = d.badge;
  const hub = mesh(reg.g(new THREE.CylinderGeometry(0.046, 0.046, bd.face - bd.t - zP, 48)).rotateX(Math.PI / 2), M.satin, frontG); hub.position.set(0, bd.y, (zP + bd.face - bd.t) / 2);
  const badgeSide = lathe(THREE, reg, [[bd.r - 0.0005, 0], [bd.r, 0.001], [bd.r, bd.t - 0.0022], [bd.r - 0.0008, bd.t - 0.0006], [bd.r - 0.002, bd.t]], 96); badgeSide.rotateX(Math.PI / 2);
  const badgeRim = mesh(badgeSide, M.satin, frontG); badgeRim.position.set(0, bd.y, bd.face - bd.t);
  const badgeFace = mesh(reg.g(new THREE.CircleGeometry(bd.r - 0.002, 96)), M.badge, frontG, { cast: false }); badgeFace.position.set(0, bd.y, bd.face + 0.00002); badgeFace.name = 'badge';
  const badgeBack = mesh(reg.g(new THREE.CircleGeometry(bd.r - 0.0005, 64)).rotateY(Math.PI), M.satin, frontG, { cast: false }); badgeBack.position.set(0, bd.y, bd.face - bd.t);
  A('badge', frontG, 0, bd.y, bd.face + 0.002);
  // static cables B, C, D (+ ferrite bead)
  const cz = zP + 0.013;
  const kx = d.kx, cab = (pts) => mesh(staticTube(THREE, reg, pts.map(([x, y, z]) => [x * kx, y, z]), hi ? 90 : 50, hi ? 12 : 8, { rx: 0.0032 }), M.cable, frontG);
  const cB = cab([[-0.03, glands[0][1] - 0.014, zP + 0.026], [-0.026, 0.745, cz + 0.006], [0.004, 0.61, cz + 0.004], [0.04, 0.47, cz], [0.052, 0.37, cz - 0.001], [0.05, 0.3, cz - 0.001]]);
  const cC = cab([[0.058, glands[1][1] - 0.014, zP + 0.026], [0.054, 0.745, cz + 0.001], [0.026, 0.61, cz - 0.004], [-0.016, 0.47, cz - 0.002], [-0.045, 0.37, cz - 0.001], [-0.045, 0.3, cz - 0.001]]);
  const cD = cab([[0.108, 0.849 - 0.042, d.bracketFront + 0.009], [0.106, 0.77, d.bracketFront - 0.012], [0.101, 0.64, cz + 0.004], [0.094, 0.5, cz], [0.084, 0.4, cz], [0.06, 0.31, cz - 0.001]]);
  const bead = mesh(reg.g(new THREE.SphereGeometry(0.0068, 24, 16)), M.satin, frontG); bead.scale.set(1, 2.3, 1); bead.position.set(0.1012 * kx, 0.645, cz + 0.004);
  A('cables', frontG, 0.012, 0.58, cz + 0.01); A('panel', frontG, -0.08, 0.5, zP + 0.002);

  /* ── round-bezel touchscreen ── */
  const Rs = d.Rs;
  const discGeo = lathe(THREE, reg, [[Rs, 0], [Rs, d.screenT - 0.0024], [Rs - 0.0006, d.screenT - 0.0009], [Rs - 0.0018, d.screenT - 0.0002], [Rs - 0.0034, d.screenT], [0, d.screenT]], hi ? 128 : 72); discGeo.rotateX(Math.PI / 2);
  const disc = mesh(discGeo, M.gloss, screenG); disc.position.set(0, yTop, zP);
  const discBack = mesh(reg.g(new THREE.CircleGeometry(Rs, hi ? 96 : 64)).rotateY(Math.PI), M.satin, screenG, { cast: false }); discBack.position.set(0, yTop, zP + 0.0002);
  const ring = mesh(reg.g(new THREE.TorusGeometry(Rs + 0.0004, 0.0012, 10, hi ? 160 : 96)), M.rim, screenG, { cast: false }); ring.position.set(0, yTop, zP + 0.0042);
  const SW = o.screenRes, SH = Math.round(SW / 1.48), scv = canvas(SW, SH), sctx = scv.getContext('2d');
  const screenTex = canvasTex(THREE, reg, scv, { aniso: 16 });
  const dispMat = reg.m(new THREE.MeshPhysicalMaterial({ envMap: env, color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1.15, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.55 }));
  const display = mesh(reg.g(new THREE.PlaneGeometry(d.display[0], d.display[1])), dispMat, screenG, { cast: false }); display.position.set(0, yTop + 0.002, zP + d.screenT + 0.0002); display.name = 'display';
  A('screen', screenG, 0, yTop + 0.004, zP + d.screenT + 0.002);

  /* ── base: black flared disc on five casters ── */
  const bprof = [[0, 0.083], [0.26, 0.083], [0.298, 0.0835], [0.3065, 0.0856], [0.3105, 0.0895], [0.3115, 0.094], [0.3098, 0.0985], [0.3045, 0.1024], [0.2965, 0.1052]];
  for (let i = 1; i <= 28; i++) { const r = lerp(0.29, 0.066, i / 28); bprof.push([r, 0.106 + 0.108 * Math.pow(1 - (r - 0.066) / 0.224, 2.5)]); }
  bprof.push([0.05, 0.2155], [0.025, 0.2168], [0, 0.2172]);
  const baseMesh = mesh(lathe(THREE, reg, bprof, hi ? 128 : 72), M.baseMat, baseG, { recv: true }); baseMesh.name = 'baseDisc';
  { const n = 5, r = rng(11), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), e = new THREE.Euler();
    const plateG = reg.g(new THREE.CylinderGeometry(0.02, 0.02, 0.005, 28)), stemG = reg.g(new THREE.CylinderGeometry(0.011, 0.013, 0.014, 20));
    const forkG = reg.g(new THREE.ExtrudeGeometry(roundRectShape(THREE, 0.034, 0.042, 0.012), { depth: 0.026, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 })); forkG.translate(0, 0, -0.013);
    const wheelG = reg.g(new THREE.CylinderGeometry(0.029, 0.029, 0.022, 32)).rotateX(Math.PI / 2), hubG = reg.g(new THREE.CylinderGeometry(0.012, 0.012, 0.0235, 20)).rotateX(Math.PI / 2);
    const plates = new THREE.InstancedMesh(plateG, M.hub, n), stems = new THREE.InstancedMesh(stemG, M.satin, n), forks = new THREE.InstancedMesh(forkG, M.satin, n), wheels = new THREE.InstancedMesh(wheelG, M.rubber, n), hubs = new THREE.InstancedMesh(hubG, M.hub, n);
    for (let i = 0; i < n; i++) {
      const th = Math.PI / 2 + i * TAU / n, cx = Math.cos(th) * 0.25, cz2 = Math.sin(th) * 0.25, sw = -th + Math.PI / 2 + (r() - 0.5) * 0.9;
      m4.makeTranslation(cx, 0.0805, cz2); plates.setMatrixAt(i, m4); m4.makeTranslation(cx, 0.072, cz2); stems.setMatrixAt(i, m4);
      q.setFromEuler(e.set(0, sw, 0)); const tx = Math.sin(sw) * 0.009, tz = Math.cos(sw) * 0.009;
      m4.compose(v.set(cx + tx, 0.043, cz2 + tz), q, s1); forks.setMatrixAt(i, m4);
      m4.compose(v.set(cx + tx * 1.5, 0.029, cz2 + tz * 1.5), q.setFromEuler(e.set(0, sw + Math.PI / 2, 0)), s1); wheels.setMatrixAt(i, m4); hubs.setMatrixAt(i, m4);
    }
    for (const im of [plates, stems, forks, wheels, hubs]) { im.castShadow = o.castShadow; baseG.add(im); }
    A('caster', baseG, 0, 0.03, 0.27);
  }
  A('base', baseG, 0, 0.11, 0.25);

  /* ── internals (only visible in exploded view; 原理示意) ── */
  if (o.internals) {
    const box = (w, h, dd, mat, x, y, z, parent = internalsG) => { const m = mesh(reg.g(new THREE.BoxGeometry(w, h, dd)), mat, parent); m.position.set(x, y, z); return m; };
    for (const x of [-0.115, 0.115]) for (const z of [-0.12, 0.1]) box(0.01, 0.9, 0.01, M.anod, x, 0.68, z);
    for (const y of [0.24, 0.62]) box(0.24, 0.006, 0.24, M.internal, 0, y, -0.01);
    const rf = box(0.2, 0.18, 0.14, M.internal, 0, 0.44, -0.02);
    const rfFace = mesh(reg.g(new THREE.PlaneGeometry(0.18, 0.15)), M.pcb, internalsG, { cast: false }); rfFace.position.set(0, 0.44, 0.0505);
    const fins = new THREE.InstancedMesh(reg.g(new THREE.BoxGeometry(0.004, 0.17, 0.04)), M.anod, 13); { const m4 = new THREE.Matrix4(); for (let i = 0; i < 13; i++) { m4.makeTranslation(-0.096 + i * 0.016, 0.44, -0.115); fins.setMatrixAt(i, m4); } } internalsG.add(fins);
    box(0.17, 0.003, 0.002, M.led, 0, 0.525, 0.052).castShadow = false;
    box(0.18, 0.09, 0.13, M.internal, 0, 0.3, -0.02);
    const pcb = mesh(reg.g(new THREE.PlaneGeometry(0.21, 0.2)), M.pcb, internalsG); pcb.position.set(0, 1.07, 0.125);
    for (const [x, y, w, h] of [[-0.05, 1.1, 0.04, 0.04], [0.04, 1.05, 0.05, 0.03], [0.01, 1.13, 0.03, 0.02], [-0.06, 1.02, 0.03, 0.03]]) box(w, h, 0.006, M.rubber, x, y, 0.129);
    const canG = new THREE.Group(); canG.position.set(0, 0.96, -0.11); internalsG.add(canG);
    mesh(lathe(THREE, reg, [[0.0, -0.09], [0.028, -0.088], [0.034, -0.078], [0.034, 0.07], [0.028, 0.085], [0.01, 0.092], [0, 0.093]], 48), M.can, canG);
    const band = mesh(reg.g(new THREE.CylinderGeometry(0.0345, 0.0345, 0.05, 48, 1, true)), M.canBand, canG); band.position.y = 0.0;
    const valve = mesh(reg.g(new THREE.CylinderGeometry(0.011, 0.013, 0.03, 24)), M.rubber, canG); valve.position.y = -0.1;
    const line1 = mesh(staticTube(THREE, reg, [[0, 0.85, -0.11], [-0.02, 0.83, -0.02], [-0.07, 0.83, 0.1], [-0.1, 0.834, zP - 0.002]], 40, 8, { rx: 0.0028 }), M.canBand, internalsG);
    const line2 = mesh(staticTube(THREE, reg, [[0.05, 0.53, 0.05], [0.04, 0.68, 0.1], [0.0, 0.8, 0.15], [-0.1, 0.834, zP - 0.002]], 40, 8, { rx: 0.003 }), M.led, internalsG);
    void line1; void line2; void rf;
    A('internals', internalsG, 0, 0.62, 0.05); A('rf', internalsG, 0, 0.44, 0.06);
    internalsG.visible = false;
  }

  /* ── holstered handpiece + its dynamic cable A ── */
  const hp = buildHandpiece(THREE, reg, M, T, { detail: o.detail });
  hpG.position.set(...d.hp); hpG.scale.setScalar(d.hpScale); hpG.add(hp.group);
  // holstered copy: slightly more diffuse satin finish so it reads bright-silver at console scale (as in the brochure render)
  const chromeH = reg.m(M.chrome.clone()); chromeH.metalness = 0.8; chromeH.roughness = 0.3; chromeH.color.set(0xe9ebee); tameDirect(chromeH, 0.5, 0.3); hp.meshes.body.material = chromeH;
  for (const k of ['enable', 'controls', 'tip', 'electrode', 'R', 'M', 'minus', 'plus', 'waist', 'latch']) anchors[k] = hp.anchors[k];
  A('handpiece', hpG, 0, -0.09, 0.024);
  const cA = makeTube(THREE, hi ? 110 : 60, hi ? 12 : 8, { rx: 0.0034, dynamic: true });
  const cableA = new THREE.Mesh(cA.geometry, M.cable); cableA.castShadow = o.castShadow; cableA.frustumCulled = false; cableG.add(cableA); reg.g(cA.geometry);
  const restA = [[d.hp[0], d.hp[1] + (HP.tail + 0.002) * d.hpScale, d.hp[2]], [d.hp[0] - 0.001, 0.6, d.hp[2] - 0.022], [-0.106 * d.kx, 0.5, cz + 0.004], [-0.098 * d.kx, 0.4, cz], [-0.086 * d.kx, 0.32, cz], [-0.075 * d.kx, 0.262, cz + 0.001], [-0.047 * d.kx, 0.2235, cz + 0.001], [0.0, 0.211, cz + 0.001], [0.045 * d.kx, 0.2225, cz]].map((p) => new THREE.Vector3(...p));
  const ctrlA = restA.map((p) => p.clone()), curveA = new THREE.CatmullRomCurve3(ctrlA, false, 'catmullrom', 0.5);
  const sampA = []; for (let i = 0; i <= (hi ? 110 : 60); i++) sampA.push(new THREE.Vector3());
  const _tail = new THREE.Vector3(), _dT = new THREE.Vector3();

  /* ── contact shadow ── */
  let shadow = null;
  if (o.contactShadow) {
    const sm = reg.m(new THREE.MeshBasicMaterial({ map: T.shadow, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.9 }));
    const sg = reg.g(new THREE.PlaneGeometry(0.95, 0.95)); sg.rotateX(-Math.PI / 2);
    shadow = new THREE.Mesh(sg, sm); shadow.position.y = 0.0015; shadow.renderOrder = -1; shadow.userData.noHL = true; root.add(shadow);
  }

  /* ── highlight overlays ── */
  const HL = {};
  const hl = (key, objs) => { const mat = fresnelMat(THREE, reg); const list = objs.map((x) => addOverlay(THREE, mat, x)); HL[key] = { set(i) { list.forEach((l) => l.set(i)); } }; };
  hl('screen', [disc, display]); hl('handpiece', hp.bodyParts); hl('tip', [hp.tip.group]); hl('base', [baseG]); hl('badge', [badgeFace, badgeRim]);
  hl('bracket', [bracket]); hl('handles', shellG.children.filter((m) => m.name === 'handleLeft' || m.name === 'handleRight' || m.name === 'handleMount'));
  hl('panel', [panel]); hl('power', [pwrRing, pwr]); hl('shell', [shell]); hl('cables', [cB, cC, cD, cableA]);

  /* ── update ── */
  let screenKey = '';
  const svTmp = { ...SV_DEF }, _pp = {}, _hpP = { t: 0, tipInsert: 1, enablePressed: 0, electrodeGlow: 0, cooling: 0, buttonPress: null, buttonPressAmount: 1, tipGap: 0 };
  function update(params = {}) {
    const p = finiteParams(params, _pp), t = p.t || 0;
    // screen
    const sName = p.screen || 'logo';
    Object.assign(svTmp, SV_DEF, p.screenValues || {});
    const firingPhase = sName === 'treatment' && svTmp.status === 'firing' ? Math.floor((t * 0.9 % 1) * 60) : 0;
    const key = sName === 'treatment' || sName === 'activate' ? `${sName}|${svTmp.level}|${svTmp.cooling}|${svTmp.pulse}|${svTmp.density}|${svTmp.shots}|${svTmp.shotsTotal}|${svTmp.energyKJ}|${svTmp.ohm}|${svTmp.watt}|${svTmp.status}|${svTmp.selected}|${firingPhase}` : sName;
    if (key !== screenKey) { drawScreen(sctx, SW, SH, sName, svTmp, firingPhase / 60 / 0.9); screenTex.needsUpdate = true; screenKey = key; }
    const pulse = 0.55 + 0.45 * Math.sin(t * TAU * 0.9);
    dispMat.emissiveIntensity = sName === 'off' ? 0 : 1.15 + (p.highlight === 'screen' ? 0.12 * pulse : 0);
    M.power.emissiveIntensity = sName === 'off' ? 0.02 : 0.35;
    // rim light strip
    const g = clamp(p.rimGlow ?? 0.6);
    M.rim.emissiveIntensity = 0.03 + 1.25 * g * g; M.spill.opacity = 0.65 * g * g; spill.visible = g > 1e-3;
    // float & turntable
    const fl = clamp(p.float || 0), lift = fl * (0.03 + 0.008 * Math.sin(t * 1.25));
    floatG.position.y = lift; turnG.rotation.y = p.turntable || 0;
    if (shadow) { const s = 1 + lift * 5; shadow.scale.set(s, 1, s); shadow.material.opacity = 0.9 * clamp(1 - lift * 9, 0.25, 1); }
    // explode
    const e = clamp(p.explode || 0);
    // exploded anatomy: base stays grounded, everything else lifts, shell slides back, panel/screen/handpiece come forward
    const el = seg(e, 0, 0.5) * 0.2, es = seg(e, 0.05, 0.75), ef = seg(e, 0.12, 0.85), esc = seg(e, 0.22, 0.95), eh = seg(e, 0.3, 1);
    baseG.position.set(0, 0, 0);
    shellG.position.set(0, el, -0.52 * es);
    internalsG.position.set(0, el, 0.02 * es);
    frontG.position.set(0, el, 0.3 * ef);
    screenG.position.set(0, el + 0.05 * esc, 0.3 * ef + 0.24 * esc);
    hpG.scale.setScalar(d.hpScale); hpG.position.set(d.hp[0] - 0.24 * eh, d.hp[1] + el + 0.05 * eh, d.hp[2] + 0.3 * ef + 0.36 * eh);
    hpG.rotation.set(0.1 * eh, -0.55 * eh, 0.34 * eh);
    if (internalsG.children.length) { internalsG.visible = e > 1e-3; const si = 0.92 + 0.08 * seg(e, 0.1, 0.6); internalsG.scale.set(si, si, si); }
    // handpiece (holstered)
    _hpP.t = t; _hpP.tipInsert = p.tipInsert ?? 1; _hpP.enablePressed = p.enablePressed || 0; _hpP.electrodeGlow = p.electrodeGlow || 0; _hpP.cooling = p.cooling || 0;
    _hpP.buttonPress = p.buttonPress || null; _hpP.buttonPressAmount = p.buttonPressAmount ?? 1; _hpP.tipGap = 0.045 * eh;
    hp.update(_hpP);
    // cable A follows the handpiece tail and the front panel
    hpG.updateMatrix(); _tail.set(0, HP.tail + 0.002, 0).applyMatrix4(hpG.matrix); _dT.copy(_tail).sub(restA[0]);
    const n = restA.length - 1, F = frontG.position;
    for (let i = 0; i <= n; i++) {
      const w = i === 0 ? 0 : Math.min(1, (i / n) * 1.6), sag = i > 0 && i < n ? 0.05 * eh * Math.sin(Math.PI * i / n) : 0;
      ctrlA[i].set(restA[i].x + _dT.x * (1 - w) + F.x * w, restA[i].y + _dT.y * (1 - w) + F.y * w - sag, restA[i].z + _dT.z * (1 - w) + F.z * w);
    }
    for (let i = 0; i < sampA.length; i++) curveA.getPoint(i / (sampA.length - 1), sampA[i]);
    cA.set(sampA);
    // highlights
    for (const k in HL) HL[k].set(p.highlight === k ? pulse * 0.8 : 0);
  }
  update({});

  const parts = { root, float: floatG, turntable: turnG, base: baseG, shell: shellG, shellMesh: shell, rim: rimF, front: frontG, panel, spill, bracket, badge: badgeFace, screen: screenG, display, screenDisc: disc, power: pwr, handpiece: hpG, handpieceParts: hp, tip: hp.tip.group, cableA, cables: [cableA, cB, cC, cD], internals: internalsG, shadow, screenCanvas: scv };
  return {
    object3d: root, parts, handpiece: hp, dims: DIM, anchorNames: Object.keys(anchors),
    update,
    anchor(name, out = new THREE.Vector3()) { const a = anchors[name]; if (!a) return null; a.updateWorldMatrix(true, false); return out.setFromMatrixPosition(a.matrixWorld); },
    dispose() { root.removeFromParent(); reg.dispose(); },
  };
}
