import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/line/storage-factory';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const history = await storage.getBroadcastHistory(limit);
    return NextResponse.json({ history });
  } catch (error) {
    console.error('[history]', error);
    return NextResponse.json({ error: '履歴の取得に失敗しました' }, { status: 500 });
  }
}
