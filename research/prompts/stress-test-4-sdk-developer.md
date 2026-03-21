# Stress Test 4: SDK Developer Experience

You are a backend developer integrating SidClaw into your AI agent application. You've never used the SDK before. Your job is to test every SDK feature, hit every error path, and find every rough edge.

**Do NOT modify any source code in the SidClaw repo.** You CAN create temporary test scripts in a `/tmp/` directory to exercise the SDK.

## Prerequisites

1. Start db + API: `docker compose up db -d && cd apps/api && npx prisma migrate deploy && npx prisma db seed && npm run dev`
2. Get the dev API key from `deployment/.env.development`
3. Note the agent IDs from seed data: agent-001 (Customer Comms), agent-002 (Knowledge), agent-003 (Case Ops)

## Test Approach

Create test scripts in `/tmp/sdk-tests/` that import from the built SDK. Build the SDK first:

```bash
cd packages/sdk && npm run build
```

Then reference it from test scripts via relative path or `npm link`.

## Test 1: Client Initialization Edge Cases

Create `/tmp/sdk-tests/init-tests.ts`:

```typescript
import { AgentIdentityClient } from '<path_to_sdk>';

// Test 1a: Valid initialization
const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: 'http://localhost:4000',
  agentId: 'agent-001',
});
console.log('Valid init: OK');

// Test 1b: Missing apiKey
try {
  const bad = new AgentIdentityClient({ apiKey: '', apiUrl: 'http://localhost:4000', agentId: 'agent-001' });
  await bad.evaluate({ operation: 'test', target_integration: 'test', resource_scope: 'test', data_classification: 'public' });
  console.log('Empty apiKey: Should have failed');
} catch (e) {
  console.log('Empty apiKey error:', e.constructor.name, e.message);
}

// Test 1c: Wrong apiUrl (connection refused)
try {
  const bad = new AgentIdentityClient({ apiKey: 'ai_test', apiUrl: 'http://localhost:9999', agentId: 'agent-001', maxRetries: 0 });
  await bad.evaluate({ operation: 'test', target_integration: 'test', resource_scope: 'test', data_classification: 'public' });
  console.log('Wrong URL: Should have failed');
} catch (e) {
  console.log('Wrong URL error:', e.constructor.name, e.message);
}

// Test 1d: Invalid apiUrl format
try {
  const bad = new AgentIdentityClient({ apiKey: 'ai_test', apiUrl: 'not-a-url', agentId: 'agent-001', maxRetries: 0 });
  await bad.evaluate({ operation: 'test', target_integration: 'test', resource_scope: 'test', data_classification: 'public' });
} catch (e) {
  console.log('Bad URL format error:', e.constructor.name, e.message);
}

// Test 1e: Non-existent agent ID
try {
  const client = new AgentIdentityClient({ apiKey: process.env.SIDCLAW_API_KEY!, apiUrl: 'http://localhost:4000', agentId: 'non-existent-agent' });
  await client.evaluate({ operation: 'test', target_integration: 'test', resource_scope: 'test', data_classification: 'public' });
} catch (e) {
  console.log('Bad agent ID error:', e.constructor.name, e.message);
  // Should this be a clear "agent not found" error?
}
```

## Test 2: Evaluate — All Decision Paths

```typescript
const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: 'http://localhost:4000',
  agentId: 'agent-001',
});

// Test 2a: Allow decision
const allow = await client.evaluate({
  operation: 'render',
  target_integration: 'template_engine',
  resource_scope: 'approved_templates',
  data_classification: 'internal',
});
console.log('Allow:', JSON.stringify(allow));
// Verify: decision = 'allow', trace_id exists, approval_request_id is null

// Test 2b: Approval required decision
const approval = await client.evaluate({
  operation: 'send',
  target_integration: 'communications_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
});
console.log('Approval:', JSON.stringify(approval));
// Verify: decision = 'approval_required', trace_id exists, approval_request_id exists

// Test 2c: Deny decision
const deny = await client.evaluate({
  operation: 'export',
  target_integration: 'crm_platform',
  resource_scope: 'customer_pii_records',
  data_classification: 'restricted',
});
console.log('Deny:', JSON.stringify(deny));
// Verify: decision = 'deny', trace_id exists, approval_request_id is null, reason is informative

// Test 2d: No matching policy (default deny)
const noMatch = await client.evaluate({
  operation: 'unknown_operation',
  target_integration: 'unknown_service',
  resource_scope: 'anything',
  data_classification: 'public',
});
console.log('No match:', JSON.stringify(noMatch));
// Verify: decision = 'deny', reason mentions "default deny" or "no matching policy"

// Test 2e: Empty context
const withContext = await client.evaluate({
  operation: 'send',
  target_integration: 'communications_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
  context: { reasoning: 'Customer requested follow-up', template: 'service-follow-up' },
});
console.log('With context:', JSON.stringify(withContext));
// Verify: works, context doesn't break anything

// Test 2f: Very large context
const bigContext: Record<string, unknown> = {};
for (let i = 0; i < 100; i++) bigContext[`key_${i}`] = 'x'.repeat(1000);
try {
  await client.evaluate({
    operation: 'send',
    target_integration: 'communications_service',
    resource_scope: 'customer_emails',
    data_classification: 'confidential',
    context: bigContext,
  });
  console.log('Large context: accepted');
} catch (e) {
  console.log('Large context error:', e.constructor.name, e.message);
}
```

## Test 3: waitForApproval — Edge Cases

```typescript
// Test 3a: Approval already decided
// First evaluate, then approve via API, then call waitForApproval
const result = await client.evaluate({
  operation: 'send',
  target_integration: 'communications_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
});

// Approve immediately via API
await fetch(`http://localhost:4000/api/v1/approvals/${result.approval_request_id}/approve`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.SIDCLAW_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ approver_name: 'Test Admin' }),
});

// Now wait — should resolve immediately
const status = await client.waitForApproval(result.approval_request_id!, { timeout: 5000 });
console.log('Already decided:', status);

// Test 3b: Timeout
const result2 = await client.evaluate({
  operation: 'send',
  target_integration: 'communications_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
});

try {
  await client.waitForApproval(result2.approval_request_id!, { timeout: 3000, pollInterval: 500 });
  console.log('Timeout: Should have thrown');
} catch (e) {
  console.log('Timeout error:', e.constructor.name, e.message);
  // Verify: ApprovalTimeoutError
}

// Test 3c: Non-existent approval ID
try {
  await client.waitForApproval('non-existent-id', { timeout: 2000 });
} catch (e) {
  console.log('Bad approval ID:', e.constructor.name, e.message);
}

// Test 3d: Custom poll interval
// Verify it actually polls at the specified interval (not faster, not slower)
const start = Date.now();
const result3 = await client.evaluate({
  operation: 'send',
  target_integration: 'communications_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
});

// Approve after 2 seconds
setTimeout(async () => {
  await fetch(`http://localhost:4000/api/v1/approvals/${result3.approval_request_id}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SIDCLAW_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver_name: 'Test Admin' }),
  });
}, 2000);

const pollResult = await client.waitForApproval(result3.approval_request_id!, { timeout: 10000, pollInterval: 500 });
const elapsed = Date.now() - start;
console.log(`Poll resolved in ${elapsed}ms (expected ~2000-2500ms)`);
```

## Test 4: recordOutcome — Edge Cases

```typescript
// Test 4a: Success outcome
const allowResult = await client.evaluate({
  operation: 'read',
  target_integration: 'document_store',
  resource_scope: 'internal_docs',
  data_classification: 'internal',
});
await client.recordOutcome(allowResult.trace_id, { status: 'success' });
console.log('Success outcome recorded');

// Test 4b: Error outcome with metadata
await client.recordOutcome(allowResult.trace_id, {
  status: 'error',
  metadata: { error: 'Connection timeout', retries: 3 },
});
// Wait — this should fail because the trace is already finalized
// Verify: does it throw or silently succeed?

// Test 4c: Outcome on denied trace
const denyResult = await client.evaluate({
  operation: 'export',
  target_integration: 'crm_platform',
  resource_scope: 'customer_pii_records',
  data_classification: 'restricted',
});
try {
  await client.recordOutcome(denyResult.trace_id, { status: 'success' });
  console.log('Outcome on deny: Should have failed (trace already blocked)');
} catch (e) {
  console.log('Outcome on deny error:', e.constructor.name, e.message);
  // Verify: ConflictError or similar
}

// Test 4d: Non-existent trace ID
try {
  await client.recordOutcome('non-existent-trace', { status: 'success' });
} catch (e) {
  console.log('Bad trace ID:', e.constructor.name, e.message);
}
```

## Test 5: withGovernance Wrapper

```typescript
import { withGovernance, ActionDeniedError } from '<path_to_sdk>';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: 'http://localhost:4000',
  agentId: 'agent-002',
});

// Test 5a: Allowed action
const readDocs = withGovernance(client, {
  operation: 'read',
  target_integration: 'document_store',
  resource_scope: 'internal_docs',
  data_classification: 'internal',
}, async (query: string) => {
  return [`Document 1: ${query}`, `Document 2: ${query}`];
});

const docs = await readDocs('AI governance');
console.log('Allowed result:', docs);
// Verify: returns the function's result

// Test 5b: Denied action
const exportData = withGovernance(client, {
  operation: 'read',
  target_integration: 'document_store',
  resource_scope: 'board_materials',
  data_classification: 'restricted',
}, async () => {
  return 'should not reach here';
});

try {
  await exportData();
  console.log('Deny: Should have thrown');
} catch (e) {
  if (e instanceof ActionDeniedError) {
    console.log('ActionDeniedError:', e.reason, 'trace:', e.traceId);
  } else {
    console.log('Wrong error type:', e.constructor.name);
  }
}

// Test 5c: Function that throws
const failingFn = withGovernance(client, {
  operation: 'read',
  target_integration: 'document_store',
  resource_scope: 'internal_docs',
  data_classification: 'internal',
}, async () => {
  throw new Error('Database connection failed');
});

try {
  await failingFn();
} catch (e) {
  console.log('Function error preserved:', e.message);
  // Verify: the original error is re-thrown, not wrapped
  // Verify: outcome recorded as 'error'
}

// Test 5d: Function with arguments and return value
const processDocument = withGovernance(client, {
  operation: 'read',
  target_integration: 'document_store',
  resource_scope: 'internal_docs',
  data_classification: 'internal',
}, async (docId: string, format: string) => {
  return { id: docId, format, content: 'Hello world' };
});

const doc = await processDocument('doc-123', 'markdown');
console.log('Args preserved:', doc);
// Verify: arguments passed through correctly, return value correct
```

## Test 6: Error Type Hierarchy

```typescript
import { AgentIdentityError, ActionDeniedError, ApprovalTimeoutError, ApprovalExpiredError, ApiRequestError } from '<path_to_sdk>';

// Verify error hierarchy
const denied = new ActionDeniedError('test', 'trace-1', 'rule-1');
console.log('instanceof AgentIdentityError:', denied instanceof AgentIdentityError);  // true
console.log('instanceof Error:', denied instanceof Error);  // true
console.log('name:', denied.name);  // 'ActionDeniedError'
console.log('code:', denied.code);  // 'action_denied'

const timeout = new ApprovalTimeoutError('ap-1', 'trace-1', 5000);
console.log('timeout instanceof AgentIdentityError:', timeout instanceof AgentIdentityError);  // true
console.log('timeout.timeoutMs:', timeout.timeoutMs);  // 5000

// Verify catch patterns work
try {
  throw denied;
} catch (e) {
  if (e instanceof ActionDeniedError) {
    console.log('Caught ActionDeniedError correctly');
  }
  if (e instanceof AgentIdentityError) {
    console.log('Also caught as AgentIdentityError');
  }
}
```

## Test 7: Webhook Signature Verification

```typescript
import { verifyWebhookSignature } from '<path_to_sdk>/webhooks';
import { createHmac } from 'crypto';

const secret = 'test-secret-key-32-chars-minimum';
const payload = JSON.stringify({ event: 'approval.requested', data: { id: '123' } });

// Valid signature
const validSig = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
console.log('Valid:', verifyWebhookSignature(payload, validSig, secret));  // true

// Invalid signature
console.log('Invalid:', verifyWebhookSignature(payload, 'sha256=wrong', secret));  // false

// Wrong secret
const wrongSig = 'sha256=' + createHmac('sha256', 'wrong-secret').update(payload).digest('hex');
console.log('Wrong secret:', verifyWebhookSignature(payload, wrongSig, secret));  // false

// Tampered payload
console.log('Tampered:', verifyWebhookSignature(payload + 'x', validSig, secret));  // false

// Empty signature
console.log('Empty sig:', verifyWebhookSignature(payload, '', secret));  // false

// Missing sha256= prefix
const rawHash = createHmac('sha256', secret).update(payload).digest('hex');
console.log('No prefix:', verifyWebhookSignature(payload, rawHash, secret));  // false

// Timing attack resistance (should use timingSafeEqual internally)
console.log('Timing safe: verified by implementation using crypto.timingSafeEqual');
```

## Test 8: Concurrent Evaluations

```typescript
// Test rapid concurrent evaluations from the same agent
const promises = Array.from({ length: 20 }, (_, i) =>
  client.evaluate({
    operation: 'read',
    target_integration: 'document_store',
    resource_scope: 'internal_docs',
    data_classification: 'internal',
    context: { request_number: i },
  })
);

const results = await Promise.allSettled(promises);
const succeeded = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');
console.log(`Concurrent: ${succeeded.length} succeeded, ${failed.length} failed`);

// Verify: each successful result has a unique trace_id
const traceIds = new Set(succeeded.map(r => (r as any).value.trace_id));
console.log(`Unique traces: ${traceIds.size} (should be ${succeeded.length})`);
```

## Deliverable

Write a report to `research/stress-tests/04-sdk-developer.md` with:

1. **Error handling assessment**: Does every error path produce a clear, typed error?
2. **Edge case results**: What happened with each edge case?
3. **API consistency**: Are error messages helpful? Do they include trace_id where relevant?
4. **Concurrency results**: Any race conditions? Duplicate traces?
5. **Wrapper correctness**: Does withGovernance preserve arguments, return values, and error types?
6. **Type safety**: Did TypeScript types catch any issues? Any places where `any` leaks through?
7. **Developer experience assessment**: Rate 1-10. What was confusing? What was smooth?
8. **Bugs found**: With severity and reproduction steps
9. **Missing features**: What would you expect the SDK to have that it doesn't?
