import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

export const ConfigSchema = z.object({
  version: z.string().default('0.1.0'),
  policy: z.enum(['default', 'strict', 'custom']).default('default'),
  agents: z
    .object({
      claude: z
        .object({
          enabled: z.boolean().default(false),
          instructions_file: z.string().default('CLAUDE.md'),
          settings_file: z.string().default('.claude/settings.json'),
          hooks_enabled: z.boolean().default(true),
          enforce_trace_summary: z.boolean().default(true),
        })
        .default({}),
      codex: z
        .object({
          enabled: z.boolean().default(false),
          instructions_file: z.string().default('AGENTS.md'),
          sandbox_mode: z.string().default('workspace-write'),
          approval_policy: z.string().default('on-request'),
          enforce_trace_summary: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),
  risk_thresholds: z
    .object({
      max_files_before_challenge: z.number().int().positive().default(5),
      max_lines_before_challenge: z.number().int().positive().default(300),
    })
    .default({}),
  challenge: z
    .object({
      default_mode: z.enum(['static', 'self', 'reviewer']).default('static'),
      self_challenge_on_high_risk: z.boolean().default(true),
      reviewer_mode: z.boolean().default(false),
    })
    .default({}),
  logging: z
    .object({
      receipts: z.boolean().default(true),
      json: z.boolean().default(true),
      markdown: z.boolean().default(true),
      redact_secrets: z.boolean().default(true),
    })
    .default({}),
  policies: z
    .object({
      allowlist: z.array(z.string()).default([]),
      denylist: z.array(z.string()).default([]),
    })
    .default({}),
  commands: z
    .object({
      lint: z.string().optional(),
      typecheck: z.string().optional(),
      test: z.string().optional(),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

export function loadConfig(configFile: string): Config {
  if (!existsSync(configFile)) return defaultConfig();
  const raw = readFileSync(configFile, 'utf8');
  const parsed = JSON.parse(raw);
  return ConfigSchema.parse(parsed);
}

export function saveConfig(configFile: string, config: Config): void {
  const dir = dirname(configFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
