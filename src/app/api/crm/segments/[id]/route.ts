import { NextRequest, NextResponse } from 'next/server';
import { getSegmentById, updateSegment, deleteSegment } from '@/lib/crm/segments';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const segment = await getSegmentById(id);

    if (!segment) {
      return NextResponse.json({ error: 'セグメントが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ segment });
  } catch (error) {
    console.error('[segments/get]', error);
    const message = error instanceof Error ? error.message : 'セグメントの取得に失敗しました';
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

    const segment = await updateSegment(id, body);

    return NextResponse.json({ segment });
  } catch (error) {
    console.error('[segments/update]', error);
    const message = error instanceof Error ? error.message : 'セグメントの更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await deleteSegment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[segments/delete]', error);
    const message = error instanceof Error ? error.message : 'セグメントの削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
