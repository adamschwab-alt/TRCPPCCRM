import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Next 16 renamed `middleware` → `proxy` (Node runtime, not configurable).
 * Responsibilities:
 *   1. Refresh the Supabase auth session cookies on every request.
 *   2. Gate routes: unauthenticated → /login.
 *   3. Enforce TOTP MFA: any authenticated session that is not yet aal2 is sent
 *      to /auth/mfa (enroll on first login, challenge thereafter).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
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

  const path = request.nextUrl.pathname;
  const isLogin = path === '/login';
  const isMfa = path === '/auth/mfa';
  const isAuthApi = path.startsWith('/auth/');

  // Unauthenticated → login (except the login page itself & auth callbacks).
  if (!user) {
    if (isLogin || isAuthApi) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  // Authenticated: enforce MFA. aal2 == TOTP satisfied this session.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa = aal?.currentLevel !== 'aal2';

  if (needsMfa && !isMfa && !isAuthApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/mfa';
    return NextResponse.redirect(url);
  }

  // Fully authenticated user landing on /login → send to dashboard.
  if (!needsMfa && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals, API routes (they self-authorize),
  // static assets, and the favicon.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
