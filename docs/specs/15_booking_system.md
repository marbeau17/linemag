# 相談窓口予約システム 仕様書

## 1. 概要

LINE登録済み顧客が相談窓口の予約を行えるシステム。顧客はLIFF上で利用可能なタイムスロットを選択し、予約を確定する。確定時にGoogle Meet招待URLがLINE経由で自動配信される。

### 1.1 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14 (App Router) + LINE LIFF SDK |
| バックエンド | Next.js API Routes (Route Handlers) |
| データベース | Supabase (PostgreSQL) |
| 認証 | LINE Login (LIFF) + Supabase Auth |
| 通知 | LINE Messaging API |
| ビデオ会議 | Google Meet (固定URL方式) |
| Cron/スケジューラ | Vercel Cron または Supabase Edge Functions |

### 1.2 用語定義

| 用語 | 説明 |
|------|------|
| スロット | 予約可能な時間枠（30分または60分） |
| バッファタイム | スロット前後に設ける準備・片付け用の余白時間 |
| LIFF | LINE Front-end Framework。LINE内ブラウザでWebアプリを動作させる仕組み |
| ノーショー | 予約者が連絡なく来場・参加しなかった状態 |
| 相談枠 | 管理者が設定する相談対応可能な時間帯 |

---

## 2. 予約フロー全体設計

### 2.1 顧客視点フロー

```
LINE トーク画面
  │
  ├─ リッチメニュー「予約する」タップ
  │
  ▼
LIFF 予約画面 起動
  │
  ├─ LIFF初期化 → LINE Login認証
  ├─ ユーザープロフィール取得 (userId, displayName)
  ├─ Supabase顧客テーブルとの紐付け（初回は自動登録）
  │
  ▼
相談種別選択（任意拡張）
  │
  ├─ 相談種別を選択（例: 一般相談、技術相談）
  ├─ 選択に応じて所要時間が自動決定（30分 or 60分）
  │
  ▼
日付選択
  │
  ├─ カレンダーUI表示（当日〜30日先まで）
  ├─ 休業日・予約不可日はグレーアウト
  ├─ 空きスロットがある日にはインジケーター表示
  │
  ▼
時間スロット選択
  │
  ├─ 選択日の空きスロット一覧表示
  ├─ 残数表示（「残り2枠」など）
  ├─ 既に予約済みのスロットは非表示 or 「満」表示
  │
  ▼
予約内容確認
  │
  ├─ 日時・相談種別・所要時間の確認
  ├─ 備考欄（任意入力）
  │
  ▼
予約確定
  │
  ├─ 仮予約レコード作成（ステータス: pending）
  ├─ 即時 → confirmed に遷移（自動承認モードの場合）
  ├─ LINE通知: 予約確認メッセージ + Google Meet URL送信
  │
  ▼
予約完了画面
  │
  └─ 予約詳細表示 + 「マイ予約一覧へ」リンク
```

### 2.2 管理者視点フロー

```
管理画面 (/dashboard/bookings)
  │
  ├─ カレンダービュー: 日/週/月表示切り替え
  ├─ 予約一覧: ステータス別フィルタ・検索
  │
  ▼
スロット設定
  │
  ├─ 営業時間テンプレート設定（曜日別）
  ├─ 休業日設定（祝日・特別休業）
  ├─ 例外日設定（臨時営業・時間変更）
  ├─ 同時予約可能数設定
  ├─ バッファタイム設定
  │
  ▼
予約管理
  │
  ├─ 新規予約の承認/拒否（手動承認モード時）
  ├─ 予約のキャンセル（顧客への通知付き）
  ├─ 予約の日時変更
  ├─ ノーショー記録
  │
  ▼
Google Meet管理
  │
  ├─ 固定Meet URL登録（複数対応可能）
  ├─ URL割り当てルール設定
  │
  ▼
レポート
  │
  └─ 予約数推移・キャンセル率・ノーショー率
```

---

## 3. タイムスロット管理仕様

### 3.1 スロット生成ロジック

スロットは事前に物理レコードとして生成するのではなく、**営業時間設定から動的に算出**する方式を採用する。これにより設定変更時のメンテナンスコストを最小化する。

#### 3.1.1 営業時間テンプレート

曜日ごとに営業時間を定義する。

```
例:
月曜〜金曜: 09:00 - 18:00
土曜:       10:00 - 15:00
日曜:       休業
```

1日の中で複数の時間帯を設定可能（昼休憩の除外など）。

```
例:
月曜〜金曜:
  午前ブロック: 09:00 - 12:00
  午後ブロック: 13:00 - 18:00
```

#### 3.1.2 休業日

| 種別 | 説明 |
|------|------|
| 定休日 | 曜日ベースで繰り返し（例: 毎週日曜） |
| 祝日 | 日本の祝日マスタから自動取得、または手動登録 |
| 特別休業 | 管理者が任意の日付を指定 |

#### 3.1.3 例外日（オーバーライド）

特定の日付に対して通常の営業時間テンプレートを上書きする。

```
例:
2026-04-29 (祝日だが臨時営業): 10:00 - 14:00
2026-05-01 (通常営業日だが短縮): 09:00 - 12:00
```

#### 3.1.4 スロット算出アルゴリズム

```typescript
function generateSlots(date: Date, duration: 30 | 60): TimeSlot[] {
  // 1. 対象日の営業時間ブロックを取得
  //    - 例外日設定があればそちらを優先
  //    - なければ曜日テンプレートを使用
  //    - 休業日なら空配列を返す

  // 2. 各営業時間ブロック内でスロットを生成
  //    - 開始時刻から duration 分刻みで生成
  //    - バッファタイムを考慮（スロット間に buffer 分の空きを確保）
  //    - 終了時刻を超えるスロットは除外

  // 3. 既存予約を照合し空き状況を判定
  //    - 同時予約可能数(max_concurrent)に達したスロットを「満」にする
  //    - バッファタイムが重複するスロットも考慮

  // 4. 結果を返す
  return slots;
}
```

**生成例（30分スロット、バッファ10分、09:00-12:00ブロック）:**

| スロット | 実質占有時間（バッファ込み） |
|---------|--------------------------|
| 09:00 - 09:30 | 08:50 - 09:40 |
| 09:40 - 10:10 | 09:30 - 10:20 |
| 10:20 - 10:50 | 10:10 - 11:00 |
| 11:00 - 11:30 | 10:50 - 11:40 |

### 3.2 スロット種類

| 種別 | 時間 | 用途例 |
|------|------|--------|
| ショート | 30分 | 簡易相談、フォローアップ |
| スタンダード | 60分 | 初回相談、詳細ヒアリング |

相談種別ごとにデフォルトの所要時間を紐付ける。管理者は個別に変更可能。

### 3.3 同時予約可能数

| 設定 | 説明 |
|------|------|
| max_concurrent | 同一時間帯に受付可能な予約数（デフォルト: 1） |
| 担当者が複数名いる場合は枠を増やせる |
| スロット単位ではなく時間帯単位で判定 |

### 3.4 バッファタイム

| 設定 | デフォルト値 | 説明 |
|------|------------|------|
| buffer_before | 10分 | スロット開始前の準備時間 |
| buffer_after | 10分 | スロット終了後の片付け・記録時間 |

バッファタイムは顧客には見えない。管理者のカレンダー上ではグレー表示。

---

## 4. 予約ライフサイクル

### 4.1 ステータス遷移図

```
                    ┌──────────────────────────────┐
                    │                              │
  [作成] ──→ pending ──→ confirmed ──→ reminded ──→ completed
                │            │           │
                │            │           └──→ no_show
                │            │
                │            └──→ cancelled_by_admin
                │
                └──→ cancelled_by_customer
                │
                └──→ rejected (手動承認モード時)
                │
                └──→ expired (一定時間内に承認されなかった場合)
```

### 4.2 各ステータスの詳細

| ステータス | 説明 | 遷移条件 |
|-----------|------|---------|
| `pending` | 仮予約。承認待ち | 顧客が予約を確定操作した時点 |
| `confirmed` | 予約確定 | 自動承認: 即時遷移 / 手動承認: 管理者が承認 |
| `reminded` | リマインド済み | 予約時刻の24時間前 + 1時間前にリマインド送信 |
| `completed` | 相談実施済み | 管理者が完了操作、または予約時刻の2時間後に自動遷移 |
| `no_show` | ノーショー | 管理者が手動でマーク |
| `cancelled_by_customer` | 顧客キャンセル | 顧客がキャンセル操作 |
| `cancelled_by_admin` | 管理者キャンセル | 管理者がキャンセル操作 |
| `rejected` | 拒否 | 管理者が手動承認モードで拒否 |
| `expired` | 期限切れ | 手動承認モードで一定時間（24時間）承認されなかった |

### 4.3 自動処理タイムライン

```
予約確定時
  └─ LINE通知: 予約確認メッセージ送信

予約24時間前
  └─ LINE通知: リマインダー送信（1回目）

予約1時間前
  └─ LINE通知: リマインダー送信（2回目）+ Google Meet URL再送

予約時刻
  └─ （相談実施）

予約時刻 + 2時間後
  └─ ステータスを自動的に completed に遷移（no_show未マークの場合）
```

---

## 5. Google Meet連携仕様

### 5.1 固定URL管理方式

Google Calendar API等による動的生成ではなく、**事前に作成した固定Google Meet URL**を管理する方式を採用する。理由は以下の通り。

- Google Workspace APIの認証・権限管理が不要
- 実装・運用がシンプル
- URLが変わらないため顧客側でブックマーク可能

#### 5.1.1 Meet URL管理テーブル

複数の相談室（Meet URL）を登録し、予約時に空いているURLを割り当てる。

```
meet_rooms テーブル:
  - id
  - name          （例: "相談室A", "相談室B"）
  - meet_url      （例: "https://meet.google.com/abc-defg-hij"）
  - is_active     （有効/無効）
  - created_at
```

#### 5.1.2 URL割り当てロジック

```typescript
async function assignMeetRoom(bookingTime: Date): Promise<MeetRoom> {
  // 1. 有効なMeet Roomの一覧を取得
  // 2. 同一時間帯に割り当て済みのRoomを除外
  // 3. 空いているRoomをラウンドロビンで割り当て
  // 4. 割り当てなし（全Room使用中）の場合はエラー
  return availableRoom;
}
```

### 5.2 招待メッセージ生成

予約確定時に以下の情報を含むメッセージを生成する。

```
テンプレート:

【相談窓口予約が確定しました】

■ 予約日時
{date} {start_time} 〜 {end_time}

■ 相談種別
{consultation_type}

■ Google Meet URL
{meet_url}
※ 開始時刻になりましたら上記URLからご参加ください

■ 予約番号
{booking_number}

■ キャンセル・変更
予約の変更・キャンセルは下記からお手続きください。
{liff_mypage_url}

※ キャンセルは予約時刻の{cancel_deadline_hours}時間前までにお願いいたします。
```

---

## 6. LINE通知フロー

### 6.1 通知種別一覧

| 通知種別 | タイミング | 送信方法 |
|---------|-----------|---------|
| 予約確認 | 予約確定時 | Push Message |
| リマインダー(1回目) | 予約24時間前 | Push Message |
| リマインダー(2回目) | 予約1時間前 | Push Message |
| 変更通知 | 予約日時変更時 | Push Message |
| キャンセル通知（顧客起点） | 顧客がキャンセル時 | Push Message |
| キャンセル通知（管理者起点） | 管理者がキャンセル時 | Push Message |
| 拒否通知 | 管理者が予約を拒否時 | Push Message |
| ノーショー通知 | ノーショー記録時 | Push Message |

### 6.2 LINE Messaging API連携

```typescript
// Push Message送信
async function sendBookingNotification(
  lineUserId: string,
  notificationType: NotificationType,
  booking: Booking
): Promise<void> {
  const message = buildNotificationMessage(notificationType, booking);

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [message],
    }),
  });
}
```

### 6.3 メッセージフォーマット

全通知は **Flex Message** 形式を使用し、以下の構成とする。

```
┌─────────────────────────┐
│ [アイコン] タイトル       │  ← ヘッダー（通知種別に応じた色）
├─────────────────────────┤
│ 予約日時: YYYY/MM/DD HH:MM │
│ 相談種別: ○○○○         │
│ 予約番号: BK-XXXXXXXX   │
├─────────────────────────┤
│ [Google Meetに参加]      │  ← アクションボタン（リマインダー時）
│ [予約詳細を確認]         │  ← LIFFマイページへのリンク
└─────────────────────────┘
```

通知種別ごとのヘッダー色:

| 種別 | 色 |
|------|-----|
| 予約確認 | #06C755 (LINE Green) |
| リマインダー | #4A90D9 (Blue) |
| 変更通知 | #F5A623 (Orange) |
| キャンセル・拒否 | #D0021B (Red) |
| 完了 | #7B8D93 (Gray) |

### 6.4 リマインダーCron設定

```typescript
// Vercel Cron: vercel.json
{
  "crons": [
    {
      "path": "/api/cron/booking-reminder",
      "schedule": "0 * * * *"  // 毎時0分に実行
    }
  ]
}

// リマインダー処理
// 1. 24時間後〜25時間後に予約があり、まだリマインド未送信のレコードを取得
// 2. 1時間後〜2時間後に予約があり、2回目リマインド未送信のレコードを取得
// 3. 各レコードに対してLINE通知を送信
// 4. reminded_at を更新
```

---

## 7. 管理画面仕様

### 7.1 ページ構成

```
/dashboard/bookings
  ├─ /dashboard/bookings                 予約一覧・カレンダー
  ├─ /dashboard/bookings/[id]            予約詳細
  ├─ /dashboard/bookings/settings        予約設定
  │   ├─ /settings/business-hours        営業時間設定
  │   ├─ /settings/holidays              休業日設定
  │   ├─ /settings/slot-config           スロット設定
  │   └─ /settings/meet-rooms            Google Meet URL管理
  └─ /dashboard/bookings/reports         レポート
```

### 7.2 カレンダービュー

#### 7.2.1 表示モード

| モード | 説明 |
|--------|------|
| 月表示 | 各日に予約数バッジを表示。日付クリックで日表示へ |
| 週表示 | 時間軸 x 日付のグリッド。予約をブロックで表示 |
| 日表示 | 時間軸に沿って予約ブロックを表示。バッファタイムもグレーで表示 |

#### 7.2.2 予約ブロック表示

```
┌────────────────────────┐
│ 10:00 - 10:30          │
│ 山田太郎               │
│ [一般相談] [確定]       │
│ 相談室A                │
└────────────────────────┘
```

色分け:
- 確定: 緑系
- 仮予約: 黄系
- キャンセル済み: グレー（薄く表示）
- ノーショー: 赤系

### 7.3 予約一覧

| カラム | 説明 |
|--------|------|
| 予約番号 | BK-XXXXXXXX形式 |
| 顧客名 | LINE表示名 |
| 日時 | YYYY/MM/DD HH:MM |
| 相談種別 | カテゴリ名 |
| 所要時間 | 30分 / 60分 |
| ステータス | バッジ表示 |
| 相談室 | 割り当てられたMeet Room名 |
| 操作 | 詳細・キャンセル・ノーショーボタン |

フィルタ:
- ステータス別
- 日付範囲
- 相談種別
- 顧客名キーワード検索

### 7.4 スロット設定画面

| 設定項目 | UI | 説明 |
|---------|-----|------|
| 営業時間テンプレート | 曜日ごとのタイムレンジ入力 | 開始・終了を曜日別に設定 |
| 昼休憩 | チェックボックス + 時間入力 | 営業時間内の除外ブロック |
| 休業日 | カレンダーピッカー | 特定日を休業日に設定 |
| 例外日 | カレンダーピッカー + 時間入力 | 特定日の営業時間を上書き |
| スロット長 | セレクトボックス | 30分 / 60分 |
| バッファタイム | 数値入力 | 前後の余白（分） |
| 同時予約数 | 数値入力 | 同一時間帯の最大予約数 |
| 予約受付期間 | 数値入力 | 何日先まで予約可能か（デフォルト: 30日） |
| 承認モード | トグル | 自動承認 / 手動承認 |

---

## 8. キャンセルポリシー・ノーショー対応

### 8.1 キャンセルポリシー

| ルール | 設定値（デフォルト） |
|--------|-------------------|
| キャンセル期限 | 予約時刻の24時間前まで |
| 期限内キャンセル | 無条件でキャンセル可能 |
| 期限後キャンセル | LIFFからのキャンセル不可。管理者に連絡を促すメッセージ表示 |
| 管理者キャンセル | 期限に関係なく常時可能 |

### 8.2 キャンセル処理フロー

```
顧客がキャンセルボタンをタップ
  │
  ├─ キャンセル期限チェック
  │   ├─ 期限内 → キャンセル確認ダイアログ → キャンセル実行
  │   └─ 期限外 → 「直接ご連絡ください」メッセージ表示
  │
  ▼
キャンセル実行
  ├─ ステータスを cancelled_by_customer に更新
  ├─ スロットの空きを復元（予約数カウントを減算）
  ├─ Meet Room割り当てを解除
  ├─ LINE通知: キャンセル完了メッセージ送信
  └─ 管理者へ: キャンセル発生通知（任意設定）
```

### 8.3 ノーショー対応

| 対応 | 説明 |
|------|------|
| 記録 | 管理者が予約詳細画面から「ノーショー」ボタンで記録 |
| 通知 | ノーショー記録時に顧客へLINE通知（次回以降のお願い） |
| 履歴管理 | 顧客ごとのノーショー回数を集計 |
| 制限（任意） | ノーショーN回以上の顧客に予約制限をかける（将来拡張） |

---

## 9. 予約データモデル

### 9.1 ER図（概要）

```
customers ─────┐
               │ 1:N
               ▼
           bookings ────── meet_rooms
               │               (N:1)
               │
               ├── booking_status_logs (ステータス変遷履歴)
               │
               └── booking_notifications (通知送信履歴)

business_hours_templates (営業時間テンプレート)
holidays (休業日)
business_hour_overrides (例外日)
consultation_types (相談種別マスタ)
booking_settings (システム設定)
```

### 9.2 テーブル定義

#### 9.2.1 customers（顧客）

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  picture_url TEXT,
  email VARCHAR(255),
  phone VARCHAR(20),
  no_show_count INTEGER NOT NULL DEFAULT 0,
  is_booking_restricted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_line_user_id ON customers(line_user_id);
```

#### 9.2.2 consultation_types（相談種別マスタ）

```sql
CREATE TABLE consultation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,  -- 30 or 60
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 9.2.3 meet_rooms（Google Meet部屋）

```sql
CREATE TABLE meet_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  meet_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 9.2.4 bookings（予約）

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number VARCHAR(20) NOT NULL UNIQUE,  -- 'BK-' + 8桁英数字
  customer_id UUID NOT NULL REFERENCES customers(id),
  consultation_type_id UUID NOT NULL REFERENCES consultation_types(id),
  meet_room_id UUID REFERENCES meet_rooms(id),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending | confirmed | reminded | completed
    -- cancelled_by_customer | cancelled_by_admin
    -- rejected | expired | no_show
  notes TEXT,                          -- 顧客からの備考
  admin_notes TEXT,                    -- 管理者メモ
  reminder_1_sent_at TIMESTAMPTZ,      -- 24時間前リマインド送信日時
  reminder_2_sent_at TIMESTAMPTZ,      -- 1時間前リマインド送信日時
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX idx_bookings_date_time ON bookings(booking_date, start_time);
```

#### 9.2.5 booking_status_logs（ステータス変遷履歴）

```sql
CREATE TABLE booking_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  previous_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by VARCHAR(50),  -- 'system' | 'customer' | 'admin:{admin_id}'
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_status_logs_booking_id ON booking_status_logs(booking_id);
```

#### 9.2.6 booking_notifications（通知送信履歴）

```sql
CREATE TABLE booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
    -- confirmation | reminder_1 | reminder_2
    -- change | cancellation | rejection | no_show
  line_user_id VARCHAR(64) NOT NULL,
  message_payload JSONB,
  sent_at TIMESTAMPTZ,
  is_success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_notifications_booking_id ON booking_notifications(booking_id);
```

#### 9.2.7 business_hours_templates（営業時間テンプレート）

```sql
CREATE TABLE business_hours_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL,  -- 0=日曜, 1=月曜, ..., 6=土曜
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(day_of_week, start_time)
);
```

#### 9.2.8 holidays（休業日）

```sql
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name VARCHAR(100),            -- '元日', '成人の日' etc.
  holiday_type VARCHAR(20) NOT NULL DEFAULT 'manual',
    -- national_holiday | manual
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_holidays_date ON holidays(holiday_date);
```

#### 9.2.9 business_hour_overrides（例外日）

```sql
CREATE TABLE business_hour_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(override_date, start_time)
);

CREATE INDEX idx_overrides_date ON business_hour_overrides(override_date);
```

#### 9.2.10 booking_settings（システム設定）

```sql
CREATE TABLE booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初期データ
INSERT INTO booking_settings (key, value, description) VALUES
  ('slot_duration_minutes', '30', 'デフォルトスロット長（分）'),
  ('buffer_before_minutes', '10', 'スロット前バッファ（分）'),
  ('buffer_after_minutes', '10', 'スロット後バッファ（分）'),
  ('max_concurrent_bookings', '1', '同時予約可能数'),
  ('booking_window_days', '30', '予約受付期間（日数）'),
  ('cancel_deadline_hours', '24', 'キャンセル期限（時間前）'),
  ('approval_mode', '"auto"', '承認モード: auto | manual'),
  ('auto_complete_after_hours', '2', '自動完了までの時間（時間）'),
  ('no_show_restriction_count', '3', 'ノーショー制限回数');
```

### 9.3 RLS（Row Level Security）ポリシー

```sql
-- customers: 自分のレコードのみ参照可能
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_own"
  ON customers FOR SELECT
  USING (line_user_id = current_setting('app.current_line_user_id'));

-- bookings: 自分の予約のみ参照可能（顧客向け）
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_own"
  ON bookings FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE line_user_id = current_setting('app.current_line_user_id')
    )
  );

-- 管理者は全レコードにアクセス可能（service_role key使用）
```

---

## 10. API エンドポイント設計

### 10.1 顧客向けAPI

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/bookings/slots?date={date}&type={typeId}` | 指定日の空きスロット取得 |
| GET | `/api/bookings/available-dates?month={YYYY-MM}` | 指定月の予約可能日一覧 |
| POST | `/api/bookings` | 予約作成 |
| GET | `/api/bookings/my` | 自分の予約一覧 |
| GET | `/api/bookings/my/[id]` | 自分の予約詳細 |
| POST | `/api/bookings/my/[id]/cancel` | 予約キャンセル |
| GET | `/api/consultation-types` | 相談種別一覧 |

### 10.2 管理者向けAPI

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/admin/bookings` | 予約一覧（フィルタ付き） |
| GET | `/api/admin/bookings/[id]` | 予約詳細 |
| PATCH | `/api/admin/bookings/[id]` | 予約更新（ステータス変更等） |
| POST | `/api/admin/bookings/[id]/approve` | 予約承認 |
| POST | `/api/admin/bookings/[id]/reject` | 予約拒否 |
| POST | `/api/admin/bookings/[id]/cancel` | 予約キャンセル |
| POST | `/api/admin/bookings/[id]/no-show` | ノーショー記録 |
| GET | `/api/admin/settings/business-hours` | 営業時間設定取得 |
| PUT | `/api/admin/settings/business-hours` | 営業時間設定更新 |
| GET | `/api/admin/settings/holidays` | 休業日一覧 |
| POST | `/api/admin/settings/holidays` | 休業日追加 |
| DELETE | `/api/admin/settings/holidays/[id]` | 休業日削除 |
| GET | `/api/admin/settings/overrides` | 例外日一覧 |
| POST | `/api/admin/settings/overrides` | 例外日追加 |
| DELETE | `/api/admin/settings/overrides/[id]` | 例外日削除 |
| CRUD | `/api/admin/settings/meet-rooms` | Meet Room管理 |
| CRUD | `/api/admin/settings/consultation-types` | 相談種別管理 |
| GET | `/api/admin/settings/booking-config` | 予約設定取得 |
| PUT | `/api/admin/settings/booking-config` | 予約設定更新 |

### 10.3 Cron API

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/cron/booking-reminder` | リマインダー送信（毎時実行） |
| POST | `/api/cron/booking-auto-complete` | 自動完了処理（毎時実行） |
| POST | `/api/cron/booking-auto-expire` | 自動期限切れ処理（毎時実行） |

---

## 11. LIFF画面構成

### 11.1 画面一覧

| 画面 | LIFFパス | 説明 |
|------|---------|------|
| 予約トップ | `/liff/booking` | 相談種別選択 |
| 日付選択 | `/liff/booking/date` | カレンダーで日付選択 |
| 時間選択 | `/liff/booking/time` | 空きスロット選択 |
| 確認 | `/liff/booking/confirm` | 予約内容確認・備考入力 |
| 完了 | `/liff/booking/complete` | 予約完了 |
| マイ予約一覧 | `/liff/booking/my` | 自分の予約一覧 |
| 予約詳細 | `/liff/booking/my/[id]` | 予約詳細・キャンセル |

### 11.2 LIFF初期化フロー

```typescript
import liff from '@line/liff';

async function initLiff() {
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }

  const profile = await liff.getProfile();
  // profile.userId でSupabase顧客テーブルと紐付け
}
```

---

## 12. 非機能要件

### 12.1 パフォーマンス

| 項目 | 目標値 |
|------|--------|
| スロット取得API応答時間 | 500ms以内 |
| 予約作成API応答時間 | 1000ms以内 |
| LINE通知送信 | 予約確定から5秒以内 |

### 12.2 同時アクセス制御

同一スロットへの同時予約を防ぐため、予約作成時にデータベースレベルで排他制御を行う。

```sql
-- 予約作成時のトランザクション
BEGIN;

-- 対象スロットのロックを取得
SELECT COUNT(*) as current_count
FROM bookings
WHERE booking_date = $1
  AND start_time = $2
  AND status NOT IN ('cancelled_by_customer', 'cancelled_by_admin', 'rejected', 'expired')
FOR UPDATE;

-- max_concurrent_bookings と比較
-- 空きがあれば INSERT、なければ ROLLBACK

COMMIT;
```

### 12.3 データ保持期間

| データ | 保持期間 |
|--------|---------|
| 予約データ | 無期限（完了後もレポート用に保持） |
| 通知送信履歴 | 1年 |
| ステータス変遷履歴 | 1年 |
