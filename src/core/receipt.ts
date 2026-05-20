import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Config } from './config.js';
import { gitContext, workingDiff } from './git.js';
import { SessionLogger, type LogEvent } from './logger.js';
import type { TraceguardPaths } from './paths.js';
import { isHighRiskPath } from './risk.js';
import { PACKAGE_VERSION } from './version.js';

const FilesChangedSchema = z.object({
  path: z.string(),
  change_type: z.enum(['created', 'modified', 'deleted', 'renamed']),
  lines_added: z.number().nullable(),
  lines_removed: z.number().nullable(),
});

const CommandRunSchema = z.object({
  command: z.string(),
  risk_level: z.number().int().min(0).max(3),
  exit_code: z.number().nullable(),
  summary: z.string(),
  timestamp: z.string(),
});

const ApprovalSchema = z.object({
  action: z.string(),
  risk_level: z.number().int().min(0).max(3),
  approved: z.boolean(),
  timestamp: z.string(),
});

const EvidenceSchema = z.object({
  claim: z.string(),
  evidence_type: z.enum(['repo_file', 'diff', 'test_result', 'command_output', 'external_source', 'assumption']),
  source: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
});

const TestSchema = z.object({
  command: z.string(),
  result: z.enum(['passed', 'failed', 'not_run']),
  summary: z.string(),
});

const UncertaintySchema = z.object({
  uncertainty: z.string(),
  recommended_verification: z.string(),
});

const ChallengePassSchema = z.object({
  triggered: z.boolean(),
  trigger_reason: z.string(),
  result: z.enum(['passed', 'failed', 'skipped', 'recommended']),
  summary: z.string(),
});

export const ReceiptSchema = z.object({
  traceguard_version: z.string(),
  agent: z.string(),
  session_id: z.string(),
  timestamp_start: z.string(),
  timestamp_end: z.string(),
  repository: z.object({
    root: z.string(),
    git_remote_hash: z.string().nullable(),
    git_branch: z.string().nullable(),
    git_commit_before: z.string().nullable(),
    git_commit_after: z.string().nullable(),
  }),
  user_request_summary: z.string(),
  files_changed: z.array(FilesChangedSchema),
  commands_run: z.array(CommandRunSchema),
  approvals: z.array(ApprovalSchema),
  evidence: z.array(EvidenceSchema),
  tests: z.array(TestSchema),
  uncertainties: z.array(UncertaintySchema),
  challenge_pass: ChallengePassSchema,
  final_status: z.enum(['completed', 'completed_with_warnings', 'blocked', 'failed']),
});

export type Receipt = z.infer<typeof ReceiptSchema>;
export type ReceiptWriteResult = { jsonPath: string; markdownPath: string; receipt: Receipt };

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function detectTestCommand(command: string): boolean {
  return /\b(npm\s+test|npm\s+run\s+test|vitest|jest|mocha|pytest|go\s+test|cargo\s+test)\b/.test(command);
}

function summarizeCommand(command: string, exitCode: number | null): string {
  const status = exitCode === null ? 'no exit code' : exitCode === 0 ? 'ok' : `exit ${exitCode}`;
  const head = command.split('\n')[0] ?? '';
  const truncated = head.length > 80 ? head.slice(0, 77) + '...' : head;
  return `${truncated} — ${status}`;
}

interface AggregatedEvents {
  start: string;
  end: string;
  commands: Receipt['commands_run'];
  approvals: Receipt['approvals'];
  tests: Receipt['tests'];
  blockedCount: number;
}

function aggregateEvents(events: LogEvent[]): AggregatedEvents {
  const commands: Receipt['commands_run'] = [];
  const approvals: Receipt['approvals'] = [];
  const tests: Receipt['tests'] = [];
  let blockedCount = 0;

  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const start = sorted[0]?.timestamp ?? new Date().toISOString();
  const end = sorted[sorted.length - 1]?.timestamp ?? start;

  // Index post events by target so we can attach exit codes to pre events.
  const postByTarget = new Map<string, LogEvent>();
  for (const e of sorted) {
    if (e.kind === 'post_tool_use') {
      const target = asString(e.payload['target']);
      if (target) postByTarget.set(target, e);
    }
  }

  for (const e of sorted) {
    if (e.kind === 'pre_tool_use') {
      const tool = asString(e.payload['tool']) ?? '';
      if (tool.toLowerCase() !== 'bash') continue;
      const command = asString(e.payload['target']) ?? '';
      const level = (asNumber(e.payload['risk_level']) ?? 0) as 0 | 1 | 2 | 3;
      const post = postByTarget.get(command);
      const exitCode = post ? asNumber(post.payload['exit_code']) : null;
      commands.push({
        command,
        risk_level: level,
        exit_code: exitCode,
        summary: summarizeCommand(command, exitCode),
        timestamp: e.timestamp,
      });

      if (level === 2) {
        approvals.push({
          action: command,
          risk_level: 2,
          approved: true, // If we got here, Claude Code surfaced and user approved.
          timestamp: e.timestamp,
        });
      }
      if (level === 3) {
        blockedCount++;
        approvals.push({
          action: command,
          risk_level: 3,
          approved: false,
          timestamp: e.timestamp,
        });
      }

      if (detectTestCommand(command)) {
        const result: 'passed' | 'failed' | 'not_run' =
          exitCode === 0 ? 'passed' : exitCode === null ? 'not_run' : 'failed';
        tests.push({
          command,
          result,
          summary: summarizeCommand(command, exitCode),
        });
      }
    }
  }

  return { start, end, commands, approvals, tests, blockedCount };
}

function shouldTriggerChallenge(
  diff: Awaited<ReturnType<typeof workingDiff>>,
  agg: AggregatedEvents,
  config: Config,
): { triggered: boolean; reason: string } {
  const reasons: string[] = [];
  if (agg.approvals.some((a) => a.risk_level >= 2)) reasons.push('Level 2 or 3 action');
  if (diff.files.some((f) => isHighRiskPath(f.path))) reasons.push('security-sensitive path changed');
  const ranTests = agg.tests.length > 0;
  if (!ranTests && diff.filesChanged > 0) reasons.push('no tests were run after code changes');
  if (agg.tests.some((t) => t.result === 'failed')) reasons.push('tests failed');
  if (diff.filesChanged > config.risk_thresholds.max_files_before_challenge) {
    reasons.push(`more than ${config.risk_thresholds.max_files_before_challenge} files changed`);
  }
  if (diff.insertions + diff.deletions > config.risk_thresholds.max_lines_before_challenge) {
    reasons.push(
      `more than ${config.risk_thresholds.max_lines_before_challenge} lines changed`,
    );
  }
  return { triggered: reasons.length > 0, reason: reasons.join('; ') };
}

function buildUncertainties(
  diff: Awaited<ReturnType<typeof workingDiff>>,
  agg: AggregatedEvents,
): Receipt['uncertainties'] {
  const out: Receipt['uncertainties'] = [];
  if (diff.filesChanged > 0 && agg.tests.length === 0) {
    out.push({
      uncertainty: 'Code was changed but no test command was observed in this session.',
      recommended_verification: 'Run the project test suite before relying on this change.',
    });
  }
  for (const t of agg.tests) {
    if (t.result === 'failed') {
      out.push({
        uncertainty: `Test command failed: ${t.command}`,
        recommended_verification: 'Re-run after fixing the failing tests.',
      });
    }
  }
  for (const f of diff.files) {
    if (isHighRiskPath(f.path)) {
      out.push({
        uncertainty: `Security-sensitive file modified: ${f.path}`,
        recommended_verification: 'Have a reviewer inspect this change before merging.',
      });
    }
  }
  return out;
}

function buildEvidence(
  diff: Awaited<ReturnType<typeof workingDiff>>,
  agg: AggregatedEvents,
): Receipt['evidence'] {
  const evidence: Receipt['evidence'] = [];
  for (const t of agg.tests) {
    evidence.push({
      claim: `Test command ${t.command} ${t.result}.`,
      evidence_type: 'test_result',
      source: t.command,
      confidence: t.result === 'passed' ? 'high' : 'low',
    });
  }
  if (diff.filesChanged > 0) {
    evidence.push({
      claim: `${diff.filesChanged} file(s) changed totalling +${diff.insertions}/-${diff.deletions} lines.`,
      evidence_type: 'diff',
      source: 'git diff HEAD',
      confidence: 'high',
    });
  }
  return evidence;
}

function chooseFinalStatus(
  diff: Awaited<ReturnType<typeof workingDiff>>,
  agg: AggregatedEvents,
  challengeTriggered: boolean,
): Receipt['final_status'] {
  if (agg.blockedCount > 0) return 'blocked';
  if (agg.tests.some((t) => t.result === 'failed')) return 'failed';
  if (challengeTriggered || diff.files.some((f) => isHighRiskPath(f.path))) {
    return 'completed_with_warnings';
  }
  return 'completed';
}

export async function buildReceipt(
  paths: TraceguardPaths,
  sessionId: string,
  config: Config,
  agent: 'claude-code' | 'codex' = 'claude-code',
): Promise<Receipt> {
  const logger = new SessionLogger(paths.logsDir, sessionId, config.logging.redact_secrets);
  const events = logger.read();
  const agg = aggregateEvents(events);
  const ctx = await gitContext(paths.repoRoot);
  const diff = await workingDiff(paths.repoRoot);
  const challenge = shouldTriggerChallenge(diff, agg, config);

  const receipt: Receipt = {
    traceguard_version: PACKAGE_VERSION,
    agent,
    session_id: sessionId,
    timestamp_start: agg.start,
    timestamp_end: agg.end,
    repository: {
      root: paths.repoRoot,
      git_remote_hash: ctx.remoteHash,
      git_branch: ctx.branch,
      git_commit_before: null,
      git_commit_after: ctx.headCommit,
    },
    user_request_summary: '(not captured — populate from agent input in a future version)',
    files_changed: diff.files.map((f) => ({
      path: f.path,
      change_type: f.changeType,
      lines_added: f.insertions,
      lines_removed: f.deletions,
    })),
    commands_run: agg.commands,
    approvals: agg.approvals,
    evidence: buildEvidence(diff, agg),
    tests: agg.tests,
    uncertainties: buildUncertainties(diff, agg),
    challenge_pass: {
      triggered: challenge.triggered,
      trigger_reason: challenge.reason,
      result: challenge.triggered ? 'recommended' : 'skipped',
      summary: challenge.triggered
        ? 'Static challenge recommended. Run `traceguard verify` for details.'
        : 'No challenge pass required.',
    },
    final_status: chooseFinalStatus(diff, agg, challenge.triggered),
  };

  return ReceiptSchema.parse(receipt);
}

export function renderMarkdown(r: Receipt): string {
  const lines: string[] = [];
  lines.push('# TRACEguard Receipt');
  lines.push('');
  lines.push(`- **Agent:** ${r.agent}`);
  lines.push(`- **Session:** ${r.session_id}`);
  lines.push(`- **Started:** ${r.timestamp_start}`);
  lines.push(`- **Ended:** ${r.timestamp_end}`);
  lines.push(`- **Status:** ${r.final_status}`);
  if (r.repository.git_branch) lines.push(`- **Branch:** ${r.repository.git_branch}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(r.user_request_summary);
  lines.push('');

  if (r.files_changed.length) {
    lines.push('## Files Changed');
    for (const f of r.files_changed) {
      lines.push(`- \`${f.path}\` — ${f.change_type} (+${f.lines_added ?? 0}/-${f.lines_removed ?? 0})`);
    }
    lines.push('');
  }

  if (r.commands_run.length) {
    lines.push('## Commands Run');
    for (const c of r.commands_run) {
      lines.push(`- \`${c.command}\` — risk L${c.risk_level}, ${c.summary}`);
    }
    lines.push('');
  }

  if (r.tests.length) {
    lines.push('## Tests');
    for (const t of r.tests) {
      lines.push(`- \`${t.command}\` — **${t.result}**`);
    }
    lines.push('');
  }

  if (r.approvals.length) {
    lines.push('## Approvals');
    for (const a of r.approvals) {
      lines.push(`- L${a.risk_level} ${a.approved ? 'approved' : 'blocked'}: \`${a.action}\``);
    }
    lines.push('');
  }

  if (r.evidence.length) {
    lines.push('## Evidence');
    for (const e of r.evidence) {
      lines.push(`- **${e.confidence}** (${e.evidence_type}): ${e.claim} — _${e.source}_`);
    }
    lines.push('');
  }

  if (r.uncertainties.length) {
    lines.push('## Uncertainties');
    for (const u of r.uncertainties) {
      lines.push(`- ${u.uncertainty}`);
      lines.push(`  - **Verify by:** ${u.recommended_verification}`);
    }
    lines.push('');
  }

  lines.push('## Challenge Pass');
  lines.push(`- Triggered: ${r.challenge_pass.triggered ? 'yes' : 'no'}`);
  if (r.challenge_pass.trigger_reason) {
    lines.push(`- Reason: ${r.challenge_pass.trigger_reason}`);
  }
  lines.push(`- Result: ${r.challenge_pass.result}`);
  lines.push(`- ${r.challenge_pass.summary}`);

  return lines.join('\n') + '\n';
}

export async function buildAndWriteReceipt(
  paths: TraceguardPaths,
  sessionId: string,
  config: Config,
  agent: 'claude-code' | 'codex' = 'claude-code',
): Promise<ReceiptWriteResult> {
  if (!existsSync(paths.receiptsDir)) {
    mkdirSync(paths.receiptsDir, { recursive: true });
  }
  const receipt = await buildReceipt(paths, sessionId, config, agent);
  const stamp = receipt.timestamp_end.replace(/[:.]/g, '-');
  const base = `${stamp}-${sessionId}`;
  const jsonPath = join(paths.receiptsDir, `${base}.json`);
  const markdownPath = join(paths.receiptsDir, `${base}.md`);
  writeFileSync(jsonPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  writeFileSync(markdownPath, renderMarkdown(receipt), 'utf8');
  return { jsonPath, markdownPath, receipt };
}

export function listReceipts(receiptsDir: string): { path: string; mtimeMs: number }[] {
  if (!existsSync(receiptsDir)) return [];
  return readdirSync(receiptsDir)
    .filter((f) => f.endsWith('.md') && f !== 'CHALLENGE.md')
    .map((f) => {
      const full = join(receiptsDir, f);
      return { path: full, mtimeMs: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function latestReceiptPath(receiptsDir: string): string | null {
  const all = listReceipts(receiptsDir);
  return all[0]?.path ?? null;
}
