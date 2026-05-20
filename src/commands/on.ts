import { enableClaude } from '../integrations/claude.js';

export function runOn(agent: string): void {
  switch (agent) {
    case 'claude':
    case 'claude-code':
      enableClaude();
      return;
    case 'codex':
      console.log('[traceguard] on codex: not yet implemented (Phase 8)');
      return;
    default:
      console.error(`Unknown agent: ${agent}. Expected 'claude' or 'codex'.`);
      process.exit(2);
  }
}
