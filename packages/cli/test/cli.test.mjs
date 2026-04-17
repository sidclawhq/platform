import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', 'bin', 'sidclaw.mjs');

function run(args, env = {}) {
  return new Promise((resolvePromise) => {
    const proc = spawn('node', [CLI, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c));
    proc.stderr.on('data', (c) => (stderr += c));
    proc.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

test('help exits 0', async () => {
  const { code, stdout } = await run(['help']);
  assert.equal(code, 0);
  assert.ok(stdout.includes('sidclaw'));
});

test('no args prints help', async () => {
  const { code, stdout } = await run([]);
  assert.equal(code, 0);
  assert.ok(stdout.includes('Usage'));
});

test('approvals list without env fails cleanly', async () => {
  const { code, stderr } = await run(['approvals', 'list'], {
    SIDCLAW_BASE_URL: '',
    SIDCLAW_API_KEY: '',
  });
  assert.equal(code, 1);
  assert.ok(stderr.includes('Missing env var'));
});

test('unknown command fails with help', async () => {
  const { code, stderr, stdout } = await run(['foobar']);
  assert.equal(code, 1);
  assert.ok(stderr.includes('Unknown command'));
  assert.ok(stdout.includes('Usage'));
});
