// 1. 数据定义
// 1.1 客户档案数据库
const userProfiles = {
    'profile1': {
        name: "王女士",
        age: 28,
        concern: "改善皱纹和松弛",
        matched_by: ['20-29', 'anti-aging'],
        report_title: "王女士，您的专属抗衰老诊断报告",
        data_interpretation: {
            skinAge: { val: 32, label: "检测肌龄" },
            hydroLipid: { val: 45, label: "水油均衡", unit: "%" },
            barrierHealth: { val: 60, label: "屏障健康度", unit: "/100" },
            collagenDensity: { val: 65, label: "胶原蛋白丰盈度", unit: "/100" },
            smasFirmness: { val: 70, label: "SMAS筋膜层紧致度", unit: "/100" },
            periorbitalFirmness: { val: 58, label: "眼周紧致度", unit: "/100" },
            pigmentation: { val: 85, label: "色素沉着分析", unit: "/100" },
            poreRefinement: { val: 78, label: "毛孔细腻度", unit: "/100" }
        },
        master_plan: {
            name: "YOUMAGIC™ · 初老肌精准抗衰方案",
            description: "针对28岁肌龄特点，通过刺激真皮层胶原蛋白的持续新生，精准对抗第一道细纹，重塑面部年轻结构，实现预防与治疗双重功效。",
            core_treatment: {
                tech: "YOUMAGIC™ 智感单极射频",
                params: ["治疗强度: 5-7档", "建议发数: 900发"]
            },
            professional_treatments: "建议在射频治疗后一周，搭配进行深层补水导入或抗氧化精华护理，以最大化治疗效果。",
            homecare_products: "日间使用含维生素C的抗氧化精华；夜间建立对A醇/视黄醇类产品的耐受，促进胶原再生。",
            lifestyle_advice: "保证充足睡眠，每日严格防晒，有助于延缓光老化。",
            areaHighlight: "areas-highlight-1.png"
        },
        similar_case: {
            before: "1.png",
            after: "1A.png",
            desc: "这位28岁的用户同样面临初老和眼周细纹的困扰，这是她在接受YOUMAGIC智感单极射频治疗一个疗程后的真实效果对比。"
        },
        community_feedback: [
            { platform: 'weibo', user: '@不爱加班的Linda', text: '年纪一到28，<strong>法令纹</strong>真的藏不住了，加上天天<strong>熬夜加班</strong>，整个脸都感觉往下掉。做完YOUMAGIC一个疗程，最大的感受就是脸被重新"抓"住了，<strong>紧致感</strong>特别明显，化妆再也不卡粉了！' },
            { platform: 'rednote', user: '@甜心教主本人', text: '作为初代90后，最怕的就是<strong>初老</strong>症状。眼角已经有几条小细纹了，朋友推荐来做YOUMAGIC，感觉像是给皮肤做了一次深层SPA，现在眼周的<strong>干纹</strong>都不见了，上妆超服帖。' },
            { platform: 'douyin', user: '@一只小汤圆', text: '我主要是想改善<strong>肤色暗沉</strong>和预防松弛，做完之后整个脸都亮了一个度，而且感觉皮肤变得更Q弹了，会坚持做下去的。' }
        ],
        analysis: {
            skinAge: { val: 32, label: "检测肌龄" },
            hydroLipid: { val: 45, label: "水油均衡", unit: "%" },
            barrierHealth: { val: 60, label: "屏障健康度", unit: "/100" },
            collagenDensity: { val: 65, label: "胶原蛋白丰盈度", unit: "/100" },
            smasFirmness: { val: 70, label: "SMAS筋膜层紧致度", unit: "/100" },
            periorbitalFirmness: { val: 58, label: "眼周紧致度", unit: "/100" },
            pigmentation: { val: 85, label: "色素沉着分析", unit: "/100" },
            poreRefinement: { val: 78, label: "毛孔细腻度", unit: "/100" },
            visual_summary: "根据您的面部图像分析，初期老化迹象主要表现在<strong>眼周的动态细纹</strong>和<strong>鼻唇沟区域的轻微凹陷</strong>。这表明您的皮肤弹性开始下降，是启动预防性抗衰治疗的最佳时机。"
        }
    },
    'profile2': {
        name: "李女士",
        age: 38,
        concern: "改善皱纹和松弛",
        matched_by: ['30-39', '40+', 'anti-aging'],
        report_title: "李女士，您的专属轮廓新生诊断报告",
        data_interpretation: {
            skinAge: { val: 45, label: "检测肌龄" },
            hydroLipid: { val: 35, label: "水油均衡", unit: "%" },
            barrierHealth: { val: 55, label: "屏障健康度", unit: "/100" },
            collagenDensity: { val: 45, label: "胶原蛋白丰盈度", unit: "/100" },
            smasFirmness: { val: 40, label: "SMAS筋膜层紧致度", unit: "/100" },
            periorbitalFirmness: { val: 42, label: "眼周紧致度", unit: "/100" },
            pigmentation: { val: 68, label: "色素沉着分析", unit: "/100" },
            poreRefinement: { val: 82, label: "毛孔细腻度", unit: "/100" }
        },
        master_plan: {
            name: "YOUMAGIC™ · 熟龄肌轮廓重塑方案",
            description: "为38岁熟龄肌定制的强效抗衰方案，目标是作用于SMAS筋膜层，重建深层支撑结构，显著提升面部轮廓，实现视觉年龄的逆转。",
            core_treatment: {
                tech: "YOUMAGIC™ 智感单极射频",
                params: ["治疗强度: 8-10档 (强效)", "建议发数: 1200发 (全面部+颈部)"]
            },
            professional_treatments: "可考虑在疗程间隙，搭配进行中胚层疗法，为皮肤补充修复所需营养物质。",
            homecare_products: "选择含胜肽、玻色因等抗衰成分的高效能精华；配合使用含有神经酰胺或角鲨烷的修复类面霜。",
            lifestyle_advice: "增加富含Omega-3的食物摄入，如深海鱼，有益于皮肤抗炎和保湿。",
            areaHighlight: "areas-highlight-2.png"
        },
        similar_case: {
            before: "2.png",
            after: "2A.png",
            desc: "这位38岁的用户面临下面部松弛和轮廓模糊问题，治疗后实现了清晰的下颌线和全面的紧致提升。"
        },
        community_feedback: [
            { platform: 'rednote', user: '@优雅的二姨', text: '生完孩子后感觉<strong>面部下垂</strong>得特别快，尤其是<strong>下颌线</strong>，都快跟脖子连一起了。YOUMAGIC是我的救星，做完三次之后，侧脸轮廓绝了，彻底告别了"妈妈感"！' },
            { platform: 'douyin', user: '@不服老的王姐', text: '我这个年纪，最怕的就是<strong>"垮"</strong>。试了很多项目，YOUMAGIC是体感最好、效果最明显的，感觉把松掉的肉都提上去了，整个人都精神了。' },
            { platform: 'weibo', user: '@生活家Aimee', text: '法令纹和<strong>木偶纹</strong>真的很显老！做完YOUMAGIC之后，这两条线都变浅了好多，朋友都说我看起来年轻了好几岁，钱花得太值了。' }
        ],
        analysis: {
            skinAge: { val: 45, label: "检测肌龄" },
            hydroLipid: { val: 35, label: "水油均衡", unit: "%" },
            barrierHealth: { val: 55, label: "屏障健康度", unit: "/100" },
            collagenDensity: { val: 45, label: "胶原蛋白丰盈度", unit: "/100" },
            smasFirmness: { val: 40, label: "SMAS筋膜层紧致度", unit: "/100" },
            periorbitalFirmness: { val: 42, label: "眼周紧致度", unit: "/100" },
            pigmentation: { val: 68, label: "色素沉着分析", unit: "/100" },
            poreRefinement: { val: 82, label: "毛孔细腻度", unit: "/100" },
            visual_summary: "从整体轮廓评估，您的问题核心在于<strong>SMAS筋膜层的松弛</strong>和<strong>大面积的胶原流失</strong>，尤其集中在<strong>中下面部</strong>。这导致了下颌线模糊和全面的\"下垂感\"，需要进行深层、强效的提拉紧致治疗。"
        }
    },
    'profile3': {
        name: "张小姐",
        age: 23,
        concern: "解决痘痘和毛孔",
        matched_by: ['20-29', 'acne-pores'],
        report_title: "张小姐，您的专属净肤焕颜诊断报告",
        data_interpretation: {
            skinAge: { val: 25, label: "检测肌龄" },
            hydroLipid: { val: 25, label: "水油均衡", unit: "%" },
            barrierHealth: { val: 70, label: "屏障健康度", unit: "/100" },
            collagenDensity: { val: 88, label: "胶原蛋白丰盈度", unit: "/100" },
            smasFirmness: { val: 90, label: "SMAS筋膜层紧致度", unit: "/100" },
            periorbitalFirmness: { val: 92, label: "眼周紧致度", unit: "/100" },
            pigmentation: { val: 70, label: "色素沉着分析", unit: "/100" },
            poreRefinement: { val: 50, label: "毛孔细腻度", unit: "/100" }
        },
        master_plan: {
            name: "YOUMAGIC™ · 油性痘肌净肤修复方案",
            description: "专为年轻油性痘肌设计，旨在通过调节皮脂腺的过度活跃，加速痘印代谢、收缩粗大毛孔，重建健康的皮肤屏障。",
            core_treatment: {
                tech: "YOUMAGIC™ 智感单极射频 (净肤模式)",
                params: ["治疗模式: 净肤-修复模式", "建议能量: 4-6档"]
            },
            professional_treatments: "定期进行医疗级清洁项目，如水飞梭或果酸焕肤，以保持毛孔通畅。",
            homecare_products: "使用含有水杨酸或壬二酸的精华来疏通毛孔、抑制炎症；选择无油配方的保湿产品。",
            lifestyle_advice: "减少高糖、高GI食物的摄入，有助于控制皮脂腺的过度分泌。",
            areaHighlight: "areas-highlight-3.png"
        },
        similar_case: {
            before: "3.png",
            after: "3A.png",
            desc: "这位23岁的用户受痘痘和毛孔问题困扰，治疗后肤质得到显著改善，水油趋于平衡，肤色更均匀。"
        },
        community_feedback: [
            { platform: 'douyin', user: '@奶油小面包', text: '混油皮真的太难了，T区<strong>油光满面</strong>，两颊又<strong>毛孔粗大</strong>。做了YOUMAGIC的净肤模式，感觉找到了本命项目！出油情况好了很多，现在素颜出门都敢了。' },
            { platform: 'rednote', user: '@今天不长痘', text: '之前手贱挤痘痘，留下了好多<strong>新生痘印</strong>，红红黑黑的很难看。这个项目对付痘印真的有一手，做完几次之后，脸干净了好多，化妆终于不用狂上遮瑕了。' },
            { platform: 'weibo', user: '@成分党研究员', text: '我主要是看中了它能调节<strong>水油平衡</strong>和修复屏障。做完之后皮肤状态稳定了很多，不再那么容易<strong>反复长痘</strong>了，对于油痘肌来说是维稳的一把好手。' }
        ],
        analysis: {
            skinAge: { val: 25, label: "检测肌龄" },
            hydroLipid: { val: 25, label: "水油均衡", unit: "%" },
            barrierHealth: { val: 70, label: "屏障健康度", unit: "/100" },
            collagenDensity: { val: 88, label: "胶原蛋白丰盈度", unit: "/100" },
            smasFirmness: { val: 90, label: "SMAS筋膜层紧致度", unit: "/100" },
            periorbitalFirmness: { val: 92, label: "眼周紧致度", unit: "/100" },
            pigmentation: { val: 70, label: "色素沉着分析", unit: "/100" },
            poreRefinement: { val: 50, label: "毛孔细腻度", unit: "/100" },
            visual_summary: "您的皮肤主要问题源于<strong>皮脂腺过度活跃</strong>，导致<strong>T区和两颊的毛孔堵塞与粗大</strong>，并伴有炎症后的<strong>色素沉着（痘印）</strong>。我们的方案将首先从调节水油平衡和疏通毛孔入手。"
        }
    }
};

// 1.2 数据解读信息库
const tooltipData = {
    skinAge: {
        title: "肌龄 (Skin Age)",
        content: "<p><strong>检测原理:</strong> 通过深度学习算法，分析您面部图像的皱纹、色斑、纹理等超过100个特征点，与我们包含10万+份亚洲肌肤样本的数据库进行比对，从而估算出您肌肤的当前状态年龄。</p><p><strong>数值解读:</strong> 肌龄高于生理年龄，意味着您的皮肤老化速度超过了自然规律，需要立刻进行干预。</p>"
    },
    elasticity: {
        title: "弹性指数",
        content: "<p><strong>检测原理:</strong> 模拟物理拉伸测试，通过分析皮肤在微表情下的回弹速度和纹理变化，评估真皮层中弹性纤维的健康程度。</p><p><strong>数值解读:</strong> 分数越低，表示弹性纤维流失越严重，皮肤越容易出现松弛和下垂。</p>"
    },
    wrinkles: {
        title: "皱纹分析",
        content: "<p><strong>检测原理:</strong> 运用图像识别技术，检测并分类面部的静态纹（无表情时也存在）和动态纹（表情时产生），并测量其深度和长度。</p><p><strong>数值解读:</strong> 分数越低，表示皱纹问题越显著。低于80分通常意味着动态纹已开始向静态纹转化。</p>"
    }
};

const interpretationData = {
    skinAge: { 
        principle: "通过深度学习算法，分析您面部图像的皱纹、色斑、纹理等超过100个特征点，与我们包含10万+份亚洲肌肤样本的数据库进行比对，从而估算出您肌肤的当前状态年龄。", 
        interpretation: "肌龄高于生理年龄，意味着您的皮肤老化速度超过了自然规律，需要立刻进行干预。反之，则说明您的皮肤状态优于同龄人。",
        range: [18, 25], // Example: ideal skin age range
        unit: '岁'
    },
    hydroLipid: { 
        principle: "采用多光谱成像技术，分析皮肤表面的反射率和吸收率，精确计算角质层的水分含量与皮脂腺的油脂分泌水平。", 
        interpretation: "理想范围在40-60%。低于40%表示皮肤干燥缺水，易产生干纹；高于60%表示油脂分泌过盛，易引发毛孔堵塞和痘痘。",
        range: [40, 60],
        unit: '%'
    },
    barrierHealth: { 
        principle: "通过测量经皮水分流失率(TEWL)和皮肤表面PH值，综合评估皮肤物理屏障和化学屏障的健康状况。", 
        interpretation: "分数越高，表示皮肤屏障越健康，能有效抵御外界刺激。低于60分，表示屏障功能受损，易出现敏感、泛红、刺痛等问题。",
        range: [80, 100],
        unit: '/100'
    },
    collagenDensity: { 
        principle: "模拟医学超声波原理，通过分析特定频率的反射波形，无创评估真皮层中胶原蛋白的密度和排列结构。", 
        interpretation: "这是决定皮肤'饱满度'和'弹性'的核心指标。分数低于70，表示胶原蛋白已开始显著流失，是皮肤松弛的根本原因。",
        range: [75, 100],
        unit: '/100'
    },
    smasFirmness: { 
        principle: "利用高频聚焦超声波的相位变化，精确探测SMAS筋膜层的深度和松弛程度，这是决定面部轮廓的关键层次。", 
        interpretation: "分数越高，表示深层支撑结构越稳固，面部轮廓越清晰。低于60分，则表示已出现下面部松弛和下颌线模糊。",
        range: [70, 100],
        unit: '/100'
    },
    periorbitalFirmness: { 
        principle: "结合高倍镜图像分析眼周皮肤的微循环、淋巴回流状况和脂肪垫体积，综合评估眼周老化程度。", 
        interpretation: "眼周是面部最先衰老的区域。分数越低，眼袋、泪沟、鱼尾纹等问题越显著，需要进行针对性的精细化治疗。",
        range: [70, 100],
        unit: '/100'
    },
    pigmentation: { 
        principle: "利用伍氏灯(Wood's Lamp)原理的特殊光谱，使表皮和真皮层的不同色素团块显形，并对其面积、深度和密度进行量化分析。", 
        interpretation: "分数越低，表示深层色斑、晒斑或炎症后色素沉着（痘印）问题越严重。我们会根据色素所在的层次，推荐不同的治疗方案。",
        range: [80, 100], // Higher is better
        unit: '/100'
    },
    poreRefinement: { 
        principle: "通过高倍镜图像分析，自动识别并计算单位面积内的毛孔数量、平均直径以及是否有角栓堵塞。", 
        interpretation: "分数越低，表示毛孔问题越严重。通常由油脂分泌旺盛、胶原蛋白流失或清洁不当引起。",
        range: [75, 100], // Higher is better
        unit: '/100'
    }
};

// 2. 初始化与事件绑定
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('consultation-form');
    const optionButtons = form.querySelectorAll('.option-btn');
    const submitBtn = form.querySelector('.submit-btn');
    let selections = { age: null, concern: null };

    optionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.form-group');
            const type = group.dataset.group;
            
            group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selections[type] = btn.dataset.value;

            if (selections.age && selections.concern) {
                submitBtn.disabled = false;
            }
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const matchedProfileId = matchProfile(selections);
        startAnalysisAnimation(matchedProfileId);
    });
    
    document.getElementById('back-to-form').addEventListener('click', () => goToStep(1));

    const modal = document.getElementById('tooltip-modal');
    modal.querySelector('.close-btn').onclick = () => modal.style.display = "none";
    window.onclick = (event) => { if (event.target == modal) modal.style.display = "none"; };
});

// 3. 核心功能函数
function matchProfile(selections) {
    for (const id in userProfiles) {
        if (userProfiles[id].matched_by.includes(selections.age) && userProfiles[id].matched_by.includes(selections.concern)) {
            return id;
        }
    }
    return 'profile1'; // 默认
}

function startAnalysisAnimation(profileId) {
    goToStep(2);
    const textElement = document.getElementById('analysis-text');
    const steps = ["正在连接YOUMAGIC云端数据库...", "正在分析您的皮肤数据模型...", "正在匹配超过10万份亚洲肌肤案例...", "生成报告中..."];
    let i = 0;
    textElement.textContent = steps[i];
    const interval = setInterval(() => {
        i++;
        if (i < steps.length) {
            textElement.textContent = steps[i];
        } else {
            clearInterval(interval);
            setTimeout(() => {
                goToStep(3);
                renderReport(profileId);
            }, 800);
        }
    }, 1500);
}

function renderReport(profileId) {
    const profile = userProfiles[profileId];
    if (!profile) return;

    document.getElementById('report-title').textContent = profile.report_title;
    
    renderVisualDiagnosis(profile);

    renderDataInterpretation(profile.data_interpretation);
    renderMasterPlan(profile.master_plan);
    renderSimilarCase(profile.similar_case);
    renderCommunityFeedback(profile.community_feedback);
}

function renderVisualDiagnosis(profile) {
    const container = document.getElementById('visual-diagnosis-module');
    const imageElement = document.getElementById('visual-diagnosis-image');
    const textElement = document.getElementById('visual-summary-text');
    
    if (container && imageElement && textElement) {
        imageElement.src = profile.master_plan.areaHighlight;
        textElement.innerHTML = profile.analysis.visual_summary;
        container.style.display = 'block';
    }
}

function renderDataInterpretation(data) {
    const container = document.getElementById('data-interpretation-container');
    container.innerHTML = ''; // Clear previous content

    for (const key in data) {
        const item = data[key];
        const info = interpretationData[key];
        
        // Define scale, assuming 0-100 for most, but adaptable
        const scaleMin = (key === 'skinAge') ? 18 : 0;
        const scaleMax = (key === 'skinAge') ? 60 : 100;

        // Calculate positions for the visualizer bar
        const userScorePercent = ((item.val - scaleMin) / (scaleMax - scaleMin)) * 100;
        const rangeStartPercent = ((info.range[0] - scaleMin) / (scaleMax - scaleMin)) * 100;
        const rangeWidthPercent = ((info.range[1] - info.range[0]) / (scaleMax - scaleMin)) * 100;

        container.innerHTML += `
            <div class="interpretation-card">
                <div class="interpretation-header">
                    <h4>${item.label}</h4>
                    <span class="interpretation-score">${item.val}${info.unit || ''}</span>
                </div>
                <div class="interpretation-visualizer">
                    <div class="normal-range-bar" style="left: ${rangeStartPercent}%; width: ${rangeWidthPercent}%;"></div>
                    <div class="user-score-indicator" style="left: calc(${userScorePercent}% - 8px);"></div>
                </div>
                <div class="range-labels">
                    <span>${scaleMin}</span>
                    <span>${scaleMax}</span>
                </div>
                <div class="interpretation-body">
                    <p><strong>检测原理:</strong> ${info.principle}</p>
                    <p><strong>数值解读:</strong> ${info.interpretation}</p>
                </div>
            </div>
        `;
    }
}

function renderMasterPlan(plan) {
    const container = document.getElementById('master-plan-container');
    
    // 保留设备展示
    const techShowcaseHTML = container.querySelector('.tech-showcase').outerHTML;
    
    let coreParamsHtml = '';
    plan.core_treatment.params.forEach(p => { coreParamsHtml += `<li>${p}</li>`; });

    container.innerHTML = `
        <div class="plan-section">
            ${techShowcaseHTML}
            <h4>${plan.core_treatment.tech}</h4>
            <ul>${coreParamsHtml}</ul>
        </div>
        <div class="plan-section">
            <h4>推荐搭配护理</h4>
            <p>${plan.professional_treatments}</p>
        </div>
        <div class="plan-section">
            <h4>居家养护建议</h4>
            <p>${plan.homecare_products}</p>
        </div>
        <div class="plan-section">
            <h4>生活方式建议</h4>
            <p>${plan.lifestyle_advice}</p>
        </div>
    `;
}

function renderSimilarCase(caseData) {
    const container = document.getElementById('similar-case-container');
    container.innerHTML = `
        <div class="case-card">
            <h4>与您情况相似的用户效果</h4>
            <div class="before-after-img">
                <img src="${caseData.before}" alt="治疗前">
                <img src="${caseData.after}" alt="治疗后">
            </div>
            <p>${caseData.desc}</p>
        </div>
    `;
}

function renderCommunityFeedback(feedbacks) {
    const container = document.getElementById('community-feedback-container');
    container.innerHTML = ''; // Clear previous content

    if (!feedbacks || feedbacks.length === 0) {
        container.innerHTML = '<p>暂无更多相关反馈。</p>';
        return;
    }

    feedbacks.forEach(feedback => {
        const logoSrc = `${feedback.platform}.webp`; // Assumes we have weibo.webp, rednote.webp, etc.
        container.innerHTML += `
            <div class="feedback-card">
                <div class="feedback-header">
                    <img src="${logoSrc}" alt="${feedback.platform}" class="feedback-platform-logo">
                    <span class="feedback-user">${feedback.user}</span>
                </div>
                <p class="feedback-text">${feedback.text}</p>
            </div>
        `;
    });
}

function showTooltip(metricId) {
    const data = tooltipData[metricId];
    if (!data) return;
    document.getElementById('tooltip-title').textContent = data.title;
    document.getElementById('tooltip-body').innerHTML = data.content;
    document.getElementById('tooltip-modal').style.display = 'block';
}

function goToStep(stepNum) {
    document.querySelectorAll('.app-step').forEach(step => step.classList.remove('active'));
    const targetStep = document.getElementById(`step-${stepNum}`);
    if (targetStep) {
        targetStep.classList.add('active');
    }
    window.scrollTo(0, 0);
}
