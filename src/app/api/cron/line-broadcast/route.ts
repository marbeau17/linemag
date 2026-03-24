import { NextRequest, NextResponse } from 'next/server';
import { scrapeLatestArticles } from '@/lib/line/scraper';
import { summarizeArticle } from '@/lib/line/summarizer';
import { broadcastArticle } from '@/lib/line/messaging';
import { LineApiError } from '@/lib/line/messaging';
import { storage } from '@/lib/line/storage-factory';
import { logExecution } from '@/lib/line/logger';
import { notifyOnError } from '@/lib/line/notifier';

function getJstInfo() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = jst.getUTCHours();
  const scheduledSlot = hour >= 15 ? '18:00' : '09:00';
  const timeStr = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')} JST`;
  return { timeStr, scheduledSlot };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { timeStr, scheduledSlot } = getJstInfo();
  console.log(`[cron] Triggered at ${timeStr} (slot: ${scheduledSlot})`);

  try {
    const schedule = await storage.getSchedule();
    if (!schedule.enabled) {
      await logExecution('CRON', 'SKIP', 'スケジュール無効');
      return NextResponse.json({ message: 'スケジュール無効', skipped: true, executionTimeJST: timeStr, scheduledSlot });
    }

    // スクレイピング
    await logExecution('SCRAPE', 'SUCCESS', 'スクレイピング開始');
    const articles = await scrapeLatestArticles();
    const sent = await storage.getSentUrls();
    const fresh = articles.filter((a) => !sent.includes(a.url));

    if (fresh.length === 0) {
      await logExecution('CRON', 'SKIP', `新着なし (取得${articles.length}件、全て配信済み)`);
      return NextResponse.json({ message: '新着なし', articlesFound: articles.length, executionTimeJST: timeStr, scheduledSlot });
    }

    await logExecution('SCRAPE', 'SUCCESS', `${fresh.length}件の未配信記事を検出`);

    const batch = fresh.slice(0, schedule.maxArticlesPerRun);
    const results = [];

    for (const article of batch) {
      try {
        // 要約
        await logExecution('SUMMARIZE', 'SUCCESS', `要約生成開始: ${article.title}`);
        const summary = await summarizeArticle(article);
        await logExecution('SUMMARIZE', 'SUCCESS', `要約生成完了: ${summary.catchyTitle} (${summary.summaryText.length}文字)`);

        // 配信
        const result = await broadcastArticle({
          articleUrl: article.url,
          articleTitle: article.title,
          summaryTitle: summary.catchyTitle,
          summaryText: summary.summaryText,
          thumbnailUrl: article.thumbnailUrl,
          templateId: schedule.templateId,
          articleCategory: article.category || undefined,
        });

        if (result.success) {
          await storage.addSentUrl({
            url: article.url,
            title: article.title,
            sentAt: result.sentAt,
            status: 'SUCCESS',
            templateId: schedule.templateId,
          });
          await storage.resetConsecutiveErrors();
          await logExecution('BROADCAST', 'SUCCESS', `配信成功: ${article.title}`);
        } else {
          await storage.addSentUrl({
            url: article.url,
            title: article.title,
            sentAt: result.sentAt,
            status: 'FAILED',
            error: result.error,
            templateId: schedule.templateId,
          });
          await logExecution('BROADCAST', 'ERROR', `配信失敗: ${result.error}`);

          // E-07: LINE認証エラーの通知
          if (result.error?.includes('認証エラー')) {
            await notifyOnError('E-07', result.error);
          }
        }

        results.push({ url: article.url, success: result.success, error: result.error });

        // 記事間に1秒の間隔
        if (batch.indexOf(article) < batch.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ url: article.url, success: false, error: errorMsg });
        await logExecution('BROADCAST', 'ERROR', `例外発生: ${errorMsg}`, { url: article.url });

        // 認証エラーの場合は即座に中断
        if (error instanceof LineApiError && error.isAuthError) {
          await notifyOnError('E-07', errorMsg);
          break;
        }
      }
    }

    // 連続エラーチェック
    const hasSuccess = results.some((r) => r.success);
    if (!hasSuccess) {
      const errorCount = await storage.incrementConsecutiveErrors();
      if (errorCount >= 3) {
        await notifyOnError('CONSECUTIVE', `${errorCount}回連続でエラーが発生しています`);
      }
    }

    await logExecution('CRON', 'SUCCESS', `Cron完了: ${results.filter(r => r.success).length}/${results.length}件成功`);
    return NextResponse.json({ message: '完了', results, executionTimeJST: timeStr, scheduledSlot });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[cron]', error);
    await logExecution('CRON', 'ERROR', `Cron処理エラー: ${errorMsg}`);

    const errorCount = await storage.incrementConsecutiveErrors();
    if (errorCount >= 3) {
      await notifyOnError('CONSECUTIVE', `${errorCount}回連続でエラーが発生: ${errorMsg}`);
    }

    return NextResponse.json({ error: 'Cron処理エラー', detail: errorMsg }, { status: 500 });
  }
}
