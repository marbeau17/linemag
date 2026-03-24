# 14. 自社ECサイト連携・クーポン機能 仕様書

## 1. 概要

LineMagプラットフォームに自社ECサイト連携機能を追加し、購買データの取得・顧客紐付け・クーポンの作成/配布/利用管理をLINE経由で実現する。これにより、ブログ配信・CRM・予約機能に加え、EC購買行動に基づいたマーケティング施策が可能となる。

### 1.1 対象範囲

| 機能領域 | 内容 |
|---------|------|
| EC連携 | 購買データ取得、顧客紐付け、商品情報同期 |
| クーポン管理 | 作成、配布、利用追跡、効果測定 |
| LINE配信連携 | クーポンのFlexメッセージ配信、リッチメニュー統合 |

### 1.2 技術スタック

- **バックエンド**: Next.js 14 App Router（API Routes）
- **データベース**: Supabase（PostgreSQL + RLS）
- **メッセージング**: LINE Messaging API（Flex Message）
- **外部連携**: 各ECプラットフォームREST API / Webhook

---

## 2. EC連携アーキテクチャ

### 2.1 全体構成

```
┌─────────────┐     Webhook/API      ┌──────────────────┐
│  ECサイト     │ ◄──────────────────► │  LineMag Backend  │
│ (Shopify等)  │                      │  Next.js API      │
└─────────────┘                      └────────┬─────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │  Supabase         │
                                     │  (PostgreSQL)     │
                                     └────────┬─────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │  LINE Messaging   │
                                     │  API              │
                                     └──────────────────┘
```

### 2.2 データ連携方式

| 方式 | 用途 | 方向 |
|------|------|------|
| **Webhook受信** | 注文作成/更新/キャンセル、顧客作成/更新 | EC → LineMag |
| **REST APIポーリング** | 商品マスタ同期、在庫同期、注文履歴バッチ取得 | LineMag → EC |
| **REST API書き込み** | クーポン作成、ディスカウントコード登録 | LineMag → EC |

### 2.3 Webhook受信エンドポイント

```
POST /api/ec/webhook/{platform}
```

- `platform`: `shopify` | `base` | `stores` | `custom`
- HMAC署名検証による真正性確認
- 冪等性キー（`X-Shopify-Webhook-Id` 等）によるリトライ安全性保証
- 受信後は即座に `202 Accepted` を返却し、非同期でジョブキューへ投入

### 2.4 データ同期フロー

```
1. Webhook受信 → 署名検証 → 冪等性チェック
2. イベントペイロードを ec_webhook_logs に記録
3. イベント種別に応じたハンドラーを実行:
   - order.created   → 注文データ保存 + 顧客紐付け + クーポン利用記録更新
   - order.updated   → 注文ステータス更新
   - order.cancelled → 注文キャンセル処理 + クーポン利用取消判定
   - customer.created → 顧客データ保存 + LINE ID紐付け試行
   - customer.updated → 顧客データ更新
4. 紐付け済みLINEユーザーへのアクション（サンクスメッセージ、次回クーポン等）
```

### 2.5 顧客紐付けロジック

LINE友だちとEC顧客の紐付けは以下の優先度で実施する:

| 優先度 | 紐付けキー | 方法 |
|--------|-----------|------|
| 1 | LINEログイン連携 | OAuth2フローでLINE IDとEC顧客IDを直接紐付け |
| 2 | メールアドレス一致 | LINEプロフィール取得時のメールとEC登録メールを照合 |
| 3 | 電話番号一致 | LINE連携時に取得した電話番号とEC登録電話番号を照合 |
| 4 | クーポンコード経由 | ユニークコード利用時にLINE配信先と注文者を紐付け |

---

## 3. 主要ECプラットフォーム対応

### 3.1 Shopify

| 項目 | 仕様 |
|------|------|
| API | Shopify Admin REST API / GraphQL Admin API |
| 認証 | OAuth2（Custom App） |
| Webhook | `orders/create`, `orders/updated`, `orders/cancelled`, `customers/create`, `customers/update` |
| クーポン連携 | Price Rules API + Discount Codes API |
| 商品同期 | Products API（`GET /admin/api/2024-01/products.json`） |
| レート制限 | REST: 2リクエスト/秒、GraphQL: 50ポイント/秒 |

**Shopify Webhookペイロード例（order.created）:**
```json
{
  "id": 820982911946154500,
  "email": "customer@example.com",
  "total_price": "5980.00",
  "discount_codes": [
    {
      "code": "LM-ABCD1234",
      "amount": "500.00",
      "type": "fixed_amount"
    }
  ],
  "line_items": [...]
}
```

### 3.2 BASE

| 項目 | 仕様 |
|------|------|
| API | BASE API v1 |
| 認証 | OAuth2 |
| Webhook | 注文通知（メール転送ベース→Webhook変換が必要） |
| クーポン連携 | クーポンAPI（`POST /1/coupons`） |
| 商品同期 | Items API（`GET /1/items`） |
| レート制限 | 3リクエスト/秒 |

**注意事項:** BASEはWebhookのネイティブサポートが限定的なため、定期ポーリング（5分間隔）による注文取得を併用する。

### 3.3 STORES

| 項目 | 仕様 |
|------|------|
| API | STORES API（パートナー向け） |
| 認証 | APIキー |
| Webhook | 注文作成、注文ステータス変更 |
| クーポン連携 | クーポン管理API |
| 商品同期 | 商品一覧API |
| レート制限 | 1リクエスト/秒 |

### 3.4 カスタムEC（自社開発サイト）

汎用的なWebhookレシーバーとアダプターパターンで対応する。

```typescript
// src/lib/ec/adapters/types.ts

export interface EcAdapter {
  platform: string;
  verifyWebhook(req: Request): Promise<boolean>;
  parseOrder(payload: unknown): EcOrder;
  parseCustomer(payload: unknown): EcCustomer;
  createDiscountCode(coupon: CouponDefinition): Promise<string>;
  syncProducts(cursor?: string): Promise<EcProductPage>;
}
```

EC事業者は以下の最低限のWebhookを実装する:

| イベント | エンドポイント | ペイロード必須フィールド |
|---------|--------------|----------------------|
| 注文作成 | `POST /api/ec/webhook/custom` | `event: "order.created"`, `order_id`, `email`, `total`, `discount_codes[]` |
| 注文更新 | 同上 | `event: "order.updated"`, `order_id`, `status` |

---

## 4. クーポン機能仕様

### 4.1 クーポン種類

| 種類 | `discount_type` | 値の意味 | 例 |
|------|----------------|---------|-----|
| 割引率 | `percentage` | パーセント（1〜100） | 10%OFF |
| 固定額割引 | `fixed_amount` | 円（1以上） | 500円OFF |
| 送料無料 | `free_shipping` | なし（`discount_value = 0`） | 送料無料 |
| ポイント付与 | `point_grant` | 付与ポイント数 | 500ポイント |

### 4.2 クーポンコード体系

#### 共通コード
- 全ユーザー共通で利用可能（例: `SUMMER2026`）
- 管理者が任意の文字列を指定
- フォーマット: `[A-Z0-9\-]{4,20}`

#### ユニークコード
- ユーザーごとに一意のコードを自動発行
- フォーマット: `LM-{XXXXXXXX}`（`X` = 英数字8桁、プレフィックス設定可能）
- 生成アルゴリズム: `crypto.randomUUID()` ベースの短縮ハッシュ + 重複チェック
- 顧客紐付けトラッキングの根拠となる

```typescript
// コード生成ロジック
function generateUniqueCode(prefix: string = 'LM'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return `${prefix}-${code}`;
}
```

### 4.3 利用条件

| 条件 | カラム | 型 | 説明 |
|------|--------|------|------|
| 最低購入額 | `min_purchase_amount` | `integer` | 円単位。0 = 条件なし |
| 対象商品制限 | `target_product_ids` | `text[]` | 空配列 = 全商品対象 |
| 対象カテゴリ制限 | `target_categories` | `text[]` | 空配列 = 全カテゴリ対象 |
| 1人あたり利用回数上限 | `max_uses_per_user` | `integer` | 0 = 無制限 |
| 全体利用回数上限 | `max_total_uses` | `integer` | 0 = 無制限 |
| 有効期間（開始） | `valid_from` | `timestamptz` | 必須 |
| 有効期間（終了） | `valid_until` | `timestamptz` | 必須 |
| 他クーポン併用可否 | `combinable` | `boolean` | デフォルト: `false` |
| 初回購入限定 | `first_purchase_only` | `boolean` | デフォルト: `false` |

### 4.4 発行フロー

#### 手動発行
管理画面から個別または一括でクーポンを作成・配布する。

```
管理者 → クーポン作成画面 → 条件設定 → コード生成 → 対象者選択 → LINE配信
```

#### 自動トリガー発行
CRMイベントに基づき自動的にクーポンを発行する。

| トリガー | ユースケース | 例 |
|---------|-------------|-----|
| `friend_added` | 友だち追加時 | 初回500円OFFクーポン |
| `birthday` | 誕生月 | バースデー10%OFFクーポン |
| `purchase_completed` | 購入完了時 | 次回送料無料クーポン |
| `cart_abandoned` | カート放棄検知（72時間） | 限定5%OFFクーポン |
| `dormant_user` | 未購入期間（30/60/90日） | 復帰促進15%OFFクーポン |
| `segment_entry` | セグメント条件合致時 | VIP限定クーポン |

```typescript
// src/lib/ec/coupon-triggers.ts

export interface CouponTriggerRule {
  id: string;
  trigger_event: string;
  coupon_template_id: string;
  conditions: Record<string, unknown>;  // トリガー固有の条件
  is_active: boolean;
  cooldown_days: number;  // 同一ユーザーへの再発行抑止期間
}
```

#### バッチ発行
Cronジョブで定期的に対象者を抽出し、一括発行する。

```
Cron (daily 09:00 JST)
  → 誕生月ユーザー抽出
  → ユニークコード生成
  → ec_coupons / ec_coupon_codes INSERT
  → LINE Push配信キュー投入
```

既存の `/api/cron/line-broadcast` と同様に、Vercel Cronまたは外部スケジューラから起動する。

---

## 5. データベース設計

### 5.1 テーブル一覧

```sql
-- ================================================================
-- EC連携テーブル
-- ================================================================

-- ECプラットフォーム接続設定
CREATE TABLE ec_connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform      text NOT NULL CHECK (platform IN ('shopify', 'base', 'stores', 'custom')),
  shop_domain   text,
  api_key       text,             -- 暗号化して保存（Supabase Vault）
  api_secret    text,             -- 暗号化して保存
  access_token  text,             -- 暗号化して保存
  webhook_secret text,            -- HMAC検証用
  sync_config   jsonb DEFAULT '{}',
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (account_id, platform)
);

-- EC顧客マスタ
CREATE TABLE ec_customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ec_customer_id  text NOT NULL,          -- ECプラットフォーム側の顧客ID
  platform        text NOT NULL,
  email           text,
  phone           text,
  line_user_id    text,                   -- LINE友だちとの紐付け
  first_name      text,
  last_name       text,
  total_spent     integer DEFAULT 0,      -- 累計購入額（円）
  order_count     integer DEFAULT 0,      -- 累計注文回数
  first_order_at  timestamptz,
  last_order_at   timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (account_id, platform, ec_customer_id)
);

CREATE INDEX idx_ec_customers_line_user ON ec_customers(line_user_id) WHERE line_user_id IS NOT NULL;
CREATE INDEX idx_ec_customers_email ON ec_customers(account_id, email) WHERE email IS NOT NULL;

-- EC注文データ
CREATE TABLE ec_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ec_order_id     text NOT NULL,
  ec_customer_id  uuid REFERENCES ec_customers(id),
  platform        text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  total_amount    integer NOT NULL,       -- 円
  discount_amount integer DEFAULT 0,
  coupon_codes    text[] DEFAULT '{}',
  line_attributed boolean DEFAULT false,  -- LINE経由の購入か
  order_data      jsonb DEFAULT '{}',     -- 生の注文データ
  ordered_at      timestamptz NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (account_id, platform, ec_order_id)
);

CREATE INDEX idx_ec_orders_customer ON ec_orders(ec_customer_id);
CREATE INDEX idx_ec_orders_coupon ON ec_orders USING gin(coupon_codes);
CREATE INDEX idx_ec_orders_ordered_at ON ec_orders(account_id, ordered_at DESC);

-- Webhookログ
CREATE TABLE ec_webhook_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL,
  platform        text NOT NULL,
  event_type      text NOT NULL,
  idempotency_key text,
  payload         jsonb NOT NULL,
  status          text DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  error_message   text,
  processed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_ec_webhook_idempotency
  ON ec_webhook_logs(account_id, platform, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ================================================================
-- クーポンテーブル
-- ================================================================

-- クーポン定義（テンプレート）
CREATE TABLE ec_coupons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  discount_type         text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping', 'point_grant')),
  discount_value        integer NOT NULL DEFAULT 0,
  code_type             text NOT NULL CHECK (code_type IN ('common', 'unique')),
  common_code           text,                   -- code_type='common' の場合のみ
  code_prefix           text DEFAULT 'LM',      -- code_type='unique' の場合のプレフィックス
  min_purchase_amount   integer DEFAULT 0,
  target_product_ids    text[] DEFAULT '{}',
  target_categories     text[] DEFAULT '{}',
  max_uses_per_user     integer DEFAULT 0,       -- 0=無制限
  max_total_uses        integer DEFAULT 0,       -- 0=無制限
  current_total_uses    integer DEFAULT 0,
  valid_from            timestamptz NOT NULL,
  valid_until           timestamptz NOT NULL,
  combinable            boolean DEFAULT false,
  first_purchase_only   boolean DEFAULT false,
  status                text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'exhausted')),
  ec_synced             boolean DEFAULT false,   -- ECプラットフォーム側にコード登録済みか
  ec_price_rule_id      text,                    -- Shopify Price Rule ID等
  metadata              jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_ec_coupons_status ON ec_coupons(account_id, status);
CREATE INDEX idx_ec_coupons_valid ON ec_coupons(account_id, valid_from, valid_until);

-- ユニークコード個別レコード
CREATE TABLE ec_coupon_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       uuid NOT NULL REFERENCES ec_coupons(id) ON DELETE CASCADE,
  code            text NOT NULL UNIQUE,
  line_user_id    text,                   -- 配布先LINEユーザー
  status          text DEFAULT 'issued' CHECK (status IN ('issued', 'delivered', 'used', 'expired', 'revoked')),
  delivered_at    timestamptz,
  used_at         timestamptz,
  used_order_id   uuid REFERENCES ec_orders(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_ec_coupon_codes_coupon ON ec_coupon_codes(coupon_id);
CREATE INDEX idx_ec_coupon_codes_user ON ec_coupon_codes(line_user_id) WHERE line_user_id IS NOT NULL;
CREATE INDEX idx_ec_coupon_codes_code ON ec_coupon_codes(code);

-- クーポン自動発行ルール
CREATE TABLE ec_coupon_trigger_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  coupon_id           uuid NOT NULL REFERENCES ec_coupons(id) ON DELETE CASCADE,
  trigger_event       text NOT NULL,
  conditions          jsonb DEFAULT '{}',
  cooldown_days       integer DEFAULT 0,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- クーポン利用ログ（効果測定用）
CREATE TABLE ec_coupon_usage_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       uuid NOT NULL REFERENCES ec_coupons(id),
  coupon_code_id  uuid REFERENCES ec_coupon_codes(id),
  code            text NOT NULL,
  line_user_id    text,
  order_id        uuid REFERENCES ec_orders(id),
  discount_amount integer NOT NULL,
  used_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_ec_coupon_usage_coupon ON ec_coupon_usage_logs(coupon_id);
CREATE INDEX idx_ec_coupon_usage_date ON ec_coupon_usage_logs(used_at DESC);
```

### 5.2 RLSポリシー

```sql
-- ec_coupons: アカウント所有者のみアクセス可
ALTER TABLE ec_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY ec_coupons_account_policy ON ec_coupons
  USING (account_id = auth.uid());

-- 他テーブルも同様に account_id ベースでRLSを設定
```

---

## 6. クーポン管理画面仕様

### 6.1 画面一覧

| 画面 | パス | 機能 |
|------|------|------|
| クーポン一覧 | `/dashboard/coupons` | ステータスフィルタ、検索、一覧表示 |
| クーポン作成 | `/dashboard/coupons/new` | ウィザード形式での新規作成 |
| クーポン詳細 | `/dashboard/coupons/[id]` | 設定確認、利用状況、コード一覧 |
| クーポン編集 | `/dashboard/coupons/[id]/edit` | 設定変更（有効期間中は一部項目のみ） |
| 効果測定 | `/dashboard/coupons/analytics` | 全体サマリー、個別クーポン分析 |
| トリガー設定 | `/dashboard/coupons/triggers` | 自動発行ルール管理 |

### 6.2 クーポン一覧画面

```
┌─────────────────────────────────────────────────────────┐
│ クーポン管理                              [+ 新規作成]    │
├─────────────────────────────────────────────────────────┤
│ [すべて] [下書き] [有効] [一時停止] [期限切れ]  🔍検索    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 初回500円OFFクーポン          有効                   │ │
│ │ 固定額 ¥500 OFF │ ユニーク │ 利用: 142/500          │ │
│ │ 有効期限: 2026/04/01 - 2026/06/30                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 夏セール10%OFF                有効                   │ │
│ │ 割引率 10% OFF │ 共通 │ コード: SUMMER2026         │ │
│ │ 有効期限: 2026/07/01 - 2026/08/31                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│                    [1] [2] [3] ... [次へ]                │
└─────────────────────────────────────────────────────────┘
```

### 6.3 クーポン作成ウィザード

**Step 1: 基本設定**
- クーポン名（必須）
- 説明文
- 割引タイプ選択（割引率 / 固定額 / 送料無料 / ポイント付与）
- 割引値入力

**Step 2: コード設定**
- コードタイプ選択（共通コード / ユニークコード）
- 共通コード: コード文字列入力 + 重複チェック
- ユニークコード: プレフィックス設定、発行数量指定

**Step 3: 利用条件**
- 最低購入額
- 対象商品/カテゴリ（EC商品マスタからの選択UI）
- 利用回数上限（1人あたり / 全体）
- 有効期間（開始日時 / 終了日時）
- 併用可否 / 初回購入限定

**Step 4: 確認・公開**
- 設定内容の最終確認
- ECプラットフォームへのコード同期実行
- ステータス選択（下書き保存 / 即時有効化）

### 6.4 編集制約

有効化済みクーポンで変更不可の項目:

| 項目 | 変更可否 | 理由 |
|------|---------|------|
| 割引タイプ・値 | 不可 | ECプラットフォーム側のPrice Ruleと不整合になるため |
| コードタイプ | 不可 | 既発行コードとの整合性 |
| 共通コード文字列 | 不可 | 既配布済みコードとの整合性 |
| 有効期間 | 延長のみ可 | 短縮は既配布ユーザーへの影響大 |
| 利用回数上限 | 増加のみ可 | 減少は既利用者との矛盾 |
| 対象商品/カテゴリ | 可 | ただし利用済みユーザーには遡及しない |
| ステータス | 可 | 一時停止/再開が可能 |

---

## 7. クーポンのLINE配信テンプレート連携

### 7.1 Flex Messageテンプレート

既存の `src/lib/line/templates.ts` のFlexメッセージビルダーを拡張し、クーポン専用テンプレートを追加する。

#### テンプレート: coupon-card

```typescript
// src/lib/line/templates/coupon-card.ts

import type { FlexContainer } from '@/types/line';

export interface CouponCardParams {
  couponName: string;
  discountLabel: string;     // "500円OFF" / "10%OFF" / "送料無料"
  code: string;
  validUntil: string;        // "2026/06/30まで"
  description?: string;
  shopUrl: string;
  conditions?: string;       // "5,000円以上のお買い物で利用可"
  brandColor?: string;       // ヘッダー色 "#FF6B6B" 等
}

export function buildCouponCard(params: CouponCardParams): FlexContainer {
  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'COUPON',
          color: '#FFFFFF',
          size: 'sm',
          weight: 'bold',
        },
        {
          type: 'text',
          text: params.discountLabel,
          color: '#FFFFFF',
          size: '3xl',
          weight: 'bold',
        },
      ],
      backgroundColor: params.brandColor ?? '#FF6B6B',
      paddingAll: '20px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: params.couponName, weight: 'bold', size: 'lg' },
        { type: 'text', text: params.description ?? '', size: 'sm', color: '#666666', wrap: true },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: 'クーポンコード', size: 'xs', color: '#AAAAAA' },
            { type: 'text', text: params.code, size: 'xl', weight: 'bold', align: 'center' },
          ],
          margin: 'lg',
          backgroundColor: '#F5F5F5',
          paddingAll: '15px',
          cornerRadius: '8px',
        },
        { type: 'text', text: `有効期限: ${params.validUntil}`, size: 'xs', color: '#999999', margin: 'md' },
        ...(params.conditions
          ? [{ type: 'text' as const, text: params.conditions, size: 'xs' as const, color: '#999999', wrap: true }]
          : []),
      ],
      paddingAll: '20px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: 'ショップで使う', uri: params.shopUrl },
          style: 'primary',
          color: params.brandColor ?? '#FF6B6B',
        },
      ],
      paddingAll: '15px',
    },
  } as FlexContainer;
}
```

### 7.2 配信メッセージ型定義

```typescript
// src/types/line.ts への追加

export interface CouponMessage {
  type: 'flex';
  altText: string;  // 例: "【500円OFFクーポン】初回購入限定クーポンをプレゼント"
  contents: FlexContainer;
}
```

### 7.3 配信方式

| 方式 | エンドポイント | 用途 |
|------|--------------|------|
| ブロードキャスト | `POST /api/line/broadcast` | 全友だちへの共通コードクーポン |
| マルチキャスト | `POST /api/line/multicast` | セグメント配信（ユニークコード） |
| プッシュ | `POST /api/line/push` | 個別ユーザーへのトリガー配信 |

**ユニークコード配信フロー:**
```
1. 対象ユーザーリスト取得
2. ユーザーごとにユニークコード生成 → ec_coupon_codes INSERT
3. ユーザーごとにFlexメッセージ生成（コードを埋め込み）
4. LINE Push API で個別送信（500件/リクエストのマルチキャスト利用）
5. ec_coupon_codes.status を 'delivered' に更新、delivered_at 記録
```

### 7.4 リッチメニュー連携

クーポン一覧ページへのリンクをリッチメニューに設定可能とする。

```
リッチメニュー → LIFF URL → /liff/coupons
  → ユーザーの保有クーポン一覧表示
  → 未使用/使用済み/期限切れのタブ切替
  → コードのコピー機能
  → ショップへの遷移ボタン
```

---

## 8. 効果測定

### 8.1 KPI指標

| 指標 | 計算式 | 表示 |
|------|--------|------|
| 配布数 | `ec_coupon_codes WHERE status IN ('delivered','used')` の件数 | 数値 |
| 利用数 | `ec_coupon_codes WHERE status = 'used'` の件数 | 数値 |
| 利用率 | 利用数 / 配布数 × 100 | パーセント |
| 割引総額 | `SUM(ec_coupon_usage_logs.discount_amount)` | 円 |
| クーポン経由売上 | `SUM(ec_orders.total_amount) WHERE coupon_codes && ARRAY[対象コード]` | 円 |
| ROI | (クーポン経由売上 − 割引総額) / 割引総額 × 100 | パーセント |
| 平均注文額（クーポン利用時） | クーポン経由売上 / 利用数 | 円 |
| 平均注文額（通常） | 非クーポン売上 / 非クーポン注文数 | 円（比較用） |
| 新規顧客獲得数 | `first_purchase_only` クーポン利用かつ初回注文の件数 | 数値 |

### 8.2 ダッシュボード表示

```
┌─────────────────────────────────────────────────────────┐
│ クーポン効果測定                     期間: [過去30日 ▼]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  配布数        利用数        利用率         ROI           │
│  1,250        187          14.9%        +320%          │
│                                                         │
│  割引総額       クーポン経由売上   新規獲得                │
│  ¥93,500      ¥892,300          42人                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [利用推移グラフ - 日別の利用数・売上の折れ線チャート]        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  クーポン別パフォーマンス                                  │
│  ┌──────────────┬────┬────┬───────┬────────┐           │
│  │ クーポン名     │配布 │利用 │利用率  │売上貢献  │           │
│  ├──────────────┼────┼────┼───────┼────────┤           │
│  │ 初回500円OFF   │500  │92  │18.4%  │¥456,200│           │
│  │ 夏セール10%OFF │750  │95  │12.7%  │¥436,100│           │
│  └──────────────┴────┴────┴───────┴────────┘           │
└─────────────────────────────────────────────────────────┘
```

### 8.3 集計SQLビュー

```sql
-- クーポン別効果サマリービュー
CREATE VIEW ec_coupon_analytics AS
SELECT
  c.id AS coupon_id,
  c.name AS coupon_name,
  c.discount_type,
  c.discount_value,
  c.valid_from,
  c.valid_until,
  COUNT(DISTINCT cc.id) FILTER (WHERE cc.status IN ('delivered', 'used')) AS distributed_count,
  COUNT(DISTINCT cc.id) FILTER (WHERE cc.status = 'used') AS used_count,
  ROUND(
    COUNT(DISTINCT cc.id) FILTER (WHERE cc.status = 'used')::numeric /
    NULLIF(COUNT(DISTINCT cc.id) FILTER (WHERE cc.status IN ('delivered', 'used')), 0) * 100,
    1
  ) AS usage_rate,
  COALESCE(SUM(ul.discount_amount), 0) AS total_discount,
  COALESCE(SUM(o.total_amount), 0) AS attributed_revenue,
  CASE
    WHEN COALESCE(SUM(ul.discount_amount), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(o.total_amount), 0) - COALESCE(SUM(ul.discount_amount), 0))::numeric /
      COALESCE(SUM(ul.discount_amount), 0) * 100,
      1
    )
  END AS roi_percent
FROM ec_coupons c
LEFT JOIN ec_coupon_codes cc ON cc.coupon_id = c.id
LEFT JOIN ec_coupon_usage_logs ul ON ul.coupon_id = c.id
LEFT JOIN ec_orders o ON o.id = ul.order_id
GROUP BY c.id, c.name, c.discount_type, c.discount_value, c.valid_from, c.valid_until;
```

---

## 9. 不正利用防止策

### 9.1 防止対策一覧

| リスク | 対策 | 実装 |
|--------|------|------|
| コード総当たり | 8桁英数字（32^8 = 約1兆通り）+ レート制限 | API側でIP/ユーザー単位のレート制限 |
| 同一ユーザーの複数利用 | `max_uses_per_user` + LINE ID/メールでの重複検知 | DB制約 + アプリケーションロジック |
| 全体上限超過 | `max_total_uses` とアトミックカウンタ | `UPDATE ... SET current_total_uses = current_total_uses + 1 WHERE current_total_uses < max_total_uses` |
| 期限切れコード利用 | `valid_from` / `valid_until` の検証 | EC側 + LineMag側の二重検証 |
| コード共有・転売 | ユニークコード + LINE ID紐付け | ユニークコードを推奨、利用時にLINE IDを照合 |
| 複数アカウント作成 | LINE IDベースの重複チェック | 同一LINE IDへの発行履歴確認 |
| 併用による過大割引 | `combinable` フラグ | EC側のDiscount Combination設定と連動 |
| Webhook偽装 | HMAC署名検証 | プラットフォーム別の署名検証ロジック |

### 9.2 レート制限

```typescript
// src/lib/ec/rate-limiter.ts

const COUPON_VALIDATE_LIMIT = {
  windowMs: 60 * 1000,     // 1分間
  maxRequests: 10,          // 1ユーザーあたり10回
};

const WEBHOOK_RECEIVE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 100,         // IPあたり100回/分
};
```

### 9.3 アトミックなクーポン利用処理

```sql
-- クーポン利用時のトランザクション（楽観的ロック）
BEGIN;

-- 1. クーポン有効性チェック + 全体利用回数の原子的インクリメント
UPDATE ec_coupons
SET current_total_uses = current_total_uses + 1,
    updated_at = now()
WHERE id = $1
  AND status = 'active'
  AND valid_from <= now()
  AND valid_until >= now()
  AND (max_total_uses = 0 OR current_total_uses < max_total_uses)
RETURNING id;
-- RETURNING が空なら利用不可 → ROLLBACK

-- 2. ユーザー別利用回数チェック
SELECT COUNT(*) FROM ec_coupon_usage_logs
WHERE coupon_id = $1 AND line_user_id = $2;
-- max_uses_per_user を超過していたら ROLLBACK + current_total_uses を戻す

-- 3. コードステータス更新
UPDATE ec_coupon_codes
SET status = 'used', used_at = now(), used_order_id = $3
WHERE id = $4 AND status IN ('issued', 'delivered');

-- 4. 利用ログ記録
INSERT INTO ec_coupon_usage_logs (coupon_id, coupon_code_id, code, line_user_id, order_id, discount_amount)
VALUES ($1, $4, $5, $2, $3, $6);

COMMIT;
```

### 9.4 アラート通知

異常検知時にSlack/LINE通知を送信する（既存の `src/lib/line/notifier.ts` を拡張）。

| 検知条件 | アラートレベル | アクション |
|---------|-------------|----------|
| 1時間以内に同一IPから10回以上のコード検証失敗 | WARNING | 管理者通知 |
| クーポン利用率が1日で配布数の50%を超過 | INFO | 管理者通知 |
| 無効なWebhook署名を5回以上連続受信 | CRITICAL | Webhookエンドポイント一時停止検討 |
| 同一LINE IDが異なるEC顧客IDでクーポン利用 | WARNING | 管理者通知 + 当該ユーザーのクーポン一時停止 |

---

## 10. APIエンドポイント一覧

| メソッド | パス | 機能 |
|---------|------|------|
| `GET` | `/api/ec/coupons` | クーポン一覧取得 |
| `POST` | `/api/ec/coupons` | クーポン新規作成 |
| `GET` | `/api/ec/coupons/[id]` | クーポン詳細取得 |
| `PATCH` | `/api/ec/coupons/[id]` | クーポン更新 |
| `POST` | `/api/ec/coupons/[id]/codes/generate` | ユニークコード一括生成 |
| `GET` | `/api/ec/coupons/[id]/codes` | コード一覧取得 |
| `POST` | `/api/ec/coupons/[id]/distribute` | LINE配信実行 |
| `POST` | `/api/ec/coupons/validate` | クーポンコード検証（EC側から呼び出し） |
| `POST` | `/api/ec/webhook/[platform]` | Webhook受信 |
| `GET` | `/api/ec/orders` | 注文一覧取得 |
| `GET` | `/api/ec/customers` | EC顧客一覧取得 |
| `GET` | `/api/ec/analytics/coupons` | クーポン効果測定データ取得 |
| `GET` | `/api/ec/connections` | EC接続設定取得 |
| `POST` | `/api/ec/connections` | EC接続設定作成 |
| `POST` | `/api/ec/connections/[id]/sync` | 手動同期実行 |
| `POST` | `/api/ec/triggers` | トリガールール作成 |
| `GET` | `/api/ec/triggers` | トリガールール一覧取得 |
| `PATCH` | `/api/ec/triggers/[id]` | トリガールール更新 |

---

## 11. 実装フェーズ

| フェーズ | 内容 | 目安期間 |
|---------|------|---------|
| **Phase 1** | DBスキーマ作成、クーポンCRUD API、管理画面（一覧・作成・詳細） | 2週間 |
| **Phase 2** | Shopify連携（Webhook受信、注文同期、Price Rule同期） | 2週間 |
| **Phase 3** | LINE配信テンプレート（Flex Message）、ユニークコード配信フロー | 1週間 |
| **Phase 4** | 自動トリガー発行、バッチ処理（Cronジョブ） | 1週間 |
| **Phase 5** | 効果測定ダッシュボード、分析ビュー | 1週間 |
| **Phase 6** | BASE/STORES対応、カスタムECアダプター | 2週間 |
| **Phase 7** | 不正利用防止強化、LIFF（クーポン一覧ページ）、リッチメニュー連携 | 1週間 |
