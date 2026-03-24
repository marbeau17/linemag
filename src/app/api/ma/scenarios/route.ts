import { NextRequest, NextResponse } from 'next/server';
import { getScenarios, createScenario } from '@/lib/ma/scenarios';

export async function GET() {
  try {
    const scenarios = await getScenarios();
    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error('[scenarios]', error);
    const message = error instanceof Error ? error.message : 'シナリオ一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const scenario = await createScenario(body);

    return NextResponse.json({ scenario }, { status: 201 });
  } catch (error) {
    console.error('[scenarios/create]', error);
    const message = error instanceof Error ? error.message : 'シナリオの作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
