import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TraceguardPaths } from '../core/paths.js';

const SELF_CHALLENGE_TEXT = `# TRACEguard Self-Challenge

Before finalizing your work, run through this checklist out loud in
your final answer. Do not rewrite your whole answer — just address
each item briefly:

1. **Most likely mistake.** What is the single most likely error in
   what you just produced?
2. **Highest-risk file or command.** Which change (or command) has
   the largest blast radius, and why is it safe?
3. **Unverified claims.** Identify every claim in your answer that
   is not directly verified by a test, command output, or file
   inspection. Mark each as **Likely**, **Assumption**, or **Unknown**.
4. **Cheapest next verification step.** If the user only ran one
   more command to gain confidence, which one would it be?
5. **Should the user review before relying on this?** Answer yes or
   no, with one sentence of justification.

Conclude with a one-line TRACEguard self-assessment: \`PASS\`,
\`WARN\`, or \`NEEDS_REVIEW\`.
`;

export function writeSelfChallengePrompt(paths: TraceguardPaths): string {
  const out = join(paths.receiptsDir, 'CHALLENGE.md');
  writeFileSync(out, SELF_CHALLENGE_TEXT, 'utf8');
  return out;
}
