/**
 * The geometry behind `WebRadar` — a spider web used as a progress chart.
 *
 * Kept out of the component for the same reason every other decision on this site is: it is
 * arithmetic, so it can be unit-tested exactly, and a rendering bug then has one place to
 * hide instead of two. Everything here is deterministic — same numbers in, byte-identical
 * `points` strings out, on any machine and after any redeploy.
 *
 * The layout: `SECTORS` sectors (one per catalog bucket), each subdivided into
 * `SPOKES_PER_SECTOR` web segments, so the rings are 12-gons and read as a web rather than
 * as a diamond. Step 0 is straight up and steps advance clockwise, like a clock face.
 */

/** A square viewBox — the SVG scales with its container, the numbers never change. */
export const RADAR_VIEWBOX = 200;

const CENTER = RADAR_VIEWBOX / 2;

/** Outer rim, leaving a couple of units of air inside the viewBox for the stroke. */
export const RADAR_RADIUS = 88;

/** Concentric rings, i.e. the 25 % / 50 % / 75 % / 100 % gridlines. */
export const RADAR_RINGS = 4;

/** Web segments per sector. Three is enough to bend the rings into a web. */
export const SPOKES_PER_SECTOR = 3;

export interface RadarPoint {
  x: number;
  y: number;
}

/** Two decimals: enough for a 200-unit viewBox, and it keeps float noise out of the markup. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The point `step` steps clockwise from the top, at `radius` from the centre.
 *
 * `step` may run past `steps` (the wedges walk through a sector's boundary) — the angle
 * simply keeps going round, which is what makes a closing arc land on its neighbour exactly.
 */
export function radarPoint(step: number, steps: number, radius: number): RadarPoint {
  const angle = -Math.PI / 2 + (2 * Math.PI * step) / steps;
  return {
    x: round(CENTER + radius * Math.cos(angle)),
    y: round(CENTER + radius * Math.sin(angle)),
  };
}

/** How many web segments the whole radar has. */
export function radarSteps(sectors: number): number {
  return sectors * SPOKES_PER_SECTOR;
}

/** The radius of ring `ring` (1-based; ring `RADAR_RINGS` is the rim). */
export function ringRadius(ring: number, rings: number = RADAR_RINGS): number {
  return round((RADAR_RADIUS * ring) / rings);
}

/** One concentric web ring, as the polygon its `points` attribute needs. */
export function ringPolygon(
  ring: number,
  sectors: number,
  rings: number = RADAR_RINGS,
): RadarPoint[] {
  const steps = radarSteps(sectors);
  const radius = ringRadius(ring, rings);
  return Array.from({ length: steps }, (_, step) => radarPoint(step, steps, radius));
}

/** A radial thread: centre → rim, at every web segment boundary. */
export function spokeEnd(step: number, sectors: number): RadarPoint {
  return radarPoint(step, radarSteps(sectors), RADAR_RADIUS);
}

export const RADAR_CENTER: RadarPoint = { x: CENTER, y: CENTER };

/**
 * `owned / total` as a 0…1 fill, guarded against the two cases that produce `NaN` or a
 * wedge spilling out of the web: an empty bucket, and more owned than the catalog knows of
 * (which is possible the moment the owner buys something the seed has not heard about).
 */
export function fillFraction(owned: number, total: number): number {
  if (!Number.isFinite(owned) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.max(owned / total, 0), 1);
}

/**
 * The filled part of one sector: the centre, then the arc across that sector at
 * `fraction × RADAR_RADIUS`.
 *
 * A fully empty sector collapses onto the centre point, which renders as nothing at all —
 * the honest picture of a bucket with no figures in it.
 */
export function sectorWedge(sector: number, sectors: number, fraction: number): RadarPoint[] {
  const steps = radarSteps(sectors);
  const radius = round(RADAR_RADIUS * Math.min(Math.max(fraction, 0), 1));
  const first = sector * SPOKES_PER_SECTOR;

  return [
    RADAR_CENTER,
    ...Array.from({ length: SPOKES_PER_SECTOR + 1 }, (_, offset) =>
      radarPoint(first + offset, steps, radius),
    ),
  ];
}

/** `[{x:1,y:2}, …]` → `"1,2 …"`, the only string an SVG `points` attribute understands. */
export function polygonPoints(points: readonly RadarPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
