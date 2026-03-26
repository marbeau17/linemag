# LineMag 顧客属性定義 仕様書

| 項目 | 内容 |
|------|------|
| 文書ID | SPEC-CA |
| 対象システム | LineMag (Next.js 14 / Vercel / Supabase) |
| 作成日 | 2026-03-26 |
| ステータス | Draft |
| 関連文書 | SPEC-01 (LSTEP連携), SPEC-06 (顧客向けUI/UX), SPEC-12 (データベーススキーマ) |

---

## 目次

1. [概要](#1-概要)
2. [属性カテゴリ](#2-属性カテゴリ)
3. [データベース設計](#3-データベース設計)
4. [顧客詳細画面の改善](#4-顧客詳細画面の改善)
5. [カスタムフィールド管理画面](#5-カスタムフィールド管理画面)
6. [アンケート連携（L-STEP風）](#6-アンケート連携lstep風)
7. [自動属性更新ルール](#7-自動属性更新ルール)
8. [セグメントとの連携](#8-セグメントとの連携)
9. [API設計](#9-api設計)
10. [実装優先度](#10-実装優先度)

---

## 1. 概要

### 1.1 背景と目的

L-STEP（LINE STEP）は、LINE公式アカウントの自動化・CRM ツールとして広く普及しており、「友だち情報管理」「カスタムフィールド」「回答フォーム」「スコアリング」「流入経路分析」などの顧客属性管理機能を提供している。

本仕様書では、L-STEPの顧客属性管理機能を参考に、LineMag独自の顧客属性管理システムを設計する。LINE友だちの情報を体系的に管理し、セグメント配信・パーソナライゼーションに活用することを目的とする。

### 1.2 L-STEPの主要機能との対応

| L-STEPの機能 | LineMagでの対応 | 説明 |
|-------------|----------------|------|
| 友だち情報（標準項目） | 個人情報属性 | 氏名・連絡先・住所等の基本プロフィール |
| カスタムフィールド | カスタム属性 | 管理者が自由に定義できるフィールド |
| 回答フォーム | アンケート連携 | LIFFフォームで属性を収集・自動反映 |
| スコアリング | エンゲージメントスコア | 行動ベースの自動スコアリング |
| 流入経路分析 | 流入属性 | QR/URL/キャンペーン別の流入元追跡 |
| タグ管理 | 拡張タグシステム | カテゴリ・階層・自動付与ルール対応 |
| 対応マーク | ライフサイクルステージ | new/active/dormant/churned の自動判定 |

### 1.3 設計方針

- **既存テーブルとの互換性**: 現在の `customers` テーブル構造を維持しつつ、カラムを追加する形で拡張する
- **スキーマレス拡張**: カスタムフィールドは EAV（Entity-Attribute-Value）パターンで実装し、管理者が自由に属性を定義可能にする
- **自動収集の最大化**: LINE APIから取得できる情報は自動で取り込み、手動入力を最小限にする
- **プライバシー配慮**: 個人情報は暗号化対象とし、GDPR/個人情報保護法に準拠した管理を行う

---

## 2. 属性カテゴリ

### 2.1 基本情報（LINE提供）

LINE Messaging API の `getProfile` で自動取得される情報。既存の `customers` テーブルで管理済み。

| 属性名 | フィールド名 | 型 | 説明 | 取得タイミング |
|--------|-------------|-----|------|---------------|
| LINE User ID | lineUserId | string | LINE固有のユーザー識別子 | follow / webhook |
| LINE表示名 | displayName | string | LINEプロフィール名 | follow / 定期更新 |
| プロフィール画像 | pictureUrl | string | プロフィール画像URL | follow / 定期更新 |
| ステータスメッセージ | statusMessage | string | LINEステータス | follow / 定期更新 |

**注意事項:**
- `displayName` はユーザーが随時変更できるため、定期的に再取得が必要
- `pictureUrl` は一時URLのため、永続化する場合はストレージにコピーする
- LINE API の仕様により、ブロック中のユーザーの `getProfile` はエラーとなる

### 2.2 個人情報（ユーザー入力 / 管理者入力）

L-STEPの「友だち情報」に相当する属性群。アンケートフォーム、LIFF画面、または管理者の手動入力で収集する。

| 属性名 | フィールド名 | 型 | 制約 | 説明 | 入力方法 |
|--------|-------------|-----|------|------|---------|
| 氏名（漢字） | fullName | string | 最大100文字 | 本名（姓名） | アンケート / 管理者入力 |
| 氏名（フリガナ） | fullNameKana | string | 最大100文字、カタカナのみ | カタカナ表記 | アンケート |
| ニックネーム | nickname | string | 最大50文字 | 呼び名（メッセージ差し込み用） | アンケート |
| メールアドレス | email | string | メール形式 | 連絡先 | アンケート / LIFF |
| 電話番号 | phone | string | 数字・ハイフン | 連絡先 | アンケート |
| 生年月日 | birthDate | date | YYYY-MM-DD | 誕生日配信・年齢算出に使用 | アンケート |
| 性別 | gender | enum | male / female / other | 性別 | アンケート |
| 郵便番号 | postalCode | string | 7桁数字 | 住所特定・エリア配信 | アンケート |
| 都道府県 | prefecture | string | 47都道府県 | エリア配信に使用 | アンケート / 郵便番号から自動 |
| 市区町村 | city | string | 最大100文字 | エリア詳細 | アンケート / 郵便番号から自動 |
| 職業 | occupation | string | 最大50文字 | セグメント用 | アンケート |
| 会社名 | company | string | 最大100文字 | B2B対応 | アンケート |
| 年齢層 | ageGroup | enum | 10s / 20s / 30s / 40s / 50s / 60plus | 年代セグメント | アンケート / 生年月日から自動算出 |

**性別の選択肢:**

```
male    : 男性
female  : 女性
other   : その他 / 回答しない
```

**年齢層の定義:**

```
10s     : 10代（10-19歳）
20s     : 20代（20-29歳）
30s     : 30代（30-39歳）
40s     : 40代（40-49歳）
50s     : 50代（50-59歳）
60plus  : 60歳以上
```

**都道府県マスタ:**

```
北海道, 青森県, 岩手県, 宮城県, 秋田県, 山形県, 福島県,
茨城県, 栃木県, 群馬県, 埼玉県, 千葉県, 東京都, 神奈川県,
新潟県, 富山県, 石川県, 福井県, 山梨県, 長野県,
岐阜県, 静岡県, 愛知県, 三重県,
滋賀県, 京都府, 大阪府, 兵庫県, 奈良県, 和歌山県,
鳥取県, 島根県, 岡山県, 広島県, 山口県,
徳島県, 香川県, 愛媛県, 高知県,
福岡県, 佐賀県, 長崎県, 熊本県, 大分県, 宮崎県, 鹿児島県, 沖縄県
```

### 2.3 行動属性（自動計算）

L-STEPの「スコアリング」「流入経路」「対応マーク」に相当する属性群。システムが自動的に計測・算出する。

#### 2.3.1 流入属性

| 属性名 | フィールド名 | 型 | 説明 | 更新タイミング |
|--------|-------------|-----|------|---------------|
| 流入経路 | acquisitionSource | string | QR / URL / 検索 / 紹介 等 | follow時に1回 |
| 流入メディア | acquisitionMedium | string | organic / paid / referral / direct | follow時に1回 |
| 流入キャンペーン | acquisitionCampaign | string | キャンペーン名・識別子 | follow時に1回 |

**流入経路の判別ロジック:**

```
友だち追加URL に utm_source / utm_medium / utm_campaign パラメータを付与し、
Webhook の follow イベント受信時に解析してcustomersレコードに保存する。

例:
  https://lin.ee/xxxxx?utm_source=instagram&utm_medium=paid&utm_campaign=spring2026
  -> acquisitionSource = "instagram"
  -> acquisitionMedium = "paid"
  -> acquisitionCampaign = "spring2026"

パラメータがない場合:
  -> acquisitionSource = "direct"
  -> acquisitionMedium = "organic"
  -> acquisitionCampaign = null
```

#### 2.3.2 エンゲージメント属性

| 属性名 | フィールド名 | 型 | 説明 | 更新タイミング |
|--------|-------------|-----|------|---------------|
| 友だち追加日時 | firstSeenAt | datetime | 初回follow日時 | follow時に1回 |
| 最終接触日時 | lastSeenAt | datetime | 直近のアクション日時 | 各アクション時 |
| メッセージ数 | messageCount | number | ユーザーからの受信メッセージ数 | メッセージ受信時 |
| エンゲージメントスコア | engagementScore | number (0-100) | 総合エンゲージメント指標 | 日次バッチ |
| ライフサイクルステージ | lifecycleStage | enum | ユーザーの活動状態 | 日次バッチ |

**エンゲージメントスコアの算出ロジック:**

```
スコア = SUM(各要素のスコア) を 0-100 にスケーリング

要素と配点:
  [接触頻度]     直近7日間のメッセージ数  x 5pt   (上限 30pt)
  [継続性]       友だち追加からの日数       段階加算 (上限 15pt)
                   30日未満: 5pt / 90日未満: 10pt / 90日以上: 15pt
  [アクション]   直近30日間のアクション数  x 3pt   (上限 25pt)
                   (メッセージ送信、リッチメニュータップ、LIFF閲覧等)
  [購買]         購入回数                  x 5pt   (上限 20pt)
  [クーポン]     クーポン利用回数          x 3pt   (上限 10pt)

  合計: 最大 100pt
```

**ライフサイクルステージの定義:**

| ステージ | 値 | 判定条件 | 説明 |
|---------|-----|---------|------|
| 新規 | new | 友だち追加から14日以内 | 新しく友だちになったユーザー |
| アクティブ | active | 直近30日以内にアクションあり | 活発に利用しているユーザー |
| 休眠 | dormant | 30-90日間アクションなし | 利用が減少しているユーザー |
| 離脱 | churned | 90日以上アクションなし、またはブロック | 事実上離脱したユーザー |

```
判定フロー（日次バッチ）:

1. blocked_at IS NOT NULL -> churned
2. last_seen_at < now() - 90 days -> churned
3. last_seen_at < now() - 30 days -> dormant
4. first_seen_at > now() - 14 days -> new
5. それ以外 -> active
```

#### 2.3.3 購買・利用属性

| 属性名 | フィールド名 | 型 | 説明 | 更新タイミング |
|--------|-------------|-----|------|---------------|
| 累計購入金額 | totalPurchaseAmount | number | EC連携での累計金額 | 購入確定時 |
| 購入回数 | purchaseCount | number | EC連携での累計回数 | 購入確定時 |
| 最終購入日 | lastPurchaseAt | datetime | 直近の購入日 | 購入確定時 |
| 予約回数 | reservationCount | number | 予約機能の利用回数 | 予約確定時 |
| クーポン利用回数 | couponUsageCount | number | クーポンの使用回数 | クーポン利用時 |

### 2.4 カスタム属性（管理者定義）

L-STEPの「カスタムフィールド」に相当。管理者が自由に属性を定義できる拡張フィールド。

#### 対応する型

| 型 | field_type | 格納カラム | 説明 | 用途例 |
|----|-----------|-----------|------|--------|
| テキスト型 | text | value_text | 自由入力テキスト | 備考、メモ、特記事項 |
| 数値型 | number | value_number | 数値データ | ポイント残高、来店回数 |
| 日付型 | date | value_date | 日付データ | 契約開始日、有効期限 |
| 選択型 | select | value_text | 単一選択（管理者が選択肢を定義） | 会員ランク、関心カテゴリ |
| 複数選択型 | multiselect | value_json | 複数選択（配列で格納） | 興味のあるサービス |
| チェックボックス型 | boolean | value_boolean | ON/OFF | メルマガ購読、同意フラグ |

#### カスタムフィールド定義の例

```json
[
  {
    "name": "関心カテゴリ",
    "field_key": "interest_category",
    "field_type": "select",
    "options": ["IT", "Marketing", "Finance", "HR", "Legal"],
    "is_required": false,
    "display_order": 1,
    "description": "ユーザーが最も関心のある分野"
  },
  {
    "name": "利用中のサービス",
    "field_key": "current_services",
    "field_type": "multiselect",
    "options": ["ServiceA", "ServiceB", "ServiceC", "ServiceD"],
    "is_required": false,
    "display_order": 2,
    "description": "現在利用中のサービス（複数選択可）"
  },
  {
    "name": "メルマガ購読",
    "field_key": "newsletter_subscribed",
    "field_type": "boolean",
    "options": [],
    "is_required": false,
    "display_order": 3,
    "description": "メールマガジンの購読有無"
  }
]
```

#### 制約事項

- カスタムフィールドは最大 **50個** まで定義可能
- `field_key` はシステム全体で一意、英数字とアンダースコアのみ（`/^[a-z][a-z0-9_]{1,49}$/`）
- 選択型・複数選択型の選択肢は最大 **100個** まで
- フィールド削除時は関連する `custom_field_values` も CASCADE 削除される

### 2.5 タグ（既存機能拡張）

現在の `customer_tags` テーブルを拡張し、L-STEPのタグ管理に相当する機能を実現する。

#### 拡張ポイント

**1. タグカテゴリ**

タグをカテゴリで分類し、管理しやすくする。

| カテゴリ例 | 色 | 用途 |
|-----------|-----|------|
| 興味関心 | #3b82f6 (青) | ユーザーの関心分野 |
| ステータス | #10b981 (緑) | 対応状況・進捗 |
| 流入経路 | #f59e0b (黄) | 友だち追加の経路 |
| キャンペーン | #ef4444 (赤) | 参加キャンペーン |
| カスタム | #6b7280 (グレー) | その他の分類 |

**2. タグ階層（親タグ → 子タグ）**

```
興味関心（カテゴリ）
  ├── IT
  │   ├── AI/ML
  │   ├── Web開発
  │   └── インフラ
  ├── マーケティング
  │   ├── SNS運用
  │   └── 広告運用
  └── 経営
      ├── 人事
      └── 財務
```

**3. 自動タグ付与ルール**

条件に一致した場合にタグを自動的に付与する仕組み。

```
ルール例:
  条件: purchaseCount >= 3 AND totalPurchaseAmount >= 10000
  アクション: タグ「リピーター」を付与

  条件: lifecycleStage == "dormant"
  アクション: タグ「要フォロー」を付与

  条件: acquisitionSource == "instagram"
  アクション: タグ「Instagram流入」を付与
```

**4. タグの色分け**

タグ個別に色を設定可能にし、視認性を向上させる。

---

## 3. データベース設計

### 3.1 customersテーブル拡張

既存の `customers` テーブル（SPEC-12 参照）に以下のカラムを追加する。

**既存カラム（変更なし）:**

```
id, line_user_id, display_name, picture_url, status_message,
email, phone, gender, birth_date, prefecture,
membership_tier, message_count, first_seen_at, last_seen_at,
blocked_at, attributes, created_at, updated_at
```

**追加カラム:**

| カラム名 | 型 | デフォルト | 説明 |
|---------|-----|----------|------|
| full_name | text | NULL | 氏名（漢字） |
| full_name_kana | text | NULL | 氏名（フリガナ） |
| nickname | text | NULL | ニックネーム |
| postal_code | text | NULL | 郵便番号 |
| city | text | NULL | 市区町村 |
| occupation | text | NULL | 職業 |
| company | text | NULL | 会社名 |
| age_group | text | NULL | 年齢層 |
| acquisition_source | text | NULL | 流入経路 |
| acquisition_medium | text | NULL | 流入メディア |
| acquisition_campaign | text | NULL | 流入キャンペーン |
| engagement_score | integer | 0 | エンゲージメントスコア |
| lifecycle_stage | text | 'new' | ライフサイクルステージ |
| total_purchase_amount | numeric(12,2) | 0 | 累計購入金額 |
| purchase_count | integer | 0 | 購入回数 |
| last_purchase_at | timestamptz | NULL | 最終購入日 |
| reservation_count | integer | 0 | 予約回数 |
| coupon_usage_count | integer | 0 | クーポン利用回数 |

**マイグレーションSQL:**

```sql
-- customers テーブルへのカラム追加
ALTER TABLE customers ADD COLUMN full_name text;
ALTER TABLE customers ADD COLUMN full_name_kana text;
ALTER TABLE customers ADD COLUMN nickname text;
ALTER TABLE customers ADD COLUMN postal_code text;
ALTER TABLE customers ADD COLUMN city text;
ALTER TABLE customers ADD COLUMN occupation text;
ALTER TABLE customers ADD COLUMN company text;
ALTER TABLE customers ADD COLUMN age_group text
    CHECK (age_group IN ('10s', '20s', '30s', '40s', '50s', '60plus'));
ALTER TABLE customers ADD COLUMN acquisition_source text;
ALTER TABLE customers ADD COLUMN acquisition_medium text;
ALTER TABLE customers ADD COLUMN acquisition_campaign text;
ALTER TABLE customers ADD COLUMN engagement_score integer NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN lifecycle_stage text NOT NULL DEFAULT 'new'
    CHECK (lifecycle_stage IN ('new', 'active', 'dormant', 'churned'));
ALTER TABLE customers ADD COLUMN total_purchase_amount numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN purchase_count integer NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN last_purchase_at timestamptz;
ALTER TABLE customers ADD COLUMN reservation_count integer NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN coupon_usage_count integer NOT NULL DEFAULT 0;

-- 追加インデックス
CREATE INDEX idx_customers_engagement_score ON customers (engagement_score DESC);
CREATE INDEX idx_customers_lifecycle_stage ON customers (lifecycle_stage);
CREATE INDEX idx_customers_acquisition_source ON customers (acquisition_source);
CREATE INDEX idx_customers_age_group ON customers (age_group);
CREATE INDEX idx_customers_total_purchase_amount ON customers (total_purchase_amount DESC);
CREATE INDEX idx_customers_full_name ON customers (full_name) WHERE full_name IS NOT NULL;
CREATE INDEX idx_customers_postal_code ON customers (postal_code) WHERE postal_code IS NOT NULL;
```

### 3.2 custom_field_definitions テーブル（新規）

管理者がカスタムフィールドを定義するためのマスタテーブル。

```sql
CREATE TABLE custom_field_definitions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    field_key     text NOT NULL UNIQUE,
    field_type    text NOT NULL
                      CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'boolean')),
    options       jsonb NOT NULL DEFAULT '[]',
    is_required   boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    description   text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- field_key のフォーマットチェック
ALTER TABLE custom_field_definitions
    ADD CONSTRAINT chk_field_key_format
    CHECK (field_key ~ '^[a-z][a-z0-9_]{1,49}$');

-- 最大50件の制約はアプリケーション層で制御

CREATE INDEX idx_custom_field_definitions_display_order
    ON custom_field_definitions (display_order);
CREATE INDEX idx_custom_field_definitions_field_type
    ON custom_field_definitions (field_type);
```

### 3.3 custom_field_values テーブル（新規）

各顧客のカスタムフィールド値を格納するEAVテーブル。

```sql
CREATE TABLE custom_field_values (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    field_id      uuid NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    value_text    text,
    value_number  numeric,
    value_date    date,
    value_json    jsonb,
    value_boolean boolean,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (customer_id, field_id)
);

CREATE INDEX idx_custom_field_values_customer_id
    ON custom_field_values (customer_id);
CREATE INDEX idx_custom_field_values_field_id
    ON custom_field_values (field_id);
CREATE INDEX idx_custom_field_values_value_text
    ON custom_field_values (value_text) WHERE value_text IS NOT NULL;
CREATE INDEX idx_custom_field_values_value_number
    ON custom_field_values (value_number) WHERE value_number IS NOT NULL;
```

### 3.4 tag_categories テーブル（新規）

タグのカテゴリ分類を管理するテーブル。

```sql
CREATE TABLE tag_categories (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL UNIQUE,
    color         text NOT NULL DEFAULT '#6b7280',
    display_order integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tag_categories_display_order
    ON tag_categories (display_order);

-- 初期データ
INSERT INTO tag_categories (name, color, display_order) VALUES
    ('興味関心', '#3b82f6', 1),
    ('ステータス', '#10b981', 2),
    ('流入経路', '#f59e0b', 3),
    ('キャンペーン', '#ef4444', 4),
    ('カスタム', '#6b7280', 5);
```

### 3.5 customer_tags テーブル拡張

既存の `customer_tags` テーブルにカテゴリ参照と色を追加する。

```sql
-- カテゴリ参照の追加
ALTER TABLE customer_tags
    ADD COLUMN category_id uuid REFERENCES tag_categories(id) ON DELETE SET NULL;

-- タグ個別の色（任意）
ALTER TABLE customer_tags
    ADD COLUMN color text;

-- 親タグ参照（階層構造）
ALTER TABLE customer_tags
    ADD COLUMN parent_tag text;

CREATE INDEX idx_customer_tags_category_id
    ON customer_tags (category_id);
CREATE INDEX idx_customer_tags_parent_tag
    ON customer_tags (parent_tag) WHERE parent_tag IS NOT NULL;
```

### 3.6 tag_auto_rules テーブル（新規）

自動タグ付与ルールを管理するテーブル。

```sql
CREATE TABLE tag_auto_rules (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    conditions  jsonb NOT NULL,
    tag         text NOT NULL,
    category_id uuid REFERENCES tag_categories(id) ON DELETE SET NULL,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tag_auto_rules_is_active
    ON tag_auto_rules (is_active) WHERE is_active = true;
```

**conditions の JSON 構造:**

```json
{
  "operator": "AND",
  "rules": [
    {
      "field": "purchase_count",
      "operator": ">=",
      "value": 3
    },
    {
      "field": "total_purchase_amount",
      "operator": ">=",
      "value": 10000
    }
  ]
}
```

対応する演算子:

```
=, !=, >, >=, <, <=       -- 数値・日付比較
contains, not_contains      -- テキスト部分一致
in, not_in                  -- 選択肢一致
is_null, is_not_null        -- NULL判定
```

### 3.7 surveys テーブル（新規）

アンケートフォームの定義を管理するテーブル。

```sql
CREATE TABLE surveys (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title        text NOT NULL,
    description  text,
    questions    jsonb NOT NULL DEFAULT '[]',
    field_mappings jsonb NOT NULL DEFAULT '{}',
    is_active    boolean NOT NULL DEFAULT true,
    expires_at   timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE survey_responses (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id   uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    answers     jsonb NOT NULL DEFAULT '{}',
    responded_at timestamptz NOT NULL DEFAULT now(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (survey_id, customer_id)
);

CREATE INDEX idx_survey_responses_survey_id
    ON survey_responses (survey_id);
CREATE INDEX idx_survey_responses_customer_id
    ON survey_responses (customer_id);
```

### 3.8 ER図（追加テーブル）

```
                       ┌─────────────────────────┐
                       │   custom_field_         │
                       │   definitions           │
                       │                         │
                       │  id (PK)                │
                       │  name                   │
                       │  field_key (UNIQUE)      │
                       │  field_type             │
                       │  options (jsonb)        │
                       └────────────┬────────────┘
                                    │ 1:N
                       ┌────────────┴────────────┐
                       │  custom_field_values     │
                       │                         │
                       │  id (PK)                │
                       │  customer_id (FK)       │
┌──────────────┐       │  field_id (FK)          │
│  customers   │──1:N──│  value_text / number /  │
│  (拡張済み)   │       │  date / json / boolean  │
│              │       └─────────────────────────┘
│              │
│              │──1:N──┌─────────────────────────┐
│              │       │  customer_tags (拡張)    │
│              │       │  + category_id (FK)     │───N:1──┌──────────────┐
│              │       │  + color                │        │tag_categories│
│              │       │  + parent_tag           │        └──────────────┘
│              │       └─────────────────────────┘
│              │
│              │──1:N──┌─────────────────────────┐
│              │       │  survey_responses       │───N:1──┌──────────────┐
│              │       └─────────────────────────┘        │   surveys    │
│              │                                          └──────────────┘
└──────────────┘
                       ┌─────────────────────────┐
                       │  tag_auto_rules         │
                       │  (独立)                  │
                       └─────────────────────────┘
```

### 3.9 RLS（Row Level Security）ポリシー

すべての新規テーブルに RLS を適用する（SPEC-12 の設計方針に準拠）。

```sql
-- custom_field_definitions: 認証済みユーザーのみ読み書き
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON custom_field_definitions
    FOR ALL USING (auth.role() = 'authenticated');

-- custom_field_values: 認証済みユーザーのみ読み書き
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON custom_field_values
    FOR ALL USING (auth.role() = 'authenticated');

-- tag_categories: 認証済みユーザーのみ読み書き
ALTER TABLE tag_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON tag_categories
    FOR ALL USING (auth.role() = 'authenticated');

-- surveys: 認証済みユーザーが管理、LIFF経由で回答
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON surveys
    FOR ALL USING (auth.role() = 'authenticated');

-- survey_responses: 認証済みユーザーが閲覧、LIFF経由で作成
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON survey_responses
    FOR ALL USING (auth.role() = 'authenticated');
```

---

## 4. 顧客詳細画面の改善

### 4.1 画面構成

既存の顧客詳細画面（SPEC-06 参照）をタブ構成に拡張する。

```
/dashboard/customers/[customerId]

+------------------------------------------------------------------+
|  [<] 顧客詳細                                                     |
+------------------------------------------------------------------+
|  +------+  山田 太郎                                              |
|  | ICON |  @yamada_taro                                           |
|  +------+  LINE表示名: たろう                                     |
|            ステージ: [Active]  スコア: [78/100]                   |
+------------------------------------------------------------------+
|  [基本情報] [行動履歴] [カスタム属性] [タグ]                       |
+------------------------------------------------------------------+
|                                                                    |
|  (選択中のタブの内容が表示される)                                  |
|                                                                    |
+------------------------------------------------------------------+
```

### 4.2 基本情報タブ

個人情報と行動属性のサマリーを表示・編集する。

```
+------------------------------------------------------------------+
|  個人情報                                           [編集]         |
+------------------------------------------------------------------+
|  氏名（漢字）    : 山田 太郎                                      |
|  フリガナ        : ヤマダ タロウ                                   |
|  ニックネーム    : たろう                                         |
|  メール          : yamada@example.com                             |
|  電話            : 090-1234-5678                                  |
|  生年月日        : 1990-05-15 (35歳)                             |
|  性別            : 男性                                           |
|  郵便番号        : 150-0001                                       |
|  都道府県        : 東京都                                         |
|  市区町村        : 渋谷区                                         |
|  職業            : エンジニア                                     |
|  会社名          : 株式会社サンプル                               |
+------------------------------------------------------------------+
|  行動サマリー                                                     |
+------------------------------------------------------------------+
|  +----------------+  +----------------+  +------------------+     |
|  | エンゲージ     |  | 累計購入       |  | 流入経路         |     |
|  | メント         |  | 金額           |  |                  |     |
|  |    78/100      |  |   ¥45,000     |  | Instagram        |     |
|  |  [=========>]  |  |   (5回)        |  | (paid)           |     |
|  +----------------+  +----------------+  +------------------+     |
|                                                                    |
|  +----------------+  +----------------+  +------------------+     |
|  | ステージ       |  | 予約回数       |  | クーポン利用     |     |
|  |  [Active]      |  |    3回         |  |    2回           |     |
|  +----------------+  +----------------+  +------------------+     |
+------------------------------------------------------------------+
```

### 4.3 行動履歴タブ

`customer_actions` テーブルのデータをタイムライン形式で表示。

```
+------------------------------------------------------------------+
|  行動履歴                                  [フィルタ: 全て  v]     |
+------------------------------------------------------------------+
|                                                                    |
|  2026-03-26 14:30  [メッセージ] 「予約したいです」を受信          |
|  2026-03-25 10:00  [クーポン]   春キャンペーンクーポンを利用      |
|  2026-03-24 18:45  [LIFF]       予約画面を閲覧                    |
|  2026-03-20 09:00  [配信]       週刊ニュース配信を受信            |
|  2026-03-15 11:30  [購入]       商品Aを購入 (¥3,000)             |
|  2026-03-01 08:00  [follow]     友だち追加                        |
|                                                                    |
|  [もっと見る]                                                      |
+------------------------------------------------------------------+
```

### 4.4 カスタム属性タブ

カスタムフィールドの値を表示・編集する。

```
+------------------------------------------------------------------+
|  カスタム属性                                       [編集]         |
+------------------------------------------------------------------+
|                                                                    |
|  関心カテゴリ      : IT                                           |
|  利用中のサービス  : ServiceA, ServiceC                           |
|  メルマガ購読      : [x] ON                                      |
|  契約開始日        : 2025-04-01                                   |
|  ポイント残高      : 1,500                                        |
|                                                                    |
+------------------------------------------------------------------+
```

### 4.5 タグタブ

カテゴリ別にタグを表示・管理する。

```
+------------------------------------------------------------------+
|  タグ管理                                     [タグを追加]         |
+------------------------------------------------------------------+
|                                                                    |
|  興味関心                                                         |
|    [IT] [AI/ML] [Web開発]                                        |
|                                                                    |
|  ステータス                                                       |
|    [リピーター] [VIP]                                             |
|                                                                    |
|  流入経路                                                         |
|    [Instagram流入]                                                |
|                                                                    |
|  キャンペーン                                                     |
|    [春キャンペーン2026]                                           |
|                                                                    |
+------------------------------------------------------------------+
```

---

## 5. カスタムフィールド管理画面

### 5.1 画面パス

```
/dashboard/settings/custom-fields
```

### 5.2 フィールド一覧画面

```
+------------------------------------------------------------------+
|  カスタムフィールド設定                      [+ 新規作成]          |
+------------------------------------------------------------------+
|  # | フィールド名        | キー              | 型     | 必須     |
+------------------------------------------------------------------+
|  1 | 関心カテゴリ        | interest_category | 選択   |          |
|  2 | 利用中のサービス    | current_services  | 複数選択|         |
|  3 | メルマガ購読        | newsletter_sub    | boolean| [x]      |
|  4 | 契約開始日          | contract_start    | 日付   |          |
|  5 | ポイント残高        | point_balance     | 数値   |          |
+------------------------------------------------------------------+
|  ドラッグ&ドロップで並び順を変更できます                          |
+------------------------------------------------------------------+
```

### 5.3 フィールド新規作成・編集ダイアログ

```
+--------------------------------------------------+
|  カスタムフィールド作成                            |
+--------------------------------------------------+
|                                                    |
|  フィールド名 *                                    |
|  [                              ]                  |
|                                                    |
|  フィールドキー *                                  |
|  [                              ]                  |
|  ※ 英小文字・数字・アンダースコアのみ              |
|                                                    |
|  データ型 *                                        |
|  [テキスト         v]                              |
|                                                    |
|  説明（任意）                                      |
|  [                              ]                  |
|                                                    |
|  [ ] 必須フィールドにする                          |
|                                                    |
|  --- 選択型の場合 ---                              |
|  選択肢:                                           |
|  [選択肢1          ] [x]                           |
|  [選択肢2          ] [x]                           |
|  [+ 選択肢を追加]                                  |
|                                                    |
|        [キャンセル]  [保存]                         |
+--------------------------------------------------+
```

### 5.4 フィールド削除

削除時の確認ダイアログ:

```
+--------------------------------------------------+
|  フィールドの削除                                  |
+--------------------------------------------------+
|                                                    |
|  「関心カテゴリ」を削除しますか？                  |
|                                                    |
|  このフィールドに保存されている全顧客の値が        |
|  削除されます。この操作は取り消せません。          |
|                                                    |
|        [キャンセル]  [削除する]                     |
+--------------------------------------------------+
```

---

## 6. アンケート連携（L-STEP風）

### 6.1 概要

L-STEPの「回答フォーム」に相当する機能。LIFFアプリとしてアンケートフォームを表示し、回答結果を顧客属性に自動反映する。

### 6.2 アンケートフロー

```
管理者がアンケートを作成
  -> アンケートURLを生成 (/liff/survey/[surveyId])
  -> LINE配信またはリッチメニューでURLを送信
  -> ユーザーがLIFFでフォームを開く
  -> liff.getProfile() でユーザーを識別
  -> ユーザーがフォームに回答して送信
  -> 回答結果を survey_responses に保存
  -> field_mappings に従って customers / custom_field_values に自動反映
  -> 完了画面を表示 -> LINEトーク画面に戻る
```

### 6.3 アンケート定義の構造

```json
{
  "title": "初回アンケート",
  "description": "サービス改善のためにお聞かせください",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "label": "お名前を教えてください",
      "required": true
    },
    {
      "id": "q2",
      "type": "select",
      "label": "年齢をお選びください",
      "options": ["10代", "20代", "30代", "40代", "50代", "60歳以上"],
      "required": true
    },
    {
      "id": "q3",
      "type": "multiselect",
      "label": "興味のある分野を選んでください（複数可）",
      "options": ["IT", "マーケティング", "経営", "デザイン", "その他"],
      "required": false
    },
    {
      "id": "q4",
      "type": "email",
      "label": "メールアドレス",
      "required": false
    }
  ],
  "field_mappings": {
    "q1": { "target": "customer", "field": "full_name" },
    "q2": { "target": "customer", "field": "age_group", "transform": "age_label_to_code" },
    "q3": { "target": "custom_field", "field_key": "interest_category" },
    "q4": { "target": "customer", "field": "email" }
  }
}
```

### 6.4 質問タイプ

| タイプ | 説明 | UI |
|--------|------|-----|
| text | テキスト入力 | input[type=text] |
| textarea | 複数行テキスト | textarea |
| select | 単一選択 | ラジオボタン |
| multiselect | 複数選択 | チェックボックス |
| email | メールアドレス | input[type=email] |
| phone | 電話番号 | input[type=tel] |
| date | 日付 | input[type=date] |
| number | 数値 | input[type=number] |
| rating | 評価（1-5星） | 星アイコン |

### 6.5 field_mappings の変換関数

| 関数名 | 説明 | 入力例 | 出力例 |
|--------|------|--------|--------|
| age_label_to_code | 年齢ラベルをコードに変換 | "20代" | "20s" |
| prefecture_normalize | 都道府県名の正規化 | "東京" | "東京都" |
| phone_normalize | 電話番号のハイフン統一 | "09012345678" | "090-1234-5678" |
| postal_code_normalize | 郵便番号のハイフン統一 | "1500001" | "150-0001" |

### 6.6 アンケート管理画面

```
/dashboard/settings/surveys
```

```
+------------------------------------------------------------------+
|  アンケート管理                               [+ 新規作成]         |
+------------------------------------------------------------------+
|  タイトル              | 回答数 | 状態   | 作成日     |           |
+------------------------------------------------------------------+
|  初回アンケート        |   124  | 公開中 | 2026-03-01 | [編集]    |
|  満足度調査            |    45  | 公開中 | 2026-03-15 | [編集]    |
|  春キャンペーン応募    |    89  | 終了   | 2026-02-01 | [編集]    |
+------------------------------------------------------------------+
```

---

## 7. 自動属性更新ルール

### 7.1 リアルタイム更新

イベント発生時に即座に更新される属性。

| トリガー | 更新対象 | ロジック |
|---------|---------|---------|
| follow Webhook | first_seen_at | 初回のみ設定 |
| follow Webhook | acquisition_source / medium / campaign | UTMパラメータを解析 |
| message Webhook | last_seen_at | 現在日時で更新 |
| message Webhook | message_count | +1 インクリメント |
| 購入完了 | total_purchase_amount | 購入金額を加算 |
| 購入完了 | purchase_count | +1 インクリメント |
| 購入完了 | last_purchase_at | 現在日時で更新 |
| 予約確定 | reservation_count | +1 インクリメント |
| クーポン利用 | coupon_usage_count | +1 インクリメント |
| アンケート回答 | 各マッピング先フィールド | field_mappings に従って反映 |

### 7.2 日次バッチ更新

毎日深夜（JST 03:00）に実行されるバッチ処理で更新される属性。

**エンゲージメントスコアの再計算:**

```sql
-- engagement_score の再計算（擬似SQL）
UPDATE customers SET
    engagement_score = LEAST(100, (
        -- 接触頻度: 直近7日間のメッセージ数 x 5 (上限30)
        LEAST(30, (
            SELECT COUNT(*) FROM customer_actions
            WHERE customer_id = customers.id
              AND action_type = 'message'
              AND created_at > now() - interval '7 days'
        ) * 5)
        +
        -- 継続性: 友だち追加からの日数
        CASE
            WHEN first_seen_at > now() - interval '30 days' THEN 5
            WHEN first_seen_at > now() - interval '90 days' THEN 10
            ELSE 15
        END
        +
        -- アクション: 直近30日間のアクション数 x 3 (上限25)
        LEAST(25, (
            SELECT COUNT(*) FROM customer_actions
            WHERE customer_id = customers.id
              AND created_at > now() - interval '30 days'
        ) * 3)
        +
        -- 購買: 購入回数 x 5 (上限20)
        LEAST(20, purchase_count * 5)
        +
        -- クーポン: クーポン利用回数 x 3 (上限10)
        LEAST(10, coupon_usage_count * 3)
    )),
    updated_at = now()
WHERE blocked_at IS NULL;
```

**ライフサイクルステージの再判定:**

```sql
UPDATE customers SET
    lifecycle_stage = CASE
        WHEN blocked_at IS NOT NULL THEN 'churned'
        WHEN last_seen_at < now() - interval '90 days' THEN 'churned'
        WHEN last_seen_at < now() - interval '30 days' THEN 'dormant'
        WHEN first_seen_at > now() - interval '14 days' THEN 'new'
        ELSE 'active'
    END,
    updated_at = now();
```

**年齢層の自動算出:**

```sql
UPDATE customers SET
    age_group = CASE
        WHEN birth_date IS NULL THEN age_group  -- 変更しない
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 20 THEN '10s'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 30 THEN '20s'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 40 THEN '30s'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 50 THEN '40s'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 60 THEN '50s'
        ELSE '60plus'
    END,
    updated_at = now()
WHERE birth_date IS NOT NULL;
```

**自動タグ付与ルールの実行:**

```sql
-- tag_auto_rules テーブルの各ルールを評価し、
-- 条件に一致する顧客にタグを付与する
-- アプリケーション層で実装（SQLのみでは複雑なため）
```

### 7.3 バッチ実行の実装

```
Vercel Cron Job: /api/cron/update-customer-attributes
  スケジュール: 0 18 * * * (UTC 18:00 = JST 03:00)
  タイムアウト: 300秒

  実行順序:
    1. 年齢層の再算出
    2. ライフサイクルステージの再判定
    3. エンゲージメントスコアの再計算
    4. 自動タグ付与ルールの評価・実行
    5. 実行ログの記録 (execution_logs)
```

---

## 8. セグメントとの連携

### 8.1 セグメント条件の拡張

既存のセグメント機能（SPEC-12 の `segments` / `segment_members` テーブル）で、拡張された属性を条件として使用可能にする。

### 8.2 利用可能なセグメント条件

| カテゴリ | フィールド | 演算子 | 値の例 |
|---------|-----------|--------|--------|
| 個人情報 | gender | = | male |
| 個人情報 | age_group | = / IN | 20s, 30s |
| 個人情報 | prefecture | = / IN | 東京都, 大阪府 |
| 個人情報 | occupation | = / LIKE | エンジニア |
| 行動 | engagement_score | >=, <=, BETWEEN | 70 |
| 行動 | lifecycle_stage | = / IN | active |
| 行動 | message_count | >=, <= | 10 |
| 行動 | first_seen_at | >=, <= | 2026-01-01 |
| 行動 | last_seen_at | >=, <= | 2026-03-01 |
| 購買 | total_purchase_amount | >=, <= | 10000 |
| 購買 | purchase_count | >=, <= | 3 |
| 購買 | last_purchase_at | >=, <= | 2026-01-01 |
| 流入 | acquisition_source | = / IN | instagram |
| 流入 | acquisition_medium | = / IN | paid |
| 流入 | acquisition_campaign | = / LIKE | spring2026 |
| タグ | tag | HAS / NOT_HAS | リピーター |
| タグ | tag_category | HAS_IN | 興味関心 |
| カスタム | [field_key] | 型に応じた演算子 | 任意 |

### 8.3 セグメント条件の JSON 構造

```json
{
  "operator": "AND",
  "conditions": [
    {
      "field": "age_group",
      "operator": "IN",
      "value": ["20s", "30s"]
    },
    {
      "field": "prefecture",
      "operator": "=",
      "value": "東京都"
    },
    {
      "field": "engagement_score",
      "operator": ">=",
      "value": 50
    },
    {
      "field": "tag",
      "operator": "HAS",
      "value": "IT"
    },
    {
      "field": "custom:interest_category",
      "operator": "=",
      "value": "Marketing"
    }
  ]
}
```

### 8.4 セグメント活用例

| セグメント名 | 条件 | 用途 |
|-------------|------|------|
| 東京20-30代女性 | prefecture=東京都, age_group IN (20s,30s), gender=female | エリア x 年齢 x 性別ターゲティング |
| 高エンゲージメント | engagement_score >= 70 | VIPコンテンツ配信 |
| 休眠掘り起こし | lifecycle_stage = dormant | 再アクティベーション配信 |
| Instagram流入 | acquisition_source = instagram | 流入経路別ナーチャリング |
| リピーター | purchase_count >= 3 | ロイヤルティプログラム |
| IT関心層 | custom:interest_category = IT | コンテンツ最適化 |

---

## 9. API設計

### 9.1 顧客属性 API

**顧客属性の取得:**

```
GET /api/customers/[customerId]/attributes

Response:
{
  "customer": {
    "id": "uuid",
    "lineUserId": "U...",
    "displayName": "...",
    "fullName": "...",
    "email": "...",
    "engagementScore": 78,
    "lifecycleStage": "active",
    ...
  },
  "customFields": [
    {
      "fieldKey": "interest_category",
      "fieldName": "関心カテゴリ",
      "fieldType": "select",
      "value": "IT"
    }
  ],
  "tags": [
    {
      "tag": "IT",
      "category": "興味関心",
      "color": "#3b82f6"
    }
  ]
}
```

**顧客属性の更新:**

```
PATCH /api/customers/[customerId]/attributes

Body:
{
  "fullName": "山田 太郎",
  "prefecture": "東京都",
  "customFields": {
    "interest_category": "Marketing"
  }
}
```

### 9.2 カスタムフィールド管理 API

```
GET    /api/custom-fields              -- 一覧取得
POST   /api/custom-fields              -- 新規作成
PATCH  /api/custom-fields/[fieldId]    -- 更新
DELETE /api/custom-fields/[fieldId]    -- 削除
PATCH  /api/custom-fields/reorder      -- 並び順変更
```

### 9.3 アンケート API

```
GET    /api/surveys                    -- 一覧取得
POST   /api/surveys                    -- 新規作成
PATCH  /api/surveys/[surveyId]         -- 更新
DELETE /api/surveys/[surveyId]         -- 削除
GET    /api/surveys/[surveyId]/responses  -- 回答一覧
```

### 9.4 LIFF用アンケート回答 API

```
GET    /api/liff/surveys/[surveyId]    -- アンケート定義取得
POST   /api/liff/surveys/[surveyId]/respond  -- 回答送信
```

### 9.5 タグ管理 API

```
GET    /api/tag-categories             -- カテゴリ一覧
POST   /api/tag-categories             -- カテゴリ作成
PATCH  /api/tag-categories/[id]        -- カテゴリ更新
DELETE /api/tag-categories/[id]        -- カテゴリ削除

GET    /api/tag-auto-rules             -- 自動ルール一覧
POST   /api/tag-auto-rules             -- 自動ルール作成
PATCH  /api/tag-auto-rules/[id]        -- 自動ルール更新
DELETE /api/tag-auto-rules/[id]        -- 自動ルール削除
```

---

## 10. 実装優先度

### P1: 基盤整備（Sprint 1-2）

| タスク | 工数目安 | 依存 |
|--------|---------|------|
| customers テーブルへのカラム追加マイグレーション | 0.5日 | なし |
| 顧客詳細画面のタブ構成化 | 2日 | なし |
| 基本情報タブ（表示・編集フォーム） | 2日 | カラム追加 |
| 行動サマリーカード表示 | 1日 | カラム追加 |
| 流入経路パラメータの解析・保存ロジック | 1日 | カラム追加 |
| エンゲージメントスコア・ライフサイクルの日次バッチ | 2日 | カラム追加 |

**P1 合計: 約8.5日**

### P2: カスタムフィールド（Sprint 3-4）

| タスク | 工数目安 | 依存 |
|--------|---------|------|
| custom_field_definitions / values テーブル作成 | 0.5日 | なし |
| カスタムフィールド管理画面（CRUD） | 3日 | テーブル作成 |
| 顧客詳細画面 カスタム属性タブ | 2日 | テーブル作成 |
| tag_categories テーブル・タグカテゴリ機能 | 1.5日 | なし |
| タグ管理UI改善（カテゴリ表示・色分け） | 2日 | カテゴリ機能 |
| 自動タグ付与ルール（tag_auto_rules） | 2日 | カテゴリ機能 |
| セグメント条件の拡張（新属性対応） | 2日 | カラム追加 |

**P2 合計: 約13日**

### P3: アンケート連携・高度な機能（Sprint 5-6）

| タスク | 工数目安 | 依存 |
|--------|---------|------|
| surveys / survey_responses テーブル作成 | 0.5日 | なし |
| アンケート管理画面（作成・編集・一覧） | 3日 | テーブル作成 |
| LIFF アンケートフォーム画面 | 3日 | テーブル作成 |
| 回答結果の属性自動反映ロジック | 2日 | カスタムフィールド |
| 年齢層自動算出バッチ | 0.5日 | P1バッチ |
| タグ階層構造（親タグ・子タグ） | 2日 | P2タグ機能 |
| アンケート回答集計ダッシュボード | 2日 | アンケート機能 |

**P3 合計: 約13日**

### 全体スケジュール

```
Sprint 1-2 (2週間): P1 基盤整備
  -> 顧客属性の基本管理が可能に

Sprint 3-4 (2週間): P2 カスタムフィールド
  -> 柔軟な属性定義・タグ分類が可能に

Sprint 5-6 (2週間): P3 アンケート連携
  -> LIFFアンケートで属性を自動収集可能に
```

---

## 付録

### A. 既存テーブルとの整合性

本仕様は SPEC-12（データベーススキーマ仕様書）の `customers` テーブル定義を基盤としている。既存カラム（`email`, `phone`, `gender`, `birth_date`, `prefecture`, `message_count`, `first_seen_at`, `last_seen_at`, `blocked_at`, `attributes`）はそのまま維持し、新規カラムを追加する形で拡張する。

既存の `attributes` (jsonb) カラムは、カスタムフィールド機能が完成するまでの過渡期に簡易的な属性格納として引き続き利用可能とする。カスタムフィールド機能の完成後は、`attributes` カラムの内容を `custom_field_values` テーブルに段階的に移行する。

### B. L-STEPとの機能比較

| 機能 | L-STEP | LineMag（本仕様） | 備考 |
|------|--------|-------------------|------|
| 友だち情報（標準項目） | 15項目 | 13項目 | ほぼ同等 |
| カスタムフィールド | 無制限 | 最大50個 | 実用上十分 |
| 回答フォーム | GUI作成 | 管理画面 + LIFF | 同等 |
| スコアリング | 手動設定 | 自動算出 | より自動化 |
| 流入経路分析 | QRコード別 | UTMパラメータ | より柔軟 |
| タグ管理 | カテゴリ + 色 | カテゴリ + 色 + 階層 + 自動ルール | より高機能 |
| 対応マーク | 手動 | 自動（ライフサイクル） | より自動化 |
| セグメント配信 | タグ + 属性 | 全属性 + カスタムフィールド | より柔軟 |

### C. プライバシーとセキュリティ

- 個人情報（氏名、メール、電話番号、住所）は Supabase の RLS で保護
- 管理者のみが顧客の個人情報にアクセス可能
- LIFF経由のアンケート回答は LINE ユーザー認証で本人確認済み
- 個人情報のエクスポート機能は管理者権限を持つユーザーのみに制限
- データ削除要請への対応として、顧客データの完全削除機能（GDPR対応）を実装予定
