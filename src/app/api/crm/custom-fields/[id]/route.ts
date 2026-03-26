import { NextRequest, NextResponse } from 'next/server';
import {
  getFieldDefinitionById,
  updateFieldDefinition,
  deleteFieldDefinition,
} from '@/lib/crm/custom-fields';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const definition = await getFieldDefinitionById(id);

    if (!definition) {
      return NextResponse.json({ error: 'カスタムフィールドが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ definition });
  } catch (error) {
    console.error('[crm/custom-fields/[id]] GET', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールドの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const definition = await updateFieldDefinition(id, body);

    return NextResponse.json({ definition });
  } catch (error) {
    console.error('[crm/custom-fields/[id]] PUT', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールドの更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    await deleteFieldDefinition(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[crm/custom-fields/[id]] DELETE', error);
    const message = error instanceof Error ? error.message : 'カスタムフィールドの削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
