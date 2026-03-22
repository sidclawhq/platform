import { NextRequest, NextResponse } from 'next/server';

const SIDCLAW_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  const { approvalId, action, apiKey, note } = await request.json();

  if (!approvalId || !action || !apiKey) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  if (action !== 'approve' && action !== 'deny') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${SIDCLAW_API_URL}/api/v1/approvals/${approvalId}/${action}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approver_name: 'Demo Reviewer',
          decision_note: note || `${action === 'approve' ? 'Approved' : 'Denied'} via interactive demo`,
        }),
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Approval action failed:', error);
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
