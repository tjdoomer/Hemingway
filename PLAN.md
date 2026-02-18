# Hemingway Implementation Plan

> The iceberg theory of AI orchestration — only 1/8 visible, the rest runs beneath.

This is the master plan. Agents check off tasks as they complete them.
Each task has an ID, description, assigned worktree branch, and status.

**Status legend:** `[ ]` pending | `[~]` in progress | `[x]` complete | `[!]` blocked

---

## Phase 1: Core Pipeline (Make It Work)

> Goal: A single end-to-end flow where you type a request, Samantha classifies it, routes to an agent, and the agent executes a real tool.

### P1.1 Fix Tool Calling Pipeline
- [ ] **P1.1.1** — Replace `zodToJsonSchema` stub in `src/models/client.ts` with real conversion using `zod-to-json-schema` library
- [ ] **P1.1.2** — Add `zod-to-json-schema` to dependencies
- [ ] **P1.1.3** — Write tests for tool schema conversion (OpenAI format, Anthropic format)
- **Branch:** `worktree/p1-tool-pipeline`
- **Security scan:** Required after completion

### P1.2 Model Detection & Auto-Discovery
- [ ] **P1.2.1** — Implement real LMStudio model detection (query `/v1/models` endpoint)
- [ ] **P1.2.2** — Add Ollama auto-detection (`http://localhost:11434/api/tags`)
- [ ] **P1.2.3** — Implement model tier classification (fast/medium/strong) based on model size and capabilities
- [ ] **P1.2.4** — Route work tasks → cloud models, personal tasks → local models
- [ ] **P1.2.5** — Add fallback chain: preferred model → same-tier alternative → any available
- [ ] **P1.2.6** — Update model capabilities map with current Claude 4.x and GPT-4o models
- **Branch:** `worktree/p1-model-detection`
- **Security scan:** Required after completion

### P1.3 Wire Samantha → Agent Execution
- [ ] **P1.3.1** — Connect `Samantha.process()` to `AgentRegistry.executeTask()` so classified tasks actually run
- [ ] **P1.3.2** — Add agent execution result display in CLI (show tool calls, outputs, errors)
- [ ] **P1.3.3** — Implement streaming output from agents to CLI
- [ ] **P1.3.4** — Add task status tracking (pending → in_progress → completed/failed)
- **Branch:** `worktree/p1-execution-wiring`
- **Security scan:** Required after completion

---

## Phase 2: Real Agent Implementations

> Goal: Each agent has at least one working real-world tool. No more `[Mock]` returns.

### P2.1 GitHub Agent
- [ ] **P2.1.1** — Implement `list_pull_requests` using `gh` CLI or Octokit
- [ ] **P2.1.2** — Implement `get_pr_details` with diff summary
- [ ] **P2.1.3** — Implement `create_issue`, `comment_on_pr`, `merge_pr`
- [ ] **P2.1.4** — Implement `list_repos`, `get_repo_status`
- [ ] **P2.1.5** — Add auth detection (GITHUB_TOKEN environment variable)
- **Branch:** `worktree/p2-github-agent`
- **Security scan:** Required — handles auth tokens

### P2.2 Coding Agent
- [ ] **P2.2.1** — Implement real `read_file` with sandboxed path validation
- [ ] **P2.2.2** — Implement real `write_file` with confirmation for destructive writes
- [ ] **P2.2.3** — Implement `run_shell` with sandbox (project directory only)
- [ ] **P2.2.4** — Implement `search_code` (grep/ripgrep wrapper)
- [ ] **P2.2.5** — Implement `edit_file` with diff-based edits
- **Branch:** `worktree/p2-coding-agent`
- **Security scan:** Required — executes shell commands

### P2.3 Slack Agent
- [ ] **P2.3.1** — Integrate Slack Bolt SDK or Web API
- [ ] **P2.3.2** — Implement `send_message` to channels/users
- [ ] **P2.3.3** — Implement `read_messages` with channel history
- [ ] **P2.3.4** — Implement `search_messages`
- [ ] **P2.3.5** — Add auth detection (SLACK_BOT_TOKEN)
- **Branch:** `worktree/p2-slack-agent`
- **Security scan:** Required — handles auth tokens

### P2.4 Email/Calendar Agent (Google)
- [ ] **P2.4.1** — Implement Google OAuth2 flow for Gmail + Calendar
- [ ] **P2.4.2** — Implement `read_emails` with Gmail API
- [ ] **P2.4.3** — Implement `send_email` with Gmail API
- [ ] **P2.4.4** — Implement `list_events` with Google Calendar API
- [ ] **P2.4.5** — Implement `create_event` with Google Calendar API
- [ ] **P2.4.6** — Add calendar briefing feature ("what's on my schedule today?")
- **Branch:** `worktree/p2-google-agent`
- **Security scan:** Required — handles OAuth tokens

### P2.5 Research Agent
- [ ] **P2.5.1** — Integrate web search API (Brave Search, Tavily, or SerpAPI)
- [ ] **P2.5.2** — Implement `web_search` with result summarization
- [ ] **P2.5.3** — Implement `fetch_url` with content extraction
- [ ] **P2.5.4** — Add search result caching
- **Branch:** `worktree/p2-research-agent`
- **Security scan:** Required after completion

### P2.6 Creative Agent
- [ ] **P2.6.1** — Implement creative writing with higher temperature settings
- [ ] **P2.6.2** — Add draft/edit/revise workflow
- [ ] **P2.6.3** — Implement blog post / social media post templates
- **Branch:** `worktree/p2-creative-agent`
- **Security scan:** Required after completion

### P2.7 Social Agent
- [ ] **P2.7.1** — Implement Twitter/X API integration for posting
- [ ] **P2.7.2** — Implement LinkedIn API integration
- [ ] **P2.7.3** — Add content scheduling and draft review
- **Branch:** `worktree/p2-social-agent`
- **Security scan:** Required — handles social media auth

---

## Phase 3: Memory & Persistence Hardening

> Goal: Bulletproof memory system that survives crashes, accumulates knowledge, and enables cross-agent context.

### P3.1 Memory System Upgrades
- [ ] **P3.1.1** — Add WAL mode to SQLite for concurrent access from worktrees
- [ ] **P3.1.2** — Implement memory compaction (summarize old conversations)
- [ ] **P3.1.3** — Add vector embeddings for semantic search (local embedding model)
- [ ] **P3.1.4** — Implement cross-session context retrieval ("what did I ask about last time?")
- [ ] **P3.1.5** — Add preference learning (track user corrections and adapt)
- [ ] **P3.1.6** — Implement memory export/import for backup
- **Branch:** `worktree/p3-memory`
- **Security scan:** Required — handles persistent user data

### P3.2 Message Storage & Audit Trail
- [ ] **P3.2.1** — Add structured event logging (12-factor-agents pattern)
- [ ] **P3.2.2** — Implement conversation replay from stored messages
- [ ] **P3.2.3** — Add agent attribution to all messages and tool calls
- [ ] **P3.2.4** — Implement message search across sessions
- **Branch:** `worktree/p3-messages`
- **Security scan:** Required after completion

---

## Phase 4: UI & Human-in-the-Loop

> Goal: HumanLayer-style approval system and dashboard for monitoring agents.

### P4.1 Approval System
- [ ] **P4.1.1** — Define risk levels for tool calls (low/medium/high/critical)
- [ ] **P4.1.2** — Implement approval gates for high-risk operations (send email, merge PR, post to Slack)
- [ ] **P4.1.3** — Add approve/deny flow in terminal UI
- [ ] **P4.1.4** — Implement auto-approve for low-risk operations
- **Branch:** `worktree/p4-approvals`
- **Security scan:** Required — security-critical feature

### P4.2 Dashboard / TUI
- [ ] **P4.2.1** — Build Ink-based TUI dashboard showing agent status, task queue, recent activity
- [ ] **P4.2.2** — Add real-time event streaming to dashboard
- [ ] **P4.2.3** — Implement task queue visualization
- [ ] **P4.2.4** — Add conversation history viewer
- **Branch:** `worktree/p4-dashboard`
- **Security scan:** Required after completion

---

## Phase 5: Voice & "Samantha" Experience

> Goal: Talk to Hemingway via microphone, hear responses spoken back.

### P5.1 Speech-to-Text (Input)
- [ ] **P5.1.1** — Integrate Whisper (local) or cloud ASR for mic input
- [ ] **P5.1.2** — Implement wake word detection ("Hemingway")
- [ ] **P5.1.3** — Add push-to-talk and continuous listening modes
- [ ] **P5.1.4** — Wire ASR output into Samantha.process()
- **Branch:** `worktree/p5-voice-input`
- **Security scan:** Required after completion

### P5.2 Text-to-Speech (Output)
- [ ] **P5.2.1** — Integrate CSM or ElevenLabs for speech synthesis
- [ ] **P5.2.2** — Assign distinct voice identities per agent type
- [ ] **P5.2.3** — Implement streaming audio playback
- [ ] **P5.2.4** — Add voice settings (speed, tone, enable/disable)
- **Branch:** `worktree/p5-voice-output`
- **Security scan:** Required after completion

---

## Phase 6: Multi-Agent Orchestration at Scale

> Goal: Multiple agents running in parallel worktrees, coordinated by Samantha.

### P6.1 Parallel Agent Execution
- [ ] **P6.1.1** — Implement agent session isolation (each agent gets own context)
- [ ] **P6.1.2** — Add concurrency limits and depth limits for spawned agents
- [ ] **P6.1.3** — Implement fire-and-forget with announce-back pattern (OpenClaw-inspired)
- [ ] **P6.1.4** — Add agent health monitoring and self-healing (Gas Town-inspired)
- **Branch:** `worktree/p6-parallel`
- **Security scan:** Required after completion

### P6.2 Inter-Agent Communication
- [ ] **P6.2.1** — Define typed message protocol between agents
- [ ] **P6.2.2** — Implement message routing through Samantha
- [ ] **P6.2.3** — Add escalation system (agent → Samantha → human)
- [ ] **P6.2.4** — Implement sub-agent spawning for complex tasks
- **Branch:** `worktree/p6-communication`
- **Security scan:** Required after completion

---

## Cross-Cutting: Security

> Every phase must pass security scanning before merge.

- [ ] **SEC.1** — Run Security-Bot against each completed worktree branch before merge
- [ ] **SEC.2** — Fix all CRITICAL and HIGH findings before merge
- [ ] **SEC.3** — Document MEDIUM/LOW findings with remediation timeline
- [ ] **SEC.4** — Maintain `.security-agent.yml` policy file
- [ ] **SEC.5** — Run `npm audit` on dependency changes

---

## How Agents Use This File

1. **Before starting work:** Read this file. Find the next unchecked task in your assigned phase.
2. **Starting a task:** Change `[ ]` to `[~]` and note your agent name.
3. **Completing a task:** Change `[~]` to `[x]`, commit the change to PLAN.md.
4. **If blocked:** Change to `[!]` and add a note explaining the blocker.
5. **After completing a branch:** Request security scan, then open PR to `main`.
6. **Update CHANGELOG.md** with every meaningful change.
