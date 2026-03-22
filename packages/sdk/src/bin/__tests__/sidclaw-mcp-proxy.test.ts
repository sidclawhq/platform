import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve(__dirname, '../../../dist/bin/sidclaw-mcp-proxy.cjs');

function runCLI(env: Record<string, string> = {}) {
  try {
    const output = execFileSync('node', [CLI_PATH], {
      env: { ...process.env, ...env },
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: output, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      exitCode: error.status ?? 1,
    };
  }
}

describe('sidclaw-mcp-proxy CLI', () => {
  it('exits with error when SIDCLAW_API_KEY is missing', () => {
    const result = runCLI({});
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('SIDCLAW_API_KEY is required');
  });

  it('exits with error when SIDCLAW_AGENT_ID is missing', () => {
    const result = runCLI({ SIDCLAW_API_KEY: 'test-key' });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('SIDCLAW_AGENT_ID is required');
  });

  it('exits with error when SIDCLAW_UPSTREAM_CMD is missing', () => {
    const result = runCLI({
      SIDCLAW_API_KEY: 'test-key',
      SIDCLAW_AGENT_ID: 'test-agent',
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('SIDCLAW_UPSTREAM_CMD is required');
  });

  it('logs startup info to stderr (not stdout)', () => {
    const result = runCLI({
      SIDCLAW_API_KEY: 'test-key',
      SIDCLAW_AGENT_ID: 'test-agent',
      SIDCLAW_UPSTREAM_CMD: 'echo',
      SIDCLAW_UPSTREAM_ARGS: 'hello',
    });
    // The proxy will try to start and likely fail connecting, but startup logs should be on stderr
    expect(result.stderr).toContain('[SidClaw]');
    expect(result.stdout).not.toContain('[SidClaw]');
  });

  it('uses default values for optional config', () => {
    const result = runCLI({
      SIDCLAW_API_KEY: 'test-key',
      SIDCLAW_AGENT_ID: 'test-agent',
      SIDCLAW_UPSTREAM_CMD: 'echo',
    });
    expect(result.stderr).toContain('Approval mode: error');
    expect(result.stderr).toContain('api.sidclaw.com');
  });

  it('exits with error for invalid SIDCLAW_TOOL_MAPPINGS JSON', () => {
    const result = runCLI({
      SIDCLAW_API_KEY: 'test-key',
      SIDCLAW_AGENT_ID: 'test-agent',
      SIDCLAW_UPSTREAM_CMD: 'echo',
      SIDCLAW_TOOL_MAPPINGS: 'not-valid-json',
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('SIDCLAW_TOOL_MAPPINGS must be valid JSON');
  });
});
