/**
 * Hemingway - Model Client Factory
 * 
 * Creates and manages LLM clients for different providers.
 * Handles message formatting and response parsing.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { 
  ModelProvider, 
  ProviderConfig, 
  Message, 
  ToolCall, 
  Tool,
  ModelInfo 
} from '../types/index.js';
import { logger, generateId } from '../utils/index.js';
import { modelDetector } from './detector.js';

/**
 * Unified completion options
 */
export interface CompletionOptions {
  model: string;
  messages: Message[];
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Unified completion response
 */
export interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

/**
 * Model Client - unified interface for all providers
 */
export class ModelClient {
  private openaiClients: Map<string, OpenAI> = new Map();
  private anthropicClient?: Anthropic;
  private providerConfigs: Map<ModelProvider, ProviderConfig> = new Map();

  constructor() {}

  /**
   * Configure a provider
   */
  configureProvider(config: ProviderConfig): void {
    this.providerConfigs.set(config.provider, config);

    if (config.provider === 'openai' && config.apiKey) {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      this.openaiClients.set('openai', client);
    }

    if (config.provider === 'lmstudio') {
      const client = new OpenAI({
        apiKey: 'lm-studio',
        baseURL: config.baseUrl || 'http://localhost:1234/v1',
      });
      this.openaiClients.set('lmstudio', client);
    }

    if (config.provider === 'anthropic' && config.apiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: config.apiKey,
      });
    }
  }

  /**
   * Get completion from a model
   */
  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const modelInfo = modelDetector.getModel(options.model);
    
    if (!modelInfo) {
      // Try to determine provider from model string
      if (options.model.startsWith('openai:')) {
        return this.completeOpenAI(options, 'openai');
      } else if (options.model.startsWith('anthropic:')) {
        return this.completeAnthropic(options);
      } else if (options.model.startsWith('lmstudio:')) {
        return this.completeOpenAI(options, 'lmstudio');
      }
      throw new Error(`Unknown model: ${options.model}`);
    }

    switch (modelInfo.provider) {
      case 'openai':
        return this.completeOpenAI(options, 'openai');
      case 'lmstudio':
        return this.completeOpenAI(options, 'lmstudio');
      case 'anthropic':
        return this.completeAnthropic(options);
      default:
        throw new Error(`Unsupported provider: ${modelInfo.provider}`);
    }
  }

  /**
   * Complete using OpenAI-compatible API (OpenAI, LMStudio)
   */
  private async completeOpenAI(
    options: CompletionOptions,
    clientKey: 'openai' | 'lmstudio'
  ): Promise<CompletionResponse> {
    const client = this.openaiClients.get(clientKey);
    if (!client) {
      throw new Error(`${clientKey} client not configured`);
    }

    // Extract the actual model name (remove provider prefix)
    const modelName = options.model.includes(':') 
      ? options.model.split(':')[1] 
      : options.model;

    // Convert messages to OpenAI format
    const messages = this.messagesToOpenAI(options.messages);

    // Convert tools to OpenAI format
    const tools = options.tools?.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.parameters),
      },
    }));

    try {
      const response = await client.chat.completions.create({
        model: modelName,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice.message.content || '',
        toolCalls,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      logger.error(`OpenAI completion failed:`, error);
      throw error;
    }
  }

  /**
   * Complete using Anthropic API
   */
  private async completeAnthropic(options: CompletionOptions): Promise<CompletionResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not configured');
    }

    // Extract the actual model name
    const modelName = options.model.includes(':')
      ? options.model.split(':')[1]
      : options.model;

    // Convert messages to Anthropic format
    const { system, messages } = this.messagesToAnthropic(options.messages);

    // Convert tools to Anthropic format
    const tools = options.tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        ...this.zodToJsonSchema(tool.parameters),
      },
    }));

    try {
      const response = await this.anthropicClient.messages.create({
        model: modelName,
        system: system || undefined,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      });

      // Extract content and tool use
      let content = '';
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      logger.error(`Anthropic completion failed:`, error);
      throw error;
    }
  }

  /**
   * Convert internal messages to OpenAI format
   */
  private messagesToOpenAI(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool' && msg.toolResults) {
        // Tool results need special handling
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolResults[0]?.toolCallId || '',
          content: msg.content,
        };
      }

      if (msg.role === 'assistant' && msg.toolCalls) {
        return {
          role: 'assistant' as const,
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }

      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
    });
  }

  /**
   * Convert internal messages to Anthropic format
   */
  private messagesToAnthropic(messages: Message[]): {
    system: string | null;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | null = null;
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
        continue;
      }

      if (msg.role === 'tool' && msg.toolResults) {
        anthropicMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolResults[0]?.toolCallId || '',
            content: msg.content,
          }],
        });
        continue;
      }

      if (msg.role === 'assistant' && msg.toolCalls) {
        const content: Anthropic.ContentBlock[] = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        anthropicMessages.push({
          role: 'assistant',
          content,
        });
        continue;
      }

      anthropicMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    return { system, messages: anthropicMessages };
  }

  /**
   * Convert Zod schema to JSON Schema (simplified)
   */
  private zodToJsonSchema(schema: unknown): Record<string, unknown> {
    // For now, return a basic schema
    // In production, use a proper zod-to-json-schema library
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  /**
   * Stream completion (for real-time output)
   */
  async *streamComplete(options: CompletionOptions): AsyncGenerator<string> {
    const modelInfo = modelDetector.getModel(options.model);
    
    if (!modelInfo || modelInfo.provider === 'openai' || modelInfo.provider === 'lmstudio') {
      yield* this.streamOpenAI(options, modelInfo?.provider === 'lmstudio' ? 'lmstudio' : 'openai');
    } else if (modelInfo.provider === 'anthropic') {
      yield* this.streamAnthropic(options);
    }
  }

  /**
   * Stream from OpenAI-compatible API
   */
  private async *streamOpenAI(
    options: CompletionOptions,
    clientKey: 'openai' | 'lmstudio'
  ): AsyncGenerator<string> {
    const client = this.openaiClients.get(clientKey);
    if (!client) return;

    const modelName = options.model.includes(':')
      ? options.model.split(':')[1]
      : options.model;

    const messages = this.messagesToOpenAI(options.messages);

    const stream = await client.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Stream from Anthropic API
   */
  private async *streamAnthropic(options: CompletionOptions): AsyncGenerator<string> {
    if (!this.anthropicClient) return;

    const modelName = options.model.includes(':')
      ? options.model.split(':')[1]
      : options.model;

    const { system, messages } = this.messagesToAnthropic(options.messages);

    const stream = await this.anthropicClient.messages.stream({
      model: modelName,
      system: system || undefined,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

// Singleton instance
export const modelClient = new ModelClient();
