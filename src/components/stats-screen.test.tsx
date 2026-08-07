import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SHELF_FIXTURE } from "@/test/fixtures";
import { normalizeCategoryProgress } from "@/lib/stats";

import { StatsScreen } from "./stats-screen";
import { WebRadar } from "./web-radar";

const PROGRESS = normalizeCategoryProgress([
  { category: "peter", owned: 11, total: 120 },
  { category: "spider_verse", owned: 1, total: 60 },
  { category: "friends_foes", owned: 2, total: 62 },
  { category: "other", owned: 1, total: 5 },
]);

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
