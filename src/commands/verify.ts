import { readFileSync } from 'node:fs';
import pc from 'picocolors';
import { runStaticChallenge } from '../challenge/static.js';
import { writeSelfChallengePrompt } from '../challenge/self.js';
import { runReviewerChallenge } from '../challenge/reviewer.js';
import { loadConfig } from '../core/config.js';
import { resolvePaths } from '../core/paths.js';
import { ReceiptSchema, latestReceiptPath } from '../core/receipt.js';
import { dim, heading, tag } from '../core/style.js';

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

  console.log(heading('TRACEguard challenge pass'));
  console.log();

  const staticResult = await runStaticChallenge(paths, config, receipt);
  const headline =
    staticResult.result === 'passed'
      ? pc.green('PASSED')
      : staticResult.result === 'warn'
        ? pc.yellow('WARN')
        : pc.red('BLOCK');
  console.log(heading(`Static challenge:`) + ` ${headline}`);
  for (const f of staticResult.findings) {
    const line =
      f.severity === 'block'
        ? tag.block(`[${f.category}] ${f.detail}`)
        : f.severity === 'warn'
          ? tag.warn(`[${f.category}] ${f.detail}`)
          : `${dim('·')} [${f.category}] ${f.detail}`;
    console.log(`  ${line}`);
  }
  if (staticResult.findings.length === 0) {
    console.log(`  ${tag.ok('no findings')}`);
  }
  console.log();

  if (config.challenge.self_challenge_on_high_risk && staticResult.result !== 'passed') {
    const promptPath = writeSelfChallengePrompt(paths);
    console.log(heading('Self-challenge:'));
    console.log(`  ${tag.arrow('written to ' + promptPath)}`);
    console.log(dim('  the agent should address this prompt before finalizing'));
    console.log();
  }

  if (config.challenge.reviewer_mode) {
    console.log(heading('Independent reviewer:'));
    const r = await runReviewerChallenge(receipt);
    console.log(`  verdict: ${r.verdict}`);
    if (r.output) console.log(dim('  ' + r.output.split('\n').slice(0, 8).join('\n  ')));
    console.log();
  }

  console.log(heading(`Receipt: `) + latest);
  process.exit(staticResult.result === 'block' ? 2 : 0);
}
