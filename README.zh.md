# ChatDeck

> 365 开源计划 #006 · 本地 AI 聊天中心，一个界面管理所有 AI 服务

本地 AI 对话中心。一个界面统一调用所有 AI，一键开聊。

你的电脑上已经装了 Claude、Qwen 或 Ollama，但每次想用的时候都得开终端、敲命令、配参数。ChatDeck 提供一个 Web 界面，把每个**配置**都设置好：选好服务商、写好系统提示词，点一下就能直接对话。所有聊天记录按配置自动归档，随时可以回看。

它直接调用你本机已安装的 CLI 工具，利用你现有的订阅套餐免费对话，无需额外的 API 费用。

## 快速开始

**环境要求：** Node.js >= 18

```bash
npm install
npm run dev
```

打开 http://localhost:3456

也可以直接用启动脚本：`start.bat`（Windows）/ `bash start.sh`（macOS/Linux）。

## 使用流程

1. **创建配置** - 选择服务商（如 Claude），按需设置系统提示词，取个名字
2. **点击即用** - 在侧边栏选择配置，一切就绪，直接输入消息
3. **随时回看** - 所有会话按配置自动保存，方便查找和继续

## 功能特性

- **一键开聊** - 选个配置就能用，不用敲命令、不用配参数
- **免费使用** - 直接调用本机 CLI 工具（`claude`、`qwen`、`ollama`），用你现有的订阅
- **7 个服务商** - Claude、OpenAI、Gemini、Qwen、DeepSeek、Groq、Ollama
- **对话归档** - 所有聊天按配置分类保存，方便查找和回顾
- **对比模式** - 可选功能，将同一提示词同时发给多个服务商并排对比
- **会话分叉** - 编辑任意消息，分支出新对话
- **导出** - 将对话下载为 Markdown 文件
- **深色模式**和**中英双语**界面

## 服务商配置

每个服务商支持两种调用方式：

| 方式 | 说明 | 费用 |
|------|------|------|
| **CLI**（推荐） | 调用本机已安装的工具，如 `claude`、`ollama`、`qwen` | 免费（使用你的订阅套餐） |
| **API** | 直接调用 API，需填写密钥 | 按量付费 |

CLI 工具会自动检测。如需配置 API 密钥，点击右上角齿轮图标进入设置。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建会话 |
| `Ctrl+/` | 切换对比模式 |
| `Ctrl+E` | 导出为 Markdown |
| `Ctrl+1~4` | 切换服务商 |

## 生产部署

```bash
npm run build
npm start
```

或通过 CLI：

```bash
npx chat-deck              # 默认端口 3456
npx chat-deck -p 8080      # 自定义端口
```

## 项目结构

```
packages/
  client/    React + Vite 前端
  server/    Express + WebSocket 后端
  shared/    共享 TypeScript 类型定义
```

## 关于 365 开源计划

本项目是 [365 开源计划](https://github.com/rockbenben/365opensource) 的第 006 个项目。

一个人 + AI，一年 300+ 个开源项目。[提交你的需求 →](https://my.feishu.cn/share/base/form/shrcnI6y7rrmlSjbzkYXh6sjmzb)

## 许可证

MIT
