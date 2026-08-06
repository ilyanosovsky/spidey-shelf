# Design System

Full brief: [`docs/design/spidey-collection-design-brief.md`](https://github.com/ilyanosovsky/spidey-shelf/blob/main/docs/design/spidey-collection-design-brief.md).
Mockups (Claude Design export): `docs/design/mockups/`. Reference: the movie "Spidey Tracker"
(pixel handheld-gadget UI) — inspired by, never copied; no Marvel/Sony assets.

## Tokens

| Token | HEX | Use |
|---|---|---|
| `--navy-deep` | `#0D2440` | map/screen background |
| `--navy-panel` | `#123B5C` | cards, panels |
| `--blue-frame` | `#3A8FC7` | gadget-body frames |
| `--blue-bright` | `#1B41C8` | desktop passe-partout |
| `--coral` | `#F0614F` | NOT OWNED, wishlist, alerts |
| `--green` | `#4CAF6E` | OWNED, success |
| `--amber` | `#F5B840` | primary CTA, number badges |
| `--cream` | `#FFF6E8` | text on dark |
| `--lcd-bg` / `--lcd-glow` | `#1E3B23` / `#8BC34A` | LCD counters |
| `--ink-px` | `#101418` | pixel outlines, text on amber |

Dark theme only — a deliberate "CRT gadget" product choice.

## Typography

- **Press Start 2P** — display only: headers, buttons, badges, counters. Min 10–11px,
  short strings only.
- Readable sans (system/Inter) — body text, stories.
- Tabular numerics + wide letter-spacing on LCD digits.

## Core components

FigureCard (owned / wanted / not-mine-anymore / new-sighting) · VerdictStamp (OWNED green /
NOT OWNED coral) · LCDCounter · PixelButton (amber CTA / green secondary / coral danger;
pressed = 2px down-shift) · ToothedBanner · TickerBar · WebRadar (progress) · MapMarker
(pixel spider, green/red/gray) · ScannerOverlay (web-corner viewfinder) · Mascot (own sprite).

## Voice & microcopy

Gadget speaks English, short and geeky: `SIGHTING CONFIRMED!` · `ALREADY IN THE VAULT` ·
`63 SPIDERS STILL OUT THERE` · `BARCODE NOT FOUND. TYPE THE NUMBER?`

## Accessibility

Touch targets ≥ 44px; contrast: cream-on-coral only bold/large; respect
`prefers-reduced-motion` (ticker & mascot animations off).
