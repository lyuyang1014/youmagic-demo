// Single source of truth for every fact shown on the site.
// src: "IFU p.N" = 使用说明书印刷页码; "DA p.N" = 产品彩页页码.
// Any number rendered on the page must come from here.

export const DATA = {
  product: {
    brand: 'YOUMAGIC',
    wordmark: 'YŌUMAGIC',
    name: 'YM5 射频皮肤治疗仪',
    tech: '高能单极射频',
    techEn: 'High Energy Monopolar RF',
    type: '单极电容耦合射频皮肤治疗仪', // IFU p.6
    indication: '本产品在医疗机构中，由有资质的医务人员经培训合格后使用，利用射频热效应减轻面部轻、中度皮肤皱纹。', // IFU p.4
    indicationShort: '减轻面部轻、中度皮肤皱纹', // DA p.1 wording; separator per IFU p.4 (合规：轻、中度)
    regNo: '国械注准 20243092361', // IFU p.1 (第三类医疗器械，按注册证编号规则)
    registrant: '昆山威脉通医疗科技有限公司',
    registrantAddr: '江苏省苏州市昆山市玉山镇登云路 268 号 1 号房 801 室 B2',
    hotline: '400-888-0993',
    manufacturers: [
      { name: '邦迅医药科技（上海）有限公司', license: '沪药监械生产许 20242792 号' },
      { name: '威脉清通医疗科技（无锡）有限公司', license: '苏药监械生产许 20250003 号' },
    ],
    ifuDate: '2025 年 1 月 3 日',
    src: 'IFU p.1, p.4, p.6',
  },

  heritage: {
    since: 1995,
    lines: ['清华大学', '“八五”国家科技攻关项目'],
    motto: ['国家工程奠基 植根清华大学', '多专利 自主研发'],
    src: 'DA p.6',
  },

  // 3 adjustable RF parameters — DA p.2 + IFU p.9–10, p.30
  params: [
    { key: 'power', label: '功率档位', range: '0.5 – 8', step: 0.5, note: '每 0.5 档 +10 W，25 W → 175 W' },
    { key: 'cooling', label: '制冷强度', range: '1 – 4', step: 1, note: '数值越大，治疗头端降温速率越快、温度越低' },
    { key: 'pulse', label: '脉冲时间', range: '0.7 s – 1.5 s', step: 0.1, note: '一个脉冲对应 0.1 秒；数值越大，脉冲数量越多' },
  ],

  // 7 core technologies — verbatim from DA p.2
  core7: [
    { n: '01', title: '闪脉冲技术', text: '100ms 窄脉宽能量数更密，温度上升更稳定', key: '100ms', anchor: '#pulse' },
    { n: '02', title: '动态脉冲技术', text: '因肤调节长短脉冲，个性化治疗多样化选择', key: '因肤调节', anchor: '#pulse' },
    { n: '03', title: '多重制冷调节技术', text: '多强度制冷调节，更加人性化和舒适性高', key: '多强度', anchor: '#console' },
    { n: '04', title: '多维智能温控技术', text: '智能算法精准释放制冷量，保护表皮更安全', key: '智能算法', anchor: '#mechanism' },
    { n: '05', title: '5+4 激活验真技术', text: '五端激活+四维验真，全方位杜绝假货', key: '五端激活+四维验真', anchor: '#verify' },
    { n: '06', title: '可视化能量密度', text: '能量密度监测，精准温控直达肌肤深层', key: '密度监测', anchor: '#console' },
    { n: '07', title: 'AI 能量匹配技术', text: 'AI 智能匹配阻抗网络，补偿能量输出更精准有效', key: 'AI', anchor: '#impedance' },
  ],

  // electrical / mechanical specs — IFU p.6–8, p.11, p.30
  specs: {
    rfFreq: '6.78 MHz ± 3%',
    impedance: '75 – 350 Ω ± 20%',
    ratedLoad: '100 – 250 Ω',
    energyLevel: '0 – 8，步进 0.5',
    power: '25 – 175 W',
    cooling: '1 – 4，步进 1',
    pulse: '0.7 s – 1.5 s，步进 0.1 s，±10%',
    powerAccuracy: '输出功率误差不大于设定值的 ±20%',
    input: '220 V~，50 Hz，500 VA',
    mode: '连续运行',
    shock: 'I 类 · BF 型应用部分',
    maxPeakVoltage: '360 V',
    size: '600 × 480 × 1285 mm',
    weight: '< 45 kg',
    ip: 'IPX0',
    cables: { power: '3.0 m', handpiece: '2.0 m', electrode: '2.0 m' },
    lifetime: { host: '5 年', tip: '3 年' },
    standards: ['GB 9706.1-2020', 'GB 9706.202-2021', 'YY 9706.102-2021（1 组 B 类）'],
    operating: '10 – 30 °C · 10 – 90 %RH · 700 – 1060 hPa',
  },

  components: [
    { name: '主机', model: 'YM5-G1', material: '/', contact: '否' },
    { name: '治疗手具总成', model: 'YM5-H1', material: '/', contact: '否' },
    { name: '一次性使用治疗头端', model: 'YM5-TP4-900', material: '铜、聚酰亚胺', contact: '是', note: '治疗面积 4.0 cm² · 900 发 · 仅供一名患者使用' },
    { name: '制冷剂罐', model: 'R134a', material: '', contact: '', note: '递送至治疗头端电极的非患者侧，冷却皮肤表面' },
    { name: '中性电极片', model: 'GBS-Db1131a', material: '', contact: '', note: '一次性分散电极，闭合射频回路；接触质量持续监测' },
  ],

  // load vs power (IFU p.31, 图12) — full power plateau across rated load
  loadCurve: {
    load: [75, 100, 150, 200, 250, 300, 350],
    full: [140, 175, 175, 175, 175, 150, 130],
    half: [95, 95, 95, 95, 95, 95, 95],
    src: 'IFU p.31 图12',
  },

  // RF pulse phases (IFU p.15 §7.6)
  pulsePhases: ['治疗前冷却', '射频传送', '治疗后冷却'],

  // touch-screen reference state (IFU p.9 图3 / p.13 图8)
  screenRef: { shots: 586, total: 900, energyKJ: 12.25, ohm: 109, watt: 135, level: 6.0, cooling: 1, pulse: 1.0, density: 33.8 },
  defaults: { level: 2, cooling: 1, pulse: 1.0 }, // IFU p.19 默认安全参数

  // treatment workflow (IFU p.18–23)
  protocol: {
    prep: [
      '取下治疗区域所有金属饰品，清除润肤露、油等皮肤用品，剃除体毛；面部治疗须束起头发',
      '告知患者治疗期间务必反馈热感或不适',
      '将中性电极片贴于血管丰富、平坦、干燥的腰部或身体两侧（髋关节以上）',
      '在四肢和身体放置干纱布，防止皮肤对皮肤接触',
    ],
    device: ['开机自检', '安装一次性治疗头端（仅单向可插入），扫码激活', '75% 酒精清洁治疗头端', '连接中性电极片', '就绪：制冷剂罐 · 手具 · 头端 · 电极片'],
    plan: '按治疗头 4 cm² 大小在面部绘制紧密排列的正方形网格，逐格治疗',
    limits: '同一部位的治疗最多不超过 6 次，每次间隔应至少大于 60 s',
    feedbackTarget: '将患者热感反馈保持在 2.0 – 3.0',
    heatScale: ['无感觉', '温热感', '热感', '很热', '非常热', '无法忍受'],
    coolScale: ['无感觉', '微凉', '很凉', '很凉', '非常凉'],
    lowerEnergyZones: ['颧骨', '下颌', '颞部', '前额'],
    noGo: '不可用于眼部（包括眶骨以内上下眼睑区域，或眶缘内区域）',
    recommended: '能量水平位于“中、较高”区域（能量密度目标约 16.6 – 31.3 J/cm²），制冷强度选用默认档位',
    src: 'IFU p.4, p.18–22',
  },

  // fault / protection codes (IFU p.24–25)
  faults: [
    { code: 'E101', text: '手具连接异常', group: 'device' },
    { code: 'E103', text: '标定参数错误', group: 'device' },
    { code: 'E104', text: '制冷剂未安装', group: 'cooling' },
    { code: 'E202', text: '治疗头未识别 · 请检查是否是正品治疗头', group: 'auth' },
    { code: 'E203', text: '治疗头已耗尽', group: 'auth' },
    { code: 'E301', text: '治疗头已在别处使用过', group: 'auth' },
    { code: 'E302', text: '治疗头使用超时', group: 'auth' },
    { code: 'E303', text: '治疗头有激活记录 · 疑似回充头', group: 'auth' },
    { code: 'E304', text: '治疗头有写入记录 · 疑似回充头', group: 'auth' },
    { code: 'E306', text: '治疗头激活失败', group: 'auth' },
    { code: 'E403', text: '电极回路连接不佳', group: 'circuit' },
    { code: 'E406', text: '有接地回路', group: 'circuit' },
    { code: 'E503', text: '制冷剂不足', group: 'cooling' },
    { code: 'E603', text: '阻抗异常', group: 'circuit' },
    { code: 'E605', text: '功率异常', group: 'output' },
    { code: 'E628', text: '温度过高', group: 'output' },
  ],

  // clinical study (IFU p.32–33) + brochure charts (DA p.3)
  study: {
    design: ['前瞻性', '多中心', '随机', '平行对照', '盲法评价', '非劣效性设计'],
    n: 212,
    followUpDays: 180,
    population: 'FWCS 皱纹评分 3–6 分 · Fitzpatrick 皮肤分级 II–V 型 · 30–60 周岁',
    comparator: '已上市单极射频治疗系统（对照器械）',
    comparatorIFU: 'Thermage CPT System（型号 TG-2B）', // named in IFU p.32
    endpoints: '治疗后第 30、90、180 天面部皱纹改善有效率及 FWCS 皱纹评分',
    conclusion: '均非劣于对照器械，治疗效果与对照器械差异无统计学意义。',
    centers: ['中国医学科学院整形外科医院', '南方医科大学', '成都市第二人民医院', '新疆维吾尔自治区人民医院'],
    src: 'IFU p.32–33 · DA p.3, p.5',
  },
  charts: {
    // 总有效率 (printed values, DA p.3)
    efficacy: { months: ['1 个月', '3 个月', '6 个月'], youmagic: [90.65, 100.0, 96.23], control: [90.29, 98.1, 91.18] },
    // FWCS 均值 (printed values, DA p.3)
    fwcs: { points: ['筛选期', '1 个月', '3 个月', '6 个月'], youmagic: [4.57, 4.39, 3.94, 4.01], control: [4.55, 4.22, 3.81, 3.88] },
    // GAIS 3 个月分值占比 — NOT printed on the brochure; read off bar heights (±1.5 pt). Always label “≈ 估读”.
    // efficacy definition: GAIS ≤ 3 分例数 / 总例数 (盲评)
    gais: { estimated: true, scores: ['1分', '2分', '3分', '4分', '5分'], youmagic: [16, 57, 27, 0, 0], control: [16, 57, 25.1, 1.9, 0] },
    // FWCS 与基线相比跨级分数占比 — NOT printed; read off bars (totals ±2.5, segments ±1.5). Always label “≈ 估读”.
    fwcsShift: {
      estimated: true,
      months: ['1 个月', '3 个月', '6 个月'],
      keys: ['>3分', '2分', '1分'],
      youmagic: [[1, 2.5, 31], [1, 17, 51], [0, 13.5, 56]],
      control: [[0, 0, 37], [0, 17, 55], [0, 11.5, 52]],
      note: '跨级分数 = 基线期分值 − 随访时间分值；跨级分值越大说明改善效果越明显',
    },
    efficacyDef: '有效率：治疗后不同随访时间的面部皱纹与基线期相比，依据盲评结果，GAIS 评分 ≤ 3 分的例数占该组总例数的百分比。',
    // collagen ratio vs week 0 (animal study, DA p.4) — estimated from plotted points
    collagen: { weeks: [0, 4, 12], type1: [1.0, 1.42, 1.61], type3: [1.0, 1.38, 1.49] },
    gaisScale: ['改善非常明显', '改善明显', '有一定程度改善', '没有变化', '比以前更糟'],
  },
  visia: { actualAge: 32, before: 32, after: 27, src: 'DA p.5 · 数据来自 VISIA 皮肤检测仪' },

  disclaimers: {
    individual: '存在个体差异，不视为对产品功效的保证。',
    pro: '本页面内容仅供医疗专业机构及其专业人士交流使用。',
    brochure: '本产品信息物料仅供专业机构及其专业人士了解使用，未经品牌同意，任何一方不得将该物料用作产品宣传推广等用途。',
    sim: '交互模拟为原理示意，用于理解作用机制，不代表实际组织温度或临床数据。',
    contraindication: '体内有金属植入物（包括金属镶牙）、有源植入物的人群，一般不可以进行治疗。植入心脏起搏器、除颤器的人群不能接受治疗，也不要靠近设备工作的地方。',
  },
};
