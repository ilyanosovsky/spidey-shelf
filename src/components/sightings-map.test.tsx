import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildSightingsMap } from "@/lib/sightings-map";
import { shelfEntry, SHELF_FIXTURE, VERONIKA_SHELF_ENTRY } from "@/test/fixtures";

import { SightingsLegend, SightingsMap } from "./sightings-map";

const DATA = buildSightingsMap(SHELF_FIXTURE);

/** Amsterdam with two of his spiders, one of her Stitches and one of her Grogus. */
const MIXED = buildSightingsMap([
  shelfEntry({ slug: "p1", acquiredCity: "Amsterdam", acquiredCountry: "NL" }),
  shelfEntry({ slug: "p2", acquiredCity: "Amsterdam", acquiredCountry: "NL" }),
  VERONIKA_SHELF_ENTRY,
  shelfEntry({
    slug: "g1",
    category: "grogu",
    status: "veronika",
    acquiredCity: "Amsterdam",
    acquiredCountry: "NL",
  }),
]);

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

  it("draws one plate per kind at a mixed city, and badges only the kind with several", () => {
    const { container } = render(<SightingsMap data={MIXED} />);
    const plates = [...container.querySelectorAll("rect")].filter(
      (rect) => rect.getAttribute("opacity") === "0.9",
    );
    expect(plates).toHaveLength(3);
    // Plates sit side by side, left to right, never on top of each other.
    const xs = plates.map((rect) => Number(rect.getAttribute("x")));
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(3);

    const badges = [...container.querySelectorAll("text")].map((node) => node.textContent);
    expect(badges).toEqual(["2"]);
  });

  it("draws a spider-only city as a single plate", () => {
    const { container } = render(<SightingsMap data={buildSightingsMap([shelfEntry()])} />);
    const plates = [...container.querySelectorAll("rect")].filter(
      (rect) => rect.getAttribute("opacity") === "0.9",
    );
    expect(plates).toHaveLength(1);
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

  it("is the key to the icons: a mini sprite and a count per kind, plus a spoken line", () => {
    render(<SightingsLegend data={MIXED} />);
    const [chip] = screen.getAllByRole("listitem");

    const kinds = [...chip.querySelectorAll("svg")].map((svg) => svg.dataset.iconKind);
    expect(kinds).toEqual(["spider", "stitch", "grogu"]);
    for (const svg of chip.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
    expect(within(chip).getByText("2 spiders, 1 Stitch, 1 Grogu")).toHaveClass("sr-only");
    expect(chip.textContent).toContain("AMSTERDAM");
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
