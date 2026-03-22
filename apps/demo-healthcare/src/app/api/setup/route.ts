import { NextResponse } from 'next/server';
import { getOrCreateDemoSession } from '@/lib/demo-session';

export async function POST() {
  try {
    const session = await getOrCreateDemoSession(null);
    return NextResponse.json({
      sessionId: session.sessionId,
      agentId: session.agentId,
      apiKey: session.apiKey,
    });
  } catch (error) {
    console.error('Demo setup failed:', error);
    return NextResponse.json(
      { error: 'Failed to set up demo environment' },
      { status: 500 }
    );
  }
}
