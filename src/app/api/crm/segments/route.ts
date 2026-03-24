import { NextRequest, NextResponse } from 'next/server';
import { getSegments, createSegment } from '@/lib/crm/segments';

export async function GET() {
  try {
    const segments = await getSegments();
    return NextResponse.json({ segments });
  } catch (error) {
    console.error('[segments]', error);
    const message = error instanceof Error ? error.message : 'セグメント一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (name, type)' },
        { status: 400 }
      );
    }

    const segment = await createSegment({
      name: body.name,
      description: body.description,
      type: body.type,
      rules: body.rules,
      autoRefresh: body.autoRefresh,
    });

    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    console.error('[segments/create]', error);
    const message = error instanceof Error ? error.message : 'セグメントの作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
