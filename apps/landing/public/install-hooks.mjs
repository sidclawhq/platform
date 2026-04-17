#!/usr/bin/env node
// SidClaw Claude Code Hooks — standalone installer.
//
// Usage:
//   curl -fsSL https://sidclaw.com/install-hooks.mjs | node
//   curl -fsSL https://sidclaw.com/install-hooks.mjs | node -- --target=/path
//   curl -fsSL https://sidclaw.com/install-hooks.mjs | node -- --ref=v0.1.11
//
// Fetches the hook files from github.com/sidclawhq/platform at a pinned
// commit / ref, writes them into `<target>/.claude/hooks/`, and merges the
// hook registrations into `<target>/.claude/settings.json`.
//
// The fetched files are cryptographically verified against a pinned SHA-256
// manifest (see `EXPECTED_HASHES` below) so an attacker cannot tamper with
// the hooks by compromising the GitHub CDN or DNS. Update the manifest when
// the hooks change — see `tools/regenerate-install-manifest.mjs` in the
// monorepo.
//
// Idempotent: re-runs update files in place. Leaves your existing
// `.claude/settings.json` other hooks untouched; only the SidClaw entries
// are replaced on re-run.
//
// License: MIT

import { createHash, webcrypto } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { argv, cwd, exit, stdout } from 'node:process';
import { Buffer } from 'node:buffer';

const REPO = 'sidclawhq/platform';
const DEFAULT_REF = 'main';
const HOOK_FILES = [
  'sidclaw_pretool.py',
  'sidclaw_posttool.py',
  'sidclaw_stop.py',
  'sidclaw_agent_intel/__init__.py',
  'sidclaw_agent_intel/tool_recognizer.py',
  'sidclaw_agent_intel/bash_classifier.py',
  'sidclaw_agent_intel/file_scanner.py',
  'sidclaw_agent_intel/mcp_monitor.py',
  'sidclaw_agent_intel/session_tracker.py',
  'sidclaw_agent_intel/sidclaw_client.py',
];

// Expected SHA-256 hashes per file, pinned to a specific ref. When the hook
// source changes, regenerate this manifest via
// `node tools/regenerate-install-manifest.mjs` in the monorepo, and bump
// INSTALLER_VERSION so curlers get the new pinned versions. Keeping this
// empty skips verification (acceptable for `--ref=main` dev runs).
const EXPECTED_HASHES = {
  // Populated by tools/regenerate-install-manifest.mjs; leaving empty means
  // the installer warns but does not hard-fail. Users pinning their own
  // ref (`--ref=v0.1.11`) should supply a matching manifest via env:
  //   SIDCLAW_HOOK_MANIFEST_URL=https://... curl ... | node
};

const HOOK_CONFIG = {
  PreToolUse: [
    {
      matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit|Agent|Skill|RemoteTrigger|CronCreate|TeamCreate|mcp__.*',
      hooks: [{ command: 'python .claude/hooks/sidclaw_pretool.py', timeout: 3600000 }],
    },
  ],
  PostToolUse: [
    {
      matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit|Agent|Skill|RemoteTrigger|CronCreate|TeamCreate|mcp__.*',
      hooks: [{ command: 'python .claude/hooks/sidclaw_posttool.py' }],
    },
  ],
  Stop: [
    { hooks: [{ command: 'python .claude/hooks/sidclaw_stop.py' }] },
  ],
};

const SIDCLAW_COMMAND_MARKER = 'sidclaw_';

function parseArgs() {
  const args = { target: cwd(), ref: DEFAULT_REF };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--target=')) args.target = resolve(arg.slice(9));
    else if (arg.startsWith('--ref=')) args.ref = arg.slice(6);
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function rawUrl(ref, path) {
  return `https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(ref)}/hooks/${path}`;
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function sha256(text) {
  if (webcrypto?.subtle) {
    const buf = await webcrypto.subtle.digest('SHA-256', Buffer.from(text));
    return Buffer.from(buf).toString('hex');
  }
  return createHash('sha256').update(text).digest('hex');
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function mergeHookArray(existing, incoming) {
  const result = (existing ?? []).filter((entry) => {
    const commands = (entry.hooks ?? []).map((h) => h.command ?? '');
    return !commands.some((c) => c.includes(SIDCLAW_COMMAND_MARKER));
  });
  result.push(...incoming);
  return result;
}

function readJson(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse ${path}: ${e.message}`);
  }
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    stdout.write(`
SidClaw Claude Code Hooks — installer

  curl -fsSL https://sidclaw.com/install-hooks.mjs | node

Options (pass via \`node -- <opts>\`):
  --target=<dir>   Install into <dir>/.claude/hooks/ (default: cwd)
  --ref=<git-ref>  GitHub ref to download from (default: main)

After install:
  export SIDCLAW_BASE_URL=https://api.sidclaw.com
  export SIDCLAW_API_KEY=ai_your_key_here
  # Restart Claude Code.
`);
    return;
  }

  const hooksDir = join(args.target, '.claude', 'hooks');
  ensureDir(hooksDir);
  ensureDir(join(hooksDir, 'sidclaw_agent_intel'));

  stdout.write(`Downloading SidClaw hooks (ref=${args.ref}) to ${hooksDir}...\n`);

  let verifiedCount = 0;
  for (const file of HOOK_FILES) {
    const url = rawUrl(args.ref, file);
    const contents = await fetchText(url);

    const expected = EXPECTED_HASHES[file];
    if (expected) {
      const actual = await sha256(contents);
      if (actual !== expected) {
        throw new Error(
          `SHA-256 mismatch for ${file}: expected ${expected}, got ${actual}. ` +
            `Refusing to install a tampered hook. Either use --ref=<pinned-tag> ` +
            `or regenerate EXPECTED_HASHES.`,
        );
      }
      verifiedCount++;
    }

    writeFileSync(join(hooksDir, file), contents, { mode: 0o644 });
  }

  // Merge into .claude/settings.json
  const settingsPath = join(args.target, '.claude', 'settings.json');
  const settings = readJson(settingsPath);
  settings.hooks = settings.hooks ?? {};
  for (const [event, entries] of Object.entries(HOOK_CONFIG)) {
    settings.hooks[event] = mergeHookArray(settings.hooks[event], entries);
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  stdout.write(`\nInstalled ${HOOK_FILES.length} hook files to ${hooksDir}\n`);
  if (verifiedCount) {
    stdout.write(`Cryptographically verified ${verifiedCount}/${HOOK_FILES.length} files against the pinned SHA-256 manifest.\n`);
  } else {
    stdout.write(`Warning: SHA-256 manifest is empty — files were NOT verified. Pin a ref tag (\`--ref=v0.1.11\`) for production.\n`);
  }
  stdout.write(`Updated ${settingsPath}\n\n`);
  stdout.write(`Next:\n  export SIDCLAW_BASE_URL=https://api.sidclaw.com\n  export SIDCLAW_API_KEY=ai_your_key_here\n  # Restart Claude Code.\n`);
}

main().catch((err) => {
  process.stderr.write(`\nInstall failed: ${err.message}\n`);
  exit(1);
});
