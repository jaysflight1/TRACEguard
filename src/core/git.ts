import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';

export interface GitContext {
  isRepo: boolean;
  branch: string | null;
  headCommit: string | null;
  remoteHash: string | null;
}

export interface DiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: Array<{
    path: string;
    changeType: 'created' | 'modified' | 'deleted' | 'renamed';
    insertions: number;
    deletions: number;
  }>;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function gitContext(repoRoot: string): Promise<GitContext> {
  if (!existsSync(join(repoRoot, '.git'))) {
    return { isRepo: false, branch: null, headCommit: null, remoteHash: null };
  }
  const git: SimpleGit = simpleGit(repoRoot);
  const branchRaw = await safe(() => git.revparse(['--abbrev-ref', 'HEAD']));
  const commit = await safe(() => git.revparse(['HEAD']));
  const remoteUrl = await safe(() => git.getConfig('remote.origin.url'));
  return {
    isRepo: true,
    branch: branchRaw?.trim() || null,
    headCommit: commit?.trim() || null,
    remoteHash: remoteUrl?.value
      ? createHash('sha256').update(remoteUrl.value).digest('hex').slice(0, 16)
      : null,
  };
}

const STATUS_MAP: Record<string, DiffSummary['files'][number]['changeType']> = {
  A: 'created',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'created',
};

export async function workingDiff(repoRoot: string): Promise<DiffSummary> {
  if (!existsSync(join(repoRoot, '.git'))) {
    return { filesChanged: 0, insertions: 0, deletions: 0, files: [] };
  }
  const git = simpleGit(repoRoot);
  const numstat = (await safe(() => git.raw(['diff', '--numstat', 'HEAD']))) ?? '';
  const nameStatus = (await safe(() => git.raw(['diff', '--name-status', 'HEAD']))) ?? '';

  const statusByPath = new Map<string, DiffSummary['files'][number]['changeType']>();
  for (const line of nameStatus.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const code = parts[0] ?? '';
    const path = parts[parts.length - 1] ?? '';
    if (!path) continue;
    const key = code.charAt(0).toUpperCase();
    statusByPath.set(path, STATUS_MAP[key] ?? 'modified');
  }

  const files: DiffSummary['files'] = [];
  let insertions = 0;
  let deletions = 0;
  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue;
    const [insStr, delStr, ...rest] = line.split('\t');
    const path = rest.join('\t');
    if (!path) continue;
    const ins = insStr === '-' ? 0 : Number.parseInt(insStr ?? '0', 10) || 0;
    const del = delStr === '-' ? 0 : Number.parseInt(delStr ?? '0', 10) || 0;
    insertions += ins;
    deletions += del;
    files.push({
      path,
      changeType: statusByPath.get(path) ?? 'modified',
      insertions: ins,
      deletions: del,
    });
  }

  return {
    filesChanged: files.length,
    insertions,
    deletions,
    files,
  };
}
