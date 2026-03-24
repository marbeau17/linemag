import { NextRequest, NextResponse } from 'next/server';
import { getBookingSettings, updateBookingSettings } from '@/lib/booking/slots';

export async function GET() {
  try {
    const settings = await getBookingSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[booking/settings] GET', error);
    const message = error instanceof Error ? error.message : '予約設定の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = await updateBookingSettings(body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[booking/settings] PUT', error);
    const message = error instanceof Error ? error.message : '予約設定の更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
