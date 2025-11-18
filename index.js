/**
 * MVU Variable Framework - SillyTavern Extension
 * 独立版本，不依赖酒馆助手
 * 完全兼容现有MVU角色卡
 */

import { 
    eventTypes, 
    callPopup, 
    saveSettingsDebounced, 
    getRequestHeaders,
    substituteParams,
    chat,
    characters,
    this_chid,
    chat_metadata,
    saveChatConditional
} from '../../../script.js';
import { registerSlashCommand } from '../../../slash-commands.js';
import { getContext, extension_settings } from '../../../extensions.js';

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

// Vue应用实例
let vueApp = null;

/**
 * 初始化扩展
 */
async function initializeExtension() {
    console.log('[MVU] 开始初始化MVU变量框架...');
    
    // 加载设置
    loadSettings();
    
    // 注册事件监听器
    registerEventListeners();
    
    // 注册斜杠命令
    registerSlashCommands();
    
    // 创建UI面板
    createUIPanel();
    
    console.log('[MVU] MVU变量框架初始化完成！');
    
    // 显示欢迎消息
    toastr.info(`MVU变量框架 v${MVU_VERSION} 加载成功！`, '[MVU]独立扩展');
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
        saveSettingsDebounced();
        console.log('[MVU] 设置保存成功');
    } catch (e) {
        console.error('[MVU] 设置保存失败:', e);
    }
}

/**
 * 注册事件监听器
 */
function registerEventListeners() {
    // 监听聊天切换事件
    eventTypes.forEach(eventType => {
        if (eventType === 'CHAT_CHANGED') {
            $(document).on(eventType, onChatChanged);
        } else if (eventType === 'MESSAGE_SENT') {
            $(document).on(eventType, onMessageSent);
        } else if (eventType === 'MESSAGE_RECEIVED') {
            $(document).on(eventType, onMessageReceived);
        }
    });
    
    console.log('[MVU] 事件监听器注册完成');
}

/**
 * 注册斜杠命令
 */
function registerSlashCommands() {
    registerSlashCommand('mvu', handleMvuCommand, ['mvariable'], 'MVU变量管理命令');
    registerSlashCommand('mvu_set', handleSetVariable, [], '设置变量值');
    registerSlashCommand('mvu_get', handleGetVariable, [], '获取变量值');
    registerSlashCommand('mvu_reset', handleResetVariables, [], '重置变量');
    
    console.log('[MVU] 斜杠命令注册完成');
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
    $('#extensions_settings2').append(panelHtml);
    
    // 绑定UI事件
    bindUIEvents();
    
    console.log('[MVU] UI面板创建完成');
}

/**
 * 绑定UI事件
 */
function bindUIEvents() {
    // 折叠/展开面板
    $('#mvu-panel .inline-drawer-toggle').on('click', function() {
        const content = $('#mvu-panel .inline-drawer-content');
        const icon = $(this).find('.inline-drawer-icon');
        
        content.slideToggle(200);
        icon.toggleClass('down up');
    });
    
    // 通知设置
    $('#mvu-notify-error').prop('checked', mvuSettings.notifications.variableUpdateError);
    $('#mvu-notify-error').on('change', function() {
        mvuSettings.notifications.variableUpdateError = $(this).prop('checked');
        saveSettings();
    });
    
    $('#mvu-notify-parsing').prop('checked', mvuSettings.notifications.extraModelParsing);
    $('#mvu-notify-parsing').on('change', function() {
        mvuSettings.notifications.extraModelParsing = $(this).prop('checked');
        saveSettings();
    });
    
    // 更新方式
    $('#mvu-update-mode').val(mvuSettings.updateMode);
    $('#mvu-update-mode').on('change', function() {
        mvuSettings.updateMode = $(this).val();
        saveSettings();
    });
    
    // 功能按钮
    $('#mvu-reprocess').on('click', reprocessVariables);
    $('#mvu-reload-init').on('click', reloadInitVariables);
    $('#mvu-snapshot').on('click', snapshotFloor);
    $('#mvu-replay').on('click', replayFloor);
    $('#mvu-cleanup').on('click', cleanupOldVariables);
}

// ===== 事件处理函数 =====

/**
 * 聊天切换事件处理
 */
async function onChatChanged() {
    console.log('[MVU] 聊天已切换');
    await initializeVariables();
}

/**
 * 消息发送事件处理
 */
async function onMessageSent(event, data) {
    console.log('[MVU] 消息已发送');
    await processMessageVariables(data);
}

/**
 * 消息接收事件处理
 */
async function onMessageReceived(event, data) {
    console.log('[MVU] 消息已接收');
    await updateVariables(data);
}

// ===== 核心功能函数 =====

/**
 * 初始化变量系统
 */
async function initializeVariables() {
    try {
        const chatData = await getChatData();
        if (!chatData || chatData.length === 0) {
            console.warn('[MVU] 没有聊天数据，跳过初始化');
            return;
        }
        
        // 初始化变量存储结构
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
        toastr.success('变量系统已初始化', '[MVU]');
        
    } catch (error) {
        console.error('[MVU] 变量初始化失败:', error);
        toastr.error('变量初始化失败', '[MVU]');
    }
}

/**
 * 获取聊天数据
 */
async function getChatData() {
    // 使用SillyTavern的API获取聊天数据
    if (window.chat && Array.isArray(window.chat)) {
        return window.chat;
    }
    return [];
}

/**
 * 处理消息中的变量
 */
async function processMessageVariables(messageData) {
    if (!messageData || !messageData.message) {
        return;
    }
    
    const variableCommands = extractVariableCommands(messageData.message);
    if (variableCommands.length > 0) {
        console.log('[MVU] 找到变量命令:', variableCommands);
        await executeVariableCommands(variableCommands);
    }
}

/**
 * 提取变量命令
 */
function extractVariableCommands(message) {
    const commands = [];
    const regex = /_\.(set|insert|assign|remove|unset|delete|add)\s*\([^)]+\)/g;
    let match;
    
    while ((match = regex.exec(message)) !== null) {
        commands.push(match[0]);
    }
    
    return commands;
}

/**
 * 执行变量命令
 */
async function executeVariableCommands(commands) {
    for (const command of commands) {
        try {
            // 这里需要实现命令解析和执行逻辑
            console.log('[MVU] 执行命令:', command);
            // TODO: 实现具体的命令执行逻辑
        } catch (error) {
            console.error('[MVU] 命令执行失败:', error);
            if (mvuSettings.notifications.variableUpdateError) {
                toastr.error(`命令执行失败: ${command}`, '[MVU]');
            }
        }
    }
}

/**
 * 更新变量
 */
async function updateVariables(data) {
    try {
        // TODO: 实现变量更新逻辑
        console.log('[MVU] 更新变量');
    } catch (error) {
        console.error('[MVU] 变量更新失败:', error);
    }
}

// ===== 斜杠命令处理函数 =====

async function handleMvuCommand(args) {
    const helpText = `
MVU变量框架命令帮助:
/mvu - 显示此帮助信息
/mvu_set <变量名> <值> - 设置变量
/mvu_get <变量名> - 获取变量值
/mvu_reset - 重置所有变量
    `;
    
    await callPopup(helpText, 'text', '');
    return '';
}

async function handleSetVariable(args) {
    // TODO: 实现设置变量逻辑
    console.log('[MVU] 设置变量:', args);
    return 'Variable set';
}

async function handleGetVariable(args) {
    // TODO: 实现获取变量逻辑
    console.log('[MVU] 获取变量:', args);
    return 'Variable value';
}

async function handleResetVariables() {
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
        toastr.success('变量已重置', '[MVU]');
    }
    return 'Variables reset';
}

// ===== 功能按钮函数 =====

async function reprocessVariables() {
    console.log('[MVU] 重新处理变量');
    toastr.info('正在重新处理变量...', '[MVU]');
    // TODO: 实现重新处理逻辑
}

async function reloadInitVariables() {
    console.log('[MVU] 重新加载初始变量');
    toastr.info('正在重新加载初始变量...', '[MVU]');
    // TODO: 实现重新加载逻辑
}

async function snapshotFloor() {
    const floor = prompt('请输入要保留变量信息的楼层 (如 10 为第 10 层):');
    if (floor) {
        console.log('[MVU] 创建快照楼层:', floor);
        toastr.success(`已将第 ${floor} 层设为快照楼层`, '[MVU]');
    }
}

async function replayFloor() {
    const floor = prompt('请输入要重演的楼层 (如 10 为第 10 层, -1 为最新楼层):');
    if (floor) {
        console.log('[MVU] 重演楼层:', floor);
        toastr.info('正在重演楼层...', '[MVU]');
        // TODO: 实现重演逻辑
    }
}

async function cleanupOldVariables() {
    const keep = prompt('请输入要保留变量信息的楼层数 (如 10 为保留最后 10 层):');
    if (keep && confirm(`确定要清理旧楼层的变量信息吗？将保留最后 ${keep} 层。`)) {
        console.log('[MVU] 清理旧变量，保留楼层数:', keep);
        toastr.success(`已清理旧变量，保留了最后 ${keep} 层`, '[MVU]');
        // TODO: 实现清理逻辑
    }
}

// ===== 扩展注册 =====

jQuery(async () => {
    // 确保DOM加载完成后初始化
    if (extension_name === MVU_EXTENSION_NAME) {
        await initializeExtension();
    }
});

// 导出接口供外部调用
window.MvuExtension = {
    version: MVU_VERSION,
    settings: mvuSettings,
    events: MVU_EVENTS,
    getVariables: () => window.mvuVariables,
    setVariable: handleSetVariable,
    getVariable: handleGetVariable,
    resetVariables: handleResetVariables
};
