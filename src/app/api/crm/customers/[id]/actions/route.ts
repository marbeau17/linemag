import { NextRequest, NextResponse } from 'next/server';
import { getCustomerActions } from '@/lib/crm/actions';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const actionType = (searchParams.get('actionType') as import('@/lib/crm/actions').ActionType) || undefined;

  try {
    const result = await getCustomerActions(id, { limit, offset, actionType });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[crm/customers/[id]/actions] GET', error);
    const message = error instanceof Error ? error.message : 'アクション履歴の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
