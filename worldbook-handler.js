/**
 * MVU世界书处理模块
 * 处理世界书中的初始变量和变量更新规则
 */

class WorldbookHandler {
    constructor() {
        this.initialized = false;
        this.initializedLorebooks = {};
    }
    
    /**
     * 扫描并加载世界书中的InitVar条目
     */
    async scanWorldbookForInitVar() {
        console.log('[MVU] 扫描世界书中的InitVar条目...');
        
        try {
            // 获取当前激活的世界书
            const worldbooks = await this.getActiveWorldbooks();
            let hasInitVar = false;
            
            for (const worldbook of worldbooks) {
                // 检查是否已初始化过
                if (this.initializedLorebooks[worldbook.name]) {
                    continue;
                }
                
                const entries = await this.getWorldbookEntries(worldbook.name);
                
                for (const entry of entries) {
                    // 检查条目注释中是否包含[initvar]标记
                    if (entry.comment && entry.comment.toLowerCase().includes('[initvar]')) {
                        console.log(`[MVU] 找到InitVar条目: ${entry.comment}`);
                        
                        // 解析条目内容
                        const initData = await this.parseInitVarContent(entry.content);
                        if (initData) {
                            // 合并到变量系统
                            await this.mergeInitVarData(initData);
                            hasInitVar = true;
                        }
                    }
                }
                
                // 标记该世界书已处理
                this.initializedLorebooks[worldbook.name] = true;
            }
            
            if (hasInitVar) {
                toastr.success('世界书初始变量加载成功', '[MVU]');
            }
            
            return hasInitVar;
            
        } catch (error) {
            console.error('[MVU] 扫描世界书失败:', error);
            return false;
        }
    }
    
    /**
     * 解析InitVar内容
     */
    async parseInitVarContent(content) {
        // 替换宏
        content = substituteParams(content);
        
        let parsedData = null;
        
        // 尝试多种格式解析
        // 1. 尝试YAML
        try {
            if (typeof YAML !== 'undefined') {
                parsedData = YAML.parse(content);
            }
        } catch (e) {
            console.log('[MVU] 不是YAML格式，尝试其他格式');
        }
        
        // 2. 尝试JSON5
        if (!parsedData) {
            try {
                parsedData = JSON5.parse(content);
            } catch (e) {
                console.log('[MVU] 不是JSON5格式，尝试其他格式');
            }
        }
        
        // 3. 尝试标准JSON
        if (!parsedData) {
            try {
                parsedData = JSON.parse(content);
            } catch (e) {
                console.log('[MVU] 不是JSON格式');
            }
        }
        
        // 4. 尝试TOML
        if (!parsedData) {
            try {
                if (typeof toml !== 'undefined') {
                    parsedData = toml.parse(content);
                }
            } catch (e) {
                console.error('[MVU] 无法解析InitVar内容:', e);
            }
        }
        
        return parsedData;
    }
    
    /**
     * 合并InitVar数据到变量系统
     */
    async mergeInitVarData(initData) {
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
        
        // 深度合并数据
        window.mvuVariables.stat_data = this.deepMerge(
            window.mvuVariables.stat_data,
            initData
        );
        
        console.log('[MVU] InitVar数据已合并:', initData);
    }
    
    /**
     * 深度合并对象
     */
    deepMerge(target, source) {
        const output = Object.assign({}, target);
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    }
    
    /**
     * 判断是否为对象
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
    
    /**
     * 获取激活的世界书
     */
    async getActiveWorldbooks() {
        try {
            // 从聊天元数据获取世界书信息
            const metadata = chat_metadata || {};
            const worldbooks = [];
            
            // 获取角色世界书
            if (metadata.world_info) {
                worldbooks.push({
                    name: metadata.world_info,
                    type: 'character'
                });
            }
            
            // 获取全局世界书
            if (metadata.global_lore) {
                metadata.global_lore.forEach(wb => {
                    worldbooks.push({
                        name: wb,
                        type: 'global'
                    });
                });
            }
            
            return worldbooks;
            
        } catch (error) {
            console.error('[MVU] 获取世界书失败:', error);
            return [];
        }
    }
    
    /**
     * 获取世界书条目
     */
    async getWorldbookEntries(worldbookName) {
        try {
            // 尝试从世界书API获取条目
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ name: worldbookName })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.entries || [];
            }
            
        } catch (error) {
            console.error(`[MVU] 获取世界书条目失败 (${worldbookName}):`, error);
        }
        
        return [];
    }
    
    /**
     * 处理UpdateVariable块
     */
    parseUpdateVariableBlock(message) {
        const blocks = [];
        const regex = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/g;
        let match;
        
        while ((match = regex.exec(message)) !== null) {
            const content = match[1];
            
            // 提取分析部分（如果有）
            let analysis = '';
            const analysisMatch = content.match(/<Analy[sz]e?>([\s\S]*?)<\/Analy[sz]e?>/i);
            if (analysisMatch) {
                analysis = analysisMatch[1].trim();
            }
            
            // 提取变量命令
            const commands = content.replace(/<Analy[sz]e?>[\s\S]*?<\/Analy[sz]e?>/i, '').trim();
            
            blocks.push({
                analysis,
                commands,
                fullMatch: match[0]
            });
        }
        
        return blocks;
    }
    
    /**
     * 处理变量宏替换
     */
    substituteVariableMacros(text) {
        // 替换 {{get_message_variable::xxx}} 格式
        text = text.replace(/\{\{get_message_variable::(\w+)\}\}/g, (match, varName) => {
            if (window.mvuVariables && window.mvuVariables[varName]) {
                return JSON.stringify(window.mvuVariables[varName]);
            }
            return match;
        });
        
        // 替换 <%= getvar('xxx') %> 格式
        text = text.replace(/<%=\s*getvar\(['"](\w+)['"]\)\s*%>/g, (match, varName) => {
            if (window.mvuVariables && window.mvuVariables[varName]) {
                return JSON.stringify(window.mvuVariables[varName]);
            }
            return match;
        });
        
        return text;
    }
    
    /**
     * 检查世界书条目的MVU标记
     */
    checkWorldbookMvuTags(entries) {
        const result = {
            hasPlotOnly: false,
            hasUpdateOnly: false,
            hasMixed: false
        };
        
        for (const entry of entries) {
            if (entry.comment) {
                const comment = entry.comment.toLowerCase();
                
                if (comment.includes('[mvu_plot]')) {
                    result.hasPlotOnly = true;
                } else if (comment.includes('[mvu_update]')) {
                    result.hasUpdateOnly = true;
                } else {
                    result.hasMixed = true;
                }
            }
        }
        
        return result;
    }
    
    /**
     * 初始化世界书处理器
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        
        console.log('[MVU] 初始化世界书处理器');
        
        // 监听世界书加载事件
        $(document).on('worldInfoLoaded', async () => {
            await this.scanWorldbookForInitVar();
        });
        
        // 初始扫描
        await this.scanWorldbookForInitVar();
        
        this.initialized = true;
    }
}

// 导出处理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldbookHandler;
} else {
    window.WorldbookHandler = WorldbookHandler;
}
