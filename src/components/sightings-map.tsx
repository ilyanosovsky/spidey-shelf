import { graticule, hairline, mapBounds, markerCell, viewBoxOf, type MapBounds } from "@/lib/geo";
import { sightingsMapCaption, type CitySighting, type SightingsMapData } from "@/lib/sightings-map";
import { WORLD_LAND_PATH } from "@/lib/world-land";

import { CATEGORY_ACCENT } from "./pixel-spider-art";

/**
 * The travel map: where the collection was actually found.
 *
 * The reference gadget's world screen — dark navy ground, a thin graticule, and pixel spiders
 * sitting on the cities. Nothing here is a map library: the landmass is one SVG path in
 * `src/lib/world-land.ts` (Natural Earth 110m, public domain, rounded to whole degrees so the
 * coastlines step), the projection is `x = lng + 180 / y = 90 - lat`, and the crop is a
 * viewBox computed from the markers themselves. That is the whole trick — equirectangular is
 * linear, so "zoom to the places he has been" costs one `viewBox` attribute.
 *
 * A server component with no props but data, like everything else on the public site.
 *
 * The SVG is `aria-hidden`: it is a picture of the legend beneath it, and the legend is real
 * text with the flag, the city and the count. Same rule as `WebRadar` — nothing on this
 * screen is only available as a shape.
 */
export function SightingsMap({
  data,
  className = "",
}: {
  data: SightingsMapData;
  className?: string;
}) {
  const bounds = mapBounds(data.markers.map((marker) => marker.point));
  const lines = graticule(bounds);
  const stroke = hairline(bounds);
  const cell = markerCell(bounds);

  return (
    <div className={className}>
      <svg
        viewBox={viewBoxOf(bounds)}
        role="presentation"
        aria-hidden="true"
        focusable="false"
        // No width/height attributes: with a viewBox and `h-auto`, the panel takes its
        // aspect ratio from the crop, so a wide crop is a wide panel instead of a letterbox.
        className="block h-auto w-full rounded border-2 border-ink-px bg-navy-deep"
      >
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          style={{ fill: "var(--color-navy-deep)" }}
        />

        <g style={{ stroke: "var(--color-blue-frame)" }} strokeWidth={stroke} opacity={0.35}>
          {lines.meridians.map((x) => (
            <line key={`meridian-${x}`} x1={x} y1={bounds.y} x2={x} y2={bounds.y + bounds.height} />
          ))}
          {lines.parallels.map((y) => (
            <line key={`parallel-${y}`} x1={bounds.x} y1={y} x2={bounds.x + bounds.width} y2={y} />
          ))}
        </g>

        <path
          d={WORLD_LAND_PATH}
          style={{ fill: "var(--color-navy-panel)", stroke: "var(--color-blue-frame)" }}
          strokeWidth={stroke * 1.4}
          strokeLinejoin="round"
        />

        {/*
         * Drawn smallest-first, so where two cities overlap — and at this scale Tbilisi and
         * Batumi always will — the busier one ends up on top rather than behind.
         */}
        {[...data.markers].reverse().map((marker) => (
          <SpiderMarker key={marker.key} marker={marker} cell={cell} bounds={bounds} />
        ))}
      </svg>

      <p className="font-pixel mt-3 text-[10px] leading-relaxed tracking-wider text-lcd-glow">
        {sightingsMapCaption(data)}
      </p>
    </div>
  );
}

/**
 * The 5×5 spider — `PixelSpiderArt`'s 16×16 sprite boiled down to what survives at 25px.
 *
 * Six leg cells at the corners and mid-height, a 3×3 body, two cream eyes. Everything below
 * five cells stops reading as a spider and starts reading as a smudge, and everything above
 * it makes nine markers on one map touch each other.
 */
const MARKER_LEGS: readonly (readonly [number, number])[] = [
  [0, 0],
  [4, 0],
  [0, 2],
  [4, 2],
  [0, 4],
  [4, 4],
];

const MARKER_EYES: readonly number[] = [1, 3];

function SpiderMarker({
  marker,
  cell,
  bounds,
}: {
  marker: CitySighting;
  cell: number;
  bounds: MapBounds;
}) {
  const accent = CATEGORY_ACCENT[marker.category];
  const left = marker.point.x - 2.5 * cell;
  const top = marker.point.y - 2.5 * cell;

  return (
    <g shapeRendering="crispEdges">
      {/* A dark plate under the sprite: coral legs on navy land would otherwise disappear. */}
      <rect
        x={left - 0.4 * cell}
        y={top - 0.4 * cell}
        width={5.8 * cell}
        height={5.8 * cell}
        style={{ fill: "var(--color-navy-deep)", stroke: "var(--color-ink-px)" }}
        strokeWidth={cell * 0.3}
        opacity={0.9}
      />

      {MARKER_LEGS.map(([column, row]) => (
        <rect
          key={`leg-${column}-${row}`}
          x={left + column * cell}
          y={top + row * cell}
          width={cell}
          height={cell}
          style={{ fill: accent }}
        />
      ))}

      <rect
        x={left + cell}
        y={top + cell}
        width={3 * cell}
        height={3 * cell}
        style={{ fill: accent }}
      />

      {MARKER_EYES.map((column) => (
        <rect
          key={`eye-${column}`}
          x={left + column * cell}
          y={top + cell}
          width={cell}
          height={cell}
          style={{ fill: "var(--color-cream)" }}
        />
      ))}

      {marker.count > 1 ? (
        <CountBadge marker={marker} cell={cell} left={left} top={top} bounds={bounds} />
      ) : null}
    </g>
  );
}

/**
 * `×5` on an amber chip at the pin's shoulder — one marker, several figures.
 *
 * It flips to the left of the sprite when the city sits near the right edge of the crop, so
 * Moscow's badge cannot end up half outside the panel.
 */
function CountBadge({
  marker,
  cell,
  left,
  top,
  bounds,
}: {
  marker: CitySighting;
  cell: number;
  left: number;
  top: number;
  bounds: MapBounds;
}) {
  const width = cell * (marker.count > 9 ? 3.2 : 2.4);
  const height = cell * 2.2;
  const flip = marker.point.x + 4 * cell > bounds.x + bounds.width;
  const x = flip ? left - width + cell * 0.8 : left + 4.2 * cell;
  const y = top - cell * 1.6;

  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: "var(--color-amber)", stroke: "var(--color-ink-px)" }}
        strokeWidth={cell * 0.3}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={cell * 1.5}
        className="font-pixel"
        style={{ fill: "var(--color-ink-px)" }}
      >
        {marker.count}
      </text>
    </>
  );
}

/**
 * Flag · city · count under the map — the legend, and the accessible version of the picture.
 *
 * Deliberately not links. There are no city pages, and a link that goes nowhere useful is a
 * worse promise than plain text; when `/place/<city>` exists this is the component that grows
 * anchors.
 */
export function SightingsLegend({ data }: { data: SightingsMapData }) {
  return (
    <>
      <ul className="mt-4 flex flex-wrap gap-2">
        {data.markers.map((marker) => (
          <li
            key={marker.key}
            className="flex min-h-11 items-center gap-2 rounded border-2 px-3 py-2"
            style={{ borderColor: CATEGORY_ACCENT[marker.category] }}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {marker.flag}
            </span>
            <span className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream">
              {marker.city}
            </span>
            <span className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow tabular-nums">
              {marker.count}
            </span>
          </li>
        ))}
      </ul>

      {data.uncharted.length > 0 ? (
        <p className="mt-4 text-sm text-cream/70">
          <span className="font-pixel mr-2 text-[10px] tracking-wider text-amber">
            UNCHARTED SECTORS:
          </span>
          {data.uncharted.map((entry) => `${entry.name} (${entry.place})`).join(" · ")}
        </p>
      ) : null}
    </>
  );
}
