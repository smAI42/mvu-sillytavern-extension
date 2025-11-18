# 📚 GitHub上传完整教程（小白版）

## 第一部分：准备工作

### 1. 注册GitHub账号
1. 访问 https://github.com
2. 点击右上角的 "Sign up"
3. 输入你的邮箱、密码和用户名
4. 验证邮箱

### 2. 安装Git（可选，推荐）
- **Windows**: 下载 https://git-scm.com/download/win
- **Mac**: 在终端运行 `brew install git`
- **Linux**: 运行 `sudo apt-get install git`

## 第二部分：创建仓库

### 方法一：通过网页界面上传（最简单）

#### 步骤1：创建新仓库
1. 登录GitHub后，点击右上角的 "+" 号
2. 选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `mvu-sillytavern-extension`
   - **Description**: `MVU Variable Framework - 独立的SillyTavern扩展，用于管理角色卡变量系统`
   - **Public/Private**: 选择 Public（公开）
   - ✅ 勾选 "Add a README file"
   - **License**: 选择 MIT License
4. 点击 "Create repository"

#### 步骤2：上传文件
1. 在新创建的仓库页面，点击 "Add file" -> "Upload files"
2. 将 `mvu-extension` 文件夹内的所有文件拖拽到上传区域
3. 文件结构应该是：
   ```
   根目录/
   ├── manifest.json
   ├── index.js
   ├── variable-processor.js
   ├── worldbook-handler.js
   ├── styles.css
   ├── README.md
   ├── LICENSE
   └── .gitignore
   ```
4. 在 "Commit changes" 部分：
   - **标题**: `Initial release v1.0.0`
   - **描述**: `首个独立版本发布，完全兼容现有MVU角色卡`
5. 点击 "Commit changes"

### 方法二：使用Git命令行（推荐进阶用户）

#### 步骤1：初始化本地仓库
在命令行中，进入 `mvu-extension` 文件夹：
```bash
cd mvu-extension
git init
git add .
git commit -m "Initial release v1.0.0"
```

#### 步骤2：连接GitHub仓库
```bash
git remote add origin https://github.com/你的用户名/mvu-sillytavern-extension.git
git branch -M main
git push -u origin main
```

## 第三部分：发布Release版本

### 创建发布版本
1. 在仓库页面右侧找到 "Releases"
2. 点击 "Create a new release"
3. 填写发布信息：
   - **Tag version**: `v1.0.0`
   - **Release title**: `MVU Extension v1.0.0 - 独立版本`
   - **Description**: 
   ```markdown
   ## 🎉 MVU Variable Framework v1.0.0
   
   ### ✨ 特性
   - 完全独立运行，不依赖酒馆助手
   - 100%兼容现有MVU角色卡
   - 支持世界书InitVar初始化
   - 自动变量更新和管理
   - 快照和楼层重演功能
   
   ### 📦 安装方法
   1. 下载 Source code (zip)
   2. 解压到 `SillyTavern/public/scripts/extensions/third-party/`
   3. 重启SillyTavern
   
   ### ⚠️ 注意事项
   - 需要SillyTavern v1.13.4或更高版本
   - 如已安装酒馆助手版MVU，请先卸载
   ```
4. 点击 "Publish release"

## 第四部分：完善仓库

### 1. 更新README.md
在仓库根目录创建更详细的README：

```markdown
# MVU SillyTavern Extension

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![SillyTavern](https://img.shields.io/badge/SillyTavern-1.13.4+-orange)

## 📖 简介
MVU Variable Framework是一个强大的SillyTavern扩展...

## ✨ 特性
- 🎯 完整的变量管理系统
- 🔄 自动变量更新
- 💾 快照和恢复功能
- 📊 变量追踪历史

## 🚀 快速开始
### 安装
1. [下载最新版本](https://github.com/你的用户名/mvu-sillytavern-extension/releases)
2. 解压到扩展目录
3. 重启SillyTavern

## 📚 文档
查看 [Wiki](https://github.com/你的用户名/mvu-sillytavern-extension/wiki) 获取详细文档

## 🤝 贡献
欢迎提交Issue和Pull Request！

## 📄 许可证
MIT License
```

### 2. 创建Wiki页面（可选）
1. 在仓库页面点击 "Wiki" 标签
2. 创建以下页面：
   - Home（首页）
   - Installation（安装指南）
   - Usage（使用教程）
   - FAQ（常见问题）
   - API Reference（API文档）

### 3. 设置GitHub Pages（可选）
1. 进入 Settings -> Pages
2. Source选择 "Deploy from a branch"
3. Branch选择 "main" 和 "/(root)"
4. 保存后会生成在线文档地址

## 第五部分：推广和维护

### 1. 添加话题标签
在仓库页面点击齿轮图标，添加话题：
- `sillytavern`
- `sillytavern-extension`
- `roleplay`
- `ai-chat`
- `variable-management`

### 2. 创建Issue模板
创建 `.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug report
about: 报告问题
title: '[BUG] '
labels: bug
---

**问题描述**
简要描述遇到的问题

**重现步骤**
1. 步骤一
2. 步骤二

**预期行为**
应该发生什么

**实际行为**
实际发生了什么

**环境信息**
- SillyTavern版本：
- 浏览器：
- 操作系统：
```

### 3. 版本更新流程
每次更新时：
1. 修改 `manifest.json` 中的版本号
2. 更新 README.md 中的更新日志
3. 创建新的Release
4. 打上合适的标签

## 📌 重要提醒

### 文件组织
确保所有文件都在仓库根目录，而不是在子文件夹中：
```
✅ 正确：
github.com/你的用户名/mvu-sillytavern-extension/
├── manifest.json
├── index.js
└── ...

❌ 错误：
github.com/你的用户名/mvu-sillytavern-extension/
└── mvu-extension/
    ├── manifest.json
    └── ...
```

### 协作开发
如果想要其他人协作：
1. Settings -> Manage access
2. 点击 "Invite a collaborator"
3. 输入协作者的GitHub用户名

### 自动化发布
可以使用GitHub Actions自动化构建和发布：
1. 创建 `.github/workflows/release.yml`
2. 配置自动打包和发布流程

## 🎯 检查清单

上传前确保：
- [ ] 所有文件都在正确位置
- [ ] README.md内容完整
- [ ] LICENSE文件存在
- [ ] manifest.json版本号正确
- [ ] 没有包含个人隐私信息
- [ ] 代码中没有硬编码的API密钥

## 💡 专业建议

1. **定期更新**: 及时修复bug和添加新功能
2. **回应Issue**: 积极回应用户反馈
3. **版本管理**: 使用语义化版本号 (major.minor.patch)
4. **文档完善**: 保持文档与代码同步更新
5. **社区互动**: 在相关论坛和Discord宣传你的扩展

---

恭喜！你现在已经成功将MVU扩展上传到GitHub了！🎉
