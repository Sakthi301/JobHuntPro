import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) return "/";
  if (nextPath.startsWith("//")) return "/";
  return nextPath;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const errorUrl = new URL("/login", requestUrl.origin);
      errorUrl.searchParams.set("auth_error", "oauth_callback_failed");
      return NextResponse.redirect(errorUrl);
    }
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
