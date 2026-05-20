# TRACEguard Protocol: A Lightweight Transparency Layer for Claude Code and Codex CLI

## 1. Purpose

TRACEguard is a terminal-native protocol and CLI wrapper for AI coding agents. It is designed to make agentic coding workflows more transparent, trustworthy, and accountable while preserving as much autonomy as possible.

TRACEguard targets two agent environments:

1. Claude Code
2. Codex CLI

The protocol does not attempt to replace either agent. Instead, it adds a lightweight governance layer around them using project instructions, permission boundaries, hooks/configuration, structured logging, and optional verification passes.

The central design principle is:

> Transparent agents should expose evidence, uncertainty, and actions, not merely produce longer explanations.

TRACEguard is intended to be installed once, activated per project, and then applied automatically whenever the user runs Claude Code or Codex inside that repository.

Example user flow:

```bash
npm install -g traceguard
traceguard init
traceguard on claude
traceguard on codex
```

After activation, the user continues using their normal coding agent workflow, but TRACEguard injects protocol instructions, configures risk boundaries, records auditable receipts, and triggers verification only when needed.

---

## 2. TRACE Acronym

TRACEguard is organized around five interventions:

| Letter | Intervention | Main Goal |
|---|---|---|
| T | Tool Boundaries | Prevent unsafe or unaccountable agent actions |
| R | Reason-Grounded Receipts | Produce concise, auditable summaries of what the agent did and why |
| A | Abstention and Uncertainty | Force the agent to mark low-confidence or unsupported claims |
| C | Challenge Pass | Verify risky or unsupported outputs before finalizing |
| E | Evidence Binding | Tie important claims and code changes to repo evidence, tests, or external sources |

Together, these create a practical transparency protocol for coding agents without requiring model retraining, custom APIs, or heavy always-on review.

---

# 3. Core Protocol

## T — Tool Boundaries

### Objective

Claude Code and Codex can read files, edit code, and run commands. TRACEguard should preserve autonomy for ordinary coding tasks while requiring extra scrutiny for actions that create security, privacy, reliability, or accountability risks.

### Boundary Categories

TRACEguard classifies every agent action into one of four risk levels.

#### Level 0: Safe / autonomous

Allowed without interruption.

Examples:

```text
Read files inside the repository
Search repository files
Edit files inside the repository
Run formatting commands
Run local unit tests
Run static analysis
Create new files inside the repository
Read package metadata
```

#### Level 1: Logged / autonomous

Allowed without interruption, but must be logged in the TRACE receipt.

Examples:

```text
Installing development dependencies
Running test suites
Creating generated files
Editing configuration files
Modifying lockfiles
Running build commands
```

#### Level 2: Approval required

The agent must pause and ask the user before continuing.

Examples:

```text
Deleting files
Running commands with rm, chmod, chown, sudo, kill, pkill, curl | sh, wget | sh
Modifying files outside the repository
Accessing environment files such as .env, .env.local, .npmrc, credentials files, SSH keys, or cloud config
Changing CI/CD, deployment, auth, billing, security, or production configuration
Making network calls when not clearly required
Installing global packages
Pushing commits or creating pull requests
```

#### Level 3: Blocked by default

The action is denied unless the user explicitly disables TRACEguard or changes the policy.

Examples:

```text
Exfiltrating secrets
Sending repository content to unknown external endpoints
Disabling TRACEguard from inside an agent session
Changing TRACEguard logs
Deleting TRACEguard receipts
Running destructive shell commands outside the repository
Modifying git history with force-push or reset --hard without approval
```

### Claude Code Implementation

Claude Code integration should use:

1. `CLAUDE.md` for persistent project instructions.
2. `.claude/settings.json` for permissions.
3. Claude Code hooks for deterministic enforcement and logging.

TRACEguard should create or update:

```text
CLAUDE.md
.claude/settings.json
.traceguard/config.json
.traceguard/logs/
.traceguard/receipts/
```

The `CLAUDE.md` injection should include:

```md
## TRACEguard Protocol

You are operating under TRACEguard.

You may work autonomously inside the repository for ordinary coding tasks, but you must follow these rules:

1. Do not claim that a change was tested unless a test, build, or command was actually run.
2. Before destructive, external, credential-related, network, deployment, or security-sensitive actions, ask the user for approval.
3. Distinguish repo-grounded claims from assumptions.
4. When uncertain, say what is uncertain and what would verify it.
5. At the end of each task, produce a concise TRACE summary:
   - files changed
   - commands run
   - tests performed
   - assumptions
   - unresolved risks
   - whether verification was skipped, run, or recommended
```

Claude Code hook behavior:

```text
PreToolUse:
  Inspect command or file operation.
  Classify risk level.
  Allow Level 0 and Level 1.
  Log Level 1.
  Block or request approval for Level 2.
  Deny Level 3.

PostToolUse:
  Log files touched, command status, stdout/stderr summary, and timestamp.

Stop:
  Generate or update TRACE receipt for the session.
```

### Codex CLI Implementation

Codex integration should use:

1. `AGENTS.md` for project instructions.
2. Codex sandbox/approval settings where available.
3. TRACEguard wrapper command for session logging and receipt generation.

TRACEguard should create or update:

```text
AGENTS.md
.traceguard/config.json
.traceguard/logs/
.traceguard/receipts/
```

The `AGENTS.md` injection should mirror the Claude instruction block:

```md
## TRACEguard Protocol

You are operating under TRACEguard.

Follow these constraints:

1. Work autonomously for normal repo-local coding tasks.
2. Do not perform destructive, external, credential-related, network, deployment, or security-sensitive actions without approval.
3. Label unsupported factual claims as assumptions.
4. Do not say tests passed unless you actually ran them.
5. End with a TRACE summary listing files changed, commands run, tests performed, assumptions, unresolved risks, and verification status.
```

Codex wrapper behavior:

```text
traceguard run codex
  Load .traceguard/config.json
  Ensure AGENTS.md contains TRACEguard block
  Start Codex process
  Capture terminal session metadata where possible
  Record generated receipt at task end
```

If Codex exposes native config for sandbox and approval behavior, TRACEguard should set conservative defaults:

```json
{
  "sandbox_mode": "workspace-write",
  "approval_policy": "on-request",
  "network_access": "restricted"
}
```

Exact config keys may vary by Codex version, so TRACEguard should validate installed Codex capabilities before writing settings.

---

## R — Reason-Grounded Receipts

### Objective

The receipt is the main accountability artifact. It should not expose hidden chain-of-thought. It should summarize observable actions, evidence, assumptions, and verification status.

TRACEguard should generate a receipt after each agent session.

### Receipt Schema

Each receipt should be saved as:

```text
.traceguard/receipts/YYYY-MM-DDTHH-MM-SSZ-session-id.json
.traceguard/receipts/YYYY-MM-DDTHH-MM-SSZ-session-id.md
```

The JSON receipt should follow this schema:

```json
{
  "traceguard_version": "0.1.0",
  "agent": "claude-code | codex",
  "session_id": "string",
  "timestamp_start": "ISO-8601",
  "timestamp_end": "ISO-8601",
  "repository": {
    "root": "string",
    "git_remote_hash": "string | null",
    "git_branch": "string | null",
    "git_commit_before": "string | null",
    "git_commit_after": "string | null"
  },
  "user_request_summary": "string",
  "files_changed": [
    {
      "path": "string",
      "change_type": "created | modified | deleted | renamed",
      "lines_added": "number | null",
      "lines_removed": "number | null"
    }
  ],
  "commands_run": [
    {
      "command": "string",
      "risk_level": 0,
      "exit_code": 0,
      "summary": "string",
      "timestamp": "ISO-8601"
    }
  ],
  "approvals": [
    {
      "action": "string",
      "risk_level": 2,
      "approved": true,
      "timestamp": "ISO-8601"
    }
  ],
  "evidence": [
    {
      "claim": "string",
      "evidence_type": "repo_file | test_result | command_output | external_source | assumption",
      "source": "string",
      "confidence": "high | medium | low"
    }
  ],
  "tests": [
    {
      "command": "string",
      "result": "passed | failed | not_run",
      "summary": "string"
    }
  ],
  "uncertainties": [
    {
      "uncertainty": "string",
      "recommended_verification": "string"
    }
  ],
  "challenge_pass": {
    "triggered": true,
    "trigger_reason": "string",
    "result": "passed | failed | skipped | recommended",
    "summary": "string"
  },
  "final_status": "completed | completed_with_warnings | blocked | failed"
}
```

### Markdown Receipt Format

The Markdown receipt should be human-readable:

```md
# TRACEguard Receipt

Agent: Claude Code
Session: 2026-05-19T18:45:00Z
Status: Completed with warnings

## Summary
The agent modified authentication middleware and added unit tests.

## Files Changed
- `src/auth.ts` — modified
- `tests/auth.test.ts` — created

## Commands Run
- `npm test` — passed
- `npm run lint` — failed due to pre-existing formatting issue

## Evidence
- Claim: Authentication behavior was tested.
  - Evidence: `npm test` passed.
  - Confidence: High.

## Assumptions
- The agent assumed existing session-token format is stable because no migration file was present.

## Unresolved Risks
- Lint failure remains unresolved.
- No integration test was run.

## Challenge Pass
Triggered: Yes
Reason: Authentication-sensitive code modified
Result: Recommended manual review
```

### Token and Autonomy Cost

Receipts add minimal model-token cost because most receipt fields can be generated from logs, git diff, and command outputs. The only model-generated part should be the short natural-language summary. The agent remains autonomous because receipts are produced after action, not before every step.

---

## A — Abstention and Uncertainty

### Objective

The agent should not present unsupported claims as facts. TRACEguard requires uncertainty labeling for claims that are not grounded in repo evidence, command output, tests, or external sources.

### Required Confidence Labels

For final user-facing summaries, the agent must label claims using:

```text
Verified: Supported by a test, command output, code inspection, or cited source.
Likely: Supported by repo evidence but not directly tested.
Assumption: Plausible but not verified.
Unknown: The agent lacks enough evidence.
```

### Agent Instruction

TRACEguard injects:

```md
When summarizing your work, classify important claims as Verified, Likely, Assumption, or Unknown.

Never say:
- "This works"
- "This is fixed"
- "Tests pass"
- "This is safe"
unless you have direct evidence.

Instead say:
- "Verified by `npm test`"
- "Likely based on inspection of `src/router.ts`"
- "Assumption: this environment variable exists in production"
- "Unknown: I did not run the integration suite"
```

### Abstention Triggers

The agent must abstain or ask for verification when:

```text
The requested answer depends on external facts not available in the repo.
The agent lacks access to a required file.
The agent did not run tests but is asked whether the code works.
The task involves security, auth, payments, deletion, deployment, or production data.
The task involves interpreting legal, medical, or high-stakes compliance meaning.
The agent detects conflicting evidence.
```

### Token and Autonomy Cost

This adds a small amount of text to final answers but does not interrupt normal coding. It increases trustworthiness because the user can distinguish verified work from guesses.

---

## C — Challenge Pass

### Objective

TRACEguard should not run expensive verification on every task. Instead, it triggers a targeted challenge pass only when risk is high.

### Challenge Pass Triggers

A challenge pass should run when any of the following are true:

```text
Risk Level 2 approval was requested.
Authentication, authorization, cryptography, payments, database migrations, CI/CD, deployment, or security-sensitive files were changed.
Tests failed or were not run after nontrivial code changes.
The final answer contains unsupported external factual claims.
The agent modified more than N files, default N = 5.
The agent changed more than M lines, default M = 300.
The user explicitly requests verification.
The agent reports low confidence.
```

### Challenge Pass Modes

TRACEguard should support three modes.

#### Mode 1: Static Challenge

No extra model call. Uses deterministic checks:

```text
git diff summary
test command status
lint/typecheck status
secret scan
dangerous command scan
changed-files risk scan
```

#### Mode 2: Agent Self-Challenge

One extra model instruction at the end:

```md
Before finalizing, perform a TRACEguard challenge pass.

Do not rewrite your full answer. Instead, identify:
1. The most likely mistake in your solution.
2. The highest-risk file or command changed.
3. Any claim that is not directly verified.
4. The cheapest next verification step.
5. Whether the user should review before using the result.
```

#### Mode 3: Independent Reviewer Challenge

Optional heavier mode. Runs a second agent call or review command, if available.

Prompt:

```md
You are the TRACEguard reviewer.

Review the session receipt, git diff, commands run, and final summary.

Return:
- PASS if the work is low-risk and evidence is sufficient.
- WARN if the work may be correct but has unresolved uncertainty.
- BLOCK if the work includes unsafe actions, unsupported high-confidence claims, failed tests without disclosure, or unapproved risky operations.

Do not propose large rewrites. Focus only on transparency, verification, and accountability.
```

### Default Policy

TRACEguard default should be:

```json
{
  "challenge_mode": "static",
  "self_challenge_on_high_risk": true,
  "independent_reviewer": false
}
```

### Token and Autonomy Cost

The challenge pass is selective. Most sessions use only deterministic checks. High-risk sessions pay for one short additional model call. This is worth it because verification literature suggests targeted checking improves factuality more reliably than generic “explain your reasoning” prompts.

---

## E — Evidence Binding

### Objective

The agent must link important claims to evidence. In coding contexts, evidence usually means local files, tests, command outputs, or diffs rather than academic citations.

### Evidence Types

TRACEguard recognizes five evidence categories:

```text
repo_file: Claim is grounded in a file that exists in the repository.
diff: Claim is grounded in the actual code changes made.
command_output: Claim is grounded in terminal output.
test_result: Claim is grounded in a test, build, lint, or typecheck command.
external_source: Claim is grounded in a cited external source.
assumption: Claim is not verified.
```

### Required Evidence Binding Rules

The final summary must bind the following claims to evidence:

```text
Any claim that a bug was fixed.
Any claim that tests pass.
Any claim that behavior is safe.
Any claim about package behavior or API behavior.
Any claim about security implications.
Any claim about performance improvement.
Any claim about compatibility.
Any claim about deployment readiness.
```

Example acceptable output:

```text
Verified: `npm test` passed after the change.
Likely: The bug was caused by missing null handling in `src/parser.ts`, based on the failing test and diff.
Assumption: Production uses the same parser path as the local test.
Unknown: I did not test Windows compatibility.
```

### Token and Autonomy Cost

Evidence binding primarily changes the structure of final output. It does not require constant interruptions. It reduces overtrust by making the support level of each claim visible.

---

# 4. CLI Design

## Commands

TRACEguard should expose the following commands:

```bash
traceguard init
traceguard on claude
traceguard on codex
traceguard off claude
traceguard off codex
traceguard status
traceguard receipt latest
traceguard receipt list
traceguard verify
traceguard uninstall
```

## `traceguard init`

Creates:

```text
.traceguard/
  config.json
  logs/
  receipts/
  policies/
```

Creates or updates:

```text
CLAUDE.md
AGENTS.md
.claude/settings.json
```

It should not overwrite existing user content. It should insert a clearly marked block:

```md
<!-- TRACEguard:start -->
...
<!-- TRACEguard:end -->
```

## `traceguard on claude`

Behavior:

```text
1. Ensure `.traceguard/config.json` exists.
2. Ensure `CLAUDE.md` contains TRACEguard block.
3. Ensure `.claude/settings.json` contains TRACEguard hook configuration.
4. Install local hook scripts into `.traceguard/hooks/`.
5. Mark Claude integration as active.
```

## `traceguard on codex`

Behavior:

```text
1. Ensure `.traceguard/config.json` exists.
2. Ensure `AGENTS.md` contains TRACEguard block.
3. If Codex config is detectable, set or recommend sandbox/approval defaults.
4. Mark Codex integration as active.
```

## `traceguard off`

Disables TRACEguard by removing or commenting out the marked blocks it inserted. It must preserve user-authored content.

## `traceguard status`

Prints:

```text
TRACEguard status
Claude Code: active/inactive
Codex: active/inactive
Last receipt: path
Policy: default/strict/custom
Challenge mode: static/self/reviewer
```

---

# 5. Default Configuration

```json
{
  "version": "0.1.0",
  "policy": "default",
  "agents": {
    "claude": {
      "enabled": true,
      "instructions_file": "CLAUDE.md",
      "settings_file": ".claude/settings.json",
      "hooks_enabled": true
    },
    "codex": {
      "enabled": true,
      "instructions_file": "AGENTS.md",
      "sandbox_mode": "workspace-write",
      "approval_policy": "on-request"
    }
  },
  "risk_thresholds": {
    "max_files_before_challenge": 5,
    "max_lines_before_challenge": 300
  },
  "challenge": {
    "default_mode": "static",
    "self_challenge_on_high_risk": true,
    "reviewer_mode": false
  },
  "logging": {
    "receipts": true,
    "json": true,
    "markdown": true,
    "redact_secrets": true
  }
}
```

---

# 6. Recommended MVP Scope

For a two-day research hackathon, implement the MVP in this order:

## MVP 1: Instruction Injection

```text
traceguard init
traceguard on claude
traceguard on codex
```

This creates `CLAUDE.md`, `AGENTS.md`, `.traceguard/config.json`, and the receipt directory.

## MVP 2: Receipt Generator

Implement:

```bash
traceguard receipt latest
```

Use:

```text
git diff --stat
git diff --name-status
git status --short
recent shell command logs if available
```

Generate Markdown and JSON receipts.

## MVP 3: Risk Scanner

Implement deterministic checks for:

```text
.env access
secret-looking file changes
rm/chmod/sudo/curl-pipe-shell commands
auth/security/payment/deployment file paths
large diffs
failed or missing tests
```

## MVP 4: Claude Code Hooks

Add hook scripts for Claude Code to block or log risky commands.

## MVP 5: Codex Compatibility

Ensure `AGENTS.md` protocol works and provide recommended Codex sandbox/approval config. Full process-level wrapping can be added later.

---

# 7. Why This Is Low-Friction

TRACEguard avoids heavy-handed restrictions by using three principles:

1. **Default autonomy inside the repository.** Normal coding proceeds without interruption.
2. **Approval only at risk boundaries.** The user is interrupted only for destructive, external, credential-related, or high-stakes actions.
3. **Verification only when triggered.** Most tasks receive a receipt; risky tasks receive challenge passes.

This makes TRACEguard practical for real developers because it does not turn every model response into a compliance checklist.

---

# 8. Judge-Facing Novelty Claim

TRACEguard is not just another “make the model explain itself” prompt. It is a portable runtime protocol for AI coding agents that combines:

```text
Tool-boundary enforcement
Evidence-linked final claims
Uncertainty and abstention labels
Triggered verification
Auditable session receipts
```

The key contribution is the integration of these interventions into a terminal workflow for Claude Code and Codex CLI with minimal token cost and minimal loss of autonomy.

A concise project claim:

> TRACEguard is a lightweight terminal protocol for trustworthy AI coding agents. It makes Claude Code and Codex sessions more transparent by logging what the agent changed, what evidence supports its claims, when it was uncertain, and when risky actions required approval.
