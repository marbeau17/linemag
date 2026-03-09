'use client';

import { useMemo } from 'react';
import type { TemplateId } from '@/types/line';

// ============================================================================
// FlexPreview — LINE Flex Message のビジュアルプレビュー
// 各テンプレートの実際の表示をスマホ風フレーム内でシミュレーション
// ============================================================================

interface FlexPreviewProps {
  templateId: TemplateId;
  summaryTitle: string;
  summaryText: string;
  thumbnailUrl: string | null;
  articleUrl: string;
  articleCategory?: string;
}

export default function FlexPreview({
  templateId,
  summaryTitle,
  summaryText,
  thumbnailUrl,
  articleUrl,
  articleCategory,
}: FlexPreviewProps) {
  const dateStr = useMemo(() => {
    const n = new Date();
    const d = ['日', '月', '火', '水', '木', '金', '土'];
    return `${n.getMonth() + 1}/${n.getDate()}（${d[n.getDay()]}）`;
  }, []);

  const title = summaryTitle || 'タイトル未設定';
  const text = summaryText || '要約テキストがここに表示されます。';
  const category = articleCategory || 'EC戦略';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* スマホフレーム */}
      <div className="w-full max-w-[320px] rounded-2xl bg-[#7494A5] p-4 shadow-xl">
        {/* ステータスバー風 */}
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white/40" />
            <span className="text-[10px] font-medium text-white/70">LINE</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-sm bg-white/30" />
            <div className="h-1.5 w-3 rounded-sm bg-white/40" />
            <div className="h-1.5 w-3 rounded-sm bg-white/50" />
          </div>
        </div>

        {/* チャットバブル */}
        <div className="ml-auto max-w-[280px]">
          {templateId === 'daily-column' && (
            <DailyColumnPreview
              title={title}
              text={text}
              thumbnailUrl={thumbnailUrl}
              category={category}
              dateStr={dateStr}
            />
          )}
          {templateId === 'news-card' && (
            <NewsCardPreview
              title={title}
              text={text}
              thumbnailUrl={thumbnailUrl}
              category={category}
              dateStr={dateStr}
            />
          )}
          {templateId === 'visual-magazine' && (
            <VisualMagazinePreview
              title={title}
              text={text}
              thumbnailUrl={thumbnailUrl}
              dateStr={dateStr}
            />
          )}
          {templateId === 'minimal-text' && (
            <MinimalTextPreview
              title={title}
              text={text}
              dateStr={dateStr}
              articleUrl={articleUrl}
            />
          )}
          {templateId === 'premium-card' && (
            <PremiumCardPreview
              title={title}
              text={text}
              thumbnailUrl={thumbnailUrl}
              category={category}
              dateStr={dateStr}
            />
          )}
        </div>

        {/* 入力バー風 */}
        <div className="mt-3 flex items-center gap-2 rounded-full bg-white/20 px-3 py-2">
          <div className="h-4 w-4 rounded-full bg-white/30" />
          <div className="h-3 flex-1 rounded bg-white/10" />
          <div className="h-4 w-4 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  );
}

// ─── 共通パーツ ─────────────────────────────────────────────────────────────

function ImagePlaceholder({ aspectClass = 'aspect-[20/13]' }: { aspectClass?: string }) {
  return (
    <div className={`w-full ${aspectClass} bg-gradient-to-br from-slate-300 to-slate-200 flex items-center justify-center`}>
      <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    </div>
  );
}

function ThumbnailImage({
  url,
  aspectClass = 'aspect-[20/13]',
  className = '',
}: {
  url: string | null;
  aspectClass?: string;
  className?: string;
}) {
  if (!url) return <ImagePlaceholder aspectClass={aspectClass} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="記事サムネイル"
      className={`w-full object-cover ${aspectClass} ${className}`}
    />
  );
}

// ─── 1. デイリーコラム ───────────────────────────────────────────────────────

function DailyColumnPreview({
  title,
  text,
  thumbnailUrl,
  category,
  dateStr,
}: {
  title: string;
  text: string;
  thumbnailUrl: string | null;
  category: string;
  dateStr: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#1B4965' }}>
        <div>
          <p className="text-[10px] font-bold" style={{ color: '#AAAAEE' }}>
            Today&apos;s Column
          </p>
          <p className="text-xs font-bold text-white">{dateStr}</p>
        </div>
        <span
          className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold"
          style={{ color: '#1B4965' }}
        >
          {category}
        </span>
      </div>

      {/* Hero image */}
      <ThumbnailImage url={thumbnailUrl} aspectClass="aspect-[20/13]" />

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-sm font-bold leading-snug" style={{ color: '#1A1A2E' }}>
          {title}
        </p>
        <div className="my-2.5 h-px bg-[#E8E8E8]" />
        <p className="text-xs leading-relaxed" style={{ color: '#555555' }}>
          {text}
        </p>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div
          className="flex items-center justify-center rounded-md py-2 text-xs font-bold text-white"
          style={{ backgroundColor: '#1B4965' }}
        >
          記事を読む
        </div>
      </div>
    </div>
  );
}

// ─── 2. ニュースカード ───────────────────────────────────────────────────────

function NewsCardPreview({
  title,
  text,
  thumbnailUrl,
  category,
  dateStr,
}: {
  title: string;
  text: string;
  thumbnailUrl: string | null;
  category: string;
  dateStr: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Body */}
      <div className="px-4 py-3">
        {/* Category + Date row */}
        <div className="flex items-center justify-between">
          <span
            className="rounded-sm px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: '#2D6A4F' }}
          >
            {category}
          </span>
          <span className="text-[10px] text-[#999999]">{dateStr}</span>
        </div>

        {/* Horizontal: image left, title right */}
        <div className="mt-3 flex gap-3">
          <div className="w-[72px] flex-shrink-0">
            <ThumbnailImage url={thumbnailUrl} aspectClass="aspect-square" className="rounded-md" />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="line-clamp-3 text-sm font-bold leading-snug"
              style={{ color: '#1A1A2E' }}
            >
              {title}
            </p>
          </div>
        </div>

        <div className="my-2.5 h-px bg-[#EEEEEE]" />
        <p className="text-xs leading-relaxed" style={{ color: '#555555' }}>
          {text}
        </p>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2.5">
        <p className="text-center text-xs font-bold" style={{ color: '#2D6A4F' }}>
          続きを読む &rarr;
        </p>
      </div>
    </div>
  );
}

// ─── 3. ビジュアルマガジン ───────────────────────────────────────────────────

function VisualMagazinePreview({
  title,
  text,
  thumbnailUrl,
  dateStr,
}: {
  title: string;
  text: string;
  thumbnailUrl: string | null;
  dateStr: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Hero image (16:9) */}
      <ThumbnailImage url={thumbnailUrl} aspectClass="aspect-video" />

      {/* Body */}
      <div className="px-4 py-3">
        {/* Badge row */}
        <div className="flex items-center justify-between">
          <span
            className="rounded-sm px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: '#6B2FA0' }}
          >
            FEATURE
          </span>
          <span className="text-[10px] text-[#999999]">{dateStr}</span>
        </div>

        {/* Title (xl equivalent) */}
        <p
          className="mt-2.5 text-base font-bold leading-snug"
          style={{ color: '#1A1A2E' }}
        >
          {title}
        </p>

        {/* Accent lines */}
        <div className="mt-2.5 flex gap-0">
          <div className="h-[3px] flex-[2]" style={{ backgroundColor: '#6B2FA0' }} />
          <div className="h-[3px] flex-[1]" style={{ backgroundColor: '#9B59B6' }} />
          <div className="h-[3px] flex-[1]" style={{ backgroundColor: '#D5A6E6' }} />
        </div>

        <p className="mt-2.5 text-xs leading-relaxed" style={{ color: '#555555' }}>
          {text}
        </p>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div
          className="flex items-center justify-center rounded-md py-2 text-xs font-bold text-white"
          style={{ backgroundColor: '#6B2FA0' }}
        >
          特集記事を読む
        </div>
      </div>
    </div>
  );
}

// ─── 4. ミニマルテキスト ─────────────────────────────────────────────────────

function MinimalTextPreview({
  title,
  text,
  dateStr,
  articleUrl,
}: {
  title: string;
  text: string;
  dateStr: string;
  articleUrl: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="px-4 py-4">
        {/* Top accent bar */}
        <div className="h-1 w-full rounded-sm" style={{ backgroundColor: '#374151' }} />

        <p className="mt-3 text-[11px]" style={{ color: '#999999' }}>
          {dateStr}
        </p>

        <p className="mt-1.5 text-sm font-bold leading-snug" style={{ color: '#1F2937' }}>
          {title}
        </p>

        <p className="mt-3 text-xs leading-relaxed" style={{ color: '#6B7280' }}>
          {text}
        </p>

        {/* Text link (right-aligned) */}
        <div className="mt-4 flex justify-end">
          <a
            href={articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold underline"
            style={{ color: '#374151' }}
          >
            記事を読む &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── 5. プレミアムカード ─────────────────────────────────────────────────────

function PremiumCardPreview({
  title,
  text,
  thumbnailUrl,
  category,
  dateStr,
}: {
  title: string;
  text: string;
  thumbnailUrl: string | null;
  category: string;
  dateStr: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Dark header */}
      <div
        className="flex items-center justify-center gap-1 px-4 py-3"
        style={{ backgroundColor: '#1A1A2E' }}
      >
        <span className="text-xs" style={{ color: '#D4A843' }}>&#9670;</span>
        <span className="text-[11px] font-bold" style={{ color: '#D4A843' }}>
          PREMIUM COLUMN
        </span>
        <span className="text-xs" style={{ color: '#D4A843' }}>&#9670;</span>
      </div>

      {/* Hero image (optional) */}
      {thumbnailUrl && (
        <ThumbnailImage url={thumbnailUrl} aspectClass="aspect-[20/13]" />
      )}

      {/* Body */}
      <div className="px-4 py-3">
        {/* Category + Date */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold" style={{ color: '#92400E' }}>
            {category}
          </span>
          <span className="text-[10px] text-[#999999]">{dateStr}</span>
        </div>

        {/* Gold divider */}
        <div className="mt-2 h-[2px]" style={{ backgroundColor: '#D4A843' }} />

        <p
          className="mt-2.5 text-sm font-bold leading-snug"
          style={{ color: '#1A1A2E' }}
        >
          {title}
        </p>

        <p className="mt-2.5 text-xs leading-relaxed" style={{ color: '#555555' }}>
          {text}
        </p>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div
          className="flex items-center justify-center rounded-md py-2 text-xs font-bold text-white"
          style={{ backgroundColor: '#1A1A2E' }}
        >
          記事を読む
        </div>
      </div>
    </div>
  );
}
