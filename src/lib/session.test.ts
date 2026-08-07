// @vitest-environment node
// jose needs WebCrypto (`crypto.subtle`), which jsdom does not implement.

import { describe, expect, it } from "vitest";

import {
  readCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSessionToken,
  verifySessionFromCookieHeader,
  verifySessionToken,
} from "./session";

const SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
const OTHER_SECRET = "a-completely-different-secret-of-the-same-size";

describe("session tokens", () => {
  it("round-trips a signed admin session", async () => {
    const token = await signSessionToken({ sub: "admin", role: "admin" }, { secret: SECRET });

    await expect(verifySessionToken(token, SECRET)).resolves.toEqual({
      sub: "admin",
      role: "admin",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSessionToken({ sub: "admin", role: "admin" }, { secret: SECRET });

    await expect(verifySessionToken(token, OTHER_SECRET)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSessionToken(
      { sub: "admin", role: "admin" },
      { secret: SECRET, maxAgeSeconds: -60 },
    );

    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it("rejects a token that expired between signing and verifying", async () => {
    const anHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const token = await signSessionToken(
      { sub: "admin", role: "admin" },
      { secret: SECRET, now: anHourAgo, maxAgeSeconds: 60 },
    );

    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signSessionToken({ sub: "admin", role: "admin" }, { secret: SECRET });
    const [header, payload, signature] = token.split(".");
    const tampered = [header, payload, `${signature.slice(0, -2)}xx`].join(".");

    await expect(verifySessionToken(tampered, SECRET)).resolves.toBeNull();
  });

  it("rejects missing and malformed tokens", async () => {
    await expect(verifySessionToken(undefined, SECRET)).resolves.toBeNull();
    await expect(verifySessionToken("", SECRET)).resolves.toBeNull();
    await expect(verifySessionToken("not-a-jwt", SECRET)).resolves.toBeNull();
  });

  it("throws when signing without a secret", async () => {
    const previous = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;

    try {
      await expect(signSessionToken({ sub: "admin", role: "admin" })).rejects.toThrow(
        /SESSION_SECRET/,
      );
      // Verification fails closed instead of throwing.
      await expect(verifySessionToken("anything")).resolves.toBeNull();
    } finally {
      if (previous !== undefined) process.env.SESSION_SECRET = previous;
    }
  });
});

describe("readCookie", () => {
  it("finds the session among its neighbours", () => {
    expect(readCookie("a=1; spidey_session=abc.def.ghi; b=2", SESSION_COOKIE_NAME)).toBe(
      "abc.def.ghi",
    );
    expect(readCookie("spidey_session=only", SESSION_COOKIE_NAME)).toBe("only");
  });

  it("does not match a cookie whose name merely contains ours", () => {
    expect(readCookie("not_spidey_session=x", SESSION_COOKIE_NAME)).toBeUndefined();
    expect(readCookie("spidey_session_old=x", SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("keeps `=` inside the value", () => {
    expect(readCookie("spidey_session=a=b=c", SESSION_COOKIE_NAME)).toBe("a=b=c");
  });

  it("survives a missing or junk header", () => {
    expect(readCookie(null, SESSION_COOKIE_NAME)).toBeUndefined();
    expect(readCookie("", SESSION_COOKIE_NAME)).toBeUndefined();
    expect(readCookie("garbage", SESSION_COOKIE_NAME)).toBeUndefined();
  });
});

describe("verifySessionFromCookieHeader", () => {
  it("is the same verification, read off a raw header", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SECRET;

    try {
      const token = await signSessionToken({ sub: "admin", role: "admin" });

      await expect(
        verifySessionFromCookieHeader(`theme=dark; ${SESSION_COOKIE_NAME}=${token}`),
      ).resolves.toEqual({ sub: "admin", role: "admin" });

      // No cookie, a foreign cookie and a forged token all fail closed.
      await expect(verifySessionFromCookieHeader(null)).resolves.toBeNull();
      await expect(verifySessionFromCookieHeader("theme=dark")).resolves.toBeNull();
      await expect(
        verifySessionFromCookieHeader(`${SESSION_COOKIE_NAME}=not-a-jwt`),
      ).resolves.toBeNull();
    } finally {
      if (previous === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previous;
    }
  });
});

describe("session cookie", () => {
  it("is httpOnly, lax and scoped to the whole site", () => {
    const options = sessionCookieOptions();

    expect(SESSION_COOKIE_NAME).toBe("spidey_session");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("is secure in production", () => {
    const previous = process.env.NODE_ENV;

    try {
      // NODE_ENV is readonly in @types/node; the runtime value is what matters here.
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(sessionCookieOptions().secure).toBe(true);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = previous;
    }
  });
});
