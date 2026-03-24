# 19. インフラストラクチャ・デプロイメント仕様

| 項目 | 内容 |
|------|------|
| ドキュメントID | SPEC-019 |
| 対象システム | LineMag（LINE配信自動化システム） |
| 作成日 | 2026-03-24 |
| ステータス | Draft |

---

## 目次

1. [インフラ全体構成](#1-インフラ全体構成)
2. [Supabase プロジェクト設計](#2-supabase-プロジェクト設計)
3. [Vercel 設定最適化](#3-vercel-設定最適化)
4. [CI/CD パイプライン設計](#4-cicd-パイプライン設計)
5. [監視・アラート設計](#5-監視アラート設計)
6. [スケーラビリティ設計](#6-スケーラビリティ設計)
7. [コスト試算](#7-コスト試算)
8. [環境設計](#8-環境設計)

---

## 1. インフラ全体構成

### 1.1 構成概要図

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ユーザー / 管理者                             │
│                    (ブラウザ / LINE アプリ)                          │
└────────────┬──────────────────────────────┬─────────────────────────┘
             │ HTTPS                        │ LINE Webhook
             ▼                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Vercel (hnd1 / 東京)                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  Next.js App      │  │  API Routes      │  │  Vercel Cron    │  │
│  │  (SSR / ISR)      │  │  /api/line/*     │  │  日次 00:00 UTC │  │
│  │  管理ダッシュボード│  │  /api/cron/*     │  │  → line-broadcast│  │
│  └────────┬─────────┘  └───────┬──────────┘  └────────┬────────┘  │
│           │                    │                       │           │
│           │         ┌─────────┴───────────┐           │           │
│           │         │  Edge Middleware     │           │           │
│           │         │  (認証・レート制限)   │           │           │
│           │         └─────────┬───────────┘           │           │
└───────────┼─────────────────┬─┼───────────────────────┼───────────┘
            │                 │ │                        │
            ▼                 │ ▼                        ▼
┌───────────────────────────┐│┌──────────────────────────────────────┐
│   Supabase (東京リージョン)│││         外部 API                     │
│  ┌─────────────────────┐  │││  ┌──────────────┐ ┌──────────────┐  │
│  │  PostgreSQL         │  │││  │ LINE          │ │ Gemini API   │  │
│  │  - broadcast_history│  │││  │ Messaging API │ │ (要約生成)    │  │
│  │  - execution_logs   │  │││  │ (配信/Push)   │ │              │  │
│  │  - schedules        │  │││  └──────────────┘ └──────────────┘  │
│  │  - sent_urls        │  │││  ┌──────────────┐                   │
│  │  - error_tracking   │  │││  │ meetsc.co.jp │                   │
│  └─────────────────────┘  │││  │ (スクレイピング│                   │
│  ┌─────────────────────┐  │││  │  対象サイト)  │                   │
│  │  Auth (GoTrue)      │  │││  └──────────────┘                   │
│  │  - 管理者認証       │  ││└──────────────────────────────────────┘
│  └─────────────────────┘  ││
│  ┌─────────────────────┐  ││
│  │  Storage (S3互換)    │  ││
│  │  - 画像キャッシュ    │  ││
│  └─────────────────────┘  ││
│  ┌─────────────────────┐  ││
│  │  Edge Functions     │  ││
│  │  - Webhook処理      │  ││
│  └─────────────────────┘  ││
│  ┌─────────────────────┐  ││
│  │  Realtime           │  ││
│  │  - ログライブ表示    │  ││
│  └─────────────────────┘  ││
└───────────────────────────┘│
                             │
┌────────────────────────────┴───────────────────────────────────────┐
│                    GitHub (ソースコード管理)                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  GitHub Actions                                             │  │
│  │  - CI: lint / type-check / build / test                     │  │
│  │  - CD: Vercel 自動デプロイ (プレビュー / 本番)               │  │
│  │  - DB Migration: Supabase CLI                               │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 データフロー

```
[Vercel Cron 00:00 UTC]
    │
    ▼
[API Route: /api/cron/line-broadcast]
    │
    ├─→ [meetsc.co.jp スクレイピング] ─→ 記事取得
    │
    ├─→ [Supabase PostgreSQL] ─→ 送信済みURL確認
    │
    ├─→ [Gemini API] ─→ 記事要約生成
    │
    ├─→ [LINE Messaging API] ─→ ブロードキャスト配信
    │
    └─→ [Supabase PostgreSQL] ─→ 配信履歴・ログ保存
                                    │
                                    ▼
                              [Supabase Realtime]
                                    │
                                    ▼
                              [管理ダッシュボード リアルタイム更新]
```

### 1.3 ネットワーク構成

| 通信経路 | プロトコル | レイテンシ目標 | 備考 |
|----------|-----------|--------------|------|
| ユーザー → Vercel | HTTPS/TLS 1.3 | < 100ms | Vercel Edge Network (CDN) |
| Vercel → Supabase | HTTPS | < 10ms | 同一リージョン (東京) |
| Vercel → LINE API | HTTPS | < 200ms | LINE サーバー (日本) |
| Vercel → Gemini API | HTTPS | < 2000ms | Google Cloud (リージョン自動) |
| Vercel → meetsc.co.jp | HTTPS | < 1000ms | スクレイピング対象 |

---

## 2. Supabase プロジェクト設計

### 2.1 リージョン選定

| 項目 | 選定 | 理由 |
|------|------|------|
| リージョン | `ap-northeast-1` (東京) | Vercel hnd1 と同一リージョン。レイテンシ最小化。LINE API サーバーとも近接 |
| 代替リージョン | `ap-southeast-1` (シンガポール) | 東京リージョン障害時のフェイルオーバー先候補 |

### 2.2 プラン選定

| フェーズ | プラン | 月額 | 理由 |
|---------|--------|------|------|
| 開発〜初期運用 | Free | $0 | DB 500MB、Auth 50,000 MAU、Storage 1GB で十分 |
| 本番安定運用 | Pro | $25/月 | DB 8GB、日次バックアップ、メール通知対応 |
| スケール時 | Pro + Add-on | $25+α | Compute Add-on、PITR バックアップ追加 |

### 2.3 プラン移行判断基準

以下のいずれかに該当した場合、Pro プランへ移行する:

- データベースサイズが 400MB を超過
- API リクエストが 500,000回/月 を超過
- 同時接続数が安定的に 50 を超過
- 本番環境でのサービスレベル保証が必要になった場合

### 2.4 Supabase サービス利用設計

| サービス | 用途 | 設定 |
|---------|------|------|
| PostgreSQL | 配信履歴、実行ログ、スケジュール、送信済みURL、エラー追跡 | RLS 有効、Connection Pooling (Transaction Mode) |
| Auth (GoTrue) | 管理ダッシュボードの認証 | Email/Password、マジックリンク |
| Storage | スクレイピングした画像のキャッシュ | バケット `article-thumbnails`、Public アクセス可 |
| Edge Functions | LINE Webhook 受信処理（低レイテンシ要件） | Deno Runtime |
| Realtime | 管理ダッシュボードでのログ・ステータスのリアルタイム表示 | Broadcast チャネル |

### 2.5 データベース接続設計

```
接続方式:
  ┌─────────────────────┐
  │  Vercel Serverless   │ ──→ Supabase Connection Pooler (Transaction Mode)
  │  Functions           │     Port: 6543
  └─────────────────────┘     プール接続数: Free=15 / Pro=50

  ┌─────────────────────┐
  │  Supabase Edge       │ ──→ Supabase Client SDK (REST API)
  │  Functions           │     自動接続管理
  └─────────────────────┘

  ┌─────────────────────┐
  │  マイグレーション     │ ──→ Direct Connection (Session Mode)
  │  (CI/CD)             │     Port: 5432
  └─────────────────────┘
```

**接続プーリング設定:**

| パラメータ | 値 | 備考 |
|-----------|-----|------|
| Mode | Transaction | サーバーレス環境に最適 |
| Pool Size | 15 (Free) / 50 (Pro) | プランに応じた上限 |
| Connection Timeout | 10s | タイムアウト |
| Idle Timeout | 30s | アイドル接続の解放 |

### 2.6 Row Level Security (RLS) ポリシー

```sql
-- 基本方針: 全テーブルで RLS を有効化
-- service_role キーは Vercel サーバーサイドのみで使用

-- broadcast_history: サービスロールのみ書き込み可、認証済みユーザーは読み取り可
ALTER TABLE broadcast_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_insert" ON broadcast_history
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "authenticated_read" ON broadcast_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- execution_logs: 同上
-- schedules: 認証済みユーザーは読み書き可
-- sent_urls: サービスロールのみ
```

---

## 3. Vercel 設定最適化

### 3.1 現行設定 (vercel.json)

現行の `vercel.json` で定義済みの設定:

- **リージョン:** `hnd1` (東京)
- **Cron:** `0 0 * * *` (日次 UTC 00:00 = JST 09:00)
- **Function Duration:** 最大 120秒 (`/api/cron/line-broadcast`)

### 3.2 最適化項目

#### 3.2.1 ISR (Incremental Static Regeneration) 設定

| ページ | ISR 戦略 | revalidate | 備考 |
|-------|---------|-----------|------|
| `/` (管理ダッシュボード) | SSR | なし | 常に最新データ |
| `/api/*` | Dynamic | なし | API は常にサーバーサイド実行 |
| 将来的な公開ページ | ISR | 3600s (1時間) | 静的コンテンツのキャッシュ |

#### 3.2.2 Edge Middleware 設計

```typescript
// middleware.ts
// 適用対象: /api/line/*, 管理ダッシュボードページ
export const config = {
  matcher: ['/api/line/:path*', '/dashboard/:path*'],
};
```

| 機能 | 実装方式 | 詳細 |
|------|---------|------|
| API 認証チェック | Edge Middleware | CRON_SECRET / Supabase JWT 検証 |
| レート制限 | Edge Middleware | IP ベース、60 req/min |
| CORS | Edge Middleware | 許可オリジン制限 |
| リダイレクト | Edge Middleware | 未認証 → ログインページ |

#### 3.2.3 Serverless Function 最適化

| 項目 | 設定値 | 備考 |
|------|--------|------|
| Node.js Runtime | 20.x | LTS |
| メモリ | 1024MB (デフォルト) | Cron 処理は十分 |
| Max Duration | 120s (Cron), 60s (Scrape), 30s (その他) | 現行維持 |
| リージョン | hnd1 | 東京固定 |
| Bundler | esbuild (Next.js デフォルト) | Tree-shaking 有効 |

#### 3.2.4 環境変数管理

**変数分類と管理方針:**

| 変数名 | スコープ | 種別 | 保管場所 |
|--------|---------|------|---------|
| `GEMINI_API_KEY` | Server only | Secret | Vercel Environment Variables (Encrypted) |
| `LINE_CHANNEL_ACCESS_TOKEN` | Server only | Secret | Vercel Environment Variables (Encrypted) |
| `CRON_SECRET` | Server only | Secret | Vercel Environment Variables (Encrypted) |
| `ADMIN_LINE_USER_ID` | Server only | Config | Vercel Environment Variables |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Config | Vercel Environment Variables |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Config | Vercel Environment Variables |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Secret | Vercel Environment Variables (Encrypted) |
| `SUPABASE_DB_URL` | Server only | Secret | Vercel Environment Variables (Encrypted) |

**環境変数のスコープ:**

```
Production  : 本番用の実キー
Preview     : ステージング用 Supabase プロジェクトのキー
Development : ローカル開発用 (.env.local、Git 管理外)
```

> **重要:** `NEXT_PUBLIC_` プレフィックスのない変数はクライアントバンドルに含まれない。Supabase の `service_role` キーは絶対にクライアントに露出させないこと。

### 3.3 vercel.json 最適化案

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["hnd1"],
  "functions": {
    "src/app/api/cron/line-broadcast/route.ts": {
      "maxDuration": 120,
      "memory": 1024
    },
    "src/app/api/line/scrape/route.ts": {
      "maxDuration": 60
    },
    "src/app/api/line/scrape-detail/route.ts": {
      "maxDuration": 45
    },
    "src/app/api/line/broadcast/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/line/push/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/line/scrape-list/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/line/followers/route.ts": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/cron/line-broadcast",
      "schedule": "0 0 * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

---

## 4. CI/CD パイプライン設計

### 4.1 パイプライン全体フロー

```
[Developer] ─push─→ [GitHub]
                        │
                ┌───────┴────────┐
                ▼                ▼
        [Feature Branch]    [main Branch]
                │                │
                ▼                ▼
        ┌──────────────┐  ┌──────────────┐
        │ GitHub Actions│  │ GitHub Actions│
        │ CI Pipeline   │  │ CI Pipeline   │
        │ - lint        │  │ - lint        │
        │ - type-check  │  │ - type-check  │
        │ - build       │  │ - build       │
        │ - test (将来) │  │ - test (将来) │
        └──────┬───────┘  └──────┬───────┘
               │                 │
               ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │ Vercel        │  │ Vercel        │
        │ Preview Deploy│  │ Production    │
        │ (自動)        │  │ Deploy (自動) │
        └──────┬───────┘  └──────┬───────┘
               │                 │
               ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │ Staging       │  │ Production    │
        │ Supabase      │  │ Supabase      │
        │ (プレビュー用)│  │ (本番用)      │
        └──────────────┘  └──────────────┘
```

### 4.2 GitHub Actions ワークフロー設計

#### 4.2.1 CI ワークフロー（既存の拡張）

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run build
        env:
          GEMINI_API_KEY: dummy-key-for-build
          LINE_CHANNEL_ACCESS_TOKEN: dummy-token-for-build
          CRON_SECRET: dummy-secret-for-build
          NEXT_PUBLIC_SUPABASE_URL: https://dummy.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key-for-build

  # 将来追加予定
  # test:
  #   runs-on: ubuntu-latest
  #   steps:
  #     - uses: actions/checkout@v4
  #     - uses: actions/setup-node@v4
  #       with:
  #         node-version: 20
  #         cache: 'npm'
  #     - run: npm ci
  #     - run: npm test
```

#### 4.2.2 DB マイグレーション ワークフロー（新規）

```yaml
# .github/workflows/db-migration.yml
name: Database Migration

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  migrate-production:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### 4.3 Vercel デプロイ設定

| トリガー | デプロイ先 | 環境 | 自動/手動 |
|---------|----------|------|---------|
| PR 作成/更新 | Preview | staging Supabase | 自動 |
| `main` ブランチ push | Production | production Supabase | 自動 |
| 手動トリガー | Production | production Supabase | 手動 (Vercel Dashboard) |

### 4.4 デプロイ前チェックリスト

```
□ CI (lint, type-check, build) が全て成功していること
□ DB マイグレーションが staging で検証済みであること
□ 環境変数の追加・変更がある場合、Vercel Dashboard で設定済みであること
□ 破壊的変更がある場合、ロールバック手順が文書化されていること
```

### 4.5 ロールバック手順

| 対象 | 方法 | 所要時間 |
|------|------|---------|
| Vercel デプロイ | Vercel Dashboard → 前回デプロイを Promote | < 1分 |
| DB マイグレーション | `supabase db reset` + 手動リストア (PITR) | 5〜15分 |
| 環境変数 | Vercel Dashboard で即時変更 | < 1分 |

---

## 5. 監視・アラート設計

### 5.1 監視レイヤー構成

```
┌──────────────────────────────────────────────────────────────────┐
│                    監視・アラートレイヤー                         │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Vercel          │  │ Supabase         │  │ 外部監視       │  │
│  │ Analytics       │  │ Dashboard        │  │ (UptimeRobot) │  │
│  │ + Speed Insights│  │ + Logs Explorer  │  │               │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                    │                     │          │
│           └────────────┬───────┘─────────────────────┘          │
│                        ▼                                        │
│              ┌─────────────────┐                                │
│              │  アラート通知    │                                │
│              │  - LINE通知     │                                │
│              │  - Email通知    │                                │
│              └─────────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Vercel 監視

| 機能 | 利用プラン | 監視対象 |
|------|----------|---------|
| Vercel Analytics | Pro 付属 | ページビュー、Web Vitals (LCP, FID, CLS) |
| Speed Insights | Pro 付属 | レスポンスタイム、TTFB |
| Function Logs | 全プラン | Serverless Function の実行ログ |
| Deployment Checks | 全プラン | デプロイ成否 |
| Cron Monitoring | Pro 付属 | Cron ジョブの実行状況・成否 |

### 5.3 Supabase 監視

| 機能 | 監視対象 | 閾値 |
|------|---------|------|
| Database Health | CPU使用率、メモリ、ディスク | CPU > 80%、ディスク > 80% |
| Logs Explorer | PostgreSQL ログ、Auth ログ、API ログ | エラー率 > 5% |
| Realtime Inspector | WebSocket 接続数 | 接続数 > 100 |
| API レポート | リクエスト数、レスポンスタイム | p95 > 500ms |

### 5.4 外部監視（UptimeRobot）

| 監視対象 | チェック間隔 | 方法 | アラート条件 |
|---------|------------|------|------------|
| 管理ダッシュボード | 5分 | HTTPS GET `/` | ステータス != 200 |
| Cron エンドポイント | 5分 | HTTPS GET `/api/cron/line-broadcast` | 応答なし (タイムアウト30秒) |
| Supabase REST API | 5分 | HTTPS GET `/rest/v1/` | ステータス != 200 |

**費用:** UptimeRobot Free プラン (50 モニター、5分間隔) で十分対応可能。

### 5.5 アラート設計

| アラートレベル | 条件 | 通知先 | 通知手段 |
|--------------|------|--------|---------|
| CRITICAL | サービスダウン (5分以上応答なし) | 管理者 | LINE Push + Email |
| CRITICAL | Cron ジョブ 3回連続失敗 | 管理者 | LINE Push (既存 notifier) |
| WARNING | LINE 認証エラー (E-07) | 管理者 | LINE Push (既存 notifier) |
| WARNING | DB 接続エラー | 管理者 | Email (Supabase通知) |
| INFO | デプロイ完了 | 管理者 | Vercel Slack Integration / Email |

### 5.6 アプリケーションレベル監視（既存機能）

現行の `src/lib/line/notifier.ts` による内蔵監視:

- 連続エラー検知 (`consecutiveErrors >= 3`)
- LINE 認証エラー検知 (`E-07`)
- 実行ログの自動記録 (`src/lib/line/logger.ts`)

移行後は `storage.ts` のファイルベース保存を Supabase PostgreSQL に置き換え、Realtime を活用して管理ダッシュボードでリアルタイム表示する。

---

## 6. スケーラビリティ設計

### 6.1 現行のボトルネック分析

| ボトルネック | 影響 | 深刻度 |
|------------|------|--------|
| ファイルベースストレージ | Vercel Serverless はファイルシステムが一時的。デプロイ時にデータ消失 | 高 |
| 単一 Cron ジョブ | 配信量増加時にタイムアウト (120秒制限) | 中 |
| 同期的な記事処理 | 記事数増加時に処理時間が線形増加 | 中 |

### 6.2 Supabase 移行によるスケーラビリティ改善

| 改善項目 | Before (ファイルベース) | After (Supabase) |
|---------|----------------------|------------------|
| データ永続性 | デプロイ毎にリセットリスク | PostgreSQL で永続化 |
| 同時アクセス | ファイルロック競合 | 接続プール + トランザクション |
| クエリ性能 | 全件読み込み + フィルター | SQL インデックス + WHERE 句 |
| データ容量 | ディスク容量制限 | Free: 500MB / Pro: 8GB |

### 6.3 配信量増加への対応設計

#### フェーズ 1: 現行規模 (友だち数 〜1,000人)

```
配信方式: broadcast API (単一リクエスト)
想定配信数: 1〜3記事/日
処理時間: < 30秒
```

#### フェーズ 2: 中規模 (友だち数 1,000〜10,000人)

```
配信方式: broadcast API (単一リクエスト、LINE側で分割)
想定配信数: 3〜5記事/日
処理時間: < 60秒
追加対策:
  - バッチサイズの最適化
  - 記事間の待機時間を動的調整
```

#### フェーズ 3: 大規模 (友だち数 10,000人〜)

```
配信方式: narrowcast / audience 配信
想定配信数: 5〜10記事/日
処理時間: Cron 1回あたり < 120秒、複数回実行
追加対策:
  - Cron スケジュールの複数時間帯化 (09:00, 12:00, 18:00)
  - Supabase Edge Functions でのバックグラウンド処理
  - キュー方式の導入 (Supabase Edge Functions + pg_cron)
```

### 6.4 同時接続設計

| 接続元 | 最大同時接続数 | 接続方式 |
|--------|-------------|---------|
| Vercel Serverless Functions | 15 (Free) / 50 (Pro) | Connection Pooler (Transaction mode) |
| 管理ダッシュボード (Realtime) | 10 | WebSocket (Supabase Realtime) |
| Supabase Edge Functions | 内部接続 | Supabase Client SDK |
| CI/CD マイグレーション | 1 | Direct Connection |

### 6.5 キャッシュ戦略

| 対象 | キャッシュ層 | TTL | 無効化 |
|------|------------|-----|--------|
| 管理ダッシュボード (静的アセット) | Vercel CDN | 永続 (immutable) | デプロイ時自動 |
| API レスポンス (履歴取得等) | `stale-while-revalidate` | 60s | データ更新時 |
| サムネイル画像 | Supabase Storage CDN | 86400s (24時間) | 手動 |
| スクレイピング結果 | Supabase PostgreSQL | Cron 実行間隔 (24時間) | 次回 Cron 実行時 |

---

## 7. コスト試算

### 7.1 月間コスト概算（初期運用フェーズ）

| サービス | プラン | 月額 (USD) | 月額 (JPY概算) | 備考 |
|---------|--------|-----------|---------------|------|
| Vercel | Pro | $20 | 約 3,000円 | 1メンバー |
| Supabase | Free | $0 | 0円 | 500MB DB, 50K MAU |
| LINE Messaging API | Free | $0 | 0円 | 月200通まで無料 |
| Gemini API | Free Tier | $0 | 0円 | 1,500 req/day 無料枠 |
| UptimeRobot | Free | $0 | 0円 | 50モニターまで |
| **合計** | | **$20** | **約 3,000円** | |

### 7.2 月間コスト概算（本番安定運用フェーズ）

| サービス | プラン | 月額 (USD) | 月額 (JPY概算) | 備考 |
|---------|--------|-----------|---------------|------|
| Vercel | Pro | $20 | 約 3,000円 | 1メンバー |
| Supabase | Pro | $25 | 約 3,750円 | 8GB DB, バックアップ |
| LINE Messaging API | ライトプラン | 5,000円 | 5,000円 | 月5,000通まで |
| Gemini API | Pay-as-you-go | $1〜5 | 約 150〜750円 | 月100〜500リクエスト |
| UptimeRobot | Free | $0 | 0円 | |
| ドメイン (任意) | - | $10〜15/年 | 約 125円/月 | カスタムドメイン |
| **合計** | | | **約 12,000〜13,000円** | |

### 7.3 月間コスト概算（スケールフェーズ）

| サービス | プラン | 月額 (JPY概算) | 備考 |
|---------|--------|---------------|------|
| Vercel | Pro | 約 3,000円 | |
| Supabase | Pro + Compute Add-on | 約 5,000〜10,000円 | Small Compute |
| LINE Messaging API | スタンダードプラン | 15,000円 | 月30,000通まで |
| Gemini API | Pay-as-you-go | 約 750〜1,500円 | |
| **合計** | | **約 24,000〜30,000円** | |

### 7.4 LINE Messaging API 料金体系

| プラン | 月額 | 無料メッセージ通数 | 追加メッセージ |
|-------|------|-----------------|--------------|
| コミュニケーションプラン | 0円 | 200通/月 | 不可 |
| ライトプラン | 5,000円 | 5,000通/月 | 不可 |
| スタンダードプラン | 15,000円 | 30,000通/月 | 〜3円/通 |

> **注意:** ブロードキャスト配信の場合、「メッセージ通数 = 配信先友だち数 x 配信回数」で計算される。友だち数 100人に日次1回配信で月間約 3,000通。

### 7.5 コスト最適化方針

1. **Supabase Free → Pro 移行は段階的に:** 実際の使用量を監視し、Free プランの制限に近づいた時点で移行
2. **LINE 無料枠の最大活用:** 友だち数が少ない初期は配信頻度を抑え、コミュニケーションプラン (200通) で運用
3. **Gemini API 無料枠の活用:** 日次配信 1〜3 記事であれば無料枠内で収まる
4. **Vercel Pro は必須:** Cron ジョブ、Function Duration 拡張、Analytics のために Pro プランが推奨

---

## 8. 環境設計

### 8.1 環境一覧

| 環境 | 用途 | URL | Supabase プロジェクト | Vercel 環境 |
|------|------|-----|---------------------|-------------|
| Development | ローカル開発 | `http://localhost:3000` | ローカル (supabase start) | - |
| Staging | プレビュー・統合テスト | `https://<branch>.linemag.vercel.app` | staging プロジェクト | Preview |
| Production | 本番運用 | `https://linemag.vercel.app` | production プロジェクト | Production |

### 8.2 環境別構成

#### Development（ローカル開発）

```
ツール:
  - Next.js dev server (next dev)
  - Supabase CLI (supabase start) → ローカル PostgreSQL + Auth + Storage
  - Supabase Studio (http://localhost:54323) → ローカル DB 管理

環境変数:
  - .env.local (Git 管理外)
  - NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
  - NEXT_PUBLIC_SUPABASE_ANON_KEY=<ローカル anon key>
  - SUPABASE_SERVICE_ROLE_KEY=<ローカル service_role key>
  - GEMINI_API_KEY=<開発用キー>
  - LINE_CHANNEL_ACCESS_TOKEN=<テスト用トークン>

特徴:
  - ホットリロード対応
  - Supabase ローカル DB でデータ永続化 (Docker)
  - LINE 配信はテストユーザーへの Push のみ
  - シードデータで初期データ投入可能
```

#### Staging（プレビュー環境）

```
インフラ:
  - Vercel Preview Deployment (PR ごとに自動生成)
  - Supabase staging プロジェクト (東京リージョン、Free プラン)

環境変数:
  - Vercel Dashboard > Environment Variables > Preview
  - staging 用 Supabase プロジェクトのキー

特徴:
  - PR 作成時に自動デプロイ
  - 本番と同一の Supabase スキーマ (マイグレーション適用)
  - LINE 配信はテストユーザーのみ (ADMIN_LINE_USER_ID)
  - Cron ジョブは無効化 (staging では手動実行のみ)
  - PR に Vercel Bot がプレビュー URL をコメント
```

#### Production（本番環境）

```
インフラ:
  - Vercel Production Deployment (main ブランチ)
  - Supabase production プロジェクト (東京リージョン、Free → Pro)

環境変数:
  - Vercel Dashboard > Environment Variables > Production
  - production 用 Supabase プロジェクトのキー

特徴:
  - main ブランチへのマージで自動デプロイ
  - Cron ジョブが有効 (日次 UTC 00:00)
  - 全フォロワーへのブロードキャスト配信
  - 監視・アラートが全て有効
  - 日次バックアップ (Supabase Pro)
```

### 8.3 環境間のデータ分離

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Development │   │  Staging    │   │ Production  │
│             │   │             │   │             │
│ Local DB    │   │ Supabase    │   │ Supabase    │
│ (Docker)    │   │ staging     │   │ production  │
│             │   │ project     │   │ project     │
│ ─ シード    │   │ ─ テスト    │   │ ─ 本番      │
│   データ    │   │   データ    │   │   データ    │
│             │   │             │   │             │
│ LINE:       │   │ LINE:       │   │ LINE:       │
│ テストBot   │   │ テストBot   │   │ 本番Bot     │
│ (同一 or別) │   │ (同一Bot)   │   │             │
└─────────────┘   └─────────────┘   └─────────────┘

※ Staging と Production は完全に別の Supabase プロジェクト
※ LINE Bot は可能であれば staging 用と production 用を分離
```

### 8.4 マイグレーション管理

```
supabase/
├── migrations/
│   ├── 20260324000000_create_sent_urls.sql
│   ├── 20260324000001_create_broadcast_history.sql
│   ├── 20260324000002_create_execution_logs.sql
│   ├── 20260324000003_create_schedules.sql
│   ├── 20260324000004_create_error_tracking.sql
│   └── 20260324000005_create_rls_policies.sql
├── seed.sql              # 開発用シードデータ
└── config.toml           # Supabase CLI 設定
```

**マイグレーション運用ルール:**

1. マイグレーションファイルは一度マージしたら変更しない（新しいマイグレーションで修正）
2. `supabase db diff` で差分を生成し、手動で確認後にコミット
3. staging で検証してから production に適用
4. 破壊的変更 (カラム削除等) は 2 ステップで実施（deprecated → 削除）

### 8.5 シークレット管理フロー

```
┌──────────────────────────────────────────────────────────────┐
│                  シークレット管理                              │
│                                                              │
│  [開発者ローカル]                                             │
│    .env.local (Git管理外、.gitignore に記載)                  │
│                                                              │
│  [CI/CD]                                                     │
│    GitHub Secrets                                            │
│    ├── SUPABASE_ACCESS_TOKEN                                 │
│    ├── SUPABASE_PROJECT_REF                                  │
│    └── (ビルド用ダミー値は ci.yml にハードコード)              │
│                                                              │
│  [Vercel]                                                    │
│    Vercel Environment Variables (暗号化保存)                  │
│    ├── Production 用キー                                     │
│    ├── Preview 用キー                                        │
│    └── スコープ: Production / Preview / Development          │
│                                                              │
│  [Supabase]                                                  │
│    Supabase Dashboard → Settings → API                      │
│    ├── anon key (公開可)                                     │
│    ├── service_role key (サーバーサイドのみ)                  │
│    └── DB connection string (サーバーサイドのみ)              │
└──────────────────────────────────────────────────────────────┘
```

### 8.6 .gitignore 追加項目

```gitignore
# Supabase
supabase/.temp/
supabase/.branches/

# Environment
.env
.env.local
.env.*.local

# Data (移行前の旧ファイルベースデータ)
data/
```

---

## 付録

### A. 移行チェックリスト（ファイルベース → Supabase）

```
Phase 1: Supabase セットアップ
  □ Supabase プロジェクト作成 (production + staging)
  □ マイグレーションファイル作成・適用
  □ RLS ポリシー設定
  □ Connection Pooler 設定確認

Phase 2: コード移行
  □ storage.ts を Supabase クライアントに置き換え
  □ 環境変数を Vercel に設定
  □ ローカル開発環境で動作確認

Phase 3: データ移行
  □ 既存 JSON データを PostgreSQL にインポート
  □ データ整合性チェック

Phase 4: 本番切り替え
  □ staging で E2E 動作確認
  □ production デプロイ
  □ Cron ジョブの動作確認
  □ 旧ファイルベースコードの削除
```

### B. 障害対応フロー

| 障害種別 | 検知方法 | 一次対応 | 二次対応 |
|---------|---------|---------|---------|
| Vercel ダウン | UptimeRobot アラート | Vercel Status 確認 | 復旧待ち (SLA 99.99%) |
| Supabase ダウン | UptimeRobot アラート | Supabase Status 確認 | 復旧待ち / 一時的にファイルベースフォールバック |
| Cron 失敗 | LINE通知 (notifier) | ログ確認、手動実行 | 原因調査・修正デプロイ |
| LINE API エラー | LINE通知 (E-07) | トークン確認・再発行 | LINE Developer Console 確認 |
| DB 接続エラー | Supabase ログ | 接続数確認 | Connection Pooler 設定見直し |
