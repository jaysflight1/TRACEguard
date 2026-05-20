import { execa } from 'execa';
import { dim, heading, tag } from '../core/style.js';
import { PACKAGE_VERSION } from '../core/version.js';

export interface UpdateOptions {
  source?: 'npm' | 'github';
  check?: boolean;
}

const NPM_SOURCE = 'traceguard@latest';
const GITHUB_SOURCE = 'github:jaysflight1/traceguard';

export async function runUpdate(opts: UpdateOptions = {}): Promise<void> {
  const source = opts.source ?? 'npm';
  const target = source === 'github' ? GITHUB_SOURCE : NPM_SOURCE;

  console.log(heading('TRACEguard update'));
  console.log(`  Current package version: ${PACKAGE_VERSION}`);
  console.log(`  Update source:           ${source} (${target})`);
  console.log();

  if (opts.check) {
    console.log(dim('  --check passed; not running install. Re-run without --check to apply.'));
    return;
  }

  console.log('  ' + tag.arrow(`running: npm install -g ${target}`));
  console.log();

  try {
    const child = execa('npm', ['install', '-g', target], { stdio: 'inherit' });
    await child;
  } catch (err) {
    console.error();
    console.error(tag.block('npm install failed.'));
    const msg = err instanceof Error ? err.message : String(err);
    console.error(dim('  ' + msg));
    console.error();
    console.error(dim('Common fixes:'));
    console.error(dim('  - permission errors: prefix with `sudo`, or use a node version manager (nvm, fnm, asdf).'));
    console.error(dim('  - network errors:    check connectivity, retry, or use `--source github` if npm is down.'));
    process.exit(1);
  }

  console.log();
  console.log(tag.ok('Package updated.'));
  console.log();
  console.log(heading('Next steps'));
  console.log(dim('  Per-project files (CLAUDE.md / AGENTS.md blocks, hook shims, settings entries)'));
  console.log(dim('  are written at install time and do not auto-refresh. For each project using'));
  console.log(dim('  TRACEguard, run inside that repo:'));
  console.log();
  console.log('    ' + tag.arrow('traceguard init --force      # refresh protocol blocks'));
  console.log('    ' + tag.arrow('traceguard on claude         # refresh hook shims + settings'));
  console.log('    ' + tag.arrow('traceguard on codex          # refresh codex sandbox block'));
  console.log();
  console.log(dim('Then `traceguard status` should show package and config versions matching.'));
}
