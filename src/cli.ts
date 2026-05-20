#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runOn } from './commands/on.js';
import { runOff } from './commands/off.js';
import { runReceiptLatest, runReceiptList } from './commands/receipt.js';
import { runStatus } from './commands/status.js';
import { runSummary } from './commands/summary.js';
import { runUninstall } from './commands/uninstall.js';
import { runVerify } from './commands/verify.js';

const program = new Command();

program
  .name('traceguard')
  .description(
    'Lightweight transparency layer for AI coding agents (Claude Code, Codex CLI).',
  )
  .version('0.1.0');

program
  .command('init')
  .description('Scaffold .traceguard/ and instruction files in the current repo')
  .option('--force', 'Re-write TRACEguard config and blocks even if present')
  .action((opts: { force?: boolean }) => {
    runInit({ force: opts.force });
  });

program
  .command('on <agent>')
  .description('Enable TRACEguard for an agent (claude | codex)')
  .action((agent: string) => {
    runOn(agent);
  });

program
  .command('off <agent>')
  .description('Disable TRACEguard for an agent (claude | codex)')
  .action((agent: string) => {
    runOff(agent);
  });

program
  .command('status')
  .description('Show TRACEguard activation and policy state')
  .action(() => {
    runStatus();
  });

const receipt = program.command('receipt').description('Inspect session receipts');
receipt
  .command('latest')
  .description('Print the most recent receipt')
  .action(() => {
    runReceiptLatest();
  });
receipt
  .command('list')
  .description('List all receipts')
  .action(() => {
    runReceiptList();
  });

const summary = program
  .command('summary')
  .description('Toggle whether agents must produce a TRACE summary at end-of-task');
summary
  .command('on [agent]')
  .description('Enforce TRACE summaries (default — applies to both agents if [agent] omitted)')
  .action((agent?: string) => {
    runSummary('on', agent);
  });
summary
  .command('off [agent]')
  .description('Skip TRACE summaries unless the user explicitly asks')
  .action((agent?: string) => {
    runSummary('off', agent);
  });
summary
  .command('status [agent]')
  .description('Show whether TRACE summaries are currently enforced')
  .action((agent?: string) => {
    runSummary('status', agent);
  });

program
  .command('verify')
  .description('Force a challenge pass against the latest receipt')
  .action(async () => {
    await runVerify();
  });

program
  .command('uninstall')
  .description('Remove TRACEguard from this repo')
  .option('--purge', 'Also delete .traceguard/ (config, logs, receipts)')
  .action((opts: { purge?: boolean }) => {
    runUninstall({ purge: opts.purge });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('[traceguard] error:', err?.message ?? err);
  process.exit(1);
});
