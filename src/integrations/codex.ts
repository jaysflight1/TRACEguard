import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../core/config.js';
import { hasBlock, insertBlock, removeBlock } from '../core/markers.js';
import { resolvePaths } from '../core/paths.js';
import { dim, heading, tag } from '../core/style.js';
import { AGENTS_BLOCK } from '../templates/index.js';

const CODEX_TG_START = '# TRACEguard:start';
const CODEX_TG_END = '# TRACEguard:end';

function codexConfigPath(): string | null {
  const candidates = [join(homedir(), '.codex', 'config.toml')];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function tgBlockBody(config: ReturnType<typeof loadConfig>): string {
  return [
    `sandbox_mode = "${config.agents.codex.sandbox_mode}"`,
    `approval_policy = "${config.agents.codex.approval_policy}"`,
    `# network_access = "restricted"  # uncomment if your Codex build supports it`,
  ].join('\n');
}

function injectIntoToml(content: string, body: string): string {
  const startIdx = content.indexOf(CODEX_TG_START);
  const endIdx = content.indexOf(CODEX_TG_END);
  const block = `${CODEX_TG_START}\n${body}\n${CODEX_TG_END}`;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return (
      content.slice(0, startIdx) + block + content.slice(endIdx + CODEX_TG_END.length)
    );
  }
  const sep = content.length === 0 || content.endsWith('\n') ? '' : '\n';
  return content + sep + (content.length ? '\n' : '') + block + '\n';
}

function stripFromToml(content: string): string {
  const startIdx = content.indexOf(CODEX_TG_START);
  const endIdx = content.indexOf(CODEX_TG_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return content;
  const before = content.slice(0, startIdx).replace(/\n+$/, '');
  let after = content.slice(endIdx + CODEX_TG_END.length);
  if (after.startsWith('\n')) after = after.slice(1);
  return before + (before && after ? '\n\n' : '') + after;
}

export function enableCodex(): void {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  config.agents.codex.enabled = true;
  saveConfig(paths.configFile, config);

  insertBlock(paths.agentsMd, 'protocol', AGENTS_BLOCK);
  console.log(heading('TRACEguard enabled for Codex CLI.'));
  console.log('  ' + tag.ok(`protocol block: ${paths.agentsMd}`));

  const codexConfig = codexConfigPath();
  if (codexConfig) {
    const current = readFileSync(codexConfig, 'utf8');
    const updated = injectIntoToml(current, tgBlockBody(config));
    if (updated !== current) {
      writeFileSync(codexConfig, updated, 'utf8');
      console.log('  ' + tag.ok(`Codex config updated: ${codexConfig}`));
    } else {
      console.log('  ' + tag.exists(`Codex config already up to date: ${codexConfig}`));
    }
  } else {
    console.log('  ' + tag.warn(`Codex config not found at ~/.codex/config.toml — recommended settings:`));
    console.log();
    console.log(dim(tgBlockBody(config).split('\n').map((l) => '    ' + l).join('\n')));
    console.log();
    console.log(dim('  Add the block above to your Codex config when ready.'));
  }
}

export function disableCodex(): void {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  config.agents.codex.enabled = false;
  saveConfig(paths.configFile, config);

  removeBlock(paths.agentsMd, 'protocol');
  console.log(heading('TRACEguard disabled for Codex CLI.'));
  console.log('  ' + tag.ok(`protocol block removed from ${paths.agentsMd}`));

  const codexConfig = codexConfigPath();
  if (codexConfig) {
    const current = readFileSync(codexConfig, 'utf8');
    const updated = stripFromToml(current);
    if (updated !== current) {
      writeFileSync(codexConfig, updated, 'utf8');
      console.log('  ' + tag.ok(`Codex config cleaned: ${codexConfig}`));
    }
  }
}

export function isCodexEnabled(): boolean {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  return config.agents.codex.enabled && hasBlock(paths.agentsMd, 'protocol');
}
