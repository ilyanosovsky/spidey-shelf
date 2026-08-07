import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildSightingsMap } from "@/lib/sightings-map";
import { shelfEntry, SHELF_FIXTURE } from "@/test/fixtures";

import { SightingsLegend, SightingsMap } from "./sightings-map";

const DATA = buildSightingsMap(SHELF_FIXTURE);

describe("SightingsMap", () => {
  it("crops to a viewBox that holds the markers", () => {
    const { container } = render(<SightingsMap data={DATA} />);
    const svg = container.querySelector("svg");

    const [x, y, width, height] = (svg?.getAttribute("viewBox") ?? "").split(" ").map(Number);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    for (const marker of DATA.markers) {
      expect(marker.point.x).toBeGreaterThanOrEqual(x);
      expect(marker.point.x).toBeLessThanOrEqual(x + width);
      expect(marker.point.y).toBeGreaterThanOrEqual(y);
      expect(marker.point.y).toBeLessThanOrEqual(y + height);
    }
  });

  it("draws the landmass and the graticule", () => {
    const { container } = render(<SightingsMap data={DATA} />);
    expect(container.querySelectorAll("path").length).toBe(1);
    expect(container.querySelectorAll("line").length).toBeGreaterThan(0);
  });

  it("stays decorative — the legend below it carries the facts", () => {
    const { container } = render(<SightingsMap data={DATA} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("badges only the clustered cities", () => {
    const { container } = render(<SightingsMap data={DATA} />);
    // Moscow is the only city in the fixture with two figures.
    const badges = [...container.querySelectorAll("text")].map((node) => node.textContent);
    expect(badges).toEqual(["2"]);
  });

  it("captions itself with the totals", () => {
    render(<SightingsMap data={DATA} />);
    expect(screen.getByText("4 CITIES · 5 SIGHTINGS")).toBeInTheDocument();
  });

  it("has no markers and still renders on an empty shelf", () => {
    const { container } = render(<SightingsMap data={buildSightingsMap([])} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });
});

describe("SightingsLegend", () => {
  it("lists flag, city and count as real text", () => {
    render(<SightingsLegend data={DATA} />);
    const items = screen.getAllByRole("listitem").map((node) => node.textContent);
    expect(items[0]).toContain("MOSCOW");
    expect(items[0]).toContain("2");
    expect(items).toHaveLength(4);
  });

  it("is not a set of links — there are no city pages to link to", () => {
    render(<SightingsLegend data={DATA} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("names the figures it cannot place, instead of losing them", () => {
    const data = buildSightingsMap([
      shelfEntry({
        slug: "milan",
        name: "Spider-Man 2099",
        acquiredCity: "Milan",
        acquiredCountry: "IT",
      }),
    ]);
    render(<SightingsLegend data={data} />);

    const line = screen.getByText(/UNCHARTED SECTORS/).closest("p");
    expect(
      within(line as HTMLElement).getByText(/Spider-Man 2099 \(MILAN, IT\)/),
    ).toBeInTheDocument();
  });

  it("says nothing about uncharted sectors when every city is known", () => {
    render(<SightingsLegend data={DATA} />);
    expect(screen.queryByText(/UNCHARTED SECTORS/)).not.toBeInTheDocument();
  });
});
