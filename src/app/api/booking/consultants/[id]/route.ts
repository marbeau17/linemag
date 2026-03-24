import { NextRequest, NextResponse } from 'next/server';
import { getConsultantById, updateConsultant, deleteConsultant } from '@/lib/booking/consultants';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const consultant = await getConsultantById(id);
    if (!consultant) {
      return NextResponse.json({ error: '担当者が見つかりません' }, { status: 404 });
    }
    return NextResponse.json(consultant);
  } catch (error) {
    console.error('[booking/consultants/[id]] GET', error);
    const message = error instanceof Error ? error.message : '担当者情報の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateConsultant(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[booking/consultants/[id]] PUT', error);
    const message = error instanceof Error ? error.message : '担当者情報の更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await deleteConsultant(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[booking/consultants/[id]] DELETE', error);
    const message = error instanceof Error ? error.message : '担当者の削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
