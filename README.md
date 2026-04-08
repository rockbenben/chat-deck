# ChatDeck

A local AI chat hub. One interface for all your AI providers, one click to start.

You already have Claude, Qwen, or Ollama installed on your machine. But every time you want to use them, you open a terminal, type commands, set up system prompts. ChatDeck gives you a web UI where each **Profile** is a ready-to-go AI setup: provider + system prompt, pre-configured. Click a profile, chat instantly. All conversations stay organized and easy to find later.

It calls the CLI tools on your machine directly, so you chat for free using your existing subscriptions. No API keys required (but supported if you prefer).

## Quick Start

**Prerequisites:** Node.js >= 18

```bash
npm install
npm run dev
```

Open http://localhost:3456

Or use startup scripts: `start.bat` (Windows) / `bash start.sh` (macOS/Linux).

## How It Works

1. **Create a Profile** - Pick a provider (e.g. Claude), set a system prompt if needed, give it a name
2. **Click and Chat** - Select the profile from the sidebar, everything is ready, just type your message
3. **Come Back Anytime** - All sessions are saved under each profile, easy to find and continue later

## Features

- **One click to chat** - Pick a profile, start talking. No setup, no commands
- **Free to use** - Calls local CLI tools (`claude`, `qwen`, `ollama`) directly, uses your existing subscriptions
- **7 providers** - Claude, OpenAI, Gemini, Qwen, DeepSeek, Groq, Ollama
- **Conversations organized** - Every chat is saved under its profile for easy lookup
- **Compare mode** - Optionally send the same prompt to multiple providers side-by-side
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

## License

MIT
