/**
 * LangChain.js callback handler for SidClaw governance logging.
 *
 * Non-blocking, observe-only integration. Creates audit traces
 * for every tool call without blocking execution.
 */
import type { AgentIdentityClient } from '@sidclaw/sdk';

/**
 * Callback handler methods interface.
 * Matches LangChain's BaseCallbackHandler pattern without requiring
 * the full @langchain/core dependency at the type level.
 */
interface CallbackHandlerMethods {
  handleToolStart?(tool: Record<string, unknown>, input: string, runId: string): Promise<void>;
  handleToolEnd?(output: string, runId: string): Promise<void>;
  handleToolError?(error: Error, runId: string): Promise<void>;
}

/**
 * Callback handler that logs all tool calls to SidClaw as audit traces.
 *
 * This is a non-blocking, observe-only integration. Every tool call
 * is recorded as a trace in SidClaw, but execution is never blocked.
 *
 * For policy enforcement (allow/deny/approval_required), use
 * governTools() or governTool() instead.
 */
export class GovernanceCallbackHandler implements CallbackHandlerMethods {
  name = 'sidclaw-governance';
  private activeTraces = new Map<string, string>();

  constructor(
    private client: AgentIdentityClient,
    private dataClassification: string = 'internal'
  ) {}

  async handleToolStart(tool: Record<string, unknown>, input: string, runId: string): Promise<void> {
    try {
      const toolName = (tool?.name as string) ?? (tool?.id as string) ?? 'unknown';
      const result = await this.client.evaluate({
        operation: toolName,
        target_integration: toolName,
        resource_scope: '*',
        data_classification: this.dataClassification as 'public' | 'internal' | 'confidential' | 'restricted',
        context: { input: input.substring(0, 500), mode: 'observe' },
      });
      this.activeTraces.set(runId, result.trace_id);
    } catch {
      // Never block on logging failures
    }
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    const traceId = this.activeTraces.get(runId);
    this.activeTraces.delete(runId);
    if (traceId) {
      try {
        await this.client.recordOutcome(traceId, { status: 'success' });
      } catch {
        // Silent
      }
    }
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    const traceId = this.activeTraces.get(runId);
    this.activeTraces.delete(runId);
    if (traceId) {
      try {
        await this.client.recordOutcome(traceId, {
          status: 'error',
          metadata: { error: error.message.substring(0, 500) },
        });
      } catch {
        // Silent
      }
    }
  }
}
