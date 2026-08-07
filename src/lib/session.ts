import { SignJWT, jwtVerify } from "jose";

/**
 * Single-admin session tokens. Hand-rolled on purpose (no auth library) — the whole
 * surface is: sign a JWT, put it in an httpOnly cookie, verify it on every request that
 * touches admin data.
 *
 * This module is deliberately pure: no `next/headers`, no `server-only`. Everything here
 * is unit-testable and safe to import from the proxy, from server components and from
 * server actions alike.
 */

export const SESSION_COOKIE_NAME = "spidey_session";

/** 30 days — a personal single-admin tool, re-typing the password monthly is enough. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = {
  /** Who — there is exactly one admin, so this is a constant, but keep it explicit. */
  sub: string;
  role: "admin";
};

export type SignSessionOptions = {
  /** Overridable for tests; defaults to `process.env.SESSION_SECRET`. */
  secret?: string;
  /** Seconds until expiry. Zero or negative produces an already-expired token. */
  maxAgeSeconds?: number;
  /** "now" in seconds since the epoch — injectable so tests can backdate a token. */
  now?: number;
};

function secretKey(secret?: string): Uint8Array {
  const value = secret ?? process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set — see docs/wiki/Environment.md.");
  }
  return new TextEncoder().encode(value);
}

export async function signSessionToken(
  payload: SessionPayload,
  options: SignSessionOptions = {},
): Promise<string> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS;

  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + maxAge)
    .sign(secretKey(options.secret));
}

/**
 * Fail-closed: any problem at all (missing token, tampered signature, wrong secret,
 * expired, unexpected payload shape, missing SESSION_SECRET) resolves to `null`.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secret?: string,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.role !== "admin") return null;
    return { sub: payload.sub, role: "admin" };
  } catch {
    return null;
  }
}

/**
 * The session cookie's value, straight out of a raw `Cookie:` header.
 *
 * Route handlers can reach `next/headers`' `cookies()`, but UploadThing's file router runs
 * its middleware inside its own async runtime, and a request-scoped API that may or may not
 * survive that is not something to gate an upload on. The header is right there on the
 * `Request`, so the router reads it directly — and because this is a plain string parse, the
 * "is this the admin?" question stays unit-testable without a Next.js request at all.
 *
 * Splits on `;` only: cookie values are percent-encoded by the cookie store, so a `;` cannot
 * appear inside one, and the first `=` wins because a base64url JWT never contains `=` in the
 * middle but its padding could in principle sit at the end.
 */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return part.slice(index + 1).trim();
  }

  return undefined;
}

/** The admin check for a bare `Request` — same verification, no `next/headers`. */
export async function verifySessionFromCookieHeader(
  header: string | null | undefined,
): Promise<SessionPayload | null> {
  return verifySessionToken(readCookie(header, SESSION_COOKIE_NAME));
}

/**
 * Cookie attributes for the session cookie.
 *
 * `secure` is on in production only: Safari refuses Secure cookies over plain http, which
 * would make `npm run dev` on localhost impossible to log into. Production (Vercel) is
 * https-only, so the flag is always on where it matters.
 */
export function sessionCookieOptions(maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
