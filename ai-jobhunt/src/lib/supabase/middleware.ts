// ═══════════════════════════════════════════════════════════
// Supabase Auth Middleware
// ═══════════════════════════════════════════════════════════
// Runs on EVERY request to check if user is logged in.
// - If NOT logged in → redirect to /login
// - If logged in and on /login → redirect to /
// This protects all app routes from unauthorized access.
// ═══════════════════════════════════════════════════════════

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = new Set([
  '/',
  '/setup',
  '/analytics',
  '/tracker',
  '/cover',
  '/resume-builder',
  '/question-bank',
  '/interview',
  '/ats',
]);

const AUTH_COOKIE_HINTS = ['auth-token', 'sb-'];
const IS_DEV = process.env.NODE_ENV === 'development';
const SKIP_DEV_AUTH_MIDDLEWARE = process.env.SKIP_DEV_AUTH_MIDDLEWARE !== 'false';

function hasSupabaseAuthCookie(request: NextRequest) {
  const cookies = request.cookies.getAll();
  return cookies.some(({ name }) =>
    AUTH_COOKIE_HINTS.some((hint) => name.includes(hint))
  );
}

async function getUserWithTimeout(supabase: ReturnType<typeof createServerClient>, timeoutMs = 900) {
  return await Promise.race([
    supabase.auth.getUser(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('supabase_auth_timeout')), timeoutMs);
    }),
  ]);
}

/**
 * Refreshes the user's Supabase auth session and enforces
 * route protection (redirect to /login if not authenticated).
 */
export async function updateSession(request: NextRequest) {
  if (IS_DEV && SKIP_DEV_AUTH_MIDDLEWARE) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/login');
  const isProtectedRoute = PROTECTED_PATHS.has(pathname);
  const hasAuthCookie = hasSupabaseAuthCookie(request);

  if (!isAuthRoute && !isProtectedRoute) {
    return NextResponse.next({ request });
  }

  // Fast path for logged-out users: no remote auth round-trip needed.
  if (isProtectedRoute && !hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Login page can render immediately if no auth cookie exists yet.
  if (isAuthRoute && !hasAuthCookie) {
    return NextResponse.next({ request });
  }

  // Start with the original request
  let supabaseResponse = NextResponse.next({ request });

  // Create a Supabase client that can read/write cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream middleware/handlers)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Also set cookies on the response (for the browser)
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check if user is logged in, but avoid hanging the entire request.
  let user = null;
  try {
    const result = await getUserWithTimeout(supabase);
    user = result.data.user;
  } catch {
    // If auth check times out, keep login route accessible and
    // deny protected routes by redirecting to login.
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // NOT logged in + trying to access protected page → go to login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Logged in + trying to access login page → go to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
