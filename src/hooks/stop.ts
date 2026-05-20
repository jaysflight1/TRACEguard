import { clearCurrentSession } from '../core/logger.js';
import { buildContext, silentAllow } from './shared.js';

async function main(): Promise<void> {
  const ctx = buildContext();
  ctx.logger.log('stop', {
    session_id: ctx.sessionId,
  });

  // Receipt generation is implemented in Phase 6; until then we just close
  // the session so the next agent run starts a fresh id. The dynamic import
  // is split through a variable so TypeScript doesn't resolve the path at
  // build time before that module exists.
  try {
    const modPath = '../core/receipt.js';
    const mod = (await import(modPath)) as {
      buildAndWriteReceipt?: (
        paths: typeof ctx.paths,
        sessionId: string,
        config: typeof ctx.config,
      ) => { markdownPath: string };
    };
    if (mod.buildAndWriteReceipt) {
      const result = mod.buildAndWriteReceipt(ctx.paths, ctx.sessionId, ctx.config);
      process.stderr.write(`[traceguard] receipt: ${result.markdownPath}\n`);
    }
  } catch {
    // receipt module not present yet — defer gracefully.
  }

  clearCurrentSession(ctx.paths.currentSessionFile);
  silentAllow();
}

void main();
