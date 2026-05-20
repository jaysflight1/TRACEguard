const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'aws_access_key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'aws_secret_key', pattern: /\b(?:aws_)?secret[_-]?access[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi },
  { name: 'github_token', pattern: /\bghp_[A-Za-z0-9]{36,}\b/g },
  { name: 'github_oauth', pattern: /\bgho_[A-Za-z0-9]{36,}\b/g },
  { name: 'github_pat', pattern: /\bgithub_pat_[A-Za-z0-9_]{82,}\b/g },
  { name: 'slack_token', pattern: /\bxox[abrsp]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'openai_key', pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'anthropic_key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'google_api_key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'private_key_pem', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: 'generic_secret', pattern: /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_/+=-]{20,}['"]/gi },
];

export interface SecretFinding {
  name: string;
  index: number;
  match: string;
}

export function findSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const { name, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      findings.push({ name, index: m.index, match: m[0] });
      if (m.index === pattern.lastIndex) pattern.lastIndex++;
    }
  }
  return findings;
}

export function containsSecret(text: string): boolean {
  return findSecrets(text).length > 0;
}

export function redact(text: string): string {
  let out = text;
  for (const { pattern } of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => {
      if (match.length <= 8) return '[REDACTED]';
      return `[REDACTED:${match.length}chars]`;
    });
  }
  return out;
}
