import { NextRequest, NextResponse } from 'next/server';
import { getCustomerCoupons } from '@/lib/coupon/issues';

type RouteParams = { params: Promise<{ customerId: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const coupons = await getCustomerCoupons(customerId, status ? { status } : undefined);
    return NextResponse.json(coupons);
  } catch (error) {
    console.error('[coupons/customer/[customerId]] GET', error);
    const message = error instanceof Error ? error.message : '顧客のクーポン情報の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
