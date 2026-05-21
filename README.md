# TRACEguard

[![CI](https://github.com/jaysflight1/traceguard/actions/workflows/ci.yml/badge.svg)](https://github.com/jaysflight1/traceguard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](./package.json)

> **A lightweight transparency layer for AI coding agents.** TRACEguard makes Claude Code and Codex CLI sessions auditable: it intercepts risky actions before they run, records what the agent did with evidence, and lets you verify the result — without retraining anything or replacing the agent.

## The problem

AI coding agents are increasingly trusted to run shell commands, edit files, and push code. But today's terminal agents:

- treat `rm -rf` and `npm test` as just tool use,
- claim work is done or tested without evidence,
- produce long natural-language explanations that look thorough but aren't grounded in what actually happened.

There's no built-in record of **what the agent did, why, and what evidence supports its claims**. Auditors, teammates, and even the user have to take the agent's word for it.

## What TRACEguard does

A terminal-native protocol + CLI that adds five interventions around any agent session, with **default autonomy** for ordinary work and **scrutiny only at risk boundaries**:

| | Intervention | Mechanism |
|---|---|---|
| **T** | Tool Boundaries | A Level 0–3 classifier runs in a Claude Code `PreToolUse` hook. Level 0/1 actions proceed silently; Level 2 prompts the user; Level 3 blocks with a structured reason. |
| **R** | Reason-Grounded Receipts | A `Stop` hook generates a zod-validated JSON + Markdown receipt from the session log + `git diff HEAD`, recording files changed, commands run with risk levels, tests, and evidence. |
| **A** | Abstention & Uncertainty | The injected `CLAUDE.md` / `AGENTS.md` block instructs the agent to label claims as **Verified / Likely / Assumption / Unknown** at end-of-task. |
| **C** | Challenge Pass | `traceguard verify` runs deterministic static checks (secret scan over the diff, risky-path detection, lint/typecheck rerun, threshold breaches) and exits non-zero on a block verdict. |
| **E** | Evidence Binding | Receipt claims must bind to one of: `repo_file`, `diff`, `command_output`, `test_result`, `external_source`, or be marked `assumption`. |

The novel contribution is the **integration** of all five interventions into a portable terminal protocol with minimal token cost, no model retraining, and full reversibility.

## Quick start

```bash
# install (from GitHub for now — npm registry publish coming)
npm install -g github:jaysflight1/traceguard

# in any project repo
traceguard init            # scaffold .traceguard/, CLAUDE.md, AGENTS.md
traceguard on claude       # wire up .claude/settings.json hooks
traceguard status          # confirm

# work normally — `claude` sessions are now governed
# after the session:
traceguard receipt latest  # see what the agent did
traceguard verify          # force a challenge pass
```

> The shorter `tg` alias works for every command (`tg init`, `tg on claude`, `tg status`).
> If you prefer not to install globally: `npx github:jaysflight1/traceguard <command>`.

## Verify it works (≈60 seconds)

For reviewers and judges — confirms the install, hook enforcement, and test suite end-to-end:

```bash
bash $(npm root -g)/traceguard/scripts/judge-smoke-test.sh
```

Output is a four-step checklist with green ✓ / red ✗ for each step. See [`scripts/judge-smoke-test.sh`](./scripts/judge-smoke-test.sh) for what it asserts.

## Removing TRACEguard

```bash
traceguard uninstall          # reverse all marker-block edits, preserve .traceguard/
traceguard uninstall --purge  # also delete .traceguard/ (config, logs, receipts)
```

Every file edit TRACEguard makes is wrapped in HTML-comment sentinels, so `uninstall` is byte-for-byte reversible — your own content outside the markers is never touched.

## Further reading

- [`COMMANDS.md`](./COMMANDS.md) — full per-command reference with options, file effects, and exit codes
- [`TRACEguard_protocol.md`](./TRACEguard_protocol.md) — the protocol design, risk-level boundaries, receipt schema, and challenge-pass modes
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — phase-by-phase build that produced the current tree

---

## Commands at a glance

| Command | What it does |
|---|---|
| `traceguard init` | Scaffolds `.traceguard/{logs,receipts,policies,hooks}` and inserts the protocol block into `CLAUDE.md` and `AGENTS.md`. |
| `traceguard on` | **Global resume.** No arg — flips `enabled: true` in config so hooks classify actions again. |
| `traceguard off` | **Global pause.** No arg — flips `enabled: false`; hooks short-circuit to allow every action. Protocol blocks and hook installation stay in place. |
| `traceguard on claude` | Enables Claude Code integration: installs hook shims and merges TRACEguard-tagged entries into `.claude/settings.json`. |
| `traceguard on codex` | Enables Codex CLI integration: inserts the `AGENTS.md` block and applies sandbox/approval settings to `~/.codex/config.toml` (or recommends them). |
| `traceguard off claude` | Reverses `on claude` — removes the `CLAUDE.md` block and TRACEguard's `.claude/settings.json` entries while preserving user-added hooks. |
| `traceguard off codex` | Reverses `on codex` — removes the `AGENTS.md` block and TRACEguard's Codex TOML block. |
| `traceguard status` | Reports activation state, hook installation, sandbox/approval settings, policy, challenge mode, summary toggle, and the last receipt path. |
| `traceguard summary on\|off\|status [agent]` | Toggles whether the agent must produce the end-of-task TRACE summary. Flips a flag in `.traceguard/config.json` — never modifies `CLAUDE.md` or `AGENTS.md`. |
| `traceguard receipt latest` | Prints the Markdown of the most recent session receipt. |
| `traceguard receipt list` | Lists every receipt, most recent first. |
| `traceguard verify` | Forces a challenge pass against the latest receipt (static checks, optional self-challenge, optional reviewer). Exits 2 on a block verdict. |
| `traceguard update` | Wrapper around `npm install -g traceguard@latest`. Use `--source github` for direct GitHub installs, `--check` for a dry run. Prints the per-project refresh commands afterwards. |
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
