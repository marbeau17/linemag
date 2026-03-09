import { NextResponse } from 'next/server';
import { scrapeLatestArticles, getAndClearLogs } from '@/lib/line/scraper';
import { summarizeArticle } from '@/lib/line/summarizer';

export async function POST() {
  try {
    const articles = await scrapeLatestArticles();
    const scrapeLogs = getAndClearLogs();

    if (articles.length === 0) {
      return NextResponse.json({
        articles: [],
        message: '新しい記事が見つかりませんでした',
        logs: scrapeLogs,
      });
    }

    const results = [];
    for (const article of articles) {
      try {
        const summary = await summarizeArticle(article);
        results.push({
          url: article.url,
          originalTitle: article.title,
          catchyTitle: summary.catchyTitle,
          summaryText: summary.summaryText,
          thumbnailUrl: article.thumbnailUrl,
          category: article.category,
        });
      } catch (err) {
        console.error('[scrape] summarize failed:', err);
        results.push({
          url: article.url,
          originalTitle: article.title,
          catchyTitle: article.title,
          summaryText: article.body.substring(0, 300),
          thumbnailUrl: article.thumbnailUrl,
          category: article.category,
        });
      }
    }
    return NextResponse.json({ articles: results, logs: scrapeLogs });
  } catch (error) {
    const scrapeLogs = getAndClearLogs();
    console.error('[scrape]', error);
    return NextResponse.json({
      error: '記事の取得に失敗しました',
      detail: error instanceof Error ? error.message : String(error),
      logs: scrapeLogs,
    }, { status: 500 });
  }
}
