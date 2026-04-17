#!/usr/bin/env node
// Install the SidClaw Claude Code hooks into a project.
//
// Usage:
//   node scripts/install-hooks.mjs              # installs into cwd
//   node scripts/install-hooks.mjs --target=.   # same
//   node scripts/install-hooks.mjs --target=/path/to/project
//
// What it does:
//   1. Copies hooks/{*.py, sidclaw_agent_intel/} to <target>/.claude/hooks/
//   2. Merges hook entries into <target>/.claude/settings.json
//   3. Prints a "next steps" message telling the user which env vars to set
//
// The script is idempotent — safe to re-run after a git pull.
// License: MIT

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, cwd, exit, stdout } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SOURCE_HOOKS = resolve(REPO_ROOT, 'hooks');

const HOOK_FILES = [
  'sidclaw_pretool.py',
  'sidclaw_posttool.py',
  'sidclaw_stop.py',
];

const HOOK_CONFIG = {
  PreToolUse: [
    {
      matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit|Agent|Skill|RemoteTrigger|CronCreate|TeamCreate|mcp__.*',
      hooks: [
        { command: 'python .claude/hooks/sidclaw_pretool.py', timeout: 3600000 },
      ],
    },
  ],
  PostToolUse: [
    {
      matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit|Agent|Skill|RemoteTrigger|CronCreate|TeamCreate|mcp__.*',
      hooks: [
        { command: 'python .claude/hooks/sidclaw_posttool.py' },
      ],
    },
  ],
  Stop: [
    {
      hooks: [
        { command: 'python .claude/hooks/sidclaw_stop.py' },
      ],
    },
  ],
};

const SIDCLAW_COMMAND_MARKER = 'sidclaw_';

function parseTarget() {
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--target=')) {
      return resolve(arg.slice('--target='.length));
    }
  }
  return cwd();
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function copyHookFiles(target) {
  const hooksDir = join(target, '.claude', 'hooks');
  ensureDir(hooksDir);

  for (const file of HOOK_FILES) {
    cpSync(join(SOURCE_HOOKS, file), join(hooksDir, file));
  }

  // Copy the sidclaw_agent_intel package
  const intelSrc = join(SOURCE_HOOKS, 'sidclaw_agent_intel');
  const intelDst = join(hooksDir, 'sidclaw_agent_intel');
  ensureDir(intelDst);
  for (const entry of readdirSync(intelSrc)) {
    const srcPath = join(intelSrc, entry);
    const dstPath = join(intelDst, entry);
    if (statSync(srcPath).isFile()) {
      cpSync(srcPath, dstPath);
    }
  }

  return hooksDir;
}

function readSettings(settingsPath) {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse ${settingsPath}: ${e.message}`);
  }
}

function mergeHookArray(existing, incoming) {
  const result = (existing ?? []).filter(entry => {
    // Drop any prior SidClaw entry (matched by the command string) so we can
    // re-add it idempotently with latest config.
    const commands = (entry.hooks ?? []).map(h => h.command ?? '');
    return !commands.some(c => c.includes(SIDCLAW_COMMAND_MARKER));
  });
  result.push(...incoming);
  return result;
}

function mergeSettings(settings) {
  settings.hooks = settings.hooks ?? {};
  for (const [event, entries] of Object.entries(HOOK_CONFIG)) {
    settings.hooks[event] = mergeHookArray(settings.hooks[event], entries);
  }
  return settings;
}

function main() {
  const target = parseTarget();

  if (!existsSync(SOURCE_HOOKS)) {
    console.error(`Source hooks directory not found: ${SOURCE_HOOKS}`);
    exit(1);
  }

  const hooksDir = copyHookFiles(target);
  const settingsPath = join(target, '.claude', 'settings.json');
  const settings = mergeSettings(readSettings(settingsPath));

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  stdout.write(`\nSidClaw hooks installed to ${hooksDir}\n`);
  stdout.write(`Updated ${settingsPath}\n\n`);
  stdout.write('Next steps:\n');
  stdout.write('  1. export SIDCLAW_BASE_URL=https://api.sidclaw.com\n');
  stdout.write('  2. export SIDCLAW_API_KEY=ai_your_key_here\n');
  stdout.write('  3. Restart Claude Code.\n');
  stdout.write('\nEvery governed tool call will be evaluated against your policies.\n');
  stdout.write('Run with SIDCLAW_HOOK_MODE=observe for a dry run (no blocking).\n');
}

main();
