import { describe, expect, it } from "vitest";

import manifest from "./manifest";

/**
 * A manifest is untestable in the useful sense — nobody can assert "iOS installed it" here.
 * What can be asserted is the handful of fields whose absence turns a home-screen app back
 * into a browser bookmark, and the icon set Android needs to avoid cropping a leg off.
 */
describe("manifest", () => {
  const value = manifest();

  it("is a standalone app called SPIDEY", () => {
    expect(value.name).toBe("SPIDEY SHELF");
    expect(value.short_name).toBe("SPIDEY");
    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
  });

  it("paints the splash in the app's own navy, not white", () => {
    expect(value.background_color).toBe("#0d2440");
    expect(value.theme_color).toBe("#1b41c8");
  });

  it("ships both icon purposes at both sizes", () => {
    const icons = value.icons ?? [];
    for (const purpose of ["any", "maskable"]) {
      for (const size of ["192x192", "512x512"]) {
        expect(
          icons.some((icon) => icon.purpose === purpose && icon.sizes === size),
          `${purpose} ${size}`,
        ).toBe(true);
      }
    }
  });

  it("points every icon at a real path under /icons", () => {
    for (const icon of value.icons ?? []) {
      expect(icon.src).toMatch(/^\/icons\/[a-z0-9-]+\.png$/);
      expect(icon.type).toBe("image/png");
    }
  });
});
