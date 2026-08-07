import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicNav } from "./public-nav";

describe("PublicNav", () => {
  it("renders the four screens as links", () => {
    render(<PublicNav pathname="/" />);

    expect(screen.getByRole("link", { name: "SHELF" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "SEARCH" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "WISHLIST" })).toHaveAttribute("href", "/wishlist");
    expect(screen.getByRole("link", { name: "STATS" })).toHaveAttribute("href", "/stats");
  });

  it("marks the current screen", () => {
    render(<PublicNav pathname="/wishlist?cat=all" />);

    expect(screen.getByRole("link", { name: "WISHLIST" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "SHELF" })).not.toHaveAttribute("aria-current");
  });

  it("keeps SHELF lit on a figure page", () => {
    render(<PublicNav pathname="/figure/pop-marvel-spider-man-3" />);

    expect(screen.getByRole("link", { name: "SHELF" })).toHaveAttribute("aria-current", "page");
  });

  it("gives every target the 44px touch floor", () => {
    render(<PublicNav pathname="/stats" isAdmin />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
  });
});

/**
 * The Phase 10 rule, and the one worth a test: a guest's HTML must not merely hide the
 * console — it must not contain it. The item is never constructed, so there is nothing in the
 * DOM to find with a devtools inspector or a view-source.
 */
describe("PublicNav and the session", () => {
  it("shows a guest four items and no trace of the admin", () => {
    const { container } = render(<PublicNav pathname="/" />);

    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByRole("link", { name: "CONSOLE" })).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("CONSOLE");
    expect(container.innerHTML).not.toContain("/admin");
  });

  it("gives the owner a fifth CONSOLE tab into the back office", () => {
    render(<PublicNav pathname="/" isAdmin />);

    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "CONSOLE" })).toHaveAttribute("href", "/admin");
    // The public tabs are untouched — this is an addition, not a different nav.
    expect(screen.getByRole("link", { name: "SHELF" })).toHaveAttribute("aria-current", "page");
  });

  it("lights CONSOLE up on every admin screen", () => {
    for (const path of [
      "/admin",
      "/admin/collection",
      "/admin/collection/11111111-1111-4111-8111-111111111111/edit",
      "/admin/add?step=details",
    ]) {
      const { unmount } = render(<PublicNav pathname={path} isAdmin />);

      expect(screen.getByRole("link", { name: "CONSOLE" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "SHELF" })).not.toHaveAttribute("aria-current");
      unmount();
    }
  });

  it("keeps CONSOLE amber and off the four-tab row on a phone", () => {
    render(<PublicNav pathname="/stats" isAdmin />);

    const console_ = screen.getByRole("link", { name: "CONSOLE" });
    expect(console_.className).toContain("border-amber");
    expect(console_.parentElement?.className).toContain("col-span-4");
    // …and it takes its place in the row once there is width for five labels.
    expect(console_.parentElement?.className).toContain("sm:col-span-1");
  });

  it("fills the console tab amber when it is the current screen", () => {
    render(<PublicNav pathname="/admin" isAdmin />);

    expect(screen.getByRole("link", { name: "CONSOLE" }).className).toContain("bg-amber");
  });
});
