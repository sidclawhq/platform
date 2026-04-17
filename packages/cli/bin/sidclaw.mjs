#!/usr/bin/env node
// Terminal UI for SidClaw approvals.
//
// Usage:
//   sidclaw approvals           # interactive picker for pending approvals
//   sidclaw approvals --watch   # poll + desktop notifications
//   sidclaw approvals list      # dumb list output (CI-friendly)
//   sidclaw help
//
// Requires: SIDCLAW_BASE_URL + SIDCLAW_API_KEY in env.
//
// Dependency-free (pure stdlib). MIT licensed.

import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const argv = process.argv.slice(2);

function printHelp() {
  process.stdout.write(`
sidclaw — terminal CLI for SidClaw governance

Usage:
  sidclaw approvals            Interactive queue (Up/Down to move, Enter to open,
                               A to approve, D to deny, Q to quit)
  sidclaw approvals list       Non-interactive list (CI-friendly)
  sidclaw approvals --watch    Keep running, notify on new pending approvals
  sidclaw help                 This message

Environment:
  SIDCLAW_BASE_URL    Required. e.g. https://api.sidclaw.com
  SIDCLAW_API_KEY     Required.
  SIDCLAW_CLI_POLL    Seconds between polls in --watch (default 10)
`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function apiRequest(method, path, body) {
  const baseUrl = requireEnv('SIDCLAW_BASE_URL');
  const apiKey = requireEnv('SIDCLAW_API_KEY');
  const url = new URL(path, baseUrl);
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'sidclaw-cli/0.1',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = text;
          }
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${typeof data === 'string' ? data : JSON.stringify(data)}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function listApprovals(status = 'pending') {
  return apiRequest('GET', `/api/v1/approvals?status=${status}&limit=50`);
}

async function decideApproval(id, decision, note) {
  const path = decision === 'approved'
    ? `/api/v1/approvals/${id}/approve`
    : `/api/v1/approvals/${id}/deny`;
  return apiRequest('POST', path, { decision_note: note });
}

function notify(message) {
  // Best-effort desktop notification
  if (process.platform === 'darwin') {
    spawn('osascript', ['-e', `display notification "${message}" with title "SidClaw"`], {
      stdio: 'ignore',
    }).unref();
  } else if (process.platform === 'linux') {
    spawn('notify-send', ['SidClaw', message], { stdio: 'ignore' }).unref();
  }
  // Windows: fall back to terminal bell
  process.stdout.write('\x07');
}

async function listCommand() {
  try {
    const res = await listApprovals('pending');
    const rows = res.data ?? [];
    if (rows.length === 0) {
      process.stdout.write('No pending approvals.\n');
      return;
    }
    process.stdout.write(`${rows.length} pending approval(s):\n\n`);
    for (const r of rows) {
      const risk = r.risk_classification ? `[${r.risk_classification.toUpperCase()}] ` : '';
      process.stdout.write(`  ${risk}${r.id}\n`);
      process.stdout.write(`    agent: ${r.agent_name ?? r.agent_id}\n`);
      process.stdout.write(`    action: ${r.requested_operation} → ${r.target_integration}\n`);
      process.stdout.write(`    flagged: ${r.flag_reason ?? ''}\n`);
      process.stdout.write(`    requested_at: ${r.requested_at}\n\n`);
    }
  } catch (err) {
    console.error(`Failed to list approvals: ${err.message}`);
    process.exit(1);
  }
}

async function interactive() {
  let res;
  try {
    res = await listApprovals('pending');
  } catch (err) {
    console.error(`Failed to list approvals: ${err.message}`);
    process.exit(1);
  }
  const rows = (res && res.data) || [];
  if (rows.length === 0) {
    process.stdout.write('No pending approvals.\n');
    return;
  }

  let cursor = 0;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);
  }
  process.stdin.resume();

  const render = () => {
    process.stdout.write('\x1b[2J\x1b[H'); // clear
    process.stdout.write('SidClaw — pending approvals\n');
    process.stdout.write('Up/Down: select · Enter: details · A: approve · D: deny · Q: quit\n\n');
    rows.forEach((r, i) => {
      const marker = i === cursor ? '▸ ' : '  ';
      const risk = r.risk_classification ? `[${r.risk_classification}] ` : '';
      process.stdout.write(`${marker}${risk}${r.agent_name ?? r.agent_id} · ${r.requested_operation}\n`);
      if (i === cursor) {
        process.stdout.write(`    ${r.flag_reason ?? ''}\n`);
      }
    });
  };

  const cleanup = () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    rl.close();
  };

  render();

  process.stdin.on('keypress', async (_str, key) => {
    if (!key) return;
    if (key.name === 'up' && cursor > 0) {
      cursor--;
      render();
    } else if (key.name === 'down' && cursor < rows.length - 1) {
      cursor++;
      render();
    } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      cleanup();
      process.exit(0);
    } else if (key.name === 'a' || key.name === 'd') {
      const row = rows[cursor];
      const decision = key.name === 'a' ? 'approved' : 'denied';
      cleanup();
      const note = await promptLine(`Note (optional): `);
      try {
        await decideApproval(row.id, decision, note || undefined);
        process.stdout.write(`\n${decision.toUpperCase()}: ${row.id}\n`);
      } catch (err) {
        process.stderr.write(`Failed: ${err.message}\n`);
      }
      process.exit(0);
    } else if (key.name === 'return') {
      const row = rows[cursor];
      cleanup();
      process.stdout.write('\x1b[2J\x1b[H');
      process.stdout.write(`Approval ${row.id}\n`);
      process.stdout.write(JSON.stringify(row, null, 2));
      process.stdout.write('\n');
      process.exit(0);
    }
  });
}

async function watch() {
  const pollSeconds = parseInt(process.env.SIDCLAW_CLI_POLL ?? '10', 10) || 10;
  const seen = new Set();
  process.stdout.write(`Watching for new approvals (poll every ${pollSeconds}s)...\n`);

  while (true) {
    try {
      const res = await listApprovals('pending');
      const rows = res.data ?? [];
      for (const row of rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          const agentName = row.agent_name ?? row.agent_id;
          const title = `${row.requested_operation} → ${row.target_integration}`;
          process.stdout.write(`[${new Date().toISOString()}] NEW ${agentName}: ${title}\n`);
          notify(`${agentName}: ${title}`);
        }
      }
    } catch (err) {
      process.stderr.write(`Poll failed: ${err.message}\n`);
    }
    await new Promise((r) => setTimeout(r, pollSeconds * 1000));
  }
}

function promptLine(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'approvals') {
    if (subcommand === 'list') return listCommand();
    if (subcommand === '--watch' || rest.includes('--watch')) return watch();
    return interactive();
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
