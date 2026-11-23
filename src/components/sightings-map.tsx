import { graticule, hairline, mapBounds, markerCell, viewBoxOf, type MapBounds } from "@/lib/geo";
import { MARKER_GRID, markerSpriteRects } from "@/lib/marker-sprites";
import {
  sightingIconsLabel,
  sightingIconOffsets,
  sightingsMapCaption,
  type CitySighting,
  type SightingIcon,
  type SightingsMapData,
} from "@/lib/sightings-map";
import { WORLD_LAND_PATH } from "@/lib/world-land";

import { CATEGORY_ACCENT, toneFill } from "./pixel-spider-art";

/**
 * The travel map: where the collection was actually found.
 *
 * The reference gadget's world screen — dark navy ground, a thin graticule, and pixel spiders
 * sitting on the cities (and, since Phase 14, a pixel Stitch and a pixel Grogu beside them —
 * one sprite per kind found in a city). Nothing here is a map library: the landmass is one
 * SVG path in `src/lib/world-land.ts` (Natural Earth 110m, public domain, rounded to whole
 * degrees so the coastlines step), the projection is `x = lng + 180 / y = 90 - lat`, and the
 * crop is a viewBox computed from the markers themselves. That is the whole trick — equirectangular is
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
          <CityMarker key={marker.key} marker={marker} cell={cell} bounds={bounds} />
        ))}
      </svg>

      <p className="font-pixel mt-3 text-[10px] leading-relaxed tracking-wider text-lcd-glow">
        {sightingsMapCaption(data)}
      </p>
    </div>
  );
}

/**
 * One city: a 5×5 sprite per kind found there, side by side, the group centred on the point.
 *
 * The sprites come from `src/lib/marker-sprites.ts` — the spider, and since Phase 14 the
 * sprites of Veronika's two lines — and the layout from `sightingIconOffsets`, so a city with
 * only spiders is one sprite at offset 0, drawn exactly as it was before there were kinds.
 *
 * Plates and sprites first, badges last: a badge hangs off its icon's shoulder towards the
 * next icon, and drawn in between it would be covered by its neighbour's plate.
 */
function CityMarker({
  marker,
  cell,
  bounds,
}: {
  marker: CitySighting;
  cell: number;
  bounds: MapBounds;
}) {
  const offsets = sightingIconOffsets(marker.icons.length);
  const placed = marker.icons.map((icon, index) => ({
    icon,
    left: marker.point.x + offsets[index] * cell - 2.5 * cell,
    top: marker.point.y - 2.5 * cell,
  }));

  // One decision per city, made on the rightmost icon: badges flip to the left of their
  // sprites near the right edge of the crop, all together, so two badges never face each
  // other across one gap.
  const rightmost = marker.point.x + (offsets[offsets.length - 1] ?? 0) * cell;
  const flip = rightmost + 4 * cell > bounds.x + bounds.width;

  return (
    <g shapeRendering="crispEdges">
      {placed.map(({ icon, left, top }) => (
        <IconSprite key={icon.kind} icon={icon} cell={cell} left={left} top={top} />
      ))}
      {placed.map(({ icon, left, top }) =>
        icon.count > 1 ? (
          <CountBadge
            key={`badge-${icon.kind}`}
            count={icon.count}
            cell={cell}
            left={left}
            top={top}
            flip={flip}
          />
        ) : null,
      )}
    </g>
  );
}

function IconSprite({
  icon,
  cell,
  left,
  top,
}: {
  icon: SightingIcon;
  cell: number;
  left: number;
  top: number;
}) {
  const accent = CATEGORY_ACCENT[icon.category];

  return (
    <>
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

      {markerSpriteRects(icon.kind).map((rect) => (
        <rect
          key={`${rect.tone}-${rect.x}-${rect.y}`}
          x={left + rect.x * cell}
          y={top + rect.y * cell}
          width={rect.width * cell}
          height={rect.height * cell}
          style={{ fill: toneFill(rect.tone, accent) }}
        />
      ))}
    </>
  );
}

/**
 * `×5` on an amber chip at an icon's shoulder — one sprite, several figures.
 *
 * It flips to the left of the sprite when the city sits near the right edge of the crop, so
 * Moscow's badge cannot end up half outside the panel (the caller decides, once per city).
 */
function CountBadge({
  count,
  cell,
  left,
  top,
  flip,
}: {
  count: number;
  cell: number;
  left: number;
  top: number;
  flip: boolean;
}) {
  const width = cell * (count > 9 ? 3.2 : 2.4);
  const height = cell * 2.2;
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
        {count}
      </text>
    </>
  );
}

/** The legend's key: the map's own 5×5 sprite for one kind, at text size. */
function MiniSprite({ icon }: { icon: SightingIcon }) {
  const accent = CATEGORY_ACCENT[icon.category];
  return (
    <svg
      viewBox={`0 0 ${MARKER_GRID} ${MARKER_GRID}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      data-icon-kind={icon.kind}
      className="h-3 w-3 shrink-0"
    >
      {markerSpriteRects(icon.kind).map((rect) => (
        <rect
          key={`${rect.tone}-${rect.x}-${rect.y}`}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          style={{ fill: toneFill(rect.tone, accent) }}
        />
      ))}
    </svg>
  );
}

/**
 * Flag · city · icons · counts under the map — the legend, the accessible version of the
 * picture, and since Phase 14 its KEY: each chip repeats the city's sprites at text size,
 * each followed by that kind's count, so the Stitch and the Grogu on the map are explained
 * right underneath it rather than left to be guessed.
 *
 * The mini sprites are decoration; what a screen reader gets is one natural phrase per city
 * ("3 spiders, 1 Stitch, 1 Grogu"), not three anonymous numbers.
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
            {marker.icons.map((icon) => (
              <span key={icon.kind} className="flex items-center gap-1" aria-hidden="true">
                <MiniSprite icon={icon} />
                <span className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow tabular-nums">
                  {icon.count}
                </span>
              </span>
            ))}
            <span className="sr-only">{sightingIconsLabel(marker.icons)}</span>
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
