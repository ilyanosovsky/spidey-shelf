import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "./session";

/**
 * Data Access Layer — the ONE place that decides whether the current request is the admin.
 *
 * `src/proxy.ts` also redirects unauthenticated requests away from `/admin`, but that is
 * UX only. CVE-2025-29927 showed that a middleware/proxy check can be skipped with a
 * crafted header, so real enforcement lives here and must be called inside every admin
 * page, server action and route handler.
 */

/**
 * React `cache()` dedupes this per request: a page and the three components below it can
 * all ask for the session and the cookie is only parsed and the JWT only verified once.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
});

/** Guard for admin pages and server actions. Never returns for anonymous requests. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * "Is the owner looking at this page?" — the question the nav asks (Phase 10).
 *
 * Never a guard: the only thing it may decide is whether the CONSOLE tab is rendered. It is
 * a full JWT verification rather than a cookie-presence check, so a hand-written
 * `spidey_session=x` shows a guest's nav, and it is safe on every public page because they
 * are all `force-dynamic` already (reading cookies would otherwise opt them out of static
 * rendering — see docs/wiki/Architecture.md).
 */
export async function isAdminSession(): Promise<boolean> {
  return (await getSession()) !== null;
}
