import { buildContext, silentAllow } from './shared.js';

const MAX_OUT = 2048;

function truncate(s: string, max = MAX_OUT): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} bytes]`;
}

function main(): void {
  const ctx = buildContext();
  const input = ctx.event.tool_input ?? {};
  const response = ctx.event.tool_response ?? {};

  const stdoutRaw = typeof response['stdout'] === 'string' ? (response['stdout'] as string) : '';
  const stderrRaw = typeof response['stderr'] === 'string' ? (response['stderr'] as string) : '';
  const exitCode = typeof response['exit_code'] === 'number' ? (response['exit_code'] as number) : null;

  ctx.logger.log('post_tool_use', {
    tool: ctx.event.tool_name ?? null,
    target:
      (typeof input['command'] === 'string' && (input['command'] as string)) ||
      (typeof input['file_path'] === 'string' && (input['file_path'] as string)) ||
      null,
    exit_code: exitCode,
    stdout: stdoutRaw ? truncate(stdoutRaw) : null,
    stderr: stderrRaw ? truncate(stderrRaw) : null,
  });

  silentAllow();
}

main();
