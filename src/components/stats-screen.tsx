import { buildSightingsMap } from "@/lib/sightings-map";
import {
  acquisitionCountries,
  acquisitionTimeline,
  vaultCounters,
  type CategoryProgress,
} from "@/lib/stats";
import { type PublicShelfEntry } from "@/lib/showcase";

import { LCDCounter } from "./lcd-counter";
import { PixelFrame } from "./pixel-frame";
import { PublicNav } from "./public-nav";
import { SightingsLegend, SightingsMap } from "./sightings-map";
import { ToothedBanner } from "./toothed-banner";
import { WebRadar } from "./web-radar";

/**
 * The collector's dashboard: how far in, how it went, and where it came from.
 *
 * Four readings of the same 247-row catalog and 19-row shelf, none of them hardcoded — every
 * number below is computed from what is in the database on this request, so re-seeding the
 * catalog moves them all at once.
 */
export function StatsScreen({
  progress,
  entries,
}: {
  progress: readonly CategoryProgress[];
  entries: readonly PublicShelfEntry[];
}) {
  const counters = vaultCounters(progress);
  const timeline = acquisitionTimeline(entries);
  const countries = acquisitionCountries(entries);
  const sightings = buildSightingsMap(entries);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 p-4 sm:p-6"
    >
      <PublicNav pathname="/stats" />

      <PixelFrame as="header" className="p-4 sm:p-5">
        <h1 className="font-pixel text-sm leading-relaxed tracking-wider text-cream">
          VAULT STATUS
        </h1>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {counters.map((counter) => (
            <LCDCounter key={counter.label} value={counter.value} label={counter.label} size="sm" />
          ))}
        </div>
      </PixelFrame>

      <section aria-labelledby="web-radar">
        <ToothedBanner as="h2" className="max-w-[240px]">
          <span id="web-radar">WEB RADAR</span>
        </ToothedBanner>
        <PixelFrame className="mt-4 p-5">
          <WebRadar progress={progress} />
        </PixelFrame>
      </section>

      <section aria-labelledby="sightings-map">
        <ToothedBanner as="h2" className="max-w-[280px]">
          <span id="sightings-map">SIGHTINGS MAP</span>
        </ToothedBanner>
        <PixelFrame className="mt-4 p-5">
          {sightings.markers.length === 0 && sightings.uncharted.length === 0 ? (
            <p className="text-sm text-cream/70">Nothing pinned to the map yet.</p>
          ) : (
            <>
              <SightingsMap data={sightings} />
              <SightingsLegend data={sightings} />
            </>
          )}
        </PixelFrame>
      </section>

      <section aria-labelledby="timeline">
        <ToothedBanner as="h2" className="max-w-[280px]">
          <span id="timeline">ACQUISITION LOG</span>
        </ToothedBanner>
        <PixelFrame className="mt-4 p-5">
          {timeline.length === 0 ? (
            <p className="text-sm text-cream/70">No dated sightings yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {timeline.map((row) => (
                <li key={row.year} className="flex items-center gap-3">
                  <span className="font-pixel w-12 shrink-0 text-[10px] leading-relaxed tracking-wider text-amber tabular-nums">
                    {row.year}
                  </span>
                  {/* The bar is a plain div, square-cut: no gradient, no rounding, 8-bit. */}
                  <span className="h-4 flex-1 border-2 border-ink-px bg-lcd-bg">
                    <span
                      aria-hidden="true"
                      className="block h-full bg-lcd-glow"
                      style={{ width: `${Math.round(row.share * 100)}%` }}
                    />
                  </span>
                  <span className="font-pixel w-8 shrink-0 text-right text-[10px] leading-relaxed tracking-wider text-lcd-glow tabular-nums">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PixelFrame>
      </section>

      <section aria-labelledby="geography">
        <ToothedBanner as="h2" className="max-w-[280px]">
          <span id="geography">FOUND IN THE WILD</span>
        </ToothedBanner>
        <PixelFrame className="mt-4 p-5">
          {countries.length === 0 ? (
            <p className="text-sm text-cream/70">No places logged yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {countries.map((country) => (
                <li
                  key={country.code}
                  className="flex min-h-11 items-center gap-2 rounded border-2 border-blue-frame px-3 py-2"
                >
                  <span className="text-lg leading-none">{country.flag}</span>
                  <span className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream">
                    {country.code}
                  </span>
                  <span className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow tabular-nums">
                    {country.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-cream/70">
            Nothing here was ordered online — every figure was picked up somewhere, which is why the
            flags are the real collection.
          </p>
        </PixelFrame>
      </section>

      {/*
       * The install hint, and the only PWA affordance on the site.
       *
       * iOS has no `beforeinstallprompt`, so there is no button to render — Safari's own
       * Share → Add to Home Screen is the whole flow, and a fake "INSTALL" button that opens
       * a tutorial is worse than a sentence. One line of copy, no client JavaScript, and the
       * same on every platform.
       */}
      <footer className="mt-auto pt-2 pb-[env(safe-area-inset-bottom)]">
        <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream/60">
          {ADD_TO_HOME_SCREEN_HINT}
        </p>
      </footer>
    </main>
  );
}

/** Pixel font, so it stays short; sentence case would not survive at 10px anyway. */
export const ADD_TO_HOME_SCREEN_HINT =
  "ADD TO HOME SCREEN — SHARE ↑ THEN ADD TO HOME SCREEN, AND THE SHELF OPENS FULL-SCREEN.";
