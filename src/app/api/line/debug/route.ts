// ============================================================================
// GET /api/line/debug
// デバッグ用: ブログスクレイピングの詳細ログを返す
// ============================================================================

import { NextResponse } from 'next/server';
import { scrapeLatestArticles, getAndClearLogs } from '@/lib/line/scraper';

export async function GET() {
  const startTime = Date.now();

  try {
    const articles = await scrapeLatestArticles();
    const logs = getAndClearLogs();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      durationMs,
      articlesFound: articles.length,
      articles: articles.map(a => ({
        url: a.url,
        title: a.title,
        bodyLength: a.body.length,
        bodyPreview: a.body.substring(0, 200),
        thumbnailUrl: a.thumbnailUrl,
        category: a.category,
        publishedAt: a.publishedAt,
      })),
      logs,
    });
  } catch (error) {
    const logs = getAndClearLogs();
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      logs,
    }, { status: 500 });
  }
}
