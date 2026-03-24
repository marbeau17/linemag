import { NextResponse } from 'next/server';
import { getReservationStats } from '@/lib/booking/reservations';

export async function GET() {
  try {
    const stats = await getReservationStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[booking/reservations/stats] GET', error);
    const message =
      error instanceof Error ? error.message : '予約統計の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
