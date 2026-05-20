import { enableClaude } from '../integrations/claude.js';
import { enableCodex } from '../integrations/codex.js';

export function runOn(agent: string): void {
  switch (agent) {
    case 'claude':
    case 'claude-code':
      enableClaude();
      return;
    case 'codex':
      enableCodex();
      return;
    default:
      console.error(`Unknown agent: ${agent}. Expected 'claude' or 'codex'.`);
      process.exit(2);
  }
}
