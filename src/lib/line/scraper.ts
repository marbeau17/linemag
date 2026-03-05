// ============================================================================
// src/lib/line/scraper.ts
// ブログスクレイピング — 記事一覧・詳細・サムネイル画像取得
// ============================================================================

import * as cheerio from 'cheerio';
import type { ScrapedArticle } from '@/types/line';

const BLOG_URL = 'https://meetsc.co.jp/blog/';
const BLOG_BASE_URL = 'https://meetsc.co.jp/blog/';
const MAX_ARTICLES = 5;

interface ArticleListItem {
  url: string;
  title: string;
  thumbnailUrl: string | null;
  category: string | null;
}

export async function fetchArticleList(): Promise<ArticleListItem[]> {
  const response = await fetch(BLOG_URL, {
    headers: { 'User-Agent': 'LineMag/1.0' },
  });
  if (!response.ok) throw new Error(`Blog fetch failed: ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const articles: ArticleListItem[] = [];

  $('.card, [class*="card"], article').each((_, el) => {
    const $card = $(el);
    const $link = $card.find('a[href]').first();
    const href = $link.attr('href');
    if (!href || href === '#') return;

    const url = href.startsWith('http') ? href : `${BLOG_BASE_URL}${href}`;
    const title =
      $card.find('h3').first().text().trim() ||
      $card.find('h2').first().text().trim() ||
      $link.text().trim() || '';
    if (!title || title === 'READ MORE') return;

    const $img = $card.find('img').first();
    let thumbnailUrl: string | null = null;
    if ($img.length) {
      const src = $img.attr('src') || $img.attr('data-src');
      if (src) {
        thumbnailUrl = src.startsWith('http')
          ? src
          : `https://meetsc.co.jp${src.startsWith('/') ? '' : '/'}${src}`;
      }
    }

    const category =
      $card.find('[class*="badge"], [class*="category"], .tag').first().text().trim() || null;

    articles.push({ url, title, thumbnailUrl, category });
  });

  return articles.slice(0, MAX_ARTICLES);
}

export async function fetchArticleDetail(item: ArticleListItem): Promise<ScrapedArticle> {
  const response = await fetch(item.url, {
    headers: { 'User-Agent': 'LineMag/1.0' },
  });
  if (!response.ok) throw new Error(`Article fetch failed: ${response.status} — ${item.url}`);

  const html = await response.text();
  const $ = cheerio.load(html);

  const articleEl = $('article').first();
  const contentRoot = articleEl.length ? articleEl : $('main').first();
  const bodyClone = contentRoot.clone();
  bodyClone.find('nav, footer, header, script, style, [class*="related"], [class*="share"]').remove();

  const bodyText = bodyClone
    .find('p, h2, h3, li')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 0)
    .join('\n');

  const dateMatch = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const publishedAt = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : null;

  let thumbnailUrl = item.thumbnailUrl;
  if (!thumbnailUrl) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      thumbnailUrl = ogImage.startsWith('http') ? ogImage : `https://meetsc.co.jp${ogImage}`;
    }
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

export async function scrapeLatestArticles(): Promise<ScrapedArticle[]> {
  const list = await fetchArticleList();
  const articles: ScrapedArticle[] = [];
  for (const item of list) {
    try {
      articles.push(await fetchArticleDetail(item));
    } catch (err) {
      console.warn(`[scraper] Failed to fetch ${item.url}:`, err);
    }
  }
  return articles;
}
