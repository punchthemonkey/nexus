Nexus – Sovereign Browser‑Native AI Agent

A self‑improving, hybrid AI agent that runs entirely in your browser as a Progressive Web App.

https://img.shields.io/badge/license-MIT-blue.svg
https://img.shields.io/badge/TypeScript-5.5-blue
https://img.shields.io/badge/Preact-10.20-purple
https://img.shields.io/badge/Vite-5.4-646CFF

---

Overview

Nexus combines local AI inference (WebLLM/WebGPU) with optional cloud delegation (OpenAI, Anthropic, Gemini). It includes encrypted API key storage, a modular skill system, and a self‑evolution pipeline via GitClaw. Designed from the ground up for iOS Safari (iPhone 15 Pro Max, iOS 26.5+), Nexus delivers a native‑like PWA experience with full offline capability.

Why Nexus?

· Privacy First: Conversations and API keys stay on your device. Cloud models are only used when you explicitly delegate.
· Cost Efficient: Simple queries run locally on your device for free; complex tasks can be routed to cloud models.
· Extensible: Add new capabilities through Skills (JSON‑defined prompts + tool permissions) or connect to MCP servers.
· Self‑Improving: Nexus logs its own failures and can propose code or skill improvements via GitHub Issues (GitClaw integration).

---

Features

Core AI

· Local LLM inference with WebLLM (Qwen2.5‑1.5B quantized, WebGPU accelerated)
· Cloud delegation to OpenAI GPT‑4o, Anthropic Claude 3.5 Sonnet, and Google Gemini 1.5 Pro
· ReAct Loop – Reasoning + Acting with tool use (calculator, web search, page fetching)
· Adaptive provider selection based on thermal/battery state, network, and task complexity

Security & Privacy

· WebCrypto AES‑GCM encrypted keychain with PBKDF2 (600,000 iterations) master password
· Brute‑force lockout after 5 failed attempts (15‑minute cooldown)
· Sandboxed tool execution in Web Workers – no DOM access
· Strict Content Security Policy (CSP) and DOMPurify output sanitization

Memory & Sync

· IndexedDB for local conversation storage
· Optional Turso cloud sync with stale‑while‑revalidate (multi‑device)

Extensibility

· Skill System: Install, activate, import/export skills that define system prompts and allowed tools
· Built‑in tools: calculator, web_search, fetch_page
· MCP / WebMCP integration for dynamic external tool discovery (Chrome 146+ native, remote SSE fallback)

Self‑Evolution (Optional)

· Struggle logging and analysis
· SelfModifySkill generates improvement proposals using cloud LLMs
· GitHub Issue creation with GitClaw workflow for autonomous PRs (human review gate)

Mobile‑Optimised PWA

· iOS safe‑area support, haptic feedback, standalone mode
· Thermal & battery monitoring with adaptive inference scheduler
· Debug overlay (Ctrl+Shift+D) with system metrics and circuit breaker status
· Multi‑tab coordination via BroadcastChannel

---

Architecture

Nexus follows Hexagonal Architecture (Ports & Adapters) to keep core domain logic independent of external dependencies.

```
src/
├── domain/                 # Pure business logic
│   ├── entities/           # Conversation, Message, Skill, StruggleLog
│   ├── ports/              # ILLMProvider, IToolExecutor, IMemoryStore, IKeychain
│   └── orchestrator/       # ReAct loop (depends only on ports)
├── application/            # Use cases and cross‑cutting concerns
│   ├── container.ts        # tsyringe DI configuration
│   ├── event-bus.ts        # Pub/sub event bus
│   └── services/           # StruggleLogger, etc.
├── infrastructure/         # Concrete adapters
│   ├── adapters/
│   │   ├── llm/            # LocalLLMAdapter, OpenAI, Anthropic, Gemini
│   │   ├── storage/        # IndexedDBAdapter, TursoSyncAdapter
│   │   ├── tools/          # ToolExecutorAdapter, built‑in tools
│   │   └── keychain/       # WebCryptoKeychain
│   ├── workers/            # tool-worker.ts (sandbox)
│   └── monitoring/         # ThermalMonitor, CircuitBreaker, Profiler
├── ui/                     # Preact components and hooks
│   ├── components/         # ChatView, ModelLoader, DebugOverlay
│   ├── hooks/              # useLocalLLM, useOrchestrator
│   └── styles/             # Global CSS, utilities
└── workers/                # Service worker for PWA
```

For detailed diagrams and the complete technical specification, see the Master Handover Document.

---

Getting Started

Prerequisites

· Node.js 20+ and npm (or pnpm)
· A modern browser with WebGPU support (Chrome 113+, Edge 113+, Safari 26+ with feature flag enabled)

Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/nexus.git
cd nexus

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open http://localhost:3000 in your browser.

First Launch

1. The local LLM (~500 MB) will download automatically via Cache API (one‑time). A progress indicator is shown.
2. You will be prompted to create a master password to encrypt the API keychain.
3. (Optional) Add cloud provider API keys in Settings → API Keys.

---

Usage

Basic Chat

Type a message and press Send. The agent will respond using the local model by default. If the task is complex and cloud keys are configured, Nexus may automatically delegate to a cloud provider.

Tools

· Calculator: What is 2 + 3 * 4?
· Web Search: Search for latest AI news
· Fetch Page: Fetch content from https://example.com

Skills

1. Open the Skills panel.
2. Activate a built‑in skill (e.g., Web Researcher) to restrict tools and set a custom system prompt.
3. Import custom skills from a JSON URL.

Debug Overlay

Press Ctrl+Shift+D (or Cmd+Shift+D on macOS) to toggle a real‑time overlay showing thermal state, battery level, GPU memory pressure, circuit breaker status, and more.

---

Configuration

Environment Variables

Create a .env file in the root (or set variables in your deployment platform):

```env
# Turso Cloud Sync (optional)
VITE_TURSO_DB_URL=libsql://your-db.turso.io
VITE_TURSO_AUTH_TOKEN=your-token
VITE_TURSO_SYNC_URL=https://sync.turso.io
VITE_TURSO_SYNC_INTERVAL=30000

# GitClaw Self‑Evolution (optional)
VITE_GITCLAW_REPO=owner/repo

# Default local model (optional)
VITE_DEFAULT_MODEL=Qwen2.5-1.5B-Instruct-q4f16_1-MLC
```

API Keys

API keys are never stored in environment variables or the build. They are encrypted locally using your master password and stored in IndexedDB. Enter them via the Settings UI after unlocking the keychain.

PWA Manifest & Icons

Place your PWA icons (pwa-192x192.png, pwa-512x512.png) in the public/ folder. The manifest.webmanifest file is already configured.

---

Deployment

Build for Production

```bash
npm run build
```

The output will be in the dist/ directory.

Deploy to Vercel / Netlify / Cloudflare Pages

· Connect your GitHub repository.
· Set the required environment variables (see above).
· Ensure the following headers are added (they are included in vercel.json / netlify.toml in the repo):
  · Cross-Origin-Opener-Policy: same-origin
  · Cross-Origin-Embedder-Policy: require-corp
  · Content-Security-Policy: ... (as defined in vite.config.ts)

iOS PWA Testing

1. Open the deployed URL in Safari on an iPhone.
2. Tap Share → Add to Home Screen.
3. Launch from the home screen – the app will run in standalone mode.

---

Testing

```bash
# Run unit tests (Vitest)
npm run test

# Run end‑to‑end tests (Playwright)
npm run test:e2e

# Lint and format
npm run lint
npm run format
```

---

Known Limitations

· WebGPU required for local inference; older devices fall back to cloud‑only.
· Turso sync uses last‑write‑wins; concurrent edits may lose data.
· MCP remote servers must support CORS and SSE.
· Self‑evolution PRs require manual review.

---

Future Roadmap

· WebAuthn / Passkey unlock (passwordless keychain)
· Voice input/output via Web Speech API
· Local embeddings & RAG with Transformers.js
· Multi‑modal vision (image upload to cloud models)
· Skill marketplace

---

Contributing

Contributions are welcome! Please open an issue or submit a pull request. See CONTRIBUTING.md for guidelines.

License

This project is licensed under the MIT License – see the LICENSE file for details.

---

Built with ❤️ by the Nexus team
