import { existsSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../core/config.js';
import { hasBlock } from '../core/markers.js';
import { resolvePaths } from '../core/paths.js';
import { latestReceiptPath } from '../core/receipt.js';

function badge(active: boolean): string {
  return active ? pc.green('active') : pc.dim('inactive');
}

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

  console.log(pc.bold('TRACEguard status'));
  console.log(`  Repo root:        ${paths.repoRoot}`);
  console.log(`  Claude Code:      ${badge(claudeActive)}`);
  console.log(`    CLAUDE.md block:   ${claudeBlock ? 'yes' : 'no'}`);
  console.log(`    settings.json:     ${settingsExists ? paths.claudeSettings : '(none)'}`);
  console.log(`    hook shims:        ${hooksInstalled ? paths.hooksDir : '(none)'}`);
  console.log(`  Codex:            ${badge(codexActive)}`);
  console.log(`    AGENTS.md block:   ${agentsBlock ? 'yes' : 'no'}`);
  console.log(`    sandbox_mode:      ${config.agents.codex.sandbox_mode}`);
  console.log(`    approval_policy:   ${config.agents.codex.approval_policy}`);
  console.log(`  Policy:           ${config.policy}`);
  console.log(`  Challenge mode:   ${config.challenge.default_mode}`);
  console.log(`  Reviewer mode:    ${config.challenge.reviewer_mode ? 'on' : 'off'}`);
  console.log(`  Last receipt:     ${latest ?? '(none yet)'}`);
}
