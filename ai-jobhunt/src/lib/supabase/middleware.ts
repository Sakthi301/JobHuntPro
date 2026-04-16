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

/**
 * Refreshes the user's Supabase auth session and enforces
 * route protection (redirect to /login if not authenticated).
 */
export async function updateSession(request: NextRequest) {
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

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');

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
