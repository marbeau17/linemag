# 11. API設計仕様書

## 目次

1. [API設計原則](#1-api設計原則)
2. [全エンドポイント一覧](#2-全エンドポイント一覧)
3. [エラーハンドリング標準](#3-エラーハンドリング標準)
4. [認証・認可フロー](#4-認証認可フロー)
5. [レート制限設計](#5-レート制限設計)
6. [APIドキュメント自動生成方針](#6-apiドキュメント自動生成方針)

---

## 1. API設計原則

### 1.1 RESTful設計

本システムは Next.js 14 App Router の Route Handlers を基盤とし、RESTful API を構築する。

| 原則 | 適用方針 |
|------|----------|
| リソース指向 | URL はリソース（名詞）を表す。動詞は HTTP メソッドで表現する |
| ステートレス | 各リクエストは独立して処理可能。セッション状態はサーバーに保持しない |
| 統一インターフェース | 全 API で共通のリクエスト/レスポンス形式を使用する |
| HATEOAS | 将来的な導入を想定し、レスポンスに `_links` フィールドを予約する |

### 1.2 命名規則

```
/api/v1/{ドメイン}/{リソース}
/api/v1/{ドメイン}/{リソース}/{id}
/api/v1/{ドメイン}/{リソース}/{id}/{サブリソース}
```

**規約:**

- パスはすべて **小文字ケバブケース**（`kebab-case`）で統一する
- リソース名は **複数形** を使用する（例: `/customers`, `/coupons`）
- ネスト（サブリソース）は **2階層まで** とする
- クエリパラメータはスネークケース（`snake_case`）を使用する
- リクエスト/レスポンスボディの JSON キーはキャメルケース（`camelCase`）を使用する

**既存 API との互換性:**

既存の `/api/line/*` エンドポイントはバージョニングなし（`v1` プレフィックスなし）で運用中のため、以下の移行戦略を採用する。

| フェーズ | パス | 状態 |
|----------|------|------|
| 現行 | `/api/line/*` | 既存エンドポイント。当面維持する |
| 新規 | `/api/v1/*` | 全新規 API はバージョン付きパスで作成する |
| 将来 | `/api/v1/line/*` | 既存 API を段階的に v1 パスへ移行する |

### 1.3 バージョニング

- **方式:** URL パスベース（`/api/v1/`）
- **互換性:** メジャーバージョン内では後方互換性を維持する
- **非推奨:** フィールド削除は最低2バージョン間の猶予期間を設け、レスポンスヘッダ `Deprecation` で通知する
- **並行運用:** 旧バージョンは最低6ヶ月間並行運用し、`Sunset` ヘッダで終了日を通知する

### 1.4 HTTP メソッドの使い分け

| メソッド | 用途 | べき等性 | 例 |
|----------|------|----------|-----|
| GET | リソースの取得 | Yes | 顧客一覧の取得 |
| POST | リソースの作成、アクション実行 | No | クーポン作成、配信実行 |
| PUT | リソースの全体更新 | Yes | スケジュール設定の更新 |
| PATCH | リソースの部分更新 | Yes | 顧客タグの追加 |
| DELETE | リソースの削除 | Yes | 予約のキャンセル |

### 1.5 共通レスポンス形式

**成功時（単一リソース）:**

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-03-24T10:00:00Z"
  }
}
```

**成功時（コレクション）:**

```json
{
  "data": [ ... ],
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-03-24T10:00:00Z"
  },
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalPages": 5,
    "totalCount": 100
  }
}
```

**ページネーション共通クエリパラメータ:**

| パラメータ | 型 | デフォルト | 最大値 | 説明 |
|------------|-----|-----------|--------|------|
| `page` | number | 1 | - | ページ番号 |
| `per_page` | number | 20 | 100 | 1ページあたりの件数 |
| `sort` | string | リソース依存 | - | ソートフィールド |
| `order` | string | `desc` | - | `asc` または `desc` |

---

## 2. 全エンドポイント一覧

### 2.1 既存API（LINE配信ドメイン）

> 現行パス `/api/line/*` で運用中。将来的に `/api/v1/line/*` へ移行予定。

#### スクレイピング

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| POST | `/api/line/scrape-list` | 記事一覧取得 | なし | `{ articles: ScrapedArticle[], count: number, logs: string[] }` |
| POST | `/api/line/scrape-detail` | 記事詳細スクレイピング | `{ url: string }` | `{ article: ScrapedArticle }` |
| POST | `/api/line/scrape` | 記事スクレイピング＋要約 | `{ url: string }` | `{ article: ScrapedArticle, summary: SummaryResult }` |

#### LINE配信

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| POST | `/api/line/broadcast` | 全フォロワーへブロードキャスト | `BroadcastRequest` | `{ success: boolean, sentAt: string }` |
| POST | `/api/line/test-broadcast` | テスト配信 | `BroadcastRequest` | `{ success: boolean, sentAt: string }` |
| POST | `/api/line/push` | 個別ユーザーへプッシュ | `{ userId: string } & BroadcastRequest` | `{ success: boolean, sentAt: string }` |

#### フォロワー・履歴・ログ

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/line/followers` | フォロワー一覧取得 | なし | `{ followers: Follower[], count: number }` |
| GET | `/api/line/history` | 配信履歴取得 | `?limit=50` | `{ history: BroadcastHistory[] }` |
| GET | `/api/line/logs` | 実行ログ取得 | `?limit=100&step=CRON` | `{ logs: LogEntry[] }` |

#### スケジュール

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/line/schedule` | スケジュール設定取得 | なし | `ScheduleConfig` |
| PUT | `/api/line/schedule` | スケジュール設定更新 | `Partial<ScheduleConfig>` | `{ success: boolean, schedule: ScheduleConfig }` |

#### Webhook

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| POST | `/api/line/webhook` | LINEイベント受信 | `WebhookBody` | `{ status: "ok" }` |
| GET | `/api/line/webhook` | 記録済みユーザー一覧 | なし | `{ users: StoredUser[], count: number }` |

#### Cron

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/cron/line-broadcast` | 定期配信実行 | `Authorization: Bearer {CRON_SECRET}` | `{ message: string, results: CronResult[] }` |

---

### 2.2 新規API: 認証（Auth）

> パス: `/api/v1/auth/*`

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| POST | `/api/v1/auth/login` | 管理者ログイン | `{ email: string, password: string }` | `{ data: { accessToken: string, refreshToken: string, expiresIn: number } }` |
| POST | `/api/v1/auth/refresh` | トークンリフレッシュ | `{ refreshToken: string }` | `{ data: { accessToken: string, expiresIn: number } }` |
| POST | `/api/v1/auth/logout` | ログアウト | なし（Authorization ヘッダ必須） | `{ data: { message: "logged out" } }` |
| GET | `/api/v1/auth/me` | 自分の管理者情報取得 | なし（Authorization ヘッダ必須） | `{ data: AdminUser }` |

**型定義:**

```typescript
interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor";
  createdAt: string;
  lastLoginAt: string;
}
```

---

### 2.3 新規API: CRM（顧客管理）

> パス: `/api/v1/crm/*`

#### 顧客 CRUD

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/crm/customers` | 顧客一覧取得 | `?page=1&per_page=20&tag=VIP&search=田中` | `{ data: Customer[], pagination }` |
| POST | `/api/v1/crm/customers` | 顧客作成 | `CreateCustomerRequest` | `{ data: Customer }` |
| GET | `/api/v1/crm/customers/{id}` | 顧客詳細取得 | なし | `{ data: Customer }` |
| PUT | `/api/v1/crm/customers/{id}` | 顧客更新 | `UpdateCustomerRequest` | `{ data: Customer }` |
| DELETE | `/api/v1/crm/customers/{id}` | 顧客削除（論理削除） | なし | `{ data: { message: "deleted" } }` |
| GET | `/api/v1/crm/customers/{id}/activities` | 顧客アクティビティ取得 | `?page=1&per_page=50` | `{ data: Activity[], pagination }` |

**型定義:**

```typescript
interface Customer {
  id: string;
  lineUserId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  tags: Tag[];
  segments: string[];
  note: string;
  firstContactAt: string;
  lastContactAt: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateCustomerRequest {
  lineUserId?: string;
  name: string;
  email?: string;
  phone?: string;
  tagIds?: string[];
  note?: string;
}

interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phone?: string;
  tagIds?: string[];
  note?: string;
}

interface Activity {
  id: string;
  customerId: string;
  type: "message_received" | "message_sent" | "coupon_used"
       | "reservation_made" | "tag_added" | "tag_removed";
  description: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}
```

#### タグ管理

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/crm/tags` | タグ一覧取得 | なし | `{ data: Tag[] }` |
| POST | `/api/v1/crm/tags` | タグ作成 | `{ name: string, color: string }` | `{ data: Tag }` |
| PUT | `/api/v1/crm/tags/{id}` | タグ更新 | `{ name?: string, color?: string }` | `{ data: Tag }` |
| DELETE | `/api/v1/crm/tags/{id}` | タグ削除 | なし | `{ data: { message: "deleted" } }` |
| POST | `/api/v1/crm/customers/{id}/tags` | 顧客にタグ付与 | `{ tagIds: string[] }` | `{ data: Customer }` |
| DELETE | `/api/v1/crm/customers/{id}/tags/{tagId}` | 顧客からタグ除去 | なし | `{ data: Customer }` |

```typescript
interface Tag {
  id: string;
  name: string;
  color: string;           // hex カラーコード例: "#FF5733"
  customerCount: number;
  createdAt: string;
}
```

#### セグメント管理

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/crm/segments` | セグメント一覧取得 | なし | `{ data: Segment[] }` |
| POST | `/api/v1/crm/segments` | セグメント作成 | `CreateSegmentRequest` | `{ data: Segment }` |
| GET | `/api/v1/crm/segments/{id}` | セグメント詳細取得 | なし | `{ data: Segment }` |
| PUT | `/api/v1/crm/segments/{id}` | セグメント更新 | `UpdateSegmentRequest` | `{ data: Segment }` |
| DELETE | `/api/v1/crm/segments/{id}` | セグメント削除 | なし | `{ data: { message: "deleted" } }` |
| GET | `/api/v1/crm/segments/{id}/customers` | セグメントに属する顧客一覧 | `?page=1&per_page=20` | `{ data: Customer[], pagination }` |

```typescript
interface Segment {
  id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  matchType: "all" | "any";         // AND / OR 条件
  customerCount: number;
  isAutoUpdate: boolean;             // 条件に基づく自動更新の有無
  createdAt: string;
  updatedAt: string;
}

interface SegmentRule {
  field: "tag" | "lastContactAt" | "messageCount"
       | "couponUsageCount" | "reservationCount";
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
          | "contains" | "not_contains" | "in" | "not_in";
  value: string | number | string[];
}

type CreateSegmentRequest = Omit<Segment, "id" | "customerCount" | "createdAt" | "updatedAt">;
type UpdateSegmentRequest = Partial<CreateSegmentRequest>;
```

---

### 2.4 新規API: クーポン

> パス: `/api/v1/coupons/*`

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/coupons` | クーポン一覧取得 | `?page=1&per_page=20&status=active` | `{ data: Coupon[], pagination }` |
| POST | `/api/v1/coupons` | クーポン作成 | `CreateCouponRequest` | `{ data: Coupon }` |
| GET | `/api/v1/coupons/{id}` | クーポン詳細取得 | なし | `{ data: Coupon }` |
| PUT | `/api/v1/coupons/{id}` | クーポン更新 | `UpdateCouponRequest` | `{ data: Coupon }` |
| DELETE | `/api/v1/coupons/{id}` | クーポン削除（論理削除） | なし | `{ data: { message: "deleted" } }` |
| POST | `/api/v1/coupons/{id}/distribute` | クーポン配布 | `{ customerIds?: string[], segmentId?: string }` | `{ data: { distributedCount: number, distributions: Distribution[] } }` |
| POST | `/api/v1/coupons/{id}/redeem` | クーポン利用 | `{ customerId: string, code: string }` | `{ data: { redeemed: boolean, remainingUses: number } }` |
| GET | `/api/v1/coupons/{id}/stats` | クーポン統計取得 | なし | `{ data: CouponStats }` |

```typescript
interface Coupon {
  id: string;
  code: string;                      // ユニークなクーポンコード
  name: string;
  description: string;
  discountType: "percentage" | "fixed_amount" | "free_item";
  discountValue: number;
  maxUsageTotal: number | null;      // null = 無制限
  maxUsagePerUser: number;
  usedCount: number;
  status: "draft" | "active" | "expired" | "disabled";
  startsAt: string;
  expiresAt: string;
  targetSegmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

type CreateCouponRequest = Omit<Coupon,
  "id" | "usedCount" | "status" | "createdAt" | "updatedAt">;
type UpdateCouponRequest = Partial<CreateCouponRequest> & { status?: Coupon["status"] };

interface Distribution {
  customerId: string;
  couponId: string;
  code: string;
  distributedAt: string;
  redeemedAt: string | null;
}

interface CouponStats {
  couponId: string;
  totalDistributed: number;
  totalRedeemed: number;
  redemptionRate: number;            // 0.0 - 1.0
  distributionsByDate: { date: string; count: number }[];
  redemptionsByDate: { date: string; count: number }[];
}
```

---

### 2.5 新規API: 予約

> パス: `/api/v1/reservations/*`

#### スロット管理

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/reservations/slots` | 利用可能スロット取得 | `?date_from=2026-03-24&date_to=2026-03-31` | `{ data: Slot[] }` |
| POST | `/api/v1/reservations/slots` | スロット一括作成 | `CreateSlotsRequest` | `{ data: Slot[] }` |
| PUT | `/api/v1/reservations/slots/{id}` | スロット更新 | `UpdateSlotRequest` | `{ data: Slot }` |
| DELETE | `/api/v1/reservations/slots/{id}` | スロット削除 | なし | `{ data: { message: "deleted" } }` |

#### 予約 CRUD

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/reservations` | 予約一覧取得 | `?page=1&per_page=20&status=confirmed&date_from=...` | `{ data: Reservation[], pagination }` |
| POST | `/api/v1/reservations` | 予約作成 | `CreateReservationRequest` | `{ data: Reservation }` |
| GET | `/api/v1/reservations/{id}` | 予約詳細取得 | なし | `{ data: Reservation }` |
| PUT | `/api/v1/reservations/{id}` | 予約更新 | `UpdateReservationRequest` | `{ data: Reservation }` |
| POST | `/api/v1/reservations/{id}/cancel` | 予約キャンセル | `{ reason?: string }` | `{ data: Reservation }` |
| POST | `/api/v1/reservations/{id}/confirm` | 予約確定 | なし | `{ data: Reservation }` |

#### Google Meet 連携

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| POST | `/api/v1/reservations/{id}/meet` | Google Meetリンク生成 | なし | `{ data: { meetUrl: string, calendarEventId: string } }` |

```typescript
interface Slot {
  id: string;
  date: string;                     // "2026-03-25"
  startTime: string;                // "10:00"
  endTime: string;                  // "11:00"
  capacity: number;
  bookedCount: number;
  isAvailable: boolean;
  createdAt: string;
}

interface CreateSlotsRequest {
  dateFrom: string;
  dateTo: string;
  timeSlots: { startTime: string; endTime: string }[];
  capacity: number;
  excludeDays?: number[];           // 0=日, 6=土
}

type UpdateSlotRequest = Partial<Pick<Slot, "capacity" | "isAvailable">>;

interface Reservation {
  id: string;
  customerId: string;
  customerName: string;
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  note: string;
  meetUrl: string | null;
  calendarEventId: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateReservationRequest {
  customerId: string;
  slotId: string;
  note?: string;
  autoCreateMeet?: boolean;
}

type UpdateReservationRequest = Partial<Pick<
  Reservation, "note" | "date" | "slotId"
>>;
```

---

### 2.6 新規API: ユーザープロファイル

> パス: `/api/v1/profiles/*`

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/profiles/{lineUserId}` | LINEユーザーのプロファイル取得 | なし | `{ data: UserProfile }` |
| PUT | `/api/v1/profiles/{lineUserId}` | プロファイル更新 | `UpdateProfileRequest` | `{ data: UserProfile }` |
| GET | `/api/v1/profiles/{lineUserId}/interactions` | ユーザーのインタラクション履歴 | `?page=1&per_page=50&type=message` | `{ data: Interaction[], pagination }` |

```typescript
interface UserProfile {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage: string | null;
  customerId: string | null;         // CRM顧客IDとの紐付け
  preferences: {
    categories: string[];            // 興味カテゴリ
    notificationEnabled: boolean;
    language: string;
  };
  stats: {
    messageCount: number;
    lastMessageAt: string | null;
    couponsUsed: number;
    reservationsMade: number;
  };
  firstSeenAt: string;
  lastSeenAt: string;
}

interface UpdateProfileRequest {
  preferences?: Partial<UserProfile["preferences"]>;
  customerId?: string;
}

interface Interaction {
  id: string;
  lineUserId: string;
  type: "message_received" | "message_sent" | "follow"
       | "unfollow" | "postback" | "coupon_received" | "coupon_used";
  content: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}
```

---

### 2.7 新規API: 分析

> パス: `/api/v1/analytics/*`

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/v1/analytics/kpi` | KPIサマリー取得 | `?date_from=2026-03-01&date_to=2026-03-24` | `{ data: KpiSummary }` |
| GET | `/api/v1/analytics/kpi/trends` | KPIトレンド取得 | `?date_from=...&date_to=...&interval=daily` | `{ data: KpiTrend[] }` |
| GET | `/api/v1/analytics/broadcasts` | 配信分析 | `?date_from=...&date_to=...` | `{ data: BroadcastAnalytics }` |
| GET | `/api/v1/analytics/coupons` | クーポン分析 | `?date_from=...&date_to=...` | `{ data: CouponAnalytics }` |
| GET | `/api/v1/analytics/reservations` | 予約分析 | `?date_from=...&date_to=...` | `{ data: ReservationAnalytics }` |
| POST | `/api/v1/analytics/reports` | レポート生成 | `CreateReportRequest` | `{ data: Report }` |
| GET | `/api/v1/analytics/reports` | レポート一覧取得 | `?page=1&per_page=10` | `{ data: Report[], pagination }` |
| GET | `/api/v1/analytics/reports/{id}` | レポート詳細取得 | なし | `{ data: Report }` |
| GET | `/api/v1/analytics/reports/{id}/download` | レポートダウンロード | `?format=csv` | バイナリ（CSV/PDF） |

```typescript
interface KpiSummary {
  period: { from: string; to: string };
  followers: {
    total: number;
    new: number;
    churned: number;
    netGrowth: number;
    growthRate: number;              // 百分率
  };
  broadcasts: {
    totalSent: number;
    successRate: number;
    avgOpenRate: number;
  };
  coupons: {
    totalDistributed: number;
    totalRedeemed: number;
    redemptionRate: number;
  };
  reservations: {
    totalBooked: number;
    totalCompleted: number;
    cancellationRate: number;
    avgBookingLeadDays: number;
  };
}

interface KpiTrend {
  date: string;
  followers: number;
  newFollowers: number;
  broadcastsSent: number;
  couponsRedeemed: number;
  reservationsBooked: number;
}

interface BroadcastAnalytics {
  period: { from: string; to: string };
  totalBroadcasts: number;
  successRate: number;
  templateBreakdown: { templateId: string; count: number; successRate: number }[];
  timeSlotBreakdown: { hour: number; count: number; avgOpenRate: number }[];
}

interface CouponAnalytics {
  period: { from: string; to: string };
  activeCoupons: number;
  topCoupons: { couponId: string; name: string; redemptionRate: number }[];
  distributionTrend: { date: string; distributed: number; redeemed: number }[];
}

interface ReservationAnalytics {
  period: { from: string; to: string };
  totalReservations: number;
  completionRate: number;
  cancellationRate: number;
  peakHours: { hour: number; count: number }[];
  avgUtilizationRate: number;
}

interface CreateReportRequest {
  name: string;
  type: "kpi_summary" | "broadcast_detail" | "coupon_detail"
       | "reservation_detail" | "custom";
  dateFrom: string;
  dateTo: string;
  format: "csv" | "pdf";
  sections?: string[];               // typeが"custom"の場合のみ
}

interface Report {
  id: string;
  name: string;
  type: string;
  status: "generating" | "ready" | "failed";
  dateFrom: string;
  dateTo: string;
  format: "csv" | "pdf";
  fileUrl: string | null;
  fileSize: number | null;
  generatedAt: string | null;
  createdAt: string;
}
```

---

### 2.8 新規API: 定期実行（Cron）

> パス: `/api/cron/*`（既存の `/api/cron/line-broadcast` に追加）

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|-----------|-----------|
| GET | `/api/cron/line-broadcast` | 定期配信実行（既存） | `Authorization: Bearer {CRON_SECRET}` | 既存仕様参照 |
| GET | `/api/cron/segment-refresh` | セグメント自動更新 | `Authorization: Bearer {CRON_SECRET}` | `{ refreshed: number, errors: string[] }` |
| GET | `/api/cron/coupon-expiry-check` | クーポン期限切れチェック＋通知 | `Authorization: Bearer {CRON_SECRET}` | `{ expired: number, notified: number }` |
| GET | `/api/cron/reservation-reminder` | 予約リマインダー送信 | `Authorization: Bearer {CRON_SECRET}` | `{ sent: number, errors: string[] }` |

---

## 3. エラーハンドリング標準

### 3.1 エラーレスポンス形式

すべてのエラーレスポンスは以下の統一形式に従う。

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "リクエストパラメータが不正です",
    "details": [
      {
        "field": "email",
        "message": "メールアドレスの形式が不正です",
        "code": "INVALID_FORMAT"
      }
    ],
    "requestId": "req_abc123"
  }
}
```

### 3.2 エラーコード体系

エラーコードは `{カテゴリ}_{詳細}` の命名規則に従う。

#### 共通エラー（HTTP 4xx）

| HTTP | エラーコード | 説明 |
|------|-------------|------|
| 400 | `VALIDATION_ERROR` | リクエストバリデーション失敗 |
| 400 | `INVALID_PARAMETER` | 個別パラメータ不正 |
| 400 | `MISSING_PARAMETER` | 必須パラメータ欠落 |
| 401 | `AUTHENTICATION_REQUIRED` | 認証情報なし |
| 401 | `TOKEN_EXPIRED` | JWTトークン期限切れ |
| 401 | `TOKEN_INVALID` | JWTトークン不正 |
| 403 | `PERMISSION_DENIED` | 権限不足 |
| 404 | `RESOURCE_NOT_FOUND` | リソースが見つからない |
| 409 | `CONFLICT` | リソースの競合（重複作成など） |
| 409 | `SLOT_ALREADY_BOOKED` | 予約スロットが既に埋まっている |
| 422 | `UNPROCESSABLE_ENTITY` | セマンティックエラー（形式は正しいが処理不可） |
| 429 | `RATE_LIMIT_EXCEEDED` | レート制限超過 |

#### サーバーエラー（HTTP 5xx）

| HTTP | エラーコード | 説明 |
|------|-------------|------|
| 500 | `INTERNAL_ERROR` | 内部サーバーエラー |
| 502 | `LINE_API_ERROR` | LINE Messaging API のエラー |
| 502 | `GOOGLE_API_ERROR` | Google Calendar/Meet API のエラー |
| 503 | `SERVICE_UNAVAILABLE` | 外部サービス一時的利用不可 |
| 504 | `GATEWAY_TIMEOUT` | 外部サービスタイムアウト |

### 3.3 バリデーションエラーの詳細

`details` 配列の各要素が持つフィールドレベルのエラーコード:

| コード | 説明 | 例 |
|--------|------|-----|
| `REQUIRED` | 必須フィールドが未指定 | `name` が空 |
| `INVALID_FORMAT` | 形式不正 | メールアドレス形式違反 |
| `TOO_SHORT` | 最小長未満 | パスワードが8文字未満 |
| `TOO_LONG` | 最大長超過 | 名前が255文字超過 |
| `OUT_OF_RANGE` | 数値範囲外 | `capacity` が0以下 |
| `INVALID_ENUM` | 許可されていない列挙値 | `status` に不正な値 |
| `DUPLICATE` | 重複値 | クーポンコードの重複 |

### 3.4 既存APIからの移行

既存 API は `{ error: string }` 形式でエラーを返しているが、新規 API では上記の統一形式を採用する。既存 API のエラー形式は v1 移行時に統一形式へ変更する。

---

## 4. 認証・認可フロー

### 4.1 認証方式の概要

| 方式 | 用途 | 対象エンドポイント |
|------|------|-------------------|
| API Key（Bearer トークン） | Cron ジョブ、外部システム連携 | `/api/cron/*` |
| JWT（Access Token + Refresh Token） | 管理画面からの操作 | `/api/v1/*`（`/auth/login`, `/auth/refresh` 除く） |
| LINE Webhook 署名検証 | LINE プラットフォームからのイベント受信 | `/api/line/webhook` |

### 4.2 JWT トークン仕様

| 項目 | 値 |
|------|-----|
| アルゴリズム | RS256 |
| Access Token 有効期限 | 15分 |
| Refresh Token 有効期限 | 7日 |
| 発行者（iss） | `linemag-api` |
| 対象（aud） | `linemag-admin` |

**Access Token ペイロード:**

```json
{
  "sub": "admin_abc123",
  "email": "admin@example.com",
  "role": "admin",
  "iss": "linemag-api",
  "aud": "linemag-admin",
  "iat": 1711267200,
  "exp": 1711268100
}
```

### 4.3 ミドルウェア構成

Next.js の `middleware.ts` および Route Handler 内で以下のミドルウェアチェーンを構成する。

```
リクエスト受信
  │
  ├── /api/line/webhook
  │     └── [1] LINE署名検証ミドルウェア
  │           └── X-Line-Signature ヘッダを Channel Secret で HMAC-SHA256 検証
  │
  ├── /api/cron/*
  │     └── [1] API Key 検証ミドルウェア
  │           └── Authorization: Bearer {CRON_SECRET} を検証
  │
  └── /api/v1/* （認証不要パスを除く）
        ├── [1] JWT 検証ミドルウェア
        │     ├── Authorization: Bearer {accessToken} を検証
        │     ├── 有効期限チェック
        │     └── ペイロードを request context に注入
        ├── [2] ロールベース認可ミドルウェア
        │     └── エンドポイントに必要なロールを検証
        └── [3] レート制限ミドルウェア
              └── セクション5 参照
```

### 4.4 ロールベースアクセス制御（RBAC）

| ロール | 説明 | 権限 |
|--------|------|------|
| `owner` | システムオーナー | 全操作。管理者の作成・削除を含む |
| `admin` | 管理者 | CRM、クーポン、予約、分析の全操作。管理者管理は不可 |
| `editor` | 編集者 | 配信、スクレイピング、閲覧系操作のみ。削除・設定変更は不可 |

**エンドポイント別の必要ロール:**

| ドメイン | 操作 | 必要ロール |
|----------|------|-----------|
| auth | 管理者作成・削除 | `owner` |
| crm | 顧客の作成・更新・削除 | `admin` 以上 |
| crm | 顧客の閲覧 | `editor` 以上 |
| coupons | 作成・配布・削除 | `admin` 以上 |
| coupons | 閲覧・統計 | `editor` 以上 |
| reservations | 全操作 | `admin` 以上 |
| reservations | 閲覧 | `editor` 以上 |
| analytics | 全操作 | `editor` 以上 |
| line（既存） | 全操作 | `editor` 以上（将来の v1 移行時に適用） |

### 4.5 LINE Webhook 署名検証

```typescript
import crypto from "crypto";

function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}
```

---

## 5. レート制限設計

### 5.1 制限方式

- **アルゴリズム:** スライディングウィンドウ方式
- **識別キー:** JWT の `sub`（管理者ID）。未認証の場合は IP アドレス
- **ストレージ:** Vercel KV（Redis 互換）を使用。ローカル開発時はインメモリ

### 5.2 制限値

| カテゴリ | ウィンドウ | 上限 | 対象 |
|----------|-----------|------|------|
| 標準 API | 1分 | 60リクエスト | `/api/v1/*` 全般 |
| 認証 API | 15分 | 10リクエスト | `/api/v1/auth/login` |
| 配信 API | 1分 | 10リクエスト | `/api/line/broadcast`, `/api/line/push` |
| 分析 API | 1分 | 30リクエスト | `/api/v1/analytics/*` |
| レポート生成 | 1時間 | 5リクエスト | `/api/v1/analytics/reports`（POST） |
| Cron | 1分 | 1リクエスト | `/api/cron/*` |
| Webhook | 1秒 | 100リクエスト | `/api/line/webhook` |

### 5.3 レスポンスヘッダ

すべてのレスポンスに以下のレート制限ヘッダを付与する。

| ヘッダ | 説明 | 例 |
|--------|------|-----|
| `X-RateLimit-Limit` | ウィンドウあたりの上限 | `60` |
| `X-RateLimit-Remaining` | 残りリクエスト数 | `45` |
| `X-RateLimit-Reset` | ウィンドウリセット時刻（Unix秒） | `1711267260` |
| `Retry-After` | 制限超過時のリトライ待機秒数 | `30` |

### 5.4 制限超過時のレスポンス

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1711267260

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "リクエスト数が上限を超えました。30秒後に再試行してください。",
    "requestId": "req_abc123"
  }
}
```

---

## 6. APIドキュメント自動生成方針

### 6.1 ツール選定

| ツール | 用途 |
|--------|------|
| **OpenAPI 3.1** | API 仕様の記述フォーマット |
| **next-swagger-doc** | Next.js Route Handler からの OpenAPI 仕様自動生成 |
| **Swagger UI** | インタラクティブな API ドキュメント画面 |
| **Zod** | リクエスト/レスポンスのバリデーションとスキーマ定義の一元化 |
| **zod-to-openapi** | Zod スキーマから OpenAPI スキーマへの自動変換 |

### 6.2 スキーマ駆動開発フロー

```
[1] Zod スキーマ定義（バリデーション＋型生成の Source of Truth）
  │
  ├──→ [2a] TypeScript 型を自動推論（z.infer<typeof schema>）
  │
  └──→ [2b] zod-to-openapi で OpenAPI スキーマを自動生成
         │
         └──→ [3] Swagger UI で閲覧可能なドキュメントを提供
```

### 6.3 実装ディレクトリ構成

```
src/
├── schemas/                          # Zod スキーマ定義
│   ├── common.ts                     # 共通スキーマ（pagination, error）
│   ├── auth.ts
│   ├── crm.ts
│   ├── coupons.ts
│   ├── reservations.ts
│   ├── profiles.ts
│   └── analytics.ts
├── app/
│   ├── api/
│   │   ├── v1/                       # 新規 API
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── refresh/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── me/route.ts
│   │   │   ├── crm/
│   │   │   │   ├── customers/
│   │   │   │   │   ├── route.ts              # GET(一覧), POST(作成)
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── route.ts          # GET, PUT, DELETE
│   │   │   │   │       ├── activities/route.ts
│   │   │   │   │       └── tags/
│   │   │   │   │           ├── route.ts      # POST(タグ付与)
│   │   │   │   │           └── [tagId]/route.ts  # DELETE
│   │   │   │   ├── tags/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── [id]/route.ts
│   │   │   │   └── segments/
│   │   │   │       ├── route.ts
│   │   │   │       └── [id]/
│   │   │   │           ├── route.ts
│   │   │   │           └── customers/route.ts
│   │   │   ├── coupons/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── distribute/route.ts
│   │   │   │       ├── redeem/route.ts
│   │   │   │       └── stats/route.ts
│   │   │   ├── reservations/
│   │   │   │   ├── route.ts
│   │   │   │   ├── slots/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── [id]/route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── cancel/route.ts
│   │   │   │       ├── confirm/route.ts
│   │   │   │       └── meet/route.ts
│   │   │   ├── profiles/
│   │   │   │   └── [lineUserId]/
│   │   │   │       ├── route.ts
│   │   │   │       └── interactions/route.ts
│   │   │   └── analytics/
│   │   │       ├── kpi/
│   │   │       │   ├── route.ts
│   │   │       │   └── trends/route.ts
│   │   │       ├── broadcasts/route.ts
│   │   │       ├── coupons/route.ts
│   │   │       ├── reservations/route.ts
│   │   │       └── reports/
│   │   │           ├── route.ts
│   │   │           └── [id]/
│   │   │               ├── route.ts
│   │   │               └── download/route.ts
│   │   ├── line/                     # 既存 API（現行維持）
│   │   └── cron/                     # Cron API
│   └── docs/
│       └── api/page.tsx              # Swagger UI ホスティングページ
└── lib/
    ├── middleware/
    │   ├── auth.ts                   # JWT 検証
    │   ├── rate-limit.ts             # レート制限
    │   ├── validate.ts               # Zod バリデーション
    │   └── line-signature.ts         # LINE 署名検証
    └── openapi/
        └── registry.ts              # OpenAPI レジストリ設定
```

### 6.4 JSDoc アノテーション規約

各 Route Handler に以下の形式で OpenAPI メタデータを記述する。

```typescript
import { createRoute } from "@/lib/openapi/registry";
import { CustomerSchema, CreateCustomerSchema } from "@/schemas/crm";

/**
 * @openapi
 * /api/v1/crm/customers:
 *   post:
 *     tags: [CRM]
 *     summary: 顧客を新規作成する
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCustomerRequest'
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function POST(request: NextRequest) {
  // ...
}
```

### 6.5 Swagger UI アクセス

| 環境 | URL | 認証 |
|------|-----|------|
| ローカル開発 | `http://localhost:3000/docs/api` | なし |
| ステージング | `https://staging.linemag.vercel.app/docs/api` | Basic 認証 |
| 本番 | 非公開（内部ネットワークのみ） | JWT 認証 |

### 6.6 CI/CD 統合

| ステップ | 内容 |
|----------|------|
| ビルド時 | `zod-to-openapi` で `openapi.json` を自動生成し、`public/` に配置 |
| テスト時 | OpenAPI 仕様に対して `@apidevtools/swagger-parser` でバリデーション実施 |
| デプロイ時 | Swagger UI ページが最新の仕様を参照していることを確認 |

---

## 付録: エンドポイント総数サマリー

| ドメイン | エンドポイント数 | 新規/既存 |
|----------|-----------------|-----------|
| LINE配信（スクレイピング） | 3 | 既存 |
| LINE配信（配信） | 3 | 既存 |
| LINE配信（フォロワー・履歴・ログ） | 3 | 既存 |
| LINE配信（スケジュール） | 2 | 既存 |
| LINE配信（Webhook） | 2 | 既存 |
| 認証 | 4 | 新規 |
| CRM（顧客） | 6 | 新規 |
| CRM（タグ） | 6 | 新規 |
| CRM（セグメント） | 6 | 新規 |
| クーポン | 8 | 新規 |
| 予約（スロット） | 4 | 新規 |
| 予約（予約） | 6 | 新規 |
| 予約（Google Meet） | 1 | 新規 |
| ユーザープロファイル | 3 | 新規 |
| 分析 | 9 | 新規 |
| Cron | 4 | 既存1 + 新規3 |
| **合計** | **70** | |
