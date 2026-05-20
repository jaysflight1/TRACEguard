# TRACEguard Command Reference

Every command runs against the **current working directory's repo root** (walks up to the nearest `.git` or `package.json`). All file edits TRACEguard makes are wrapped in HTML-comment sentinels so they can be reversed cleanly.

> Every command shown below as `traceguard <...>` also accepts the shorter alias `tg <...>`. So `traceguard init` and `tg init` are identical. The long name is used throughout this reference for clarity; pick whichever you prefer day-to-day.

---

## `traceguard init`

Scaffolds the TRACEguard layout in the current repo.

**What it does:**

- Creates `.traceguard/{logs,receipts,policies,hooks}/`
- Writes `.traceguard/config.json` with the default policy (Level 0–3 thresholds, challenge mode = `static`, secret redaction on)
- Inserts the protocol block into `CLAUDE.md` and `AGENTS.md` between `<!-- TRACEguard:start blockId=protocol -->` and `<!-- TRACEguard:end blockId=protocol -->`. If those files don't exist, they're created with just the block. User content outside the markers is never touched.
- Adds `.traceguard/.gitignore` so per-session logs aren't committed by default (receipts and config are committable).

**Usage:**

```bash
traceguard init           # idempotent — safe to re-run
traceguard init --force   # re-write the TRACEguard config and blocks
```

Run this **once per project**. After it succeeds, run `on claude` and/or `on codex`.

---

## `traceguard on claude`

Activates TRACEguard for Claude Code in the current repo.

**What it does:**

1. Ensures `.traceguard/config.json` exists.
2. Inserts (or refreshes) the `CLAUDE.md` protocol block.
3. Installs three executable hook shim scripts in `.traceguard/hooks/`:
   - `pre-tool-use.sh` → invoked before every Bash/Edit/Write/MultiEdit
   - `post-tool-use.sh` → invoked after every tool
   - `stop.sh` → invoked when the agent session ends
4. Merges TRACEguard-tagged entries into `.claude/settings.json` under `PreToolUse`, `PostToolUse`, and `Stop`. Existing user-defined hooks are preserved — TRACEguard's entries carry an internal `__traceguard__` marker so `off` removes exactly them.
5. Sets `agents.claude.enabled = true` in config.

**Usage:**

```bash
traceguard on claude
```

After this, your normal `claude` session in this repo will be governed by TRACEguard — risky commands are classified and either logged, prompted, or blocked, and a receipt is written at session end.

---

## `traceguard on codex`

Activates TRACEguard for Codex CLI in the current repo.

**What it does:**

1. Inserts (or refreshes) the `AGENTS.md` protocol block.
2. If `~/.codex/config.toml` exists, idempotently injects a marked block setting `sandbox_mode = "workspace-write"` and `approval_policy = "on-request"`. If it doesn't exist, prints the recommended block to stdout instead of writing anything you didn't opt into.
3. Sets `agents.codex.enabled = true` in config.

**Usage:**

```bash
traceguard on codex
```

> Codex coverage is best-effort: without a Claude-Code-style hook API, TRACEguard relies on the `AGENTS.md` instructions plus the sandbox/approval defaults to keep risky actions surfaced.

---

## `traceguard off claude`

Reverses `on claude`.

**What it does:**

- Removes the `CLAUDE.md` protocol block (between its sentinels).
- Removes only the TRACEguard-tagged hook entries from `.claude/settings.json`. Any hooks you added yourself stay put.
- Sets `agents.claude.enabled = false`.

**Usage:**

```bash
traceguard off claude
```

`.traceguard/` (config, logs, receipts) is **not** deleted — use `uninstall --purge` if you want a clean slate.

---

## `traceguard off codex`

Reverses `on codex`.

**What it does:**

- Removes the `AGENTS.md` protocol block.
- Removes the TRACEguard-marked block from `~/.codex/config.toml` (if present), preserving the rest of your Codex config.
- Sets `agents.codex.enabled = false`.

**Usage:**

```bash
traceguard off codex
```

---

## `traceguard status`

Shows the current TRACEguard state for the repo.

**What it prints:**

- Repo root
- Claude Code: `active` / `inactive`, plus whether the `CLAUDE.md` block is present, whether `.claude/settings.json` exists, and whether hook shims are installed
- Codex: `active` / `inactive`, plus the configured `sandbox_mode` and `approval_policy`
- Active policy (`default` / `strict` / `custom`)
- Challenge mode (`static` / `self` / `reviewer`)
- Reviewer mode on/off
- Path to the most recent receipt (or `(none yet)`)

**Usage:**

```bash
traceguard status
```

Use this to confirm `on`/`off` actually took effect.

---

## `traceguard receipt latest`

Prints the Markdown of the most recent session receipt to stdout.

**Receipts contain:**

- Files changed (path, change type, `+N/-N` line counts) from `git diff HEAD`
- Commands run (with risk level and exit code)
- Tests detected and their result
- Approvals (Level 2 ask-and-approved, Level 3 blocked)
- Evidence list (claims bound to `test_result`, `diff`, etc.)
- Uncertainties + recommended verification steps
- Whether a challenge pass was triggered, and why

**Usage:**

```bash
traceguard receipt latest
```

Receipts live in `.traceguard/receipts/` as `<timestamp>-<session-id>.{json,md}`.

---

## `traceguard receipt list`

Lists every receipt in the repo, most recent first.

**Usage:**

```bash
traceguard receipt list
```

Each line is `<ISO timestamp>  <path>`. `CHALLENGE.md` (the self-challenge prompt) is excluded.

---

## `traceguard summary`

Toggles whether the agent must produce the end-of-task TRACE summary, **without rewriting `CLAUDE.md` or `AGENTS.md`**.

The protocol blocks installed by `init` already reference a config flag (`agents.<agent>.enforce_trace_summary`), so flipping it propagates to the next session automatically.

**Subcommands:**

```bash
traceguard summary on              # enforce summaries for both agents (default)
traceguard summary off             # skip summaries unless user asks
traceguard summary status          # show current toggle for both agents

traceguard summary off codex       # disable only for Codex
traceguard summary on claude       # enable only for Claude Code
traceguard summary status claude   # show only Claude's setting
```

**What it changes:** exactly one boolean in `.traceguard/config.json` per targeted agent. No file scaffolding, no marker edits, no hook installation. The Stop hook records the active value into the session log so receipts reflect which mode was in effect.

**When to use it:** turn `off` when you want a quick coding session without the structured trailing summary; turn `on` (default) for any session where audit value matters.

---

## `traceguard verify`

Forces a challenge pass against the latest receipt, regardless of whether it would have been triggered automatically.

**What it runs:**

1. **Static challenge** (always):
   - Scans the working diff for security-sensitive paths (`auth/`, `payments/`, `migrations/`, `.github/workflows/`, etc.)
   - Runs the secret regex set over each changed file **and** over the added lines in its diff
   - Re-runs `config.commands.lint` and `config.commands.typecheck` if those are declared and were not already run in the session
   - Surfaces failed tests, blocked Level 3 actions, and threshold breaches (default: > 5 files or > 300 lines)
2. **Self-challenge** (if enabled and static result is not `passed`): writes a `CHALLENGE.md` prompt into `.traceguard/receipts/` that the agent should address on its next turn.
3. **Independent reviewer** (if `reviewer_mode: true` in config): shells out to `claude -p` with the receipt JSON for an external `PASS` / `WARN` / `BLOCK` verdict. Best-effort — silently downgrades to `SKIPPED` if `claude` isn't on PATH.

**Usage:**

```bash
traceguard verify
```

Exit code is `2` on a block verdict, `0` otherwise. Useful as a pre-merge step.

---

## `traceguard uninstall`

Removes TRACEguard from the repo by calling both `off` flows.

**What it does:**

- `off claude` (removes `CLAUDE.md` block + `.claude/settings.json` entries)
- `off codex` (removes `AGENTS.md` block + Codex TOML block)
- Without `--purge`: leaves `.traceguard/` so your historical receipts and config survive.
- With `--purge`: deletes `.traceguard/` entirely (config, logs, receipts gone).

**Usage:**

```bash
traceguard uninstall          # remove integrations, keep history
traceguard uninstall --purge  # remove integrations AND wipe .traceguard/
```

---

## `traceguard --help` / `traceguard --version`

Standard commander output. `--help` works on any subcommand too:

```bash
traceguard --help
traceguard init --help
traceguard receipt --help
```
