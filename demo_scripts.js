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

// 移动端性能优化和内存管理
let performanceOptimization = {
    isMobile: window.innerWidth <= 768,
    memoryCleanupInterval: null,
    
    // 初始化性能优化
    init() {
        if (this.isMobile) {
            console.log('🚀 启用移动端性能优化模式');
            this.enableMobileOptimizations();
            this.startMemoryMonitoring();
        }
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            
            if (wasMobile !== this.isMobile) {
                console.log(`📱 设备模式切换: ${this.isMobile ? '移动端' : '桌面端'}`);
                // 重新初始化Canvas
                setTimeout(() => {
                    initializeFaceCanvas();
                }, 100);
            }
        });
    },
    
    // 启用移动端优化
    enableMobileOptimizations() {
        // 禁用一些不必要的动画
        document.documentElement.style.setProperty('--animation-duration', '0.2s');
        
        // 优化触摸事件
        document.addEventListener('touchstart', function() {}, { passive: true });
        document.addEventListener('touchmove', function() {}, { passive: true });
        
        // Chart.js移动端优化配置
        if (window.Chart) {
            Chart.defaults.animation.duration = 300;
            Chart.defaults.responsive = true;
            Chart.defaults.maintainAspectRatio = false;
            Chart.defaults.interaction.intersect = false;
            Chart.defaults.plugins.legend.display = false; // 移动端隐藏图例节省空间
            console.log('📊 Chart.js移动端优化已启用');
        }
        
        // 预设移动端Canvas优化
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px) {
                canvas {
                    image-rendering: pixelated;
                    image-rendering: -moz-crisp-edges;
                    image-rendering: crisp-edges;
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    // 开始内存监控
    startMemoryMonitoring() {
        // 每30秒进行一次内存清理
        this.memoryCleanupInterval = setInterval(() => {
            this.performMemoryCleanup();
        }, 30000);
        
        // 页面可见性变化时进行清理
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.performMemoryCleanup();
            }
        });
    },
    
    // 执行内存清理
    performMemoryCleanup() {
        try {
            // 清理可能的内存泄漏
            if (window.gc) {
                window.gc();
            }
            
            // 清理未使用的图片缓存
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                if (img.complete && !img.parentNode) {
                    img.src = '';
                }
            });
            
            // 移动端专门清理Chart.js实例（如果误创建了）
            if (this.isMobile && window.Chart) {
                // 销毁可能存在的图表实例
                Object.keys(Chart.instances).forEach(id => {
                    const chart = Chart.instances[id];
                    if (chart && chart.canvas && !chart.canvas.offsetParent) {
                        chart.destroy();
                        console.log('🧹 清理未使用的Chart实例:', id);
                    }
                });
            }
            
            console.log('🧹 执行内存清理');
        } catch (error) {
            console.warn('内存清理失败:', error);
        }
    },
    
    // 清理资源
    destroy() {
        if (this.memoryCleanupInterval) {
            clearInterval(this.memoryCleanupInterval);
        }
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化性能优化
    performanceOptimization.init();
    
    // 初始化应用
    initializeApp();
    bindEvents();
    setupCharts();
    setupAnimations();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', function() {
    performanceOptimization.destroy();
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
    
    bindProfileSelectorEvents();
    // 默认加载一次，确保初始界面有数据
    updateUIForProfile(currentUserProfile);
}

function bindProfileSelectorEvents() {
    const profileCards = document.querySelectorAll('.profile-card');
    profileCards.forEach(card => {
        card.addEventListener('click', function() {
            // 更新当前选择的档案
            currentUserProfile = this.getAttribute('data-profile');
            
            // 更新卡片激活状态
            profileCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            // 用新数据更新所有相关UI
            updateUIForProfile(currentUserProfile);
            console.log(`已切换到档案: ${currentUserProfile}`);
        });
    });
}

function updateUIForProfile(profileId) {
    const profile = userProfiles[profileId];
    if (!profile) return;

    // 更新第一步的头像等信息 (如果需要)
    // 更新分析报告标题
    const analysisTitle = document.getElementById('analysis-title');
    if (analysisTitle) {
        analysisTitle.textContent = `${profile.name}的AI智能面部分析报告`;
    }
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
            // 使用新的变美方案初始化函数
            initializeTreatmentPlan();
            // 保持原有的治疗定制器功能
            setupTreatmentCustomizer();
            initializeTreatmentPreview();
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
                
                // 使用当前选择的档案数据更新UI
                updateAnalysisReport(currentUserProfile);
                initializeFaceCanvas(); // 可在此函数内部也传入profile数据
            }, 500 + (progressItems.length * 1000));
        }
    }, 1000);
}

function playAnalysisSound(step) {
    // 可以添加音效反馈
    console.log(`分析步骤 ${step + 1} 完成`);
}

// 面部画布初始化 - 移动端优化版
function initializeFaceCanvas() {
    const canvas = document.getElementById('faceCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // 移动端性能优化：限制DPR和Canvas尺寸
    const isMobile = window.innerWidth <= 768;
    const dpr = isMobile ? Math.min(window.devicePixelRatio || 1, 2) : (window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    
    // 移动端降低分辨率以节省内存
    const scale = isMobile ? 0.8 : 1;
    canvas.width = rect.width * dpr * scale;
    canvas.height = rect.height * dpr * scale;
    ctx.scale(dpr * scale, dpr * scale);
    
    // 优化Canvas渲染设置
    ctx.imageSmoothingEnabled = !isMobile; // 移动端关闭抗锯齿以提升性能
    
    // 加载并绘制face.png图片
    loadFaceImage(ctx, isMobile);
}

// 加载面部图片 - 移动端优化版
function loadFaceImage(ctx, isMobile = false) {
    const faceImage = new Image();
    
    // 移动端预设较小的Canvas尺寸
    const canvasWidth = isMobile ? 250 : 300;
    const canvasHeight = isMobile ? 320 : 400;
    
    faceImage.onload = function() {
        console.log('✅ face.png 加载成功');
        
        // 清除画布
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // 绘制专业背景
        drawProfessionalBackground(ctx, canvasWidth, canvasHeight);
        
        // 绘制面部图片 - 居中对齐
        const imgAspectRatio = faceImage.naturalWidth / faceImage.naturalHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;
        
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (imgAspectRatio > canvasAspectRatio) {
            // 图片更宽，以高度为准
            drawHeight = canvasHeight;
            drawWidth = drawHeight * imgAspectRatio;
            offsetX = (canvasWidth - drawWidth) / 2;
        } else {
            // 图片更高，以宽度为准
            drawWidth = canvasWidth;
            drawHeight = drawWidth / imgAspectRatio;
            offsetY = (canvasHeight - drawHeight) / 2;
        }
        
        // 居中绘制
        ctx.drawImage(faceImage, offsetX, offsetY, drawWidth, drawHeight);
        
        // 移动端简化效果以提升性能
        if (isMobile) {
            drawSimplifiedHeatMap(ctx, canvasWidth, canvasHeight);
            drawSimplifiedGrid(ctx, canvasWidth, canvasHeight);
        } else {
            // 添加完整的热力图效果
            drawBeautifulHeatMap(ctx);
            // 添加分析网格
            drawAnalysisGrid(ctx);
            // 添加专业分析框架
            drawAnalysisFramework(ctx);
        }
    };
    
    faceImage.onerror = function(error) {
        console.warn('❌ 无法加载face.png，使用默认绘制', error);
        console.log('🔄 回退到Canvas绘制模式');
        
        // 如果图片加载失败，使用原来的绘制方法
        drawBackground(ctx);
        drawProfessionalFace(ctx);
        
        if (isMobile) {
            drawSimplifiedHeatMap(ctx, canvasWidth, canvasHeight);
            drawSimplifiedGrid(ctx, canvasWidth, canvasHeight);
        } else {
            drawBeautifulHeatMap(ctx);
            drawAnalysisGrid(ctx);
        }
    };
    
    // 添加超时处理
    setTimeout(() => {
        if (!faceImage.complete) {
            console.warn('⏰ face.png 加载超时，使用默认绘制');
            faceImage.onerror();
        }
    }, 5000);
    
    // 设置图片源 - 尝试多个可能的路径
    const imagePaths = [
        'face.png',
        './face.png',
        '/youmagic-demo/face.png'
    ];
    
    let currentPathIndex = 0;
    
    function tryNextPath() {
        if (currentPathIndex < imagePaths.length) {
            console.log(`🔍 尝试加载: ${imagePaths[currentPathIndex]}`);
            faceImage.src = imagePaths[currentPathIndex];
            currentPathIndex++;
        }
    }
    
    faceImage.onerror = function() {
        if (currentPathIndex < imagePaths.length) {
            console.warn(`❌ ${imagePaths[currentPathIndex - 1]} 加载失败，尝试下一个路径`);
            tryNextPath();
        } else {
            console.warn('❌ 所有路径都加载失败，使用默认绘制');
            // 使用原来的绘制方法
            drawBackground(ctx);
            drawProfessionalFace(ctx);
            if (isMobile) {
                drawSimplifiedHeatMap(ctx, canvasWidth, canvasHeight);
                drawSimplifiedGrid(ctx, canvasWidth, canvasHeight);
            } else {
                drawBeautifulHeatMap(ctx);
                drawAnalysisGrid(ctx);
            }
        }
    };
    
    // 开始尝试第一个路径
    tryNextPath();
}

// 绘制专业背景
function drawProfessionalBackground(ctx, width = 300, height = 400) {
    // 创建专业的医美背景
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f8f9fa');
    gradient.addColorStop(0.5, '#e9ecef');
    gradient.addColorStop(1, '#dee2e6');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // 添加微妙的医美纹理（移动端减少数量）
    const isMobile = width < 300;
    const textureCount = isMobile ? 15 : 30;
    
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#5D3E8E';
    for (let i = 0; i < textureCount; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 3, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// 移动端简化热力图
function drawSimplifiedHeatMap(ctx, width = 250, height = 320) {
    ctx.save();
    
    // 设置较轻的混合模式
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.2;
    
    // 只绘制主要问题区域，减少计算量
    
    // 前额区域
    const foreheadGradient = ctx.createRadialGradient(width/2, height*0.2, 0, width/2, height*0.2, 25);
    foreheadGradient.addColorStop(0, 'rgba(255, 193, 7, 0.6)');
    foreheadGradient.addColorStop(1, 'rgba(255, 193, 7, 0)');
    
    ctx.fillStyle = foreheadGradient;
    ctx.beginPath();
    ctx.ellipse(width/2, height*0.2, 25, 15, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 下颌线区域
    const jawGradient = ctx.createRadialGradient(width/2, height*0.85, 0, width/2, height*0.85, 35);
    jawGradient.addColorStop(0, 'rgba(255, 107, 107, 0.7)');
    jawGradient.addColorStop(1, 'rgba(255, 107, 107, 0)');
    
    ctx.fillStyle = jawGradient;
    ctx.beginPath();
    ctx.ellipse(width/2, height*0.85, 30, 20, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.restore();
}

// 移动端简化网格
function drawSimplifiedGrid(ctx, width = 250, height = 320) {
    ctx.save();
    
    // 绘制基本分析线
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#5D3E8E';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    
    // 面部中线
    ctx.beginPath();
    ctx.moveTo(width/2, height*0.1);
    ctx.lineTo(width/2, height*0.9);
    ctx.stroke();
    
    // 三等分线
    ctx.beginPath();
    // 上1/3
    ctx.moveTo(width*0.2, height*0.25);
    ctx.lineTo(width*0.8, height*0.25);
    // 下1/3
    ctx.moveTo(width*0.2, height*0.65);
    ctx.lineTo(width*0.8, height*0.65);
    ctx.stroke();
    
    ctx.restore();
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
    
    const severityColors = {
        mild: '#4CAF50',
        medium: '#FFC107', 
        severe: '#FF6B6B'
    };
    
    const severityText = {
        'mild': '轻微',
        'medium': '中等',
        'severe': '严重'
    };
    
    const recommendations = getRecommendation(region, severity);
    const detailedInfo = getDetailedAnalysis(region, issue, severity);
    
    const details = `
        <div class="region-analysis">
            <h4>${region}区域分析</h4>
            <div class="analysis-summary">
                <span class="issue-badge" style="background: ${severityColors[severity]}; color: white; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: 600;">
                    ${issue} - ${severityText[severity]}
                </span>
                <div class="severity-indicator" style="margin-top: 10px;">
                    <div class="severity-bar" style="background: #f0f0f0; height: 6px; border-radius: 3px; overflow: hidden;">
                        <div class="severity-fill" style="background: ${severityColors[severity]}; height: 100%; width: ${severity === 'mild' ? '30%' : severity === 'medium' ? '60%' : '90%'}; transition: width 0.8s ease; border-radius: 3px;"></div>
                    </div>
                </div>
            </div>
            
            <div class="detailed-analysis" style="margin: 15px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px; line-height: 1.5; border-left: 3px solid ${severityColors[severity]};">
                <strong style="color: ${severityColors[severity]};">详细分析：</strong><br>
                <span style="color: #555;">${detailedInfo.analysis}</span>
            </div>
            
            <div class="metrics-list">
                <div class="metric-row">
                    <span class="metric-name">问题严重程度</span>
                    <span class="metric-value" style="color: ${severityColors[severity]}; font-weight: 600;">
                        ${severityText[severity]}
                    </span>
                </div>
                <div class="metric-row">
                    <span class="metric-name">建议治疗强度</span>
                    <span class="metric-value" style="color: #5D3E8E; font-weight: 600;">${detailedInfo.intensity}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-name">预期改善程度</span>
                    <span class="metric-value" style="color: #4CAF50; font-weight: 600;">${detailedInfo.improvement}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-name">治疗周期</span>
                    <span class="metric-value">${detailedInfo.duration}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-name">维持时间</span>
                    <span class="metric-value">${detailedInfo.maintenance}</span>
                </div>
            </div>
            
            <div class="treatment-params" style="margin: 15px 0; padding: 12px; background: rgba(93, 62, 142, 0.05); border-radius: 10px; border: 1px solid rgba(93, 62, 142, 0.1);">
                <strong style="color: #5D3E8E; font-size: 14px; display: block; margin-bottom: 8px;">
                    🎯 推荐参数设置
                </strong>
                <div style="font-size: 13px; color: #666; line-height: 1.4;">
                    <div style="margin-bottom: 4px;">• <strong>能量强度：</strong>${detailedInfo.energy}</div>
                    <div style="margin-bottom: 4px;">• <strong>脉冲频率：</strong>${detailedInfo.frequency}</div>
                    <div>• <strong>治疗深度：</strong>${detailedInfo.depth}</div>
                </div>
            </div>
            
            <div class="recommendation" style="background: rgba(76, 175, 80, 0.05); border-left: 3px solid #4CAF50; padding: 12px; border-radius: 0 8px 8px 0;">
                <strong style="color: #4CAF50; display: block; margin-bottom: 6px;">💡 专业建议</strong>
                <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.4;">${recommendations}</p>
            </div>
        </div>
    `;
    
    regionDetails.innerHTML = details;
    regionDetails.classList.add('slide-up');
    
    // 添加动画效果
    setTimeout(() => {
        const severityFill = regionDetails.querySelector('.severity-fill');
        if (severityFill) {
            severityFill.style.width = '0%';
            setTimeout(() => {
                severityFill.style.width = severity === 'mild' ? '30%' : severity === 'medium' ? '60%' : '90%';
            }, 100);
        }
    }, 200);
    
    // 移除动画类
    setTimeout(() => {
        regionDetails.classList.remove('slide-up');
    }, 600);
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

// 获取详细分析信息
function getDetailedAnalysis(region, issue, severity) {
    const detailedData = {
        '前额': {
            mild: {
                analysis: '前额区域呈现轻微细纹，主要集中在动态表情产生的横纹。皮肤弹性良好，胶原蛋白结构基本完整。',
                intensity: '温和模式（2-3级）',
                improvement: '65-75%',
                duration: '4-6周',
                maintenance: '12-15个月',
                energy: '60-80%',
                frequency: '2-3Hz',
                depth: '真皮浅层'
            },
            medium: {
                analysis: '前额横纹较为明显，静态状态下可见。皮肤弹性开始下降，需要刺激胶原蛋白再生。',
                intensity: '标准模式（4-6级）',
                improvement: '75-85%',
                duration: '6-8周',
                maintenance: '10-12个月',
                energy: '80-90%',
                frequency: '3-4Hz',
                depth: '真皮中层'
            },
            severe: {
                analysis: '前额深度皱纹明显，伴有皮肤松弛。胶原蛋白大量流失，需要强化修复治疗。',
                intensity: '强化模式（7-9级）',
                improvement: '85-95%',
                duration: '8-12周',
                maintenance: '8-10个月',
                energy: '90-100%',
                frequency: '4-5Hz',
                depth: '真皮深层'
            }
        },
        '左眼周': {
            mild: {
                analysis: '眼周肌肤轻微松弛，鱼尾纹处于早期形成阶段。眼部肌肤较薄，需要温和处理。',
                intensity: '温和模式（1-2级）',
                improvement: '60-70%',
                duration: '3-4周',
                maintenance: '15-18个月',
                energy: '40-60%',
                frequency: '1-2Hz',
                depth: '表皮层'
            },
            medium: {
                analysis: '眼周鱼尾纹较为明显，眼袋轻微凸起。需要针对性紧致治疗。',
                intensity: '标准模式（3-4级）',
                improvement: '70-80%',
                duration: '4-6周',
                maintenance: '12-15个月',
                energy: '60-75%',
                frequency: '2-3Hz',
                depth: '真皮浅层'
            },
            severe: {
                analysis: '眼周严重松弛，鱼尾纹深度明显，眼袋突出。需要综合性抗衰方案。',
                intensity: '强化模式（5-6级）',
                improvement: '80-90%',
                duration: '6-10周',
                maintenance: '10-12个月',
                energy: '75-85%',
                frequency: '3-4Hz',
                depth: '真皮中层'
            }
        },
        '右眼周': {
            mild: {
                analysis: '眼周肌肤轻微松弛，鱼尾纹处于早期形成阶段。眼部肌肤较薄，需要温和处理。',
                intensity: '温和模式（1-2级）',
                improvement: '60-70%',
                duration: '3-4周',
                maintenance: '15-18个月',
                energy: '40-60%',
                frequency: '1-2Hz',
                depth: '表皮层'
            },
            medium: {
                analysis: '眼周鱼尾纹较为明显，眼袋轻微凸起。需要针对性紧致治疗。',
                intensity: '标准模式（3-4级）',
                improvement: '70-80%',
                duration: '4-6周',
                maintenance: '12-15个月',
                energy: '60-75%',
                frequency: '2-3Hz',
                depth: '真皮浅层'
            },
            severe: {
                analysis: '眼周严重松弛，鱼尾纹深度明显，眼袋突出。需要综合性抗衰方案。',
                intensity: '强化模式（5-6级）',
                improvement: '80-90%',
                duration: '6-10周',
                maintenance: '10-12个月',
                energy: '75-85%',
                frequency: '3-4Hz',
                depth: '真皮中层'
            }
        },
        '左面颊': {
            mild: {
                analysis: '面颊区域轻微松弛，苹果肌位置略有下移。整体肌肤状态良好。',
                intensity: '温和模式（2-3级）',
                improvement: '70-80%',
                duration: '4-6周',
                maintenance: '15-18个月',
                energy: '70-85%',
                frequency: '2-3Hz',
                depth: '真皮浅层'
            },
            medium: {
                analysis: '面颊松弛较明显，法令纹开始加深。需要提升面部轮廓。',
                intensity: '标准模式（4-6级）',
                improvement: '80-85%',
                duration: '6-8周',
                maintenance: '12-15个月',
                energy: '85-95%',
                frequency: '3-4Hz',
                depth: '真皮中层'
            },
            severe: {
                analysis: '面颊严重下垂，法令纹深重。需要强化轮廓重塑治疗。',
                intensity: '强化模式（7-9级）',
                improvement: '85-95%',
                duration: '8-12周',
                maintenance: '10-12个月',
                energy: '95-100%',
                frequency: '4-5Hz',
                depth: '真皮深层'
            }
        },
        '右面颊': {
            mild: {
                analysis: '面颊区域轻微松弛，苹果肌位置略有下移。整体肌肤状态良好。',
                intensity: '温和模式（2-3级）',
                improvement: '70-80%',
                duration: '4-6周',
                maintenance: '15-18个月',
                energy: '70-85%',
                frequency: '2-3Hz',
                depth: '真皮浅层'
            },
            medium: {
                analysis: '面颊松弛较明显，法令纹开始加深。需要提升面部轮廓。',
                intensity: '标准模式（4-6级）',
                improvement: '80-85%',
                duration: '6-8周',
                maintenance: '12-15个月',
                energy: '85-95%',
                frequency: '3-4Hz',
                depth: '真皮中层'
            },
            severe: {
                analysis: '面颊严重下垂，法令纹深重。需要强化轮廓重塑治疗。',
                intensity: '强化模式（7-9级）',
                improvement: '85-95%',
                duration: '8-12周',
                maintenance: '10-12个月',
                energy: '95-100%',
                frequency: '4-5Hz',
                depth: '真皮深层'
            }
        },
        '下颌线': {
            mild: {
                analysis: '下颌线轮廓略显模糊，双下巴初现。肌肉张力开始下降。',
                intensity: '温和模式（3-4级）',
                improvement: '75-85%',
                duration: '6-8周',
                maintenance: '12-15个月',
                energy: '80-90%',
                frequency: '3-4Hz',
                depth: '真皮中层'
            },
            medium: {
                analysis: '下颌线明显松弛，双下巴较为突出。需要重点紧致治疗。',
                intensity: '标准模式（5-7级）',
                improvement: '85-90%',
                duration: '8-10周',
                maintenance: '10-12个月',
                energy: '90-95%',
                frequency: '4-5Hz',
                depth: '真皮深层'
            },
            severe: {
                analysis: '下颌线严重松弛下垂，双下巴明显。需要强化轮廓重塑方案。',
                intensity: '强化模式（8-10级）',
                improvement: '90-95%',
                duration: '10-16周',
                maintenance: '8-10个月',
                energy: '95-100%',
                frequency: '5-6Hz',
                depth: '筋膜层'
            }
        }
    };
    
    return detailedData[region]?.[severity] || {
        analysis: '该区域需要专业评估，建议咨询医师制定个性化方案。',
        intensity: '待定',
        improvement: '待评估',
        duration: '待定',
        maintenance: '待定',
        energy: '待定',
        frequency: '待定',
        depth: '待定'
    };
}

// 雷达图初始化（仅桌面端）
function initializeRadarChart() {
    // 移动端跳过雷达图初始化，节省内存
    if (window.innerWidth <= 768) {
        console.log('📱 移动端：跳过雷达图，使用轻量级替代方案');
        initializeMobileSkinScores();
        return;
    }
    
    const ctx = document.getElementById('radarChart');
    if (!ctx) return;
    
    console.log('💻 桌面端：初始化雷达图');
    
    new Chart(ctx.getContext('2d'), {
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

// 移动端皮肤指数初始化（轻量级替代方案）
function initializeMobileSkinScores() {
    console.log('📱 移动端：初始化轻量级皮肤指数显示');
    
    const scores = [
        { label: '弹性', value: 68 },
        { label: '水分', value: 45 },
        { label: '紧致', value: 62 },
        { label: '均匀', value: 78 },
        { label: '光泽', value: 55 },
        { label: '细腻', value: 72 }
    ];
    
    // 添加动画效果
    setTimeout(() => {
        const scoreItems = document.querySelectorAll('.mobile-score-item');
        scoreItems.forEach((item, index) => {
            // 延迟动画，营造加载效果
            setTimeout(() => {
                const fill = item.querySelector('.mobile-score-fill');
                const value = item.querySelector('.mobile-score-value');
                
                if (fill && value) {
                    // 从0开始动画到目标值
                    const targetWidth = parseInt(fill.style.width);
                    let currentWidth = 0;
                    const increment = targetWidth / 20;
                    
                    const animateProgress = () => {
                        currentWidth += increment;
                        if (currentWidth >= targetWidth) {
                            currentWidth = targetWidth;
                            fill.style.width = currentWidth + '%';
                            value.style.transform = 'scale(1.1)';
                            setTimeout(() => {
                                value.style.transform = 'scale(1)';
                            }, 200);
                        } else {
                            fill.style.width = currentWidth + '%';
                            requestAnimationFrame(animateProgress);
                        }
                    };
                    
                    animateProgress();
                }
                
                // 添加入场动画
                item.style.opacity = '0';
                item.style.transform = 'translateY(20px)';
                item.style.transition = 'all 0.5s ease';
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, 50);
                
            }, index * 100);
        });
    }, 500);
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
    
    // 更新桌面端改善程度
    const improvementRateEl = document.getElementById('improvementRate');
    if (improvementRateEl) {
        improvementRateEl.textContent = `${improvement}%`;
    }
    
    // 更新移动端改善程度
    const mobileImprovementValue = document.getElementById('mobileImprovementValue');
    const mobileImprovementFill = document.getElementById('mobileImprovementFill');
    
    if (mobileImprovementValue && mobileImprovementFill) {
        mobileImprovementValue.textContent = `${improvement}%`;
        // 动画更新进度条
        setTimeout(() => {
            mobileImprovementFill.style.width = `${improvement}%`;
        }, 100);
    }
    
    // 更新治疗图片效果（根据强度调整滤镜）
    updateTreatmentImages(improvement);
    
    // 更新疼痛程度
    const painLevels = ['无感', '轻微', '中等', '明显'];
    const painIndex = Math.floor((treatmentParams.intensity - 1) / 3);
    const painLevelEl = document.getElementById('painLevel');
    if (painLevelEl) {
        painLevelEl.textContent = painLevels[painIndex] || '轻微';
    }
    
    // 更新恢复时间
    const recoveryDays = Math.ceil(treatmentParams.intensity / 2);
    const recoveryTimeEl = document.getElementById('recoveryTime');
    if (recoveryTimeEl) {
        recoveryTimeEl.textContent = `${recoveryDays}-${recoveryDays + 1}天`;
    }
    
    // 更新费用
    const baseCost = 6000;
    const intensityCost = treatmentParams.intensity * 400;
    const frequencyCost = treatmentParams.frequency * 200;
    const totalCost = baseCost + intensityCost + frequencyCost;
    const estimatedCostEl = document.getElementById('estimatedCost');
    if (estimatedCostEl) {
        estimatedCostEl.textContent = `¥${totalCost.toLocaleString()}`;
    }
}

// 更新治疗图片效果
function updateTreatmentImages(improvement) {
    const beforeImg = document.getElementById('beforeTreatmentImg');
    const afterImg = document.getElementById('afterTreatmentImg');
    
    if (beforeImg && afterImg) {
        // 根据改善程度调整图片效果
        const contrastBonus = Math.round(improvement / 5); // 0-19的对比度增强
        const brightnessBonus = Math.round(improvement / 10); // 0-9的亮度增强
        
        // 治疗前保持原样
        beforeImg.style.filter = 'none';
        
        // 治疗后图片增强效果
        afterImg.style.filter = `
            contrast(${100 + contrastBonus}%) 
            brightness(${100 + brightnessBonus}%) 
            saturate(${100 + contrastBonus}%)
        `;
        
        console.log(`🎨 图片效果更新: 改善${improvement}%, 对比度+${contrastBonus}%, 亮度+${brightnessBonus}%`);
    }
}

// 初始化治疗效果预览
function initializeTreatmentPreview() {
    const comparisonSlider = document.getElementById('comparisonSlider');
    
    if (comparisonSlider) {
        comparisonSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            // 可以添加滑块交互效果
            console.log(`对比滑块位置: ${value}%`);
        });
    }
    
    // 初始加载图片
    setTimeout(() => {
        updateTreatmentImages(75); // 默认75%改善
    }, 1000);
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

// 变美方案初始化
function initializeTreatmentPlan() {
    setupTreatmentTabs();
    setupCategoryFilters();
    setupProjectCards();
    initializeTreatmentAvatar();
}

// 设置治疗方案标签页
function setupTreatmentTabs() {
    const tabItems = document.querySelectorAll('.tab-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabItems.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabItems.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 激活当前标签
            this.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-content`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            // 添加切换动画
            this.classList.add('slide-up');
            setTimeout(() => {
                this.classList.remove('slide-up');
            }, 300);
        });
    });
}

// 设置区域分类筛选
function setupCategoryFilters() {
    const categoryItems = document.querySelectorAll('.category-item');
    const projectCards = document.querySelectorAll('.project-card');
    
    categoryItems.forEach(category => {
        category.addEventListener('click', function() {
            const targetCategory = this.getAttribute('data-category');
            
            // 移除所有活动状态
            categoryItems.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            // 筛选项目卡片
            projectCards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                
                if (targetCategory === 'all' || cardCategory === targetCategory) {
                    card.style.display = 'flex';
                    card.classList.add('fade-in');
                } else {
                    card.style.display = 'none';
                    card.classList.remove('fade-in');
                }
            });
        });
    });
}

// 设置项目卡片交互
function setupProjectCards() {
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
        card.addEventListener('click', function() {
            const projectName = this.querySelector('h3').textContent;
            const projectDesc = this.querySelector('.project-desc').textContent;
            
            // 添加点击动画
            this.classList.add('bounce-in');
            setTimeout(() => {
                this.classList.remove('bounce-in');
            }, 600);
            
            // 显示项目详情
            console.log(`选择项目: ${projectName}`);
            console.log(`项目描述: ${projectDesc}`);
        });
        
        // 添加鼠标悬停效果
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// 初始化治疗头像区域
function initializeTreatmentAvatar() {
    const treatmentTags = document.querySelectorAll('.treatment-tag');
    
    treatmentTags.forEach(tag => {
        tag.addEventListener('click', function() {
            const area = this.getAttribute('data-area');
            const treatmentType = this.textContent;
            
            // 添加点击动画
            this.classList.add('bounce-in');
            setTimeout(() => {
                this.classList.remove('bounce-in');
            }, 600);
            
            // 显示对应区域的治疗信息
            showTreatmentAreaInfo(area, treatmentType);
        });
        
        // 添加脉冲动画
        tag.addEventListener('mouseenter', function() {
            this.style.animation = 'pulse 1s infinite';
        });
        
        tag.addEventListener('mouseleave', function() {
            this.style.animation = 'none';
        });
    });
}

// 显示治疗区域信息
function showTreatmentAreaInfo(area, treatmentType) {
    const treatmentInfo = getTreatmentAreaInfo(area, treatmentType);
    
    // 创建信息提示框
    const infoBox = document.createElement('div');
    infoBox.className = 'treatment-info-box';
    infoBox.innerHTML = `
        <div class="info-header">
            <h4>${area} - ${treatmentType}</h4>
            <button class="info-close">&times;</button>
        </div>
        <div class="info-content">
            <p><strong>适应症：</strong>${treatmentInfo.indications}</p>
            <p><strong>治疗方案：</strong>${treatmentInfo.treatment}</p>
            <p><strong>预期效果：</strong>${treatmentInfo.effect}</p>
            <p><strong>治疗周期：</strong>${treatmentInfo.cycle}</p>
        </div>
    `;
    
    // 添加样式
    infoBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 15px;
        padding: 20px;
        box-shadow: 0 8px 25px rgba(93, 62, 142, 0.2);
        z-index: 1000;
        max-width: 400px;
        width: 90%;
        animation: fadeIn 0.3s ease;
    `;
    
    // 添加背景遮罩
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(infoBox);
    
    // 关闭按钮事件
    const closeBtn = infoBox.querySelector('.info-close');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(infoBox);
        document.body.removeChild(overlay);
    });
    
    // 点击遮罩关闭
    overlay.addEventListener('click', () => {
        document.body.removeChild(infoBox);
        document.body.removeChild(overlay);
    });
}

// 获取治疗区域信息
function getTreatmentAreaInfo(area, treatmentType) {
    const treatmentData = {
        '前额': {
            indications: '额纹、川字纹、抬头纹',
            treatment: 'YOUMAGIC射频紧致，针对前额肌肉放松',
            effect: '减少抬头纹，提升前额平滑度',
            cycle: '1-2次，间隔4-6周'
        },
        '眼部': {
            indications: '眼周细纹、鱼尾纹、眼袋下垂',
            treatment: '精准温控射频，温和改善眼周肌肤',
            effect: '减少细纹，提升眼部紧致度',
            cycle: '2-3次，间隔3-4周'
        },
        '面颊': {
            indications: '面部松弛、苹果肌下垂、法令纹',
            treatment: '深层射频技术，刺激胶原蛋白再生',
            effect: '提升面部轮廓，改善松弛状态',
            cycle: '2-3次，间隔4-6周'
        },
        '下颌': {
            indications: '双下巴、下颌线模糊、颈纹',
            treatment: '射频塑形，重新定义下颌轮廓',
            effect: '明显改善下颌线条，减少双下巴',
            cycle: '3-4次，间隔4-6周'
        },
        '颈部': {
            indications: '颈纹、颈部松弛、火鸡脖',
            treatment: '颈部专用射频程序，分层治疗',
            effect: '紧致颈部肌肤，减少颈纹',
            cycle: '2-3次，间隔4-6周'
        }
    };
    
    return treatmentData[area] || {
        indications: '多种肌肤问题',
        treatment: 'YOUMAGIC专业射频治疗',
        effect: '改善肌肤状态，提升紧致度',
        cycle: '根据个人情况定制'
    };
}

const userProfiles = {
    'profile1': {
        name: "王女士",
        age: 28,
        skinType: "混合性偏干",
        profileDesc: "初老抗衰",
        avatar: "face.png", // 稍后可替换
        analysis: {
            skinAge: 32,
            scores: {
                elasticity: 65,
                moisture: 58,
                wrinkles: 72,
                pigmentation: 85,
                pores: 78,
                sensitivity: 80,
            },
            summary: "肌肤整体处于轻度老化阶段，胶原蛋白流失加速，眼周及法令纹区域出现动态性皱纹，需即刻启动抗衰护理。",
            regions: {
                forehead: { issue: "抬头纹", severity: "轻度", details: "因表情习惯产生动态性抬头纹，皮层弹性下降。", recommendation: "建议通过射频提升前额紧致度。" },
                eyes: { issue: "眼周细纹", severity: "中度", details: "眼周皮肤干燥，出现干纹和表情纹，是面部最早出现衰老的信号。", recommendation: "推荐使用眼部专用探头进行精准提拉。" },
                cheeks: { issue: "法令纹", severity: "中度", details: "鼻唇沟加深，苹果肌有轻微下垂趋势，是面部松弛的关键指标。", recommendation: "重点加强中面部提拉，刺激胶原再生。" },
                jawline: { issue: "轮廓清晰", severity: "优秀", details: "下颌线紧致，无明显脂肪堆积或松弛。", recommendation: "保持良好，可做预防性紧致维护。" },
                nose: { issue: "毛孔", severity: "轻度", details: "鼻翼两侧毛孔因油脂分泌而略显粗大。", recommendation: "射频治疗可帮助收缩毛孔。" },
                chin: { issue: "肤色均匀", severity: "良好", details: "下巴区域肤色均匀，无明显痘印或色素沉着。", recommendation: "继续保持。" }
            }
        },
        treatmentPlan: {
            chiefPlan: {
                name: "YOUMAGIC™ 眼周焕活与中面部提升疗程",
                description: "针对28岁初老肌定制，精准对抗第一道细纹，重塑面部年轻结构，实现预防与治疗双重功效。",
                coreProject: "超频炮精准提拉 (眼部+面部)",
                parameters: {
                    intensity: "5-7档 (温和-中效)",
                    shots: "900发",
                    probe: "眼部专用探头 + 面部4.0探头"
                },
                add_ons: "术后导入医用级胶原蛋白精华",
                cycle: "建议3次为一个完整疗程，每次间隔30-45天。"
            }
        },
        results: {
            improvement: "78%",
            pain: "几乎无痛",
            recovery: "24-48小时",
            cost: "¥12,800"
        }
    },
    'profile2': {
        name: "李女士",
        age: 38,
        skinType: "干性",
        profileDesc: "熟龄紧致",
        avatar: "treat.png", // 稍后可替换
        analysis: {
            skinAge: 45,
            scores: {
                elasticity: 45,
                moisture: 42,
                wrinkles: 55,
                pigmentation: 68,
                pores: 82,
                sensitivity: 75,
            },
            summary: "面部呈现显著的松弛和下垂迹象，胶原蛋白和弹性纤维流失严重，下颌线模糊，是典型的熟龄衰老特征。",
            regions: {
                forehead: { issue: "静态皱纹", severity: "中度", details: "已形成静态抬头纹，即使无表情时也清晰可见。", recommendation: "需采用更高能量进行深层射频刺激。" },
                eyes: { issue: "眼袋与下垂", severity: "严重", details: "眼周皮肤松弛，形成眼袋和多重皱纹，眼神略显疲态。", recommendation: "眼部综合抗衰是本次治疗重点。" },
                cheeks: { issue: "全面部松弛", severity: "严重", details: "苹果肌下移，法令纹、木偶纹三线齐现，中面部容积流失明显。", recommendation: "启动全面部SMAS筋膜层提拉。" },
                jawline: { issue: "轮廓模糊", severity: "严重", details: "下颌缘脂肪堆积与皮肤松弛导致轮廓线消失，出现双下巴。", recommendation: "下颌缘重塑是改善面部年轻化的关键。" },
                nose: { issue: "肤质尚可", severity: "良好", details: "鼻部皮肤状态相对较好。", recommendation: "常规维护即可。" },
                chin: { issue: "颈纹", severity: "中度", details: "颈部出现横向纹路，皮肤松弛。", recommendation: "治疗范围需延伸至颈部。" }
            }
        },
        treatmentPlan: {
            chiefPlan: {
                name: "YOUMAGIC™ 全面部轮廓重塑与深度抗衰疗程",
                description: "为38岁熟龄肌定制的强效抗衰方案，目标是重建深层支撑结构，显著提升面部轮廓，实现视觉年龄的逆转。",
                coreProject: "超频炮MAX深度提拉",
                parameters: {
                    intensity: "8-10档 (强效)",
                    shots: "1200发 (全面部+颈部)",
                    probe: "面部4.0探头 + 颈部专用探头"
                },
                add_ons: "搭配使用生物刺激剂，促进胶原再生",
                cycle: "建议4-5次为一个完整疗程，每次间隔45-60天。"
            }
        },
        results: {
            improvement: "85%",
            pain: "轻微热感",
            recovery: "3-5天",
            cost: "¥25,600"
        }
    },
    'profile3': {
        name: "张小姐",
        age: 23,
        skinType: "油性痘肌",
        profileDesc: "痘肌改善",
        avatar: "face.png", // 稍后可替换
        analysis: {
            skinAge: 25,
            scores: {
                elasticity: 88,
                moisture: 65,
                wrinkles: 95,
                pigmentation: 70,
                pores: 50,
                sensitivity: 60,
            },
            summary: "皮肤年轻，但油脂分泌旺盛导致毛孔粗大和反复性痘痘，留下大量新生痘印，水油平衡和屏障修复是核心问题。",
            regions: {
                forehead: { issue: "闭口粉刺", severity: "中度", details: "额头区域有较多闭口粉刺，皮肤不够平滑。", recommendation: "射频治疗有助于抑制皮脂腺过度活跃。" },
                eyes: { issue: "状态良好", severity: "优秀", details: "眼周皮肤紧致，无明显问题。", recommendation: "保持即可。" },
                cheeks: { issue: "新生痘印", severity: "严重", details: "两颊有大量红色和褐色痘印，是炎症后色素沉着(PIH)的典型表现。", recommendation: "通过射频加速新陈代谢，淡化痘印。" },
                jawline: { issue: "偶发性痘痘", severity: "轻度", details: "下颌缘偶有炎症性痘痘发生。", recommendation: "需注意清洁和内分泌调节。" },
                nose: { issue: "黑头与毛孔", severity: "严重", details: "鼻头和鼻翼有明显黑头和毛孔堵塞。", recommendation: "射频热效应能帮助深层清洁和收缩毛孔。" },
                chin: { issue: "陈旧痘印", severity: "中度", details: "下巴区域有部分颜色较深的陈旧痘印。", recommendation: "治疗需要更有耐心。" }
            }
        },
        treatmentPlan: {
            chiefPlan: {
                name: "YOUMAGIC™ 水油平衡与痘肌修复疗程",
                description: "专为年轻油性痘肌设计，旨在调节皮脂分泌、加速痘印代谢、收缩粗大毛孔，重建健康的皮肤屏障。",
                coreProject: "超频炮净肤模式",
                parameters: {
                    intensity: "4-6档 (净肤-修复)",
                    shots: "600发",
                    probe: "面部修复专用探头"
                },
                add_ons: "配合使用含有水杨酸或果酸的医用护肤品",
                cycle: "建议每月1次，连续3-6个月，以稳定皮肤状态。"
            }
        },
        results: {
            improvement: "90% (痘肌改善率)",
            pain: "无痛",
            recovery: "几乎无恢复期",
            cost: "¥6,800"
        }
    }
};

let currentUserProfile = 'profile1'; // 默认加载案例一