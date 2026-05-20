import { readFileSync } from 'node:fs';
import Table from 'cli-table3';
import { latestReceiptPath, listReceipts } from '../core/receipt.js';
import { resolvePaths } from '../core/paths.js';
import { dim, heading } from '../core/style.js';

export function runReceiptLatest(): void {
  const paths = resolvePaths();
  const latest = latestReceiptPath(paths.receiptsDir);
  if (!latest) {
    console.log('No receipts found. Receipts are produced when an agent session ends.');
    return;
  }
  console.log(readFileSync(latest, 'utf8'));
  console.log(dim(`(${latest})`));
}

export function runReceiptList(): void {
  const paths = resolvePaths();
  const all = listReceipts(paths.receiptsDir);
  if (all.length === 0) {
    console.log('No receipts found.');
    return;
  }
  console.log(heading(`TRACEguard receipts (${all.length})`));
  console.log();
  const t = new Table({
    head: ['When', 'Path'],
    style: { head: ['cyan'], border: ['gray'] },
    colWidths: [26, 60],
    wordWrap: true,
  });
  for (const r of all) {
    t.push([new Date(r.mtimeMs).toISOString(), r.path]);
  }
  console.log(t.toString());
}
