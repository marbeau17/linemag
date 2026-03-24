# Google Meet連携 仕様書

## 1. 概要

予約システムとGoogle Meetを連携し、オンライン相談の予約から招待配信・リマインダーまでを自動化する。固定のGoogle Meet URLを相談員ごとに割り当て、予約確定時にLINE経由で顧客へ招待情報を配信する。

### 1.1 システム構成図

```
[顧客(LINE)] → [予約フォーム] → [Next.js API Routes]
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
              [Google Calendar API] [LINE Messaging API] [DB(予約管理)]
                        │               ▲               │
                        │               │               │
                        ▼               │               ▼
              [カレンダーイベント]   [招待/リマインダー]  [cron/スケジューラ]
```

### 1.2 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | Next.js 14 / React 18 / TypeScript |
| API | Next.js API Routes |
| カレンダー連携 | Google Calendar API v3 |
| メッセージ配信 | LINE Messaging API |
| スケジューラ | Vercel Cron Jobs |
| 認証 | Google Service Account |

---

## 2. Google Meet固定URL管理方式

### 2.1 設計方針

Google Meet URLは動的生成せず、相談員ごとに事前発行した固定URLを使用する。これにより以下のメリットを得る。

- Google Meet API（有料）の呼び出しが不要
- 相談員が毎回同じURLを使えるため運用が簡単
- APIレート制限の影響を受けない

### 2.2 相談員テーブル設計

```typescript
// types/consultant.ts
interface Consultant {
  id: string;                  // 相談員ID（UUID）
  name: string;                // 氏名
  email: string;               // Google Workspaceメールアドレス
  meetUrl: string;             // 固定Google Meet URL
  specialties: Specialty[];    // 担当分野
  workSchedule: WorkSchedule;  // 勤務スケジュール
  maxDailySlots: number;       // 1日の最大予約枠数
  isActive: boolean;           // 有効フラグ
  createdAt: string;
  updatedAt: string;
}

type Specialty =
  | 'general'        // 一般相談
  | 'tax'            // 税務
  | 'insurance'      // 保険
  | 'investment'     // 投資
  | 'real_estate'    // 不動産
  | 'inheritance';   // 相続

interface WorkSchedule {
  // 曜日ごとの勤務時間（0=日, 1=月, ..., 6=土）
  [dayOfWeek: number]: TimeSlot[];
}

interface TimeSlot {
  start: string; // "09:00"
  end: string;   // "12:00"
}
```

### 2.3 固定URL発行手順

1. Google Workspace管理者が相談員のGoogleアカウントでMeetを開く
2. 「新しい会議を作成」→「次回以降の会議を作成」で固定URLを取得
3. 取得したURL（`https://meet.google.com/xxx-xxxx-xxx`）をDBに登録

### 2.4 URL割り当てロジック

予約リクエスト時、以下の優先順位で相談員を自動割り当てる。

```typescript
// lib/consultant-matcher.ts
async function assignConsultant(
  requestedDate: Date,
  requestedTime: string,
  specialty: Specialty
): Promise<Consultant | null> {
  const candidates = await getActiveConsultants();

  const matched = candidates
    // 1. 担当分野でフィルタ
    .filter(c => c.specialties.includes(specialty))
    // 2. 勤務スケジュールでフィルタ
    .filter(c => isWorkingAt(c.workSchedule, requestedDate, requestedTime))
    // 3. 当日の予約枠に空きがあるかチェック
    .filter(c => hasAvailableSlot(c, requestedDate))
    // 4. 当日の予約数が少ない順にソート（負荷分散）
    .sort((a, b) => getDailyBookingCount(a, requestedDate) - getDailyBookingCount(b, requestedDate));

  return matched[0] ?? null;
}
```

**割り当て優先順位:**

| 優先度 | 条件 | 説明 |
|--------|------|------|
| 1 | 担当分野一致 | 相談内容に合った専門性を持つ相談員 |
| 2 | 勤務時間内 | 指定日時が勤務スケジュール内 |
| 3 | 枠空き | 1日の最大予約枠に達していない |
| 4 | 負荷分散 | 当日の予約数が少ない相談員を優先 |

---

## 3. Google Calendar API連携

### 3.1 認証設定（サービスアカウント方式）

サービスアカウントを使用し、ドメイン全体の委任（Domain-Wide Delegation）で相談員のカレンダーにイベントを作成する。

**セットアップ手順:**

1. Google Cloud Consoleでプロジェクトを作成
2. Google Calendar APIを有効化
3. サービスアカウントを作成し、JSONキーをダウンロード
4. Google Workspace管理コンソールで「ドメイン全体の委任」を設定
5. スコープ `https://www.googleapis.com/auth/calendar` を許可

**環境変数:**

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=meet-booking@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_WORKSPACE_DOMAIN=example.com
```

### 3.2 カレンダーイベント作成

```typescript
// lib/google-calendar.ts
import { google } from 'googleapis';

interface CreateEventParams {
  consultantEmail: string;
  customerName: string;
  startTime: Date;       // 相談開始時刻
  durationMinutes: number; // 相談時間（デフォルト30分）
  meetUrl: string;
  specialty: Specialty;
  memo?: string;
}

async function createCalendarEvent(params: CreateEventParams) {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
    subject: params.consultantEmail, // 相談員として操作
  });

  const calendar = google.calendar({ version: 'v3', auth });

  const endTime = new Date(params.startTime);
  endTime.setMinutes(endTime.getMinutes() + params.durationMinutes);

  const event = await calendar.events.insert({
    calendarId: params.consultantEmail,
    requestBody: {
      summary: `【オンライン相談】${params.customerName}様`,
      description: [
        `相談分野: ${params.specialty}`,
        `Google Meet: ${params.meetUrl}`,
        params.memo ? `メモ: ${params.memo}` : '',
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: params.startTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      conferenceData: undefined, // 固定URL使用のため動的生成しない
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      },
    },
  });

  return event.data;
}
```

### 3.3 予約のキャンセル・変更

```typescript
// lib/google-calendar.ts
async function cancelCalendarEvent(
  consultantEmail: string,
  calendarEventId: string
) {
  const auth = getAuthClient(consultantEmail);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: consultantEmail,
    eventId: calendarEventId,
  });
}

async function updateCalendarEvent(
  consultantEmail: string,
  calendarEventId: string,
  newStartTime: Date,
  durationMinutes: number
) {
  const auth = getAuthClient(consultantEmail);
  const calendar = google.calendar({ version: 'v3', auth });

  const endTime = new Date(newStartTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);

  await calendar.events.patch({
    calendarId: consultantEmail,
    eventId: calendarEventId,
    requestBody: {
      start: {
        dateTime: newStartTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
    },
  });
}
```

---

## 4. LINE招待メッセージ仕様

### 4.1 予約確定時の招待メッセージ

予約確定直後にLINE Messaging APIのFlex Messageで送信する。

```typescript
// lib/line-messages/meet-invitation.ts
function buildInvitationMessage(booking: Booking): FlexMessage {
  return {
    type: 'flex',
    altText: 'オンライン相談のご予約が確定しました',
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#00B900',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: 'オンライン相談 予約確定',
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          // 日時
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '日時', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: formatDateTime(booking.startTime), size: 'sm', flex: 5, wrap: true },
            ],
          },
          // 相談分野
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '相談内容', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: getSpecialtyLabel(booking.specialty), size: 'sm', flex: 5 },
            ],
          },
          // 担当者
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '担当者', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: booking.consultantName, size: 'sm', flex: 5 },
            ],
          },
          // 区切り線
          { type: 'separator', margin: 'lg' },
          // 注意事項
          {
            type: 'text',
            text: '【ご利用にあたって】\n・開始5分前までに下記URLからご参加ください\n・Googleアカウントがなくてもブラウザから参加可能です\n・通信環境の良い静かな場所でご参加ください\n・相談時間は約30分です',
            size: 'xs',
            color: '#666666',
            wrap: true,
            margin: 'lg',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#00B900',
            action: {
              type: 'uri',
              label: 'Google Meetに参加する',
              uri: booking.meetUrl,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'uri',
              label: '予約をキャンセル',
              uri: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/cancel/${booking.id}`,
            },
          },
        ],
      },
    },
  };
}
```

### 4.2 メッセージ表示例

```
┌──────────────────────────────┐
│  オンライン相談 予約確定       │（緑ヘッダー）
├──────────────────────────────┤
│  日時      2026年3月25日(水)  │
│           14:00〜14:30       │
│  相談内容  税務相談            │
│  担当者    山田太郎            │
│──────────────────────────────│
│  【ご利用にあたって】          │
│  ・開始5分前までに下記URLから   │
│    ご参加ください              │
│  ・Googleアカウントがなくても   │
│    ブラウザから参加可能です     │
│  ・通信環境の良い静かな場所で   │
│    ご参加ください              │
│  ・相談時間は約30分です        │
├──────────────────────────────┤
│  [ Google Meetに参加する ]     │（緑ボタン）
│  [ 予約をキャンセル ]          │（白ボタン）
└──────────────────────────────┘
```

---

## 5. リマインダー設計

### 5.1 リマインダースケジュール

| タイミング | 送信条件 | メッセージ内容 |
|-----------|---------|--------------|
| 24時間前 | 予約がキャンセルされていない | 明日の相談リマインド + Meet URL |
| 1時間前 | 予約がキャンセルされていない | まもなく相談開始 + Meet URL + 準備案内 |
| 10分前 | 予約がキャンセルされていない | 開始直前通知 + Meet URL（ワンタップ参加） |

### 5.2 Vercel Cron Jobs設定

```json
// vercel.json（追記）
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

10分間隔でcronを実行し、送信対象のリマインダーをまとめて処理する。

### 5.3 リマインダー処理ロジック

```typescript
// app/api/cron/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Vercel Cron認証チェック
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // 送信対象の予約を取得
  const targets = await getPendingReminders(now, [
    { offsetMinutes: 24 * 60, type: '24h' },
    { offsetMinutes: 60, type: '1h' },
    { offsetMinutes: 10, type: '10min' },
  ]);

  const results = [];
  for (const target of targets) {
    try {
      const message = buildReminderMessage(target.booking, target.type);
      await sendLineMessage(target.booking.lineUserId, message);
      await markReminderSent(target.booking.id, target.type);
      results.push({ bookingId: target.booking.id, type: target.type, status: 'sent' });
    } catch (error) {
      results.push({ bookingId: target.booking.id, type: target.type, status: 'error' });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
```

### 5.4 リマインダーメッセージ（タイプ別）

**24時間前:**
```
明日のオンライン相談のリマインドです。

日時: 2026年3月25日(水) 14:00〜14:30
担当: 山田太郎

[ Google Meetに参加する ]
```

**1時間前:**
```
まもなくオンライン相談の時間です。

本日 14:00〜14:30
担当: 山田太郎

以下をご確認ください:
・Wi-Fi等の通信環境
・マイク・カメラの動作
・静かな環境

[ Google Meetに参加する ]
```

**10分前:**
```
オンライン相談の開始10分前です。
下のボタンからご参加ください。

[ 今すぐ参加する ]
```

### 5.5 リマインダー管理テーブル

```typescript
interface ReminderRecord {
  id: string;
  bookingId: string;
  type: '24h' | '1h' | '10min';
  scheduledAt: Date;    // 送信予定時刻
  sentAt: Date | null;  // 実際の送信時刻（null=未送信）
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
}
```

---

## 6. 相談員（スタッフ）管理

### 6.1 勤務スケジュール管理

```typescript
// 勤務スケジュールの例
const exampleSchedule: WorkSchedule = {
  1: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], // 月
  2: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], // 火
  3: [{ start: '09:00', end: '12:00' }],                                    // 水（午前のみ）
  4: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], // 木
  5: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '15:00' }], // 金
  // 0(日), 6(土) はキーなし = 休業日
};
```

### 6.2 予約枠の算出

```typescript
// lib/availability.ts
interface AvailableSlot {
  startTime: Date;
  endTime: Date;
  consultantId: string;
  consultantName: string;
}

async function getAvailableSlots(
  date: Date,
  specialty: Specialty,
  slotDurationMinutes: number = 30
): Promise<AvailableSlot[]> {
  const dayOfWeek = date.getDay();
  const consultants = await getActiveConsultants();

  const slots: AvailableSlot[] = [];

  for (const consultant of consultants) {
    if (!consultant.specialties.includes(specialty)) continue;

    const timeSlots = consultant.workSchedule[dayOfWeek];
    if (!timeSlots) continue;

    const existingBookings = await getBookingsForDate(consultant.id, date);

    for (const ts of timeSlots) {
      let current = parseTime(date, ts.start);
      const end = parseTime(date, ts.end);

      while (current.getTime() + slotDurationMinutes * 60000 <= end.getTime()) {
        const slotEnd = new Date(current.getTime() + slotDurationMinutes * 60000);
        const isBooked = existingBookings.some(b => hasOverlap(b, current, slotEnd));

        if (!isBooked) {
          slots.push({
            startTime: new Date(current),
            endTime: slotEnd,
            consultantId: consultant.id,
            consultantName: consultant.name,
          });
        }
        // 30分刻みで次のスロットへ
        current = new Date(current.getTime() + slotDurationMinutes * 60000);
      }
    }
  }

  return slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
```

### 6.3 休暇・臨時休業の管理

```typescript
interface ConsultantHoliday {
  id: string;
  consultantId: string;
  date: Date;          // 休暇日
  type: 'full' | 'partial'; // 全日/一部時間
  timeRange?: {        // partial の場合のみ
    start: string;
    end: string;
  };
  reason?: string;
}
```

予約枠算出時にこのテーブルもチェックし、休暇日・時間帯の枠を除外する。

---

## 7. Google Workspace API認証設定

### 7.1 認証方式の選定

| 方式 | 用途 | 採用 |
|------|------|------|
| サービスアカウント + ドメイン全体委任 | サーバーサイドでのカレンダー操作 | 採用 |
| OAuth 2.0 (ユーザー認証) | 管理画面からの手動操作（将来拡張） | 将来検討 |
| APIキー | 公開データの読み取り専用 | 不使用 |

### 7.2 サービスアカウント設定手順

1. **Google Cloud Console**
   - プロジェクト作成（例: `linemag-meet`）
   - 「APIとサービス」→「ライブラリ」→ Google Calendar API を有効化
   - 「認証情報」→「サービスアカウントを作成」
   - JSONキーをダウンロード

2. **Google Workspace管理コンソール**
   - 「セキュリティ」→「APIの制御」→「ドメイン全体の委任」
   - サービスアカウントのクライアントIDを追加
   - 許可スコープ:
     ```
     https://www.googleapis.com/auth/calendar
     https://www.googleapis.com/auth/calendar.events
     ```

3. **環境変数設定**
   ```env
   # .env.local
   GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@project-id.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_WORKSPACE_DOMAIN=example.com
   ```

### 7.3 認証ヘルパー

```typescript
// lib/google-auth.ts
import { google } from 'googleapis';

export function getAuthClient(subjectEmail: string) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    subject: subjectEmail, // 委任対象ユーザー
  });
}
```

### 7.4 必要なnpmパッケージ

```bash
npm install googleapis
```

`googleapis` パッケージにはGoogle Calendar APIクライアントと認証ライブラリの両方が含まれる。

---

## 8. 予約フロー全体像

### 8.1 予約確定フロー

```
1. 顧客がLINEで「相談予約」をタップ
2. LIFFアプリ or リッチメニューから予約フォームを表示
3. 顧客が相談分野・希望日時を選択
4. API: 空き枠チェック → 相談員自動割り当て
5. 顧客が内容を確認し予約確定
6. API: 以下を並列実行
   ├── Google Calendar にイベント作成
   ├── DB に予約レコード保存
   ├── DB にリマインダーレコード作成（3件）
   └── LINE で招待メッセージ送信
7. 完了画面を表示
```

### 8.2 キャンセルフロー

```
1. 顧客が招待メッセージ内の「予約をキャンセル」をタップ
2. キャンセル確認画面を表示
3. 顧客がキャンセルを確定
4. API: 以下を並列実行
   ├── Google Calendar のイベント削除
   ├── DB の予約ステータスを cancelled に更新
   ├── DB のリマインダーを cancelled に更新
   └── LINE でキャンセル確認メッセージ送信
```

### 8.3 予約データモデル

```typescript
interface Booking {
  id: string;                    // 予約ID（UUID）
  lineUserId: string;            // LINE ユーザーID
  customerName: string;          // 顧客名
  consultantId: string;          // 相談員ID
  consultantName: string;        // 相談員名
  meetUrl: string;               // Google Meet URL
  calendarEventId: string;       // Google Calendar イベントID
  specialty: Specialty;          // 相談分野
  startTime: Date;               // 開始時刻
  endTime: Date;                 // 終了時刻
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  memo?: string;                 // 顧客からのメモ
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 9. 技術制約と代替案

### 9.1 Google Calendar API制約

| 制約項目 | 上限値 | 影響と対策 |
|---------|-------|-----------|
| 1日あたりのAPI呼び出し | 1,000,000回/日 | 通常運用では問題なし |
| 1ユーザーあたりのクエリ | 500回/100秒 | 大量予約時はキューイングで対応 |
| イベント作成頻度 | 60回/分/ユーザー | 同一相談員への集中予約時に注意 |
| カレンダー数上限 | 25/ユーザー | 影響なし（メインカレンダーのみ使用） |

### 9.2 Google Meet固定URL方式の制約

| 項目 | 制約内容 | 対策 |
|------|---------|------|
| URL有効期限 | 固定URLは365日間未使用だと失効 | 月次で自動チェック（カレンダーイベントを確認） |
| 同時利用 | 同じURLで同時に複数セッションは不可 | 予約枠を重複させないスケジューリングで防止 |
| 参加者制限 | URLを知っていれば誰でも参加可能 | 待合室（ロビー）機能を有効化し相談員が承認 |
| 録画権限 | 主催者（相談員）のみ | 仕様上問題なし |

### 9.3 Vercel Cron Jobsの制約

| プラン | cron実行頻度 | 最大実行時間 | 対策 |
|--------|-------------|-------------|------|
| Hobby | 1日1回 | 10秒 | 本番運用には不適 |
| Pro | 最短1分間隔 | 60秒 | 10分間隔で運用。1回あたりの処理数を制限 |

**Hobby プランの場合の代替案:**

1. **外部cronサービス** - cron-job.org等の無料サービスからAPIエンドポイントを叩く
2. **Upstash QStash** - サーバーレス向けメッセージキュー。スケジュール実行対応
3. **クライアントサイドポーリング** - 管理画面アクセス時にリマインダー送信をトリガー（非推奨）

### 9.4 コスト試算

| サービス | 料金体系 | 月間コスト目安 |
|---------|---------|--------------|
| Google Workspace Business Starter | 680円/ユーザー/月 | 相談員数 x 680円 |
| Google Calendar API | 無料 | 0円 |
| Google Meet（Workspace付属） | 追加料金なし | 0円 |
| LINE Messaging API | 無料枠200通/月、超過分は従量課金 | メッセージ数に依存 |
| Vercel Pro | $20/月 | 約3,000円 |
| **合計（相談員3名の場合）** | | **約5,040円/月 + LINE従量課金** |

### 9.5 セキュリティ考慮事項

- サービスアカウントの秘密鍵は環境変数で管理し、リポジトリにコミットしない
- `.env.local` を `.gitignore` に含める
- Meet URLはDB上で管理し、APIレスポンスでは予約当事者のみに返却
- キャンセルURLにはUUIDを使用し、推測不可能にする
- Cron APIエンドポイントにはベアラートークン認証を設定

---

## 10. 実装優先度

| フェーズ | 項目 | 工数目安 |
|---------|------|---------|
| Phase 1 | 相談員マスタ管理 + 固定URL登録 | 2日 |
| Phase 1 | 予約フォーム（空き枠表示・予約確定） | 3日 |
| Phase 1 | Google Calendar連携（イベント作成・削除） | 2日 |
| Phase 1 | LINE招待メッセージ送信 | 1日 |
| Phase 2 | リマインダー（cron + 3段階通知） | 2日 |
| Phase 2 | キャンセル・日時変更機能 | 2日 |
| Phase 3 | 管理画面（相談員スケジュール管理） | 3日 |
| Phase 3 | 休暇管理・臨時スケジュール変更 | 1日 |
| | **合計** | **約16日** |
