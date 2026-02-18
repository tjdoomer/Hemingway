/**
 * Hemingway - Agents Module
 */

export { BaseAgent, WorkAgent, PersonalAgent } from './base.js';
export {
  GitHubAgent,
  CodingAgent,
  SlackAgent,
  EmailAgent,
  ResearchAgent,
  CalendarAgent,
  CreativeAgent,
  ChatAgent,
  SocialAgent,
} from './specialized.js';
export { AgentRegistry, getAgentRegistry } from './registry.js';
