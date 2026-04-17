// Server tests for the SidClaw demo — uses node:test + fetch, no dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoServer } from '../server.mjs';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

test('GET /api/scenarios lists all scenarios', async () => {
  const { server } = createDemoServer();
  const base = await listen(server);
  try {
    const res = await fetch(`${base}/api/scenarios`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.scenarios));
    assert.ok(body.scenarios.length >= 4);
    const pending = body.scenarios.filter((s) => s.status === 'pending');
    assert.ok(pending.length >= 2, 'at least two pending scenarios');
  } finally {
    server.close();
  }
});

test('GET /api/scenarios/:id returns a single scenario', async () => {
  const { server } = createDemoServer();
  const base = await listen(server);
  try {
    const res = await fetch(`${base}/api/scenarios/scn-claude-code-rm-rf`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, 'scn-claude-code-rm-rf');
    assert.equal(body.action.operation, 'bash.destructive');
  } finally {
    server.close();
  }
});

test('POST decide approves a pending scenario', async () => {
  const { server } = createDemoServer();
  const base = await listen(server);
  try {
    const res = await fetch(`${base}/api/scenarios/scn-claude-code-rm-rf/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved', approver_name: 'Alice', note: 'ok' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'approved');
    assert.equal(body.decision.approver_name, 'Alice');
    assert.equal(body.decision.status, 'approved');
    // idempotent / conflict check
    const second = await fetch(`${base}/api/scenarios/scn-claude-code-rm-rf/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'denied' }),
    });
    assert.equal(second.status, 409);
  } finally {
    server.close();
  }
});

test('POST decide with invalid decision returns 400', async () => {
  const { server } = createDemoServer();
  const base = await listen(server);
  try {
    const res = await fetch(`${base}/api/scenarios/scn-fintech-trade/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'maybe' }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('scenario state is isolated per server instance', async () => {
  const { server: s1 } = createDemoServer();
  const { server: s2 } = createDemoServer();
  const base1 = await listen(s1);
  const base2 = await listen(s2);
  try {
    await fetch(`${base1}/api/scenarios/scn-fintech-trade/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved' }),
    });
    const res2 = await fetch(`${base2}/api/scenarios/scn-fintech-trade`);
    const body2 = await res2.json();
    assert.equal(body2.status, 'pending', 'second server should be unaffected');
  } finally {
    s1.close();
    s2.close();
  }
});

test('serves index.html at /', async () => {
  const { server } = createDemoServer();
  const base = await listen(server);
  try {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('SidClaw Demo'));
  } finally {
    server.close();
  }
});

test('refuses directory traversal', async () => {
  const { server } = createDemoServer();
  const base = await listen(server);
  try {
    const res = await fetch(`${base}/../../../etc/passwd`);
    assert.ok(res.status === 403 || res.status === 404);
  } finally {
    server.close();
  }
});
