# 20. 分析・レポーティング仕様書

## 1. 概要

LineMag プラットフォームにおける分析・レポーティング機能の設計仕様を定める。LINE配信、顧客、クーポン、予約、EC購買の各ドメインデータを横断的に集計・可視化し、事業判断を支援するダッシュボードおよびレポート機能を提供する。

### 1.1 対象ユーザー

| ロール | 主な利用シーン |
|--------|---------------|
| 運用担当者 | 日次の配信効果確認、クーポン利用状況の把握 |
| マーケティング責任者 | 週次・月次のKPIレビュー、施策効果の分析 |
| 経営層 | 月次サマリー、LTV推移、売上全体の俯瞰 |
| 店舗スタッフ | 予約状況の確認、稼働率のモニタリング |

### 1.2 技術スタック

- **DB**: Supabase (PostgreSQL 15+)
- **フロントエンド**: Next.js (App Router) + React
- **チャートライブラリ**: Recharts (後述)
- **エクスポート**: サーバーサイドCSV生成 + ブラウザPDF生成
- **リアルタイム**: Supabase Realtime (Postgres Changes)

---

## 2. 分析ダッシュボード設計

### 2.1 画面構成

```
/dashboard/analytics            ... メインダッシュボード
/dashboard/analytics/delivery   ... 配信分析
/dashboard/analytics/customers  ... 顧客分析
/dashboard/analytics/coupons    ... クーポン分析
/dashboard/analytics/bookings   ... 予約分析
/dashboard/analytics/ec         ... EC購買分析
/dashboard/analytics/reports    ... レポート生成・一覧
```

### 2.2 メインダッシュボード (`/dashboard/analytics`)

全ドメインの主要KPIを一画面に集約するサマリービュー。

```
┌──────────────────────────────────────────────────────────────┐
│  期間セレクター: [今日] [7日] [30日] [カスタム __|__|]        │
├──────────────────────────────────────────────────────────────┤
│  KPIカード (上段 4枚)                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 配信数    │ │ 開封率   │ │ 売上合計  │ │ 予約数    │       │
│  │ 1,234     │ │ 68.2%    │ │ ¥2.4M    │ │ 89件      │       │
│  │ ▲ +12%   │ │ ▼ -2.1% │ │ ▲ +8%   │ │ ▲ +15%  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├──────────────────────────────────────────────────────────────┤
│  中段: 2カラムレイアウト                                      │
│  ┌──────────────────────┐ ┌──────────────────────┐          │
│  │ 配信効果推移          │ │ 売上推移              │          │
│  │ (折れ線: 開封率/CTR) │ │ (棒+折れ線: 売上/件数)│          │
│  └──────────────────────┘ └──────────────────────┘          │
├──────────────────────────────────────────────────────────────┤
│  下段: 3カラムレイアウト                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 顧客セグメント│ │ クーポン利用率│ │ 予約稼働率    │        │
│  │ (ドーナツ)    │ │ (横棒)       │ │ (ヒートマップ)│        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 KPIカード仕様

各KPIカードは以下の情報を表示する。

| 要素 | 説明 |
|------|------|
| ラベル | KPI名称 |
| 現在値 | 選択期間内の集計値 |
| 前期比 | 前期間との比較（%変化） |
| トレンド矢印 | 上昇/下降/横ばいのインジケーター |
| スパークライン | 直近7データポイントの小さな折れ線 |

前期比の算出ルール:
- 「今日」選択時 → 前日比
- 「7日」選択時 → 前7日間比
- 「30日」選択時 → 前30日間比
- 「カスタム」選択時 → 同日数分の直前期間比

---

## 3. レポート種類

### 3.1 定型レポート

| レポート種別 | 生成タイミング | 保持期間 | 主な内容 |
|-------------|--------------|---------|---------|
| 日次レポート | 毎日 03:00 JST (バッチ) | 90日 | 前日の配信数、開封率、CTR、売上、予約数 |
| 週次レポート | 毎週月曜 04:00 JST | 1年 | 週間KPI推移、セグメント別配信効果、クーポンROI |
| 月次レポート | 毎月1日 05:00 JST | 無期限 | 月間総括、LTV推移、チャーン率、予約稼働率、EC売上分析 |

### 3.2 カスタムレポート

ユーザーが任意の期間・指標・セグメントを選択して生成するアドホックレポート。

```typescript
interface CustomReportRequest {
  dateRange: {
    start: string;  // ISO 8601 (YYYY-MM-DD)
    end: string;
  };
  metrics: MetricId[];          // 選択するKPI群
  dimensions: DimensionId[];    // 分析軸（セグメント、テンプレート種別等）
  filters?: FilterCondition[];  // 絞り込み条件
  format: 'dashboard' | 'csv' | 'pdf';
}

type MetricId =
  | 'delivery_count' | 'open_rate' | 'ctr' | 'cvr'
  | 'new_customers' | 'active_customers' | 'churn_rate' | 'ltv'
  | 'coupon_usage_rate' | 'coupon_roi' | 'avg_discount'
  | 'booking_count' | 'cancel_rate' | 'occupancy_rate'
  | 'ec_revenue' | 'ec_orders' | 'ec_avg_order_value';

type DimensionId =
  | 'date' | 'week' | 'month'
  | 'segment' | 'template_id' | 'coupon_type'
  | 'product_category' | 'booking_type';
```

### 3.3 レポート保存・共有

- 生成済みレポートは `analytics_reports` テーブルに保存
- URLで共有可能（認証付きパーマリンク）
- お気に入り登録によるクイックアクセス

---

## 4. 主要KPI定義と計算式

### 4.1 配信効果指標

| KPI | 定義 | 計算式 | 目標水準 |
|-----|------|--------|---------|
| 配信数 | 期間内の配信メッセージ総数 | `COUNT(*)` from `broadcast_logs` | - |
| 到達率 | 配信成功の割合 | `SUM(delivered) / SUM(sent) * 100` | >= 98% |
| 開封率 | 到達メッセージのうち開封された割合 | `SUM(opened) / SUM(delivered) * 100` | >= 60% |
| CTR (クリック率) | 開封メッセージのうちリンクがクリックされた割合 | `SUM(clicked) / SUM(opened) * 100` | >= 15% |
| CVR (コンバージョン率) | クリックから購買/予約に至った割合 | `SUM(converted) / SUM(clicked) * 100` | >= 5% |
| テンプレート別効果 | テンプレートID別の開封率・CTR | GROUP BY `template_id` | - |

```sql
-- 日別配信効果サマリー
SELECT
  DATE(sent_at)              AS date,
  template_id,
  COUNT(*)                   AS sent_count,
  SUM(CASE WHEN delivered THEN 1 ELSE 0 END) AS delivered_count,
  SUM(CASE WHEN opened THEN 1 ELSE 0 END)    AS opened_count,
  SUM(CASE WHEN clicked THEN 1 ELSE 0 END)   AS clicked_count,
  SUM(CASE WHEN converted THEN 1 ELSE 0 END) AS converted_count,
  ROUND(SUM(CASE WHEN opened THEN 1 ELSE 0 END)::numeric
    / NULLIF(SUM(CASE WHEN delivered THEN 1 ELSE 0 END), 0) * 100, 2)
    AS open_rate,
  ROUND(SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::numeric
    / NULLIF(SUM(CASE WHEN opened THEN 1 ELSE 0 END), 0) * 100, 2)
    AS ctr
FROM broadcast_logs
WHERE sent_at >= :start_date AND sent_at < :end_date
GROUP BY DATE(sent_at), template_id
ORDER BY date DESC;
```

### 4.2 顧客指標

| KPI | 定義 | 計算式 | 目標水準 |
|-----|------|--------|---------|
| 新規顧客数 | 期間内に初めてLINE友だち追加した数 | `COUNT(*) WHERE followed_at BETWEEN :start AND :end` | - |
| アクティブ顧客数 | 期間内に何らかのアクション（開封/クリック/購買/予約）をした顧客数 | `COUNT(DISTINCT user_id)` from action logs | - |
| アクティブ率 | 全友だちのうちアクティブの割合 | `active_customers / total_followers * 100` | >= 40% |
| チャーン率 (月次) | 前月アクティブのうち今月非アクティブの割合 | `(prev_active - current_active) / prev_active * 100` ※復帰顧客除外 | <= 5% |
| LTV (顧客生涯価値) | 顧客1人あたりの平均累計売上 | `SUM(revenue) / COUNT(DISTINCT customer_id)` | - |
| リピート率 | 2回以上購買した顧客の割合 | `COUNT(repeat_buyers) / COUNT(all_buyers) * 100` | >= 30% |

```sql
-- 月次チャーン率計算
WITH prev_month AS (
  SELECT DISTINCT user_id
  FROM user_actions
  WHERE action_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND action_at <  DATE_TRUNC('month', CURRENT_DATE)
),
curr_month AS (
  SELECT DISTINCT user_id
  FROM user_actions
  WHERE action_at >= DATE_TRUNC('month', CURRENT_DATE)
    AND action_at <  DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')
)
SELECT
  (SELECT COUNT(*) FROM prev_month) AS prev_active,
  (SELECT COUNT(*) FROM prev_month WHERE user_id NOT IN (SELECT user_id FROM curr_month))
    AS churned,
  ROUND(
    (SELECT COUNT(*) FROM prev_month WHERE user_id NOT IN (SELECT user_id FROM curr_month))::numeric
    / NULLIF((SELECT COUNT(*) FROM prev_month), 0) * 100, 2
  ) AS churn_rate;
```

### 4.3 クーポン指標

| KPI | 定義 | 計算式 | 目標水準 |
|-----|------|--------|---------|
| 発行数 | 期間内に発行されたクーポン枚数 | `COUNT(*)` from `coupons_issued` | - |
| 利用率 | 発行クーポンのうち使用された割合 | `SUM(used) / SUM(issued) * 100` | >= 20% |
| クーポンROI | クーポンによる売上増分 / 割引コスト | `(incremental_revenue - discount_cost) / discount_cost * 100` | >= 200% |
| 平均割引額 | 使用されたクーポンの平均割引金額 | `AVG(discount_amount) WHERE used = true` | - |
| 売上貢献額 | クーポン使用注文の売上合計 | `SUM(order_total) WHERE coupon_id IS NOT NULL` | - |
| クーポン別効果 | クーポン種別ごとの利用率・売上貢献 | GROUP BY `coupon_type` | - |

```sql
-- クーポンROI計算
SELECT
  c.coupon_type,
  COUNT(ci.id)                           AS issued_count,
  SUM(CASE WHEN ci.used_at IS NOT NULL THEN 1 ELSE 0 END) AS used_count,
  ROUND(
    SUM(CASE WHEN ci.used_at IS NOT NULL THEN 1 ELSE 0 END)::numeric
    / NULLIF(COUNT(ci.id), 0) * 100, 2
  ) AS usage_rate,
  SUM(ci.discount_amount)               AS total_discount,
  SUM(o.total_amount)                   AS coupon_revenue,
  ROUND(
    (SUM(o.total_amount) - SUM(ci.discount_amount))::numeric
    / NULLIF(SUM(ci.discount_amount), 0) * 100, 2
  ) AS roi_pct
FROM coupons c
JOIN coupon_issues ci ON c.id = ci.coupon_id
LEFT JOIN orders o ON o.coupon_issue_id = ci.id
WHERE ci.issued_at >= :start_date AND ci.issued_at < :end_date
GROUP BY c.coupon_type;
```

### 4.4 予約指標

| KPI | 定義 | 計算式 | 目標水準 |
|-----|------|--------|---------|
| 予約数 | 期間内の予約総数 | `COUNT(*)` from `bookings` | - |
| 予約率 | LINE配信からの予約コンバージョン率 | `SUM(bookings_from_line) / SUM(line_clicked) * 100` | >= 8% |
| キャンセル率 | 予約のうちキャンセルされた割合 | `SUM(cancelled) / SUM(booked) * 100` | <= 10% |
| 稼働率 | 利用可能スロットに対する予約の割合 | `SUM(booked_slots) / SUM(available_slots) * 100` | >= 70% |
| 平均リードタイム | 予約日から来店日までの平均日数 | `AVG(visit_date - booked_at)` | - |
| NPS | 来店後アンケートの推奨度スコア | `(promoters - detractors) / total_responses * 100` | >= 50 |
| ノーショー率 | 予約済みだが来店しなかった割合 | `SUM(no_show) / SUM(confirmed) * 100` | <= 3% |

```sql
-- 日別予約・キャンセル・稼働率
SELECT
  b.booking_date,
  COUNT(*)                                           AS total_bookings,
  SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
  SUM(CASE WHEN b.status = 'no_show'   THEN 1 ELSE 0 END) AS no_show,
  ROUND(
    SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END)::numeric
    / NULLIF(COUNT(*), 0) * 100, 2
  ) AS cancel_rate,
  s.available_slots,
  ROUND(
    SUM(CASE WHEN b.status IN ('confirmed','completed') THEN 1 ELSE 0 END)::numeric
    / NULLIF(s.available_slots, 0) * 100, 2
  ) AS occupancy_rate
FROM bookings b
JOIN slot_availability s ON s.date = b.booking_date
WHERE b.booking_date >= :start_date AND b.booking_date < :end_date
GROUP BY b.booking_date, s.available_slots
ORDER BY b.booking_date DESC;
```

### 4.5 EC購買指標

| KPI | 定義 | 計算式 | 目標水準 |
|-----|------|--------|---------|
| 売上合計 | 期間内の注文合計金額 | `SUM(total_amount)` from `orders` | - |
| 注文件数 | 期間内の注文数 | `COUNT(*)` from `orders` | - |
| 平均注文額 (AOV) | 1注文あたりの平均金額 | `SUM(total_amount) / COUNT(*)` | - |
| 購買頻度 | 顧客1人あたりの期間内平均注文回数 | `COUNT(*) / COUNT(DISTINCT customer_id)` | - |
| 商品別売上 | 商品カテゴリ/SKU別の売上ランキング | GROUP BY `product_id` / `category` | - |
| LINE経由売上比率 | 全売上のうちLINE配信経由の割合 | `SUM(CASE WHEN source='line' ...) / SUM(total) * 100` | >= 25% |
| カート離脱率 | カート作成後に購買完了しなかった割合 | `1 - (completed_orders / cart_created) * 100` | <= 60% |

---

## 5. データ可視化コンポーネント

### 5.1 チャートライブラリ選定

**Recharts** を採用する。

| 評価軸 | Recharts | Chart.js (react-chartjs-2) | Nivo |
|--------|----------|---------------------------|------|
| React親和性 | 宣言的コンポーネント | ラッパー経由 | 宣言的 |
| バンドルサイズ | ~45KB (gzip) | ~60KB | ~80KB |
| カスタマイズ性 | 高 (SVGベース) | 中 (Canvasベース) | 高 |
| レスポンシブ | `<ResponsiveContainer>` 内蔵 | 要設定 | 内蔵 |
| SSR対応 | 良好 | Canvas依存で制限あり | 良好 |
| ドキュメント・コミュニティ | 充実 | 充実 | 中程度 |

**選定理由**: Next.js App Router環境でのSSR互換性、SVGベースによるPDFエクスポートとの相性、React宣言的APIとの自然な統合。

### 5.2 チャートコンポーネント一覧

| コンポーネント | チャート種類 | 用途 | Rechartsコンポーネント |
|--------------|------------|------|----------------------|
| `TrendLineChart` | 折れ線 | KPI時系列推移 (開封率、CTR、売上) | `<LineChart>` |
| `ComparisonBarChart` | 棒グラフ | 期間比較、セグメント比較 | `<BarChart>` |
| `ComboChart` | 棒+折れ線 | 売上(棒) + 件数(線) の複合表示 | `<ComposedChart>` |
| `SegmentDonut` | ドーナツ | 顧客セグメント構成比 | `<PieChart>` |
| `HorizontalBar` | 横棒 | クーポン利用率ランキング、商品売上ランク | `<BarChart layout="vertical">` |
| `OccupancyHeatmap` | ヒートマップ | 予約稼働率 (曜日 x 時間帯) | カスタムSVG + `<Tooltip>` |
| `FunnelChart` | ファネル | 配信→開封→クリック→CVR | `<FunnelChart>` |
| `SparkLine` | ミニ折れ線 | KPIカード内のトレンド表示 | `<LineChart>` (軸なし) |
| `ScatterPlot` | 散布図 | LTV vs 購買頻度の相関分析 | `<ScatterChart>` |

### 5.3 共通仕様

```typescript
// チャート共通Props
interface BaseChartProps {
  data: Record<string, unknown>[];
  dateRange: { start: string; end: string };
  loading?: boolean;
  error?: string | null;
  height?: number;          // デフォルト: 300
  showLegend?: boolean;     // デフォルト: true
  exportable?: boolean;     // デフォルト: true (SVG→PNG保存ボタン表示)
}
```

- 全チャートは `<ResponsiveContainer>` でラップし、親コンテナに追従
- ローディング中はスケルトンプレースホルダーを表示
- データ0件の場合は「データがありません」の空状態UIを表示
- ツールチップは全チャート共通フォーマット（日付、値、前期比）

---

## 6. SQLビュー / マテリアライズドビュー設計

### 6.1 設計方針

- リアルタイム性の必要なKPIは **通常のVIEW** で提供
- 重い集計処理は **MATERIALIZED VIEW** で事前計算し、定期リフレッシュ
- 全ビューに適切なインデックスを付与

### 6.2 ビュー一覧

#### 通常ビュー (リアルタイム参照)

```sql
-- (1) 当日の配信サマリー (軽量なのでVIEWで十分)
CREATE OR REPLACE VIEW v_today_delivery_summary AS
SELECT
  template_id,
  COUNT(*)                                                    AS sent,
  SUM(CASE WHEN delivered THEN 1 ELSE 0 END)                 AS delivered,
  SUM(CASE WHEN opened THEN 1 ELSE 0 END)                    AS opened,
  SUM(CASE WHEN clicked THEN 1 ELSE 0 END)                   AS clicked,
  ROUND(SUM(CASE WHEN opened THEN 1 ELSE 0 END)::numeric
    / NULLIF(SUM(CASE WHEN delivered THEN 1 ELSE 0 END), 0) * 100, 2)
    AS open_rate,
  ROUND(SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::numeric
    / NULLIF(SUM(CASE WHEN opened THEN 1 ELSE 0 END), 0) * 100, 2)
    AS ctr
FROM broadcast_logs
WHERE DATE(sent_at) = CURRENT_DATE
GROUP BY template_id;

-- (2) 当日の予約サマリー
CREATE OR REPLACE VIEW v_today_booking_summary AS
SELECT
  COUNT(*)                                                    AS total_bookings,
  SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)      AS confirmed,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)      AS cancelled,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)      AS completed
FROM bookings
WHERE DATE(created_at) = CURRENT_DATE;
```

#### マテリアライズドビュー (バッチリフレッシュ)

```sql
-- (3) 日別配信効果 (過去データは不変のためMV向き)
CREATE MATERIALIZED VIEW mv_daily_delivery_stats AS
SELECT
  DATE(sent_at)              AS date,
  template_id,
  COUNT(*)                   AS sent,
  SUM(CASE WHEN delivered THEN 1 ELSE 0 END) AS delivered,
  SUM(CASE WHEN opened THEN 1 ELSE 0 END)    AS opened,
  SUM(CASE WHEN clicked THEN 1 ELSE 0 END)   AS clicked,
  SUM(CASE WHEN converted THEN 1 ELSE 0 END) AS converted
FROM broadcast_logs
WHERE sent_at < CURRENT_DATE  -- 当日は除外 (VIEWで参照)
GROUP BY DATE(sent_at), template_id
WITH DATA;

CREATE UNIQUE INDEX idx_mv_daily_delivery ON mv_daily_delivery_stats (date, template_id);

-- (4) 月別顧客指標
CREATE MATERIALIZED VIEW mv_monthly_customer_stats AS
SELECT
  DATE_TRUNC('month', action_at)::date AS month,
  COUNT(DISTINCT user_id)              AS active_users,
  COUNT(DISTINCT CASE WHEN action_type = 'purchase' THEN user_id END) AS buyers,
  SUM(CASE WHEN action_type = 'purchase' THEN amount ELSE 0 END)      AS total_revenue
FROM user_actions
GROUP BY DATE_TRUNC('month', action_at)
WITH DATA;

CREATE UNIQUE INDEX idx_mv_monthly_customer ON mv_monthly_customer_stats (month);

-- (5) クーポン効果サマリー
CREATE MATERIALIZED VIEW mv_coupon_effectiveness AS
SELECT
  c.id                        AS coupon_id,
  c.coupon_type,
  c.name                      AS coupon_name,
  COUNT(ci.id)                AS issued_count,
  SUM(CASE WHEN ci.used_at IS NOT NULL THEN 1 ELSE 0 END) AS used_count,
  SUM(COALESCE(ci.discount_amount, 0))  AS total_discount,
  SUM(COALESCE(o.total_amount, 0))      AS generated_revenue
FROM coupons c
LEFT JOIN coupon_issues ci ON c.id = ci.coupon_id
LEFT JOIN orders o ON o.coupon_issue_id = ci.id
GROUP BY c.id, c.coupon_type, c.name
WITH DATA;

CREATE UNIQUE INDEX idx_mv_coupon_eff ON mv_coupon_effectiveness (coupon_id);

-- (6) 予約稼働率ヒートマップ (曜日 x 時間帯)
CREATE MATERIALIZED VIEW mv_booking_heatmap AS
SELECT
  EXTRACT(DOW FROM booking_date)::int  AS day_of_week,  -- 0=日, 6=土
  booking_hour,
  COUNT(*)                             AS booking_count,
  AVG(occupancy_rate)                  AS avg_occupancy
FROM bookings b
JOIN slot_availability s ON s.date = b.booking_date AND s.hour = b.booking_hour
WHERE b.booking_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY EXTRACT(DOW FROM booking_date), booking_hour
WITH DATA;

CREATE UNIQUE INDEX idx_mv_booking_heat ON mv_booking_heatmap (day_of_week, booking_hour);
```

### 6.3 リフレッシュスケジュール

```sql
-- pg_cron を使用したリフレッシュ (Supabase で有効化)
-- 日次 03:00 JST (18:00 UTC)
SELECT cron.schedule('refresh-daily-delivery', '0 18 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_delivery_stats$$);

-- 月次 1日 05:00 JST (20:00 UTC 前日)
SELECT cron.schedule('refresh-monthly-customer', '0 20 L * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_customer_stats$$);

-- 日次 04:00 JST
SELECT cron.schedule('refresh-coupon-eff', '0 19 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_coupon_effectiveness$$);

-- 週次 月曜 03:30 JST
SELECT cron.schedule('refresh-booking-heatmap', '30 18 * * 1',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_booking_heatmap$$);
```

---

## 7. リアルタイム分析 vs バッチ分析

### 7.1 分類基準

| 観点 | リアルタイム | バッチ |
|------|------------|-------|
| データ鮮度 | 即時 (~数秒) | 定期更新 (数時間遅延許容) |
| 計算コスト | 低 (単純集計) | 高 (大量データ結合・集計) |
| ユースケース | 当日モニタリング | 過去トレンド分析 |

### 7.2 リアルタイム分析対象

Supabase Realtime (Postgres Changes) を活用する。

| データ | テーブル | 用途 |
|--------|---------|------|
| 配信状況 | `broadcast_logs` | 配信直後の到達・開封リアルタイムカウント |
| 予約入出 | `bookings` | 本日の予約状況ライブ更新 |
| 注文発生 | `orders` | 当日売上のリアルタイム積み上げ |

```typescript
// Supabase Realtime購読の実装例
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 配信ログのリアルタイム購読
const channel = supabase
  .channel('realtime-delivery')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'broadcast_logs',
      filter: `sent_at=gte.${todayISO}`,
    },
    (payload) => {
      // ダッシュボードのKPIカードを即時更新
      updateDeliveryStats(payload.new);
    }
  )
  .subscribe();
```

### 7.3 バッチ分析対象

| データ | 処理 | スケジュール |
|--------|------|------------|
| 日別配信効果集計 | MV `mv_daily_delivery_stats` リフレッシュ | 毎日 03:00 |
| 月次顧客指標 | MV `mv_monthly_customer_stats` リフレッシュ | 毎月1日 |
| クーポン効果 | MV `mv_coupon_effectiveness` リフレッシュ | 毎日 04:00 |
| 予約ヒートマップ | MV `mv_booking_heatmap` リフレッシュ | 毎週月曜 |
| 定型レポート生成 | `analytics_reports` テーブルへINSERT | 日次/週次/月次 |
| LTV再計算 | 全顧客のLTV値を再計算 | 毎週日曜 |

### 7.4 ハイブリッドアプローチ

当日データはリアルタイムVIEW + Realtime購読で表示し、過去データはマテリアライズドビューから高速に取得する。ダッシュボード側で両データソースを `UNION ALL` で結合する。

```sql
-- 当日 + 過去データの統合クエリ例
SELECT date, template_id, sent, delivered, opened, clicked
FROM mv_daily_delivery_stats
WHERE date >= :start_date AND date < CURRENT_DATE

UNION ALL

SELECT
  CURRENT_DATE AS date,
  template_id,
  COUNT(*) AS sent,
  SUM(CASE WHEN delivered THEN 1 ELSE 0 END) AS delivered,
  SUM(CASE WHEN opened THEN 1 ELSE 0 END)    AS opened,
  SUM(CASE WHEN clicked THEN 1 ELSE 0 END)   AS clicked
FROM broadcast_logs
WHERE DATE(sent_at) = CURRENT_DATE
GROUP BY template_id

ORDER BY date;
```

---

## 8. データエクスポート機能

### 8.1 CSV エクスポート

サーバーサイドでストリーミング生成し、大量データにも対応する。

```typescript
// API: GET /api/analytics/export/csv
interface CsvExportParams {
  report_type: 'delivery' | 'customers' | 'coupons' | 'bookings' | 'ec';
  date_start: string;
  date_end: string;
  metrics?: string[];       // 省略時は全指標
  encoding?: 'utf-8' | 'shift_jis';  // デフォルト: utf-8 (BOM付き)
}
```

**実装方針**:
- `ReadableStream` を使ったストリーミングレスポンス
- UTF-8 BOM (`\uFEFF`) を先頭に付与し、Excelでの文字化けを防止
- Shift_JIS オプションは `iconv-lite` で変換
- ファイル名: `linemag_{report_type}_{start}_{end}.csv`
- 最大行数: 100,000行 (超過時はページネーションまたはバックグラウンドジョブ)

```typescript
// CSV生成の実装例
export async function GET(request: NextRequest) {
  const params = parseExportParams(request);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // BOM
      controller.enqueue(encoder.encode('\uFEFF'));
      // ヘッダー行
      controller.enqueue(encoder.encode(CSV_HEADERS[params.report_type] + '\n'));

      // データをチャンクで取得・出力
      let offset = 0;
      const CHUNK_SIZE = 1000;
      while (true) {
        const rows = await fetchAnalyticsData(params, offset, CHUNK_SIZE);
        if (rows.length === 0) break;
        for (const row of rows) {
          controller.enqueue(encoder.encode(toCsvRow(row) + '\n'));
        }
        offset += CHUNK_SIZE;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${generateFilename(params)}"`,
    },
  });
}
```

### 8.2 PDF エクスポート

ブラウザ側でHTML→PDFを生成する。サーバー負荷を回避し、チャートのSVGをそのまま活用する。

```typescript
// 使用ライブラリ: html2canvas + jsPDF
interface PdfExportParams {
  title: string;
  dateRange: { start: string; end: string };
  sections: PdfSection[];   // 含めるセクション
  orientation?: 'portrait' | 'landscape';  // デフォルト: landscape
}

type PdfSection =
  | { type: 'kpi_cards' }
  | { type: 'chart'; chartId: string }
  | { type: 'table'; data: Record<string, unknown>[] };
```

**実装方針**:
- `html2canvas` でダッシュボードの各セクションをキャプチャ
- `jsPDF` でA4横向きPDFに配置
- ヘッダーに「LineMag レポート」「期間」「生成日時」を表示
- フッターにページ番号を表示
- チャートはSVG→Canvas→PNGの変換パイプラインで高品質を維持

```typescript
// PDFエクスポートの実装例
async function exportToPdf(params: PdfExportParams): Promise<void> {
  const pdf = new jsPDF({
    orientation: params.orientation ?? 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // ヘッダー
  pdf.setFontSize(16);
  pdf.text(params.title, 14, 20);
  pdf.setFontSize(10);
  pdf.text(`期間: ${params.dateRange.start} 〜 ${params.dateRange.end}`, 14, 28);
  pdf.text(`生成日時: ${new Date().toLocaleString('ja-JP')}`, 14, 34);

  let yOffset = 44;

  for (const section of params.sections) {
    const element = document.getElementById(`export-${section.type}`);
    if (!element) continue;

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 267; // A4横幅 - マージン
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (yOffset + imgHeight > 190) {
      pdf.addPage();
      yOffset = 14;
    }

    pdf.addImage(imgData, 'PNG', 14, yOffset, imgWidth, imgHeight);
    yOffset += imgHeight + 10;
  }

  pdf.save(`linemag_report_${params.dateRange.start}_${params.dateRange.end}.pdf`);
}
```

### 8.3 エクスポートUI

各分析画面の右上に統一的なエクスポートボタンを配置する。

```
┌──────────────────┐
│ エクスポート ▼    │
├──────────────────┤
│ 📄 CSVダウンロード│
│ 📑 PDFダウンロード│
└──────────────────┘
```

---

## 9. データベーステーブル設計 (分析関連)

分析機能に必要な追加テーブルを定義する。

```sql
-- 配信ログ (既存のファイルストレージからDB移行)
CREATE TABLE broadcast_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id   TEXT NOT NULL,
  article_url   TEXT NOT NULL,
  article_title TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered     BOOLEAN DEFAULT FALSE,
  opened        BOOLEAN DEFAULT FALSE,
  opened_at     TIMESTAMPTZ,
  clicked       BOOLEAN DEFAULT FALSE,
  clicked_at    TIMESTAMPTZ,
  converted     BOOLEAN DEFAULT FALSE,
  converted_at  TIMESTAMPTZ,
  recipient_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_broadcast_logs_sent_at ON broadcast_logs (sent_at);
CREATE INDEX idx_broadcast_logs_template ON broadcast_logs (template_id, sent_at);

-- ユーザーアクションログ (分析用統合テーブル)
CREATE TABLE user_actions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,  -- 'open', 'click', 'purchase', 'booking', 'coupon_use'
  action_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount      NUMERIC(12,2) DEFAULT 0,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_user_actions_user ON user_actions (user_id, action_at);
CREATE INDEX idx_user_actions_type ON user_actions (action_type, action_at);

-- 生成済みレポート保存
CREATE TABLE analytics_reports (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type  TEXT NOT NULL,     -- 'daily', 'weekly', 'monthly', 'custom'
  title        TEXT NOT NULL,
  date_start   DATE NOT NULL,
  date_end     DATE NOT NULL,
  data         JSONB NOT NULL,    -- 集計結果のJSON
  created_by   UUID REFERENCES users(id),
  is_favorite  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_type_date ON analytics_reports (report_type, date_start);
```

---

## 10. API エンドポイント設計

```
GET  /api/analytics/summary          メインダッシュボードKPI取得
GET  /api/analytics/delivery         配信分析データ
GET  /api/analytics/customers        顧客分析データ
GET  /api/analytics/coupons          クーポン分析データ
GET  /api/analytics/bookings         予約分析データ
GET  /api/analytics/ec               EC購買分析データ
POST /api/analytics/reports          カスタムレポート生成
GET  /api/analytics/reports          生成済みレポート一覧
GET  /api/analytics/reports/:id      レポート詳細取得
GET  /api/analytics/export/csv       CSVエクスポート
```

共通クエリパラメータ:

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `start` | `string` (YYYY-MM-DD) | 期間開始日 |
| `end` | `string` (YYYY-MM-DD) | 期間終了日 |
| `granularity` | `day \| week \| month` | 集計粒度 |
| `segment` | `string` | セグメントフィルター |
| `template_id` | `string` | テンプレートフィルター |

---

## 11. パフォーマンス要件

| 項目 | 要件 |
|------|------|
| ダッシュボード初回ロード | 2秒以内 |
| チャートデータ取得 (API) | 500ms以内 |
| CSVエクスポート (10,000行) | 3秒以内 |
| PDFエクスポート | 5秒以内 |
| リアルタイム更新遅延 | 3秒以内 |
| マテリアライズドビューリフレッシュ | 30秒以内 |

### パフォーマンス最適化方針

1. **クエリ最適化**: 分析クエリには必ず日付範囲のWHERE句を含め、パーティションプルーニングを活用
2. **MVの活用**: 過去データはマテリアライズドビュー経由で取得し、都度集計を避ける
3. **APIレスポンスキャッシュ**: 同一条件のリクエストは `Cache-Control` ヘッダーで5分間キャッシュ
4. **遅延ロード**: ダッシュボードはKPIカードを先に表示し、チャートは `Suspense` で遅延ロード
5. **データ間引き**: 長期間(90日超)のチャートは日次→週次に自動集約してデータポイント数を削減

---

## 12. 実装フェーズ

| フェーズ | 内容 | 目安期間 |
|---------|------|---------|
| Phase 1 | DBテーブル作成、MV定義、配信効果ダッシュボード | 2週間 |
| Phase 2 | 顧客分析、EC購買分析の追加 | 2週間 |
| Phase 3 | クーポン分析、予約分析の追加 | 2週間 |
| Phase 4 | レポート生成機能、CSV/PDFエクスポート | 1週間 |
| Phase 5 | リアルタイム更新、パフォーマンスチューニング | 1週間 |
