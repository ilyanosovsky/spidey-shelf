import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type MarketPanel } from "@/lib/ebay/market";

import { MarketSignal, PriceChip } from "./market-signal";

function panel(overrides: Partial<MarketPanel> = {}): MarketPanel {
  return {
    listingCount: 25,
    minCents: 1899,
    medianCents: 2450,
    currency: "USD",
    ageLabel: "CHECKED 6H AGO",
    stale: false,
    searchUrl: "https://www.ebay.com/sch/i.html?_nkw=Funko+Pop+Spider-Man+1450&LH_BIN=1",
    ...overrides,
  };
}

describe("MarketSignal", () => {
  it("leads with the median and the sample size", () => {
    render(<MarketSignal panel={panel()} />);
    expect(screen.getByText("~$25 · 25 LISTINGS")).toBeInTheDocument();
    expect(screen.getByText("MIN $19")).toBeInTheDocument();
  });

  it("always says these are asking prices", () => {
    render(<MarketSignal panel={panel()} />);
    expect(screen.getByText(/Active listings, not sold prices/)).toBeInTheDocument();
  });

  it("links out safely and in a new tab", () => {
    render(<MarketSignal panel={panel()} />);
    const link = screen.getByRole("link", { name: /SEE ON EBAY/ });
    expect(link).toHaveAttribute("href", panel().searchUrl);
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("dates every number it shows", () => {
    render(<MarketSignal panel={panel({ ageLabel: "CHECKED 3D AGO" })} />);
    expect(screen.getByText(/CHECKED 3D AGO/)).toBeInTheDocument();
  });

  it("admits when the number is the last known one", () => {
    render(<MarketSignal panel={panel({ stale: true, ageLabel: "CHECKED 3D AGO" })} />);
    expect(screen.getByText(/EBAY DID NOT ANSWER/)).toBeInTheDocument();
  });

  it("says nothing about eBay when the refresh worked", () => {
    render(<MarketSignal panel={panel()} />);
    expect(screen.queryByText(/EBAY DID NOT ANSWER/)).not.toBeInTheDocument();
  });

  it("prints a non-dollar currency without inventing a symbol", () => {
    render(<MarketSignal panel={panel({ currency: "AUD", medianCents: 3400, minCents: 2900 })} />);
    expect(screen.getByText("~AUD 34 · 25 LISTINGS")).toBeInTheDocument();
    expect(screen.getByText("MIN AUD 29")).toBeInTheDocument();
  });
});

describe("PriceChip", () => {
  it("is one number and nothing else — the wishlist has no room for a panel", () => {
    const { container } = render(<PriceChip label="~$25" />);
    expect(container.textContent).toBe("~$25");
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
