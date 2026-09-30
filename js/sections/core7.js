// #core7 — YŌUMAGIC® 核心技术优势 hub + 个性化 3 大射频参数
// src: DA p.2 (7 项核心技术原文、3 大射频参数 1…8 / 1…4 / 0.7s…1.5s)
//      IFU p.9–10 (能量强度步进 0.5、制冷强度含义、1 个脉冲 = 0.1 s)
//      IFU p.14–15 (能量输出表空白 = 限制输出；p.15 能量水平 ↔ 制冷强度范围/默认；调节功率档位或脉冲时间时制冷档位自动回默认)
//      IFU p.15 (单发脉冲：治疗前冷却 → 射频传送 → 治疗后冷却) · IFU p.31 (图12 额定负载 100–250 Ω 全功率 175 W)

const C = {
  mint: '#43e6a8', jade: '#2bae7e', violet: '#8a5cf0', cool: '#7fd4ff', text: '#eceaf4',
  t2: '#a9a6ba', t3: '#6f6c82', line: 'rgba(255,255,255,0.10)', line2: 'rgba(255,255,255,0.18)',
};
const ACC = ['#43e6a8', '#2bae7e', '#7fd4ff', '#ffc45e', '#a07cff', '#f2a44b', '#6fe9c0'];
// brochure layout: 01/03/05/07 on the left, 02/04/06 on the right (degrees clockwise from 12 o'clock)
const ANG = [-38, 38, -76, 82, -114, 126, -152];
const TAU = Math.PI * 2;

// per-technology caption under the large visual; sim → shows DATA.disclaimers.sim
const CAPS = [
  { cap: '1 个脉冲对应 0.1 s（说明书 第 9 页）· 温度曲线为原理示意', sim: true },
  { cap: '脉冲时间 0.7–1.5 s，步进 0.1 s，即 7–15 个脉冲（说明书 第 9–10 页）' },
  { cap: '制冷强度 1–4：数值越大，治疗头端降温速率越快、温度越低（说明书 第 9 页）· 喷雾为示意' },
  { cap: '单发脉冲：治疗前冷却 → 射频传送 → 治疗后冷却（说明书 第 15 页）· 温度曲线为原理示意', sim: true },
  { cap: '原文：五端激活 + 四维验真（彩页 第 2 页）· 图形为示意，激活流程见“激活验真”章节' },
  { cap: '能量密度随功率档位 × 脉冲时间变化，分低 / 中 / 较高 / 高四级（说明书 第 14–15 页 能量输出表）' },
  { cap: '额定负载 100–250 Ω 内全功率输出 175 W（说明书 第 31 页 图12）· 阻抗波动为原理示意', sim: true },
];

/* ---------------- tiny canvas helpers ---------------- */
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const monoF = (s) => `${s}px "JetBrains Mono", ui-monospace, monospace`;
const sansF = (s, w = 400) => `${w} ${s}px "Noto Sans SC", "PingFang SC", system-ui, sans-serif`;
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sm = (t) => { t = cl(t); return t * t * (3 - 2 * t); };
const eo = (t) => 1 - Math.pow(1 - cl(t), 3);
const pingpong = (i, n) => { const m = i % (2 * n); return m <= n ? m : 2 * n - m; };
function txt(c, s, x, y, { color = C.t3, align = 'left', font = monoF(10), base = 'alphabetic' } = {}) {
  c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y);
}
function rrect(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
}
function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------------- glyphs: g(c, w, h, t, big, lib) ---------------- */
// 01 闪脉冲 — narrow 100 ms pulses, steady temperature rise
function g0(c, w, h, t, big, lib) {
  if (!big) {
    const x0 = w * 0.18, x1 = w * 0.82, yb = h * 0.63, yt = h * 0.37, per = w * 0.13, pw = w * 0.045;
    const span = x1 - x0 + per;
    c.strokeStyle = C.line2; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, yb + 0.5); c.lineTo(x1, yb + 0.5); c.stroke();
    for (let k = 0; k < 7; k++) {
      const x = x1 - ((t * w * 0.11 + k * per) % span);
      if (x < x0 - pw || x > x1) continue;
      const a = Math.sin(Math.PI * cl((x - x0) / (x1 - x0)));
      c.fillStyle = withAlpha(C.mint, 0.25 + 0.75 * a);
      c.shadowColor = C.mint; c.shadowBlur = 8 * a;
      rrect(c, x, yt, pw, yb - yt, 1.5); c.fill();
    }
    c.shadowBlur = 0;
    return;
  }
  const L = 34, R = w - 14, yb = h - 38, pt = yb - h * 0.2, pwid = R - L, slots = 10, sw = pwid / slots;
  const T = 4.6, ph = (t % T) / T, prog = cl(ph / 0.78);
  // axis + labels
  c.strokeStyle = C.line2; c.lineWidth = 1; c.beginPath(); c.moveTo(L, yb + 0.5); c.lineTo(R, yb + 0.5); c.stroke();
  for (let k = 0; k <= slots; k++) {
    const x = L + k * sw;
    c.strokeStyle = C.line; c.beginPath(); c.moveTo(x + 0.5, yb + 3); c.lineTo(x + 0.5, yb + 7); c.stroke();
  }
  txt(c, '0', L, yb + 20, { align: 'center' });
  txt(c, '0.5 s', L + pwid / 2, yb + 20, { align: 'center' });
  txt(c, '1.0 s', R, yb + 20, { align: 'right' });
  // pulses
  const lit = prog * slots;
  for (let k = 0; k < slots; k++) {
    const x = L + k * sw + sw * 0.29, bw = sw * 0.42;
    const on = cl(lit - k);
    rrect(c, x, pt, bw, yb - pt, 2);
    if (on > 0) {
      const cur = Math.floor(lit) === k && prog < 1;
      c.fillStyle = withAlpha(C.mint, 0.35 + 0.55 * on);
      c.shadowColor = C.mint; c.shadowBlur = cur ? 18 : 6; c.fill(); c.shadowBlur = 0;
    } else { c.strokeStyle = C.line2; c.lineWidth = 1; c.stroke(); }
  }
  // 100 ms bracket on 3rd pulse
  const bx = L + 2 * sw, by = pt - 10;
  c.strokeStyle = C.t3; c.lineWidth = 1; c.beginPath();
  c.moveTo(bx + 1, by + 4); c.lineTo(bx + 1, by); c.lineTo(bx + sw - 1, by); c.lineTo(bx + sw - 1, by + 4); c.stroke();
  txt(c, '100 ms', bx + sw / 2, by - 5, { align: 'center', color: C.t2 });
  // temperature curve (原理示意) — smooth, steady ramp with tiny per-pulse ripples
  const top = 18, bot = pt - 30, n = 90;
  const grad = c.createLinearGradient(L, 0, R, 0);
  grad.addColorStop(0, lib.heatCSS(0.42)); grad.addColorStop(1, lib.heatCSS(0.86));
  c.strokeStyle = grad; c.lineWidth = 2.2; c.lineJoin = 'round'; c.beginPath();
  const upto = prog;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * upto;
    const v = 1 - Math.pow(1 - u, 1.7) + 0.012 * Math.sin(u * slots * TAU) * (1 - u);
    const x = L + u * pwid, y = bot - v * (bot - top);
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke();
  if (upto > 0) {
    const v = 1 - Math.pow(1 - upto, 1.7);
    c.fillStyle = lib.heatCSS(0.45 + 0.4 * upto); c.shadowColor = c.fillStyle; c.shadowBlur = 14;
    c.beginPath(); c.arc(L + upto * pwid, bot - v * (bot - top), 3.5, 0, TAU); c.fill(); c.shadowBlur = 0;
  }
  txt(c, '温度（原理示意）', L, top - 4, { font: sansF(11), color: C.t2 });
  txt(c, 'RF', L - 8, yb - 4, { align: 'right' });
}

// 02 动态脉冲 — long / short pulse trains (7–15 pulses)
function g1(c, w, h, t, big) {
  if (!big) {
    const n = 7 + Math.round(8 * (0.5 - 0.5 * Math.cos(t * 1.05)));
    const x0 = w * 0.2, x1 = w * 0.8, slot = (x1 - x0) / 15, yb = h * 0.62, yt = h * 0.38;
    for (let k = 0; k < 15; k++) {
      const on = k < n;
      c.fillStyle = on ? withAlpha(C.jade, 0.95) : 'rgba(255,255,255,0.10)';
      rrect(c, x0 + k * slot + slot * 0.22, yt, slot * 0.56, yb - yt, 1); c.fill();
    }
    c.strokeStyle = withAlpha(C.jade, 0.8); c.lineWidth = 1.2; c.beginPath();
    const ex = x0 + n * slot;
    c.moveTo(x0, yb + 6); c.lineTo(ex, yb + 6); c.moveTo(ex, yb + 3); c.lineTo(ex, yb + 9); c.moveTo(x0, yb + 3); c.lineTo(x0, yb + 9); c.stroke();
    return;
  }
  const L = 30, R = w - 30, idx = pingpong(Math.floor(t / 0.62), 8), p = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5][idx];
  const n = Math.round(p * 10), f = cl(((t / 0.62) % 1) / 0.35);
  const slot = (R - L) / 15, yt = 40, yb = h * 0.58;
  txt(c, `${p.toFixed(1)} s`, L, 24, { font: '300 22px Montserrat, sans-serif', color: C.text });
  txt(c, `= ${n} 个脉冲 × 0.1 s`, L + 62, 24, { font: sansF(12), color: C.t2 });
  for (let k = 0; k < 15; k++) {
    const on = k < n - 1 ? 1 : k === n - 1 ? f : 0;
    const x = L + k * slot + slot * 0.25, bw = slot * 0.5;
    rrect(c, x, yt + 4, bw, yb - yt - 4, 2);
    if (on > 0) {
      const hh = (yb - yt - 4) * (0.3 + 0.7 * on);
      rrect(c, x, yb - hh, bw, hh, 2);
      c.fillStyle = withAlpha(C.jade, 0.45 + 0.5 * on); c.shadowColor = C.jade; c.shadowBlur = 8; c.fill(); c.shadowBlur = 0;
    } else { c.strokeStyle = C.line; c.lineWidth = 1; c.stroke(); }
  }
  // scale 0.7 … 1.5
  const sy = h - 34;
  c.strokeStyle = C.line2; c.lineWidth = 2; c.beginPath(); c.moveTo(L, sy); c.lineTo(R, sy); c.stroke();
  const tx = (i) => L + (i / 8) * (R - L);
  c.strokeStyle = withAlpha(C.jade, 0.9); c.beginPath(); c.moveTo(L, sy); c.lineTo(tx(idx), sy); c.stroke();
  for (let i = 0; i <= 8; i++) {
    c.fillStyle = i <= idx ? C.jade : C.t3; c.beginPath(); c.arc(tx(i), sy, i === idx ? 5 : 2, 0, TAU); c.fill();
  }
  txt(c, '0.7 s · 短脉冲', L, sy + 20, { font: sansF(11), color: C.t2 });
  txt(c, '长脉冲 · 1.5 s', R, sy + 20, { font: sansF(11), color: C.t2, align: 'right' });
}

function snowflake(c, x, y, r, rot, color, lw = 1.4) {
  c.save(); c.translate(x, y); c.rotate(rot); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    c.rotate(TAU / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r);
    c.moveTo(0, -r * 0.55); c.lineTo(-r * 0.24, -r * 0.78); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.24, -r * 0.78);
    c.stroke();
  }
  c.restore();
}
// 03 多重制冷调节 — cooling levels 1–4
function g2(c, w, h, t, big) {
  if (!big) {
    const L = 1 + (Math.floor(t / 0.85) % 4), cx = w / 2, cy = h / 2;
    snowflake(c, cx, cy, w * 0.15, t * 0.35, C.cool, 1.4);
    for (let k = 1; k <= 4; k++) {
      const r = w * (0.2 + 0.052 * k);
      c.strokeStyle = k <= L ? withAlpha(C.cool, 0.35 + 0.16 * k) : 'rgba(255,255,255,0.08)';
      c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.72, Math.PI * 2.28); c.stroke();
    }
    return;
  }
  const L = 1 + (Math.floor(t / 1.2) % 4);
  const sx = w * 0.17, sy = h * 0.46;
  c.shadowColor = C.cool; c.shadowBlur = 10 + 4 * L;
  snowflake(c, sx, sy, Math.min(h * 0.26, w * 0.13), t * 0.25, C.cool, 1.8); c.shadowBlur = 0;
  txt(c, '制冷强度', sx, h - 18, { font: sansF(12), color: C.t2, align: 'center' });
  const x0 = w * 0.36, x1 = w - 16, cw = (x1 - x0) / 4, top = 34, bot = h - 40;
  for (let k = 1; k <= 4; k++) {
    const cx = x0 + (k - 0.5) * cw, act = k === L;
    // nozzle
    c.fillStyle = act ? C.cool : 'rgba(255,255,255,0.18)'; rrect(c, cx - 9, top, 18, 7, 2); c.fill();
    // spray particles, density ∝ level
    const cnt = 7 * k;
    for (let p = 0; p < cnt; p++) {
      const ph = (t * (0.55 + 0.1 * k) + hash(k * 97 + p)) % 1;
      const spread = (hash(p * 13 + k) - 0.5) * cw * 0.7 * ph;
      const y = top + 10 + ph * (bot - top - 26);
      c.fillStyle = withAlpha(C.cool, (act ? 0.85 : 0.28) * (1 - ph));
      c.beginPath(); c.arc(cx + spread, y, act ? 1.7 : 1.3, 0, TAU); c.fill();
    }
    // cold plate (colder = brighter & thicker)
    const th = 3 + k * 2.5;
    c.fillStyle = withAlpha(C.cool, (act ? 0.25 : 0.1) + k * (act ? 0.15 : 0.05));
    if (act) { c.shadowColor = C.cool; c.shadowBlur = 16; }
    rrect(c, cx - cw * 0.36, bot - th, cw * 0.72, th, 2); c.fill(); c.shadowBlur = 0;
    txt(c, String(k), cx, bot + 20, { font: act ? '500 16px Montserrat, sans-serif' : '300 14px Montserrat, sans-serif', color: act ? C.cool : C.t3, align: 'center' });
  }
  c.strokeStyle = C.line2; c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + cw * 0.2, 12); c.lineTo(x1 - 4, 12); c.lineTo(x1 - 10, 8); c.stroke();
  txt(c, '降温更快 · 温度更低', x1 - 4, 26, { font: sansF(10), color: C.t3, align: 'right' });
}

// 04 多维智能温控 — pre-cool → RF → post-cool
function g3(c, w, h, t, big, lib) {
  if (!big) {
    const cx = w / 2, top = h * 0.22, bot = h * 0.64, tw = w * 0.1, br = w * 0.09;
    const lvl = 0.52 + 0.07 * Math.sin(t * 1.4);
    c.strokeStyle = C.line2; c.lineWidth = 1.3;
    rrect(c, cx - tw / 2, top, tw, bot - top + 4, tw / 2); c.stroke();
    c.beginPath(); c.arc(cx, bot + br * 0.8, br, 0, TAU); c.stroke();
    const fy = bot - (bot - top) * lvl;
    const g = c.createLinearGradient(0, bot, 0, top); g.addColorStop(0, '#ffc45e'); g.addColorStop(1, C.cool);
    c.fillStyle = g; rrect(c, cx - tw / 2 + 2.5, fy, tw - 5, bot - fy + 4, 3); c.fill();
    c.fillStyle = '#ffc45e'; c.beginPath(); c.arc(cx, bot + br * 0.8, br - 2.5, 0, TAU); c.fill();
    for (let k = 0; k < 3; k++) {
      const a = t * 1.2 + (k * TAU) / 3, r = w * 0.3;
      c.fillStyle = withAlpha(C.cool, 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(a * 2)));
      c.beginPath(); c.arc(cx + Math.cos(a) * r, h * 0.47 + Math.sin(a) * r * 0.55, 2, 0, TAU); c.fill();
    }
    return;
  }
  const L = 16, R = w - 16, bw = R - L, segs = [0.27, 0.73];
  const barY = h - 46, barH = 12, top = 30, bot = barY - 26;
  const T = 5.2, u0 = cl(((t % T) / T) / 0.86);
  const names = ['治疗前冷却', '射频传送', '治疗后冷却'];
  const cols = [C.cool, '#f0603f', C.cool];
  const bounds = [0, segs[0], segs[1], 1];
  for (let s = 0; s < 3; s++) {
    const x = L + bounds[s] * bw, ww = (bounds[s + 1] - bounds[s]) * bw - 3;
    const active = u0 >= bounds[s] && u0 < bounds[s + 1];
    c.fillStyle = withAlpha(cols[s], active ? 0.55 : 0.16);
    rrect(c, x, barY, ww, barH, 6); c.fill();
    txt(c, names[s], x + ww / 2, barY + barH + 18, { font: sansF(11, active ? 500 : 400), color: active ? C.text : C.t3, align: 'center' });
  }
  // curves (原理示意)
  const deep = (u) => (u < segs[0] ? 0.12 : u < segs[1] ? 0.12 + 0.72 * sm((u - segs[0]) / (segs[1] - segs[0])) : 0.84 - 0.06 * sm((u - segs[1]) / (1 - segs[1])));
  const epi = (u) => (u < segs[0] ? 0.3 - 0.16 * sm(u / segs[0]) : u < segs[1] ? 0.14 + 0.12 * sm((u - segs[0]) / (segs[1] - segs[0])) : 0.26 - 0.16 * sm((u - segs[1]) / (1 - segs[1])));
  const Y = (v) => bot - v * (bot - top);
  c.strokeStyle = C.line; c.setLineDash([2, 4]); c.beginPath();
  for (const b of [segs[0], segs[1]]) { c.moveTo(L + b * bw, top - 6); c.lineTo(L + b * bw, barY - 4); }
  c.stroke(); c.setLineDash([]);
  const drawCurve = (f, color, lw) => {
    c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'round'; c.beginPath();
    for (let i = 0; i <= 80; i++) { const u = (i / 80) * u0; const x = L + u * bw, y = Y(f(u)); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
    c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 12;
    c.beginPath(); c.arc(L + u0 * bw, Y(f(u0)), 3.4, 0, TAU); c.fill(); c.shadowBlur = 0;
  };
  drawCurve(deep, lib.heatCSS(0.72), 2.2);
  drawCurve(epi, C.cool, 2.2);
  const lx = Math.min(L + u0 * bw + 8, R - 52), yd = Y(deep(u0)), ye = Y(epi(u0));
  const sep = Math.max(0, 16 - Math.abs(ye - yd));
  txt(c, '深层组织', lx, (yd <= ye ? yd - sep / 2 : yd + sep / 2) - 4, { font: sansF(11), color: lib.heatCSS(0.8) });
  txt(c, '表皮', lx, (ye > yd ? ye + sep / 2 : ye - sep / 2) + 12, { font: sansF(11), color: C.cool });
  txt(c, '温度（原理示意）', L, top - 12, { font: sansF(11), color: C.t2 });
  // playhead
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(L + u0 * bw, top - 4); c.lineTo(L + u0 * bw, barY + barH + 2); c.stroke();
  // spray during cooling phases
  if (u0 < segs[0] || u0 >= segs[1]) {
    for (let p = 0; p < 14; p++) {
      const ph = (t * 1.3 + hash(p * 7.3)) % 1;
      c.fillStyle = withAlpha(C.cool, 0.7 * (1 - ph));
      c.beginPath(); c.arc(L + u0 * bw + (hash(p) - 0.5) * 26 * ph, barY - 4 - ph * 22, 1.3, 0, TAU); c.fill();
    }
  }
}

// 05 5+4 激活验真 — pentagon (5) + square (4) → check
function g4(c, w, h, t, big) {
  const T = 5, s = t % T;
  const fade = s > 4.5 ? 1 - (s - 4.5) / 0.5 : 1;
  const cx = big ? w * 0.3 : w / 2, cy = big ? h * 0.5 : h / 2;
  const R5 = big ? Math.min(h * 0.4, w * 0.2) : w * 0.3, R4 = R5 * 0.5;
  const p5 = Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + (k * TAU) / 5; return [cx + Math.cos(a) * R5, cy + Math.sin(a) * R5]; });
  const p4 = Array.from({ length: 4 }, (_, k) => { const a = -Math.PI / 2 + (k * TAU) / 4; return [cx + Math.cos(a) * R4, cy + Math.sin(a) * R4]; });
  const on5 = (k) => cl((s - 0.25 - k * 0.3) / 0.25) * fade;
  const on4 = (k) => cl((s - 1.95 - k * 0.3) / 0.25) * fade;
  const poly = (pts, on, col, lw) => {
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length], o = Math.min(on(k), on((k + 1) % pts.length));
      c.strokeStyle = o > 0 ? withAlpha(col, 0.25 + 0.6 * o) : 'rgba(255,255,255,0.10)'; c.lineWidth = lw;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    for (let k = 0; k < pts.length; k++) {
      const o = on(k);
      c.fillStyle = o > 0 ? col : 'rgba(255,255,255,0.18)';
      if (o > 0) { c.shadowColor = col; c.shadowBlur = big ? 14 : 8; }
      c.beginPath(); c.arc(pts[k][0], pts[k][1], (big ? 4.5 : 2.6) * (0.7 + 0.3 * (o || 0.6)), 0, TAU); c.fill(); c.shadowBlur = 0;
    }
  };
  poly(p5, on5, C.mint, big ? 1.4 : 1.1);
  poly(p4, on4, '#a07cff', big ? 1.4 : 1.1);
  const ck = cl((s - 3.3) / 0.45) * fade;
  if (ck > 0) {
    const k = big ? R4 * 0.55 : R4 * 0.6;
    const pts = [[cx - k, cy + k * 0.05], [cx - k * 0.25, cy + k * 0.7], [cx + k, cy - k * 0.6]];
    const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
    const d = ck * (l1 + l2);
    c.strokeStyle = '#fff'; c.lineWidth = big ? 3 : 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = C.mint; c.shadowBlur = 12;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    if (d <= l1) c.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * (d / l1), pts[0][1] + (pts[1][1] - pts[0][1]) * (d / l1));
    else { c.lineTo(pts[1][0], pts[1][1]); const e = (d - l1) / l2; c.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * e, pts[1][1] + (pts[2][1] - pts[1][1]) * e); }
    c.stroke(); c.shadowBlur = 0;
  }
  if (!big) return;
  const lx = w * 0.58;
  const row = (y, label, n, on, col) => {
    txt(c, label, lx, y, { font: sansF(15, 500), color: C.text });
    for (let k = 0; k < n; k++) {
      const o = on(k);
      c.fillStyle = o > 0 ? col : 'rgba(255,255,255,0.12)';
      c.beginPath(); c.arc(lx + 6 + k * 18, y + 20, 5, 0, TAU); c.fill();
    }
  };
  row(h * 0.36, '五端激活', 5, on5, C.mint);
  txt(c, '+', lx, h * 0.36 + 52, { font: '300 18px Montserrat, sans-serif', color: C.t3 });
  row(h * 0.36 + 76, '四维验真', 4, on4, '#a07cff');
}

// 06 可视化能量密度 — four-band gauge (IFU energy table)
const DMIN = 6.3, DMAX = 38.8;
function g5(c, w, h, t, big, lib) {
  const bands = lib.BANDS;
  const cx = big ? w * 0.34 : w / 2, cy = big ? h * 0.8 : h * 0.62;
  const R = big ? Math.min(w * 0.27, h * 0.62) : w * 0.31;
  const ang = (d) => Math.PI + ((d - DMIN) / (DMAX - DMIN)) * Math.PI;
  const lw = big ? 12 : 5;
  bands.forEach((b, i) => {
    const a0 = ang(i === 0 ? DMIN : bands[i - 1].max) + 0.03, a1 = ang(b.max) - 0.03;
    c.strokeStyle = b.hex; c.globalAlpha = 0.9; c.lineWidth = lw; c.lineCap = 'butt';
    c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke(); c.globalAlpha = 1;
  });
  let v, lv = 0, pl = 0;
  if (big) {
    const EX = [[2, 1.0], [3, 1.0], [4, 1.1], [5, 1.0], [6, 1.0], [7, 0.8]];
    const step = 1.9, i = Math.floor(t / step) % EX.length, prev = EX[(i + EX.length - 1) % EX.length];
    const e = eo(((t % step) / step) / 0.4);
    const d0 = lib.density(prev[0], prev[1]), d1 = lib.density(EX[i][0], EX[i][1]);
    v = d0 + (d1 - d0) * e; lv = EX[i][0]; pl = EX[i][1];
  } else v = DMIN + (DMAX - DMIN) * (0.5 - 0.5 * Math.cos(t * 0.8));
  const a = ang(v);
  const nl = R * (big ? 0.78 : 0.82);
  c.strokeStyle = '#fff'; c.lineWidth = big ? 2.4 : 1.6; c.lineCap = 'round';
  c.shadowColor = bandHex(lib, v); c.shadowBlur = 12;
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * nl, cy + Math.sin(a) * nl); c.stroke(); c.shadowBlur = 0;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, big ? 5 : 3, 0, TAU); c.fill();
  if (!big) return;
  // ticks & labels
  [DMIN, 16.3, 23.8, 31.3, DMAX].forEach((d) => {
    const aa = ang(d), r1 = R + lw / 2 + 4, r2 = R + lw / 2 + 16, end = d === DMIN || d === DMAX;
    // end labels sit under the arc ends so they never collide with the end ticks
    if (end) txt(c, d.toFixed(1), cx + Math.cos(aa) * R, cy + lw / 2 + 16, { align: 'center', color: C.t3 });
    else txt(c, d.toFixed(1), cx + Math.cos(aa) * r2, cy + Math.sin(aa) * r2 + 4, { align: 'center', color: C.t3 });
    c.strokeStyle = C.line2; c.lineWidth = 1; c.beginPath(); c.moveTo(cx + Math.cos(aa) * (R - lw / 2 - 2), cy + Math.sin(aa) * (R - lw / 2 - 2)); c.lineTo(cx + Math.cos(aa) * r1, cy + Math.sin(aa) * r1); c.stroke();
  });
  bands.forEach((b, i) => {
    const mid = ((i === 0 ? DMIN : bands[i - 1].max) + b.max) / 2, aa = ang(mid), rr = R - lw - 14;
    txt(c, b.label, cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr + 4, { font: sansF(11), color: b.hex, align: 'center' });
  });
  const bx = w * 0.7, band = lib.bandOf(lib.density(lv, pl));
  txt(c, `功率档位 ${lv.toFixed(1)} · ${lib.levelPower(lv)} W`, bx, h * 0.3, { font: sansF(12), color: C.t2 });
  txt(c, `脉冲时间 ${pl.toFixed(1)} s`, bx, h * 0.3 + 20, { font: sansF(12), color: C.t2 });
  txt(c, v.toFixed(1), bx, h * 0.3 + 66, { font: '300 38px Montserrat, sans-serif', color: C.text });
  txt(c, 'J/cm²', bx, h * 0.3 + 86, { color: C.t3 });
  c.fillStyle = withAlpha(band.hex, 0.18); rrect(c, bx, h * 0.3 + 96, 56, 22, 11); c.fill();
  c.fillStyle = band.hex; c.beginPath(); c.arc(bx + 12, h * 0.3 + 107, 3.5, 0, TAU); c.fill();
  txt(c, band.label, bx + 21, h * 0.3 + 111.5, { font: sansF(12, 500), color: band.hex });
}
const bandHex = (lib, v) => lib.bandOf(v).hex;

// 07 AI 能量匹配 — jittery impedance in, flat power out
function shotR(i) { return 100 + 150 * (0.15 + 0.7 * hash(i * 3.17 + 1.3)); } // 原理示意: 100–250 Ω
function g6(c, w, h, t, big) {
  if (!big) {
    const cy = h / 2, x0 = w * 0.16, xm0 = w * 0.42, xm1 = w * 0.58, x1 = w * 0.84, seg = (xm0 - x0) / 5;
    c.strokeStyle = withAlpha('#a07cff', 0.9); c.lineWidth = 1.4; c.lineJoin = 'round'; c.beginPath();
    const tick = Math.floor(t * 3.2);
    for (let k = 0; k <= 5; k++) {
      const y = cy + (hash(tick + k * 1.7) - 0.5) * h * 0.34;
      k ? c.lineTo(x0 + k * seg, y) : c.moveTo(x0, y);
    }
    c.stroke();
    // node cluster
    for (let k = 0; k < 3; k++) {
      const a = t * 1.6 + (k * TAU) / 3;
      c.fillStyle = k === Math.floor(t * 3) % 3 ? C.mint : withAlpha(C.mint, 0.45);
      c.beginPath(); c.arc(w / 2 + Math.cos(a) * w * 0.055, cy + Math.sin(a) * w * 0.055, 2.3, 0, TAU); c.fill();
    }
    c.strokeStyle = C.mint; c.lineWidth = 1.8; c.shadowColor = C.mint; c.shadowBlur = 8;
    c.beginPath(); c.moveTo(xm1, cy); c.lineTo(x1, cy); c.stroke(); c.shadowBlur = 0;
    return;
  }
  const L = 40, xm0 = w * 0.44, xm1 = w * 0.56, R = w - 16, top = 34, bot = h - 40, cy = (top + bot) / 2;
  const Yr = (r) => bot - ((r - 75) / (275 - 75)) * (bot - top);
  // input band 100–250
  c.fillStyle = 'rgba(160,124,255,0.07)'; c.fillRect(L, Yr(250), xm0 - L, Yr(100) - Yr(250));
  c.strokeStyle = C.line; c.setLineDash([3, 4]); c.beginPath();
  c.moveTo(L, Yr(250)); c.lineTo(xm0, Yr(250)); c.moveTo(L, Yr(100)); c.lineTo(xm0, Yr(100)); c.stroke(); c.setLineDash([]);
  txt(c, '250 Ω', L - 4, Yr(250) + 4, { align: 'right' });
  txt(c, '100 Ω', L - 4, Yr(100) + 4, { align: 'right' });
  const rate = 2.2, sp = t * rate, nSeg = 7, sw = (xm0 - L) / nSeg;
  c.strokeStyle = '#a07cff'; c.lineWidth = 1.8; c.lineJoin = 'round'; c.beginPath();
  const frac = sp % 1, base = Math.floor(sp);
  let first = true;
  for (let k = -1; k <= nSeg; k++) {
    const x = cl(L + (k - frac + 1) * sw, L, xm0), x2 = cl(L + (k - frac + 2) * sw, L, xm0);
    const y = Yr(shotR(base - nSeg + k));
    if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y);
    c.lineTo(x2, y);
  }
  c.stroke();
  const rNow = shotR(base);
  txt(c, `${Math.round(rNow)} Ω`, L, top - 12, { font: '300 18px Montserrat, sans-serif', color: '#c9b6ff' });
  txt(c, '阻抗 · 逐发变化', L + 64, top - 13, { font: sansF(11), color: C.t3 });
  // network
  const nx = (xm0 + xm1) / 2, lay = [[-1, 3], [0, 4], [1, 3]];
  const pts = lay.map(([col, n]) => Array.from({ length: n }, (_, j) => [nx + col * (xm1 - xm0) * 0.42, cy + (j - (n - 1) / 2) * 20]));
  c.lineWidth = 1;
  for (let a = 0; a < 2; a++) for (const p of pts[a]) for (const q of pts[a + 1]) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 - (p[1] + q[1]) * 0.05 - a);
    c.strokeStyle = withAlpha(C.mint, 0.08 + 0.22 * pulse); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
  }
  pts.flat().forEach((p, i) => { c.fillStyle = withAlpha(C.mint, 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 4 + i))); c.beginPath(); c.arc(p[0], p[1], 3, 0, TAU); c.fill(); });
  c.strokeStyle = 'rgba(160,124,255,0.5)'; c.beginPath(); c.moveTo(xm0, Yr(rNow)); c.lineTo(pts[0][1][0] - 4, pts[0][1][1]); c.stroke();
  c.strokeStyle = withAlpha(C.mint, 0.6); c.beginPath(); c.moveTo(pts[2][1][0] + 4, pts[2][1][1]); c.lineTo(xm1 + 8, cy); c.stroke();
  txt(c, 'AI 匹配', nx, bot + 6, { font: sansF(10), color: C.t3, align: 'center' });
  // output flat line with per-shot RF bursts
  const ox = xm1 + 8;
  c.strokeStyle = C.mint; c.lineWidth = 2.4; c.shadowColor = C.mint; c.shadowBlur = 10;
  c.beginPath(); c.moveTo(ox, cy); c.lineTo(R, cy); c.stroke(); c.shadowBlur = 0;
  txt(c, '175 W', R, top - 12, { font: '300 18px Montserrat, sans-serif', color: C.mint, align: 'right' });
  txt(c, '输出功率 · 全功率', R - 58, top - 13, { font: sansF(11), color: C.t3, align: 'right' });
  for (let k = 0; k < 6; k++) {
    const x = ox + ((k + frac) / 6) * (R - ox);
    c.fillStyle = withAlpha(C.mint, 0.5); c.beginPath(); c.arc(x, cy, 2, 0, TAU); c.fill();
  }
}

const GLYPHS = [g0, g1, g2, g3, g4, g5, g6];
const onceVisible = (el, fn, threshold = 0.2) => { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold }); io.observe(el); };


/* ---------------- module ---------------- */
export default {
  id: 'core7',
  nav: '核心技术',
  async init(root, ctx) {
    const { gsap, lib, data, reduced } = ctx;
    const items = data.core7;
    const hl = (it) => {
      let s = it.text;
      if (it.key.includes('+')) s = s.replace('五端', '<em>五端</em>').replace('四维', '<em>四维</em>');
      else s = s.replace(it.key, `<em>${it.key}</em>`);
      return s.split('，').join('<br>');
    };
    const bandCool = (b) => (b.coolRange.length > 1 ? `${b.coolRange[0]}–${b.coolRange[b.coolRange.length - 1]}` : `${b.coolRange[0]}`);

    root.innerHTML = `
      <div class="wrap wrap--wide c7">
        <header class="sec-head c7-head">
          <span class="eyebrow" data-reveal>02 · CORE TECHNOLOGY</span>
          <h2 class="h1" data-reveal><span class="c7-word">YŌUMAGIC<sup>®</sup></span> 核心技术优势</h2>
          <p class="lead" data-reveal>七项核心技术，覆盖脉冲、制冷、温控、验真、能量密度与能量匹配。悬停或轻点任一节点，查看说明并跳转到对应的交互演示。</p>
        </header>

        <div class="c7-hub">
          <div class="c7-stage" aria-label="七项核心技术">
            <svg class="c7-lines" aria-hidden="true"></svg>
            <div class="c7-halo" aria-hidden="true"></div>
            <div class="c7-nmpa num" aria-hidden="true">YM5</div>
            <img class="c7-device" src="assets/img/device.webp" width="496" height="1186" alt="YOUMAGIC YM5 射频皮肤治疗仪主机" decoding="async" />
            ${items.map((it, i) => `
              <div class="c7-node" data-i="${i}" data-side="${ANG[i] < 0 ? 'l' : 'r'}" style="--acc:${ACC[i]}">
                <span class="c7-node__num num" aria-hidden="true">${it.n}</span>
                <button class="c7-orb" type="button" aria-pressed="false" aria-controls="c7-detail" aria-label="${it.n} ${it.title}">
                  <svg class="c7-orb__ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" pathLength="1"/></svg>
                  <canvas class="c7-orb__cv" aria-hidden="true"></canvas>
                </button>
                <div class="c7-node__label"><span class="c7-node__n mono">${it.n}</span><span class="c7-node__t">${it.title}</span></div>
                <div class="c7-node__body">
                  <p>${hl(it)}</p>
                  <a class="c7-more" href="${it.anchor}">深入了解 <span aria-hidden="true">→</span></a>
                </div>
              </div>`).join('')}
          </div>

          <aside class="c7-detail card card--glass" id="c7-detail">
            <div class="c7-detail__bgnum num" aria-hidden="true">01</div>
            <div class="c7-detail__top">
              <span class="c7-detail__idx mono"><b>01</b> / 07</span>
              <span class="tag-src">来源：彩页 第 2 页</span>
            </div>
            <div class="c7-detail__viz"><canvas aria-hidden="true"></canvas></div>
            <p class="c7-detail__cap micro"></p>
            <div class="c7-detail__copy" aria-live="polite">
              <h3 class="c7-detail__title"></h3>
              <p class="c7-detail__text"></p>
            </div>
            <div class="c7-detail__foot">
              <button class="btn c7-detail__go" type="button">深入了解 <span aria-hidden="true">→</span></button>
              <div class="c7-dots" role="group" aria-label="选择核心技术">
                ${items.map((it, i) => `<button type="button" data-i="${i}" aria-label="${it.n} ${it.title}"><i></i></button>`).join('')}
              </div>
            </div>
            <p class="c7-detail__sim disclaimer">${data.disclaimers.sim}</p>
          </aside>
        </div>

        <div class="c7-trio">
          <div class="c7-lock" data-reveal>
            <div class="c7-lock__caps mono" aria-hidden="true">HIGH<br>ENERGY<br>MONOPOLAR<br>RF</div>
            <div class="c7-lock__words" role="heading" aria-level="3">
              <span class="c7-lock__w">个性化</span>
              <span class="c7-three" aria-label="3 大射频参数"><span class="c7-three__d num" aria-hidden="true">3</span><span class="c7-three__tag" aria-hidden="true">射频参数</span><span class="c7-three__da" aria-hidden="true">大</span></span>
              <span class="c7-lock__w">可调节</span>
            </div>
            <p class="c7-lock__sub small">功率档位 × 脉冲时间决定每一发的能量密度，制冷强度对应治疗头端的制冷量——三项参数均可按皮肤状态调节。试着按下 <b>−</b> / <b>+</b>。</p>
            <div class="c7-eq" aria-live="polite">
              <div class="c7-eq__t"><span class="mono">ENERGY DENSITY</span>能量密度 = 输出功率 × 脉冲时间 ÷ 治疗面积</div>
              <div class="c7-eq__row">
                <span class="c7-eq__term"><b class="num" data-e="w">–</b><i>W</i></span>
                <span class="c7-eq__op" aria-hidden="true">×</span>
                <span class="c7-eq__term"><b class="num" data-e="t">–</b><i>s</i></span>
                <span class="c7-eq__op" aria-hidden="true">÷</span>
                <span class="c7-eq__term"><b class="num">4.0</b><i>cm²</i></span>
                <span class="c7-eq__op" aria-hidden="true">=</span>
                <span class="c7-eq__term c7-eq__res"><b class="num" data-e="d">–</b><i>J/cm²</i></span>
              </div>
              <div class="c7-eq__scale" aria-hidden="true">
                ${lib.BANDS.map((b, i) => `<span style="--c:${b.hex};flex:${(b.max - (i ? lib.BANDS[i - 1].max : 6.3)).toFixed(1)}"><em>${b.label}</em></span>`).join('')}
                <i class="c7-eq__mk"></i>
              </div>
              <div class="c7-eq__ticks mono" aria-hidden="true">${[6.3, 16.3, 23.8, 31.3, 38.8].map((d) => `<span style="left:${(((d - 6.3) / 32.5) * 100).toFixed(2)}%">${d.toFixed(1)}</span>`).join('')}</div>
              <p class="micro c7-eq__src">治疗面积 4.0 cm²（YM5-TP4-900，说明书 第 11 页）；计算值与说明书 第 14–15 页能量输出表一致。</p>
            </div>
          </div>

          <div class="c7-panel card" data-reveal>
            ${[
              { k: 'power', label: '功率档位', rng: '1 ··· 8', n: 16 },
              { k: 'cooling', label: '制冷强度', rng: '1 ··· 4', n: 4 },
              { k: 'pulse', label: '脉冲时间', rng: '0.7s ··· 1.5s', n: 9 },
            ].map((p) => `
              <div class="c7-p" data-k="${p.k}">
                <div class="c7-p__head">
                  <span class="c7-p__label">${p.label}</span>
                  <span class="c7-p__rng mono">${p.rng}</span>
                  <output class="c7-p__val num" aria-live="polite">–</output>
                </div>
                <div class="c7-p__ctl">
                  <button class="c7-p__btn" type="button" data-d="-1" aria-label="${p.label} 减">−</button>
                  <div class="c7-p__bar" data-n="${p.n}">
                    <div class="c7-p__ticks">${Array.from({ length: p.n }, (_, i) => `<i data-j="${i}">${p.k === 'cooling' ? snowSVG : ''}</i>`).join('')}</div>
                  </div>
                  <button class="c7-p__btn" type="button" data-d="1" aria-label="${p.label} 加">+</button>
                </div>
                <div class="c7-p__sub micro"></div>
              </div>`).join('')}
            <div class="c7-out" aria-live="polite">
              <div class="c7-out__i"><span class="c7-out__k">输出功率</span><span class="c7-out__v num" data-o="w">–</span><span class="c7-out__u">W</span></div>
              <div class="c7-out__i"><span class="c7-out__k">能量密度</span><span class="c7-out__v num" data-o="d">–</span><span class="c7-out__u">J/cm²</span></div>
              <div class="c7-out__i"><span class="c7-out__k">能量水平</span><span class="c7-out__band" data-o="b"><i></i><span></span></span></div>
              <div class="c7-out__i"><span class="c7-out__k">制冷强度范围</span><span class="c7-out__v num" data-o="c">–</span><span class="c7-out__u" data-o="cd"></span></div>
            </div>
            <p class="c7-msg small" aria-live="polite"></p>
            <p class="note">来源：彩页 第 2 页（参数范围标注 1…8 / 1…4 / 0.7s…1.5s）；使用说明书 第 9–10 页（能量强度步进 0.5、制冷强度步进 1、脉冲时间步进 0.1 s = 1 个脉冲），第 14–15 页（能量输出表：0.5–8 档 = 25–175 W；能量水平与制冷强度匹配表），第 11 页（治疗面积 4.0 cm²）。<a href="#console" class="c7-link">在完整操作台中体验 →</a></p>
          </div>
        </div>
      </div>`;

    /* ================= orbit hub ================= */
    const stage = root.querySelector('.c7-stage');
    const svgEl = root.querySelector('.c7-lines');
    const nodes = [...root.querySelectorAll('.c7-node')];
    const orbs = nodes.map((n) => n.querySelector('.c7-orb'));
    const rings = nodes.map((n) => n.querySelector('.c7-orb__ring circle'));
    const detail = root.querySelector('.c7-detail');
    const dEls = {
      bg: detail.querySelector('.c7-detail__bgnum'), idx: detail.querySelector('.c7-detail__idx b'),
      title: detail.querySelector('.c7-detail__title'), text: detail.querySelector('.c7-detail__text'),
      cap: detail.querySelector('.c7-detail__cap'), sim: detail.querySelector('.c7-detail__sim'),
      go: detail.querySelector('.c7-detail__go'), dots: [...detail.querySelectorAll('.c7-dots button')],
      copy: detail.querySelector('.c7-detail__copy'),
    };
    const mqDesk = window.matchMedia('(min-width: 960px)');
    let geo = null, orbitP = reduced ? 1 : 0, paths = [], pulses = [], lens = [];

    function measure() {
      if (!mqDesk.matches) { geo = null; svgEl.innerHTML = ''; return; }
      const W = stage.clientWidth, H = stage.clientHeight;
      const devH = H * 0.76, devW = devH * (496 / 1186), cy = H * 0.5;
      geo = { W, H, cx: W / 2, cy, rx: W * 0.395, ry: H * 0.41, devW, devH, dx0: W / 2 - devW / 2, dx1: W / 2 + devW / 2, dy0: cy - devH / 2, dy1: cy + devH / 2 };
      svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
      // rings + bezel ticks
      let s = '';
      s += `<defs><radialGradient id="c7g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8a5cf0" stop-opacity=".0"/><stop offset="1" stop-color="#8a5cf0" stop-opacity=".0"/></radialGradient></defs>`;
      s += `<ellipse class="c7-ring c7-ring--a" cx="${geo.cx}" cy="${geo.cy}" rx="${geo.rx}" ry="${geo.ry}"/>`;
      s += `<ellipse class="c7-ring c7-ring--b" cx="${geo.cx}" cy="${geo.cy}" rx="${geo.rx * 1.1}" ry="${geo.ry * 1.1}"/>`;
      s += `<ellipse class="c7-ring c7-ring--c" cx="${geo.cx}" cy="${geo.cy}" rx="${geo.rx * 0.74}" ry="${geo.ry * 0.74}"/>`;
      let ticks = '';
      for (let a = 0; a < 360; a += 4) {
        const r = (a * Math.PI) / 180, major = a % 20 === 0;
        const r1 = 1.1 + (major ? 0.025 : 0.012), r0 = 1.1 - 0.0;
        ticks += `M${geo.cx + Math.sin(r) * geo.rx * r0} ${geo.cy - Math.cos(r) * geo.ry * r0}L${geo.cx + Math.sin(r) * geo.rx * r1} ${geo.cy - Math.cos(r) * geo.ry * r1}`;
      }
      s += `<path class="c7-ticks" d="${ticks}"/>`;
      // connectors: device edge → orb
      nodes.forEach((n, i) => {
        const a = (ANG[i] * Math.PI) / 180;
        const nx = geo.cx + Math.sin(a) * geo.rx, ny = geo.cy - Math.cos(a) * geo.ry;
        const left = ANG[i] < 0;
        const ax = left ? geo.dx0 + geo.devW * 0.14 : geo.dx1 - geo.devW * 0.14;
        const ay = cl(ny, geo.dy0 + geo.devH * 0.16, geo.dy0 + geo.devH * 0.74);
        const ux = nx - ax, uy = ny - ay, len = Math.hypot(ux, uy);
        const ex = nx - (ux / len) * 46, ey = ny - (uy / len) * 46;
        const c1x = ax + (left ? -1 : 1) * Math.abs(ux) * 0.45, c1y = ay;
        const d = `M${ax} ${ay}C${c1x} ${c1y} ${ex - ux * 0.2} ${ey - uy * 0.2} ${ex} ${ey}`;
        s += `<path class="c7-link-l" data-i="${i}" d="${d}" style="--acc:${ACC[i]}"/>`;
        s += `<path class="c7-link-p" data-i="${i}" d="${d}" style="--acc:${ACC[i]}"/>`;
        s += `<circle class="c7-anchor" data-i="${i}" cx="${ax}" cy="${ay}" r="2.5" style="--acc:${ACC[i]}"/>`;
      });
      svgEl.innerHTML = s;
      paths = [...svgEl.querySelectorAll('.c7-link-l')];
      pulses = [...svgEl.querySelectorAll('.c7-link-p')];
      lens = paths.map((p) => p.getTotalLength());
      paths.forEach((p, i) => { p.style.strokeDasharray = `${lens[i]}`; });
      pulses.forEach((p, i) => { p.style.strokeDasharray = `26 ${lens[i] + 30}`; });
      layout();
    }

    function layout() {
      if (!geo) {
        nodes.forEach((n) => { n.style.transform = ''; n.style.opacity = ''; });
        return;
      }
      const P = orbitP;
      nodes.forEach((n, i) => {
        const e = eo(cl((P - i * 0.055) / 0.55));
        const start = ANG[i] < 0 ? -205 : 205;
        const ang = ((start + (ANG[i] - start) * e) * Math.PI) / 180;
        const rf = 0.45 + 0.55 * e;
        const x = geo.cx + Math.sin(ang) * geo.rx * rf, y = geo.cy - Math.cos(ang) * geo.ry * rf;
        n.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.55 + 0.45 * e).toFixed(3)})`;
        n.style.opacity = cl(e * 1.4).toFixed(3);
        const lp = cl((P - 0.5 - i * 0.035) / 0.3);
        if (paths[i]) paths[i].style.strokeDashoffset = `${lens[i] * (1 - lp)}`;
      });
      svgEl.style.setProperty('--ring', cl((P - 0.05) / 0.5).toFixed(3));
    }

    measure();
    lib.onResize(() => { measure(); sizeCanvases(); if (reduced) drawAll(2.4); });
    mqDesk.addEventListener?.('change', () => { measure(); sizeCanvases(); });

    // orbit progress proxy. ScrollTrigger.refresh() (fonts ready / resize) re-renders scrubbed tweens with
    // callbacks suppressed, so onUpdate alone can leave the constellation frozen mid-spiral — syncOrbit()
    // re-reads the proxy from the refresh event and from the render loop.
    let orbitProxy = null;
    const syncOrbit = () => { if (orbitProxy && Math.abs(orbitProxy.p - orbitP) > 1e-4) { orbitP = orbitProxy.p; layout(); } };
    if (!reduced) {
      const proxy = { p: 0 };
      orbitProxy = proxy;
      gsap.to(proxy, {
        p: 1, ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top 88%', end: 'top 22%', scrub: 0.9 },
        onUpdate: () => { orbitP = proxy.p; layout(); },
      });
      ctx.ScrollTrigger?.addEventListener('refresh', syncOrbit);
      gsap.fromTo(root.querySelector('.c7-device'), { y: 60, opacity: 0, scale: 0.94 }, {
        y: 0, opacity: 1, scale: 1, ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top 92%', end: 'top 40%', scrub: 0.9 },
      });
    }

    // mobile reveal for cards
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.2 });
    nodes.forEach((n) => io.observe(n));

    /* ---- active node + detail ---- */
    let active = -1, autoT = 0, hovering = false, userLock = 0;
    const AUTO = 4.6;
    function setActive(i, animate = true) {
      if (i === active) return;
      active = i;
      const it = items[i];
      nodes.forEach((n, j) => n.classList.toggle('is-active', j === i));
      orbs.forEach((o, j) => o.setAttribute('aria-pressed', String(j === i)));
      dEls.dots.forEach((d, j) => { d.classList.toggle('is-on', j === i); d.setAttribute('aria-pressed', String(j === i)); });
      svgEl.querySelectorAll('[data-i]').forEach((p) => p.classList.toggle('is-on', +p.dataset.i === i));
      root.style.setProperty('--c7-acc', ACC[i]);
      autoT = 0;
      const apply = () => {
        dEls.bg.textContent = it.n; dEls.idx.textContent = it.n;
        dEls.title.textContent = it.title; dEls.text.innerHTML = hl(it);
        dEls.cap.textContent = CAPS[i].cap; dEls.sim.hidden = !CAPS[i].sim;
      };
      if (!animate || reduced) { apply(); return; }
      gsap.to([dEls.copy, dEls.cap, dEls.bg], {
        opacity: 0, y: -10, duration: 0.18, ease: 'power2.in', overwrite: true,
        onComplete: () => {
          apply();
          gsap.fromTo([dEls.bg, dEls.copy, dEls.cap], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'expo.out' });
        },
      });
    }
    setActive(0, false);

    orbs.forEach((o, i) => {
      o.addEventListener('pointerenter', () => { if (mqDesk.matches) { hovering = true; setActive(i); } });
      o.addEventListener('focus', () => setActive(i));
      o.addEventListener('click', () => { setActive(i); userLock = 9; });
    });
    stage.addEventListener('pointerleave', () => { hovering = false; });
    detail.addEventListener('pointerenter', () => { hovering = true; });
    detail.addEventListener('pointerleave', () => { hovering = false; });
    dEls.dots.forEach((d, i) => d.addEventListener('click', () => { setActive(i); userLock = 9; }));
    dEls.go.addEventListener('click', () => ctx.scrollTo(items[active].anchor));

    // pointer parallax on the device
    if (!reduced) {
      const dev = root.querySelector('.c7-device'), halo = root.querySelector('.c7-halo');
      const qx = gsap.quickTo(dev, 'xPercent', { duration: 1.2, ease: 'power3.out' });
      const qhx = gsap.quickTo(halo, 'x', { duration: 1.6, ease: 'power3.out' });
      const qhy = gsap.quickTo(halo, 'y', { duration: 1.6, ease: 'power3.out' });
      stage.addEventListener('pointermove', (e) => {
        if (!geo) return;
        const r = stage.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        qx(nx * 4); qhx(nx * 40); qhy(ny * 30);
      });
    }

    /* ---- canvases ---- */
    const minis = nodes.map((n) => n.querySelector('canvas'));
    const bigCv = detail.querySelector('canvas');
    const cvs = [...minis, bigCv];
    const fits = new Map();
    function sizeCanvases() { cvs.forEach((cv) => fits.set(cv, lib.fitCanvas(cv))); }
    sizeCanvases();
    function draw(cv, i, t, big) {
      const f = fits.get(cv);
      if (!f || f.cssW < 2) return;
      const c = cv.getContext('2d');
      c.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      c.clearRect(0, 0, f.cssW, f.cssH);
      GLYPHS[i](c, f.cssW, f.cssH, t, big, lib);
    }
    function drawAll(t) {
      minis.forEach((cv, i) => draw(cv, i, t + i * 0.37, false));
      if (mqDesk.matches) draw(bigCv, active, t, true);
    }
    // wait for fonts so canvas labels render with the right faces
    document.fonts?.ready.then(() => { sizeCanvases(); if (reduced) drawAll(2.4); });

    if (reduced) {
      drawAll(2.4);
    } else {
      let bigT = 0, lastActive = active;
      lib.visibleLoop(stage.parentElement, (dt, t) => {
        syncOrbit();
        if (active !== lastActive) { bigT = 0; lastActive = active; }
        bigT += dt;
        minis.forEach((cv, i) => draw(cv, i, t + i * 0.37, false));
        if (geo) draw(bigCv, active, bigT, true);
        // autoplay
        if (userLock > 0) userLock -= dt;
        if (geo && !hovering && userLock <= 0 && orbitP > 0.95) {
          autoT += dt;
          if (autoT >= AUTO) setActive((active + 1) % items.length);
        }
        const prog = cl(autoT / AUTO);
        rings.forEach((r, j) => { r.style.strokeDashoffset = j === active ? String(1 - prog) : '1'; });
        // signal packet travelling along the active connector (device → orb)
        const p = pulses[active];
        if (p) p.style.strokeDashoffset = String(-((t * 160) % (lens[active] + 30)) + 26);
      });
    }

    /* ================= 3 parameters ================= */
    const LV = lib.LEVELS, PU = lib.PULSES;
    const S = { lv: 5, pu: 1.0, cool: 2 };
    const panel = root.querySelector('.c7-panel');
    const P = Object.fromEntries(['power', 'cooling', 'pulse'].map((k) => [k, panel.querySelector(`.c7-p[data-k="${k}"]`)]));
    const msg = panel.querySelector('.c7-msg');
    const out = { w: panel.querySelector('[data-o="w"]'), d: panel.querySelector('[data-o="d"]'), b: panel.querySelector('[data-o="b"]'), c: panel.querySelector('[data-o="c"]'), cd: panel.querySelector('[data-o="cd"]') };
    const eq = root.querySelector('.c7-eq');
    const eqEl = { w: eq.querySelector('[data-e="w"]'), t: eq.querySelector('[data-e="t"]'), d: eq.querySelector('[data-e="d"]'), mk: eq.querySelector('.c7-eq__mk') };
    const bandOfState = () => lib.bandOf(lib.density(S.lv, S.pu));
    let fillAnim = reduced ? 1 : 0; // 0 → bars empty (before scroll-in)

    function paintBar(el, idx, n, extra) {
      const ticks = el.querySelectorAll('.c7-p__ticks i');
      ticks.forEach((tk, j) => {
        tk.classList.toggle('is-on', j <= idx);
        tk.classList.toggle('is-cur', j === idx);
        extra?.(tk, j);
      });
    }
    function say(text, warn = false) {
      msg.textContent = text; msg.classList.toggle('is-warn', warn);
      if (!reduced) gsap.fromTo(msg, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' });
    }
    const tw = { w: 0, d: 0 };
    function render(animateNums = true) {
      const b = bandOfState();
      const li = Math.round(LV.indexOf(S.lv) * fillAnim), pi = Math.round(PU.indexOf(S.pu) * fillAnim), ci = Math.round((S.cool - 1) * fillAnim);
      paintBar(P.power, li, 16);
      paintBar(P.pulse, pi, 9);
      paintBar(P.cooling, ci, 4, (tk, j) => tk.classList.toggle('is-off', !b.coolRange.includes(j + 1)));
      P.power.querySelector('.c7-p__val').textContent = S.lv.toFixed(1);
      P.cooling.querySelector('.c7-p__val').textContent = String(S.cool);
      P.pulse.querySelector('.c7-p__val').textContent = `${S.pu.toFixed(1)} s`;
      P.power.querySelector('.c7-p__sub').textContent = `${lib.levelPower(S.lv)} W · 每 0.5 档 +10 W`;
      P.cooling.querySelector('.c7-p__sub').textContent = `当前能量水平可调 ${bandCool(b)} 档 · 默认 ${b.coolDefault} 档`;
      P.pulse.querySelector('.c7-p__sub').textContent = `${Math.round(S.pu * 10)} 个脉冲 × 0.1 s`;
      const W = lib.levelPower(S.lv), D = lib.density(S.lv, S.pu);
      const paintNums = () => {
        out.w.textContent = Math.round(tw.w); out.d.textContent = tw.d.toFixed(1);
        eqEl.w.textContent = Math.round(tw.w); eqEl.d.textContent = tw.d.toFixed(1);
        eqEl.mk.style.left = `${(cl((tw.d - 6.3) / 32.5) * 100).toFixed(2)}%`;
      };
      eqEl.t.textContent = S.pu.toFixed(1);
      eq.style.setProperty('--band', b.hex);
      if (animateNums && !reduced) {
        gsap.to(tw, { w: W, d: D, duration: 0.6, ease: 'power3.out', overwrite: true, onUpdate: paintNums });
      } else { tw.w = W; tw.d = D; paintNums(); }
      out.b.style.setProperty('--b', b.hex);
      out.b.querySelector('span').textContent = b.label;
      out.c.textContent = bandCool(b);
      out.cd.textContent = `默认 ${b.coolDefault}`;
      panel.style.setProperty('--band', b.hex);
      [['power', li / 15], ['pulse', pi / 8], ['cooling', ci / 3]].forEach(([k, f]) => P[k].querySelector('.c7-p__bar').style.setProperty('--f', f.toFixed(3)));
    }
    function shake(el) {
      if (reduced) return;
      gsap.fromTo(el, { x: 0 }, { x: 0, duration: 0.45, ease: 'none', keyframes: { x: [0, -6, 6, -4, 4, 0] } });
    }
    function step(k, d) {
      if (k === 'cooling') {
        const b = bandOfState(), nv = S.cool + d;
        if (nv < 1 || nv > 4) return shake(P.cooling);
        if (!b.coolRange.includes(nv)) {
          shake(P.cooling);
          return say(`能量水平「${b.label}」对应的制冷强度范围为 ${bandCool(b)} 档（说明书 第 15 页）。`, true);
        }
        S.cool = nv; render(); return say(`制冷强度 ${nv} 档：数值越大，治疗头端降温速率越快、温度越低。`);
      }
      const arr = k === 'power' ? LV : PU, key = k === 'power' ? 'lv' : 'pu';
      const j = arr.indexOf(S[key]) + d;
      if (j < 0 || j >= arr.length) return shake(P[k]);
      const next = { ...S, [key]: arr[j] };
      if (!lib.isAllowed(next.lv, next.pu)) {
        shake(P[k]);
        const dd = lib.density(next.lv, next.pu);
        return say(`功率档位 ${next.lv.toFixed(1)} × 脉冲时间 ${next.pu.toFixed(1)} s 在能量输出表中为空白（${dd > 38.8 ? '能量密度过高' : '能量密度过低'}），治疗仪限制输出。`, true);
      }
      const prevCool = S.cool;
      S[key] = arr[j];
      const b = bandOfState();
      S.cool = b.coolDefault;
      render();
      say(prevCool !== S.cool
        ? `能量水平变为「${b.label}」，制冷强度已自动回到默认 ${b.coolDefault} 档（说明书 第 15 页）。`
        : `能量密度 ${lib.density(S.lv, S.pu).toFixed(1)} J/cm² · 能量水平「${b.label}」，制冷强度保持默认 ${b.coolDefault} 档。`);
    }
    panel.querySelectorAll('.c7-p').forEach((el) => {
      el.querySelectorAll('.c7-p__btn').forEach((btn) => btn.addEventListener('click', () => step(el.dataset.k, +btn.dataset.d)));
    });
    render(false);
    msg.textContent = '调节功率档位或脉冲时间时，制冷强度会自动回到该能量水平的默认档位。';

    if (!reduced) {
      const o = { f: 0 };
      onceVisible(panel, () => gsap.to(o, { f: 1, duration: 1.6, ease: 'power3.inOut', delay: 0.2, onUpdate: () => { fillAnim = o.f; render(false); } }), 0.3);
    }
  },
};

const snowSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M12 5.5l-2.2-2M12 5.5l2.2-2M12 18.5l-2.2 2M12 18.5l2.2 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
