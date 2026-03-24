import { NextRequest, NextResponse } from 'next/server';
import { getABTestById, updateABTest, deleteABTest, calculateTestResults } from '@/lib/ma/ab-tests';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const test = await getABTestById(id);

    if (!test) {
      return NextResponse.json({ error: 'A/Bテストが見つかりません' }, { status: 404 });
    }

    const results = await calculateTestResults(id);

    return NextResponse.json({ test, results });
  } catch (error) {
    console.error('[ab-tests/get]', error);
    const message = error instanceof Error ? error.message : 'A/Bテストの取得に失敗しました';
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

    const test = await updateABTest(id, body);

    return NextResponse.json({ test });
  } catch (error) {
    console.error('[ab-tests/update]', error);
    const message = error instanceof Error ? error.message : 'A/Bテストの更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await deleteABTest(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ab-tests/delete]', error);
    const message = error instanceof Error ? error.message : 'A/Bテストの削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
