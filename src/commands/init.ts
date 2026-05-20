import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { defaultConfig, loadConfig, saveConfig } from '../core/config.js';
import { insertBlock } from '../core/markers.js';
import { resolvePaths } from '../core/paths.js';
import { dim, heading, printBanner, tag } from '../core/style.js';
import { PACKAGE_VERSION } from '../core/version.js';
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

  if (!existsSync(paths.configFile)) {
    const fresh = defaultConfig();
    fresh.version = PACKAGE_VERSION;
    saveConfig(paths.configFile, fresh);
    created.push(paths.configFile);
  } else if (opts.force) {
    const current = loadConfig(paths.configFile);
    current.version = PACKAGE_VERSION;
    saveConfig(paths.configFile, current);
    ensured.push(paths.configFile);
  } else {
    ensured.push(paths.configFile);
  }

  insertBlock(paths.claudeMd, 'protocol', CLAUDE_BLOCK);
  insertBlock(paths.agentsMd, 'protocol', AGENTS_BLOCK);
  ensured.push(paths.claudeMd, paths.agentsMd);

  const tgGitignore = `${paths.traceguardDir}/.gitignore`;
  if (!existsSync(tgGitignore)) {
    writeFileSync(tgGitignore, 'logs/\n', 'utf8');
    created.push(tgGitignore);
  }

  const rel = (p: string): string => p.replace(paths.repoRoot + '/', '');

  printBanner();
  console.log();
  console.log(heading('TRACEguard initialized.'));
  console.log();
  if (created.length) {
    console.log(heading('  Created'));
    for (const p of created) console.log('    ' + tag.added(rel(p)));
  }
  if (ensured.length) {
    console.log();
    console.log(dim('  Already present'));
    for (const p of ensured) console.log('    ' + tag.exists(rel(p)));
  }
  console.log();
  console.log(heading('Next steps'));
  console.log(`  1. Activate the agent you use:`);
  console.log(`       ${tag.arrow('npx traceguard on claude     (or:  npx tg on claude)')}`);
  console.log(`       ${tag.arrow('npx traceguard on codex      (or:  npx tg on codex)')}`);
  console.log(`  2. Confirm activation:`);
  console.log(`       ${tag.arrow('npx traceguard status        (or:  npx tg status)')}`);
  console.log();
  console.log(dim('If TRACEguard is installed globally (`npm install -g traceguard`),'));
  console.log(dim('you can drop the `npx` prefix and just run `traceguard` or `tg`.'));
  console.log(dim('See `npx traceguard --help` or COMMANDS.md for the full reference.'));
}
