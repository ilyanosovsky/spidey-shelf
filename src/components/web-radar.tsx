import {
  fillFraction,
  polygonPoints,
  RADAR_RINGS,
  RADAR_VIEWBOX,
  ringPolygon,
  RADAR_CENTER,
  sectorWedge,
  spokeEnd,
  radarSteps,
} from "@/lib/radar";
import { categoryProgressLabel, type CategoryProgress } from "@/lib/stats";

import { CATEGORY_ACCENT } from "./pixel-spider-art";

/**
 * The progress chart as a spider web — the radar from the reference gadget.
 *
 * One sector per catalog bucket, filled from the centre out to `owned / total`, in that
 * bucket's colour. Concentric rings mark the quarters, so a wedge that reaches the second
 * ring is visibly "half of this bucket". Nothing moves and nothing is random: the geometry
 * is pure arithmetic in `src/lib/radar.ts`, tested there, and this component only turns
 * numbers into `points` attributes.
 *
 * The SVG itself is `aria-hidden`: it is a picture of the legend below it, and the legend is
 * real text with the real counts. Colours are the same category hues as everywhere else
 * (tokens, never raw hex), which is what keeps it readable on the navy ground.
 */
export function WebRadar({
  progress,
  className = "",
}: {
  progress: readonly CategoryProgress[];
  className?: string;
}) {
  const sectors = progress.length;
  const steps = radarSteps(sectors);

  return (
    <div className={`flex flex-col items-center gap-5 sm:flex-row sm:items-center ${className}`}>
      <svg
        viewBox={`0 0 ${RADAR_VIEWBOX} ${RADAR_VIEWBOX}`}
        role="presentation"
        aria-hidden="true"
        focusable="false"
        className="w-full max-w-[240px] shrink-0"
      >
        {/* Filled sectors first, so the web's threads stay drawn on top of them. */}
        {progress.map((row, index) => (
          <polygon
            key={`wedge-${row.category}`}
            points={polygonPoints(sectorWedge(index, sectors, fillFraction(row.owned, row.total)))}
            style={{ fill: CATEGORY_ACCENT[row.category] }}
            opacity={0.55}
          />
        ))}

        {Array.from({ length: RADAR_RINGS }, (_, ring) => (
          <polygon
            key={`ring-${ring}`}
            points={polygonPoints(ringPolygon(ring + 1, sectors))}
            fill="none"
            style={{ stroke: "var(--color-blue-frame)" }}
            strokeWidth={ring + 1 === RADAR_RINGS ? 2 : 1}
            opacity={ring + 1 === RADAR_RINGS ? 0.9 : 0.45}
          />
        ))}

        {Array.from({ length: steps }, (_, step) => {
          const end = spokeEnd(step, sectors);
          // The four sector boundaries are the load-bearing threads; the rest are web fill.
          const boundary = step % (steps / Math.max(sectors, 1)) === 0;
          return (
            <line
              key={`spoke-${step}`}
              x1={RADAR_CENTER.x}
              y1={RADAR_CENTER.y}
              x2={end.x}
              y2={end.y}
              style={{ stroke: "var(--color-blue-frame)" }}
              strokeWidth={boundary ? 2 : 1}
              opacity={boundary ? 0.9 : 0.35}
            />
          );
        })}
      </svg>

      <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-1">
        {progress.map((row) => (
          <li key={row.category} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 shrink-0 rounded-[2px] border-2 border-ink-px"
              style={{ backgroundColor: CATEGORY_ACCENT[row.category] }}
            />
            <span className="font-pixel min-w-0 flex-1 text-[10px] leading-relaxed tracking-wider text-cream">
              {categoryProgressLabel(row)}
            </span>
            <span className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow tabular-nums">
              {row.owned} / {row.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
