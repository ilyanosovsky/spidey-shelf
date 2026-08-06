import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts` (same matcher config, nodejs runtime).
 *
 * THIS IS NOT AUTHENTICATION. It is an optimistic redirect so an anonymous visitor who
 * types /admin lands on the login screen instead of flashing an empty console. It only
 * checks that a session cookie EXISTS — it does not verify the signature, and a proxy
 * check can be bypassed outright (CVE-2025-29927: a crafted `x-middleware-subrequest`
 * header skipped Next.js middleware entirely).
 *
 * Real enforcement is `requireAdmin()` from src/lib/dal.ts, called inside the admin page
 * and inside every server action that touches admin data.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (hasSessionCookie) return;

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
