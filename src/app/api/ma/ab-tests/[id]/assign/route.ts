import { NextRequest, NextResponse } from 'next/server';
import { assignCustomersToTest, getTestAssignments } from '@/lib/ma/ab-tests';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const assignments = await getTestAssignments(id);

    return NextResponse.json({ assignments, count: assignments.length });
  } catch (error) {
    console.error('[ab-tests/assign/get]', error);
    const message = error instanceof Error ? error.message : 'テスト割り当ての取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.customerIds || !Array.isArray(body.customerIds) || body.customerIds.length === 0) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (customerIds)' },
        { status: 400 }
      );
    }

    await assignCustomersToTest(id, body.customerIds as string[]);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[ab-tests/assign]', error);
    const message = error instanceof Error ? error.message : '顧客の割り当てに失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
