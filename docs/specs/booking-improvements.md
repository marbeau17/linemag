# LineMag 予約システム改善仕様書

> 作成日: 2026-03-26
> ステータス: ドラフト
> 対象ファイル:
> - `src/lib/booking/slots.ts`
> - `src/lib/booking/reservations.ts`
> - `src/lib/booking/consultants.ts`
> - `src/app/dashboard/reservations/page.tsx`
> - `src/app/dashboard/reservations/calendar/page.tsx`
> - `src/app/dashboard/reservations/slots/page.tsx`
> - `src/app/liff/booking/page.tsx`

---

## 目次

1. [バグ修正 (Critical)](#1-バグ修正-critical)
2. [UX 改善](#2-ux-改善)
3. [機能拡張](#3-機能拡張)
4. [データ整合性](#4-データ整合性)

---

## 1. バグ修正 (Critical)

### 1.1 プロパティ命名の不整合 (snake_case vs camelCase) — P1

**現状の問題:**

`slots/page.tsx` (スロット設定画面) のフロントエンド型定義と、バックエンド (`slots.ts`) の型定義で `businessHours` の構造が異なる。

- **バックエンド (`slots.ts`)**: `businessHours` は `Record<string, { start: string; end: string }>` でキーが曜日番号 (`"0"` ~ `"6"`)
- **スロット設定画面 (`slots/page.tsx`)**: `businessHours` は `BusinessHour[]` (配列) でキーが `"mon"`, `"tue"` 等の文字列
- **カレンダー画面 (`calendar/page.tsx`)**: `businessHours` のキーとして `"monday"`, `"tuesday"` 等のフルネームを使用

```typescript
// slots.ts (backend) -- day key is "0" ~ "6"
businessHours: Record<string, { start: string; end: string }>;

// slots/page.tsx (frontend) -- array with "mon", "tue" etc.
interface BusinessHour {
  day: string;   // "mon", "tue", ...
  label: string;
  start: string;
  end: string;
}

// calendar/page.tsx (frontend) -- full names
const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
```

**影響:**
- スロット設定画面で保存した営業時間が、スロット生成ロジック (`generateSlots`) で正しく参照されない可能性がある
- カレンダー画面のタイムラインバーに営業時間が表示されない場合がある

**修正方針:**
- DB スキーマの `business_hours` カラムの形式を統一する (推奨: `Record<string, { start: string; end: string }>` でキーは `"0"` ~ `"6"`)
- フロントエンド側で変換レイヤーを設け、表示用の曜日ラベルとDBキーのマッピングを一元管理する
- `@/types/booking` に共通型として `BusinessHours` を定義する

---

### 1.2 Null ガード不足 — P1

**現状の問題:**

複数箇所で `null` / `undefined` に対するガードが不十分。

**(a) `reservations.ts` の `getReservations` — 日付フィルタの問題**

```typescript
// reservations.ts L199-204
if (options.dateFrom) {
  query = query.gte('time_slots.date', options.dateFrom);
}
if (options.dateTo) {
  query = query.lte('time_slots.date', options.dateTo);
}
```

Supabase の `gte` / `lte` を結合テーブル (`time_slots`) のカラムに適用しているが、結合が `null` の場合 (time_slots が削除されたケース等) にフィルタが意図通りに動作しない。PostgREST の仕様上、結合先カラムでのフィルタは結合自体を `inner join` 化させるため、`time_slots` が存在しない予約が結果から落ちる。

**(b) `slots/page.tsx` の設定読み込み**

```typescript
// slots/page.tsx L98
.then((d) => { if (d && d.businessHours) setSettings(d); })
```

API レスポンスに `businessHours` が含まれていても配列でない場合 (バックエンドが `Record` で返す場合)、`.map()` 呼び出し時にランタイムエラーが発生する。

**(c) `liff/booking/page.tsx` のハードコード顧客ID**

```typescript
// liff/booking/page.tsx L35
const HARDCODED_CUSTOMER_ID = 'cust_placeholder_001';
```

LIFF 経由でログインした顧客の実際の ID を使用していない。存在しない顧客IDで予約が作成され、外部キー制約エラーまたは不整合データが発生する。

**修正方針:**
- (a) 日付フィルタは `reservations` テーブル自体に `date` カラムを追加するか、結合ではなくサブクエリで処理する
- (b) `businessHours` の型チェックを行い、配列 / オブジェクトどちらが来ても正しく変換する
- (c) LIFF SDK の `liff.getProfile()` から取得した LINE User ID を使って顧客IDを解決する

---

### 1.3 businessHours のオブジェクト vs 配列の取り扱い — P1

**現状の問題:**

`updateBookingSettings` (slots.ts) は `businessHours` を `Record` としてDBに保存するが、`slots/page.tsx` は配列として送信する。API レイヤーでの変換が抜けているか、不整合が起きている可能性がある。

加えて、`BookingSettings` のプロパティ名がフロントエンドとバックエンドで異なる:

| プロパティ | バックエンド (slots.ts) | フロントエンド (slots/page.tsx) |
|---|---|---|
| 最大予約日数 | `maxAdvanceDays` | `bookableAheadDays` |
| 休業日 | `holidays` | `closedDates` |

**修正方針:**
- API エンドポイント (`/api/booking/settings`) でリクエスト/レスポンスの正規化を行う
- フロントエンドの型定義をバックエンドに合わせるか、明示的なマッピング関数を用意する

---

## 2. UX 改善

### 2.1 管理ダッシュボードからの予約作成 — P1

**現状:**
予約作成は LIFF (`/liff/booking`) 経由のみ。管理者がダッシュボードから直接予約を作成できない。

**改善内容:**
- 予約一覧画面 (`/dashboard/reservations`) に「新規予約」ボタンを追加
- モーダルまたは専用ページで以下を入力:
  - 顧客 (既存顧客の検索・選択)
  - 相談員
  - 日付・時間スロット
  - 相談種別
  - 備考
- 作成後、予約一覧を自動リフレッシュ

**対象ファイル:**
- `src/app/dashboard/reservations/page.tsx` — ボタン追加
- 新規: `src/app/dashboard/reservations/new/page.tsx` または モーダルコンポーネント

---

### 2.2 予約詳細ビュー — P2

**現状:**
予約一覧テーブルの行をクリックしても詳細は表示されない。顧客名のリンクは CRM ページに遷移するのみ。

**改善内容:**
- テーブル行クリックまたは「詳細」ボタンで予約詳細を表示 (スライドパネルまたはモーダル)
- 表示内容:
  - 予約日時、相談員、顧客情報
  - ステータス履歴 (作成 -> 確定 -> 完了 等)
  - 備考 (notes)
  - Meet URL
  - キャンセル理由 (将来対応)
- 詳細画面からステータス変更操作を実行可能にする

**対象ファイル:**
- `src/app/dashboard/reservations/page.tsx`
- 新規: `src/components/booking/ReservationDetailPanel.tsx`

---

### 2.3 ウォークイン顧客の手動予約作成 — P2

**現状:**
ウォークイン (飛び込み) 顧客に対応する仕組みがない。

**改善内容:**
- 管理画面から「ウォークイン予約」を作成するフロー
- 顧客情報は最小限 (名前・電話番号) で仮登録
- 時間スロットを選択せずに「即時」で予約を作成するオプション
- ステータスは `confirmed` で直接作成

**対象ファイル:**
- 2.1 の予約作成フォームに「ウォークイン」モード追加

---

### 2.4 スロット生成の日時ピッカー改善 — P2

**現状:**
`slots/page.tsx` のスロット生成セクションでは、`<input type="date">` で開始日・終了日を指定する形式。

**改善内容:**
- カレンダーUI で日付範囲を視覚的に選択可能にする
- 既にスロットが存在する日付をハイライト表示
- 「来週分を生成」「来月分を生成」等のクイックアクションボタン
- 生成前のプレビュー (何件のスロットが作成されるか表示)

**対象ファイル:**
- `src/app/dashboard/reservations/slots/page.tsx`

---

### 2.5 カレンダーに相談員名を表示 — P2

**現状:**
カレンダーのミニブロック (`calendar/page.tsx` L343-353) では時刻と顧客名のみ表示。

```typescript
<span className="truncate text-slate-600">
  {r.startTime?.slice(0, 5)} {r.customerName ?? '予約'}
</span>
```

**改善内容:**
- ミニブロックに相談員名を追加表示
- 相談員ごとに色分け (カラーコード割り当て)
- サイドパネルの予約リストでも相談員名をより目立つ位置に配置

**対象ファイル:**
- `src/app/dashboard/reservations/calendar/page.tsx`

---

### 2.6 スロット設定のビジュアルグリッド化 — P3

**現状:**
営業時間の設定はフォーム入力 (曜日ごとに開始時間・終了時間の `<input type="time">`) のみ。

**改善内容:**
- 曜日 x 時間帯のグリッド表示
- グリッドセルをクリック/ドラッグで営業時間範囲を設定
- 視覚的に各曜日の営業時間が一目で把握できる
- 休業日もカレンダー上でトグル可能にする

**対象ファイル:**
- `src/app/dashboard/reservations/slots/page.tsx`
- 新規: `src/components/booking/WeeklyScheduleGrid.tsx`

---

## 3. 機能拡張

### 3.1 キャンセル時の LINE 通知 — P1

**現状:**
`cancelReservation` (`reservations.ts`) はステータスを `cancelled` に更新し、スロットを解放するのみ。顧客への通知は行われない。

**改善内容:**
- 予約キャンセル時に LINE Messaging API 経由でプッシュメッセージを送信
- メッセージ内容:
  - キャンセルされた予約の日時
  - 相談員名
  - 再予約リンク (LIFF URL)
- 管理者がキャンセル理由を入力できるフィールドを追加
- キャンセル理由は顧客への通知メッセージにも含める

**対象ファイル:**
- `src/lib/booking/reservations.ts` — `cancelReservation` に通知トリガー追加
- 新規: `src/lib/booking/notifications.ts`
- LINE メッセージテンプレート追加

---

### 3.2 自動スロット生成 (週次繰り返し) — P2

**現状:**
スロット生成は手動操作 (`bulkCreateSlots`) のみ。毎週手動で生成する必要がある。

**改善内容:**
- Cron ジョブ (Vercel Cron 等) で週次自動スロット生成
- 設定項目:
  - 自動生成を有効/無効にするトグル
  - 何週先まで生成するか (例: 2週間先)
  - 自動生成対象の相談員
- 生成ログの記録と管理画面での確認

**実装案:**

```typescript
// /api/cron/generate-slots (Vercel Cron)
// Schedule: every Monday at 00:00 JST
export async function GET() {
  const consultants = await getConsultants(true); // active only
  const settings = await getBookingSettings();
  // Generate slots for the next N weeks
  for (const consultant of consultants) {
    await bulkCreateSlots(
      consultant.id,
      startDate,
      endDate,
      settings.slotDurations[0],
    );
  }
}
```

**対象ファイル:**
- 新規: `src/app/api/cron/generate-slots/route.ts`
- `vercel.json` に cron 設定追加
- `src/app/dashboard/reservations/slots/page.tsx` — 自動生成設定UI

---

### 3.3 相談員の休暇・例外日管理 — P2

**現状:**
休業日はシステム全体の `holidays` としてのみ管理。相談員ごとの休暇日は設定できない。

**改善内容:**
- `consultants` テーブルに `unavailable_dates` カラムを追加 (またはリレーションテーブル)
- 相談員ごとの休暇日をカレンダーUIで設定可能にする
- スロット生成時に相談員の休暇日をスキップ
- `getAvailableSlots` で相談員の休暇日を考慮

**対象ファイル:**
- `src/lib/booking/consultants.ts` — 型定義・クエリ更新
- `src/lib/booking/slots.ts` — `generateSlots` に休暇チェック追加
- `src/app/dashboard/reservations/slots/page.tsx` — 相談員別休暇設定UI

---

### 3.4 予約備考の相談員表示 — P3

**現状:**
LIFF の予約フロー (`liff/booking/page.tsx`) で顧客が入力した `notes` は DB に保存されるが、管理画面のカレンダーのサイドパネルでのみ小さく表示される。予約一覧テーブルには表示されない。

**改善内容:**
- 予約一覧テーブルに備考カラム追加 (truncate表示)
- 予約詳細パネル (2.2) で備考を全文表示
- 相談員が備考を追記・編集できる機能
- 備考が存在する予約にはアイコンインジケーターを表示

**対象ファイル:**
- `src/app/dashboard/reservations/page.tsx`
- `src/lib/booking/reservations.ts` — 備考更新API追加

---

### 3.5 予約データの CSV エクスポート — P3

**現状:**
予約データをエクスポートする機能がない。

**改善内容:**
- 予約一覧画面に「CSVエクスポート」ボタンを追加
- エクスポート内容:
  - 予約ID、予約日時、顧客名、相談員名、相談種別、ステータス、備考、Meet URL、作成日
- フィルタ条件を適用した状態でエクスポート可能
- 文字コードは UTF-8 (BOM付き) でExcel対応

**実装案:**

```typescript
// /api/booking/reservations/export (GET)
// Query params: same as reservations list API
export async function GET(request: Request) {
  const reservations = await getReservations(filters);
  const csv = convertToCSV(reservations);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reservations.csv"',
    },
  });
}
```

**対象ファイル:**
- 新規: `src/app/api/booking/reservations/export/route.ts`
- `src/app/dashboard/reservations/page.tsx` — エクスポートボタン追加

---

## 4. データ整合性

### 4.1 二重予約防止 (楽観的ロック) — P1

**現状:**
`createReservation` (`reservations.ts`) はスロットの `is_available` を `false` に更新してから予約を挿入するが、2つのリクエストが同時に同じスロットを予約した場合、両方が成功する可能性がある (race condition)。

```typescript
// reservations.ts L112-121 -- race condition
const { error: slotError } = await supabase
  .from('time_slots')
  .update({ is_available: false, updated_at: now } as never)
  .eq('id', input.timeSlotId);
// -> 2 requests can both succeed here if they run concurrently
```

**改善内容:**
- Supabase の `update` に `is_available = true` の条件を追加 (楽観的ロック)
- 更新結果の `count` を確認し、0件の場合は「既に予約済み」エラーを返す
- LIFF 側でもエラーハンドリングを追加し、「この枠は既に予約されました」メッセージを表示

**実装案:**

```typescript
// reservations.ts -- optimistic locking
const { data: slotData, error: slotError, count } = await supabase
  .from('time_slots')
  .update({ is_available: false, updated_at: now } as never)
  .eq('id', input.timeSlotId)
  .eq('is_available', true)  // <-- guard condition
  .select('id', { count: 'exact' });

if (count === 0) {
  throw new Error('SLOT_ALREADY_BOOKED');
}
```

**対象ファイル:**
- `src/lib/booking/reservations.ts` — `createReservation`
- `src/app/liff/booking/page.tsx` — エラーメッセージ処理

---

### 4.2 予約ステータス変更時のスロット自動更新 — P1

**現状:**
- `cancelReservation` はスロットを `is_available: true` に戻す (正しい動作)
- `completeReservation` はスロットを更新しない (スロットは `is_available: false` のまま)
- `markNoShow` はスロットを更新しない (スロットは `is_available: false` のまま)

ノーショーの場合、スロットが無駄に消費されたままになる。

**改善内容:**
- `completeReservation`: スロットは `is_available: false` のまま (過去のスロットなので正しい)
- `markNoShow`: スロットの日時が未来の場合のみ `is_available: true` に戻す
- ステータスを `cancelled` から `confirmed` に戻す操作がある場合、スロットを再度 `is_available: false` にする

**対象ファイル:**
- `src/lib/booking/reservations.ts`

---

### 4.3 過去スロットの自動クリーンアップ — P3

**現状:**
過去の日付のスロットが `is_available: true` のまま残り続ける。LIFF の予約フローでは30日先までの範囲でフェッチするため直接的な問題にはならないが、データが肥大化する。

**改善内容:**
- 日次 Cron ジョブで前日以前の `is_available: true` スロットを `is_available: false` に更新
- または、一定期間 (例: 3ヶ月) 以上前のスロットをアーカイブ/削除
- `getAvailableSlots` クエリに `date >= today` の条件を常時付与

**実装案:**

```typescript
// /api/cron/cleanup-slots (Vercel Cron)
// Schedule: daily at 01:00 JST
export async function GET() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  await supabase
    .from('time_slots')
    .update({ is_available: false })
    .lte('date', dateStr)
    .eq('is_available', true);
}
```

**対象ファイル:**
- 新規: `src/app/api/cron/cleanup-slots/route.ts`
- `src/lib/booking/slots.ts` — `getAvailableSlots` にガード追加

---

## 優先度サマリー

| 優先度 | 項目 | カテゴリ |
|--------|------|----------|
| **P1** | 1.1 プロパティ命名の不整合 | バグ修正 |
| **P1** | 1.2 Null ガード不足 | バグ修正 |
| **P1** | 1.3 businessHours オブジェクト/配列不整合 | バグ修正 |
| **P1** | 2.1 管理ダッシュボードからの予約作成 | UX改善 |
| **P1** | 3.1 キャンセル時の LINE 通知 | 機能拡張 |
| **P1** | 4.1 二重予約防止 (楽観的ロック) | データ整合性 |
| **P1** | 4.2 ステータス変更時のスロット自動更新 | データ整合性 |
| **P2** | 2.2 予約詳細ビュー | UX改善 |
| **P2** | 2.3 ウォークイン顧客の手動予約作成 | UX改善 |
| **P2** | 2.4 スロット生成の日時ピッカー改善 | UX改善 |
| **P2** | 2.5 カレンダーに相談員名を表示 | UX改善 |
| **P2** | 3.2 自動スロット生成 (週次繰り返し) | 機能拡張 |
| **P2** | 3.3 相談員の休暇・例外日管理 | 機能拡張 |
| **P3** | 2.6 スロット設定のビジュアルグリッド化 | UX改善 |
| **P3** | 3.4 予約備考の相談員表示 | 機能拡張 |
| **P3** | 3.5 予約データの CSV エクスポート | 機能拡張 |
| **P3** | 4.3 過去スロットの自動クリーンアップ | データ整合性 |

---

## 実装順序の推奨

### Phase 1 (即時対応 — P1 バグ修正 + データ整合性)
1. 4.1 二重予約防止
2. 1.1 + 1.3 businessHours 命名・型の統一
3. 1.2 Null ガード修正 (LIFF の顧客ID修正含む)
4. 4.2 ステータス変更時のスロット更新

### Phase 2 (短期 — P1 機能 + P2 UX)
5. 2.1 管理画面からの予約作成
6. 3.1 キャンセル通知
7. 2.2 予約詳細ビュー
8. 2.5 カレンダーに相談員名表示

### Phase 3 (中期 — P2 機能 + P3)
9. 3.2 自動スロット生成
10. 3.3 相談員休暇管理
11. 2.3 ウォークイン予約
12. 2.4 日時ピッカー改善
13. 残りの P3 項目
