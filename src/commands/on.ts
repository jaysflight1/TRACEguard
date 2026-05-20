import { loadConfig, saveConfig } from '../core/config.js';
import { resolvePaths } from '../core/paths.js';
import { dim, heading, tag } from '../core/style.js';
import { enableClaude } from '../integrations/claude.js';
import { enableCodex } from '../integrations/codex.js';

export function runOn(agent?: string): void {
  if (!agent) {
    enableGlobal();
    return;
  }
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

function enableGlobal(): void {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  if (config.enabled) {
    console.log(heading('TRACEguard already enabled.'));
    console.log(dim('Use `traceguard off` to pause enforcement, or `traceguard on <agent>` to install an integration.'));
    return;
  }
  config.enabled = true;
  saveConfig(paths.configFile, config);
  console.log(heading('TRACEguard resumed.'));
  console.log('  ' + tag.ok('enforcement re-enabled — hooks will classify actions on the next session'));
}
