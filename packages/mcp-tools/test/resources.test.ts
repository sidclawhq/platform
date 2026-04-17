import { describe, it, expect, vi } from 'vitest';
import { readResource } from '../src/resources';
import type { SidClawClient } from '../src/client';

function mockClient(): SidClawClient {
  return {
    evaluate: vi.fn(),
    recordOutcome: vi.fn(),
    waitForApproval: vi.fn(),
    listPolicies: vi.fn(async () => ({ data: [{ id: 'pol-1' }] })),
    listTraces: vi.fn(async () => ({ data: [{ id: 'trace-1' }] })),
    health: vi.fn(async () => ({ status: 'healthy' })),
  } as unknown as SidClawClient;
}

describe('readResource', () => {
  it('reads the policies resource', async () => {
    const client = mockClient();
    const result = await readResource(client, 'sidclaw://policies');
    expect(result.contents[0].mimeType).toBe('application/json');
    expect(result.contents[0].text).toContain('pol-1');
  });

  it('reads the status resource with graceful health failure', async () => {
    const client = mockClient();
    const result = await readResource(client, 'sidclaw://status');
    expect(result.contents[0].text).toContain('healthy');
  });

  it('reads agent history with decoded id', async () => {
    const client = mockClient();
    const result = await readResource(client, 'sidclaw://agent/claude-code/history');
    expect((client.listTraces as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('claude-code', 50);
    expect(result.contents[0].text).toContain('trace-1');
  });

  it('rejects unknown URIs', async () => {
    const client = mockClient();
    await expect(readResource(client, 'sidclaw://unknown')).rejects.toThrow();
  });
});
