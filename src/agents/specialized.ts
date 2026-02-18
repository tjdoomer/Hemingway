/**
 * Hemingway - Specialized Agents
 * 
 * "There is nothing noble in being superior to your fellow man;
 * true nobility is being superior to your former self."
 * 
 * Specialized agents for different task domains.
 */

import { z } from 'zod';
import type { Tool, ToolResult } from '../types/index.js';
import { WorkAgent, PersonalAgent } from './base.js';
import { generateId } from '../utils/index.js';

// =============================================================================
// Work Agents
// =============================================================================

/**
 * GitHub Agent - handles GitHub operations
 */
export class GitHubAgent extends WorkAgent {
  constructor() {
    super({
      id: 'github-agent',
      name: 'GitHub Agent',
      role: 'github',
      description: 'Manages GitHub repositories, PRs, issues, and code reviews',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the GitHub Agent within the Hemingway system.
Your specialty is managing GitHub repositories, pull requests, issues, and code reviews.

Capabilities:
- List and review pull requests
- Create and manage issues
- Manage branches
- Review code changes
- Check CI/CD status
- Merge PRs when appropriate

Always provide clear summaries of GitHub activity.
When reviewing code, be constructive and specific.`;
  }

  protected registerTools(): void {
    // GitHub tools would be implemented here
    this.registerTool({
      name: 'list_pull_requests',
      description: 'List pull requests in a repository',
      parameters: z.object({
        repo: z.string().describe('Repository name (owner/repo format)'),
        state: z.enum(['open', 'closed', 'all']).optional(),
      }),
      execute: async (params) => this.listPullRequests(params as { repo: string; state?: string }),
    });

    this.registerTool({
      name: 'get_pr_details',
      description: 'Get details of a specific pull request',
      parameters: z.object({
        repo: z.string().describe('Repository name'),
        pr_number: z.number().describe('Pull request number'),
      }),
      execute: async (params) => this.getPRDetails(params as { repo: string; pr_number: number }),
    });
  }

  private async listPullRequests(params: { repo: string; state?: string }): Promise<ToolResult> {
    // This would use the GitHub API in a real implementation
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Listed PRs for ${params.repo} with state: ${params.state || 'open'}`,
    };
  }

  private async getPRDetails(params: { repo: string; pr_number: number }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] PR #${params.pr_number} details for ${params.repo}`,
    };
  }
}

/**
 * Coding Agent - handles code development tasks
 */
export class CodingAgent extends WorkAgent {
  constructor() {
    super({
      id: 'coding-agent',
      name: 'Coding Agent',
      role: 'coding',
      description: 'Writes, reviews, and refactors code',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Coding Agent within the Hemingway system.
Your specialty is writing, reviewing, and refactoring code.

Capabilities:
- Write clean, efficient code
- Review code for bugs and improvements
- Refactor existing code
- Explain code and concepts
- Debug issues
- Write tests

Follow best practices for the language/framework being used.
Write code that is readable and maintainable.`;
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'read_file',
      description: 'Read contents of a file',
      parameters: z.object({
        path: z.string().describe('File path to read'),
      }),
      execute: async (params) => this.readFile(params as { path: string }),
    });

    this.registerTool({
      name: 'write_file',
      description: 'Write contents to a file',
      parameters: z.object({
        path: z.string().describe('File path to write'),
        content: z.string().describe('Content to write'),
      }),
      execute: async (params) => this.writeFile(params as { path: string; content: string }),
    });
  }

  private async readFile(params: { path: string }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Read file: ${params.path}`,
    };
  }

  private async writeFile(params: { path: string; content: string }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Wrote to file: ${params.path}`,
    };
  }
}

/**
 * Slack Agent - handles Slack communications
 */
export class SlackAgent extends WorkAgent {
  constructor() {
    super({
      id: 'slack-agent',
      name: 'Slack Agent',
      role: 'slack',
      description: 'Manages Slack messages and channels',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Slack Agent within the Hemingway system.
Your specialty is managing Slack communications.

Capabilities:
- Send messages to channels and users
- Read recent messages
- Create channel summaries
- Set reminders
- Manage notifications

Keep messages professional yet friendly.
Respect channel conventions and etiquette.`;
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'send_message',
      description: 'Send a message to a Slack channel or user',
      parameters: z.object({
        channel: z.string().describe('Channel name or user ID'),
        message: z.string().describe('Message to send'),
      }),
      execute: async (params) => this.sendMessage(params as { channel: string; message: string }),
    });
  }

  private async sendMessage(params: { channel: string; message: string }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Sent message to ${params.channel}`,
    };
  }
}

/**
 * Email Agent - handles email communications
 */
export class EmailAgent extends WorkAgent {
  constructor() {
    super({
      id: 'email-agent',
      name: 'Email Agent',
      role: 'email',
      description: 'Manages email communications',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Email Agent within the Hemingway system.
Your specialty is managing email communications.

Capabilities:
- Read and summarize emails
- Draft email responses
- Send emails
- Search inbox
- Manage labels/folders

Write professional, clear emails.
Be mindful of tone and audience.`;
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'read_emails',
      description: 'Read recent emails',
      parameters: z.object({
        limit: z.number().optional().describe('Number of emails to read'),
        unread_only: z.boolean().optional().describe('Only unread emails'),
      }),
      execute: async (params) => this.readEmails(params as { limit?: number; unread_only?: boolean }),
    });

    this.registerTool({
      name: 'send_email',
      description: 'Send an email',
      parameters: z.object({
        to: z.string().describe('Recipient email'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body'),
      }),
      execute: async (params) => this.sendEmail(params as { to: string; subject: string; body: string }),
    });
  }

  private async readEmails(params: { limit?: number; unread_only?: boolean }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Read ${params.limit || 10} emails`,
    };
  }

  private async sendEmail(params: { to: string; subject: string; body: string }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Sent email to ${params.to}`,
    };
  }
}

/**
 * Research Agent - handles web research
 */
export class ResearchAgent extends WorkAgent {
  constructor() {
    super({
      id: 'research-agent',
      name: 'Research Agent',
      role: 'research',
      description: 'Conducts web research and information gathering',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Research Agent within the Hemingway system.
Your specialty is conducting research and gathering information.

Capabilities:
- Search the web
- Summarize articles and documents
- Find relevant information
- Fact-check claims
- Compile research reports

Provide accurate, well-sourced information.
Clearly distinguish facts from opinions.`;
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'web_search',
      description: 'Search the web for information',
      parameters: z.object({
        query: z.string().describe('Search query'),
        num_results: z.number().optional().describe('Number of results'),
      }),
      execute: async (params) => this.webSearch(params as { query: string; num_results?: number }),
    });
  }

  private async webSearch(params: { query: string; num_results?: number }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Search results for: ${params.query}`,
    };
  }
}

// =============================================================================
// Personal Agents
// =============================================================================

/**
 * Calendar Agent - handles calendar management
 */
export class CalendarAgent extends PersonalAgent {
  constructor() {
    super({
      id: 'calendar-agent',
      name: 'Calendar Agent',
      role: 'calendar',
      description: 'Manages calendar events and scheduling',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Calendar Agent within the Hemingway system.
Your specialty is managing calendar events and scheduling.

Capabilities:
- View upcoming events
- Schedule new events
- Find available time slots
- Set reminders
- Manage recurring events

Be helpful with scheduling and time management.
Consider time zones when relevant.`;
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'list_events',
      description: 'List upcoming calendar events',
      parameters: z.object({
        days: z.number().optional().describe('Number of days to look ahead'),
      }),
      execute: async (params) => this.listEvents(params as { days?: number }),
    });

    this.registerTool({
      name: 'create_event',
      description: 'Create a calendar event',
      parameters: z.object({
        title: z.string().describe('Event title'),
        start: z.string().describe('Start time (ISO format)'),
        end: z.string().describe('End time (ISO format)'),
        description: z.string().optional().describe('Event description'),
      }),
      execute: async (params) => this.createEvent(params as { 
        title: string; 
        start: string; 
        end: string; 
        description?: string;
      }),
    });
  }

  private async listEvents(params: { days?: number }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Listed events for next ${params.days || 7} days`,
    };
  }

  private async createEvent(params: { 
    title: string; 
    start: string; 
    end: string; 
    description?: string;
  }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Created event: ${params.title}`,
    };
  }
}

/**
 * Creative Agent - handles creative tasks
 */
export class CreativeAgent extends PersonalAgent {
  constructor() {
    super({
      id: 'creative-agent',
      name: 'Creative Agent',
      role: 'creative',
      description: 'Helps with creative writing and content creation',
      temperature: 0.9, // Higher creativity
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Creative Agent within the Hemingway system.
Your specialty is creative writing and content creation.

Capabilities:
- Write stories, poems, and creative content
- Draft blog posts and articles
- Brainstorm ideas
- Edit and improve writing
- Create social media content

Channel Hemingway's spirit - be bold, concise, and evocative.
"Write drunk, edit sober" (but always deliver polished work).`;
  }

  protected registerTools(): void {
    // Creative agent primarily uses the LLM directly
  }
}

/**
 * Chat Agent - handles casual conversation
 */
export class ChatAgent extends PersonalAgent {
  constructor() {
    super({
      id: 'chat-agent',
      name: 'Chat Agent',
      role: 'chat',
      description: 'Friendly conversational companion',
      temperature: 0.8,
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Chat Agent within the Hemingway system.
Your role is to be a friendly, thoughtful conversational companion.

Personality:
- Warm and genuine, like talking to a good friend
- Curious and engaging
- Supportive but honest
- Thoughtful about life and ideas

You can discuss anything - life, philosophy, hobbies, feelings.
Be present, listen well, and respond meaningfully.`;
  }

  protected registerTools(): void {
    // Chat agent uses pure conversation
  }
}

/**
 * Social Agent - handles social media
 */
export class SocialAgent extends PersonalAgent {
  constructor() {
    super({
      id: 'social-agent',
      name: 'Social Agent',
      role: 'social',
      description: 'Manages social media presence',
    });
  }

  protected getDefaultSystemPrompt(): string {
    return `You are the Social Agent within the Hemingway system.
Your specialty is managing social media presence.

Capabilities:
- Draft social media posts
- Suggest posting strategies
- Review and improve content
- Track engagement patterns

Create engaging, authentic content.
Maintain voice consistency across platforms.`;
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'draft_post',
      description: 'Draft a social media post',
      parameters: z.object({
        platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook']),
        topic: z.string().describe('Post topic or theme'),
        tone: z.string().optional().describe('Desired tone'),
      }),
      execute: async (params) => this.draftPost(params as { 
        platform: string; 
        topic: string; 
        tone?: string;
      }),
    });
  }

  private async draftPost(params: { 
    platform: string; 
    topic: string; 
    tone?: string;
  }): Promise<ToolResult> {
    return {
      toolCallId: generateId(),
      success: true,
      output: `[Mock] Drafted ${params.platform} post about: ${params.topic}`,
    };
  }
}
