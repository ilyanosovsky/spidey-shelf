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
public site is still server-rendered except two deliberate exceptions — `ShareButton` below
(the native share sheet is not something a server can hand over) and Phase 9's `BoxArtImage`
(an `onError` swap is a browser event):

| Component        | Props                                                   | Notes                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PixelFrame`     | `accent?`, `weight` (`sm`/`md`), `as?`                  | the gadget panel: border + hard `--ink-px` shadow. `sm` is the thin card frame on mobile, `md` the screen body; `accent` overrides the border colour                                                  |
| `PixelButton`    | `variant` (`primary`/`secondary`/`danger`/`quiet`)      | amber CTA / green / coral / outline; pressed = 2px down-right + shorter shadow; `min-h-11` (44px). `PixelButtonLink` is the same thing as a link                                                      |
| `LCDCounter`     | `value`, `label`, `size` (`sm`/`lg`), `scanlines`       | glowing tabular digits on `--lcd-bg`, 2px scanline overlay (`.lcd-scanlines`)                                                                                                                         |
| `ToothedBanner`  | `as?` (heading level), `tone` (`coral`/`green`)         | coral plaque, square teeth via `.pixel-teeth` (repeating gradient). Text is `--ink-px`, not cream. `tone="green"` is the Phase 6 success plaque                                                       |
| `TickerBar`      | `text`                                                  | CSS marquee on an LCD strip; the line is repeated 3× and the track travels ⅓ of its width, so the loop is seamless. Stops under `prefers-reduced-motion`                                              |
| `PixelSpiderArt` | `slug`, `category`, `popNumber`, `size` (`card`/`hero`) | the drawn box art: a deterministic 16×16 inline-SVG spider, hue per category, pop number as cover text. `aria-hidden` — the card carries the same facts. Since Phase 9 it is reached through `BoxArt` |
| `FigureCard`     | `entry`, `isNew?`                                       | states: mine (default) · not-mine-anymore (dimmed + amber chip) · new sighting (amber star). Whole card links to `/figure/<slug>`                                                                     |
| `ShelfScreen`    | `entries`, `progress`, `filter`                         | the home screen as a pure function of fetched data, so `src/app/page.tsx` is only the DB shell                                                                                                        |

Category hues (`PixelSpiderArt`, card frames, category chips): `peter` → coral ·
`spider_verse` → green · `friends_foes` → amber · `other` → blue-frame.

Added in Phase 5 (search, wishlist, stats):

| Component      | Props           | Notes                                                                                                                                                                                                                                 |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VerdictStamp` | `verdict`       | the answer, stamped: green `OWNED` · coral `NOT OWNED YET` + amber `GIFT IDEA` chip · coral `NOT OWNED` + the lower-case footnote "was in the collection once". Rotated −2°, ink on both fills                                        |
| `PublicNav`    | `pathname`      | SHELF · SEARCH · WISHLIST · STATS as a 4-column grid (never wraps at 375px), `min-h-11`, active item filled green. `pathname` is a prop — server components have no `usePathname()`                                                   |
| `WantedCard`   | `figure`        | `FigureCard`'s twin for a catalog row nobody owns: coral frame, WANTED stamp top-right, links to `/search?q=<number>`. Not one big link — it holds the SHARE button                                                                   |
| `ShareButton`  | `href`, `title` | one of the two client components on the public site: `navigator.share`, else clipboard + "LINK COPIED" for 2s. Resolves the relative href against the current origin                                                                  |
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
| `IdentifyStep` (step 1)     | autofocused GET box over the whole catalog, tappable result cards, the green `⌖ SCAN THE BOX` button (Phase 7), and `+ ADD AS NEW FIGURE` always last                   |
| `NewFigureStep` (step 1b)   | name + optional number (prefilled from the search) + four category chips (`PETER PARKER` preselected) + optional product line → a `needs_review` catalog row            |
| `ConfirmStep` (step 2)      | coral `IS IT THIS ONE?` banner, the figure as a `PixelSpiderArt` hero, `OR ONE OF THESE` variant cards, and either `CONFIRM — IT'S MINE` or the amber duplicate warning |
| `DetailsStep` (step 3)      | date (today) · city + country (last used) · status chips · optional story, with `SAVE THE SIGHTING` first in the DOM and `SKIP FOR NOW` under it                        |
| `DoneStep` (step 4)         | green `SIGHTING CONFIRMED!` plaque, the figure, two LCD counters with fresh counts, then `ADD ANOTHER` · `VIEW IT` · `WRITE THE STORY` (only when one is owed)          |
| `QuickAddRail` (all frames) | `1 FIND · 2 CONFIRM · 3 DETAILS`, the active one filled amber; `new` sits on step 1 and `done` on step 3                                                                |

The shared furniture — the rail, the chips, the hero and summary cards, the error list — is
`src/app/admin/add/quick-add-ui.tsx`. Chip tones: category cream · variant amber · coral
`NEEDS REVIEW` · green `IN THE VAULT`. Those last two are admin-only by construction: the
type that carries them (`AdminCatalogFigure`) never reaches a public component.

Added in Phase 7 (barcode scanner) — the first and only client JavaScript in Quick Add:

| Component        | Props                                        | Notes                                                                                                                                                                 |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScanButton`     | —                                            | the green `⌖ SCAN THE BOX` button on step 1. Deliberately tiny: the overlay is a `next/dynamic(..., { ssr: false })` behind it, so pressing it is what loads a camera |
| `ScannerOverlay` | `onClose`                                    | full-screen `role="dialog"`: video feed, viewfinder, scanline, caption, CLOSE, and `TYPE INSTEAD` in **every** state                                                  |
| `ScanResultStep` | `upc`, `notice`, `parsedTitle`, `candidates` | `IS IT ONE OF THESE?` — the barcode as printed groups, what the lookup called it, catalog guesses, `+ ADD AS NEW FIGURE` last                                         |
| `ScanFailedStep` | `notice`                                     | a code that fails its own check digit: coral panel, one sentence of why, `TYPE INSTEAD` as the primary button                                                         |

`ScannerOverlay`'s viewfinder is the web-corner frame from the brief — four amber corner
brackets (`border-t-4`/`border-l-4` pairs) around the band that is actually handed to the
decoder, so "aim here" is literally true rather than decorative. A coral `.scanline` sweeps
that band; it animates `top` and not `transform`, because a percentage translate resolves
against the line's own 3px height and would twitch instead of sweep. Under
`prefers-reduced-motion` the animation is killed **by name** and the line is parked at 50% —
the global "shorten every animation" rule would otherwise leave it stuck at the bottom edge
reading as a stray border, the same trap `.ticker-track` documents. On a lock the corners and
the band turn `--pop-green` for one 420ms flash before the navigation.

Phase 7 wording lives in `SCAN_COPY` / `SCAN_NOTICES` (`src/lib/barcode/scan-flow.ts`), the
same closed-table rule as `QUICK_ADD_COPY`: `⌖ SCAN THE BOX` · `SCANNING` ·
`AIM AT THE BARCODE ON THE BOX BOTTOM` · `TYPE INSTEAD` · `WAKING THE CAMERA…` ·
`BARCODE LOCKED` · `NO CAMERA PERMISSION.` · `THE CAMERA NEEDS HTTPS.` ·
`IF THE CAMERA STAYS DARK, RELOAD.` (the iOS home-screen-PWA quirk — the permission is not
persisted) · `IS IT ONE OF THESE?` · `MATCHED BY BARCODE` ·
`THAT BARCODE DOES NOT CHECK OUT. TYPE THE NUMBER?` · `BARCODE NOT FOUND. TYPE THE NUMBER?` ·
`LOOKUP BUSY — TYPE THE NUMBER?`. The notices travel in the URL as codes, so nothing else
may ever render from it.

Added in Phase 8 (map, prices, PWA):

| Component         | Props                       | Notes                                                                                                                                                                                                         |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SightingsMap`    | `data` (`SightingsMapData`) | the travel map on `/stats`: navy ground, 30° graticule, Natural Earth landmass, 5×5 pixel spiders on the cities. `viewBox` is the crop, computed from the markers; SVG is `aria-hidden`                       |
| `SightingsLegend` | `data`                      | flag · city · count under the map, and the accessible version of it. **Deliberately not links** — there are no city pages, and a link that goes nowhere is a worse promise than text. Plus the UNCHARTED line |
| `MarketSignal`    | `panel` (`MarketPanel`)     | the LCD price panel on `/figure/[slug]`: `~$25 · 25 LISTINGS`, `MIN $19`, `SEE ON EBAY ↗`, the fetch age, and the fine print. Renders only when there is a number; never explains its own absence             |
| `PriceChip`       | `label`                     | the wishlist's amber `~$25`. Appears only where a figure page has already paid for the lookup and the answer is still fresh — the wishlist never triggers one                                                 |

The map's marker is the `MapMarker` the brief asked for, arrived at from the other direction:
not a spider in a round frame with a status colour, but the shelf's own **category** hue on a
dark plate, so a pin means the same thing a card border means. Sizes are in **degrees, not
pixels**, so a marker is the same share of the panel at 375px and at 1280px.

**One sprite, three sizes.** The 16×16 spider's geometry left `PixelSpiderArt` in Phase 8 and
lives in `src/lib/spider-sprite.ts`. The card art, the map's 5×5 simplification and the PWA
icons all read from it, because two hand-drawn copies of one animal drift the first time
somebody straightens a leg.

Added in Phase 9 (box art the owner uploads — ADR-011):

| Component     | Props                                                                     | Notes                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BoxArt`      | `slug`, `name`, `category`, `popNumber`, `imagePath?`, `size`, `sizes`    | **the one place a figure's picture is chosen**: uploaded art through `next/image`, else `PixelSpiderArt`. Every card, hero and admin summary goes through it, so the three sources cannot drift |
| `BoxArtImage` | `src`, `alt`, `sizes`, `fallback`, `priority?`                            | the `onError` swap, and the only client component Phase 9 adds to the public site. `fallback` is a **rendered ReactNode**, so the placeholder stays server-side                                 |
| `BoxArtPanel` | `referenceFigureId`, `slug`, `name`, `category`, `popNumber`, `imagePath` | the BOX ART panel on `/admin/collection/[id]/edit` — the upload screen                                                                                                                          |

**`BoxArt` replaced eight direct `PixelSpiderArt` calls.** The placeholder component itself is
unchanged and still the default; what moved is the decision. Alt text is always
`"<NAME> box art"` (`boxArtAlt()`), never "image" — and the placeholder stays `aria-hidden`,
because the card already carries the same facts as text.

### The BOX ART panel (`/admin/collection/[id]/edit`, admin-only)

Custom UI over the SDK's `useUploadThing` hook — deliberately **not** the stock
`<UploadButton />`, which ships its own design system and would paint a Tailwind-generic
button into the middle of the gadget. What the SDK provides is `startUpload` and a progress
number; everything on screen is house furniture:

| Piece         | What                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| the preview   | `BoxArt` at `hero` size — the current art, or the drawn spider                                                               |
| the button    | amber `PixelButton` (`min-h-11`), labelled `UPLOAD BOX ART` or `REPLACE BOX ART`; opens a `sr-only` `accept="image/*"` input |
| the readout   | an LCD strip: a ten-block bar (`▓▓▓▓▓░░░░░`, pixel font so the blocks align) over the caption                                |
| the success   | green `ToothedBanner` — `BOX ART SECURED!`                                                                                   |
| the failure   | the same LCD strip in coral, with the reason                                                                                 |
| while working | the scanner's `.scanline` sweeps the preview — one shared class, already reduced-motion-aware                                |

Captions, in order: `NORMALIZING…` → `UPLOADING… 0%` … `UPLOADING… 100%` →
`BOX ART SECURED!`. The bar gives the first tenth to normalization rather than showing a
separate spinner: on a phone, decoding and re-encoding a 12 MP photo is a real wait, and one
bar that moves the whole time reads as one operation, which is what it is to the person
watching. Progress granularity is `"fine"` (1%) and not the SDK's default `"coarse"` (10%) —
against a ten-block bar, coarse jumps a whole block at a time and reads as stuck.

Phase 9 wording lives in `BOX_ART_COPY` / `BOX_ART_ERRORS` (`src/lib/box-art.ts`), the same
closed-table rule as `QUICK_ADD_COPY` and `SCAN_COPY`: `BOX ART` ·
`ANY PHOTO — IT BECOMES 800×800 WEBP ON NAVY` · `UPLOAD BOX ART` · `REPLACE BOX ART` ·
`NORMALIZING…` · `UPLOADING… n%` · `BOX ART SECURED!` ·
`THAT IS NOT AN IMAGE — PICK A PNG OR A JPG` · `THAT FILE IS OVER 4MB — PICK A SMALLER ONE` ·
`COULD NOT READ THAT IMAGE — TRY ANOTHER` · `UPLOAD FAILED — TRY AGAIN`.

The panel sits **above** the sighting form and outside it, because box art belongs to the
catalog row rather than to the sighting, and because uploading is immediate — there is no
SAVE, and a field inside a form promises otherwise.

### App icons and the favicon (Phase 8)

`npm run icons:generate` (`scripts/generate-icons.ts`, sharp) draws them all from that same
grid — coral spider, cream eyes, `--navy-deep` ground:

| File                                  | What                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `public/icons/icon-{192,512}.png`     | `purpose: "any"` — edge to edge, with the gadget's blue frame                  |
| `public/icons/maskable-{192,512}.png` | `purpose: "maskable"` — no frame, sprite at 50% so no launcher crop eats a leg |
| `public/apple-touch-icon.png`         | 180px; iOS masks to a rounded rect and never a circle, so the frame stays      |
| `src/app/favicon.ico`                 | 16/32/48 PNG payloads in one container, replacing create-next-app's default    |

The PNGs are **committed**, not built: a favicon that needs a native module to exist is a
deploy that fails on someone else's machine at the worst moment. The script stays for
regeneration.

Still to build: Mascot (own sprite).

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
component: `NEW SIGHTING` · `NUMBER OR NAME` · `SCAN THE CATALOG` ·
`ADD AS NEW FIGURE` · `IS IT THIS ONE?` · `CONFIRM — IT'S MINE` · `OR ONE OF THESE` ·
`ALREADY IN THE VAULT (SINCE APR 2025)` · `ADD DUPLICATE (+1)` · `WHERE AND WHEN?` ·
`SAVE THE SIGHTING` · `SKIP FOR NOW` · `SIGHTING CONFIRMED!` · `ADD ANOTHER` · `VIEW IT` ·
`WRITE THE STORY` · `STORIES OWED: 3` · `STORY OWED`. Form complaints are a closed table of
codes with fixed wording (`DATE MUST BE YYYY-MM-DD`, `PICK ONE OF THE FOUR CATEGORIES`, …) —
they travel in the URL, so nothing else may ever render from it.

Phase 8 wording lives in `MARKET_COPY` (`src/lib/ebay/snapshot.ts`) and
`sightingsMapCaption()` (`src/lib/sightings-map.ts`): `MARKET SIGNAL` · `SEE ON EBAY` ·
`Active listings, not sold prices. eBay US, Buy It Now.` · `~$25 · 25 LISTINGS` · `MIN $19` ·
`CHECKED 6H AGO` · `EBAY DID NOT ANSWER` · `SIGHTINGS MAP` · `9 CITIES · 19 SIGHTINGS` ·
`UNCHARTED SECTORS:` · `NO PLACES LOGGED YET` · and the install hint,
`ADD TO HOME SCREEN — SHARE ↑ THEN ADD TO HOME SCREEN, AND THE SHELF OPENS FULL-SCREEN.`

Three of those are doing real work rather than decorating:

- the **`~`** is the median admitting it is a median of twenty-five strangers' asking prices —
  which is also why `formatMoney()` rounds to whole units; `$23.99` would claim a precision the
  number does not have;
- **"active listings, not sold prices"** is the difference between what people want for a Pop
  and what one actually goes for, and every price guide that omits it is lying;
- **the age** is what stops a cached number reading as a live one.

## Accessibility

Touch targets ≥ 44px; pixel font ≥ 10px; contrast: cream-on-coral only bold/large; respect
`prefers-reduced-motion` (ticker & scanline animations off by name, not merely shortened).

### The focus ring

`FOCUS_RING` in `src/components/pixel-button.tsx` — `focus-visible:outline-2
focus-visible:outline-offset-2 focus-visible:outline-amber` — is the one focus treatment on the
site, shared by every button variant, the LCD `fieldClass`, the nav, the tabs, the cards and the
outbound links. Amber because it is the one hue on this palette legible against every background
the site has. Before Phase 8 the buttons had only an `:active` pressed state, so a keyboard user
got the browser default outline — on a 2px ink-bordered dark button, close to invisible.

The category and status pickers are labels wrapping `sr-only` radios, so they carry
`has-[:focus-visible]:outline-*` instead: the focus lands on an input nobody can see, and the
ring has to appear on the thing that looks like the control.

A `SKIP TO CONTENT` link sits first in `<body>`, `sr-only` until focused. Every `<main>` on the
site carries `id="main"` and `tabIndex={-1}` — without the tabindex the jump moves the scroll
position and leaves focus behind, which is the failure mode that makes skip links useless.

### Contrast, measured (Phase 8 audit)

| Pair                        | Ratio       | Verdict                                                    |
| --------------------------- | ----------- | ---------------------------------------------------------- |
| cream on coral              | **3.00**    | ❌ fixed — `danger` buttons now use ink (5.75)             |
| ink on coral                | 5.75        | ✅ the coral pairing everywhere (banner, stamp, button)    |
| ink on amber                | 10.41       | ✅                                                         |
| ink on green                | 6.75        | ✅                                                         |
| cream on navy-deep / panel  | 14.6 / 10.9 | ✅                                                         |
| cream/70 on navy-deep       | 7.77        | ✅ the secondary-prose colour                              |
| amber on navy-deep          | 8.79        | ✅                                                         |
| lcd-glow on lcd-bg          | 5.87        | ✅ — the LCD caption was `/70` (3.71) and is now full glow |
| **blue-frame on navy-deep** | **4.42**    | ❌ as text — a near miss, and a miss                       |

`--blue-frame` is now **a frame colour, not a text colour**: 4.42 clears the 3∶1 bar for
borders and UI shapes and fails the 4.5 bar for text, so its eleven text uses became
`text-cream/80`. The border stays blue, which is where the accent was doing its work anyway.

`--coral` on navy (4.86) and `--pop-green` on navy (5.70) remain fine as text; both are only
ever used on `--navy-deep`, never on `--navy-panel` (3.61 / 4.24), and that is worth keeping
true when a new panel is added.
