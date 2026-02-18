# Changelog

All notable changes to Hemingway are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).
Each entry must include the agent/author, date, and commit hash.

---

## [Unreleased]

_Work tracked in [PLAN.md](./PLAN.md). Agents: check off tasks as you complete them._

---

## [0.1.0] - 2026-02-18

### Added
- **Initial scaffolding** — Full project structure with TypeScript, ESM modules, and build pipeline. (`fa06891`, Tj)
- **Type system** — Comprehensive Zod-validated types for agents, tasks, messages, tools, memory, events, and config. (`fa06891`, Tj)
- **CLI** — Commander-based CLI with interactive REPL, direct command mode, status display, and ASCII banner. (`fa06891`, Tj)
- **Samantha orchestrator** — Core orchestrator with heuristic + LLM-based intent classification, task creation, work/personal routing, and conversation memory. (`fa06891`, Tj)
- **9 specialized agents** — GitHubAgent, CodingAgent, SlackAgent, EmailAgent, ResearchAgent, CalendarAgent, CreativeAgent, ChatAgent, SocialAgent with base/work/personal class hierarchy. (`fa06891`, Tj)
- **Model detection** — Auto-discovery of LMStudio, OpenAI, and Anthropic models with capability mapping. (`fa06891`, Tj)
- **Model client** — Unified completion interface for OpenAI-compatible and Anthropic APIs with streaming support. (`fa06891`, Tj)
- **Memory system** — SQLite-backed 4-layer memory: session (conversation), episodic (task history), semantic (preferences), working (current state). (`fa06891`, Tj)
- **Utility functions** — ID generation, path expansion, retry with backoff, logging, tag extraction. (`fa06891`, Tj)

### Fixed
- **TypeScript compilation errors** — Resolved type errors preventing build. (`9bede4e`, Tj)
- **`expandPath` path traversal vulnerability** — Hardened against `../` traversal attacks without breaking legitimate `~/` paths. Previous security fix introduced a regression where valid paths like `~/Documents/test.txt` were rejected because the leading `/` after `~` was mistakenly flagged. (`20843e2`, Claude Opus 4.6)
- **Format string injection in logger** — Switched to `%s` format specifiers to prevent user-controlled input from being interpreted as format strings. (`20843e2`, Claude Opus 4.6)

### Added (Security)
- **Security tests** — 10 tests covering path traversal prevention and format string injection prevention in `src/utils/security.test.ts`. (`20843e2`, Claude Opus 4.6)
- **SECURITY_FIXES.md** — Documentation of vulnerabilities found and fixes applied. (`20843e2`, Claude Opus 4.6)

---

## Agent Changelog Format

When making changes, agents MUST append an entry using this format:

```markdown
## [version or Unreleased] - YYYY-MM-DD

### Added/Changed/Fixed/Removed
- **Brief description** — Details of the change. (`commit_hash`, AgentName)
```

Rules:
1. Always include the commit hash and agent name
2. Group changes under Added/Changed/Fixed/Removed
3. Link to relevant PLAN.md task ID where applicable
4. Security fixes get their own subsection
