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
    render(<PublicNav pathname="/stats" />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
  });
});
