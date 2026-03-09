import { NextRequest, NextResponse } from 'next/server';
import { fetchArticleDetail } from '@/lib/line/scraper';
import { summarizeArticle } from '@/lib/line/summarizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.url || !body.title) {
      return NextResponse.json({ error: 'url and title are required' }, { status: 400 });
    }

    const article = await fetchArticleDetail({
      url: body.url,
      title: body.title,
      thumbnailUrl: body.thumbnailUrl || null,
      category: body.category || null,
    });

    let catchyTitle = article.title;
    let summaryText = article.body.substring(0, 300);

    try {
      const summary = await summarizeArticle(article);
      catchyTitle = summary.catchyTitle;
      summaryText = summary.summaryText;
    } catch (err) {
      console.error('[scrape-detail] summarize failed:', err);
    }

    return NextResponse.json({
      url: article.url,
      title: article.title,
      catchyTitle,
      summaryText,
      thumbnailUrl: article.thumbnailUrl,
      category: article.category,
      bodyLength: article.body.length,
    });
  } catch (error) {
    console.error('[scrape-detail]', error);
    return NextResponse.json({
      error: '記事詳細の取得に失敗しました',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
