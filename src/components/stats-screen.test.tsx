import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SHELF_FIXTURE } from "@/test/fixtures";
import { type StoredSnapshot } from "@/lib/ebay/snapshot";
import { collectionFinances } from "@/lib/finances";
import { normalizeCategoryProgress } from "@/lib/stats";

import { MAP_MODAL_COPY } from "./map-modal";
import { StatsScreen } from "./stats-screen";
import { WebRadar } from "./web-radar";

const PROGRESS = normalizeCategoryProgress([
  { category: "peter", owned: 11, total: 120 },
  { category: "spider_verse", owned: 1, total: 60 },
  { category: "friends_foes", owned: 2, total: 62 },
  { category: "other", owned: 1, total: 5 },
]);

function snapshot(medianCents: number): StoredSnapshot {
  return {
    listingCount: 25,
    minCents: Math.round(medianCents * 0.7),
    medianCents,
    currency: "USD",
    fetchedAt: new Date("2026-08-07T11:00:00.000Z"),
  };
}

/**
 * Two of the fixture's four owned figures have a cached price — which is also the state the
 * real shelf is in the first morning after the cron ships.
 */
const FINANCES = collectionFinances(
  SHELF_FIXTURE,
  new Map([
    ["pop-marvel-spider-man-last-stand-1450", snapshot(9900)],
    ["pop-marvel-spider-man-3", snapshot(500)],
    // A figure he no longer owns, priced: it must not reach the section at all.
    ["pop-lilo-stitch-stitch-as-pineapple-1570", snapshot(50000)],
  ]),
);

describe("StatsScreen", () => {
  it("shows the three counters", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);

    expect(screen.getByText("PETER CANON")).toBeInTheDocument();
    // Twice on the page: the LCD counter, and the radar's legend one section down.
    expect(screen.getAllByText("11 / 120")).toHaveLength(2);
    expect(screen.getByText("12 / 180")).toBeInTheDocument();
    expect(screen.getByText("15 / 247")).toBeInTheDocument();
  });

  it("draws the years, empty ones included", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);

    for (const year of ["2023", "2024", "2025", "2026"]) {
      expect(screen.getByText(year)).toBeInTheDocument();
    }
  });

  it("flies a flag per country, busiest first", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);

    const geography = screen.getByText("FOUND IN THE WILD").closest("section");
    const codes = within(geography as HTMLElement)
      .getAllByRole("listitem")
      .map((node) => node.textContent);
    expect(codes[0]).toContain("RU");
    expect(codes).toHaveLength(4);
  });

  it("pins the cities on the map, between the radar and the years", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);

    const map = screen.getByText("SIGHTINGS MAP").closest("section");
    expect(within(map as HTMLElement).getByText("4 CITIES · 5 SIGHTINGS")).toBeInTheDocument();

    const cities = within(map as HTMLElement)
      .getAllByRole("listitem")
      .map((node) => node.textContent);
    expect(cities[0]).toContain("MOSCOW");
    expect(cities).toHaveLength(4);
  });

  it("offers the map as a modal, with the legend left out on the page", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);

    const map = screen.getByText("SIGHTINGS MAP").closest("section") as HTMLElement;
    expect(within(map).getByRole("button", { name: MAP_MODAL_COPY.open })).toBeInTheDocument();
    expect(within(map).getByText(MAP_MODAL_COPY.expand)).toBeInTheDocument();

    // Closed on arrival, and the legend's four cities are on the page, not behind the tap.
    expect(map.querySelector("dialog")?.open).toBe(false);
    expect(within(map).getAllByRole("listitem")).toHaveLength(4);
  });

  it("prices the collection between the counters and the radar", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} finances={FINANCES} />);

    const finances = screen.getByText("FINANCES").closest("section") as HTMLElement;
    expect(within(finances).getByText("~$104")).toBeInTheDocument();
    expect(within(finances).getByText("TOTAL VAULT VALUE")).toBeInTheDocument();

    // Both ends of the collection, each linking to the figure it names.
    expect(within(finances).getByText("MOST PRIZED")).toBeInTheDocument();
    expect(within(finances).getByText("~$99")).toBeInTheDocument();
    expect(within(finances).getByText("EASIEST FIND")).toBeInTheDocument();
    expect(within(finances).getByText("~$5")).toBeInTheDocument();
    expect(
      within(finances).getByRole("link", { name: /Spider-Man \(Last Stand\)/ }),
    ).toHaveAttribute("href", "/figure/pop-marvel-spider-man-last-stand-1450");

    // The section sits above the radar, which is where the mockup's rhythm puts a second
    // whole-shelf readout.
    const sections = Array.from(document.querySelectorAll("section"));
    expect(sections.indexOf(finances)).toBeLessThan(
      sections.indexOf(screen.getByText("WEB RADAR").closest("section") as HTMLElement),
    );
  });

  it("says how much of the shelf the total actually covers", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} finances={FINANCES} />);

    const finances = screen.getByText("FINANCES").closest("section") as HTMLElement;
    expect(within(finances).getByText(/PRICED: 2 \/ 4/)).toBeInTheDocument();
    expect(within(finances).getByText(/MORE AFTER THE NEXT NIGHTLY SWEEP/)).toBeInTheDocument();
    // The one sentence that keeps the number honest, shared with the MARKET SIGNAL panel.
    expect(
      within(finances).getByText("Active listings, not sold prices. eBay US, Buy It Now."),
    ).toBeInTheDocument();
  });

  it("never counts a figure that left the shelf, however dear it was", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} finances={FINANCES} />);

    const finances = screen.getByText("FINANCES").closest("section") as HTMLElement;
    expect(within(finances).queryByText("~$500")).not.toBeInTheDocument();
    expect(within(finances).queryByText(/Stitch As Pineapple/)).not.toBeInTheDocument();
  });

  it("renders no FINANCES section at all without keys or without a cached price", () => {
    const { unmount } = render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);
    expect(screen.queryByText("FINANCES")).not.toBeInTheDocument();
    expect(screen.queryByText("TOTAL VAULT VALUE")).not.toBeInTheDocument();
    unmount();

    // Explicit `null` is what `getCollectionFinances()` returns for both cases.
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} finances={null} />);
    expect(screen.queryByText("FINANCES")).not.toBeInTheDocument();
    // And the rest of the screen is untouched by its absence.
    expect(screen.getByText("SIGHTINGS MAP")).toBeInTheDocument();
    expect(screen.getByText("WEB RADAR")).toBeInTheDocument();
  });

  it("shows the owner a CONSOLE tab and a visitor four tabs", () => {
    const { unmount } = render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);
    expect(screen.queryByRole("link", { name: "CONSOLE" })).not.toBeInTheDocument();
    unmount();

    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} isAdmin />);
    expect(screen.getByRole("link", { name: "CONSOLE" })).toHaveAttribute("href", "/admin");
  });

  it("tells a phone how to install the shelf, without pretending to be able to do it", () => {
    render(<StatsScreen progress={PROGRESS} entries={SHELF_FIXTURE} />);

    expect(screen.getByText(/ADD TO HOME SCREEN/)).toBeInTheDocument();
    // No install button anywhere: iOS has no `beforeinstallprompt` to hang one on.
    expect(screen.queryByRole("button", { name: /INSTALL/i })).not.toBeInTheDocument();
  });

  it("does not crash on an empty shelf", () => {
    render(<StatsScreen progress={PROGRESS} entries={[]} />);

    expect(screen.getByText("No dated sightings yet.")).toBeInTheDocument();
    expect(screen.getByText("No places logged yet.")).toBeInTheDocument();
    expect(screen.getByText("Nothing pinned to the map yet.")).toBeInTheDocument();
  });
});

describe("WebRadar", () => {
  it("draws one wedge per bucket and lists the counts", () => {
    const { container } = render(<WebRadar progress={PROGRESS} />);

    // 4 wedges + 4 rings.
    expect(container.querySelectorAll("polygon")).toHaveLength(8);
    expect(container.querySelectorAll("line")).toHaveLength(12);

    expect(screen.getByText("PETER PARKER")).toBeInTheDocument();
    expect(screen.getByText("11 / 120")).toBeInTheDocument();
    expect(screen.getByText("2 / 62")).toBeInTheDocument();
  });

  it("is decorative — the legend carries the numbers", () => {
    const { container } = render(<WebRadar progress={PROGRESS} />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the same markup for the same numbers", () => {
    const first = render(<WebRadar progress={PROGRESS} />).container.innerHTML;
    const second = render(<WebRadar progress={PROGRESS} />).container.innerHTML;
    expect(first).toBe(second);
  });

  it("collapses an empty bucket onto the centre instead of dividing by zero", () => {
    const { container } = render(
      <WebRadar
        progress={normalizeCategoryProgress([{ category: "peter", owned: 0, total: 0 }])}
      />,
    );

    const wedge = container.querySelector("polygon");
    expect(wedge?.getAttribute("points")).toBe("100,100 100,100 100,100 100,100 100,100");
  });
});
