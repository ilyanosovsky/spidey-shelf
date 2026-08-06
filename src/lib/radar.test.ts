import { describe, expect, it } from "vitest";

import {
  fillFraction,
  polygonPoints,
  RADAR_CENTER,
  RADAR_RADIUS,
  RADAR_RINGS,
  RADAR_VIEWBOX,
  radarPoint,
  radarSteps,
  ringPolygon,
  ringRadius,
  sectorWedge,
  spokeEnd,
  SPOKES_PER_SECTOR,
} from "./radar";

const CENTER = RADAR_VIEWBOX / 2;

function distanceFromCentre(point: { x: number; y: number }): number {
  return Math.hypot(point.x - CENTER, point.y - CENTER);
}

describe("radarPoint", () => {
  it("starts at the top and turns clockwise", () => {
    expect(radarPoint(0, 12, 88)).toEqual({ x: 100, y: 12 });
    expect(radarPoint(3, 12, 88)).toEqual({ x: 188, y: 100 });
    expect(radarPoint(6, 12, 88)).toEqual({ x: 100, y: 188 });
    expect(radarPoint(9, 12, 88)).toEqual({ x: 12, y: 100 });
  });

  it("wraps past a full turn, so a wedge can close on its neighbour", () => {
    expect(radarPoint(12, 12, 88)).toEqual(radarPoint(0, 12, 88));
  });

  it("collapses onto the centre at radius zero", () => {
    expect(radarPoint(5, 12, 0)).toEqual(RADAR_CENTER);
  });

  it("rounds to two decimals, so the markup is byte-identical every render", () => {
    const point = radarPoint(1, 12, 88);
    expect(point).toEqual(radarPoint(1, 12, 88));
    expect(String(point.x)).toMatch(/^\d+(\.\d{1,2})?$/);
  });
});

describe("ringPolygon", () => {
  it("has one vertex per web segment", () => {
    expect(radarSteps(4)).toBe(4 * SPOKES_PER_SECTOR);
    expect(ringPolygon(1, 4)).toHaveLength(12);
    expect(ringPolygon(RADAR_RINGS, 4)).toHaveLength(12);
  });

  it("puts every vertex of a ring at that ring's radius", () => {
    for (const point of ringPolygon(2, 4)) {
      expect(distanceFromCentre(point)).toBeCloseTo(ringRadius(2), 1);
    }
  });

  it("spaces the rings evenly out to the rim", () => {
    expect(ringRadius(1)).toBe(RADAR_RADIUS / 4);
    expect(ringRadius(RADAR_RINGS)).toBe(RADAR_RADIUS);
  });
});

describe("spokeEnd", () => {
  it("reaches the rim", () => {
    expect(distanceFromCentre(spokeEnd(5, 4))).toBeCloseTo(RADAR_RADIUS, 1);
  });
});

describe("fillFraction", () => {
  it("is owned over total", () => {
    expect(fillFraction(11, 120)).toBeCloseTo(0.0917, 4);
    expect(fillFraction(60, 120)).toBe(0.5);
  });

  it("never divides by an empty bucket", () => {
    expect(fillFraction(0, 0)).toBe(0);
    expect(fillFraction(3, 0)).toBe(0);
  });

  it("clamps to the web", () => {
    // Owning more than the catalog knows about is a seed that is behind, not a bug worth
    // drawing outside the rings.
    expect(fillFraction(5, 4)).toBe(1);
    expect(fillFraction(-2, 10)).toBe(0);
  });
});

describe("sectorWedge", () => {
  it("is the centre plus that sector's arc", () => {
    const wedge = sectorWedge(0, 4, 1);
    expect(wedge).toHaveLength(SPOKES_PER_SECTOR + 2);
    expect(wedge[0]).toEqual(RADAR_CENTER);
    for (const point of wedge.slice(1)) {
      expect(distanceFromCentre(point)).toBeCloseTo(RADAR_RADIUS, 1);
    }
  });

  it("collapses to nothing when the bucket is empty", () => {
    expect(sectorWedge(2, 4, 0).every((point) => point.x === 100 && point.y === 100)).toBe(true);
  });

  it("fills proportionally", () => {
    const half = sectorWedge(1, 4, 0.5);
    expect(distanceFromCentre(half[1])).toBeCloseTo(RADAR_RADIUS / 2, 1);
  });

  it("closes exactly on the next sector's first thread", () => {
    const first = sectorWedge(0, 4, 1);
    const second = sectorWedge(1, 4, 1);
    expect(first[first.length - 1]).toEqual(second[1]);
  });

  it("covers the whole web when every sector is full", () => {
    const rim = sectorWedge(3, 4, 1);
    expect(rim[rim.length - 1]).toEqual(radarPoint(0, radarSteps(4), RADAR_RADIUS));
  });
});

describe("polygonPoints", () => {
  it("renders the attribute SVG expects", () => {
    expect(
      polygonPoints([
        { x: 1, y: 2 },
        { x: 3.25, y: 4 },
      ]),
    ).toBe("1,2 3.25,4");
    expect(polygonPoints([])).toBe("");
  });
});
