import { readFileSync } from 'node:fs';
import pc from 'picocolors';
import { latestReceiptPath, listReceipts } from '../core/receipt.js';
import { resolvePaths } from '../core/paths.js';

export function runReceiptLatest(): void {
  const paths = resolvePaths();
  const latest = latestReceiptPath(paths.receiptsDir);
  if (!latest) {
    console.log('No receipts found. Receipts are produced when an agent session ends.');
    return;
  }
  console.log(readFileSync(latest, 'utf8'));
  console.log(pc.dim(`(${latest})`));
}

export function runReceiptList(): void {
  const paths = resolvePaths();
  const all = listReceipts(paths.receiptsDir);
  if (all.length === 0) {
    console.log('No receipts found.');
    return;
  }
  for (const r of all) {
    const stamp = new Date(r.mtimeMs).toISOString();
    console.log(`${stamp}  ${r.path}`);
  }
}
