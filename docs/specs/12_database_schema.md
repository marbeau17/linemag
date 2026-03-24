# 12. データベーススキーマ仕様書

## 1. 概要

LineMag システムのストレージ基盤をファイルベース（JSON）から Supabase（PostgreSQL）へ移行し、既存機能の永続化に加えて、顧客管理・行動分析・クーポン・予約・EC連携などの新規機能を支えるデータベーススキーマを定義する。

### 1.1 設計方針

- **UUID v4** を全テーブルの主キーに採用（`gen_random_uuid()`）
- **タイムスタンプ** は全テーブルに `created_at` / `updated_at` を付与（`timestamptz` 型）
- **ソフトデリート** は必要なテーブルに `deleted_at` カラムで対応
- **JSONB** を活用し、スキーマレスな拡張データを格納可能にする
- **RLS（Row Level Security）** を全テーブルに適用し、API経由の不正アクセスを防止
- **命名規則**: スネークケース、テーブル名は複数形

### 1.2 対象範囲

| カテゴリ | 内容 |
|---------|------|
| 既存移行 | 送信済みURL、配信履歴、スケジュール設定、実行ログ、Webhookユーザー |
| 新規 | 顧客プロファイル、行動履歴、クーポン、予約、セグメント、EC連携 |

---

## 2. ER図

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LineMag ER Diagram                            │
└─────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
 │  customers   │──1:N──│ customer_actions  │       │    segments      │
 │              │       └──────────────────┘       │                  │
 │  (顧客)      │                                   └────────┬─────────┘
 │              │──1:N──┌──────────────────┐                 │
 │              │       │  customer_tags   │       ┌─────────┴────────┐
 │              │       └──────────────────┘       │segment_members   │
 │              │                                   └──────────────────┘
 │              │──1:N──┌──────────────────┐              ▲
 │              │       │ coupon_issues    │──────────────┘(セグメント
 │              │       └───────┬──────────┘               配信対象)
 │              │               │
 │              │       ┌───────┴──────────┐
 │              │       │ coupon_usages    │
 │              │       └──────────────────┘
 │              │               ▲
 │              │       ┌───────┴──────────┐
 │              │       │ coupon_masters   │
 │              │       └──────────────────┘
 │              │
 │              │──1:N──┌──────────────────┐       ┌──────────────────┐
 │              │       │  reservations    │──N:1──│  time_slots      │
 │              │       └──────────────────┘       └──────────────────┘
 │              │
 │              │──1:N──┌──────────────────┐
 │              │       │ delivery_tracks  │
 │              │       └──────────────────┘
 │              │               ▲
 │              │       ┌───────┴──────────┐
 │              │       │   broadcasts     │
 │              │       └──────────────────┘
 │              │
 │              │──1:N──┌──────────────────┐       ┌──────────────────┐
 │              │       │    orders        │──N:M──│    products      │
 │              │       └──────────────────┘       └──────────────────┘
 │              │                │
 └──────────────┘       ┌───────┴──────────┐
                        │  order_items     │
                        └──────────────────┘

 ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │   sent_urls      │   │   schedules      │   │ execution_logs   │
 └──────────────────┘   └──────────────────┘   └──────────────────┘
  (既存移行: 独立)       (既存移行: 独立)       (既存移行: 独立)
```

### テーブル関連の詳細

| 親テーブル | 子テーブル | 関係 | 外部キー |
|-----------|-----------|------|---------|
| customers | customer_actions | 1:N | customer_id |
| customers | customer_tags | 1:N | customer_id |
| customers | coupon_issues | 1:N | customer_id |
| customers | reservations | 1:N | customer_id |
| customers | delivery_tracks | 1:N | customer_id |
| customers | orders | 1:N | customer_id |
| customers | segment_members | 1:N | customer_id |
| segments | segment_members | 1:N | segment_id |
| coupon_masters | coupon_issues | 1:N | coupon_master_id |
| coupon_issues | coupon_usages | 1:N | coupon_issue_id |
| time_slots | reservations | 1:N | time_slot_id |
| broadcasts | delivery_tracks | 1:N | broadcast_id |
| orders | order_items | 1:N | order_id |
| products | order_items | 1:N | product_id |

---

## 3. テーブル定義

### 3.1 既存データ移行テーブル

#### 3.1.1 `sent_urls` — 送信済みURL

元ファイル: `line-sent-urls.json`

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| url | text | NOT NULL, UNIQUE | 送信済み記事URL |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 登録日時 |

```sql
CREATE TABLE sent_urls (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url         text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sent_urls_url ON sent_urls (url);
CREATE INDEX idx_sent_urls_created_at ON sent_urls (created_at DESC);
```

#### 3.1.2 `broadcasts` — 配信履歴

元ファイル: `line-broadcast-history.json`

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| url | text | NOT NULL | 記事URL |
| title | text | NOT NULL | 記事タイトル |
| template_id | text | | 使用テンプレートID |
| status | text | NOT NULL, CHECK | 'SUCCESS' / 'FAILED' |
| error_message | text | | エラー時のメッセージ |
| sent_at | timestamptz | NOT NULL | 配信実行日時 |
| metadata | jsonb | DEFAULT '{}' | 追加メタデータ |
| created_at | timestamptz | NOT NULL, DEFAULT now() | レコード作成日時 |

```sql
CREATE TABLE broadcasts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url           text NOT NULL,
    title         text NOT NULL,
    template_id   text,
    status        text NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    error_message text,
    sent_at       timestamptz NOT NULL,
    metadata      jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcasts_sent_at ON broadcasts (sent_at DESC);
CREATE INDEX idx_broadcasts_status ON broadcasts (status);
CREATE INDEX idx_broadcasts_url ON broadcasts (url);
```

#### 3.1.3 `schedules` — スケジュール設定

元ファイル: `line-schedule.json`

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| key | text | NOT NULL, UNIQUE | 設定キー（'default' 等） |
| enabled | boolean | NOT NULL, DEFAULT false | 有効/無効 |
| times | text[] | NOT NULL, DEFAULT '{}' | 配信時刻一覧 |
| template_id | text | NOT NULL, DEFAULT 'daily-column' | テンプレートID |
| max_articles_per_run | integer | NOT NULL, DEFAULT 3 | 1回あたり最大記事数 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 最終更新日時 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |

```sql
CREATE TABLE schedules (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key                   text NOT NULL UNIQUE DEFAULT 'default',
    enabled               boolean NOT NULL DEFAULT false,
    times                 text[] NOT NULL DEFAULT '{}',
    template_id           text NOT NULL DEFAULT 'daily-column',
    max_articles_per_run  integer NOT NULL DEFAULT 3,
    updated_at            timestamptz NOT NULL DEFAULT now(),
    created_at            timestamptz NOT NULL DEFAULT now()
);
```

#### 3.1.4 `execution_logs` — 実行ログ

元ファイル: `execution-logs.json`

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| step | text | NOT NULL, CHECK | 'SCRAPE' / 'SUMMARIZE' / 'BROADCAST' / 'CRON' |
| result | text | NOT NULL, CHECK | 'SUCCESS' / 'ERROR' / 'SKIP' |
| detail | text | NOT NULL | 詳細メッセージ |
| metadata | jsonb | DEFAULT '{}' | 追加メタデータ |
| executed_at | timestamptz | NOT NULL, DEFAULT now() | 実行日時 |

```sql
CREATE TABLE execution_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step        text NOT NULL CHECK (step IN ('SCRAPE', 'SUMMARIZE', 'BROADCAST', 'CRON')),
    result      text NOT NULL CHECK (result IN ('SUCCESS', 'ERROR', 'SKIP')),
    detail      text NOT NULL,
    metadata    jsonb NOT NULL DEFAULT '{}',
    executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_execution_logs_executed_at ON execution_logs (executed_at DESC);
CREATE INDEX idx_execution_logs_step ON execution_logs (step);
CREATE INDEX idx_execution_logs_result ON execution_logs (result);
CREATE INDEX idx_execution_logs_step_executed ON execution_logs (step, executed_at DESC);
```

#### 3.1.5 `error_trackings` — エラー追跡

元ファイル: `error-tracking.json`

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| key | text | NOT NULL, UNIQUE | 追跡キー（'default' 等） |
| consecutive_errors | integer | NOT NULL, DEFAULT 0 | 連続エラー回数 |
| last_error_at | timestamptz | | 最終エラー日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新日時 |

```sql
CREATE TABLE error_trackings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key                 text NOT NULL UNIQUE DEFAULT 'default',
    consecutive_errors  integer NOT NULL DEFAULT 0,
    last_error_at       timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT now()
);
```

---

### 3.2 顧客管理テーブル

#### 3.2.1 `customers` — 顧客プロファイル

元ファイル: `webhook-users.json` を拡張

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| line_user_id | text | NOT NULL, UNIQUE | LINE User ID |
| display_name | text | | LINE表示名 |
| picture_url | text | | プロフィール画像URL |
| status_message | text | | ステータスメッセージ |
| email | text | | メールアドレス |
| phone | text | | 電話番号 |
| gender | text | CHECK | 'male' / 'female' / 'other' / NULL |
| birth_date | date | | 生年月日 |
| prefecture | text | | 都道府県 |
| membership_tier | text | NOT NULL, DEFAULT 'free', CHECK | 会員ランク |
| message_count | integer | NOT NULL, DEFAULT 0 | 累計メッセージ数 |
| first_seen_at | timestamptz | NOT NULL, DEFAULT now() | 初回接触日時 |
| last_seen_at | timestamptz | NOT NULL, DEFAULT now() | 最終接触日時 |
| blocked_at | timestamptz | | ブロック日時（NULLならアクティブ） |
| attributes | jsonb | NOT NULL, DEFAULT '{}' | カスタム属性（自由項目） |
| created_at | timestamptz | NOT NULL, DEFAULT now() | レコード作成日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | レコード更新日時 |

```sql
CREATE TABLE customers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id    text NOT NULL UNIQUE,
    display_name    text,
    picture_url     text,
    status_message  text,
    email           text,
    phone           text,
    gender          text CHECK (gender IN ('male', 'female', 'other')),
    birth_date      date,
    prefecture      text,
    membership_tier text NOT NULL DEFAULT 'free'
                        CHECK (membership_tier IN ('free', 'silver', 'gold', 'platinum')),
    message_count   integer NOT NULL DEFAULT 0,
    first_seen_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    blocked_at      timestamptz,
    attributes      jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_customers_line_user_id ON customers (line_user_id);
CREATE INDEX idx_customers_membership_tier ON customers (membership_tier);
CREATE INDEX idx_customers_prefecture ON customers (prefecture);
CREATE INDEX idx_customers_blocked_at ON customers (blocked_at) WHERE blocked_at IS NULL;
CREATE INDEX idx_customers_last_seen_at ON customers (last_seen_at DESC);
CREATE INDEX idx_customers_attributes ON customers USING GIN (attributes);
```

#### 3.2.2 `customer_tags` — 顧客タグ

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| customer_id | uuid | NOT NULL, FK → customers.id | 顧客ID |
| tag | text | NOT NULL | タグ名 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 付与日時 |

```sql
CREATE TABLE customer_tags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag         text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (customer_id, tag)
);

CREATE INDEX idx_customer_tags_customer_id ON customer_tags (customer_id);
CREATE INDEX idx_customer_tags_tag ON customer_tags (tag);
```

#### 3.2.3 `customer_actions` — 顧客行動履歴

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| customer_id | uuid | NOT NULL, FK → customers.id | 顧客ID |
| action_type | text | NOT NULL, CHECK | 行動タイプ |
| action_detail | jsonb | NOT NULL, DEFAULT '{}' | 行動詳細データ |
| source | text | | イベント発生元 |
| acted_at | timestamptz | NOT NULL, DEFAULT now() | 行動日時 |

`action_type` 値: `'message_received'`, `'link_tap'`, `'purchase'`, `'follow'`, `'unfollow'`, `'coupon_use'`, `'reservation'`, `'page_view'`

```sql
CREATE TABLE customer_actions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    action_type   text NOT NULL CHECK (action_type IN (
                      'message_received', 'link_tap', 'purchase',
                      'follow', 'unfollow', 'coupon_use',
                      'reservation', 'page_view'
                  )),
    action_detail jsonb NOT NULL DEFAULT '{}',
    source        text,
    acted_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_actions_customer_id ON customer_actions (customer_id);
CREATE INDEX idx_customer_actions_type ON customer_actions (action_type);
CREATE INDEX idx_customer_actions_acted_at ON customer_actions (acted_at DESC);
CREATE INDEX idx_customer_actions_customer_type ON customer_actions (customer_id, action_type);
CREATE INDEX idx_customer_actions_detail ON customer_actions USING GIN (action_detail);
```

---

### 3.3 クーポンテーブル

#### 3.3.1 `coupon_masters` — クーポンマスター

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| code | text | NOT NULL, UNIQUE | クーポンコード（人が読める形式） |
| name | text | NOT NULL | クーポン名 |
| description | text | | 説明 |
| discount_type | text | NOT NULL, CHECK | 'fixed' / 'percentage' |
| discount_value | numeric(10,2) | NOT NULL | 割引額またはパーセンテージ |
| min_purchase_amount | numeric(10,2) | DEFAULT 0 | 最低利用金額 |
| max_issues | integer | | 最大発行数（NULLなら無制限） |
| max_uses_per_customer | integer | NOT NULL, DEFAULT 1 | 顧客あたり最大利用回数 |
| valid_from | timestamptz | NOT NULL | 有効開始日時 |
| valid_until | timestamptz | NOT NULL | 有効終了日時 |
| is_active | boolean | NOT NULL, DEFAULT true | 有効フラグ |
| target_segment_id | uuid | FK → segments.id | 対象セグメント（NULLなら全員） |
| metadata | jsonb | NOT NULL, DEFAULT '{}' | 追加設定 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新日時 |

```sql
CREATE TABLE coupon_masters (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                   text NOT NULL UNIQUE,
    name                   text NOT NULL,
    description            text,
    discount_type          text NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value         numeric(10,2) NOT NULL,
    min_purchase_amount    numeric(10,2) DEFAULT 0,
    max_issues             integer,
    max_uses_per_customer  integer NOT NULL DEFAULT 1,
    valid_from             timestamptz NOT NULL,
    valid_until            timestamptz NOT NULL,
    is_active              boolean NOT NULL DEFAULT true,
    target_segment_id      uuid REFERENCES segments(id) ON DELETE SET NULL,
    metadata               jsonb NOT NULL DEFAULT '{}',
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_period CHECK (valid_until > valid_from),
    CONSTRAINT valid_discount CHECK (
        (discount_type = 'fixed' AND discount_value > 0) OR
        (discount_type = 'percentage' AND discount_value > 0 AND discount_value <= 100)
    )
);

CREATE INDEX idx_coupon_masters_code ON coupon_masters (code);
CREATE INDEX idx_coupon_masters_active ON coupon_masters (is_active) WHERE is_active = true;
CREATE INDEX idx_coupon_masters_valid ON coupon_masters (valid_from, valid_until);
```

#### 3.3.2 `coupon_issues` — クーポン発行

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| coupon_master_id | uuid | NOT NULL, FK → coupon_masters.id | クーポンマスターID |
| customer_id | uuid | NOT NULL, FK → customers.id | 発行先顧客ID |
| issue_code | text | NOT NULL, UNIQUE | 個別発行コード |
| status | text | NOT NULL, DEFAULT 'issued', CHECK | 'issued' / 'used' / 'expired' / 'revoked' |
| issued_at | timestamptz | NOT NULL, DEFAULT now() | 発行日時 |
| expires_at | timestamptz | NOT NULL | 個別有効期限 |
| used_at | timestamptz | | 使用日時 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |

```sql
CREATE TABLE coupon_issues (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_master_id uuid NOT NULL REFERENCES coupon_masters(id) ON DELETE RESTRICT,
    customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    issue_code       text NOT NULL UNIQUE,
    status           text NOT NULL DEFAULT 'issued'
                         CHECK (status IN ('issued', 'used', 'expired', 'revoked')),
    issued_at        timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    used_at          timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_issues_customer_id ON coupon_issues (customer_id);
CREATE INDEX idx_coupon_issues_master_id ON coupon_issues (coupon_master_id);
CREATE INDEX idx_coupon_issues_status ON coupon_issues (status);
CREATE INDEX idx_coupon_issues_code ON coupon_issues (issue_code);
```

#### 3.3.3 `coupon_usages` — クーポン利用履歴

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| coupon_issue_id | uuid | NOT NULL, FK → coupon_issues.id | 発行済みクーポンID |
| order_id | uuid | FK → orders.id | 紐づく注文ID |
| discount_amount | numeric(10,2) | NOT NULL | 実際の割引金額 |
| used_at | timestamptz | NOT NULL, DEFAULT now() | 利用日時 |

```sql
CREATE TABLE coupon_usages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_issue_id uuid NOT NULL REFERENCES coupon_issues(id) ON DELETE RESTRICT,
    order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
    discount_amount numeric(10,2) NOT NULL,
    used_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_usages_issue_id ON coupon_usages (coupon_issue_id);
CREATE INDEX idx_coupon_usages_order_id ON coupon_usages (order_id);
```

---

### 3.4 予約テーブル

#### 3.4.1 `time_slots` — 予約枠

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| slot_date | date | NOT NULL | 予約日 |
| start_time | time | NOT NULL | 開始時刻 |
| end_time | time | NOT NULL | 終了時刻 |
| capacity | integer | NOT NULL, DEFAULT 1 | 最大予約可能数 |
| reserved_count | integer | NOT NULL, DEFAULT 0 | 現在の予約数 |
| is_available | boolean | NOT NULL, DEFAULT true | 利用可能フラグ |
| metadata | jsonb | NOT NULL, DEFAULT '{}' | 追加情報 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新日時 |

```sql
CREATE TABLE time_slots (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_date      date NOT NULL,
    start_time     time NOT NULL,
    end_time       time NOT NULL,
    capacity       integer NOT NULL DEFAULT 1,
    reserved_count integer NOT NULL DEFAULT 0,
    is_available   boolean NOT NULL DEFAULT true,
    metadata       jsonb NOT NULL DEFAULT '{}',
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_capacity CHECK (reserved_count <= capacity),
    UNIQUE (slot_date, start_time, end_time)
);

CREATE INDEX idx_time_slots_date ON time_slots (slot_date);
CREATE INDEX idx_time_slots_available ON time_slots (slot_date, is_available)
    WHERE is_available = true;
```

#### 3.4.2 `reservations` — 予約情報

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| customer_id | uuid | NOT NULL, FK → customers.id | 予約者 |
| time_slot_id | uuid | NOT NULL, FK → time_slots.id | 予約枠 |
| status | text | NOT NULL, DEFAULT 'confirmed', CHECK | 予約状態 |
| google_meet_url | text | | Google Meet URL |
| notes | text | | メモ |
| reminder_sent_at | timestamptz | | リマインダー送信日時 |
| cancelled_at | timestamptz | | キャンセル日時 |
| metadata | jsonb | NOT NULL, DEFAULT '{}' | 追加情報 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新日時 |

`status` 値: `'confirmed'`, `'cancelled'`, `'completed'`, `'no_show'`

```sql
CREATE TABLE reservations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    time_slot_id    uuid NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    status          text NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    google_meet_url text,
    notes           text,
    reminder_sent_at timestamptz,
    cancelled_at    timestamptz,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_customer_id ON reservations (customer_id);
CREATE INDEX idx_reservations_time_slot_id ON reservations (time_slot_id);
CREATE INDEX idx_reservations_status ON reservations (status);
CREATE INDEX idx_reservations_created_at ON reservations (created_at DESC);
```

---

### 3.5 セグメントテーブル

#### 3.5.1 `segments` — セグメント定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| name | text | NOT NULL, UNIQUE | セグメント名 |
| description | text | | 説明 |
| segment_type | text | NOT NULL, DEFAULT 'static', CHECK | 'static' / 'dynamic' |
| filter_conditions | jsonb | | 動的セグメントのフィルタ条件 |
| member_count | integer | NOT NULL, DEFAULT 0 | メンバー数（キャッシュ） |
| is_active | boolean | NOT NULL, DEFAULT true | 有効フラグ |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新日時 |

`filter_conditions` の例（動的セグメント）:
```json
{
  "rules": [
    { "field": "prefecture", "operator": "eq", "value": "東京都" },
    { "field": "membership_tier", "operator": "in", "values": ["gold", "platinum"] },
    { "field": "last_seen_at", "operator": "gte", "value": "-30d" }
  ],
  "logic": "AND"
}
```

```sql
CREATE TABLE segments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text NOT NULL UNIQUE,
    description       text,
    segment_type      text NOT NULL DEFAULT 'static'
                          CHECK (segment_type IN ('static', 'dynamic')),
    filter_conditions jsonb,
    member_count      integer NOT NULL DEFAULT 0,
    is_active         boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_segments_type ON segments (segment_type);
CREATE INDEX idx_segments_active ON segments (is_active) WHERE is_active = true;
```

#### 3.5.2 `segment_members` — セグメントメンバーシップ

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| segment_id | uuid | NOT NULL, FK → segments.id | セグメントID |
| customer_id | uuid | NOT NULL, FK → customers.id | 顧客ID |
| added_at | timestamptz | NOT NULL, DEFAULT now() | 追加日時 |

```sql
CREATE TABLE segment_members (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id  uuid NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (segment_id, customer_id)
);

CREATE INDEX idx_segment_members_segment_id ON segment_members (segment_id);
CREATE INDEX idx_segment_members_customer_id ON segment_members (customer_id);
```

---

### 3.6 配信追跡テーブル

#### 3.6.1 `delivery_tracks` — 個別配信追跡

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| broadcast_id | uuid | NOT NULL, FK → broadcasts.id | 配信ID |
| customer_id | uuid | NOT NULL, FK → customers.id | 配信先顧客ID |
| status | text | NOT NULL, DEFAULT 'sent', CHECK | 配信ステータス |
| delivered_at | timestamptz | | 到達日時 |
| opened_at | timestamptz | | 開封日時 |
| clicked_at | timestamptz | | クリック日時 |
| error_message | text | | エラーメッセージ |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |

`status` 値: `'pending'`, `'sent'`, `'delivered'`, `'failed'`

```sql
CREATE TABLE delivery_tracks (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id  uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status        text NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    delivered_at  timestamptz,
    opened_at     timestamptz,
    clicked_at    timestamptz,
    error_message text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_tracks_broadcast_id ON delivery_tracks (broadcast_id);
CREATE INDEX idx_delivery_tracks_customer_id ON delivery_tracks (customer_id);
CREATE INDEX idx_delivery_tracks_status ON delivery_tracks (status);
CREATE INDEX idx_delivery_tracks_broadcast_status ON delivery_tracks (broadcast_id, status);
```

---

### 3.7 EC連携テーブル

#### 3.7.1 `products` — 商品マスター

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| external_id | text | UNIQUE | 外部EC商品ID |
| name | text | NOT NULL | 商品名 |
| description | text | | 商品説明 |
| price | numeric(10,2) | NOT NULL | 価格（税込） |
| category | text | | カテゴリ |
| image_url | text | | 商品画像URL |
| stock_quantity | integer | NOT NULL, DEFAULT 0 | 在庫数 |
| is_available | boolean | NOT NULL, DEFAULT true | 販売可能フラグ |
| metadata | jsonb | NOT NULL, DEFAULT '{}' | 追加属性 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新日時 |

```sql
CREATE TABLE products (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     text UNIQUE,
    name            text NOT NULL,
    description     text,
    price           numeric(10,2) NOT NULL,
    category        text,
    image_url       text,
    stock_quantity  integer NOT NULL DEFAULT 0,
    is_available    boolean NOT NULL DEFAULT true,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_available ON products (is_available) WHERE is_available = true;
CREATE INDEX idx_products_external_id ON products (external_id);
```

#### 3.7.2 `orders` — 注文

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| customer_id | uuid | NOT NULL, FK → customers.id | 注文者 |
| external_order_id | text | UNIQUE | 外部EC注文ID |
| status | text | NOT NULL, DEFAULT 'pending', CHECK | 注文ステータス |
| subtotal | numeric(10,2) | NOT NULL | 小計 |
| discount_amount | numeric(10,2) | NOT NULL, DEFAULT 0 | 割引額 |
| total_amount | numeric(10,2) | NOT NULL | 合計金額 |
| ordered_at | timestamptz | NOT NULL, DEFAULT now() | 注文日時 |
| shipped_at | timestamptz | | 出荷日時 |
| delivered_at | timestamptz | | 配達完了日時 |
| cancelled_at | timestamptz | | キャンセル日時 |
| metadata | jsonb | NOT NULL, DEFAULT '{}' | 追加情報 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新日時 |

`status` 値: `'pending'`, `'confirmed'`, `'shipped'`, `'delivered'`, `'cancelled'`, `'refunded'`

```sql
CREATE TABLE orders (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    external_order_id text UNIQUE,
    status            text NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                              'pending', 'confirmed', 'shipped',
                              'delivered', 'cancelled', 'refunded'
                          )),
    subtotal          numeric(10,2) NOT NULL,
    discount_amount   numeric(10,2) NOT NULL DEFAULT 0,
    total_amount      numeric(10,2) NOT NULL,
    ordered_at        timestamptz NOT NULL DEFAULT now(),
    shipped_at        timestamptz,
    delivered_at      timestamptz,
    cancelled_at      timestamptz,
    metadata          jsonb NOT NULL DEFAULT '{}',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_ordered_at ON orders (ordered_at DESC);
CREATE INDEX idx_orders_external_id ON orders (external_order_id);
```

#### 3.7.3 `order_items` — 注文明細

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主キー |
| order_id | uuid | NOT NULL, FK → orders.id | 注文ID |
| product_id | uuid | NOT NULL, FK → products.id | 商品ID |
| quantity | integer | NOT NULL, DEFAULT 1 | 数量 |
| unit_price | numeric(10,2) | NOT NULL | 購入時単価 |
| subtotal | numeric(10,2) | NOT NULL | 小計（unit_price x quantity） |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 作成日時 |

```sql
CREATE TABLE order_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price  numeric(10,2) NOT NULL,
    subtotal    numeric(10,2) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
```

---

## 4. 共通関数・トリガー

### 4.1 updated_at 自動更新トリガー

```sql
-- updated_at を自動で現在時刻に更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at を持つ全テーブルに適用
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'customers', 'schedules', 'error_trackings',
        'coupon_masters', 'time_slots', 'reservations',
        'segments', 'products', 'orders'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW
             EXECUTE FUNCTION update_updated_at_column()',
            t, t
        );
    END LOOP;
END;
$$;
```

### 4.2 予約枠の reserved_count 自動更新

```sql
-- 予約作成時に time_slots.reserved_count をインクリメント
CREATE OR REPLACE FUNCTION increment_reserved_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE time_slots
    SET reserved_count = reserved_count + 1
    WHERE id = NEW.time_slot_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_increment
AFTER INSERT ON reservations
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION increment_reserved_count();

-- 予約キャンセル時に time_slots.reserved_count をデクリメント
CREATE OR REPLACE FUNCTION decrement_reserved_count()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'no_show') THEN
        UPDATE time_slots
        SET reserved_count = GREATEST(reserved_count - 1, 0)
        WHERE id = NEW.time_slot_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_decrement
AFTER UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION decrement_reserved_count();
```

### 4.3 セグメントメンバー数の自動更新

```sql
CREATE OR REPLACE FUNCTION update_segment_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE segments SET member_count = member_count + 1
        WHERE id = NEW.segment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE segments SET member_count = GREATEST(member_count - 1, 0)
        WHERE id = OLD.segment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_segment_member_count
AFTER INSERT OR DELETE ON segment_members
FOR EACH ROW
EXECUTE FUNCTION update_segment_member_count();
```

---

## 5. Supabase 固有機能の活用

### 5.1 Row Level Security（RLS）

全テーブルで RLS を有効化し、サービスロールキー（`service_role`）経由のサーバーサイドアクセスのみを許可する。管理ダッシュボードは Next.js API Routes から `service_role` キーで接続するため、anon キーでの直接アクセスはブロックする。

```sql
-- 全テーブルで RLS を有効化
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'sent_urls', 'broadcasts', 'schedules', 'execution_logs',
        'error_trackings', 'customers', 'customer_tags',
        'customer_actions', 'coupon_masters', 'coupon_issues',
        'coupon_usages', 'time_slots', 'reservations',
        'segments', 'segment_members', 'delivery_tracks',
        'products', 'orders', 'order_items'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END;
$$;

-- サービスロール用ポリシー（全テーブル共通）
-- service_role は RLS をバイパスするため、明示的なポリシーは不要
-- anon ユーザーにはポリシーなし = アクセス拒否

-- 将来的に顧客自身がLIFF経由でアクセスする場合のポリシー例:
-- CREATE POLICY "customers_read_own"
--     ON customers FOR SELECT
--     USING (line_user_id = current_setting('request.jwt.claims')::jsonb->>'sub');
```

### 5.2 Realtime

以下のテーブルで Realtime 購読を有効化し、管理ダッシュボードのリアルタイム更新を実現する。

```sql
-- Supabase Dashboard から設定、または以下を実行:
ALTER PUBLICATION supabase_realtime ADD TABLE broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE execution_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
```

| テーブル | ユースケース |
|---------|-------------|
| broadcasts | 配信実行の進捗をリアルタイム表示 |
| execution_logs | ログストリームのライブ表示 |
| reservations | 予約状況のリアルタイム反映 |
| orders | 注文ステータス変更の即座反映 |

### 5.3 Edge Functions

| 関数名 | トリガー | 処理内容 |
|--------|---------|---------|
| `process-webhook` | LINE Webhook 受信 | 顧客の upsert、行動履歴の記録 |
| `issue-coupon` | 管理画面操作 / スケジュール | クーポンの個別発行とLINE通知 |
| `sync-segment-members` | 定期実行（cron） | 動的セグメントのメンバー再計算 |
| `send-reservation-reminder` | 定期実行（cron） | 予約リマインダーのLINE送信 |
| `sync-ec-orders` | 外部EC Webhook | 注文データの同期と顧客行動記録 |

### 5.4 Storage

| バケット名 | 用途 | アクセス |
|-----------|------|---------|
| `customer-avatars` | 顧客プロフィール画像のキャッシュ | 認証済みのみ |
| `broadcast-assets` | 配信用画像・リッチメニュー素材 | 認証済みのみ |
| `coupon-images` | クーポン画像 | 公開 |

---

## 6. マイグレーション戦略

### 6.1 移行フェーズ

```
Phase 1: 準備           Phase 2: 二重書込       Phase 3: 切替          Phase 4: 撤去
─────────────────────  ─────────────────────  ─────────────────────  ──────────────
・Supabaseプロジェクト   ・JSON書込と並行して      ・読み取りをSupabaseに   ・JSONファイル
  作成                   Supabaseにも書込         完全切替               読み書き削除
・テーブル作成           ・既存JSONデータの        ・JSON書込を停止        ・storage.ts を
・storage.ts に           一括インポート          ・整合性の最終検証       Supabase版に
  Supabase版を追加       ・読み取りはJSONのまま                           完全置換
```

### 6.2 Phase 1: テーブル作成とクライアントセットアップ

```bash
# Supabase CLI でマイグレーションファイルを生成
npx supabase migration new initial_schema
```

セクション 3 の全 CREATE TABLE 文をマイグレーションファイルに記述する。

### 6.3 Phase 2: データインポートスクリプト

```sql
-- webhook-users.json → customers テーブル
-- インポートスクリプト例（Edge Function または Node.js スクリプト）
INSERT INTO customers (line_user_id, message_count, first_seen_at, last_seen_at)
SELECT
    (elem->>'userId')::text,
    (elem->>'messageCount')::integer,
    (elem->>'firstSeen')::timestamptz,
    (elem->>'lastSeen')::timestamptz
FROM jsonb_array_elements(:webhook_users_json::jsonb) AS elem
ON CONFLICT (line_user_id) DO UPDATE SET
    message_count = EXCLUDED.message_count,
    last_seen_at = EXCLUDED.last_seen_at;

-- line-broadcast-history.json → broadcasts テーブル
INSERT INTO broadcasts (url, title, template_id, status, error_message, sent_at)
SELECT
    (elem->>'url')::text,
    (elem->>'title')::text,
    (elem->>'templateId')::text,
    (elem->>'status')::text,
    (elem->>'error')::text,
    (elem->>'sentAt')::timestamptz
FROM jsonb_array_elements(:broadcast_history_json::jsonb) AS elem;

-- line-sent-urls.json → sent_urls テーブル
INSERT INTO sent_urls (url)
SELECT jsonb_array_elements_text(:sent_urls_json::jsonb)
ON CONFLICT (url) DO NOTHING;

-- execution-logs.json → execution_logs テーブル
INSERT INTO execution_logs (step, result, detail, metadata, executed_at)
SELECT
    (elem->>'step')::text,
    (elem->>'result')::text,
    (elem->>'detail')::text,
    COALESCE(elem->'metadata', '{}')::jsonb,
    (elem->>'executedAt')::timestamptz
FROM jsonb_array_elements(:execution_logs_json::jsonb) AS elem;

-- line-schedule.json → schedules テーブル
INSERT INTO schedules (key, enabled, times, template_id, max_articles_per_run)
VALUES (
    'default',
    (:schedule_json->>'enabled')::boolean,
    ARRAY(SELECT jsonb_array_elements_text(:schedule_json->'times')),
    (:schedule_json->>'templateId')::text,
    (:schedule_json->>'maxArticlesPerRun')::integer
)
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    times = EXCLUDED.times,
    template_id = EXCLUDED.template_id,
    max_articles_per_run = EXCLUDED.max_articles_per_run;
```

### 6.4 Phase 3: storage.ts の置換

`src/lib/line/storage.ts` の `FileStorage` クラスを `SupabaseStorage` クラスに置き換える。インターフェースは維持し、呼び出し元の変更を最小化する。

```typescript
// 移行後のイメージ（概要のみ）
import { createClient } from '@supabase/supabase-js';

class SupabaseStorage {
    private supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    async getSentUrls(): Promise<string[]> {
        const { data } = await this.supabase
            .from('sent_urls')
            .select('url')
            .order('created_at', { ascending: false });
        return (data ?? []).map(r => r.url);
    }

    async addSentUrl(record: BroadcastRecord): Promise<void> {
        await this.supabase.from('sent_urls').upsert({ url: record.url });
        await this.supabase.from('broadcasts').insert({
            url: record.url,
            title: record.title,
            template_id: record.templateId,
            status: record.status,
            error_message: record.error,
            sent_at: record.sentAt,
        });
    }
    // ... 他メソッドも同様に置換
}
```

### 6.5 Phase 4: 検証と撤去

1. Supabase のデータ件数と JSON ファイルの件数を比較検証
2. 1週間の並行稼働期間を設け、不整合がないことを確認
3. JSON 読み書きコードと `data/` ディレクトリを削除
4. `fs` / `path` の import が不要になったことを確認

---

## 7. バックアップ・リカバリ方針

### 7.1 自動バックアップ（Supabase 提供）

| プラン | バックアップ頻度 | 保持期間 |
|--------|---------------|---------|
| Free | 日次 | 7日間 |
| Pro | 日次 | 30日間 |
| Enterprise | 日次 + PITR | カスタム |

### 7.2 追加バックアップ戦略

| 方法 | 頻度 | 保存先 | 内容 |
|------|------|--------|------|
| `pg_dump` 論理バックアップ | 日次 | Supabase Storage / 外部S3 | 全テーブルの SQL ダンプ |
| テーブル単位エクスポート | 週次 | ローカル / S3 | 重要テーブルの CSV エクスポート |
| PITR（Point-in-Time Recovery） | 継続 | Supabase 内部 | WAL ベースのリカバリ（Pro以上） |

### 7.3 リカバリ手順

```
1. 障害検知
   └─ Supabase Health Check / アプリケーションエラー監視

2. 影響範囲の特定
   └─ どのテーブル・時間帯が影響を受けたか確認

3. リカバリ実行
   ├─ 軽微: 個別レコードの手動修正
   ├─ 中度: pg_dump からの部分リストア
   └─ 重大: PITR または日次バックアップからの全体リストア

4. データ整合性検証
   └─ 外部キー制約・ビジネスロジックの整合性チェック

5. 原因分析・再発防止
```

### 7.4 データ保持ポリシー

| テーブル | 保持期間 | 超過時の処理 |
|---------|---------|-------------|
| execution_logs | 90日 | 古いレコードを削除（cron） |
| customer_actions | 365日 | 古いレコードを集約テーブルに移行 |
| delivery_tracks | 180日 | 古いレコードを削除 |
| その他 | 無期限 | - |

```sql
-- 古いログの定期削除（Supabase cron / pg_cron）
SELECT cron.schedule(
    'cleanup-old-logs',
    '0 3 * * *',  -- 毎日 AM 3:00
    $$
    DELETE FROM execution_logs
    WHERE executed_at < now() - INTERVAL '90 days';

    DELETE FROM customer_actions
    WHERE acted_at < now() - INTERVAL '365 days';

    DELETE FROM delivery_tracks
    WHERE created_at < now() - INTERVAL '180 days';
    $$
);
```

---

## 8. パフォーマンス最適化

### 8.1 インデックス戦略

全テーブルのインデックスはセクション 3 の各 CREATE TABLE 直後に定義済み。設計方針は以下の通り。

| 種別 | 適用箇所 | 理由 |
|------|---------|------|
| B-tree（デフォルト） | 外部キー、ステータス、日付 | 等価検索・範囲検索の高速化 |
| GIN | jsonb カラム（attributes, action_detail） | JSON 内部検索の高速化 |
| 部分インデックス | `WHERE is_active = true`, `WHERE blocked_at IS NULL` | アクティブレコードのみの検索最適化 |
| 複合インデックス | `(customer_id, action_type)`, `(broadcast_id, status)` | 頻出クエリパターンの最適化 |

### 8.2 パーティショニング

大量のレコードが見込まれるテーブルに対し、月単位のレンジパーティショニングを適用する。

```sql
-- customer_actions を月単位でパーティショニング
CREATE TABLE customer_actions (
    id            uuid NOT NULL DEFAULT gen_random_uuid(),
    customer_id   uuid NOT NULL,
    action_type   text NOT NULL,
    action_detail jsonb NOT NULL DEFAULT '{}',
    source        text,
    acted_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, acted_at)
) PARTITION BY RANGE (acted_at);

-- パーティション作成（例: 2026年）
CREATE TABLE customer_actions_2026_01 PARTITION OF customer_actions
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE customer_actions_2026_02 PARTITION OF customer_actions
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE customer_actions_2026_03 PARTITION OF customer_actions
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- ... 以降、月ごとに作成

-- パーティション自動作成（pg_partman または cron で月次実行）
-- 新しい月のパーティションを事前作成するスクリプトを用意する

-- delivery_tracks も同様にパーティショニング可能
CREATE TABLE delivery_tracks (
    id            uuid NOT NULL DEFAULT gen_random_uuid(),
    broadcast_id  uuid NOT NULL,
    customer_id   uuid NOT NULL,
    status        text NOT NULL DEFAULT 'sent',
    delivered_at  timestamptz,
    opened_at     timestamptz,
    clicked_at    timestamptz,
    error_message text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
```

> **注意**: パーティショニングを適用する場合、セクション 3 の通常の CREATE TABLE 文ではなく上記のパーティション定義を使用する。外部キー制約はパーティションテーブルでは直接使用できないため、アプリケーション側で整合性を保証するか、トリガーで制約を実現する。初期段階ではデータ量が小さいため、通常テーブルで開始し、データ増加に応じてパーティショニングへ移行することを推奨する。

### 8.3 クエリ最適化のガイドライン

| パターン | 推奨手法 |
|---------|---------|
| 顧客一覧（ページネーション） | `LIMIT` / `OFFSET` ではなくカーソルベース（`WHERE id > :last_id`） |
| セグメント配信対象の取得 | `segment_members` との JOIN + バッチ処理（1000件単位） |
| 行動履歴の集計 | マテリアライズドビューを活用し、日次で更新 |
| ダッシュボード統計 | 集約テーブルまたはマテリアライズドビューで事前計算 |

```sql
-- ダッシュボード用マテリアライズドビュー例
CREATE MATERIALIZED VIEW mv_daily_broadcast_stats AS
SELECT
    date_trunc('day', sent_at) AS broadcast_date,
    COUNT(*) AS total_broadcasts,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success_count,
    COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count
FROM broadcasts
GROUP BY date_trunc('day', sent_at)
ORDER BY broadcast_date DESC;

CREATE UNIQUE INDEX idx_mv_daily_broadcast_stats_date
    ON mv_daily_broadcast_stats (broadcast_date);

-- 日次リフレッシュ
SELECT cron.schedule(
    'refresh-broadcast-stats',
    '0 4 * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_broadcast_stats'
);

-- 顧客行動サマリーのマテリアライズドビュー
CREATE MATERIALIZED VIEW mv_customer_action_summary AS
SELECT
    customer_id,
    action_type,
    COUNT(*) AS action_count,
    MAX(acted_at) AS last_acted_at
FROM customer_actions
GROUP BY customer_id, action_type;

CREATE UNIQUE INDEX idx_mv_customer_action_summary
    ON mv_customer_action_summary (customer_id, action_type);
```

### 8.4 コネクションプーリング

Supabase では PgBouncer によるコネクションプーリングが標準提供される。Next.js の API Routes / Edge Functions からの接続には、プーリングモードの接続文字列を使用する。

| 接続タイプ | ポート | 用途 |
|-----------|-------|------|
| Direct | 5432 | マイグレーション、管理操作 |
| Pooler (Transaction mode) | 6543 | アプリケーションからの通常クエリ |

```
# .env.local
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
SUPABASE_DB_POOLER_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

---

## 9. 全テーブル CREATE 文（一括実行用）

以下は全テーブルを依存関係順に作成する一括 SQL である。Supabase の SQL Editor またはマイグレーションファイルに貼り付けて実行する。

```sql
-- ============================================================================
-- LineMag Database Schema - Full Migration
-- 対象: Supabase (PostgreSQL 15+)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. 既存データ移行テーブル
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE sent_urls (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url         text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE broadcasts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url           text NOT NULL,
    title         text NOT NULL,
    template_id   text,
    status        text NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    error_message text,
    sent_at       timestamptz NOT NULL,
    metadata      jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE schedules (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key                   text NOT NULL UNIQUE DEFAULT 'default',
    enabled               boolean NOT NULL DEFAULT false,
    times                 text[] NOT NULL DEFAULT '{}',
    template_id           text NOT NULL DEFAULT 'daily-column',
    max_articles_per_run  integer NOT NULL DEFAULT 3,
    updated_at            timestamptz NOT NULL DEFAULT now(),
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE execution_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step        text NOT NULL CHECK (step IN ('SCRAPE', 'SUMMARIZE', 'BROADCAST', 'CRON')),
    result      text NOT NULL CHECK (result IN ('SUCCESS', 'ERROR', 'SKIP')),
    detail      text NOT NULL,
    metadata    jsonb NOT NULL DEFAULT '{}',
    executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE error_trackings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key                 text NOT NULL UNIQUE DEFAULT 'default',
    consecutive_errors  integer NOT NULL DEFAULT 0,
    last_error_at       timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. 顧客管理テーブル
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE customers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id    text NOT NULL UNIQUE,
    display_name    text,
    picture_url     text,
    status_message  text,
    email           text,
    phone           text,
    gender          text CHECK (gender IN ('male', 'female', 'other')),
    birth_date      date,
    prefecture      text,
    membership_tier text NOT NULL DEFAULT 'free'
                        CHECK (membership_tier IN ('free', 'silver', 'gold', 'platinum')),
    message_count   integer NOT NULL DEFAULT 0,
    first_seen_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    blocked_at      timestamptz,
    attributes      jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_tags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag         text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (customer_id, tag)
);

CREATE TABLE customer_actions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    action_type   text NOT NULL CHECK (action_type IN (
                      'message_received', 'link_tap', 'purchase',
                      'follow', 'unfollow', 'coupon_use',
                      'reservation', 'page_view'
                  )),
    action_detail jsonb NOT NULL DEFAULT '{}',
    source        text,
    acted_at      timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. セグメントテーブル（クーポンの FK 先として先に作成）
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE segments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text NOT NULL UNIQUE,
    description       text,
    segment_type      text NOT NULL DEFAULT 'static'
                          CHECK (segment_type IN ('static', 'dynamic')),
    filter_conditions jsonb,
    member_count      integer NOT NULL DEFAULT 0,
    is_active         boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE segment_members (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id  uuid NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (segment_id, customer_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. クーポンテーブル
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE coupon_masters (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                   text NOT NULL UNIQUE,
    name                   text NOT NULL,
    description            text,
    discount_type          text NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value         numeric(10,2) NOT NULL,
    min_purchase_amount    numeric(10,2) DEFAULT 0,
    max_issues             integer,
    max_uses_per_customer  integer NOT NULL DEFAULT 1,
    valid_from             timestamptz NOT NULL,
    valid_until            timestamptz NOT NULL,
    is_active              boolean NOT NULL DEFAULT true,
    target_segment_id      uuid REFERENCES segments(id) ON DELETE SET NULL,
    metadata               jsonb NOT NULL DEFAULT '{}',
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_period CHECK (valid_until > valid_from),
    CONSTRAINT valid_discount CHECK (
        (discount_type = 'fixed' AND discount_value > 0) OR
        (discount_type = 'percentage' AND discount_value > 0 AND discount_value <= 100)
    )
);

CREATE TABLE coupon_issues (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_master_id uuid NOT NULL REFERENCES coupon_masters(id) ON DELETE RESTRICT,
    customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    issue_code       text NOT NULL UNIQUE,
    status           text NOT NULL DEFAULT 'issued'
                         CHECK (status IN ('issued', 'used', 'expired', 'revoked')),
    issued_at        timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    used_at          timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. 予約テーブル
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE time_slots (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_date      date NOT NULL,
    start_time     time NOT NULL,
    end_time       time NOT NULL,
    capacity       integer NOT NULL DEFAULT 1,
    reserved_count integer NOT NULL DEFAULT 0,
    is_available   boolean NOT NULL DEFAULT true,
    metadata       jsonb NOT NULL DEFAULT '{}',
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_capacity CHECK (reserved_count <= capacity),
    UNIQUE (slot_date, start_time, end_time)
);

CREATE TABLE reservations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    time_slot_id     uuid NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    status           text NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    google_meet_url  text,
    notes            text,
    reminder_sent_at timestamptz,
    cancelled_at     timestamptz,
    metadata         jsonb NOT NULL DEFAULT '{}',
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. 配信追跡テーブル
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE delivery_tracks (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id  uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status        text NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    delivered_at  timestamptz,
    opened_at     timestamptz,
    clicked_at    timestamptz,
    error_message text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. EC連携テーブル
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE products (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     text UNIQUE,
    name            text NOT NULL,
    description     text,
    price           numeric(10,2) NOT NULL,
    category        text,
    image_url       text,
    stock_quantity  integer NOT NULL DEFAULT 0,
    is_available    boolean NOT NULL DEFAULT true,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    external_order_id text UNIQUE,
    status            text NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                              'pending', 'confirmed', 'shipped',
                              'delivered', 'cancelled', 'refunded'
                          )),
    subtotal          numeric(10,2) NOT NULL,
    discount_amount   numeric(10,2) NOT NULL DEFAULT 0,
    total_amount      numeric(10,2) NOT NULL,
    ordered_at        timestamptz NOT NULL DEFAULT now(),
    shipped_at        timestamptz,
    delivered_at      timestamptz,
    cancelled_at      timestamptz,
    metadata          jsonb NOT NULL DEFAULT '{}',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price  numeric(10,2) NOT NULL,
    subtotal    numeric(10,2) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coupon_usages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_issue_id uuid NOT NULL REFERENCES coupon_issues(id) ON DELETE RESTRICT,
    order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
    discount_amount numeric(10,2) NOT NULL,
    used_at         timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. インデックス
-- ────────────────────────────────────────────────────────────────────────────

-- sent_urls
CREATE INDEX idx_sent_urls_url ON sent_urls (url);
CREATE INDEX idx_sent_urls_created_at ON sent_urls (created_at DESC);

-- broadcasts
CREATE INDEX idx_broadcasts_sent_at ON broadcasts (sent_at DESC);
CREATE INDEX idx_broadcasts_status ON broadcasts (status);
CREATE INDEX idx_broadcasts_url ON broadcasts (url);

-- execution_logs
CREATE INDEX idx_execution_logs_executed_at ON execution_logs (executed_at DESC);
CREATE INDEX idx_execution_logs_step ON execution_logs (step);
CREATE INDEX idx_execution_logs_result ON execution_logs (result);
CREATE INDEX idx_execution_logs_step_executed ON execution_logs (step, executed_at DESC);

-- customers
CREATE INDEX idx_customers_membership_tier ON customers (membership_tier);
CREATE INDEX idx_customers_prefecture ON customers (prefecture);
CREATE INDEX idx_customers_blocked_at ON customers (blocked_at) WHERE blocked_at IS NULL;
CREATE INDEX idx_customers_last_seen_at ON customers (last_seen_at DESC);
CREATE INDEX idx_customers_attributes ON customers USING GIN (attributes);

-- customer_tags
CREATE INDEX idx_customer_tags_customer_id ON customer_tags (customer_id);
CREATE INDEX idx_customer_tags_tag ON customer_tags (tag);

-- customer_actions
CREATE INDEX idx_customer_actions_customer_id ON customer_actions (customer_id);
CREATE INDEX idx_customer_actions_type ON customer_actions (action_type);
CREATE INDEX idx_customer_actions_acted_at ON customer_actions (acted_at DESC);
CREATE INDEX idx_customer_actions_customer_type ON customer_actions (customer_id, action_type);
CREATE INDEX idx_customer_actions_detail ON customer_actions USING GIN (action_detail);

-- segments
CREATE INDEX idx_segments_type ON segments (segment_type);
CREATE INDEX idx_segments_active ON segments (is_active) WHERE is_active = true;

-- segment_members
CREATE INDEX idx_segment_members_segment_id ON segment_members (segment_id);
CREATE INDEX idx_segment_members_customer_id ON segment_members (customer_id);

-- coupon_masters
CREATE INDEX idx_coupon_masters_code ON coupon_masters (code);
CREATE INDEX idx_coupon_masters_active ON coupon_masters (is_active) WHERE is_active = true;
CREATE INDEX idx_coupon_masters_valid ON coupon_masters (valid_from, valid_until);

-- coupon_issues
CREATE INDEX idx_coupon_issues_customer_id ON coupon_issues (customer_id);
CREATE INDEX idx_coupon_issues_master_id ON coupon_issues (coupon_master_id);
CREATE INDEX idx_coupon_issues_status ON coupon_issues (status);
CREATE INDEX idx_coupon_issues_code ON coupon_issues (issue_code);

-- coupon_usages
CREATE INDEX idx_coupon_usages_issue_id ON coupon_usages (coupon_issue_id);
CREATE INDEX idx_coupon_usages_order_id ON coupon_usages (order_id);

-- time_slots
CREATE INDEX idx_time_slots_date ON time_slots (slot_date);
CREATE INDEX idx_time_slots_available ON time_slots (slot_date, is_available)
    WHERE is_available = true;

-- reservations
CREATE INDEX idx_reservations_customer_id ON reservations (customer_id);
CREATE INDEX idx_reservations_time_slot_id ON reservations (time_slot_id);
CREATE INDEX idx_reservations_status ON reservations (status);
CREATE INDEX idx_reservations_created_at ON reservations (created_at DESC);

-- delivery_tracks
CREATE INDEX idx_delivery_tracks_broadcast_id ON delivery_tracks (broadcast_id);
CREATE INDEX idx_delivery_tracks_customer_id ON delivery_tracks (customer_id);
CREATE INDEX idx_delivery_tracks_status ON delivery_tracks (status);
CREATE INDEX idx_delivery_tracks_broadcast_status ON delivery_tracks (broadcast_id, status);

-- products
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_available ON products (is_available) WHERE is_available = true;
CREATE INDEX idx_products_external_id ON products (external_id);

-- orders
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_ordered_at ON orders (ordered_at DESC);
CREATE INDEX idx_orders_external_id ON orders (external_order_id);

-- order_items
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. トリガー関数
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'customers', 'schedules', 'error_trackings',
        'coupon_masters', 'time_slots', 'reservations',
        'segments', 'products', 'orders'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW
             EXECUTE FUNCTION update_updated_at_column()',
            t, t
        );
    END LOOP;
END;
$$;

-- 予約枠のカウント管理
CREATE OR REPLACE FUNCTION increment_reserved_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE time_slots
    SET reserved_count = reserved_count + 1
    WHERE id = NEW.time_slot_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_increment
AFTER INSERT ON reservations
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION increment_reserved_count();

CREATE OR REPLACE FUNCTION decrement_reserved_count()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'no_show') THEN
        UPDATE time_slots
        SET reserved_count = GREATEST(reserved_count - 1, 0)
        WHERE id = NEW.time_slot_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_decrement
AFTER UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION decrement_reserved_count();

-- セグメントメンバー数の管理
CREATE OR REPLACE FUNCTION update_segment_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE segments SET member_count = member_count + 1
        WHERE id = NEW.segment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE segments SET member_count = GREATEST(member_count - 1, 0)
        WHERE id = OLD.segment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_segment_member_count
AFTER INSERT OR DELETE ON segment_members
FOR EACH ROW
EXECUTE FUNCTION update_segment_member_count();

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Row Level Security
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'sent_urls', 'broadcasts', 'schedules', 'execution_logs',
        'error_trackings', 'customers', 'customer_tags',
        'customer_actions', 'coupon_masters', 'coupon_issues',
        'coupon_usages', 'time_slots', 'reservations',
        'segments', 'segment_members', 'delivery_tracks',
        'products', 'orders', 'order_items'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. Realtime 有効化
-- ────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE execution_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

COMMIT;
```

---

## 10. テーブル一覧サマリー

| # | テーブル名 | 分類 | レコード想定規模 | パーティション |
|---|-----------|------|-----------------|---------------|
| 1 | sent_urls | 既存移行 | 数百〜数千 | 不要 |
| 2 | broadcasts | 既存移行 | 数千 | 不要 |
| 3 | schedules | 既存移行 | 1〜数件 | 不要 |
| 4 | execution_logs | 既存移行 | 数万 | 検討 |
| 5 | error_trackings | 既存移行 | 1〜数件 | 不要 |
| 6 | customers | 新規 | 数千〜数万 | 不要 |
| 7 | customer_tags | 新規 | 数万 | 不要 |
| 8 | customer_actions | 新規 | 数十万〜数百万 | 月次レンジ |
| 9 | segments | 新規 | 数十 | 不要 |
| 10 | segment_members | 新規 | 数万 | 不要 |
| 11 | coupon_masters | 新規 | 数百 | 不要 |
| 12 | coupon_issues | 新規 | 数千〜数万 | 不要 |
| 13 | coupon_usages | 新規 | 数千 | 不要 |
| 14 | time_slots | 新規 | 数千 | 不要 |
| 15 | reservations | 新規 | 数千〜数万 | 不要 |
| 16 | delivery_tracks | 新規 | 数十万〜数百万 | 月次レンジ |
| 17 | products | 新規 | 数百〜数千 | 不要 |
| 18 | orders | 新規 | 数千〜数万 | 不要 |
| 19 | order_items | 新規 | 数万 | 不要 |
