import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', 'bin', 'traceguard.js');
const DIST = join(__dirname, '..', 'dist');

function run(cwd: string, args: string, input?: string): { stdout: string; status: number } {
  try {
    const stdout = execSync(`node ${CLI} ${args}`, {
      cwd,
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TRACEGUARD_DIST_DIR: DIST },
    }).toString();
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { status: number; stdout?: Buffer; stderr?: Buffer };
    return {
      stdout: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? ''),
      status: e.status ?? 1,
    };
  }
}

function runHook(name: string, cwd: string, event: object): { stdout: string; status: number } {
  const script = join(DIST, 'hooks', `${name}.js`);
  try {
    const stdout = execSync(`node ${script}`, {
      cwd,
      input: JSON.stringify(event),
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString();
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { status: number; stdout?: Buffer; stderr?: Buffer };
    return {
      stdout: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? ''),
      status: e.status ?? 1,
    };
  }
}

describe('e2e', () => {
  let repo: string;

  beforeAll(() => {
    // Ensure build artifacts exist.
    if (!existsSync(DIST)) {
      execSync('npm run build', { cwd: join(__dirname, '..') });
    }
    repo = mkdtempSync(join(tmpdir(), 'tg-e2e-'));
    execSync('git init -q', { cwd: repo });
    execSync('git config user.email t@t', { cwd: repo });
    execSync('git config user.name t', { cwd: repo });
    writeFileSync(join(repo, 'README.md'), '# repo\n', 'utf8');
    execSync('git add README.md && git commit -q -m initial', { cwd: repo });
  });

  it('init scaffolds the .traceguard tree', () => {
    const { stdout, status } = run(repo, 'init');
    expect(status).toBe(0);
    expect(stdout).toContain('TRACEguard initialized');
    expect(existsSync(join(repo, '.traceguard', 'config.json'))).toBe(true);
    expect(existsSync(join(repo, '.traceguard', 'receipts'))).toBe(true);
    expect(existsSync(join(repo, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(repo, 'AGENTS.md'))).toBe(true);
  });

  it('on claude installs hooks and settings, off claude reverses them', () => {
    run(repo, 'on claude');
    expect(existsSync(join(repo, '.claude', 'settings.json'))).toBe(true);
    const settings = JSON.parse(readFileSync(join(repo, '.claude', 'settings.json'), 'utf8'));
    expect(settings.hooks.PreToolUse[0].__traceguard__).toBe(true);

    run(repo, 'off claude');
    const after = JSON.parse(readFileSync(join(repo, '.claude', 'settings.json'), 'utf8'));
    expect(after.hooks).toBeUndefined();
  });

  it('hooks produce a receipt at session end', () => {
    run(repo, 'on claude');

    // Modify a file so the receipt has files_changed > 0.
    writeFileSync(join(repo, 'README.md'), '# repo\n\nedit\n', 'utf8');

    const sid = 'e2e-session';
    runHook('pre-tool-use', repo, {
      session_id: sid,
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    });
    runHook('post-tool-use', repo, {
      session_id: sid,
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
      tool_response: { exit_code: 0, stdout: 'ok' },
    });
    runHook('stop', repo, { session_id: sid });

    const { stdout } = run(repo, 'receipt latest');
    expect(stdout).toContain('TRACEguard Receipt');
    expect(stdout).toContain('README.md');
    expect(stdout).toContain('npm test');
  });

  it('pre-tool-use blocks a Level 3 command', () => {
    const r = runHook('pre-tool-use', repo, {
      session_id: 'e2e-block',
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin main' },
    });
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('block');
  });

  afterAll(() => {
    // best-effort cleanup happens via mkdtemp; nothing to do.
  });
});
