# テスト仕様書

**プロジェクト:** LineMag — LINE マガジン配信システム (CRM / クーポン / 予約 / MA / 分析)
**最終更新:** 2026-03-25
**技術スタック:** Next.js 14, TypeScript, Supabase, Vitest, Playwright, MSW

---

## 1. テスト概要

### 1.1 目的

LineMag の全機能について品質を保証するため、ユニットテスト・インテグレーションテスト・E2E テスト・モンキーテストの 4 層でテストを実施する。リグレッション防止と安全なリファクタリングを可能にすることを最終的なゴールとする。

### 1.2 対象範囲

| レイヤー | 対象ディレクトリ / ファイル |
|---|---|
| ストレージ層 | `src/lib/line/storage.ts`, `supabase-storage.ts`, `storage-factory.ts` |
| CRM サービス | `src/lib/crm/customers.ts`, `tags.ts`, `segments.ts`, `actions.ts` |
| クーポンサービス | `src/lib/coupon/masters.ts`, `issues.ts` |
| 予約サービス | `src/lib/booking/slots.ts`, `reservations.ts`, `consultants.ts` |
| MA サービス | `src/lib/ma/scenarios.ts`, `ab-tests.ts`, `delivery.ts` |
| 分析サービス | `src/lib/analytics/kpi.ts`, `charts.ts`, `reports.ts` |
| LINE 関連 | `src/lib/line/templates.ts`, `templates-business.ts`, `summarizer.ts`, `scraper.ts` |
| API Routes | `src/app/api/**` |
| LIFF | `src/app/liff/**` |

### 1.3 テストフレームワーク

| ツール | 用途 |
|---|---|
| **Vitest** | ユニットテスト / インテグレーションテスト |
| **Playwright** | E2E テスト / モンキーテスト |
| **MSW (Mock Service Worker)** | API モック / Supabase モック |
| **@testing-library/react** | React コンポーネントテスト |

### 1.4 テスト ID 体系

| プレフィックス | 種別 |
|---|---|
| `UT-xxx` | ユニットテスト |
| `IT-xxx` | インテグレーションテスト |
| `E2E-xxx` | E2E テスト |
| `MT-xxx` | モンキーテスト |

---

## 2. ユニットテスト仕様

### 2.1 ストレージ層 (`src/lib/line/storage*.ts`)

#### 2.1.1 FileStorage

| ID | テスト名 | 対象メソッド | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-001 | 送信済み URL 取得 (空ファイル) | `getSentUrls()` | ファイル未作成 | 空配列 `[]` を返す |
| UT-002 | 送信済み URL 追加 | `addSentUrl()` | `BroadcastRecord` (url: "https://example.com") | URL がリストに追加される。配信履歴にもレコード追加 |
| UT-003 | 重複 URL 追加スキップ | `addSentUrl()` | 既存 URL と同一の URL | URL リストの長さが変わらない |
| UT-004 | URL 最大件数超過時の切り捨て | `addSentUrl()` | `maxSentUrls` 超過状態で追加 | 古い URL が削除され最大件数に収まる |
| UT-005 | 配信履歴取得 (デフォルト limit) | `getBroadcastHistory()` | 引数なし | 最大 50 件の配信履歴を新しい順で返す |
| UT-006 | 配信履歴取得 (カスタム limit) | `getBroadcastHistory(10)` | limit=10 | 最大 10 件を返す |
| UT-007 | 実行ログ追加 | `addExecutionLog()` | `{ step: 'SCRAPE', result: 'SUCCESS', detail: 'ok' }` | ログに id, executedAt が自動付与されて保存される |
| UT-008 | 実行ログ取得 (デフォルト) | `getExecutionLogs()` | 引数なし | 最大 100 件を返す |
| UT-009 | ステップ別ログ取得 | `getLogsByStep('BROADCAST')` | step='BROADCAST' | BROADCAST のログのみ返す |
| UT-010 | スケジュール取得 (初期値) | `getSchedule()` | ファイル未作成 | デフォルト値 `{ enabled: false, times: ['09:00','18:00'], ... }` |
| UT-011 | スケジュール保存 | `saveSchedule()` | `ScheduleConfig` | 保存後 `getSchedule()` で同一値取得 |
| UT-012 | 連続エラーカウント取得 | `getConsecutiveErrorCount()` | 初回 | 0 を返す |
| UT-013 | エラーカウント増加 | `incrementErrorCount()` | 連続呼び出し | カウントが 1 ずつ増加 |
| UT-014 | エラーカウントリセット | `resetErrorCount()` | カウント > 0 の状態 | カウントが 0 にリセット |
| UT-015 | JSON 書き込みのアトミック性 | `writeJson()` (内部) | 正常データ | `.tmp` ファイル経由でリネーム書き込み |

#### 2.1.2 SupabaseStorage

| ID | テスト名 | 対象メソッド | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-016 | 送信済み URL 取得 | `getSentUrls()` | DB に 3 件存在 | 3 件の URL 配列を返す |
| UT-017 | 送信済み URL 追加 | `addSentUrl()` | `BroadcastRecord` | `sent_urls` テーブルに INSERT, `broadcast_history` にも INSERT |
| UT-018 | 配信履歴取得 | `getBroadcastHistory()` | limit=20 | 最大 20 件を返す |
| UT-019 | 実行ログ追加 | `addExecutionLog()` | ログエントリ | `execution_logs` テーブルに INSERT |
| UT-020 | 実行ログ取得 | `getExecutionLogs()` | デフォルト | 最大 100 件を返す |
| UT-021 | スケジュール取得 | `getSchedule()` | DB に設定あり | 保存済み設定を返す |
| UT-022 | スケジュール保存 | `saveSchedule()` | 設定オブジェクト | UPSERT される |
| UT-023 | エラー追跡操作 | 各メソッド | カウント増減 | DB のカウント値が正しく更新される |

#### 2.1.3 StorageFactory

| ID | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| UT-024 | Supabase バックエンド選択 | `STORAGE_BACKEND=supabase` | `SupabaseStorage` インスタンスを返す |
| UT-025 | File バックエンド選択 (デフォルト) | 環境変数未設定 | `FileStorage` インスタンスを返す |
| UT-026 | File バックエンド選択 (明示) | `STORAGE_BACKEND=file` | `FileStorage` インスタンスを返す |

---

### 2.2 CRM サービス (`src/lib/crm/`)

#### 2.2.1 Customers (`customers.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-027 | 顧客一覧取得 (デフォルト) | `getCustomers()` | `{}` | `{ customers: [...], total, page: 1, perPage: 20 }` |
| UT-028 | 顧客一覧 — ページネーション | `getCustomers()` | `{ page: 2, perPage: 10 }` | page=2, perPage=10 の結果 |
| UT-029 | 顧客一覧 — テキスト検索 | `getCustomers()` | `{ search: '田中' }` | `display_name` に "田中" を含む顧客のみ |
| UT-030 | 顧客一覧 — 会員ランクフィルター | `getCustomers()` | `{ tier: 'gold' }` | `membershipTier === 'gold'` の顧客のみ |
| UT-031 | 顧客一覧 — 都道府県フィルター | `getCustomers()` | `{ prefecture: '東京都' }` | `prefecture === '東京都'` の顧客のみ |
| UT-032 | 顧客一覧 — タグフィルター | `getCustomers()` | `{ tags: ['VIP'] }` | VIP タグ付き顧客のみ |
| UT-033 | 顧客一覧 — ソート (message_count desc) | `getCustomers()` | `{ sortBy: 'message_count', sortOrder: 'desc' }` | メッセージ数降順 |
| UT-034 | 顧客 ID 取得 | `getCustomerById()` | 既存 ID | 顧客オブジェクト |
| UT-035 | 顧客 ID 取得 (存在しない) | `getCustomerById()` | 存在しない UUID | `null` |
| UT-036 | LINE ユーザー ID 取得 | `getCustomerByLineUserId()` | 既存 `lineUserId` | 顧客オブジェクト |
| UT-037 | 顧客 UPSERT (新規) | `upsertCustomerByLineUserId()` | 新規 `lineUserId` + プロフィール | 新規レコード作成 |
| UT-038 | 顧客 UPSERT (既存更新) | `upsertCustomerByLineUserId()` | 既存 `lineUserId` + 更新データ | 既存レコード更新 |
| UT-039 | 顧客更新 | `updateCustomer()` | `{ id, displayName: '新名前' }` | `displayName` が更新される |
| UT-040 | 顧客カウント | `getCustomerCount()` | なし | 全顧客数 (number) |

#### 2.2.2 Tags (`tags.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-041 | 顧客タグ取得 | `getCustomerTags()` | `customerId` | タグ配列 |
| UT-042 | タグ追加 | `addTagToCustomer()` | `customerId`, `'VIP'` | タグが追加される |
| UT-043 | タグ重複追加 (冪等) | `addTagToCustomer()` | 既にある同一タグ | エラーにならない (UPSERT) |
| UT-044 | タグ削除 | `removeTagFromCustomer()` | `customerId`, `'VIP'` | タグが削除される |
| UT-045 | 一括タグ追加 | `bulkAddTags()` | `customerIds[]`, `tag` | 全顧客にタグ追加 |
| UT-046 | ユニークタグ一覧 | `getAllUniqueTags()` | なし | 重複なしのタグ文字列配列 |
| UT-047 | タグ別顧客 ID 取得 | `getCustomerIdsByTag()` | `'VIP'` | VIP タグを持つ顧客 ID 配列 |
| UT-048 | タグ別カウント | `getTagCounts()` | なし | `[{ tag: 'VIP', count: 5 }, ...]` |

#### 2.2.3 Segments (`segments.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-049 | セグメント一覧取得 | `getSegments()` | なし | セグメント配列 |
| UT-050 | セグメント ID 取得 | `getSegmentById()` | 既存 ID | セグメントオブジェクト |
| UT-051 | セグメント ID 取得 (存在しない) | `getSegmentById()` | 存在しない UUID | `null` |
| UT-052 | セグメント作成 (static) | `createSegment()` | `{ name: 'テスト', type: 'static' }` | 新規セグメント返却 |
| UT-053 | セグメント作成 (dynamic + ルール) | `createSegment()` | `{ name: 'VIP東京', type: 'dynamic', rules: [{field:'prefecture', operator:'eq', value:'東京都'}] }` | ルール付きセグメント |
| UT-054 | セグメント更新 | `updateSegment()` | `{ id, name: '新名前' }` | 名前更新 |
| UT-055 | セグメント削除 | `deleteSegment()` | 既存 ID | 削除完了, `segment_members` も CASCADE 削除 |
| UT-056 | セグメントメンバー取得 | `getSegmentMembers()` | `segmentId` | メンバー ID 配列 |
| UT-057 | セグメントメンバー追加 | `addMembersToSegment()` | `segmentId`, `customerIds[]` | メンバー追加 |
| UT-058 | セグメントメンバー削除 | `removeMemberFromSegment()` | `segmentId`, `customerId` | メンバー削除 |
| UT-059 | セグメントカウント更新 | `refreshSegmentCount()` | `segmentId` | `customerCount` が実メンバー数に更新 |

#### 2.2.4 Actions (`actions.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-060 | アクション記録 | `trackAction()` | `{ customerId, actionType: 'follow', actionDetail: {} }` | `customer_actions` テーブルに INSERT |
| UT-061 | アクション記録 — 全タイプ | `trackAction()` | `message_received`, `link_tap`, `purchase`, `follow`, `unfollow`, `coupon_use`, `reservation`, `page_view` 各タイプ | 全て正常保存 |
| UT-062 | 顧客アクション取得 (デフォルト) | `getCustomerActions()` | `customerId` | 最新 50 件, 降順 |
| UT-063 | 顧客アクション取得 (フィルター) | `getCustomerActions()` | `customerId, { type: 'purchase' }` | purchase のみ |
| UT-064 | アクションカウント | `getActionCount()` | `{ customerId, actionType: 'purchase' }` | 該当件数 (number) |
| UT-065 | 最近のアクション取得 | `getRecentActions()` | `limit=10` | 全顧客の直近 10 件 |

---

### 2.3 クーポンサービス (`src/lib/coupon/`)

#### 2.3.1 Masters (`masters.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-066 | クーポンマスター一覧取得 | `getCouponMasters()` | なし | マスター配列 |
| UT-067 | クーポンマスター ID 取得 | `getCouponMasterById()` | 既存 ID | マスターオブジェクト |
| UT-068 | クーポンマスター ID 取得 (存在しない) | `getCouponMasterById()` | 不正 UUID | `null` |
| UT-069 | クーポンマスターコード取得 | `getCouponMasterByCode()` | `'SUMMER2026'` | 一致するマスター |
| UT-070 | クーポンマスター作成 (fixed) | `createCouponMaster()` | `{ code: 'SUMMER2026', name: '夏割', discountType: 'fixed', discountValue: 500, validFrom, validUntil }` | 新規マスター返却 |
| UT-071 | クーポンマスター作成 (percentage) | `createCouponMaster()` | `discountType: 'percentage', discountValue: 10` | 10% 割引マスター |
| UT-072 | クーポンマスター作成 (free_shipping) | `createCouponMaster()` | `discountType: 'free_shipping'` | 送料無料マスター |
| UT-073 | クーポンマスター更新 | `updateCouponMaster()` | `{ id, name: '更新後名称' }` | 名称更新 |
| UT-074 | クーポンマスター削除 | `deleteCouponMaster()` | 既存 ID | 削除完了 |
| UT-075 | クーポンマスターカウント | `getCouponMasterCount()` | なし | マスター総数 (number) |

#### 2.3.2 Issues (`issues.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-076 | クーポン発行 | `issueCoupon()` | `{ couponMasterId, customerId }` | `CouponIssue` 返却, `issueCode` 生成済み, `status: 'issued'` |
| UT-077 | クーポン発行 — 最大発行数超過 | `issueCoupon()` | `maxIssues` に達した状態 | エラー送出 |
| UT-078 | クーポン発行 — 顧客利用上限超過 | `issueCoupon()` | `maxUsesPerCustomer` に達した状態 | エラー送出 |
| UT-079 | 一括クーポン発行 | `batchIssueCoupon()` | `couponMasterId`, `customerIds[]` | 複数 `CouponIssue` 一括作成 |
| UT-080 | 顧客クーポン一覧取得 | `getCustomerCoupons()` | `customerId` | 顧客の全クーポン (マスター情報含む) |
| UT-081 | マスター別発行一覧 | `getCouponIssues()` | `couponMasterId` | 該当マスターの発行一覧 |
| UT-082 | クーポン使用 | `useCoupon()` | `issueId`, `{ discountAmount: 500 }` | `status` が `'used'` に変更, `usedAt` 設定, `coupon_usages` に記録 |
| UT-083 | クーポン使用 — 既使用済み | `useCoupon()` | 既に `used` の issueId | エラー送出 |
| UT-084 | クーポン使用 — 期限切れ | `useCoupon()` | `expired` 状態の issueId | エラー送出 |
| UT-085 | クーポン取消 | `revokeCoupon()` | `issueId` | `status` が `'revoked'` に変更 |
| UT-086 | クーポン統計計算 | `getCouponStats()` | `couponMasterId` | `{ issued, used, expired, revoked, usageRate }` |

---

### 2.4 予約サービス (`src/lib/booking/`)

#### 2.4.1 Slots (`slots.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-087 | 予約設定取得 | `getBookingSettings()` | なし | `BookingSettings` オブジェクト |
| UT-088 | 予約設定更新 | `updateBookingSettings()` | `{ bufferMinutes: 15 }` | バッファ 15 分に更新 |
| UT-089 | スロット生成 — 基本 | `generateSlots()` | `{ consultantId, startDate, endDate, duration: 60 }` | 営業時間内に 60 分刻みでスロット生成 |
| UT-090 | スロット生成 — 祝日除外 | `generateSlots()` | `holidays` に含まれる日付を範囲に含む | 祝日にはスロット未生成 |
| UT-091 | スロット生成 — バッファ考慮 | `generateSlots()` | `bufferMinutes: 10`, `duration: 50` | スロット間に 10 分の空き |
| UT-092 | スロット生成 — 休業日 (曜日) | `generateSlots()` | `businessHours` に該当曜日キーなし | 休業日にはスロット未生成 |
| UT-093 | 空きスロット検索 | `getAvailableSlots()` | `{ consultantId, date, duration }` | `isAvailable: true` のスロットのみ |
| UT-094 | 日別スロット取得 | `getSlotsForDate()` | `date: '2026-04-01'` | 指定日の全スロット |
| UT-095 | スロット空き切替 | `toggleSlotAvailability()` | `slotId` | `isAvailable` の真偽値反転 |
| UT-096 | 一括スロット作成 | `bulkCreateSlots()` | スロット配列 | 全スロット一括 INSERT |

#### 2.4.2 Reservations (`reservations.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-097 | 予約作成 | `createReservation()` | `{ customerId, timeSlotId, consultantId, serviceType: '相談' }` | `Reservation` 返却, `status: 'pending'`, スロットが `isAvailable: false` に |
| UT-098 | 予約作成 — 既予約スロット | `createReservation()` | `isAvailable: false` のスロット | エラー送出 |
| UT-099 | 予約 ID 取得 | `getReservationById()` | 既存 ID | `Reservation` (結合フィールド含む) |
| UT-100 | 予約一覧取得 | `getReservations()` | `{ status: 'confirmed' }` | confirmed の予約のみ |
| UT-101 | 予約確認 (pending → confirmed) | `confirmReservation()` | `id` | `status: 'confirmed'` |
| UT-102 | 予約キャンセル (→ cancelled) | `cancelReservation()` | `id` | `status: 'cancelled'`, `cancelledAt` 設定, スロット解放 |
| UT-103 | 予約完了 (→ completed) | `completeReservation()` | `id` | `status: 'completed'`, `completedAt` 設定 |
| UT-104 | 無断キャンセル (→ no_show) | `markNoShow()` | `id` | `status: 'no_show'` |
| UT-105 | リマインダー送信済み | `markReminderSent()` | `id` | `status: 'reminded'`, `reminderSentAt` 設定 |
| UT-106 | リマインダー対象取得 | `getUpcomingReservationsForReminder()` | なし | 翌日の confirmed 予約 (リマインダー未送信) |
| UT-107 | 予約統計 | `getReservationStats()` | なし | `{ total, pending, confirmed, completed, cancelled, noShow }` |

#### 2.4.3 Consultants (`consultants.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-108 | コンサルタント一覧取得 | `getConsultants()` | なし | コンサルタント配列 |
| UT-109 | コンサルタント ID 取得 | `getConsultantById()` | 既存 ID | `Consultant` オブジェクト |
| UT-110 | コンサルタント作成 | `createConsultant()` | `{ name: '山田太郎', email: 'yamada@ex.com', meetUrl: 'https://...' }` | 新規コンサルタント |
| UT-111 | コンサルタント更新 | `updateConsultant()` | `{ id, specialties: ['税務','会計'] }` | specialties 更新 |
| UT-112 | コンサルタント削除 | `deleteConsultant()` | 既存 ID | 削除完了 |

---

### 2.5 MA サービス (`src/lib/ma/`)

#### 2.5.1 Scenarios (`scenarios.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-113 | シナリオ一覧取得 | `getScenarios()` | なし | シナリオ配列 |
| UT-114 | シナリオ ID 取得 | `getScenarioById()` | 既存 ID | `Scenario` オブジェクト (steps, triggerConfig 含む) |
| UT-115 | シナリオ ID 取得 (存在しない) | `getScenarioById()` | 不正 UUID | `null` |
| UT-116 | シナリオ作成 (event トリガー) | `createScenario()` | `{ name: 'フォロー歓迎', triggerType: 'event', triggerConfig: { eventType: 'follow' }, steps: [{type:'message', config:{...}}] }` | 新規シナリオ返却 |
| UT-117 | シナリオ作成 (schedule トリガー) | `createScenario()` | `{ triggerType: 'schedule', triggerConfig: { schedule: '0 9 * * *' } }` | cron 式保存 |
| UT-118 | シナリオ作成 (manual トリガー) | `createScenario()` | `{ triggerType: 'manual' }` | 手動実行シナリオ |
| UT-119 | シナリオ更新 | `updateScenario()` | `{ id, isActive: true }` | アクティブ化 |
| UT-120 | シナリオ削除 | `deleteScenario()` | 既存 ID | 削除完了 |
| UT-121 | シナリオ実行ログ記録 | `logScenarioExecution()` | `{ scenarioId, customerId, stepIndex: 0, status: 'sent', detail: {} }` | `ScenarioLog` INSERT |
| UT-122 | シナリオログ取得 | `getScenarioLogs()` | `scenarioId` | 該当シナリオのログ配列 |
| UT-123 | シナリオ統計更新 | `updateScenarioStats()` | `scenarioId`, `{ sent: 100, opened: 45, clicked: 12 }` | stats フィールド更新 |

#### 2.5.2 A/B Tests (`ab-tests.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-124 | A/B テスト一覧取得 | `getABTests()` | なし | テスト配列 |
| UT-125 | A/B テスト ID 取得 | `getABTestById()` | 既存 ID | `ABTest` オブジェクト |
| UT-126 | A/B テスト作成 | `createABTest()` | `{ name: 'テンプレ比較', testType: 'template', variantA: {...}, variantB: {...}, sampleSize: 100 }` | 新規テスト, `status: 'draft'` |
| UT-127 | A/B テスト更新 (開始) | `updateABTest()` | `{ id, status: 'running', startedAt: '...' }` | ステータス遷移 |
| UT-128 | A/B テスト削除 | `deleteABTest()` | 既存 ID | 削除完了 (assignments も CASCADE) |
| UT-129 | 顧客割当 | `assignCustomersToTest()` | `testId`, `customerIds[]` | A/B ランダム振り分け, 各顧客に `ABTestAssignment` 作成 |
| UT-130 | 割当一覧取得 | `getTestAssignments()` | `testId` | 割当配列 |
| UT-131 | 割当イベント記録 (opened) | `recordAssignmentEvent()` | `assignmentId`, `'opened'` | `openedAt` 更新 |
| UT-132 | 割当イベント記録 (clicked) | `recordAssignmentEvent()` | `assignmentId`, `'clicked'` | `clickedAt` 更新 |
| UT-133 | 割当イベント記録 (converted) | `recordAssignmentEvent()` | `assignmentId`, `'converted'` | `convertedAt` 更新 |
| UT-134 | テスト結果計算 | `calculateTestResults()` | `testId` | `{ variantAStats, variantBStats, winner }` |
| UT-135 | テスト結果 — A 勝利 | `calculateTestResults()` | A の開封率 > B | `winner: 'A'` |
| UT-136 | テスト結果 — B 勝利 | `calculateTestResults()` | B の開封率 > A | `winner: 'B'` |

#### 2.5.3 Delivery (`delivery.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-137 | 配信ログ記録 | `logDelivery()` | `{ customerId, messageType: 'broadcast', status: 'sent' }` | `delivery_logs` に INSERT |
| UT-138 | 配信ログ一括記録 | `batchLogDelivery()` | 複数の `LogDeliveryInput` | 一括 INSERT |
| UT-139 | 配信ステータス更新 | `updateDeliveryStatus()` | `logId`, `'opened'` | status フィールド更新 |
| UT-140 | 配信ログ取得 | `getDeliveryLogs()` | `{ messageType: 'push', limit: 50 }` | push のみ最大 50 件 |
| UT-141 | 配信統計取得 | `getDeliveryStats()` | `dateRange` | `{ sent, delivered, opened, clicked, failed, openRate, clickRate }` |
| UT-142 | 日次配信カウント | `getDailyDeliveryCounts()` | `dateRange` | 日付別カウント配列 |

---

### 2.6 分析サービス (`src/lib/analytics/`)

#### 2.6.1 KPI (`kpi.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-143 | 前期算出 | `getPreviousPeriod()` | `{ from: '2026-03-01', to: '2026-03-31' }` | `{ from: '2026-01-30', to: '2026-02-28' }` (同日数分遡る) |
| UT-144 | 配信 KPI 計算 | `getDeliveryKPIs()` | `dateRange` | `{ totalDeliveries, openRate, clickRate }` 各 `KPICard` |
| UT-145 | 顧客 KPI 計算 | `getCustomerKPIs()` | `dateRange` | `{ totalCustomers, newCustomers, activeCustomers, churnRate }` |
| UT-146 | クーポン KPI 計算 | `getCouponKPIs()` | `dateRange` | `{ couponIssued, couponUsageRate }` |
| UT-147 | 予約 KPI 計算 | `getBookingKPIs()` | `dateRange` | `{ totalReservations, reservationRate, cancelRate }` |
| UT-148 | ダッシュボード KPI 統合 | `getDashboardKPIs()` | `dateRange` | `DashboardKPIs` 全 12 項目 |
| UT-149 | KPI 前期比較 — 上昇 | `getDeliveryKPIs()` | 当期 > 前期 | `trend: 'up'`, `change > 0` |
| UT-150 | KPI 前期比較 — 下降 | `getDeliveryKPIs()` | 当期 < 前期 | `trend: 'down'`, `change < 0` |
| UT-151 | KPI 前期比較 — 横ばい | `getDeliveryKPIs()` | 当期 === 前期 | `trend: 'flat'`, `change: 0` |

#### 2.6.2 Charts (`charts.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-152 | 配信トレンドデータ | `getDeliveryTrend()` | `dateRange` | 日別 `ChartDataPoint[]` (sent, opened, clicked) |
| UT-153 | 顧客増減データ | `getCustomerGrowth()` | `dateRange` | 日別 (new, blocked, net) |
| UT-154 | クーポン利用トレンド | `getCouponUsageTrend()` | `dateRange` | 日別 (issued, used) |
| UT-155 | 予約トレンド | `getReservationTrend()` | `dateRange` | 日別 (reserved, cancelled, completed) |
| UT-156 | 会員ランク分布 | `getTierDistribution()` | なし | `[{ tier, count }, ...]` |
| UT-157 | 人気コンテンツ | `getTopContent()` | `dateRange` | 上位記事 (title, clicks) |
| UT-158 | 時間帯別アクティビティ | `getHourlyActivity()` | `dateRange` | 24 時間帯別カウント |
| UT-159 | ライフサイクルファネル | `getLifecycleFunnel()` | なし | ファネルステージ別カウント |
| UT-160 | チャートデータ — 空期間 | 各関数 | データなし期間 | 全日付エントリが 0 値で返される |

#### 2.6.3 Reports (`reports.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-161 | 配信レポート生成 | `generateReport()` | `{ type: 'delivery', dateRange, format: 'json' }` | `ReportResult` (title, summary, rows, columns) |
| UT-162 | 顧客レポート生成 | `generateReport()` | `{ type: 'customers' }` | 顧客レポート |
| UT-163 | クーポンレポート生成 | `generateReport()` | `{ type: 'coupons' }` | クーポンレポート |
| UT-164 | 予約レポート生成 | `generateReport()` | `{ type: 'bookings' }` | 予約レポート |
| UT-165 | サマリーレポート生成 | `generateReport()` | `{ type: 'summary' }` | 統合サマリーレポート |
| UT-166 | 不明なレポートタイプ | `generateReport()` | `{ type: 'unknown' }` | エラー送出 |
| UT-167 | CSV 出力 — 基本 | `reportToCSV()` | `ReportResult` | BOM 付き UTF-8 CSV 文字列 |
| UT-168 | CSV 出力 — 日本語セル | `reportToCSV()` | 日本語を含む rows | エスケープ・ダブルクォート処理正常 |
| UT-169 | CSV 出力 — カンマ含むフィールド | `reportToCSV()` | 値にカンマ含む | フィールドがダブルクォートで囲まれる |
| UT-170 | CSV 出力 — 改行含むフィールド | `reportToCSV()` | 値に改行含む | フィールドがダブルクォートで囲まれる |

---

### 2.7 LINE 関連 (`src/lib/line/`)

#### 2.7.1 Templates (`templates.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-171 | Flex Message 構築 (daily-column) | `buildFlexMessage()` | `BroadcastRequest` (テンプレート: daily-column) | 有効な `FlexContainer` 構造 |
| UT-172 | Flex Message — タイトル反映 | `buildFlexMessage()` | `title: 'テスト記事'` | ヘッダーにタイトル表示 |
| UT-173 | Flex Message — URL 反映 | `buildFlexMessage()` | `url: 'https://...'` | アクションの URI が設定される |
| UT-174 | Flex Message — 要約反映 | `buildFlexMessage()` | `summary: 'テスト要約'` | 本文に要約テキスト |

#### 2.7.2 Templates Business (`templates-business.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-175 | クーポン配信メッセージ | `buildCouponDeliveryMessage()` | `{ couponName, code, discountType, discountValue, validUntil }` | 有効な Flex Message, クーポンコード含む |
| UT-176 | 予約確認メッセージ | `buildReservationConfirmMessage()` | `{ customerName, date, startTime, consultantName, meetUrl }` | 予約詳細含む Flex Message |
| UT-177 | 予約リマインダーメッセージ | `buildReservationReminderMessage()` | 予約情報 | リマインダー用 Flex Message |
| UT-178 | 予約キャンセルメッセージ | `buildReservationCancelMessage()` | 予約情報 | キャンセル通知 Flex Message |
| UT-179 | テンプレート — 長いテキスト | 各関数 | 256 文字超の名前 | 切り捨てまたは正常処理 |

#### 2.7.3 Summarizer (`summarizer.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-180 | 記事要約生成 | `summarizeArticle()` | `ScrapedArticle` | `SummaryResult` (summary, keyPoints) |
| UT-181 | 要約 — 短い記事 | `summarizeArticle()` | 100 文字未満の記事 | 正常に要約生成 |
| UT-182 | 要約 — 長い記事 | `summarizeArticle()` | 10000 文字超の記事 | 正常に要約生成 (トリミングあり) |
| UT-183 | 要約 — API エラー | `summarizeArticle()` | OpenAI API モックエラー | エラーハンドリング (リトライまたは例外) |

#### 2.7.4 Scraper (`scraper.ts`)

| ID | テスト名 | 対象関数 | 入力 | 期待結果 |
|---|---|---|---|---|
| UT-184 | 記事一覧取得 | `fetchArticleList()` | MSW でモック HTML | `ArticleListItem[]` |
| UT-185 | 記事詳細取得 | `fetchArticleDetail()` | `ArticleListItem` + モック HTML | `ScrapedArticle` (title, content, imageUrl) |
| UT-186 | 最新記事スクレイプ | `scrapeLatestArticles()` | モック | 未送信記事のみ返却 |
| UT-187 | スクレイプ — ネットワークエラー | `fetchArticleList()` | MSW で 500 エラー | 例外送出 |
| UT-188 | スクレイプ — 不正 HTML | `fetchArticleDetail()` | 不正な構造の HTML | 空またはデフォルト値 |
| UT-189 | ログ取得・クリア | `getAndClearLogs()` | ログ蓄積状態 | ログ配列を返し内部バッファクリア |

---

## 3. インテグレーションテスト仕様

### 3.1 API Routes

#### 3.1.1 LINE API

| ID | エンドポイント | メソッド | テスト内容 | 期待レスポンス |
|---|---|---|---|---|
| IT-001 | `/api/line/scrape-list` | GET | 正常: 記事一覧取得 | 200, `{ articles: [...] }` |
| IT-002 | `/api/line/scrape-list` | GET | エラー: スクレイプ失敗 | 500, `{ error }` |
| IT-003 | `/api/line/scrape-detail` | POST | 正常: 記事詳細取得 | 200, `{ article }` |
| IT-004 | `/api/line/scrape` | POST | 正常: 記事スクレイプ+要約 | 200, `{ articles }` |
| IT-005 | `/api/line/broadcast` | POST | 正常: Flex Message 配信 | 200, `{ success: true }` |
| IT-006 | `/api/line/broadcast` | POST | エラー: LINE API 障害 | 500 |
| IT-007 | `/api/line/push` | POST | 正常: 個別プッシュ | 200 |
| IT-008 | `/api/line/test-broadcast` | POST | 正常: テスト配信 | 200 |
| IT-009 | `/api/line/history` | GET | 正常: 配信履歴取得 | 200, `{ history: [...] }` |
| IT-010 | `/api/line/logs` | GET | 正常: 実行ログ取得 | 200, `{ logs: [...] }` |
| IT-011 | `/api/line/schedule` | GET | 正常: スケジュール取得 | 200, `{ schedule }` |
| IT-012 | `/api/line/schedule` | POST | 正常: スケジュール保存 | 200 |
| IT-013 | `/api/line/followers` | GET | 正常: フォロワー一覧 | 200 |
| IT-014 | `/api/line/debug` | GET | 正常: デバッグ情報 | 200 |

#### 3.1.2 CRM API

| ID | エンドポイント | メソッド | テスト内容 | 期待レスポンス |
|---|---|---|---|---|
| IT-015 | `/api/crm/customers` | GET | 正常: 顧客一覧 | 200, `{ customers, total, page, perPage }` |
| IT-016 | `/api/crm/customers` | GET | バリデーション: page=-1 | 400 |
| IT-017 | `/api/crm/customers/[id]` | GET | 正常: 顧客詳細 | 200, `{ customer }` |
| IT-018 | `/api/crm/customers/[id]` | GET | エラー: 存在しない ID | 404 |
| IT-019 | `/api/crm/customers/[id]` | PATCH | 正常: 顧客更新 | 200 |
| IT-020 | `/api/crm/customers/[id]/tags` | GET | 正常: タグ一覧 | 200, `{ tags: [...] }` |
| IT-021 | `/api/crm/customers/[id]/tags` | POST | 正常: タグ追加 | 200 |
| IT-022 | `/api/crm/customers/[id]/tags` | DELETE | 正常: タグ削除 | 200 |
| IT-023 | `/api/crm/customers/[id]/actions` | GET | 正常: アクション取得 | 200, `{ actions: [...] }` |
| IT-024 | `/api/crm/customers/[id]/actions` | POST | 正常: アクション記録 | 200 |
| IT-025 | `/api/crm/customers/count` | GET | 正常: 顧客数 | 200, `{ count }` |
| IT-026 | `/api/crm/tags` | GET | 正常: 全タグ一覧 | 200, `{ tags: [...] }` |
| IT-027 | `/api/crm/segments` | GET | 正常: セグメント一覧 | 200, `{ segments: [...] }` |
| IT-028 | `/api/crm/segments` | POST | 正常: セグメント作成 | 201, `{ segment }` |
| IT-029 | `/api/crm/segments` | POST | バリデーション: name 空 | 400 |
| IT-030 | `/api/crm/segments/[id]` | GET | 正常: セグメント詳細 | 200 |
| IT-031 | `/api/crm/segments/[id]` | PATCH | 正常: セグメント更新 | 200 |
| IT-032 | `/api/crm/segments/[id]` | DELETE | 正常: セグメント削除 | 200 |
| IT-033 | `/api/crm/segments/[id]/members` | GET | 正常: メンバー一覧 | 200, `{ members: [...] }` |
| IT-034 | `/api/crm/segments/[id]/members` | POST | 正常: メンバー追加 | 200 |
| IT-035 | `/api/crm/stats` | GET | 正常: CRM 統計 | 200 |

#### 3.1.3 クーポン API

| ID | エンドポイント | メソッド | テスト内容 | 期待レスポンス |
|---|---|---|---|---|
| IT-036 | `/api/coupons` | GET | 正常: クーポン一覧 | 200, `{ coupons: [...] }` |
| IT-037 | `/api/coupons` | POST | 正常: クーポン作成 | 201, `{ coupon }` |
| IT-038 | `/api/coupons` | POST | バリデーション: code 空 | 400 |
| IT-039 | `/api/coupons/[id]` | GET | 正常: クーポン詳細 | 200 |
| IT-040 | `/api/coupons/[id]` | PATCH | 正常: クーポン更新 | 200 |
| IT-041 | `/api/coupons/[id]` | DELETE | 正常: クーポン削除 | 200 |
| IT-042 | `/api/coupons/[id]/issue` | POST | 正常: クーポン発行 | 200, `{ issue }` |
| IT-043 | `/api/coupons/[id]/issue` | POST | エラー: 発行上限 | 400 |
| IT-044 | `/api/coupons/[id]/use` | POST | 正常: クーポン使用 | 200 |
| IT-045 | `/api/coupons/[id]/use` | POST | エラー: 既使用 | 400 |
| IT-046 | `/api/coupons/customer/[customerId]` | GET | 正常: 顧客クーポン一覧 | 200 |

#### 3.1.4 予約 API

| ID | エンドポイント | メソッド | テスト内容 | 期待レスポンス |
|---|---|---|---|---|
| IT-047 | `/api/booking/consultants` | GET | 正常: コンサルタント一覧 | 200 |
| IT-048 | `/api/booking/consultants` | POST | 正常: コンサルタント作成 | 201 |
| IT-049 | `/api/booking/consultants/[id]` | PATCH | 正常: コンサルタント更新 | 200 |
| IT-050 | `/api/booking/consultants/[id]` | DELETE | 正常: コンサルタント削除 | 200 |
| IT-051 | `/api/booking/slots` | POST | 正常: スロット生成 | 200 |
| IT-052 | `/api/booking/slots/[date]` | GET | 正常: 日別スロット | 200, `{ slots: [...] }` |
| IT-053 | `/api/booking/settings` | GET | 正常: 予約設定取得 | 200 |
| IT-054 | `/api/booking/settings` | PUT | 正常: 予約設定更新 | 200 |
| IT-055 | `/api/booking/reservations` | GET | 正常: 予約一覧 | 200 |
| IT-056 | `/api/booking/reservations` | POST | 正常: 予約作成 | 201 |
| IT-057 | `/api/booking/reservations` | POST | エラー: 既予約スロット | 400 |
| IT-058 | `/api/booking/reservations/[id]` | GET | 正常: 予約詳細 | 200 |
| IT-059 | `/api/booking/reservations/[id]` | PATCH | 正常: ステータス変更 | 200 |
| IT-060 | `/api/booking/reservations/stats` | GET | 正常: 予約統計 | 200 |

#### 3.1.5 MA API

| ID | エンドポイント | メソッド | テスト内容 | 期待レスポンス |
|---|---|---|---|---|
| IT-061 | `/api/ma/scenarios` | GET | 正常: シナリオ一覧 | 200 |
| IT-062 | `/api/ma/scenarios` | POST | 正常: シナリオ作成 | 201 |
| IT-063 | `/api/ma/scenarios` | POST | バリデーション: name 空 | 400 |
| IT-064 | `/api/ma/scenarios/[id]` | GET | 正常: シナリオ詳細 | 200 |
| IT-065 | `/api/ma/scenarios/[id]` | PATCH | 正常: シナリオ更新 | 200 |
| IT-066 | `/api/ma/scenarios/[id]` | DELETE | 正常: シナリオ削除 | 200 |
| IT-067 | `/api/ma/scenarios/[id]/logs` | GET | 正常: シナリオログ | 200 |
| IT-068 | `/api/ma/ab-tests` | GET | 正常: A/B テスト一覧 | 200 |
| IT-069 | `/api/ma/ab-tests` | POST | 正常: A/B テスト作成 | 201 |
| IT-070 | `/api/ma/ab-tests/[id]` | GET | 正常: A/B テスト詳細 | 200 |
| IT-071 | `/api/ma/ab-tests/[id]` | PATCH | 正常: A/B テスト更新 | 200 |
| IT-072 | `/api/ma/ab-tests/[id]` | DELETE | 正常: A/B テスト削除 | 200 |
| IT-073 | `/api/ma/ab-tests/[id]/assign` | POST | 正常: 顧客割当 | 200 |

#### 3.1.6 分析 API

| ID | エンドポイント | メソッド | テスト内容 | 期待レスポンス |
|---|---|---|---|---|
| IT-074 | `/api/analytics/kpi` | GET | 正常: KPI 取得 | 200, `DashboardKPIs` |
| IT-075 | `/api/analytics/kpi` | GET | バリデーション: from > to | 400 |
| IT-076 | `/api/analytics/charts` | GET | 正常: チャートデータ | 200 |
| IT-077 | `/api/analytics/delivery` | GET | 正常: 配信統計 | 200 |
| IT-078 | `/api/analytics/reports` | POST | 正常: レポート生成 | 200, `ReportResult` |
| IT-079 | `/api/analytics/reports` | POST | バリデーション: type 不正 | 400 |

#### 3.1.7 共通認証テスト

| ID | テスト内容 | 期待結果 |
|---|---|---|
| IT-080 | 認証なしで `/api/crm/customers` にアクセス | 401 Unauthorized |
| IT-081 | 認証なしで `/api/coupons` にアクセス | 401 Unauthorized |
| IT-082 | 認証なしで `/api/booking/reservations` にアクセス | 401 Unauthorized |
| IT-083 | 認証なしで `/api/ma/scenarios` にアクセス | 401 Unauthorized |
| IT-084 | 認証なしで `/api/analytics/kpi` にアクセス | 401 Unauthorized |
| IT-085 | 無効なトークンで API アクセス | 401 Unauthorized |

---

### 3.2 Webhook 連携

| ID | テスト名 | エンドポイント | 入力 | 期待結果 |
|---|---|---|---|---|
| IT-086 | Webhook 署名検証 — 正常 | `/api/line/webhook` | 正しい署名ヘッダー | 200, イベント処理実行 |
| IT-087 | Webhook 署名検証 — 不正 | `/api/line/webhook` | 不正な署名 | 400 or 401 |
| IT-088 | follow イベント → 顧客作成 | `/api/line/webhook` | `{ type: 'follow', source: { userId: 'U...' } }` | `customers` テーブルに UPSERT, アクション記録 |
| IT-089 | unfollow イベント → ブロック記録 | `/api/line/webhook` | `{ type: 'unfollow' }` | `blockedAt` 更新, アクション記録 |
| IT-090 | message イベント → メッセージカウント更新 | `/api/line/webhook` | `{ type: 'message' }` | `messageCount` +1, `lastSeenAt` 更新 |
| IT-091 | postback イベント → アクション記録 | `/api/line/webhook` | `{ type: 'postback', data: '...' }` | `customer_actions` に記録 |
| IT-092 | 未知イベントタイプ | `/api/line/webhook` | `{ type: 'unknown' }` | 正常終了 (無視) |
| IT-093 | Webhook — 空 events 配列 | `/api/line/webhook` | `{ events: [] }` | 200, 処理なし |

---

### 3.3 Cron Jobs

#### 3.3.1 line-broadcast

| ID | テスト名 | エンドポイント | テスト内容 | 期待結果 |
|---|---|---|---|---|
| IT-094 | スケジュール配信 — 正常実行 | `/api/cron/line-broadcast` | スケジュール有効, 配信時間内 | 記事スクレイプ → 要約 → 配信 → ログ記録 |
| IT-095 | スケジュール配信 — 無効 | `/api/cron/line-broadcast` | `enabled: false` | スキップ, ログ記録 |
| IT-096 | スケジュール配信 — 時間外 | `/api/cron/line-broadcast` | 配信時間外 | スキップ |
| IT-097 | スケジュール配信 — 新規記事なし | `/api/cron/line-broadcast` | 全記事送信済み | スキップ, ログ記録 |
| IT-098 | Cron 認証 — CRON_SECRET 不一致 | `/api/cron/line-broadcast` | 不正な Authorization ヘッダー | 401 |

#### 3.3.2 reservation-reminder

| ID | テスト名 | エンドポイント | テスト内容 | 期待結果 |
|---|---|---|---|---|
| IT-099 | リマインダー送信 — 対象あり | `/api/cron/reservation-reminder` | 翌日の confirmed 予約あり | LINE プッシュ送信, `reminderSentAt` 更新 |
| IT-100 | リマインダー送信 — 対象なし | `/api/cron/reservation-reminder` | 翌日の予約なし | 処理なし, 正常終了 |
| IT-101 | リマインダー — 送信済みスキップ | `/api/cron/reservation-reminder` | `reminderSentAt` 既設定 | 再送信しない |

#### 3.3.3 ma-executor

| ID | テスト名 | エンドポイント | テスト内容 | 期待結果 |
|---|---|---|---|---|
| IT-102 | シナリオ実行 — event トリガー | `/api/cron/ma-executor` | アクティブなイベントトリガーシナリオ | 対象顧客にステップ実行, ログ記録 |
| IT-103 | シナリオ実行 — schedule トリガー | `/api/cron/ma-executor` | cron 式一致のシナリオ | 実行, `lastExecutedAt` 更新 |
| IT-104 | シナリオ実行 — 非アクティブ | `/api/cron/ma-executor` | `isActive: false` | スキップ |
| IT-105 | シナリオ実行 — ステップ失敗 | `/api/cron/ma-executor` | ステップ実行中にエラー | ログに `status: 'failed'` 記録, 次シナリオ継続 |

---

## 4. E2E テスト仕様 (Playwright)

### 4.1 認証フロー

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-001 | 正常ログイン | 1. `/login` 表示 2. メール/パスワード入力 3. ログインボタン押下 | ダッシュボード (`/`) に遷移 |
| E2E-002 | 不正認証情報 | 1. `/login` 表示 2. 間違ったパスワード入力 3. ログインボタン押下 | エラーメッセージ表示, ログインページ維持 |
| E2E-003 | 未認証リダイレクト | 1. `/` に直接アクセス (未認証) | `/login` にリダイレクト |
| E2E-004 | ログアウト | 1. ログイン済み状態 2. ログアウトボタン押下 | `/login` に遷移, セッション破棄 |
| E2E-005 | セッション持続 | 1. ログイン 2. ページリロード | ログイン状態維持 |

### 4.2 配信管理

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-006 | 記事スクレイプ→プレビュー | 1. 配信ページ表示 2. スクレイプ実行 3. 記事選択 4. プレビュー表示 | Flex Message プレビュー表示 |
| E2E-007 | 記事配信 | 1. E2E-006 後 2. 配信ボタン押下 3. 確認ダイアログ OK | 配信成功メッセージ, 配信履歴に追加 |
| E2E-008 | テスト配信 | 1. 記事選択 2. テスト配信ボタン | テスト配信成功 |
| E2E-009 | 配信履歴表示 | 1. 配信履歴ページ表示 | 過去の配信一覧表示 (日時, タイトル, ステータス) |
| E2E-010 | スケジュール設定 | 1. スケジュール設定ページ 2. 時間設定 3. 有効化 4. 保存 | 設定保存, 表示反映 |
| E2E-011 | 実行ログ表示 | 1. ログページ表示 | 実行ログ一覧表示 (ステップ別フィルター可) |

### 4.3 CRM

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-012 | 顧客一覧表示 | 1. `/crm/customers` 表示 | 顧客テーブル表示 (名前, ランク, 最終接触日) |
| E2E-013 | 顧客検索 | 1. 検索ボックスに "田中" 入力 | テーブルがフィルターされ "田中" を含む顧客のみ |
| E2E-014 | 顧客フィルター (ランク) | 1. ランクフィルターで "gold" 選択 | gold ランクの顧客のみ表示 |
| E2E-015 | 顧客フィルター (都道府県) | 1. 都道府県フィルターで "東京都" 選択 | 東京都の顧客のみ表示 |
| E2E-016 | 顧客ページネーション | 1. 2 ページ目に移動 | 2 ページ目のデータ表示 |
| E2E-017 | 顧客詳細表示 | 1. 顧客行クリック | 顧客詳細ページ (プロフィール, タグ, アクション履歴) |
| E2E-018 | タグ追加 | 1. 顧客詳細 2. タグ入力 3. 追加ボタン | タグ表示に追加 |
| E2E-019 | タグ削除 | 1. タグの x ボタンクリック | タグ削除, 表示更新 |
| E2E-020 | セグメント作成 | 1. `/crm/segments` 2. 新規作成 3. 名前・ルール入力 4. 保存 | セグメント一覧に追加 |
| E2E-021 | セグメント詳細・メンバー確認 | 1. セグメントクリック | メンバー一覧, ルール表示 |

### 4.4 クーポン

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-022 | クーポン作成 | 1. `/coupons` 2. 新規作成 3. コード, 名前, 割引タイプ/値, 期間入力 4. 保存 | クーポン一覧に追加 |
| E2E-023 | クーポン一覧表示 | 1. `/coupons` 表示 | クーポンマスター一覧 (名前, コード, 種別, 期間, ステータス) |
| E2E-024 | クーポン詳細表示 | 1. クーポンクリック | 詳細 (発行数, 利用率, 発行一覧) |
| E2E-025 | クーポン発行 (個別) | 1. クーポン詳細 2. 顧客選択 3. 発行ボタン | 発行一覧に追加, ステータス: issued |
| E2E-026 | クーポン発行 (セグメント一括) | 1. セグメント選択 2. 一括発行 | 全メンバーに発行 |
| E2E-027 | クーポン無効化 | 1. クーポンの無効化ボタン | `isActive: false`, 一覧でステータス反映 |

### 4.5 予約

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-028 | コンサルタント登録 | 1. `/booking/consultants` 2. 新規作成 3. 名前, メール, Meet URL 入力 4. 保存 | コンサルタント一覧に追加 |
| E2E-029 | スロット生成 | 1. `/booking/slots` 2. コンサルタント選択 3. 日付範囲, 時間幅設定 4. 生成 | カレンダーにスロット表示 |
| E2E-030 | 予約一覧表示 | 1. `/booking/reservations` 表示 | 予約テーブル (日時, 顧客, コンサルタント, ステータス) |
| E2E-031 | 予約確認操作 | 1. pending 予約の確認ボタン押下 | ステータスが confirmed に変更 |
| E2E-032 | 予約キャンセル操作 | 1. 予約のキャンセルボタン 2. 確認ダイアログ OK | ステータスが cancelled に変更 |
| E2E-033 | カレンダービュー | 1. カレンダータブ表示 | 月間カレンダーにスロット/予約表示 |
| E2E-034 | 予約設定変更 | 1. 設定ページ 2. 営業時間/バッファ変更 3. 保存 | 設定反映 |

### 4.6 MA

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-035 | シナリオ作成 | 1. `/ma/scenarios` 2. 新規作成 3. 名前, トリガー設定, ステップ追加 4. 保存 | シナリオ一覧に追加 |
| E2E-036 | シナリオ有効化 | 1. シナリオの有効化トグル | `isActive: true`, 状態反映 |
| E2E-037 | シナリオ詳細・ログ確認 | 1. シナリオクリック | ステップ可視化, 実行ログ一覧 |
| E2E-038 | A/B テスト作成 | 1. `/ma/ab-tests` 2. 新規作成 3. テスト名, バリアント A/B 設定 4. 保存 | テスト一覧に追加, `status: 'draft'` |
| E2E-039 | A/B テスト開始 | 1. テスト詳細 2. 開始ボタン | `status: 'running'` |
| E2E-040 | A/B テスト結果確認 | 1. 完了済みテスト詳細 | バリアント別統計, 勝者表示 |

### 4.7 分析

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-041 | KPI ダッシュボード表示 | 1. `/analytics` 表示 | 12 個の KPI カード表示 (値, 前期比, トレンド矢印) |
| E2E-042 | 期間変更 | 1. 日付ピッカーで期間変更 | KPI, チャート全てが更新 |
| E2E-043 | 配信トレンドチャート | 1. 配信タブ | 折れ線グラフ (sent, opened, clicked) |
| E2E-044 | 顧客増減チャート | 1. 顧客タブ | 棒グラフ (new, blocked) |
| E2E-045 | レポート生成 | 1. レポートページ 2. タイプ選択 3. 期間設定 4. 生成ボタン | レポートテーブル表示 |
| E2E-046 | CSV ダウンロード | 1. E2E-045 後 2. CSV ダウンロードボタン | CSV ファイルダウンロード (BOM 付き UTF-8) |

### 4.8 LIFF (モバイル)

| ID | テスト名 | 手順 | 期待結果 |
|---|---|---|---|
| E2E-047 | 予約フロー — ステップ 1: サービス選択 | 1. `/liff/booking` 表示 2. サービス種別選択 | ステップ 2 に遷移 |
| E2E-048 | 予約フロー — ステップ 2: 日時選択 | 1. カレンダーから日付選択 2. 空きスロット選択 | ステップ 3 に遷移 |
| E2E-049 | 予約フロー — ステップ 3: 情報入力 | 1. メモ入力 (任意) | ステップ 4 に遷移 |
| E2E-050 | 予約フロー — ステップ 4: 確認・送信 | 1. 予約内容確認 2. 予約ボタン押下 | 予約完了画面, DB に予約作成 |
| E2E-051 | 予約フロー — 空きなし表示 | 1. 全スロット予約済みの日付選択 | "空きがありません" メッセージ |
| E2E-052 | クーポン一覧 (LIFF) | 1. `/liff/coupons` 表示 | 自分の有効クーポン一覧表示 |
| E2E-053 | クーポン使用 (LIFF) | 1. クーポン選択 2. 使用ボタン | ステータスが used に変更, 使用完了画面 |
| E2E-054 | マイページ (LIFF) | 1. `/liff/mypage` 表示 | 予約履歴, クーポン, プロフィール表示 |

---

## 5. モンキーテスト仕様

### 5.1 概要

Playwright を使用してランダム操作を自動実行し、アプリケーションがクラッシュしないことを検証する。各テストは 5 分間連続して実行する。

### 5.2 テストケース

| ID | テスト名 | 手順 | 検証内容 |
|---|---|---|---|
| MT-001 | ランダムクリック | ダッシュボードから開始し、画面上の可視要素をランダムにクリック (300 回) | コンソールエラーなし, ページクラッシュなし |
| MT-002 | ランダムフォーム入力 | フォーム要素を検出し、ランダム文字列 (英数字, 日本語, 特殊文字) を入力して送信 | 未処理例外なし, 500 エラーなし |
| MT-003 | 高速ナビゲーション | サイドバーのリンクをランダムに高速クリック (間隔: 100-500ms) | メモリリークなし, ページ表示正常 |
| MT-004 | 高速ページ遷移 + 戻る | ランダムページ遷移 → ブラウザバック → 再遷移を繰り返す | 状態不整合なし |
| MT-005 | 空文字入力 | 全フォームの必須フィールドに空文字で送信 | バリデーションエラー表示, クラッシュなし |
| MT-006 | 超長文入力 | テキストフィールドに 10,000 文字の文字列入力 | クラッシュなし, 適切なエラーまたは切り捨て |
| MT-007 | 特殊文字入力 | `<script>alert(1)</script>`, `'; DROP TABLE users;--`, `\x00\x01`, 絵文字 (🎉🔥) 等を入力 | XSS/SQL インジェクション不発, クラッシュなし |
| MT-008 | 大量データ表示 | 1000 件のモックデータで一覧ページ表示 | ページ応答 3 秒以内, スクロール正常 |
| MT-009 | 同時操作シミュレーション | 複数タブで同一操作を同時実行 | データ不整合なし, 排他制御正常 |
| MT-010 | ネットワーク断続 | Playwright でネットワーク遮断/復旧を繰り返しながら操作 | エラー表示適切, リカバリ正常 |

---

## 6. テストデータ

### 6.1 モックデータ定義

```typescript
// tests/mocks/data.ts

export const mockCustomers = [
  {
    id: 'cust-001',
    lineUserId: 'U1234567890abcdef',
    displayName: '田中太郎',
    pictureUrl: 'https://profile.line-scdn.net/...',
    statusMessage: 'こんにちは',
    email: 'tanaka@example.com',
    phone: '090-1234-5678',
    gender: 'male',
    birthDate: '1990-01-15',
    prefecture: '東京都',
    membershipTier: 'gold',
    messageCount: 42,
    firstSeenAt: '2025-06-01T00:00:00Z',
    lastSeenAt: '2026-03-24T10:30:00Z',
    blockedAt: null,
    attributes: { source: 'campaign_2025' },
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2026-03-24T10:30:00Z',
  },
  {
    id: 'cust-002',
    lineUserId: 'Uabcdef1234567890',
    displayName: '鈴木花子',
    pictureUrl: null,
    statusMessage: null,
    email: null,
    phone: null,
    gender: 'female',
    birthDate: '1985-07-20',
    prefecture: '大阪府',
    membershipTier: 'silver',
    messageCount: 15,
    firstSeenAt: '2025-09-01T00:00:00Z',
    lastSeenAt: '2026-03-20T14:00:00Z',
    blockedAt: null,
    attributes: null,
    createdAt: '2025-09-01T00:00:00Z',
    updatedAt: '2026-03-20T14:00:00Z',
  },
];

export const mockCouponMaster = {
  id: 'coupon-master-001',
  code: 'SPRING2026',
  name: '春の特別割引',
  description: '全商品10%オフ',
  discountType: 'percentage' as const,
  discountValue: 10,
  minPurchaseAmount: 1000,
  maxIssues: 500,
  maxUsesPerCustomer: 1,
  validFrom: '2026-03-01T00:00:00Z',
  validUntil: '2026-04-30T23:59:59Z',
  isActive: true,
  targetSegmentId: null,
  metadata: {},
  createdAt: '2026-02-15T00:00:00Z',
  updatedAt: '2026-02-15T00:00:00Z',
};

export const mockConsultant = {
  id: 'consultant-001',
  name: '山田太郎',
  email: 'yamada@example.com',
  meetUrl: 'https://meet.google.com/abc-defg-hij',
  specialties: ['税務相談', '資産運用'],
  isActive: true,
  maxDailySlots: 8,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

export const mockScenario = {
  id: 'scenario-001',
  name: 'フォロー歓迎シナリオ',
  description: '新規フォロワーに歓迎メッセージ + クーポン送付',
  triggerType: 'event' as const,
  triggerConfig: { eventType: 'follow', delay: 0 },
  steps: [
    { type: 'message' as const, config: { template: 'welcome' } },
    { type: 'wait' as const, config: { hours: 24 } },
    { type: 'coupon' as const, config: { couponMasterId: 'coupon-master-001' } },
  ],
  isActive: true,
  targetSegmentId: null,
  stats: { sent: 150, opened: 67, clicked: 23 },
  lastExecutedAt: '2026-03-24T09:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-24T09:00:00Z',
};

export const mockABTest = {
  id: 'ab-test-001',
  name: 'テンプレート比較テスト',
  description: 'daily-column vs rich-image',
  status: 'running' as const,
  testType: 'template' as const,
  variantA: { templateId: 'daily-column' },
  variantB: { templateId: 'rich-image' },
  targetSegmentId: null,
  sampleSize: 200,
  metric: 'open_rate',
  results: {},
  winner: null,
  startedAt: '2026-03-20T00:00:00Z',
  endedAt: null,
  createdAt: '2026-03-19T00:00:00Z',
  updatedAt: '2026-03-20T00:00:00Z',
};

export const mockBroadcastRecord = {
  url: 'https://example.com/article/001',
  title: 'テスト記事タイトル',
  sentAt: '2026-03-24T09:00:00Z',
  status: 'SUCCESS' as const,
  templateId: 'daily-column',
};

export const mockScrapedArticle = {
  url: 'https://example.com/article/002',
  title: '最新ニュース記事',
  content: 'これはテスト記事の本文です。十分な長さのテキストを含みます。',
  imageUrl: 'https://example.com/images/article002.jpg',
  publishedAt: '2026-03-24T08:00:00Z',
};
```

### 6.2 Supabase Mock 設定

```typescript
// tests/mocks/supabase.ts

import { vi } from 'vitest';

// Supabase クエリビルダーのチェーンモック
function createQueryBuilder(data: unknown[] = [], error: null | { message: string } = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn((resolve) => resolve({ data, error, count: data.length })),
  };
  return builder;
}

export function createMockSupabaseClient(overrides: Record<string, unknown[]> = {}) {
  return {
    from: vi.fn((table: string) => {
      const data = overrides[table] ?? [];
      return createQueryBuilder(data);
    }),
  };
}

// getAdminClient モック
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => createMockSupabaseClient()),
}));
```

### 6.3 MSW ハンドラー

```typescript
// tests/mocks/handlers.ts

import { http, HttpResponse } from 'msw';

export const handlers = [
  // LINE Messaging API
  http.post('https://api.line.me/v2/bot/message/broadcast', () => {
    return HttpResponse.json({ sentMessages: [{ id: 'msg-001' }] });
  }),

  http.post('https://api.line.me/v2/bot/message/push', () => {
    return HttpResponse.json({ sentMessages: [{ id: 'msg-002' }] });
  }),

  http.get('https://api.line.me/v2/bot/followers/ids', () => {
    return HttpResponse.json({ userIds: ['U001', 'U002'], next: null });
  }),

  http.get('https://api.line.me/v2/bot/profile/:userId', ({ params }) => {
    return HttpResponse.json({
      userId: params.userId,
      displayName: 'テストユーザー',
      pictureUrl: 'https://profile.line-scdn.net/test',
      statusMessage: 'テスト',
    });
  }),

  // OpenAI API (要約用)
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{
        message: { content: 'これは要約テキストです。' },
      }],
    });
  }),

  // スクレイプ対象サイト
  http.get('https://example.com/articles', () => {
    return new HttpResponse(
      '<html><body><a href="/article/001">記事1</a></body></html>',
      { headers: { 'Content-Type': 'text/html' } },
    );
  }),
];
```

---

## 7. 成功基準

### 7.1 基準一覧

| テスト種別 | 基準 | 閾値 |
|---|---|---|
| ユニットテスト | コードカバレッジ (行) | **80% 以上** |
| ユニットテスト | コードカバレッジ (分岐) | **70% 以上** |
| ユニットテスト | テスト成功率 | **100%** |
| インテグレーションテスト | 全エンドポイント正常系 | **全テスト通過** |
| インテグレーションテスト | 認証テスト | **全テスト通過** |
| E2E テスト | 主要フロー | **全テスト通過** |
| E2E テスト | LIFF フロー | **全テスト通過** |
| モンキーテスト | 未処理例外 | **0 件** |
| モンキーテスト | ページクラッシュ | **0 件** |
| モンキーテスト | 500 エラー | **0 件** |

### 7.2 カバレッジ対象ディレクトリ

```
src/lib/crm/          -- 80%+
src/lib/coupon/        -- 80%+
src/lib/booking/       -- 80%+
src/lib/ma/            -- 80%+
src/lib/analytics/     -- 80%+
src/lib/line/          -- 80%+
src/app/api/           -- 70%+ (統合テストでカバー)
```

### 7.3 CI パイプライン統合

```
1. プルリクエスト時:
   - Vitest (ユニット + 統合) 全実行
   - カバレッジレポート生成
   - 閾値未満で失敗

2. main マージ後:
   - Playwright E2E 全実行 (staging 環境)
   - モンキーテスト実行 (5 分間)

3. 週次:
   - 全テストスイート実行
   - カバレッジトレンドレポート
```

### 7.4 テストケース総数

| 種別 | 件数 |
|---|---|
| ユニットテスト (UT-001 〜 UT-189) | **189 件** |
| インテグレーションテスト (IT-001 〜 IT-105) | **105 件** |
| E2E テスト (E2E-001 〜 E2E-054) | **54 件** |
| モンキーテスト (MT-001 〜 MT-010) | **10 件** |
| **合計** | **358 件** |
