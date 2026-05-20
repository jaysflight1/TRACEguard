import { loadConfig, saveConfig } from '../core/config.js';
import { resolvePaths } from '../core/paths.js';
import { dim, heading, tag } from '../core/style.js';

type Mode = 'on' | 'off' | 'status';

export function runSummary(mode: Mode, agentArg?: string): void {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  const agents = parseAgents(agentArg);

  if (mode === 'status') {
    console.log(heading('TRACEguard TRACE summary toggle'));
    for (const a of agents) {
      const enabled = config.agents[a].enforce_trace_summary;
      console.log(`  ${a.padEnd(8)} ${enabled ? tag.active('enforced') : tag.inactive('skipped')}`);
    }
    console.log();
    console.log(dim('Toggle with `traceguard summary on` or `traceguard summary off`.'));
    console.log(dim('Add `claude` or `codex` to target one agent: `traceguard summary off codex`.'));
    return;
  }

  const target = mode === 'on';
  for (const a of agents) {
    config.agents[a].enforce_trace_summary = target;
  }
  saveConfig(paths.configFile, config);

  console.log(heading(`TRACE summary ${target ? 'enabled' : 'disabled'}`));
  for (const a of agents) {
    console.log('  ' + tag.ok(`${a}: enforce_trace_summary = ${target}`));
  }
  console.log();
  console.log(dim('CLAUDE.md and AGENTS.md were not modified — the templates already'));
  console.log(dim('reference this flag, so the change takes effect on the next session.'));
}

function parseAgents(arg: string | undefined): Array<'claude' | 'codex'> {
  if (!arg || arg === 'all') return ['claude', 'codex'];
  if (arg === 'claude' || arg === 'codex') return [arg];
  console.error(`Unknown agent: ${arg}. Expected 'claude', 'codex', or 'all'.`);
  process.exit(2);
}
