import { NextRequest, NextResponse } from 'next/server';
import { getCustomers } from '@/lib/crm/customers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '20', 10);
  const search = searchParams.get('search') || undefined;
  const tier = searchParams.get('tier') || undefined;
  const prefecture = searchParams.get('prefecture') || undefined;
  const sortBy = (searchParams.get('sortBy') as 'last_seen_at' | 'created_at' | 'display_name' | 'message_count') || undefined;
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined;

  try {
    const result = await getCustomers({
      page,
      perPage,
      search,
      tier,
      prefecture,
      sortBy,
      sortOrder,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[crm/customers]', error);
    const message = error instanceof Error ? error.message : '顧客一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
