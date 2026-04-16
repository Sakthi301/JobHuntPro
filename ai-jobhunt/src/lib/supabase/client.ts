// ═══════════════════════════════════════════════════════════
// Supabase Client — Browser Side
// ═══════════════════════════════════════════════════════════
// Used in React components (client-side) to interact with
// Supabase Auth and Database. Uses cookie-based sessions.
// ═══════════════════════════════════════════════════════════

import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in browser/React components.
 * This client automatically manages auth tokens via cookies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
