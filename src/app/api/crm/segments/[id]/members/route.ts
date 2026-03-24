import { NextRequest, NextResponse } from 'next/server';
import {
  getSegmentMembers,
  addMembersToSegment,
  removeMemberFromSegment,
} from '@/lib/crm/segments';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const customerIds = await getSegmentMembers(id);

    return NextResponse.json({ customerIds, count: customerIds.length });
  } catch (error) {
    console.error('[segments/members/get]', error);
    const message = error instanceof Error ? error.message : 'メンバー一覧の取得に失敗しました';
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

    await addMembersToSegment(id, body.customerIds as string[]);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[segments/members/add]', error);
    const message = error instanceof Error ? error.message : 'メンバーの追加に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const customerId = request.nextUrl.searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (customerId)' },
        { status: 400 }
      );
    }

    await removeMemberFromSegment(id, customerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[segments/members/remove]', error);
    const message = error instanceof Error ? error.message : 'メンバーの削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
