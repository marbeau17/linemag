# LSTEP連携仕様書

| 項目 | 内容 |
|------|------|
| 文書ID | SPEC-01 |
| 対象システム | LineMag (Next.js 14 / Vercel) |
| 作成日 | 2026-03-24 |
| ステータス | Draft |

---

## 目次

1. [LSTEPの機能とLineMagの統合方針](#1-lstepの機能とlinemagの統合方針)
2. [タグ管理・シナリオ配信との連携設計](#2-タグ管理シナリオ配信との連携設計)
3. [リッチメニューのカスタマイズ戦略](#3-リッチメニューのカスタマイズ戦略)
4. [LSTEP API連携仕様](#4-lstep-api連携仕様)
5. [LSTEP vs 自前実装 比較表](#5-lstep-vs-自前実装-比較表)

---

## 1. LSTEPの機能とLineMagの統合方針

### 1.1 現状のLineMagアーキテクチャ

```
meetsc.co.jp/blog/ (WordPress)
        |
   [スクレイピング] ── src/lib/line/scraper.ts
        |
   [Gemini AI要約] ── src/lib/line/summarizer.ts
        |
   [Flex Message生成] ── src/lib/line/templates.ts (5テンプレート)
        |
   [LINE Messaging API]
     ├── Broadcast (全員配信) ── src/lib/line/messaging.ts
     ├── Push (個別配信)
     └── Webhook (UserID収集) ── src/app/api/line/webhook/route.ts
        |
   [ファイルベース保存] ── data/*.json (Supabase移行予定)
```

### 1.2 機能の切り分け方針

LSTEPの導入範囲を「CRM/マーケティング自動化はLSTEP」「コンテンツ生成/独自ロジックはLineMag自前」という原則で切り分ける。

#### LSTEPに委譲する機能

| 機能 | 理由 |
|------|------|
| **タグ管理** | LSTEPのGUIで非エンジニアも運用可能。行動ベースの自動タグ付けが標準装備 |
| **セグメント配信** | タグ・流入経路・回答フォーム結果を条件に絞り込み配信。自前で作ると工数大 |
| **シナリオ配信（ステップ配信）** | 友だち追加後の自動ナーチャリング。分岐条件・待機時間をGUIで設定可能 |
| **リッチメニュー切替** | タグやシナリオ進行度に応じた動的切替。LINE公式の標準機能では1パターン固定 |
| **回答フォーム** | ユーザープロファイル収集（業種・関心テーマ等）。回答結果が自動でタグに反映 |
| **流入経路分析** | QRコード/URL別に友だち追加元を識別。経路ごとのタグ自動付与 |
| **クーポン配信** | 条件付きクーポン発行・使用状況追跡 |
| **予約管理** | カレンダー連携の予約受付（30分/1時間スロット対応） |

#### LineMag側で自前実装を継続する機能

| 機能 | 理由 |
|------|------|
| **ブログスクレイピング** | meetsc.co.jp固有のDOM構造に依存。LSTEP側に該当機能なし |
| **Gemini AI要約** | AI要約はLineMag独自の差別化ポイント。LSTEPにAI要約機能は存在しない |
| **Flex Messageテンプレート生成** | 5種類のテンプレート（daily-column, news-card等）は独自設計。LSTEPのテンプレートでは再現不可 |
| **スケジュール配信のトリガー** | Vercel Cronによる自動実行はそのまま維持。ただし配信先をLSTEP APIに変更 |
| **管理ダッシュボード** | 記事選択・プレビュー・テスト配信のUIは自前のNext.jsダッシュボードを継続 |
| **配信ログ・履歴管理** | Supabase移行後にLineMag独自の分析ビューを構築（LSTEPの分析と併用） |

### 1.3 統合後のアーキテクチャ

```
meetsc.co.jp/blog/
        |
   [LineMag: スクレイピング + AI要約 + Flex Message生成]
        |
        +---> [LINE Messaging API: Broadcast/Push] ※コンテンツ配信
        |         (既存の src/lib/line/messaging.ts)
        |
        +---> [LSTEP API: タグ付与] ※配信後にユーザー行動を記録
                  |
            [LSTEP内部]
              ├── タグ管理 + セグメント
              ├── シナリオ配信（ナーチャリング）
              ├── リッチメニュー動的切替
              ├── 回答フォーム → プロファイル充実
              ├── クーポン管理
              └── 予約システム
```

**重要な設計判断**: コンテンツ配信（Flex Message）はLineMagからLINE Messaging APIに直接送信する。LSTEPはCRM/マーケティング自動化レイヤーとして並行稼働させる。配信をLSTEP経由に一本化しない理由は以下の通り。

- LineMagのFlex Messageテンプレートは高度にカスタマイズされており、LSTEPのメッセージビルダーでは再現困難
- Vercel Cronによる自動配信フローを維持したい
- LSTEP APIのメッセージ送信には月額プランによる送信数上限がある

---

## 2. タグ管理・シナリオ配信との連携設計

### 2.1 タグ体系設計

LSTEPのタグを以下のカテゴリで体系化する。命名規則は `カテゴリ:値` とする。

#### 属性タグ（回答フォームで取得）

| タグ名 | 取得方法 | 用途 |
|--------|----------|------|
| `属性:経営者` | 回答フォーム | セグメント配信 |
| `属性:人事担当` | 回答フォーム | セグメント配信 |
| `属性:マーケ担当` | 回答フォーム | セグメント配信 |
| `属性:個人事業主` | 回答フォーム | セグメント配信 |
| `業種:IT` | 回答フォーム | コンテンツ出し分け |
| `業種:製造` | 回答フォーム | コンテンツ出し分け |
| `業種:サービス` | 回答フォーム | コンテンツ出し分け |
| `業種:その他` | 回答フォーム | コンテンツ出し分け |

#### 行動タグ（自動付与）

| タグ名 | 付与トリガー | 用途 |
|--------|-------------|------|
| `閲覧:ブログ記事` | Flex Message内のURLクリック | 記事興味度の計測 |
| `閲覧:カテゴリ:{category}` | 記事カテゴリ別のクリック追跡 | カテゴリ別の関心分析 |
| `行動:クーポン取得` | クーポン取得アクション | EC連携 |
| `行動:クーポン使用済` | クーポン使用確認 | 購買追跡 |
| `行動:予約完了` | 予約確定時 | 予約管理 |
| `行動:予約キャンセル` | 予約キャンセル時 | フォロー配信トリガー |

#### 流入経路タグ（自動付与）

| タグ名 | 付与条件 | 用途 |
|--------|---------|------|
| `流入:HP` | meetsc.co.jp からの友だち追加 | 経路分析 |
| `流入:ブログ` | ブログ記事内QRコード経由 | 経路分析 |
| `流入:セミナー` | セミナー用QRコード経由 | 経路分析 |
| `流入:名刺` | 名刺用QRコード経由 | 経路分析 |

#### ステージタグ（シナリオ進行で自動切替）

| タグ名 | 付与タイミング | 用途 |
|--------|-------------|------|
| `ステージ:新規` | 友だち追加直後 | リッチメニュー切替 |
| `ステージ:関心あり` | 記事3回以上クリック | リッチメニュー切替 |
| `ステージ:見込み` | 回答フォーム回答済 | リッチメニュー切替 |
| `ステージ:商談中` | 予約完了 | リッチメニュー切替 |
| `ステージ:顧客` | 手動付与（成約後） | リッチメニュー切替 |

### 2.2 シナリオ配信設計

#### シナリオA: 友だち追加直後ナーチャリング

```
[友だち追加]
    |
    +-- 即時: あいさつメッセージ + 回答フォームへの誘導
    |         タグ付与: ステージ:新規
    |
    +-- 1日後: meetsc.co.jpの人気記事TOP3紹介（Flex Message）
    |          ※LineMagのFlex Messageテンプレートを流用
    |
    +-- 3日後: 回答フォーム未回答 → リマインド送信
    |          回答フォーム回答済 → スキップ
    |
    +-- 7日後: 業種別おすすめ記事（タグ条件分岐）
    |          ├── 業種:IT → IT関連記事
    |          ├── 業種:製造 → 製造業関連記事
    |          └── その他 → 汎用おすすめ記事
    |
    +-- 14日後: 初回クーポン配信
               タグ付与: 行動:クーポン取得
```

#### シナリオB: 記事クリック後フォローアップ

```
[記事URLクリック]
    |
    +-- タグ付与: 閲覧:ブログ記事, 閲覧:カテゴリ:{category}
    |
    +-- クリック3回目: タグ切替 ステージ:新規 → ステージ:関心あり
    |                  リッチメニュー自動切替
    |
    +-- 1日後: 同カテゴリの関連記事をプッシュ
               ※LineMagのスクレイピング結果から同カテゴリ記事を取得
```

#### シナリオC: 予約リマインド

```
[予約完了]
    |
    +-- 即時: 予約確認メッセージ + Google Meet URL
    |         タグ付与: 行動:予約完了, ステージ:商談中
    |
    +-- 予約1日前: リマインドメッセージ
    |
    +-- 予約1時間前: 最終リマインド + Google Meet URL再送
    |
    +-- 予約翌日: お礼メッセージ + アンケートフォーム
```

### 2.3 LineMagからのタグ付与フロー

LineMagの配信処理（`src/lib/line/messaging.ts`）にLSTEP連携を追加する。

```typescript
// src/lib/line/lstep/client.ts (新規作成)

interface LstepTagRequest {
  userId: string;
  tagName: string;
}

export async function addLstepTag(req: LstepTagRequest): Promise<void> {
  // LSTEP APIを呼び出してタグ付与
  // 詳細は「4. LSTEP API連携仕様」を参照
}

export async function removeLstepTag(req: LstepTagRequest): Promise<void> {
  // LSTEP APIを呼び出してタグ削除
}
```

**配信時のタグ付与タイミング**:

1. `broadcastArticle()` 実行時 → 配信対象記事のカテゴリをメタデータとしてLSTEPに送信
2. Flex Message内のURLにLSTEPのクリック計測パラメータを付与
3. Webhookでユーザーアクション受信時 → LSTEPのタグ付与APIを呼び出し

---

## 3. リッチメニューのカスタマイズ戦略

### 3.1 リッチメニューのパターン設計

ユーザーのステージタグに応じて、最大3パターンのリッチメニューを動的に切り替える。

#### パターンA: 新規ユーザー（ステージ:新規）

```
+-------------------+-------------------+
|                   |                   |
|   最新記事を読む   |   プロフィール登録  |
|   (ブログ一覧へ)   |   (回答フォーム)   |
|                   |                   |
+-------------------+-------------------+
|                   |                   |
|   会社概要         |   お問い合わせ     |
|   (meetsc.co.jp)  |   (LINE応答)      |
|                   |                   |
+-------------------+-------------------+
```

#### パターンB: 関心ユーザー（ステージ:関心あり / ステージ:見込み）

```
+-------------------+-------------------+
|                   |                   |
|   おすすめ記事     |   無料相談予約     |
|   (パーソナライズ) |   (予約システム)   |
|                   |                   |
+-------------------+-------------------+
|                   |                   |
|   クーポン一覧     |   サービス紹介     |
|   (LSTEP管理)     |   (meetsc.co.jp)  |
|                   |                   |
+-------------------+-------------------+
```

#### パターンC: 商談中/顧客（ステージ:商談中 / ステージ:顧客）

```
+-------------------+-------------------+
|                   |                   |
|   最新情報         |   予約状況確認     |
|   (限定コンテンツ) |   (予約管理)      |
|                   |                   |
+-------------------+-------------------+
|                   |                   |
|   お得なクーポン   |   担当者に連絡     |
|   (優待クーポン)   |   (1:1チャット)   |
|                   |                   |
+-------------------+-------------------+
```

### 3.2 リッチメニューの切替ルール

| トリガー | 切替先 | 実装場所 |
|---------|--------|---------|
| 友だち追加 | パターンA | LSTEPシナリオ内で自動設定 |
| `ステージ:関心あり` タグ付与 | パターンB | LSTEPのタグトリガーで自動切替 |
| `ステージ:商談中` タグ付与 | パターンC | LSTEPのタグトリガーで自動切替 |
| `ステージ:顧客` タグ付与 | パターンC | LSTEPのタグトリガーで自動切替 |

### 3.3 リッチメニューの各ボタンアクション

| ボタン | アクション種別 | 遷移先/動作 |
|--------|---------------|-------------|
| 最新記事を読む | URI | `https://meetsc.co.jp/blog/` |
| プロフィール登録 | URI | LSTEP回答フォームURL |
| おすすめ記事 | Postback | LineMagが受信し、タグに基づくパーソナライズ記事をPush送信 |
| 無料相談予約 | URI | LSTEP予約ページURL or Googleカレンダー予約リンク |
| クーポン一覧 | URI | LSTEPクーポンページURL |
| 予約状況確認 | Postback | LineMagが受信し、Supabaseから予約情報を取得してFlexで返信 |

### 3.4 Postback連携の実装方針

リッチメニューの「おすすめ記事」「予約状況確認」ボタンはPostbackアクションとし、LineMagのWebhookで受信して処理する。

```typescript
// src/app/api/line/webhook/route.ts への追加予定

// Postbackイベントの処理
if (event.type === 'postback') {
  const data = event.postback?.data; // 例: "action=recommend" or "action=check_reservation"
  switch (data) {
    case 'action=recommend':
      // LSTEP APIからユーザータグを取得
      // タグに基づきスクレイピング済み記事からフィルタ
      // パーソナライズされたFlex MessageをPush送信
      break;
    case 'action=check_reservation':
      // Supabaseから予約情報を取得
      // Flex MessageでPush送信
      break;
  }
}
```

---

## 4. LSTEP API連携仕様

### 4.1 認証

LSTEP APIはAPIキー認証を使用する。

```
# .env に追加
LSTEP_API_KEY=lsxxxxxxxxxxxxxxxxxxxxxx
LSTEP_API_BASE_URL=https://api.lstep.jp/v1
```

```typescript
// src/lib/line/config.ts への追加

lstep: {
  get apiKey(): string {
    const key = process.env.LSTEP_API_KEY;
    if (!key) throw new Error('LSTEP_API_KEY is not set');
    return key;
  },
  get baseUrl(): string {
    return process.env.LSTEP_API_BASE_URL || 'https://api.lstep.jp/v1';
  },
},
```

### 4.2 LSTEPクライアント実装

新規ファイル `src/lib/lstep/client.ts` を作成する。

```typescript
// src/lib/lstep/client.ts

import { config } from '@/lib/line/config';

interface LstepApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LstepUser {
  id: string;
  lineUserId: string;
  displayName: string;
  tags: string[];
  scenario?: string;
  registeredAt: string;
}

class LstepClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.lstep.baseUrl;
    this.apiKey = config.lstep.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<LstepApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      throw new Error(`LSTEP API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  // ── タグ操作 ──

  async addTag(lineUserId: string, tagName: string): Promise<void> {
    await this.request('POST', '/tags/add', { lineUserId, tagName });
  }

  async removeTag(lineUserId: string, tagName: string): Promise<void> {
    await this.request('POST', '/tags/remove', { lineUserId, tagName });
  }

  async getUserTags(lineUserId: string): Promise<string[]> {
    const res = await this.request<{ tags: string[] }>(
      'GET',
      `/users/${lineUserId}/tags`,
    );
    return res.data?.tags ?? [];
  }

  // ── ユーザー情報取得 ──

  async getUser(lineUserId: string): Promise<LstepUser | null> {
    try {
      const res = await this.request<LstepUser>(
        'GET',
        `/users/${lineUserId}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  // ── シナリオ操作 ──

  async startScenario(
    lineUserId: string,
    scenarioId: string,
  ): Promise<void> {
    await this.request('POST', '/scenarios/start', {
      lineUserId,
      scenarioId,
    });
  }

  async stopScenario(lineUserId: string): Promise<void> {
    await this.request('POST', '/scenarios/stop', { lineUserId });
  }
}

export const lstepClient = new LstepClient();
```

### 4.3 Webhook連携

LSTEPからLineMagへの通知と、LineMagからLSTEPへの通知の双方向連携を行う。

#### 4.3.1 LSTEP → LineMag Webhook

LSTEPの「外部連携Webhook」設定で、特定イベント時にLineMagのエンドポイントを呼び出す。

```
エンドポイント: https://linemag.vercel.app/api/lstep/webhook
メソッド: POST
認証: X-Lstep-Signature ヘッダーによるHMAC検証
```

```typescript
// src/app/api/lstep/webhook/route.ts (新規作成)

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface LstepWebhookEvent {
  eventType: 'tag_added' | 'tag_removed' | 'form_answered'
           | 'scenario_completed' | 'reservation_created'
           | 'reservation_cancelled' | 'coupon_used';
  lineUserId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LSTEP_WEBHOOK_SECRET || '';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-lstep-signature') || '';

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event: LstepWebhookEvent = JSON.parse(rawBody);

  switch (event.eventType) {
    case 'tag_added':
      // ステージタグの変更に応じてLineMag側の処理を実行
      // 例: ステージ:関心あり → パーソナライズ記事のプッシュ配信
      break;

    case 'form_answered':
      // 回答フォーム結果をSupabaseのユーザープロファイルに同期
      break;

    case 'reservation_created':
      // 予約情報をSupabaseに記録 + Google Meet URL生成
      break;

    case 'reservation_cancelled':
      // 予約キャンセル処理
      break;

    case 'coupon_used':
      // クーポン使用状況をSupabaseに記録
      break;
  }

  return NextResponse.json({ status: 'ok' });
}
```

#### 4.3.2 LineMag → LSTEP（タグ付与）

LineMagの既存Webhookを拡張し、ユーザーアクション時にLSTEPにタグを付与する。

```typescript
// src/app/api/line/webhook/route.ts の拡張

import { lstepClient } from '@/lib/lstep/client';

// 既存のPOSTハンドラ内に追加
for (const event of body.events) {
  const userId = event.source?.userId;
  if (!userId) continue;

  // 既存: ファイルベースのユーザー記録（将来Supabase移行）
  // ...existing code...

  // 追加: LSTEPタグ付与
  if (event.type === 'follow') {
    await lstepClient.addTag(userId, 'ステージ:新規');
  }

  if (event.type === 'message' && event.message?.type === 'text') {
    await lstepClient.addTag(userId, '行動:メッセージ送信');
  }
}
```

### 4.4 Flex Message内のクリック追跡

LineMagが生成するFlex Message内のURLにLSTEPの計測パラメータを付与する。

```typescript
// src/lib/line/templates.ts の変更方針

// 変更前
const articleUrl = req.articleUrl;

// 変更後: LSTEPの計測パラメータを付与
const articleUrl = appendLstepTracking(req.articleUrl, {
  category: req.articleCategory,
  templateId: req.templateId,
});

function appendLstepTracking(
  url: string,
  meta: { category?: string; templateId: string },
): string {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'linemag');
  u.searchParams.set('utm_medium', 'line');
  u.searchParams.set('utm_campaign', meta.templateId);
  if (meta.category) {
    u.searchParams.set('utm_content', meta.category);
  }
  return u.toString();
}
```

### 4.5 予約システム連携

LSTEPの予約機能を利用し、Google Meetと連携する。

```
予約フロー:
1. ユーザーがリッチメニュー「無料相談予約」をタップ
2. LSTEPの予約ページに遷移（30分/1時間スロット選択）
3. LSTEP内で予約確定
4. LSTEP Webhook → LineMag API → Google Calendar API + Google Meet URL生成
5. LineMagがFlex Messageで予約確認 + Meet URLをPush送信
6. LSTEPのシナリオCがリマインド配信を担当
```

```typescript
// src/app/api/lstep/webhook/route.ts 内の reservation_created ハンドラ

case 'reservation_created': {
  const { date, time, duration, lineUserId } = event.data as {
    date: string;      // "2026-04-01"
    time: string;      // "14:00"
    duration: number;  // 30 or 60 (分)
    lineUserId: string;
  };

  // Google Calendar API で予定作成 + Meet URL取得
  const meetUrl = await createCalendarEvent({
    summary: `meetsc 無料相談 - ${lineUserId}`,
    startDateTime: `${date}T${time}:00+09:00`,
    durationMinutes: duration,
    addGoogleMeet: true,
  });

  // Flex Messageで予約確認を送信
  await pushReservationConfirmation(lineUserId, {
    date, time, duration, meetUrl,
  });

  // Supabaseに予約レコードを保存
  await saveReservation({ lineUserId, date, time, duration, meetUrl });
  break;
}
```

### 4.6 API呼び出しのエラーハンドリング

LineMagの既存リトライパターン（`src/lib/line/retry.ts`）を踏襲し、LSTEP APIへの呼び出しにも同等のリトライロジックを適用する。

```typescript
// src/lib/line/config.ts への追加

retry: {
  // ...既存設定...
  lstep: {
    maxRetries: 2,
    delayMs: 3000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
},
```

| ステータス | 対応 |
|-----------|------|
| 401 | APIキーエラー。リトライなし。管理者に通知 |
| 429 | レート制限。30秒後に1回リトライ |
| 5xx | サーバーエラー。3秒後に最大2回リトライ |
| タイムアウト | 5秒後に1回リトライ |

---

## 5. LSTEP vs 自前実装 比較表

### 5.1 機能別比較

| 機能 | LSTEP利用 | 自前実装 | 推奨 |
|------|-----------|---------|------|
| **タグ管理** | GUI操作で即日運用開始。自動タグ付けルール設定可。非エンジニアが運用可能 | Supabase + 管理画面の構築が必要。開発工数: 約2-3週間 | **LSTEP** |
| **セグメント配信** | タグ・属性・行動の複合条件でGUIから配信可。テンプレート制約あり | 完全なクエリ自由度。Flex Message自由。開発工数: 約3-4週間 | **LSTEP** (基本) + **自前** (Flex Message) |
| **シナリオ配信** | 分岐・待機・条件付き配信をGUIで設計。変更が即時反映 | 状態管理+キュー+スケジューラの構築が必要。開発工数: 約4-6週間 | **LSTEP** |
| **リッチメニュー切替** | タグ連動で最大20パターン切替。画像テンプレートあり | LINE API直接操作が必要。切替ロジック自前実装。開発工数: 約1-2週間 | **LSTEP** |
| **回答フォーム** | ドラッグ&ドロップでフォーム作成。回答→タグ自動付与 | フォームUI+Webhook+保存の実装が必要。開発工数: 約2-3週間 | **LSTEP** |
| **流入経路分析** | QRコード生成+自動タグ付与。管理画面で集計 | UTMパラメータ+独自集計基盤の構築。開発工数: 約2週間 | **LSTEP** |
| **クーポン配信** | 条件付き発行・期限管理・使用追跡がビルトイン | クーポンマスタ+発行ロジック+検証APIの構築。開発工数: 約3-4週間 | **LSTEP** |
| **予約管理** | カレンダーUI+リマインド配信が標準搭載 | カレンダーUI+スロット管理+Google Calendar APIの構築。開発工数: 約3-4週間 | **LSTEP** (受付) + **自前** (Meet連携) |
| **AI要約配信** | 対応不可。外部APIでのコンテンツ生成をメッセージに埋め込む手段なし | Gemini API連携+Flex Message生成が稼働中 | **自前** |
| **ブログスクレイピング** | 対応不可 | Cheerioベースで稼働中 | **自前** |
| **Flex Messageテンプレート** | 簡易ビルダーのみ。高度なカスタマイズ不可 | 5テンプレート稼働中。完全な自由度 | **自前** |
| **配信分析ダッシュボード** | 標準の分析画面あり。カスタマイズ制限あり | Next.jsダッシュボードに独自指標を追加可能 | **併用** |

### 5.2 コスト比較

| 項目 | LSTEP | 自前実装 |
|------|-------|---------|
| 初期費用 | 0円 | 開発人件費 (上記工数の合計: 約20-30週間分) |
| 月額費用 | スタンダードプラン: 21,780円/月 (税込) ※友だち数5,000人以下 | Supabase Free/Pro + Vercel Hobby/Pro |
| スケーラビリティ | 友だち数増加でプラン変更が必要（上位プラン: 32,780円〜/月） | Supabase/Vercelの従量課金。友だち10万人以下なら月数千円程度 |
| 運用コスト | GUIで非エンジニアが運用可 | エンジニアの運用保守が必要 |
| ベンダーロックイン | LSTEPのサービス終了リスク。データエクスポートは可能だが移行コスト大 | 自社管理。任意のタイミングで変更可能 |

### 5.3 総合判定

| 判定基準 | 推奨アプローチ |
|---------|-------------|
| 早期立ち上げを重視 | LSTEP全面採用 + LineMagのAI配信を並行運用 |
| 長期的なコスト最適化を重視 | 段階的に自前実装に移行（まずLSTEPで運用ノウハウ蓄積） |
| 非エンジニアの運用参加を重視 | LSTEP（GUI操作のメリットが大きい） |
| 独自のUXを重視 | 自前実装（Flex Messageの自由度、独自ダッシュボード） |

### 5.4 推奨ロードマップ

```
Phase 1 (即時): LSTEP導入 + LineMag既存機能の維持
  - LSTEPアカウント開設・初期設定
  - タグ体系の構築（2.1節のタグをLSTEPに登録）
  - リッチメニュー3パターンの作成・設定
  - 友だち追加シナリオ（シナリオA）の構築
  - 回答フォームの作成

Phase 2 (1-2週間後): API連携の実装
  - src/lib/lstep/client.ts の実装
  - src/app/api/lstep/webhook/route.ts の実装
  - 既存Webhookの拡張（LSTEP連携タグ付与）
  - Flex Message URLへの計測パラメータ付与

Phase 3 (3-4週間後): CRM機能の本格稼働
  - シナリオB（記事クリック後フォローアップ）の稼働
  - セグメント配信の開始
  - クーポン配信の設定

Phase 4 (5-6週間後): 予約システム連携
  - LSTEP予約機能の設定
  - Google Calendar API + Meet連携の実装
  - シナリオC（予約リマインド）の稼働
  - Supabase予約テーブルの構築

Phase 5 (8週間後〜): 最適化
  - 配信分析データの蓄積・評価
  - シナリオの効果測定・改善
  - 必要に応じてLSTEP機能の自前実装への段階的移行検討
```

---

## 付録A: 環境変数一覧（追加分）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `LSTEP_API_KEY` | LSTEP APIキー | `ls_xxxxxxxxxxxxxxxx` |
| `LSTEP_API_BASE_URL` | LSTEP APIベースURL | `https://api.lstep.jp/v1` |
| `LSTEP_WEBHOOK_SECRET` | Webhook署名検証用シークレット | `whsec_xxxxxxxx` |
| `GOOGLE_CALENDAR_CREDENTIALS` | Google Calendar APIサービスアカウントJSON | (JSON文字列) |
| `GOOGLE_CALENDAR_ID` | 予約用カレンダーID | `xxxxx@group.calendar.google.com` |

## 付録B: 新規ファイル一覧

| パス | 役割 |
|------|------|
| `src/lib/lstep/client.ts` | LSTEP APIクライアント |
| `src/app/api/lstep/webhook/route.ts` | LSTEP Webhook受信エンドポイント |
| `src/lib/lstep/tracking.ts` | URL計測パラメータ付与ユーティリティ |
| `src/lib/google/calendar.ts` | Google Calendar API + Meet URL生成 |
| `src/types/lstep.ts` | LSTEP関連の型定義 |
