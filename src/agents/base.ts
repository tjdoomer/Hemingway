/**
 * Hemingway - Base Agent Class
 * 
 * "Courage is grace under pressure."
 * 
 * All specialized agents inherit from this base class.
 * Each agent is a worker that can execute specific types of tasks.
 */

import type {
  AgentConfig,
  AgentState,
  AgentType,
  AgentRole,
  Task,
  TaskResult,
  Message,
  Tool,
  ToolCall,
  ToolResult,
} from '../types/index.js';
import { modelClient, type CompletionResponse } from '../models/index.js';
import { modelDetector } from '../models/detector.js';
import { getMemoryStore } from '../memory/index.js';
import { generateId, logger } from '../utils/index.js';
import EventEmitter from 'eventemitter3';

interface AgentEvents {
  'started': (task: Task) => void;
  'thinking': (message: string) => void;
  'tool_call': (toolCall: ToolCall) => void;
  'tool_result': (result: ToolResult) => void;
  'completed': (task: Task, result: TaskResult) => void;
  'failed': (task: Task, error: Error) => void;
  'message': (message: string) => void;
}

/**
 * Base Agent - foundation for all specialized agents
 */
export abstract class BaseAgent extends EventEmitter<AgentEvents> {
  protected config: AgentConfig;
  protected state: AgentState;
  protected tools: Map<string, Tool> = new Map();
  protected modelId: string | null = null;

  constructor(config: Partial<AgentConfig> & { id: string; name: string; role: AgentRole }) {
    super();
    
    this.config = {
      id: config.id,
      name: config.name,
      type: config.type || 'work',
      role: config.role,
      description: config.description || '',
      preferredProvider: config.preferredProvider || 'openai',
      preferredModel: config.preferredModel,
      systemPrompt: config.systemPrompt || this.getDefaultSystemPrompt(),
      tools: config.tools || [],
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
    };

    this.state = {
      id: config.id,
      isActive: false,
      conversationHistory: [],
    };
  }

  /**
   * Initialize the agent with the best available model
   */
  async initialize(): Promise<void> {
    // Find appropriate model based on agent type
    const model = this.config.type === 'personal'
      ? modelDetector.getBestPersonalModel()
      : modelDetector.getBestWorkModel();

    if (model) {
      this.modelId = model.id;
      logger.info(`${this.config.name} initialized with model: ${model.name}`);
    } else {
      logger.warn(`${this.config.name}: No models available`);
    }

    // Register tools
    this.registerTools();
  }

  /**
   * Get default system prompt - override in subclasses
   */
  protected abstract getDefaultSystemPrompt(): string;

  /**
   * Register tools - override in subclasses
   */
  protected abstract registerTools(): void;

  /**
   * Execute a task
   */
  async execute(task: Task): Promise<TaskResult> {
    this.state.isActive = true;
    this.state.currentTask = task;
    this.state.lastActivity = new Date();
    this.emit('started', task);

    try {
      // Build the conversation
      const messages = this.buildMessages(task);

      // Run the agent loop
      let iterations = 0;
      const maxIterations = 10;

      while (iterations < maxIterations) {
        iterations++;
        this.emit('thinking', `Processing (iteration ${iterations})...`);

        // Get completion from model
        const response = await this.getCompletion(messages);

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            this.emit('tool_call', toolCall);
            const result = await this.executeTool(toolCall);
            this.emit('tool_result', result);

            // Add to messages
            messages.push({
              id: generateId(),
              role: 'assistant',
              content: response.content,
              toolCalls: [toolCall],
              timestamp: new Date(),
            });
            messages.push({
              id: generateId(),
              role: 'tool',
              content: result.output || result.error || '',
              toolResults: [result],
              timestamp: new Date(),
            });
          }
        } else {
          // No more tool calls, we're done
          const result: TaskResult = {
            success: true,
            output: response.content,
          };

          task.status = 'completed';
          task.completedAt = new Date();
          task.result = result;

          this.emit('completed', task, result);
          return result;
        }
      }

      // Max iterations reached
      const result: TaskResult = {
        success: false,
        error: 'Max iterations reached without completion',
      };

      task.status = 'failed';
      task.result = result;
      this.emit('failed', task, new Error(result.error!));

      return result;
    } catch (error) {
      const err = error as Error;
      const result: TaskResult = {
        success: false,
        error: err.message,
      };

      task.status = 'failed';
      task.result = result;
      this.emit('failed', task, err);

      return result;
    } finally {
      this.state.isActive = false;
      this.state.currentTask = undefined;
    }
  }

  /**
   * Build messages for the conversation
   */
  protected buildMessages(task: Task): Message[] {
    const messages: Message[] = [
      {
        id: 'system',
        role: 'system',
        content: this.config.systemPrompt,
        timestamp: new Date(),
      },
    ];

    // Add conversation history
    messages.push(...this.state.conversationHistory.slice(-10));

    // Add the task
    messages.push({
      id: generateId(),
      role: 'user',
      content: `Task: ${task.title}\n\nDescription: ${task.description}`,
      timestamp: new Date(),
    });

    return messages;
  }

  /**
   * Get completion from the model
   */
  protected async getCompletion(messages: Message[]): Promise<CompletionResponse> {
    if (!this.modelId) {
      throw new Error('No model available');
    }

    const tools = Array.from(this.tools.values());

    return modelClient.complete({
      model: this.modelId,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });
  }

  /**
   * Execute a tool call
   */
  protected async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: `Unknown tool: ${toolCall.name}`,
      };
    }

    try {
      return await tool.execute(toolCall.arguments);
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Register a tool
   */
  protected registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get agent config
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Check if agent is active
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Add message to history
   */
  addToHistory(message: Message): void {
    this.state.conversationHistory.push(message);
    // Keep history manageable
    if (this.state.conversationHistory.length > 50) {
      this.state.conversationHistory = this.state.conversationHistory.slice(-30);
    }
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.conversationHistory = [];
  }
}

/**
 * Work Agent - handles professional tasks
 */
export abstract class WorkAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> & { id: string; name: string; role: AgentRole }) {
    super({ ...config, type: 'work' });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are a professional ${this.config.role} agent within the Hemingway system.
Your job is to help with work-related tasks efficiently and professionally.
Be concise, accurate, and thorough. Focus on delivering results.
When using tools, explain what you're doing briefly.`;
  }
}

/**
 * Personal Agent - handles life/personal tasks
 */
export abstract class PersonalAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> & { id: string; name: string; role: AgentRole }) {
    super({ ...config, type: 'personal' });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are a friendly personal assistant agent within the Hemingway system.
Your job is to help with personal tasks in a warm and supportive way.
Be personable, helpful, and considerate. Respect privacy.
When using tools, explain what you're doing in a friendly manner.`;
  }
}
