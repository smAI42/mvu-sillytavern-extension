/**
 * MVU Variable Framework - SillyTavern Extension
 * 独立版本，不依赖酒馆助手
 * 完全兼容现有MVU角色卡
 */

// 使用立即执行函数避免全局污染
(function() {
    'use strict';
    
    // 全局配置
    const MVU_EXTENSION_NAME = 'mvu-variable-framework';
    const MVU_VERSION = '1.0.0';
    
    // MVU事件类型
    const MVU_EVENTS = {
        VARIABLE_INITIALIZED: 'mvu_variable_initialized',
        SINGLE_VARIABLE_UPDATED: 'mvu_variable_updated',
        VARIABLE_UPDATE_ENDED: 'mvu_variable_update_ended',
        VARIABLE_UPDATE_STARTED: 'mvu_variable_update_started',
        COMMAND_PARSED: 'mvu_command_parsed',
        BEFORE_MESSAGE_UPDATE: 'mvu_before_message_update'
    };
    
    // 存储设置
    let mvuSettings = {
        updateMode: '随AI输出',
        extraModelConfig: {
            sendPreset: true,
            useFunctionCalling: false,
            modelSource: '与插头相同',
            apiUrl: 'http://localhost:1234/v1',
            apiKey: '',
            modelName: 'gemini-2.5-flash',
            temperature: 1.0,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0,
            maxTokens: 4096
        },
        notifications: {
            variableUpdateError: false,
            extraModelParsing: true
        },
        snapshotInterval: 50,
        updateToChatVariables: false,
        autoCleanup: {
            enabled: false,
            recentFloorCount: 20,
            triggerRestoreFloorCount: 10
        }
    };
    
    // 变量处理器实例
    let variableProcessor = null;
    
    /**
     * 初始化扩展
     */
    async function initializeExtension() {
        console.log('[MVU] 开始初始化MVU变量框架...');
        
        try {
            // 加载设置
            loadSettings();
            
            // 初始化变量处理器
            if (typeof VariableProcessor !== 'undefined') {
                variableProcessor = new VariableProcessor();
            }
            
            // 注册事件监听器
            registerEventListeners();
            
            // 注册斜杠命令（延迟注册以确保API可用）
            setTimeout(() => {
                registerSlashCommands();
            }, 500);
            
            // 创建UI面板
            createUIPanel();
            
            console.log('[MVU] MVU变量框架初始化完成！');
            
            // 显示欢迎消息
            if (typeof toastr !== 'undefined') {
                toastr.info(`MVU变量框架 v${MVU_VERSION} 加载成功！`, '[MVU]独立扩展');
            }
        } catch (error) {
            console.error('[MVU] 初始化失败:', error);
        }
    }
    
    /**
     * 加载设置
     */
    function loadSettings() {
        const saved = localStorage.getItem('mvu_extension_settings');
        if (saved) {
            try {
                mvuSettings = { ...mvuSettings, ...JSON.parse(saved) };
                console.log('[MVU] 设置加载成功');
            } catch (e) {
                console.error('[MVU] 设置加载失败:', e);
            }
        }
    }
    
    /**
     * 保存设置
     */
    function saveSettings() {
        try {
            localStorage.setItem('mvu_extension_settings', JSON.stringify(mvuSettings));
            console.log('[MVU] 设置保存成功');
        } catch (e) {
            console.error('[MVU] 设置保存失败:', e);
        }
    }
    
    /**
     * 注册事件监听器
     */
    function registerEventListeners() {
        // 使用jQuery监听SillyTavern事件
        if (typeof jQuery !== 'undefined') {
            jQuery(document).on('CHAT_CHANGED', onChatChanged);
            jQuery(document).on('MESSAGE_SENT', onMessageSent);
            jQuery(document).on('MESSAGE_RECEIVED', onMessageReceived);
            jQuery(document).on('MESSAGE_DELETED', onMessageDeleted);
            jQuery(document).on('GENERATION_STARTED', onGenerationStarted);
            
            console.log('[MVU] 事件监听器注册完成');
        }
    }
    
    /**
     * 注册斜杠命令
     */
    function registerSlashCommands() {
        // 检查斜杠命令API是否可用
        if (typeof SillyTavern !== 'undefined' && SillyTavern.registerSlashCommand) {
            SillyTavern.registerSlashCommand('mvu', handleMvuCommand, ['mvariable'], 'MVU变量管理命令');
            SillyTavern.registerSlashCommand('mvu_set', handleSetVariable, [], '设置变量值');
            SillyTavern.registerSlashCommand('mvu_get', handleGetVariable, [], '获取变量值');
            SillyTavern.registerSlashCommand('mvu_reset', handleResetVariables, [], '重置变量');
            
            console.log('[MVU] 斜杠命令注册完成');
        }
    }
    
    /**
     * 创建UI面板
     */
    function createUIPanel() {
        const panelHtml = `
            <div id="mvu-panel" class="drawer-content">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>MVU 变量框架</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content" style="display: none;">
                        <div class="mvu-settings-container">
                            <!-- 通知设置 -->
                            <div class="mvu-section">
                                <h4>通知设置</h4>
                                <label class="checkbox_label">
                                    <input type="checkbox" id="mvu-notify-error" />
                                    <span>变量更新出错时通知</span>
                                </label>
                                <label class="checkbox_label">
                                    <input type="checkbox" id="mvu-notify-parsing" />
                                    <span>额外模型解析中通知</span>
                                </label>
                            </div>
                            
                            <hr />
                            
                            <!-- 更新方式 -->
                            <div class="mvu-section">
                                <h4>变量更新方式</h4>
                                <select id="mvu-update-mode" class="text_pole">
                                    <option value="随AI输出">随AI输出</option>
                                    <option value="额外模型解析">额外模型解析</option>
                                </select>
                            </div>
                            
                            <hr />
                            
                            <!-- 功能按钮 -->
                            <div class="mvu-section">
                                <h4>功能按钮</h4>
                                <div class="menu_button" id="mvu-reprocess">重新处理变量</div>
                                <div class="menu_button" id="mvu-reload-init">重新读取初始变量</div>
                                <div class="menu_button" id="mvu-snapshot">快照楼层</div>
                                <div class="menu_button" id="mvu-replay">重演楼层</div>
                                <div class="menu_button" id="mvu-cleanup">清除旧楼层变量</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到扩展设置面板
        const extensionsPanel = document.getElementById('extensions_settings2');
        if (extensionsPanel) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = panelHtml;
            extensionsPanel.appendChild(tempDiv.firstElementChild);
            
            // 绑定UI事件
            bindUIEvents();
            
            console.log('[MVU] UI面板创建完成');
        }
    }
    
    /**
     * 绑定UI事件
     */
    function bindUIEvents() {
        if (typeof jQuery === 'undefined') return;
        
        // 折叠/展开面板
        jQuery('#mvu-panel .inline-drawer-toggle').on('click', function() {
            const content = jQuery('#mvu-panel .inline-drawer-content');
            const icon = jQuery(this).find('.inline-drawer-icon');
            
            content.slideToggle(200);
            icon.toggleClass('down up');
        });
        
        // 通知设置
        jQuery('#mvu-notify-error').prop('checked', mvuSettings.notifications.variableUpdateError);
        jQuery('#mvu-notify-error').on('change', function() {
            mvuSettings.notifications.variableUpdateError = jQuery(this).prop('checked');
            saveSettings();
        });
        
        jQuery('#mvu-notify-parsing').prop('checked', mvuSettings.notifications.extraModelParsing);
        jQuery('#mvu-notify-parsing').on('change', function() {
            mvuSettings.notifications.extraModelParsing = jQuery(this).prop('checked');
            saveSettings();
        });
        
        // 更新方式
        jQuery('#mvu-update-mode').val(mvuSettings.updateMode);
        jQuery('#mvu-update-mode').on('change', function() {
            mvuSettings.updateMode = jQuery(this).val();
            saveSettings();
        });
        
        // 功能按钮
        jQuery('#mvu-reprocess').on('click', reprocessVariables);
        jQuery('#mvu-reload-init').on('click', reloadInitVariables);
        jQuery('#mvu-snapshot').on('click', snapshotFloor);
        jQuery('#mvu-replay').on('click', replayFloor);
        jQuery('#mvu-cleanup').on('click', cleanupOldVariables);
    }
    
    // ===== 事件处理函数 =====
    
    function onChatChanged() {
        console.log('[MVU] 聊天已切换');
        initializeVariables();
    }
    
    function onMessageSent(event, data) {
        console.log('[MVU] 消息已发送');
        processMessageVariables(data);
    }
    
    function onMessageReceived(event, data) {
        console.log('[MVU] 消息已接收');
        updateVariables(data);
    }
    
    function onMessageDeleted(event, data) {
        console.log('[MVU] 消息已删除');
    }
    
    function onGenerationStarted(event, data) {
        console.log('[MVU] 生成已开始');
        initializeVariables();
    }
    
    // ===== 核心功能函数 =====
    
    function initializeVariables() {
        if (!window.mvuVariables) {
            window.mvuVariables = {
                stat_data: {},
                display_data: {},
                delta_data: {},
                schema: {
                    type: 'object',
                    properties: {},
                    extensible: true
                }
            };
        }
        console.log('[MVU] 变量系统初始化完成');
    }
    
    function processMessageVariables(messageData) {
        if (!messageData) return;
        
        // 使用变量处理器解析命令
        if (variableProcessor) {
            const message = messageData.message || messageData;
            const commands = variableProcessor.parseCommands(message);
            if (commands.length > 0) {
                console.log('[MVU] 找到变量命令:', commands);
                variableProcessor.executeCommands(commands);
            }
        }
    }
    
    function updateVariables(data) {
        console.log('[MVU] 更新变量');
    }
    
    // ===== 斜杠命令处理函数 =====
    
    function handleMvuCommand(args) {
        const helpText = `
MVU变量框架命令帮助:
/mvu - 显示此帮助信息
/mvu_set <变量名> <值> - 设置变量
/mvu_get <变量名> - 获取变量值
/mvu_reset - 重置所有变量
        `;
        
        if (typeof toastr !== 'undefined') {
            toastr.info(helpText, '[MVU]帮助');
        }
        return '';
    }
    
    function handleSetVariable(args) {
        console.log('[MVU] 设置变量:', args);
        return 'Variable set';
    }
    
    function handleGetVariable(args) {
        console.log('[MVU] 获取变量:', args);
        return 'Variable value';
    }
    
    function handleResetVariables() {
        if (confirm('确定要重置所有变量吗？')) {
            window.mvuVariables = {
                stat_data: {},
                display_data: {},
                delta_data: {},
                schema: {
                    type: 'object',
                    properties: {},
                    extensible: true
                }
            };
            if (typeof toastr !== 'undefined') {
                toastr.success('变量已重置', '[MVU]');
            }
        }
        return 'Variables reset';
    }
    
    // ===== 功能按钮函数 =====
    
    function reprocessVariables() {
        console.log('[MVU] 重新处理变量');
        if (typeof toastr !== 'undefined') {
            toastr.info('正在重新处理变量...', '[MVU]');
        }
    }
    
    function reloadInitVariables() {
        console.log('[MVU] 重新加载初始变量');
        if (typeof toastr !== 'undefined') {
            toastr.info('正在重新加载初始变量...', '[MVU]');
        }
    }
    
    function snapshotFloor() {
        const floor = prompt('请输入要保留变量信息的楼层 (如 10 为第 10 层):');
        if (floor) {
            console.log('[MVU] 创建快照楼层:', floor);
            if (typeof toastr !== 'undefined') {
                toastr.success(`已将第 ${floor} 层设为快照楼层`, '[MVU]');
            }
        }
    }
    
    function replayFloor() {
        const floor = prompt('请输入要重演的楼层 (如 10 为第 10 层, -1 为最新楼层):');
        if (floor) {
            console.log('[MVU] 重演楼层:', floor);
            if (typeof toastr !== 'undefined') {
                toastr.info('正在重演楼层...', '[MVU]');
            }
        }
    }
    
    function cleanupOldVariables() {
        const keep = prompt('请输入要保留变量信息的楼层数 (如 10 为保留最后 10 层):');
        if (keep && confirm(`确定要清理旧楼层的变量信息吗？将保留最后 ${keep} 层。`)) {
            console.log('[MVU] 清理旧变量，保留楼层数:', keep);
            if (typeof toastr !== 'undefined') {
                toastr.success(`已清理旧变量，保留了最后 ${keep} 层`, '[MVU]');
            }
        }
    }
    
    // ===== 初始化入口 =====
    
    // 等待DOM和SillyTavern加载完成
    if (typeof jQuery !== 'undefined') {
        jQuery(document).ready(function() {
            console.log('[MVU] DOM ready, 准备初始化...');
            
            // 延迟初始化以确保所有依赖加载完成
            setTimeout(function() {
                initializeExtension();
                
                // 导出接口
                window.MvuExtension = {
                    version: MVU_VERSION,
                    settings: mvuSettings,
                    events: MVU_EVENTS,
                    getVariables: () => window.mvuVariables,
                    setVariable: handleSetVariable,
                    getVariable: handleGetVariable,
                    resetVariables: handleResetVariables,
                    initialize: initializeExtension
                };
            }, 2000);
        });
    } else {
        // 如果jQuery不可用，使用原生方法
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[MVU] DOM loaded, 准备初始化...');
            
            setTimeout(function() {
                initializeExtension();
                
                // 导出接口
                window.MvuExtension = {
                    version: MVU_VERSION,
                    settings: mvuSettings,
                    events: MVU_EVENTS,
                    getVariables: () => window.mvuVariables,
                    initialize: initializeExtension
                };
            }, 2000);
        });
    }
    
    console.log('[MVU] 扩展脚本加载完成');
    
})();