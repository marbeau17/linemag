import { NextRequest, NextResponse } from 'next/server';
import { getCustomerTags, addTagToCustomer, removeTagFromCustomer } from '@/lib/crm/tags';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;

  try {
    const tags = await getCustomerTags(id);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('[crm/customers/[id]/tags] GET', error);
    const message = error instanceof Error ? error.message : 'タグの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;

  try {
    const { tag } = await request.json();
    if (!tag || typeof tag !== 'string') {
      return NextResponse.json({ error: 'タグを指定してください' }, { status: 400 });
    }
    await addTagToCustomer(id, tag);
    const result = { customerId: id, tag };
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[crm/customers/[id]/tags] POST', error);
    const message = error instanceof Error ? error.message : 'タグの追加に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');

  if (!tag) {
    return NextResponse.json({ error: '削除するタグを指定してください' }, { status: 400 });
  }

  try {
    await removeTagFromCustomer(id, tag);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[crm/customers/[id]/tags] DELETE', error);
    const message = error instanceof Error ? error.message : 'タグの削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
