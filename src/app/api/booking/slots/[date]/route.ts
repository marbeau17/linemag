import { NextRequest, NextResponse } from 'next/server';
import { getSlotsForDate } from '@/lib/booking/slots';

type RouteParams = { params: Promise<{ date: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { date } = await params;
    const { searchParams } = new URL(request.url);
    const consultantId = searchParams.get('consultantId');

    const slots = await getSlotsForDate(date, consultantId ?? undefined);
    return NextResponse.json(slots);
  } catch (error) {
    console.error('[booking/slots/[date]] GET', error);
    const message = error instanceof Error ? error.message : '指定日の予約枠の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
