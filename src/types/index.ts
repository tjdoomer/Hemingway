/**
 * Hemingway - Core Type Definitions
 * 
 * "The iceberg theory" - only one-eighth visible,
 * yet the types define the entire structure beneath.
 */

import { z } from 'zod';

// =============================================================================
// Model & Provider Types
// =============================================================================

export type ModelProvider = 'openai' | 'anthropic' | 'lmstudio' | 'ollama';

export interface ModelCapabilities {
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxOutputTokens: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  isLocal: boolean;
  capabilities: ModelCapabilities;
  isAvailable: boolean;
}

export interface ProviderConfig {
  provider: ModelProvider;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  isEnabled: boolean;
}

// =============================================================================
// Agent Types
// =============================================================================

export type AgentType = 'work' | 'personal';
export type AgentRole = 
  | 'orchestrator'  // Samantha
  | 'coding'
  | 'github'
  | 'slack'
  | 'email'
  | 'calendar'
  | 'research'
  | 'creative'
  | 'social'
  | 'chat';

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  role: AgentRole;
  description: string;
  preferredProvider: ModelProvider;
  preferredModel?: string;
  systemPrompt: string;
  tools: string[];
  maxTokens: number;
  temperature: number;
}

export interface AgentState {
  id: string;
  isActive: boolean;
  currentTask?: Task;
  lastActivity?: Date;
  conversationHistory: Message[];
}

// =============================================================================
// Task & Message Types
// =============================================================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'waiting_input' | 'completed' | 'failed';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: AgentType;
  assignedAgent?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: TaskResult;
  metadata: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: Artifact[];
}

export interface Artifact {
  type: 'file' | 'link' | 'message' | 'code';
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  agentId?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

// =============================================================================
// Tool Types
// =============================================================================

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
  execute: (params: unknown) => Promise<ToolResult>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output?: string;
  error?: string;
}

// =============================================================================
// Memory Types
// =============================================================================

export type MemoryType = 'session' | 'episodic' | 'semantic' | 'working';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  importance: number;
}

export interface ConversationContext {
  sessionId: string;
  messages: Message[];
  activeTask?: Task;
  workingMemory: Map<string, unknown>;
}

// =============================================================================
// Event Types
// =============================================================================

export type EventType =
  | 'user_input'
  | 'agent_response'
  | 'task_created'
  | 'task_completed'
  | 'task_failed'
  | 'tool_called'
  | 'tool_result'
  | 'memory_stored'
  | 'model_switched'
  | 'error';

export interface HemingwayEvent {
  type: EventType;
  timestamp: Date;
  data: unknown;
  source?: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface HemingwayConfig {
  providers: ProviderConfig[];
  defaultWorkModel: string;
  defaultPersonalModel: string;
  memoryDbPath: string;
  voiceEnabled: boolean;
  voiceWakeWord: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFile?: string;
}

// =============================================================================
// Intent Classification
// =============================================================================

export const IntentSchema = z.object({
  type: z.enum(['work', 'personal', 'unclear']),
  confidence: z.number().min(0).max(1),
  category: z.string(),
  suggestedAgent: z.string().optional(),
  requiresHumanApproval: z.boolean(),
  reasoning: z.string(),
});

export type Intent = z.infer<typeof IntentSchema>;

export const TaskClassificationSchema = z.object({
  intent: IntentSchema,
  extractedTask: z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    tools: z.array(z.string()),
  }),
});

export type TaskClassification = z.infer<typeof TaskClassificationSchema>;
