import { describe, expect, it } from "vitest";

import { activeNavHref, ADMIN_NAV, CONSOLE_NAV_ITEM, navItemsFor, PUBLIC_NAV } from "./nav";

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

describe("navItemsFor", () => {
  it("gives a guest exactly the four public tabs", () => {
    expect(navItemsFor(false)).toEqual(PUBLIC_NAV);
    expect(navItemsFor(false)).toHaveLength(4);
  });

  it("adds CONSOLE for a verified admin session, last", () => {
    const items = navItemsFor(true);

    expect(items).toHaveLength(5);
    expect(items.slice(0, 4)).toEqual([...PUBLIC_NAV]);
    expect(items[4]).toEqual({ href: "/admin", label: "CONSOLE" });
    expect(items[4]).toEqual(CONSOLE_NAV_ITEM);
  });

  it("never leaks the console into the guest array — the two are separate objects", () => {
    // The admin nav is a copy, so pushing onto it could not mutate the public one.
    expect(ADMIN_NAV).not.toBe(PUBLIC_NAV);
    expect(navItemsFor(false).some((item) => item.href.startsWith("/admin"))).toBe(false);
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

  it("treats every back-office screen as the console", () => {
    expect(activeNavHref("/admin")).toBe("/admin");
    expect(activeNavHref("/admin/collection")).toBe("/admin");
    expect(activeNavHref("/admin/collection/11111111-1111-4111-8111-111111111111/edit")).toBe(
      "/admin",
    );
    expect(activeNavHref("/admin/add?step=confirm&ref=abc")).toBe("/admin");
  });

  it("ignores the query string and a trailing slash", () => {
    expect(activeNavHref("/wishlist?cat=peter")).toBe("/wishlist");
    expect(activeNavHref("/search/")).toBe("/search");
    expect(activeNavHref("/stats#geography")).toBe("/stats");
    expect(activeNavHref("/?cat=other")).toBe("/");
    expect(activeNavHref("/admin/")).toBe("/admin");
  });

  it("highlights nothing off the map", () => {
    expect(activeNavHref("/login")).toBeNull();
    expect(activeNavHref("/searchlight")).toBeNull();
    expect(activeNavHref("/administrator")).toBeNull();
    expect(activeNavHref(undefined)).toBeNull();
  });
});
