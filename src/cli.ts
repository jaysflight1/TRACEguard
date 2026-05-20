#!/usr/bin/env node
import { Command } from 'commander';
import { resolvePaths } from './core/paths.js';
import { loadConfig } from './core/config.js';
import { runInit } from './commands/init.js';
import { runOn } from './commands/on.js';
import { runOff } from './commands/off.js';
import { runReceiptLatest, runReceiptList } from './commands/receipt.js';

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
    const paths = resolvePaths();
    const config = loadConfig(paths.configFile);
    console.log('TRACEguard status');
    console.log(`Repo root:     ${paths.repoRoot}`);
    console.log(`Claude Code:   ${config.agents.claude.enabled ? 'active' : 'inactive'}`);
    console.log(`Codex:         ${config.agents.codex.enabled ? 'active' : 'inactive'}`);
    console.log(`Policy:        ${config.policy}`);
    console.log(`Challenge:     ${config.challenge.default_mode}`);
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

program
  .command('verify')
  .description('Force a challenge pass against the latest receipt')
  .action(() => {
    console.log('[traceguard] verify: not yet implemented (Phase 7)');
  });

program
  .command('uninstall')
  .description('Remove TRACEguard from this repo')
  .action(() => {
    console.log('[traceguard] uninstall: not yet implemented (Phase 9)');
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('[traceguard] error:', err?.message ?? err);
  process.exit(1);
});
