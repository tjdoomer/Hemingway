/**
 * Hemingway - Model Detection System
 * 
 * Auto-discovers available models from:
 * - LMStudio local server
 * - OpenAI API
 * - Anthropic API
 * - Ollama (future)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { ModelInfo, ModelProvider, ProviderConfig, ModelCapabilities } from '../types/index.js';
import { logger, retry } from '../utils/index.js';

// Known model capabilities
const MODEL_CAPABILITIES: Record<string, Partial<ModelCapabilities>> = {
  // OpenAI Models
  'gpt-4-turbo': {
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 4096,
  },
  'gpt-4o': {
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 16384,
  },
  'gpt-4o-mini': {
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 16384,
  },
  'gpt-3.5-turbo': {
    contextWindow: 16385,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    maxOutputTokens: 4096,
  },
  // Anthropic Models
  'claude-3-5-sonnet-20241022': {
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 8192,
  },
  'claude-3-opus-20240229': {
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 4096,
  },
  'claude-3-haiku-20240307': {
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    maxOutputTokens: 4096,
  },
};

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  contextWindow: 8192,
  supportsTools: false,
  supportsVision: false,
  supportsStreaming: true,
  maxOutputTokens: 2048,
};

/**
 * Model Detector - discovers available models across providers
 */
export class ModelDetector {
  private detectedModels: Map<string, ModelInfo> = new Map();
  private providerConfigs: Map<ModelProvider, ProviderConfig> = new Map();

  constructor() {}

  /**
   * Configure a provider
   */
  configureProvider(config: ProviderConfig): void {
    this.providerConfigs.set(config.provider, config);
  }

  /**
   * Detect all available models from configured providers
   */
  async detectAll(): Promise<ModelInfo[]> {
    const results: ModelInfo[] = [];
    const detectionPromises: Promise<ModelInfo[]>[] = [];

    // Check LMStudio
    const lmstudioConfig = this.providerConfigs.get('lmstudio');
    if (lmstudioConfig?.isEnabled) {
      detectionPromises.push(this.detectLMStudio(lmstudioConfig));
    }

    // Check OpenAI
    const openaiConfig = this.providerConfigs.get('openai');
    if (openaiConfig?.isEnabled && openaiConfig.apiKey) {
      detectionPromises.push(this.detectOpenAI(openaiConfig));
    }

    // Check Anthropic
    const anthropicConfig = this.providerConfigs.get('anthropic');
    if (anthropicConfig?.isEnabled && anthropicConfig.apiKey) {
      detectionPromises.push(this.detectAnthropic(anthropicConfig));
    }

    // Run all detections in parallel
    const detectionResults = await Promise.allSettled(detectionPromises);
    
    for (const result of detectionResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    }

    // Update cache
    for (const model of results) {
      this.detectedModels.set(model.id, model);
    }

    return results;
  }

  /**
   * Detect LMStudio models
   */
  private async detectLMStudio(config: ProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = config.baseUrl || 'http://localhost:1234/v1';
    const models: ModelInfo[] = [];

    try {
      const client = new OpenAI({
        apiKey: 'lm-studio', // LMStudio doesn't require a real key
        baseURL: baseUrl,
      });

      const response = await retry(
        () => client.models.list(),
        { maxRetries: 2, baseDelay: 500 }
      );

      for await (const model of response) {
        const modelInfo: ModelInfo = {
          id: `lmstudio:${model.id}`,
          name: model.id,
          provider: 'lmstudio',
          isLocal: true,
          capabilities: this.getCapabilities(model.id),
          isAvailable: true,
        };
        models.push(modelInfo);
      }

      logger.info(`Detected ${models.length} LMStudio models`);
    } catch (error) {
      logger.debug('LMStudio not available:', error);
    }

    return models;
  }

  /**
   * Detect OpenAI models
   */
  private async detectOpenAI(config: ProviderConfig): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    try {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });

      // Validate the API key with a simple request
      const response = await retry(
        () => client.models.list(),
        { maxRetries: 2, baseDelay: 500 }
      );

      // Filter to chat models only
      const chatModels = ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];
      
      for await (const model of response) {
        if (chatModels.some(cm => model.id.includes(cm))) {
          const modelInfo: ModelInfo = {
            id: `openai:${model.id}`,
            name: model.id,
            provider: 'openai',
            isLocal: false,
            capabilities: this.getCapabilities(model.id),
            isAvailable: true,
          };
          models.push(modelInfo);
        }
      }

      // Deduplicate by base model name
      const seen = new Set<string>();
      const uniqueModels = models.filter(m => {
        const baseName = m.name.split('-').slice(0, 3).join('-');
        if (seen.has(baseName)) return false;
        seen.add(baseName);
        return true;
      });

      logger.info(`Detected ${uniqueModels.length} OpenAI models`);
      return uniqueModels;
    } catch (error) {
      logger.warn('OpenAI API validation failed:', error);
      return [];
    }
  }

  /**
   * Detect Anthropic models
   */
  private async detectAnthropic(config: ProviderConfig): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    try {
      const client = new Anthropic({
        apiKey: config.apiKey,
      });

      // Anthropic doesn't have a list endpoint, so we validate with a minimal request
      // and return known models
      await retry(
        async () => {
          await client.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          });
        },
        { maxRetries: 2, baseDelay: 500 }
      );

      // Add known Claude models
      const claudeModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307',
      ];

      for (const modelId of claudeModels) {
        const modelInfo: ModelInfo = {
          id: `anthropic:${modelId}`,
          name: modelId,
          provider: 'anthropic',
          isLocal: false,
          capabilities: this.getCapabilities(modelId),
          isAvailable: true,
        };
        models.push(modelInfo);
      }

      logger.info(`Detected ${models.length} Anthropic models`);
    } catch (error) {
      logger.warn('Anthropic API validation failed:', error);
    }

    return models;
  }

  /**
   * Get capabilities for a model
   */
  private getCapabilities(modelId: string): ModelCapabilities {
    // Try exact match first
    if (MODEL_CAPABILITIES[modelId]) {
      return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES[modelId] };
    }

    // Try partial match
    for (const [key, caps] of Object.entries(MODEL_CAPABILITIES)) {
      if (modelId.includes(key)) {
        return { ...DEFAULT_CAPABILITIES, ...caps };
      }
    }

    // For local models, assume reasonable defaults
    return {
      ...DEFAULT_CAPABILITIES,
      contextWindow: 32768, // Most local models have decent context
      supportsTools: true, // Many support tool use
    };
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): ModelInfo | undefined {
    return this.detectedModels.get(modelId);
  }

  /**
   * Get all detected models
   */
  getAllModels(): ModelInfo[] {
    return Array.from(this.detectedModels.values());
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: ModelProvider): ModelInfo[] {
    return this.getAllModels().filter(m => m.provider === provider);
  }

  /**
   * Get local models (for personal agents)
   */
  getLocalModels(): ModelInfo[] {
    return this.getAllModels().filter(m => m.isLocal);
  }

  /**
   * Get cloud models (for work agents)
   */
  getCloudModels(): ModelInfo[] {
    return this.getAllModels().filter(m => !m.isLocal);
  }

  /**
   * Get the best available model for work tasks
   */
  getBestWorkModel(): ModelInfo | undefined {
    const cloudModels = this.getCloudModels();
    
    // Prefer Claude Sonnet or GPT-4o
    const preferred = cloudModels.find(
      m => m.name.includes('claude-3-5-sonnet') || m.name.includes('gpt-4o')
    );
    
    return preferred || cloudModels[0];
  }

  /**
   * Get the best available model for personal tasks
   */
  getBestPersonalModel(): ModelInfo | undefined {
    const localModels = this.getLocalModels();
    
    if (localModels.length > 0) {
      // Prefer larger context models
      return localModels.sort(
        (a, b) => b.capabilities.contextWindow - a.capabilities.contextWindow
      )[0];
    }

    // Fallback to cloud if no local available
    return this.getCloudModels().find(m => m.name.includes('haiku') || m.name.includes('mini'));
  }

  /**
   * Check if any models are available
   */
  hasAvailableModels(): boolean {
    return this.detectedModels.size > 0;
  }

  /**
   * Get a summary of available models
   */
  getSummary(): string {
    const local = this.getLocalModels().length;
    const cloud = this.getCloudModels().length;
    return `${local} local, ${cloud} cloud models available`;
  }
}

// Singleton instance
export const modelDetector = new ModelDetector();
