// ═══════════════════════════════════════════════════════════
// Next.js Root Middleware
// ═══════════════════════════════════════════════════════════
// This file runs BEFORE every page request. It calls the
// Supabase auth middleware to protect routes and manage
// user sessions via cookies.
// ═══════════════════════════════════════════════════════════

import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Only run middleware on app routes, skip static files
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
