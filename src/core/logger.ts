import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { redact } from './secrets.js';

export interface LogEvent {
  timestamp: string;
  kind: string;
  payload: Record<string, unknown>;
}

export class SessionLogger {
  private readonly logFile: string;
  private readonly redactSecrets: boolean;

  constructor(logsDir: string, sessionId: string, redactSecrets = true) {
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    this.logFile = join(logsDir, `session-${sessionId}.jsonl`);
    this.redactSecrets = redactSecrets;
  }

  get path(): string {
    return this.logFile;
  }

  log(kind: string, payload: Record<string, unknown> = {}): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      kind,
      payload,
    };
    let line = JSON.stringify(event);
    if (this.redactSecrets) line = redact(line);
    appendFileSync(this.logFile, line + '\n', 'utf8');
  }

  read(): LogEvent[] {
    if (!existsSync(this.logFile)) return [];
    const raw = readFileSync(this.logFile, 'utf8');
    return raw
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as LogEvent);
  }
}

/**
 * Stable session ID for the current process. Reads/writes a small file under
 * .traceguard/logs/.current-session so PreToolUse, PostToolUse, and Stop
 * hooks all share the same id within one agent session.
 */
export function getOrCreateSessionId(currentSessionFile: string): string {
  if (existsSync(currentSessionFile)) {
    const id = readFileSync(currentSessionFile, 'utf8').trim();
    if (id) return id;
  }
  const id = newSessionId();
  const dir = dirname(currentSessionFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(currentSessionFile, id, 'utf8');
  return id;
}

export function clearCurrentSession(currentSessionFile: string): void {
  if (existsSync(currentSessionFile)) {
    writeFileSync(currentSessionFile, '', 'utf8');
  }
}

export function newSessionId(): string {
  const t = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${t}-${rand}`;
}
