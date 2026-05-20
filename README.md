# TraceGuard

Open-source trust layer for AI coding agents. TRACEguard adds a lightweight governance layer around Claude Code and Codex CLI through project instructions, permission boundaries, hooks, structured logging, and optional verification passes.

The protocol is organized around five interventions:

| Letter | Intervention | Goal |
|---|---|---|
| **T** | Tool Boundaries | Prevent unsafe or unaccountable actions |
| **R** | Reason-Grounded Receipts | Auditable summaries of what the agent did and why |
| **A** | Abstention and Uncertainty | Mark low-confidence or unsupported claims |
| **C** | Challenge Pass | Verify risky or unsupported outputs before finalizing |
| **E** | Evidence Binding | Tie claims to repo evidence, tests, or external sources |

See [`TRACEguard_protocol.md`](./TRACEguard_protocol.md) for the full protocol and [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the build plan.

## Quick start

```bash
# from inside a project repo
npx traceguard init        # scaffold .traceguard/, CLAUDE.md, AGENTS.md
npx traceguard on claude   # wire up .claude/settings.json hooks
npx traceguard on codex    # inject AGENTS.md block + recommend codex sandbox
npx traceguard status      # show current activation state
```

After an agent session, inspect the receipt:

```bash
npx traceguard receipt latest
npx traceguard verify           # force a challenge pass against the latest receipt
```

To remove TRACEguard:

```bash
npx traceguard uninstall          # reverse all marker-block edits
npx traceguard uninstall --purge  # also delete .traceguard/
```

## What it does, mechanically

- **`init`** scaffolds `.traceguard/{logs,receipts,policies,hooks}` and a default config, and inserts the protocol block into `CLAUDE.md` / `AGENTS.md` via HTML-comment sentinels so the edits are fully reversible.
- **`on claude`** writes hook shim scripts into `.traceguard/hooks/` and merges TRACEguard-tagged entries into `.claude/settings.json` for `PreToolUse`, `PostToolUse`, and `Stop`. User-defined hooks are preserved.
- **PreToolUse** classifies every Bash / Edit / Write into Level 0–3 (per the protocol) and emits a JSON decision back to Claude Code: silent allow, log-and-allow, ask, or block.
- **PostToolUse** appends the tool result (with secrets redacted) to the session's JSONL log.
- **Stop** builds a structured receipt from the session log + `git diff HEAD`, validated against a zod schema, and writes both `.json` and `.md` into `.traceguard/receipts/`.
- **`verify`** runs a static challenge pass — risky-path scan, secret regex over the diff, configured lint/typecheck reruns, threshold checks — and optionally writes a self-challenge prompt or invokes an independent reviewer.

## Development

```bash
npm install
npm run build
node bin/traceguard.js --help
```

This package targets Node 20+.
