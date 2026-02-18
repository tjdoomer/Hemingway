# Hemingway 🧊

> *"The dignity of movement of an iceberg is due to only one-eighth of it being above water."* — Ernest Hemingway

**Hemingway** is a multi-agent AI orchestration system that embodies the iceberg theory: a simple, elegant surface concealing sophisticated intelligence beneath. Named after the literary titan whose minimalist style revealed depth through omission, Hemingway manages your work and personal AI agents with quiet efficiency.

## Philosophy

Like Hemingway's writing, this system shows only what's necessary. You speak naturally — "review my PRs" or "schedule lunch with mom" — and the orchestration layer beneath understands, classifies, routes, and executes. The complexity is hidden; the experience is effortless.

## Features

### 🎭 Dual-Agent System
- **Work Agents** (API-powered for reliability)
  - Code development and GitHub management
  - PR reviews and documentation
  - Slack integration
  - Google Calendar/Gmail
  - Project briefings and research

- **Personal Agents** (Local models for privacy)
  - Personal email and calendar
  - Creative tasks and life conversations
  - Social media management
  - Entertainment and casual chat

### 🧠 Samantha - The Orchestrator
An overarching intelligence (inspired by "Her") that:
- Understands your intent from natural language
- Classifies tasks as work vs. personal
- Routes to the appropriate specialized agent
- Maintains context across conversations
- Learns your preferences over time

### 🔌 Smart Model Detection
- Auto-discovers LMStudio local models
- Validates API keys for cloud providers
- Intelligent fallback strategies
- Model-specific prompt optimization

### 💾 Robust Memory System
- **Session Memory**: Active conversation context
- **Episodic Memory**: Task completion history  
- **Semantic Memory**: Learned patterns and preferences
- **Working Memory**: Current task state across agents

### 🎤 Multi-Modal Input
- Terminal text interface
- Voice commands (microphone input)
- Natural language processing

## Quick Start

```bash
# Install
npm install -g hemingway

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run
hemingway
```

## Usage

### Interactive Mode
```bash
hemingway
# or
hway
```

### Direct Commands
```bash
# Work tasks
hemingway "review the open PRs in my-project"
hemingway "what's on my calendar today?"
hemingway "send a standup update to #engineering"

# Personal tasks  
hemingway "remind me to call mom tomorrow"
hemingway "help me write a birthday message"
hemingway "what's trending on my feeds?"
```

### Voice Mode
```bash
hemingway --voice
# Say "Hemingway" to activate, then speak your request
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│         (Terminal CLI / Voice / Web Dashboard)           │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  Hemingway Core                          │
│               (Samantha Orchestrator)                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │   Intent    │ │   Task      │ │   Memory    │       │
│  │ Recognition │ │  Routing    │ │ Management  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
┌─────────▼─────────┐ ┌───▼───┐ ┌────────▼────────┐
│   Work Agents     │ │Models │ │ Personal Agents │
│  (API-powered)    │ │  Hub  │ │  (Local/Private)│
└───────────────────┘ └───────┘ └─────────────────┘
```

## Configuration

### Model Providers

```env
# Cloud APIs (Work)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Local (Personal)
LMSTUDIO_BASE_URL=http://localhost:1234/v1
```

### Integrations

```env
# GitHub
GITHUB_TOKEN=ghp_...

# Google (Calendar/Gmail)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Slack
SLACK_BOT_TOKEN=xoxb-...
```

## Agent Tags

Tag your requests to route to specific agent types:

```
"[work] refactor the authentication module"
"[personal] plan my weekend trip"
```

Or let Samantha classify automatically based on context.

## Development

```bash
# Clone
git clone https://github.com/yourusername/hemingway.git
cd hemingway

# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Test
npm test
```

## Inspired By

- **Ernest Hemingway** — The iceberg theory of writing
- **Her (2013)** — Samantha's natural, intuitive assistance
- [Gas Town](https://github.com/steveyegge/gastown) — Multi-agent workspace management
- [HumanLayer](https://github.com/humanlayer/humanlayer) — Human-in-the-loop patterns
- [12-Factor Agents](https://github.com/humanlayer/12-factor-agents) — Production agent principles
- [Delta-code](https://github.com/tjdoomer/Delta-code) — Terminal-based AI CLI

## License

MIT

---

*"All you have to do is write one true sentence. Write the truest sentence that you know."*
