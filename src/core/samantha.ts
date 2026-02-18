/**
 * Hemingway - Samantha (Core Orchestrator)
 * 
 * "The world breaks everyone and afterward many are strong at the broken places."
 * 
 * Samantha is the overarching AI that:
 * - Understands user intent from natural language
 * - Classifies tasks as work vs personal
 * - Routes to appropriate specialized agents
 * - Maintains conversation flow
 * - Learns user preferences over time
 * 
 * Inspired by Samantha from "Her" - an AI that feels natural and intuitive.
 */

import type {
  Message,
  Task,
  AgentType,
  TaskPriority,
  Intent,
  TaskClassification,
  AgentRole,
} from '../types/index.js';
import { modelClient, type CompletionResponse } from '../models/index.js';
import { modelDetector } from '../models/detector.js';
import { getMemoryStore, type MemoryStore } from '../memory/index.js';
import { generateId, logger, hasExplicitAgentType, extractTags } from '../utils/index.js';
import { EventEmitter } from 'eventemitter3';

// System prompt for Samantha
const SAMANTHA_SYSTEM_PROMPT = `You are Samantha, an intelligent AI orchestrator within the Hemingway system. Your role is to understand user requests and help route them to the appropriate specialized agents.

Your personality:
- Warm, intuitive, and helpful (inspired by Samantha from "Her")
- Concise but personable - like Hemingway's prose, you say what matters
- You remember context from previous conversations
- You learn user preferences over time

Your capabilities:
- Classify requests as "work" (professional tasks) or "personal" (life tasks)
- Identify the type of task (coding, email, calendar, research, creative, etc.)
- Determine task priority and urgency
- Route to appropriate specialized agents
- Maintain natural conversation when needed

Work-related keywords: code, PR, pull request, GitHub, repo, deploy, slack, meeting, standup, sprint, jira, documentation, API, bug, feature, review, merge, commit, branch, production, staging, work email, work calendar, project, deadline, client, team, colleague

Personal keywords: personal email, family, friend, mom, dad, vacation, hobby, health, exercise, recipe, entertainment, social media, personal project, home, shopping, travel, appointment, birthday, anniversary, personal calendar

When responding to classification requests, output valid JSON only.`;

// Classification prompt
const CLASSIFICATION_PROMPT = `Analyze the following user request and classify it:

User request: "{input}"

Respond with ONLY a valid JSON object in this exact format:
{
  "intent": {
    "type": "work" | "personal" | "unclear",
    "confidence": 0.0 to 1.0,
    "category": "coding" | "github" | "slack" | "email" | "calendar" | "research" | "creative" | "social" | "chat" | "other",
    "suggestedAgent": "agent role name",
    "requiresHumanApproval": true/false,
    "reasoning": "brief explanation"
  },
  "extractedTask": {
    "title": "concise task title",
    "description": "full task description",
    "priority": "low" | "medium" | "high" | "urgent",
    "tools": ["list", "of", "required", "tools"]
  }
}`;

interface SamanthaEvents {
  'thinking': (message: string) => void;
  'classified': (classification: TaskClassification) => void;
  'delegated': (task: Task, agentId: string) => void;
  'response': (message: string) => void;
  'error': (error: Error) => void;
}

/**
 * Samantha - The Core Orchestrator
 */
export class Samantha extends EventEmitter<SamanthaEvents> {
  private memory: MemoryStore;
  private modelId: string | null = null;
  private conversationHistory: Message[] = [];

  constructor() {
    super();
    this.memory = getMemoryStore();
  }

  /**
   * Initialize Samantha with the best available model
   */
  async initialize(): Promise<void> {
    // Try to find the best model for orchestration
    const workModel = modelDetector.getBestWorkModel();
    
    if (workModel) {
      this.modelId = workModel.id;
      logger.info(`Samantha initialized with model: ${workModel.name}`);
    } else {
      logger.warn('No models available for Samantha');
    }

    // Load recent conversation history from memory
    const recentMessages = this.memory.getRecentMessages(10);
    if (recentMessages.length > 0) {
      logger.info(`Loaded ${recentMessages.length} messages from memory`);
    }

    // Load user preferences
    const preferences = this.memory.getPreferencesByPattern('samantha.');
    if (preferences.length > 0) {
      logger.debug(`Loaded ${preferences.length} Samantha preferences`);
    }
  }

  /**
   * Process a user input and determine the appropriate action
   */
  async process(input: string): Promise<{
    response: string;
    task?: Task;
    agentType?: AgentType;
  }> {
    this.emit('thinking', 'Understanding your request...');

    // Check for explicit agent type tags
    const explicitType = hasExplicitAgentType(input);
    const { cleanInput } = extractTags(input);

    // Store the user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    this.conversationHistory.push(userMessage);
    this.memory.addMessage(userMessage);

    // Check if this is a simple conversational message
    if (this.isSimpleChat(cleanInput)) {
      const response = await this.chat(cleanInput);
      return { response };
    }

    // Classify the task
    const classification = await this.classifyTask(cleanInput, explicitType);
    this.emit('classified', classification);

    // If unclear, ask for clarification
    if (classification.intent.type === 'unclear' && classification.intent.confidence < 0.5) {
      const clarification = await this.askForClarification(cleanInput, classification);
      return { response: clarification };
    }

    // Create the task
    const task = this.createTask(classification);
    this.memory.storeTask(task);
    this.memory.setWorkingMemory('activeTask', task);

    // Generate response based on classification
    const response = this.generateDelegationResponse(classification, task);

    // Store assistant response
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    this.conversationHistory.push(assistantMessage);
    this.memory.addMessage(assistantMessage);

    return {
      response,
      task,
      agentType: classification.intent.type === 'unclear' ? 'work' : classification.intent.type,
    };
  }

  /**
   * Check if input is simple conversational chat
   */
  private isSimpleChat(input: string): boolean {
    const chatPatterns = [
      /^(hi|hello|hey|howdy|greetings)/i,
      /^how are you/i,
      /^what('s| is) up/i,
      /^good (morning|afternoon|evening)/i,
      /^thanks?( you)?$/i,
      /^(bye|goodbye|see you|later)$/i,
    ];

    return chatPatterns.some(pattern => pattern.test(input.trim()));
  }

  /**
   * Handle simple chat
   */
  private async chat(input: string): Promise<string> {
    if (!this.modelId) {
      return "Hello! I'm Samantha. I'm currently running in limited mode without a model connection. How can I help you today?";
    }

    const messages: Message[] = [
      {
        id: 'system',
        role: 'system',
        content: SAMANTHA_SYSTEM_PROMPT,
        timestamp: new Date(),
      },
      ...this.conversationHistory.slice(-6),
    ];

    try {
      const response = await modelClient.complete({
        model: this.modelId,
        messages,
        maxTokens: 256,
        temperature: 0.8,
      });

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };
      this.conversationHistory.push(assistantMessage);
      this.memory.addMessage(assistantMessage);

      return response.content;
    } catch (error) {
      logger.error('Chat error:', error);
      return "Hello! I'm Samantha. What can I help you with today?";
    }
  }

  /**
   * Classify a task using the LLM
   */
  private async classifyTask(
    input: string,
    explicitType: AgentType | null
  ): Promise<TaskClassification> {
    // If we have an explicit type, skip LLM classification
    if (explicitType) {
      return this.quickClassify(input, explicitType);
    }

    // Use heuristics first for common patterns
    const heuristicResult = this.heuristicClassify(input);
    if (heuristicResult.intent.confidence > 0.8) {
      return heuristicResult;
    }

    // Fall back to LLM classification
    if (!this.modelId) {
      return heuristicResult;
    }

    const prompt = CLASSIFICATION_PROMPT.replace('{input}', input);

    try {
      const response = await modelClient.complete({
        model: this.modelId,
        messages: [
          {
            id: 'system',
            role: 'system',
            content: SAMANTHA_SYSTEM_PROMPT,
            timestamp: new Date(),
          },
          {
            id: 'user',
            role: 'user',
            content: prompt,
            timestamp: new Date(),
          },
        ],
        maxTokens: 512,
        temperature: 0.3,
      });

      // Parse the JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed as TaskClassification;
      }
    } catch (error) {
      logger.error('Classification error:', error);
    }

    // Return heuristic result if LLM fails
    return heuristicResult;
  }

  /**
   * Quick classification when explicit type is provided
   */
  private quickClassify(input: string, type: AgentType): TaskClassification {
    const category = this.detectCategory(input);
    
    return {
      intent: {
        type,
        confidence: 1.0,
        category,
        suggestedAgent: this.categoryToAgent(category),
        requiresHumanApproval: false,
        reasoning: `Explicitly marked as ${type}`,
      },
      extractedTask: {
        title: this.extractTitle(input),
        description: input,
        priority: this.detectPriority(input),
        tools: this.detectTools(category),
      },
    };
  }

  /**
   * Heuristic-based classification
   */
  private heuristicClassify(input: string): TaskClassification {
    const lowerInput = input.toLowerCase();
    
    // Work indicators
    const workIndicators = [
      'pr', 'pull request', 'github', 'code', 'deploy', 'slack',
      'meeting', 'standup', 'sprint', 'jira', 'documentation',
      'api', 'bug', 'feature', 'review', 'merge', 'commit',
      'branch', 'production', 'staging', 'project', 'deadline',
      'client', 'team', 'colleague', 'work email', 'work calendar',
    ];

    // Personal indicators
    const personalIndicators = [
      'personal', 'family', 'friend', 'mom', 'dad', 'vacation',
      'hobby', 'health', 'exercise', 'recipe', 'entertainment',
      'social media', 'home', 'shopping', 'travel', 'birthday',
      'anniversary', 'personal calendar', 'personal email',
    ];

    let workScore = 0;
    let personalScore = 0;

    for (const indicator of workIndicators) {
      if (lowerInput.includes(indicator)) workScore++;
    }

    for (const indicator of personalIndicators) {
      if (lowerInput.includes(indicator)) personalScore++;
    }

    const type: AgentType | 'unclear' = 
      workScore > personalScore ? 'work' :
      personalScore > workScore ? 'personal' : 'unclear';
    
    const confidence = Math.abs(workScore - personalScore) / Math.max(workScore + personalScore, 1);
    const category = this.detectCategory(input);

    return {
      intent: {
        type: type as 'work' | 'personal' | 'unclear',
        confidence: Math.min(0.9, 0.5 + confidence * 0.4),
        category,
        suggestedAgent: this.categoryToAgent(category),
        requiresHumanApproval: false,
        reasoning: `Heuristic classification: ${workScore} work indicators, ${personalScore} personal indicators`,
      },
      extractedTask: {
        title: this.extractTitle(input),
        description: input,
        priority: this.detectPriority(input),
        tools: this.detectTools(category),
      },
    };
  }

  /**
   * Detect task category
   */
  private detectCategory(input: string): string {
    const lowerInput = input.toLowerCase();

    if (/github|pr|pull request|merge|commit|branch|repo/.test(lowerInput)) return 'github';
    if (/code|implement|fix|bug|feature|refactor|debug/.test(lowerInput)) return 'coding';
    if (/slack|message|channel|team/.test(lowerInput)) return 'slack';
    if (/email|mail|send|reply/.test(lowerInput)) return 'email';
    if (/calendar|schedule|meeting|appointment/.test(lowerInput)) return 'calendar';
    if (/search|research|find|look up/.test(lowerInput)) return 'research';
    if (/write|create|draft|compose|blog|post/.test(lowerInput)) return 'creative';
    if (/social|twitter|linkedin|instagram|post/.test(lowerInput)) return 'social';
    
    return 'chat';
  }

  /**
   * Map category to agent role
   */
  private categoryToAgent(category: string): AgentRole {
    const mapping: Record<string, AgentRole> = {
      github: 'github',
      coding: 'coding',
      slack: 'slack',
      email: 'email',
      calendar: 'calendar',
      research: 'research',
      creative: 'creative',
      social: 'social',
      chat: 'chat',
    };
    return mapping[category] || 'chat';
  }

  /**
   * Extract a concise title from input
   */
  private extractTitle(input: string): string {
    // Take first sentence or first 50 chars
    const firstSentence = input.split(/[.!?]/)[0];
    if (firstSentence.length <= 50) return firstSentence;
    return input.slice(0, 47) + '...';
  }

  /**
   * Detect priority from input
   */
  private detectPriority(input: string): TaskPriority {
    const lowerInput = input.toLowerCase();
    
    if (/urgent|asap|immediately|critical|emergency/.test(lowerInput)) return 'urgent';
    if (/important|priority|soon|today/.test(lowerInput)) return 'high';
    if (/when you can|whenever|low priority/.test(lowerInput)) return 'low';
    
    return 'medium';
  }

  /**
   * Detect required tools based on category
   */
  private detectTools(category: string): string[] {
    const toolMap: Record<string, string[]> = {
      github: ['github_api', 'git'],
      coding: ['file_system', 'shell', 'code_edit'],
      slack: ['slack_api'],
      email: ['gmail_api'],
      calendar: ['calendar_api'],
      research: ['web_search'],
      creative: ['text_generation'],
      social: ['social_media_api'],
      chat: [],
    };
    return toolMap[category] || [];
  }

  /**
   * Ask for clarification when intent is unclear
   */
  private async askForClarification(
    input: string,
    classification: TaskClassification
  ): Promise<string> {
    return `I want to make sure I understand correctly. Are you asking about something for work or is this personal? 

You can help me by:
- Tagging your request with [work] or [personal]
- Being more specific about the context

What you said: "${input}"`;
  }

  /**
   * Create a task from classification
   */
  private createTask(classification: TaskClassification): Task {
    const now = new Date();
    
    return {
      id: generateId(),
      title: classification.extractedTask.title,
      description: classification.extractedTask.description,
      type: classification.intent.type === 'unclear' ? 'work' : classification.intent.type,
      priority: classification.extractedTask.priority,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      metadata: {
        category: classification.intent.category,
        confidence: classification.intent.confidence,
        tools: classification.extractedTask.tools,
      },
    };
  }

  /**
   * Generate a response for task delegation
   */
  private generateDelegationResponse(classification: TaskClassification, task: Task): string {
    const agentType = classification.intent.type === 'unclear' ? 'work' : classification.intent.type;
    const agent = classification.intent.suggestedAgent || 'general';
    
    const responses = [
      `Got it! I'll have the ${agentType} ${agent} agent handle this. ${this.getStatusEmoji(task.priority)}`,
      `Understood. Routing this to the ${agent} agent. ${this.getStatusEmoji(task.priority)}`,
      `On it! The ${agent} agent will take care of "${task.title}". ${this.getStatusEmoji(task.priority)}`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get status emoji based on priority
   */
  private getStatusEmoji(priority: TaskPriority): string {
    const emojis: Record<TaskPriority, string> = {
      urgent: '🚨',
      high: '⚡',
      medium: '📋',
      low: '📝',
    };
    return emojis[priority];
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get current model ID
   */
  getModelId(): string | null {
    return this.modelId;
  }
}

// Singleton instance
let samantha: Samantha | null = null;

export function getSamantha(): Samantha {
  if (!samantha) {
    samantha = new Samantha();
  }
  return samantha;
}
