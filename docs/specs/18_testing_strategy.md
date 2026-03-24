# 18. テスト戦略仕様書

| 項目 | 内容 |
|------|------|
| ドキュメントID | SPEC-018 |
| 対象システム | LineMag — LINE配信・CRM統合プラットフォーム |
| 技術スタック | Next.js 14 / TypeScript / Supabase / Vercel |
| 外部連携 | LINE Messaging API, Gemini AI, Google Calendar API, ECサイトAPI |
| 作成日 | 2026-03-24 |
| ステータス | ドラフト |

---

## 目次

1. [テスト戦略全体像](#1-テスト戦略全体像)
2. [ユニットテスト設計](#2-ユニットテスト設計)
3. [統合テスト設計](#3-統合テスト設計)
4. [E2Eテスト設計](#4-e2eテスト設計)
5. [LINE特有のテスト](#5-line特有のテスト)
6. [パフォーマンステスト](#6-パフォーマンステスト)
7. [セキュリティテスト](#7-セキュリティテスト)
8. [テスト環境設計](#8-テスト環境設計)
9. [CI/CDパイプラインへのテスト統合](#9-cicdパイプラインへのテスト統合)

---

## 1. テスト戦略全体像

### 1.1 テストピラミッド

```
            /‾‾‾‾‾‾‾‾‾‾‾‾\
           /   E2E テスト    \          ← 少数・高コスト・高信頼
          /   (Playwright)    \            主要ユーザーフロー 10-15 本
         /─────────────────────\
        /    統合テスト          \       ← 中程度・API境界の検証
       /  (API Route + Supabase) \         APIルート全件 + 外部連携
      /───────────────────────────\
     /      ユニットテスト          \    ← 大量・低コスト・高速
    /  (Vitest + Testing Library)   \      ビジネスロジック中心
   /─────────────────────────────────\
```

### 1.2 各レイヤーの方針

| レイヤー | テスト比率(目安) | 実行頻度 | 主な対象 |
|----------|-----------------|----------|----------|
| ユニット | 70% | 全コミット | `src/lib/line/*`, 型定義, ユーティリティ, Reactコンポーネント |
| 統合 | 20% | 全PR | API Route (`src/app/api/**`), Supabase クエリ, 外部API連携 |
| E2E | 10% | デプロイ前 / 日次 | ダッシュボード操作, 配信フロー, プレビュー画面 |

### 1.3 品質ゲート

| 指標 | 閾値 | ブロック対象 |
|------|------|-------------|
| ユニットテスト合格率 | 100% | マージ |
| 統合テスト合格率 | 100% | マージ |
| E2Eテスト合格率 | 100% | デプロイ |
| コードカバレッジ (ステートメント) | 80% 以上 | マージ (警告は70%から) |
| TypeScript 型チェック | エラー0件 | マージ |
| ESLint | エラー0件 | マージ |

---

## 2. ユニットテスト設計

### 2.1 ツール選定

| ツール | 用途 |
|--------|------|
| **Vitest** | テストランナー (Next.js / TypeScript との親和性が高く、Jest互換) |
| **@testing-library/react** | Reactコンポーネントテスト |
| **msw (Mock Service Worker)** | HTTP リクエストモック |

### 2.2 対象モジュールと優先度

#### Tier 1: 最優先 (ビジネスクリティカル)

| モジュール | ファイル | テスト観点 |
|-----------|---------|-----------|
| Flex Messageテンプレート | `src/lib/line/templates.ts` | 5種類全テンプレートの構造検証、必須フィールド存在確認、不正入力時のフォールバック |
| メッセージ配信 | `src/lib/line/messaging.ts` | `LineApiError` 生成、リトライロジック、認証エラー判定 |
| リトライユーティリティ | `src/lib/line/retry.ts` | `withRetry` の再試行回数、指数バックオフ間隔、`HttpError` 分類、`fetchWithHttpError` の閾値 |
| 設定管理 | `src/lib/line/config.ts` | 環境変数未設定時の例外スロー、デフォルト値の正当性 |

#### Tier 2: 高優先

| モジュール | ファイル | テスト観点 |
|-----------|---------|-----------|
| スクレイパー | `src/lib/line/scraper.ts` | HTML解析の正確性、不正HTMLへの耐性、ログ収集 |
| 要約生成 | `src/lib/line/summarizer.ts` | Gemini APIレスポンスのパース、文字数制限の遵守 |
| フォロワー管理 | `src/lib/line/followers.ts` | ページネーション処理、空レスポンス処理 |
| ストレージ | `src/lib/line/storage.ts` | ファイル読み書き、上限超過時のトリム、同時アクセス |
| ロガー | `src/lib/line/logger.ts` | ログエントリ形式、ローテーション |
| 通知 | `src/lib/line/notifier.ts` | 管理者通知の送信条件 |

#### Tier 3: Reactコンポーネント

| コンポーネント | ファイル | テスト観点 |
|--------------|---------|-----------|
| FlexPreview | `src/components/line/FlexPreview.tsx` | テンプレート別プレビュー描画、propsバリデーション |
| ArticleCard | `src/components/line/ArticleCard.tsx` | 記事データの表示、サムネイルfallback |
| TemplateSelector | `src/components/line/TemplateSelector.tsx` | 選択イベント発火、アクティブ状態の切替 |

### 2.3 モック戦略

```
外部依存              モック方法                     理由
─────────────────────────────────────────────────────────────────
LINE Messaging API    msw (network level)           HTTP境界でモック、実装の内部に依存しない
Gemini AI API         msw (network level)           レスポンス形式のスナップショットテスト
fetch (global)        msw setupServer               Node.js環境で統一的にインターセプト
ファイルシステム       vi.mock('fs/promises')         storage.ts のI/O分離
環境変数              vi.stubEnv()                   config.ts の条件分岐テスト
Date/setTimeout       vi.useFakeTimers()             retry.ts のタイミングテスト
```

**モック方針の原則:**
- 外部HTTP通信は msw でネットワークレベルでモックする (実装詳細への依存を避ける)
- ファイルI/Oは `vi.mock` で置換する
- 内部モジュール間のモックは最小限にとどめ、可能な限り実コードを通す

### 2.4 カバレッジ目標

| 対象 | ステートメント | ブランチ | 関数 |
|------|--------------|---------|------|
| `src/lib/line/*` | 90% | 85% | 95% |
| `src/components/**` | 80% | 75% | 90% |
| `src/types/**` | N/A (型定義のみ) | N/A | N/A |
| 全体 | 80% | 75% | 85% |

### 2.5 テストケース例: `retry.ts`

```typescript
// __tests__/lib/line/retry.test.ts
describe('withRetry', () => {
  it('成功時は1回だけ実行される', async () => { ... });
  it('リトライ可能なステータスで指定回数リトライする', async () => { ... });
  it('リトライ不可なステータスでは即座に例外をスローする', async () => { ... });
  it('指数バックオフで待機時間が増加する', async () => { ... });
  it('最大リトライ回数超過で最後のエラーをスローする', async () => { ... });
  it('onRetryコールバックがリトライごとに呼ばれる', async () => { ... });
});

describe('fetchWithHttpError', () => {
  it('200レスポンスをそのまま返す', async () => { ... });
  it('非OKレスポンスでHttpErrorをスローする', async () => { ... });
  it('HttpErrorにステータスとレスポンスボディが含まれる', async () => { ... });
});
```

---

## 3. 統合テスト設計

### 3.1 API Route テスト

Next.js の App Router API Route をテストするため、`next/test-utils` またはスーパーテスト相当のHTTPリクエストシミュレーションを行う。

| API Route | メソッド | テスト観点 |
|-----------|---------|-----------|
| `/api/line/webhook` | POST | 署名検証、イベント種別ごとの分岐、ユーザー記録の永続化 |
| `/api/line/broadcast` | POST | リクエストバリデーション、配信結果の返却、エラーハンドリング |
| `/api/line/push` | POST | 個別送信のバリデーション、ユーザーID検証 |
| `/api/line/followers` | GET | ページネーション、レスポンス形式 |
| `/api/line/schedule` | GET/POST | スケジュール設定の保存と取得 |
| `/api/line/scrape` | POST | スクレイピング実行、結果フォーマット |
| `/api/line/scrape-list` | GET | 記事一覧の取得 |
| `/api/line/scrape-detail` | GET | 記事詳細の取得 |
| `/api/line/history` | GET | 配信履歴のページネーション |
| `/api/line/logs` | GET | ログエントリの取得 |
| `/api/line/test-broadcast` | POST | テスト配信(実際のAPIは呼ばない) |
| `/api/line/debug` | GET | デバッグ情報の返却 |
| `/api/cron/line-broadcast` | POST | CRON_SECRET検証、自動配信フロー全体 |

### 3.2 外部API連携テスト

外部APIとの統合テストは、以下の2段階で実施する。

#### ステージ1: モック統合テスト (CI環境)

msw を使い、実際のAPIレスポンス形式を再現したモックサーバーで実行する。

```
テスト対象                検証内容
──────────────────────────────────────────────────────
LINE Messaging API       broadcast/push の正常・エラーレスポンス処理
                         レートリミット (429) 時のリトライ動作
                         認証エラー (401/403) の検出とアラート
Gemini AI API            要約生成のリクエスト形式
                         レスポンスパース (JSON抽出)
                         トークン制限超過時のフォールバック
ブログサイト              HTML構造変更への耐性テスト
                         タイムアウト、接続エラーのハンドリング
```

#### ステージ2: コントラクトテスト (定期実行)

実際の外部APIに対して最小限のリクエストを送り、レスポンス形式が変更されていないことを確認する。

| API | 実行頻度 | 検証内容 |
|-----|---------|----------|
| LINE Messaging API | 日次 | `/v2/bot/info` エンドポイントでトークン有効性とレスポンススキーマ |
| Gemini AI | 日次 | 最小プロンプトで `gemini-2.0-flash` のレスポンス形式 |
| ブログサイト | 日次 | トップページのHTML構造 (セレクタの存在確認) |

### 3.3 Supabase 連携テスト

> 注: 現在のコードベースではファイルベースのストレージ (`data/` ディレクトリ) を使用しているが、Supabase移行を見据えた設計とする。

| テスト対象 | 方法 | 検証内容 |
|-----------|------|----------|
| テーブルCRUD | Supabase ローカル (`supabase start`) | 配信履歴、ユーザー情報、スケジュールの読み書き |
| RLS (Row Level Security) | 認証済み/未認証クライアントで実行 | 管理者のみ書き込み可、認証なしでは読み取りも不可 |
| リアルタイム | WebSocket接続テスト | 配信ステータスの即時反映 |
| Edge Functions | Deno テストランナー | Supabase Edge Function 単体の動作 |
| マイグレーション | `supabase db reset` + テスト | スキーマ変更の後方互換性 |

**Supabase ローカル環境のセットアップ:**

```bash
# ローカルSupabase起動 (Docker必須)
npx supabase start

# テスト用シードデータ投入
npx supabase db reset --seed

# テスト実行
vitest run --project integration
```

---

## 4. E2Eテスト設計

### 4.1 ツール選定

| ツール | バージョン | 選定理由 |
|--------|----------|----------|
| **Playwright** | 最新安定版 | マルチブラウザ対応、Next.js公式推奨、Auto-waiting、トレース機能 |

### 4.2 主要ユーザーフローのテストシナリオ

#### フロー1: 記事スクレイピングから配信完了まで (クリティカルパス)

```
1. ダッシュボードにアクセス
2. 記事一覧をスクレイピング
3. 記事を選択
4. テンプレートを選択 (5種類から1つ)
5. Flex Messageをプレビュー
6. 配信を実行
7. 配信履歴に記録が追加されることを確認
```

#### フロー2: スケジュール配信設定

```
1. スケジュール設定画面を開く
2. 配信時刻を設定
3. テンプレートを選択
4. 有効化して保存
5. 設定が永続化されていることを確認 (リロード後)
```

#### フロー3: 配信履歴の閲覧

```
1. 配信履歴ページにアクセス
2. 履歴一覧が表示される
3. ページネーションの動作確認
4. 個別履歴の詳細表示
```

#### フロー4: フォロワー管理

```
1. フォロワー一覧を取得
2. フォロワー情報の表示確認
3. 個別プッシュ送信のフロー
```

#### フロー5: ダッシュボードナビゲーション

```
1. 各ページ間の遷移
2. レイアウトの一貫性
3. レスポンシブ表示 (モバイル/デスクトップ)
```

#### フロー6: プレビュー画面

```
1. /preview ページにアクセス
2. 各テンプレートのプレビュー描画
3. テンプレート切替時の再描画
```

### 4.3 Playwright設定方針

```typescript
// playwright.config.ts (方針)
{
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
}
```

### 4.4 E2Eテストにおける外部APIの扱い

E2Eテストでは、外部APIへの実リクエストを避けるため、以下の戦略を採用する。

| API | E2E時の扱い |
|-----|------------|
| LINE Messaging API | 環境変数で切替可能なモックエンドポイント (`NEXT_PUBLIC_API_MOCK=true`) |
| Gemini AI | 固定レスポンスを返すモックサーバー |
| ブログサイト | ローカルHTMLファイルを配信する軽量サーバー |

---

## 5. LINE特有のテスト

### 5.1 Flex Message 構造検証

LINE Flex Message は独自のJSON構造を持ち、構造の不備があると配信失敗やレイアウト崩れが発生する。

#### テスト項目

| # | テスト内容 | 検証方法 |
|---|----------|----------|
| L-01 | 5種類全テンプレートが有効なFlexContainer構造を生成する | JSON Schemaバリデーション |
| L-02 | `type: 'bubble'` がルートに存在する | 構造チェック |
| L-03 | `body.contents` 内の各コンポーネントが許可された型のみ | 型ガード関数でのバリデーション |
| L-04 | テキストフィールドの文字数上限 (LINE制限: テキスト2000文字) | 境界値テスト |
| L-05 | 画像URLが `https://` で始まる (LINE要件) | URL検証 |
| L-06 | altText が設定されている (Flex Message必須) | 存在チェック |
| L-07 | action URI がHTTPS、かつ有効な形式 | URL形式検証 |
| L-08 | サムネイルが null の場合のフォールバック表示 | null入力テスト |
| L-09 | 特殊文字 (絵文字、改行、HTML特殊文字) を含むテキストの処理 | 文字列入力テスト |
| L-10 | 極端に長いタイトル/本文での切り詰め処理 | 境界値テスト |

#### Flex Message スキーマ検証ユーティリティ

```typescript
// テスト用: Flex Message構造のバリデーション関数
function validateFlexContainer(container: unknown): ValidationResult {
  // LINE公式仕様に基づくスキーマ検証
  // - type: 'bubble' 必須
  // - body 内の contents 配列の各要素が許可された type を持つ
  // - 画像URLが https:// で始まる
  // - テキスト長が上限以内
}
```

### 5.2 Webhook テスト

LINE Webhook はシステムへのイベント入力であり、信頼性が最重要。

| # | テスト内容 | 種別 |
|---|----------|------|
| W-01 | 正しい署名 (`x-line-signature`) を持つリクエストが受理される | 正常系 |
| W-02 | 不正な署名のリクエストが 403 で拒否される | 異常系 |
| W-03 | 署名ヘッダーが欠落したリクエストが拒否される | 異常系 |
| W-04 | `follow` イベントでユーザーIDが保存される | イベント処理 |
| W-05 | `unfollow` イベントでユーザーが非アクティブ化される | イベント処理 |
| W-06 | `message` イベント (テキスト) でメッセージカウントが増加する | イベント処理 |
| W-07 | 空の `events` 配列 (Webhook URL検証) で 200 が返る | 正常系 |
| W-08 | 不明なイベントタイプがエラーなく無視される | 耐障害性 |
| W-09 | 大量のイベント (100件同時) の処理 | 負荷 |
| W-10 | 同一ユーザーの重複イベントが冪等に処理される | 冪等性 |

### 5.3 LIFF (LINE Front-end Framework) テスト

> LIFF統合が今後実装される場合に備えた設計。

| # | テスト内容 | 方法 |
|---|----------|------|
| F-01 | LIFF SDK初期化 (`liff.init()`) の成功/失敗ハンドリング | モックSDK |
| F-02 | LINEアプリ内ブラウザ vs 外部ブラウザの判定 (`liff.isInClient()`) | User-Agent モック |
| F-03 | ユーザープロフィール取得 (`liff.getProfile()`) | モックレスポンス |
| F-04 | メッセージ送信 (`liff.sendMessages()`) | モックSDK |
| F-05 | LIFF URLスキーム (`line://app/xxx`) の生成 | URL形式検証 |

**LIFFモック戦略:**

```typescript
// テスト用LIFFモック
const mockLiff = {
  init: vi.fn().mockResolvedValue(undefined),
  isInClient: vi.fn().mockReturnValue(true),
  getProfile: vi.fn().mockResolvedValue({
    userId: 'U_test_user',
    displayName: 'テストユーザー',
    pictureUrl: 'https://example.com/avatar.png',
  }),
  sendMessages: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn().mockReturnValue(true),
};
```

---

## 6. パフォーマンステスト

### 6.1 応答時間目標

| エンドポイント / 操作 | 目標 (p95) | 目標 (p99) | 最大許容 |
|---------------------|-----------|-----------|---------|
| ダッシュボードページ読み込み | 1.5秒 | 3秒 | 5秒 |
| 記事スクレイピング (5記事) | 5秒 | 8秒 | 15秒 |
| Gemini AI 要約生成 (1記事) | 3秒 | 5秒 | 10秒 |
| Flex Message 配信 (broadcast) | 2秒 | 4秒 | 8秒 |
| Webhook レスポンス | 200ms | 500ms | 1秒 |
| 配信履歴 API | 300ms | 800ms | 2秒 |
| フォロワー一覧 API | 500ms | 1秒 | 3秒 |

### 6.2 負荷テスト

#### ツール: k6

| シナリオ | 同時ユーザー | 持続時間 | 成功基準 |
|---------|------------|---------|---------|
| Webhook 受信 | 50 req/s | 5分 | エラー率 < 0.1%, p95 < 500ms |
| ダッシュボードアクセス | 20 同時 | 10分 | エラー率 < 1%, p95 < 2秒 |
| 配信API | 10 req/s | 3分 | エラー率 < 0.5% |
| CRON自動配信 | 1 (シングル) | 1回 | 全フロー 30秒以内に完了 |

#### k6 テストスクリプト方針

```javascript
// k6/webhook-load.js (方針)
export const options = {
  scenarios: {
    webhook_burst: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.001'],
  },
};
```

### 6.3 フロントエンド パフォーマンス

| 指標 | 目標 |
|------|------|
| Largest Contentful Paint (LCP) | < 2.5秒 |
| First Input Delay (FID) | < 100ms |
| Cumulative Layout Shift (CLS) | < 0.1 |
| Total Bundle Size (gzip) | < 200KB (First Load JS) |

**測定方法:** Lighthouse CI をCI/CDパイプラインに統合し、PRごとにスコアを記録する。

---

## 7. セキュリティテスト

### 7.1 ペネトレーションテスト項目

#### 認証・認可

| # | テスト項目 | リスク | 方法 |
|---|----------|--------|------|
| S-01 | API Route への未認証アクセス | 高 | 認証トークンなしで全API Routeにリクエスト |
| S-02 | CRON エンドポイントの `CRON_SECRET` バイパス | 高 | 不正なシークレット / ヘッダーなしでリクエスト |
| S-03 | LINE Webhook 署名検証のバイパス | 高 | 改ざんボディ + 再計算署名でリクエスト |
| S-04 | Supabase RLS のバイパス | 高 | 直接SQLクエリ / 匿名キーでのアクセス試行 |

#### インジェクション

| # | テスト項目 | リスク | 方法 |
|---|----------|--------|------|
| S-05 | XSS (Flex Message プレビュー) | 中 | `<script>alert(1)</script>` をタイトル/本文に注入 |
| S-06 | SQLインジェクション (Supabase クエリ) | 高 | パラメータ化クエリの確認、直接SQL文字列連結の検出 |
| S-07 | SSRF (スクレイピングURL) | 高 | `http://localhost`, `http://169.254.169.254` をURLに指定 |
| S-08 | コマンドインジェクション | 中 | ファイルパス操作への特殊文字注入 |

#### データ保護

| # | テスト項目 | リスク | 方法 |
|---|----------|--------|------|
| S-09 | 環境変数の漏洩 | 高 | APIレスポンス / クライアントバンドルにシークレットが含まれないこと |
| S-10 | `LINE_CHANNEL_ACCESS_TOKEN` のログ出力 | 高 | 全ログ出力にトークン文字列が含まれないことを検証 |
| S-11 | `/api/line/debug` エンドポイントの本番無効化 | 中 | 本番環境でアクセスし、機密情報が返されないこと |
| S-12 | HTTPSの強制 | 中 | HTTP でのアクセスがリダイレクトされること |

#### API セキュリティ

| # | テスト項目 | リスク | 方法 |
|---|----------|--------|------|
| S-13 | レートリミット | 中 | 短時間に大量リクエストを送信し制限確認 |
| S-14 | CORSポリシー | 中 | 異なるオリジンからのリクエスト検証 |
| S-15 | Content-Type 検証 | 低 | 不正な Content-Type でのリクエスト |
| S-16 | リクエストサイズ制限 | 中 | 巨大ペイロードの送信 |

### 7.2 自動セキュリティスキャン

| ツール | 対象 | 実行頻度 |
|--------|------|---------|
| `npm audit` | 依存パッケージの脆弱性 | 毎コミット |
| ESLint security plugin | コード内のセキュリティアンチパターン | 毎コミット |
| OWASP ZAP (Baseline Scan) | Webアプリケーション全体 | 週次 |
| Snyk / Dependabot | 依存関係の脆弱性 | 日次 (自動PR) |

---

## 8. テスト環境設計

### 8.1 環境一覧

```
┌─────────────┬────────────────────────────────────────────────────┐
│  環境名      │  用途                                              │
├─────────────┼────────────────────────────────────────────────────┤
│  ローカル    │  開発者のマシン上での開発・ユニットテスト              │
│  CI         │  GitHub Actions 上のユニット・統合テスト              │
│  ステージング │  Vercel Preview + Supabase staging プロジェクト      │
│  本番        │  Vercel Production + Supabase production プロジェクト │
└─────────────┴────────────────────────────────────────────────────┘
```

### 8.2 各環境の構成

#### ローカル開発環境

```
コンポーネント          構成
───────────────────────────────────────
Next.js              npm run dev (localhost:3000)
Supabase             supabase start (ローカルDocker)
LINE API             msw モックサーバー
Gemini API           msw モックサーバー
ブログサイト           ローカルHTMLファイル or msw
テストデータ           シードスクリプト (seed.ts)
```

#### CI環境 (GitHub Actions)

```
コンポーネント          構成
───────────────────────────────────────
Next.js              ビルド後のスタンドアロンサーバー
Supabase             supabase/setup-cli Action
外部API              msw (すべてモック)
環境変数              GitHub Secrets (テスト用のみ)
ブラウザ              Playwright Docker イメージ
```

#### ステージング環境

```
コンポーネント          構成
───────────────────────────────────────
ホスティング           Vercel Preview Deployments (PRごとに自動生成)
Supabase             staging プロジェクト (本番とは別)
LINE API             テスト用LINEチャネル (本番とは別)
Gemini API           本番APIキー (レート制限に注意)
ブログサイト           実サイト (読み取りのみ)
テストデータ           ステージング専用シードデータ
```

### 8.3 テストデータ管理

| データ種別 | 管理方法 |
|-----------|---------|
| 記事データ (スクレイピング結果) | `fixtures/articles/` にJSON形式で固定データを保持 |
| Flex Message テンプレート出力 | スナップショットテスト (`__snapshots__/`) |
| LINE APIレスポンス | `fixtures/line-api/` にサンプルレスポンスを保持 |
| Gemini APIレスポンス | `fixtures/gemini/` にサンプルレスポンスを保持 |
| Webhook イベント | `fixtures/webhook-events/` に各イベントタイプのサンプルを保持 |
| Supabase シードデータ | `supabase/seed.sql` |

### 8.4 環境変数の管理

```
ファイル                  用途                    Git管理
─────────────────────────────────────────────────────
.env.local              ローカル開発              .gitignore
.env.test               テスト実行用 (モック値)    リポジトリに含める
.env.staging            ステージング              Vercel環境変数
.env.production         本番                     Vercel環境変数
```

**`.env.test` の内容 (コミット可):**

```env
LINE_CHANNEL_ACCESS_TOKEN=test_token_dummy
GEMINI_API_KEY=test_gemini_key_dummy
ADMIN_LINE_USER_ID=U_test_admin
CRON_SECRET=test_cron_secret
NEXT_PUBLIC_API_MOCK=true
```

---

## 9. CI/CDパイプラインへのテスト統合

### 9.1 パイプライン全体像

```
PR作成/更新
  │
  ├─→ [ステージ1: 静的解析]  ─── 並列実行 ───────────────────
  │     ├── TypeScript 型チェック (tsc --noEmit)
  │     ├── ESLint
  │     └── npm audit
  │
  ├─→ [ステージ2: ユニットテスト]  ─── ステージ1完了後 ─────
  │     ├── Vitest 実行
  │     └── カバレッジレポート生成 → Codecov アップロード
  │
  ├─→ [ステージ3: 統合テスト]  ─── ステージ2完了後 ──────────
  │     ├── Supabase ローカル起動
  │     ├── API Route テスト
  │     └── 外部APIモック統合テスト
  │
  ├─→ [ステージ4: ビルド]  ─── ステージ3完了後 ──────────────
  │     └── next build (ビルドエラーの検出)
  │
  ├─→ [ステージ5: E2Eテスト]  ─── ステージ4完了後 ──────────
  │     ├── Playwright (Chromium + Mobile Chrome)
  │     └── テストレポート → Artifacts アップロード
  │
  └─→ [ステージ6: デプロイ]  ─── ステージ5完了後 ──────────
        └── Vercel Preview Deploy (自動)

マージ後 (main ブランチ)
  │
  └─→ Vercel Production Deploy
        └─→ [ポストデプロイ] スモークテスト (本番URLに対するヘルスチェック)

定期実行 (日次)
  ├── コントラクトテスト (外部APIスキーマ検証)
  ├── OWASP ZAP セキュリティスキャン
  └── Lighthouse CI パフォーマンス計測
```

### 9.2 GitHub Actions ワークフロー方針

```yaml
# .github/workflows/test.yml (方針)
name: Test Suite

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm audit --audit-level=high

  unit-test:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npx vitest run --coverage
      - uses: codecov/codecov-action@v4

  integration-test:
    needs: unit-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: npm ci
      - run: npx vitest run --project integration

  build:
    needs: integration-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run build

  e2e-test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### 9.3 テスト結果の通知

| イベント | 通知先 | 条件 |
|---------|--------|------|
| テスト失敗 | Slack / LINE (管理者) | any failure |
| カバレッジ低下 | PRコメント (Codecov) | -2% 以上の低下 |
| セキュリティ脆弱性 | Slack + GitHub Issue | critical / high |
| パフォーマンス劣化 | PRコメント (Lighthouse) | スコア -5 以上の低下 |

### 9.4 テスト実行時間の目標

| ステージ | 目標時間 | 最大許容 |
|---------|---------|---------|
| 静的解析 | 30秒 | 1分 |
| ユニットテスト | 1分 | 3分 |
| 統合テスト | 2分 | 5分 |
| ビルド | 1分 | 3分 |
| E2Eテスト | 3分 | 8分 |
| **合計** | **7.5分** | **20分** |

---

## 付録A: テストファイル構成 (推奨ディレクトリ構造)

```
linemag/
├── __tests__/                          # ユニット + 統合テスト
│   ├── lib/
│   │   └── line/
│   │       ├── config.test.ts
│   │       ├── messaging.test.ts
│   │       ├── retry.test.ts
│   │       ├── scraper.test.ts
│   │       ├── storage.test.ts
│   │       ├── summarizer.test.ts
│   │       ├── templates.test.ts
│   │       ├── followers.test.ts
│   │       ├── logger.test.ts
│   │       └── notifier.test.ts
│   ├── components/
│   │   └── line/
│   │       ├── FlexPreview.test.tsx
│   │       ├── ArticleCard.test.tsx
│   │       └── TemplateSelector.test.tsx
│   └── api/                            # 統合テスト
│       └── line/
│           ├── webhook.test.ts
│           ├── broadcast.test.ts
│           ├── push.test.ts
│           ├── schedule.test.ts
│           └── cron.test.ts
├── e2e/                                # E2Eテスト
│   ├── broadcast-flow.spec.ts
│   ├── schedule.spec.ts
│   ├── history.spec.ts
│   ├── dashboard-nav.spec.ts
│   └── preview.spec.ts
├── fixtures/                           # テストデータ
│   ├── articles/
│   ├── line-api/
│   ├── gemini/
│   └── webhook-events/
├── k6/                                 # 負荷テスト
│   ├── webhook-load.js
│   └── dashboard-load.js
├── vitest.config.ts
└── playwright.config.ts
```

## 付録B: 導入ロードマップ

| フェーズ | 期間 | 内容 |
|---------|------|------|
| Phase 1 | 1-2週目 | Vitest導入、Tier 1モジュールのユニットテスト作成、CI基盤構築 |
| Phase 2 | 3-4週目 | Tier 2モジュールのユニットテスト、API Route統合テスト |
| Phase 3 | 5-6週目 | Playwright E2Eテスト、コンポーネントテスト |
| Phase 4 | 7-8週目 | LINE特有テスト、セキュリティテスト、パフォーマンステスト |
| Phase 5 | 継続 | カバレッジ向上、コントラクトテスト定期実行、テストメンテナンス |
