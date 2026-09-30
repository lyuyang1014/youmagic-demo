// #footer — registration, manufacturer & compliance information (IFU p.1, p.4; DA p.5–6)

// src: IFU printed p.1 (生产企业住所)
const MFR_ADDR = {
  '邦迅医药科技（上海）有限公司': '上海市浦东新区瑞庆路 526 号 1 幢 2 层 201 室、3 层 313 室、4 层整层',
  '威脉清通医疗科技（无锡）有限公司': '江苏省无锡市新吴区净慧东道 196 号 F 栋 5 楼',
};

export default {
  id: 'footer',
  async init(root, ctx) {
    const { data: D, gsap, reduced, lib } = ctx;
    const P = D.product;
    const mark = P.wordmark;

    root.innerHTML = `
    <div class="ft-glow" aria-hidden="true"></div>
    <div class="wrap">
      <div class="ft-mark" aria-hidden="true">${[...mark].map((c) => `<span>${c}</span>`).join('')}</div>

      <div class="ft-top">
        <div class="ft-brand">
          <a class="ft-logo" href="#hero" aria-label="返回顶部">${mark}<sup>®</sup></a>
          <p class="ft-tech">${P.tech} · ${P.name}</p>
          <p class="ft-ind"><span class="mono">适用范围</span>${P.indication}</p>
          <button type="button" class="btn ft-top-btn">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15.5V4.5M5 9.5l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            返回顶部
          </button>
        </div>

        <dl class="ft-info">
          <div class="ft-cell ft-cell--reg">
            <dt>医疗器械注册证号</dt>
            <dd class="ft-reg mono">${P.regNo}</dd>
          </div>
          <div class="ft-cell">
            <dt>注册人 / 售后服务单位</dt>
            <dd><b>${P.registrant}</b><span>${P.registrantAddr}</span><a class="ft-tel mono" href="tel:${P.hotline.replace(/-/g, '')}">${P.hotline}</a></dd>
          </div>
          ${P.manufacturers.map((m, i) => `
          <div class="ft-cell">
            <dt>生产企业 ${i + 1}</dt>
            <dd><b>${m.name}</b><span>${MFR_ADDR[m.name] || ''}</span><span class="mono ft-lic">${m.license}</span></dd>
          </div>`).join('')}
        </dl>
      </div>

      <div class="ft-notes">
        <p class="ft-note ft-note--key">${D.disclaimers.pro}</p>
        <p class="ft-note">${D.disclaimers.brochure}</p>
        <p class="ft-note">案例影像：${D.disclaimers.individual}</p>
        <p class="ft-note">${D.disclaimers.sim}</p>
        <p class="ft-note ft-note--contra"><b>禁忌证</b>${D.disclaimers.contraindication}</p>
      </div>

      <div class="ft-bottom">
        <p class="ft-read">禁忌内容或者注意事项详见说明书 · 请仔细阅读产品说明书或者在医务人员的指导下购买和使用</p>
        <p class="micro">资料来源：${P.name}使用说明书（编制日期 ${P.ifuDate}）· ${P.brand} 产品彩页 · 页面中的交互演示均为原理示意</p>
      </div>
    </div>`;

    root.querySelector('.ft-top-btn').addEventListener('click', () => ctx.scrollTo('#hero'));

    // wordmark: letters rise in; a soft light follows the pointer
    const markEl = root.querySelector('.ft-mark');
    if (!reduced) {
      gsap.from(markEl.children, {
        yPercent: 70, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: markEl, start: 'top 92%', once: true },
      });
    }
    const spans = [...markEl.children];
    const measure = () => {
      // fit the wordmark exactly to the column width
      markEl.style.fontSize = '100px';
      const natural = spans.reduce((a, sp) => a + sp.offsetWidth, 0) || 1;
      markEl.style.fontSize = Math.min(260, (100 * markEl.clientWidth) / natural * 0.97) + 'px';
      const W = markEl.clientWidth, H = markEl.clientHeight;
      markEl.style.setProperty('--W', W + 'px'); markEl.style.setProperty('--H', H + 'px');
      markEl.style.setProperty('--mx', W * 0.5 + 'px'); markEl.style.setProperty('--my', H * 0.6 + 'px');
      spans.forEach((sp) => sp.style.setProperty('--x0', sp.offsetLeft + 'px'));
    };
    measure(); lib.onResize(measure); document.fonts?.ready.then(measure);
    if (!reduced) {
      markEl.addEventListener('pointermove', (e) => {
        const r = markEl.getBoundingClientRect();
        markEl.style.setProperty('--mx', e.clientX - r.left + 'px');
        markEl.style.setProperty('--my', e.clientY - r.top + 'px');
      });
      markEl.addEventListener('pointerleave', measure);
    }
  },
};
