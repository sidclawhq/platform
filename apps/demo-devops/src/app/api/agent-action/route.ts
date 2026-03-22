import { NextRequest, NextResponse } from 'next/server';
import { AgentIdentityClient } from '@sidclaw/sdk';

const SIDCLAW_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  const { apiKey, agentId, action } = await request.json();

  if (!apiKey || !agentId || !action) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = new AgentIdentityClient({
    apiKey,
    apiUrl: SIDCLAW_API_URL,
    agentId,
  });

  try {
    const decision = await client.evaluate({
      operation: action.operation,
      target_integration: action.target_integration,
      resource_scope: action.resource_scope,
      data_classification: action.data_classification,
      context: action.context ?? {},
    });

    // If allowed, record outcome (mock execution)
    if (decision.decision === 'allow') {
      await client.recordOutcome(decision.trace_id, {
        status: 'success',
        metadata: action.context,
      });
    }

    return NextResponse.json({
      decision: decision.decision,
      trace_id: decision.trace_id,
      approval_request_id: decision.approval_request_id,
      reason: decision.reason,
    });
  } catch (error) {
    console.error('Agent action failed:', error);
    return NextResponse.json(
      { error: 'Action failed', message: String(error) },
      { status: 500 }
    );
  }
}
