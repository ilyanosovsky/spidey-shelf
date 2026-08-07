# Design System

Full brief: [`docs/design/spidey-collection-design-brief.md`](https://github.com/ilyanosovsky/spidey-shelf/blob/main/docs/design/spidey-collection-design-brief.md).
Mockups (Claude Design export): `docs/design/mockups/`. Reference: the movie "Spidey Tracker"
(pixel handheld-gadget UI) — inspired by, never copied; no Marvel/Sony assets.

## Tokens

| Token                     | HEX                   | Use                           |
| ------------------------- | --------------------- | ----------------------------- |
| `--navy-deep`             | `#0D2440`             | map/screen background         |
| `--navy-panel`            | `#123B5C`             | cards, panels                 |
| `--blue-frame`            | `#3A8FC7`             | gadget-body frames            |
| `--blue-bright`           | `#1B41C8`             | desktop passe-partout         |
| `--coral`                 | `#F0614F`             | NOT OWNED, wishlist, alerts   |
| `--green`                 | `#4CAF6E`             | OWNED, success                |
| `--amber`                 | `#F5B840`             | primary CTA, number badges    |
| `--cream`                 | `#FFF6E8`             | text on dark                  |
| `--lcd-bg` / `--lcd-glow` | `#1E3B23` / `#8BC34A` | LCD counters                  |
| `--ink-px`                | `#101418`             | pixel outlines, text on amber |

Dark theme only — a deliberate "CRT gadget" product choice.

## Typography

- **Press Start 2P** — display only: headers, buttons, badges, counters. Min 10–11px,
  short strings only.
- Readable sans (system/Inter) — body text, stories.
- Tabular numerics + wide letter-spacing on LCD digits.

⚠️ Both webfonts are loaded by `next/font` and their variable classes must stay on
**`<html>`** in `src/app/layout.tsx`. Tailwind emits the font tokens
(`--font-pixel: var(--font-press-start), monospace`) into `:root`; a custom property whose
value references an undefined variable computes to nothing there, so with the classes on
`<body>` the tokens were empty and the entire site silently rendered in the system stack
(found and fixed in Phase 4).

## Category labels

The catalog's four buckets (ADR-009). These strings are the only wording used for them —
tabs, filters, chips, counters — and live in `src/lib/categories.ts`
(`FIGURE_CATEGORY_LABELS`), never retyped in a component.

| `category`     | Label            |
| -------------- | ---------------- |
| `peter`        | `PETER PARKER`   |
| `spider_verse` | `SPIDER-VERSE`   |
| `friends_foes` | `FRIENDS & FOES` |
| `other`        | `OTHER`          |

Press Start 2P, uppercase, so they stay short by design; `FRIENDS & FOES` is the longest and
sets the minimum tab width. `PETER PARKER` doubles as the counter caption
("11 / 120 PETER PARKER COLLECTED") because that bucket _is_ the denominator.

## Core components

Built in Phase 4, all in `src/components/` and all **server components**. Everything on the
public site is still server-rendered except one deliberate exception, `ShareButton` below —
the native share sheet is not something a server can hand over:

| Component        | Props                                                   | Notes                                                                                                                                                      |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PixelFrame`     | `accent?`, `weight` (`sm`/`md`), `as?`                  | the gadget panel: border + hard `--ink-px` shadow. `sm` is the thin card frame on mobile, `md` the screen body; `accent` overrides the border colour       |
| `PixelButton`    | `variant` (`primary`/`secondary`/`danger`/`quiet`)      | amber CTA / green / coral / outline; pressed = 2px down-right + shorter shadow; `min-h-11` (44px). `PixelButtonLink` is the same thing as a link           |
| `LCDCounter`     | `value`, `label`, `size` (`sm`/`lg`), `scanlines`       | glowing tabular digits on `--lcd-bg`, 2px scanline overlay (`.lcd-scanlines`)                                                                              |
| `ToothedBanner`  | `as?` (heading level), `tone` (`coral`/`green`)         | coral plaque, square teeth via `.pixel-teeth` (repeating gradient). Text is `--ink-px`, not cream. `tone="green"` is the Phase 6 success plaque            |
| `TickerBar`      | `text`                                                  | CSS marquee on an LCD strip; the line is repeated 3× and the track travels ⅓ of its width, so the loop is seamless. Stops under `prefers-reduced-motion`   |
| `PixelSpiderArt` | `slug`, `category`, `popNumber`, `size` (`card`/`hero`) | the box-art stand-in: a deterministic 16×16 inline-SVG spider, hue per category, pop number as cover text. `aria-hidden` — the card carries the same facts |
| `FigureCard`     | `entry`, `isNew?`                                       | states: mine (default) · not-mine-anymore (dimmed + amber chip) · new sighting (amber star). Whole card links to `/figure/<slug>`                          |
| `ShelfScreen`    | `entries`, `progress`, `filter`                         | the home screen as a pure function of fetched data, so `src/app/page.tsx` is only the DB shell                                                             |

Category hues (`PixelSpiderArt`, card frames, category chips): `peter` → coral ·
`spider_verse` → green · `friends_foes` → amber · `other` → blue-frame.

Added in Phase 5 (search, wishlist, stats):

| Component      | Props           | Notes                                                                                                                                                                                                                                 |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VerdictStamp` | `verdict`       | the answer, stamped: green `OWNED` · coral `NOT OWNED YET` + amber `GIFT IDEA` chip · coral `NOT OWNED` + the lower-case footnote "was in the collection once". Rotated −2°, ink on both fills                                        |
| `PublicNav`    | `pathname`      | SHELF · SEARCH · WISHLIST · STATS as a 4-column grid (never wraps at 375px), `min-h-11`, active item filled green. `pathname` is a prop — server components have no `usePathname()`                                                   |
| `WantedCard`   | `figure`        | `FigureCard`'s twin for a catalog row nobody owns: coral frame, WANTED stamp top-right, links to `/search?q=<number>`. Not one big link — it holds the SHARE button                                                                   |
| `ShareButton`  | `href`, `title` | the one client component on the public site: `navigator.share`, else clipboard + "LINK COPIED" for 2s. Resolves the relative href against the current origin                                                                          |
| `WebRadar`     | `progress`      | the spider-web progress chart: one sector per bucket filled to `owned / total`, 4 rings, 12 threads. Geometry is pure and tested in `src/lib/radar.ts`; the SVG is `aria-hidden` and the legend beneath carries the labels and counts |

`WebRadar` fills **linearly and honestly** — at 11/120 the peter wedge really is a sliver.
No minimum-visible-bar fudge: the counters next to it are the point of the screen, and a
chart that flatters them would undo them.

Added in Phase 6 (Quick Add): `ToothedBanner` grew a `tone` prop — `coral` (default) and
`green`, the success plaque, whose teeth come from `.pixel-teeth-green` in globals.css. It is
the only change to a shared component; everything else lives in `src/app/admin/add/`.

### Quick Add screens (`/admin/add`, admin-only)

Five frames on one route, `?step=` picking between them. All server components, no client
JavaScript anywhere in the flow — the primary button of every frame sits last so it lands
under the thumb at 375px, and every target clears 44px.

| Frame                       | One line                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IdentifyStep` (step 1)     | autofocused GET box over the whole catalog, tappable result cards, a disabled `⌖ SCAN — SOON` slot for Phase 7, and `+ ADD AS NEW FIGURE` always last                   |
| `NewFigureStep` (step 1b)   | name + optional number (prefilled from the search) + four category chips (`PETER PARKER` preselected) + optional product line → a `needs_review` catalog row            |
| `ConfirmStep` (step 2)      | coral `IS IT THIS ONE?` banner, the figure as a `PixelSpiderArt` hero, `OR ONE OF THESE` variant cards, and either `CONFIRM — IT'S MINE` or the amber duplicate warning |
| `DetailsStep` (step 3)      | date (today) · city + country (last used) · status chips · optional story, with `SAVE THE SIGHTING` first in the DOM and `SKIP FOR NOW` under it                        |
| `DoneStep` (step 4)         | green `SIGHTING CONFIRMED!` plaque, the figure, two LCD counters with fresh counts, then `ADD ANOTHER` · `VIEW IT` · `WRITE THE STORY` (only when one is owed)          |
| `QuickAddRail` (all frames) | `1 FIND · 2 CONFIRM · 3 DETAILS`, the active one filled amber; `new` sits on step 1 and `done` on step 3                                                                |

The shared furniture — the rail, the chips, the hero and summary cards, the error list — is
`src/app/admin/add/quick-add-ui.tsx`. Chip tones: category cream · variant amber · coral
`NEEDS REVIEW` · green `IN THE VAULT`. Those last two are admin-only by construction: the
type that carries them (`AdminCatalogFigure`) never reaches a public component.

Still to build: MapMarker (pixel spider, green/red/gray) · ScannerOverlay (web-corner
viewfinder) · Mascot (own sprite).

The admin (`src/app/admin/ui.tsx`) re-exports `PixelButton`'s classes so the whole device
has one button; its `Panel`, `LcdStat` and chips stay admin-sized on purpose.

## Voice & microcopy

Gadget speaks English, short and geeky: `SIGHTING CONFIRMED!` · `ALREADY IN THE VAULT` ·
`63 SPIDERS STILL OUT THERE` · `BARCODE NOT FOUND. TYPE THE NUMBER?`

Phase 5 wording, all of it in `src/lib/search.ts` / `src/lib/wishlist.ts` rather than in a
component: `GIFT CHECK` · `ENTER POP NUMBER OR NAME` · `CHECK THE SHELF` ·
`31 MATCHES · 1 ALREADY ON THE SHELF` · `NOT IN THE CATALOG (YET)` ·
`WANTED: 109 SPIDERS STILL OUT THERE` · `NOTHING LEFT IN THIS SECTOR` · `PETER CANON` /
`ALL SPIDERS` / `WHOLE VAULT`. The empty search result deliberately has **no** "write to the
owner" CTA — this is a read-only showcase, not a shop with a contact form.

Phase 6 wording lives in `QUICK_ADD_COPY` (`src/lib/quick-add.ts`), never retyped in a
component: `NEW SIGHTING` · `NUMBER OR NAME` · `SCAN THE CATALOG` · `⌖ SCAN — SOON` ·
`ADD AS NEW FIGURE` · `IS IT THIS ONE?` · `CONFIRM — IT'S MINE` · `OR ONE OF THESE` ·
`ALREADY IN THE VAULT (SINCE APR 2025)` · `ADD DUPLICATE (+1)` · `WHERE AND WHEN?` ·
`SAVE THE SIGHTING` · `SKIP FOR NOW` · `SIGHTING CONFIRMED!` · `ADD ANOTHER` · `VIEW IT` ·
`WRITE THE STORY` · `STORIES OWED: 3` · `STORY OWED`. Form complaints are a closed table of
codes with fixed wording (`DATE MUST BE YYYY-MM-DD`, `PICK ONE OF THE FOUR CATEGORIES`, …) —
they travel in the URL, so nothing else may ever render from it.

## Accessibility

Touch targets ≥ 44px; contrast: cream-on-coral only bold/large; respect
`prefers-reduced-motion` (ticker & mascot animations off).
