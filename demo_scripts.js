// YOUMAGIC® 专业美学分析系统 - 交互脚本

// 全局变量
let currentStep = 1;
let userData = {
    name: '',
    age: 25,
    gender: 'female',
    skinType: 'combination',
    concerns: [],
    photo: null
};

let analysisData = {
    skinAge: 28,
    scores: {
        elasticity: 68,
        moisture: 45,
        firmness: 62,
        evenness: 78
    },
    regions: {
        forehead: { elasticity: 72, wrinkleDepth: 'medium' },
        cheeks: { sagging: 'mild', pores: 'good' },
        jawline: { clarity: 'needs improvement', firmness: 62 }
    }
};

let treatmentParams = {
    intensity: 6,
    frequency: 3,
    depth: 2,
    areas: ['jawline']
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    bindEvents();
    setupCharts();
    setupAnimations();
});

// 应用初始化
function initializeApp() {
    // 设置默认数据
    document.getElementById('userAge').value = userData.age;
    updateUserName();
    
    // 初始化浮动面板
    setupFloatingPanel();
    
    // 模拟数据加载动画
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 500);
}

// 事件绑定
function bindEvents() {
    // 照片上传
    const photoUpload = document.getElementById('photoUpload');
    const photoInput = document.getElementById('photoInput');
    
    photoUpload.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotoUpload);
    
    // 表单输入监听
    document.getElementById('userName').addEventListener('input', updateUserName);
    document.getElementById('userAge').addEventListener('input', updateUserAge);
    document.getElementById('userGender').addEventListener('change', updateGender);
    document.getElementById('skinType').addEventListener('change', updateSkinType);
    
    // 困扰选择
    const concernCheckboxes = document.querySelectorAll('.concern-item input[type="checkbox"]');
    concernCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateConcerns);
    });
    
    // 步骤导航
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        step.addEventListener('click', () => goToStep(index + 1));
    });
    
    // 面部热点交互
    setupFaceMapInteraction();
    
    // 治疗参数调节
    setupTreatmentCustomizer();
    
    // 时间轴控制
    setupTimelineControls();
}

// 照片上传处理
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            userData.photo = e.target.result;
            updatePhotoPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

function updatePhotoPreview(imageSrc) {
    const placeholder = document.getElementById('photoUpload');
    placeholder.innerHTML = `
        <img src="${imageSrc}" alt="用户照片" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px;">
        <p style="margin-top: 10px;">点击更换照片</p>
    `;
    placeholder.classList.add('bounce-in');
}

// 用户信息更新
function updateUserName() {
    const name = document.getElementById('userName').value || '用户';
    userData.name = name;
    // 更新显示中的姓名
    const nameDisplays = document.querySelectorAll('[data-user-name]');
    nameDisplays.forEach(el => el.textContent = name);
}

function updateUserAge() {
    const age = parseInt(document.getElementById('userAge').value) || 25;
    userData.age = age;
    // 更新肌肤年龄计算
    analysisData.skinAge = age + Math.floor(Math.random() * 6) - 1;
    updateAgeDisplay();
}

function updateGender() {
    userData.gender = document.getElementById('userGender').value;
}

function updateSkinType() {
    userData.skinType = document.getElementById('skinType').value;
    // 根据肌肤类型调整分析数据
    adjustAnalysisDataBySkinType();
}

function updateConcerns() {
    const concerns = [];
    const checkedBoxes = document.querySelectorAll('.concern-item input[type="checkbox"]:checked');
    checkedBoxes.forEach(checkbox => {
        concerns.push(checkbox.value);
    });
    userData.concerns = concerns;
}

// 步骤导航
function nextStep() {
    if (currentStep < 4) {
        goToStep(currentStep + 1);
    }
}

function goToStep(step) {
    // 隐藏当前步骤
    document.querySelector('.step-section.active').classList.remove('active');
    document.querySelector('.step.active').classList.remove('active');
    
    // 显示目标步骤
    document.getElementById(`step-${step}`).classList.add('active');
    document.querySelector(`[data-step="${step}"]`).classList.add('active');
    
    currentStep = step;
    
    // 步骤特定逻辑
    switch(step) {
        case 2:
            startFaceAnalysis();
            break;
        case 3:
            setupTreatmentCustomizer();
            break;
        case 4:
            generateFinalReport();
            break;
    }
}

// 面部分析动画
function startFaceAnalysis() {
    const progressItems = document.querySelectorAll('.progress-item');
    const analysisResults = document.getElementById('analysisResults');
    const nextButton = document.getElementById('nextToTreatment');
    
    // 重置进度
    progressItems.forEach(item => item.classList.remove('active'));
    analysisResults.style.display = 'none';
    nextButton.style.display = 'none';
    
    // 模拟分析进度
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
        if (currentProgress < progressItems.length) {
            progressItems[currentProgress].classList.add('active');
            
            // 添加声音效果（如果需要）
            playAnalysisSound(currentProgress);
            
            currentProgress++;
        } else {
            clearInterval(progressInterval);
            // 显示分析结果
            setTimeout(() => {
                analysisResults.style.display = 'block';
                analysisResults.classList.add('fade-in');
                nextButton.style.display = 'inline-block';
                nextButton.classList.add('bounce-in');
                
                // 初始化图表
                initializeRadarChart();
                initializeFaceCanvas();
                updateDataPanels();
            }, 500);
        }
    }, 1000);
}

function playAnalysisSound(step) {
    // 可以添加音效反馈
    console.log(`分析步骤 ${step + 1} 完成`);
}

// 面部画布初始化
function initializeFaceCanvas() {
    const canvas = document.getElementById('faceCanvas');
    const ctx = canvas.getContext('2d');
    
    // 设置高清显示
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // 加载并绘制face.png图片
    loadFaceImage(ctx);
}

// 加载面部图片
function loadFaceImage(ctx) {
    const faceImage = new Image();
    
    faceImage.onload = function() {
        // 清除画布
        ctx.clearRect(0, 0, 300, 400);
        
        // 绘制专业背景
        drawProfessionalBackground(ctx);
        
        // 绘制面部图片
        ctx.drawImage(faceImage, 0, 0, 300, 400);
        
        // 添加美观的热力图效果
        drawBeautifulHeatMap(ctx);
        
        // 添加分析网格
        drawAnalysisGrid(ctx);
        
        // 添加专业分析框架
        drawAnalysisFramework(ctx);
    };
    
    faceImage.onerror = function() {
        console.warn('无法加载face.png，使用默认绘制');
        // 如果图片加载失败，使用原来的绘制方法
        drawBackground(ctx);
        drawProfessionalFace(ctx);
        drawBeautifulHeatMap(ctx);
        drawAnalysisGrid(ctx);
    };
    
    // 设置图片源
    faceImage.src = 'face.png';
}

// 绘制专业背景
function drawProfessionalBackground(ctx) {
    // 创建专业的医美背景
    const gradient = ctx.createLinearGradient(0, 0, 300, 400);
    gradient.addColorStop(0, '#f8f9fa');
    gradient.addColorStop(0.5, '#e9ecef');
    gradient.addColorStop(1, '#dee2e6');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 400);
    
    // 添加微妙的医美纹理
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#5D3E8E';
    for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 300, Math.random() * 400, Math.random() * 3, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// 添加专业分析框架
function drawAnalysisFramework(ctx) {
    ctx.save();
    
    // 绘制分析边框
    ctx.strokeStyle = 'rgba(93, 62, 142, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(10, 10, 280, 380);
    
    // 添加角落装饰
    const cornerSize = 15;
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#5D3E8E';
    
    // 左上角
    ctx.beginPath();
    ctx.moveTo(10, 10 + cornerSize);
    ctx.lineTo(10, 10);
    ctx.lineTo(10 + cornerSize, 10);
    ctx.stroke();
    
    // 右上角
    ctx.beginPath();
    ctx.moveTo(290 - cornerSize, 10);
    ctx.lineTo(290, 10);
    ctx.lineTo(290, 10 + cornerSize);
    ctx.stroke();
    
    // 左下角
    ctx.beginPath();
    ctx.moveTo(10, 390 - cornerSize);
    ctx.lineTo(10, 390);
    ctx.lineTo(10 + cornerSize, 390);
    ctx.stroke();
    
    // 右下角
    ctx.beginPath();
    ctx.moveTo(290 - cornerSize, 390);
    ctx.lineTo(290, 390);
    ctx.lineTo(290, 390 - cornerSize);
    ctx.stroke();
    
    // 添加专业标识
    ctx.font = '10px Arial';
    ctx.fillStyle = 'rgba(93, 62, 142, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText('YOUMAGIC® AI Analysis', 285, 385);
    
    ctx.restore();
}

function drawBackground(ctx) {
    // 创建渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 300, 400);
    gradient.addColorStop(0, '#f8f9fa');
    gradient.addColorStop(0.5, '#e9ecef');
    gradient.addColorStop(1, '#dee2e6');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 400);
    
    // 添加微妙的纹理
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 300, Math.random() * 400, Math.random() * 2, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawProfessionalFace(ctx) {
    ctx.save();
    
    // 面部基础形状 - 更自然的轮廓
    ctx.beginPath();
    ctx.moveTo(150, 50);  // 头顶
    
    // 右侧轮廓
    ctx.bezierCurveTo(200, 60, 220, 120, 210, 180);  // 右侧额头到太阳穴
    ctx.bezierCurveTo(205, 220, 195, 260, 180, 290); // 右侧脸颊
    ctx.bezierCurveTo(170, 320, 160, 340, 150, 350); // 右下颌到下巴
    
    // 左侧轮廓
    ctx.bezierCurveTo(140, 340, 130, 320, 120, 290); // 左下颌
    ctx.bezierCurveTo(105, 260, 95, 220, 90, 180);   // 左侧脸颊
    ctx.bezierCurveTo(80, 120, 100, 60, 150, 50);    // 左侧太阳穴到额头
    
    ctx.closePath();
    
    // 面部渐变填充
    const faceGradient = ctx.createRadialGradient(150, 200, 50, 150, 200, 120);
    faceGradient.addColorStop(0, '#fde2d4');
    faceGradient.addColorStop(0.7, '#f4d1ae');
    faceGradient.addColorStop(1, '#e8b898');
    
    ctx.fillStyle = faceGradient;
    ctx.fill();
    
    // 面部轮廓描边
    ctx.strokeStyle = 'rgba(139, 107, 177, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 绘制更细致的五官
    drawDetailedFeatures(ctx);
    
    ctx.restore();
}

function drawDetailedFeatures(ctx) {
    // 绘制眉毛
    ctx.strokeStyle = '#8d5524';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    // 左眉毛
    ctx.beginPath();
    ctx.moveTo(115, 125);
    ctx.quadraticCurveTo(130, 120, 145, 125);
    ctx.stroke();
    
    // 右眉毛
    ctx.beginPath();
    ctx.moveTo(155, 125);
    ctx.quadraticCurveTo(170, 120, 185, 125);
    ctx.stroke();
    
    // 绘制眼睛 - 更逼真
    drawEye(ctx, 130, 145, 'left');
    drawEye(ctx, 170, 145, 'right');
    
    // 绘制鼻子 - 更立体
    drawNose(ctx);
    
    // 绘制嘴巴 - 更自然
    drawMouth(ctx);
    
    // 添加面部阴影增强立体感
    drawFacialShadows(ctx);
}

function drawEye(ctx, x, y, side) {
    ctx.save();
    
    // 眼白
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 8, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(139, 107, 177, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 瞳孔
    ctx.beginPath();
    ctx.ellipse(x, y, 6, 6, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
    
    // 瞳孔反光
    ctx.beginPath();
    ctx.ellipse(x - 2, y - 2, 2, 2, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // 睫毛
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const angle = (i - 2) * 0.3;
        const startX = x + Math.cos(angle) * 12;
        const startY = y - Math.sin(angle) * 8;
        const endX = x + Math.cos(angle) * 16;
        const endY = y - Math.sin(angle) * 12;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawNose(ctx) {
    ctx.save();
    
    // 鼻梁高光
    const noseGradient = ctx.createLinearGradient(148, 160, 152, 180);
    noseGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    noseGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = noseGradient;
    ctx.beginPath();
    ctx.ellipse(150, 170, 3, 15, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 鼻翼
    ctx.strokeStyle = 'rgba(139, 107, 177, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(143, 180, 4, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(157, 180, 4, 0, Math.PI);
    ctx.stroke();
    
    // 鼻尖阴影
    ctx.fillStyle = 'rgba(139, 107, 177, 0.1)';
    ctx.beginPath();
    ctx.ellipse(150, 182, 6, 3, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.restore();
}

function drawMouth(ctx) {
    ctx.save();
    
    // 嘴唇轮廓
    ctx.beginPath();
    ctx.moveTo(135, 210);
    ctx.quadraticCurveTo(150, 205, 165, 210);
    ctx.quadraticCurveTo(150, 220, 135, 210);
    
    // 嘴唇渐变
    const lipGradient = ctx.createLinearGradient(135, 205, 165, 220);
    lipGradient.addColorStop(0, '#d4a574');
    lipGradient.addColorStop(0.5, '#c9966b');
    lipGradient.addColorStop(1, '#b8855a');
    
    ctx.fillStyle = lipGradient;
    ctx.fill();
    
    // 嘴角微笑线条
    ctx.strokeStyle = 'rgba(139, 107, 177, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(130, 215);
    ctx.quadraticCurveTo(135, 212, 140, 215);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(160, 215);
    ctx.quadraticCurveTo(165, 212, 170, 215);
    ctx.stroke();
    
    ctx.restore();
}

function drawFacialShadows(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    
    // 下颌阴影
    const jawShadow = ctx.createLinearGradient(150, 280, 150, 320);
    jawShadow.addColorStop(0, 'rgba(139, 107, 177, 0)');
    jawShadow.addColorStop(1, 'rgba(139, 107, 177, 0.3)');
    
    ctx.fillStyle = jawShadow;
    ctx.beginPath();
    ctx.ellipse(150, 300, 60, 20, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 太阳穴阴影
    ctx.fillStyle = 'rgba(139, 107, 177, 0.2)';
    ctx.beginPath();
    ctx.ellipse(120, 140, 8, 15, -0.3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(180, 140, 8, 15, 0.3, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.restore();
}

function drawBeautifulHeatMap(ctx) {
    ctx.save();
    
    // 设置混合模式以更好地与真实照片融合
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.3;
    
    // 前额区域 - 中等问题（与热点1对应）
    const foreheadGradient = ctx.createRadialGradient(150, 80, 0, 150, 80, 35);
    foreheadGradient.addColorStop(0, 'rgba(255, 193, 7, 0.8)');
    foreheadGradient.addColorStop(0.6, 'rgba(255, 193, 7, 0.4)');
    foreheadGradient.addColorStop(1, 'rgba(255, 193, 7, 0)');
    
    ctx.fillStyle = foreheadGradient;
    ctx.beginPath();
    ctx.ellipse(150, 80, 30, 20, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 下颌线区域 - 严重问题（与热点6对应）
    const jawGradient = ctx.createRadialGradient(150, 315, 0, 150, 315, 45);
    jawGradient.addColorStop(0, 'rgba(255, 107, 107, 0.9)');
    jawGradient.addColorStop(0.5, 'rgba(255, 107, 107, 0.6)');
    jawGradient.addColorStop(1, 'rgba(255, 107, 107, 0)');
    
    ctx.fillStyle = jawGradient;
    ctx.beginPath();
    ctx.ellipse(150, 315, 40, 25, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 重置混合模式，绘制更精细的区域标记
    ctx.globalCompositeOperation = 'normal';
    ctx.globalAlpha = 0.15;
    
    // 眼周区域标记（与热点2、3对应）
    const eyeGradient1 = ctx.createRadialGradient(125, 135, 0, 125, 135, 20);
    eyeGradient1.addColorStop(0, 'rgba(76, 175, 80, 0.6)');
    eyeGradient1.addColorStop(1, 'rgba(76, 175, 80, 0)');
    
    ctx.fillStyle = eyeGradient1;
    ctx.beginPath();
    ctx.ellipse(125, 135, 15, 10, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    const eyeGradient2 = ctx.createRadialGradient(175, 135, 0, 175, 135, 20);
    eyeGradient2.addColorStop(0, 'rgba(76, 175, 80, 0.6)');
    eyeGradient2.addColorStop(1, 'rgba(76, 175, 80, 0)');
    
    ctx.fillStyle = eyeGradient2;
    ctx.beginPath();
    ctx.ellipse(175, 135, 15, 10, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 面颊区域标记（与热点4、5对应）
    const cheekGradient1 = ctx.createRadialGradient(110, 180, 0, 110, 180, 22);
    cheekGradient1.addColorStop(0, 'rgba(76, 175, 80, 0.5)');
    cheekGradient1.addColorStop(1, 'rgba(76, 175, 80, 0)');
    
    ctx.fillStyle = cheekGradient1;
    ctx.beginPath();
    ctx.ellipse(110, 180, 18, 25, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    const cheekGradient2 = ctx.createRadialGradient(190, 180, 0, 190, 180, 22);
    cheekGradient2.addColorStop(0, 'rgba(76, 175, 80, 0.5)');
    cheekGradient2.addColorStop(1, 'rgba(76, 175, 80, 0)');
    
    ctx.fillStyle = cheekGradient2;
    ctx.beginPath();
    ctx.ellipse(190, 180, 18, 25, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 添加热力图图例
    ctx.restore();
    drawHeatMapLegend(ctx);
}

// 绘制热力图图例
function drawHeatMapLegend(ctx) {
    ctx.save();
    
    // 在右上角添加简单的图例
    const legendX = 220;
    const legendY = 25;
    
    // 背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(legendX, legendY, 70, 60);
    ctx.strokeStyle = 'rgba(93, 62, 142, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, 70, 60);
    
    // 标题
    ctx.font = '10px Arial';
    ctx.fillStyle = '#5D3E8E';
    ctx.textAlign = 'center';
    ctx.fillText('问题程度', legendX + 35, legendY + 12);
    
    // 图例项
    const legendItems = [
        { color: '#4CAF50', text: '轻微', y: 25 },
        { color: '#FFC107', text: '中等', y: 35 },
        { color: '#FF6B6B', text: '严重', y: 45 }
    ];
    
    ctx.font = '9px Arial';
    ctx.textAlign = 'left';
    
    legendItems.forEach(item => {
        // 颜色点
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + 8, legendY + item.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // 文字
        ctx.fillStyle = '#333';
        ctx.fillText(item.text, legendX + 16, legendY + item.y + 3);
    });
    
    ctx.restore();
}

function drawAnalysisGrid(ctx) {
    ctx.save();
    
    // 绘制更精准的面部分析线条
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#5D3E8E';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    
    // 面部三等分线（医美标准）
    ctx.beginPath();
    // 发际线到眉毛
    ctx.moveTo(50, 85);
    ctx.lineTo(250, 85);
    // 眉毛到鼻底
    ctx.moveTo(50, 170);
    ctx.lineTo(250, 170);
    // 鼻底到下巴
    ctx.moveTo(50, 255);
    ctx.lineTo(250, 255);
    ctx.stroke();
    
    // 面部中线
    ctx.beginPath();
    ctx.moveTo(150, 50);
    ctx.lineTo(150, 350);
    ctx.stroke();
    
    // 眼部分析线
    ctx.globalAlpha = 0.06;
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    // 眼角连线
    ctx.moveTo(100, 135);
    ctx.lineTo(200, 135);
    // 瞳孔连线
    ctx.moveTo(130, 130);
    ctx.lineTo(170, 130);
    ctx.stroke();
    
    // 添加测量点标记
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#5D3E8E';
    
    // 关键测量点
    const measurementPoints = [
        {x: 150, y: 60, label: 'A'},   // 额头中点
        {x: 100, y: 135, label: 'B'},  // 左眼角
        {x: 200, y: 135, label: 'C'},  // 右眼角
        {x: 150, y: 170, label: 'D'},  // 鼻尖
        {x: 130, y: 200, label: 'E'},  // 左嘴角
        {x: 170, y: 200, label: 'F'},  // 右嘴角
        {x: 150, y: 330, label: 'G'}   // 下巴
    ];
    
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(93, 62, 142, 0.4)';
    
    measurementPoints.forEach(point => {
        // 绘制小圆点
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        // 绘制标签
        ctx.fillText(point.label, point.x + 8, point.y + 3);
    });
    
    ctx.restore();
}

// 面部地图交互
function setupFaceMapInteraction() {
    const hotspots = document.querySelectorAll('.hotspot');
    const regionDetails = document.getElementById('regionDetails');
    
    hotspots.forEach((hotspot, index) => {
        // 点击事件
        hotspot.addEventListener('click', function(e) {
            e.preventDefault();
            
            const region = this.dataset.region;
            const issue = this.dataset.issue;
            const severity = this.dataset.severity;
            const description = this.dataset.description;
            
            // 显示增强版工具提示
            showEnhancedHotspotTooltip({
                region, 
                issue, 
                severity, 
                description
            }, index + 1, e.clientX, e.clientY);
            
            // 更新区域详情
            showRegionDetails(region, issue, severity);
            
            // 添加点击动画
            this.classList.add('bounce-in');
            setTimeout(() => {
                this.classList.remove('bounce-in');
            }, 600);
        });
        
        // 触摸事件（移动端）
        hotspot.addEventListener('touchstart', function(e) {
            e.preventDefault();
            
            const touch = e.touches[0];
            const region = this.dataset.region;
            const issue = this.dataset.issue;
            const severity = this.dataset.severity;
            const description = this.dataset.description;
            
            showEnhancedHotspotTooltip({
                region, 
                issue, 
                severity, 
                description
            }, index + 1, touch.clientX, touch.clientY);
            
            showRegionDetails(region, issue, severity);
            
            // 触摸反馈
            this.style.transform = 'scale(1.4)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // 鼠标悬停（桌面端）
        if (window.innerWidth > 768) {
            hotspot.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.2)';
            });
            
            hotspot.addEventListener('mouseleave', function() {
                this.style.transform = '';
            });
        }
    });
}

// 增强版热点工具提示
function showEnhancedHotspotTooltip(hotspot, number, x, y) {
    // 移除现有的tooltip
    const existingTooltip = document.querySelector('.hotspot-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'hotspot-tooltip';
    
    const severityColors = {
        'mild': '#4CAF50',
        'medium': '#FFC107',
        'severe': '#FF6B6B'
    };
    
    const severityTexts = {
        'mild': '轻微',
        'medium': '中等',
        'severe': '严重'
    };
    
    tooltip.innerHTML = `
        <div class="tooltip-header" style="background: ${severityColors[hotspot.severity]};">
            <span class="tooltip-number">${number}</span>
            <span class="tooltip-region">${hotspot.region}</span>
        </div>
        <div class="tooltip-content">
            <div class="tooltip-issue">
                <strong>问题：</strong>${hotspot.issue}
            </div>
            <div class="tooltip-severity">
                <strong>程度：</strong>
                <span class="severity-badge" style="background: ${severityColors[hotspot.severity]}20; color: ${severityColors[hotspot.severity]};">
                    ${severityTexts[hotspot.severity]}
                </span>
            </div>
            <div class="tooltip-description">
                ${hotspot.description}
            </div>
        </div>
        <div class="tooltip-arrow"></div>
    `;
    
    document.body.appendChild(tooltip);
    
    // 计算tooltip位置
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left, top;
    
    if (window.innerWidth <= 768) {
        // 移动端：固定在底部
        left = (viewportWidth - tooltipRect.width) / 2;
        top = viewportHeight - tooltipRect.height - 20;
        tooltip.classList.add('mobile-position');
    } else {
        // 桌面端：跟随鼠标
        left = x - tooltipRect.width / 2;
        top = y - tooltipRect.height - 15;
        
        // 边界检测
        if (left < 10) left = 10;
        if (left + tooltipRect.width > viewportWidth - 10) {
            left = viewportWidth - tooltipRect.width - 10;
        }
        
        if (top < 10) {
            top = y + 15;
            tooltip.classList.add('below');
        }
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    
    // 添加关闭功能
    tooltip.addEventListener('click', () => {
        tooltip.remove();
    });
    
    // 自动消失
    setTimeout(() => {
        if (tooltip.parentNode) {
            tooltip.remove();
        }
    }, 4000);
}

function showRegionDetails(region, issue, severity) {
    const regionDetails = document.getElementById('regionDetails');
    
    // 获取对应的分析数据
    const regionData = {
        '前额': { elasticity: 72, wrinkleDepth: '中等', firmness: 68 },
        '左眼周': { elasticity: 78, wrinkleDepth: '轻微', firmness: 82 },
        '右眼周': { elasticity: 78, wrinkleDepth: '轻微', firmness: 82 },
        '左面颊': { elasticity: 65, sagging: '轻度', pores: '良好' },
        '右面颊': { elasticity: 65, sagging: '轻度', pores: '良好' },
        '下颌线': { clarity: '需改善', firmness: 62, sagging: '中度' }
    };
    
    const data = regionData[region];
    const severityText = {
        'mild': '轻微',
        'medium': '中等',
        'severe': '严重'
    };
    
    const severityColor = {
        'mild': '#4CAF50',
        'medium': '#FFC107',
        'severe': '#FF6B6B'
    };
    
    if (data) {
        let details = `
            <div class="region-analysis">
                <h4>${region} 详细分析</h4>
                <div class="analysis-summary">
                    <span class="issue-badge" style="background: ${severityColor[severity]}20; color: ${severityColor[severity]};">
                        ${issue} - ${severityText[severity]}
                    </span>
                </div>
                <div class="metrics-list">
        `;
        
        Object.keys(data).forEach(key => {
            details += `<div class="metric-row">
                <span class="metric-name">${getMetricName(key)}:</span>
                <span class="metric-value">${data[key]}</span>
            </div>`;
        });
        
        details += `
                </div>
                <div class="recommendation">
                    <p><strong>建议：</strong>${getRecommendation(region, severity)}</p>
                </div>
            </div>
        `;
        
        regionDetails.innerHTML = details;
        regionDetails.classList.add('slide-up');
        
        // 移除动画类
        setTimeout(() => {
            regionDetails.classList.remove('slide-up');
        }, 600);
    }
}

function getRecommendation(region, severity) {
    const recommendations = {
        '前额': {
            'mild': '定期保湿，使用抗氧化护肤品',
            'medium': '建议采用低强度射频治疗',
            'severe': '推荐强化射频治疗配合专业护理'
        },
        '左眼周': {
            'mild': '眼部护理，避免过度拉扯',
            'medium': '眼部专用射频治疗',
            'severe': '综合性眼部年轻化方案'
        },
        '右眼周': {
            'mild': '眼部护理，避免过度拉扯',
            'medium': '眼部专用射频治疗',
            'severe': '综合性眼部年轻化方案'
        },
        '左面颊': {
            'mild': '定期面部按摩，提升循环',
            'medium': '中等强度射频紧致治疗',
            'severe': '高强度射频配合胶原刺激'
        },
        '右面颊': {
            'mild': '定期面部按摩，提升循环',
            'medium': '中等强度射频紧致治疗',
            'severe': '高强度射频配合胶原刺激'
        },
        '下颌线': {
            'mild': '面部运动，定期护理',
            'medium': '下颌线专项射频提升',
            'severe': '综合性下颌线重塑方案'
        }
    };
    
    return recommendations[region]?.[severity] || '建议咨询专业医师制定个性化方案';
}

function getRegionName(region) {
    const names = {
        forehead: '前额区域',
        cheeks: '面颊区域',
        jawline: '下颌线'
    };
    return names[region] || region;
}

function getMetricName(metric) {
    const names = {
        elasticity: '弹性指数',
        wrinkleDepth: '皱纹深度',
        sagging: '松弛程度',
        pores: '毛孔状况',
        clarity: '清晰度',
        firmness: '紧致度'
    };
    return names[metric] || metric;
}

// 雷达图初始化
function initializeRadarChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['弹性', '水分', '紧致', '均匀', '光泽', '细腻'],
            datasets: [
                {
                    label: '您的肌肤',
                    data: [68, 45, 62, 78, 55, 72],
                    borderColor: '#5D3E8E',
                    backgroundColor: 'rgba(93, 62, 142, 0.2)',
                    pointBackgroundColor: '#5D3E8E',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#5D3E8E'
                },
                {
                    label: '同龄平均',
                    data: [75, 70, 68, 72, 65, 70],
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    pointBackgroundColor: '#FF6B6B',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#FF6B6B'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    pointLabels: {
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        color: '#2C3E50'
                    },
                    ticks: {
                        beginAtZero: true,
                        max: 100,
                        stepSize: 20,
                        showLabelBackdrop: false,
                        font: {
                            size: 10
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        padding: 20
                    }
                }
            },
            elements: {
                line: {
                    borderWidth: 3
                },
                point: {
                    radius: 6,
                    hoverRadius: 8
                }
            }
        }
    });
}

// 年龄显示更新
function updateAgeDisplay() {
    document.getElementById('realAge').textContent = userData.age;
    document.getElementById('skinAge').textContent = analysisData.skinAge;
    
    const ageDiff = analysisData.skinAge - userData.age;
    const ageGap = document.getElementById('ageGap');
    
    if (ageDiff > 0) {
        ageGap.textContent = `+${ageDiff}岁`;
        ageGap.style.color = '#FF6B6B';
    } else if (ageDiff < 0) {
        ageGap.textContent = `${ageDiff}岁`;
        ageGap.style.color = '#4ECDC4';
    } else {
        ageGap.textContent = '相符';
        ageGap.style.color = '#4ECDC4';
    }
}

// 数据面板更新
function updateDataPanels() {
    const scores = analysisData.scores;
    
    Object.keys(scores).forEach(key => {
        const panel = document.querySelector(`[data-metric="${key}"]`);
        if (panel) {
            const progressFill = panel.querySelector('.progress-fill');
            const scoreText = panel.querySelector('.score');
            
            // 动画效果
            setTimeout(() => {
                progressFill.style.width = `${scores[key]}%`;
                scoreText.textContent = `${scores[key]}/100`;
            }, 300);
        }
    });
}

// 根据肌肤类型调整分析数据
function adjustAnalysisDataBySkinType() {
    const adjustments = {
        dry: { moisture: -15, elasticity: -5 },
        oily: { moisture: +10, evenness: -10 },
        combination: { moisture: 0, evenness: -5 },
        sensitive: { elasticity: -10, evenness: -8 }
    };
    
    const adjustment = adjustments[userData.skinType] || {};
    
    Object.keys(adjustment).forEach(key => {
        if (analysisData.scores[key]) {
            analysisData.scores[key] = Math.max(0, Math.min(100, 
                analysisData.scores[key] + adjustment[key]));
        }
    });
}

// 治疗定制器设置
function setupTreatmentCustomizer() {
    const intensitySlider = document.getElementById('intensitySlider');
    const frequencySlider = document.getElementById('frequencySlider');
    const depthSlider = document.getElementById('depthSlider');
    
    // 滑块事件监听
    [intensitySlider, frequencySlider, depthSlider].forEach(slider => {
        slider.addEventListener('input', updateTreatmentParams);
    });
    
    // 治疗区域选择
    const areaCheckboxes = document.querySelectorAll('.area-checkbox input[type="checkbox"]');
    areaCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateTreatmentAreas);
    });
    
    // 初始化参数
    updateTreatmentParams();
}

function updateTreatmentParams() {
    treatmentParams.intensity = parseInt(document.getElementById('intensitySlider').value);
    treatmentParams.frequency = parseInt(document.getElementById('frequencySlider').value);
    treatmentParams.depth = parseInt(document.getElementById('depthSlider').value);
    
    // 更新效果预览
    updateEffectPreview();
    updateTreatmentMetrics();
}

function updateTreatmentAreas() {
    const areas = [];
    const checkedAreas = document.querySelectorAll('.area-checkbox input[type="checkbox"]:checked');
    checkedAreas.forEach(checkbox => {
        areas.push(checkbox.nextElementSibling.textContent);
    });
    treatmentParams.areas = areas;
    updateTreatmentMetrics();
}

function updateEffectPreview() {
    // 根据参数调整改善程度
    const baseImprovement = 60;
    const intensityBonus = treatmentParams.intensity * 3;
    const frequencyBonus = treatmentParams.frequency * 2;
    const depthBonus = treatmentParams.depth * 5;
    
    const improvement = Math.min(95, baseImprovement + intensityBonus + frequencyBonus + depthBonus);
    
    document.getElementById('improvementRate').textContent = `${improvement}%`;
    
    // 更新疼痛程度
    const painLevels = ['无感', '轻微', '中等', '明显'];
    const painIndex = Math.floor((treatmentParams.intensity - 1) / 3);
    document.getElementById('painLevel').textContent = painLevels[painIndex] || '轻微';
    
    // 更新恢复时间
    const recoveryDays = Math.ceil(treatmentParams.intensity / 2);
    document.getElementById('recoveryTime').textContent = `${recoveryDays}-${recoveryDays + 1}天`;
    
    // 更新费用
    const baseCost = 6000;
    const intensityCost = treatmentParams.intensity * 400;
    const frequencyCost = treatmentParams.frequency * 200;
    const totalCost = baseCost + intensityCost + frequencyCost;
    document.getElementById('estimatedCost').textContent = `¥${totalCost.toLocaleString()}`;
}

function updateTreatmentMetrics() {
    // 更新浮动面板中的实时数据
    const currentImprovement = document.getElementById('improvementRate').textContent;
    document.getElementById('currentImprovement').textContent = currentImprovement;
    
    // 更新年龄变化预期
    const improvementValue = parseInt(currentImprovement);
    const ageImprovement = Math.floor(improvementValue / 25);
    document.getElementById('ageChange').textContent = `-${ageImprovement}岁`;
}

// 时间轴控制器
function setupTimelineControls() {
    const timelineSlider = document.getElementById('timelineSlider');
    const stages = document.querySelectorAll('.effect-stage');
    
    timelineSlider.addEventListener('input', function() {
        const value = parseInt(this.value);
        updateTimelineStage(value);
    });
    
    // 初始化图表
    initializeEffectCharts();
}

function updateTimelineStage(days) {
    const stages = document.querySelectorAll('.effect-stage');
    stages.forEach(stage => stage.classList.remove('active'));
    
    let activeStage;
    if (days <= 7) {
        activeStage = document.querySelector('[data-stage="0"]');
    } else if (days <= 45) {
        activeStage = document.querySelector('[data-stage="30"]');
    } else if (days <= 120) {
        activeStage = document.querySelector('[data-stage="90"]');
    } else {
        activeStage = document.querySelector('[data-stage="180"]');
    }
    
    if (activeStage) {
        activeStage.classList.add('active');
    }
}

// 效果图表初始化
function initializeEffectCharts() {
    // 即刻效果图表
    initializeImmediateChart();
    initializeMonthChart();
    initializePeakChart();
    initializeMaintainChart();
    initializeMiniChart();
}

function initializeImmediateChart() {
    const ctx = document.getElementById('immediateChart').getContext('2d');
    createEffectChart(ctx, [20, 30, 25], ['紧致度', '轮廓感', '总体改善']);
}

function initializeMonthChart() {
    const ctx = document.getElementById('monthChart').getContext('2d');
    createEffectChart(ctx, [45, 40, 50], ['细腻度', '紧实度', '总体改善']);
}

function initializePeakChart() {
    const ctx = document.getElementById('peakChart').getContext('2d');
    createEffectChart(ctx, [75, 80, 85], ['轮廓改善', '皱纹减少', '总体改善']);
}

function initializeMaintainChart() {
    const ctx = document.getElementById('maintainChart').getContext('2d');
    createEffectChart(ctx, [70, 75, 80], ['结构稳定', '效果维持', '总体改善']);
}

function createEffectChart(ctx, data, labels) {
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#5D3E8E',
                    '#8B6BB1',
                    '#4ECDC4'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function initializeMiniChart() {
    const ctx = document.getElementById('miniChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['治疗前', '即刻', '1月', '3月', '6月'],
            datasets: [{
                data: [0, 25, 45, 85, 80],
                borderColor: '#5D3E8E',
                backgroundColor: 'rgba(93, 62, 142, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#5D3E8E',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false,
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            elements: {
                line: {
                    borderWidth: 2
                }
            }
        }
    });
}

// 浮动面板设置
function setupFloatingPanel() {
    const panel = document.getElementById('floatingPanel');
    const toggle = document.querySelector('.panel-toggle');
    const content = document.querySelector('.panel-content');
    
    // 只在桌面端执行
    if (window.innerWidth > 768 && panel && toggle && content) {
        let isExpanded = true;
        
        toggle.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                content.style.display = 'block';
                panel.style.height = 'auto';
                toggle.textContent = '📊';
            } else {
                content.style.display = 'none';
                panel.style.height = '60px';
                toggle.textContent = '📈';
            }
        });
    }
    
    // 移动端初始化数据监控
    if (window.innerWidth <= 768) {
        setupMobileDataMonitor();
    }
}

function togglePanel() {
    // 已在 setupFloatingPanel 中实现
}

// 移动端数据监控设置
function setupMobileDataMonitor() {
    // 初始化移动端图表
    const mobileMiniChart = document.getElementById('mobileMiniChart');
    if (mobileMiniChart) {
        initializeMobileMiniChart();
    }
    
    // 点击外部关闭模态框
    const modal = document.getElementById('mobileDataModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideMobileDataModal();
            }
        });
    }
    
    // 禁止模态框内容区域的点击事件冒泡
    const modalContent = document.querySelector('.mobile-data-content');
    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

function showMobileDataModal() {
    const modal = document.getElementById('mobileDataModal');
    if (modal) {
        modal.classList.add('show');
        
        // 更新数据
        updateMobileDataValues();
        
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }
}

function hideMobileDataModal() {
    const modal = document.getElementById('mobileDataModal');
    if (modal) {
        modal.classList.remove('show');
        
        // 恢复背景滚动
        document.body.style.overflow = '';
    }
}

function updateMobileDataValues() {
    // 同步桌面端的数据到移动端
    const currentImprovement = document.getElementById('currentImprovement');
    const ageChange = document.getElementById('ageChange');
    const mobileCurrentImprovement = document.getElementById('mobileCurrentImprovement');
    const mobileAgeChange = document.getElementById('mobileAgeChange');
    
    if (currentImprovement && mobileCurrentImprovement) {
        mobileCurrentImprovement.textContent = currentImprovement.textContent;
    }
    
    if (ageChange && mobileAgeChange) {
        mobileAgeChange.textContent = ageChange.textContent;
    }
}

function initializeMobileMiniChart() {
    const ctx = document.getElementById('mobileMiniChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['治疗前', '即刻', '1月', '3月', '6月'],
            datasets: [{
                data: [0, 25, 45, 85, 80],
                borderColor: '#5D3E8E',
                backgroundColor: 'rgba(93, 62, 142, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#5D3E8E',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    display: true,
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(93, 62, 142, 0.9)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: '#5D3E8E',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return '改善程度: ' + context.parsed.y + '%';
                        }
                    }
                }
            },
            elements: {
                line: {
                    borderWidth: 3
                }
            }
        }
    });
}

// 最终报告生成
function generateFinalReport() {
    // 更新报告数据
    updateFinalReportData();
    
    // 添加动画效果
    const reportItems = document.querySelectorAll('.report-item');
    reportItems.forEach((item, index) => {
        setTimeout(() => {
            item.classList.add('bounce-in');
        }, index * 200);
    });
}

function updateFinalReportData() {
    // 根据用户数据和治疗参数计算最终评分
    const baseScore = 60;
    const concernsBonus = userData.concerns.length * 5;
    const treatmentBonus = (treatmentParams.intensity + treatmentParams.frequency + treatmentParams.depth) * 2;
    
    const finalScore = Math.min(95, baseScore + concernsBonus + treatmentBonus);
    
    document.querySelector('.improvement-score').textContent = `${finalScore}%`;
    
    // 更新重点改善区域
    const areasText = treatmentParams.areas.join('、') || '全面改善';
    document.querySelector('.report-item:nth-child(2) span').textContent = areasText;
    
    // 更新维持时间（基于治疗强度）
    const maintainMonths = 12 + Math.floor(treatmentParams.intensity / 2);
    document.querySelector('.report-item:nth-child(4) span').textContent = `${maintainMonths}-${maintainMonths + 3}个月`;
}

// 图表设置
function setupCharts() {
    // Chart.js 全局配置
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    Chart.defaults.color = '#2C3E50';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
}

// 动画设置
function setupAnimations() {
    // GSAP 动画配置
    gsap.registerPlugin();
    
    // 页面加载动画
    gsap.from('.main-nav', { duration: 1, y: -50, opacity: 0, ease: 'power2.out' });
    gsap.from('.section-title', { duration: 1, y: 30, opacity: 0, delay: 0.3, ease: 'power2.out' });
    
    // 滚动触发动画
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '50px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);
    
    // 观察所有需要动画的元素
    document.querySelectorAll('.chart-container, .data-panel, .plan-card').forEach(el => {
        observer.observe(el);
    });
}

// 报告生成功能
function generateReport() {
    // 创建报告数据
    const reportData = {
        userData: userData,
        analysisData: analysisData,
        treatmentParams: treatmentParams,
        timestamp: new Date().toISOString()
    };
    
    // 模拟报告生成
    showLoadingModal('正在生成专属报告...');
    
    setTimeout(() => {
        hideLoadingModal();
        showSuccessModal('报告生成成功！', '您的专属美学分析报告已生成完成，包含详细的分析结果和治疗建议。');
    }, 2000);
}

function bookConsultation() {
    showSuccessModal('预约成功！', '我们的专业顾问将在24小时内与您联系，安排面诊时间。');
}

// 模态框功能
function showLoadingModal(message) {
    const modal = createModal('loading', message);
    document.body.appendChild(modal);
}

function hideLoadingModal() {
    const modal = document.querySelector('.modal.loading');
    if (modal) {
        modal.remove();
    }
}

function showSuccessModal(title, message) {
    const modal = createModal('success', message, title);
    document.body.appendChild(modal);
    
    // 3秒后自动关闭
    setTimeout(() => {
        modal.remove();
    }, 3000);
}

function createModal(type, message, title = '') {
    const modal = document.createElement('div');
    modal.className = `modal ${type}`;
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;
    
    if (title) {
        content.innerHTML = `
            <h3 style="color: #5D3E8E; margin-bottom: 15px;">${title}</h3>
            <p style="color: #2C3E50; line-height: 1.6;">${message}</p>
        `;
    } else {
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                ${type === 'loading' ? '⏳' : '✅'}
            </div>
            <p style="color: #2C3E50; line-height: 1.6;">${message}</p>
        `;
    }
    
    modal.appendChild(content);
    
    // 点击外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    return modal;
}

// 响应式适配
function handleResize() {
    const width = window.innerWidth;
    
    if (width < 768) {
        // 移动端适配
        document.body.classList.add('mobile');
    } else {
        document.body.classList.remove('mobile');
    }
}

window.addEventListener('resize', handleResize);

// 初始化时执行响应式检查
handleResize();

// 导出功能函数（供HTML调用）
window.nextStep = nextStep;
window.generateReport = generateReport;
window.bookConsultation = bookConsultation;
window.togglePanel = togglePanel; 