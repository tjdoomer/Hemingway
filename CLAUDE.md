# CLAUDE.md — Hemingway Agent Rules

> These rules are MANDATORY for all agents (human or AI) working on this codebase.

## Project Overview

Hemingway is a multi-agent AI orchestration system. TypeScript, Node.js >= 20, ESM modules.

```
src/
├── agents/       # Specialized agents (GitHub, Coding, Slack, etc.)
├── core/         # Samantha orchestrator
├── memory/       # SQLite-backed 4-layer memory system
├── models/       # Model detection and unified LLM client
├── tools/        # Real tool implementations (filesystem, github, search)
├── types/        # Zod-validated type definitions
├── utils/        # Utilities (logging, paths, retry)
├── cli.ts        # CLI entry point
└── index.ts      # Library entry point
```

## Mandatory Workflow

### 1. Work in Git Worktrees

**ALL work MUST happen in a git worktree**, not directly on `main`. This enables parallel agent execution.

```bash
# Create a worktree for your task
git worktree add ../hemingway-worktree/p1-tool-pipeline worktree/p1-tool-pipeline

# Or if the branch doesn't exist yet:
git worktree add -b worktree/p1-tool-pipeline ../hemingway-worktree/p1-tool-pipeline main

# When done, clean up:
git worktree remove ../hemingway-worktree/p1-tool-pipeline
```

Branch naming: `worktree/{plan-task-id}` (e.g., `worktree/p1-tool-pipeline`, `worktree/p2-github-agent`)

### 2. Read the Plan Before Starting

Before writing ANY code:
1. Read `PLAN.md` — find your task, check it's not already done or in progress
2. Read the specialist prompt in `.hemingway/prompts/` for your task
3. Mark your task as `[~]` in progress in `PLAN.md`

### 3. Validate Before Committing

Every commit must pass:
```bash
npm run typecheck    # TypeScript compilation
npm test             # All tests pass
```

### 4. Security Scan Before Merge

After completing work on a worktree branch, a security scan MUST be run using the Security-Bot (see local `.hemingway/prompts/SECURITY-REVIEW.md` for full process).

- **CRITICAL/HIGH findings** — MUST be fixed before merge. No exceptions.
- **MEDIUM findings** — Should be fixed. If not, track privately with timeline.
- **LOW/INFO** — Fix when convenient. Do NOT document specific vulnerabilities in committed files.

### 5. Update Tracking Files

After completing work:
1. **PLAN.md** — Check off completed tasks `[x]`
2. **CHANGELOG.md** — Add entry with commit hash and your agent name
3. Commit these updates as part of your work

## Code Standards

### TypeScript
- Strict mode (`strict: true` in tsconfig)
- ESM imports with `.js` extensions (e.g., `import { foo } from './bar.js'`)
- Use Zod for runtime validation at system boundaries
- No `any` types — use `unknown` and narrow

### Security (Non-Negotiable)
- **Path traversal**: All file paths from user/LLM input MUST be resolved and checked against a sandbox root
- **Command injection**: Use array-form `execFile`, NEVER string-interpolated `exec`
- **SSRF**: Validate URLs before fetching — block localhost, private IPs, link-local addresses
- **SQL injection**: Use parameterized queries ONLY — never string-concatenate SQL
- **Credential exposure**: NEVER log API keys, tokens, or secrets. Check before committing.
- **Format strings**: Use `%s` format specifiers in `console.log`, never pass user input as the format string

### Public Repo Safety (Non-Negotiable)
This repository is **PUBLIC**. Every file committed is visible to the world. Before committing, verify:
- **NEVER commit security documentation** — No vulnerability reports, security fix details, CVE references, attack surface descriptions, or remediation specifics. These stay local only (gitignored under `.hemingway/`).
- **NEVER commit agent prompts** — Specialist prompts in `.hemingway/prompts/` contain implementation details, code patterns, and security-sensitive guidance. These are local-only working documents.
- **NEVER commit security scan results** — Reports from Security-Bot stay in `.hemingway/security-reports/` (gitignored).
- **NEVER commit secrets or credentials** — No API keys, tokens, passwords, or connection strings. Use `.env` (gitignored).
- **NEVER commit internal tooling paths** — Absolute paths to local tools (e.g., Security-Bot location) must not appear in committed files.
- **Review every `git add`** — Use `git diff --cached` before committing. If in doubt, don't commit it.
- **CHANGELOG entries for security fixes** should say WHAT was fixed (e.g., "Hardened path validation") but NEVER describe the specific vulnerability, attack vector, or exploitation method.

### Error Handling
- Agents must handle missing models gracefully (return error, don't crash)
- Tool execution must have timeouts
- Failed tool calls should return `{ success: false, error: '...' }`, not throw

### Testing
- Tests live next to their source: `src/utils/security.test.ts`
- Use Vitest (`npm test`)
- New tools need at least: happy path test, error case test, security boundary test

## Architecture Rules

### Agent Design (12-Factor-Agents Principles)
- Agents are **small and focused** — 3-20 steps max per task
- State is **event-sourced** — the message history IS the state
- Agents are **stateless reducers** — can be paused and resumed from persisted state
- Human-in-the-loop is a **tool call**, not an afterthought
- Own your prompts, own your context window, own your control flow

### Model Routing
- **Work tasks** → cloud models (Claude Sonnet/Opus, GPT-4o) for reliability
- **Personal tasks** → local models (LMStudio, Ollama) for privacy
- Explicit `[work]` or `[personal]` tags override auto-classification
- Fallback chain: preferred → same-tier alternative → any available

### Memory System
- **Session memory**: Current conversation (in-memory + SQLite)
- **Episodic memory**: Task completion history (SQLite)
- **Semantic memory**: User preferences and patterns (SQLite)
- **Working memory**: Current task state (in-memory Map)
- SQLite uses WAL mode for concurrent access from worktrees

## File Locations

| File | Purpose | Committed? |
|------|---------|------------|
| `PLAN.md` | Master task list — check off work as you complete it | Yes |
| `CHANGELOG.md` | All changes with commit hashes and agent names | Yes |
| `CLAUDE.md` | This file — mandatory rules for all agents | Yes |
| `.env.example` | Environment variable template | Yes |
| `.hemingway/prompts/` | Specialist prompts with code examples (LOCAL ONLY) | **No — gitignored** |
| `.hemingway/security-reports/` | Security scan results (LOCAL ONLY) | **No — gitignored** |

Files that document vulnerabilities, security fixes, attack vectors, or contain agent prompts with implementation details MUST NEVER be committed. They live under `.hemingway/` which is gitignored.

## Quick Reference

```bash
# Development
npm run dev          # Run in dev mode (tsx)
npm run build        # Compile TypeScript
npm run typecheck    # Type check only
npm test             # Run tests

# Git worktree workflow
git worktree add -b worktree/my-task ../hemingway-worktree/my-task main
cd ../hemingway-worktree/my-task
npm install
# ... do work ...
npm run typecheck && npm test
# ... security scan ...
git add -A && git commit -m "feat: description"
cd /Users/thomjames-worrall/Hemingway
git merge worktree/my-task
git worktree remove ../hemingway-worktree/my-task

# Security scan (see local .hemingway/prompts/SECURITY-REVIEW.md)
security-agent scan /path/to/worktree --depth standard
```
