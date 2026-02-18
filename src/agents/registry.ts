/**
 * Hemingway - Agent Registry
 * 
 * Central registry for all agents in the system.
 */

import type { AgentRole, AgentType, Task } from '../types/index.js';
import { BaseAgent } from './base.js';
import {
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
import { logger } from '../utils/index.js';

/**
 * Agent Registry - manages all agent instances
 */
export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private initialized: boolean = false;

  constructor() {}

  /**
   * Initialize all agents
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create all agent instances
    const agentClasses = [
      GitHubAgent,
      CodingAgent,
      SlackAgent,
      EmailAgent,
      ResearchAgent,
      CalendarAgent,
      CreativeAgent,
      ChatAgent,
      SocialAgent,
    ];

    for (const AgentClass of agentClasses) {
      const agent = new AgentClass();
      await agent.initialize();
      this.agents.set(agent.getConfig().id, agent);
      this.agents.set(agent.getConfig().role, agent);
    }

    this.initialized = true;
    logger.info(`Agent Registry initialized with ${this.agents.size / 2} agents`);
  }

  /**
   * Get agent by ID or role
   */
  getAgent(idOrRole: string): BaseAgent | undefined {
    return this.agents.get(idOrRole);
  }

  /**
   * Get agent for a specific role
   */
  getAgentByRole(role: AgentRole): BaseAgent | undefined {
    return this.agents.get(role);
  }

  /**
   * Get all work agents
   */
  getWorkAgents(): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter((agent, index, arr) => 
        agent.getConfig().type === 'work' && 
        arr.findIndex(a => a.getConfig().id === agent.getConfig().id) === index
      );
  }

  /**
   * Get all personal agents
   */
  getPersonalAgents(): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter((agent, index, arr) => 
        agent.getConfig().type === 'personal' && 
        arr.findIndex(a => a.getConfig().id === agent.getConfig().id) === index
      );
  }

  /**
   * Get all agents
   */
  getAllAgents(): BaseAgent[] {
    const seen = new Set<string>();
    return Array.from(this.agents.values()).filter(agent => {
      if (seen.has(agent.getConfig().id)) return false;
      seen.add(agent.getConfig().id);
      return true;
    });
  }

  /**
   * Find the best agent for a task
   */
  findAgentForTask(task: Task): BaseAgent | undefined {
    const category = task.metadata.category as string;
    
    // Try to find by category
    const categoryAgent = this.agents.get(category);
    if (categoryAgent) return categoryAgent;

    // Fall back to type-based selection
    if (task.type === 'work') {
      return this.agents.get('coding'); // Default work agent
    } else {
      return this.agents.get('chat'); // Default personal agent
    }
  }

  /**
   * Execute a task with the appropriate agent
   */
  async executeTask(task: Task): Promise<void> {
    const agent = this.findAgentForTask(task);
    
    if (!agent) {
      throw new Error(`No agent found for task: ${task.title}`);
    }

    task.assignedAgent = agent.getConfig().id;
    task.status = 'in_progress';
    
    await agent.execute(task);
  }

  /**
   * Get status of all agents
   */
  getStatus(): Array<{ id: string; name: string; type: AgentType; role: AgentRole; isActive: boolean }> {
    return this.getAllAgents().map(agent => {
      const config = agent.getConfig();
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        role: config.role,
        isActive: agent.isActive(),
      };
    });
  }
}

// Singleton instance
let registry: AgentRegistry | null = null;

export function getAgentRegistry(): AgentRegistry {
  if (!registry) {
    registry = new AgentRegistry();
  }
  return registry;
}
