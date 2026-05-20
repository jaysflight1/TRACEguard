import { disableClaude } from '../integrations/claude.js';
import { disableCodex } from '../integrations/codex.js';

export function runOff(agent: string): void {
  switch (agent) {
    case 'claude':
    case 'claude-code':
      disableClaude();
      return;
    case 'codex':
      disableCodex();
      return;
    default:
      console.error(`Unknown agent: ${agent}. Expected 'claude' or 'codex'.`);
      process.exit(2);
  }
}
