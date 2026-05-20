import { classify, type Action } from '../core/risk.js';
import { buildContext, emitDecision, silentAllow } from './shared.js';

function eventToAction(event: { tool_name?: string; tool_input?: Record<string, unknown> }): Action | null {
  const tool = (event.tool_name ?? '').toLowerCase();
  const input = event.tool_input ?? {};
  if (tool === 'bash') {
    const command = typeof input['command'] === 'string' ? (input['command'] as string) : '';
    if (!command) return null;
    return { kind: 'bash', command };
  }
  if (tool === 'edit' || tool === 'write' || tool === 'multiedit') {
    const path = typeof input['file_path'] === 'string' ? (input['file_path'] as string) : '';
    if (!path) return null;
    return { kind: tool as 'edit' | 'write' | 'multiedit', path };
  }
  if (tool === 'read') {
    const path = typeof input['file_path'] === 'string' ? (input['file_path'] as string) : '';
    if (!path) return null;
    return { kind: 'read', path };
  }
  return null;
}

function main(): void {
  const ctx = buildContext();

  // Global pause: hooks short-circuit to allow but still leave a breadcrumb
  // so the receipt records what happened during the paused window.
  if (!ctx.config.enabled) {
    ctx.logger.log('pre_tool_use', {
      tool: ctx.event.tool_name ?? null,
      paused: true,
      target:
        (typeof ctx.event.tool_input?.['command'] === 'string' && ctx.event.tool_input['command']) ||
        (typeof ctx.event.tool_input?.['file_path'] === 'string' && ctx.event.tool_input['file_path']) ||
        null,
    });
    silentAllow();
  }

  const action = eventToAction(ctx.event);
  if (!action) {
    ctx.logger.log('pre_tool_use', { tool: ctx.event.tool_name ?? null, skipped: 'unrecognized tool' });
    silentAllow();
  }

  const decision = classify(action, ctx.paths.repoRoot, ctx.config);
  ctx.logger.log('pre_tool_use', {
    tool: ctx.event.tool_name,
    target: action.kind === 'bash' ? action.command : action.path,
    risk_level: decision.level,
    category: decision.category,
    reason: decision.reason,
  });

  switch (decision.level) {
    case 0:
      silentAllow();
    case 1:
      // Logged but allowed.
      silentAllow();
    case 2:
      emitDecision({
        decision: 'ask',
        reason: `TRACEguard: ${decision.reason} (category: ${decision.category}). Approve before continuing.`,
      });
    case 3:
      emitDecision({
        decision: 'block',
        reason: `TRACEguard blocked: ${decision.reason} (category: ${decision.category}).`,
      });
  }
}

main();
