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

  // ---- env-var guard -------------------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Cannot authenticate — let the request through so the app can render its
    // own error / setup page rather than crashing in middleware.
    console.error('[middleware] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return response;
  }

  // ---- Supabase client -----------------------------------------------------
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  });

  // ---- Fetch user (fail-open on error) -------------------------------------
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // Network or Supabase outage — allow the request through instead of
    // crashing. Protected pages will still fail gracefully on their own.
    console.error('[middleware] supabase.auth.getUser() failed:', err);
    return response;
  }

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

// NOTE: /api/cron/* is intentionally excluded — cron endpoints use their own
// auth (e.g. CRON_SECRET header) and must not go through session middleware.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/api/line/:path*',
    '/api/crm/:path*',
    '/api/coupons/:path*',
    '/api/booking/:path*',
    '/api/ma/:path*',
    '/api/analytics/:path*',
  ],
};
