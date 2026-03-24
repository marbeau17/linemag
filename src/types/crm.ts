// ============================================================================
// src/types/crm.ts
// CRM 型定義
// ============================================================================

// ─── 顧客 ────────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  email: string | null;
  phone: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birthDate: string | null;
  prefecture: string | null;
  membershipTier: 'free' | 'silver' | 'gold' | 'platinum';
  messageCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  blockedAt: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListParams {
  page?: number;
  perPage?: number;
  search?: string;
  tier?: string;
  prefecture?: string;
  tags?: string[];
  sortBy?: 'last_seen_at' | 'created_at' | 'display_name' | 'message_count';
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerListResult {
  customers: Customer[];
  total: number;
  page: number;
  perPage: number;
}

// ─── タグ ────────────────────────────────────────────────────────────────────

export interface CustomerTag {
  id: string;
  customerId: string;
  tag: string;
  createdAt: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

// ─── 行動履歴 ────────────────────────────────────────────────────────────────

export type ActionType =
  | 'message_received'
  | 'link_tap'
  | 'purchase'
  | 'follow'
  | 'unfollow'
  | 'coupon_use'
  | 'reservation'
  | 'page_view';

export interface CustomerAction {
  id: string;
  customerId: string;
  actionType: ActionType;
  actionDetail: Record<string, unknown>;
  source: string | null;
  actedAt: string;
}

export interface TrackActionInput {
  customerId: string;
  actionType: ActionType;
  actionDetail?: Record<string, unknown>;
  source?: string;
}

// ─── セグメント ──────────────────────────────────────────────────────────────

export interface SegmentRule {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value: unknown;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  type: 'static' | 'dynamic';
  rules: SegmentRule[];
  autoRefresh: boolean;
  lastComputedAt: string | null;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSegmentInput {
  name: string;
  description?: string;
  type: 'static' | 'dynamic';
  rules?: SegmentRule[];
  autoRefresh?: boolean;
}

// ─── CRM統計 ─────────────────────────────────────────────────────────────────

export interface CRMStats {
  totalCustomers: number;
  newCustomersThisMonth: number;
  activeCustomers: number;
  segmentCount: number;
  tierBreakdown: Record<string, number>;
  topTags: TagCount[];
}

// ─── アクションタイプ日本語ラベル ─────────────────────────────────────────────

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  message_received: 'メッセージ受信',
  link_tap: 'リンクタップ',
  purchase: '購入',
  follow: '友だち追加',
  unfollow: 'ブロック',
  coupon_use: 'クーポン利用',
  reservation: '予約',
  page_view: 'ページ閲覧',
};

// ─── 会員ランク日本語ラベル ──────────────────────────────────────────────────

export const TIER_LABELS: Record<string, string> = {
  free: 'フリー',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
};

export const TIER_COLORS: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700',
  silver: 'bg-gray-100 text-gray-700',
  gold: 'bg-amber-100 text-amber-700',
  platinum: 'bg-purple-100 text-purple-700',
};
