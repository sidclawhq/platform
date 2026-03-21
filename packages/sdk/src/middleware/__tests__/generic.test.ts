import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@agent-identity/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import { governObject } from '../generic';
import { ActionDeniedError } from '../../errors';

function createMockClient(): AgentIdentityClient {
  return {
    evaluate: vi.fn(),
    waitForApproval: vi.fn(),
    recordOutcome: vi.fn(),
  } as unknown as AgentIdentityClient;
}

function makeAllowDecision(overrides?: Partial<EvaluateResponse>): EvaluateResponse {
  return {
    decision: 'allow',
    trace_id: 'trace-1',
    approval_request_id: null,
    reason: 'Allowed by policy',
    policy_rule_id: 'rule-1',
    ...overrides,
  };
}

function makeDenyDecision(overrides?: Partial<EvaluateResponse>): EvaluateResponse {
  return {
    decision: 'deny',
    trace_id: 'trace-2',
    approval_request_id: null,
    reason: 'Operation not permitted',
    policy_rule_id: 'rule-2',
    ...overrides,
  };
}

describe('governObject', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps specified methods with governance', async () => {
    const service = {
      sendEmail: vi.fn().mockResolvedValue({ sent: true }),
      readConfig: vi.fn().mockResolvedValue({ key: 'value' }),
      version: '1.0',
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governObject(service, client, {
      sendEmail: { target_integration: 'email', data_classification: 'pii' },
    });

    const result = await governed.sendEmail('user@example.com', 'Hello');

    expect(result).toEqual({ sent: true });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'sendEmail',
        target_integration: 'email',
        data_classification: 'pii',
      })
    );
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
  });

  it('skips methods marked with skip: true', async () => {
    const service = {
      sendEmail: vi.fn().mockResolvedValue({ sent: true }),
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    const governed = governObject(service, client, {
      sendEmail: { target_integration: 'email' },
      logEvent: { target_integration: 'logging', skip: true },
    });

    // logEvent should be the original function (not wrapped)
    await governed.logEvent('test');
    expect(client.evaluate).not.toHaveBeenCalled();
    expect(service.logEvent).toHaveBeenCalledWith('test');
  });

  it('skips non-function properties', () => {
    const service = {
      version: '1.0' as unknown,
      name: 'MyService' as unknown,
    };

    // Should not throw even though 'version' is not a function
    const governed = governObject(service, client, {
      version: { target_integration: 'meta' },
    });

    expect(governed.version).toBe('1.0');
  });

  it('preserves this context', async () => {
    const service = {
      data: 'internal-state',
      getData: vi.fn(async function (this: { data: string }) {
        return this.data;
      }),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governObject(service, client, {
      getData: { target_integration: 'data-store' },
    });

    // The original function is bound to the original object
    const result = await governed.getData();
    expect(result).toBe('internal-state');
  });

  it('uses method name as default operation', async () => {
    const service = {
      deleteRecord: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governObject(service, client, {
      deleteRecord: { target_integration: 'database' },
    });
    await governed.deleteRecord('id-123');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'deleteRecord' })
    );
  });

  it('uses custom operation when provided', async () => {
    const service = {
      remove: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governObject(service, client, {
      remove: { operation: 'delete_record', target_integration: 'database' },
    });
    await governed.remove('id-123');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'delete_record' })
    );
  });

  it('throws ActionDeniedError on deny', async () => {
    const service = {
      sendEmail: vi.fn(),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const governed = governObject(service, client, {
      sendEmail: { target_integration: 'email' },
    });
    const error = await governed.sendEmail('test').catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(service.sendEmail).not.toHaveBeenCalled();
  });

  it('records error outcome when method throws', async () => {
    const service = {
      sendEmail: vi.fn().mockRejectedValue(new Error('SMTP down')),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governObject(service, client, {
      sendEmail: { target_integration: 'email' },
    });
    await expect(governed.sendEmail('test')).rejects.toThrow('SMTP down');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'SMTP down' },
    });
  });

  it('leaves unmapped methods unchanged', async () => {
    const service = {
      governed: vi.fn().mockResolvedValue('governed result'),
      ungoverned: vi.fn().mockResolvedValue('ungoverned result'),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governObject(service, client, {
      governed: { target_integration: 'test' },
    });

    // Ungoverned method should work without governance
    const result = await governed.ungoverned();
    expect(result).toBe('ungoverned result');
    // evaluate should only be called for the governed method, not for ungoverned
    expect(client.evaluate).not.toHaveBeenCalled();
  });
});
