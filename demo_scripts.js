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
            skinAge: { val: 32, label: "预测肌龄" },
            elasticity: { val: 65, label: "弹性指数" },
            wrinkles: { val: 72, label: "皱纹分析" },
        },
        master_plan: {
            name: "YOUMAGIC™ · 初老肌精准抗衰方案",
            description: "针对28岁肌龄特点，通过刺激真皮层胶原蛋白的持续新生，精准对抗第一道细纹，重塑面部年轻结构，实现预防与治疗双重功效。",
            params: ["治疗强度: 5-7档 (温和-中效)", "建议发数: 900发", "使用探头: 眼部专用探头 + 面部4.0探头"]
        },
        similar_case: {
            before: "1.png",
            after: "1A.png",
            desc: "这位28岁的用户同样面临初老和眼周细纹的困扰，这是她在接受YOUMAGIC智感单极射频治疗一个疗程后的真实效果对比。"
        },
    },
    'profile2': {
        name: "李女士",
        age: 38,
        concern: "改善皱纹和松弛",
        matched_by: ['30-39', '40+', 'anti-aging'],
        report_title: "李女士，您的专属轮廓新生诊断报告",
        data_interpretation: {
            skinAge: { val: 45, label: "预测肌龄" },
            elasticity: { val: 45, label: "弹性指数" },
            wrinkles: { val: 55, label: "皱纹分析" },
        },
        master_plan: {
            name: "YOUMAGIC™ · 熟龄肌轮廓重塑方案",
            description: "为38岁熟龄肌定制的强效抗衰方案，目标是作用于SMAS筋膜层，重建深层支撑结构，显著提升面部轮廓，实现视觉年龄的逆转。",
            params: ["治疗强度: 8-10档 (强效)", "建议发数: 1200发 (全面部+颈部)", "使用探头: 面部4.0探头 + 颈部专用探头"]
        },
        similar_case: {
            before: "2.png",
            after: "2A.png",
            desc: "这位38岁的用户面临下面部松弛和轮廓模糊问题，治疗后实现了清晰的下颌线和全面的紧致提升。"
        },
    },
    'profile3': {
        name: "张小姐",
        age: 23,
        concern: "解决痘痘和毛孔",
        matched_by: ['20-29', 'acne-pores'],
        report_title: "张小姐，您的专属净肤焕颜诊断报告",
        data_interpretation: {
            skinAge: { val: 25, label: "预测肌龄" },
            elasticity: { val: 88, label: "弹性指数" },
            wrinkles: { val: 95, label: "皱纹分析" },
        },
        master_plan: {
            name: "YOUMAGIC™ · 油性痘肌净肤修复方案",
            description: "专为年轻油性痘肌设计，旨在通过调节皮脂腺的过度活跃，加速痘印代谢、收缩粗大毛孔，重建健康的皮肤屏障。",
            params: ["治疗模式: 净肤-修复模式", "建议能量: 4-6档 (低能量)", "使用探头: 面部修复专用探头"]
        },
        similar_case: {
            before: "3.png",
            after: "3A.png",
            desc: "这位23岁的用户受痘痘和毛孔问题困扰，治疗后肤质得到显著改善，水油趋于平衡，肤色更均匀。"
        },
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
    document.getElementById('report-title').textContent = profile.report_title;
    renderDataInterpretation(profile.data_interpretation);
    renderMasterPlan(profile.master_plan);
    renderSimilarCase(profile.similar_case);
    renderCommunityFeedback(); // 这个函数使用静态数据
}

function renderDataInterpretation(data) {
    const container = document.getElementById('data-interpretation-container');
    container.innerHTML = '';
    for (const key in data) {
        const item = data[key];
        container.innerHTML += `
            <div class="metric-card">
                <div class="metric-info">
                    <h4>${item.label}</h4>
                    <p>${key === 'skinAge' ? `预测为 ${item.val} 岁` : `评分为 ${item.val}`}</p>
                </div>
                <div class="info-icon" data-metric="${key}">i</div>
            </div>
        `;
    }
    container.querySelectorAll('.info-icon').forEach(icon => {
        icon.addEventListener('click', (e) => showTooltip(e.target.dataset.metric));
    });
}

function renderMasterPlan(plan) {
    const container = document.getElementById('master-plan-container');
    let paramsHtml = '';
    plan.params.forEach(p => { paramsHtml += `<li>${p}</li>`; });
    container.innerHTML = `
        <h3>${plan.name}</h3>
        <p>${plan.description}</p>
        <h4>治疗参数:</h4>
        <ul>${paramsHtml}</ul>
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

function renderCommunityFeedback() {
    const container = document.getElementById('community-feedback-container');
    // For demo, using static content. Can be dynamic in real app.
    container.innerHTML = `
        <div class="feedback-card">
            <img src="avatar1.png" alt="用户头像" class="feedback-avatar">
            <div class="feedback-content">
                <h5>@莉莉安</h5>
                <p>效果真的惊艳到我了，下颌线一下子就清晰了！姐妹们快冲！</p>
                <div class="feedback-photos">
                    <img src="1A.png" alt="效果图">
                    <img src="2A.png" alt="效果图">
                </div>
            </div>
        </div>
        <div class="feedback-card">
             <img src="avatar2.png" alt="用户头像" class="feedback-avatar">
            <div class="feedback-content">
                <h5>@是你的小可爱呀</h5>
                <p>多年的痘肌终于有救了，现在的皮肤摸上去又滑又嫩，化妆都不卡粉了。</p>
                 <div class="feedback-photos">
                    <img src="3A.png" alt="效果图">
                </div>
            </div>
        </div>
    `;
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
