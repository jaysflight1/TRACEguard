export const CLAUDE_BLOCK = `## TRACEguard Protocol

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

When summarizing your work, classify important claims as **Verified**, **Likely**, **Assumption**, or **Unknown**.

Never say "this works", "this is fixed", "tests pass", or "this is safe" without direct evidence. Instead, write things like:

- "Verified by \`npm test\`"
- "Likely based on inspection of \`src/router.ts\`"
- "Assumption: this environment variable exists in production"
- "Unknown: I did not run the integration suite"

Bind claims to one of: \`repo_file\`, \`diff\`, \`command_output\`, \`test_result\`, \`external_source\`, or mark them as \`assumption\`.
`;

export const AGENTS_BLOCK = `## TRACEguard Protocol

You are operating under TRACEguard.

Follow these constraints:

1. Work autonomously for normal repo-local coding tasks.
2. Do not perform destructive, external, credential-related, network, deployment, or security-sensitive actions without approval.
3. Label unsupported factual claims as assumptions.
4. Do not say tests passed unless you actually ran them.
5. End with a TRACE summary listing files changed, commands run, tests performed, assumptions, unresolved risks, and verification status.

When summarizing, classify important claims as **Verified**, **Likely**, **Assumption**, or **Unknown**, and bind them to a concrete evidence type (repo file, diff, command output, test result, external source).
`;

export const CLAUDE_HOOK_SETTINGS = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'Bash|Edit|Write|MultiEdit',
        hooks: [
          {
            type: 'command',
            command: '.traceguard/hooks/pre-tool-use.sh',
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: '*',
        hooks: [
          {
            type: 'command',
            command: '.traceguard/hooks/post-tool-use.sh',
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: '*',
        hooks: [
          {
            type: 'command',
            command: '.traceguard/hooks/stop.sh',
          },
        ],
      },
    ],
  },
};

export const HOOK_SHIM = (target: string): string => `#!/usr/bin/env bash
# TRACEguard hook shim — invokes the installed traceguard package.
# Pipes the Claude Code hook event JSON on stdin through to the handler.
set -euo pipefail
exec node --enable-source-maps "$(npm root -g 2>/dev/null)/traceguard/dist/hooks/${target}.js" "$@"
`;
