/**
 * Hemingway - Utility Functions
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a short ID for display
 */
export function shortId(): string {
  return uuidv4().slice(0, 8);
}

/**
 * Expand home directory in paths
 * Validates input to prevent path traversal attacks
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    // Remove the ~ and leading separator (~/foo -> foo, ~foo -> foo)
    const userPath = filePath.slice(1).replace(/^[/\\]/, '');

    // Check for path traversal sequences BEFORE normalization
    if (userPath.includes('../') || userPath.includes('..\\')) {
      throw new Error('Path traversal detected: paths cannot contain "../" sequences');
    }

    // Normalize the path after validation
    const normalizedPath = path.normalize(userPath);

    // Additional check: ensure normalized path doesn't escape via ..
    if (normalizedPath.startsWith('..')) {
      throw new Error('Path traversal detected: paths cannot contain "../" sequences');
    }

    return path.join(os.homedir(), normalizedPath);
  }
  return path.normalize(filePath);
}

/**
 * Ensure a directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  const expanded = expandPath(dirPath);
  await fs.mkdir(expanded, { recursive: true });
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(expandPath(filePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleString();
}

/**
 * Format a relative time
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Parse JSON safely
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if we're running in a TTY
 */
export function isTTY(): boolean {
  return process.stdout.isTTY ?? false;
}

/**
 * Get the Hemingway data directory
 */
export function getDataDir(): string {
  return expandPath('~/.hemingway');
}

/**
 * Logger with levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLogLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    // Use a safe format to prevent format string injection
    console.log('%s %s', prefix, message, ...args);
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', message, ...args),
};

/**
 * Extract tags from input like "[work] do something"
 */
export function extractTags(input: string): { tags: string[]; cleanInput: string } {
  const tagRegex = /\[([^\]]+)\]/g;
  const tags: string[] = [];
  let match;
  
  while ((match = tagRegex.exec(input)) !== null) {
    tags.push(match[1].toLowerCase());
  }
  
  const cleanInput = input.replace(tagRegex, '').trim();
  
  return { tags, cleanInput };
}

/**
 * Check if input explicitly mentions work or personal
 */
export function hasExplicitAgentType(input: string): 'work' | 'personal' | null {
  const { tags } = extractTags(input);
  
  if (tags.includes('work')) return 'work';
  if (tags.includes('personal')) return 'personal';
  
  return null;
}
