// ============================================================================
// src/types/line.ts
// LINE配信システム型定義
// ============================================================================

export type TemplateId =
  | 'daily-column'
  | 'news-card'
  | 'visual-magazine'
  | 'minimal-text'
  | 'premium-card';

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  category: string;
  previewColor: string;
  recommendedFor: string;
}

export interface ScrapedArticle {
  url: string;
  title: string;
  body: string;
  thumbnailUrl: string | null;
  category: string | null;
  publishedAt: string | null;
}

export interface SummaryResult {
  catchyTitle: string;
  summaryText: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface BroadcastRequest {
  articleUrl: string;
  articleTitle: string;
  summaryTitle: string;
  summaryText: string;
  thumbnailUrl: string | null;
  templateId: TemplateId;
  articleCategory?: string;
}

export interface BroadcastResult {
  success: boolean;
  sentAt: string;
  error?: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  times: string[];
  templateId: TemplateId;
  maxArticlesPerRun: number;
}

// ─── Flex Message ────────────────────────────────────────────────────────────

export interface FlexContainer {
  type: 'bubble';
  size?: string;
  header?: FlexBox;
  hero?: FlexImage;
  body?: FlexBox;
  footer?: FlexBox;
  styles?: Record<string, unknown>;
}

export interface FlexBox {
  type: 'box';
  layout: 'horizontal' | 'vertical' | 'baseline';
  contents: FlexComponent[];
  [key: string]: unknown;
}

export interface FlexText {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

export interface FlexImage {
  type: 'image';
  url: string;
  [key: string]: unknown;
}

export interface FlexButton {
  type: 'button';
  action: FlexAction;
  [key: string]: unknown;
}

export interface FlexSeparator {
  type: 'separator';
  [key: string]: unknown;
}

export interface FlexFiller {
  type: 'filler';
  [key: string]: unknown;
}

export type FlexComponent =
  | FlexBox
  | FlexText
  | FlexImage
  | FlexButton
  | FlexSeparator
  | FlexFiller;

export interface FlexAction {
  type: 'uri' | 'message' | 'postback';
  label?: string;
  uri?: string;
  text?: string;
}

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: FlexContainer };
