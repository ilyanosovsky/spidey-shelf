// @vitest-environment node

import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";

import { authenticate, looksLikeBcryptHash } from "./auth";

const PASSWORD = "spidey-sense-tingling-1450!";

// Cost 4 keeps the suite fast; production hashes are generated at cost 12 by
// scripts/hash-password.mjs. bcrypt.compare reads the cost out of the hash itself.
let hash: string;

beforeAll(async () => {
  hash = await bcrypt.hash(PASSWORD, 4);
});

describe("authenticate", () => {
  it("accepts the right password", async () => {
    await expect(authenticate(PASSWORD, hash)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    await expect(authenticate("wrong-password", hash)).resolves.toBe(false);
    await expect(authenticate(`${PASSWORD} `, hash)).resolves.toBe(false);
  });

  it("rejects an empty password even against a valid hash", async () => {
    await expect(authenticate("", hash)).resolves.toBe(false);
  });

  it("fails closed when the hash is missing or corrupt", async () => {
    await expect(authenticate(PASSWORD, undefined)).resolves.toBe(false);
    await expect(authenticate(PASSWORD, null)).resolves.toBe(false);
    await expect(authenticate(PASSWORD, "")).resolves.toBe(false);
    await expect(authenticate(PASSWORD, "not-a-bcrypt-hash")).resolves.toBe(false);
  });

  it("handles non-ascii passwords byte-for-byte", async () => {
    const unicodeHash = await bcrypt.hash("паучьё-чутьё-🕷", 4);

    await expect(authenticate("паучьё-чутьё-🕷", unicodeHash)).resolves.toBe(true);
    await expect(authenticate("паучье-чутье-🕷", unicodeHash)).resolves.toBe(false);
  });

  it("verifies a cost-12 hash the way scripts/hash-password.mjs produces one", async () => {
    const productionStyleHash = bcrypt.hashSync("cost-twelve", 12);

    expect(productionStyleHash).toMatch(/^\$2[aby]\$12\$/);
    await expect(authenticate("cost-twelve", productionStyleHash)).resolves.toBe(true);
    await expect(authenticate("cost-thirteen", productionStyleHash)).resolves.toBe(false);
  });
});

describe("looksLikeBcryptHash", () => {
  it("accepts a real hash", () => {
    expect(looksLikeBcryptHash(bcrypt.hashSync("whatever", 4))).toBe(true);
  });

  it("catches a hash mangled by dotenv-expand", () => {
    // What `ADMIN_PASSWORD_HASH=$2b$12$…` (unquoted, unescaped) becomes after Next.js
    // parses the .env file: `$2b`, `$12` and `$<salt-head>` are eaten as variables.
    const real = bcrypt.hashSync("whatever", 4);
    const mangled = real.replace(/\$2[aby]\$\d{2}\$.{10}/, "");

    expect(looksLikeBcryptHash(mangled)).toBe(false);
  });

  it("rejects empty and non-bcrypt values", () => {
    expect(looksLikeBcryptHash(undefined)).toBe(false);
    expect(looksLikeBcryptHash(null)).toBe(false);
    expect(looksLikeBcryptHash("")).toBe(false);
    expect(looksLikeBcryptHash("hunter2")).toBe(false);
    expect(looksLikeBcryptHash("$2b$12$too-short")).toBe(false);
  });
});
