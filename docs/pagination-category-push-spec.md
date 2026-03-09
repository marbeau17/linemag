# LineMag 機能追加仕様書: ページネーション・カテゴリー絞り込み・個別配信

**作成日:** 2026-03-09
**対象プロジェクト:** LineMag LINE Broadcast System
**ステータス:** Draft

---

## 目次

1. [記事一覧ページネーション](#1-記事一覧ページネーション)
2. [カテゴリー絞り込み](#2-カテゴリー絞り込み)
3. [個別配信 (Push API)](#3-個別配信-push-api)
4. [実装順序と依存関係](#4-実装順序と依存関係)

---

## 1. 記事一覧ページネーション

### 現状

スクレイパー (`src/lib/line/scraper.ts`) の `fetchArticleList()` は全記事を取得するが、
`config.blog.maxArticlesPerScrape = 5` により `scrapeLatestArticles()` で最大5件に制限される。
ダッシュボードの Step 2（記事選択）では5件がそのまま表示される。

### 変更内容

#### 1-1. スクレイパー側の変更

`scrapeLatestArticles()` の5件制限を撤廃し、`fetchArticleList()` が返す全記事を返却する。

**対象ファイル:** `src/lib/line/scraper.ts`

```
// 変更前: list を maxArticlesPerScrape で slice していた場合、その制限を除去
// 変更後: fetchArticleList() の返却をそのまま全件処理
```

`config.blog.maxArticlesPerScrape` は設定として残すが、スクレイパーでは使用しない。
将来の cron 自動配信で参照する可能性があるため削除はしない。

#### 1-2. API レスポンス

`POST /api/line/scrape-list` のレスポンスは変更なし。
全記事を `articles` 配列で返す。件数が増えるのみ。

```json
{
  "articles": [ ... ],   // 全件
  "count": 42,
  "logs": [ ... ]
}
```

#### 1-3. クライアント側ページネーション

Step 2 の記事一覧にクライアントサイドのページネーションを実装する。

| 項目 | 値 |
|---|---|
| ページサイズ | 10件 / ページ |
| 初期ページ | 1 |
| ページ切り替え時 | 選択中の記事・詳細キャッシュを保持 |

#### 1-4. ページネーション State

```typescript
// ページネーション用 state
const [currentPage, setCurrentPage] = useState(1);
const PAGE_SIZE = 10;

// 表示対象の記事（フィルタリング後 → ページネーション）
const displayedArticles = filteredArticles.slice(
  (currentPage - 1) * PAGE_SIZE,
  currentPage * PAGE_SIZE
);
const totalPages = Math.ceil(filteredArticles.length / PAGE_SIZE);
```

#### 1-5. UI モックアップ

```
┌─────────────────────────────────────────────────┐
│  Step 2: 記事を選択                              │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ カテゴリー: [すべて          ▼]             │ │  ← Feature 2 で追加
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ ● 記事タイトル A                            │ │
│  │   カテゴリー: お知らせ | 2026-03-01         │ │
│  ├─────────────────────────────────────────────┤ │
│  │ ○ 記事タイトル B                            │ │
│  │   カテゴリー: コラム   | 2026-02-28         │ │
│  ├─────────────────────────────────────────────┤ │
│  │ ○ 記事タイトル C                            │ │
│  │   カテゴリー: お知らせ | 2026-02-25         │ │
│  ├─────────────────────────────────────────────┤ │
│  │                 ...                         │ │
│  │            (10件表示)                        │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │   [前へ]     ページ 1 / 5     [次へ]        │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 1-6. ページネーションボタン仕様

| ボタン | ラベル | 無効条件 |
|---|---|---|
| 前へ | `前へ` | `currentPage === 1` |
| 次へ | `次へ` | `currentPage === totalPages` |
| ページ表示 | `ページ {current} / {total}` | — |

**ページ切り替え動作:**
- ページ遷移時、選択済み記事 (`selectedArticle`) と詳細キャッシュ (`articleDetail`) はクリアしない
- 選択中の記事が現在のページに含まれない場合でも選択状態は維持する
- ページ切り替え時にスクロール位置を記事一覧の先頭にリセットする

---

## 2. カテゴリー絞り込み

### 現状

スクレイパーは記事ごとに `category` フィールドを抽出済み (`ArticleListItem.category`)。
しかしダッシュボードではカテゴリー情報を表示・フィルターに利用していない。

### 変更内容

#### 2-1. カテゴリー一覧の抽出

```typescript
// スクレイプ結果からユニークなカテゴリーを抽出
const categories = useMemo(() => {
  const cats = articles
    .map(a => a.category)
    .filter((c): c is string => c !== null && c !== '');
  return ['すべて', ...Array.from(new Set(cats))];
}, [articles]);
```

#### 2-2. フィルター State

```typescript
const [selectedCategory, setSelectedCategory] = useState('すべて');

// フィルター適用（ページネーション前に実行）
const filteredArticles = useMemo(() => {
  if (selectedCategory === 'すべて') return articles;
  return articles.filter(a => a.category === selectedCategory);
}, [articles, selectedCategory]);
```

#### 2-3. フィルター変更時のページリセット

```typescript
const handleCategoryChange = (category: string) => {
  setSelectedCategory(category);
  setCurrentPage(1);  // フィルター変更時はページ1に戻す
};
```

#### 2-4. UI モックアップ

```
┌──────────────────────────────────────────┐
│ カテゴリー: [すべて          ▼]          │
│             ┌──────────────────┐         │
│             │ すべて        ✓  │         │
│             │ お知らせ         │         │
│             │ コラム           │         │
│             │ イベント         │         │
│             │ キャンペーン     │         │
│             └──────────────────┘         │
└──────────────────────────────────────────┘
```

ドロップダウンは HTML `<select>` 要素で実装する。

#### 2-5. カテゴリーが null の記事の扱い

- `category` が `null` または空文字の記事は「すべて」表示時のみ表示される
- 特定カテゴリーでフィルターした場合、`category` が `null` の記事は非表示
- 必要に応じて「未分類」カテゴリーの追加を将来検討

#### 2-6. データフロー

```
fetchArticleList() → 全記事 (articles[])
    ↓
カテゴリー絞り込み (selectedCategory)
    ↓
filteredArticles[]
    ↓
ページネーション (currentPage, PAGE_SIZE)
    ↓
displayedArticles[] → 画面表示
```

---

## 3. 個別配信 (Push API)

### 現状

- `src/lib/line/messaging.ts` に `sendBroadcast()` (全体配信) と `sendPush()` (テスト配信用) が存在
- `sendPush()` は `testBroadcastArticle()` 内部でのみ使用され、管理者 `ADMIN_LINE_USER_ID` への送信に限定
- 公開 API エンドポイントは `POST /api/line/broadcast` のみ
- ダッシュボード Step 4 では Broadcast（全体配信）のみ選択可能

### 変更内容

#### 3-1. 新規 API エンドポイント

**`POST /api/line/push`**

**対象ファイル (新規):** `src/app/api/line/push/route.ts`

**リクエストボディ:**

```typescript
interface PushRequest {
  userId: string;          // LINE User ID (U で始まる33文字)
  articleUrl: string;
  summaryTitle: string;
  summaryText: string;
  thumbnailUrl: string | null;
  templateId: TemplateId;
  articleCategory?: string;
}
```

**レスポンス (成功):**

```json
{
  "success": true,
  "sentAt": "2026-03-09T10:30:00.000Z"
}
```

**レスポンス (エラー):**

```json
{
  "error": "エラーメッセージ",
  "status": 400
}
```

**バリデーション:**

| フィールド | ルール |
|---|---|
| `userId` | 必須。`/^U[0-9a-f]{32}$/` に一致すること |
| `articleUrl` | 必須。空文字不可 |
| `summaryTitle` | 必須。空文字不可 |
| `summaryText` | 必須。空文字不可 |
| `templateId` | 必須。有効な `TemplateId` であること |

#### 3-2. messaging.ts の変更

**対象ファイル:** `src/lib/line/messaging.ts`

既存の `sendPush()` は private 関数としてそのまま維持。
新たに `pushArticle()` を公開関数として追加する。

```typescript
/**
 * 個別配信 — 指定ユーザーにPush送信
 */
export async function pushArticle(
  userId: string,
  req: BroadcastRequest
): Promise<BroadcastResult> {
  try {
    const flex: FlexContainer = buildFlexMessage(req);
    await sendPush(userId, [
      {
        type: 'flex',
        altText: `${req.summaryTitle}\n\n${req.summaryText}\n\n${req.articleUrl}`,
        contents: flex,
      },
    ]);
    return { success: true, sentAt: new Date().toISOString() };
  } catch (error) {
    return {
      success: false,
      sentAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

**エクスポート一覧 (変更後):**

| 関数 | 用途 |
|---|---|
| `broadcastArticle(req)` | 全体配信 (既存・変更なし) |
| `testBroadcastArticle(req)` | テスト配信 (既存・変更なし) |
| `pushArticle(userId, req)` | 個別配信 (新規) |

#### 3-3. route.ts 実装

**対象ファイル (新規):** `src/app/api/line/push/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { pushArticle } from '@/lib/line/messaging';
import type { BroadcastRequest, TemplateId } from '@/types/line';

const LINE_USER_ID_REGEX = /^U[0-9a-f]{32}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バリデーション
    if (!body.userId || !LINE_USER_ID_REGEX.test(body.userId)) {
      return NextResponse.json(
        { error: 'userId が無効です。LINE User ID (U + 32桁hex) を指定してください。' },
        { status: 400 }
      );
    }
    if (!body.articleUrl || !body.summaryTitle || !body.summaryText || !body.templateId) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (articleUrl, summaryTitle, summaryText, templateId)' },
        { status: 400 }
      );
    }

    const req: BroadcastRequest = {
      articleUrl: body.articleUrl,
      articleTitle: body.articleTitle || '',
      summaryTitle: body.summaryTitle,
      summaryText: body.summaryText,
      thumbnailUrl: body.thumbnailUrl || null,
      templateId: body.templateId as TemplateId,
      articleCategory: body.articleCategory,
    };

    const result = await pushArticle(body.userId, req);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '個別配信に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sentAt: result.sentAt });
  } catch (error) {
    console.error('[push]', error);
    return NextResponse.json(
      { error: '個別配信処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
```

#### 3-4. ダッシュボード Step 4 の変更

Step 4（配信確認・送信）に配信モード選択を追加する。

**State 追加:**

```typescript
type DeliveryMode = 'broadcast' | 'push';

const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('broadcast');
const [pushUserId, setPushUserId] = useState('');
```

#### 3-5. UI モックアップ — 配信モード選択

```
┌─────────────────────────────────────────────────┐
│  Step 4: 配信確認                                │
│                                                  │
│  ── 配信モード ──────────────────────────────── │
│                                                  │
│  (●) 全体配信（Broadcast）                       │
│      全フォロワーに一斉配信します                │
│                                                  │
│  ( ) 個別配信（Push）                            │
│      指定したユーザーにのみ配信します            │
│                                                  │
└─────────────────────────────────────────────────┘
```

**個別配信モード選択時:**

```
┌─────────────────────────────────────────────────┐
│  Step 4: 配信確認                                │
│                                                  │
│  ── 配信モード ──────────────────────────────── │
│                                                  │
│  ( ) 全体配信（Broadcast）                       │
│      全フォロワーに一斉配信します                │
│                                                  │
│  (●) 個別配信（Push）                            │
│      指定したユーザーにのみ配信します            │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ LINE User ID:                               │ │
│  │ [U________________________________]         │ │
│  │ ※ Uで始まる33文字のユーザーIDを入力         │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ── プレビュー ─────────────────────────────── │
│                                                  │
│  ┌─────────────────────┐                        │
│  │   [Flex Message]    │                        │
│  │   プレビュー表示    │                        │
│  └─────────────────────┘                        │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────┐     │
│  │   テスト配信      │  │   個別配信する    │     │
│  └──────────────────┘  └──────────────────┘     │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 3-6. 配信ボタンのラベル切り替え

| 配信モード | メインボタンラベル | API エンドポイント |
|---|---|---|
| `broadcast` | `配信する` | `POST /api/line/broadcast` |
| `push` | `個別配信する` | `POST /api/line/push` |

#### 3-7. バリデーション (フロント)

個別配信モード時、送信ボタンの活性条件に `pushUserId` のバリデーションを追加:

```typescript
const isValidUserId = /^U[0-9a-f]{32}$/.test(pushUserId);

const canSend =
  deliveryMode === 'broadcast'
    ? /* 既存のバリデーション */
    : /* 既存のバリデーション */ && isValidUserId;
```

User ID が不正な場合、入力欄の下にエラーメッセージを表示:

```
[Uabc123                         ]
⚠ LINE User ID の形式が正しくありません（U + 32桁の16進数）
```

---

## 4. 実装順序と依存関係

```
Feature 1: ページネーション
    ↓ (filteredArticles を使用)
Feature 2: カテゴリー絞り込み
    ↓ (独立)
Feature 3: 個別配信 (Push API)
```

### 推奨実装順序

| 順序 | 機能 | 理由 |
|---|---|---|
| 1 | カテゴリー絞り込み | ページネーションの `filteredArticles` の基盤となる |
| 2 | ページネーション | カテゴリー絞り込み後の配列に対して適用 |
| 3 | 個別配信 | 他の2機能と独立しており、単独で実装・テスト可能 |

### 変更対象ファイル一覧

| ファイル | 変更種別 | 対象機能 |
|---|---|---|
| `src/lib/line/scraper.ts` | 修正 | 1 (maxArticlesPerScrape 制限撤廃) |
| `src/lib/line/messaging.ts` | 修正 | 3 (pushArticle 追加) |
| `src/app/api/line/push/route.ts` | 新規 | 3 (Push API エンドポイント) |
| ダッシュボード (Step 2 コンポーネント) | 修正 | 1, 2 (ページネーション + カテゴリー) |
| ダッシュボード (Step 4 コンポーネント) | 修正 | 3 (配信モード選択) |

---

## 補足: config.ts への追加

ページネーションのページサイズを config に集約する:

```typescript
// src/lib/line/config.ts
export const config = {
  // ... 既存設定 ...
  dashboard: {
    articlesPerPage: 10,
  },
} as const;
```
