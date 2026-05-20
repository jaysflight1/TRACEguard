#!/usr/bin/env node
import { Command } from 'commander';

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
  .action(() => {
    console.log('[traceguard] init: not yet implemented (Phase 2)');
  });

program
  .command('on <agent>')
  .description('Enable TRACEguard for an agent (claude | codex)')
  .action((agent: string) => {
    console.log(`[traceguard] on ${agent}: not yet implemented (Phase 3 / 8)`);
  });

program
  .command('off <agent>')
  .description('Disable TRACEguard for an agent (claude | codex)')
  .action((agent: string) => {
    console.log(`[traceguard] off ${agent}: not yet implemented (Phase 3 / 8)`);
  });

program
  .command('status')
  .description('Show TRACEguard activation and policy state')
  .action(() => {
    console.log('[traceguard] status: not yet implemented (Phase 9)');
  });

const receipt = program.command('receipt').description('Inspect session receipts');
receipt
  .command('latest')
  .description('Print the most recent receipt')
  .action(() => {
    console.log('[traceguard] receipt latest: not yet implemented (Phase 6)');
  });
receipt
  .command('list')
  .description('List all receipts')
  .action(() => {
    console.log('[traceguard] receipt list: not yet implemented (Phase 6)');
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
