import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

// Allow-list of framework keys served by this endpoint. Keeping this explicit
// prevents path-traversal and ensures the dashboard and docs stay in sync.
const ALLOWED_KEYS = new Set([
  'soc2',
  'iso27001',
  'gdpr',
  'nist-ai-rmf',
  'finra-2026',
  'eu-ai-act',
]);

// Resolved relative to the dashboard app. In dev and production builds the
// repo-root `docs/compliance/` directory is four levels up from this file
// (apps/dashboard/src/app/api/compliance/[key]/route.ts -> repo root).
const COMPLIANCE_DIR = path.resolve(
  process.cwd(),
  '..',
  '..',
  'docs',
  'compliance',
);

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  const { key } = await context.params;

  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json(
      { error: 'not_found', message: `Unknown compliance framework: ${key}` },
      { status: 404 },
    );
  }

  const filePath = path.join(COMPLIANCE_DIR, `${key}.json`);

  try {
    const raw = await readFile(filePath, 'utf-8');
    // Parse + stringify validates JSON and normalises output.
    const parsed: unknown = JSON.parse(raw);
    return new NextResponse(JSON.stringify(parsed, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="sidclaw-${key}-evidence.json"`,
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      {
        error: 'read_failed',
        message: `Could not read compliance evidence for ${key}: ${message}`,
      },
      { status: 500 },
    );
  }
}
