import { NextRequest, NextResponse } from 'next/server';
import { getCouponMasterById, getCouponStats } from '@/lib/coupon';
import { updateCouponMaster, deleteCouponMaster } from '@/lib/coupon/masters';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const [master, stats] = await Promise.all([
      getCouponMasterById(id),
      getCouponStats(id),
    ]);

    if (!master) {
      return NextResponse.json({ error: 'クーポンが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ master, stats });
  } catch (error) {
    console.error('[coupons/[id]] GET', error);
    const message = error instanceof Error ? error.message : 'クーポン情報の取得に失敗しました';
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
    const updated = await updateCouponMaster(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[coupons/[id]] PUT', error);
    const message = error instanceof Error ? error.message : 'クーポンの更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await deleteCouponMaster(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[coupons/[id]] DELETE', error);
    const message = error instanceof Error ? error.message : 'クーポンの削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
