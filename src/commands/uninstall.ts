import { rmSync, existsSync } from 'node:fs';
import { disableClaude } from '../integrations/claude.js';
import { disableCodex } from '../integrations/codex.js';
import { resolvePaths } from '../core/paths.js';
import { dim, heading, tag } from '../core/style.js';

export interface UninstallOptions {
  purge?: boolean;
}

export function runUninstall(opts: UninstallOptions = {}): void {
  const paths = resolvePaths();
  console.log(heading('Removing TRACEguard from this repo'));
  console.log();
  disableClaude();
  console.log();
  disableCodex();
  console.log();

  if (opts.purge) {
    if (existsSync(paths.traceguardDir)) {
      rmSync(paths.traceguardDir, { recursive: true, force: true });
      console.log(tag.warn(`purged: ${paths.traceguardDir}`));
    }
  } else {
    console.log(dim(`.traceguard/ retained (use --purge to delete config, logs, and receipts)`));
  }
  console.log();
  console.log(tag.ok('Done.'));
}
