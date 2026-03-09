import { NextResponse } from 'next/server';
import { fetchArticleList, getAndClearLogs } from '@/lib/line/scraper';

export async function POST() {
  try {
    const articles = await fetchArticleList();
    const logs = getAndClearLogs();
    return NextResponse.json({ articles, count: articles.length, logs });
  } catch (error) {
    const logs = getAndClearLogs();
    console.error('[scrape-list]', error);
    return NextResponse.json({
      error: '記事一覧の取得に失敗しました',
      detail: error instanceof Error ? error.message : String(error),
      logs,
    }, { status: 500 });
  }
}
