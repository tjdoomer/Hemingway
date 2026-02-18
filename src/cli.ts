#!/usr/bin/env node

/**
 * Hemingway - CLI Entry Point
 * 
 * "All you have to do is write one true sentence."
 * 
 * The terminal interface for Hemingway.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { input } from '@inquirer/prompts';
import dotenv from 'dotenv';
import { modelDetector, modelClient } from './models/index.js';
import { getSamantha } from './core/index.js';
import { getAgentRegistry } from './agents/index.js';
import { getMemoryStore } from './memory/index.js';
import { logger, setLogLevel, getDataDir, ensureDir } from './utils/index.js';
import type { ProviderConfig } from './types/index.js';

// Load environment variables
dotenv.config();

// ASCII art banner
const BANNER = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('██╗  ██╗███████╗███╗   ███╗██╗███╗   ██╗ ██████╗')}            ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('██║  ██║██╔════╝████╗ ████║██║████╗  ██║██╔════╝')}            ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('███████║█████╗  ██╔████╔██║██║██╔██╗ ██║██║  ███╗')}           ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('██╔══██║██╔══╝  ██║╚██╔╝██║██║██║╚██╗██║██║   ██║')}           ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('██║  ██║███████╗██║ ╚═╝ ██║██║██║ ╚████║╚██████╔╝')}           ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝')}            ${chalk.cyan('║')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.dim('The iceberg theory of AI orchestration')}                       ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.dim('Only 1/8 visible - the rest runs beneath')}                     ${chalk.cyan('║')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════════╝')}
`;

/**
 * Initialize the system
 */
async function initialize(): Promise<boolean> {
  const spinner = ora('Initializing Hemingway...').start();

  try {
    // Ensure data directory exists
    await ensureDir(getDataDir());

    // Configure model providers from environment
    const providers: ProviderConfig[] = [];

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      const config: ProviderConfig = {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        isEnabled: true,
      };
      providers.push(config);
      modelDetector.configureProvider(config);
      modelClient.configureProvider(config);
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      const config: ProviderConfig = {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        isEnabled: true,
      };
      providers.push(config);
      modelDetector.configureProvider(config);
      modelClient.configureProvider(config);
    }

    // LMStudio
    if (process.env.LMSTUDIO_ENABLED === 'true' || !process.env.LMSTUDIO_ENABLED) {
      const config: ProviderConfig = {
        provider: 'lmstudio',
        baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
        isEnabled: true,
      };
      providers.push(config);
      modelDetector.configureProvider(config);
      modelClient.configureProvider(config);
    }

    // Detect available models
    spinner.text = 'Detecting available models...';
    const models = await modelDetector.detectAll();
    
    if (models.length === 0) {
      spinner.warn('No models detected. Please configure API keys or start LMStudio.');
      console.log(chalk.yellow('\nConfiguration options:'));
      console.log(chalk.dim('  - Set OPENAI_API_KEY in environment or .env file'));
      console.log(chalk.dim('  - Set ANTHROPIC_API_KEY in environment or .env file'));
      console.log(chalk.dim('  - Start LMStudio with a loaded model'));
      return false;
    }

    spinner.text = 'Initializing agents...';
    
    // Initialize agent registry
    const registry = getAgentRegistry();
    await registry.initialize();

    // Initialize Samantha
    const samantha = getSamantha();
    await samantha.initialize();

    spinner.succeed(`Hemingway ready! (${modelDetector.getSummary()})`);
    return true;
  } catch (error) {
    spinner.fail('Initialization failed');
    console.error(chalk.red((error as Error).message));
    return false;
  }
}

/**
 * Display system status
 */
function displayStatus(): void {
  console.log(chalk.bold('\n📊 System Status\n'));

  // Models
  const localModels = modelDetector.getLocalModels();
  const cloudModels = modelDetector.getCloudModels();

  console.log(chalk.cyan('Models:'));
  if (localModels.length > 0) {
    console.log(chalk.green(`  Local (${localModels.length}):`));
    localModels.forEach(m => console.log(chalk.dim(`    - ${m.name}`)));
  }
  if (cloudModels.length > 0) {
    console.log(chalk.blue(`  Cloud (${cloudModels.length}):`));
    cloudModels.forEach(m => console.log(chalk.dim(`    - ${m.name}`)));
  }

  // Agents
  const registry = getAgentRegistry();
  const agents = registry.getStatus();

  console.log(chalk.cyan('\nAgents:'));
  console.log(chalk.green('  Work:'));
  agents.filter(a => a.type === 'work').forEach(a => 
    console.log(chalk.dim(`    - ${a.name} ${a.isActive ? '(active)' : ''}`))
  );
  console.log(chalk.magenta('  Personal:'));
  agents.filter(a => a.type === 'personal').forEach(a => 
    console.log(chalk.dim(`    - ${a.name} ${a.isActive ? '(active)' : ''}`))
  );

  // Memory
  const memory = getMemoryStore();
  console.log(chalk.cyan('\nSession:'));
  console.log(chalk.dim(`  ID: ${memory.getSessionId()}`));

  console.log('');
}

/**
 * Interactive REPL mode
 */
async function interactiveMode(): Promise<void> {
  console.log(BANNER);

  const initialized = await initialize();
  if (!initialized) {
    console.log(chalk.yellow('\nRunning in limited mode without models.'));
    console.log(chalk.dim('Some features may not be available.\n'));
  }

  const samantha = getSamantha();
  const memory = getMemoryStore();

  console.log(chalk.dim('Type your requests naturally. Use [work] or [personal] tags to route explicitly.'));
  console.log(chalk.dim('Commands: /status, /clear, /quit\n'));

  // REPL loop
  while (true) {
    try {
      const userInput = await input({
        message: chalk.cyan('You:'),
      });

      const trimmed = userInput.trim();

      // Handle commands
      if (trimmed === '/quit' || trimmed === '/exit' || trimmed === '/q') {
        console.log(chalk.dim('\nGoodbye! "The world is a fine place and worth fighting for."\n'));
        memory.endSession();
        break;
      }

      if (trimmed === '/status') {
        displayStatus();
        continue;
      }

      if (trimmed === '/clear') {
        samantha.clearHistory();
        console.log(chalk.dim('Conversation cleared.\n'));
        continue;
      }

      if (trimmed === '/help') {
        console.log(chalk.bold('\nCommands:'));
        console.log(chalk.dim('  /status  - Show system status'));
        console.log(chalk.dim('  /clear   - Clear conversation history'));
        console.log(chalk.dim('  /quit    - Exit Hemingway'));
        console.log(chalk.dim('\nTips:'));
        console.log(chalk.dim('  - Prefix with [work] or [personal] to route explicitly'));
        console.log(chalk.dim('  - Just speak naturally - Samantha will understand\n'));
        continue;
      }

      if (!trimmed) continue;

      // Process with Samantha
      const spinner = ora({ text: chalk.dim('Thinking...'), spinner: 'dots' }).start();

      const result = await samantha.process(trimmed);

      spinner.stop();

      // Display response
      console.log(chalk.green(`\nSamantha: ${result.response}\n`));

      if (result.task) {
        console.log(chalk.dim(`📋 Task created: ${result.task.title}`));
        console.log(chalk.dim(`   Type: ${result.agentType}, Priority: ${result.task.priority}\n`));
      }
    } catch (error) {
      if ((error as Error).message === 'User force closed the prompt') {
        console.log(chalk.dim('\n\nGoodbye!\n'));
        break;
      }
      console.error(chalk.red(`\nError: ${(error as Error).message}\n`));
    }
  }

  process.exit(0);
}

/**
 * Process a single command
 */
async function processCommand(input: string): Promise<void> {
  const initialized = await initialize();
  if (!initialized) {
    process.exit(1);
  }

  const samantha = getSamantha();
  const spinner = ora('Processing...').start();

  try {
    const result = await samantha.process(input);
    spinner.stop();

    console.log(chalk.green(`\n${result.response}\n`));

    if (result.task) {
      console.log(chalk.dim(`Task: ${result.task.title}`));
      console.log(chalk.dim(`Type: ${result.agentType}, Priority: ${result.task.priority}\n`));
    }
  } catch (error) {
    spinner.fail('Failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }

  process.exit(0);
}

// Set up CLI
const program = new Command();

program
  .name('hemingway')
  .description('Hemingway - Multi-Agent AI Orchestration System')
  .version('0.1.0');

program
  .argument('[input]', 'Direct input to process')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--voice', 'Enable voice input mode (coming soon)')
  .option('--status', 'Show system status')
  .action(async (inputArg, options) => {
    if (options.verbose) {
      setLogLevel('debug');
    }

    if (options.status) {
      await initialize();
      displayStatus();
      process.exit(0);
    }

    if (options.voice) {
      console.log(chalk.yellow('Voice mode coming soon!'));
      process.exit(0);
    }

    if (inputArg) {
      await processCommand(inputArg);
    } else {
      await interactiveMode();
    }
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    await initialize();
    displayStatus();
    process.exit(0);
  });

program
  .command('models')
  .description('List available models')
  .action(async () => {
    const spinner = ora('Detecting models...').start();
    
    // Configure providers
    if (process.env.OPENAI_API_KEY) {
      modelDetector.configureProvider({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        isEnabled: true,
      });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      modelDetector.configureProvider({
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        isEnabled: true,
      });
    }
    modelDetector.configureProvider({
      provider: 'lmstudio',
      baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
      isEnabled: true,
    });

    const models = await modelDetector.detectAll();
    spinner.stop();

    if (models.length === 0) {
      console.log(chalk.yellow('No models detected.'));
      process.exit(0);
    }

    console.log(chalk.bold('\n📦 Available Models\n'));
    
    const local = models.filter(m => m.isLocal);
    const cloud = models.filter(m => !m.isLocal);

    if (local.length > 0) {
      console.log(chalk.green('Local Models:'));
      local.forEach(m => {
        console.log(`  ${chalk.cyan(m.name)}`);
        console.log(chalk.dim(`    Context: ${m.capabilities.contextWindow.toLocaleString()} tokens`));
      });
    }

    if (cloud.length > 0) {
      console.log(chalk.blue('\nCloud Models:'));
      cloud.forEach(m => {
        console.log(`  ${chalk.cyan(m.name)} (${m.provider})`);
        console.log(chalk.dim(`    Context: ${m.capabilities.contextWindow.toLocaleString()} tokens`));
      });
    }

    console.log('');
    process.exit(0);
  });

// Parse and run
program.parse();
