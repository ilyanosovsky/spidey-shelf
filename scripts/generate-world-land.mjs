/**
 * Derives `src/lib/world-land.ts` — the SIGHTINGS MAP's landmass outline.
 *
 *   node scripts/generate-world-land.mjs [--precision=0] [--min-span=1.2]
 *
 * Input: Natural Earth 1:110m "land", as published by the `world-atlas` package
 * (TopoJSON, public domain / CC0). It is fetched once, converted, and thrown away —
 * the repo carries the derived path data, not a 55 KB JSON and not a runtime dependency.
 *
 * The projection is equirectangular, and equirectangular is *linear* in longitude and
 * latitude, so the output lives directly in degree space: `x = lng + 180`, `y = 90 - lat`,
 * viewBox `0 0 360 180`. That is what lets `SightingsMap` crop to a bounding box by
 * changing the viewBox alone — no re-projection, no second copy of the data.
 *
 * Two things this has to get right, and both were bugs before they were features:
 *
 *   1. **The antimeridian.** Eurasia is one ring that runs off the right edge and comes
 *      back on the left, so a naive `L` between those two points draws a straight line
 *      across the entire Pacific. Every segment longer than 180° is split at the map edge
 *      instead, into two subpaths that meet the border where the real coastline does.
 *   2. **Precision is the simplification.** Coordinates are rounded to whole degrees and
 *      consecutive duplicates dropped, which takes the path from 54 KB to ~27 KB and
 *      leaves the coastlines visibly stepped — which is the right look for this project
 *      rather than a compromise it tolerates.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "lib",
  "world-land.ts",
);

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  }),
);

/** Decimal places kept. 0 = whole degrees ≈ 111 km — deliberately chunky. */
const PRECISION = Number(args.precision ?? 0);
/** Rings whose bounding box is smaller than this (in degrees) are dropped. */
const MIN_SPAN = Number(args["min-span"] ?? 1.2);

const round = (value) => Number(value.toFixed(PRECISION));

/** Decode TopoJSON's quantized, delta-encoded arcs into absolute [lng, lat] pairs. */
function decodeArcs(topology) {
  const { scale, translate } = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
}

/** Stitch a ring's arc indices into one point list. A negative index means "reversed". */
function stitchRing(indices, arcs) {
  const points = [];
  for (const index of indices) {
    const reversed = index < 0;
    const arc = arcs[reversed ? ~index : index];
    for (const point of reversed ? [...arc].reverse() : arc) {
      const last = points.at(-1);
      if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
    }
  }
  return points;
}

/**
 * One ring → one or more closed subpaths in degree space, split at the antimeridian.
 *
 * The ring is walked as a closed loop (the first point is appended), and any step wider
 * than half the world is treated as a wrap: the current subpath is finished at the edge it
 * left through, and a new one starts at the opposite edge at the same latitude.
 */
function subpathsFor(points) {
  const projected = points.map(([lng, lat]) => [round(lng + 180), round(90 - lat)]);
  const loop = [...projected, projected[0]];

  const subpaths = [];
  let current = [loop[0]];

  for (let index = 1; index < loop.length; index += 1) {
    const [px, py] = loop[index - 1];
    const [qx, qy] = loop[index];

    if (Math.abs(qx - px) > 180) {
      const edgeY = round((py + qy) / 2);
      const leavingEast = qx < px;
      current.push([leavingEast ? 360 : 0, edgeY]);
      subpaths.push(current);
      current = [
        [leavingEast ? 0 : 360, edgeY],
        [qx, qy],
      ];
      continue;
    }

    current.push([qx, qy]);
  }
  subpaths.push(current);

  return subpaths
    .map((subpath) =>
      subpath.filter(
        (point, index) =>
          index === 0 || point[0] !== subpath[index - 1][0] || point[1] !== subpath[index - 1][1],
      ),
    )
    .filter((subpath) => subpath.length >= 3);
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`${SOURCE_URL} → HTTP ${response.status}`);
const topology = await response.json();
const arcs = decodeArcs(topology);

const object = topology.objects.land;
const geometries = object.type === "GeometryCollection" ? object.geometries : [object];
const polygons = geometries.flatMap((geometry) =>
  geometry.type === "MultiPolygon" ? geometry.arcs : [geometry.arcs],
);

const parts = [];
let kept = 0;
let dropped = 0;

for (const polygon of polygons) {
  for (const [ringIndex, indices] of polygon.entries()) {
    const points = stitchRing(indices, arcs);
    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);
    const span = Math.max(
      Math.max(...lngs) - Math.min(...lngs),
      Math.max(...lats) - Math.min(...lats),
    );

    // Holes (ringIndex > 0 — the Caspian, say) are kept whenever their outer ring survived.
    if (points.length < 4 || (ringIndex === 0 && span < MIN_SPAN)) {
      dropped += 1;
      continue;
    }

    for (const subpath of subpathsFor(points)) {
      kept += 1;
      parts.push(`M${subpath.map(([x, y]) => `${x} ${y}`).join("L")}Z`);
    }
  }
}

const data = parts.join("");

writeFileSync(
  OUT,
  `/**
 * The world, as one SVG path — the ground under the SIGHTINGS MAP.
 *
 * **Provenance: Natural Earth 1:110m "land", public domain (CC0)**, taken from the
 * \`world-atlas\` package (\`land-110m.json\`) and converted by
 * \`scripts/generate-world-land.mjs\`. Natural Earth data carries no copyright and no
 * attribution requirement; the line is here because a map with no cited source is a map
 * nobody can check.
 *
 * **Coordinate space is degrees, not pixels**: \`x = lng + 180\`, \`y = 90 - lat\`, so the
 * whole world is \`viewBox="0 0 360 180"\` and cropping to a region is nothing but a
 * narrower viewBox. Equirectangular is linear in lng/lat, which is exactly why this map
 * projection was chosen over anything prettier.
 *
 * Coordinates are rounded to whole degrees (~111 km) and rings smaller than ${MIN_SPAN}° are
 * dropped: ${(data.length / 1024).toFixed(1)} KB instead of 54 KB, and coastlines that step rather than curve —
 * which is the house style. Do not hand-edit; re-run the script.
 */
export const WORLD_LAND_PATH =
  "${data}";
`,
  "utf8",
);

process.stderr.write(
  `world-land: ${kept} subpaths (${dropped} rings dropped) → ${(data.length / 1024).toFixed(1)} KB → ${path.relative(process.cwd(), OUT)}\n`,
);
