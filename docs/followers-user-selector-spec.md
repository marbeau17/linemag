# フォロワー一覧取得 & ユーザー選択UI 仕様書

## 1. 概要

LINE Messaging API の「Get Follower IDs」と「Get Profile」API を使い、友だち（フォロワー）一覧を取得する。
ダッシュボードの Step 4 で、テスト配信・個別配信時にユーザーを選択式で指定できるようにする。

現状は User ID を手入力する必要があるが、本機能追加により：
- フォロワー一覧をワンクリックで取得
- プロフィール画像・表示名付きのリストからユーザーを選択
- 検索フィルターで素早く対象ユーザーを絞り込み

が可能になる。

---

## 2. LINE API 仕様

### 2.1 Get Follower IDs API

| 項目 | 内容 |
|------|------|
| Endpoint | `GET https://api.line.me/v2/bot/followers/ids` |
| Headers | `Authorization: Bearer {channel access token}` |
| Query Params | `start` (continuation token for pagination), `limit` (max 1000, default 300) |
| Response | `{ userIds: string[], next?: string }` |

**注意事項:**
- ボットを友だち追加済み かつ ブロックしていないユーザーのみ返却される
- LINE Official Account が **Verified** または **Certified** でないと利用不可（未認証アカウントでは 403 エラー）
- ページネーション: `next` トークンが存在する限り繰り返しリクエスト

```typescript
// Response type
interface GetFollowerIdsResponse {
  userIds: string[];
  next?: string; // continuation token, absent on last page
}
```

### 2.2 Get Profile API

| 項目 | 内容 |
|------|------|
| Endpoint | `GET https://api.line.me/v2/bot/profile/{userId}` |
| Headers | `Authorization: Bearer {channel access token}` |
| Response | `{ userId: string, displayName: string, pictureUrl?: string, statusMessage?: string }` |

```typescript
// Response type
interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}
```

### 2.3 Rate Limits

| API | Rate Limit |
|-----|-----------|
| Get Follower IDs | リクエスト制限なし（ただし常識的な間隔で） |
| Get Profile | 2,000 requests/second（十分余裕あり） |

---

## 3. 実装仕様

### 3.1 バックエンド

#### `src/lib/line/followers.ts` — フォロワー取得ロジック

```typescript
// fetchAllFollowerIds(): ページネーション対応で全フォロワーID取得
export async function fetchAllFollowerIds(
  channelAccessToken: string
): Promise<string[]>

// fetchUserProfile(userId): 個別プロフィール取得
export async function fetchUserProfile(
  channelAccessToken: string,
  userId: string
): Promise<LineUserProfile>

// fetchFollowersWithProfiles(): ID取得 → プロフィール並列取得
// max 20件ずつ並列リクエスト（rate limit考慮）
export async function fetchFollowersWithProfiles(
  channelAccessToken: string
): Promise<FollowerWithProfile[]>
```

**処理フロー:**

```
fetchFollowersWithProfiles()
  │
  ├─ 1. fetchAllFollowerIds()
  │      └─ GET /followers/ids (loop until no `next` token)
  │
  ├─ 2. userIds を 20件ずつチャンクに分割
  │
  └─ 3. 各チャンクを Promise.all() で並列取得
         └─ fetchUserProfile(userId) × 20
         └─ 次のチャンクへ（sequential between chunks）
```

#### `src/app/api/line/followers/route.ts` — GET API エンドポイント

```typescript
// GET /api/line/followers
// Returns: { followers: FollowerWithProfile[], count: number }

interface FollowerWithProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

interface FollowersResponse {
  followers: FollowerWithProfile[];
  count: number;
}
```

#### `src/lib/line/config.ts` — URL 追加

```typescript
// 追加する設定値
export const LINE_API_URLS = {
  // ... existing URLs
  followersUrl: 'https://api.line.me/v2/bot/followers/ids',
  profileUrl: 'https://api.line.me/v2/bot/profile',
} as const;
```

### 3.2 フロントエンド（`src/app/dashboard/page.tsx`）

#### State 追加

```typescript
const [followers, setFollowers] = useState<FollowerWithProfile[]>([]);
const [followersLoading, setFollowersLoading] = useState(false);
const [followerSearch, setFollowerSearch] = useState('');
const [selectedFollower, setSelectedFollower] = useState<FollowerWithProfile | null>(null);
```

#### 動作仕様

1. Step 4 の「個別配信」ラジオボタン選択時に、テキスト入力の代わりにユーザー選択 UI を表示
2. 「フォロワー一覧を取得」ボタンクリック → `/api/line/followers` を呼び出し
3. 取得成功 → フォロワーリストをドロップダウン/リスト形式で表示
4. 各ユーザー行: プロフィール画像（丸アイコン 32px）+ 表示名 + User ID（小さめグレー文字）
5. ユーザー選択 → `pushUserId` state に自動セット
6. テスト配信ボタンも同じユーザー選択 UI を利用可能
7. 検索フィルター: `displayName` での部分一致フィルタリング

### 3.3 UI 設計

```
配信先:
  ○ 全体配信    ○ 個別配信

  [フォロワー一覧を取得] (ボタン)

  ┌─────────────────────────────────┐
  │ 🔍 ユーザー検索...              │ (フィルター入力)
  ├─────────────────────────────────┤
  │ [📷] 田中太郎         ← 選択中  │
  │      Uxxxxxxxxxxxx             │
  ├─────────────────────────────────┤
  │ [📷] 鈴木花子                   │
  │      Uyyyyyyyyyyyy             │
  ├─────────────────────────────────┤
  │ [📷] 佐藤一郎                   │
  │      Uzzzzzzzzzzzz             │
  └─────────────────────────────────┘
  3人のフォロワー
```

**UI コンポーネント詳細:**

| 要素 | 仕様 |
|------|------|
| 「フォロワー一覧を取得」ボタン | loading中はスピナー表示、取得済みなら「再取得」テキストに変更 |
| プロフィール画像 | `rounded-full w-8 h-8`、画像なしの場合はデフォルトアイコン表示 |
| 選択中の行 | `bg-green-50 border-l-4 border-green-500` でハイライト |
| 検索フィルター | `displayName` で前方一致/部分一致。入力中にリアルタイムフィルタ |
| フォロワー数表示 | リスト下部に `{count}人のフォロワー` を表示 |
| リスト最大高さ | `max-h-60 overflow-y-auto` でスクロール対応 |

---

## 4. ファイル変更一覧

| 操作 | ファイルパス | 内容 |
|------|-------------|------|
| 新規 | `src/lib/line/followers.ts` | フォロワー取得・プロフィール取得ロジック |
| 新規 | `src/app/api/line/followers/route.ts` | GET `/api/line/followers` エンドポイント |
| 変更 | `src/lib/line/config.ts` | `followersUrl`, `profileUrl` 追加 |
| 変更 | `src/app/dashboard/page.tsx` | ユーザー選択 UI 追加（Step 4） |
| 変更 | `vercel.json` | `/api/line/followers` の timeout 設定追加 |

---

## 5. エラーハンドリング

| HTTP Status | 原因 | 対応 |
|-------------|------|------|
| 401 | Channel Access Token が無効または期限切れ | エラーメッセージ表示:「チャネルアクセストークンが無効です。設定を確認してください。」 |
| 403 | 未認証アカウント（Unverified）で Get Follower IDs API を呼び出した | エラーメッセージ表示:「フォロワー一覧の取得には認証済み LINE 公式アカウントが必要です。」→ 手動 User ID 入力にフォールバック |
| 429 | Rate limit exceeded | リトライ（exponential backoff、max 3回） |
| Network Error | タイムアウト等 | エラーメッセージ表示 + リトライボタン |

### フォールバック動作

Get Follower IDs API が 403 で失敗した場合：

```
  ┌─────────────────────────────────────────────┐
  │ ⚠ フォロワー一覧の取得には認証済みLINE公式   │
  │   アカウントが必要です。                      │
  │   User IDを直接入力してください。             │
  └─────────────────────────────────────────────┘
  User ID: [Uxxxxxxxxxxxxxxxxx          ]
```

従来のテキスト入力フィールドを表示し、手動入力を可能にする。

---

## 6. セキュリティ考慮事項

- Channel Access Token はサーバーサイドのみで使用（クライアントに露出しない）
- `/api/line/followers` エンドポイントは認証済みセッション必須
- User ID 等の個人情報はブラウザの localStorage に保存しない
- API レスポンスにはプロフィール情報の最小限（`userId`, `displayName`, `pictureUrl`）のみ含める（`statusMessage` は除外）

---

## 7. 今後の拡張（スコープ外）

- フォロワーリストのキャッシュ（Redis/KV）
- 複数ユーザー選択によるマルチキャスト配信
- タグ・セグメント別のフォロワー絞り込み
- フォロワー数の定期自動取得・ダッシュボード表示
