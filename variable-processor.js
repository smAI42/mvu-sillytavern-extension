/**
 * MVU变量处理器模块
 * 处理变量的解析、更新和存储
 */

class VariableProcessor {
    constructor() {
        this.variables = {
            stat_data: {},
            display_data: {},
            delta_data: {},
            schema: {
                type: 'object',
                properties: {},
                extensible: true,
                strictTemplate: false,
                strictSet: false,
                concatTemplateArray: true
            },
            initialized_lorebooks: {}
        };
        
        this.commandQueue = [];
        this.processingLock = false;
    }
    
    /**
     * 解析变量命令
     * @param {string} text - 包含变量命令的文本
     * @returns {Array} 解析出的命令列表
     */
    parseCommands(text) {
        const commands = [];
        const regex = /_\.(set|insert|assign|remove|unset|delete|add)\s*\(/g;
        let match;
        let lastIndex = 0;
        
        while ((match = regex.exec(text)) !== null) {
            const startPos = match.index;
            const commandType = match[1];
            
            // 找到匹配的右括号
            const endPos = this.findMatchingParenthesis(text, startPos + match[0].length - 1);
            if (endPos === -1) continue;
            
            // 查找分号和注释
            let commandEnd = endPos + 1;
            if (text[commandEnd] === ';') {
                commandEnd++;
                
                // 查找注释
                const commentMatch = text.substring(commandEnd).match(/^\s*\/\/(.*?)(\n|$)/);
                if (commentMatch) {
                    const comment = commentMatch[1].trim();
                    commandEnd += commentMatch[0].length;
                    
                    commands.push({
                        type: commandType,
                        fullMatch: text.substring(startPos, commandEnd),
                        args: this.parseArguments(text.substring(startPos + match[0].length, endPos)),
                        reason: comment
                    });
                } else {
                    commands.push({
                        type: commandType,
                        fullMatch: text.substring(startPos, commandEnd),
                        args: this.parseArguments(text.substring(startPos + match[0].length, endPos)),
                        reason: ''
                    });
                }
            }
        }
        
        return commands;
    }
    
    /**
     * 找到匹配的右括号
     */
    findMatchingParenthesis(text, startPos) {
        let depth = 1;
        let inString = false;
        let stringChar = '';
        
        for (let i = startPos + 1; i < text.length; i++) {
            const char = text[i];
            const prevChar = i > 0 ? text[i - 1] : '';
            
            // 处理字符串
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
            
            if (!inString) {
                if (char === '(') depth++;
                else if (char === ')') {
                    depth--;
                    if (depth === 0) return i;
                }
            }
        }
        
        return -1;
    }
    
    /**
     * 解析函数参数
     */
    parseArguments(argsString) {
        const args = [];
        let current = '';
        let inString = false;
        let stringChar = '';
        let depth = { paren: 0, bracket: 0, brace: 0 };
        
        for (let i = 0; i < argsString.length; i++) {
            const char = argsString[i];
            const prevChar = i > 0 ? argsString[i - 1] : '';
            
            // 处理字符串
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
            
            if (!inString) {
                // 处理括号深度
                if (char === '(') depth.paren++;
                else if (char === ')') depth.paren--;
                else if (char === '[') depth.bracket++;
                else if (char === ']') depth.bracket--;
                else if (char === '{') depth.brace++;
                else if (char === '}') depth.brace--;
                
                // 在顶层遇到逗号时分割参数
                if (char === ',' && depth.paren === 0 && depth.bracket === 0 && depth.brace === 0) {
                    args.push(current.trim());
                    current = '';
                    continue;
                }
            }
            
            current += char;
        }
        
        if (current.trim()) {
            args.push(current.trim());
        }
        
        return args;
    }
    
    /**
     * 执行变量命令
     */
    async executeCommand(command) {
        const { type, args, reason } = command;
        
        try {
            switch (type) {
                case 'set':
                    return await this.executeSet(args, reason);
                case 'insert':
                case 'assign':
                    return await this.executeInsert(args, reason);
                case 'remove':
                case 'unset':
                case 'delete':
                    return await this.executeRemove(args, reason);
                case 'add':
                    return await this.executeAdd(args, reason);
                default:
                    throw new Error(`Unknown command type: ${type}`);
            }
        } catch (error) {
            console.error(`[MVU] Command execution error:`, error);
            throw error;
        }
    }
    
    /**
     * 执行set命令
     */
    async executeSet(args, reason) {
        if (args.length < 2) {
            throw new Error('Set command requires at least 2 arguments');
        }
        
        const path = this.parseVariablePath(args[0]);
        const value = this.parseValue(args.length >= 3 ? args[2] : args[1]);
        
        // 获取当前值
        const oldValue = this.getVariable(path);
        
        // 设置新值
        this.setVariable(path, value);
        
        // 记录变化
        this.recordDelta(path, oldValue, value, reason);
        
        console.log(`[MVU] Set '${path}' to '${JSON.stringify(value)}' ${reason ? `(${reason})` : ''}`);
        
        return { path, oldValue, newValue: value, reason };
    }
    
    /**
     * 执行insert/assign命令
     */
    async executeInsert(args, reason) {
        const path = args.length > 0 ? this.parseVariablePath(args[0]) : '';
        
        if (args.length === 2) {
            // 插入到数组或合并到对象
            const value = this.parseValue(args[1]);
            const target = path ? this.getVariable(path) : this.variables.stat_data;
            
            if (Array.isArray(target)) {
                target.push(value);
                console.log(`[MVU] Inserted ${JSON.stringify(value)} into array '${path}'`);
            } else if (typeof target === 'object' && target !== null) {
                Object.assign(target, value);
                console.log(`[MVU] Merged ${JSON.stringify(value)} into object '${path}'`);
            } else {
                // 创建新的对象或数组
                const newValue = Array.isArray(value) ? [value] : { ...value };
                this.setVariable(path, newValue);
                console.log(`[MVU] Created new container at '${path}'`);
            }
        } else if (args.length >= 3) {
            // 插入到特定位置或键
            const key = this.parseValue(args[1]);
            const value = this.parseValue(args[2]);
            const target = path ? this.getVariable(path) : this.variables.stat_data;
            
            if (Array.isArray(target) && typeof key === 'number') {
                target.splice(key, 0, value);
                console.log(`[MVU] Inserted ${JSON.stringify(value)} at index ${key} in '${path}'`);
            } else if (typeof target === 'object') {
                target[String(key)] = value;
                console.log(`[MVU] Set key '${key}' to ${JSON.stringify(value)} in '${path}'`);
            }
        }
        
        return { path, reason };
    }
    
    /**
     * 执行remove/delete命令
     */
    async executeRemove(args, reason) {
        if (args.length < 1) {
            throw new Error('Remove command requires at least 1 argument');
        }
        
        const path = this.parseVariablePath(args[0]);
        
        if (args.length === 1) {
            // 删除整个路径
            const oldValue = this.getVariable(path);
            this.deleteVariable(path);
            this.recordDelta(path, oldValue, undefined, reason);
            console.log(`[MVU] Removed path '${path}'`);
        } else {
            // 删除特定元素
            const key = this.parseValue(args[1]);
            const target = this.getVariable(path);
            
            if (Array.isArray(target)) {
                if (typeof key === 'number') {
                    target.splice(key, 1);
                } else {
                    const index = target.findIndex(item => this.deepEqual(item, key));
                    if (index >= 0) target.splice(index, 1);
                }
                console.log(`[MVU] Removed item from array '${path}'`);
            } else if (typeof target === 'object') {
                delete target[String(key)];
                console.log(`[MVU] Removed key '${key}' from object '${path}'`);
            }
        }
        
        return { path, reason };
    }
    
    /**
     * 执行add命令（数值加法或日期操作）
     */
    async executeAdd(args, reason) {
        if (args.length !== 2) {
            throw new Error('Add command requires exactly 2 arguments');
        }
        
        const path = this.parseVariablePath(args[0]);
        const delta = this.parseValue(args[1]);
        
        const currentValue = this.getVariable(path);
        let newValue;
        
        if (typeof currentValue === 'number' && typeof delta === 'number') {
            newValue = currentValue + delta;
            this.setVariable(path, newValue);
            console.log(`[MVU] Added ${delta} to '${path}': ${currentValue} -> ${newValue}`);
        } else if (currentValue instanceof Date && typeof delta === 'number') {
            newValue = new Date(currentValue.getTime() + delta);
            this.setVariable(path, newValue.toISOString());
            console.log(`[MVU] Added ${delta}ms to date '${path}'`);
        } else {
            throw new Error(`Cannot add ${typeof delta} to ${typeof currentValue}`);
        }
        
        this.recordDelta(path, currentValue, newValue, reason);
        
        return { path, oldValue: currentValue, newValue, delta, reason };
    }
    
    /**
     * 解析变量路径
     */
    parseVariablePath(pathString) {
        // 移除引号
        pathString = pathString.replace(/^['"`](.*?)['"`]$/, '$1');
        
        // 处理点号分隔的路径
        const parts = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';
        
        for (let i = 0; i < pathString.length; i++) {
            const char = pathString[i];
            
            if ((char === '"' || char === "'") && (i === 0 || pathString[i - 1] !== '\\')) {
                if (!inQuote) {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuote = false;
                }
            } else if (char === '.' && !inQuote) {
                if (current) {
                    parts.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current) {
            parts.push(current);
        }
        
        return parts.join('.');
    }
    
    /**
     * 解析值
     */
    parseValue(valueString) {
        if (typeof valueString !== 'string') return valueString;
        
        valueString = valueString.trim();
        
        // 移除外层引号
        const unquoted = valueString.replace(/^['"`](.*?)['"`]$/, '$1');
        
        // 尝试解析特殊值
        if (unquoted === 'true') return true;
        if (unquoted === 'false') return false;
        if (unquoted === 'null') return null;
        if (unquoted === 'undefined') return undefined;
        
        // 尝试解析数字
        if (/^-?\d+(\.\d+)?$/.test(unquoted)) {
            return parseFloat(unquoted);
        }
        
        // 尝试解析JSON
        if ((valueString.startsWith('{') && valueString.endsWith('}')) ||
            (valueString.startsWith('[') && valueString.endsWith(']'))) {
            try {
                return JSON.parse(valueString);
            } catch (e) {
                // 不是有效的JSON，作为字符串返回
            }
        }
        
        // 尝试解析日期
        const date = new Date(unquoted);
        if (!isNaN(date.getTime()) && unquoted.includes('-')) {
            return date;
        }
        
        // 返回字符串值
        return unquoted;
    }
    
    /**
     * 获取变量值
     */
    getVariable(path) {
        if (!path) return this.variables.stat_data;
        
        const keys = path.split('.');
        let current = this.variables.stat_data;
        
        for (const key of keys) {
            if (current == null) return undefined;
            current = current[key];
        }
        
        return current;
    }
    
    /**
     * 设置变量值
     */
    setVariable(path, value) {
        if (!path) {
            this.variables.stat_data = value;
            return;
        }
        
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.variables.stat_data;
        
        // 创建路径
        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }
    
    /**
     * 删除变量
     */
    deleteVariable(path) {
        if (!path) {
            this.variables.stat_data = {};
            return;
        }
        
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.variables.stat_data;
        
        for (const key of keys) {
            if (!(key in current)) return;
            current = current[key];
        }
        
        delete current[lastKey];
    }
    
    /**
     * 记录变化
     */
    recordDelta(path, oldValue, newValue, reason) {
        const changeStr = `${JSON.stringify(oldValue)}->${JSON.stringify(newValue)}`;
        
        this.variables.delta_data[path] = changeStr;
        this.variables.display_data[path] = `${changeStr} ${reason ? `(${reason})` : ''}`;
        
        // 触发变量更新事件
        if (window.MVU_EVENTS) {
            $(document).trigger(window.MVU_EVENTS.SINGLE_VARIABLE_UPDATED, {
                path,
                oldValue,
                newValue,
                reason
            });
        }
    }
    
    /**
     * 深度比较
     */
    deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== 'object' || typeof b !== 'object') return false;
        
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        
        if (keysA.length !== keysB.length) return false;
        
        for (const key of keysA) {
            if (!keysB.includes(key)) return false;
            if (!this.deepEqual(a[key], b[key])) return false;
        }
        
        return true;
    }
    
    /**
     * 批量执行命令
     */
    async executeCommands(commands) {
        const results = [];
        
        for (const command of commands) {
            try {
                const result = await this.executeCommand(command);
                results.push({ success: true, command, result });
            } catch (error) {
                results.push({ success: false, command, error: error.message });
                
                if (window.mvuSettings?.notifications?.variableUpdateError) {
                    toastr.error(`命令执行失败: ${error.message}`, '[MVU]');
                }
            }
        }
        
        return results;
    }
    
    /**
     * 导出变量数据
     */
    exportVariables() {
        return JSON.parse(JSON.stringify(this.variables));
    }
    
    /**
     * 导入变量数据
     */
    importVariables(data) {
        if (data && typeof data === 'object') {
            this.variables = {
                ...this.variables,
                ...data
            };
            console.log('[MVU] Variables imported successfully');
        }
    }
    
    /**
     * 重置变量
     */
    resetVariables() {
        this.variables = {
            stat_data: {},
            display_data: {},
            delta_data: {},
            schema: {
                type: 'object',
                properties: {},
                extensible: true,
                strictTemplate: false,
                strictSet: false,
                concatTemplateArray: true
            },
            initialized_lorebooks: {}
        };
        console.log('[MVU] Variables reset');
    }
}

// 导出处理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VariableProcessor;
} else {
    window.VariableProcessor = VariableProcessor;
}
