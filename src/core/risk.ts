import { resolve } from 'node:path';
import type { Config } from './config.js';
import { isInsideRepo } from './paths.js';

export type RiskLevel = 0 | 1 | 2 | 3;

export type Action =
  | { kind: 'bash'; command: string }
  | { kind: 'edit' | 'write' | 'multiedit' | 'read'; path: string };

export interface RiskDecision {
  level: RiskLevel;
  category: string;
  reason: string;
}

const LEVEL3_CMD: { pattern: RegExp; category: string; reason: string }[] = [
  { pattern: /\bgit\s+push\s+.*--force\b|\bgit\s+push\s+-f\b/, category: 'git_force_push', reason: 'force push rewrites remote history' },
  { pattern: /\bgit\s+reset\s+--hard\b/, category: 'git_hard_reset', reason: 'hard reset can destroy uncommitted work' },
  { pattern: /\bcurl\b[^|]*\|\s*(?:ba)?sh\b/, category: 'curl_pipe_shell', reason: 'piping remote content to a shell' },
  { pattern: /\bwget\b[^|]*\|\s*(?:ba)?sh\b/, category: 'wget_pipe_shell', reason: 'piping remote content to a shell' },
  { pattern: /\bnc\b\s+.*-e\b/, category: 'reverse_shell', reason: 'netcat with -e looks like a reverse shell' },
  { pattern: /\bbase64\b.*\|\s*curl\b/, category: 'exfil_pipe', reason: 'base64-encoded payload piped to curl' },
];

const LEVEL2_CMD: { pattern: RegExp; category: string; reason: string }[] = [
  { pattern: /^\s*sudo\b/, category: 'sudo', reason: 'sudo elevates privileges' },
  { pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-rf|-fr)\b/, category: 'rm_rf', reason: 'recursive force-delete' },
  { pattern: /(^|\s)rm\s+/, category: 'rm', reason: 'file deletion' },
  { pattern: /\bchmod\b/, category: 'chmod', reason: 'permission change' },
  { pattern: /\bchown\b/, category: 'chown', reason: 'ownership change' },
  { pattern: /\bkill\b\s+-?\d+|\bpkill\b/, category: 'kill', reason: 'killing processes' },
  { pattern: /\bgit\s+push\b/, category: 'git_push', reason: 'pushing to a remote' },
  { pattern: /\bgh\s+pr\s+create\b/, category: 'pr_create', reason: 'opening a pull request' },
  { pattern: /\bnpm\s+publish\b/, category: 'npm_publish', reason: 'publishing a package' },
  { pattern: /\bnpm\s+install\s+-g\b|\bnpm\s+i\s+-g\b/, category: 'npm_global_install', reason: 'global package install' },
  { pattern: /\bcurl\b(?!.*localhost)(?!.*127\.0\.0\.1)/, category: 'network_call', reason: 'outbound network call' },
  { pattern: /\bwget\b/, category: 'network_call', reason: 'outbound network call' },
];

const LEVEL1_CMD: { pattern: RegExp; category: string; reason: string }[] = [
  { pattern: /\bnpm\s+(?:install|i|ci)\b/, category: 'dep_install', reason: 'installing local dependencies' },
  { pattern: /\b(?:pnpm|yarn)\s+(?:install|add|i)\b/, category: 'dep_install', reason: 'installing local dependencies' },
  { pattern: /\bnpm\s+(?:run\s+)?(?:build|test|lint)\b/, category: 'build_or_test', reason: 'build or test command' },
  { pattern: /\bnpm\s+test\b|\bvitest\b|\bjest\b|\bmocha\b|\bpytest\b/, category: 'test_run', reason: 'running tests' },
  { pattern: /\btsc\b/, category: 'typecheck', reason: 'type checking' },
  { pattern: /\beslint\b|\bprettier\b/, category: 'lint_or_format', reason: 'lint/format' },
];

// File-path patterns. Order matters — Level 3 first, then 2.
const LEVEL3_PATH: { pattern: RegExp; category: string; reason: string }[] = [
  { pattern: /\.traceguard\/(?:logs|receipts|config\.json)/, category: 'traceguard_internals', reason: 'modifying TRACEguard internal state' },
];

const LEVEL2_PATH: { pattern: RegExp; category: string; reason: string }[] = [
  { pattern: /(?:^|\/)\.env(?:\..+)?$/, category: 'env_file', reason: 'environment / secret file' },
  { pattern: /(?:^|\/)\.npmrc$/, category: 'npmrc', reason: 'package registry credentials' },
  { pattern: /(?:^|\/)id_(?:rsa|ed25519|ecdsa|dsa)/, category: 'ssh_key', reason: 'SSH private key' },
  { pattern: /\.(?:pem|key|p12|pfx)$/, category: 'cert_or_key', reason: 'certificate or key material' },
  { pattern: /credentials/i, category: 'credentials_file', reason: 'credentials file' },
  { pattern: /\.github\/workflows\//, category: 'ci_config', reason: 'CI workflow file' },
  { pattern: /(?:^|\/)(?:deploy|infra|terraform|k8s|kubernetes)\//i, category: 'deploy_config', reason: 'deployment / infra config' },
  { pattern: /(?:^|\/)(?:auth|authn|authz|security|payments?|billing|crypto)\//i, category: 'security_path', reason: 'security-sensitive directory' },
  { pattern: /migrations?\//i, category: 'db_migration', reason: 'database migration file' },
];

const LEVEL1_PATH: { pattern: RegExp; category: string; reason: string }[] = [
  { pattern: /(?:^|\/)package-lock\.json$/, category: 'lockfile', reason: 'lockfile change' },
  { pattern: /(?:^|\/)(?:pnpm-lock\.yaml|yarn\.lock)$/, category: 'lockfile', reason: 'lockfile change' },
  { pattern: /(?:^|\/)(?:dist|build|out|coverage)\//, category: 'generated_dir', reason: 'generated output' },
  { pattern: /(?:^|\/)(?:tsconfig.*\.json|\.eslintrc.*|\.prettierrc.*)$/, category: 'config_file', reason: 'project config' },
];

function matches(list: { pattern: RegExp; category: string; reason: string }[], s: string): RiskDecision | null {
  for (const rule of list) {
    if (rule.pattern.test(s)) {
      return { level: 0, category: rule.category, reason: rule.reason };
    }
  }
  return null;
}

export function classify(action: Action, repoRoot: string, config: Config): RiskDecision {
  // Allowlist / denylist overrides take precedence.
  const target = action.kind === 'bash' ? action.command : action.path;
  for (const pat of config.policies.denylist) {
    if (new RegExp(pat).test(target)) {
      return { level: 3, category: 'denylist', reason: `matches denylist pattern: ${pat}` };
    }
  }
  for (const pat of config.policies.allowlist) {
    if (new RegExp(pat).test(target)) {
      return { level: 0, category: 'allowlist', reason: `matches allowlist pattern: ${pat}` };
    }
  }

  if (action.kind === 'bash') {
    const cmd = action.command;
    const l3 = matches(LEVEL3_CMD, cmd);
    if (l3) return { ...l3, level: 3 };
    const l2 = matches(LEVEL2_CMD, cmd);
    if (l2) return { ...l2, level: 2 };
    const l1 = matches(LEVEL1_CMD, cmd);
    if (l1) return { ...l1, level: 1 };
    return { level: 0, category: 'shell', reason: 'no risk pattern matched' };
  }

  // File operations.
  const absPath = resolve(action.path);
  if (!isInsideRepo(repoRoot, absPath)) {
    return {
      level: 2,
      category: 'outside_repo',
      reason: 'file path is outside the repository',
    };
  }

  const rel = absPath.startsWith(repoRoot) ? absPath.slice(repoRoot.length + 1) : action.path;
  const l3 = matches(LEVEL3_PATH, rel);
  if (l3) return { ...l3, level: 3 };
  const l2 = matches(LEVEL2_PATH, rel);
  if (l2) return { ...l2, level: 2 };
  const l1 = matches(LEVEL1_PATH, rel);
  if (l1) return { ...l1, level: 1 };

  if (action.kind === 'read') {
    return { level: 0, category: 'repo_read', reason: 'read inside repo' };
  }
  return { level: 0, category: 'repo_edit', reason: 'edit inside repo' };
}

export function isHighRiskPath(rel: string): boolean {
  return (
    matches(LEVEL3_PATH, rel) !== null ||
    matches(LEVEL2_PATH, rel) !== null
  );
}
