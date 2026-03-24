import { NextRequest, NextResponse } from 'next/server';
import {
  getDeliveryTrend,
  getCustomerGrowth,
  getCouponUsageTrend,
  getReservationTrend,
  getTierDistribution,
  getTopContent,
  getHourlyActivity,
  getLifecycleFunnel,
} from '@/lib/analytics/charts';

const chartFunctions: Record<
  string,
  (range: { from: string; to: string }) => Promise<unknown>
> = {
  delivery: getDeliveryTrend,
  customers: getCustomerGrowth,
  coupons: getCouponUsageTrend,
  bookings: getReservationTrend,
  tiers: getTierDistribution,
  content: getTopContent,
  hourly: getHourlyActivity,
  funnel: getLifecycleFunnel,
};

const validTypes = Object.keys(chartFunctions);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!type || !from || !to) {
    return NextResponse.json(
      { error: 'type, from, to は必須パラメータです' },
      { status: 400 }
    );
  }

  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `無効なチャートタイプです。有効な値: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const fn = chartFunctions[type];
    const data = await fn({ from, to });
    return NextResponse.json({ type, data });
  } catch (error) {
    console.error(`[analytics/charts] GET type=${type}`, error);
    const message =
      error instanceof Error ? error.message : 'チャートデータの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
