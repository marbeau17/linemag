# LineMag マーケティング戦略・機能仕様書

**作成日:** 2026-03-24
**対象プロジェクト:** LineMag LINE Broadcast System
**ステータス:** Draft

---

## 目次

1. [マーケティングファネル設計](#1-マーケティングファネル設計)
2. [コンテンツ配信戦略](#2-コンテンツ配信戦略)
3. [クーポン戦略](#3-クーポン戦略)
4. [パーソナライゼーション戦略](#4-パーソナライゼーション戦略)
5. [KPI設計](#5-kpi設計)
6. [A/Bテスト機能要件](#6-abテスト機能要件)
7. [マーケティングオートメーション](#7-マーケティングオートメーション)

---

## 1. マーケティングファネル設計

### 1.1 概要

現行のLinemagは「ブログ記事のAI要約をフォロワー全員に一括配信」する単一チャネル構造である。これをCRM連携・ECサイト連携・相談予約システム・ユーザープロファイルの活用により、5段階のマーケティングファネルへ拡張する。

### 1.2 ファネル定義

```
┌─────────────────────────────────────────────────────────────┐
│                      【認知】 Awareness                      │
│  LINE友だち追加 / ブログ記事経由の初回接触                     │
├─────────────────────────────────────────────────────────────┤
│                     【興味】 Interest                         │
│  ブログ要約の開封・閲覧 / 記事リンクのタップ                   │
├─────────────────────────────────────────────────────────────┤
│                    【検討】 Consideration                     │
│  EC商品閲覧 / 相談予約ページ訪問 / 複数記事閲覧               │
├─────────────────────────────────────────────────────────────┤
│                     【購入】 Purchase                         │
│  EC商品購入 / 相談予約完了 / クーポン利用                      │
├─────────────────────────────────────────────────────────────┤
│                  【ロイヤル化】 Loyalty                        │
│  リピート購入 / 口コミ紹介 / 高エンゲージメント維持            │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 各ステージの詳細定義

#### 認知（Awareness）

| 項目 | 内容 |
|------|------|
| 対象ユーザー | LINE友だち追加直後のユーザー / ブログ経由の新規流入 |
| 判定条件 | `followedAt` から72時間以内、かつ記事リンクタップ0回 |
| 目的 | LineMAGの価値認知、ブランド理解 |
| 主要アクション | ウェルカムメッセージ配信、ブランド紹介コンテンツ、人気記事ダイジェスト |
| LINE配信テンプレート | `visual-magazine`（視覚的インパクト重視で第一印象を訴求） |

#### 興味（Interest）

| 項目 | 内容 |
|------|------|
| 対象ユーザー | ブログ要約を開封し、記事リンクをタップしたことがあるユーザー |
| 判定条件 | 記事リンクタップ 1回以上、かつEC商品閲覧0回 |
| 目的 | 興味のある領域の特定、エンゲージメント強化 |
| 主要アクション | 閲覧カテゴリに合わせた記事配信、関連記事レコメンド |
| LINE配信テンプレート | `daily-column`（定期的に読む習慣を形成）、`news-card`（短時間で情報取得） |

#### 検討（Consideration）

| 項目 | 内容 |
|------|------|
| 対象ユーザー | EC商品ページを閲覧、または相談予約ページに訪問したユーザー |
| 判定条件 | EC商品閲覧1回以上、または相談予約ページ訪問1回以上 |
| 目的 | 購入・予約への後押し、不安解消 |
| 主要アクション | 閲覧商品のリマインド、初回限定クーポン配布、相談予約への誘導 |
| LINE配信テンプレート | `premium-card`（特別感を演出し購買意欲を高める） |

#### 購入（Purchase）

| 項目 | 内容 |
|------|------|
| 対象ユーザー | EC商品を購入、または相談予約を完了したユーザー |
| 判定条件 | 購入完了イベント1回以上、または相談予約完了1回以上 |
| 目的 | 購入体験の最大化、次回アクションへの接続 |
| 主要アクション | 購入お礼メッセージ、利用ガイド、関連商品レコメンド、レビュー依頼 |
| LINE配信テンプレート | `premium-card`（購入ありがとうメッセージ）、`minimal-text`（フォローアップ情報） |

#### ロイヤル化（Loyalty）

| 項目 | 内容 |
|------|------|
| 対象ユーザー | リピート購入・高エンゲージメントユーザー |
| 判定条件 | 累計購入2回以上、または直近30日間の記事タップ5回以上 |
| 目的 | LTVの最大化、ブランドアドボカシーの醸成 |
| 主要アクション | VIP限定クーポン、先行情報配信、紹介プログラム案内 |
| LINE配信テンプレート | `premium-card`（VIP専用デザイン） |

### 1.4 ファネルステージ遷移のデータモデル

```typescript
interface UserFunnelState {
  userId: string;                    // LINE User ID
  currentStage: FunnelStage;
  stageHistory: StageTransition[];
  enteredAt: string;                 // ISO 8601
  lastActivityAt: string;           // ISO 8601
}

type FunnelStage =
  | 'awareness'
  | 'interest'
  | 'consideration'
  | 'purchase'
  | 'loyalty';

interface StageTransition {
  from: FunnelStage;
  to: FunnelStage;
  triggeredBy: string;              // イベント名
  transitionedAt: string;           // ISO 8601
}
```

### 1.5 ステージ遷移トリガー

| 遷移 | トリガーイベント | 自動/手動 |
|------|------------------|-----------|
| 認知 → 興味 | `article_link_tap`（初回記事リンクタップ） | 自動 |
| 興味 → 検討 | `ec_product_view` または `consultation_page_view` | 自動 |
| 検討 → 購入 | `ec_purchase_complete` または `consultation_booking_complete` | 自動 |
| 購入 → ロイヤル | `ec_purchase_complete`（2回目以上）または 30日間タップ5回以上 | 自動 |
| 任意 → 認知（リセット） | 90日間無活動 | 自動（再エンゲージメント対象） |

---

## 2. コンテンツ配信戦略

### 2.1 現行の配信フロー（As-Is）

```
meetsc.co.jp/blog/ → スクレイピング → AI要約(OpenAI) → Flex Message生成 → 全員一括配信(Broadcast)
```

現行のLineMagは `scrapeLatestArticles()` で記事を取得し、`summarizer.ts` でAI要約を生成、5種類のテンプレート（`daily-column`, `news-card`, `visual-magazine`, `minimal-text`, `premium-card`）のいずれかで配信する構造である。配信先はBroadcast APIによる全フォロワー一括、またはPush APIによる個別指定のみ。

### 2.2 拡張後の配信フロー（To-Be）

```
meetsc.co.jp/blog/ → スクレイピング → AI要約(OpenAI)
    ↓
カテゴリ判定 + ユーザーセグメント照合
    ↓
セグメント別テンプレート選択 → パーソナライズ配信(Narrowcast/Multicast)
    ↓
配信結果トラッキング → KPIダッシュボード更新
```

### 2.3 ブログ要約の最適化

#### 要約バリエーション生成

現行の `summarizer.ts` は1記事につき1つの要約（`catchyTitle` + `summaryText`）を生成している。これを以下のように拡張する。

| 要約タイプ | 用途 | 文字数目安 | 生成タイミング |
|-----------|------|-----------|---------------|
| ショート要約 | プッシュ通知のaltText、ミニマルテンプレート用 | 50-80文字 | 記事スクレイプ時 |
| スタンダード要約 | 通常のFlex Message body | 120-200文字 | 記事スクレイプ時（現行と同等） |
| ディープ要約 | 高エンゲージメントユーザー向け、検討段階向け | 250-400文字 | 記事スクレイプ時 |
| CTA特化要約 | EC商品紹介・相談予約誘導を含む要約 | 150-250文字 | セグメント配信時にオンデマンド生成 |

```typescript
interface EnhancedSummaryResult {
  catchyTitle: string;
  shortSummary: string;       // ショート要約
  standardSummary: string;    // スタンダード要約（現行のsummaryText相当）
  deepSummary: string;        // ディープ要約
  ctaSummary?: string;        // CTA特化要約（EC/予約連携時）
  relatedProductIds?: string[]; // 関連EC商品ID
  suggestedCouponType?: CouponType; // 推奨クーポン種別
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

#### カテゴリ別要約トーン

記事の `category` フィールド（既にスクレイパーで取得済み）に基づき、要約のトーンを調整する。

| カテゴリ | 要約トーン | テンプレート推奨 |
|---------|-----------|----------------|
| お知らせ | フォーマル・簡潔 | `news-card`, `minimal-text` |
| コラム | 親しみやすい・ストーリー性 | `daily-column` |
| 事例紹介 | 具体的・数値訴求 | `premium-card` |
| キャンペーン | 緊急性・お得感 | `visual-magazine` |
| EC関連 | 商品メリット・CTA強調 | `premium-card` |

### 2.4 配信タイミング

#### 時間帯別の配信最適化

| 時間帯 | 対象コンテンツ | 理由 |
|--------|---------------|------|
| 7:00-8:30 | ニュース速報型（`news-card`） | 通勤時間帯、短時間で情報取得 |
| 12:00-13:00 | コラム型（`daily-column`） | 昼休み、じっくり読める時間 |
| 18:00-19:30 | EC商品・キャンペーン情報 | 退勤後、購買意欲が高い時間帯 |
| 20:00-21:30 | ディープコンテンツ・相談予約誘導 | リラックスタイム、意思決定に時間をかけられる |

#### 曜日別の配信戦略

| 曜日 | 配信内容 | 配信時間 |
|------|---------|---------|
| 月曜 | 週間ダイジェスト / 今週のおすすめ記事 | 8:00 |
| 火-木 | 通常記事配信（新着記事ベース） | 12:00 |
| 金曜 | EC商品レコメンド / 週末キャンペーン告知 | 18:00 |
| 土曜 | 人気記事まとめ / ライフスタイル系コンテンツ | 10:00 |
| 日曜 | 配信なし（過剰配信防止） | - |

#### ユーザー行動ベースの配信タイミング

| トリガー | 配信タイミング | 内容 |
|---------|---------------|------|
| 友だち追加直後 | 即座（5分以内） | ウェルカムメッセージ |
| 記事リンクタップ後 | 24時間後 | 関連記事レコメンド |
| EC商品閲覧後 | 1時間後 | 閲覧商品リマインド + クーポン |
| カート放棄 | 3時間後 / 24時間後 | カート復帰促進メッセージ |
| 購入完了後 | 即座 / 3日後 / 14日後 | お礼 / 利用確認 / レビュー依頼 |
| 相談予約完了後 | 即座 / 前日リマインド | 予約確認 / リマインド |
| 7日間未活動 | 7日後 | 再エンゲージメントメッセージ |

### 2.5 配信頻度

#### 全体ルール

| ルール | 値 | 説明 |
|--------|-----|------|
| 最大配信数/日 | 2通 | 1ユーザーあたりの1日の最大受信数 |
| 最大配信数/週 | 5通 | 1ユーザーあたりの1週間の最大受信数 |
| 配信間隔（最小） | 4時間 | 同一ユーザーへの連続配信の最小間隔 |
| トリガー配信の優先度 | 高 | スケジュール配信より優先して配信枠を消費 |
| 配信抑止ルール | あり | ユーザーが「配信頻度を減らす」を選択した場合、週2通に制限 |

#### ファネルステージ別の配信頻度

| ファネルステージ | 推奨頻度 | 理由 |
|----------------|---------|------|
| 認知 | 週2-3通 | 離脱を防ぎつつ関係構築 |
| 興味 | 週3-4通 | 興味を深め検討段階へ推進 |
| 検討 | 週2-3通 + トリガー配信 | 押し売りにならない程度に後押し |
| 購入 | トリガー配信のみ | 購入直後は過剰配信を避ける |
| ロイヤル | 週2-3通 + VIP限定 | 特別感を維持しつつ関係深化 |

### 2.6 セグメント配信のAPI仕様

現行の `sendBroadcast()` (全体配信) / `sendPush()` (個別配信) に加え、以下のLINE Messaging API機能を活用する。

| API | 用途 | 対象人数 |
|-----|------|---------|
| Broadcast API | 全フォロワー一括配信（現行） | 全員 |
| Push API | 個別配信（実装済み） | 1人 |
| Multicast API | セグメント別配信 | 最大500人/リクエスト |
| Narrowcast API | 属性フィルタ配信 | 条件に合致するユーザー |

```typescript
// 新規追加: Multicast送信
async function sendMulticast(
  userIds: string[],
  messages: LineMessage[]
): Promise<void>;

// 新規追加: セグメント配信の公開API
export async function segmentBroadcastArticle(
  userIds: string[],
  req: BroadcastRequest
): Promise<BroadcastResult>;
```

---

## 3. クーポン戦略

### 3.1 クーポン種類

| クーポンID | 名称 | 割引内容 | 用途 |
|-----------|------|---------|------|
| `welcome_10` | ウェルカムクーポン | 10%OFF | 友だち追加後の初回購入促進 |
| `first_purchase_500` | 初回購入クーポン | 500円OFF | EC初回購入の後押し |
| `cart_abandon_15` | カート放棄クーポン | 15%OFF | カート放棄ユーザーの復帰促進 |
| `birthday_20` | バースデークーポン | 20%OFF | 誕生月の特別割引 |
| `loyal_vip_25` | VIPクーポン | 25%OFF | ロイヤルユーザーへの感謝 |
| `review_300` | レビュークーポン | 300円OFF | レビュー投稿後の次回購入促進 |
| `referral_1000` | 紹介クーポン | 1,000円OFF | 友だち紹介による新規獲得 |
| `seasonal` | シーズナルクーポン | 可変 | 季節キャンペーン用（運用で設定） |
| `consultation_booking` | 相談予約クーポン | 相談料無料/割引 | 相談予約の促進 |
| `reengagement_20` | 再エンゲージメントクーポン | 20%OFF | 休眠ユーザーの復帰促進 |

### 3.2 クーポンデータモデル

```typescript
interface Coupon {
  couponId: string;
  couponCode: string;            // ユニークコード（ユーザーごとに発行）
  type: CouponType;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed_amount' | 'free';
  discountValue: number;          // percentage: 10 = 10%, fixed_amount: 500 = 500円
  minimumOrderAmount?: number;    // 最低購入金額
  maximumDiscountAmount?: number; // 最大割引金額（percentage時の上限）
  validFrom: string;              // ISO 8601
  validUntil: string;             // ISO 8601
  usageLimit: number;             // 使用可能回数（1 = 1回限り）
  usedCount: number;
  isActive: boolean;
  applicableProductIds?: string[]; // 対象商品（空 = 全商品対象）
  applicableCategories?: string[]; // 対象カテゴリ
  createdAt: string;
  updatedAt: string;
}

type CouponType =
  | 'welcome'
  | 'first_purchase'
  | 'cart_abandon'
  | 'birthday'
  | 'vip'
  | 'review'
  | 'referral'
  | 'seasonal'
  | 'consultation'
  | 'reengagement';

interface CouponIssuance {
  issuanceId: string;
  couponId: string;
  userId: string;                 // LINE User ID
  couponCode: string;
  issuedAt: string;
  usedAt?: string;
  expiresAt: string;
  status: 'issued' | 'used' | 'expired' | 'revoked';
  usedOrderId?: string;          // EC注文ID（使用時に紐付け）
}
```

### 3.3 配布条件

| クーポン | 配布トリガー | 配布条件 | 1人あたり発行上限 |
|---------|-------------|---------|-----------------|
| ウェルカムクーポン | 友だち追加イベント（`follow`） | 初回友だち追加時のみ | 1枚 |
| 初回購入クーポン | 友だち追加後3日経過 | EC購入履歴0件 | 1枚 |
| カート放棄クーポン | `cart_abandon`イベント | カート商品金額3,000円以上 | 月2枚まで |
| バースデークーポン | 誕生月の1日 0:00 | プロファイルに誕生日登録済み | 年1枚 |
| VIPクーポン | ロイヤルステージ到達時 / 四半期ごと | 累計購入2回以上 | 四半期1枚 |
| レビュークーポン | レビュー投稿完了イベント | レビュー承認済み | レビューごとに1枚 |
| 紹介クーポン | 紹介されたユーザーの初回購入完了 | 紹介コード経由の購入確認 | 月3枚まで |
| シーズナルクーポン | 管理者による手動配布 / スケジュール | 管理画面から設定 | キャンペーンごと |
| 相談予約クーポン | 相談予約ページ閲覧後24時間 | 予約完了0件 | 1枚 |
| 再エンゲージメントクーポン | 30日間未活動検知 | 過去に1回以上記事タップ経験あり | 90日に1枚 |

### 3.4 有効期限

| クーポン | 有効期限 | 理由 |
|---------|---------|------|
| ウェルカムクーポン | 発行から14日間 | 初期の熱量が高い期間内での利用を促進 |
| 初回購入クーポン | 発行から7日間 | 短い期限で購入の緊急性を訴求 |
| カート放棄クーポン | 発行から48時間 | 購買意欲が残っている期間内に使い切らせる |
| バースデークーポン | 誕生月末日まで | 1ヶ月間の余裕を持たせ、自然な利用を促進 |
| VIPクーポン | 発行から30日間 | ロイヤルユーザーには十分な利用期間を提供 |
| レビュークーポン | 発行から30日間 | 次回購入への動機付け期間 |
| 紹介クーポン | 発行から30日間 | 紹介の連鎖を生むための十分な期間 |
| シーズナルクーポン | キャンペーン期間に依存 | 運用設定による |
| 相談予約クーポン | 発行から72時間 | 検討段階の離脱を防ぐ短期限定 |
| 再エンゲージメントクーポン | 発行から14日間 | 復帰の動機付けとして適度な期間 |

### 3.5 利用条件

| 条件項目 | ルール |
|---------|--------|
| 併用可否 | 原則1注文につき1クーポン。VIPクーポンとシーズナルクーポンのみ併用可 |
| 最低購入金額 | クーポンごとに個別設定（ウェルカム: なし、カート放棄: 3,000円、VIP: 5,000円） |
| 対象商品制限 | 全商品対象を基本とし、シーズナルクーポンのみカテゴリ限定可 |
| 割引上限 | percentage型は最大割引額を設定（例: 20%OFFだが上限3,000円） |
| 使用回数 | 1クーポンコードにつき1回限り |
| 譲渡 | 不可（ユーザーID紐付け） |

### 3.6 クーポンのLINE配信テンプレート

クーポン配信時は、既存のFlex Messageテンプレートを拡張し、クーポン情報を含むカードを生成する。

```typescript
interface CouponFlexMessageRequest extends BroadcastRequest {
  couponCode: string;
  couponName: string;
  discountLabel: string;         // 例: "10%OFF", "500円OFF"
  expiresAt: string;
  minimumOrderLabel?: string;    // 例: "3,000円以上のご購入で利用可能"
  ctaLabel: string;              // 例: "クーポンを使う"
  ctaUrl: string;                // ECサイトのクーポン適用URL
}
```

### 3.7 効果測定

| 指標 | 計算式 | 目標値 |
|------|--------|--------|
| クーポン発行数 | COUNT(issuances) per period | - |
| クーポン利用率 | 利用数 / 発行数 x 100 | 15-25% |
| クーポン経由売上 | SUM(利用時の注文金額) | - |
| クーポン経由利益 | クーポン経由売上 - 割引総額 - 原価 | 正の値を維持 |
| クーポンROI | (クーポン経由利益 - クーポン運用コスト) / クーポン運用コスト x 100 | 200%以上 |
| 新規顧客獲得コスト（クーポン経由） | クーポン割引総額 / クーポン経由新規購入者数 | 業界平均以下 |
| クーポン種別別利用率 | 種別ごとの利用数 / 発行数 x 100 | 種別ごとに設定 |
| 平均注文単価への影響 | クーポン利用時AOV vs 非利用時AOV | 単価低下20%以内 |

---

## 4. パーソナライゼーション戦略

### 4.1 ユーザープロファイルデータモデル

```typescript
interface UserProfile {
  userId: string;                    // LINE User ID
  displayName: string;               // LINE表示名
  pictureUrl?: string;               // LINEプロフィール画像

  // デモグラフィック属性
  demographics: {
    ageRange?: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
    gender?: 'male' | 'female' | 'other' | 'unknown';
    prefecture?: string;             // 都道府県
    birthday?: string;               // MM-DD（月日のみ）
    occupation?: string;
  };

  // 行動データ
  behavior: {
    totalArticleTaps: number;
    totalArticleCategories: Record<string, number>;  // カテゴリ別タップ数
    lastArticleTapAt?: string;
    totalEcProductViews: number;
    totalEcPurchases: number;
    totalEcPurchaseAmount: number;
    lastPurchaseAt?: string;
    totalConsultationBookings: number;
    lastConsultationAt?: string;
    totalCouponsUsed: number;
    messageOpenRate: number;          // 直近30日間のメッセージ開封率
    averageResponseTime?: number;     // メッセージ配信からタップまでの平均秒数
  };

  // 嗜好データ
  preferences: {
    favoriteCategories: string[];     // 上位3カテゴリ
    preferredTemplateId?: TemplateId; // 最もタップ率の高いテンプレート
    preferredDeliveryTime?: string;   // 最もタップ率の高い時間帯（HH:MM）
    deliveryFrequency: 'normal' | 'reduced'; // ユーザーが選択した配信頻度
    optedOutTopics?: string[];        // 配信停止したトピック
  };

  // CRM連携データ
  crm: {
    crmCustomerId?: string;          // 外部CRMの顧客ID
    customerRank?: 'bronze' | 'silver' | 'gold' | 'platinum';
    lifetimeValue: number;
    firstContactAt: string;
    tags: string[];                   // CRM側で付与されたタグ
  };

  // ファネル状態
  funnel: UserFunnelState;

  // メタデータ
  followedAt: string;
  lastActiveAt: string;
  updatedAt: string;
}
```

### 4.2 属性別パーソナライゼーション

#### 年齢層別

| 年齢層 | コンテンツ傾向 | テンプレート | トーン |
|--------|---------------|-------------|--------|
| 18-24 | トレンド情報、ビジュアル重視 | `visual-magazine` | カジュアル、絵文字使用 |
| 25-34 | キャリア・ライフスタイル | `daily-column` | 親しみやすい |
| 35-44 | 実用情報、EC商品 | `news-card`, `premium-card` | 実用的、信頼感 |
| 45-54 | 専門性の高い情報 | `daily-column`, `premium-card` | フォーマル |
| 55+ | シンプルで読みやすい | `minimal-text` | 丁寧、大きめフォント |

#### 地域別

| 地域区分 | パーソナライズ内容 |
|---------|------------------|
| ユーザー所在地域 | 地域に関連するイベント・店舗情報の優先配信 |
| meetsc所在地域（近隣） | 対面相談予約の積極的な誘導 |
| meetsc所在地域（遠方） | オンライン相談・EC商品の優先案内 |

### 4.3 行動別パーソナライゼーション

#### 閲覧カテゴリベース

```typescript
// ユーザーの閲覧履歴からカテゴリ親和性スコアを算出
interface CategoryAffinity {
  category: string;
  score: number;           // 0.0 - 1.0
  tapCount: number;
  lastTapAt: string;
  decayFactor: number;     // 時間経過による減衰（直近の行動ほど高スコア）
}

// 配信記事のマッチングロジック
function calculateContentRelevance(
  article: ScrapedArticle,
  userAffinities: CategoryAffinity[]
): number;
```

| スコア帯 | アクション |
|---------|-----------|
| 0.8 - 1.0 | 即座に配信（高優先度） |
| 0.5 - 0.79 | 通常配信枠で配信 |
| 0.2 - 0.49 | 低頻度で配信（新たな興味の開拓目的） |
| 0.0 - 0.19 | 配信しない |

#### エンゲージメントレベル別

| レベル | 定義 | 配信戦略 |
|--------|------|---------|
| 高エンゲージメント | 開封率80%以上、週3回以上タップ | ディープ要約を配信、VIPクーポン対象 |
| 中エンゲージメント | 開封率40-79%、週1-2回タップ | スタンダード要約、通常配信頻度 |
| 低エンゲージメント | 開封率20-39%、月2-4回タップ | ショート要約、配信頻度を下げる |
| 非活動 | 開封率20%未満、月1回以下タップ | 再エンゲージメントシナリオ発動 |

#### テンプレート最適化

ユーザーごとに過去の配信結果（タップ率）をテンプレート別に集計し、最もタップ率が高いテンプレートを `preferredTemplateId` として記録する。配信時に自動選択する。

```typescript
// テンプレート別パフォーマンスの集計
interface TemplatePerformance {
  templateId: TemplateId;
  sentCount: number;
  tappedCount: number;
  tapRate: number;         // tappedCount / sentCount
}

// 最適テンプレートの選択ロジック
function selectOptimalTemplate(
  performances: TemplatePerformance[],
  articleCategory: string | null
): TemplateId;
```

### 4.4 ライフサイクル別パーソナライゼーション

#### 新規ユーザー（友だち追加後0-30日）

| 期間 | 配信内容 | 目的 |
|------|---------|------|
| 0日目 | ウェルカムメッセージ + ウェルカムクーポン | 第一印象、価値訴求 |
| 1日目 | 人気記事TOP3ダイジェスト | コンテンツ価値の体験 |
| 3日目 | 初回購入クーポン（未購入の場合） | EC誘導 |
| 7日目 | 興味カテゴリ確認リッチメニュー | プロファイル収集 |
| 14日目 | 閲覧履歴に基づくパーソナライズ記事 | 興味段階への遷移促進 |
| 30日目 | これまでの閲覧傾向サマリー | エンゲージメント確認 |

#### アクティブユーザー（31日以上、直近7日間に活動あり）

| 配信内容 | 条件 | 頻度 |
|---------|------|------|
| パーソナライズ記事配信 | 通常 | 週3-4通 |
| EC商品レコメンド | EC閲覧履歴あり | 週1通 |
| 相談予約案内 | 検討段階 | 月2回 |
| VIP特典案内 | ロイヤルステージ | 四半期1回 |

#### 休眠ユーザー（直近30日間活動なし）

| 経過日数 | アクション | 内容 |
|---------|-----------|------|
| 30日 | 再エンゲージメントメッセージ1 | 「お久しぶりです」+ 人気記事 |
| 45日 | 再エンゲージメントメッセージ2 | 再エンゲージメントクーポン配布 |
| 60日 | 最終アプローチ | 「配信を続けてよろしいですか？」確認 |
| 90日（応答なし） | 配信停止 | 自動的に配信対象から除外 |

### 4.5 セグメント定義

パーソナライゼーションで使用するセグメントの標準定義。

```typescript
interface Segment {
  segmentId: string;
  name: string;
  description: string;
  conditions: SegmentCondition[];  // AND結合
  userCount: number;               // 現在の対象ユーザー数
  isDynamic: boolean;              // 動的セグメント（リアルタイム判定）
  lastCalculatedAt: string;
  createdAt: string;
}

interface SegmentCondition {
  field: string;                   // UserProfileのフィールドパス
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'between';
  value: string | number | string[] | [number, number];
}
```

#### 標準セグメント一覧

| セグメント名 | 条件 | 用途 |
|-------------|------|------|
| 新規ユーザー | `followedAt` が30日以内 | ウェルカムシリーズ対象 |
| EC見込み客 | `behavior.totalEcProductViews >= 1` かつ `behavior.totalEcPurchases == 0` | 初回購入クーポン対象 |
| リピーター | `behavior.totalEcPurchases >= 2` | VIPクーポン対象 |
| 高エンゲージメント | `behavior.messageOpenRate >= 0.8` | ディープコンテンツ配信 |
| 休眠ユーザー | `lastActiveAt` が30日以上前 | 再エンゲージメント対象 |
| 相談予約見込み | `behavior.totalConsultationBookings == 0` かつ検討ステージ | 相談予約クーポン対象 |
| 誕生月ユーザー | `demographics.birthday` の月が当月 | バースデークーポン対象 |

---

## 5. KPI設計

### 5.1 KPIダッシュボード構成

```
┌─────────────────────────────────────────────────────────────────┐
│                    LineMag KPIダッシュボード                      │
├──────────────────┬──────────────────┬───────────────────────────┤
│  配信効果        │  エンゲージメント │  コンバージョン            │
│  ・配信数        │  ・開封率         │  ・記事→EC遷移率          │
│  ・到達率        │  ・タップ率       │  ・EC購入率               │
│  ・開封率        │  ・反応時間       │  ・相談予約率             │
├──────────────────┴──────────────────┴───────────────────────────┤
│  LTV / ファネル                                                  │
│  ・ファネル遷移率   ・顧客生涯価値   ・クーポンROI              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 配信効果KPI

| KPI | 定義 | 計算式 | 目標値 | 測定頻度 |
|-----|------|--------|--------|---------|
| 配信数 | 期間内の総配信メッセージ数 | COUNT(sent_messages) | - | 日次 |
| 到達率 | 配信先に到達したメッセージの割合 | (配信数 - バウンス数) / 配信数 x 100 | 98%以上 | 日次 |
| ブロック率 | 配信後にブロックしたユーザーの割合 | ブロック数 / 配信対象ユーザー数 x 100 | 0.5%以下 | 週次 |
| 友だち純増数 | 友だち追加数 - ブロック数 | 新規follow - unfollow | 正の値を維持 | 週次 |
| テンプレート別配信数 | テンプレートごとの配信数 | COUNT(sent_messages) GROUP BY templateId | - | 週次 |
| セグメント別配信数 | セグメントごとの配信数 | COUNT(sent_messages) GROUP BY segmentId | - | 週次 |

### 5.3 エンゲージメントKPI

| KPI | 定義 | 計算式 | 目標値 | 測定頻度 |
|-----|------|--------|--------|---------|
| メッセージ開封率 | FlexMessageを開いたユーザーの割合 | 開封数 / 到達数 x 100 | 60%以上 | 日次 |
| 記事リンクタップ率 (CTR) | 記事リンクをタップしたユーザーの割合 | タップ数 / 開封数 x 100 | 15%以上 | 日次 |
| テンプレート別タップ率 | テンプレートごとのタップ率 | タップ数 / 開封数 x 100 GROUP BY templateId | - | 週次 |
| セグメント別タップ率 | セグメントごとのタップ率 | タップ数 / 開封数 x 100 GROUP BY segmentId | - | 週次 |
| 平均反応時間 | 配信からタップまでの平均時間 | AVG(tap_at - sent_at) | 2時間以内 | 週次 |
| リッチメニュー利用率 | リッチメニューをタップしたユーザーの割合 | リッチメニュータップ数 / アクティブユーザー数 x 100 | 30%以上 | 月次 |
| カテゴリ別エンゲージメント | カテゴリごとの平均タップ率 | AVG(tap_rate) GROUP BY article_category | - | 月次 |

### 5.4 コンバージョンKPI

| KPI | 定義 | 計算式 | 目標値 | 測定頻度 |
|-----|------|--------|--------|---------|
| 記事→EC遷移率 | 記事閲覧後にEC商品を閲覧した割合 | EC遷移数 / 記事タップ数 x 100 | 5%以上 | 週次 |
| EC購入率 | EC商品閲覧後に購入した割合 | 購入数 / EC遷移数 x 100 | 3%以上 | 週次 |
| 平均注文単価 (AOV) | EC注文の平均金額 | SUM(注文金額) / COUNT(注文) | - | 月次 |
| カート放棄率 | カートに商品を入れたが購入しなかった割合 | カート放棄数 / カート追加数 x 100 | 70%以下 | 週次 |
| カート復帰率 | カート放棄後にクーポンで復帰した割合 | 復帰購入数 / カート放棄クーポン配布数 x 100 | 10%以上 | 月次 |
| 相談予約率 | LINE経由で相談予約を完了した割合 | 予約完了数 / 予約ページ遷移数 x 100 | 20%以上 | 月次 |
| 相談→購入転換率 | 相談後に購入した割合 | 相談後購入数 / 相談完了数 x 100 | 30%以上 | 月次 |
| クーポン利用率 | 配布したクーポンの利用率 | 利用数 / 配布数 x 100 | 15-25% | 月次 |
| クーポン経由売上比率 | 全売上に占めるクーポン経由売上の割合 | クーポン経由売上 / 全売上 x 100 | 20-30% | 月次 |

### 5.5 LTV（顧客生涯価値）KPI

| KPI | 定義 | 計算式 | 目標値 | 測定頻度 |
|-----|------|--------|--------|---------|
| 顧客生涯価値 (LTV) | 1顧客あたりの累計売上 | SUM(購入金額) per user | 前期比10%向上 | 月次 |
| 平均購入回数 | 1顧客あたりの平均購入回数 | SUM(購入回数) / COUNT(購入経験ユーザー) | 2回以上 | 月次 |
| 購入間隔 | リピート購入までの平均日数 | AVG(次回購入日 - 前回購入日) | 60日以内 | 月次 |
| 顧客維持率（リテンション） | 前月アクティブユーザーの翌月維持率 | 翌月もアクティブなユーザー数 / 前月アクティブユーザー数 x 100 | 80%以上 | 月次 |
| ファネル遷移率 | 各ステージから次ステージへの遷移率 | 次ステージ人数 / 現ステージ人数 x 100 | ステージ別に設定 | 月次 |
| LINE経由売上貢献率 | 全売上に占めるLINE経由の割合 | LINE経由売上 / 全売上 x 100 | 15%以上 | 月次 |
| 紹介率 | ユーザーが新規ユーザーを紹介した割合 | 紹介元ユーザー数 / アクティブユーザー数 x 100 | 5%以上 | 四半期 |

### 5.6 KPIデータモデル

```typescript
interface KpiSnapshot {
  snapshotId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  periodStart: string;           // ISO 8601
  periodEnd: string;

  delivery: {
    totalSent: number;
    totalReached: number;
    reachRate: number;
    blockCount: number;
    blockRate: number;
    netFollowerGrowth: number;
  };

  engagement: {
    openRate: number;
    tapRate: number;
    avgResponseTimeSeconds: number;
    templatePerformance: Record<TemplateId, {
      sent: number;
      opened: number;
      tapped: number;
      tapRate: number;
    }>;
    categoryPerformance: Record<string, {
      sent: number;
      tapped: number;
      tapRate: number;
    }>;
  };

  conversion: {
    articleToEcRate: number;
    ecPurchaseRate: number;
    averageOrderValue: number;
    cartAbandonRate: number;
    cartRecoveryRate: number;
    consultationBookingRate: number;
    consultationToSaleRate: number;
    couponUsageRate: number;
    couponRevenue: number;
  };

  ltv: {
    averageLtv: number;
    averagePurchaseCount: number;
    averagePurchaseInterval: number;
    retentionRate: number;
    funnelConversion: Record<FunnelStage, {
      entered: number;
      exited: number;
      conversionRate: number;
    }>;
    lineRevenueContribution: number;
  };

  createdAt: string;
}
```

---

## 6. A/Bテスト機能要件

### 6.1 概要

配信効果を継続的に改善するため、コンテンツ・テンプレート・配信タイミング・クーポンなどの要素についてA/Bテストを実施する機能を提供する。

### 6.2 テスト対象要素

| テスト対象 | バリアント例 | 主要評価指標 |
|-----------|-------------|-------------|
| テンプレート | `daily-column` vs `news-card` | タップ率 (CTR) |
| 要約タイプ | ショート要約 vs スタンダード要約 | タップ率、滞在時間 |
| 要約トーン | フォーマル vs カジュアル | タップ率、ブロック率 |
| キャッチタイトル | タイトルA vs タイトルB | 開封率、タップ率 |
| 配信時間 | 12:00配信 vs 18:00配信 | 開封率、タップ率 |
| クーポン割引率 | 10%OFF vs 15%OFF vs 500円OFF | 利用率、売上、利益 |
| クーポン有効期限 | 7日 vs 14日 vs 30日 | 利用率、利用タイミング |
| CTAテキスト | 「記事を読む」vs「詳しく見る」vs「続きはこちら」 | タップ率 |
| Flex Message構成 | 画像あり vs 画像なし | タップ率、配信コスト |

### 6.3 データモデル

```typescript
interface ABTest {
  testId: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  testType: ABTestType;

  // バリアント定義
  variants: ABTestVariant[];

  // 対象設定
  targetSegmentId?: string;        // 対象セグメント（省略時は全ユーザー）
  trafficAllocation: number[];     // 各バリアントへのトラフィック割合（例: [50, 50]）
  totalSampleSize: number;         // 必要サンプルサイズ

  // 評価設定
  primaryMetric: ABTestMetric;
  secondaryMetrics?: ABTestMetric[];
  confidenceLevel: number;         // 信頼水準（デフォルト: 0.95）
  minimumDetectableEffect: number; // 最小検出効果量（デフォルト: 0.05）

  // 期間設定
  startAt: string;
  endAt?: string;                  // 自動終了日時（省略時はサンプルサイズ到達で終了）
  autoStopOnSignificance: boolean; // 統計的有意差検出時に自動停止

  // 結果
  result?: ABTestResult;

  createdAt: string;
  updatedAt: string;
}

type ABTestType =
  | 'template'
  | 'summary_type'
  | 'summary_tone'
  | 'title'
  | 'delivery_time'
  | 'coupon_discount'
  | 'coupon_expiry'
  | 'cta_text'
  | 'message_layout';

interface ABTestVariant {
  variantId: string;
  name: string;                    // 例: "バリアントA", "バリアントB"
  description: string;
  config: Record<string, unknown>; // テスト対象の設定値
  isControl: boolean;              // コントロールグループかどうか
}

type ABTestMetric =
  | 'open_rate'
  | 'tap_rate'
  | 'ec_conversion_rate'
  | 'coupon_usage_rate'
  | 'revenue_per_user'
  | 'block_rate'
  | 'consultation_booking_rate';

interface ABTestResult {
  winnerVariantId?: string;        // 勝者バリアント（有意差なしの場合はundefined）
  isSignificant: boolean;
  pValue: number;
  variantResults: ABTestVariantResult[];
  completedAt: string;
}

interface ABTestVariantResult {
  variantId: string;
  sampleSize: number;
  metricValue: number;             // 主要指標の値
  confidenceInterval: [number, number]; // 95%信頼区間
  secondaryMetricValues?: Record<ABTestMetric, number>;
}
```

### 6.4 テスト実施フロー

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  テスト   │───→│ ユーザー │───→│  配信    │───→│  結果   │───→│  適用    │
│  設計     │    │  分割    │    │  実行    │    │  分析    │    │  反映    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
 ・対象要素選択    ・ランダム分割   ・バリアント別    ・統計的検定    ・勝者バリアント
 ・バリアント定義  ・均等配分確認    配信実行        ・有意差判定     を標準設定に
 ・評価指標設定    ・セグメント考慮  ・結果収集      ・レポート生成   ・次テスト計画
```

### 6.5 ユーザー分割ロジック

```typescript
// ユーザーをバリアントにランダムに割り当てる
// 一度割り当てたバリアントはテスト期間中固定（一貫性の担保）
interface ABTestAssignment {
  testId: string;
  userId: string;
  variantId: string;
  assignedAt: string;
}

function assignUserToVariant(
  userId: string,
  test: ABTest
): string {
  // userId + testId のハッシュ値でバリアントを決定
  // （ランダムだが再現可能な割り当て）
  const hash = hashCode(`${userId}:${test.testId}`);
  const bucket = Math.abs(hash) % 100;

  let cumulative = 0;
  for (let i = 0; i < test.variants.length; i++) {
    cumulative += test.trafficAllocation[i];
    if (bucket < cumulative) {
      return test.variants[i].variantId;
    }
  }
  return test.variants[test.variants.length - 1].variantId;
}
```

### 6.6 統計的検定

| 項目 | 仕様 |
|------|------|
| 検定手法 | 二標本比率の検定（Z検定） |
| 信頼水準 | 95%（デフォルト、80%-99%で設定可能） |
| 最小サンプルサイズ | バリアントあたり100以上 |
| 検出力 | 80% |
| 多重比較補正 | 3バリアント以上の場合はBonferroni補正を適用 |
| 早期停止 | 有意差がp<0.01で検出された場合にオプションで自動停止 |

### 6.7 管理画面要件

| 画面 | 機能 |
|------|------|
| テスト一覧 | 実行中/完了/下書きのテスト一覧表示、ステータスフィルタ |
| テスト作成 | テスト対象・バリアント・評価指標・期間の設定 |
| テスト詳細 | リアルタイムの指標推移グラフ、バリアント別の結果表示 |
| テスト結果 | 統計的検定の結果、勝者の判定、レポート出力 |

---

## 7. マーケティングオートメーション

### 7.1 概要

ユーザーの行動やライフサイクルに基づき、定義済みのシナリオに沿って自動的にメッセージを配信する仕組みを構築する。現行のcron配信（`/api/cron/line-broadcast`）を拡張し、シナリオ配信とトリガー配信の2種類のオートメーションを実装する。

### 7.2 シナリオ配信

#### シナリオ定義

事前に設計された配信シーケンスを、条件に合致するユーザーに順次実行する。

```typescript
interface Scenario {
  scenarioId: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  entryCondition: ScenarioEntryCondition;
  exitConditions: ScenarioExitCondition[];
  steps: ScenarioStep[];
  maxConcurrentUsers: number;     // 同時実行ユーザー上限
  priority: number;               // シナリオ優先度（高い値が優先）
  createdAt: string;
  updatedAt: string;
}

interface ScenarioEntryCondition {
  type: 'event' | 'segment' | 'schedule';
  eventName?: string;             // type='event'の場合
  segmentId?: string;             // type='segment'の場合
  schedule?: string;              // type='schedule'の場合（cron式）
  reentryPolicy: 'once' | 'allow_after_completion' | 'allow_always';
}

interface ScenarioExitCondition {
  type: 'event' | 'timeout' | 'manual';
  eventName?: string;
  timeoutDays?: number;
}

interface ScenarioStep {
  stepId: string;
  order: number;
  type: 'message' | 'wait' | 'condition' | 'action';

  // type='message'の場合
  message?: {
    templateId: TemplateId;
    contentType: 'article' | 'coupon' | 'custom';
    contentConfig: Record<string, unknown>;
    summaryType?: 'short' | 'standard' | 'deep' | 'cta';
  };

  // type='wait'の場合
  wait?: {
    duration: number;
    unit: 'minutes' | 'hours' | 'days';
    waitUntilTime?: string;       // 特定時刻まで待機（HH:MM）
  };

  // type='condition'の場合
  condition?: {
    field: string;
    operator: string;
    value: unknown;
    trueBranch: string;           // 条件成立時のstepId
    falseBranch: string;          // 条件不成立時のstepId
  };

  // type='action'の場合
  action?: {
    actionType: 'issue_coupon' | 'update_tag' | 'move_segment' | 'update_funnel_stage';
    config: Record<string, unknown>;
  };
}
```

#### 標準シナリオ一覧

##### シナリオ1: ウェルカムシリーズ

```
エントリー条件: follow（友だち追加）イベント
終了条件: 初回購入完了 or 30日経過

[友だち追加]
    │
    ▼
[即座] ウェルカムメッセージ + ウェルカムクーポン配布
    │     テンプレート: visual-magazine
    │     内容: ブランド紹介 + 人気記事TOP3 + 10%OFFクーポン
    │
    ▼
[+1日] 待機
    │
    ▼
[条件分岐] 記事リンクタップ済み?
    │
    ├─ Yes → [メッセージ] タップしたカテゴリの関連記事配信
    │          テンプレート: daily-column
    │
    └─ No → [メッセージ] 人気記事TOP3をショート要約で再送
             テンプレート: news-card
    │
    ▼
[+3日] 待機
    │
    ▼
[条件分岐] EC商品閲覧済み?
    │
    ├─ Yes → [メッセージ] 閲覧商品リマインド
    │          テンプレート: premium-card
    │
    └─ No → [アクション] 初回購入クーポン(500円OFF)配布
             [メッセージ] EC商品おすすめ + クーポン案内
              テンプレート: premium-card
    │
    ▼
[+7日] 待機
    │
    ▼
[メッセージ] 興味カテゴリ確認アンケート（リッチメニュー誘導）
    テンプレート: minimal-text
    │
    ▼
[+14日] 待機
    │
    ▼
[条件分岐] 購入済み?
    │
    ├─ Yes → [シナリオ終了] → 購入フォローアップシナリオへ
    │
    └─ No → [メッセージ] 相談予約のご案内
             テンプレート: premium-card
             │
             ▼
             [シナリオ終了]
```

##### シナリオ2: カート放棄リカバリー

```
エントリー条件: cart_abandon イベント
終了条件: 購入完了 or 7日経過

[カート放棄検知]
    │
    ▼
[+3時間] 待機
    │
    ▼
[メッセージ] カート内商品リマインド
    テンプレート: news-card
    内容: 「お買い忘れはありませんか？」+ 商品画像 + 商品名
    │
    ▼
[+24時間] 待機
    │
    ▼
[条件分岐] 購入済み?
    │
    ├─ Yes → [シナリオ終了]
    │
    └─ No → [アクション] カート放棄クーポン(15%OFF)配布
             [メッセージ] クーポン付きリマインド
              テンプレート: premium-card
              内容: 「今だけ15%OFF」+ クーポンコード + 有効期限(48時間)
    │
    ▼
[+48時間] 待機
    │
    ▼
[条件分岐] 購入済み?
    │
    ├─ Yes → [シナリオ終了]
    │
    └─ No → [メッセージ] 最終リマインド
             テンプレート: minimal-text
             内容: 「クーポンの有効期限が近づいています」
             │
             ▼
             [シナリオ終了]
```

##### シナリオ3: 購入フォローアップ

```
エントリー条件: ec_purchase_complete イベント
終了条件: 30日経過

[購入完了]
    │
    ▼
[即座] 購入お礼メッセージ
    テンプレート: premium-card
    内容: お礼 + 注文概要 + 配送目安
    │
    ▼
[+3日] 待機
    │
    ▼
[メッセージ] 利用ガイド / 使い方のコツ
    テンプレート: daily-column
    内容: 購入商品に関連するブログ記事（CTA特化要約）
    │
    ▼
[+14日] 待機
    │
    ▼
[メッセージ] レビュー依頼 + レビュークーポン(300円OFF)
    テンプレート: minimal-text
    内容: レビュー投稿の依頼 + クーポンインセンティブ
    │
    ▼
[+7日] 待機（購入から21日後）
    │
    ▼
[メッセージ] 関連商品レコメンド
    テンプレート: news-card
    内容: 購入商品と関連性の高い商品の紹介
    │
    ▼
[シナリオ終了]
    → リピート購入時は再度エントリー可
```

##### シナリオ4: 再エンゲージメント

```
エントリー条件: 30日間未活動のユーザー（日次バッチで検出）
終了条件: 記事タップ or 90日経過

[30日間未活動検知]
    │
    ▼
[メッセージ] 再エンゲージメントメッセージ1
    テンプレート: visual-magazine
    内容: 「お久しぶりです」+ 直近の人気記事3選
    │
    ▼
[+15日] 待機
    │
    ▼
[条件分岐] 活動再開?
    │
    ├─ Yes → [シナリオ終了]
    │
    └─ No → [アクション] 再エンゲージメントクーポン(20%OFF)配布
             [メッセージ] クーポン付き復帰メッセージ
              テンプレート: premium-card
    │
    ▼
[+15日] 待機
    │
    ▼
[条件分岐] 活動再開?
    │
    ├─ Yes → [シナリオ終了]
    │
    └─ No → [メッセージ] 最終確認
             テンプレート: minimal-text
             内容: 「引き続き配信してよろしいですか？」+ 選択ボタン
    │
    ▼
[+30日] 待機
    │
    ▼
[条件分岐] 応答あり?
    │
    ├─ Yes（配信継続） → [シナリオ終了]
    ├─ Yes（配信停止） → [アクション] 配信対象から除外
    └─ No → [アクション] 配信対象から自動除外
```

##### シナリオ5: 相談予約ナーチャリング

```
エントリー条件: consultation_page_view イベント（予約ページ閲覧）
終了条件: 予約完了 or 30日経過

[相談予約ページ閲覧]
    │
    ▼
[+24時間] 待機
    │
    ▼
[条件分岐] 予約済み?
    │
    ├─ Yes → [シナリオ終了] → 予約フォローシナリオへ
    │
    └─ No → [アクション] 相談予約クーポン配布
             [メッセージ] 相談予約の案内 + クーポン
              テンプレート: premium-card
              内容: 相談のメリット + 「今なら初回無料」クーポン
    │
    ▼
[+3日] 待機
    │
    ▼
[条件分岐] 予約済み?
    │
    ├─ Yes → [シナリオ終了]
    │
    └─ No → [メッセージ] 相談事例紹介
             テンプレート: daily-column
             内容: 過去の相談事例（ブログ記事のCTA特化要約）
    │
    ▼
[+7日] 待機
    │
    ▼
[メッセージ] 最終案内
    テンプレート: minimal-text
    内容: 「クーポンの有効期限が近づいています」+ 予約リンク
    │
    ▼
[シナリオ終了]
```

### 7.3 トリガー配信

#### トリガー定義

ユーザーの特定のアクションをリアルタイムで検知し、即座に（または指定の遅延後に）メッセージを配信する。

```typescript
interface Trigger {
  triggerId: string;
  name: string;
  description: string;
  status: 'active' | 'paused';
  eventName: string;              // 検知するイベント名
  conditions?: TriggerCondition[];  // 追加条件（AND結合）
  delay?: {
    duration: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  action: TriggerAction;
  cooldown?: {
    duration: number;
    unit: 'hours' | 'days';
  };
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface TriggerCondition {
  field: string;
  operator: string;
  value: unknown;
}

interface TriggerAction {
  type: 'send_message' | 'issue_coupon' | 'send_message_with_coupon' | 'start_scenario';
  messageConfig?: {
    templateId: TemplateId;
    contentType: 'article' | 'coupon' | 'custom';
    contentConfig: Record<string, unknown>;
  };
  couponConfig?: {
    couponType: CouponType;
  };
  scenarioId?: string;
}
```

#### 標準トリガー一覧

| トリガー名 | イベント | 遅延 | アクション | クールダウン |
|-----------|---------|------|-----------|------------|
| ウェルカム配信 | `follow` | なし | ウェルカムメッセージ + クーポン + ウェルカムシナリオ開始 | - |
| 記事タップフォローアップ | `article_link_tap` | 24時間 | 関連記事レコメンド配信 | 72時間 |
| EC商品閲覧リマインド | `ec_product_view` | 1時間 | 閲覧商品リマインド配信 | 24時間 |
| カート追加通知 | `ec_cart_add` | なし | （内部記録のみ。カート放棄シナリオのトリガーポイント） | - |
| カート放棄検知 | `cart_abandon` | なし | カート放棄リカバリーシナリオ開始 | 72時間 |
| 購入完了 | `ec_purchase_complete` | なし | 購入お礼メッセージ + 購入フォローアップシナリオ開始 | - |
| 相談予約ページ閲覧 | `consultation_page_view` | なし | 相談予約ナーチャリングシナリオ開始 | 7日 |
| 相談予約完了 | `consultation_booking_complete` | なし | 予約確認メッセージ | - |
| 相談予約前日リマインド | `consultation_reminder` (日次バッチ) | なし | 予約リマインドメッセージ | - |
| 誕生日クーポン | `birthday_detected` (日次バッチ) | なし | バースデークーポン + お祝いメッセージ | 年1回 |
| 休眠ユーザー検知 | `dormant_detected` (日次バッチ) | なし | 再エンゲージメントシナリオ開始 | 90日 |
| ファネルステージ遷移 | `funnel_stage_changed` | なし | ステージ別のウェルカムメッセージ | 24時間 |

### 7.4 イベントトラッキング

#### イベント一覧

トリガー配信とシナリオ配信の基盤となるイベントの定義。

```typescript
interface TrackingEvent {
  eventId: string;
  eventName: string;
  userId: string;
  timestamp: string;              // ISO 8601
  properties: Record<string, unknown>;
  source: 'line_webhook' | 'ec_webhook' | 'crm_webhook' | 'batch_job' | 'manual';
}
```

| イベント名 | ソース | 主要プロパティ |
|-----------|--------|---------------|
| `follow` | line_webhook | - |
| `unfollow` | line_webhook | - |
| `message_sent` | 内部 | templateId, articleUrl, segmentId |
| `message_opened` | line_webhook | messageId |
| `article_link_tap` | line_webhook (postback) | articleUrl, articleCategory |
| `ec_product_view` | ec_webhook | productId, productName, price |
| `ec_cart_add` | ec_webhook | productId, quantity, cartTotal |
| `cart_abandon` | batch_job (1時間ごと) | cartId, cartTotal, productIds |
| `ec_purchase_complete` | ec_webhook | orderId, orderTotal, productIds |
| `consultation_page_view` | ec_webhook / tracking | pageUrl |
| `consultation_booking_complete` | crm_webhook | bookingId, bookingDate |
| `consultation_reminder` | batch_job (日次) | bookingId, bookingDate |
| `coupon_issued` | 内部 | couponId, couponCode, couponType |
| `coupon_used` | ec_webhook | couponCode, orderId, orderTotal |
| `birthday_detected` | batch_job (日次) | birthday |
| `dormant_detected` | batch_job (日次) | lastActiveAt, daysSinceLastActive |
| `funnel_stage_changed` | 内部 | fromStage, toStage |

### 7.5 配信制御ルール

シナリオ配信とトリガー配信が競合した場合の制御ルール。

| ルール | 説明 |
|--------|------|
| 日次配信上限の遵守 | 1ユーザーあたり1日2通の上限を、シナリオ配信+トリガー配信の合計で遵守 |
| トリガー優先 | 日次配信枠の残りが1通の場合、スケジュール配信よりトリガー配信を優先 |
| シナリオ重複回避 | 同一ユーザーが同時に実行可能なシナリオは最大3つまで |
| クールダウンの遵守 | トリガーごとのクールダウン期間内は同じトリガーを再発火しない |
| 配信抑止期間 | ユーザーがブロック後に再友だち追加した場合、24時間は配信抑止 |
| 時間帯制限 | 22:00-7:00の間はトリガー配信を遅延し、翌朝7:00以降に配信 |

### 7.6 シナリオ実行エンジン

```typescript
interface ScenarioExecution {
  executionId: string;
  scenarioId: string;
  userId: string;
  status: 'running' | 'completed' | 'exited' | 'error';
  currentStepId: string;
  stepHistory: StepExecution[];
  enteredAt: string;
  completedAt?: string;
  exitReason?: string;
}

interface StepExecution {
  stepId: string;
  executedAt: string;
  result: 'success' | 'skipped' | 'error';
  nextStepId?: string;
  error?: string;
}
```

#### 実行フロー

```
[Cronジョブ / イベント検知]
    │
    ▼
[エントリー条件チェック]
    │
    ▼
[ScenarioExecution 作成]
    │
    ▼
[ステップ実行ループ]
    │
    ├─ message → 配信上限チェック → メッセージ送信 → 次のステップ
    ├─ wait → 待機時間をスケジュール登録 → Cronで再開
    ├─ condition → 条件評価 → 分岐先のステップへ
    └─ action → アクション実行（クーポン発行等） → 次のステップ
    │
    ▼
[終了条件チェック（各ステップ実行後）]
    │
    ├─ 終了条件成立 → status='exited' + exitReason記録
    └─ 最終ステップ完了 → status='completed'
```

### 7.7 管理画面要件

| 画面 | 機能 |
|------|------|
| シナリオ一覧 | シナリオの一覧表示、ステータス管理（有効化/一時停止/アーカイブ） |
| シナリオ編集 | ビジュアルフローエディタによるシナリオ設計 |
| シナリオ実行状況 | 現在実行中のユーザー数、ステップ別の到達率、完了/離脱率 |
| トリガー一覧 | トリガーの一覧表示、有効/無効の切り替え |
| トリガー設定 | イベント・条件・アクション・クールダウンの設定 |
| イベントログ | 直近のイベントログ一覧、フィルタリング、検索 |
| 配信キュー | 配信待ちメッセージの一覧、優先度の確認 |

---

## 付録: 実装優先度と依存関係

### フェーズ1: 基盤構築（1-2ヶ月目）

| 優先度 | 機能 | 依存 |
|--------|------|------|
| P0 | ユーザープロファイルDB設計・構築 | なし |
| P0 | イベントトラッキング基盤 | なし |
| P0 | セグメント定義・管理 | ユーザープロファイル |
| P1 | Multicast API実装 | セグメント |
| P1 | 基本KPIの計測・表示 | イベントトラッキング |

### フェーズ2: パーソナライゼーション（3-4ヶ月目）

| 優先度 | 機能 | 依存 |
|--------|------|------|
| P0 | 要約バリエーション生成 | なし |
| P0 | セグメント別配信 | フェーズ1完了 |
| P1 | テンプレート自動選択 | イベントトラッキング |
| P1 | 配信タイミング最適化 | イベントトラッキング |
| P2 | カテゴリ親和性スコアリング | イベントトラッキング |

### フェーズ3: EC・CRM連携（5-6ヶ月目）

| 優先度 | 機能 | 依存 |
|--------|------|------|
| P0 | ECサイトWebhook連携 | なし |
| P0 | クーポン発行・管理基盤 | ECサイト連携 |
| P0 | 相談予約システム連携 | CRM連携 |
| P1 | CRM顧客データ同期 | CRM連携 |
| P1 | ファネルステージ自動遷移 | フェーズ1 + フェーズ2完了 |

### フェーズ4: オートメーション（7-8ヶ月目）

| 優先度 | 機能 | 依存 |
|--------|------|------|
| P0 | トリガー配信エンジン | フェーズ1-3完了 |
| P0 | ウェルカムシナリオ | トリガー配信 |
| P0 | カート放棄リカバリー | EC連携 + トリガー配信 |
| P1 | 購入フォローアップシナリオ | EC連携 + トリガー配信 |
| P1 | 再エンゲージメントシナリオ | トリガー配信 |
| P2 | 相談予約ナーチャリングシナリオ | 相談予約連携 + トリガー配信 |

### フェーズ5: 最適化（9ヶ月目以降）

| 優先度 | 機能 | 依存 |
|--------|------|------|
| P1 | A/Bテスト基盤 | フェーズ1-4完了 |
| P1 | KPIダッシュボード拡充 | フェーズ1-4完了 |
| P2 | 配信時間帯のAI最適化 | A/Bテスト基盤 |
| P2 | LTV予測モデル | 十分なデータ蓄積後 |
| P2 | 紹介プログラム | ロイヤルユーザー基盤 |
