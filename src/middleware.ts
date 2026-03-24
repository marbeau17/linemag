// ============================================================================
// src/middleware.ts
// 認証ミドルウェア — ダッシュボード・API保護
// ============================================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // /dashboard/* — 未認証ならログインへリダイレクト
  if (!user && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // /api/line/*（webhook, cron除く） — 未認証なら 401
  if (
    !user &&
    pathname.startsWith('/api/line/') &&
    !pathname.startsWith('/api/line/webhook')
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // /api/crm/* — 未認証なら 401
  if (!user && pathname.startsWith('/api/crm/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // /api/coupons/* — 未認証なら 401
  if (!user && pathname.startsWith('/api/coupons/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // /api/booking/* — 未認証なら 401
  if (!user && pathname.startsWith('/api/booking/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // /api/ma/* — 未認証なら 401
  if (!user && pathname.startsWith('/api/ma/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // /api/analytics/* — 未認証なら 401
  if (!user && pathname.startsWith('/api/analytics/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ログイン済みで /login にアクセス → ダッシュボードへ
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/line/:path*', '/api/crm/:path*', '/api/coupons/:path*', '/api/booking/:path*', '/api/ma/:path*', '/api/analytics/:path*'],
};
