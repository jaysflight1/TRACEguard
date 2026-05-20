import { readFileSync } from 'node:fs';
import pc from 'picocolors';
import { runStaticChallenge } from '../challenge/static.js';
import { writeSelfChallengePrompt } from '../challenge/self.js';
import { runReviewerChallenge } from '../challenge/reviewer.js';
import { loadConfig } from '../core/config.js';
import { resolvePaths } from '../core/paths.js';
import { ReceiptSchema, latestReceiptPath } from '../core/receipt.js';

export async function runVerify(): Promise<void> {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  const latest = latestReceiptPath(paths.receiptsDir);
  if (!latest) {
    console.log('No receipt to verify yet. Run an agent session first.');
    process.exit(1);
  }
  const jsonPath = latest.replace(/\.md$/, '.json');
  const receipt = ReceiptSchema.parse(JSON.parse(readFileSync(jsonPath, 'utf8')));

  console.log(pc.bold('TRACEguard challenge pass\n'));

  // Static challenge always runs.
  const staticResult = await runStaticChallenge(paths, config, receipt);
  console.log(pc.bold(`Static challenge: ${staticResult.result.toUpperCase()}`));
  for (const f of staticResult.findings) {
    const tag =
      f.severity === 'block' ? pc.red('BLOCK') : f.severity === 'warn' ? pc.yellow('WARN ') : pc.dim('INFO ');
    console.log(`  ${tag} [${f.category}] ${f.detail}`);
  }
  if (staticResult.findings.length === 0) {
    console.log(pc.dim('  no findings'));
  }
  console.log();

  // Self-challenge: write the prompt file so the agent picks it up on next turn.
  if (config.challenge.self_challenge_on_high_risk && staticResult.result !== 'passed') {
    const promptPath = writeSelfChallengePrompt(paths);
    console.log(pc.bold('Self-challenge:'));
    console.log(`  written to ${promptPath}`);
    console.log(pc.dim('  the agent should address this prompt before finalizing\n'));
  }

  // Optional reviewer.
  if (config.challenge.reviewer_mode) {
    console.log(pc.bold('Independent reviewer:'));
    const r = await runReviewerChallenge(receipt);
    console.log(`  verdict: ${r.verdict}`);
    if (r.output) console.log(pc.dim('  ' + r.output.split('\n').slice(0, 8).join('\n  ')));
    console.log();
  }

  console.log(pc.bold(`Receipt: ${latest}`));
  process.exit(staticResult.result === 'block' ? 2 : 0);
}
