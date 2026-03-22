import { NextRequest, NextResponse } from 'next/server';

const SIDCLAW_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';

export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get('apiKey');
  const agentId = request.nextUrl.searchParams.get('agentId');

  if (!apiKey || !agentId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // Fetch recent traces for this agent
    const tracesRes = await fetch(
      `${SIDCLAW_API_URL}/api/v1/traces?agent_id=${agentId}&limit=10`,
      { headers, cache: 'no-store' }
    );
    const traces = tracesRes.ok ? await tracesRes.json() : { data: [] };

    // Fetch pending approvals
    const approvalsRes = await fetch(
      `${SIDCLAW_API_URL}/api/v1/approvals?status=pending&limit=10`,
      { headers, cache: 'no-store' }
    );
    const approvals = approvalsRes.ok ? await approvalsRes.json() : { data: [] };

    // For each trace, fetch its events (limit to 5 most recent)
    const tracesWithEvents = await Promise.all(
      (traces.data ?? []).slice(0, 5).map(async (trace: { id: string }) => {
        const detailRes = await fetch(
          `${SIDCLAW_API_URL}/api/v1/traces/${trace.id}`,
          { headers, cache: 'no-store' }
        );
        if (!detailRes.ok) return null;
        const detail = await detailRes.json();
        return detail.data ?? detail;
      })
    );

    // For each pending approval, fetch context — filter to this agent
    const approvalsWithContext = await Promise.all(
      (approvals.data ?? [])
        .filter((a: { agent_id: string }) => a.agent_id === agentId)
        .map(async (approval: { id: string }) => {
          const detailRes = await fetch(
            `${SIDCLAW_API_URL}/api/v1/approvals/${approval.id}`,
            { headers, cache: 'no-store' }
          );
          if (!detailRes.ok) return null;
          const detail = await detailRes.json();
          return detail.data ?? detail;
        })
    );

    return NextResponse.json({
      traces: tracesWithEvents.filter(Boolean),
      pendingApprovals: approvalsWithContext.filter(Boolean),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Governance poll failed:', error);
    return NextResponse.json({
      traces: [],
      pendingApprovals: [],
      timestamp: new Date().toISOString(),
    });
  }
}
