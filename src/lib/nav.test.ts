import { describe, expect, it } from "vitest";

import { activeNavHref, PUBLIC_NAV } from "./nav";

describe("PUBLIC_NAV", () => {
  it("is the four public screens, in gadget order", () => {
    expect(PUBLIC_NAV.map((item) => item.href)).toEqual(["/", "/search", "/wishlist", "/stats"]);
    expect(PUBLIC_NAV.map((item) => item.label)).toEqual(["SHELF", "SEARCH", "WISHLIST", "STATS"]);
  });

  it("keeps the labels short enough for four of them on a 375px row", () => {
    for (const item of PUBLIC_NAV) {
      expect(item.label.length).toBeLessThanOrEqual(8);
    }
  });

  it("does not advertise the admin", () => {
    expect(PUBLIC_NAV.some((item) => item.href.startsWith("/admin"))).toBe(false);
  });
});

describe("activeNavHref", () => {
  it("lights up the page you are on", () => {
    expect(activeNavHref("/")).toBe("/");
    expect(activeNavHref("/search")).toBe("/search");
    expect(activeNavHref("/wishlist")).toBe("/wishlist");
    expect(activeNavHref("/stats")).toBe("/stats");
  });

  it("treats a figure page as part of the shelf", () => {
    expect(activeNavHref("/figure/pop-marvel-spider-man-last-stand-1450")).toBe("/");
  });

  it("ignores the query string and a trailing slash", () => {
    expect(activeNavHref("/wishlist?cat=peter")).toBe("/wishlist");
    expect(activeNavHref("/search/")).toBe("/search");
    expect(activeNavHref("/stats#geography")).toBe("/stats");
    expect(activeNavHref("/?cat=other")).toBe("/");
  });

  it("highlights nothing off the public map", () => {
    expect(activeNavHref("/admin/collection")).toBeNull();
    expect(activeNavHref("/login")).toBeNull();
    expect(activeNavHref("/searchlight")).toBeNull();
    expect(activeNavHref(undefined)).toBeNull();
  });
});
