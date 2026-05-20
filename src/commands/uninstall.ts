import { rmSync, existsSync } from 'node:fs';
import pc from 'picocolors';
import { disableClaude } from '../integrations/claude.js';
import { disableCodex } from '../integrations/codex.js';
import { resolvePaths } from '../core/paths.js';

export interface UninstallOptions {
  purge?: boolean;
}

export function runUninstall(opts: UninstallOptions = {}): void {
  const paths = resolvePaths();
  console.log(pc.bold('Removing TRACEguard from this repo'));
  disableClaude();
  disableCodex();

  if (opts.purge) {
    if (existsSync(paths.traceguardDir)) {
      rmSync(paths.traceguardDir, { recursive: true, force: true });
      console.log(pc.yellow(`  purged: ${paths.traceguardDir}`));
    }
  } else {
    console.log(pc.dim(`  .traceguard/ retained (use --purge to delete config, logs, and receipts)`));
  }
  console.log(pc.green('Done.'));
}
