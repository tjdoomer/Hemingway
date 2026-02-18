/**
 * Hemingway - Memory Store
 * 
 * "A man's got to take a lot of punishment to write a really funny book."
 * - But he doesn't have to lose his memories.
 * 
 * Multi-layer memory system:
 * - Session: Active conversation context
 * - Episodic: Task completion history
 * - Semantic: Learned patterns and preferences
 * - Working: Current task state across agents
 */

import Database from 'better-sqlite3';
import type { 
  MemoryEntry, 
  MemoryType, 
  Message, 
  Task, 
  ConversationContext 
} from '../types/index.js';
import { generateId, expandPath, ensureDir, logger } from '../utils/index.js';
import path from 'path';

/**
 * Memory Store - persistent memory across sessions
 */
export class MemoryStore {
  private db: Database.Database;
  private sessionId: string;
  private workingMemory: Map<string, unknown> = new Map();

  constructor(dbPath: string = '~/.hemingway/memory.db') {
    const expandedPath = expandPath(dbPath);
    
    // Ensure directory exists
    const dir = path.dirname(expandedPath);
    ensureDir(dir).catch(err => logger.error('Failed to create memory dir:', err));

    this.db = new Database(expandedPath);
    this.sessionId = generateId();
    this.initializeSchema();
    
    logger.info(`Memory store initialized at ${expandedPath}`);
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      -- Memory entries table
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT,
        created_at TEXT NOT NULL,
        accessed_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 1,
        importance REAL DEFAULT 0.5
      );

      -- Messages table for conversation history
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        agent_id TEXT,
        tool_calls TEXT,
        tool_results TEXT,
        timestamp TEXT NOT NULL
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        assigned_agent TEXT,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        result TEXT,
        metadata TEXT
      );

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT,
        metadata TEXT
      );

      -- Preferences table (semantic memory)
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        updated_at TEXT NOT NULL
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
    `);

    // Record current session
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, started_at) VALUES (?, ?)
    `);
    stmt.run(this.sessionId, new Date().toISOString());
  }

  // ===========================================================================
  // Session Memory (Active conversation)
  // ===========================================================================

  /**
   * Add a message to the current session
   */
  addMessage(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, agent_id, tool_calls, tool_results, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      this.sessionId,
      message.role,
      message.content,
      message.agentId || null,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.toolResults ? JSON.stringify(message.toolResults) : null,
      message.timestamp.toISOString()
    );
  }

  /**
   * Get messages from current session
   */
  getSessionMessages(limit: number = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(this.sessionId, limit) as Array<{
      id: string;
      role: string;
      content: string;
      agent_id: string | null;
      tool_calls: string | null;
      tool_results: string | null;
      timestamp: string;
    }>;

    return rows.reverse().map(row => ({
      id: row.id,
      role: row.role as Message['role'],
      content: row.content,
      agentId: row.agent_id || undefined,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      timestamp: new Date(row.timestamp),
    }));
  }

  /**
   * Get recent messages across sessions (for context)
   */
  getRecentMessages(limit: number = 20): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      id: string;
      role: string;
      content: string;
      agent_id: string | null;
      tool_calls: string | null;
      tool_results: string | null;
      timestamp: string;
    }>;

    return rows.reverse().map(row => ({
      id: row.id,
      role: row.role as Message['role'],
      content: row.content,
      agentId: row.agent_id || undefined,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      timestamp: new Date(row.timestamp),
    }));
  }

  // ===========================================================================
  // Episodic Memory (Task history)
  // ===========================================================================

  /**
   * Store a task
   */
  storeTask(task: Task): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks 
      (id, title, description, type, assigned_agent, priority, status, created_at, updated_at, completed_at, result, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.title,
      task.description,
      task.type,
      task.assignedAgent || null,
      task.priority,
      task.status,
      task.createdAt.toISOString(),
      task.updatedAt.toISOString(),
      task.completedAt?.toISOString() || null,
      task.result ? JSON.stringify(task.result) : null,
      JSON.stringify(task.metadata)
    );
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`);
    const row = stmt.get(taskId) as {
      id: string;
      title: string;
      description: string;
      type: string;
      assigned_agent: string | null;
      priority: string;
      status: string;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
      result: string | null;
      metadata: string;
    } | undefined;

    if (!row) return undefined;

    return this.rowToTask(row);
  }

  /**
   * Get recent completed tasks (for learning)
   */
  getRecentTasks(limit: number = 20, status?: Task['status']): Task[] {
    let query = `SELECT * FROM tasks`;
    const params: (string | number)[] = [];

    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    query += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      assigned_agent: string | null;
      priority: string;
      status: string;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
      result: string | null;
      metadata: string;
    }>;

    return rows.map(row => this.rowToTask(row));
  }

  /**
   * Get similar past tasks (by keywords)
   */
  getSimilarTasks(keywords: string[], limit: number = 5): Task[] {
    const keywordPattern = keywords.map(k => `%${k.toLowerCase()}%`);
    const conditions = keywordPattern.map(() => `(LOWER(title) LIKE ? OR LOWER(description) LIKE ?)`);
    
    const query = `
      SELECT * FROM tasks 
      WHERE ${conditions.join(' OR ')}
      ORDER BY updated_at DESC
      LIMIT ?
    `;

    const params: string[] = [];
    for (const pattern of keywordPattern) {
      params.push(pattern, pattern);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params, limit) as Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      assigned_agent: string | null;
      priority: string;
      status: string;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
      result: string | null;
      metadata: string;
    }>;

    return rows.map(row => this.rowToTask(row));
  }

  private rowToTask(row: {
    id: string;
    title: string;
    description: string;
    type: string;
    assigned_agent: string | null;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    result: string | null;
    metadata: string;
  }): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type as Task['type'],
      assignedAgent: row.assigned_agent || undefined,
      priority: row.priority as Task['priority'],
      status: row.status as Task['status'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      metadata: JSON.parse(row.metadata),
    };
  }

  // ===========================================================================
  // Semantic Memory (Preferences and patterns)
  // ===========================================================================

  /**
   * Store a preference or learned pattern
   */
  storePreference(key: string, value: unknown, confidence: number = 0.5): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO preferences (key, value, confidence, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(key, JSON.stringify(value), confidence, new Date().toISOString());
  }

  /**
   * Get a preference
   */
  getPreference<T>(key: string): { value: T; confidence: number } | undefined {
    const stmt = this.db.prepare(`SELECT value, confidence FROM preferences WHERE key = ?`);
    const row = stmt.get(key) as { value: string; confidence: number } | undefined;

    if (!row) return undefined;

    return {
      value: JSON.parse(row.value) as T,
      confidence: row.confidence,
    };
  }

  /**
   * Get all preferences matching a pattern
   */
  getPreferencesByPattern(pattern: string): Array<{ key: string; value: unknown; confidence: number }> {
    const stmt = this.db.prepare(`
      SELECT key, value, confidence FROM preferences WHERE key LIKE ?
    `);

    const rows = stmt.all(`%${pattern}%`) as Array<{
      key: string;
      value: string;
      confidence: number;
    }>;

    return rows.map(row => ({
      key: row.key,
      value: JSON.parse(row.value),
      confidence: row.confidence,
    }));
  }

  // ===========================================================================
  // Working Memory (Current state)
  // ===========================================================================

  /**
   * Set a working memory value
   */
  setWorkingMemory(key: string, value: unknown): void {
    this.workingMemory.set(key, value);
  }

  /**
   * Get a working memory value
   */
  getWorkingMemory<T>(key: string): T | undefined {
    return this.workingMemory.get(key) as T | undefined;
  }

  /**
   * Clear working memory
   */
  clearWorkingMemory(): void {
    this.workingMemory.clear();
  }

  /**
   * Get current context for an agent
   */
  getConversationContext(): ConversationContext {
    return {
      sessionId: this.sessionId,
      messages: this.getSessionMessages(),
      activeTask: this.getWorkingMemory<Task>('activeTask'),
      workingMemory: this.workingMemory,
    };
  }

  // ===========================================================================
  // General Memory Operations
  // ===========================================================================

  /**
   * Store a memory entry
   */
  storeMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'accessedAt' | 'accessCount'>): string {
    const id = generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, type, content, embedding, metadata, created_at, accessed_at, access_count, importance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      entry.type,
      entry.content,
      entry.embedding ? Buffer.from(new Float32Array(entry.embedding).buffer) : null,
      JSON.stringify(entry.metadata),
      now,
      now,
      1,
      entry.importance
    );

    return id;
  }

  /**
   * Retrieve memories by type
   */
  getMemoriesByType(type: MemoryType, limit: number = 20): MemoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memories WHERE type = ? ORDER BY accessed_at DESC LIMIT ?
    `);

    const rows = stmt.all(type, limit) as Array<{
      id: string;
      type: string;
      content: string;
      embedding: Buffer | null;
      metadata: string;
      created_at: string;
      accessed_at: string;
      access_count: number;
      importance: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      type: row.type as MemoryType,
      content: row.content,
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
      accessedAt: new Date(row.accessed_at),
      accessCount: row.access_count,
      importance: row.importance,
    }));
  }

  /**
   * Search memories by content
   */
  searchMemories(query: string, limit: number = 10): MemoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memories 
      WHERE content LIKE ? 
      ORDER BY importance DESC, accessed_at DESC 
      LIMIT ?
    `);

    const rows = stmt.all(`%${query}%`, limit) as Array<{
      id: string;
      type: string;
      content: string;
      embedding: Buffer | null;
      metadata: string;
      created_at: string;
      accessed_at: string;
      access_count: number;
      importance: number;
    }>;

    // Update access counts
    for (const row of rows) {
      const updateStmt = this.db.prepare(`
        UPDATE memories SET access_count = access_count + 1, accessed_at = ? WHERE id = ?
      `);
      updateStmt.run(new Date().toISOString(), row.id);
    }

    return rows.map(row => ({
      id: row.id,
      type: row.type as MemoryType,
      content: row.content,
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
      accessedAt: new Date(row.accessed_at),
      accessCount: row.access_count,
      importance: row.importance,
    }));
  }

  /**
   * End current session
   */
  endSession(summary?: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions SET ended_at = ?, summary = ? WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), summary || null, this.sessionId);
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let memoryStore: MemoryStore | null = null;

export function getMemoryStore(dbPath?: string): MemoryStore {
  if (!memoryStore) {
    memoryStore = new MemoryStore(dbPath);
  }
  return memoryStore;
}
