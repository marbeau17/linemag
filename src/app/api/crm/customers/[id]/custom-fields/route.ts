import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerFieldValues,
  setCustomerFieldValue,
  deleteCustomerFieldValue,
} from '@/lib/crm/custom-fields';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;

  try {
    const values = await getCustomerFieldValues(id);
    return NextResponse.json({ values });
  } catch (error) {
    console.error('[crm/customers/[id]/custom-fields] GET', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールド値の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;

  try {
    const body = await request.json();

    if (!body.fieldId || !body.value) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (fieldId, value)' },
        { status: 400 },
      );
    }

    await setCustomerFieldValue(id, body.fieldId, body.value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[crm/customers/[id]/custom-fields] PUT', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールド値の設定に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get('fieldId');

  if (!fieldId) {
    return NextResponse.json({ error: '削除するフィールドIDを指定してください' }, { status: 400 });
  }

  try {
    await deleteCustomerFieldValue(id, fieldId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[crm/customers/[id]/custom-fields] DELETE', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールド値の削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
