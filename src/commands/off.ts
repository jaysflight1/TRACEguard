import { loadConfig, saveConfig } from '../core/config.js';
import { resolvePaths } from '../core/paths.js';
import { dim, heading, tag } from '../core/style.js';
import { disableClaude } from '../integrations/claude.js';
import { disableCodex } from '../integrations/codex.js';

export function runOff(agent?: string): void {
  if (!agent) {
    disableGlobal();
    return;
  }
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

function disableGlobal(): void {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  if (!config.enabled) {
    console.log(heading('TRACEguard is already paused.'));
    console.log(dim('Run `traceguard on` to resume enforcement.'));
    return;
  }
  config.enabled = false;
  saveConfig(paths.configFile, config);
  console.log(heading('TRACEguard paused.'));
  console.log('  ' + tag.warn('hooks will short-circuit to allow until you run `traceguard on`'));
  console.log('  ' + tag.ok('integrations and protocol blocks are untouched — only enforcement is suspended'));
  console.log();
  console.log(dim('To fully remove integrations, use `traceguard off claude` / `off codex` (per agent).'));
  console.log(dim('To wipe everything, use `traceguard uninstall --purge`.'));
}
