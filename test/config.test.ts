import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigSchema, defaultConfig, loadConfig, saveConfig } from '../src/core/config.js';

describe('config', () => {
  it('defaultConfig parses cleanly', () => {
    expect(() => defaultConfig()).not.toThrow();
  });

  it('round-trips through disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tg-cfg-'));
    const file = join(dir, 'config.json');
    const original = defaultConfig();
    saveConfig(file, original);
    const loaded = loadConfig(file);
    expect(loaded).toEqual(original);
  });

  it('rejects malformed challenge mode', () => {
    expect(() => ConfigSchema.parse({ challenge: { default_mode: 'wat' } })).toThrow();
  });

  it('returns defaults when file does not exist', () => {
    const loaded = loadConfig('/tmp/does-not-exist-xyzzy/config.json');
    expect(loaded).toEqual(defaultConfig());
  });
});
