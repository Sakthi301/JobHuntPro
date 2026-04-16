// ═══════════════════════════════════════════════════════════
// Supabase Client — Server Side
// ═══════════════════════════════════════════════════════════
// Used in API Routes and Server Components to securely
// interact with Supabase. Reads/writes auth cookies.
// ═══════════════════════════════════════════════════════════

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for use in server-side contexts.
 * Handles cookie-based auth sessions automatically.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently fail when called from a Server Component
            // (cookies can only be set in Server Actions or Route Handlers)
          }
        },
      },
    }
  );
}
