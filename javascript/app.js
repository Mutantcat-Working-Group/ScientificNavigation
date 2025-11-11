layui.use(['element', 'form', 'layer'], function () {
    const element = layui.element;
    const form = layui.form;
    const layer = layui.layer;

    // 全局数据存储
    let websitesData = [];
    let rolesData = []; // 存储完整的角色数据
    let rulesData = []; // 存储完整的规则数据
    let promptTemplate = '';
    let selectedRole = null;
    let selectedRules = [];
    let currentSearchKeyword = ''; // 当前搜索关键词
    let currentCategory = ''; // 当前选中的分类
    let promptDataLoaded = false; // 标记提示词页面基础数据（列表）是否已加载
    let isLoadingPromptContent = false; // 标记是否正在加载单个提示内容（角色/规则）
    let isTemplateLoaded = false; // 标记提示词模板是否已加载

    // 角色和规则列表（只包含名称）
    const roleNames = [
        '普通AI',
        '软件工程师',
        '数据分析师',
        '产品经理',
        'UI设计师',
        '前端开发工程师',
        '后端开发工程师',
        '算法工程师',
        '运维工程师',
        '测试工程师',
        '技术文档工程师',
        '架构师',
        '数据库管理员',
        '安全工程师',
        '项目经理',
        '移动端开发工程师',
        '技术支持工程师',
        '硬件工程师',
        '专业咖啡师'
    ];

    const ruleNames = [
        '强制中文',
        '置信度提示',
        '别忘了调用工具',
        '让小学生也能看懂',
        '提供代码示例',
        '分步骤详细说明',
        '列举优缺点',
        '提供实际案例',
        '给出多种方案',
        '简洁明了',
        '使用表格对比',
        '强调注意事项',
        '给出最佳实践',
        '提供学习资源',
        '使用图表辅助',
        '先总结后详述',
        '说明引入文献',
        '说明信息出处',
        '引用权威资源',
        'GBT 7714-2015引用'
    ];

    // 初始化应用
    init();

    function init() {
        loadData();
        bindEvents();

        // 确保 LayUI 导航栏正确渲染
        element.render('nav');
    }

    // 加载所有数据（优化版：分步加载）
    async function loadData() {
        try {
            // 优先加载和显示网站数据（主要内容）
            const websitesRes = await fetch('data/websites.json');
            websitesData = await websitesRes.json();

            // 立即渲染网站卡片，让用户快速看到内容
            renderWebsiteCards(websitesData);

            // 生成分类选项
            generateCategories();

            // 提示词相关数据延迟加载，不阻塞页面显示
            // 这些数据只在用户切换到AI提示词标签时才需要

        } catch (error) {
            console.error('加载数据失败:', error);
            layer.msg('数据加载失败，请刷新页面重试', { icon: 5 });
        }
    }

    // 延迟加载提示词数据
    async function loadPromptData() {
        if (promptDataLoaded) {
            return; // 已经加载过列表，直接返回
        }

        // 1) 立即渲染列表，让界面先可用
        renderRoles();
        renderRules();
        updatePromptPreview();
        promptDataLoaded = true;

        // 2) 异步加载模板，不阻塞界面
        try {
            isTemplateLoaded = false;
            setLoadingState(true); // 模板加载期间禁用复制按钮
            const promptRes = await fetch('data/prompts.md');
            promptTemplate = await promptRes.text();
            isTemplateLoaded = true;
            updatePromptPreview(); // 模板就绪后刷新预览
        } catch (error) {
            console.error('加载提示词模板失败:', error);
            layer.msg('提示词模板加载失败，预览将使用默认格式', { icon: 0 });
        } finally {
            setLoadingState(false);
        }
    }

    // 按需加载单个角色内容
    async function loadRoleContent(roleName) {
        // 检查是否已经加载过
        const existingRole = rolesData.find(r => r.name === roleName);
        if (existingRole) {
            return existingRole;
        }

        try {
            const res = await fetch(`data/roles/${roleName}.md`);
            const content = await res.text();
            const role = {
                name: roleName,
                content: content.replace(/```markdown\n?/g, '').replace(/```\n?/g, '').trim()
            };
            rolesData.push(role);
            return role;
        } catch (error) {
            console.error(`加载角色 ${roleName} 失败:`, error);
            layer.msg(`加载角色失败: ${roleName}`, { icon: 5 });
            return null;
        }
    }

    // 按需加载单个规则内容
    async function loadRuleContent(ruleName) {
        // 检查是否已经加载过
        const existingRule = rulesData.find(r => r.name === ruleName);
        if (existingRule) {
            return existingRule;
        }

        try {
            const res = await fetch(`data/rules/${ruleName}.md`);
            const content = await res.text();
            const rule = {
                name: ruleName,
                content: content.replace(/```markdown\n?/g, '').replace(/```\n?/g, '').trim()
            };
            rulesData.push(rule);
            return rule;
        } catch (error) {
            console.error(`加载规则 ${ruleName} 失败:`, error);
            layer.msg(`加载规则失败: ${ruleName}`, { icon: 5 });
            return null;
        }
    }

    // 绑定事件
    function bindEvents() {
        // 导航切换
        document.querySelectorAll('.layui-nav-item').forEach(item => {
            item.addEventListener('click', function () {
                const tab = this.getAttribute('data-tab');
                switchTab(tab);
            });
        });

        // 搜索功能
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const clearBtn = document.getElementById('clear-search');

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        // 搜索框内容变化时显示/隐藏清除按钮
        searchInput.addEventListener('input', function () {
            if (this.value.trim()) {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
        });

        // 清除搜索
        clearBtn.addEventListener('click', function () {
            searchInput.value = '';
            currentSearchKeyword = '';
            clearBtn.style.display = 'none';
            performFilter();
        });

        // 分类筛选 - 使用原生 change 事件
        const categorySelect = document.getElementById('category-select');
        categorySelect.addEventListener('change', function (e) {
            currentCategory = e.target.value;
            console.log('分类选择变化:', currentCategory);
            // 不立即触发筛选，等待用户点击搜索按钮
        });

        // 复制提示词按钮
        document.getElementById('copy-prompt-btn').addEventListener('click', copyPrompt);

        // 重置按钮
        document.getElementById('reset-prompt-btn').addEventListener('click', resetPrompt);
    }

    // 切换标签页
    function switchTab(tab) {
        // 更新导航状态
        document.querySelectorAll('.layui-nav-item').forEach(item => {
            item.classList.remove('layui-this');
            if (item.getAttribute('data-tab') === tab) {
                item.classList.add('layui-this');
            }
        });

        // 切换内容显示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });

        if (tab === 'tools') {
            document.getElementById('tools-content').style.display = 'block';
        } else if (tab === 'prompts') {
            document.getElementById('prompts-content').style.display = 'block';
            // 切换到提示词标签时，才加载提示词数据
            loadPromptData();
        }

        // 重新渲染导航，确保下划线正确显示
        element.render('nav');
    }

    // 渲染网站卡片
    function renderWebsiteCards(websites) {
        const container = document.getElementById('website-cards');

        if (websites.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="layui-icon layui-icon-face-surprised"></i>
                    <p>没有找到相关网站</p>
                </div>
            `;
            return;
        }

        container.innerHTML = websites.map(site => `
            <div class="layui-col-md4 layui-col-sm6 layui-col-xs12">
                <div class="website-card" onclick="window.open('${site.url}', '_blank')">
                    <div class="card-header">
                        <img src="${site.icon}" alt="${site.title}" class="card-icon" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><rect width=%2232%22 height=%2232%22 fill=%22%23667eea%22/><text x=%2250%%22 y=%2250%%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2216%22>${site.title.charAt(0)}</svg>'">
                        <h3 class="card-title">${site.title}</h3>
                    </div>
                    <p class="card-description">${site.description}</p>
                    <div class="card-keywords">
                        ${site.keywords.map(keyword => `<span class="keyword-tag">${keyword}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 生成分类选项
    function generateCategories() {
        const categories = new Set();
        websitesData.forEach(site => {
            site.keywords.forEach(keyword => categories.add(keyword));
        });

        const select = document.getElementById('category-select');
        const currentOptions = select.innerHTML;
        const newOptions = Array.from(categories).map(cat =>
            `<option value="${cat}">${cat}</option>`
        ).join('');

        select.innerHTML = currentOptions + newOptions;

        // 重新渲染 LayUI 的 select 组件
        form.render('select');
    }

    // 执行搜索
    function performSearch() {
        currentSearchKeyword = document.getElementById('search-input').value.trim().toLowerCase();
        console.log('搜索关键词:', currentSearchKeyword);
        performFilter();
    }

    // 统一的筛选函数
    function performFilter() {
        let filtered = websitesData;

        // 先按分类筛选
        if (currentCategory) {
            filtered = filtered.filter(site =>
                site.keywords.includes(currentCategory)
            );
            console.log('按分类筛选后:', filtered.length, '个网站');
        }

        // 再按关键词搜索
        if (currentSearchKeyword) {
            filtered = filtered.filter(site => {
                return site.title.toLowerCase().includes(currentSearchKeyword) ||
                    site.description.toLowerCase().includes(currentSearchKeyword) ||
                    site.keywords.some(k => k.toLowerCase().includes(currentSearchKeyword));
            });
            console.log('按关键词筛选后:', filtered.length, '个网站');
        }

        console.log('最终筛选结果:', filtered.length, '个网站');
        renderWebsiteCards(filtered);
    }

    // 按分类筛选（已废弃，使用 performFilter 替代）
    function filterByCategory(category) {
        currentCategory = category;
        console.log('筛选分类:', category);
        performFilter();
    }

    // 渲染角色选项（只渲染名称列表）
    function renderRoles() {
        const container = document.getElementById('roles-container');
        container.innerHTML = roleNames.map((roleName, index) => `
            <div class="role-item" data-name="${roleName}">
                <div class="role-name">${roleName}</div>
            </div>
        `).join('');

        // 绑定点击事件
        container.querySelectorAll('.role-item').forEach(item => {
            item.addEventListener('click', async function () {
                const roleName = this.getAttribute('data-name');
                
                // 移除其他角色的选中状态
                container.querySelectorAll('.role-item').forEach(i => i.classList.remove('active'));
                // 添加当前角色的选中状态
                this.classList.add('active');
                
                // 禁用复制按钮，开始加载
                setLoadingState(true);
                
                // 按需加载角色内容
                const role = await loadRoleContent(roleName);
                if (role) {
                    selectedRole = role;
                    await updatePromptPreview();
                }
                
                // 加载完成，启用复制按钮
                setLoadingState(false);
            });
        });
    }

    // 渲染规则选项（只渲染名称列表）
    function renderRules() {
        const container = document.getElementById('rules-container');
        container.innerHTML = ruleNames.map((ruleName, index) => `
            <div class="rule-item" data-name="${ruleName}">
                <div class="rule-name">${ruleName}</div>
            </div>
        `).join('');

        // 绑定点击事件
        container.querySelectorAll('.rule-item').forEach(item => {
            item.addEventListener('click', async function () {
                const ruleName = this.getAttribute('data-name');
                
                // 切换选中状态
                this.classList.toggle('active');
                
                // 禁用复制按钮，开始加载
                setLoadingState(true);
                
                if (this.classList.contains('active')) {
                    // 按需加载规则内容
                    const rule = await loadRuleContent(ruleName);
                    if (rule && !selectedRules.find(r => r.name === rule.name)) {
                        selectedRules.push(rule);
                    }
                } else {
                    // 移除规则
                    selectedRules = selectedRules.filter(r => r.name !== ruleName);
                }
                
                await updatePromptPreview();
                
                // 加载完成，启用复制按钮
                setLoadingState(false);
            });
        });
    }

    // 设置加载状态（禁用/启用复制按钮）
    function setLoadingState(loading) {
        isLoadingPromptContent = loading;
        const copyBtn = document.getElementById('copy-prompt-btn');
        
        if (loading) {
            copyBtn.disabled = true;
            copyBtn.classList.add('layui-btn-disabled');
            copyBtn.innerHTML = '<i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i> 加载中...';
        } else {
            copyBtn.disabled = false;
            copyBtn.classList.remove('layui-btn-disabled');
            copyBtn.innerHTML = '<i class="layui-icon layui-icon-file"></i> 复制提示词';
        }
    }

    // 更新提示词预览
    async function updatePromptPreview() {
        let preview = '';

        if (isTemplateLoaded && promptTemplate) {
            // 使用模板渲染
            preview = promptTemplate;
            preview = preview.replace('{roles}', selectedRole ? selectedRole.content : '（请选择一个角色）');
            if (selectedRules.length > 0) {
                const rulesContent = selectedRules.map((rule, index) => `${index + 1}. ${rule.content}`).join('\n\n');
                preview = preview.replace('{rules}', rulesContent);
            } else {
                preview = preview.replace('{rules}', '（请选择规则）');
            }
        } else {
            // 模板未就绪，使用简易占位渲染，避免空白
            const rolePart = selectedRole ? selectedRole.content : '（请选择一个角色）';
            const rulesPart = selectedRules.length > 0
                ? selectedRules.map((rule, index) => `${index + 1}. ${rule.content}`).join('\n\n')
                : '（请选择规则）';
            preview = `【提示词模板加载中，已为你展示简易预览】\n\n---- 角色 ----\n${rolePart}\n\n---- 规则 ----\n${rulesPart}`;
        }

        document.getElementById('prompt-preview').value = preview;
    }

    // 复制提示词
    function copyPrompt() {
        // 正在加载内容或模板未就绪时，不允许复制
        if (isLoadingPromptContent) {
            layer.msg('正在加载内容，请稍候...', { icon: 16 });
            return;
        }
        if (!isTemplateLoaded) {
            layer.msg('提示词模板正在加载，请稍候...', { icon: 16 });
            return;
        }

        const preview = document.getElementById('prompt-preview');
        const text = preview.value;

        if (!selectedRole) {
            layer.msg('请先选择一个角色', { icon: 0 });
            return;
        }

        if (selectedRules.length === 0) {
            layer.msg('请至少选择一个规则', { icon: 0 });
            return;
        }

        // 复制到剪贴板
        preview.select();
        try {
            document.execCommand('copy');
            layer.msg('提示词已复制到剪贴板', { icon: 1 });
        } catch (err) {
            // 使用现代 API
            navigator.clipboard.writeText(text).then(() => {
                layer.msg('提示词已复制到剪贴板', { icon: 1 });
            }).catch(() => {
                layer.msg('复制失败，请手动复制', { icon: 2 });
            });
        }
    }

    // 重置提示词选择
    function resetPrompt() {
        // 清除角色选择
        document.querySelectorAll('.role-item').forEach(item => {
            item.classList.remove('active');
        });
        selectedRole = null;

        // 清除规则选择
        document.querySelectorAll('.rule-item').forEach(item => {
            item.classList.remove('active');
        });
        selectedRules = [];

        // 更新预览
        updatePromptPreview();
        
        // 确保复制按钮恢复正常状态
        setLoadingState(false);

        layer.msg('已重置选择', { icon: 1 });
    }
});
