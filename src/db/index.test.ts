import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Guards the CI-build contract: importing the db module must NOT require
 * DATABASE_URL (next build evaluates page modules with no env in CI);
 * only actually using the client may throw.
 */
describe("db lazy initialization", () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete (globalThis as Record<string, unknown>).spideyShelfPg;
    delete (globalThis as Record<string, unknown>).spideyShelfDb;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
    delete (globalThis as Record<string, unknown>).spideyShelfPg;
    delete (globalThis as Record<string, unknown>).spideyShelfDb;
  });

  it("imports without DATABASE_URL", async () => {
    await expect(import("./index")).resolves.toBeDefined();
  });

  it("throws on first use when DATABASE_URL is missing", async () => {
    const { db } = await import("./index");
    expect(() => db.select).toThrow(/DATABASE_URL is not set/);
  });

  it("does not throw on first use when DATABASE_URL is present", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
    const { db } = await import("./index");
    expect(() => db.select).not.toThrow();
  });
});
