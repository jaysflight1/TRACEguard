#!/usr/bin/env node
import('../dist/cli.js').catch((err) => {
  console.error('[traceguard] failed to start:', err?.message ?? err);
  process.exit(1);
});
