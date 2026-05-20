import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { defaultConfig, loadConfig, saveConfig } from '../core/config.js';
import { insertBlock } from '../core/markers.js';
import { resolvePaths } from '../core/paths.js';
import { AGENTS_BLOCK, CLAUDE_BLOCK } from '../templates/index.js';

export interface InitOptions {
  force?: boolean;
}

export function runInit(opts: InitOptions = {}): void {
  const paths = resolvePaths();

  const created: string[] = [];
  const ensured: string[] = [];

  for (const dir of [
    paths.traceguardDir,
    paths.logsDir,
    paths.receiptsDir,
    paths.policiesDir,
    paths.hooksDir,
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      created.push(dir);
    } else {
      ensured.push(dir);
    }
  }

  // Config file: write defaults if missing, otherwise leave alone unless --force.
  if (!existsSync(paths.configFile)) {
    saveConfig(paths.configFile, defaultConfig());
    created.push(paths.configFile);
  } else if (opts.force) {
    const current = loadConfig(paths.configFile);
    saveConfig(paths.configFile, current);
    ensured.push(paths.configFile);
  } else {
    ensured.push(paths.configFile);
  }

  // Insert the protocol block into CLAUDE.md and AGENTS.md without touching
  // any user content outside the markers. If the file doesn't exist yet, it's
  // created containing just the marked block.
  insertBlock(paths.claudeMd, 'protocol', CLAUDE_BLOCK);
  insertBlock(paths.agentsMd, 'protocol', AGENTS_BLOCK);
  ensured.push(paths.claudeMd, paths.agentsMd);

  // .gitignore inside .traceguard so per-session logs don't get committed by
  // default. Receipts and config are committable.
  const tgGitignore = `${paths.traceguardDir}/.gitignore`;
  if (!existsSync(tgGitignore)) {
    writeFileSync(tgGitignore, 'logs/\n', 'utf8');
    created.push(tgGitignore);
  }

  const rel = (p: string) => p.replace(paths.repoRoot + '/', '');
  console.log(pc.bold('TRACEguard initialized.'));
  if (created.length) {
    console.log(pc.green('  created:'));
    for (const p of created) console.log(`    + ${rel(p)}`);
  }
  if (ensured.length) {
    console.log(pc.dim('  already present:'));
    for (const p of ensured) console.log(pc.dim(`    · ${rel(p)}`));
  }
  console.log();
  console.log('Next: `traceguard on claude` or `traceguard on codex`.');
}
