import { NextRequest, NextResponse } from 'next/server';
import { getCustomerById, updateCustomer } from '@/lib/crm/customers';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;

  try {
    const customer = await getCustomerById(id);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }
    return NextResponse.json(customer);
  } catch (error) {
    console.error('[crm/customers/[id]] GET', error);
    const message = error instanceof Error ? error.message : '顧客情報の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const updated = await updateCustomer(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[crm/customers/[id]] PUT', error);
    const message = error instanceof Error ? error.message : '顧客情報の更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
