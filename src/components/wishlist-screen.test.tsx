import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WISHLIST_FIXTURE } from "@/test/fixtures";

import { WishlistScreen } from "./wishlist-screen";

describe("WishlistScreen", () => {
  it("headlines how many spiders are still out there", () => {
    render(<WishlistScreen figures={WISHLIST_FIXTURE} filter="peter" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "WANTED: 2 SPIDERS STILL OUT THERE",
    );
  });

  it("lands on the PETER PARKER tab and marks it", () => {
    render(<WishlistScreen figures={WISHLIST_FIXTURE} filter="peter" />);

    expect(screen.getByRole("link", { name: "PETER PARKER 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ALL 6" })).toHaveAttribute(
      "href",
      "/wishlist?cat=all",
    );
  });

  it("points every card at the shareable search URL, not at a figure page", () => {
    render(<WishlistScreen figures={WISHLIST_FIXTURE} filter="peter" />);

    expect(screen.getByRole("link", { name: /Spider-Man \(White Spider\)/ })).toHaveAttribute(
      "href",
      "/search?q=334",
    );
    expect(screen.getAllByText("WANTED").length).toBeGreaterThan(0);
  });

  it("orders a tab by box number with the numberless packs last", () => {
    render(<WishlistScreen figures={WISHLIST_FIXTURE} filter="all" />);

    const cards = screen.getAllByRole("article");
    expect(cards[0]).toHaveTextContent("Spider-Man (White Spider)");
    expect(cards[cards.length - 1]).toHaveTextContent("Spider-Man: No Way Home (3 Pack)");
  });

  it("celebrates an empty bucket instead of apologising for it", () => {
    render(<WishlistScreen figures={[]} filter="peter" />);

    expect(screen.getByText("NOTHING LEFT IN THIS SECTOR")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("gives every card its own SHARE button", () => {
    render(<WishlistScreen figures={WISHLIST_FIXTURE} filter="spider_verse" />);

    expect(screen.getAllByRole("button", { name: /^Share / })).toHaveLength(2);
  });

  it("shows a price chip only on the cards a price is already cached for", () => {
    const [first] = WISHLIST_FIXTURE;
    render(
      <WishlistScreen
        figures={WISHLIST_FIXTURE}
        filter="all"
        prices={new Map([[first.slug, "~$25"]])}
      />,
    );

    expect(screen.getAllByText("~$25")).toHaveLength(1);
  });

  it("looks exactly like Phase 5 when the owner has no eBay keys", () => {
    const withoutPrices = render(<WishlistScreen figures={WISHLIST_FIXTURE} filter="all" />)
      .container.innerHTML;
    const withEmptyMap = render(
      <WishlistScreen figures={WISHLIST_FIXTURE} filter="all" prices={new Map()} />,
    ).container.innerHTML;

    expect(withoutPrices).toBe(withEmptyMap);
    expect(withoutPrices).not.toContain("~$");
  });
});
