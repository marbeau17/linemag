# 13. 認証・認可・セキュリティ仕様

## 目次

1. [システム構成概要](#1-システム構成概要)
2. [認証フロー設計](#2-認証フロー設計)
3. [認可設計（RBAC）](#3-認可設計rbac)
4. [Supabase RLS ポリシー設計](#4-supabase-rls-ポリシー設計)
5. [API 保護](#5-api-保護)
6. [環境変数・シークレット管理](#6-環境変数シークレット管理)
7. [CORS 設定](#7-cors-設定)
8. [XSS / CSRF 対策](#8-xss--csrf-対策)
9. [個人情報保護](#9-個人情報保護)

---

## 1. システム構成概要

```
┌──────────────────────────────────────────────────────────────────┐
│  クライアント層                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │ 管理画面 (Next.js)  │    │ 顧客向け LIFF アプリ         │    │
│  │ - スタッフ操作      │    │ - LINE 内ブラウザで動作      │    │
│  │ - Supabase Auth     │    │ - LIFF SDK + LINE ログイン   │    │
│  └────────┬────────────┘    └──────────────┬───────────────┘    │
│           │                                │                     │
└───────────┼────────────────────────────────┼─────────────────────┘
            │                                │
┌───────────┼────────────────────────────────┼─────────────────────┐
│  API 層 (Next.js Route Handlers)           │                     │
│  ┌────────┴───────────┐    ┌───────────────┴──────────────┐     │
│  │ /api/admin/*       │    │ /api/liff/*                   │     │
│  │ JWT 検証必須       │    │ LIFF トークン検証             │     │
│  └────────┬───────────┘    └───────────────┬──────────────┘     │
│           │                                │                     │
│  ┌────────┴────────────────────────────────┴──────────────┐     │
│  │ /api/line/webhook    (LINE 署名検証)                    │     │
│  │ /api/cron/*          (CRON_SECRET 検証)                 │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
            │
┌───────────┼──────────────────────────────────────────────────────┐
│  データ層                                                        │
│  ┌────────┴───────────┐    ┌──────────────────────────────┐     │
│  │ Supabase           │    │ 外部 API                      │     │
│  │ - PostgreSQL + RLS │    │ - LINE Messaging API          │     │
│  │ - Auth             │    │ - Google Meet API             │     │
│  │ - Storage          │    │ - EC 外部 API                 │     │
│  └────────────────────┘    └──────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

### インターフェース一覧

| インターフェース | 認証方式 | 対象ユーザー |
|---|---|---|
| 管理画面 | Supabase Auth（Email/Password） | スタッフ（admin / staff） |
| LIFF アプリ | LINE ログイン（LIFF SDK） -> Supabase 連携 | 顧客（customer） |
| Webhook エンドポイント | LINE 署名検証（X-Line-Signature） | LINE プラットフォーム |
| Cron エンドポイント | Bearer トークン（CRON_SECRET） | Vercel Cron |

---

## 2. 認証フロー設計

### 2.1 管理画面：スタッフログイン

Supabase Auth の Email/Password 認証を使用する。

```
スタッフ          管理画面 (Next.js)         Supabase Auth
  │                    │                         │
  │  Email/Password    │                         │
  ├───────────────────>│                         │
  │                    │  signInWithPassword()   │
  │                    ├────────────────────────>│
  │                    │                         │  認証情報検証
  │                    │                         │  JWT 生成
  │                    │   access_token          │
  │                    │   refresh_token         │
  │                    │<────────────────────────┤
  │                    │                         │
  │                    │  セッション Cookie 設定  │
  │                    │  (httpOnly, secure)      │
  │  ダッシュボード    │                         │
  │<───────────────────┤                         │
```

**実装方針**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

```typescript
// src/app/(admin)/login/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  if (error) {
    return { error: error.message };
  }
  redirect('/dashboard');
}
```

**セッション管理**

| 項目 | 設定値 |
|---|---|
| access_token 有効期限 | 1 時間（Supabase デフォルト） |
| refresh_token 有効期限 | 7 日間 |
| Cookie 属性 | `httpOnly`, `secure`, `SameSite=Lax` |
| セッション更新 | Middleware で自動リフレッシュ |

### 2.2 顧客向け：LINE ログイン -> Supabase 連携

LIFF SDK による LINE ログインを実施し、取得した LINE ユーザー情報を Supabase Auth と連携する。

```
顧客              LIFF アプリ           LINE Platform        Supabase
 │                    │                     │                   │
 │  LIFF 起動         │                     │                   │
 ├───────────────────>│                     │                   │
 │                    │  liff.init()        │                   │
 │                    ├────────────────────>│                   │
 │                    │                     │                   │
 │                    │  liff.login()       │                   │
 │                    ├────────────────────>│                   │
 │                    │                     │  LINE 認証画面    │
 │  LINE ログイン     │                     │                   │
 │<───────────────────┤─────────────────────┤                   │
 │  同意・認証        │                     │                   │
 ├───────────────────>│                     │                   │
 │                    │  access_token       │                   │
 │                    │  id_token           │                   │
 │                    │<────────────────────┤                   │
 │                    │                     │                   │
 │                    │  POST /api/liff/auth                    │
 │                    │  { idToken, accessToken }               │
 │                    ├────────────────────────────────────────>│
 │                    │                     │                   │
 │                    │           id_token 検証 (LINE API)      │
 │                    │           ユーザー検索 or 作成           │
 │                    │           Supabase JWT 発行             │
 │                    │                     │                   │
 │                    │  { supabaseToken, user }                │
 │                    │<────────────────────────────────────────┤
 │                    │                     │                   │
 │                    │  supabase.auth      │                   │
 │                    │  .setSession()      │                   │
 │  LIFF コンテンツ   │                     │                   │
 │<───────────────────┤                     │                   │
```

**LINE ID Token 検証（サーバー側）**

```typescript
// src/app/api/liff/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // サーバー専用
);

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  // 1. LINE ID Token を LINE API で検証
  const lineVerifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
    }),
  });

  if (!lineVerifyRes.ok) {
    return NextResponse.json({ error: 'LINE token verification failed' }, { status: 401 });
  }

  const lineProfile = await lineVerifyRes.json();
  // lineProfile: { sub, name, picture, email? }

  // 2. Supabase ユーザー検索 or 作成
  const { data: existingUser } = await supabaseAdmin
    .from('customers')
    .select('id, supabase_user_id')
    .eq('line_user_id', lineProfile.sub)
    .single();

  let supabaseUserId: string;

  if (existingUser?.supabase_user_id) {
    supabaseUserId = existingUser.supabase_user_id;
  } else {
    // 新規ユーザー作成
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${lineProfile.sub}@line.liff.local`,  // ダミーメール
      user_metadata: {
        line_user_id: lineProfile.sub,
        display_name: lineProfile.name,
        picture_url: lineProfile.picture,
        role: 'customer',
      },
      email_confirm: true,
    });

    if (error || !newUser.user) {
      return NextResponse.json({ error: 'User creation failed' }, { status: 500 });
    }
    supabaseUserId = newUser.user.id;

    // customers テーブルにも登録
    await supabaseAdmin.from('customers').upsert({
      supabase_user_id: supabaseUserId,
      line_user_id: lineProfile.sub,
      display_name: lineProfile.name,
      picture_url: lineProfile.picture,
    });
  }

  // 3. カスタム JWT 生成（Supabase セッション用）
  const { data: session, error: sessionError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${lineProfile.sub}@line.liff.local`,
    });

  // ... セッショントークンを返却
}
```

**LIFF クライアント側**

```typescript
// src/lib/liff/auth.ts
import liff from '@line/liff';

export async function initializeLiff() {
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('ID Token not available');

  // サーバー側で検証 + Supabase 連携
  const res = await fetch('/api/liff/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) throw new Error('Authentication failed');
  return res.json();
}
```

### 2.3 Next.js Middleware（セッション検証・ルート保護）

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッション自動リフレッシュ
  const { data: { user } } = await supabase.auth.getUser();

  // 管理画面ルート保護
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const role = user.user_metadata?.role;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
};
```

---

## 3. 認可設計（RBAC）

### 3.1 ロール定義

| ロール | 対象 | 権限概要 |
|---|---|---|
| `admin` | システム管理者 | 全機能へのフルアクセス。スタッフ管理、システム設定変更 |
| `staff` | 一般スタッフ | 記事管理、配信管理、顧客対応。システム設定は読み取り専用 |
| `customer` | LINE 連携顧客 | 自身のデータ閲覧・更新、予約操作、EC 機能利用 |

### 3.2 ロール格納

ロールは Supabase Auth の `user_metadata` に `role` フィールドとして保存する。加えて、`user_roles` テーブルで詳細な権限管理を行う。

```sql
-- ロール管理テーブル
CREATE TABLE public.user_roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- インデックス
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
```

### 3.3 権限マトリックス

| リソース | admin | staff | customer |
|---|---|---|---|
| ダッシュボード閲覧 | o | o | - |
| 記事管理（CRUD） | o | o | - |
| 配信管理（設定・実行） | o | o | - |
| 配信ログ閲覧 | o | o | - |
| スタッフ管理 | o | - | - |
| システム設定変更 | o | - | - |
| 顧客一覧閲覧 | o | o | - |
| 自身のプロフィール | o | o | o |
| 予約管理（自身） | - | - | o |
| EC 購入履歴（自身） | - | - | o |
| Google Meet リンク生成 | o | o | - |

### 3.4 サーバー側ロール検証ヘルパー

```typescript
// src/lib/auth/rbac.ts
import { createClient } from '@/lib/supabase/server';

type Role = 'admin' | 'staff' | 'customer';

export async function requireRole(...allowedRoles: Role[]) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Unauthorized', 401);
  }

  const userRole = user.user_metadata?.role as Role | undefined;
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new AuthError('Forbidden', 403);
  }

  return user;
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AuthError';
  }
}
```

```typescript
// 使用例: API Route Handler
import { requireRole, AuthError } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const user = await requireRole('admin', 'staff');
    // ... 処理
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 4. Supabase RLS ポリシー設計

### 4.1 基本方針

- 全テーブルで RLS を有効化する（`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`）
- `service_role` キーはサーバー側のみで使用し、クライアントには絶対に公開しない
- ポリシーは最小権限の原則に従い、必要な操作だけを許可する

### 4.2 共通ヘルパー関数

```sql
-- 現在のユーザーロールを取得
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 管理者かどうかを判定
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- スタッフ以上かどうかを判定
CREATE OR REPLACE FUNCTION public.is_staff_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 4.3 テーブル別ポリシー

#### customers テーブル

```sql
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- スタッフ以上: 全顧客の閲覧
CREATE POLICY "staff_select_customers"
  ON public.customers FOR SELECT
  USING (public.is_staff_or_above());

-- 顧客本人: 自分のレコードのみ閲覧
CREATE POLICY "customer_select_own"
  ON public.customers FOR SELECT
  USING (supabase_user_id = auth.uid());

-- 顧客本人: 自分のプロフィール更新
CREATE POLICY "customer_update_own"
  ON public.customers FOR UPDATE
  USING (supabase_user_id = auth.uid())
  WITH CHECK (supabase_user_id = auth.uid());

-- 管理者のみ: 顧客削除
CREATE POLICY "admin_delete_customers"
  ON public.customers FOR DELETE
  USING (public.is_admin());
```

#### articles テーブル

```sql
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- スタッフ以上: CRUD
CREATE POLICY "staff_all_articles"
  ON public.articles FOR ALL
  USING (public.is_staff_or_above());

-- 顧客: 公開済み記事のみ閲覧
CREATE POLICY "customer_select_published"
  ON public.articles FOR SELECT
  USING (status = 'published');
```

#### broadcast_logs テーブル

```sql
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

-- スタッフ以上: 閲覧のみ
CREATE POLICY "staff_select_logs"
  ON public.broadcast_logs FOR SELECT
  USING (public.is_staff_or_above());

-- INSERT は service_role 経由のみ（Cron / サーバー処理）
```

#### reservations テーブル

```sql
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- スタッフ以上: 全予約閲覧・管理
CREATE POLICY "staff_all_reservations"
  ON public.reservations FOR ALL
  USING (public.is_staff_or_above());

-- 顧客: 自分の予約のみ CRUD
CREATE POLICY "customer_own_reservations"
  ON public.reservations FOR ALL
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
```

#### orders テーブル（EC 連携）

```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- スタッフ以上: 全注文閲覧
CREATE POLICY "staff_select_orders"
  ON public.orders FOR SELECT
  USING (public.is_staff_or_above());

-- 顧客: 自分の注文のみ閲覧
CREATE POLICY "customer_select_own_orders"
  ON public.orders FOR SELECT
  USING (customer_id = auth.uid());
```

#### user_roles テーブル

```sql
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 管理者のみ: フルアクセス
CREATE POLICY "admin_all_roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin());

-- 本人: 自分のロールを閲覧
CREATE POLICY "user_select_own_role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
```

#### system_settings テーブル

```sql
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- スタッフ以上: 閲覧
CREATE POLICY "staff_select_settings"
  ON public.system_settings FOR SELECT
  USING (public.is_staff_or_above());

-- 管理者のみ: 更新
CREATE POLICY "admin_update_settings"
  ON public.system_settings FOR UPDATE
  USING (public.is_admin());
```

---

## 5. API 保護

### 5.1 保護方式一覧

| エンドポイントパターン | 保護方式 | 検証内容 |
|---|---|---|
| `/api/admin/*` | Supabase JWT | `Authorization: Bearer <token>` + ロール検証 |
| `/api/liff/*` | LIFF Token + Supabase JWT | LINE ID Token 検証後に Supabase セッション |
| `/api/line/webhook` | LINE 署名検証 | `X-Line-Signature` ヘッダー |
| `/api/cron/*` | CRON_SECRET | `Authorization: Bearer <CRON_SECRET>` |
| `/api/line/broadcast` 等 | Supabase JWT | admin / staff ロール必須 |

### 5.2 JWT 検証（Supabase Auth）

```typescript
// src/lib/auth/verify-jwt.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function withAuth(
  request: NextRequest,
  handler: (user: User) => Promise<NextResponse>,
  allowedRoles?: string[]
) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (allowedRoles) {
    const role = user.user_metadata?.role;
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return handler(user);
}
```

### 5.3 CRON_SECRET 検証

現行実装 (`src/app/api/cron/line-broadcast/route.ts`) に基づく。

```typescript
// src/lib/auth/verify-cron.ts
import { NextRequest, NextResponse } from 'next/server';

export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.warn('[security] CRON_SECRET is not configured');
    return null; // 開発環境ではスキップ可
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // 認証成功
}
```

**Vercel Cron 設定** (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/line-broadcast",
      "schedule": "0 0,9 * * *"
    }
  ]
}
```

Vercel は Cron 実行時に自動で `Authorization: Bearer <CRON_SECRET>` ヘッダーを付与する。

### 5.4 LINE Webhook 署名検証

現行実装では署名検証が未実装のため、以下の実装を追加する。

```typescript
// src/lib/line/verify-signature.ts
import crypto from 'crypto';

export function verifyLineSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    throw new Error('LINE_CHANNEL_SECRET is not configured');
  }

  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  );
}
```

```typescript
// Webhook ルートでの使用例
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature');

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const body: WebhookBody = JSON.parse(rawBody);
  // ... 処理
}
```

### 5.5 外部 API 認証

| 外部 API | 認証方式 | トークン管理 |
|---|---|---|
| LINE Messaging API | Channel Access Token（Bearer） | 環境変数 `LINE_CHANNEL_ACCESS_TOKEN` |
| Google Meet API | OAuth 2.0 Service Account | 環境変数 `GOOGLE_SERVICE_ACCOUNT_KEY` |
| Gemini API | API Key | 環境変数 `GEMINI_API_KEY` |
| EC 外部 API | API Key or OAuth | 環境変数 `EC_API_KEY` / `EC_API_SECRET` |

---

## 6. 環境変数・シークレット管理

### 6.1 環境変数一覧

| 変数名 | 用途 | 公開可否 | 必須 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | 公開可（`NEXT_PUBLIC_`） | 必須 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー | 公開可（RLS で保護） | 必須 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー | **サーバー専用** | 必須 |
| `NEXT_PUBLIC_LIFF_ID` | LIFF アプリ ID | 公開可 | 必須 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot チャネルアクセストークン | **サーバー専用** | 必須 |
| `LINE_CHANNEL_SECRET` | LINE Bot チャネルシークレット | **サーバー専用** | 必須 |
| `LINE_LOGIN_CHANNEL_ID` | LINE ログインチャネル ID | **サーバー専用** | 必須 |
| `CRON_SECRET` | Vercel Cron 認証シークレット | **サーバー専用** | 必須 |
| `GEMINI_API_KEY` | Gemini AI API キー | **サーバー専用** | 必須 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google Meet 用サービスアカウント | **サーバー専用** | 条件付き |
| `EC_API_KEY` | EC 外部 API キー | **サーバー専用** | 条件付き |
| `ADMIN_LINE_USER_ID` | 管理者通知用 LINE User ID | **サーバー専用** | 任意 |

### 6.2 シークレット管理方針

**原則**

1. **ソースコードにシークレットを含めない** -- `.env.local` は `.gitignore` に含める
2. **`NEXT_PUBLIC_` プレフィックス** のついた変数のみクライアントに公開される。シークレットには絶対にこのプレフィックスを付けない
3. **本番環境のシークレットは Vercel の Environment Variables で管理** する（Preview / Production を分離）
4. **サービスロールキーはサーバーサイド処理でのみ使用** -- クライアントコンポーネントや `'use client'` ファイルからの参照を禁止

**運用ルール**

| 項目 | 方針 |
|---|---|
| ローカル開発 | `.env.local` を使用。`.env.example` でテンプレートを管理 |
| ステージング | Vercel Preview 環境変数に設定 |
| 本番 | Vercel Production 環境変数に設定。チーム内の権限を持つメンバーのみ閲覧・変更可能 |
| ローテーション | LINE Channel Access Token は 30 日ごとに更新。他のキーは 90 日ごとに見直し |
| 漏洩時の対応 | 即時無効化 -> 新規キー発行 -> Vercel 環境変数更新 -> 再デプロイ |

**`.gitignore` 設定**

```
.env
.env.local
.env.*.local
*.pem
service-account-key.json
```

---

## 7. CORS 設定

### 7.1 設定方針

| エンドポイント | 許可オリジン | 備考 |
|---|---|---|
| `/api/admin/*` | 自サイトオリジンのみ | 管理画面からのアクセスのみ |
| `/api/liff/*` | 自サイト + LINE LIFF ドメイン | LIFF 内ブラウザからのアクセス |
| `/api/line/webhook` | LINE プラットフォーム | サーバー間通信（CORS 不要、署名検証で保護） |
| `/api/cron/*` | N/A | サーバー間通信（CORS 不要） |

### 7.2 実装

```typescript
// src/lib/cors.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,             // https://linemag.vercel.app
  'https://liff.line.me',                       // LIFF ドメイン
].filter(Boolean) as string[];

export function withCors(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  return response;
}

// OPTIONS プリフライトハンドラー
export function handlePreflight(request: NextRequest): NextResponse | null {
  if (request.method !== 'OPTIONS') return null;

  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
```

### 7.3 Next.js ヘッダー設定

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## 8. XSS / CSRF 対策

### 8.1 XSS 対策

| 対策 | 実装方法 | 対象 |
|---|---|---|
| 出力エスケープ | React の JSX 自動エスケープ | 全コンポーネント |
| `dangerouslySetInnerHTML` 禁止 | ESLint ルールで警告 | コードベース全体 |
| Content Security Policy | HTTP ヘッダーで設定 | 全ページ |
| HTTP ヘッダー | `X-Content-Type-Options: nosniff` | 全レスポンス |
| 入力バリデーション | Zod スキーマによるサーバー側検証 | 全 API エンドポイント |
| サニタイズ | DOMPurify（必要な場合のみ） | ユーザー入力の HTML 表示 |

**Content Security Policy**

```typescript
// src/middleware.ts（抜粋）
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co https://api.line.me https://liff.line.me;
  frame-src https://liff.line.me;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, ' ').trim();
```

> 注: LIFF SDK が `unsafe-inline` / `unsafe-eval` を必要とするため、`script-src` に含めている。将来的に nonce ベースの CSP への移行を検討する。

**入力バリデーション例**

```typescript
// src/lib/validation/schemas.ts
import { z } from 'zod';

export const broadcastRequestSchema = z.object({
  articleUrl: z.string().url().max(2048),
  templateId: z.string().max(50).optional(),
  targetUserIds: z.array(z.string().max(64)).max(500).optional(),
});

// API Route での使用
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = broadcastRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  // parsed.data を安全に使用
}
```

### 8.2 CSRF 対策

| 対策 | 実装方法 | 備考 |
|---|---|---|
| SameSite Cookie | `SameSite=Lax`（Supabase Auth デフォルト） | 管理画面 |
| Origin ヘッダー検証 | Middleware で `Origin` / `Referer` を確認 | 状態変更 API |
| カスタムヘッダー | `X-Requested-With` ヘッダーの要求 | 追加防御層 |
| CSRF トークン | LIFF アプリでの状態変更操作に使用 | 顧客向け |

**Origin 検証**

```typescript
// src/lib/auth/csrf.ts
export function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://liff.line.me',
  ];

  // サーバー間通信（Origin ヘッダーなし）は別途認証で保護
  if (!origin) return true;

  return allowedOrigins.includes(origin);
}
```

**Server Actions の保護**

Next.js 14 の Server Actions は自動的に以下の保護を提供する:

- POST リクエストのみ受け付け
- `Origin` ヘッダーの自動検証
- CSRF トークンの自動生成・検証（暗号化された Action ID）

管理画面のフォーム操作は Server Actions を積極的に活用する。

---

## 9. 個人情報保護

### 9.1 取り扱う個人情報

| データ種別 | 保存先 | 暗号化 | 保持期間 |
|---|---|---|---|
| LINE User ID | Supabase (customers) | カラムレベル暗号化 | アカウント削除まで |
| LINE 表示名 | Supabase (customers) | なし（公開情報） | アカウント削除まで |
| LINE プロフィール画像 URL | Supabase (customers) | なし（公開情報） | アカウント削除まで |
| メールアドレス（スタッフ） | Supabase Auth | Supabase 標準暗号化 | アカウント削除まで |
| 予約情報 | Supabase (reservations) | RLS で保護 | 3 年間 |
| 購入履歴 | Supabase (orders) | RLS で保護 | 5 年間（法定保存） |
| 配信ログ | Supabase (broadcast_logs) | なし | 1 年間 |
| Webhook イベントログ | Supabase (webhook_logs) | なし | 90 日間 |
| Google Meet URL | Supabase (reservations) | RLS で保護 | 予約日 + 30 日 |

### 9.2 暗号化

**転送時の暗号化**

- 全通信は TLS 1.2 以上を使用（Vercel / Supabase が自動適用）
- HSTS ヘッダーの設定

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**保存時の暗号化**

- Supabase の PostgreSQL はディスクレベル暗号化（AES-256）を標準適用
- 機微な個人情報（LINE User ID）にはカラムレベル暗号化を追加

```sql
-- pgcrypto 拡張を有効化
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 暗号化カラムの使用例
-- アプリケーションレベルで暗号化/復号を行う

-- 暗号化ヘルパー
CREATE OR REPLACE FUNCTION encrypt_pii(plain_text TEXT)
RETURNS TEXT AS $$
  SELECT encode(
    pgp_sym_encrypt(plain_text, current_setting('app.encryption_key')),
    'base64'
  );
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrypt_pii(encrypted_text TEXT)
RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(
    decode(encrypted_text, 'base64'),
    current_setting('app.encryption_key')
  );
$$ LANGUAGE sql;
```

### 9.3 データ保持・削除ポリシー

| データ | 保持期間 | 削除方法 |
|---|---|---|
| 配信ログ | 1 年間 | Cron ジョブで月次削除 |
| Webhook ログ | 90 日間 | Cron ジョブで月次削除 |
| 予約情報 | 3 年間 | 年次バッチ処理で匿名化 |
| 購入履歴 | 5 年間 | 法定保存期間後に匿名化 |
| 顧客アカウント | 退会申請まで | 退会処理で個人情報を削除（匿名化） |
| 古いセッション | 7 日間 | Supabase Auth が自動管理 |

**自動クリーンアップ SQL**

```sql
-- 90 日超過の Webhook ログを削除
DELETE FROM public.webhook_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- 1 年超過の配信ログを削除
DELETE FROM public.broadcast_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

### 9.4 個人情報保護法 / GDPR 対応

**対応方針**

| 要件 | 対応策 |
|---|---|
| 利用目的の明示 | LIFF 初回起動時にプライバシーポリシーを表示し同意を取得 |
| 同意管理 | `customer_consents` テーブルで同意履歴を記録 |
| アクセス権（開示請求） | 管理画面から顧客データをエクスポートする機能を提供 |
| 削除権（忘れられる権利） | アカウント削除 API を提供。関連データの完全削除または匿名化 |
| データポータビリティ | JSON 形式でのデータエクスポート機能 |
| 第三者提供の制限 | LINE / Google への必要最小限のデータのみ送信 |
| 漏洩時の通知 | 72 時間以内に監督機関へ報告（体制を整備） |

**同意管理テーブル**

```sql
CREATE TABLE public.customer_consents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  consent_type  TEXT NOT NULL,  -- 'privacy_policy', 'marketing', 'data_sharing'
  consented     BOOLEAN NOT NULL DEFAULT false,
  consented_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  ip_address    INET,
  user_agent    TEXT,
  version       TEXT NOT NULL,  -- ポリシーのバージョン
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consents_customer ON public.customer_consents(customer_id);
```

**アカウント削除処理**

```typescript
// src/lib/customer/delete-account.ts
export async function deleteCustomerAccount(customerId: string) {
  const supabaseAdmin = createAdminClient();

  // 1. 個人情報を匿名化（法定保存が必要なレコード）
  await supabaseAdmin
    .from('orders')
    .update({
      customer_name: '[削除済み]',
      customer_email: null,
    })
    .eq('customer_id', customerId);

  // 2. 保存不要なデータを完全削除
  await supabaseAdmin
    .from('customer_consents')
    .delete()
    .eq('customer_id', customerId);

  // 3. 顧客レコードを削除
  await supabaseAdmin
    .from('customers')
    .delete()
    .eq('id', customerId);

  // 4. Supabase Auth ユーザーを削除
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('supabase_user_id')
    .eq('id', customerId)
    .single();

  if (customer?.supabase_user_id) {
    await supabaseAdmin.auth.admin.deleteUser(customer.supabase_user_id);
  }

  // 5. 監査ログに記録
  await supabaseAdmin.from('audit_logs').insert({
    action: 'ACCOUNT_DELETED',
    target_id: customerId,
    performed_at: new Date().toISOString(),
  });
}
```

### 9.5 監査ログ

セキュリティ上重要な操作を記録する。

```sql
CREATE TABLE public.audit_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,
  target_type   TEXT,          -- 'customer', 'article', 'broadcast', etc.
  target_id     TEXT,
  details       JSONB,
  ip_address    INET,
  user_agent    TEXT,
  performed_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: 管理者のみ閲覧、INSERT は service_role 経由
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_audit"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_performed ON public.audit_logs(performed_at);
```

**記録対象イベント**

| イベント | 記録内容 |
|---|---|
| ログイン成功/失敗 | ユーザー ID、IP、User-Agent |
| ロール変更 | 変更者、対象者、旧ロール、新ロール |
| 顧客データ閲覧 | 閲覧者、対象顧客 ID |
| アカウント削除 | 実行者、対象顧客 ID |
| 配信実行 | 実行者、対象テンプレート、配信数 |
| システム設定変更 | 変更者、変更項目、旧値、新値 |

---

## 付録: セキュリティチェックリスト

実装時に以下を確認すること。

- [ ] 全テーブルで RLS が有効化されている
- [ ] `SUPABASE_SERVICE_ROLE_KEY` がクライアントに露出していない
- [ ] `NEXT_PUBLIC_` プレフィックスのついたシークレットが存在しない
- [ ] LINE Webhook に署名検証が実装されている
- [ ] Cron エンドポイントに `CRON_SECRET` 検証が実装されている
- [ ] 全フォーム入力に Zod バリデーションが適用されている
- [ ] CSP ヘッダーが設定されている
- [ ] HSTS ヘッダーが設定されている
- [ ] Cookie に `httpOnly`, `secure`, `SameSite` が設定されている
- [ ] 本番環境のシークレットが Vercel 環境変数で管理されている
- [ ] `.env.local` が `.gitignore` に含まれている
- [ ] 個人情報のデータ保持期間が設定されている
- [ ] アカウント削除（退会）機能が実装されている
- [ ] 監査ログが主要操作で記録されている
- [ ] エラーレスポンスに内部情報が含まれていない
