import { NextRequest, NextResponse } from 'next/server';
import { AgentIdentityClient } from '@sidclaw/sdk';

const SIDCLAW_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  const { apiKey, agentId, traceId, status } = await request.json();

  if (!apiKey || !agentId || !traceId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const client = new AgentIdentityClient({
    apiKey,
    apiUrl: SIDCLAW_API_URL,
    agentId,
  });

  try {
    await client.recordOutcome(traceId, {
      status: status === 'success' ? 'success' : 'error',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Record outcome failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
