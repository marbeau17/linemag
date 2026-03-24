import { NextRequest, NextResponse } from 'next/server';
import { getABTests, createABTest } from '@/lib/ma/ab-tests';

export async function GET() {
  try {
    const tests = await getABTests();
    return NextResponse.json({ tests });
  } catch (error) {
    console.error('[ab-tests]', error);
    const message = error instanceof Error ? error.message : 'A/Bテスト一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (name)' },
        { status: 400 }
      );
    }

    const test = await createABTest(body);

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    console.error('[ab-tests/create]', error);
    const message = error instanceof Error ? error.message : 'A/Bテストの作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
