import { existsSync } from 'node:fs';
import Table from 'cli-table3';
import { loadConfig } from '../core/config.js';
import { hasBlock } from '../core/markers.js';
import { resolvePaths } from '../core/paths.js';
import { latestReceiptPath } from '../core/receipt.js';
import { dim, heading, tag } from '../core/style.js';

export function runStatus(): void {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);

  const claudeBlock = hasBlock(paths.claudeMd, 'protocol');
  const agentsBlock = hasBlock(paths.agentsMd, 'protocol');
  const settingsExists = existsSync(paths.claudeSettings);
  const hooksInstalled = existsSync(paths.hooksDir);
  const latest = latestReceiptPath(paths.receiptsDir);

  const claudeActive = config.agents.claude.enabled && claudeBlock;
  const codexActive = config.agents.codex.enabled && agentsBlock;

  console.log(heading('TRACEguard status'));
  console.log(dim(`  ${paths.repoRoot}`));
  console.log();

  const overview = new Table({
    head: ['Agent', 'State', 'Details'],
    style: { head: ['cyan'], border: ['gray'] },
    colWidths: [12, 14, 56],
    wordWrap: true,
  });
  overview.push(
    [
      'Claude Code',
      claudeActive ? tag.active() : tag.inactive(),
      [
        `CLAUDE.md block: ${claudeBlock ? 'yes' : 'no'}`,
        `settings.json:   ${settingsExists ? paths.claudeSettings : '(none)'}`,
        `hook shims:      ${hooksInstalled ? paths.hooksDir : '(none)'}`,
      ].join('\n'),
    ],
    [
      'Codex',
      codexActive ? tag.active() : tag.inactive(),
      [
        `AGENTS.md block:    ${agentsBlock ? 'yes' : 'no'}`,
        `sandbox_mode:       ${config.agents.codex.sandbox_mode}`,
        `approval_policy:    ${config.agents.codex.approval_policy}`,
      ].join('\n'),
    ],
  );
  console.log(overview.toString());

  console.log();
  const policy = new Table({
    head: ['Setting', 'Value'],
    style: { head: ['cyan'], border: ['gray'] },
    colWidths: [22, 50],
  });
  const summaryClaude = config.agents.claude.enforce_trace_summary ? 'on' : 'off';
  const summaryCodex = config.agents.codex.enforce_trace_summary ? 'on' : 'off';
  policy.push(
    ['Policy', config.policy],
    ['Challenge mode', config.challenge.default_mode],
    ['Reviewer mode', config.challenge.reviewer_mode ? 'on' : 'off'],
    ['TRACE summary', `claude: ${summaryClaude}   codex: ${summaryCodex}`],
    ['Last receipt', latest ?? dim('(none yet)')],
  );
  console.log(policy.toString());
}
