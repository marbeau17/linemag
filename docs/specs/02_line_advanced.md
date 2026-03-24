# 02 LINE連携高度化仕様

> LineMag v2 拡張仕様 --- CRM連携・セグメント配信・LIFF統合
> 作成日: 2026-03-24
> ステータス: Draft

---

## 目次

1. [LINE Messaging API 拡張仕様](#1-line-messaging-api-拡張仕様)
2. [LINE Flex Message 新テンプレート設計](#2-line-flex-message-新テンプレート設計)
3. [LINE ログイン連携 (LIFF) によるWebアプリ統合](#3-line-ログイン連携-liff-によるwebアプリ統合)
4. [Webhook 拡張](#4-webhook-拡張)
5. [LINE 公式アカウントの権限・プラン要件](#5-line-公式アカウントの権限プラン要件)
6. [メッセージ配信の最適化](#6-メッセージ配信の最適化)

---

## 現行システムの概要

LineMag は Next.js 14 ベースの LINE マガジン配信システムであり、以下の API・機能を使用している。

| 機能 | エンドポイント / モジュール | 備考 |
|------|---------------------------|------|
| Broadcast 配信 | `POST /v2/bot/message/broadcast` | `src/lib/line/messaging.ts` — リトライ付き |
| Push 配信 | `POST /v2/bot/message/push` | 個別・テスト配信用 |
| フォロワーID取得 | `GET /v2/bot/followers/ids` | ページネーション対応 |
| プロフィール取得 | `GET /v2/bot/profile/{userId}` | バッチ20件並列 |
| Webhook | `POST /api/line/webhook` | User ID記録のみ (JSONファイル) |
| Flex Message | 5テンプレート | daily-column, news-card, visual-magazine, minimal-text, premium-card |
| 定期配信 | Vercel Cron → `/api/cron/line-broadcast` | スケジュール設定可 |

**型定義**: `src/types/line.ts` に `TemplateId`, `BroadcastRequest`, `FlexContainer` 等を集約。

---

## 1. LINE Messaging API 拡張仕様

### 1.1 Narrowcast API (セグメント配信)

全友だちへの Broadcast ではなく、条件に合致するユーザーだけに配信する。CRM 連携によるセグメント配信の中核となる API。

#### エンドポイント

```
POST https://api.line.me/v2/bot/message/narrowcast
```

#### リクエスト構造

```typescript
interface NarrowcastRequest {
  messages: LineMessage[];           // 最大5件
  recipient?: RecipientObject;       // 配信対象 (Audience or 論理演算)
  filter?: {
    demographic?: DemographicFilter; // 属性フィルタ (年齢・性別・OS・地域等)
  };
  limit?: {
    max: number;                     // 配信上限数
    upToRemainingQuota?: boolean;    // 残枠内で配信
  };
}
```

#### Recipient オブジェクト (配信対象の指定)

```typescript
// Audience 指定
interface AudienceRecipient {
  type: 'audience';
  audienceGroupId: number;
}

// 論理演算 (AND / OR / NOT)
interface OperatorRecipient {
  type: 'operator';
  and?: RecipientObject[];   // 最大10件
  or?: RecipientObject[];    // 最大10件
  not?: RecipientObject;     // 1件
}

type RecipientObject = AudienceRecipient | OperatorRecipient;
```

#### Demographic フィルタ

```typescript
interface DemographicFilter {
  type: 'operator';
  and?: DemographicCondition[];
}

// 利用可能な条件
type DemographicCondition =
  | { type: 'gender'; oneOf: ('male' | 'female')[] }
  | { type: 'age'; gte?: AgeRange; lt?: AgeRange }
  | { type: 'appType'; oneOf: ('ios' | 'android')[] }
  | { type: 'area'; oneOf: AreaCode[] }
  | { type: 'subscriptionPeriod'; gte?: PeriodRange; lt?: PeriodRange };

type AgeRange = 'age_15' | 'age_20' | 'age_25' | 'age_30' | 'age_35'
  | 'age_40' | 'age_45' | 'age_50';
```

#### 実装方針

新規モジュール `src/lib/line/narrowcast.ts` を作成する。

```typescript
// src/lib/line/narrowcast.ts
export async function narrowcastMessage(
  messages: LineMessage[],
  options: {
    audienceGroupId?: number;
    demographic?: DemographicFilter;
    maxRecipients?: number;
  }
): Promise<NarrowcastResult> {
  const body: NarrowcastRequest = { messages };

  if (options.audienceGroupId) {
    body.recipient = {
      type: 'audience',
      audienceGroupId: options.audienceGroupId,
    };
  }

  if (options.demographic) {
    body.filter = { demographic: options.demographic };
  }

  if (options.maxRecipients) {
    body.limit = { max: options.maxRecipients };
  }

  const res = await fetch('https://api.line.me/v2/bot/message/narrowcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.line.channelAccessToken}`,
      'X-Line-Retry-Key': crypto.randomUUID(), // 冪等性キー
    },
    body: JSON.stringify(body),
  });

  // Narrowcast は非同期処理。202 Accepted が返る。
  // 完了通知は Webhook (narrowcast completion event) で受け取る。
  if (res.status === 202) {
    const requestId = res.headers.get('x-line-request-id');
    return { success: true, requestId, status: 'accepted' };
  }
  // エラー処理は既存の messaging.ts パターンに準拠
}
```

**重要**: Narrowcast は非同期 API であり、レスポンスは `202 Accepted`。配信完了は Webhook イベント `delivery_completion` で通知される (4章参照)。

#### config.ts への追加

```typescript
// src/lib/line/config.ts に追加
line: {
  // ... 既存
  narrowcastUrl: 'https://api.line.me/v2/bot/message/narrowcast',
  audienceUrl: 'https://api.line.me/v2/bot/audienceGroup',
},
```

### 1.2 Audience 管理 API

CRM データに基づくセグメントを LINE の Audience として管理する。

#### Audience の種類

| 種類 | 用途 | API |
|------|------|-----|
| Upload Audience | User ID リストから作成 | `POST /v2/bot/audienceGroup/upload` |
| Click Audience | リッチメニュー / URL クリック者 | LINE Official Account Manager で作成 |
| Impression Audience | メッセージ開封者 | LINE Official Account Manager で作成 |
| Chat Tag Audience | チャットタグに基づく | LINE Official Account Manager で作成 |

本システムでは主に **Upload Audience** を API 経由で作成・管理する。

#### Upload Audience API

```typescript
// Audience 作成
interface CreateAudienceRequest {
  description: string;            // Audience名 (最大120文字)
  isIfaAudience: false;           // User ID ベース
  audiences: { id: string }[];    // LINE User ID の配列 (最大10,000件/リクエスト)
}

// POST https://api.line.me/v2/bot/audienceGroup/upload
// レスポンス: { audienceGroupId: number, ... }
```

```typescript
// Audience への User ID 追加 (既存 Audience に追加)
interface AddAudienceRequest {
  audienceGroupId: number;
  audiences: { id: string }[];    // 追加する User ID (最大10,000件)
}

// PUT https://api.line.me/v2/bot/audienceGroup/upload
```

#### CRM セグメント → Audience マッピング

CRM 側のセグメント定義から Audience を自動生成するモジュールを新設する。

```typescript
// src/lib/line/audience.ts

export type CrmSegment =
  | 'active-readers'        // 過去30日以内に記事クリック
  | 'coupon-users'          // クーポン利用実績あり
  | 'reservation-active'    // 直近予約あり
  | 'new-followers'         // 友だち追加7日以内
  | 'inactive-30d'          // 30日間未反応
  | 'vip';                  // 累積利用回数上位

export async function syncSegmentToAudience(
  segment: CrmSegment,
  userIds: string[],
): Promise<{ audienceGroupId: number }> { ... }

export async function getAudienceGroups(): Promise<AudienceGroup[]> {
  // GET https://api.line.me/v2/bot/audienceGroup/list
  // クエリ: page, size (最大40), description (検索)
}

export async function deleteAudience(audienceGroupId: number): Promise<void> {
  // DELETE https://api.line.me/v2/bot/audienceGroup/{audienceGroupId}
}
```

#### Audience 制限事項

- 1チャネルあたり最大 **1,000** Audience
- 1 Audience あたり最大 **10,000,000** User ID
- Upload API は 1リクエストあたり最大 **10,000** User ID --- バッチ分割が必要
- Audience のステータスが `READY` になるまで Narrowcast に使用不可 (数分かかる場合あり)

### 1.3 リッチメニュー切替 API

ユーザーのセグメントに応じてリッチメニューを動的に切り替える。

#### エンドポイント

```
# リッチメニュー作成
POST https://api.line.me/v2/bot/richmenu

# リッチメニュー画像アップロード
POST https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content

# ユーザーにリッチメニューを紐付け
POST https://api.line.me/v2/bot/user/{userId}/richmenu/{richMenuId}

# 複数ユーザーに一括紐付け
POST https://api.line.me/v2/bot/richmenu/bulk/link

# デフォルトリッチメニュー設定
POST https://api.line.me/v2/bot/user/all/richmenu/{richMenuId}
```

#### リッチメニュー設計

| メニュー名 | 対象セグメント | メニュー項目 |
|------------|---------------|-------------|
| `default-menu` | 全ユーザー (デフォルト) | マガジン / クーポン / 予約 / お問い合わせ |
| `vip-menu` | VIPセグメント | 限定コラム / VIPクーポン / 優先予約 / 専用サポート |
| `new-follower-menu` | 新規友だち (7日以内) | はじめてガイド / 初回クーポン / おすすめ記事 / 友だち紹介 |

#### 実装モジュール

```typescript
// src/lib/line/richmenu.ts

export async function createRichMenu(menu: RichMenuDefinition): Promise<string> { ... }
export async function setRichMenuImage(richMenuId: string, imageBuffer: Buffer): Promise<void> { ... }
export async function linkRichMenuToUser(userId: string, richMenuId: string): Promise<void> { ... }
export async function bulkLinkRichMenu(userIds: string[], richMenuId: string): Promise<void> {
  // POST /v2/bot/richmenu/bulk/link
  // body: { richMenuId, userIds } --- 最大500ユーザー/リクエスト
}
export async function setDefaultRichMenu(richMenuId: string): Promise<void> { ... }
```

#### リッチメニューサイズ仕様

- 画像サイズ: **2500x1686** または **2500x843** (px)
- 最大タップ領域数: **20**
- アクションタイプ: `uri` / `message` / `postback` / `richmenuswitch`

---

## 2. LINE Flex Message 新テンプレート設計

既存の5テンプレート (`daily-column`, `news-card`, `visual-magazine`, `minimal-text`, `premium-card`) に加え、以下の3テンプレートを追加する。

### 2.1 テンプレート ID 拡張

```typescript
// src/types/line.ts 変更

export type TemplateId =
  | 'daily-column'
  | 'news-card'
  | 'visual-magazine'
  | 'minimal-text'
  | 'premium-card'
  // --- v2 追加 ---
  | 'coupon-card'
  | 'reservation-confirm'
  | 'crm-notification';
```

### 2.2 クーポン用テンプレート (`coupon-card`)

クーポンコード・有効期限・割引率を視覚的に表示する Flex Message。

#### データ型

```typescript
export interface CouponMessageRequest {
  couponCode: string;           // 例: "SPRING2026"
  discountLabel: string;        // 例: "20%OFF" / "1,000円引き"
  title: string;                // 例: "春の特別クーポン"
  description: string;          // クーポン説明文
  expiresAt: string;            // ISO 8601 有効期限
  termsUrl?: string;            // 利用規約URL
  redeemUrl: string;            // クーポン利用URL (LIFF URL 推奨)
  thumbnailUrl?: string;        // 背景画像
}
```

#### Flex Message 構造

```
+---------------------------------------+
|  [クーポンバッジ]         有効期限     |  header (背景: ブランドカラー)
+---------------------------------------+
|                                       |
|         ★ 20%OFF ★                   |  body - 割引ラベル (大文字・太字)
|                                       |
|  春の特別クーポン                      |  タイトル
|  ─────────────────                    |  セパレーター
|  対象商品全品にご利用いただけます。      |  説明文
|                                       |
|  ┌─────────────────────┐             |
|  │  SPRING2026          │             |  クーポンコード (コピー可能エリア)
|  └─────────────────────┘             |
|                                       |
|  有効期限: 2026/04/30                  |  期限表示
+---------------------------------------+
|  [ クーポンを使う ]                    |  footer - CTA ボタン
+---------------------------------------+
```

#### ビルダー関数

```typescript
// src/lib/line/templates.ts に追加

function buildCouponCard(req: CouponMessageRequest): FlexContainer {
  const expiryDate = new Date(req.expiresAt);
  const formattedExpiry = `${expiryDate.getFullYear()}/${String(expiryDate.getMonth()+1).padStart(2,'0')}/${String(expiryDate.getDate()).padStart(2,'0')}`;

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box', layout: 'horizontal',
      paddingAll: 'lg', backgroundColor: '#E74C3C',
      contents: [
        { type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: 'COUPON', size: 'xs', color: '#FFFFFF', weight: 'bold' },
        ], backgroundColor: '#C0392B', cornerRadius: 'sm',
          paddingAll: 'xs', paddingStart: 'md', paddingEnd: 'md' },
        { type: 'filler' },
        { type: 'text', text: `〜${formattedExpiry}`, size: 'xxs', color: '#FFCCCC', align: 'end' },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: 'xl',
      contents: [
        { type: 'text', text: req.discountLabel, weight: 'bold', size: 'xxl',
          color: '#E74C3C', align: 'center' },
        { type: 'text', text: req.title, weight: 'bold', size: 'lg',
          color: '#1A1A2E', wrap: true, margin: 'lg', align: 'center' },
        { type: 'separator', color: '#EEEEEE', margin: 'lg' },
        { type: 'text', text: req.description, size: 'sm',
          color: '#555555', wrap: true, margin: 'lg' },
        { type: 'box', layout: 'vertical', margin: 'xl',
          backgroundColor: '#F5F5F5', cornerRadius: 'md', paddingAll: 'md',
          contents: [
            { type: 'text', text: 'クーポンコード', size: 'xxs', color: '#999999', align: 'center' },
            { type: 'text', text: req.couponCode, size: 'lg', weight: 'bold',
              color: '#E74C3C', align: 'center', margin: 'xs' },
          ],
        },
        { type: 'text', text: `有効期限: ${formattedExpiry}`,
          size: 'xs', color: '#999999', margin: 'lg', align: 'center' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: 'lg',
      contents: [
        { type: 'button',
          action: { type: 'uri', label: 'クーポンを使う', uri: req.redeemUrl },
          style: 'primary', color: '#E74C3C', height: 'sm' },
      ],
    },
    styles: { footer: { separator: true } },
  };
}
```

### 2.3 予約確認用テンプレート (`reservation-confirm`)

予約日時・場所・担当者・Google Meet URL を構造化して表示する。

#### データ型

```typescript
export interface ReservationMessageRequest {
  reservationId: string;           // 予約ID
  status: 'confirmed' | 'pending' | 'cancelled' | 'rescheduled';
  customerName: string;            // 顧客名
  dateTime: string;                // ISO 8601 予約日時
  duration: number;                // 分
  location: string;                // 場所 / "オンライン"
  staffName?: string;              // 担当者
  googleMeetUrl?: string;          // Google Meet URL
  notes?: string;                  // 備考
  rescheduleUrl?: string;          // 予約変更URL (LIFF URL 推奨)
  cancelUrl?: string;              // キャンセルURL
}
```

#### Flex Message 構造

```
+---------------------------------------+
|  ✓ 予約確認              #RSV-12345  |  header (ステータス色に応じて変化)
+---------------------------------------+
|                                       |
|  2026年3月25日（水）14:00〜15:00      |  日時 (大文字)
|                                       |
|  ─────────────────                    |
|  場所    meetSC オフィス              |  詳細テーブル
|  担当    山田 太郎                    |
|  備考    初回カウンセリング            |
|  ─────────────────                    |
|                                       |
|  📹 Google Meet で参加                |  Meet URL ボタン (存在する場合)
|     https://meet.google.com/xxx       |
|                                       |
+---------------------------------------+
|  [予約変更]    [キャンセル]            |  footer - 2ボタン
+---------------------------------------+
```

#### ステータス別ヘッダー色

| ステータス | 色 | ラベル |
|-----------|-----|-------|
| `confirmed` | `#27AE60` (緑) | 予約確定 |
| `pending` | `#F39C12` (黄) | 予約受付中 |
| `cancelled` | `#95A5A6` (灰) | キャンセル済み |
| `rescheduled` | `#3498DB` (青) | 日程変更済み |

#### ビルダー関数

```typescript
function buildReservationConfirm(req: ReservationMessageRequest): FlexContainer {
  const dt = new Date(req.dateTime);
  const days = ['日','月','火','水','木','金','土'];
  const dateStr = `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日（${days[dt.getDay()]}）`;
  const startTime = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  const endDt = new Date(dt.getTime() + req.duration * 60000);
  const endTime = `${String(endDt.getHours()).padStart(2,'0')}:${String(endDt.getMinutes()).padStart(2,'0')}`;

  const statusConfig = {
    confirmed:   { color: '#27AE60', label: '予約確定' },
    pending:     { color: '#F39C12', label: '予約受付中' },
    cancelled:   { color: '#95A5A6', label: 'キャンセル済み' },
    rescheduled: { color: '#3498DB', label: '日程変更済み' },
  }[req.status];

  // 詳細行を組み立て
  const detailRows: FlexComponent[] = [];
  const addRow = (label: string, value: string) => {
    detailRows.push({
      type: 'box', layout: 'horizontal', margin: 'md',
      contents: [
        { type: 'text', text: label, size: 'sm', color: '#999999', flex: 2 },
        { type: 'text', text: value, size: 'sm', color: '#333333', flex: 5, wrap: true },
      ],
    });
  };

  addRow('場所', req.location);
  if (req.staffName) addRow('担当', req.staffName);
  if (req.notes) addRow('備考', req.notes);

  // body contents
  const bodyContents: FlexComponent[] = [
    { type: 'text', text: dateStr, weight: 'bold', size: 'lg', color: '#1A1A2E' },
    { type: 'text', text: `${startTime} 〜 ${endTime}`, size: 'md',
      color: '#555555', margin: 'xs' },
    { type: 'separator', color: '#EEEEEE', margin: 'lg' },
    ...detailRows,
    { type: 'separator', color: '#EEEEEE', margin: 'lg' },
  ];

  // Google Meet ボタン (存在する場合)
  if (req.googleMeetUrl) {
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'lg',
      backgroundColor: '#EBF5FB', cornerRadius: 'md', paddingAll: 'md',
      contents: [
        { type: 'text', text: 'Google Meet で参加', size: 'sm',
          weight: 'bold', color: '#2980B9', align: 'center' },
        { type: 'text', text: req.googleMeetUrl, size: 'xxs',
          color: '#7FB3D8', align: 'center', margin: 'xs',
          action: { type: 'uri', label: 'Meet', uri: req.googleMeetUrl } },
      ],
    });
  }

  // footer buttons
  const footerContents: FlexComponent[] = [];
  if (req.rescheduleUrl && req.status !== 'cancelled') {
    footerContents.push({
      type: 'button',
      action: { type: 'uri', label: '予約変更', uri: req.rescheduleUrl },
      style: 'link', color: '#3498DB', height: 'sm',
    });
  }
  if (req.cancelUrl && req.status !== 'cancelled') {
    footerContents.push({
      type: 'button',
      action: { type: 'uri', label: 'キャンセル', uri: req.cancelUrl },
      style: 'link', color: '#E74C3C', height: 'sm',
    });
  }

  return {
    type: 'bubble', size: 'mega',
    header: {
      type: 'box', layout: 'horizontal',
      paddingAll: 'lg', backgroundColor: statusConfig.color,
      contents: [
        { type: 'text', text: statusConfig.label, size: 'sm',
          color: '#FFFFFF', weight: 'bold' },
        { type: 'filler' },
        { type: 'text', text: `#${req.reservationId}`, size: 'xxs',
          color: '#FFFFFFAA', align: 'end' },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: 'xl',
      contents: bodyContents,
    },
    footer: footerContents.length > 0 ? {
      type: 'box', layout: 'horizontal', paddingAll: 'md',
      contents: footerContents,
    } : undefined,
    styles: { footer: { separator: true } },
  };
}
```

### 2.4 CRM 通知用テンプレート (`crm-notification`)

CRM イベント (ステータス変更、ポイント付与、アクションリマインダー等) を汎用的に通知する。

#### データ型

```typescript
export interface CrmNotificationRequest {
  notificationType: 'status-change' | 'point-earned' | 'reminder' | 'announcement';
  iconEmoji?: string;             // 例: ラベル表示テキスト "UP" / "NEW" / "INFO"
  title: string;
  body: string;
  metadata?: { label: string; value: string }[];  // キー・バリューペア
  ctaLabel?: string;              // CTAボタンラベル
  ctaUrl?: string;                // CTAボタンURL
  accentColor?: string;           // ブランドカラー (デフォルト: #3498DB)
}
```

#### Flex Message 構造

```
+---------------------------------------+
|  [INFO] CRM通知                       |  header (notificationType に応じた色)
+---------------------------------------+
|                                       |
|  会員ランクが変更されました            |  タイトル
|  ─────────────────                    |
|  いつもご利用ありがとうございます。      |  本文
|  会員ランクがゴールドに昇格しました。   |
|                                       |
|  新ランク    ゴールド                  |  metadata テーブル (任意)
|  適用日      2026/03/24               |
|  特典        送料無料                  |
|                                       |
+---------------------------------------+
|  [ 詳細を確認 ]                        |  footer - CTA (任意)
+---------------------------------------+
```

#### notificationType 別スタイル

| タイプ | 色 | バッジラベル |
|-------|-----|------------|
| `status-change` | `#9B59B6` | UPDATE |
| `point-earned` | `#F39C12` | POINT |
| `reminder` | `#E67E22` | REMINDER |
| `announcement` | `#3498DB` | INFO |

### 2.5 テンプレート一覧 (更新後)

`src/lib/line/templates.ts` の `TEMPLATE_DEFINITIONS` に以下を追加する。

```typescript
// 追加分
{
  id: 'coupon-card',
  name: 'クーポンカード',
  description: 'クーポンコード・割引率・有効期限を目立つデザインで表示。利用ボタン付き。',
  category: 'プロモーション',
  previewColor: '#E74C3C',
  recommendedFor: 'クーポン配信・キャンペーン告知',
},
{
  id: 'reservation-confirm',
  name: '予約確認カード',
  description: '予約日時・場所・担当者・Google Meet URLを構造化表示。変更・キャンセルボタン付き。',
  category: '予約管理',
  previewColor: '#27AE60',
  recommendedFor: '予約確認通知・リマインダー',
},
{
  id: 'crm-notification',
  name: 'CRM通知カード',
  description: '会員ステータス変更・ポイント付与・リマインダーなどCRMイベントの汎用通知。',
  category: 'CRM',
  previewColor: '#3498DB',
  recommendedFor: 'CRM連携通知・ステータス更新',
},
```

---

## 3. LINE ログイン連携 (LIFF) によるWebアプリ統合

### 3.1 LIFF とは

LINE Front-end Framework (LIFF) は、LINE のトーク画面内でウェブアプリを表示する仕組み。LINE ログインと統合されており、ユーザーの LINE プロフィール情報を取得できる。

### 3.2 LIFF アプリの登録

LINE Developers Console で LIFF アプリを作成し、以下の情報を取得する。

| 項目 | 値 |
|------|-----|
| LIFF ID | `xxxx-xxxxxxxx` |
| LIFF URL | `https://liff.line.me/{LIFF_ID}` |
| Endpoint URL | `https://linemag.vercel.app/liff/*` |
| サイズ | `Full` / `Tall` / `Compact` |

#### 必要な LIFF アプリ (3つ)

| LIFF アプリ名 | サイズ | Endpoint | 用途 |
|--------------|--------|----------|------|
| `linemag-coupon` | Tall | `/liff/coupon` | クーポン利用画面 |
| `linemag-reservation` | Full | `/liff/reservation` | 予約変更・キャンセル画面 |
| `linemag-profile` | Full | `/liff/profile` | 会員プロフィール・設定画面 |

### 3.3 環境変数

```env
# .env.local に追加
NEXT_PUBLIC_LIFF_ID_COUPON=xxxx-xxxxxxxx
NEXT_PUBLIC_LIFF_ID_RESERVATION=xxxx-xxxxxxxx
NEXT_PUBLIC_LIFF_ID_PROFILE=xxxx-xxxxxxxx
LINE_LOGIN_CHANNEL_ID=xxxxxxxxxx
LINE_LOGIN_CHANNEL_SECRET=xxxxxxxxxxxxxxxx
```

### 3.4 LIFF SDK 初期化

```typescript
// src/lib/liff/init.ts

import liff from '@line/liff';

export async function initLiff(liffId: string): Promise<void> {
  await liff.init({ liffId });

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return;
  }
}

export async function getLiffProfile(): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
}> {
  const profile = await liff.getProfile();
  const decodedToken = liff.getDecodedIDToken();

  return {
    userId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl,
    email: decodedToken?.email,  // email scope が必要
  };
}

export function closeLiff(): void {
  if (liff.isInClient()) {
    liff.closeWindow();
  }
}

export function sendLiffMessage(text: string): void {
  if (liff.isInClient()) {
    liff.sendMessages([{ type: 'text', text }]);
  }
}
```

### 3.5 LIFF ページのルーティング

Next.js App Router に以下のルートを追加する。

```
src/app/liff/
  coupon/page.tsx          -- クーポン利用画面
  reservation/page.tsx     -- 予約管理画面
  profile/page.tsx         -- プロフィール・設定画面
  layout.tsx               -- LIFF 共通レイアウト (SDK 初期化)
```

#### LIFF 共通レイアウト

```typescript
// src/app/liff/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { initLiff } from '@/lib/liff/init';

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const liffId = determineLiffId(window.location.pathname);
    initLiff(liffId)
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div>LIFF初期化エラー: {error}</div>;
  if (!ready) return <div>読み込み中...</div>;
  return <>{children}</>;
}

function determineLiffId(pathname: string): string {
  if (pathname.startsWith('/liff/coupon'))
    return process.env.NEXT_PUBLIC_LIFF_ID_COUPON!;
  if (pathname.startsWith('/liff/reservation'))
    return process.env.NEXT_PUBLIC_LIFF_ID_RESERVATION!;
  return process.env.NEXT_PUBLIC_LIFF_ID_PROFILE!;
}
```

### 3.6 ユーザープロファイル取得の拡充

LIFF 連携により、Messaging API 単独では取得できない以下の情報が得られる。

| 情報 | Messaging API (現行) | LIFF (追加) |
|------|---------------------|-------------|
| User ID | `userId` | `userId` (同一) |
| 表示名 | `displayName` | `displayName` |
| プロフィール画像 | `pictureUrl` | `pictureUrl` |
| ステータスメッセージ | `statusMessage` | `statusMessage` |
| メールアドレス | 取得不可 | `email` (要 email scope) |
| OS / 言語 | 取得不可 | `liff.getOS()`, `liff.getLanguage()` |
| LIFF内かどうか | --- | `liff.isInClient()` |
| 友だち状態 | --- | `liff.getFriendship()` |

#### 拡張プロファイル型

```typescript
// src/types/line.ts に追加

export interface ExtendedUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;              // LIFF 経由
  os?: 'ios' | 'android' | 'web';
  language?: string;
  isFriend?: boolean;
  // CRM 拡張フィールド
  crmCustomerId?: string;
  segments?: string[];
  lastVisitAt?: string;
  reservationCount?: number;
  couponUsageCount?: number;
}
```

### 3.7 Google Meet 招待 URL の LINE 配信

予約確認テンプレート (`reservation-confirm`) に Google Meet URL を含めて配信する。

#### 配信フロー

```
1. 予約作成 (CRM / 管理画面)
2. Google Calendar API で予定作成 → Meet URL 自動生成
3. ReservationMessageRequest に googleMeetUrl をセット
4. reservation-confirm テンプレートで Flex Message 構築
5. Push API でユーザーに送信
```

#### API エンドポイント (新規)

```typescript
// src/app/api/line/reservation-notify/route.ts

export async function POST(request: NextRequest) {
  const body = await request.json();
  // バリデーション: reservationId, userId, dateTime, location が必須
  // Google Meet URL は任意
  const flex = buildReservationConfirm(body);
  await sendPush(body.userId, [{
    type: 'flex',
    altText: `予約確認: ${body.dateTime}`,
    contents: flex,
  }]);
}
```

---

## 4. Webhook 拡張

### 4.1 現行の課題

現行の Webhook (`src/app/api/line/webhook/route.ts`) は以下の制限がある。

- イベントタイプの区別なく全て同一処理 (User ID 記録のみ)
- 署名検証 (`x-line-signature`) が未実装
- `follow` / `unfollow` / `postback` 等の個別ハンドリングなし
- ファイルベースストレージ (本番環境では永続化されない)

### 4.2 署名検証の追加

```typescript
import crypto from 'crypto';

function verifySignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET!;
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}
```

**環境変数追加**: `LINE_CHANNEL_SECRET`

### 4.3 イベントタイプ別処理フロー

```typescript
// src/app/api/line/webhook/route.ts (リファクタ後)

interface WebhookEvent {
  type: 'message' | 'follow' | 'unfollow' | 'postback'
    | 'beacon' | 'accountLink' | 'memberJoined' | 'memberLeft'
    | 'things' | 'unsend' | 'videoPlayComplete'
    | 'delivery';   // Narrowcast 完了通知
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
  replyToken?: string;
  message?: MessageEventContent;
  postback?: PostbackContent;
  delivery?: DeliveryContent;
  link?: AccountLinkContent;
}

interface PostbackContent {
  data: string;                  // 例: "action=reschedule&id=RSV-12345"
  params?: {
    date?: string;               // date picker
    time?: string;               // time picker
    datetime?: string;           // datetime picker
  };
}

interface DeliveryContent {
  type: 'narrowcast';
  status: 'completed' | 'failed';
  // Narrowcast 配信完了通知
}
```

#### イベントハンドラーのディスパッチ

```typescript
// src/lib/line/webhook-handlers.ts

export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case 'follow':
      return handleFollow(event);
    case 'unfollow':
      return handleUnfollow(event);
    case 'message':
      return handleMessage(event);
    case 'postback':
      return handlePostback(event);
    case 'delivery':
      return handleDeliveryCompletion(event);
    case 'accountLink':
      return handleAccountLink(event);
    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }
}
```

#### 各ハンドラーの処理内容

| イベント | ハンドラー | 処理内容 |
|---------|-----------|---------|
| `follow` | `handleFollow` | ユーザー登録、ウェルカムメッセージ送信 (Reply API)、新規友だちリッチメニュー設定、CRM に新規リード作成 |
| `unfollow` | `handleUnfollow` | ユーザーステータスを `inactive` に更新、CRM にブロック通知 |
| `message` (text) | `handleMessage` | キーワード応答 ("予約" → 予約案内、"クーポン" → クーポン一覧)、その他は CRM ログに記録 |
| `postback` | `handlePostback` | `data` パラメータをパースし、予約変更・クーポン利用・アンケート回答等を処理 |
| `delivery` | `handleDeliveryCompletion` | Narrowcast 配信完了ログ記録、失敗時はアラート通知 |
| `accountLink` | `handleAccountLink` | LINE User ID と CRM Customer ID の紐付け完了処理 |

#### Postback データ設計

CTA ボタンのアクションに使用する postback data のフォーマット。

```
# 予約変更リクエスト
action=reschedule&reservationId=RSV-12345

# クーポン利用
action=redeem_coupon&couponCode=SPRING2026

# アンケート回答
action=survey&questionId=Q1&answer=5

# リッチメニュー切替リクエスト
action=switch_menu&menuType=vip
```

### 4.4 Reply API の活用

Webhook イベントの `replyToken` を使い、ユーザーへの即時返信を実装する。Push API と異なり無料。

```typescript
async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.line.channelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}
```

**注意**: `replyToken` の有効期限は **30秒**。Webhook 受信後すぐに返信する必要がある。

---

## 5. LINE 公式アカウントの権限・プラン要件

### 5.1 LINE 公式アカウントのプラン比較

| 項目 | コミュニケーションプラン | ライトプラン | スタンダードプラン |
|------|----------------------|------------|-----------------|
| 月額固定費 | 0円 | 5,000円 | 15,000円 |
| 無料メッセージ通数 | 200通/月 | 5,000通/月 | 30,000通/月 |
| 追加メッセージ | 不可 | 不可 | 〜3円/通 |
| Messaging API | 利用可 | 利用可 | 利用可 |
| Narrowcast API | 利用可 | 利用可 | 利用可 |
| Audience 管理 | 利用可 | 利用可 | 利用可 |

> **注**: 2023年6月以降のプラン体系。最新の料金は [LINE公式サイト](https://www.lycbiz.com/jp/service/line-official-account/plan/) を参照。

### 5.2 本システムに必要なプラン

**推奨: スタンダードプラン** (月額15,000円)

理由:
- CRM セグメント配信を含めると月間配信数が 5,000通を超える見込み
- 予約確認・クーポン配信はトランザクション系で通数が読みにくい
- 追加メッセージ購入が可能なのはスタンダードプランのみ

### 5.3 API 利用に必要な権限・設定

| 機能 | 必要な設定 | 設定場所 |
|------|-----------|---------|
| Messaging API | チャネル作成 | LINE Developers Console |
| Webhook | Webhook URL 設定 + 「Webhookの利用」ON | LINE Developers Console |
| フォロワーID取得 | 「チャットのメッセージ取得API」有効化 ※認証済みアカウント推奨 | LINE Official Account Manager |
| LINE ログイン | LINE ログインチャネル作成 | LINE Developers Console |
| LIFF | LIFF アプリ登録 (LINE ログインチャネル内) | LINE Developers Console |
| リッチメニュー API | Messaging API チャネルに自動付与 | --- |
| Narrowcast | Messaging API チャネルに自動付与 | --- |
| Audience 管理 | Messaging API チャネルに自動付与 | --- |

### 5.4 チャネル構成

```
LINE Developers Console
└── Provider: "meetSC"
    ├── Messaging API チャネル (既存)
    │   ├── Channel Access Token (long-lived)
    │   ├── Channel Secret
    │   ├── Webhook URL: https://linemag.vercel.app/api/line/webhook
    │   └── 機能: Broadcast, Push, Narrowcast, Audience, RichMenu
    │
    └── LINE ログインチャネル (新規作成)
        ├── Channel ID
        ├── Channel Secret
        ├── LIFF アプリ x3
        │   ├── linemag-coupon (Tall)
        │   ├── linemag-reservation (Full)
        │   └── linemag-profile (Full)
        └── Scopes: profile, openid, email
```

### 5.5 認証済みアカウント

フォロワーID一覧取得 (`GET /v2/bot/followers/ids`) は **認証済みアカウント** が推奨。未認証アカウントの場合、API からのフォロワーID取得が制限される (既存の `followers.ts` で 403 エラーハンドリング済み)。

認証済みアカウントの申請条件:
- 法人または個人事業主
- 審査あり (1〜2週間)
- アカウント名に青色バッジが付く

---

## 6. メッセージ配信の最適化

### 6.1 メッセージ通数のカウントルール

LINE のメッセージ通数は以下のようにカウントされる。

| 配信方法 | カウント |
|---------|---------|
| Broadcast | 友だち数 x 1 (=配信先人数分) |
| Push (1対1) | 1通 |
| Narrowcast | 配信先人数分 |
| Reply | **カウントされない** (無料) |
| Multicast (複数Push) | 送信先人数分 |

**重要**: 1回の API コールで複数メッセージ (最大5件) を送っても、通数は **1通** としてカウントされる。

### 6.2 コスト試算

#### 前提条件

| パラメータ | 値 |
|-----------|-----|
| 友だち数 | 500人 |
| 月間 Broadcast | 30回 (毎日1回) |
| 月間セグメント配信 | 8回 (週2回、対象50%想定) |
| 予約確認 Push | 200件/月 |
| クーポン配信 (Narrowcast) | 4回/月 (対象30%想定) |
| Reply (Webhook返信) | 無制限 (無料) |

#### 通数計算

| 配信種別 | 計算式 | 月間通数 |
|---------|--------|---------|
| Broadcast | 500人 x 30回 | 15,000通 |
| セグメント配信 | 250人 x 8回 | 2,000通 |
| 予約確認 Push | 1人 x 200回 | 200通 |
| クーポン Narrowcast | 150人 x 4回 | 600通 |
| **合計** | | **17,800通/月** |

#### 月額コスト

```
スタンダードプラン: 15,000円 (30,000通まで無料)
→ 17,800通は無料枠内
→ 月額コスト: 15,000円

※ 友だち数が増加した場合の試算:
  1,000人の場合: 約35,600通/月
  → 超過 5,600通 x 3円 = 16,800円
  → 月額コスト: 31,800円

  2,000人の場合: 約71,200通/月
  → 超過 41,200通 x 3円 = 123,600円
  → 月額コスト: 138,600円
```

### 6.3 通数削減の戦略

| 戦略 | 効果 | 実装方法 |
|------|------|---------|
| Reply API の最大活用 | Reply は無料 | Webhook 応答を全て Reply で返す |
| セグメント精度の向上 | 不要な配信を削減 | Narrowcast + Audience で対象を絞る |
| メッセージバンドル | 1通で複数メッセージ | 1 API コールに最大5メッセージを同梱 |
| 配信頻度の最適化 | Broadcast 回数削減 | 週次まとめ配信の導入 |
| A/B テスト | 効果の高いメッセージに集中 | Narrowcast の limit パラメータで一部配信→効果測定 |

### 6.4 配信数制限 (Rate Limit)

| API | Rate Limit | 備考 |
|-----|-----------|------|
| Push / Broadcast / Narrowcast | 合計 **100,000リクエスト/分** | ほぼ制限に達しない |
| Reply | **制限なし** | --- |
| Get Profile | **2,000リクエスト/秒** | バッチ取得時に注意 |
| Audience 作成 | --- | 1チャネル1,000件まで |
| LIFF API | --- | クライアント側制限なし |

既存の `messaging.ts` では 429 (Rate Limit) 時に 60秒待機 + 1回リトライの処理が実装済み。Narrowcast API でも同様のリトライロジックを適用する。

### 6.5 配信キューの設計

大量配信時にレートリミットを回避するため、配信キューを導入する。

```typescript
// src/lib/line/queue.ts

interface QueuedMessage {
  id: string;
  type: 'broadcast' | 'narrowcast' | 'push';
  payload: unknown;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt?: string;        // 予約配信
  createdAt: string;
  processedAt?: string;
  retryCount: number;
  error?: string;
}

export async function enqueueMessage(msg: Omit<QueuedMessage, 'id' | 'status' | 'createdAt' | 'retryCount'>): Promise<string> { ... }

export async function processQueue(): Promise<void> {
  // Vercel Cron から呼び出し (1分間隔)
  // pending メッセージを取得し、順次送信
  // 失敗時は retryCount をインクリメントして再キューイング (最大3回)
}
```

### 6.6 配信ログ・分析

配信結果のトラッキングのため、以下のエンドポイントを活用する。

```
# メッセージ送信数の取得
GET https://api.line.me/v2/bot/insight/message/delivery?date=20260324

# フォロワー数推移
GET https://api.line.me/v2/bot/insight/followers?date=20260324

# メッセージイベント (Narrowcast 用)
GET https://api.line.me/v2/bot/insight/message/event?requestId={requestId}
```

これらの Insight API を定期取得し、ダッシュボードに表示する。

---

## 付録

### A. 環境変数一覧 (追加分)

```env
# LINE Channel (既存)
LINE_CHANNEL_ACCESS_TOKEN=xxx       # 既存
ADMIN_LINE_USER_ID=xxx              # 既存

# LINE Channel (追加)
LINE_CHANNEL_SECRET=xxx             # Webhook署名検証用

# LINE Login / LIFF (新規)
LINE_LOGIN_CHANNEL_ID=xxx
LINE_LOGIN_CHANNEL_SECRET=xxx
NEXT_PUBLIC_LIFF_ID_COUPON=xxx
NEXT_PUBLIC_LIFF_ID_RESERVATION=xxx
NEXT_PUBLIC_LIFF_ID_PROFILE=xxx
```

### B. 新規・変更ファイル一覧

```
# 新規作成
src/lib/line/narrowcast.ts          -- Narrowcast API クライアント
src/lib/line/audience.ts            -- Audience 管理
src/lib/line/richmenu.ts            -- リッチメニュー管理
src/lib/line/webhook-handlers.ts    -- Webhook イベントハンドラー
src/lib/line/queue.ts               -- 配信キュー
src/lib/liff/init.ts                -- LIFF SDK 初期化
src/app/liff/layout.tsx             -- LIFF 共通レイアウト
src/app/liff/coupon/page.tsx        -- クーポン利用画面
src/app/liff/reservation/page.tsx   -- 予約管理画面
src/app/liff/profile/page.tsx       -- プロフィール画面
src/app/api/line/reservation-notify/route.ts  -- 予約通知API
src/app/api/line/coupon-send/route.ts         -- クーポン配信API
src/app/api/line/narrowcast/route.ts          -- Narrowcast配信API

# 変更
src/types/line.ts                   -- 型定義追加 (TemplateId, 新テンプレート型, ExtendedUserProfile)
src/lib/line/config.ts              -- URL・設定追加
src/lib/line/templates.ts           -- 3テンプレート追加
src/app/api/line/webhook/route.ts   -- 署名検証・イベントディスパッチ
```

### C. npm パッケージ追加

```json
{
  "dependencies": {
    "@line/liff": "^2.24.0"
  }
}
```

### D. 実装優先度

| 優先度 | 機能 | 工数見積 | 依存 |
|--------|------|---------|------|
| P0 | Webhook 署名検証 | 0.5日 | なし (セキュリティ上即時対応) |
| P0 | Webhook イベントハンドラー拡張 | 1日 | Webhook署名検証 |
| P1 | 予約確認テンプレート + Google Meet | 1日 | なし |
| P1 | クーポンテンプレート | 1日 | なし |
| P1 | CRM 通知テンプレート | 0.5日 | なし |
| P2 | Narrowcast API + Audience 管理 | 2日 | Webhook拡張 (完了通知受信) |
| P2 | LIFF アプリ (クーポン利用画面) | 2日 | LINE ログインチャネル作成 |
| P2 | LIFF アプリ (予約管理画面) | 2日 | LINE ログインチャネル作成 |
| P3 | リッチメニュー動的切替 | 1.5日 | Audience 管理 |
| P3 | 配信キュー | 1.5日 | Narrowcast |
| P3 | LIFF プロフィール画面 | 1日 | LIFF 基盤 |
| P3 | Insight API 連携 | 1日 | なし |

**合計見積: 約15日 (3週間)**
