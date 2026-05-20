import { disableClaude } from '../integrations/claude.js';

export function runOff(agent: string): void {
  switch (agent) {
    case 'claude':
    case 'claude-code':
      disableClaude();
      return;
    case 'codex':
      console.log('[traceguard] off codex: not yet implemented (Phase 8)');
      return;
    default:
      console.error(`Unknown agent: ${agent}. Expected 'claude' or 'codex'.`);
      process.exit(2);
  }
}
