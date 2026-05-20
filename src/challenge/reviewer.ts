import { execa } from 'execa';
import type { Receipt } from '../core/receipt.js';

const REVIEWER_PROMPT = `You are the TRACEguard reviewer.

Review the attached session receipt, summarized git diff, and tool
log. Return one of:

- PASS  — work is low-risk, evidence is sufficient.
- WARN  — work may be correct but has unresolved uncertainty.
- BLOCK — work includes unsafe actions, unsupported high-confidence
          claims, undisclosed test failures, or unapproved risky
          operations.

Do not propose large rewrites. Focus only on transparency,
verification, and accountability.
`;

export interface ReviewerResult {
  verdict: 'PASS' | 'WARN' | 'BLOCK' | 'SKIPPED';
  output: string;
}

/**
 * Optional independent reviewer. Defaults to SKIPPED unless the user has
 * `claude` available on PATH and explicitly enabled reviewer mode in config.
 * The actual CLI invocation is best-effort: any failure downgrades to SKIPPED
 * so the receipt still emits.
 */
export async function runReviewerChallenge(receipt: Receipt): Promise<ReviewerResult> {
  try {
    const promptInput = `${REVIEWER_PROMPT}\n\nReceipt JSON:\n${JSON.stringify(receipt, null, 2)}\n`;
    const { exitCode, stdout, stderr } = await execa('claude', ['-p', '--', promptInput], {
      reject: false,
      timeout: 60_000,
    });
    if (exitCode !== 0) {
      return { verdict: 'SKIPPED', output: `claude exited ${exitCode}: ${stderr}` };
    }
    const verdict: ReviewerResult['verdict'] = /\bBLOCK\b/.test(stdout)
      ? 'BLOCK'
      : /\bWARN\b/.test(stdout)
        ? 'WARN'
        : /\bPASS\b/.test(stdout)
          ? 'PASS'
          : 'SKIPPED';
    return { verdict, output: stdout };
  } catch (err) {
    return { verdict: 'SKIPPED', output: `reviewer not available: ${String(err)}` };
  }
}
