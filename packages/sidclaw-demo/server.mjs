// Minimal dependency-free HTTP server for the `npx @sidclaw/demo` experience.
// No Express, no build step — pure node:http + fs. Starts in <100ms.
//
// Routes:
//   GET  /                          → index.html (landing)
//   GET  /api/scenarios             → JSON list of fixtures
//   GET  /api/scenarios/:id         → single scenario detail
//   POST /api/scenarios/:id/decide  → mutates in-memory scenario state
//   GET  /*                         → static files from public/
//
// License: MIT

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarios, findScenario } from './fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = resolve(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectPromise);
  });
}

async function serveStatic(req, res) {
  const safePath = req.url.split('?')[0].replace(/\/+$/, '') || '/';
  const resolved = safePath === '/' ? '/index.html' : safePath;

  // Prevent directory traversal
  const target = resolve(PUBLIC_DIR, '.' + resolved);
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  try {
    await stat(target);
    const body = await readFile(target);
    const type = MIME_TYPES[extname(target)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
}

function handleApi(req, res, state) {
  const [, , resource, id, action] = req.url.split('?')[0].split('/');

  if (resource === 'scenarios' && !id && req.method === 'GET') {
    return jsonResponse(res, 200, { scenarios: Object.values(state) });
  }

  if (resource === 'scenarios' && id && !action && req.method === 'GET') {
    const scenario = state[id];
    if (!scenario) return jsonResponse(res, 404, { error: 'not_found' });
    return jsonResponse(res, 200, scenario);
  }

  if (resource === 'scenarios' && id && action === 'decide' && req.method === 'POST') {
    const scenario = state[id];
    if (!scenario) return jsonResponse(res, 404, { error: 'not_found' });
    if (scenario.status !== 'pending') {
      return jsonResponse(res, 409, { error: 'already_decided', status: scenario.status });
    }
    return readBody(req).then((raw) => {
      let body;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return jsonResponse(res, 400, { error: 'bad_json' });
      }
      const decision = body.decision;
      if (decision !== 'approved' && decision !== 'denied') {
        return jsonResponse(res, 400, { error: 'invalid_decision' });
      }
      scenario.status = decision;
      scenario.decision = {
        status: decision,
        approver_name: body.approver_name || 'You (demo)',
        decided_at: new Date().toISOString(),
        note: body.note || (decision === 'approved' ? 'Approved via demo' : 'Denied via demo'),
      };
      scenario.trace_events.push({
        type: 'approval_decided',
        actor: scenario.decision.approver_name,
        status: decision,
        offset_ms: Date.now() - new Date(scenario.requested_at).getTime(),
      });
      scenario.trace_events.push({
        type: decision === 'approved' ? 'operation_executed' : 'operation_blocked',
        actor: scenario.agent.name,
        status: decision === 'approved' ? 'success' : 'blocked',
        offset_ms: Date.now() - new Date(scenario.requested_at).getTime() + 500,
      });
      return jsonResponse(res, 200, scenario);
    });
  }

  return jsonResponse(res, 404, { error: 'not_found' });
}

export function createDemoServer() {
  // Deep-clone fixtures into mutable session state so decisions persist
  // within a single `sidclaw-demo` run but reset on restart.
  const state = Object.fromEntries(
    scenarios.map((s) => [s.id, structuredClone(s)]),
  );

  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        return handleApi(req, res, state);
      }
      return serveStatic(req, res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error', message: String(err?.message ?? err) }));
    }
  });

  return { server, state };
}

export { scenarios, findScenario };
