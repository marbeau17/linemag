# 03. CRM（顧客関係管理）システム仕様書

LineMag CRM機能の設計仕様。既存のWebhookベースのユーザー収集（`webhook-users.json`）およびLINE Messaging APIプロフィール取得（`LineUserProfile`）を基盤とし、Supabase移行後のフル機能CRMへ拡張する。

---

## 目次

1. [CRMデータモデル設計](#1-crmデータモデル設計)
2. [顧客プロファイル項目定義](#2-顧客プロファイル項目定義)
3. [セグメンテーション機能仕様](#3-セグメンテーション機能仕様)
4. [顧客ライフサイクル管理](#4-顧客ライフサイクル管理)
5. [CRMダッシュボード要件](#5-crmダッシュボード要件)
6. [データプライバシー・同意管理](#6-データプライバシー同意管理)

---

## 1. CRMデータモデル設計

### 1.1 エンティティ関連図（ER図）

```
┌─────────────────────┐       ┌──────────────────────┐
│   customers          │       │   customer_tags      │
│─────────────────────│       │──────────────────────│
│ PK id (uuid)         │──┐   │ PK id (uuid)         │
│    line_user_id       │  │   │ FK customer_id       │
│    display_name       │  │   │ FK tag_id            │
│    picture_url        │  ├──<│    assigned_at        │
│    status_message     │  │   │    assigned_by        │
│    email              │  │   └──────────────────────┘
│    phone              │  │
│    name_sei           │  │   ┌──────────────────────┐
│    name_mei           │  │   │   tags               │
│    birth_date         │  │   │──────────────────────│
│    gender             │  │   │ PK id (uuid)         │
│    prefecture         │  │   │    name              │
│    lifecycle_stage    │  │   │    color             │
│    engagement_score   │  │   │    category          │
│    first_seen_at      │  │   │    created_at        │
│    last_active_at     │  │   └──────────────────────┘
│    follow_status      │  │
│    consent_status     │  │   ┌──────────────────────┐
│    created_at         │  │   │   customer_events    │
│    updated_at         │  │   │──────────────────────│
└─────────────────────┘  │   │ PK id (uuid)         │
                          ├──<│ FK customer_id       │
                          │   │    event_type        │
                          │   │    event_data (jsonb) │
                          │   │    source            │
                          │   │    occurred_at       │
                          │   │    created_at        │
                          │   └──────────────────────┘
                          │
                          │   ┌──────────────────────┐
                          │   │  message_deliveries  │
                          │   │──────────────────────│
                          │   │ PK id (uuid)         │
                          ├──<│ FK customer_id       │
                          │   │ FK broadcast_id      │
                          │   │    delivered_at      │
                          │   │    opened_at         │
                          │   │    clicked_at        │
                          │   │    click_url         │
                          │   └──────────────────────┘
                          │
                          │   ┌──────────────────────┐
                          │   │   ec_purchases       │
                          │   │──────────────────────│
                          │   │ PK id (uuid)         │
                          ├──<│ FK customer_id       │
                          │   │    order_id (ext)    │
                          │   │    order_date        │
                          │   │    total_amount      │
                          │   │    items (jsonb)     │
                          │   │    source_platform   │
                          │   │    created_at        │
                          │   └──────────────────────┘
                          │
                          │   ┌──────────────────────┐
                          │   │   coupon_usages      │
                          │   │──────────────────────│
                          │   │ PK id (uuid)         │
                          ├──<│ FK customer_id       │
                          │   │ FK coupon_id         │
                          │   │    used_at           │
                          │   │    order_id          │
                          │   └──────────────────────┘
                          │
                          │   ┌──────────────────────┐
                          │   │   reservations       │
                          │   │──────────────────────│
                          │   │ PK id (uuid)         │
                          └──<│ FK customer_id       │
                              │    reservation_date  │
                              │    service_type      │
                              │    status            │
                              │    notes             │
                              │    created_at        │
                              └──────────────────────┘

┌─────────────────────┐       ┌──────────────────────┐
│   segments           │       │   segment_rules      │
│─────────────────────│       │──────────────────────│
│ PK id (uuid)         │──┐   │ PK id (uuid)         │
│    name              │  ├──<│ FK segment_id        │
│    description       │  │   │    field             │
│    type (static/     │  │   │    operator          │
│         dynamic)     │  │   │    value (jsonb)     │
│    auto_refresh      │  │   │    logic_group       │
│    last_computed_at  │  │   └──────────────────────┘
│    customer_count    │  │
│    created_at        │  │   ┌──────────────────────┐
│    updated_at        │  │   │   segment_members    │
└─────────────────────┘  │   │──────────────────────│
                          └──<│ FK segment_id        │
                              │ FK customer_id       │
                              │    added_at          │
                              └──────────────────────┘

┌─────────────────────┐
│   consent_records    │
│─────────────────────│
│ PK id (uuid)        │
│ FK customer_id      │
│    consent_type     │
│    granted          │
│    granted_at       │
│    revoked_at       │
│    ip_address       │
│    channel          │
└─────────────────────┘
```

### 1.2 Supabaseテーブル定義（SQL）

```sql
-- =============================================
-- customers: 顧客マスター
-- 既存の webhook-users.json / LineUserProfile を統合
-- =============================================
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  picture_url   TEXT,
  status_message TEXT,
  -- 独自属性
  email         TEXT,
  phone         TEXT,
  name_sei      TEXT,           -- 姓
  name_mei      TEXT,           -- 名
  birth_date    DATE,
  gender        TEXT CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  prefecture    TEXT,
  -- CRM属性
  lifecycle_stage TEXT NOT NULL DEFAULT 'new'
    CHECK (lifecycle_stage IN ('new', 'active', 'dormant', 'churned', 'reactivated')),
  engagement_score INTEGER NOT NULL DEFAULT 0,
  follow_status TEXT NOT NULL DEFAULT 'following'
    CHECK (follow_status IN ('following', 'blocked', 'unfollowed')),
  -- 時刻情報（既存 firstSeen/lastSeen を引き継ぎ）
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (consent_status IN ('pending', 'granted', 'denied', 'revoked')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_line_user_id ON customers (line_user_id);
CREATE INDEX idx_customers_lifecycle    ON customers (lifecycle_stage);
CREATE INDEX idx_customers_last_active  ON customers (last_active_at);
CREATE INDEX idx_customers_score        ON customers (engagement_score DESC);

-- =============================================
-- tags: 静的タグ定義
-- =============================================
CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  category   TEXT,             -- 例: 'interest', 'source', 'status'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- customer_tags: 顧客-タグ紐付け
-- =============================================
CREATE TABLE customer_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT,           -- 'auto' | 'manual' | operator名
  UNIQUE (customer_id, tag_id)
);

-- =============================================
-- customer_events: 行動イベントログ
-- =============================================
CREATE TABLE customer_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  event_data  JSONB DEFAULT '{}',
  source      TEXT NOT NULL DEFAULT 'system',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_customer   ON customer_events (customer_id, occurred_at DESC);
CREATE INDEX idx_events_type       ON customer_events (event_type, occurred_at DESC);

-- =============================================
-- message_deliveries: 配信トラッキング
-- =============================================
CREATE TABLE message_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  broadcast_id TEXT NOT NULL,     -- 既存 BroadcastRecord と紐付け
  delivered_at TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  clicked_at   TIMESTAMPTZ,
  click_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_customer  ON message_deliveries (customer_id);
CREATE INDEX idx_deliveries_broadcast ON message_deliveries (broadcast_id);

-- =============================================
-- ec_purchases: EC購買データ
-- =============================================
CREATE TABLE ec_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id        TEXT NOT NULL,          -- 外部ECシステムの注文ID
  order_date      TIMESTAMPTZ NOT NULL,
  total_amount    INTEGER NOT NULL,       -- 円（整数）
  items           JSONB NOT NULL DEFAULT '[]',
  source_platform TEXT NOT NULL,          -- 'shopify', 'base', 'stores_jp' 等
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_customer ON ec_purchases (customer_id, order_date DESC);

-- =============================================
-- coupon_usages: クーポン利用履歴
-- =============================================
CREATE TABLE coupon_usages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  coupon_id   TEXT NOT NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_id    TEXT
);

-- =============================================
-- reservations: 予約履歴
-- =============================================
CREATE TABLE reservations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reservation_date TIMESTAMPTZ NOT NULL,
  service_type     TEXT,
  status           TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- segments: セグメント定義
-- =============================================
CREATE TABLE segments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL CHECK (type IN ('static', 'dynamic')),
  auto_refresh     BOOLEAN NOT NULL DEFAULT false,
  last_computed_at TIMESTAMPTZ,
  customer_count   INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- segment_rules: 動的セグメントの条件定義
-- =============================================
CREATE TABLE segment_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  field       TEXT NOT NULL,     -- 対象フィールド
  operator    TEXT NOT NULL,     -- 比較演算子
  value       JSONB NOT NULL,    -- 比較値
  logic_group INTEGER NOT NULL DEFAULT 0  -- AND/ORグルーピング
);

-- =============================================
-- segment_members: セグメント所属
-- =============================================
CREATE TABLE segment_members (
  segment_id  UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (segment_id, customer_id)
);

-- =============================================
-- consent_records: 同意記録
-- =============================================
CREATE TABLE consent_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  granted      BOOLEAN NOT NULL,
  granted_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  ip_address   INET,
  channel      TEXT NOT NULL DEFAULT 'line'
);

CREATE INDEX idx_consent_customer ON consent_records (customer_id);
```

### 1.3 既存データマイグレーション

現在の `webhook-users.json`（`StoredUser` 型）から `customers` テーブルへの移行処理。

```typescript
// マイグレーション対応表
// webhook-users.json       → customers テーブル
// ─────────────────────────────────────────────
// userId                   → line_user_id
// firstSeen                → first_seen_at
// lastSeen                 → last_active_at
// messageCount             → customer_events へイベントとして記録
//
// LineUserProfile (followers.ts)  → customers テーブル
// ─────────────────────────────────────────────
// displayName              → display_name
// pictureUrl               → picture_url
// statusMessage            → status_message
```

移行手順:

1. `webhook-users.json` を読み込み、各 `StoredUser` に対して LINE Profile API を呼び出し
2. `customers` テーブルに UPSERT（`line_user_id` をキー）
3. `messageCount` は `customer_events` に `event_type = 'webhook_message'` として移行
4. 移行完了後、Webhook エンドポイントを Supabase 書き込みに切り替え

---

## 2. 顧客プロファイル項目定義

### 2.1 基本情報

| フィールド | 型 | 必須 | 説明 | 取得元 |
|-----------|------|------|------|--------|
| `id` | UUID | Yes | 内部顧客ID | 自動生成 |
| `email` | TEXT | No | メールアドレス | 手動入力 / LIFF連携 |
| `phone` | TEXT | No | 電話番号 | 手動入力 / LIFF連携 |
| `name_sei` | TEXT | No | 姓 | 手動入力 / LIFF連携 |
| `name_mei` | TEXT | No | 名 | 手動入力 / LIFF連携 |
| `birth_date` | DATE | No | 生年月日 | 手動入力 / LIFF連携 |
| `gender` | TEXT | No | 性別 (`male`/`female`/`other`/`unknown`) | 手動入力 |
| `prefecture` | TEXT | No | 都道府県 | 手動入力 / LIFF連携 |

### 2.2 LINE情報

| フィールド | 型 | 必須 | 説明 | 取得元 |
|-----------|------|------|------|--------|
| `line_user_id` | TEXT | Yes | LINE User ID | Webhook / Followers API |
| `display_name` | TEXT | No | LINE表示名 | Profile API |
| `picture_url` | TEXT | No | LINEアイコンURL | Profile API |
| `status_message` | TEXT | No | LINEステータスメッセージ | Profile API |
| `follow_status` | TEXT | Yes | フォロー状態 | Webhook (follow/unfollow) |
| `first_seen_at` | TIMESTAMPTZ | Yes | 初回認識日時 | Webhook（既存 `firstSeen`） |
| `last_active_at` | TIMESTAMPTZ | Yes | 最終活動日時 | Webhook / イベント更新 |

### 2.3 行動履歴（`customer_events`）

全行動は統一イベントテーブルに記録する。`event_type` で種別を分類し、`event_data` (JSONB) に詳細を格納する。

| event_type | 説明 | event_data 例 |
|-----------|------|---------------|
| `webhook_message` | LINE メッセージ受信 | `{"text": "こんにちは"}` |
| `follow` | 友だち追加 | `{}` |
| `unfollow` | ブロック/友だち削除 | `{}` |
| `message_delivered` | 配信メッセージ送達 | `{"broadcast_id": "..."}` |
| `message_opened` | メッセージ開封 | `{"broadcast_id": "..."}` |
| `link_clicked` | リンクタップ | `{"url": "...", "broadcast_id": "..."}` |
| `coupon_received` | クーポン受取 | `{"coupon_id": "..."}` |
| `coupon_used` | クーポン利用 | `{"coupon_id": "...", "order_id": "..."}` |
| `reservation_created` | 予約作成 | `{"reservation_id": "...", "service_type": "..."}` |
| `reservation_completed` | 予約完了（来店） | `{"reservation_id": "..."}` |
| `ec_purchase` | EC購入 | `{"order_id": "...", "amount": 5000}` |
| `page_view` | ページ閲覧（LIFF内） | `{"url": "...", "title": "..."}` |
| `rich_menu_tap` | リッチメニュータップ | `{"menu_id": "...", "action": "..."}` |

### 2.4 タグ

タグは手動付与（管理画面操作）と自動付与（ルールベース）の2種類をサポートする。

**プリセットタグカテゴリ:**

| カテゴリ | タグ例 | 用途 |
|---------|--------|------|
| `interest` | `美容`, `健康`, `ファッション`, `グルメ` | 興味関心 |
| `source` | `LINE広告`, `QRコード`, `紹介`, `Web流入` | 流入経路 |
| `status` | `VIP`, `要フォロー`, `休眠警告` | 運用ステータス |
| `purchase` | `リピーター`, `高単価`, `初回購入済` | 購買属性 |

**自動タグ付与ルール例:**

- EC購入3回以上 → `リピーター` 自動付与
- 累計購入額 50,000円以上 → `VIP` 自動付与
- 30日間アクション無し → `休眠警告` 自動付与

### 2.5 エンゲージメントスコアリング

顧客の活動度を 0〜100 のスコアで数値化する。スコアは日次バッチで再計算する。

**スコア算出ルール:**

| アクション | ポイント | 減衰 |
|-----------|---------|------|
| メッセージ送信 | +5 | - |
| 配信メッセージ開封 | +3 | - |
| リンクタップ | +5 | - |
| EC購入 | +15 | - |
| クーポン利用 | +10 | - |
| 予約完了 | +10 | - |
| リッチメニュー操作 | +2 | - |
| 日次アクティビティ無し | - | -1/日 |

**スコア算出期間:** 直近90日間のイベントを対象

**スコア計算式:**

```
engagement_score = min(100, max(0,
  SUM(action_points) - (inactive_days * 1)
))
```

**スコア帯の分類:**

| スコア帯 | ラベル | 解説 |
|---------|--------|------|
| 80〜100 | 高エンゲージメント | 積極的に反応するロイヤルユーザー |
| 50〜79 | 中エンゲージメント | 定期的に反応がある通常ユーザー |
| 20〜49 | 低エンゲージメント | 反応が減少傾向のユーザー |
| 0〜19 | 非アクティブ | ほぼ無反応、離脱リスクが高い |

---

## 3. セグメンテーション機能仕様

### 3.1 静的タグベースセグメント

管理者が手動でタグを付与し、タグの組み合わせで配信対象を抽出する方式。

**機能:**

- タグの作成・編集・削除（管理画面）
- 顧客へのタグ一括付与・除去
- CSVインポートによるタグ一括付与
- タグ条件の AND / OR 組み合わせによる顧客抽出

**UI操作フロー:**

```
[タグ管理] → [タグ作成: 名前・色・カテゴリ]
                ↓
[顧客一覧] → [チェックボックス選択] → [タグ一括付与]
                ↓
[配信画面] → [送信先: タグ条件指定] → [プレビュー・配信]
```

### 3.2 動的セグメント

条件式を定義し、該当する顧客を自動的にセグメントに振り分ける方式。条件に一致する顧客は自動で加入/除外される。

**条件定義の構造:**

```typescript
interface SegmentRule {
  field: string;        // 対象フィールド
  operator: Operator;   // 比較演算子
  value: unknown;       // 比較値
  logicGroup: number;   // 同一グループ内は AND、グループ間は OR
}

type Operator =
  | 'eq'            // 等しい
  | 'neq'           // 等しくない
  | 'gt'            // より大きい
  | 'gte'           // 以上
  | 'lt'            // より小さい
  | 'lte'           // 以下
  | 'contains'      // 含む（テキスト）
  | 'not_contains'  // 含まない
  | 'in'            // いずれかに一致
  | 'not_in'        // いずれにも一致しない
  | 'between'       // 範囲内
  | 'is_null'       // 値なし
  | 'is_not_null'   // 値あり
  | 'days_ago_gt'   // N日以上前
  | 'days_ago_lt';  // N日以内
```

**利用可能な条件フィールド:**

| カテゴリ | フィールド | 説明 |
|---------|-----------|------|
| 属性 | `gender`, `prefecture`, `birth_date` | 基本属性 |
| LINE | `follow_status`, `first_seen_at`, `last_active_at` | LINE関連 |
| CRM | `lifecycle_stage`, `engagement_score` | CRMステータス |
| タグ | `tag::{tag_name}` | 特定タグの有無 |
| 行動 | `event_count::{event_type}` | 特定イベントの回数 |
| 行動 | `last_event::{event_type}` | 特定イベントの最終日時 |
| EC | `total_purchase_amount`, `purchase_count` | 購買集計 |
| EC | `last_purchase_date` | 最終購入日 |

**動的セグメント例:**

```
セグメント名: "最近アクティブな美容関心層"
条件:
  グループ0 (AND):
    - last_active_at  days_ago_lt  30
    - tag::美容        eq           true
    - engagement_score gte          50
```

**リフレッシュ方式:**

| 方式 | タイミング | 用途 |
|------|----------|------|
| 手動リフレッシュ | 管理者操作時 | アドホック分析 |
| 定期リフレッシュ | 日次バッチ（毎朝6:00） | 自動配信のターゲット |
| 配信時リフレッシュ | 配信実行の直前 | 最新状態での配信保証 |

### 3.3 RFM分析

EC購買データに基づくRFM（Recency, Frequency, Monetary）分析でセグメントを自動生成する。

**RFMスコア定義:**

| 指標 | スコア5 | スコア4 | スコア3 | スコア2 | スコア1 |
|------|--------|--------|--------|--------|--------|
| **Recency** (最終購入からの日数) | 0〜14日 | 15〜30日 | 31〜60日 | 61〜90日 | 91日以上 |
| **Frequency** (購入回数/半年) | 10回以上 | 6〜9回 | 3〜5回 | 2回 | 1回 |
| **Monetary** (購入金額/半年) | 10万円以上 | 5〜10万円 | 3〜5万円 | 1〜3万円 | 1万円未満 |

**RFMセグメント自動分類:**

| セグメント名 | R | F | M | 推奨アクション |
|-------------|---|---|---|--------------|
| チャンピオン | 5 | 5 | 5 | ロイヤルティプログラム・先行案内 |
| ロイヤル顧客 | 4-5 | 4-5 | 4-5 | 限定オファー・アップセル |
| 有望顧客 | 4-5 | 2-3 | 2-3 | エンゲージメント強化・リピート促進 |
| 新規顧客 | 5 | 1 | 1 | ウェルカムシリーズ・初回特典 |
| 休眠リスク | 2-3 | 3-5 | 3-5 | 再活性化キャンペーン |
| 離脱顧客 | 1 | 1-2 | 1-2 | ウィンバック施策 |

**RFM計算バッチ:**

- 実行頻度: 日次（毎朝5:00、スコアリングバッチの前に実行）
- 対象期間: 直近180日間
- 結果格納: `customers` テーブルに `rfm_r`, `rfm_f`, `rfm_m` カラム追加、またはRFMセグメントに自動振り分け

---

## 4. 顧客ライフサイクル管理

### 4.1 ライフサイクルステージ定義

```
                     ┌──────────────┐
    友だち追加        │              │
   ─────────────────>│     new      │
                     │  (新規)       │
                     └──────┬───────┘
                            │ 初回アクション（メッセージ/タップ/購入）
                            v
                     ┌──────────────┐
                     │              │<──────────────┐
                     │   active     │               │ 再アクション
                     │  (アクティブ) │               │
                     └──────┬───────┘               │
                            │ 30日間無活動            │
                            v                       │
                     ┌──────────────┐               │
                     │              │───────────────┘
                     │   dormant    │  アクション発生
                     │  (休眠)      │
                     └──────┬───────┘
                            │ 90日間無活動
                            v
                     ┌──────────────┐
                     │              │───────────────┐
                     │   churned    │               │ アクション発生
                     │  (離脱)      │               │
                     └──────────────┘               │
                                                    v
                                             ┌──────────────┐
                                             │ reactivated  │
                                             │ (復帰)        │──> active へ遷移
                                             └──────────────┘
```

### 4.2 ステージ遷移条件

| 現ステージ | 遷移先 | トリガー条件 | 自動/手動 |
|-----------|--------|------------|----------|
| `new` | `active` | 初回のメッセージ送信 / リンクタップ / 購入 / クーポン利用 のいずれか | 自動 |
| `active` | `dormant` | `last_active_at` が30日以上前 | 自動（日次バッチ） |
| `dormant` | `active` | 任意のアクション発生 | 自動 |
| `dormant` | `churned` | `last_active_at` が90日以上前 | 自動（日次バッチ） |
| `churned` | `reactivated` | 任意のアクション発生 | 自動 |
| `reactivated` | `active` | `reactivated` 設定から7日後に自動遷移 | 自動 |
| 任意 | `churned` | `unfollow` イベント（ブロック/友だち削除） | 自動 |

### 4.3 ライフサイクル遷移バッチ

```
実行: 日次 毎朝 6:30（RFM → スコアリング → ライフサイクル の順で実行）

処理:
  1. active → dormant: last_active_at < NOW() - 30 days
  2. dormant → churned: last_active_at < NOW() - 90 days
  3. reactivated → active: reactivated_at < NOW() - 7 days
  4. 遷移イベントを customer_events に記録
  5. ライフサイクル変更通知（管理者向けサマリー）
```

### 4.4 ステージ別自動施策

| ステージ | 自動施策 | タイミング |
|---------|---------|----------|
| `new` | ウェルカムメッセージ配信 | 友だち追加直後 |
| `new` (3日後) | フォローアップメッセージ | 3日後 |
| `dormant` 移行時 | 再活性化プロモーション | 遷移直後 |
| `dormant` (14日後) | 最終リマインド | 遷移14日後 |
| `churned` 移行時 | ウィンバッククーポン | 遷移直後（最終手段） |
| `reactivated` | お帰りなさいメッセージ | 復帰直後 |

---

## 5. CRMダッシュボード要件

### 5.1 ダッシュボードTOP（KPI概要）

既存の配信ダッシュボード (`/dashboard`) にCRMタブを追加する。URL: `/dashboard/crm`

**KPIカード（上部4列）:**

| KPI | 算出方法 | 表示例 |
|-----|---------|--------|
| 総顧客数 | `COUNT(customers)` | 1,234人 |
| アクティブ率 | `active / total * 100` | 68.5% |
| 平均エンゲージメントスコア | `AVG(engagement_score)` | 52.3 |
| 今月新規獲得数 | `COUNT(first_seen_at >= 月初)` | +48人 |

**グラフエリア:**

| グラフ | 種類 | データ |
|--------|------|--------|
| 顧客獲得推移 | 折れ線（日次/週次/月次切替） | 新規顧客数の推移 |
| ライフサイクル分布 | ドーナツチャート | new / active / dormant / churned 比率 |
| エンゲージメントスコア分布 | 棒グラフ | スコア帯別の顧客数 |
| RFMマトリクス | ヒートマップ | R x F のセル別顧客数 |

### 5.2 顧客一覧画面

URL: `/dashboard/crm/customers`

**テーブルカラム:**

| カラム | 表示内容 | ソート |
|--------|---------|--------|
| アイコン | `picture_url`（LINEアイコン） | - |
| 表示名 | `display_name` | Yes |
| タグ | 付与済みタグ（バッジ表示、最大3個+残数） | - |
| ステージ | `lifecycle_stage`（色付きバッジ） | Yes |
| スコア | `engagement_score`（プログレスバー） | Yes |
| 最終活動 | `last_active_at`（相対時間） | Yes |
| 初回認識 | `first_seen_at` | Yes |

**フィルタ機能:**

- ライフサイクルステージ（チェックボックス複数選択）
- タグ（ドロップダウン複数選択）
- エンゲージメントスコア範囲（スライダー）
- フリーテキスト検索（`display_name`, `email`, `line_user_id`）
- セグメント選択

**一括操作:**

- タグ付与/除去
- セグメントへの追加
- CSVエクスポート
- 一括メッセージ配信

### 5.3 顧客詳細画面

URL: `/dashboard/crm/customers/[id]`

**レイアウト構成:**

```
┌─────────────────────────────────────────────────────────┐
│ [← 戻る]  顧客詳細                                      │
├──────────────────────┬──────────────────────────────────┤
│                      │  タグ: [美容] [VIP] [+追加]       │
│  [LINEアイコン]       │  ステージ: ●アクティブ            │
│  山田 花子            │  スコア: ████████░░ 78           │
│  @hanako_y           │  フォロー状態: フォロー中          │
│                      │  初回: 2025-08-15                │
│  ✉ hanako@...        │  最終活動: 3時間前                │
│  📱 090-xxxx-xxxx    │                                  │
├──────────────────────┴──────────────────────────────────┤
│ [タイムライン] [配信履歴] [購買履歴] [予約] [スコア推移]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ● 3時間前  リンクタップ「春のおすすめコーデ特集」          │
│  ● 1日前   メッセージ開封（デイリーコラム #234）            │
│  ● 3日前   EC購入 ¥4,980（スキンケアセット）               │
│  ● 5日前   クーポン利用「SPRING2026」                     │
│  ● 7日前   メッセージ受信「予約したいです」                 │
│  ...                                                    │
│                                                         │
│  [もっと見る]                                             │
└─────────────────────────────────────────────────────────┘
```

**各タブの内容:**

| タブ | 表示内容 |
|------|---------|
| タイムライン | 全イベントを時系列で表示（`customer_events` 全件） |
| 配信履歴 | 配信メッセージの送達・開封・クリック状況 |
| 購買履歴 | EC購入一覧（注文日・金額・商品・プラットフォーム） |
| 予約 | 予約一覧（日時・サービス・ステータス） |
| スコア推移 | エンゲージメントスコアの時系列チャート |

**操作ボタン:**

- 個別メッセージ送信（既存の Push API `/api/line/push` を利用）
- タグ編集
- メモ追加
- ステージ手動変更
- 顧客データエクスポート

### 5.4 セグメント管理画面

URL: `/dashboard/crm/segments`

**一覧画面:**

| カラム | 表示 |
|--------|------|
| セグメント名 | テキスト |
| タイプ | `静的` / `動的` バッジ |
| 顧客数 | `customer_count` |
| 最終更新 | `last_computed_at` |
| 操作 | 編集 / 複製 / 削除 / 配信 |

**セグメント作成・編集画面:**

- セグメント名・説明の入力
- 動的セグメント: 条件ビルダーUI（フィールド選択 → 演算子選択 → 値入力、AND/ORグループ）
- 静的セグメント: 顧客一覧からの手動追加 / CSVインポート
- プレビュー: 条件に一致する顧客数と一覧のリアルタイムプレビュー
- 自動リフレッシュ ON/OFF

---

## 6. データプライバシー・同意管理

### 6.1 収集データ分類

| 分類 | データ項目 | 法的根拠 |
|------|----------|---------|
| LINE提供データ | `line_user_id`, `display_name`, `picture_url`, `status_message` | LINE Platform利用規約に基づく（ユーザーのフォロー行為が同意に相当） |
| 自動収集データ | Webhookイベント、配信トラッキング、ページ閲覧 | 正当な利益（サービス提供に必要） |
| 本人提供データ | `email`, `phone`, `name_sei`, `name_mei`, `birth_date`, `prefecture` | 明示的同意（LIFF等で取得時に同意画面を表示） |
| EC連携データ | 購買履歴、注文情報 | 明示的同意（EC連携時の同意取得） |

### 6.2 同意管理（Consent Management）

**同意タイプ:**

| consent_type | 説明 | 取得タイミング |
|-------------|------|--------------|
| `terms_of_service` | 利用規約への同意 | 初回LIFF起動時 |
| `privacy_policy` | プライバシーポリシーへの同意 | 初回LIFF起動時 |
| `marketing_message` | マーケティングメッセージ受信同意 | LIFF同意画面 / リッチメニュー |
| `ec_data_sync` | EC購買データ連携同意 | EC連携設定時 |
| `third_party_share` | 第三者提供同意 | 必要時に都度取得 |

**同意フロー:**

```
[友だち追加] → LINE提供データのみ取得（追加的同意不要）
     │
     ├─ [LIFFアクセス] → 利用規約 + プライバシーポリシー同意画面表示
     │                    → 同意 → 個人情報入力フォーム表示可
     │                    → 拒否 → 基本機能のみ利用可
     │
     ├─ [EC連携] → ec_data_sync 同意画面表示
     │             → 同意 → 購買データ同期開始
     │             → 拒否 → EC連携なしで継続
     │
     └─ [同意撤回] → リッチメニュー「設定」→ 同意管理画面
                     → 各同意の撤回が可能
                     → 撤回時は該当データの利用を即時停止
```

### 6.3 データ保持ポリシー

| データ | 保持期間 | 期間超過時の処理 |
|--------|---------|----------------|
| 顧客プロファイル（基本） | アカウント存在期間中 | 削除リクエストで即時削除 |
| 行動イベントログ | 2年間 | 自動匿名化（`customer_id` を NULL に） |
| 配信トラッキング | 1年間 | 集計テーブルに移行後、詳細削除 |
| EC購買データ | 3年間（税務要件） | 集計テーブルに移行後、詳細削除 |
| 同意記録 | 無期限（法的要件） | 削除不可 |

### 6.4 データ主体の権利対応

| 権利 | 実装方法 | 対応期限 |
|------|---------|---------|
| アクセス権（開示請求） | 管理画面から顧客データの全件エクスポート機能 | 請求から2週間以内 |
| 訂正権 | LIFF上のプロフィール編集画面 | 即時反映 |
| 削除権 | 管理画面の「顧客データ完全削除」ボタン（CASCADE削除） | 請求から1ヶ月以内 |
| 同意撤回権 | LIFF上の同意管理画面 | 即時反映 |
| データポータビリティ | JSON / CSVエクスポート機能 | 請求から2週間以内 |

### 6.5 セキュリティ要件

| 項目 | 実装方針 |
|------|---------|
| 通信暗号化 | HTTPS必須（Vercelデフォルト） |
| データ暗号化 | Supabase RLS (Row Level Security) で管理者のみアクセス可 |
| PII マスキング | ログ出力時は `line_user_id`, `email`, `phone` をマスク |
| アクセスログ | 管理画面の顧客データアクセスを監査ログに記録 |
| API認証 | Supabase Auth + APIキーによる二重認証 |
| 個人情報の最小化 | 必要最小限のデータのみ収集。不要項目は任意入力 |

### 6.6 LINE特有のプライバシー考慮事項

| 項目 | 対応 |
|------|------|
| LINE User ID の取り扱い | ハッシュ化せず保持（API連携に必要）。外部への開示は禁止 |
| LINEプロフィール情報 | ユーザーがLINE側で変更した場合に定期同期（週次バッチ） |
| ブロック検知 | Webhookの `unfollow` イベントで検知し、`follow_status` を更新。ブロック後はプッシュ配信を自動停止 |
| 友だち追加経路の追記 | LINE公式アカウントの管理画面と併せて `source` タグで記録 |

---

## 付録A: 技術スタック

| レイヤー | 技術 | 補足 |
|---------|------|------|
| フロントエンド | Next.js 14 (App Router) | 既存ダッシュボードに統合 |
| バックエンド | Next.js API Routes | 既存 `/api/line/*` に CRM API を追加 |
| データベース | Supabase (PostgreSQL) | 既存ファイルベースから移行 |
| 認証 | Supabase Auth | 管理画面のアクセス制御 |
| バッチ処理 | Vercel Cron Jobs | 既存 `/api/cron/line-broadcast` と同様 |
| リアルタイム | Supabase Realtime | ダッシュボード数値の自動更新（将来対応） |

## 付録B: API エンドポイント設計

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/crm/customers` | 顧客一覧取得（フィルタ・ページネーション対応） |
| GET | `/api/crm/customers/[id]` | 顧客詳細取得 |
| PATCH | `/api/crm/customers/[id]` | 顧客プロファイル更新 |
| DELETE | `/api/crm/customers/[id]` | 顧客データ完全削除 |
| GET | `/api/crm/customers/[id]/events` | 顧客イベント履歴取得 |
| POST | `/api/crm/customers/[id]/tags` | タグ付与 |
| DELETE | `/api/crm/customers/[id]/tags/[tagId]` | タグ除去 |
| GET | `/api/crm/tags` | タグ一覧取得 |
| POST | `/api/crm/tags` | タグ作成 |
| GET | `/api/crm/segments` | セグメント一覧取得 |
| POST | `/api/crm/segments` | セグメント作成 |
| GET | `/api/crm/segments/[id]` | セグメント詳細・メンバー取得 |
| POST | `/api/crm/segments/[id]/refresh` | セグメント再計算 |
| POST | `/api/crm/segments/[id]/broadcast` | セグメント配信実行 |
| GET | `/api/crm/dashboard/kpi` | ダッシュボードKPI集計 |
| GET | `/api/crm/dashboard/lifecycle` | ライフサイクル分布 |
| GET | `/api/crm/dashboard/rfm` | RFMマトリクスデータ |
| POST | `/api/crm/ec/sync` | EC購買データ同期（Webhook受信） |
| GET | `/api/crm/consent/[customerId]` | 同意状況取得 |
| POST | `/api/crm/consent/[customerId]` | 同意記録・更新 |

## 付録C: バッチ処理スケジュール

| 時刻 | ジョブ | 依存 |
|------|--------|------|
| 05:00 | RFM スコア計算 | - |
| 05:30 | エンゲージメントスコア再計算 | RFM完了後 |
| 06:00 | 動的セグメント リフレッシュ | スコア計算完了後 |
| 06:30 | ライフサイクル ステージ遷移 | セグメント更新完了後 |
| 07:00 | 自動タグ付与ルール実行 | ライフサイクル遷移完了後 |
| 毎週月曜 03:00 | LINE プロフィール同期 | - |
| 毎月 1日 02:00 | データ保持ポリシー適用（古いデータの匿名化・削除） | - |
