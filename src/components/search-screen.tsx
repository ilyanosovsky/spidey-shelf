import {
  NO_MATCH_HEADLINE,
  orderSearchResults,
  searchSummaryLine,
  type CatalogSearchResult,
  type PublicSearchQuery,
} from "@/lib/search";

import { PixelButton } from "./pixel-button";
import { PixelFrame } from "./pixel-frame";
import { PublicNav } from "./public-nav";
import { SearchResultCard } from "./search-result-card";
import { ToothedBanner } from "./toothed-banner";

/**
 * The gift check, as a pure function of an already-run search.
 *
 * A plain GET form: the input is named `q`, the browser puts it in the URL, and the answer
 * lives at a shareable `/search?q=1450` that needs no JavaScript to render. That is not
 * minimalism for its own sake — the friend using this is on a shop's wifi with one bar.
 *
 * The header is kept deliberately short (nav, one label, one field, one button) so that on a
 * 375×667 phone the first result's stamp is on screen the moment the page loads.
 */
export function SearchScreen({
  query,
  parsed,
  results,
}: {
  /** The raw `?q=`, echoed back into the box so it can be edited. */
  query: string;
  parsed: PublicSearchQuery;
  results: readonly CatalogSearchResult[];
}) {
  const ordered = orderSearchResults(results);
  const searched = parsed.kind !== "empty";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <PublicNav pathname="/search" />

      <PixelFrame as="header" className="p-4 sm:p-5">
        <h1 className="font-pixel text-sm leading-relaxed tracking-wider text-cream">GIFT CHECK</h1>

        {/* GET, not a server action: the result must be a URL a friend can send. */}
        <form action="/search" method="get" className="mt-4 flex flex-col gap-3" role="search">
          <label
            htmlFor="q"
            className="font-pixel text-[10px] leading-relaxed tracking-wider text-amber"
          >
            ENTER POP NUMBER OR NAME
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={query}
            autoFocus
            autoComplete="off"
            placeholder="1450"
            // Same field as the admin console: LCD green on LCD dark, 16px so iOS Safari
            // does not zoom the page on focus.
            className="w-full rounded border-2 border-ink-px bg-lcd-bg px-3 py-3 text-base text-lcd-glow caret-lcd-glow outline-none placeholder:text-lcd-glow/40 focus-visible:border-blue-frame"
          />
          <PixelButton type="submit" variant="primary">
            CHECK THE SHELF
          </PixelButton>
        </form>
      </PixelFrame>

      {!searched ? (
        <PixelFrame className="p-5">
          <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow">
            STANDING IN A SHOP? TYPE THE NUMBER ON THE BOX.
          </p>
          <p className="mt-3 text-sm text-cream/70">
            The number is on the front, bottom right. A name works too — the whole Spider-Man
            catalog is in here, not just the figures Ilya owns.
          </p>
        </PixelFrame>
      ) : ordered.length === 0 ? (
        <section aria-label="Result">
          <ToothedBanner as="h2" className="max-w-[320px]">
            {NO_MATCH_HEADLINE}
          </ToothedBanner>
          <PixelFrame className="mt-4 p-5">
            <p className="text-sm text-cream/70">
              This catalog covers the Spider-Man lines (plus the handful of non-Spider figures
              already on the shelf), so a Pop from another corner of the multiverse will not be in
              here. Check the number on the box, or try a name.
            </p>
          </PixelFrame>
        </section>
      ) : (
        <section aria-label="Results" className="flex flex-col gap-4">
          <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow">
            {searchSummaryLine(ordered)}
          </p>

          <ul className="flex flex-col gap-4">
            {ordered.map((result) => (
              <li key={result.slug}>
                <SearchResultCard result={result} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
