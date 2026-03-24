import { NextRequest, NextResponse } from 'next/server';
import { getDashboardKPIs } from '@/lib/analytics/kpi';

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
    const kpis = await getDashboardKPIs({ from, to });
    return NextResponse.json(kpis);
  } catch (error) {
    console.error('[analytics/kpi] GET', error);
    const message =
      error instanceof Error ? error.message : 'KPIの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
