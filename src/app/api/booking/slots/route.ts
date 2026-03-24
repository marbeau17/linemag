import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots, bulkCreateSlots } from '@/lib/booking/slots';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const durationMinutes = searchParams.get('durationMinutes');
  const consultantId = searchParams.get('consultantId');

  try {
    const slots = await getAvailableSlots({
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      consultantId: consultantId ?? undefined,
    });
    return NextResponse.json(slots);
  } catch (error) {
    console.error('[booking/slots] GET', error);
    const message = error instanceof Error ? error.message : '予約枠の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { consultantId, startDate, endDate, durationMinutes } = body;
    const slots = await bulkCreateSlots(consultantId, startDate, endDate, durationMinutes);
    return NextResponse.json(slots, { status: 201 });
  } catch (error) {
    console.error('[booking/slots] POST', error);
    const message = error instanceof Error ? error.message : '予約枠の作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
