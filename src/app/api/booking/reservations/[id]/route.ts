import { NextRequest, NextResponse } from 'next/server';
import {
  getReservationById,
  confirmReservation,
  cancelReservation,
  completeReservation,
  markNoShow,
} from '@/lib/booking/reservations';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const { id } = await params;

  try {
    const reservation = await getReservationById(id);
    if (!reservation) {
      return NextResponse.json(
        { error: '予約が見つかりません' },
        { status: 404 },
      );
    }
    return NextResponse.json(reservation);
  } catch (error) {
    console.error('[booking/reservations/[id]] GET', error);
    const message =
      error instanceof Error ? error.message : '予約情報の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams,
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { action } = body as {
      action: 'confirm' | 'cancel' | 'complete' | 'no_show';
    };

    if (!action) {
      return NextResponse.json(
        { error: 'action は必須です' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'confirm':
        await confirmReservation(id);
        break;
      case 'cancel':
        await cancelReservation(id);
        break;
      case 'complete':
        await completeReservation(id);
        break;
      case 'no_show':
        await markNoShow(id);
        break;
      default:
        return NextResponse.json(
          { error: `無効なアクションです: ${action}` },
          { status: 400 },
        );
    }

    // Return the updated reservation
    const updated = await getReservationById(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[booking/reservations/[id]] PUT', error);
    const message =
      error instanceof Error ? error.message : '予約ステータスの更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const { id } = await params;

  try {
    const reservation = await getReservationById(id);
    if (!reservation) {
      return NextResponse.json(
        { error: '予約が見つかりません' },
        { status: 404 },
      );
    }

    await cancelReservation(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[booking/reservations/[id]] DELETE', error);
    const message =
      error instanceof Error ? error.message : '予約のキャンセルに失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
