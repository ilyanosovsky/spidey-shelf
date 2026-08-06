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

Built in Phase 4, all in `src/components/` and all **server components** — nothing on the
public showcase needs client JavaScript yet:

| Component        | Props                                                   | Notes                                                                                                                                                      |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PixelFrame`     | `accent?`, `weight` (`sm`/`md`), `as?`                  | the gadget panel: border + hard `--ink-px` shadow. `sm` is the thin card frame on mobile, `md` the screen body; `accent` overrides the border colour       |
| `PixelButton`    | `variant` (`primary`/`secondary`/`danger`/`quiet`)      | amber CTA / green / coral / outline; pressed = 2px down-right + shorter shadow; `min-h-11` (44px). `PixelButtonLink` is the same thing as a link           |
| `LCDCounter`     | `value`, `label`, `size` (`sm`/`lg`), `scanlines`       | glowing tabular digits on `--lcd-bg`, 2px scanline overlay (`.lcd-scanlines`)                                                                              |
| `ToothedBanner`  | `as?` (heading level)                                   | coral plaque, square teeth via `.pixel-teeth` (repeating gradient). Text is `--ink-px`, not cream                                                          |
| `TickerBar`      | `text`                                                  | CSS marquee on an LCD strip; the line is repeated 3× and the track travels ⅓ of its width, so the loop is seamless. Stops under `prefers-reduced-motion`   |
| `PixelSpiderArt` | `slug`, `category`, `popNumber`, `size` (`card`/`hero`) | the box-art stand-in: a deterministic 16×16 inline-SVG spider, hue per category, pop number as cover text. `aria-hidden` — the card carries the same facts |
| `FigureCard`     | `entry`, `isNew?`                                       | states: mine (default) · not-mine-anymore (dimmed + amber chip) · new sighting (amber star). Whole card links to `/figure/<slug>`                          |
| `ShelfScreen`    | `entries`, `progress`, `filter`                         | the home screen as a pure function of fetched data, so `src/app/page.tsx` is only the DB shell                                                             |

Category hues (`PixelSpiderArt`, card frames, category chips): `peter` → coral ·
`spider_verse` → green · `friends_foes` → amber · `other` → blue-frame.

Still to build: VerdictStamp (OWNED green / NOT OWNED coral) · WebRadar (progress) ·
MapMarker (pixel spider, green/red/gray) · ScannerOverlay (web-corner viewfinder) ·
Mascot (own sprite).

The admin (`src/app/admin/ui.tsx`) re-exports `PixelButton`'s classes so the whole device
has one button; its `Panel`, `LcdStat` and chips stay admin-sized on purpose.

## Voice & microcopy

Gadget speaks English, short and geeky: `SIGHTING CONFIRMED!` · `ALREADY IN THE VAULT` ·
`63 SPIDERS STILL OUT THERE` · `BARCODE NOT FOUND. TYPE THE NUMBER?`

## Accessibility

Touch targets ≥ 44px; contrast: cream-on-coral only bold/large; respect
`prefers-reduced-motion` (ticker & mascot animations off).
