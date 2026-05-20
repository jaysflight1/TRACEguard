import { readFileSync } from 'node:fs';
import { loadConfig } from '../core/config.js';
import { SessionLogger, getOrCreateSessionId } from '../core/logger.js';
import { resolvePaths, type TraceguardPaths } from '../core/paths.js';

export interface HookContext {
  paths: TraceguardPaths;
  logger: SessionLogger;
  sessionId: string;
  config: ReturnType<typeof loadConfig>;
  event: HookEvent;
}

export interface HookEvent {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  [key: string]: unknown;
}

export function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

export function parseEvent(raw: string): HookEvent {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as HookEvent;
  } catch {
    return { raw } as HookEvent;
  }
}

export function buildContext(): HookContext {
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile);
  const raw = readStdin();
  const event = parseEvent(raw);
  const sessionId =
    (typeof event.session_id === 'string' && event.session_id) ||
    getOrCreateSessionId(paths.currentSessionFile);
  const logger = new SessionLogger(
    paths.logsDir,
    sessionId,
    config.logging.redact_secrets,
  );
  return { paths, logger, sessionId, config, event };
}

/**
 * Emit a structured JSON decision back to Claude Code on stdout and exit.
 *
 * Claude Code's hook protocol treats stdout as the decision channel. We use:
 *   - exit 0 with no output           → silently allow
 *   - exit 0 with JSON {decision}     → conveys allow / ask / deny
 *   - exit 2                          → hard block (fallback)
 */
export function emitDecision(decision: {
  decision: 'approve' | 'block' | 'ask';
  reason?: string;
  permissionDecisionReason?: string;
}): never {
  process.stdout.write(JSON.stringify(decision) + '\n');
  process.exit(decision.decision === 'block' ? 2 : 0);
}

export function silentAllow(): never {
  process.exit(0);
}
