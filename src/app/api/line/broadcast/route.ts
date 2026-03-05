import { NextRequest, NextResponse } from 'next/server';
import { broadcastArticle } from '@/lib/line/messaging';
import type { BroadcastRequest, TemplateId } from '@/types/line';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.articleUrl || !body.summaryTitle || !body.summaryText || !body.templateId) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const req: BroadcastRequest = {
      articleUrl: body.articleUrl,
      articleTitle: body.articleTitle,
      summaryTitle: body.summaryTitle,
      summaryText: body.summaryText,
      thumbnailUrl: body.thumbnailUrl,
      templateId: body.templateId as TemplateId,
      articleCategory: body.articleCategory,
    };

    const result = await broadcastArticle(req);
    if (!result.success) {
      return NextResponse.json({ error: result.error || '配信に失敗しました' }, { status: 500 });
    }
    return NextResponse.json({ success: true, sentAt: result.sentAt });
  } catch (error) {
    console.error('[broadcast]', error);
    return NextResponse.json({ error: '配信処理中にエラーが発生しました' }, { status: 500 });
  }
}
