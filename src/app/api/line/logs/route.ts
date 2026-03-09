import { NextRequest, NextResponse } from 'next/server';
import { getLogs } from '@/lib/line/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const step = searchParams.get('step') || undefined;

  try {
    const logs = await getLogs(limit, step);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[logs]', error);
    return NextResponse.json({ error: 'ログの取得に失敗しました' }, { status: 500 });
  }
}
