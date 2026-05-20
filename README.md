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

> Every command also responds to the shorter `tg` alias —
> `npx tg init`, `npx tg on claude`, `npx tg status`, etc.
> If you `npm install -g traceguard`, drop the `npx` prefix entirely.

After an agent session ends, inspect the receipt:

```bash
npx traceguard receipt latest
npx traceguard verify      # force a challenge pass against the latest receipt
```

To remove TRACEguard:

```bash
npx traceguard uninstall          # reverse all marker-block edits
npx traceguard uninstall --purge  # also delete .traceguard/
```

---

## Commands at a glance

| Command | What it does |
|---|---|
| `traceguard init` | Scaffolds `.traceguard/{logs,receipts,policies,hooks}` and inserts the protocol block into `CLAUDE.md` and `AGENTS.md`. |
| `traceguard on claude` | Enables Claude Code integration: installs hook shims and merges TRACEguard-tagged entries into `.claude/settings.json`. |
| `traceguard on codex` | Enables Codex CLI integration: inserts the `AGENTS.md` block and applies sandbox/approval settings to `~/.codex/config.toml` (or recommends them). |
| `traceguard off claude` | Reverses `on claude` — removes the `CLAUDE.md` block and TRACEguard's `.claude/settings.json` entries while preserving user-added hooks. |
| `traceguard off codex` | Reverses `on codex` — removes the `AGENTS.md` block and TRACEguard's Codex TOML block. |
| `traceguard status` | Reports activation state, hook installation, sandbox/approval settings, policy, challenge mode, summary toggle, and the last receipt path. |
| `traceguard summary on\|off\|status [agent]` | Toggles whether the agent must produce the end-of-task TRACE summary. Flips a flag in `.traceguard/config.json` — never modifies `CLAUDE.md` or `AGENTS.md`. |
| `traceguard receipt latest` | Prints the Markdown of the most recent session receipt. |
| `traceguard receipt list` | Lists every receipt, most recent first. |
| `traceguard verify` | Forces a challenge pass against the latest receipt (static checks, optional self-challenge, optional reviewer). Exits 2 on a block verdict. |
| `traceguard uninstall` | Calls both `off` flows. Pass `--purge` to also delete `.traceguard/`. |
| `traceguard --help` / `--version` | Standard commander help and version output. Works on any subcommand too. |

For each command's exact behavior, options, file effects, and exit codes, see [`COMMANDS.md`](./COMMANDS.md).

---

## Typical workflow

```bash
# one-time setup in a project
cd ~/code/my-project
traceguard init
traceguard on claude

# work normally — Claude Code is now governed by TRACEguard
claude

# after the session, check what happened
traceguard receipt latest

# before merging anything risky
traceguard verify
```

## Development

```bash
npm install
npm run build
npm test
node bin/traceguard.js --help
```

This package targets Node 20+. See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the phase-by-phase build that produced the current tree.
