import { NextRequest, NextResponse } from 'next/server';
import { getScenarioLogs } from '@/lib/ma/scenarios';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const limit = request.nextUrl.searchParams.get('limit');

    const logs = await getScenarioLogs(id, limit ? parseInt(limit, 10) : undefined);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[scenarios/logs]', error);
    const message = error instanceof Error ? error.message : 'シナリオログの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
