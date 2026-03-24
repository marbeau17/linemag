// MA シナリオ
export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  triggerType: 'event' | 'schedule' | 'manual';
  triggerConfig: TriggerConfig;
  steps: ScenarioStep[];
  isActive: boolean;
  targetSegmentId: string | null;
  stats: { sent: number; opened: number; clicked: number };
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerConfig {
  eventType?: string;
  schedule?: string;
  delay?: number;
}

export interface ScenarioStep {
  type: 'wait' | 'message' | 'condition' | 'coupon' | 'tag';
  config: Record<string, unknown>;
}

// A/Bテスト
export interface ABTest {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  testType: 'template' | 'content' | 'timing' | 'segment';
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  targetSegmentId: string | null;
  sampleSize: number;
  metric: string;
  results: Record<string, unknown>;
  winner: 'A' | 'B' | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ラベル定数
export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  event: 'イベントトリガー',
  schedule: 'スケジュール',
  manual: '手動実行',
};

export const STEP_TYPE_LABELS: Record<string, string> = {
  wait: '待機',
  message: 'メッセージ送信',
  condition: '条件分岐',
  coupon: 'クーポン配布',
  tag: 'タグ付与',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  follow: '友だち追加',
  purchase: '商品購入',
  reservation: '予約完了',
  birthday: '誕生日',
  cart_abandon: 'カート放棄',
  inactive_30d: '30日間未活動',
};

export const AB_TEST_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  running: '実行中',
  completed: '完了',
  cancelled: '中止',
};

export const AB_TEST_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

export const AB_TEST_TYPE_LABELS: Record<string, string> = {
  template: 'テンプレート比較',
  content: 'コンテンツ比較',
  timing: '配信タイミング',
  segment: 'セグメント比較',
};
