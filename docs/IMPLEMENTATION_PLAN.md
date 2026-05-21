# TRACEguard — Code Implementation Plan

This plan turns `TRACEguard_protocol.md` into a concrete, ordered build sequence for the `traceguard` CLI. It is organized by phase. Each phase lists files to create, key functions to implement, dependencies, and acceptance checks.

Target stack:
- Node.js 20+ (matches Claude Code + Codex CLI ecosystem)
- TypeScript (strict)
- `commander` for CLI parsing
- `execa` for child processes
- `fast-glob` for path scanning
- `simple-git` for git introspection
- `zod` for config + receipt schema validation
- `vitest` for tests

Repository layout (target end-state):

```
traceguard/
├── package.json
├── tsconfig.json
├── README.md
├── bin/
│   └── traceguard.js          # node shim → dist/cli.js
├── src/
│   ├── cli.ts                 # commander entry, command routing
│   ├── commands/
│   │   ├── init.ts
│   │   ├── on.ts
│   │   ├── off.ts
│   │   ├── status.ts
│   │   ├── receipt.ts
│   │   ├── verify.ts
│   │   └── uninstall.ts
│   ├── core/
│   │   ├── config.ts          # load/validate .traceguard/config.json
│   │   ├── paths.ts           # resolves repo root + traceguard paths
│   │   ├── markers.ts         # TRACEguard:start/end block insertion
│   │   ├── risk.ts            # Level 0–3 classifier
│   │   ├── secrets.ts         # redaction + secret-pattern scan
│   │   ├── git.ts             # diff, status, branch, commit helpers
│   │   ├── logger.ts          # structured JSONL log writer
│   │   └── receipt.ts         # build + render JSON + Markdown receipt
│   ├── integrations/
│   │   ├── claude.ts          # CLAUDE.md + .claude/settings.json wiring
│   │   └── codex.ts           # AGENTS.md + sandbox/approval wiring
│   ├── hooks/
│   │   ├── pre-tool-use.ts    # invoked by Claude Code PreToolUse
│   │   ├── post-tool-use.ts   # invoked by Claude Code PostToolUse
│   │   └── stop.ts            # invoked by Claude Code Stop
│   ├── challenge/
│   │   ├── static.ts          # deterministic checks
│   │   ├── self.ts            # self-challenge prompt block emitter
│   │   └── reviewer.ts        # independent reviewer (optional)
│   └── templates/
│       ├── claude-block.md
│       ├── agents-block.md
│       ├── claude-settings.json
│       └── default-config.json
├── test/
│   ├── risk.test.ts
│   ├── markers.test.ts
│   ├── receipt.test.ts
│   ├── hooks.test.ts
│   └── e2e-init.test.ts
└── .traceguard/               # only created in a target project, not this repo
```

---

## Phase 0 — Project bootstrap

Action steps:

1. `npm init -y`, then set `"name": "traceguard"`, `"bin": { "traceguard": "bin/traceguard.js" }`, `"type": "module"`.
2. Add dev deps: `typescript`, `tsx`, `vitest`, `@types/node`. Runtime deps: `commander`, `execa`, `fast-glob`, `simple-git`, `zod`, `picocolors`.
3. Create `tsconfig.json` (strict, `module: ESNext`, `target: ES2022`, `outDir: dist`).
4. Add scripts: `build`, `dev`, `test`, `lint`.
5. Create `bin/traceguard.js`:
   ```js
   #!/usr/bin/env node
   import('../dist/cli.js');
   ```
6. Add `chmod +x bin/traceguard.js` step in `prepare` script.

Acceptance: `npm run build && node bin/traceguard.js --help` prints command list.

---

## Phase 1 — CLI skeleton and shared core

Action steps:

1. `src/cli.ts`: build `commander` program with subcommands `init`, `on`, `off`, `status`, `receipt`, `verify`, `uninstall`. Wire `on <agent>` and `off <agent>` with `agent ∈ {claude, codex}`.
2. `src/core/paths.ts`:
   - `findRepoRoot(cwd)` → walks up to nearest `.git` or `package.json`, fallback `cwd`.
   - Resolve canonical paths: `.traceguard/`, `.traceguard/config.json`, `.traceguard/logs/`, `.traceguard/receipts/`, `.traceguard/hooks/`, `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`.
3. `src/core/config.ts`:
   - `ConfigSchema` (zod) mirroring §5 default config.
   - `loadConfig()`, `saveConfig()`, `defaultConfig()`.
4. `src/core/markers.ts`:
   - `insertBlock(filePath, blockId, content)` — idempotent insert/update between `<!-- TRACEguard:start blockId=X -->` and `<!-- TRACEguard:end blockId=X -->`.
   - `removeBlock(filePath, blockId)` — removes only the marked block, preserves user content.
5. `src/core/logger.ts`:
   - JSONL writer to `.traceguard/logs/session-<id>.jsonl`.
   - Helpers: `logEvent(kind, payload)`, `redactingWrite(line)`.

Acceptance: unit tests for `markers.ts` show inserting twice produces a single block; `removeBlock` leaves the surrounding file untouched.

---

## Phase 2 — `traceguard init`

Action steps:

1. `src/commands/init.ts`:
   - Compute repo root via `paths.findRepoRoot`.
   - Create directories: `.traceguard/{logs,receipts,policies,hooks}`.
   - Write `.traceguard/config.json` from `templates/default-config.json` if missing.
   - Touch `CLAUDE.md` and `AGENTS.md` if missing (empty file with just the inserted block).
   - Print summary of created files.
2. `templates/default-config.json` → exact JSON from protocol §5.
3. `templates/claude-block.md` and `templates/agents-block.md` → instruction text from protocol §3 (T) and §3 (Codex section).
4. Add `--force` flag to overwrite existing TRACEguard blocks (still never touches user content outside markers).

Acceptance: e2e test runs `traceguard init` in tmp dir, asserts file tree + JSON parses against `ConfigSchema`.

---

## Phase 3 — `traceguard on/off claude`

Action steps:

1. `src/integrations/claude.ts`:
   - `enableClaude()`:
     1. Ensure `.traceguard/config.json` exists (call init if not).
     2. `insertBlock(CLAUDE.md, "protocol", templates/claude-block.md)`.
     3. Merge TRACEguard hook entries into `.claude/settings.json` under `hooks.PreToolUse`, `hooks.PostToolUse`, `hooks.Stop`. Use deep merge that never deletes user-defined hooks.
     4. Install hook launcher scripts to `.traceguard/hooks/`:
        - `pre-tool-use.sh` → `node "$REPO/.traceguard/hooks/pre-tool-use.js"`
        - `post-tool-use.sh`, `stop.sh` analogously.
        - JS files are tiny shims that `require` the installed `traceguard/dist/hooks/*`.
     5. Mark `agents.claude.enabled = true` in config.
   - `disableClaude()`: reverse of above — `removeBlock`, remove TRACEguard entries from `.claude/settings.json` hooks arrays, leave user hooks intact, set `enabled = false`.
2. `templates/claude-settings.json` defines the hook entries TRACEguard adds:
   ```json
   {
     "hooks": {
       "PreToolUse":  [{ "matcher": "Bash|Edit|Write", "command": ".traceguard/hooks/pre-tool-use.sh" }],
       "PostToolUse": [{ "matcher": "*",                "command": ".traceguard/hooks/post-tool-use.sh" }],
       "Stop":        [{ "matcher": "*",                "command": ".traceguard/hooks/stop.sh" }]
     }
   }
   ```
3. Wire `src/commands/on.ts` and `off.ts` to dispatch on agent name.

Acceptance: after `on claude`, `.claude/settings.json` contains TRACEguard hook entries; after `off claude` those entries are gone and user-added hooks remain.

---

## Phase 4 — Risk classifier (the T core)

Action steps:

1. `src/core/risk.ts`:
   - Type `Action = { kind: "bash"; command: string } | { kind: "edit" | "write" | "read"; path: string }`.
   - Type `RiskLevel = 0 | 1 | 2 | 3`.
   - `classify(action, repoRoot, config): { level, reason, category }`.
   - Rules table (ordered, first match wins):
     - **Level 3:** patterns `force[- ]push`, `git reset --hard`, `curl .*\| ?sh`, `wget .*\| ?sh`, writes to `.traceguard/logs|receipts|config.json`, exfil indicators (`base64 .* curl`, `nc -e`).
     - **Level 2:** `rm `, `rm -rf`, `chmod`, `chown`, `sudo `, `kill`, `pkill`, `npm publish`, `git push`, `gh pr create`, writes to `.env*`, `.npmrc`, `id_rsa*`, `*.pem`, `**/credentials*`, paths under CI dirs (`.github/workflows/`, `deploy/`, `infra/`), files outside `repoRoot`.
     - **Level 1:** `npm install`, `npm i `, `pnpm add`, `yarn add`, `npm run build`, `npm test`, edits to `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, generated dirs (`dist/`, `build/`).
     - **Level 0:** anything else inside `repoRoot`.
   - Allow `config.policies.allowlist` and `config.policies.denylist` overrides.
2. `src/core/secrets.ts`: regex set for AWS keys, GitHub tokens, generic API keys, PEM headers. Two surfaces: `containsSecret(text)` and `redact(text)`.

Acceptance: ≥40 unit tests in `test/risk.test.ts` covering each rule and the override path.

---

## Phase 5 — Claude Code hooks

Action steps:

1. `src/hooks/pre-tool-use.ts`:
   - Read JSON event from stdin (Claude Code hook contract).
   - Build `Action` from event (`tool`, `input.command` or `input.file_path`).
   - `classify` → switch on level:
     - 0: exit 0 silently.
     - 1: `logEvent("level1", …)`, exit 0.
     - 2: write a "pending approval" log entry, exit with non-zero + `decision: "ask"` payload (Claude Code convention) prompting the user.
     - 3: log + exit with `decision: "deny"` and human-readable reason.
2. `src/hooks/post-tool-use.ts`:
   - Append to current session log: tool, files touched, command, exit code, truncated stdout/stderr (≤2KB, redacted).
3. `src/hooks/stop.ts`:
   - Read session log.
   - Invoke `buildReceipt(sessionId)` and write JSON + Markdown receipts.
4. All hooks share a `getSessionId()` helper (env var or hash of pid+start time persisted in `.traceguard/logs/.current-session`).

Acceptance: synthetic hook event JSON piped through each hook produces expected log lines and exit codes.

---

## Phase 6 — Receipt generator

Action steps:

1. `src/core/git.ts`:
   - `diffStat()`, `diffNameStatus()`, `headBefore()`, `headAfter()`, `currentBranch()`, `remoteHash()` (sha256 of `git config --get remote.origin.url`).
2. `src/core/receipt.ts`:
   - `ReceiptSchema` (zod) mirroring §3 R JSON shape.
   - `buildReceipt(sessionId)`:
     1. Load session JSONL log.
     2. Gather git context.
     3. Aggregate `commands_run`, `files_changed`, `approvals`, `tests` from log events.
     4. Detect uncertainties: tests `not_run` or `failed`, risky paths touched, large diff.
     5. Decide `challenge_pass.triggered` per §3 C triggers.
     6. Determine `final_status`: `completed` / `completed_with_warnings` / `blocked` / `failed`.
   - `renderMarkdown(receipt)` → human-readable format from §3 R.
   - `write(receipt)` → writes both `.json` and `.md` into `.traceguard/receipts/`.
3. `src/commands/receipt.ts`:
   - `receipt list` → sorted by mtime.
   - `receipt latest` → prints Markdown of newest receipt.

Acceptance: receipt JSON validates against schema; Markdown renders without `undefined`.

---

## Phase 7 — Challenge pass

Action steps:

1. `src/challenge/static.ts`:
   - `runStaticChallenge(receipt, repoRoot)`:
     - Run `git diff` again to confirm scope.
     - Run lint/typecheck commands declared in config (`config.commands.lint`, `config.commands.typecheck`) if present and not yet run.
     - `secrets.containsSecret` over the diff.
     - Scan changed files for risky path patterns (auth, payments, migrations).
     - Return `{ result: "passed" | "warn" | "block", findings: [...] }`.
2. `src/challenge/self.ts`:
   - Does not call any LLM directly. Instead, writes a `CHALLENGE.md` instruction file inside the receipts dir and adds a marker the agent's next response should address. (Keeps TRACEguard model-agnostic.)
3. `src/challenge/reviewer.ts`:
   - Optional. If `config.challenge.reviewer_mode` is true and `ANTHROPIC_API_KEY` is set, invoke `claude` CLI in a one-shot mode with the reviewer prompt from §3 C. Stub the call behind an `executeReviewer()` interface so it can be mocked.
4. `src/commands/verify.ts`:
   - Force a challenge pass against the latest receipt regardless of triggers.

Acceptance: static challenge catches a planted `.env` modification and a planted `AWS_SECRET_ACCESS_KEY=` string in the diff.

---

## Phase 8 — Codex integration

Action steps:

1. `src/integrations/codex.ts`:
   - `enableCodex()`: `insertBlock(AGENTS.md, "protocol", agents-block.md)`. Detect Codex config (`~/.codex/config.toml` or project-local) — if present and writable, set:
     ```toml
     sandbox_mode = "workspace-write"
     approval_policy = "on-request"
     network_access = "restricted"
     ```
     If not present, print a recommendation block instead of writing.
   - `disableCodex()`: remove TRACEguard block from `AGENTS.md`, revert config additions tagged with `# TRACEguard:` comment.
2. `traceguard run codex` (deferred from MVP):
   - Spawn `codex` as a child process via `execa`.
   - Stream stdout/stderr through redactor into session log.
   - On exit, run `buildReceipt`.

Acceptance: `traceguard on codex` produces an `AGENTS.md` with the TRACEguard block and either updates or recommends Codex sandbox settings without clobbering existing config.

---

## Phase 9 — `status`, `uninstall`, polish

Action steps:

1. `src/commands/status.ts`:
   - Load config, check presence/markers in `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`.
   - Print the block shown in protocol §4.
2. `src/commands/uninstall.ts`:
   - Call `disableClaude()` and `disableCodex()`.
   - Optionally (`--purge`) delete `.traceguard/` after confirmation.
3. Help text, colorized output, exit codes consistent across commands.
4. Add `traceguard --version` from `package.json`.

Acceptance: `status` accurately reflects on/off transitions; `uninstall` leaves no TRACEguard markers anywhere.

---

## Phase 10 — Tests and packaging

Action steps:

1. Unit tests: `risk`, `markers`, `secrets`, `receipt`, `config`.
2. Integration tests: spawn CLI in a tmp git repo via `execa`, run `init → on claude → simulated hook events → stop hook → receipt latest`.
3. Snapshot test for Markdown receipt rendering.
4. CI: GitHub Actions workflow running `npm test` on Node 20 and 22.
5. Publish prep: `npm pack` smoke test, ensure `bin/` and `dist/` are in `files` field, `prepare` script builds before publish.
6. Update root `README.md` with install + quickstart matching protocol §1.

Acceptance: `npm test` green, `npm pack` produces a tarball that installs and runs end-to-end.

---

## Mapping to protocol's MVP order (§6)

| Protocol MVP | Phases in this plan |
|---|---|
| MVP 1: Instruction injection | 0, 1, 2, 3 (claude on), 8 (codex on, AGENTS.md only) |
| MVP 2: Receipt generator | 5 (logger + stop hook), 6 |
| MVP 3: Risk scanner | 4, 7 (static challenge) |
| MVP 4: Claude Code hooks | 3, 5 |
| MVP 5: Codex compatibility | 8 |

A 2-day hackathon path: Phase 0 → 1 → 2 → 3 (on claude only) → 4 (Level 2/3 rules only) → 5 (PreToolUse + Stop) → 6 (Markdown receipt only) → ship. Defer self/reviewer challenge, Codex process wrapping, and `verify`.

---

## Key design decisions worth noting

1. **Marker-based file edits**: every file TRACEguard touches uses HTML-comment sentinels keyed by block ID so `off` is fully reversible.
2. **No LLM calls inside hooks**: hooks are pure Node; the only optional LLM call lives in `challenge/reviewer.ts` behind a config flag and an injectable interface.
3. **Hook events are the source of truth**: receipts are built from the JSONL session log, not from agent self-report — this is what gives the receipt accountability value.
4. **Secret redaction at write time**: `logger.redactingWrite` is the single funnel for log/receipt output, so a forgotten code path can't leak secrets to disk.
5. **Codex coverage is best-effort**: without a Claude-Code-style hook API, TRACEguard relies on `AGENTS.md` + sandbox config + optional process wrapping; the receipt for Codex sessions will be coarser and that limitation is surfaced in `status`.
