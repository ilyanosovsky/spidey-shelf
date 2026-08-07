import { describe, expect, it } from "vitest";

import { absoluteUrl, DEFAULT_SITE_URL, siteUrl } from "./site";

describe("siteUrl", () => {
  it("takes the environment when it names an origin", () => {
    expect(siteUrl("https://spidey.example")).toBe("https://spidey.example");
    expect(siteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("adds the protocol a person pasting a host leaves off", () => {
    expect(siteUrl("spidey-shelf.vercel.app")).toBe("https://spidey-shelf.vercel.app");
  });

  it("never ends in a slash, so `${base}${path}` cannot produce a double one", () => {
    expect(siteUrl("https://spidey.example/")).toBe("https://spidey.example");
    expect(siteUrl("https://spidey.example///")).toBe("https://spidey.example");
  });

  it("keeps a sub-path deployment, which is a real Vercel shape", () => {
    expect(siteUrl("https://example.com/shelf")).toBe("https://example.com/shelf");
  });

  it("falls back rather than throwing — a typo must not fail `next build`", () => {
    expect(siteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("")).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("   ")).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("http://")).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("javascript:alert(1)")).toBe(DEFAULT_SITE_URL);
  });

  it("produces something `new URL()` accepts — that is what `metadataBase` needs", () => {
    for (const input of [undefined, "", "spidey.example", "https://a.b/c/", "nonsense://x"]) {
      expect(() => new URL(siteUrl(input))).not.toThrow();
    }
  });
});

describe("absoluteUrl", () => {
  it("builds the absolute address a crawler can actually fetch", () => {
    expect(absoluteUrl("/sitemap.xml", "https://spidey.example")).toBe(
      "https://spidey.example/sitemap.xml",
    );
    expect(absoluteUrl("/", "https://spidey.example")).toBe("https://spidey.example/");
  });

  it("tolerates a path that forgot its leading slash", () => {
    expect(absoluteUrl("wishlist", "https://spidey.example")).toBe(
      "https://spidey.example/wishlist",
    );
  });

  it("defaults to the deployment's own origin", () => {
    expect(absoluteUrl("/stats")).toBe(`${siteUrl()}/stats`);
  });
});
