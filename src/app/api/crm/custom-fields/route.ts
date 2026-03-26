import { NextRequest, NextResponse } from 'next/server';
import { getFieldDefinitions, createFieldDefinition } from '@/lib/crm/custom-fields';

export async function GET() {
  try {
    const definitions = await getFieldDefinitions();
    return NextResponse.json({ definitions });
  } catch (error) {
    console.error('[crm/custom-fields] GET', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールド一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.fieldKey || !body.fieldType) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (name, fieldKey, fieldType)' },
        { status: 400 },
      );
    }

    const definition = await createFieldDefinition({
      name: body.name,
      fieldKey: body.fieldKey,
      fieldType: body.fieldType,
      options: body.options,
      isRequired: body.isRequired,
      displayOrder: body.displayOrder,
      description: body.description,
    });

    return NextResponse.json({ definition }, { status: 201 });
  } catch (error) {
    console.error('[crm/custom-fields] POST', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールドの作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
