import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentIdentityClient } from '../agent-identity-client';
import { ApiRequestError, ApprovalTimeoutError, ApprovalExpiredError } from '../../errors';

const BASE_CONFIG = {
  apiKey: 'test-api-key',
  apiUrl: 'https://api.example.com',
  agentId: 'agent-123',
  maxRetries: 2,
  retryBaseDelayMs: 10, // fast for tests
};

function mockFetchResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: {
      get: (key: string) => headers?.[key] ?? null,
    },
  } as unknown as Response;
}

describe('AgentIdentityClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('evaluate()', () => {
    it('sends POST to /api/v1/evaluate with correct body and auth header', async () => {
      const responseBody = {
        decision: 'allow',
        trace_id: 'trace-1',
        approval_request_id: null,
        reason: 'Allowed by default policy',
        policy_rule_id: 'rule-1',
      };
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(responseBody));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users_table',
        data_classification: 'internal',
      });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const call = fetchSpy.mock.calls[0]!;
      expect(call[0]).toBe('https://api.example.com/api/v1/evaluate');
      expect(call[1]?.method).toBe('POST');
      expect(call[1]?.headers).toEqual({
        'Authorization': 'Bearer test-api-key',
        'Content-Type': 'application/json',
      });
    });

    it('returns typed EvaluateResponse on success', async () => {
      const responseBody = {
        decision: 'allow' as const,
        trace_id: 'trace-1',
        approval_request_id: null,
        reason: 'Allowed by default policy',
        policy_rule_id: 'rule-1',
      };
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(responseBody));

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users_table',
        data_classification: 'internal',
      });

      expect(result).toEqual(responseBody);
      expect(result.decision).toBe('allow');
      expect(result.trace_id).toBe('trace-1');
    });

    it('includes agent_id in the request body', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({
        decision: 'allow',
        trace_id: 'trace-1',
        approval_request_id: null,
        reason: 'ok',
        policy_rule_id: null,
      }));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await client.evaluate({
        operation: 'write',
        target_integration: 'slack',
        resource_scope: '#general',
        data_classification: 'public',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
      expect(body.agent_id).toBe('agent-123');
      expect(body.operation).toBe('write');
    });

    it('throws ApiRequestError on 400 validation error', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(
        { error: 'validation_error', message: 'Invalid operation', request_id: 'req-1' },
        400
      ));

      const client = new AgentIdentityClient(BASE_CONFIG);
      const error = await client.evaluate({
        operation: '',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      }).catch(e => e) as ApiRequestError;

      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error.code).toBe('validation_error');
      expect(error.status).toBe(400);
    });

    it('throws ApiRequestError on 401 unauthorized', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(
        { error: 'unauthorized', message: 'Invalid API key', request_id: 'req-2' },
        401
      ));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await expect(client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      })).rejects.toThrow(ApiRequestError);
    });

    it('retries on 500 server error up to maxRetries', async () => {
      const errorResponse = mockFetchResponse(
        { error: 'internal_error', message: 'Server error', request_id: 'req-3' },
        500
      );
      const successResponse = mockFetchResponse({
        decision: 'allow',
        trace_id: 'trace-1',
        approval_request_id: null,
        reason: 'ok',
        policy_rule_id: null,
      });

      // Fail twice, succeed on third
      fetchSpy
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      });

      expect(result.decision).toBe('allow');
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('retries on 429 rate limit', async () => {
      const rateLimitResponse = mockFetchResponse(
        { error: 'rate_limit_exceeded', message: 'Too many requests', request_id: 'req-4' },
        429
      );
      const successResponse = mockFetchResponse({
        decision: 'allow',
        trace_id: 'trace-1',
        approval_request_id: null,
        reason: 'ok',
        policy_rule_id: null,
      });

      fetchSpy
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      });

      expect(result.decision).toBe('allow');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 400 client error', async () => {
      fetchSpy.mockResolvedValue(mockFetchResponse(
        { error: 'validation_error', message: 'Bad request', request_id: 'req-5' },
        400
      ));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await expect(client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      })).rejects.toThrow(ApiRequestError);

      // Should only be called once — no retries for 4xx
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('applies exponential backoff between retries', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sleepSpy = vi.spyOn(AgentIdentityClient.prototype as any, 'sleep')
        .mockResolvedValue(undefined);

      const errorResponse = mockFetchResponse(
        { error: 'internal_error', message: 'Server error', request_id: 'req-6' },
        500
      );

      fetchSpy.mockResolvedValue(errorResponse);

      const client = new AgentIdentityClient({ ...BASE_CONFIG, retryBaseDelayMs: 100 });
      await expect(client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      })).rejects.toThrow();

      // Should have called sleep for each retry (maxRetries = 2, so 2 sleeps)
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      // First delay should be based on 100 * 2^0 = 100 (with jitter: 50-150)
      const firstDelay = sleepSpy.mock.calls[0]![0] as number;
      expect(firstDelay).toBeGreaterThanOrEqual(50);
      expect(firstDelay).toBeLessThanOrEqual(150);
      // Second delay should be based on 100 * 2^1 = 200 (with jitter: 100-300)
      const secondDelay = sleepSpy.mock.calls[1]![0] as number;
      expect(secondDelay).toBeGreaterThanOrEqual(100);
      expect(secondDelay).toBeLessThanOrEqual(300);

      sleepSpy.mockRestore();
    });

    it('throws after exhausting all retries', async () => {
      fetchSpy.mockResolvedValue(mockFetchResponse(
        { error: 'internal_error', message: 'Server error', request_id: 'req-7' },
        500
      ));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await expect(client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      })).rejects.toThrow(ApiRequestError);

      // 1 initial + 2 retries = 3 total calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('handles network errors (fetch throws)', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await expect(client.evaluate({
        operation: 'read',
        target_integration: 'postgres',
        resource_scope: 'users',
        data_classification: 'internal',
      })).rejects.toThrow('Failed to fetch');

      // Should retry on network errors
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('waitForApproval()', () => {
    it('resolves immediately if approval is already decided (approved)', async () => {
      const approvedResponse = {
        id: 'approval-1',
        status: 'approved' as const,
        decided_at: '2026-03-20T10:00:00Z',
        approver_name: 'Alice',
        decision_note: 'Looks good',
      };
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(approvedResponse));

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.waitForApproval('approval-1');

      expect(result.status).toBe('approved');
      expect(result.approver_name).toBe('Alice');
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('resolves immediately if approval is already decided (denied)', async () => {
      const deniedResponse = {
        id: 'approval-2',
        status: 'denied' as const,
        decided_at: '2026-03-20T10:00:00Z',
        approver_name: 'Bob',
        decision_note: 'Too risky',
      };
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(deniedResponse));

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.waitForApproval('approval-2');

      expect(result.status).toBe('denied');
      expect(result.decision_note).toBe('Too risky');
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('polls until approval is approved', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(AgentIdentityClient.prototype as any, 'sleep').mockResolvedValue(undefined);

      const pendingResponse = {
        id: 'approval-3',
        status: 'pending' as const,
        decided_at: null,
        approver_name: null,
        decision_note: null,
      };
      const approvedResponse = {
        id: 'approval-3',
        status: 'approved' as const,
        decided_at: '2026-03-20T10:00:00Z',
        approver_name: 'Alice',
        decision_note: 'Approved',
      };

      fetchSpy
        .mockResolvedValueOnce(mockFetchResponse(pendingResponse))
        .mockResolvedValueOnce(mockFetchResponse(pendingResponse))
        .mockResolvedValueOnce(mockFetchResponse(approvedResponse));

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.waitForApproval('approval-3', { pollInterval: 10 });

      expect(result.status).toBe('approved');
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('polls until approval is denied', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(AgentIdentityClient.prototype as any, 'sleep').mockResolvedValue(undefined);

      const pendingResponse = {
        id: 'approval-4',
        status: 'pending' as const,
        decided_at: null,
        approver_name: null,
        decision_note: null,
      };
      const deniedResponse = {
        id: 'approval-4',
        status: 'denied' as const,
        decided_at: '2026-03-20T10:00:00Z',
        approver_name: 'Bob',
        decision_note: 'Denied',
      };

      fetchSpy
        .mockResolvedValueOnce(mockFetchResponse(pendingResponse))
        .mockResolvedValueOnce(mockFetchResponse(deniedResponse));

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.waitForApproval('approval-4', { pollInterval: 10 });

      expect(result.status).toBe('denied');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('throws ApprovalExpiredError if status is expired', async () => {
      const expiredResponse = {
        id: 'approval-5',
        status: 'expired' as const,
        decided_at: null,
        approver_name: null,
        decision_note: null,
      };
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(expiredResponse));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await expect(
        client.waitForApproval('approval-5')
      ).rejects.toThrow(ApprovalExpiredError);
    });

    it('throws ApprovalTimeoutError if timeout is reached', async () => {
      // Mock sleep to be instant (no real delay)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(AgentIdentityClient.prototype as any, 'sleep').mockResolvedValue(undefined);

      const pendingResponse = {
        id: 'approval-6',
        status: 'pending' as const,
        decided_at: null,
        approver_name: null,
        decision_note: null,
      };

      fetchSpy.mockResolvedValue(mockFetchResponse(pendingResponse));

      // Mock Date.now to simulate time passing
      let callCount = 0;
      const startTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        // First call: start time. Subsequent calls: past the timeout.
        callCount++;
        if (callCount <= 1) return startTime;
        return startTime + 200; // past 100ms timeout
      });

      const client = new AgentIdentityClient(BASE_CONFIG);
      await expect(
        client.waitForApproval('approval-6', { timeout: 100, pollInterval: 10 })
      ).rejects.toThrow(ApprovalTimeoutError);
    });

    it('uses custom pollInterval', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sleepSpy = vi.spyOn(AgentIdentityClient.prototype as any, 'sleep')
        .mockResolvedValue(undefined);

      const pendingResponse = {
        id: 'approval-7',
        status: 'pending' as const,
        decided_at: null,
        approver_name: null,
        decision_note: null,
      };
      const approvedResponse = {
        id: 'approval-7',
        status: 'approved' as const,
        decided_at: '2026-03-20T10:00:00Z',
        approver_name: 'Alice',
        decision_note: null,
      };

      fetchSpy
        .mockResolvedValueOnce(mockFetchResponse(pendingResponse))
        .mockResolvedValueOnce(mockFetchResponse(approvedResponse));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await client.waitForApproval('approval-7', { pollInterval: 5000 });

      expect(sleepSpy).toHaveBeenCalledWith(5000);
    });

    it('uses custom timeout', async () => {
      // Mock sleep to be instant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(AgentIdentityClient.prototype as any, 'sleep').mockResolvedValue(undefined);

      const pendingResponse = {
        id: 'approval-8',
        status: 'pending' as const,
        decided_at: null,
        approver_name: null,
        decision_note: null,
      };

      fetchSpy.mockResolvedValue(mockFetchResponse(pendingResponse));

      // Mock Date.now to simulate time passing past the custom timeout
      let callCount = 0;
      const startTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return startTime;
        return startTime + 60; // past 50ms timeout
      });

      const client = new AgentIdentityClient(BASE_CONFIG);
      const error = await client.waitForApproval('approval-8', {
        timeout: 50,
        pollInterval: 10,
      }).catch(e => e) as ApprovalTimeoutError;

      expect(error).toBeInstanceOf(ApprovalTimeoutError);
      expect(error.timeoutMs).toBe(50);
    });
  });

  describe('recordOutcome()', () => {
    it('sends POST to /api/v1/traces/:traceId/outcome', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(null, 204));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await client.recordOutcome('trace-abc', { status: 'success' });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const call = fetchSpy.mock.calls[0]!;
      expect(call[0]).toBe('https://api.example.com/api/v1/traces/trace-abc/outcome');
      expect(call[1]?.method).toBe('POST');
    });

    it('includes status and metadata in body', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(null, 204));

      const client = new AgentIdentityClient(BASE_CONFIG);
      await client.recordOutcome('trace-abc', {
        status: 'error',
        metadata: { error: 'Something went wrong' },
      });

      const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
      expect(body.status).toBe('error');
      expect(body.metadata).toEqual({ error: 'Something went wrong' });
    });

    it('handles 204 No Content response', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(null, 204));

      const client = new AgentIdentityClient(BASE_CONFIG);
      const result = await client.recordOutcome('trace-abc', { status: 'success' });

      expect(result).toBeUndefined();
    });
  });
});
