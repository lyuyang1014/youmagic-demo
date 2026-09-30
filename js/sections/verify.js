// #verify — 5+4 激活验真技术
// src: DA p.2   “5+4 激活验真技术 — 五端激活+四维验真，全方位杜绝假货”（原文引用；不解释 5 端 / 4 维的具体含义）
//      IFU p.10 一次性使用治疗头端仅供一名患者使用，请勿重复使用或尝试重新处理
//      IFU p.11 头端安装到治疗手具上后，其类型将在触摸屏上显示；YM5-TP4-900，治疗面积 4.0 cm²
//      IFU p.19 成功连接后触摸屏显示头端类型，包括可用的射频能量脉冲次数
//      IFU p.12 验真界面：扫描激活界面二维码 → 输入验证激活码 → 确认后进入治疗界面；一旦激活，需在规定的时间段内完成治疗发数
//      IFU p.13 图7 激活界面（请激活治疗头 / 请输入激活码 / 二维码 / 型号 YM5-TP4-900 / 发数 900 / 日期 20220425 / 删除 / 5–9 · 0–4 / 取消 / 确认）；图8 治疗界面
//      IFU p.19 头端几何形状仅允许沿一个方向插入；默认参数 功率档位 2、制冷强度 1、脉冲时间 1.0
//      IFU p.24 故障代码表（E202 E203 E301 E302 E303 E304 E306 及解除措施）
//      IFU p.30 一次性使用治疗头端使用有效期 3 年 · IFU p.33 “请勿重复使用”标识

// 故障解除措施 — src: IFU p.24（data.faults 仅含说明，这里补全原表“故障解除措施”列）
const REMEDY = { E202: '请检查是否是正品治疗头', E203: '请更换新治疗头', E301: '请更换新治疗头', E302: '请更换新治疗头', E303: '疑似回充头请更换', E304: '疑似回充头请更换', E306: '请重试或更换治疗头' };
const SCEN = [
  { label: '正品新头', code: null },
  { label: '已在别处使用过', code: 'E301' },
  { label: '疑似回充头（有激活记录）', code: 'E303' },
  { label: '疑似回充头（有写入记录）', code: 'E304' },
  { label: '使用超时', code: 'E302' },
  { label: '已耗尽', code: 'E203' },
  { label: '无法识别', code: 'E202' },
  { label: '激活失败', code: 'E306' },
];
const DEMO = '582047'; // 演示激活码（虚构）
const onceVisible = (el, fn, threshold = 0.2) => { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold }); io.observe(el); };

const TIP_SVG = `<svg viewBox="0 0 120 120" class="vf-tipsvg" aria-hidden="true">
  <defs>
    <linearGradient id="vf-t-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d93c7"/><stop offset="1" stop-color="#34507a"/></linearGradient>
    <linearGradient id="vf-t-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c4468"/><stop offset="1" stop-color="#16243a"/></linearGradient>
    <linearGradient id="vf-t-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b5d8e"/><stop offset="1" stop-color="#1f3354"/></linearGradient>
    <linearGradient id="vf-t-au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd98a"/><stop offset=".5" stop-color="#d9973c"/><stop offset="1" stop-color="#9a5e1c"/></linearGradient>
  </defs>
  <path d="M60 16 L100 36 L60 56 L20 36Z" fill="url(#vf-t-top)" opacity=".95"/>
  <path d="M20 36 L60 56 L60 102 L20 82Z" fill="url(#vf-t-l)" opacity=".95"/>
  <path d="M60 56 L100 36 L100 82 L60 102Z" fill="url(#vf-t-r)" opacity=".95"/>
  <path d="M65 61 L95 46 L95 79 L65 94Z" fill="url(#vf-t-au)"/>
  <path d="M71 63 L89 54 L89 75 L71 84Z" fill="#6b3f10" opacity=".75"/>
  <path d="M73 66 L87 59 M73 70 L87 63 M73 74 L87 67 M73 78 L87 71" stroke="#e9b66a" stroke-width=".8" opacity=".8"/>
  <path d="M60 16 L100 36 L60 56 L20 36Z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".8"/>
</svg>`;
const GEAR = '<svg viewBox="0 0 24 24" class="vf-gear" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5-.02-.7 2-1.6-2-3.4-2.4.9a8 8 0 0 0-1.2-.7L16.5 4h-4l-.4 2.5c-.4.2-.8.4-1.2.7l-2.4-.9-2 3.4 2 1.6a8 8 0 0 0 0 1.4l-2 1.6 2 3.4 2.4-.9c.4.3.8.5 1.2.7l.4 2.5h4l.4-2.5c.4-.2.8-.4 1.2-.7l2.4.9 2-3.4-2-1.6.02-.7Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

/* ---- decorative QR (not a real code) ---- */
function qrSVG(seed = 7) {
  const N = 25, m = Array.from({ length: N }, () => Array(N).fill(0));
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) m[y][x] = rnd() > 0.52 ? 1 : 0;
  const finder = (ox, oy) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      const edge = x === 0 || x === 6 || y === 0 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      m[Y][X] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (edge || core) ? 1 : 0;
    }
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  for (let i = 8; i < N - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) m[18 + y][18 + x] = Math.max(Math.abs(x), Math.abs(y)) !== 1 ? 1 : 0;
  let d = '';
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      if (m[y][x]) { const x0 = x; while (x < N && m[y][x]) x++; d += `M${x0} ${y}h${x - x0}v1h${x0 - x}z`; } else x++;
    }
  }
  return `<svg viewBox="-2 -2 29 29" class="vf-qrsvg" shape-rendering="crispEdges" aria-hidden="true"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><path d="${d}" fill="#0b0d12"/></svg>`;
}

/* ---- key shape (square, rounded corners, one chamfered corner) as 2D points ---- */
function keyPts(s, r, ch) {
  const h = s / 2, pts = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  arc(h - r, -h + r, -Math.PI / 2);   // bottom-right
  pts.push([h, h - ch], [h - ch, h]); // top-right chamfer
  arc(-h + r, h - r, Math.PI / 2);    // top-left
  arc(-h + r, -h + r, Math.PI);       // bottom-left
  return pts;
}
const ptsToPath = (pts, k = 1, ox = 0, oy = 0) => pts.map((p, i) => `${i ? 'L' : 'M'}${(ox + p[0] * k).toFixed(2)} ${(oy - p[1] * k).toFixed(2)}`).join('') + 'Z';

export default {
  id: 'verify',
  nav: '激活验真',
  async init(root, ctx) {
    const { gsap, lib, data, reduced } = ctx;
    const faultText = Object.fromEntries(data.faults.filter((f) => f.group === 'auth').map((f) => [f.code, f.text.split(' · ')[0]]));
    const tip = data.components.find((c) => c.model === 'YM5-TP4-900');
    const D = data.defaults;
    const keyPath = ptsToPath(keyPts(1.16, 0.12, 0.34), 30, 44, 44);

    root.innerHTML = `
      <div class="wrap vf">
        <div class="vf-top">
          <header class="sec-head vf-head">
            <span class="eyebrow" data-reveal>08 · AUTHENTICATION</span>
            <h2 class="h1" data-reveal>5+4 激活验真技术</h2>
            <p class="lead vf-claim" data-reveal><em>五端</em>激活+<em>四维</em>验真，全方位杜绝假货</p>
            <p class="vf-sub" data-reveal>每一个一次性使用治疗头端都需在治疗仪上<b>扫码激活</b>后才能进入治疗界面，且<b>仅供一名患者使用</b>。下面按说明书流程完整走一遍。<span class="tag-src">说明书 第 10–13、19 页 · 彩页 第 2 页</span></p>
          </header>
          <div class="vf-lock" aria-hidden="true" data-reveal="scale">
            <svg viewBox="0 0 220 220" class="vf-lock__svg">
              <polygon class="vf-l5" points="${Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5; return `${110 + Math.cos(a) * 96},${110 + Math.sin(a) * 96}`; }).join(' ')}"/>
              <polygon class="vf-l4" points="${Array.from({ length: 4 }, (_, k) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 4; return `${110 + Math.cos(a) * 50},${110 + Math.sin(a) * 50}`; }).join(' ')}"/>
              ${Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5; return `<circle class="vf-ld vf-ld5" style="--k:${k}" cx="${110 + Math.cos(a) * 96}" cy="${110 + Math.sin(a) * 96}" r="6"/>`; }).join('')}
              ${Array.from({ length: 4 }, (_, k) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 4; return `<circle class="vf-ld vf-ld4" style="--k:${k}" cx="${110 + Math.cos(a) * 50}" cy="${110 + Math.sin(a) * 50}" r="5"/>`; }).join('')}
              <path class="vf-lck" d="M92 111 l12 12 l24 -26"/>
            </svg>
            <div class="vf-lock__num num"><span>5</span><i>+</i><span>4</span></div>
            <div class="vf-lock__cap"><span>五端激活</span><span>四维验真</span></div>
          </div>
        </div>

        <ol class="vf-steps" data-reveal>
          ${[
            ['安装头端', '头端几何形状仅允许沿一个方向插入', '第 19 页'],
            ['自动识别', '安装后触摸屏显示头端类型与可用发数', '第 11、19 页'],
            ['扫码激活', '验证程序扫描二维码，输入激活码并确认', '第 12 页'],
            ['进入治疗', '激活后需在规定的时间段内完成治疗发数', '第 12 页'],
          ].map(([t, d, p], i) => `<li class="vf-step" data-i="${i}"><span class="vf-step__n num">${i + 1}</span><div><div class="vf-step__t">${t}</div><div class="vf-step__d">${d}</div><span class="tag-src">说明书 ${p}</span></div></li>`).join('')}
        </ol>

        <div class="vf-demo">
          <div class="vf-stage card">
            <div class="vf-stage__head"><span class="vf-stage__t">治疗手具 · 一次性使用治疗头端</span><span class="mono vf-stage__m">${tip.model}</span></div>
            <div class="vf-gl"><canvas aria-label="三维示意：一次性使用治疗头端与治疗手具" role="img"></canvas>
              <img class="vf-fallback" src="assets/img/handpiece.webp" alt="治疗手具与一次性使用治疗头端" hidden />
              <div class="vf-hud" aria-hidden="true">
                <svg viewBox="0 0 88 88"><path class="vf-hud__sock" d="${keyPath}"/><g class="vf-hud__tip"><path d="${keyPath}"/></g><circle class="vf-hud__mk" cx="${44 + 30 * 0.45}" cy="${44 - 30 * 0.45}" r="3"/></svg>
                <span class="micro">对位示意</span>
              </div>
              <div class="vf-flash" aria-hidden="true"></div>
            </div>
            <p class="vf-hint" aria-live="polite">旋转头端，使倒角与手具接口对齐，然后插入。</p>
            <div class="vf-stage__ctl">
              <button type="button" class="btn vf-rot"><span aria-hidden="true">↻</span> 旋转 90°</button>
              <button type="button" class="btn btn--primary vf-ins">插入治疗头</button>
            </div>
            <p class="micro vf-stage__note">三维模型与倒角形状为示意；说明书原文：“一次性使用治疗头端的几何形状仅允许沿一个方向插入”。</p>
          </div>

          <div class="vf-right">
            <div class="vf-device">
              <div class="vf-screen" data-state="boot" tabindex="0" aria-label="触摸屏激活界面（复刻说明书图7）">
                <div class="vf-scr vf-scr--boot">
                  <div class="vf-logo">YŌUMAGIC</div>
                  <div class="vf-boot"><span>发布版本： V 1</span><span class="vf-boot__msg">系统自检中<i>.</i><i>.</i><i>.</i></span></div>
                </div>
                <div class="vf-scr vf-scr--act">
                  <div class="vf-scr__top"><span class="vf-logo vf-logo--s">YŌUMAGIC</span>${GEAR}</div>
                  <div class="vf-act">
                    <div class="vf-act__l">
                      <div class="vf-act__title">请激活治疗头</div>
                      <div class="vf-act__sub">请输入激活码</div>
                      <div class="vf-ped"><div class="vf-ped__tip">${TIP_SVG}</div><div class="vf-ped__empty">等待安装<br>治疗头</div></div>
                      <div class="vf-act__type"><span class="mono">YM5-TP4-900</span> · 可用 <b>900</b> 发</div>
                    </div>
                    <div class="vf-act__r">
                      <div class="vf-qrrow">
                        <div class="vf-qr">${qrSVG(11)}<div class="vf-qr__mask">安装后<br>显示</div><div class="vf-laser"></div></div>
                        <dl class="vf-info"><div><dt>型号</dt><dd>YM5-TP4-900</dd></div><div><dt>发数</dt><dd>900</dd></div><div><dt>日期</dt><dd>20220425</dd></div></dl>
                      </div>
                      <div class="vf-inrow"><div class="vf-input mono" aria-live="polite" aria-label="激活码输入框"><span class="vf-input__v"></span><i class="vf-caret"></i></div><button type="button" class="vf-k vf-k--w" data-k="del">删除</button></div>
                      <div class="vf-keys">${['5', '6', '7', '8', '9', '0', '1', '2', '3', '4'].map((n) => `<button type="button" class="vf-k" data-k="${n}">${n}</button>`).join('')}</div>
                      <div class="vf-acts"><button type="button" class="vf-k vf-k--w" data-k="cancel">取消</button><button type="button" class="vf-k vf-k--w vf-k--ok" data-k="ok">确认</button></div>
                    </div>
                  </div>
                </div>
                <div class="vf-scr vf-scr--treat">
                  <div class="vf-scr__top"><span class="vf-logo vf-logo--s">YŌUMAGIC</span>${GEAR}</div>
                  <div class="vf-tr">
                    <div class="vf-act__l">
                      <div class="vf-act__title">待治疗</div>
                      <div class="vf-act__sub">请检查制冷剂罐和中性电极片</div>
                      <div class="vf-ped is-on"><div class="vf-ped__tip">${TIP_SVG}</div></div>
                    </div>
                    <div class="vf-tr__r">
                      <div class="vf-tr__stats">
                        <div><span>治疗发数</span><b class="num">0 / 900</b></div>
                        <div><span>累计能量(KJ)</span><b class="num">0.00</b></div>
                        <div><span>阻值(Ω)</span><b class="num">—</b></div>
                        <div><span>功率(W)</span><b class="num">—</b></div>
                      </div>
                      <div class="vf-tr__params">
                        <div class="vf-tr__dens"><span>能量密度</span><b class="num">${lib.density(D.level, D.pulse).toFixed(1)}</b></div>
                        ${[['功率档位', D.level.toFixed(1)], ['制冷强度', String(D.cooling)], ['脉冲时间', D.pulse.toFixed(1)]].map(([k, v]) => `<div class="vf-tr__p"><i>+</i><span>${k}</span><b class="num">${v}</b><i>−</i></div>`).join('')}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="vf-toast" role="status"></div>
              </div>
            </div>
            <div class="vf-phone" aria-hidden="true">
              <div class="vf-phone__bar"><span>验证程序</span><i></i></div>
              <div class="vf-phone__view">${qrSVG(11)}<div class="vf-phone__scan"></div><span class="vf-c vf-c1"></span><span class="vf-c vf-c2"></span><span class="vf-c vf-c3"></span><span class="vf-c vf-c4"></span></div>
              <div class="vf-phone__st micro">正在识别二维码…</div>
            </div>
            <div class="vf-codecard" aria-live="polite" hidden>
              <div class="vf-codecard__ic" aria-hidden="true"><i></i></div>
              <div class="vf-codecard__b">
                <div class="micro">验证程序 · 已识别 <span class="mono">YM5-TP4-900 · 900 发</span></div>
                <div class="vf-codecard__row"><span class="micro">激活码（演示，虚构）</span><span class="mono vf-codecard__code">${DEMO.slice(0, 3)} ${DEMO.slice(3)}</span></div>
              </div>
              <button type="button" class="btn vf-codecard__fill">一键填入</button>
            </div>
            <div class="vf-under">
              <button type="button" class="btn vf-scan" disabled><span class="vf-scan__i" aria-hidden="true"></span>用验证程序扫码</button>
              <button type="button" class="btn vf-reset">重置演示</button>
              <span class="micro vf-under__src">触摸屏界面复刻自说明书 图6–图8（第 12–13 页）</span>
            </div>
          </div>
        </div>

        <div class="vf-sim card" data-reveal>
          <div class="vf-sim__l">
            <div class="vf-sim__eyebrow mono">ANTI-COUNTERFEIT · 模拟</div>
            <h3 class="h3">防伪校验模拟</h3>
            <p class="small">选择一种治疗头状态，看治疗仪会给出什么提示。故障代码与处理措施摘自说明书故障代码表。</p>
            <div class="vf-chips" role="group" aria-label="治疗头状态">
              ${SCEN.map((s, i) => `<button type="button" class="vf-chip${s.code ? '' : ' vf-chip--ok'}" data-i="${i}" aria-pressed="false"><i aria-hidden="true"></i>${s.label}</button>`).join('')}
            </div>
          </div>
          <div class="vf-con" aria-live="polite">
            <div class="vf-con__bar"><i></i><i></i><i></i><span class="mono">YM5 · 治疗头校验</span></div>
            <div class="vf-con__body">
              <div class="vf-con__lines mono"></div>
              <div class="vf-con__verdict"></div>
            </div>
          </div>
          <div class="vf-codes">
            <div class="vf-codes__t">故障代码 · 治疗头</div>
            ${Object.keys(REMEDY).map((c) => `<div class="vf-code" data-c="${c}"><b class="mono">${c}</b><span>${faultText[c]}</span></div>`).join('')}
            <span class="tag-src">说明书 第 24 页</span>
          </div>
        </div>

        <div class="vf-foot">
          <div class="vf-foot__sym" data-reveal>
            <svg viewBox="0 0 64 64" aria-label="请勿重复使用标识"><circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" stroke-width="3"/><text x="32" y="42" text-anchor="middle" font-size="30" font-family="Montserrat, sans-serif" fill="currentColor">2</text><line x1="13" y1="51" x2="51" y2="13" stroke="currentColor" stroke-width="3"/></svg>
            <div><b>仅供一名患者使用</b><p class="small">制造商提供的一次性使用治疗头端仅供一名患者使用。请勿重复使用或尝试重新处理；用于多名患者会造成患者之间微生物交叉污染的风险。</p><span class="tag-src">说明书 第 10、33 页</span></div>
          </div>
          <div class="vf-foot__stats">
            <div class="stat" data-reveal><div class="stat__v num" data-count="900">900<span class="stat__u">发</span></div><div class="stat__k">每个头端的治疗计数</div></div>
            <div class="stat" data-reveal><div class="stat__v num">4.0<span class="stat__u">cm²</span></div><div class="stat__k">治疗面积</div></div>
            <div class="stat" data-reveal><div class="stat__v num">1<span class="stat__u">名患者</span></div><div class="stat__k">单一患者使用</div></div>
            <div class="stat" data-reveal><div class="stat__v num">${data.specs.lifetime.tip.replace(/\s*年/, '')}<span class="stat__u">年</span></div><div class="stat__k">头端使用有效期</div></div>
          </div>
        </div>
        <p class="note">激活码为演示用虚构数字，二维码为装饰图形；“五端激活 + 四维验真”为彩页原文，其具体实现以厂家资料为准。本页仅演示说明书所述的安装—识别—扫码激活—进入治疗流程及故障提示。</p>
      </div>`;

    const $ = (s) => root.querySelector(s);
    const screen = $('.vf-screen'), toastEl = $('.vf-toast'), inputV = $('.vf-input__v');
    const steps = [...root.querySelectorAll('.vf-step')];
    const hint = $('.vf-hint'), btnRot = $('.vf-rot'), btnIns = $('.vf-ins'), btnScan = $('.vf-scan'), btnReset = $('.vf-reset');
    const phone = $('.vf-phone'), hudTip = $('.vf-hud__tip'), hud = $('.vf-hud'), flash = $('.vf-flash');
    const S = { state: 'boot', installed: false, scanned: false, code: '', quarter: 1, busy: false, activated: false, gen: 0 };

    /* ---------------- steps ---------------- */
    function setStep(n) {
      steps.forEach((s, i) => { s.classList.toggle('is-done', i < n); s.classList.toggle('is-cur', i === n); });
    }
    setStep(0);
    function say(t) { hint.textContent = t; if (!reduced) gsap.fromTo(hint, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.4 }); }

    /* ---------------- screen ---------------- */
    function setScreen(st) {
      S.state = st; screen.dataset.state = st;
    }
    let toastT = 0;
    function toast(html, kind = 'info', ms = 2600) {
      toastEl.innerHTML = html; toastEl.className = `vf-toast is-show vf-toast--${kind}`;
      clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-show'), ms);
    }
    function renderInput() {
      inputV.textContent = S.code.replace(/(\d{3})(?=\d)/, '$1 ');
    }
    function press(k) {
      if (S.state !== 'act' || S.busy) return;
      if (!S.installed) { toast('请先在左侧安装一次性使用治疗头端', 'info'); return; }
      if (/^\d$/.test(k)) { if (S.code.length < 6) S.code += k; }
      else if (k === 'del') S.code = S.code.slice(0, -1);
      else if (k === 'cancel') S.code = '';
      else if (k === 'ok') return confirm();
      renderInput();
    }
    function confirm() {
      if (!S.code) { toast('请输入激活码', 'info'); return; }
      if (S.code === DEMO) {
        S.busy = true; S.activated = true;
        const g = S.gen;
        toast('<b>激活成功</b> · 进入治疗界面', 'ok', 1800);
        setStep(3);
        if (!reduced) gsap.to(codeCard, { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: -14, duration: 0.6, delay: 0.6, ease: 'power3.inOut', onComplete: () => { codeCard.hidden = true; gsap.set(codeCard, { clearProps: 'all' }); } });
        else codeCard.hidden = true;
        setTimeout(() => {
          if (g !== S.gen) return;
          setScreen('treat'); S.busy = false; setStep(4);
          say('已进入治疗界面。头端一旦激活，需在规定的时间段内完成治疗发数。');
        }, reduced ? 0 : 1100);
        return;
      }
      toast(`<b class="mono">E306</b> ${faultText.E306} · ${REMEDY.E306}`, 'err', 3200);
      if (!reduced) gsap.fromTo('.vf-input', { x: 0 }, { duration: 0.45, keyframes: { x: [0, -8, 8, -5, 5, 0] }, ease: 'none' });
      S.code = ''; renderInput();
    }
    root.querySelectorAll('.vf-k').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    screen.addEventListener('keydown', (e) => {
      if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
      else if (e.key === 'Enter') { press('ok'); e.preventDefault(); }
      else if (e.key === 'Escape') { press('cancel'); }
    });

    // boot → activation screen when first visible
    const boot = () => {
      if (S.state !== 'boot') return;
      setTimeout(() => { if (S.state === 'boot') { setScreen('act'); } }, reduced ? 0 : 1700);
    };
    if (reduced) boot();
    else onceVisible(screen, boot, 0.35);

    /* ---------------- scan ---------------- */
    btnScan.addEventListener('click', () => {
      if (!S.installed || S.busy || S.activated) return;
      S.busy = true; btnScan.disabled = true;
      const g = S.gen;
      phone.classList.add('is-show', 'is-scanning'); phone.setAttribute('aria-hidden', 'false');
      screen.classList.add('is-scanning');
      say('验证程序正在扫描触摸屏上的二维码…');
      const done = () => {
        if (g !== S.gen) return;
        S.scanned = true; S.busy = false;
        phone.classList.remove('is-show', 'is-scanning'); phone.setAttribute('aria-hidden', 'true');
        screen.classList.remove('is-scanning');
        codeCard.hidden = false;
        if (!reduced) gsap.fromTo(codeCard, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
        say(`已获取激活码。在触摸屏键盘输入 ${DEMO.slice(0, 3)} ${DEMO.slice(3)}（或点“一键填入”），再按“确认”。`);
        setStep(2);
      };
      if (reduced) done(); else setTimeout(done, 1900);
    });
    const codeCard = $('.vf-codecard');
    codeCard.querySelector('.vf-codecard__fill').addEventListener('click', () => {
      if (S.state !== 'act' || S.busy || !S.scanned) return;
      S.code = ''; renderInput();
      const g = S.gen;
      [...DEMO].forEach((d, i) => setTimeout(() => { if (g === S.gen) press(d); }, reduced ? 0 : 110 * (i + 1)));
    });

    /* ---------------- install (3D) ---------------- */
    const aligned = () => ((S.quarter % 4) + 4) % 4 === 0;
    function hudUpdate(animate = true) {
      const deg = -S.quarter * 90;
      if (animate && !reduced) gsap.to(hudTip, { rotation: deg, svgOrigin: '44 44', duration: 0.55, ease: 'back.out(1.6)' });
      else gsap.set(hudTip, { rotation: deg, svgOrigin: '44 44' });
      hud.classList.toggle('is-ok', aligned());
    }
    hudUpdate(false);
    let three = null; // { spinTo, insert, remove }
    btnRot.addEventListener('click', () => {
      if (S.installed || S.busy) return;
      S.quarter += 1; hudUpdate();
      three?.spinTo(S.quarter);
      say(aligned() ? '倒角已对齐接口——现在可以插入。' : '倒角未对齐，继续旋转。');
    });
    btnIns.addEventListener('click', async () => {
      if (S.installed || S.busy) return;
      S.busy = true;
      const ok = aligned(), g = S.gen;
      if (three) await three.insert(ok); else await new Promise((r) => setTimeout(r, reduced ? 0 : 400));
      if (g !== S.gen) return; // 重置演示 pressed mid-insert
      S.busy = false;
      if (!ok) {
        say('插不进去：头端几何形状仅允许沿一个方向插入。请旋转对齐后再试。');
        hud.classList.add('is-bad'); setTimeout(() => hud.classList.remove('is-bad'), 900);
        if (!reduced) { flash.classList.remove('is-bad', 'is-ok'); void flash.offsetWidth; flash.classList.add('is-bad'); }
        return;
      }
      if (!reduced) { flash.classList.remove('is-bad', 'is-ok'); void flash.offsetWidth; flash.classList.add('is-ok'); }
      S.installed = true;
      root.classList.add('vf--installed');
      btnRot.disabled = true; btnIns.disabled = true; btnIns.textContent = '已安装';
      if (S.state === 'boot') setScreen('act');
      screen.classList.add('is-tip');
      setStep(2);
      btnScan.disabled = false;
      say('已安装。触摸屏显示头端类型 YM5-TP4-900 与可用发数 900，下一步：扫码激活。');
    });

    btnReset.addEventListener('click', () => {
      Object.assign(S, { installed: false, scanned: false, code: '', quarter: 1, busy: false, activated: false, gen: S.gen + 1 });
      if (!reduced) gsap.killTweensOf(codeCard);
      gsap.set(codeCard, { clearProps: 'all' });
      root.classList.remove('vf--installed');
      screen.classList.remove('is-tip', 'is-scanning');
      phone.classList.remove('is-show', 'is-scanning'); phone.setAttribute('aria-hidden', 'true');
      codeCard.hidden = true;
      btnRot.disabled = false; btnIns.disabled = false; btnIns.textContent = '插入治疗头'; btnScan.disabled = true;
      renderInput(); setScreen('act'); setStep(0); hudUpdate();
      three?.remove(S.quarter);
      say('旋转头端，使倒角与手具接口对齐，然后插入。');
    });

    // lazy 3D
    const glWrap = $('.vf-gl'), canvas = glWrap.querySelector('canvas');
    const io = new IntersectionObserver(async (es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      try { three = await build3D(canvas, glWrap, { gsap, lib, reduced, quarter: S.quarter }); }
      catch (err) {
        console.warn('[verify] 3D unavailable, using image fallback', err?.message);
        glWrap.classList.add('is-fallback'); glWrap.querySelector('.vf-fallback').hidden = false;
      }
    }, { rootMargin: '600px 0px' });
    io.observe(glWrap);

    /* ---------------- anti-counterfeit simulator ---------------- */
    const lines = $('.vf-con__lines'), verdict = $('.vf-con__verdict');
    const chips = [...root.querySelectorAll('.vf-chip')], codeRows = [...root.querySelectorAll('.vf-code')];
    let run = 0;
    async function simulate(i) {
      const my = ++run, sc = SCEN[i];
      chips.forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)));
      codeRows.forEach((r) => r.classList.remove('is-hit'));
      verdict.className = 'vf-con__verdict'; verdict.innerHTML = '';
      lines.innerHTML = '';
      const L = [
        '› 检测到治疗头接入',
        '› 读取头端信息',
        sc.code === 'E306' ? '› 提交激活码' : '› 校验中',
      ];
      const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
      for (let k = 0; k < L.length; k++) {
        if (my !== run) return;
        const row = document.createElement('div');
        row.className = 'vf-con__ln';
        row.innerHTML = `<span>${L[k]}</span><i class="vf-con__dots"></i><b></b>`;
        lines.appendChild(row);
        await wait(420);
        if (my !== run) return;
        row.querySelector('b').textContent = k < L.length - 1 || !sc.code ? 'OK' : '!';
        row.classList.add(k < L.length - 1 || !sc.code ? 'is-ok' : 'is-bad');
      }
      await wait(200);
      if (my !== run) return;
      if (!sc.code) {
        verdict.classList.add('is-ok');
        verdict.innerHTML = `<div class="vf-v__icon" aria-hidden="true">✓</div><div><div class="vf-v__code">校验通过</div><div class="vf-v__msg">进入激活界面 · 扫码输入激活码后开始治疗</div></div>`;
      } else {
        verdict.classList.add('is-bad');
        verdict.innerHTML = `<div class="vf-v__icon" aria-hidden="true">!</div><div><div class="vf-v__code mono">${sc.code}</div><div class="vf-v__msg">${faultText[sc.code]}</div><div class="vf-v__fix">${REMEDY[sc.code]}</div></div>`;
        codeRows.find((r) => r.dataset.c === sc.code)?.classList.add('is-hit');
      }
      if (!reduced) gsap.fromTo(verdict, { opacity: 0, y: 12, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out' });
    }
    chips.forEach((c, i) => c.addEventListener('click', () => simulate(i)));
    onceVisible($('.vf-sim'), () => { if (run === 0) simulate(2); }, 0.35);
  },
};

/* ================= Three.js handpiece + tip ================= */
async function build3D(canvas, wrap, { gsap, lib, reduced, quarter }) {
  const THREE = await import('three');
  const { RoomEnvironment } = await import('three/addons/RoomEnvironment.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-4, 6, 8); scene.add(key);
  const rim = new THREE.PointLight(0x8a5cf0, 30, 20, 2); rim.position.set(4, -2, -3); scene.add(rim);
  const mintL = new THREE.PointLight(0x43e6a8, 0, 8, 2); scene.add(mintL);

  const rig = new THREE.Group(); scene.add(rig);
  const hp = new THREE.Group(); rig.add(hp);
  rig.rotation.z = 0.4; hp.rotation.y = 0.5; hp.position.set(-2.6, 0, 0);

  // --- handpiece body (lathe along +X) ---
  const prof = [[0.0, 0.62], [0.08, 0.66], [0.9, 0.67], [1.7, 0.63], [2.5, 0.5], [3.3, 0.56], [4.1, 0.66], [4.8, 0.6], [5.3, 0.44], [5.55, 0.26], [5.6, 0.0]]
    .map(([y, r]) => new THREE.Vector2(r, y));
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd4d9e1, metalness: 1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.95 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), silver);
  body.rotation.z = -Math.PI / 2; body.position.x = 0.32; hp.add(body);
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0c0d11, metalness: 0.2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.32, 64), black);
  collar.rotation.z = Math.PI / 2; collar.position.x = 0.16; hp.add(collar);
  const btn = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.62, 8, 16), black);
  btn.rotation.z = Math.PI / 2; btn.position.set(1.45, 0.66, 0); btn.scale.set(1, 1, 1.6); hp.add(btn);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.5, 0, 0), new THREE.Vector3(6.4, -0.05, 0), new THREE.Vector3(7.4, -0.5, -0.3), new THREE.Vector3(8.6, -1.6, -0.9),
  ]), 40, 0.13, 12, false), black);
  hp.add(cable);

  // --- keyed socket boss (extends along −X) ---
  const shapeOf = (s, r, ch) => { const p = keyPts(s, r, ch); const sh = new THREE.Shape(); p.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath(); return sh; };
  const bossG = new THREE.Group(); bossG.rotation.y = -Math.PI / 2; hp.add(bossG);
  const boss = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(0.86, 0.1, 0.26), { depth: 0.34, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 }), black);
  bossG.add(boss);
  const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(keyPts(0.86, 0.1, 0.26).map(([x, y]) => new THREE.Vector3(x, y, 0.365))), new THREE.LineBasicMaterial({ color: 0x43e6a8, transparent: true, opacity: 0.9 }));
  bossG.add(outline);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0x43e6a8 }));
  led.position.set(0.36, 0.36, 0.37); bossG.add(led);

  // --- tip (cap) ---
  const carrier = new THREE.Group(); hp.add(carrier);
  const spin = new THREE.Group(); carrier.add(spin);
  const tipMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(1.16, 0.12, 0.34), { depth: 0.6, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 8 }),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0b10, metalness: 0.3, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }));
  spin.add(tipMesh);
  // electrode (copper + polyimide) texture
  const tc = document.createElement('canvas'); tc.width = tc.height = 256;
  const g = tc.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#f0c070'); gr.addColorStop(0.5, '#c98a36'); gr.addColorStop(1, '#8e561b');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#5a3610'; g.fillRect(40, 40, 176, 176);
  g.strokeStyle = '#e8b36a'; g.lineWidth = 3;
  for (let y = 56; y < 206; y += 14) { g.beginPath(); g.moveTo(52, y); g.lineTo(204, y); g.stroke(); }
  g.strokeStyle = 'rgba(255,230,170,.6)'; g.lineWidth = 6; g.strokeRect(22, 22, 212, 212);
  const tex = new THREE.CanvasTexture(tc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const eGeo = new THREE.ShapeGeometry(shapeOf(0.98, 0.08, 0.28), 8);
  const uv = eGeo.attributes.uv, pos = eGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 0.49) / 0.98, (pos.getY(i) + 0.49) / 0.98);
  const eMat = new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.85, roughness: 0.3, clearcoat: 0.8, emissive: new THREE.Color(0xffb347), emissiveIntensity: 0 });
  const electrode = new THREE.Mesh(eGeo, eMat); electrode.position.z = 0.656; spin.add(electrode);
  const tipMk = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0x43e6a8 }));
  tipMk.position.set(0.47, 0.47, 0.02); spin.add(tipMk);
  // activation ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x43e6a8, transparent: true, opacity: 0 }));
  ring.rotation.y = -Math.PI / 2; ring.position.x = -0.3; hp.add(ring);

  const FREE = -2.3, SEAT = 0.0, BLOCK = -0.42, AX = -Math.PI / 2, TILT = 0.62;
  carrier.position.x = FREE;
  carrier.rotation.y = AX + TILT; // present the electrode face to the camera while free
  spin.rotation.z = (quarter * Math.PI) / 2;
  let seated = false, tlCur = null;

  // framing
  const fit = () => {
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const z = 14.4 * Math.max(1, 1.47 / camera.aspect);
    camera.position.set(0, 0.2, z); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    rig.position.set(camera.aspect < 1.45 ? 1.2 : 0.45, camera.aspect < 1.45 ? 0.1 : -0.12, 0);
  };
  fit();
  lib.onResize(fit);

  // pointer parallax
  const tgt = { x: 0, y: 0 };
  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    tgt.x = ((e.clientX - r.left) / r.width - 0.5); tgt.y = ((e.clientY - r.top) / r.height - 0.5);
  });
  wrap.addEventListener('pointerleave', () => { tgt.x = 0; tgt.y = 0; });

  const baseRX = 0, baseRY = 0;
  mintL.position.set(-1.2, 0.6, 1.2);
  const render = (dt = 0, t = 0) => {
    rig.rotation.x += (baseRX + tgt.y * 0.25 - rig.rotation.x) * Math.min(1, dt * 3);
    rig.rotation.y += (baseRY + tgt.x * 0.35 - rig.rotation.y) * Math.min(1, dt * 3);
    if (!seated && !reduced) carrier.position.y = Math.sin(t * 1.6) * 0.05;
    else carrier.position.y *= 0.9;
    led.material.color.setHSL(0.43, 0.75, 0.45 + 0.15 * Math.sin(t * 3));
    renderer.render(scene, camera);
  };
  if (reduced) { render(); lib.onResize(() => render()); }
  else lib.visibleLoop(wrap, render);

  return {
    spinTo(q) {
      if (reduced) { spin.rotation.z = (q * Math.PI) / 2; render(); return; }
      gsap.to(spin.rotation, { z: (q * Math.PI) / 2, duration: 0.6, ease: 'back.out(1.6)' });
    },
    async insert(ok) {
      if (reduced) {
        if (ok) { carrier.position.x = SEAT; carrier.rotation.y = AX; seated = true; eMat.emissiveIntensity = 0.25; ring.material.opacity = 0.6; }
        render(); return;
      }
      if (!ok) {
        await new Promise((res) => {
          tlCur = gsap.timeline({ onComplete: res })
            .to(carrier.rotation, { y: AX, duration: 0.35, ease: 'power2.inOut' })
            .to(carrier.position, { x: BLOCK, duration: 0.45, ease: 'power2.in' }, 0.1)
            .to(spin.rotation, { duration: 0.35, keyframes: { z: [spin.rotation.z, spin.rotation.z + 0.08, spin.rotation.z - 0.08, spin.rotation.z + 0.04, spin.rotation.z] } })
            .to(outline.material.color, { r: 1, g: 0.38, b: 0.25, duration: 0.1 }, '<')
            .to(carrier.position, { x: FREE, duration: 0.7, ease: 'power3.out' })
            .to(carrier.rotation, { y: AX + TILT, duration: 0.7, ease: 'power3.out' }, '<')
            .to(outline.material.color, { r: 0.26, g: 0.9, b: 0.66, duration: 0.5 }, '<');
        });
        return;
      }
      await new Promise((res) => {
        tlCur = gsap.timeline()
          .to(carrier.rotation, { y: AX, duration: 0.35, ease: 'power2.inOut' })
          .to(carrier.position, { x: BLOCK + 0.1, duration: 0.45, ease: 'power2.in' }, 0.1)
          .to(carrier.position, { x: SEAT, duration: 0.3, ease: 'back.out(3)' })
          .add(() => { seated = true; res(); })
          .to(rig.position, { duration: 0.25, keyframes: { x: [rig.position.x, rig.position.x - 0.06, rig.position.x + 0.04, rig.position.x] } }, '<')
          .fromTo(ring.material, { opacity: 0.9 }, { opacity: 0.35, duration: 1.2 }, '<')
          .fromTo(ring.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1.35, y: 1.35, z: 1.35, duration: 1.2, ease: 'expo.out' }, '<')
          .to(eMat, { emissiveIntensity: 0.55, duration: 0.2 }, '<')
          .to(eMat, { emissiveIntensity: 0.12, duration: 1.2 })
          .to(mintL, { intensity: 6, duration: 0.2 }, '<-1.2')
          .to(mintL, { intensity: 1.5, duration: 1 });
      });
    },
    remove(q) {
      seated = false;
      if (reduced) { carrier.position.x = FREE; carrier.rotation.y = AX + TILT; spin.rotation.z = (q * Math.PI) / 2; eMat.emissiveIntensity = 0; ring.material.opacity = 0; render(); return; }
      tlCur?.kill(); tlCur = null;
      gsap.killTweensOf([carrier.position, carrier.rotation, spin.rotation, eMat, ring.material, ring.scale, mintL, rig.position, outline.material.color]);
      outline.material.color.setRGB(0.26, 0.9, 0.66);
      fit(); // restores rig.position if the seat-shake was interrupted
      gsap.to(carrier.position, { x: FREE, duration: 0.8, ease: 'power3.inOut' });
      gsap.to(carrier.rotation, { y: AX + TILT, duration: 0.8, ease: 'power3.inOut' });
      gsap.to(spin.rotation, { z: (q * Math.PI) / 2, duration: 0.8, ease: 'power3.inOut' });
      gsap.to(eMat, { emissiveIntensity: 0, duration: 0.4 });
      gsap.to(ring.material, { opacity: 0, duration: 0.4 });
      gsap.to(mintL, { intensity: 0, duration: 0.4 });
    },
  };
}
