// #console — playable replica of the YM5 treatment touchscreen + handpiece, beside the full energy matrix.
// src: IFU p.9 图3 / p.13 图8（触摸屏布局与读数）· IFU p.10 图4（治疗手具：使能按钮、R、− M +、内置触发开关）
//      IFU p.14 图9（设置界面信息）· IFU p.14–15 §7.5（能量输出表、制冷档位匹配、自动回默认制冷）
//      IFU p.15 §7.6（准备就绪 → 预备 → 启动三阶段 → 完成；界面文案）· IFU p.19–21（默认参数 2 / 1 / 1.0；接触压力过低停止输出）
//      IFU p.31 §14（能量输出表）· DA p.2（可视化能量密度、多重制冷调节 原文）
// Cooling-phase durations and pressure thresholds below are schematic (not specified in the IFU).
// 3D (YM3D): the console (createDevice) mirrors the virtual touchscreen on its own screen; the IFU energy table is a
// createEnergyMatrix3D bar field (click a bar → load). Both views share ONE WebGL context (sticky layer + scissor).

const PRE = 0.45, POST = 0.6; // schematic 治疗前 / 治疗后冷却 durations (s)
const P_TOUCH = 8, P_LO = 40, P_HI = 76; // schematic contact-pressure zones (0–100)
// src: IFU p.14 图9 设置界面（主机 / 治疗头两栏 + 音量、亮度调节）；治疗面积见 IFU p.11
const SETTINGS = {
  host: [['设备型号', 'YM5'], ['主机型号', 'YM5-G1'], ['手具型号', 'YM5-H1']],
  tip: [['名称', 'YM5-TP4-900'], ['发数', '900'], ['治疗面积', '4.0 cm²']],
};

import * as THREE from 'three';
import * as S3 from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createDevice } from '../ym3d/device.mjs';
import { createEnergyMatrix3D, projectAnchor } from '../ym3d/dataviz.mjs';
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

/* host.mjs work-around (library issue, reported by integration QA): when a mount goes far off-screen the host calls
   renderer.forceContextLoss() and on the way back rebuilds on the SAME canvas, whose context is still lost → createStage
   throws ("reading 'precision'") and the fallback fires for good. Each build therefore renders into a fresh sibling canvas
   under the host's own canvas, which stays on top (context-less, transparent) as the pointer / drag layer. */
const freshStageLib = (YM) => ({
  ...YM,
  createStage(THREE_, canvas, opts) {
    canvas.__ymRC?.remove();
    const c = document.createElement('canvas');
    c.className = 'ym3d-rc';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    canvas.parentNode.insertBefore(c, canvas);
    canvas.__ymRC = c;
    return YM.createStage(THREE_, c, opts);
  },
});

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let _fonts = null;
const fontsReady = () => (_fonts ||= Promise.all(['600 40px Montserrat', '500 40px Montserrat'].map((f) => document.fonts?.load(f))).catch(() => {}));
/** YM3D fx/halo materials use AdditiveBlending with alpha = 1, which also ADDS alpha: on a transparent canvas every
    glow quad becomes an opaque dark square. Re-map them to add colour only (alpha untouched). */
function additiveKeepsAlpha(THREE, root) {
  root.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      if (m.blending !== THREE.AdditiveBlending) continue;
      Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      m.needsUpdate = true;
    }
  });
}

export default {
  id: 'console',
  nav: '操控台',
  async init(root, ctx) {
    const { lib, data, gsap } = ctx;
    const vis = data.core7[5], cool = data.core7[2];
    const { LEVELS, PULSES, BANDS } = lib;

    const col = (k, label, v) => `
      <div class="cs-pcol" data-k="${k}">
        <button type="button" class="cs-rb btn-plus" data-k="${k}" data-d="1" aria-label="${label} 增加">+</button>
        <span class="cs-pcol__k">${label}</span>
        <span class="cs-pcol__v num" aria-live="polite">${v}</span>
        <button type="button" class="cs-rb btn-minus" data-k="${k}" data-d="-1" aria-label="${label} 减少">−</button>
      </div>`;

    const cells = LEVELS.map((lv) => `
      <div class="cs-mx__row" role="row">
        <span class="cs-mx__rh" role="rowheader" data-lv="${lv}"><b class="num">${lv.toFixed(1)}</b><small>${lib.levelPower(lv)}W</small></span>
        ${PULSES.map((p) => {
          const ok = lib.isAllowed(lv, p);
          const d = lib.density(lv, p);
          const b = lib.bandOf(d);
          return `<button type="button" role="gridcell" tabindex="-1" class="cs-c ${ok ? 'is-' + b.key : 'is-blank'}" data-lv="${lv}" data-p="${p}"
            aria-label="${ok ? `功率档位 ${lv.toFixed(1)}，${lib.levelPower(lv)} 瓦，脉冲时间 ${p.toFixed(1)} 秒，能量密度 ${d.toFixed(1)}，${b.label}` : `功率档位 ${lv.toFixed(1)}，脉冲时间 ${p.toFixed(1)} 秒，限制输出区`}"
            ${ok ? '' : 'aria-disabled="true"'}>${ok ? d.toFixed(1) : ''}</button>`;
        }).join('')}
      </div>`).join('');

    root.innerHTML = `
    <div class="cs-3dl" aria-hidden="true"></div>
    <div class="wrap">
      <header class="sec-head">
        <span class="eyebrow">06 · INTERFACE</span>
        <h2 class="h1">每一发能量，<span class="grad-text">看得见</span></h2>
        <p class="lead"><b>${vis.title}</b>——“${vis.text}”；<b>${cool.title}</b>——“${cool.text}”。下面按使用说明书复刻 YM5 触摸屏与治疗手具：调参数、按压皮肤、按住使能，完整走一遍“准备就绪 → 预备 → 启动 → 完成”。</p>
      </header>

      <div class="cs-grid">
        <div class="cs-left">
          <div class="cs-dev3d" role="img" aria-label="YM5 主机三维模型：触摸屏实时镜像右侧操控面板的状态与参数（准备就绪、预备、输出中、完成）">
            <div class="cs-v3d__lbls" aria-hidden="true">
              <span class="cs-lb cs-lb--scr" data-a="screen"><i></i>触摸屏 · 实时镜像</span>
              <span class="cs-lb cs-lb--en" data-a="enable">使能按钮 · 按住</span>
            </div>
            <div class="cs-dev3d__cap"><span class="chip cs-dev3d__chip">YM5-G1 主机 · 三维示意</span><span class="chip cs-dev3d__hint">拖动旋转</span></div>
          </div>
        </div>

        <div class="cs-right">
          <div class="cs-device" data-reveal>
            <div class="cs-bezel">
              <div class="cs-scr" aria-label="YM5 触摸屏（交互复刻）">
                <div class="cs-scr__top">
                  <span class="cs-logo">${data.product.wordmark}</span>
                  <button type="button" class="cs-gear" aria-label="系统工具按钮（设置）">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.3 4.8-1.8-.3a6.8 6.8 0 0 1-.7 1.6l1.1 1.5-1.6 1.6-1.5-1.1c-.5.3-1 .5-1.6.7l-.3 1.8h-2.2l-.3-1.8a6.8 6.8 0 0 1-1.6-.7l-1.5 1.1-1.6-1.6 1.1-1.5a6.8 6.8 0 0 1-.7-1.6l-1.8-.3v-2.2l1.8-.3c.2-.6.4-1.1.7-1.6L6.2 7.5l1.6-1.6 1.5 1.1c.5-.3 1-.5 1.6-.7l.3-1.8h2.2l.3 1.8c.6.2 1.1.4 1.6.7l1.5-1.1 1.6 1.6-1.1 1.5c.3.5.5 1 .7 1.6l1.8.3v2.2Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
                  </button>
                </div>
                <div class="cs-scr__main">
                  <div class="cs-scr__l">
                    <div class="cs-status" aria-live="polite">
                      <div class="cs-status__t">准备就绪</div>
                      <div class="cs-status__s">按住手具使能按钮开始</div>
                    </div>
                    <div class="cs-tip">
                      <svg class="cs-ring" viewBox="0 0 200 200" aria-hidden="true"><g class="cs-ring__trk"></g><g class="cs-ring__prg"></g></svg>
                      <div class="cs-tip__disc">
                        ${tipSVG()}
                        <span class="cs-tip__frost" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>
                      </div>
                    </div>
                    <ol class="cs-phase" aria-label="启动模式三阶段">
                      ${data.pulsePhases.map((t, i) => `<li data-ph="${i}">${t}</li>`).join('')}
                    </ol>
                  </div>
                  <div class="cs-scr__r">
                    <dl class="cs-read">
                      <div><dt>治疗发数</dt><dd class="num"><span class="cs-o-shots">900</span> / <span>900</span></dd></div>
                      <div><dt>累计能量(KJ)</dt><dd class="num cs-o-kj">0.00</dd></div>
                      <div><dt>阻值(Ω)</dt><dd class="num cs-o-ohm">—</dd></div>
                      <div><dt>功率(W)</dt><dd class="num cs-o-w">55</dd></div>
                    </dl>
                    <div class="cs-bottom">
                      <div class="cs-dens" aria-live="polite">
                        <span class="cs-dens__k">能量密度(J/cm²)</span>
                        <b class="num cs-o-d">13.8</b>
                        <span class="cs-dens__b"><i></i><em>低</em></span>
                      </div>
                      <div class="cs-params">
                        ${col('lv', '功率档位', '2.0')}${col('cool', '制冷强度', '1')}${col('p', '脉冲时间', '1.0')}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="cs-toast" role="status" aria-live="assertive"></div>
                <div class="cs-set" hidden>
                  <button type="button" class="cs-set__back">‹ 返回</button>
                  <div class="cs-set__cols">
                    <section><h4>主机</h4><dl>${SETTINGS.host.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
                    <section><h4>治疗头</h4><dl>${SETTINGS.tip.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
                  </div>
                  <label class="cs-set__sl"><span>亮度</span><input type="range" class="cs-set__bri" min="55" max="120" value="100" aria-label="触摸屏亮度（演示）"></label>
                  <p class="cs-set__n">设置界面：调节触摸屏亮度、显示主机与治疗头型号信息 · 使用说明书 第 14 页 图9（治疗面积：第 11 页）</p>
                </div>
                <div class="cs-empty" hidden>
                  <b>E203 · 治疗头已耗尽</b>
                  <button type="button" class="cs-empty__btn">更换一次性使用治疗头端（演示）</button>
                </div>
              </div>
            </div>
          </div>

          <div class="cs-ctl" data-reveal>
            <div class="cs-hpwrap">
              <div class="cs-hp" role="group" aria-label="治疗手具控制（虚拟）">
                <span class="cs-hp__tip" aria-hidden="true"><i></i></span>
                <button type="button" class="cs-en" aria-pressed="false" aria-label="使能按钮：按住启动，松开中断射频">
                  <span class="cs-en__l">使能</span><span class="cs-en__h">按住</span>
                </button>
                <span class="cs-hp__waist" aria-hidden="true"></span>
                <div class="cs-hp__ctl">
                  <button type="button" class="cs-hk cs-hk--r" data-hk="R" aria-label="R：快速切换到上一次治疗参数">R</button>
                  <span class="cs-hp__pill">
                    <button type="button" class="cs-hk" data-hk="-" aria-label="减少选定参数">−</button>
                    <button type="button" class="cs-hk cs-hk--m" data-hk="M" aria-label="M：选择要调整的参数">M</button>
                    <button type="button" class="cs-hk" data-hk="+" aria-label="增加选定参数">+</button>
                  </span>
                </div>
                <span class="cs-hp__tail" aria-hidden="true"></span>
              </div>
              <ul class="cs-hp__cap">
                <li><b>使能按钮</b>按住进入“预备”，松开即中断射频</li>
                <li><b>R</b>切换到上一次的治疗参数</li>
                <li><b>M</b>选择参数（屏幕显示为绿色），<b>− / +</b> 调节</li>
              </ul>
            </div>
            <div class="cs-pad" role="slider" tabindex="0" aria-label="接触皮肤：治疗头端接触压力（拖动按压）" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="未接触">
              <div class="cs-pad__hd"><b>接触皮肤</b><span class="cs-pad__st">未接触</span></div>
              <div class="cs-pad__stage">
                <div class="cs-pad__tip" aria-hidden="true"><i></i></div>
                <div class="cs-pad__skin" aria-hidden="true"><i class="ep"></i><i class="de"></i><i class="sc"></i><span class="cs-pad__heat"></span><span class="cs-pad__cold"></span></div>
                <div class="cs-pad__meter" aria-hidden="true"><i class="z0"></i><i class="z1"></i><i class="z2"></i><i class="z3"></i><b class="cs-pad__mk"></b></div>
              </div>
              <div class="cs-pad__ft"><span class="micro">拖动按压 · 松手保持</span><button type="button" class="cs-pad__lift">抬离</button></div>
            </div>
          </div>
          <p class="cs-hint small"><span class="num">01</span> 在“接触皮肤”垫上向下拖动，让压力进入绿色区间　<span class="num">02</span> 按住“使能”（键盘：聚焦后按住空格）　<span class="num">03</span> 观察治疗前冷却 → 射频传送 → 治疗后冷却</p>

          <div class="cs-mx card" data-reveal>
            <div class="cs-mx__hd">
              <div><span class="eyebrow">ENERGY MATRIX</span><h3 class="h3">能量输出表 <small>能量密度 J/cm²</small></h3></div>
              <span class="tag-src">使用说明书 第 31 页</span>
            </div>
            <p class="small cs-mx__lead">功率 W × 脉冲时间 s ÷ 4.0 cm² = 能量密度，柱高即能量密度。点击任一立柱即载入操控台，当前设置实时高亮；拖动可旋转。</p>
            <div class="cs-mx3d" tabindex="0" role="group" aria-label="三维能量输出表：柱高为能量密度。方向键移动光标（上下为功率档位，左右为脉冲时间），回车载入操控台">
              <div class="cs-v3d__lbls" aria-hidden="true">
                <span class="cs-lb cs-lb--hl" data-a="highlight"></span>
                <span class="cs-lb cs-lb--zone" data-a="zone">推荐区 · 中 / 较高</span>
                <span class="cs-lb cs-lb--lock" data-a="locked">限制输出区 · 表内空白</span>
              </div>
              <div class="cs-mx3d__tt" hidden></div>
              <span class="cs-sr cs-mx3d__sr" aria-live="polite"></span>
            </div>
            <div class="legend cs-mx__lg cs-mx__lg--3d">
              ${BANDS.map((b) => `<span><i style="background:${b.color}"></i>${b.label} ${b.min}–${b.max}</span>`).join('')}
              <span><i class="cs-lg-blank"></i>限制输出</span>
              <span><i class="cs-lg-zone"></i>推荐区（中、较高）</span>
            </div>
            <details class="cs-mx__det">
              <summary><span>数值表 · 能量输出表原表</span><small>可键盘操作 · 使用说明书 第 31 页</small></summary>
            <div class="cs-mx__wrap">
              <div class="cs-mx__grid" role="grid" aria-label="能量输出表：功率档位 × 脉冲时间 → 能量密度（J/cm²）；方向键移动，回车载入">
                <div class="cs-mx__row cs-mx__row--hd" role="row">
                  <span class="cs-mx__corner" role="columnheader"><i>档位</i><i>s</i></span>
                  ${PULSES.map((p) => `<span class="cs-mx__ch num" role="columnheader" data-p="${p}">${p.toFixed(1)}</span>`).join('')}
                </div>
                ${cells}
              </div>
              <svg class="cs-mx__zone" aria-hidden="true"><path class="cs-mx__zg"/><path class="cs-mx__zp"/></svg>
              <div class="cs-mx__tt" role="tooltip" hidden></div>
            </div>
            </details>
            <div class="cs-cm" aria-live="polite">
              <div class="cs-cm__hd"><span>能量水平与制冷强度匹配</span><span class="cs-cm__cols"><i>1</i><i>2</i><i>3</i><i>4</i></span></div>
              ${BANDS.map((b) => `
                <div class="cs-cm__row" data-b="${b.key}">
                  <span class="cs-cm__lv"><i style="background:${b.color}"></i>${b.label}<small class="num">${b.min}–${b.max}</small></span>
                  <span class="cs-cm__pips">${[1, 2, 3, 4].map((c) => `<i data-c="${c}" class="${b.coolRange.includes(c) ? 'ok' : 'no'} ${c === b.coolDefault ? 'def' : ''}"></i>`).join('')}</span>
                </div>`).join('')}
              <p class="micro cs-cm__n">◎ 默认制冷强度 · ● 可选范围 · 调节功率档位或脉冲时间时，制冷强度自动回到默认档（使用说明书 第 15 页）</p>
            </div>
          </div>
        </div>
      </div>
      <p class="disclaimer cs-disc">界面为依据使用说明书图示的交互复刻示意：冷却阶段时长、接触压力阈值与阻值读数为演示设定（阻值取额定负载 100–250 Ω 范围内的示意值），射频中断时的计数方式为演示处理；三维主机为示意模型。实际操作以设备与使用说明书为准。推荐参数：能量水平位于“中、较高”区域，制冷强度选用默认档位（使用说明书 第 21 页）。</p>
    </div>`;

    /* ================= state ================= */
    const q = (s) => root.querySelector(s), qa = (s) => [...root.querySelectorAll(s)];
    const S = {
      lv: data.defaults.level, cool: data.defaults.cooling, p: data.defaults.pulse,
      shots: 900, kj: 0, ohm: null, sel: null, mode: 'ready', held: false, press: 0,
    };
    const snap = () => ({ lv: S.lv, cool: S.cool, p: S.p });
    const same = (a, b) => a && b && a.lv === b.lv && a.cool === b.cool && a.p === b.p;
    let committed = snap(), last = null, commitT = 0;
    const commit = () => { clearTimeout(commitT); if (!same(snap(), committed)) { last = committed; committed = snap(); } };
    const commitSoon = () => { clearTimeout(commitT); commitT = setTimeout(commit, 1500); };

    /* ================= elements ================= */
    const scr = q('.cs-scr');
    const stT = q('.cs-status__t'), stS = q('.cs-status__s');
    const oShots = q('.cs-o-shots'), oKJ = q('.cs-o-kj'), oOhm = q('.cs-o-ohm'), oW = q('.cs-o-w'), oD = q('.cs-o-d');
    const densBox = q('.cs-dens'), densB = q('.cs-dens__b em');
    const pcols = Object.fromEntries(qa('.cs-pcol').map((c) => [c.dataset.k, c]));
    const tipEl = q('.cs-tip'), phaseLis = qa('.cs-phase li');
    const toastEl = q('.cs-toast');
    const enBtn = q('.cs-en'), pad = q('.cs-pad'), padSt = q('.cs-pad__st'), padStage = q('.cs-pad__stage');
    const mxCells = qa('.cs-c'), mxRH = qa('.cs-mx__rh'), mxCH = qa('.cs-mx__ch');
    const cmRows = qa('.cs-cm__row');

    /* ================= toast ================= */
    let toastT = 0;
    const toast = (msg, kind = 'warn') => {
      toastEl.textContent = msg; toastEl.dataset.kind = kind;
      toastEl.classList.remove('is-on'); void toastEl.offsetWidth; toastEl.classList.add('is-on');
      clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2300);
    };
    const shake = (el) => { if (!ctx.reduced) gsap.fromTo(el, { x: -5 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }); };

    /* ================= render ================= */
    const bandNow = () => lib.bandOf(lib.density(S.lv, S.p));
    let prevVals = {};
    function renderParams(anim = true) {
      const d = lib.density(S.lv, S.p), b = lib.bandOf(d);
      const vals = { lv: S.lv.toFixed(1), cool: String(S.cool), p: S.p.toFixed(1) };
      for (const k of ['lv', 'cool', 'p']) {
        const v = pcols[k].querySelector('.cs-pcol__v');
        if (v.textContent !== vals[k]) {
          const up = prevVals[k] != null && parseFloat(vals[k]) > parseFloat(prevVals[k]);
          v.textContent = vals[k];
          if (anim && !ctx.reduced) gsap.fromTo(v, { y: up ? 10 : -10, opacity: 0.1 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
        }
        pcols[k].classList.toggle('is-sel', S.sel === k);
      }
      prevVals = vals;
      q('.cs-hk--m').classList.toggle('is-on', !!S.sel);
      oW.textContent = String(lib.levelPower(S.lv));
      const old = parseFloat(oD.textContent) || d;
      if (anim && !ctx.reduced && old !== d) {
        const o = { v: old };
        gsap.to(o, { v: d, duration: 0.45, ease: 'power2.out', onUpdate: () => (oD.textContent = o.v.toFixed(1)) });
      } else oD.textContent = d.toFixed(1);
      densBox.style.setProperty('--band', b.hex);
      densB.textContent = b.label;
      // matrix
      mxCells.forEach((c) => {
        const on = +c.dataset.lv === S.lv && +c.dataset.p === S.p;
        c.classList.toggle('is-cur', on);
        c.classList.toggle('in-row', +c.dataset.lv === S.lv && !on);
        c.classList.toggle('in-col', +c.dataset.p === S.p && !on);
        if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      });
      mxRH.forEach((h) => h.classList.toggle('is-cur', +h.dataset.lv === S.lv));
      mxCH.forEach((h) => h.classList.toggle('is-cur', +h.dataset.p === S.p));
      cmRows.forEach((r) => {
        const on = r.dataset.b === b.key;
        r.classList.toggle('is-cur', on);
        r.querySelectorAll('i[data-c]').forEach((i) => i.classList.toggle('cur', on && +i.dataset.c === S.cool));
      });
      buildRing();
    }
    const fmtKJ = (v) => v.toFixed(2);
    function renderReadouts() {
      oShots.textContent = String(S.shots);
      oKJ.textContent = fmtKJ(S.kj);
      oOhm.textContent = S.ohm == null ? '—' : String(S.ohm);
    }

    /* ================= status ================= */
    function setStatus(t, s) {
      if (stT.textContent !== t) {
        stT.textContent = t;
        if (!ctx.reduced) gsap.fromTo(stT, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
      }
      stS.textContent = s;
    }
    const pressState = () => (S.press < P_TOUCH ? 'none' : S.press < P_LO ? 'lo' : S.press <= P_HI ? 'ok' : 'hi');
    const pressOK = () => pressState() === 'ok';
    function refreshStatus() {
      scr.dataset.mode = S.mode;
      enBtn.setAttribute('aria-pressed', String(S.held));
      enBtn.classList.toggle('is-held', S.held);
      if (S.mode === 'ready') setStatus('准备就绪', S.press >= P_TOUCH ? '按住手具使能按钮开始' : '按压皮肤并按住使能按钮开始');
      else if (S.mode === 'armed') {
        const ps = pressState();
        setStatus('预备', ps === 'none' ? '请将治疗头端垂直按压于治疗部位' : ps === 'lo' ? '接触压力不足，请适当加压' : ps === 'hi' ? '接触压力超出范围，请减小压力' : '已感测到适当接触…');
      } else if (S.mode === 'done') setStatus('治疗完成', S.held ? '请开始下一次治疗 · 抬离皮肤并松开使能按钮' : '请开始下一次治疗');
      else if (S.mode === 'empty') setStatus('治疗头已耗尽', '请更换一次性使用治疗头端');
      tipEl.classList.toggle('is-armed', S.mode === 'armed');
    }

    /* ================= ring (pre · N×100ms · post) ================= */
    const trk = q('.cs-ring__trk'), prg = q('.cs-ring__prg');
    let ringSegs = [];
    function buildRing() {
      const n = Math.round(S.p * 10);
      const total = PRE + S.p + POST;
      const GAP = 1.1;
      const segs = [{ kind: 'cool', len: (PRE / total) * 100 }];
      for (let i = 0; i < n; i++) segs.push({ kind: 'rf', len: (0.1 / total) * 100 });
      segs.push({ kind: 'cool', len: (POST / total) * 100 });
      let off = 0;
      trk.innerHTML = ''; prg.innerHTML = '';
      ringSegs = segs.map((s) => {
        const len = Math.max(0.3, s.len - (s.kind === 'rf' ? 0.55 : GAP));
        const mk = (parent, cls) => {
          const c = lib.svg('circle', { cx: 100, cy: 100, r: 92, pathLength: 100, class: `${cls} ${s.kind}`, 'stroke-dasharray': `${len} ${100 - len}`, 'stroke-dashoffset': String(-off - (s.kind === 'rf' ? 0.25 : GAP / 2)) }, parent);
          return c;
        };
        mk(trk, 'seg');
        const p = mk(prg, 'seg');
        p.setAttribute('stroke-dasharray', `0 100`);
        const r = { ...s, len, el: p };
        off += s.len;
        return r;
      });
    }
    function setRing(el) { // el: elapsed seconds in shot sequence (or -1 to clear)
      const n = Math.round(S.p * 10);
      const parts = [PRE, ...Array(n).fill(0.1), POST];
      let t = el;
      ringSegs.forEach((s, i) => {
        const f = el < 0 ? 0 : clamp(t / parts[i], 0, 1);
        t -= parts[i];
        s.el.setAttribute('stroke-dasharray', `${(s.len * f).toFixed(2)} ${(100 - s.len * f).toFixed(2)}`);
      });
    }

    /* ================= parameter logic (lib exact) ================= */
    const onlyReady = () => { if (S.mode !== 'ready') { toast('请在“准备就绪”状态下调节参数'); return false; } return true; };
    function change(k, dir) {
      if (!onlyReady()) return;
      const col = pcols[k];
      if (k === 'lv' || k === 'p') {
        const nlv = k === 'lv' ? Math.round((S.lv + 0.5 * dir) * 2) / 2 : S.lv;
        const np = k === 'p' ? Math.round((S.p + 0.1 * dir) * 10) / 10 : S.p;
        if (nlv < 0.5 || nlv > 8 || np < 0.7 - 1e-9 || np > 1.5 + 1e-9) {
          toast(k === 'lv' ? '功率档位范围 0.5 – 8' : '脉冲时间范围 0.7 – 1.5 s'); shake(col); return;
        }
        if (!lib.isAllowed(nlv, np)) { toast('该组合为限制输出区'); shake(col); flashCell(nlv, np); return; }
        const oldCool = S.cool;
        S.lv = nlv; S.p = np;
        S.cool = bandNow().coolDefault;
        if (S.cool !== oldCool) setTimeout(() => pcols.cool.classList.add('is-auto'), 0), setTimeout(() => pcols.cool.classList.remove('is-auto'), 900);
      } else {
        const b = bandNow(), nc = S.cool + dir;
        if (!b.coolRange.includes(nc)) {
          toast(`能量水平“${b.label}”可选制冷强度 ${b.coolRange[0]}–${b.coolRange[b.coolRange.length - 1]}`); shake(col); return;
        }
        S.cool = nc;
      }
      renderParams(); commitSoon();
    }
    function flashCell(lv, p) {
      const c = mxCells.find((x) => +x.dataset.lv === lv && +x.dataset.p === p);
      if (!c) return;
      c.classList.remove('is-deny'); void c.offsetWidth; c.classList.add('is-deny');
    }
    function load(lv, p, from) {
      if (!onlyReady()) return;
      if (!lib.isAllowed(lv, p)) { toast('该组合为限制输出区'); flashCell(lv, p); return; }
      commit();
      S.lv = lv; S.p = p; S.cool = bandNow().coolDefault;
      renderParams(); commit();
      if (from === 'mx') toast(`已载入 ${lv.toFixed(1)} 档 · ${p.toFixed(1)} s · 制冷 ${S.cool}`, 'ok');
    }

    qa('.cs-rb').forEach((b) => b.addEventListener('click', () => change(b.dataset.k, +b.dataset.d)));

    /* handpiece: R / − M + */
    let selT = 0;
    const ORDER = ['lv', 'cool', 'p'];
    const NAMES = { lv: '功率档位', cool: '制冷强度', p: '脉冲时间' };
    const armSel = () => { clearTimeout(selT); selT = setTimeout(() => { if (S.sel) { S.sel = null; renderParams(false); commit(); toast('参数已自动确认', 'ok'); } }, 3200); };
    qa('.cs-hk').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.hk;
      if (k === 'M') {
        if (!onlyReady()) return;
        const i = S.sel ? ORDER.indexOf(S.sel) : -1;
        S.sel = ORDER[(i + 1) % 3];
        renderParams(false); armSel();
        toast(`已选择：${NAMES[S.sel]}`, 'info');
      } else if (k === '+' || k === '-') {
        if (!S.sel) { toast('请先按 M 选择要调整的参数', 'info'); return; }
        change(S.sel, k === '+' ? 1 : -1); armSel();
      } else if (k === 'R') {
        if (!onlyReady()) return;
        commit();
        if (!last) { toast('暂无上一次治疗参数', 'info'); return; }
        const tgt = last; last = committed; committed = { ...tgt };
        S.lv = tgt.lv; S.p = tgt.p; S.cool = tgt.cool;
        renderParams(); toast(`已切换到上一次参数：${tgt.lv.toFixed(1)} 档 · 制冷 ${tgt.cool} · ${tgt.p.toFixed(1)} s`, 'ok');
      }
    }));

    /* ================= enable button (press & hold) ================= */
    let armT = 0;
    function enableDown() {
      if (S.held) return;
      S.held = true;
      if (S.mode === 'ready') {
        if (S.shots <= 0) { S.mode = 'empty'; }
        else { S.mode = 'armed'; if (S.sel) { S.sel = null; renderParams(false); } commit(); }
      }
      refreshStatus(); evaluate();
    }
    function enableUp() {
      if (!S.held) return;
      S.held = false;
      clearTimeout(armT);
      if (S.mode === 'armed') S.mode = 'ready';
      else if (S.mode === 'fire' && (seq.phase === 'pre' || seq.phase === 'rf')) interrupt('released');
      else if (S.mode === 'done') S.mode = 'ready';
      refreshStatus();
    }
    function evaluate() {
      clearTimeout(armT);
      if (S.mode !== 'armed') return;
      if (S.held && pressOK()) armT = setTimeout(() => { if (S.mode === 'armed' && S.held && pressOK()) fire(); }, 320);
    }
    enBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { enBtn.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ } enableDown(); });
    enBtn.addEventListener('pointerup', enableUp);
    enBtn.addEventListener('pointercancel', enableUp);
    enBtn.addEventListener('lostpointercapture', enableUp);
    enBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    enBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); enableDown(); } else if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
    enBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); enableUp(); } });
    enBtn.addEventListener('blur', enableUp);

    /* ================= contact pad ================= */
    function setPress(v) {
      S.press = clamp(Math.round(v), 0, 100);
      pad.style.setProperty('--press', (S.press / 100).toFixed(3));
      const sh = padStage.clientHeight || 150, skinTop = sh * 0.5, tipH = 40;
      const bottom = S.press < P_TOUCH ? skinTop - 34 + (S.press / P_TOUCH) * 34 : skinTop + ((S.press - P_TOUCH) / (100 - P_TOUCH)) * 22;
      pad.style.setProperty('--tipY', (bottom - tipH).toFixed(1) + 'px');
      pad.style.setProperty('--dent', Math.max(0, bottom - skinTop).toFixed(1) + 'px');
      const ps = pressState();
      const txt = { none: '未接触', lo: '压力过轻', ok: '接触良好', hi: '压力过大' }[ps];
      padSt.textContent = txt; pad.dataset.ps = ps;
      pad.setAttribute('aria-valuenow', String(S.press)); pad.setAttribute('aria-valuetext', `${txt}（${S.press}）`);
      if (S.mode === 'fire' && (seq.phase === 'pre' || seq.phase === 'rf') && !pressOK()) interrupt('pressure');
      if (S.mode === 'ready' || S.mode === 'armed') refreshStatus();
      evaluate();
    }
    const padFromY = (e) => {
      const r = padStage.getBoundingClientRect();
      return clamp((e.clientY - r.top - 18) / (r.height - 36), 0, 1) * 100;
    };
    padStage.addEventListener('pointerdown', (e) => {
      e.preventDefault(); try { padStage.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ } pad.classList.add('is-drag');
      const y0 = e.clientY, v0 = S.press;
      const r = padStage.getBoundingClientRect();
      // absolute jump if pressed below the current tip, otherwise relative drag feels natural
      const abs = padFromY(e);
      const useAbs = Math.abs(abs - v0) > 12;
      if (useAbs) setPress(abs);
      const base = useAbs ? abs : v0;
      const move = (ev) => setPress(base + ((ev.clientY - y0) / (r.height - 36)) * 100);
      const up = () => { pad.classList.remove('is-drag'); padStage.removeEventListener('pointermove', move); padStage.removeEventListener('pointerup', up); padStage.removeEventListener('pointercancel', up); };
      padStage.addEventListener('pointermove', move); padStage.addEventListener('pointerup', up); padStage.addEventListener('pointercancel', up);
    });
    pad.addEventListener('keydown', (e) => {
      const m = { ArrowDown: 5, ArrowRight: 5, ArrowUp: -5, ArrowLeft: -5, PageDown: 15, PageUp: -15 };
      if (e.key in m) { e.preventDefault(); setPress(S.press + m[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); setPress(0); }
      else if (e.key === 'End') { e.preventDefault(); setPress(100); }
    });
    q('.cs-pad__lift').addEventListener('click', () => {
      if (ctx.reduced) setPress(0);
      else { const o = { v: S.press }; gsap.to(o, { v: 0, duration: 0.4, ease: 'power2.out', onUpdate: () => setPress(o.v) }); }
    });

    /* ================= firing sequence (IFU §7.6) ================= */
    const seq = { phase: null, t0: 0, tRF: 0, tPost: 0, raf: 0, interrupted: false, delivered: 0, sub: -1 };
    let ohmBase = 150;
    const nextOhm = () => { ohmBase = clamp(ohmBase + (Math.random() - 0.5) * 36, 112, 238); return Math.round(clamp(ohmBase + (Math.random() - 0.5) * 12, 100, 250)); };
    function setPhase(i) {
      phaseLis.forEach((li, k) => { li.classList.toggle('is-on', k === i); li.classList.toggle('is-done', i >= 0 && k < i); });
      tipEl.classList.toggle('is-cool', i === 0 || i === 2);
      tipEl.classList.toggle('is-rf', i === 1);
      pad.classList.toggle('is-cool', i === 0 || i === 2);
      pad.classList.toggle('is-rf', i === 1);
    }
    function fire() {
      S.mode = 'fire'; scr.dataset.mode = 'fire';
      commit();
      Object.assign(seq, { phase: 'pre', t0: performance.now(), interrupted: false, delivered: 0, sub: -1 });
      setStatus('输出中', '能量输出中…，请保持静止');
      setPhase(0);
      cancelAnimationFrame(seq.raf);
      seq.raf = requestAnimationFrame(tick);
    }
    function tick(now) {
      const el = (now - seq.t0) / 1000;
      if (seq.phase === 'pre') {
        setRing(el);
        if (el >= PRE) { seq.phase = 'rf'; seq.tRF = now; S.ohm = nextOhm(); renderReadouts(); setPhase(1); }
      }
      if (seq.phase === 'rf') {
        const e = (now - seq.tRF) / 1000;
        setRing(PRE + Math.min(e, S.p));
        const sub = Math.floor(e / 0.1);
        if (sub !== seq.sub && e < S.p) { seq.sub = sub; tipEl.classList.remove('is-tick'); void tipEl.offsetWidth; tipEl.classList.add('is-tick'); }
        if (e >= S.p) endRF(S.p, now);
      }
      if (seq.phase === 'post') {
        const e = (now - seq.tPost) / 1000;
        if (!seq.interrupted) setRing(PRE + S.p + Math.min(e, POST));
        if (e >= POST) { finish(); return; }
      }
      seq.raf = requestAnimationFrame(tick);
    }
    function endRF(dur, now) {
      seq.phase = 'post'; seq.tPost = now; seq.delivered = dur;
      const J = lib.levelPower(S.lv) * dur;
      const k0 = S.kj;
      S.kj += J / 1000;
      if (!seq.interrupted) S.shots = Math.max(0, S.shots - 1); // 每传送一次射频能量脉冲，治疗发数递减一次（IFU p.15）
      oShots.textContent = String(S.shots);
      if (!ctx.reduced) { const o = { v: k0 }; gsap.to(o, { v: S.kj, duration: 0.6, ease: 'power2.out', onUpdate: () => (oKJ.textContent = fmtKJ(o.v)) }); }
      else oKJ.textContent = fmtKJ(S.kj);
      [oShots, oKJ].forEach((x) => { x.classList.remove('is-bump'); void x.offsetWidth; x.classList.add('is-bump'); });
      setPhase(2);
    }
    function interrupt(why) {
      if (seq.phase !== 'rf' && seq.phase !== 'pre') return;
      const now = performance.now(), before = seq.phase === 'pre';
      seq.interrupted = true;
      // IFU p.10 / p.15: 松开使能按钮或抬起治疗头 → 射频停止输出，进入治疗后冷却（预冷阶段中断则不输出射频）
      if (before) { seq.phase = 'post'; seq.tPost = now; seq.delivered = 0; setPhase(2); }
      else endRF(Math.min((now - seq.tRF) / 1000, S.p), now);
      const what = before ? '射频未输出' : '射频已停止';
      setStatus('输出中断', why === 'pressure' ? `接触压力不足，${what} · 保持接触以完成治疗后冷却` : `${what} · 请保持治疗头端接触皮肤，完成治疗后冷却`);
      scr.classList.add('is-int');
    }
    function finish() {
      cancelAnimationFrame(seq.raf);
      seq.phase = null;
      setPhase(-1);
      tipEl.classList.remove('is-tick');
      scr.classList.remove('is-int');
      if (seq.interrupted) { S.mode = S.held ? 'done' : 'ready'; setRing(-1); refreshStatus(); if (S.held) setStatus('输出中断', '请抬离皮肤并松开使能按钮'); return; }
      S.mode = S.shots <= 0 ? 'empty' : 'done';
      refreshStatus();
      q('.cs-empty').hidden = S.mode !== 'empty';
      setTimeout(() => { if (S.mode === 'done' && !S.held) { S.mode = 'ready'; refreshStatus(); } }, 1800);
      setTimeout(() => { if (S.mode !== 'fire') setRing(-1); }, 1800);
      if (S.mode === 'done' && S.held) setTimeout(() => refreshStatus(), 1400);
    }
    q('.cs-empty__btn').addEventListener('click', () => { S.shots = 900; S.mode = 'ready'; q('.cs-empty').hidden = true; renderReadouts(); refreshStatus(); });

    /* settings overlay */
    const set = q('.cs-set');
    q('.cs-gear').addEventListener('click', () => { if (S.mode !== 'ready') { toast('请在“准备就绪”状态下打开设置'); return; } set.hidden = false; q('.cs-set__back').focus(); });
    q('.cs-set__back').addEventListener('click', () => { set.hidden = true; q('.cs-gear').focus(); });
    const bri = q('.cs-set__bri');
    bri.addEventListener('input', () => { scr.style.setProperty('--bri', (bri.value / 100).toFixed(2)); bri.style.setProperty('--p', ((bri.value - bri.min) / (bri.max - bri.min)) * 100 + '%'); });
    bri.dispatchEvent(new Event('input'));

    /* ================= matrix interactions ================= */
    const tt = q('.cs-mx__tt'), mxWrap = q('.cs-mx__wrap');
    function showTip(c) {
      const lv = +c.dataset.lv, p = +c.dataset.p, ok = lib.isAllowed(lv, p);
      if (ok) {
        const d = lib.density(lv, p), b = lib.bandOf(d);
        tt.innerHTML = `<b>${lib.levelPower(lv)} W × ${p.toFixed(1)} s ÷ 4.0 cm² = <em style="color:${b.hex}">${d.toFixed(1)}</em> J/cm²</b><span>功率档位 ${lv.toFixed(1)} · 能量水平“${b.label}” · 默认制冷 ${b.coolDefault}（可选 ${b.coolRange.join('、')}）</span>`;
      } else {
        const raw = (lib.levelPower(lv) * p) / 4;
        tt.innerHTML = `<b>限制输出区</b><span>${lv.toFixed(1)} 档 × ${p.toFixed(1)} s 在能量输出表中为空白${raw > 38.8 ? '（按公式将高于表内上限 38.8 J/cm²）' : '（过低组合限制输出）'}，该组合不可选择</span>`;
      }
      tt.hidden = false;
      const wr = mxWrap.getBoundingClientRect(), cr = c.getBoundingClientRect();
      const tw = tt.offsetWidth, th = tt.offsetHeight;
      let x = cr.left - wr.left + cr.width / 2 - tw / 2;
      x = clamp(x, 0, wr.width - tw);
      let y = cr.top - wr.top - th - 8;
      if (y < 0) y = cr.bottom - wr.top + 8;
      tt.style.transform = `translate(${x}px, ${y}px)`;
    }
    const hideTip = () => { tt.hidden = true; };
    mxCells.forEach((c) => {
      c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(c); });
      c.addEventListener('pointerleave', hideTip);
      c.addEventListener('focus', () => showTip(c));
      c.addEventListener('blur', hideTip);
      c.addEventListener('click', () => { focusCell(c); load(+c.dataset.lv, +c.dataset.p, 'mx'); });
    });
    // roving tabindex
    let focusIdx = mxCells.findIndex((c) => +c.dataset.lv === S.lv && +c.dataset.p === S.p);
    const focusCell = (c) => { mxCells.forEach((x) => (x.tabIndex = -1)); c.tabIndex = 0; focusIdx = mxCells.indexOf(c); };
    mxCells[focusIdx].tabIndex = 0;
    q('.cs-mx__grid').addEventListener('keydown', (e) => {
      const c = e.target.closest('.cs-c');
      if (!c) return;
      let i = mxCells.indexOf(c), r = Math.floor(i / 9), k = i % 9;
      const m = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (m) { r = clamp(r + m[0], 0, 15); k = clamp(k + m[1], 0, 8); }
      else if (e.key === 'Home') k = 0;
      else if (e.key === 'End') k = 8;
      else return;
      e.preventDefault();
      const n = mxCells[r * 9 + k]; focusCell(n); n.focus();
    });

    /* recommended-zone outline (中 + 较高 cells) */
    const zg = q('.cs-mx__zg'), zp = q('.cs-mx__zp'), zsvg = q('.cs-mx__zone');
    function drawZone() {
      const wr = { width: mxWrap.offsetWidth, height: mxWrap.offsetHeight };
      zsvg.setAttribute('viewBox', `0 0 ${wr.width} ${wr.height}`);
      zsvg.setAttribute('width', wr.width); zsvg.setAttribute('height', wr.height);
      const inZ = (lv, p) => lib.isAllowed(lv, p) && ['mid', 'high'].includes(lib.bandOf(lib.density(lv, p)).key);
      let d = '';
      const r1 = (v) => Math.round(v * 10) / 10;
      mxCells.forEach((c, i) => {
        const lv = +c.dataset.lv, p = +c.dataset.p;
        if (!inZ(lv, p)) return;
        const r = Math.floor(i / 9), k = i % 9;
        const cl = c.offsetLeft, ct = c.offsetTop;
        const x0 = r1(cl - 1.5), x1 = r1(cl + c.offsetWidth + 1.5), y0 = r1(ct - 1.5), y1 = r1(ct + c.offsetHeight + 1.5);
        const nb = (dr, dk) => { const rr = r + dr, kk = k + dk; if (rr < 0 || rr > 15 || kk < 0 || kk > 8) return false; return inZ(LEVELS[rr], PULSES[kk]); };
        if (!nb(-1, 0)) d += `M${x0} ${y0}H${x1}`;
        if (!nb(1, 0)) d += `M${x0} ${y1}H${x1}`;
        if (!nb(0, -1)) d += `M${x0} ${y0}V${y1}`;
        if (!nb(0, 1)) d += `M${x1} ${y0}V${y1}`;
      });
      zg.setAttribute('d', d); zp.setAttribute('d', d);
    }
    const ro = new ResizeObserver(() => drawZone());
    ro.observe(q('.cs-mx__grid'));

    /* ================= boot ================= */
    renderParams(false);
    renderReadouts();
    refreshStatus();
    setPress(0);
    document.fonts?.ready.then(drawZone);
    lib.onResize(() => setPress(S.press));

    // one-time attention cue: pulse the pad + enable when the console scrolls into view
    if (!ctx.reduced) {
      lib.whenVisible(q('.cs-ctl'), () => {
        if (root.dataset.cued) return; root.dataset.cued = '1';
        gsap.fromTo([pad, enBtn], { boxShadow: '0 0 0 0 rgba(67,230,168,0.6)' }, { boxShadow: '0 0 0 14px rgba(67,230,168,0)', duration: 1.2, repeat: 2, stagger: 0.3, ease: 'power2.out', clearProps: 'boxShadow' });
      }, null, '-25% 0px');
    }

    /* ================= 3D (YM3D) — one WebGL context, two views =================
       A sticky, viewport-sized transparent canvas (.cs-3dl) sits behind the content. Each frame the 3D console
       (.cs-dev3d, createDevice) and the 3D energy matrix (.cs-mx3d, createEnergyMatrix3D) are rendered into their
       on-screen rectangles via viewport + scissor, so the section never holds more than one WebGL context.
       The virtual touchscreen state S / seq drives the 3D screen (screenValues + status), the holstered
       handpiece (enable / keys / RF glow / cooling) and the matrix highlight; clicks on the 3D bars call load(). */
    {
      const reduced3 = !!ctx.reduced;
      const layer = q('.cs-3dl'), mxTT = q('.cs-mx3d__tt'), mxSR = q('.cs-mx3d__sr');
      const KEYS = { R: 'R', M: 'M', '-': 'minus', '+': 'plus' };
      const press = { k: null, at: -1e9 };
      qa('.cs-hk').forEach((b) => b.addEventListener('click', () => { press.k = KEYS[b.dataset.hk]; press.at = performance.now(); }));
      const mkView = (el) => ({
        el, on: false, x: 0, y: 0, w: 0, h: 0, top: 0, px: 0, py: 0,
        drag: { az: 0, el: 0, active: false, moved: 0, lx: 0, ly: 0 }, ptr: { x: 0, y: 0, in: false },
        lbls: [...el.querySelectorAll('.cs-lb')].map((n) => ({ el: n, a: n.dataset.a, out: {}, on: false })),
      });
      const VD = mkView(q('.cs-dev3d')), VM = mkView(q('.cs-mx3d'));
      let st3 = null, sig = '', hover = null, kc = null, mxRev = reduced3 ? 1 : 0, mxStarted = reduced3, en = 0, glow = 0, cold = 0;
      const _v = new THREE.Vector3(), _ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), _hit = new THREE.Vector3();

      /* drag-to-orbit (+ click) on a view; the canvas is behind the DOM, so the placeholders take the pointer */
      function bindView(v, onClick, onHover) {
        const el = v.el;
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          v.ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; v.ptr.y = -(((e.clientY - r.top) / r.height) * 2 - 1); v.ptr.in = true;
          if (v.drag.active) {
            const dx = e.clientX - v.drag.lx, dy = e.clientY - v.drag.ly; v.drag.lx = e.clientX; v.drag.ly = e.clientY;
            v.drag.moved += Math.abs(dx) + Math.abs(dy);
            if (v.drag.moved > 6) { v.drag.az = clamp(v.drag.az - dx * 0.0045, -1.2, 1.2); v.drag.el = clamp(v.drag.el + dy * 0.0035, -0.45, 0.8); onHover?.(null); }
          } else onHover?.(e, r);
        });
        el.addEventListener('pointerleave', () => { v.ptr.in = false; if (!v.drag.active) onHover?.(null); });
        el.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          Object.assign(v.drag, { active: true, moved: 0, lx: e.clientX, ly: e.clientY });
          try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
          el.classList.add('is-grab');
        });
        const up = (e) => {
          if (!v.drag.active) return;
          v.drag.active = false; el.classList.remove('is-grab');
          if (v.drag.moved <= 6 && e.type === 'pointerup') onClick?.(e);
        };
        el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      }

      /* ---- matrix: picking, tooltip, keyboard cursor ---- */
      const tipHTML = (lv, p) => {
        if (lib.isAllowed(lv, p)) {
          const d = lib.density(lv, p), b = lib.bandOf(d);
          return `<b>${lib.levelPower(lv)} W × ${p.toFixed(1)} s ÷ 4.0 cm² = <em style="color:${b.hex}">${d.toFixed(1)}</em> J/cm²</b><span>功率档位 ${lv.toFixed(1)} · 能量水平“${b.label}” · 默认制冷 ${b.coolDefault}</span>`;
        }
        return `<b>限制输出区</b><span>${lv.toFixed(1)} 档 × ${p.toFixed(1)} s 在能量输出表中为空白，该组合不可选择</span>`;
      };
      let ttKey = '', ttMsgT = 0;
      function showTT(html, x, y, key) {
        if (key !== ttKey) { mxTT.innerHTML = html; ttKey = key; }
        mxTT.hidden = false;
        const w = mxTT.offsetWidth, h = mxTT.offsetHeight;
        const tx = clamp(x - w / 2, 4, VM.w - w - 4), ty = y - h - 16 < 4 ? y + 18 : y - h - 16;
        mxTT.style.transform = `translate(${tx.toFixed(0)}px, ${ty.toFixed(0)}px)`;
      }
      const hideTT = () => { if (Date.now() < ttMsgT) return; mxTT.hidden = true; ttKey = ''; };
      function pick(e, r) {
        if (!st3 || !mxStarted) return null;
        _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        ray.setFromCamera(_ndc, st3.camM);
        let best = null, bd = Infinity;
        for (const b of st3.boxes) { if (ray.ray.intersectBox(b.box, _hit)) { const d = _hit.distanceToSquared(ray.ray.origin); if (d < bd) { bd = d; best = b.c; } } }
        return best;
      }
      bindView(VM, (e) => {
        const c = pick(e, VM.el.getBoundingClientRect());
        if (!c) return;
        kc = null;
        if (S.mode !== 'ready') { showTT('<b>请在“准备就绪”状态下调节参数</b><span>松开使能按钮、等待本发完成后再选择</span>', hover?.x ?? VM.w / 2, hover?.y ?? VM.h / 2, 'busy'); ttMsgT = Date.now() + 1600; return; }
        load(c.lv, c.p, 'mx');
        if (!c.allowed) { showTT(tipHTML(c.lv, c.p), e.clientX - VM.el.getBoundingClientRect().left, e.clientY - VM.el.getBoundingClientRect().top, 'deny' + c.lv + c.p); ttMsgT = Date.now() + 1400; }
      }, (e, r) => {
        if (!e) { hover = null; hideTT(); VM.el.style.cursor = ''; return; }
        const c = pick(e, r);
        if (!c) { hover = null; hideTT(); VM.el.style.cursor = ''; return; }
        hover = { c, x: e.clientX - r.left, y: e.clientY - r.top };
        VM.el.style.cursor = c.allowed ? 'pointer' : 'not-allowed';
        if (e.pointerType === 'mouse') showTT(tipHTML(c.lv, c.p), hover.x, hover.y, `${c.lv}|${c.p}`);
      });
      VM.el.addEventListener('keydown', (e) => {
        const m = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        if (!kc) kc = { i: LEVELS.indexOf(S.lv), j: PULSES.indexOf(S.p) };
        if (m) { e.preventDefault(); kc.i = clamp(kc.i + m[0], 0, 15); kc.j = clamp(kc.j + m[1], 0, 8); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); load(LEVELS[kc.i], PULSES[kc.j], 'mx'); return; }
        else if (e.key === 'Escape') { kc = null; hideTT(); return; }
        else return;
        const lv = LEVELS[kc.i], p = PULSES[kc.j];
        mxSR.textContent = lib.isAllowed(lv, p) ? `功率档位 ${lv.toFixed(1)}，脉冲时间 ${p.toFixed(1)} 秒，能量密度 ${lib.density(lv, p).toFixed(1)}，${lib.bandOf(lib.density(lv, p)).label}；回车载入` : `功率档位 ${lv.toFixed(1)}，脉冲时间 ${p.toFixed(1)} 秒，限制输出区`;
      });
      VM.el.addEventListener('blur', () => { kc = null; hideTT(); });
      bindView(VD, null, null);

      /* ---- device: UI state → screenValues / status / handpiece ---- */
      const sv = { level: 2, cooling: 1, pulse: 1, shots: 900, shotsTotal: 900, energyKJ: 0, ohm: '—', status: 'ready', selected: null };
      const devP = { t: 0, screen: 'treatment', screenValues: sv, rimGlow: 0.6, enablePressed: 0, electrodeGlow: 0, cooling: 0, buttonPress: null, buttonPressAmount: 1, tipInsert: 1 };
      const STATUS = { ready: 'ready', armed: 'standby', fire: 'firing', done: 'done', empty: 'done' };
      const SEL = { lv: 'level', cool: 'cooling', p: 'pulse' };
      function devParams(t, dt) {
        Object.assign(sv, { level: S.lv, cooling: S.cool, pulse: S.p, shots: S.shots, energyKJ: +S.kj.toFixed(2), ohm: S.ohm == null ? '—' : S.ohm, status: STATUS[S.mode] || 'ready', selected: SEL[S.sel] || null });
        devP.screen = S.mode === 'empty' ? 'activate' : 'treatment';
        devP.t = reduced3 ? 0 : t;
        const k = reduced3 ? 1 : 1 - Math.exp(-dt * 14);
        en += ((S.held ? 1 : 0) - en) * k;
        const now = performance.now();
        const rfOn = seq.phase === 'rf' && !seq.interrupted, coolOn = seq.phase === 'pre' || seq.phase === 'post';
        const sub = rfOn ? (((now - seq.tRF) / 1000) % 0.1) / 0.1 : 0; // 100 ms sub-pulses
        glow += ((rfOn ? (sub < 0.86 ? 0.75 : 0.3) : 0) - glow) * (reduced3 ? 1 : 1 - Math.exp(-dt * 30));
        cold += ((coolOn ? 0.9 : 0) - cold) * k;
        const since = now - press.at;
        Object.assign(devP, {
          enablePressed: en, electrodeGlow: glow, cooling: cold,
          rimGlow: S.mode === 'fire' ? 0.82 + (reduced3 ? 0 : 0.14 * Math.sin(t * 9)) : 0.6,
          buttonPress: since < 280 ? press.k : null, buttonPressAmount: since < 280 ? Math.sin(Math.PI * since / 280) : 0,
        });
      }

      /* ---- cameras ---- */
      const orbit = (cam, o, az = 0, el = 0, rk = 1) => {
        const a = o.azimuth + az, e = o.elevation + el, r = o.radius * rk, [tx, ty, tz] = o.target;
        cam.position.set(tx + r * Math.cos(e) * Math.sin(a), ty + r * Math.sin(e), tz + r * Math.cos(e) * Math.cos(a));
        cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz);
      };
      const mixO = (a, b, k, o) => { for (let i = 0; i < 3; i++) o.target[i] = a.target[i] + (b.target[i] - a.target[i]) * k; o.radius = a.radius + (b.radius - a.radius) * k; o.azimuth = a.azimuth + (b.azimuth - a.azimuth) * k; o.elevation = a.elevation + (b.elevation - a.elevation) * k; return o; };
      const DW = { target: [0, 0.66, 0.02], radius: 3.8, azimuth: -0.62, elevation: 0.14 };
      const DC = { target: [-0.02, 1.0, 0.2], radius: 1.3, azimuth: -0.2, elevation: 0.06 };
      const MXI = { target: [0.05, 0.1, 0.1], radius: 9.6, azimuth: -0.25, elevation: 1.05 };
      const oD = { target: [0, 0, 0] }, oM = { target: [0, 0, 0] };
      const setAspect = (cam, w, h) => { const a = w / h; if (Math.abs(cam.aspect - a) > 1e-4) { cam.aspect = a; cam.updateProjectionMatrix(); } };
      const parallax = (v, dt) => {
        const k = 1 - Math.exp(-dt * 3);
        v.px += ((v.ptr.in && !v.drag.active ? v.ptr.x : 0) - v.px) * k; v.py += ((v.ptr.in && !v.drag.active ? v.ptr.y : 0) - v.py) * k;
        if (!v.drag.active && !reduced3) { const d = Math.exp(-dt * 0.9); v.drag.az *= d; v.drag.el *= d; }
      };

      function place(v, l, o, on, ax = -0.5, ay = -1, dx = 0, dy = -12) {
        const vis = on && o.visible && o.x > 6 && o.x < v.w - 6 && o.y > 6 && o.y < v.h - 6;
        if (vis !== l.on) { l.on = vis; l.el.classList.toggle('is-on', vis); }
        if (vis) l.el.style.transform = `translate3d(${(o.x + dx).toFixed(1)}px, ${(o.y + dy).toFixed(1)}px, 0) translate(${ax * 100}%, ${ay * 100}%)`;
      }
      let hlTxt = '';

      function drawDevice(s, stage, t, dt) {
        const { renderer, camera } = stage;
        parallax(VD, dt);
        devParams(t, dt);
        s.dev.update(devP);
        const vh = window.innerHeight;
        const k = reduced3 ? 1 : S3.ease.inOut(clamp((vh * 0.92 - VD.top) / (vh * 0.62), 0, 1));
        mixO(DW, DC, k, oD);
        const asp = VD.w / VD.h, fit = Math.max(1, Math.pow(0.7 / asp, 0.85));
        setAspect(camera, VD.w, VD.h);
        orbit(camera, oD, VD.drag.az + VD.px * 0.09 + (reduced3 ? 0 : 0.035 * Math.sin(t * 0.23)), VD.drag.el * 0.7 - VD.py * 0.04, 1 + (fit - 1) * k);
        renderer.render(stage.scene, camera);
        // labels: screen chip + enable (while held)
        for (const l of VD.lbls) {
          s.dev.anchor(l.a, _v);
          if (l.a === 'screen') _v.y += 0.105;
          const o = projectAnchor(THREE, _v, camera, VD.w, VD.h, l.out);
          if (l.a === 'screen') place(VD, l, o, k > 0.85);
          else place(VD, l, o, S.held && k > 0.85, -1, -0.5, -18, 0);
        }
      }

      function drawMatrix(s, stage, t, dt) {
        const { renderer } = stage;
        if (!mxStarted && VM.top < window.innerHeight * 0.86) mxStarted = true;
        s.mx.object3d.visible = mxStarted;
        if (mxStarted && mxRev < 1) mxRev = Math.min(1, mxRev + dt / 2.4);
        parallax(VM, dt);
        const rv = S3.ease.inOut(mxRev);
        const hc = kc ? { lv: LEVELS[kc.i], p: PULSES[kc.j] } : null;
        s.mx.update({ t: reduced3 ? 0 : t, reveal: rv, highlight: { lv: S.lv, p: S.p }, pulseHighlight: reduced3 ? 0 : 0.7, focus: 0.45, zone: 1, values: 0, labels: 1 });
        const base = s.mx.view, asp = VM.w / VM.h, fit = Math.max(0.94, Math.pow(1.5 / asp, 0.55));
        mixO(MXI, base, S3.ease.out(clamp(mxRev * 1.15, 0, 1)), oM);
        setAspect(s.camM, VM.w, VM.h);
        orbit(s.camM, oM, VM.drag.az + VM.px * 0.07, VM.drag.el * 0.7 - VM.py * 0.03, fit);
        renderer.render(s.sceneM, s.camM);
        // labels
        const d = lib.density(S.lv, S.p), b = lib.bandOf(d);
        const small = VM.w < 480;
        const txt = small ? `${S.lv.toFixed(1)} × ${S.p.toFixed(1)} s · <b style="color:${b.hex}">${d.toFixed(1)}</b> · ${b.label}` : `${S.lv.toFixed(1)} 档 × ${S.p.toFixed(1)} s · <b style="color:${b.hex}">${d.toFixed(1)}</b> J/cm² · ${b.label}`;
        for (const l of VM.lbls) {
          if (l.a === 'highlight' && txt !== hlTxt) { hlTxt = txt; l.el.innerHTML = `<i style="background:${b.hex}"></i>${small ? '' : '当前 '}${txt}`; }
          const o = projectAnchor(THREE, s.mx.anchors[l.a], s.camM, VM.w, VM.h, l.out);
          const on = rv > 0.98 && (l.a === 'highlight' || (!small && !hover && !kc));
          place(VM, l, o, on, -0.5, -1, 0, l.a === 'highlight' ? -10 : -4);
        }
        // keyboard cursor tooltip
        if (hc) {
          s.mx.cellTop(hc.lv, hc.p, _v); _v.y += 0.05;
          const o = projectAnchor(THREE, _v, s.camM, VM.w, VM.h, {});
          showTT(tipHTML(hc.lv, hc.p) + '<span class="cs-mx3d__k">回车载入 · Esc 取消</span>', o.x, o.y, `k${hc.lv}|${hc.p}`);
        }
      }

      let wasAny = true;
      function frame3(s, stage, t, dt) {
        st3 = s;
        const lr = layer.getBoundingClientRect(), W = lr.width, H = lr.height;
        let rs = '';
        for (const v of [VD, VM]) {
          const r = v.el.getBoundingClientRect();
          v.x = r.left - lr.left; v.y = r.top - lr.top; v.w = r.width; v.h = r.height; v.top = r.top;
          v.on = v.w > 4 && v.h > 4 && v.x < W && v.x + v.w > 0 && v.y < H && v.y + v.h > 0;
          rs += `${v.on ? 1 : 0}${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.w)},${Math.round(v.h)};`;
        }
        const any = VD.on || VM.on;
        if (reduced3) { // single still per state: redraw only when the UI state or the view rectangles change
          const ns = `${rs}|${S.lv}|${S.cool}|${S.p}|${S.shots}|${S.kj}|${S.ohm}|${S.mode}|${S.sel}|${S.held}|${seq.phase}|${kc && kc.i + ',' + kc.j}|${VD.drag.az.toFixed(3)},${VD.drag.el.toFixed(3)},${VM.drag.az.toFixed(3)},${VM.drag.el.toFixed(3)}|${mxStarted}`;
          if (ns === sig) return; sig = ns;
        }
        if (!any && !wasAny) return;
        wasAny = any;
        const { renderer } = stage;
        renderer.setScissorTest(false); renderer.clear();
        for (const [v, draw] of [[VD, drawDevice], [VM, drawMatrix]]) {
          if (!v.on) continue;
          const gy = H - (v.y + v.h);
          renderer.setViewport(v.x, gy, v.w, v.h); renderer.setScissor(v.x, gy, v.w, v.h); renderer.setScissorTest(true);
          draw(s, stage, t, dt);
        }
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
      }

      fontsReady().then(() => mount3D(layer, {
        THREE, stageLib: precompileLib(freshStageLib(S3)), dpr: 1.5, margin: '25% 0px', farMargin: '120% 0px',
        stageOpts: { fov: 30, transparent: true, exposure: 1.0 },
        build(stage) {
          const dev = createDevice(THREE, { screenRes: 1280, internals: false, back: false });
          additiveKeepsAlpha(THREE, dev.object3d);
          stage.scene.add(dev.object3d);
          const kl = stage.lights.key;
          kl.position.set(2.2, 4.2, 3.2); kl.target.position.set(0, 0.8, 0); stage.scene.add(kl.target);
          Object.assign(kl.shadow.camera, { left: -1.2, right: 1.2, top: 1.8, bottom: -0.6 }); kl.shadow.camera.updateProjectionMatrix();
          stage.lights.rim.intensity = 1.1;
          // matrix scene (own lights, shared PMREM environment)
          const sceneM = new THREE.Scene(); sceneM.environment = stage.env;
          const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 5); key.castShadow = true;
          key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
          const rim = new THREE.DirectionalLight(S3.BRAND.violet, 1.6); rim.position.set(-5, 3, -4);
          const fill = new THREE.HemisphereLight(0xdfe6ff, 0x140c24, 0.35);
          sceneM.add(key, rim, fill);
          const mx = createEnergyMatrix3D(THREE, {});
          additiveKeepsAlpha(THREE, mx.object3d);
          sceneM.add(mx.object3d);
          const camM = new THREE.PerspectiveCamera(32, 1.5, 0.05, 100);
          const boxes = mx.cells.map((c) => {
            mx.cellTop(c.lv, c.p, _v); const hw = 0.1125;
            return { c, box: new THREE.Box3(new THREE.Vector3(_v.x - hw, -0.02, _v.z - hw), new THREE.Vector3(_v.x + hw, Math.max(0.07, _v.y), _v.z + hw)) };
          });
          sig = ''; wasAny = true;
          queueMicrotask(() => { try { stage.renderer.compileAsync(sceneM, camM).catch(() => {}); } catch (e) { /* lost */ } }); // precompile the matrix view too
          return { dev, mx, sceneM, camM, boxes, lightsM: [key, rim, fill] };
        },
        frame: frame3,
        dispose(s) { st3 = null; s?.dev?.dispose(); s?.mx?.dispose(); s?.lightsM?.forEach((l) => l.shadow?.map?.dispose?.()); },
        fallback() { root.classList.add('cs-nogl'); },
      }));
    }
  },
};

function tipSVG() {
  return `<svg class="cs-tip__art" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="csBody" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4a4d56"/><stop offset=".18" stop-color="#1b1c22"/><stop offset=".7" stop-color="#0b0b0f"/><stop offset="1" stop-color="#2a2c33"/></linearGradient>
      <linearGradient id="csSide" x1="0" x2="1"><stop offset="0" stop-color="#15161b"/><stop offset="1" stop-color="#303340"/></linearGradient>
      <linearGradient id="csGold" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff0c2"/><stop offset=".35" stop-color="#e8b85c"/><stop offset=".7" stop-color="#b07a2a"/><stop offset="1" stop-color="#f3cf7e"/></linearGradient>
      <radialGradient id="csHot" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff4d6"/><stop offset=".5" stop-color="#ffc45e" stop-opacity=".8"/><stop offset="1" stop-color="#f0603f" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="104" cy="160" rx="62" ry="10" fill="rgba(0,0,0,.45)"/>
    <g transform="rotate(-32 100 100)">
      <rect x="42" y="72" width="22" height="56" rx="6" fill="#0d0e12" stroke="rgba(255,255,255,.08)"/>
      <rect x="58" y="66" width="86" height="68" rx="16" fill="url(#csBody)"/>
      <rect x="66" y="72" width="66" height="5" rx="2.5" fill="rgba(255,255,255,.14)"/>
      <path d="M140 66 h10 a8 8 0 0 1 8 8 v52 a8 8 0 0 1 -8 8 h-10 z" fill="url(#csSide)"/>
      <g class="cs-face">
        <rect x="150" y="70" width="14" height="60" rx="4" fill="url(#csGold)"/>
        <rect x="153" y="76" width="8" height="48" rx="2" fill="none" stroke="rgba(90,50,10,.45)" stroke-width="1"/>
        <path d="M155 80v40M159 80v40" stroke="rgba(90,50,10,.25)" stroke-width=".8"/>
        <rect class="cs-face__hot" x="146" y="62" width="24" height="76" rx="8" fill="url(#csHot)"/>
        <rect class="cs-face__cold" x="149" y="69" width="16" height="62" rx="5" fill="#bfeaff"/>
      </g>
      <text x="100" y="106" text-anchor="middle" class="cs-tip__lbl">YM5-TP4</text>
    </g>
  </svg>`;
}
