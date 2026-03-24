import { NextRequest, NextResponse } from 'next/server';
import { useCoupon as redeemCoupon } from '@/lib/coupon/issues';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const { issueId, discountAmount } = await request.json();

    if (!issueId) {
      return NextResponse.json(
        { error: '発行IDを指定してください' },
        { status: 400 }
      );
    }

    if (typeof discountAmount !== 'number' || discountAmount <= 0) {
      return NextResponse.json(
        { error: '有効な割引額を指定してください' },
        { status: 400 }
      );
    }

    const result = await redeemCoupon(issueId, discountAmount);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[coupons/[id]/use] POST', error);
    const message = error instanceof Error ? error.message : 'クーポンの使用処理に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
