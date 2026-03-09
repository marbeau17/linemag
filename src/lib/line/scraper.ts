// ============================================================================
// src/lib/line/scraper.ts
// ブログスクレイピング — 記事一覧・詳細・サムネイル画像取得
// リトライロジック付き (E-01, E-03)
// ============================================================================

import * as cheerio from 'cheerio';
import type { ScrapedArticle } from '@/types/line';
import { config } from './config';
import { withRetry, fetchWithHttpError } from './retry';

// ─── ログ収集 ────────────────────────────────────────────────────────────────

export interface ScrapeLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

let _logs: ScrapeLog[] = [];

function log(level: ScrapeLog['level'], message: string, data?: Record<string, unknown>) {
  const entry: ScrapeLog = { timestamp: new Date().toISOString(), level, message, data };
  _logs.push(entry);
  const prefix = `[scraper:${level}]`;
  if (level === 'error') console.error(prefix, message, data || '');
  else if (level === 'warn') console.warn(prefix, message, data || '');
  else console.log(prefix, message, data || '');
}

export function getAndClearLogs(): ScrapeLog[] {
  const out = [..._logs];
  _logs = [];
  return out;
}

// ─── 記事一覧 ────────────────────────────────────────────────────────────────

interface ArticleListItem {
  url: string;
  title: string;
  thumbnailUrl: string | null;
  category: string | null;
}

export async function fetchArticleList(): Promise<ArticleListItem[]> {
  log('info', 'Fetching blog index page', { url: config.blog.url });

  // E-01: ブログページ取得失敗 — 1回リトライ (3秒間隔)
  const response = await withRetry(
    () => fetchWithHttpError(config.blog.url, {
      headers: { 'User-Agent': config.blog.userAgent },
    }),
    {
      ...config.retry.scraper,
      onRetry: (attempt, error) => {
        log('warn', `Blog index fetch retry #${attempt}`, { error: error.message });
      },
    },
  );

  const html = await response.text();
  log('info', 'Blog HTML fetched', { htmlLength: html.length });

  const $ = cheerio.load(html);
  const articles: ArticleListItem[] = [];

  // ── デバッグ: ページ内のカード系要素を探索 ──
  const cardCount = $('.card').length;
  const articleCount = $('article').length;
  const allLinks = $('a[href$=".html"]').length;
  log('debug', 'DOM element counts', { '.card': cardCount, 'article': articleCount, 'a[href$=.html]': allLinks });

  // ── メイン抽出: .card 要素 ──
  $('.card').each((i, el) => {
    const $card = $(el);
    const $link = $card.find('a[href]').first();
    let href = $link.attr('href');

    // If no child <a>, check if .card is wrapped by <a>
    if (!href) {
      const $parentLink = $card.closest('a[href]');
      href = $parentLink.attr('href');
    }

    log('debug', `Card #${i} found`, {
      hasLink: !!href,
      href: href || 'none',
      html: $card.html()?.substring(0, 200),
    });

    if (!href || href === '#') return;

    let url: string;
    if (href.startsWith('http')) {
      url = href;
    } else if (href.startsWith('./')) {
      url = `${config.blog.baseUrl}${href.substring(2)}`;
    } else {
      url = `${config.blog.baseUrl}${href}`;
    }

    const title =
      $card.find('h3').first().text().trim() ||
      $card.find('h2').first().text().trim() ||
      $link.text().trim() || '';
    if (!title || title === 'READ MORE') {
      log('debug', `Card #${i} skipped — no valid title`, { rawText: $card.text().substring(0, 100) });
      return;
    }

    const $img = $card.find('img').first();
    let thumbnailUrl: string | null = null;
    if ($img.length) {
      const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
      if (src) {
        if (src.startsWith('http')) {
          thumbnailUrl = src;
        } else if (src.startsWith('./')) {
          thumbnailUrl = `${config.blog.baseUrl}${src.substring(2)}`;
        } else if (src.startsWith('/')) {
          thumbnailUrl = `${config.blog.siteUrl}${src}`;
        } else {
          thumbnailUrl = `${config.blog.baseUrl}${src}`;
        }
      }
      log('debug', `Card #${i} image`, { rawSrc: src, resolved: thumbnailUrl });
    }

    const category =
      $card.find('.category-badge').first().text().trim() ||
      $card.attr('data-category') ||
      $card.find('[class*="badge"], [class*="category"]').first().text().trim() ||
      null;

    articles.push({ url, title, thumbnailUrl, category });
    log('info', `Article extracted: ${title}`, { url, hasThumbnail: !!thumbnailUrl, category });
  });

  // ── フォールバック: .card が無い場合 ──
  if (articles.length === 0) {
    log('warn', 'No .card elements found — trying fallback link selector');

    $('a[href$=".html"]').each((i, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      if (!href || href === '#' || href.includes('index')) return;

      let url: string;
      if (href.startsWith('http')) url = href;
      else if (href.startsWith('./')) url = `${config.blog.baseUrl}${href.substring(2)}`;
      else url = `${config.blog.baseUrl}${href}`;

      if (articles.some(a => a.url === url)) return;

      const title = $a.find('h3, h2').first().text().trim() || $a.text().trim();
      if (!title || title.length < 5 || title === 'READ MORE') return;

      const $img = $a.find('img').first();
      let thumbnailUrl: string | null = null;
      if ($img.length) {
        const src = $img.attr('src') || $img.attr('data-src');
        if (src) {
          if (src.startsWith('http')) thumbnailUrl = src;
          else if (src.startsWith('./')) thumbnailUrl = `${config.blog.baseUrl}${src.substring(2)}`;
          else thumbnailUrl = `${config.blog.baseUrl}${src}`;
        }
      }

      articles.push({ url, title, thumbnailUrl, category: null });
      log('info', `Fallback article: ${title}`, { url });
    });
  }

  log('info', `Total articles extracted: ${articles.length}`);
  return articles;
}

// ─── 記事詳細 ────────────────────────────────────────────────────────────────

export async function fetchArticleDetail(item: ArticleListItem): Promise<ScrapedArticle> {
  log('info', `Fetching article detail: ${item.title}`, { url: item.url });

  // E-03: 記事詳細ページ取得失敗 — 1回リトライ
  const response = await withRetry(
    () => fetchWithHttpError(item.url, {
      headers: { 'User-Agent': config.blog.userAgent },
    }),
    {
      ...config.retry.scraper,
      onRetry: (attempt, error) => {
        log('warn', `Article detail fetch retry #${attempt}`, { url: item.url, error: error.message });
      },
    },
  );

  const html = await response.text();
  const $ = cheerio.load(html);

  const contentRoot = $('article').first().length ? $('article').first()
    : $('main').first().length ? $('main').first()
    : $('body');

  const bodyClone = contentRoot.clone();
  bodyClone.find('nav, footer, header, script, style, noscript, [class*="related"], [class*="share"], [class*="sidebar"]').remove();

  const bodyText = bodyClone
    .find('p, h2, h3, li')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t: string) => t.length > 0)
    .join('\n');

  log('debug', 'Article body extracted', { bodyLength: bodyText.length, preview: bodyText.substring(0, 150) });

  const dateMatch = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const publishedAt = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : null;

  let thumbnailUrl = item.thumbnailUrl;
  if (!thumbnailUrl) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      thumbnailUrl = ogImage.startsWith('http') ? ogImage : `${config.blog.siteUrl}${ogImage}`;
    }
    log('debug', 'OGP image fallback', { ogImage, resolved: thumbnailUrl });
  }

  return {
    url: item.url,
    title: item.title,
    body: bodyText,
    thumbnailUrl,
    category: item.category,
    publishedAt,
  };
}

// ─── 一括取得 ────────────────────────────────────────────────────────────────

export async function scrapeLatestArticles(): Promise<ScrapedArticle[]> {
  _logs = [];
  log('info', '=== Scrape session started ===');

  const list = await fetchArticleList();
  const articles: ScrapedArticle[] = [];

  for (const item of list) {
    try {
      articles.push(await fetchArticleDetail(item));
    } catch (err) {
      // E-03: 該当記事をスキップし次の記事を処理
      log('error', `Failed to fetch article detail — skipping`, {
        url: item.url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log('info', `=== Scrape complete: ${articles.length} articles ===`);
  return articles;
}
