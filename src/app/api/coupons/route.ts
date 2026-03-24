import { NextRequest, NextResponse } from 'next/server';
import { getCouponMasters, createCouponMaster } from '@/lib/coupon/masters';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    const masters = await getCouponMasters({ activeOnly });
    return NextResponse.json(masters);
  } catch (error) {
    console.error('[coupons] GET', error);
    const message = error instanceof Error ? error.message : 'クーポン一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const master = await createCouponMaster(body);
    return NextResponse.json(master, { status: 201 });
  } catch (error) {
    console.error('[coupons] POST', error);
    const message = error instanceof Error ? error.message : 'クーポンの作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
