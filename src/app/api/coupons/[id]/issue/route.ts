import { NextRequest, NextResponse } from 'next/server';
import { batchIssueCoupon, getCouponIssues } from '@/lib/coupon/issues';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const { customerIds, expiresAt } = await request.json();

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: '対象顧客IDを指定してください' },
        { status: 400 }
      );
    }

    const result = await batchIssueCoupon(id, customerIds, expiresAt);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[coupons/[id]/issue] POST', error);
    const message = error instanceof Error ? error.message : 'クーポンの発行に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const issues = await getCouponIssues(id);
    return NextResponse.json(issues);
  } catch (error) {
    console.error('[coupons/[id]/issue] GET', error);
    const message = error instanceof Error ? error.message : '発行済みクーポンの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
