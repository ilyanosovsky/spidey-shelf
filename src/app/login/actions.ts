"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authenticate, looksLikeBcryptHash } from "@/lib/auth";
import { getSession } from "@/lib/dal";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signSessionToken } from "@/lib/session";

export type LoginState = { error: string | null };

/**
 * One password, one hash, one cookie.
 *
 * The failure message never says whether the password was empty, wrong, or whether the
 * server is misconfigured — a visitor gets "ACCESS DENIED" either way.
 */
export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    console.error("ADMIN_PASSWORD_HASH is not set — login is impossible until it is.");
    return { error: "ACCESS DENIED" };
  }

  if (!looksLikeBcryptHash(hash)) {
    // Almost always the dotenv-expand footgun: in .env files every `$` of the hash must be
    // written as `\$`, otherwise `$2b$12$…` is expanded away. Vercel's dashboard is fine.
    console.error(
      "ADMIN_PASSWORD_HASH is not a valid bcrypt hash — in .env files escape every `$` as `\\$`.",
    );
    return { error: "ACCESS DENIED" };
  }

  if (!(await authenticate(password, hash))) {
    return { error: "ACCESS DENIED" };
  }

  const token = await signSessionToken({ sub: "admin", role: "admin" });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  redirect("/admin");
}

/** Drops the session cookie. Re-verifies first, per the "every server action" rule. */
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  const cookieStore = await cookies();

  if (session) {
    cookieStore.delete({ name: SESSION_COOKIE_NAME, path: "/" });
  }

  redirect("/login");
}
