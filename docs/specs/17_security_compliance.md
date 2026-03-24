# 17. セキュリティ・コンプライアンス要件仕様書

| 項目 | 内容 |
|---|---|
| ドキュメントID | SPEC-017 |
| 対象システム | LineMag（LINE公式アカウント連携 CRM・EC・予約統合プラットフォーム） |
| 技術スタック | Next.js 14 / Supabase / Vercel / LINE Messaging API |
| 作成日 | 2026-03-24 |
| ステータス | Draft |

---

## 目次

1. [セキュリティ要件一覧（OWASP Top 10 対応）](#1-セキュリティ要件一覧owasp-top-10-対応)
2. [個人情報保護法対応](#2-個人情報保護法対応)
3. [LINE プラットフォームポリシー遵守事項](#3-line-プラットフォームポリシー遵守事項)
4. [データ分類（機密度レベル定義）](#4-データ分類機密度レベル定義)
5. [アクセスログ・監査ログ設計](#5-アクセスログ監査ログ設計)
6. [インシデント対応フロー](#6-インシデント対応フロー)
7. [脆弱性管理](#7-脆弱性管理)
8. [バックアップ・災害復旧計画](#8-バックアップ災害復旧計画)
9. [Supabase セキュリティ設定チェックリスト](#9-supabase-セキュリティ設定チェックリスト)

---

## 1. セキュリティ要件一覧（OWASP Top 10 対応）

OWASP Top 10 (2021) の各カテゴリに対し、LineMag で講じる対策を定義する。

### 1.1 A01: アクセス制御の不備 (Broken Access Control)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A01-01 | Supabase RLS（Row Level Security）を全テーブルに適用し、テナント間・ユーザー間のデータ分離を保証する | RLS ポリシーで `auth.uid()` および `tenant_id` を検証 | 必須 |
| SEC-A01-02 | API Route（Next.js App Router）で認証・認可チェックを middleware レベルで実施する | `middleware.ts` で Supabase セッショントークンを検証し、未認証リクエストを拒否 | 必須 |
| SEC-A01-03 | 管理者・スタッフ・閲覧者のロールベースアクセス制御（RBAC）を実装する | `user_roles` テーブルと RLS ポリシーの組み合わせ | 必須 |
| SEC-A01-04 | Server Actions / API Route でリソースの所有者チェックを必ず行う | パスパラメータの ID だけでなく、セッションユーザーの所属テナントを突合 | 必須 |
| SEC-A01-05 | CORS 設定を本番ドメインのみに制限する | `next.config.js` の `headers()` および Supabase ダッシュボードで設定 | 必須 |

### 1.2 A02: 暗号化の失敗 (Cryptographic Failures)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A02-01 | 通信を全経路で TLS 1.2 以上に限定する | Vercel はデフォルトで HTTPS を強制。Supabase 接続も SSL 必須 | 必須 |
| SEC-A02-02 | 保存時暗号化（Encryption at Rest）を有効にする | Supabase（PostgreSQL）のストレージ暗号化をデフォルト有効で運用 | 必須 |
| SEC-A02-03 | LINE チャネルシークレット・アクセストークンを環境変数で管理し、コードに含めない | Vercel Environment Variables（Production / Preview / Development を分離） | 必須 |
| SEC-A02-04 | パスワードハッシュに bcrypt（コストファクター 10 以上）を使用する | Supabase Auth がデフォルトで bcrypt を使用 | 必須 |
| SEC-A02-05 | 機密カラム（電話番号等）は pgcrypto でアプリケーションレベル暗号化を検討する | `pgp_sym_encrypt` / `pgp_sym_decrypt` の利用 | 推奨 |

### 1.3 A03: インジェクション (Injection)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A03-01 | SQL インジェクション防止のため、Supabase クライアント（パラメータ化クエリ）のみを使用する | `supabase.from().select()` 等の API を利用。生 SQL を禁止 | 必須 |
| SEC-A03-02 | XSS 防止のため、ユーザー入力を必ずサニタイズする | React の自動エスケープを活用。`dangerouslySetInnerHTML` の使用を原則禁止 | 必須 |
| SEC-A03-03 | Server Actions の入力値を zod スキーマでバリデーションする | 全 Server Action の先頭で `z.object({...}).parse(input)` を実行 | 必須 |
| SEC-A03-04 | LINE Webhook ペイロードの署名検証を行う | `X-Line-Signature` ヘッダーを HMAC-SHA256 で検証 | 必須 |

### 1.4 A04: 安全でない設計 (Insecure Design)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A04-01 | 脅威モデリングを機能追加時に実施する | STRIDE モデルを用いた設計レビューをプルリクエスト時に実施 | 推奨 |
| SEC-A04-02 | レート制限を API 全体に適用する | Vercel Edge Middleware + Upstash Redis でレートリミット（100 req/min/IP） | 必須 |
| SEC-A04-03 | ビジネスロジックの悪用防止（予約の多重取得、在庫操作等） | サーバーサイドでのトランザクション制御と楽観的ロック | 必須 |

### 1.5 A05: セキュリティの設定ミス (Security Misconfiguration)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A05-01 | セキュリティヘッダーを設定する | `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy` を `next.config.js` で設定 | 必須 |
| SEC-A05-02 | 本番環境でデバッグ情報を非公開にする | `NEXT_PUBLIC_` プレフィックスの環境変数を最小限に。エラー詳細をクライアントに返さない | 必須 |
| SEC-A05-03 | Supabase の匿名キー（anon key）の権限を RLS で最小限に制限する | anon ロールのデフォルト権限を全テーブルで DENY に設定 | 必須 |
| SEC-A05-04 | 不要な Supabase 機能（Realtime 等）を無効化する | 使用しないテーブルの Realtime を OFF | 推奨 |

### 1.6 A06: 脆弱で古いコンポーネント (Vulnerable and Outdated Components)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A06-01 | `npm audit` を CI パイプラインに組み込む | GitHub Actions で PR ごとに実行。Critical / High は即時対応 | 必須 |
| SEC-A06-02 | Dependabot を有効化し、依存関係の自動更新 PR を受け取る | `.github/dependabot.yml` を設定 | 必須 |
| SEC-A06-03 | Node.js ランタイムを LTS バージョンに固定する | `.node-version` または `engines` フィールドで指定 | 必須 |

### 1.7 A07: 識別と認証の失敗 (Identification and Authentication Failures)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A07-01 | 管理画面ログインに多要素認証（MFA）を提供する | Supabase Auth の TOTP MFA を有効化 | 推奨 |
| SEC-A07-02 | セッショントークンの有効期限を適切に設定する | アクセストークン: 1 時間、リフレッシュトークン: 7 日 | 必須 |
| SEC-A07-03 | ログイン試行回数を制限する | 5 回失敗で 15 分ロックアウト（Supabase Auth の設定） | 必須 |
| SEC-A07-04 | LINE ログイン（OAuth 2.0）の state パラメータで CSRF を防止する | `@line/liff` SDK が自動生成する state を検証 | 必須 |

### 1.8 A08: ソフトウェアとデータの整合性の不具合 (Software and Data Integrity Failures)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A08-01 | CI/CD パイプラインの権限を最小化する | GitHub Actions の `permissions` を明示的に制限 | 必須 |
| SEC-A08-02 | LINE Webhook の署名検証を必ず行う（再掲） | リプレイ攻撃防止のためタイムスタンプも検証 | 必須 |
| SEC-A08-03 | npm パッケージのロックファイル（`package-lock.json`）をコミットに含める | `npm ci` でインストールし、再現性を保証 | 必須 |

### 1.9 A09: セキュリティログとモニタリングの不備 (Security Logging and Monitoring Failures)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A09-01 | 認証イベント（ログイン成功/失敗）を記録する | Supabase Auth のログ + カスタム `auth_events` テーブル | 必須 |
| SEC-A09-02 | 個人情報へのアクセスを監査ログに記録する | 後述の監査ログ設計（セクション 5）に準拠 | 必須 |
| SEC-A09-03 | 異常検知アラートを設定する | Vercel Log Drain → 外部 SIEM（例: Datadog）で閾値ベースアラート | 推奨 |

### 1.10 A10: サーバーサイドリクエストフォージェリ (SSRF)

| ID | 要件 | 実装方針 | 優先度 |
|---|---|---|---|
| SEC-A10-01 | 外部 URL へのリクエストにホワイトリスト制限を設ける | LINE API (`api.line.me`) 等の許可ドメインのみ接続可能にする | 必須 |
| SEC-A10-02 | ユーザー入力由来の URL を直接 fetch しない | URL パース後にプライベート IP レンジを拒否 | 必須 |

---

## 2. 個人情報保護法対応

### 2.1 適用法令

| 法令 | 適用範囲 |
|---|---|
| 個人情報の保護に関する法律（個人情報保護法） | 顧客の氏名、LINE ID、購買履歴、予約情報の取扱い全般 |
| 電気通信事業法（2023 年改正・外部送信規律） | LINE LIFF 経由での Cookie・識別子送信 |
| 特定商取引法 | EC 機能における表示義務 |
| 不正アクセス禁止法 | システムへの不正アクセス防止義務 |

### 2.2 取得する個人情報と利用目的

| データ項目 | 取得方法 | 利用目的 |
|---|---|---|
| LINE ユーザーID（`userId`） | LINE ログイン / 友だち追加 | ユーザー識別、メッセージ配信 |
| 表示名・プロフィール画像 | LINE Profile API | 管理画面での顧客表示 |
| 氏名・メールアドレス・電話番号 | LIFF フォーム入力 | 予約確認、注文処理、問い合わせ対応 |
| 購買履歴 | EC 機能での注文 | 注文管理、レコメンド、分析 |
| 予約履歴 | 予約機能での登録 | 予約管理、リマインド配信 |
| アクセスログ | 自動取得 | セキュリティ監視、サービス改善 |

### 2.3 同意取得フロー

```
[ユーザー] 友だち追加 / LIFF アクセス
    │
    ▼
[リッチメニュー / LIFF 画面]
    │
    ▼
[同意画面表示]
    ├── プライバシーポリシー全文へのリンク
    ├── 利用目的の明示（箇条書き）
    ├── 第三者提供の有無（LINE 社への情報連携を含む）
    └── 「同意する」ボタン
    │
    ▼
[同意記録の保存]
    ├── consent_logs テーブルに記録
    │     - user_id
    │     - consent_type (privacy_policy / marketing / third_party)
    │     - version (ポリシーバージョン番号)
    │     - consented_at (タイムスタンプ)
    │     - ip_address (取得元 IP)
    │     - user_agent
    └── 同意なしの場合はサービス利用を制限
    │
    ▼
[サービス利用開始]
```

### 2.4 同意管理の要件

| ID | 要件 | 詳細 |
|---|---|---|
| PII-01 | 同意のバージョン管理 | プライバシーポリシー改定時に新バージョンを発番し、再同意を要求する |
| PII-02 | 同意の撤回（オプトアウト） | LIFF 画面またはリッチメニューから同意撤回が可能。撤回後はマーケティング配信を停止 |
| PII-03 | 開示・訂正・削除請求対応 | 管理画面に「データ主体リクエスト」機能を実装。30 日以内に対応 |
| PII-04 | データポータビリティ | JSON / CSV 形式で個人データをエクスポートする機能を提供 |
| PII-05 | 利用目的の変更通知 | 利用目的変更時は LIFF 画面で再同意を取得。LINE メッセージでも通知 |
| PII-06 | 未成年者対応 | 16 歳未満のユーザーには法定代理人の同意を求める仕組みを検討 |

### 2.5 データ保持期間

| データ種別 | 保持期間 | 根拠 |
|---|---|---|
| 購買履歴 | 取引完了後 7 年 | 商法（商事帳簿保存義務） |
| 予約履歴 | 予約完了後 3 年 | 業務上の必要性 |
| アクセスログ | 1 年 | セキュリティ監視目的 |
| 同意記録 | 同意撤回後 5 年 | 立証のための保持 |
| 退会ユーザーの個人情報 | 退会後 30 日で匿名化 | 個人情報保護法の最小限保持原則 |

---

## 3. LINE プラットフォームポリシー遵守事項

### 3.1 LINE 公式アカウント利用ガイドライン

| ID | 遵守事項 | 対応方針 |
|---|---|---|
| LINE-01 | LINE ユーザーデータの利用目的を LINE Developers コンソールに正確に記載する | 申請時にサービス概要・利用目的を明記 |
| LINE-02 | LINE ユーザー ID を第三者に提供しない | LINE ユーザー ID は自社システム内のみで使用。外部サービス連携時はハッシュ化 |
| LINE-03 | チャネルアクセストークンの安全な管理 | 環境変数で管理。長期トークンは使用せず、v2.1 のステートレスチャネルアクセストークンを使用 |
| LINE-04 | LIFF アプリの URL スキーム制限 | LIFF URL は `https://liff.line.me/{liffId}` のみを使用 |
| LINE-05 | Messaging API の利用制限を遵守する | 月間配信数の上限管理。レートリミット（API 呼び出し回数）の監視 |
| LINE-06 | LINE ログインの `openid` / `profile` / `email` スコープは必要最小限のみ取得する | 利用機能に応じて動的にスコープを変更 |

### 3.2 LINE データ取扱いの禁止事項

- LINE プロフィール情報（表示名・画像 URL）のキャッシュは 24 時間以内とする
- LINE のトーク履歴を本システムで保存しない（Webhook で受信したテキストは処理後に破棄するか、同意を得て保存）
- LINE ユーザー ID のみで個人を特定できる情報を外部公開しない
- スパム配信（同意なき広告配信）を行わない

### 3.3 Webhook セキュリティ

| 要件 | 実装 |
|---|---|
| 署名検証 | `X-Line-Signature` を HMAC-SHA256 で検証。不一致は 400 で拒否 |
| リプレイ攻撃防止 | Webhook イベントの `timestamp` を検証。5 分以上古いイベントは破棄 |
| エンドポイント保護 | Webhook URL を推測困難なパスに設定。公開しない |
| レスポンス | Webhook エンドポイントは常に 200 を返し、処理はバックグラウンドで実行 |

---

## 4. データ分類（機密度レベル定義）

### 4.1 機密度レベル

| レベル | 名称 | 定義 | 例 |
|---|---|---|---|
| L4 | 極秘 | 漏洩時に法的責任・重大な損害が発生するデータ | チャネルシークレット、DB 接続文字列、Supabase サービスロールキー |
| L3 | 秘密 | 個人を特定可能な情報（PII） | 氏名、メールアドレス、電話番号、LINE ユーザー ID、購買履歴 |
| L2 | 社外秘 | 社内業務データ。漏洩時に業務上の損害が発生 | 売上集計、予約統計、顧客セグメント情報 |
| L1 | 公開 | 漏洩してもリスクが低いデータ | 公開商品情報、店舗営業時間、FAQ |

### 4.2 レベル別の取扱い要件

| 管理策 | L4（極秘） | L3（秘密） | L2（社外秘） | L1（公開） |
|---|---|---|---|---|
| 保存時暗号化 | 必須（アプリレベル） | 必須（DB レベル） | 必須（DB レベル） | 不要 |
| 通信路暗号化（TLS） | 必須 | 必須 | 必須 | 必須 |
| アクセスログ | 必須（全操作） | 必須（参照・変更） | 必須（変更のみ） | 不要 |
| アクセス権限 | システム管理者のみ | RBAC で制御 | 認証済みユーザー | 制限なし |
| バックアップからの復元テスト | 四半期ごと | 四半期ごと | 半年ごと | 不要 |
| データマスキング（開発環境） | 必須 | 必須 | 推奨 | 不要 |
| 保持期限の設定 | 必須 | 必須 | 推奨 | 不要 |

### 4.3 データフロー上の分類適用ポイント

```
[LINE ユーザー]
    │ TLS 1.2+
    ▼
[Vercel Edge Network]
    │ TLS 1.2+
    ▼
[Next.js App (Server)]
    │ TLS 1.2+ (Supabase connection pooler)
    ▼
[Supabase PostgreSQL]
    ├── L4: secrets → 環境変数のみ（DB に保存しない）
    ├── L3: PII テーブル → RLS + カラム暗号化
    ├── L2: 集計テーブル → RLS
    └── L1: 公開テーブル → RLS（読み取り許可）
```

---

## 5. アクセスログ・監査ログ設計

### 5.1 ログ種別

| ログ種別 | 目的 | 保存先 | 保持期間 |
|---|---|---|---|
| アクセスログ | リクエスト単位の記録 | Vercel Log Drain → 外部ストレージ | 1 年 |
| 認証ログ | ログイン成功/失敗の記録 | Supabase `auth_events` テーブル | 2 年 |
| 監査ログ | 個人情報の参照・変更の記録 | Supabase `audit_logs` テーブル | 5 年 |
| エラーログ | アプリケーションエラー | Vercel Logs / Sentry | 90 日 |
| セキュリティログ | 不正アクセス・異常検知 | 外部 SIEM | 2 年 |

### 5.2 監査ログテーブル設計

```sql
CREATE TABLE audit_logs (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id      UUID NOT NULL,           -- 操作者の user_id
    actor_role    TEXT NOT NULL,            -- admin / staff / viewer
    action        TEXT NOT NULL,            -- CREATE / READ / UPDATE / DELETE / EXPORT
    resource_type TEXT NOT NULL,            -- customer / order / reservation
    resource_id   UUID,                     -- 対象レコードの ID
    tenant_id     UUID NOT NULL,            -- テナント ID
    details       JSONB,                    -- 変更前後の値（diff）
    ip_address    INET,
    user_agent    TEXT,
    request_id    UUID                      -- リクエスト追跡用
);

-- パフォーマンスのためのインデックス
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_id, timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs (tenant_id, timestamp DESC);

-- RLS: 監査ログは管理者のみ閲覧可能。書き込みは service_role のみ
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
              AND user_roles.role = 'admin'
              AND user_roles.tenant_id = audit_logs.tenant_id
        )
    );
```

### 5.3 監査ログ記録対象

| 操作 | 記録するイベント |
|---|---|
| 個人情報の参照 | 顧客詳細画面の表示、個人情報検索 |
| 個人情報の変更 | 顧客情報の更新、プロフィール変更 |
| 個人情報の削除 | 退会処理、データ削除リクエスト対応 |
| 個人情報のエクスポート | CSV / JSON エクスポート |
| 認証イベント | ログイン成功/失敗、MFA 認証、パスワードリセット |
| 権限変更 | ロール変更、招待、メンバー削除 |
| システム設定変更 | LINE チャネル設定、Webhook URL 変更 |
| 一括操作 | セグメント配信、一括データ更新 |

### 5.4 ログの改ざん防止

| 対策 | 実装 |
|---|---|
| 書き込み専用 | `audit_logs` テーブルへの UPDATE / DELETE を全ロールで禁止（REVOKE） |
| 外部バックアップ | 日次で外部ストレージ（例: Supabase Storage / S3）にエクスポート |
| 整合性検証 | 各ログエントリに前エントリのハッシュを含める（チェーン構造、オプション） |

---

## 6. インシデント対応フロー

### 6.1 インシデント分類

| レベル | 名称 | 定義 | 対応目標時間 |
|---|---|---|---|
| P1 | 緊急 | 個人情報漏洩の確認、サービス全面停止 | 検知後 1 時間以内に初動対応 |
| P2 | 重大 | 個人情報漏洩の疑い、主要機能の障害 | 検知後 4 時間以内に初動対応 |
| P3 | 警告 | 脆弱性の発見、軽微な障害 | 検知後 24 時間以内に初動対応 |
| P4 | 注意 | 潜在的リスクの検出 | 次回スプリントで対応 |

### 6.2 対応フロー

```
[検知] 監視アラート / ユーザー報告 / 外部通報
    │
    ▼
[トリアージ] (15 分以内)
    ├── インシデントレベルの判定（P1〜P4）
    ├── 対応チームの招集
    └── インシデント管理チケット作成
    │
    ▼
[封じ込め] (P1: 1 時間以内)
    ├── 影響範囲の特定
    ├── 侵害されたアクセストークンの無効化
    ├── 該当 API エンドポイントの一時停止
    └── Supabase RLS ポリシーの緊急強化
    │
    ▼
[根絶]
    ├── 脆弱性の修正
    ├── 不正アクセス経路の遮断
    └── 侵害されたデータの特定
    │
    ▼
[復旧]
    ├── サービスの段階的再開
    ├── データ整合性の確認
    └── 監視の強化
    │
    ▼
[事後対応]
    ├── ポストモーテム（振り返り）の実施
    ├── 再発防止策の策定・実施
    ├── 関係者への通知（下記参照）
    └── インシデント報告書の作成
```

### 6.3 通知義務

| 通知先 | 条件 | 期限 |
|---|---|---|
| 個人情報保護委員会 | 個人情報の漏洩が発生した場合（速報） | 検知後 3〜5 日以内 |
| 個人情報保護委員会 | 個人情報の漏洩が発生した場合（確報） | 検知後 30 日以内（不正目的の場合は 60 日以内） |
| 本人（データ主体） | 個人情報の漏洩が発生した場合 | 速やかに |
| LINE 社 | LINE プラットフォームに関連するインシデント | 速やかに |

### 6.4 連絡体制

| 役割 | 担当 | 連絡方法 |
|---|---|---|
| インシデントコマンダー | CTO または技術責任者 | Slack `#incident` チャネル + 電話 |
| 技術対応 | エンジニアチーム | Slack `#incident` チャネル |
| 法務対応 | 法務担当 / 外部弁護士 | メール + 電話 |
| 広報対応 | 経営陣 | 対面 / 電話 |

---

## 7. 脆弱性管理

### 7.1 定期スキャン

| スキャン種別 | ツール | 頻度 | 対応基準 |
|---|---|---|---|
| 依存パッケージ脆弱性 | `npm audit` / Dependabot | PR ごと + 週次 | Critical: 24 時間以内、High: 1 週間以内 |
| SAST（静的解析） | ESLint Security Plugin / Semgrep | PR ごと | High 以上はマージブロック |
| DAST（動的解析） | OWASP ZAP | 月次 | High 以上は次スプリントで対応 |
| コンテナ / インフラ | Vercel のセキュリティ機能 | 継続的 | アラート発生時に対応 |
| シークレットスキャン | GitHub Secret Scanning / gitleaks | PR ごと | 検出時は即時ローテーション |

### 7.2 依存関係更新ポリシー

| パッケージ種別 | 更新頻度 | 承認プロセス |
|---|---|---|
| セキュリティパッチ（Critical/High） | 即時 | リードエンジニア承認 → 即時デプロイ |
| セキュリティパッチ（Medium/Low） | 週次 | 通常の PR レビュー |
| マイナーバージョン | 月次 | 通常の PR レビュー + テスト通過 |
| メジャーバージョン（Next.js / Supabase 等） | 四半期ごとに評価 | チーム合議 + ステージング検証 |

### 7.3 脆弱性対応フロー

```
[検出] npm audit / Dependabot / 外部報告
    │
    ▼
[評価] CVSS スコアと影響範囲を確認
    │
    ▼
[判定] Critical/High → 即時対応
       Medium/Low → 計画対応
    │
    ▼
[修正] パッチ適用 / ワークアラウンド
    │
    ▼
[検証] テスト実行 + 再スキャン
    │
    ▼
[デプロイ] Vercel へデプロイ
    │
    ▼
[記録] 脆弱性管理台帳に記録
```

---

## 8. バックアップ・災害復旧計画

### 8.1 RPO / RTO 定義

| 指標 | 目標値 | 根拠 |
|---|---|---|
| RPO（目標復旧時点） | 1 時間 | Supabase の Point-in-Time Recovery（Pro プラン以上） |
| RTO（目標復旧時間） | 4 時間 | 新規 Supabase プロジェクト復元 + Vercel 再デプロイ |

### 8.2 バックアップ方針

| 対象 | 方式 | 頻度 | 保持期間 | 保存先 |
|---|---|---|---|---|
| Supabase PostgreSQL | Supabase 自動バックアップ（PITR） | 継続的（WAL ベース） | 7 日間（Pro プラン） | Supabase 管理 |
| Supabase PostgreSQL | 手動 `pg_dump` エクスポート | 日次 | 30 日間 | 外部 S3 互換ストレージ |
| Supabase Storage | ファイル同期 | 日次 | 30 日間 | 外部 S3 互換ストレージ |
| アプリケーションコード | Git リポジトリ | 継続的 | 無期限 | GitHub |
| 環境変数・シークレット | 暗号化バックアップ | 変更時 | 3 世代 | 別リージョンの安全なストレージ |
| 監査ログ | 外部エクスポート | 日次 | 5 年 | 外部ストレージ（WORM） |

### 8.3 災害復旧手順

#### シナリオ 1: Supabase 障害

1. Supabase ステータスページで障害状況を確認
2. 障害が長期化する場合、最新の `pg_dump` から新プロジェクトに復元
3. Vercel 環境変数を新プロジェクトの接続情報に更新
4. DNS / LIFF URL は変更不要（API 層は Vercel のまま）

#### シナリオ 2: Vercel 障害

1. Vercel ステータスページで障害状況を確認
2. 障害が長期化する場合、別プラットフォーム（Cloudflare Pages 等）にデプロイ
3. DNS を切り替え（LIFF URL は LINE Developers コンソールで更新）

#### シナリオ 3: データ破損（人為的ミス / 不正アクセス）

1. Supabase PITR で破損直前の時点に復元
2. 監査ログで変更内容を特定し、影響範囲を確認
3. 必要に応じて部分的なデータ修復を実施

### 8.4 復旧テスト

| テスト | 頻度 | 内容 |
|---|---|---|
| バックアップ復元テスト | 四半期ごと | `pg_dump` からの復元が正常に動作するか検証 |
| フェイルオーバーテスト | 半年ごと | 代替環境へのデプロイ手順を確認 |
| DR 訓練 | 年次 | 全シナリオのテーブルトップ演習 |

---

## 9. Supabase セキュリティ設定チェックリスト

### 9.1 認証設定

| # | チェック項目 | 状態 |
|---|---|---|
| 1 | メール確認（Email Confirmation）を有効にしている | [ ] |
| 2 | サインアップの自動確認（Auto-confirm）を無効にしている（管理者招待制の場合） | [ ] |
| 3 | セッショントークンの有効期限を適切に設定している（JWT expiry: 3600 秒） | [ ] |
| 4 | リフレッシュトークンの有効期限を設定している | [ ] |
| 5 | 外部 OAuth プロバイダー（LINE Login）のリダイレクト URL をホワイトリスト登録している | [ ] |
| 6 | MFA（TOTP）を管理者ユーザーに対して有効化している | [ ] |
| 7 | パスワードの最小長を 8 文字以上に設定している | [ ] |
| 8 | ログイン試行回数制限を設定している | [ ] |

### 9.2 データベース設定

| # | チェック項目 | 状態 |
|---|---|---|
| 9 | 全テーブルで RLS（Row Level Security）を有効にしている | [ ] |
| 10 | RLS ポリシーが `auth.uid()` またはカスタムクレームでユーザーを検証している | [ ] |
| 11 | `public` スキーマへのデフォルトアクセス権限を制限している | [ ] |
| 12 | `service_role` キーをクライアントサイドコードで使用していない | [ ] |
| 13 | `anon` キーの権限を RLS で適切に制限している | [ ] |
| 14 | データベース Webhook で機密データを送信していない | [ ] |
| 15 | 不要な PostgreSQL 拡張機能を無効にしている | [ ] |
| 16 | データベースの直接接続（port 5432）を IP 制限で保護している | [ ] |

### 9.3 API 設定

| # | チェック項目 | 状態 |
|---|---|---|
| 17 | API の URL を公開資料に記載していない（anon key は公開前提だが、不必要に広めない） | [ ] |
| 18 | API レスポンスで不要なフィールドを返していない（`select()` で必要カラムのみ指定） | [ ] |
| 19 | API レートリミットを設定している | [ ] |
| 20 | Supabase Edge Functions のシークレットを環境変数で管理している | [ ] |

### 9.4 Storage 設定

| # | チェック項目 | 状態 |
|---|---|---|
| 21 | Storage バケットのアクセスポリシーを設定している | [ ] |
| 22 | 公開バケットに個人情報を含むファイルを保存していない | [ ] |
| 23 | ファイルアップロードのサイズ制限を設定している | [ ] |
| 24 | 許可するファイル形式（MIME type）を制限している | [ ] |

### 9.5 環境・運用

| # | チェック項目 | 状態 |
|---|---|---|
| 25 | 本番環境と開発環境で別の Supabase プロジェクトを使用している | [ ] |
| 26 | 開発環境のデータベースに本番の個人情報を含めていない | [ ] |
| 27 | Supabase ダッシュボードへのアクセスに MFA を設定している | [ ] |
| 28 | Supabase プロジェクトのリージョンを東京（ap-northeast-1）に設定している | [ ] |
| 29 | データベースのバックアップが有効になっている（Pro プラン以上の PITR） | [ ] |
| 30 | Supabase のセキュリティアドバイザー（Security Advisor）の指摘事項に全て対応している | [ ] |

---

## 付録

### A. セキュリティ要件トレーサビリティマトリクス

| OWASP カテゴリ | 要件 ID | 実装コンポーネント | テスト方法 |
|---|---|---|---|
| A01 アクセス制御 | SEC-A01-01〜05 | RLS / middleware.ts / RBAC | 自動テスト + 手動ペネトレーション |
| A02 暗号化 | SEC-A02-01〜05 | TLS / pgcrypto / Vercel env | 設定監査 |
| A03 インジェクション | SEC-A03-01〜04 | Supabase client / zod / HMAC | SAST + DAST |
| A07 認証 | SEC-A07-01〜04 | Supabase Auth / LINE Login | 自動テスト |
| 個人情報保護 | PII-01〜06 | consent_logs / 管理画面 | 手動テスト + 監査 |
| LINE ポリシー | LINE-01〜06 | 環境変数 / API 実装 | コードレビュー |

### B. 用語集

| 用語 | 説明 |
|---|---|
| RLS | Row Level Security。PostgreSQL の行単位アクセス制御機能 |
| RBAC | Role-Based Access Control。ロールベースアクセス制御 |
| PITR | Point-in-Time Recovery。任意の時点へのデータベース復元 |
| RPO | Recovery Point Objective。許容されるデータ損失の最大時間 |
| RTO | Recovery Time Objective。サービス復旧までの目標時間 |
| PII | Personally Identifiable Information。個人を特定可能な情報 |
| SAST | Static Application Security Testing。静的アプリケーションセキュリティテスト |
| DAST | Dynamic Application Security Testing。動的アプリケーションセキュリティテスト |
| SIEM | Security Information and Event Management。セキュリティ情報イベント管理 |
| WORM | Write Once Read Many。一度書き込んだら変更不可のストレージ |
| STRIDE | Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege |
