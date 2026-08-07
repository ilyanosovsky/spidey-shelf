// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/robots.txt` and `/sitemap.xml` — the two documents nobody on the team ever looks at and
 * every crawler does.
 *
 * The database is mocked, because the point of the sitemap test is what it does when the
 * shelf answers and what it does when Railway does not.
 */

const h = vi.hoisted(() => ({
  listPublicShelf: vi.fn(),
}));

vi.mock("@/lib/showcase-queries", () => ({ listPublicShelf: h.listPublicShelf }));

import robots from "./robots";
import sitemap, { dynamic } from "./sitemap";
import { alt, contentType, size } from "./opengraph-image";
import { OG_IMAGE, siteUrl } from "@/lib/site";

const BASE = siteUrl();

beforeEach(() => {
  vi.clearAllMocks();
  h.listPublicShelf.mockResolvedValue([
    { slug: "pop-marvel-spider-man-3", acquiredAt: "2023-12-04" },
    { slug: "pop-marvel-spider-man-1450", acquiredAt: null },
  ]);
});

describe("robots.txt", () => {
  it("lets a crawler have the whole public site", () => {
    expect(robots().rules).toMatchObject({ userAgent: "*", allow: "/" });
  });

  it("keeps the console, the API and the login form out of a search result", () => {
    // Not a security control — `requireAdmin()` inside every action is (ADR-005). This only
    // stops a crawler spending its budget on a password box.
    expect(robots().rules).toMatchObject({ disallow: ["/admin", "/api", "/login"] });
  });

  it("points at an ABSOLUTE sitemap — a relative one is ignored by every crawler", () => {
    expect(robots().sitemap).toBe(`${BASE}/sitemap.xml`);
    expect(() => new URL(String(robots().sitemap))).not.toThrow();
  });
});

describe("sitemap.xml", () => {
  it("is dynamic, or `next build` would query Railway from a CI job with no database", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("lists the four public screens and every figure with a page", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.slice(0, 4)).toEqual([
      `${BASE}/`,
      `${BASE}/search`,
      `${BASE}/wishlist`,
      `${BASE}/stats`,
    ]);
    expect(urls).toContain(`${BASE}/figure/pop-marvel-spider-man-3`);
    expect(urls).toHaveLength(6);
  });

  it("never lists an admin screen", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/admin") || url.includes("/login"))).toBe(false);
  });

  it("dates a figure page from its own sighting", async () => {
    const entry = (await sitemap()).find((row) =>
      row.url.endsWith("/figure/pop-marvel-spider-man-3"),
    );
    expect(entry?.lastModified).toEqual(new Date("2023-12-04"));
  });

  it("still answers when a figure has no date", async () => {
    const entry = (await sitemap()).find((row) =>
      row.url.endsWith("/figure/pop-marvel-spider-man-1450"),
    );
    expect(entry?.lastModified).toBeInstanceOf(Date);
  });

  it("degrades to the four screens when the database is asleep", async () => {
    h.listPublicShelf.mockRejectedValue(new Error("ECONNREFUSED"));

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toEqual([`${BASE}/`, `${BASE}/search`, `${BASE}/wishlist`, `${BASE}/stats`]);
  });

  it("emits absolute URLs throughout — a `<loc>` may not be a path", async () => {
    for (const entry of await sitemap()) {
      expect(entry.url.startsWith("http")).toBe(true);
      expect(() => new URL(entry.url)).not.toThrow();
    }
  });
});

describe("the social card route", () => {
  it("declares the size it actually draws — a mismatch letterboxes the preview", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
  });

  it("agrees with the object `/figure/[slug]` has to name it by", () => {
    // The figure page overrides `openGraph`, which drops the inherited image; it names this
    // constant back. Two spellings of one card is exactly what that would invite.
    expect(OG_IMAGE).toMatchObject({
      url: "/opengraph-image",
      width: size.width,
      height: size.height,
      alt,
      type: contentType,
    });
  });

  it("describes the card in words, for the clients that read alt text", () => {
    expect(alt.length).toBeGreaterThan(10);
  });
});
