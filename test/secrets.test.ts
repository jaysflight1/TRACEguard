import { describe, expect, it } from 'vitest';
import { containsSecret, findSecrets, redact } from '../src/core/secrets.js';

describe('secrets', () => {
  it('detects an AWS access key id', () => {
    expect(containsSecret('AKIAIOSFODNN7EXAMPLE')).toBe(true);
  });

  it('detects a GitHub PAT', () => {
    expect(containsSecret('ghp_abcdefghijklmnopqrstuvwxyz0123456789')).toBe(true);
  });

  it('detects a PEM private key header', () => {
    expect(containsSecret('-----BEGIN PRIVATE KEY-----')).toBe(true);
  });

  it('returns no findings for ordinary text', () => {
    expect(findSecrets('hello world foo bar 1234')).toEqual([]);
  });

  it('redact replaces secret payload but preserves structure', () => {
    const redacted = redact('token: AKIAIOSFODNN7EXAMPLE end');
    expect(redacted).toContain('end');
    expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});
