import { NextRequest, NextResponse } from 'next/server';
import { scrapeLatestArticles } from '@/lib/line/scraper';
import { summarizeArticle } from '@/lib/line/summarizer';
import { broadcastArticle } from '@/lib/line/messaging';
import { promises as fs } from 'fs';
import path from 'path';
import type { ScheduleConfig, TemplateId } from '@/types/line';

const SCHEDULE_FILE = path.join(process.cwd(), 'data', 'line-schedule.json');
const SENT_FILE = path.join(process.cwd(), 'data', 'line-sent-urls.json');

async function readSchedule(): Promise<ScheduleConfig> {
  try { return JSON.parse(await fs.readFile(SCHEDULE_FILE, 'utf-8')); }
  catch { return { enabled: false, times: ['09:00','18:00'], templateId: 'daily-column' as TemplateId, maxArticlesPerRun: 3 }; }
}

async function readSent(): Promise<string[]> {
  try { return JSON.parse(await fs.readFile(SENT_FILE, 'utf-8')); }
  catch { return []; }
}

async function addSent(url: string) {
  const urls = await readSent();
  if (!urls.includes(url)) {
    urls.push(url);
    await fs.mkdir(path.dirname(SENT_FILE), { recursive: true });
    await fs.writeFile(SENT_FILE, JSON.stringify(urls.slice(-200), null, 2), 'utf-8');
  }
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const schedule = await readSchedule();
    if (!schedule.enabled) {
      return NextResponse.json({ message: 'スケジュール無効', skipped: true });
    }

    const articles = await scrapeLatestArticles();
    const sent = await readSent();
    const fresh = articles.filter((a) => !sent.includes(a.url));
    if (fresh.length === 0) {
      return NextResponse.json({ message: '新着なし', articlesFound: articles.length });
    }

    const batch = fresh.slice(0, schedule.maxArticlesPerRun);
    const results = [];

    for (const article of batch) {
      try {
        const summary = await summarizeArticle(article);
        const result = await broadcastArticle({
          articleUrl: article.url,
          articleTitle: article.title,
          summaryTitle: summary.catchyTitle,
          summaryText: summary.summaryText,
          thumbnailUrl: article.thumbnailUrl,
          templateId: schedule.templateId,
          articleCategory: article.category || undefined,
        });
        if (result.success) await addSent(article.url);
        results.push({ url: article.url, success: result.success, error: result.error });
        if (batch.indexOf(article) < batch.length - 1) await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        results.push({ url: article.url, success: false, error: String(error) });
      }
    }

    return NextResponse.json({ message: '完了', results });
  } catch (error) {
    console.error('[cron]', error);
    return NextResponse.json({ error: 'Cron処理エラー' }, { status: 500 });
  }
}
