import { NextRequest, NextResponse } from 'next/server';
import { getConsultants, createConsultant } from '@/lib/booking/consultants';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    const consultants = await getConsultants(activeOnly);
    return NextResponse.json(consultants);
  } catch (error) {
    console.error('[booking/consultants] GET', error);
    const message = error instanceof Error ? error.message : '担当者一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const consultant = await createConsultant(body);
    return NextResponse.json(consultant, { status: 201 });
  } catch (error) {
    console.error('[booking/consultants] POST', error);
    const message = error instanceof Error ? error.message : '担当者の作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
