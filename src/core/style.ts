import pc from 'picocolors';

/**
 * Shared visual primitives so every command speaks the same dialect.
 * Symbols degrade to plain ASCII when stdout is not a TTY so log capture,
 * pipes, and CI output stay readable.
 */

const isTty = process.stdout.isTTY === true;

export const symbols = {
  ok: isTty ? '✓' : '+',
  bullet: isTty ? '·' : '-',
  arrow: isTty ? '→' : '->',
  cross: isTty ? '✗' : 'x',
  warn: isTty ? '!' : '!',
  info: isTty ? 'ℹ' : 'i',
  active: isTty ? '●' : '*',
  inactive: isTty ? '○' : 'o',
} as const;

export const tag = {
  ok: (s: string): string => `${pc.green(symbols.ok)} ${s}`,
  added: (s: string): string => `${pc.green(symbols.ok)} ${s}`,
  exists: (s: string): string => `${pc.dim(symbols.bullet)} ${pc.dim(s)}`,
  warn: (s: string): string => `${pc.yellow(symbols.warn)} ${s}`,
  block: (s: string): string => `${pc.red(symbols.cross)} ${s}`,
  arrow: (s: string): string => `${pc.cyan(symbols.arrow)} ${s}`,
  active: (s = 'active'): string => `${pc.green(symbols.active)} ${pc.green(s)}`,
  inactive: (s = 'inactive'): string => `${pc.dim(symbols.inactive)} ${pc.dim(s)}`,
};

const BANNER_LINES = [
  '╔════════════════════════════════════╗',
  '║                                    ║',
  '║   T R A C E G U A R D              ║',
  '║   transparency for AI agents       ║',
  '║                                    ║',
  '╚════════════════════════════════════╝',
];

export function printBanner(): void {
  if (!isTty) return;
  for (const line of BANNER_LINES) {
    process.stdout.write(pc.cyan(line) + '\n');
  }
}

export function heading(s: string): string {
  return pc.bold(pc.cyan(s));
}

export function dim(s: string): string {
  return pc.dim(s);
}
