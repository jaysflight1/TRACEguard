import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hasBlock, insertBlock, removeBlock } from '../src/core/markers.js';

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-markers-'));
  return join(dir, 'CLAUDE.md');
}

describe('markers', () => {
  it('creates a file with just the block if missing', () => {
    const f = tmpFile();
    insertBlock(f, 'protocol', 'hello');
    const content = readFileSync(f, 'utf8');
    expect(content).toContain('<!-- TRACEguard:start blockId=protocol -->');
    expect(content).toContain('hello');
    expect(content).toContain('<!-- TRACEguard:end blockId=protocol -->');
  });

  it('appends to existing user content without touching it', () => {
    const f = tmpFile();
    writeFileSync(f, '# User docs\n\nimportant', 'utf8');
    insertBlock(f, 'protocol', 'block body');
    const content = readFileSync(f, 'utf8');
    expect(content.startsWith('# User docs\n\nimportant')).toBe(true);
    expect(content).toContain('block body');
  });

  it('is idempotent — second insert replaces, does not duplicate', () => {
    const f = tmpFile();
    insertBlock(f, 'protocol', 'first');
    insertBlock(f, 'protocol', 'second');
    const content = readFileSync(f, 'utf8');
    expect(content).not.toContain('first');
    expect(content).toContain('second');
    const starts = content.match(/TRACEguard:start blockId=protocol/g)?.length ?? 0;
    expect(starts).toBe(1);
  });

  it('removeBlock leaves surrounding content intact', () => {
    const f = tmpFile();
    writeFileSync(f, 'before\n', 'utf8');
    insertBlock(f, 'protocol', 'middle');
    removeBlock(f, 'protocol');
    const content = readFileSync(f, 'utf8');
    expect(content).toContain('before');
    expect(content).not.toContain('middle');
    expect(content).not.toContain('TRACEguard');
  });

  it('hasBlock detects presence', () => {
    const f = tmpFile();
    expect(hasBlock(f, 'protocol')).toBe(false);
    insertBlock(f, 'protocol', 'x');
    expect(hasBlock(f, 'protocol')).toBe(true);
    removeBlock(f, 'protocol');
    expect(hasBlock(f, 'protocol')).toBe(false);
  });
});
