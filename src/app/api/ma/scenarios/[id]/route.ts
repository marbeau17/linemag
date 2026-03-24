import { NextRequest, NextResponse } from 'next/server';
import { getScenarioById, updateScenario, deleteScenario } from '@/lib/ma/scenarios';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const scenario = await getScenarioById(id);

    if (!scenario) {
      return NextResponse.json({ error: 'シナリオが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('[scenarios/get]', error);
    const message = error instanceof Error ? error.message : 'シナリオの取得に失敗しました';
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

    const scenario = await updateScenario(id, body);

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('[scenarios/update]', error);
    const message = error instanceof Error ? error.message : 'シナリオの更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await deleteScenario(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[scenarios/delete]', error);
    const message = error instanceof Error ? error.message : 'シナリオの削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
