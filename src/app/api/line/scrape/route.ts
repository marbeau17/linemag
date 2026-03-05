import { NextResponse } from 'next/server';
import { scrapeLatestArticles } from '@/lib/line/scraper';
import { summarizeArticle } from '@/lib/line/summarizer';

export async function POST() {
  try {
    const articles = await scrapeLatestArticles();
    if (articles.length === 0) {
      return NextResponse.json({ articles: [], message: '新しい記事が見つかりませんでした' });
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
      } catch {
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
    return NextResponse.json({ articles: results });
  } catch (error) {
    console.error('[scrape]', error);
    return NextResponse.json({ error: '記事の取得に失敗しました' }, { status: 500 });
  }
}
