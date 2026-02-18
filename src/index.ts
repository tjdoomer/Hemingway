/**
 * Hemingway - Multi-Agent AI Orchestration System
 * 
 * "The iceberg theory of AI orchestration"
 * Only 1/8 visible - the rest runs beneath.
 */

// Core
export { Samantha, getSamantha } from './core/index.js';

// Agents
export {
  BaseAgent,
  WorkAgent,
  PersonalAgent,
  GitHubAgent,
  CodingAgent,
  SlackAgent,
  EmailAgent,
  ResearchAgent,
  CalendarAgent,
  CreativeAgent,
  ChatAgent,
  SocialAgent,
  AgentRegistry,
  getAgentRegistry,
} from './agents/index.js';

// Memory
export { MemoryStore, getMemoryStore } from './memory/index.js';

// Models
export {
  ModelDetector,
  modelDetector,
  ModelClient,
  modelClient,
  type CompletionOptions,
  type CompletionResponse,
} from './models/index.js';

// Types
export * from './types/index.js';

// Utils
export * from './utils/index.js';
