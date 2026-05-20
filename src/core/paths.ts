import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface TraceguardPaths {
  repoRoot: string;
  traceguardDir: string;
  configFile: string;
  logsDir: string;
  receiptsDir: string;
  policiesDir: string;
  hooksDir: string;
  currentSessionFile: string;
  claudeMd: string;
  agentsMd: string;
  claudeSettings: string;
  claudeDir: string;
}

/**
 * Walk up from `start` looking for a `.git` directory or `package.json`.
 * Falls back to `start` itself if neither is found.
 */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export function resolvePaths(repoRoot: string = findRepoRoot()): TraceguardPaths {
  const traceguardDir = join(repoRoot, '.traceguard');
  return {
    repoRoot,
    traceguardDir,
    configFile: join(traceguardDir, 'config.json'),
    logsDir: join(traceguardDir, 'logs'),
    receiptsDir: join(traceguardDir, 'receipts'),
    policiesDir: join(traceguardDir, 'policies'),
    hooksDir: join(traceguardDir, 'hooks'),
    currentSessionFile: join(traceguardDir, 'logs', '.current-session'),
    claudeMd: join(repoRoot, 'CLAUDE.md'),
    agentsMd: join(repoRoot, 'AGENTS.md'),
    claudeDir: join(repoRoot, '.claude'),
    claudeSettings: join(repoRoot, '.claude', 'settings.json'),
  };
}

export function isInsideRepo(repoRoot: string, candidate: string): boolean {
  const r = resolve(repoRoot) + '/';
  const c = resolve(candidate);
  return (c + '/').startsWith(r);
}
