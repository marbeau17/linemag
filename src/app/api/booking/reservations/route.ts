import { NextRequest, NextResponse } from 'next/server';
import { getReservations, createReservation } from '@/lib/booking/reservations';
import { getConsultantById } from '@/lib/booking/consultants';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const consultantId = searchParams.get('consultantId') || undefined;
  const customerId = searchParams.get('customerId') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const limit = searchParams.get('limit')
    ? parseInt(searchParams.get('limit')!, 10)
    : undefined;
  const offset = searchParams.get('offset')
    ? parseInt(searchParams.get('offset')!, 10)
    : undefined;

  try {
    const reservations = await getReservations({
      status,
      consultantId,
      customerId,
      dateFrom,
      dateTo,
      limit,
      offset,
    });
    return NextResponse.json(reservations);
  } catch (error) {
    console.error('[booking/reservations] GET', error);
    const message =
      error instanceof Error ? error.message : '予約一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, timeSlotId, consultantId, serviceType, notes } = body;

    if (!customerId || !timeSlotId || !consultantId) {
      return NextResponse.json(
        { error: 'customerId, timeSlotId, consultantId は必須です' },
        { status: 400 },
      );
    }

    // Auto-assign meetUrl from consultant's meet_url
    const consultant = await getConsultantById(consultantId);
    if (!consultant) {
      return NextResponse.json(
        { error: '指定された相談員が見つかりません' },
        { status: 404 },
      );
    }

    const reservation = await createReservation({
      customerId,
      timeSlotId,
      consultantId,
      serviceType,
      notes,
      meetUrl: consultant.meetUrl,
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error('[booking/reservations] POST', error);
    const message =
      error instanceof Error ? error.message : '予約の作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
