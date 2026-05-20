import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadConfig, saveConfig } from '../core/config.js';
import { hasBlock, insertBlock, removeBlock } from '../core/markers.js';
import { resolvePaths, type TraceguardPaths } from '../core/paths.js';
import { CLAUDE_BLOCK, CLAUDE_HOOK_SETTINGS } from '../templates/index.js';

const HOOK_SCRIPTS = ['pre-tool-use', 'post-tool-use', 'stop'] as const;
type HookScript = (typeof HOOK_SCRIPTS)[number];

const HOOK_MARK = '__traceguard__';

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function hookShimContent(target: HookScript, repoRoot: string): string {
  // Locate the installed traceguard package. We try in this order:
  //   1. $TRACEGUARD_DIST_DIR (set by tests / dev runs)
  //   2. node_modules/traceguard/dist/hooks/<target>.js inside the repo
  //   3. global npm root
  return `#!/usr/bin/env bash
# TRACEguard hook shim. Pipes Claude Code hook event JSON on stdin to the handler.
set -euo pipefail

REPO_ROOT=${JSON.stringify(repoRoot)}

resolve_handler() {
  if [ -n "\${TRACEGUARD_DIST_DIR:-}" ] && [ -f "$TRACEGUARD_DIST_DIR/hooks/${target}.js" ]; then
    echo "$TRACEGUARD_DIST_DIR/hooks/${target}.js"
    return
  fi
  local local_path="$REPO_ROOT/node_modules/traceguard/dist/hooks/${target}.js"
  if [ -f "$local_path" ]; then
    echo "$local_path"
    return
  fi
  local global_root
  global_root=$(npm root -g 2>/dev/null || true)
  if [ -n "$global_root" ] && [ -f "$global_root/traceguard/dist/hooks/${target}.js" ]; then
    echo "$global_root/traceguard/dist/hooks/${target}.js"
    return
  fi
  return 1
}

HANDLER=$(resolve_handler) || {
  echo "[traceguard] hook handler for ${target} not found; allowing action" >&2
  exit 0
}

exec node --enable-source-maps "$HANDLER" "$@"
`;
}

function writeHookShims(paths: TraceguardPaths): void {
  ensureDir(paths.hooksDir);
  for (const name of HOOK_SCRIPTS) {
    const file = join(paths.hooksDir, `${name}.sh`);
    writeFileSync(file, hookShimContent(name, paths.repoRoot), 'utf8');
    chmodSync(file, 0o755);
  }
}

interface ClaudeSettings {
  hooks?: Record<string, unknown>;
  [k: string]: unknown;
}

function readSettings(file: string): ClaudeSettings {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as ClaudeSettings;
  } catch {
    return {};
  }
}

function writeSettings(file: string, settings: ClaudeSettings): void {
  ensureDir(dirname(file));
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function mergeHookEntries(settings: ClaudeSettings): ClaudeSettings {
  const desired = CLAUDE_HOOK_SETTINGS.hooks;
  const existingHooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const merged: Record<string, unknown[]> = { ...existingHooks };

  for (const [event, entries] of Object.entries(desired)) {
    const current = Array.isArray(merged[event]) ? [...(merged[event] as unknown[])] : [];
    // Remove any prior TRACEguard-tagged entries before re-adding.
    const filtered = current.filter(
      (e) => !(e && typeof e === 'object' && (e as Record<string, unknown>)[HOOK_MARK] === true),
    );
    for (const entry of entries) {
      filtered.push({ ...entry, [HOOK_MARK]: true });
    }
    merged[event] = filtered;
  }

  return { ...settings, hooks: merged };
}

function removeHookEntries(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks || typeof settings.hooks !== 'object') return settings;
  const hooks = settings.hooks as Record<string, unknown[]>;
  const cleaned: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const kept = entries.filter(
      (e) => !(e && typeof e === 'object' && (e as Record<string, unknown>)[HOOK_MARK] === true),
    );
    if (kept.length > 0) cleaned[event] = kept;
  }
  const next: ClaudeSettings = { ...settings };
  if (Object.keys(cleaned).length === 0) {
    delete next.hooks;
  } else {
    next.hooks = cleaned;
  }
  return next;
}

export function enableClaude(): void {
  const paths = resolvePaths();
  ensureDir(paths.traceguardDir);
  ensureDir(paths.hooksDir);

  const config = loadConfig(paths.configFile);
  config.agents.claude.enabled = true;
  saveConfig(paths.configFile, config);

  insertBlock(paths.claudeMd, 'protocol', CLAUDE_BLOCK);

  if (config.agents.claude.hooks_enabled) {
    writeHookShims(paths);
    const settings = readSettings(paths.claudeSettings);
    writeSettings(paths.claudeSettings, mergeHookEntries(settings));
  }

  console.log('TRACEguard enabled for Claude Code.');
  console.log(`  protocol block: ${paths.claudeMd}`);
  if (config.agents.claude.hooks_enabled) {
    console.log(`  hook settings:  ${paths.claudeSettings}`);
    console.log(`  hook shims:     ${paths.hooksDir}`);
  }
}

export function disableClaude(): void {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  config.agents.claude.enabled = false;
  saveConfig(paths.configFile, config);

  removeBlock(paths.claudeMd, 'protocol');

  if (existsSync(paths.claudeSettings)) {
    const settings = readSettings(paths.claudeSettings);
    writeSettings(paths.claudeSettings, removeHookEntries(settings));
  }

  console.log('TRACEguard disabled for Claude Code.');
  console.log(`  protocol block removed from ${paths.claudeMd}`);
  console.log(`  hook entries removed from ${paths.claudeSettings}`);
}

export function isClaudeEnabled(): boolean {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  return (
    config.agents.claude.enabled &&
    hasBlock(paths.claudeMd, 'protocol')
  );
}
