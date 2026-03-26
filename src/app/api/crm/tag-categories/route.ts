import { NextRequest, NextResponse } from 'next/server';
import { getTagCategories, createTagCategory } from '@/lib/crm/tag-categories';

export async function GET() {
  try {
    const categories = await getTagCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('[crm/tag-categories] GET', error);
    const message = error instanceof Error ? error.message : 'タグカテゴリ一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.color) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (name, color)' },
        { status: 400 },
      );
    }

    const category = await createTagCategory({
      name: body.name,
      color: body.color,
      displayOrder: body.displayOrder,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('[crm/tag-categories] POST', error);
    const message = error instanceof Error ? error.message : 'タグカテゴリの作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
