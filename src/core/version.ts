import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Read the installed traceguard package's version from its own package.json.
 *
 * Layout: this file is at `<root>/src/core/version.ts` in dev and at
 * `<root>/dist/core/version.js` after build — both are two directories below
 * the package root, so the resolution is the same in both cases.
 */
function loadPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, '..', '..', 'package.json');
    const raw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const PACKAGE_VERSION: string = loadPackageVersion();

export interface VersionCheck {
  packageVersion: string;
  configVersion: string;
  matches: boolean;
  /** Hint for the user when a mismatch is detected. */
  hint: string | null;
}

/**
 * Compare the installed package version against the version stamped in the
 * project's .traceguard/config.json. A mismatch means the binary has been
 * updated but the per-project files (CLAUDE.md block, hook shims, settings
 * entries) haven't been refreshed yet.
 */
export function compareVersions(configVersion: string): VersionCheck {
  const matches = configVersion === PACKAGE_VERSION;
  return {
    packageVersion: PACKAGE_VERSION,
    configVersion,
    matches,
    hint: matches
      ? null
      : 'Project config was written by a different TRACEguard version. ' +
        'Run `traceguard init --force` and re-run `traceguard on claude` / `on codex` to refresh.',
  };
}

