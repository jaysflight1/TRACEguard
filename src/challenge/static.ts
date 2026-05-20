import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execa } from 'execa';
import { workingDiff } from '../core/git.js';
import { isHighRiskPath } from '../core/risk.js';
import { findSecrets } from '../core/secrets.js';
import type { Config } from '../core/config.js';
import type { Receipt } from '../core/receipt.js';
import type { TraceguardPaths } from '../core/paths.js';

export interface ChallengeFinding {
  severity: 'info' | 'warn' | 'block';
  category: string;
  detail: string;
}

export interface StaticChallengeResult {
  result: 'passed' | 'warn' | 'block';
  findings: ChallengeFinding[];
}

async function fileDiff(repoRoot: string, file: string): Promise<string> {
  try {
    const { stdout } = await execa('git', ['diff', 'HEAD', '--', file], { cwd: repoRoot });
    return stdout;
  } catch {
    return '';
  }
}

async function runCheckCommand(repoRoot: string, command: string): Promise<{ ok: boolean; output: string }> {
  try {
    const { exitCode, stdout, stderr } = await execa(command, {
      cwd: repoRoot,
      shell: true,
      reject: false,
    });
    return { ok: exitCode === 0, output: (stdout || '') + (stderr || '') };
  } catch (err) {
    return { ok: false, output: String(err) };
  }
}

export async function runStaticChallenge(
  paths: TraceguardPaths,
  config: Config,
  receipt: Receipt,
): Promise<StaticChallengeResult> {
  const findings: ChallengeFinding[] = [];
  const diff = await workingDiff(paths.repoRoot);

  // 1. Risky paths.
  for (const f of diff.files) {
    if (isHighRiskPath(f.path)) {
      findings.push({
        severity: 'warn',
        category: 'risky_path',
        detail: `Security-sensitive path changed: ${f.path}`,
      });
    }
  }

  // 2. Secret scan over the diff.
  for (const f of diff.files) {
    if (f.changeType === 'deleted') continue;
    const fullPath = join(paths.repoRoot, f.path);
    if (!existsSync(fullPath)) continue;
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
    const secrets = findSecrets(content);
    if (secrets.length > 0) {
      findings.push({
        severity: 'block',
        category: 'secret_in_diff',
        detail: `Possible secrets found in ${f.path}: ${secrets.map((s) => s.name).join(', ')}`,
      });
    }
    // Also scan the diff body to catch additions even if the secret was redacted from the working copy on read.
    const diffBody = await fileDiff(paths.repoRoot, f.path);
    const addedLines = diffBody
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .join('\n');
    const inDiff = findSecrets(addedLines);
    if (inDiff.length > 0) {
      findings.push({
        severity: 'block',
        category: 'secret_in_diff',
        detail: `Added lines in ${f.path} contain possible secrets: ${inDiff.map((s) => s.name).join(', ')}`,
      });
    }
  }

  // 3. Re-run declared lint / typecheck commands if they weren't observed.
  const observedCommands = new Set(receipt.commands_run.map((c) => c.command));
  for (const key of ['lint', 'typecheck'] as const) {
    const cmd = config.commands[key];
    if (!cmd) continue;
    if (observedCommands.has(cmd)) continue;
    const { ok, output } = await runCheckCommand(paths.repoRoot, cmd);
    findings.push({
      severity: ok ? 'info' : 'warn',
      category: `${key}_run`,
      detail: ok
        ? `${cmd} passed`
        : `${cmd} failed:\n${output.slice(0, 600)}`,
    });
  }

  // 4. Tests claimed but failed.
  for (const t of receipt.tests) {
    if (t.result === 'failed') {
      findings.push({
        severity: 'warn',
        category: 'test_failed',
        detail: `Test command failed: ${t.command}`,
      });
    }
  }

  // 5. Blocked Level 3 actions.
  for (const a of receipt.approvals) {
    if (a.risk_level === 3 && !a.approved) {
      findings.push({
        severity: 'block',
        category: 'l3_blocked',
        detail: `Level 3 action attempted and blocked: ${a.action}`,
      });
    }
  }

  // 6. Threshold breaches.
  if (diff.filesChanged > config.risk_thresholds.max_files_before_challenge) {
    findings.push({
      severity: 'warn',
      category: 'large_diff_files',
      detail: `${diff.filesChanged} files changed exceeds threshold of ${config.risk_thresholds.max_files_before_challenge}`,
    });
  }
  if (diff.insertions + diff.deletions > config.risk_thresholds.max_lines_before_challenge) {
    findings.push({
      severity: 'warn',
      category: 'large_diff_lines',
      detail: `${diff.insertions + diff.deletions} lines changed exceeds threshold of ${config.risk_thresholds.max_lines_before_challenge}`,
    });
  }

  const result: StaticChallengeResult['result'] = findings.some((f) => f.severity === 'block')
    ? 'block'
    : findings.some((f) => f.severity === 'warn')
      ? 'warn'
      : 'passed';

  return { result, findings };
}
