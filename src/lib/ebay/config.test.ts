import { describe, expect, it } from "vitest";

import { isEbayConfiguredIn } from "./config";

/**
 * The gate is the whole feature design, so it gets the tests a feature usually gets.
 *
 * Phase 8 shipped eBay prices to an owner who has no eBay keys. That is only acceptable if
 * "no keys" is a first-class state rather than an untested edge — hence the emphasis on the
 * half-configured cases, which are what a fat-fingered Vercel dashboard actually produces.
 */
describe("isEbayConfiguredIn", () => {
  it("needs both keys", () => {
    expect(isEbayConfiguredIn({ EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "secret" })).toBe(true);
  });

  it("treats a half-configured app as unconfigured", () => {
    expect(isEbayConfiguredIn({ EBAY_CLIENT_ID: "id" })).toBe(false);
    expect(isEbayConfiguredIn({ EBAY_CLIENT_SECRET: "secret" })).toBe(false);
  });

  it("treats blanks as absent — an empty env var is what a copy-paste leaves behind", () => {
    expect(isEbayConfiguredIn({ EBAY_CLIENT_ID: "", EBAY_CLIENT_SECRET: "" })).toBe(false);
    expect(isEbayConfiguredIn({ EBAY_CLIENT_ID: "  ", EBAY_CLIENT_SECRET: "secret" })).toBe(false);
  });

  it("is false for an empty environment — the owner's current deployment", () => {
    expect(isEbayConfiguredIn({})).toBe(false);
  });

  it("ignores every other variable in the environment", () => {
    expect(isEbayConfiguredIn({ DATABASE_URL: "postgres://…", SESSION_SECRET: "x" })).toBe(false);
  });
});
