#!/usr/bin/env node
// CLI entry point for `npx @sidclaw/demo` / `npx sidclaw-demo`.
//
// - Starts an in-process HTTP server on :3030 (or --port)
// - Auto-opens the browser unless --no-open is passed
// - Prints a clear exit message
// - No dependencies — everything is stdlib
//
// License: MIT

import { spawn } from 'node:child_process';
import { platform } from 'node:process';
import { createDemoServer } from './server.mjs';

function parseArgs(argv) {
  const args = { port: 3030, open: true, host: '127.0.0.1' };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-open') args.open = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--port=')) args.port = parseInt(arg.slice('--port='.length), 10) || 3030;
    else if (arg === '--port') args.port = parseInt(argv[++i], 10) || 3030;
    else if (arg.startsWith('--host=')) args.host = arg.slice('--host='.length);
  }
  return args;
}

function openBrowser(url) {
  const opener =
    platform === 'darwin'
      ? ['open', [url]]
      : platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : ['xdg-open', [url]];
  try {
    const child = spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch {
    // Non-fatal — user can click the URL in the terminal
  }
}

function printHelp() {
  process.stdout.write(`
SidClaw Demo — see the AI agent approval card in 10 seconds.

Usage:
  npx @sidclaw/demo           # starts the demo, opens your browser
  npx @sidclaw/demo --port 8080
  npx @sidclaw/demo --no-open
  npx @sidclaw/demo --help

Environment:
  SIDCLAW_DEMO_PORT           # same as --port

Keyboard shortcut: Ctrl+C to stop.

Next step: deploy your own governed agent with \`npx create-sidclaw-app\`.
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const port = parseInt(process.env.SIDCLAW_DEMO_PORT || `${args.port}`, 10) || 3030;
  const { server } = createDemoServer();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${port} is already in use. Try:\n  npx @sidclaw/demo --port ${port + 1}\n`);
    } else {
      console.error('Demo server failed to start:', err.message);
    }
    process.exit(1);
  });

  server.listen(port, args.host, () => {
    const url = `http://${args.host === '0.0.0.0' ? 'localhost' : args.host}:${port}`;
    process.stdout.write(`\n┌────────────────────────────────────────────────────┐\n`);
    process.stdout.write(`│  SidClaw Demo running at ${url.padEnd(26)}│\n`);
    process.stdout.write(`│                                                    │\n`);
    process.stdout.write(`│  Approve or deny the pending scenarios, then       │\n`);
    process.stdout.write(`│  explore the full trace viewer on the right.       │\n`);
    process.stdout.write(`│                                                    │\n`);
    process.stdout.write(`│  Ready to deploy? → npx create-sidclaw-app         │\n`);
    process.stdout.write(`└────────────────────────────────────────────────────┘\n\n`);
    process.stdout.write(`Press Ctrl+C to stop.\n`);
    if (args.open) openBrowser(url);
  });

  const shutdown = () => {
    process.stdout.write('\nStopping demo...\n');
    server.close(() => process.exit(0));
    // Safety: force-exit if close hangs
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
