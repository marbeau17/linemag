import { NextResponse } from 'next/server';
import { getCustomerCount } from '@/lib/crm/customers';

export async function GET() {
  try {
    const count = await getCustomerCount();
    return NextResponse.json({ count });
  } catch (error) {
    console.error('[crm/customers/count]', error);
    const message = error instanceof Error ? error.message : '顧客数の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
