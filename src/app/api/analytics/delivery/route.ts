import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryStats, getDailyDeliveryCounts } from '@/lib/ma/delivery';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      { error: '期間（from, to）は必須です' },
      { status: 400 }
    );
  }

  try {
    const [stats, trend] = await Promise.all([
      getDeliveryStats(from, to),
      getDailyDeliveryCounts(from, to),
    ]);

    return NextResponse.json({ stats, trend });
  } catch (error) {
    console.error('[analytics/delivery] GET', error);
    const message =
      error instanceof Error ? error.message : '配信統計の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
