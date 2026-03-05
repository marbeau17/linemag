// ============================================================================
// src/lib/line/templates.ts
// LINE Flex Message テンプレート — 5種類のマガジンデザイン
// ============================================================================

import type {
  TemplateDefinition,
  BroadcastRequest,
  FlexContainer,
  FlexComponent,
} from '@/types/line';

// ─── テンプレート一覧 ────────────────────────────────────────────────────────

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'daily-column',
    name: 'デイリーコラム',
    description: '毎日のマガジン風コラムスタイル。ヘッダーに日付バッジ、大きなサムネイル画像、読みやすい要約文。',
    category: 'マガジン',
    previewColor: '#1B4965',
    recommendedFor: '日常配信・定期コラム',
  },
  {
    id: 'news-card',
    name: 'ニュースカード',
    description: 'コンパクトなニュースカード形式。左にサムネイル、右にタイトルと要約。',
    category: 'ニュース',
    previewColor: '#2D6A4F',
    recommendedFor: '速報・短い記事',
  },
  {
    id: 'visual-magazine',
    name: 'ビジュアルマガジン',
    description: '全幅ヒーロー画像で視覚的インパクト重視。雑誌の表紙のようなリッチなデザイン。',
    category: 'ビジュアル',
    previewColor: '#6B2FA0',
    recommendedFor: '特集記事・ビジュアル重視',
  },
  {
    id: 'minimal-text',
    name: 'ミニマルテキスト',
    description: 'シンプルで軽量なテキスト中心デザイン。通信量が少なく、テキスト重視の読者向け。',
    category: 'シンプル',
    previewColor: '#374151',
    recommendedFor: 'テキスト中心・軽量配信',
  },
  {
    id: 'premium-card',
    name: 'プレミアムカード',
    description: 'ゴールドアクセントのプレミアム感あるデザイン。ブランディング強化に最適。',
    category: 'プレミアム',
    previewColor: '#92400E',
    recommendedFor: '重要告知・特別な記事',
  },
];

// ─── ビルダー ─────────────────────────────────────────────────────────────────

export function buildFlexMessage(req: BroadcastRequest): FlexContainer {
  switch (req.templateId) {
    case 'daily-column':    return buildDailyColumn(req);
    case 'news-card':       return buildNewsCard(req);
    case 'visual-magazine': return buildVisualMagazine(req);
    case 'minimal-text':    return buildMinimalText(req);
    case 'premium-card':    return buildPremiumCard(req);
    default:                return buildDailyColumn(req);
  }
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

const FALLBACK_IMG = 'https://placehold.co/800x520/1B4965/white?text=LineMag';

function img(url: string | null): string {
  if (!url) return FALLBACK_IMG;
  return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
}

function today(): string {
  const n = new Date();
  const d = ['日','月','火','水','木','金','土'];
  return `${n.getMonth()+1}/${n.getDate()}（${d[n.getDay()]}）`;
}

// ============================================================================
// 1. デイリーコラム
// ============================================================================

function buildDailyColumn(req: BroadcastRequest): FlexContainer {
  return {
    type: 'bubble', size: 'mega',
    header: {
      type: 'box', layout: 'horizontal',
      contents: [
        { type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: "Today's Column", size: 'xs', color: '#AAAAEE', weight: 'bold' },
          { type: 'text', text: today(), size: 'sm', color: '#FFFFFF', weight: 'bold' },
        ]},
        { type: 'filler' } as FlexComponent,
        { type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: req.articleCategory || 'EC戦略', size: 'xxs', color: '#1B4965', weight: 'bold', align: 'center' },
        ], backgroundColor: '#FFFFFF', cornerRadius: 'md', paddingAll: 'xs', paddingStart: 'md', paddingEnd: 'md' },
      ],
      paddingAll: 'lg', backgroundColor: '#1B4965',
    },
    hero: {
      type: 'image', url: img(req.thumbnailUrl), size: 'full',
      aspectRatio: '20:13', aspectMode: 'cover',
      action: { type: 'uri', label: '記事を読む', uri: req.articleUrl },
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: 'xl',
      contents: [
        { type: 'text', text: req.summaryTitle, weight: 'bold', size: 'lg', color: '#1A1A2E', wrap: true },
        { type: 'separator', color: '#E8E8E8', margin: 'lg' },
        { type: 'text', text: req.summaryText, size: 'sm', color: '#555555', wrap: true, margin: 'lg' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: 'lg',
      contents: [
        { type: 'button', action: { type: 'uri', label: '記事を読む', uri: req.articleUrl }, style: 'primary', color: '#1B4965', height: 'sm' },
      ],
    },
    styles: { footer: { separator: true } },
  };
}

// ============================================================================
// 2. ニュースカード
// ============================================================================

function buildNewsCard(req: BroadcastRequest): FlexContainer {
  return {
    type: 'bubble', size: 'mega',
    body: {
      type: 'box', layout: 'vertical', paddingAll: 'xl',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'box', layout: 'vertical', contents: [
            { type: 'text', text: req.articleCategory || 'NEWS', size: 'xxs', color: '#FFFFFF', weight: 'bold', align: 'center' },
          ], backgroundColor: '#2D6A4F', cornerRadius: 'sm', paddingAll: 'xs', paddingStart: 'sm', paddingEnd: 'sm' },
          { type: 'filler' } as FlexComponent,
          { type: 'text', text: today(), size: 'xxs', color: '#999999', align: 'end' },
        ]},
        { type: 'box', layout: 'horizontal', margin: 'lg',
          contents: [
            { type: 'image', url: img(req.thumbnailUrl), size: 'full', aspectRatio: '1:1', aspectMode: 'cover', flex: 2 } as FlexComponent,
            { type: 'box', layout: 'vertical', flex: 3, paddingStart: 'lg',
              contents: [
                { type: 'text', text: req.summaryTitle, weight: 'bold', size: 'md', color: '#1A1A2E', wrap: true, maxLines: 3 },
              ],
            },
          ],
        },
        { type: 'separator', color: '#EEEEEE', margin: 'lg' },
        { type: 'text', text: req.summaryText, size: 'sm', color: '#555555', wrap: true, margin: 'lg' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: 'md',
      contents: [
        { type: 'button', action: { type: 'uri', label: '続きを読む →', uri: req.articleUrl }, style: 'link', color: '#2D6A4F', height: 'sm' },
      ],
    },
    styles: { footer: { separator: true } },
  };
}

// ============================================================================
// 3. ビジュアルマガジン
// ============================================================================

function buildVisualMagazine(req: BroadcastRequest): FlexContainer {
  return {
    type: 'bubble', size: 'mega',
    hero: {
      type: 'image', url: img(req.thumbnailUrl), size: 'full',
      aspectRatio: '16:9', aspectMode: 'cover',
      action: { type: 'uri', label: '記事を読む', uri: req.articleUrl },
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: 'xl',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'box', layout: 'vertical', contents: [
            { type: 'text', text: 'FEATURE', size: 'xxs', color: '#FFFFFF', weight: 'bold', align: 'center' },
          ], backgroundColor: '#6B2FA0', cornerRadius: 'sm', paddingAll: 'xs', paddingStart: 'md', paddingEnd: 'md' },
          { type: 'filler' } as FlexComponent,
          { type: 'text', text: today(), size: 'xxs', color: '#999999' },
        ]},
        { type: 'text', text: req.summaryTitle, weight: 'bold', size: 'xl', color: '#1A1A2E', wrap: true, margin: 'lg' },
        { type: 'box', layout: 'horizontal', margin: 'lg',
          contents: [
            { type: 'box', layout: 'vertical', contents: [{ type: 'filler' }], backgroundColor: '#6B2FA0', height: '3px', flex: 2 },
            { type: 'box', layout: 'vertical', contents: [{ type: 'filler' }], backgroundColor: '#9B59B6', height: '3px', flex: 1 },
            { type: 'box', layout: 'vertical', contents: [{ type: 'filler' }], backgroundColor: '#D5A6E6', height: '3px', flex: 1 },
          ],
        },
        { type: 'text', text: req.summaryText, size: 'sm', color: '#555555', wrap: true, margin: 'lg' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: 'lg',
      contents: [
        { type: 'button', action: { type: 'uri', label: '特集記事を読む', uri: req.articleUrl }, style: 'primary', color: '#6B2FA0', height: 'sm' },
      ],
    },
    styles: { footer: { separator: true } },
  };
}

// ============================================================================
// 4. ミニマルテキスト
// ============================================================================

function buildMinimalText(req: BroadcastRequest): FlexContainer {
  return {
    type: 'bubble', size: 'mega',
    body: {
      type: 'box', layout: 'vertical', paddingAll: 'xl',
      contents: [
        { type: 'box', layout: 'vertical', contents: [{ type: 'filler' }], backgroundColor: '#374151', height: '4px', cornerRadius: 'sm' },
        { type: 'text', text: today(), size: 'xs', color: '#999999', margin: 'lg' },
        { type: 'text', text: req.summaryTitle, weight: 'bold', size: 'lg', color: '#1F2937', wrap: true, margin: 'md' },
        { type: 'text', text: req.summaryText, size: 'sm', color: '#6B7280', wrap: true, margin: 'lg' },
        { type: 'box', layout: 'horizontal', margin: 'xl',
          contents: [
            { type: 'filler' } as FlexComponent,
            { type: 'text', text: '記事を読む →', size: 'sm', color: '#374151', weight: 'bold', decoration: 'underline',
              action: { type: 'uri', label: '読む', uri: req.articleUrl } },
          ],
        },
      ],
    },
  };
}

// ============================================================================
// 5. プレミアムカード
// ============================================================================

function buildPremiumCard(req: BroadcastRequest): FlexContainer {
  return {
    type: 'bubble', size: 'mega',
    header: {
      type: 'box', layout: 'vertical', paddingAll: 'lg', backgroundColor: '#1A1A2E',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '◆', size: 'sm', color: '#D4A843' },
          { type: 'text', text: ' PREMIUM COLUMN ', size: 'xs', color: '#D4A843', weight: 'bold', margin: 'xs' },
          { type: 'text', text: '◆', size: 'sm', color: '#D4A843' },
        ]},
      ],
    },
    hero: req.thumbnailUrl ? {
      type: 'image', url: img(req.thumbnailUrl), size: 'full',
      aspectRatio: '20:13', aspectMode: 'cover',
      action: { type: 'uri', label: '読む', uri: req.articleUrl },
    } : undefined,
    body: {
      type: 'box', layout: 'vertical', paddingAll: 'xl',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: req.articleCategory || 'SPECIAL', size: 'xxs', color: '#92400E', weight: 'bold' },
          { type: 'filler' } as FlexComponent,
          { type: 'text', text: today(), size: 'xxs', color: '#999999' },
        ]},
        { type: 'box', layout: 'vertical', contents: [{ type: 'filler' }], backgroundColor: '#D4A843', height: '2px', margin: 'md' },
        { type: 'text', text: req.summaryTitle, weight: 'bold', size: 'lg', color: '#1A1A2E', wrap: true, margin: 'lg' },
        { type: 'text', text: req.summaryText, size: 'sm', color: '#555555', wrap: true, margin: 'lg' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: 'lg',
      contents: [
        { type: 'button', action: { type: 'uri', label: '記事を読む', uri: req.articleUrl }, style: 'primary', color: '#1A1A2E', height: 'sm' },
      ],
    },
    styles: { footer: { separator: true } },
  };
}
