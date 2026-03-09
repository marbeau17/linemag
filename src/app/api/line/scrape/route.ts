import { NextResponse } from 'next/server';
import { fetchArticleList, getAndClearLogs } from '@/lib/line/scraper';

export async function POST() {
  try {
    const list = await fetchArticleList();
    const scrapeLogs = getAndClearLogs();

    if (list.length === 0) {
      return NextResponse.json({
        articles: [],
        message: '新しい記事が見つかりませんでした',
        logs: scrapeLogs,
      });
    }

    const results = list.map((item) => ({
      url: item.url,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      category: item.category,
    }));

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
