# ChatDeck

> 365 Open Source Plan #006 · Local AI chat hub — one interface for all your providers

[中文文档](README.zh.md)

A local AI chat hub that doubles as an AI toolbox. One interface for all your AI providers, one click to start.

![Chat View](docs/chat-view.png)

## Why ChatDeck

**AI as a tool, not just a chatbot.** Most AI interfaces are built for multi-turn conversations. But many tasks don't need context — you just want to throw text at an AI and get a result. Text polishing, translation, summarization, code review... you do these dozens of times a day, and previous conversations only get in the way.

ChatDeck's **Stateless mode** strips all history from every request. Each message is processed from scratch with only your system prompt — no context leaking in, no pollution from previous turns. Create a "Polish Text" profile, and it becomes a dedicated text-polishing tool: input in, result out, clean every time.

Combined with **Profile presets** (provider + system prompt, ready to go) and **Compare mode** (same input, multiple providers side-by-side), ChatDeck turns your local AI tools into a fast, organized workflow.

### Highlights

- **Stateless mode** - Zero context per message. Each request = system prompt + your input. Ideal for text editing, translation, and any high-frequency single-turn task
- **Profile presets** - Pre-configure provider + system prompt. Click to use, no setup each time
- **Compare mode** - Send the same prompt to multiple providers, pick the best result
- **Free to use** - Calls local CLI tools (`claude`, `qwen`, `ollama`) directly, uses your existing subscriptions. API keys optional
- **7 providers** - Claude, OpenAI, Gemini, Qwen, DeepSeek, Groq, Ollama

![Compare Mode](docs/compare-mode.png)

## Quick Start

**Prerequisites:** Node.js >= 18

```bash
npm install
npm run dev
```

Open http://localhost:3456

Or use startup scripts: `start.bat` (Windows) / `bash start.sh` (macOS/Linux).

## How It Works

1. **Create a Profile** - Pick a provider, set a system prompt, give it a name. Stateless mode is on by default
2. **Click and Chat** - Select the profile from the sidebar, just type your message
3. **Come Back Anytime** - All sessions are saved under each profile, easy to find and continue

## All Features

- **One click to chat** - Pick a profile, start talking. No setup, no commands
- **Stateless mode** - Enabled per profile or toggled per session. Perfect for repetitive text tasks
- **Compare mode** - Side-by-side provider comparison
- **7 providers** - Claude, OpenAI, Gemini, Qwen, DeepSeek, Groq, Ollama
- **Free via CLI** - Uses locally installed tools, no API cost
- **Session fork** - Edit any message and branch into a new conversation
- **Export** - Download conversations as Markdown
- **Dark mode** and **Chinese/English** interface

## Provider Setup

ChatDeck works in two ways per provider:

| Mode | How | Cost |
|------|-----|------|
| **CLI** (recommended) | Uses locally installed tools like `claude`, `ollama`, `qwen` | Free with your subscription |
| **API** | Direct API calls with your key | Pay per token |

CLI tools are auto-detected. To configure API keys, click the gear icon in the top-right corner.

### API Key Sources

| Provider | Where to get the key |
|----------|---------------------|
| Claude | [console.anthropic.com](https://console.anthropic.com/) (optional — works free via `claude` CLI) |
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Qwen | [bailian.console.aliyun.com](https://bailian.console.aliyun.com/) (DashScope API) |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/) |
| Groq | [console.groq.com](https://console.groq.com/) |
| Ollama | No key needed (local) |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New session |
| `Ctrl+/` | Toggle Compare mode |
| `Ctrl+E` | Export as Markdown |
| `Ctrl+1~4` | Switch provider |

## Production Build

```bash
npm run build
npm start
```

Or via CLI:

```bash
npx chat-deck              # default port 3456
npx chat-deck -p 8080      # custom port
```

## Project Structure

```
packages/
  client/    React + Vite frontend
  server/    Express + WebSocket backend
  shared/    Shared TypeScript types
```

## About 365 Open Source Plan

This is project #006 of the [365 Open Source Plan](https://github.com/rockbenben/365opensource).

One person + AI, 300+ open source projects in a year. [Submit your idea →](https://my.feishu.cn/share/base/form/shrcnI6y7rrmlSjbzkYXh6sjmzb)

## License

MIT
