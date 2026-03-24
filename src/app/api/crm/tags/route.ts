import { NextResponse } from 'next/server';
import { getAllUniqueTags, getTagCounts } from '@/lib/crm/tags';

export async function GET() {
  try {
    const [tags, counts] = await Promise.all([
      getAllUniqueTags(),
      getTagCounts(),
    ]);

    return NextResponse.json({ tags, counts });
  } catch (error) {
    console.error('[tags]', error);
    const message = error instanceof Error ? error.message : 'タグ一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
