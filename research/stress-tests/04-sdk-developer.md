# Stress Test 4: SDK Developer Experience

**Date:** 2026-03-21
**Persona:** Backend developer integrating SidClaw SDK for the first time
**SDK version:** @sidclaw/sdk 0.1.0
**API version:** localhost:4000 (Fastify)
**Node.js:** v24.3.0

---

## 1. Error Handling Assessment

### Overall: Strong (8/10)

Every API-facing error path produces a typed `ApiRequestError` with status code, error code, and a human-readable message. The error hierarchy is well-designed — `instanceof` chains work correctly, and every error carries a `.code` property for programmatic matching.

**What works well:**
- All errors extend `AgentIdentityError` → `Error`, so standard catch patterns work
- `ApiRequestError` includes `.status`, `.code`, `.requestId` — excellent for debugging
- `ActionDeniedError` includes `.traceId` and `.policyRuleId` — great for audit trails
- `ApprovalTimeoutError` includes `.timeoutMs` — useful for retry logic
- `RateLimitError` includes `.retryAfter`, `.limit`, `.remaining` — complete rate limit info
- Stack traces present on all error types

**Gaps:**
- **Network errors surface as raw `TypeError`** (e.g., "fetch failed", "Failed to parse URL"). These are not wrapped in an SDK error type. A developer doing `catch (e) { if (e instanceof AgentIdentityError) ... }` will miss network failures entirely. This is the biggest DX issue found.
- Empty `apiKey` doesn't fail at construction time — it only fails on first API call with a generic "Authentication required" message. Constructor validation would catch this earlier and with a clearer message.
- `undefined` apiKey produces "Invalid API key" (401) rather than a clear "apiKey is required" message.

## 2. Edge Case Results

### Test 1: Client Initialization

| Test | Input | Result | Assessment |
|------|-------|--------|------------|
| 1a | Valid config | Constructor OK | PASS |
| 1b | Empty apiKey `''` | `ApiRequestError: Authentication required` (401) on first call | MINOR — should fail at construction |
| 1c | Wrong URL (port 9999) | `TypeError: fetch failed` | BUG — not wrapped in SDK error |
| 1d | Invalid URL `'not-a-url'` | `TypeError: Failed to parse URL` | BUG — not wrapped in SDK error |
| 1e | Non-existent agent ID | `ApiRequestError: Agent 'non-existent-agent' not found` (404) | PASS — clear message |
| 1f | `undefined` apiKey | `ApiRequestError: Invalid API key` (401) | MINOR — could be caught at construction |

### Test 2: Evaluate Decision Paths

| Test | Scenario | Decision | Details | Assessment |
|------|----------|----------|---------|------------|
| 2a | Allow (render templates) | `allow` | trace_id present, approval_request_id null, reason present | PASS |
| 2b | Approval required (send email) | `approval_required` | trace_id, approval_request_id, risk_classification all present | PASS |
| 2c | Deny (export PII) | `deny` | trace_id present, informative reason, policy_rule_id present | PASS |
| 2d | No matching policy | `deny` | reason: "No policy rule matches this action — denied by default" | PASS |
| 2e | With context object | `approval_required` | Context accepted, no errors | PASS |
| 2f | Large context (~100KB) | `approval_required` | Accepted without errors | PASS |

All evaluate paths return complete, well-structured responses. The `reason` field is always informative. The `policy_rule_id` is `null` for default deny (correct).

### Test 3: waitForApproval

| Test | Scenario | Result | Assessment |
|------|----------|--------|------------|
| 3a | Already approved | Resolved immediately with full status | PASS |
| 3b | Timeout (3s) | `ApprovalTimeoutError` with correct timeoutMs | PASS |
| 3c | Non-existent ID | `ApiRequestError: ApprovalRequest 'non-existent-id' not found` (404) | PASS |
| 3d | Custom poll (500ms) + delayed approve (2s) | Resolved in ~2530ms (expected 2000-2500ms) | PASS — slight overshoot from poll timing |

### Test 4: recordOutcome

| Test | Scenario | Result | Assessment |
|------|----------|--------|------------|
| 4a | Success outcome | Recorded successfully | PASS |
| 4b | Double outcome (same trace) | `ApiRequestError` (409): "Trace is already finalized" | PASS — correct conflict detection |
| 4c | Outcome on denied trace | `ApiRequestError` (409): "Trace is already finalized with outcome 'blocked'" | PASS — excellent error message |
| 4d | Non-existent trace | `ApiRequestError` (404): "Trace not found" | PASS |
| 4e | Outcome with nested metadata | Recorded successfully | PASS |

## 3. API Consistency

### Error Messages: Excellent (9/10)

- Every API error includes a clear, human-readable `message`
- Error codes are consistent: `unauthorized`, `not_found`, `forbidden`, `conflict`
- `request_id` is included in API errors — excellent for support debugging
- The 409 Conflict message for double-outcome explicitly states the current outcome state ("already finalized with outcome 'blocked'") — very helpful

### Missing from errors:
- Network errors (TypeError) don't include `trace_id` or `request_id` — they bypass the SDK error system entirely
- `ApprovalTimeoutError` hardcodes `traceId: 'unknown'` — the trace ID from the original evaluate is lost by the time timeout fires

## 4. Concurrency Results

### No issues found

- **20 concurrent evaluations from same agent:** 20/20 succeeded, all unique trace IDs, completed in 112ms
- **15 concurrent evaluations from 3 agents:** 15/15 succeeded, all unique trace IDs
- No race conditions, no duplicate traces, no ordering issues
- Server handled concurrent load without errors or degraded responses

## 5. Wrapper Correctness (withGovernance)

### All tests pass

| Test | Scenario | Result |
|------|----------|--------|
| 5a | Allowed action | Function executed, return value preserved (array) |
| 5b | Denied action | `ActionDeniedError` thrown with reason, traceId, policyRuleId |
| 5c | Function throws | Original `Error` re-thrown (not wrapped), outcome recorded as error |
| 5d | Multi-arg function | Arguments passed through correctly, return value correct |
| 5e | Primitive return | `42` returned correctly with correct type |

The wrapper correctly:
- Preserves function arguments (variadic)
- Preserves return types and values
- Re-throws original errors (not wrapped)
- Records outcomes (success/error) automatically
- Throws `ActionDeniedError` on deny (not a generic error)

## 6. Type Safety

### Assessment: Good (7/10)

**Strengths:**
- `EvaluateRequest` enforces required fields (`operation`, `target_integration`, `resource_scope`, `data_classification`)
- `data_classification` is typed as a union (`'public' | 'internal' | 'confidential' | 'restricted'`)
- Error types have proper readonly fields
- `withGovernance` preserves generic types for args and return value

**Gaps:**
- Constructor doesn't validate at build time — `apiKey: ''` or `apiKey: undefined as any` are accepted
- `ClientConfig` doesn't enforce `apiUrl` format (no URL validation)
- `context` field is typed as `Record<string, unknown>` — no depth/size limit enforcement client-side
- `waitForApproval` uses `traceId: 'unknown'` as a sentinel value in `ApprovalTimeoutError` — should be `string | null` or threaded from the original evaluate call

## 7. Developer Experience Assessment

### Overall: 8/10

**Smooth:**
- Installation via npm link worked immediately
- Import paths are clean (`@sidclaw/sdk`, `@sidclaw/sdk/webhooks`)
- The `evaluate()` → `waitForApproval()` → `recordOutcome()` flow is intuitive
- `withGovernance()` wrapper is the right abstraction for most use cases — eliminates boilerplate
- Error hierarchy is well-designed — catch `AgentIdentityError` for all SDK errors, or catch specific subtypes
- Webhook verification is a simple, standalone function — easy to integrate
- Response payloads are consistent and include all needed fields

**Confusing:**
- No constructor validation means errors appear later, at unexpected call sites
- Network errors aren't SDK errors — breaks the "catch AgentIdentityError for all SDK problems" mental model
- `waitForApproval` losing the trace ID (hardcoded `'unknown'`) is surprising when the error type has a `traceId` field
- No JSDoc on the client methods visible after build (type hints work, but hovering shows no documentation)
- The `maxRetries` default of 3 with exponential backoff means a failing request to a dead server takes ~7 seconds before throwing (not obvious)

**What I'd want as a first-time user:**
- A "getting started" code snippet in the README showing the full evaluate → wait → outcome flow
- A `client.healthCheck()` method to verify connectivity before starting
- Retry behavior documented (especially the ~7s timeout for 3 retries with backoff)

## 8. Bugs Found

### BUG-1: Network errors not wrapped in SDK error types (Severity: Medium)

**Reproduction:**
```typescript
const client = new AgentIdentityClient({
  apiKey: 'test',
  apiUrl: 'http://localhost:9999', // nothing running
  agentId: 'agent-001',
  maxRetries: 0,
});
try {
  await client.evaluate({ ... });
} catch (e) {
  console.log(e instanceof AgentIdentityError); // false — it's a TypeError
}
```

**Impact:** Developers using `instanceof AgentIdentityError` in catch blocks will miss network failures. These will bubble up as unhandled `TypeError` exceptions.

**Fix:** Wrap network errors in a new `NetworkError extends AgentIdentityError` or in `ApiRequestError` with a status of 0.

### BUG-2: `ApprovalTimeoutError` loses trace ID (Severity: Low)

**Reproduction:**
```typescript
const result = await client.evaluate({ ... }); // result.trace_id = 'abc-123'
try {
  await client.waitForApproval(result.approval_request_id!, { timeout: 1000 });
} catch (e) {
  if (e instanceof ApprovalTimeoutError) {
    console.log(e.traceId); // 'unknown' — not the actual trace ID
  }
}
```

**Impact:** The `ApprovalTimeoutError` has a `traceId` field but it's always `'unknown'` because `waitForApproval` doesn't receive the trace ID. The developer has to track it themselves.

**Fix:** Either accept `traceId` as an option to `waitForApproval()`, or remove the `traceId` field from `ApprovalTimeoutError` to avoid misleading developers.

### BUG-3: No constructor validation (Severity: Low)

**Reproduction:**
```typescript
const client = new AgentIdentityClient({
  apiKey: '',      // empty — silently accepted
  apiUrl: 'foo',   // invalid — silently accepted
  agentId: '',     // empty — silently accepted
});
// No error until first API call
```

**Impact:** Misconfiguration is only caught at runtime during the first API call, making it harder to debug. Developers expect constructors to validate required parameters.

**Fix:** Add validation in the constructor: throw if `apiKey`, `apiUrl`, or `agentId` are empty/missing. Optionally validate `apiUrl` is a valid URL.

## 9. Missing Features

| Feature | Priority | Rationale |
|---------|----------|-----------|
| `client.healthCheck()` | Medium | Verify connectivity before starting work; useful in startup health checks |
| Constructor validation | Medium | Fail fast on misconfiguration |
| Network error wrapping | Medium | Complete the error type hierarchy |
| `client.getApprovalStatus()` (single poll) | Low | Sometimes you want one check without the polling loop |
| Request/response interceptors | Low | For logging, metrics, custom headers |
| `AbortController` support | Low | Cancel in-flight evaluations or approval waits |
| Configurable logger | Low | Debug mode that logs requests/responses |
| `client.listTraces()` / `client.getTrace()` | Low | Inspect traces programmatically without the dashboard |

---

## Summary

The SDK is well-designed for its core use case. The `evaluate → waitForApproval → recordOutcome` flow works correctly across all decision paths. `withGovernance` is a clean abstraction that handles the common case well. The error hierarchy is thoughtful, and the API responses are consistently structured.

The main areas for improvement are:
1. **Network error wrapping** — the biggest gap in the error handling story
2. **Constructor validation** — fail fast on bad config
3. **Lost trace ID in timeout errors** — a field exists but contains a sentinel value

No concurrency issues, no data corruption, no security concerns found. The webhook verification implementation is solid (timing-safe comparison, prefix validation).
