# Implementation Plan — Spidey Shelf

> **This file is the single source of progress truth.** Every PR updates the status of the
> steps it touches. Statuses: ⬜ todo · 🟡 in progress · 🟢 done · ⛔ blocked.

| Phase | Goal                            | Status                                                     |
| ----- | ------------------------------- | ---------------------------------------------------------- |
| 0     | Scaffold & CI                   | 🟢                                                         |
| 1     | Database & admin auth           | 🟢 (scheduled backups deferred → storage phase)            |
| 2     | Reference catalog seed + images | 🟡 (catalog seeded from plan B — images blocked on rights) |
| 3     | Owner data entry (19 figures)   | 🟢                                                         |
| 4     | Public showcase                 | 🟢                                                         |
| 5     | Search, wishlist & stats        | 🟢                                                         |
| 6     | Admin Quick Add flow            | 🟢                                                         |
| 7     | Barcode scanner                 | 🟢                                                         |
| 8     | Polish: PWA, map, prices        | 🟡 (PWA · map · a11y done — eBay awaits the owner's keys)  |
| 9     | Manual box art (UploadThing)    | 🟡 (pipeline live — the owner still has to upload the art) |
| 10    | Admin navigation & map modal    | 🟢                                                         |

Governance: 🟢 [PR #1](https://github.com/ilyanosovsky/spidey-shelf/pull/1)

---

## Phase 0 — Scaffold & CI

| Step                                                       | Status | PR  | Notes                                                    |
| ---------------------------------------------------------- | ------ | --- | -------------------------------------------------------- |
| Next.js App Router + TS + Tailwind scaffold                | 🟢     | #2  | Next 16.3, React 19.2, Node 22                           |
| Design tokens from brief → Tailwind theme + Press Start 2P | 🟢     | #2  | dark-only                                                |
| ESLint + Prettier + typecheck scripts                      | 🟢     | #2  | docs/ excluded from lint                                 |
| Vitest + Testing Library setup, sample test                | 🟢     | #2  | 7 tests: slug lib + Home smoke                           |
| CI becomes real (remove no-app guard in ci.yml)            | 🟢     | #2  | + format:check                                           |
| Vercel project connected, hello page deployed              | 🟢     |     | connected; previews build per PR; Function Region → fra1 |

## Phase 1 — Database & admin auth

| Step                                                                        | Status | PR  | Notes                                                                                                                            |
| --------------------------------------------------------------------------- | ------ | --- | -------------------------------------------------------------------------------------------------------------------------------- |
| Railway Postgres provisioned + volume backups enabled                       | 🟡     |     | provisioned ✅; native backups are Pro-only → manual `pg_dump` script for now, scheduled dumps to R2 arrive with Phase 2 storage |
| Drizzle setup, connection pooling                                           | 🟢     | #3  | postgres.js, `max: 1` + `prepare: false`, client cached on `globalThis`                                                          |
| Schema: `reference_figures`, `owned_figures`, view `catalog_with_ownership` | 🟢     | #3  | `slug` unique, `pop_number` indexed non-unique; `search_vector` + trigram index in custom SQL                                    |
| Migrations pipeline (`drizzle-kit`)                                         | 🟢     | #3  | `db:generate` / `db:migrate` / `db:studio`; never `push`                                                                         |
| Admin session: jose cookie + bcrypt env hash, login page                    | 🟢     | #3  | re-verify in every server action; `src/proxy.ts` is optimistic UX only                                                           |
| Unit tests: slug gen, session verify                                        | 🟢     | #3  | 25 tests (7 existing + 18 new: session, authenticate, hash sanity)                                                               |

✅ **Resolved 2026-08-06:** public access enabled on the Railway Postgres
(`*.proxy.rlwy.net`, EU West), `.env` and Vercel now carry `DATABASE_PUBLIC_URL`, both
migrations applied to the live DB and verified. The dotenv-expand trap (`$` in the bcrypt
hash must be `\$` in `.env` files, raw in the Vercel dashboard) is fixed locally and
documented in Environment.md.

## Phase 2 — Reference catalog seed + images

| Step                                                        | Status | PR  | Notes                                                                                        |
| ----------------------------------------------------------- | ------ | --- | -------------------------------------------------------------------------------------------- |
| Decision: pops.today (plan A) vs checklist sites (plan B)   | 🟡     | #4  | plan B (checklist facts) seeded; pops.today reply may upgrade source + unlock images later   |
| Seed script (idempotent, CSV in repo, `source_url` per row) | 🟢     | #4  | `npm run db:seed`; 240 rows upserted on `slug`, 121 count toward the total                   |
| Manual review pass (`needs_review` triage)                  | 🟡     | #4  | 18 seed rows + 22 ambiguous categorizations (PR #5, listed below) — owner triage still to do |
| Image pipeline: fetch once → 800×800 WebP → object storage  | ⛔     |     | still blocked on image rights. Phase 9 routes around it: the owner uploads the art (ADR-011) |
| Storage choice: R2 vs Railway Bucket (ADR)                  | 🟢     | #11 | answered by ADR-011 for the interim: **UploadThing** (free 2 GB, ~10k normalized figures)    |

### Ambiguous categorizations awaiting owner triage (22 rows, PR #5)

All 22 are flagged `needs_review = true` in `data/catalog/spiderman.csv`. The rule applied
throughout (ADR-009): **the depicted base character wins**.

Explicit calls, with the reasoning:

- **233 Superior Spider-Man → `friends_foes`** — Otto Octavius' mind occupying Peter's body
  and suit (the comics' _Superior Spider-Man_ run) is narratively Doc Ock, not Peter: a foe
  wearing the suit. Matches the original curator's note that this entry "is not a Peter
  Parker Spider-Man figure".
- **302 Gwenom Spider-Man → `spider_verse`** — Gwen Stacy / Spider-Gwen bonded to the Venom
  symbiote; base character wins, and the base is Gwen.
- **598 Venomized Spider-Man → `peter`** — the Maximum Venom line's symbiote version of
  Peter's Spider-Man; base character wins. The mirror case of Venomized Miles Morales, which
  goes to `spider_verse`.
- **961 Doppelganger Spider-Man → `friends_foes`** — Marvel's Doppelganger is a separate
  symbiote-spawned monster that mimics Spider-Man's look, not Peter himself.
- **966 Poison Spider-Man (Glow Chase) → `peter`** — the Venomverse "Poison"-corrupted
  version of Peter's Spider-Man; treated exactly like Venomized Spider-Man.

The remaining rows the pass had to decide (same rule, no extra nuance):

| #    | Name                                         | →              |
| ---- | -------------------------------------------- | -------------- |
| 1090 | Spider-Man                                   | `peter`        |
| 1123 | Statue of Liberty                            | `friends_foes` |
| 1159 | The Amazing Spider-Man                       | `peter`        |
| 1171 | The Amazing Spider-Man (Unmasked)            | `peter`        |
| 1186 | The Amazing Spider-Man (Figure 8/8) (Deluxe) | `peter`        |
| 1223 | Spider-Man                                   | `peter`        |
| 1223 | Spider-Man (Translucent)                     | `peter`        |
| 1234 | Gwen Stacy — _Across the Spider-Verse_       | `spider_verse` |
| 1236 | Spider-Man (10 inch)                         | `peter`        |
| 1236 | Spider-Man (10 inch) (Black Light)           | `peter`        |
| 1239 | Peter B. Parker & Mayday                     | `peter`        |
| 1356 | Gwen Stacy — _Spider-Man: Blue_              | `friends_foes` |
| 1410 | Mayday Parker                                | `spider_verse` |
| —    | Iron Man and Spider-Man (2 Pack)             | `peter`        |
| —    | Spider-Man vs. Spider-Man (2 Pack)           | `peter`        |
| —    | Spider-Man: No Way Home (3 Pack)             | `peter`        |
| —    | Spider-Man: No Way Home (8 Pack)             | `peter`        |

The two Gwen Stacys are the interesting pair: #1234 is Spider-Gwen from _Across the
Spider-Verse_ (a web-slinger → `spider_verse`), #1356 is civilian Gwen from the _Spider-Man:
Blue_ comics line (a person around Peter → `friends_foes`). Multi-figure packs go to `peter`
when Peter is in the box, and count toward the total once.

## Phase 3 — Owner data entry

| Step                                        | Status | PR  | Notes                                                                                                              |
| ------------------------------------------- | ------ | --- | ------------------------------------------------------------------------------------------------------------------ |
| Minimal admin CRUD for owned figures        | 🟢     | #5  | `/admin/collection` list + `new` (search-first) + `[id]/edit`, real delete behind a confirm step; server-first     |
| Enter 12 spiders + 7 other figures manually | 🟢     | #5  | done as `data/collection/owned.csv` + `npm run db:seed:owned` (19 rows, all resolved) — repeatable, not hand-typed |

## Phase 4 — Public showcase

| Step                                                                             | Status | PR  | Notes                                                                                                          |
| -------------------------------------------------------------------------------- | ------ | --- | -------------------------------------------------------------------------------------------------------------- |
| Component library: FigureCard, PixelButton, LCDCounter, ToothedBanner, TickerBar | 🟢     | #6  | `src/components/`, all server components; + PixelFrame, PixelSpiderArt, ShelfScreen. Admin re-uses PixelButton |
| Home: grid, tabs (All Spiders / Other), LCD counter, new sightings ribbon        | 🟢     | #6  | tabs are the 4 buckets + ALL via `?cat=`, server-filtered; live `11 / 120`; ribbon = 5 newest `acquired_at`    |
| Figure page: box art, sighting log (place/date/story), prev/next                 | 🟢     | #6  | `/figure/[slug]`, owned figures only (others 404); prev/next wrap around and name the neighbour                |
| Ticker with latest sighting                                                      | 🟢     | #6  | CSS-only marquee, stops under `prefers-reduced-motion`                                                         |
| Box art placeholder while image rights are blocked                               | 🟢     | #6  | `PixelSpiderArt`: deterministic 16×16 inline-SVG sprite, hue per category, pop number as cover text            |

Two fixes made along the way, both pre-existing and both visible on every screen:

- **The webfonts never applied.** `next/font`'s variable classes sat on `<body>` while
  Tailwind emits `--font-pixel: var(--font-press-start), …` into `:root`, where that
  reference is undefined — so the token computed to nothing and the whole site rendered in
  the system stack. The classes moved to `<html>`.
- **Testing Library never cleaned up between renders.** Auto-cleanup only registers with
  Vitest `globals: true`; `vitest.setup.ts` now calls `afterEach(cleanup)` itself, which is
  what makes multi-render component tests possible at all.

## Phase 5 — Search, wishlist & stats

| Step                                                    | Status | PR  | Notes                                                                                                   |
| ------------------------------------------------------- | ------ | --- | ------------------------------------------------------------------------------------------------------- |
| Search by number/name, OWNED / NOT OWNED verdict stamp  | 🟢     | #7  | GET form → shareable `/search?q=1450`; three verdicts (owned / never / had-once)                        |
| Variant disambiguation in results                       | 🟢     | #7  | every row sharing the number, owned ones first; art + line + exclusivity/variant chips per card         |
| Wishlist page (NULL rows of the ownership view)         | 🟢     | #7  | `/wishlist`, default tab PETER PARKER (109), coral WANTED cards linking to `/search?q=<number>` + SHARE |
| Stats: LCD counters 11/120 + 19/247, web-radar progress | 🟢     | #7  | `/stats`: 11/120 · 12/180 · 15/247 (live), WebRadar, 2023–2026 timeline, flags. Denominator = ADR-009   |
| Shared public nav (SHELF · SEARCH · WISHLIST · STATS)   | 🟢     | #7  | on all four public screens; 4-column grid, 44px targets, one row at 375px; admin stays unlinked         |

## Phase 6 — Admin Quick Add flow

| Step                                                                             | Status | PR  | Notes                                                                                                                   |
| -------------------------------------------------------------------------------- | ------ | --- | ----------------------------------------------------------------------------------------------------------------------- |
| Search-first add screen (number/name)                                            | 🟢     | #8  | `/admin/add`, autofocused GET form over the whole 247-row catalog; `NEEDS REVIEW` / `IN THE VAULT` chips are admin-only |
| Confirm screen with variant picker                                               | 🟢     | #8  | mandatory step; siblings = same `pop_number`, or same base name + product line spelled differently                      |
| Details step: place (last-used default), date (today), status, story (skippable) | 🟢     | #8  | last place = the most recent shelf row (live: Moscow/RU); `SKIP FOR NOW` is a second submit → `needs_story`             |
| Success screen + duplicate guard ("already in the vault")                        | 🟢     | #8  | `ADD DUPLICATE (+1)` bumps `quantity` on the existing row and skips step 3 — never a second shelf row                   |
| Not-in-catalog path ("add as new figure")                                        | 🟢     | #8  | never block on incomplete catalog; writes `source='manual'`, `needs_review=true`, `counts_toward_total ⇔ peter`         |
| Story queue: `STORIES OWED: n` → `/admin/collection?filter=needs_story`          | 🟢     | #8  | invariant: a sighting with no story is a story owed; the edit form clears it                                            |
| `⌖ SCAN — SOON` slot for Phase 7                                                 | 🟢     | #8  | rendered `disabled` + `aria-disabled`, no handler behind it                                                             |

## Phase 7 — Barcode scanner

| Step                                                        | Status | PR  | Notes                                                                                                                            |
| ----------------------------------------------------------- | ------ | --- | -------------------------------------------------------------------------------------------------------------------------------- |
| zxing-wasm integration + BarcodeDetector feature-detect     | 🟢     | #9  | native used only when `getSupportedFormats()` AND a real `detect()` both pass; `.wasm` served from `public/`, never a CDN        |
| Scanner overlay UI (viewfinder, fallback to typing)         | 🟢     | #9  | web-corner viewfinder + reduced-motion scanline; `TYPE INSTEAD` in every state; denied / no-camera / insecure-context each named |
| UPC lookup in catalog + UPCitemdb fallback (100 req/day)    | 🟢     | #9  | catalog first (both UPC-A and EAN-13 forms), then exactly one API call, no retries; exclusives may share UPC → always confirm    |
| UPC backfill: a confirmed scan teaches the catalog          | 🟢     | #9  | NULL → write · same code → no-op · different code → keep it, `needs_review` + `review_note` (migration 0003, applied live)       |
| Scanner off the public bundle                               | 🟢     | #9  | `ScanButton` → dynamic overlay → dynamic wasm; `/`, `/search`, `/wishlist`, `/stats` reference neither                           |
| **Real-device test on the owner's iPhone (Vercel preview)** | 🟢     | #9  | **passed 2026-08-07**: permission prompted, decode fast, `TYPE INSTEAD` comfortable                                              |

**What could not be verified in CI, and how it was settled.** Everything else was checked
headless: unit tests, the graceful no-camera path under jsdom, the whole `?step=scan-result`
routing against the live database, and one real UPCitemdb call. **The one thing that could not
be** was the thing the phase is named after — pointing a camera at a box and getting digits out
of it needs a lens, a real barcode and iOS Safari, none of which exist in CI.

> **Settled on 2026-08-07.** The owner ran the scanner on his iPhone against the Vercel
> preview: the camera permission prompt appeared, the decode came back in a second or two
> rather than thirty, and the `TYPE INSTEAD` escape hatch was comfortable to reach. Phase 7
> is 🟢.

Two decisions worth knowing about this phase:

- **The catalog's `upc` column was empty** — all 247 rows (ADR-008 seeded checklist facts,
  and checklists do not print barcodes). So the scanner's value is not "look up a barcode";
  it is a loop: scan → UPCitemdb names the product → fuzzy-match our catalog → the owner
  confirms → **the code is written onto that row**. Every real scan makes the next one free,
  and the API budget shrinks toward zero as the shelf gets scanned.
- **A second, different barcode never overwrites the first.** Funko exclusives genuinely
  share UPCs (ADR-006), so a clash is ambiguity rather than a correction: the old value
  stays, the row is flagged, and `review_note` records both codes for the triage pass. That
  is what `drizzle/0003_review_note.sql` is for (additive, idempotent, view untouched;
  applied to the live database so the preview cannot meet a missing column).

## Phase 8 — Polish

| Step                                          | Status | PR  | Notes                                                                                                                         |
| --------------------------------------------- | ------ | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| PWA: manifest, icons, install prompt          | 🟢     | #10 | `src/app/manifest.ts`, real pixel-spider PNGs + a new `favicon.ico`, `appleWebApp` meta. **No install prompt** — see the note |
| Travel map with pixel spider markers per city | 🟢     | #10 | SIGHTINGS MAP on `/stats`: inline-SVG equirectangular, Natural Earth 110m landmass, 9 cities from a code dictionary           |
| eBay Browse API prices (optional)             | 🟡     | #10 | **built keys-optional — awaiting the owner's eBay developer keys.** Without them nothing renders and nothing is called        |
| Accessibility & perf audit, reduced-motion    | 🟢     | #10 | focus rings on every control, skip link, one real contrast failure fixed, every pixel label back above 10px                   |

**The PWA has no install button, on purpose.** iOS Safari does not implement
`beforeinstallprompt` — there is no event to hook and no API to call, and Share → Add to Home
Screen is the entire flow. So instead of a button that opens a tutorial, `/stats` ends with one
pixel-font line of copy telling a visitor what to tap. `metadata.appleWebApp` is what makes the
result feel native once they do: without `capable: true`, "Add to Home Screen" produces a
bookmark that opens Safari with its chrome, which is the difference between an app and a link.

**The map's coordinates are a dictionary in code, not columns in the database.**
`owned_figures.acquired_lat` / `acquired_lng` have existed since Phase 1 and are still NULL on
all 19 rows. `src/lib/geo.ts` holds the nine cities instead, and that is the better trade three
ways: it is retroactive (every existing row is placed without a backfill), it needs no
migration, and the admin's Quick Add flow does not grow a geocoder — one more thing to wait for
on a phone, in a shop. A city the dictionary does not know is a line of copy under the map
(`UNCHARTED SECTORS`), never a crash. Today there are none: all nine resolve.

**The landmass is real data, not a doodle.** Natural Earth 1:110m "land" (public domain, CC0)
via the `world-atlas` package, converted once by `scripts/generate-world-land.mjs` into a single
SVG path in degree space (`x = lng + 180`, `y = 90 - lat`). Two things had to be got right:
Eurasia is one ring that crosses the antimeridian, which a naive path draws as a straight line
across the Pacific, and the coordinates are rounded to whole degrees — 27 KB instead of 54 KB,
and coastlines that step rather than curve, which is the house style rather than a compromise.
Because equirectangular is linear, cropping to "the places he has been" is one `viewBox`
attribute and no re-projection.

**eBay shipped without ever being called.** The owner has no developer keyset, so
`isEbayConfigured()` is false and the feature is invisible: `/figure/[slug]` renders no panel,
the wishlist renders no chips, and — verified by patching `fetch` and running the real
orchestrator against the live database — **zero network calls are made**. The client was written
against eBay's documented Browse and OAuth shapes and tested against fixtures (hit / empty / 401
/ 429 / garbage). ⚠️ **Live-shape verification is owed**: when the keys arrive, one real
`item_summary/search` body should be diffed against the fixtures in
`src/lib/ebay/parse.test.ts` before the panel is trusted. See [[Environment]] for how to get the
keys.

**The wishlist can never trigger a lookup.** 232 cards × one Browse call each would spend the
entire 5,000-a-day free tier in twenty-two page views. So `/figure/[slug]` is the only thing
that ever pays for a price (and only when its 24-hour snapshot is missing or stale), and the
wishlist's amber `~$24` chips are that payment being reused from `price_snapshots`
(migration 0004, applied live).

### The accessibility pass, item by item

Four of these were real failures, not tidying:

- **Cream on coral was 3.00∶1** at 10px — below AA for anything under 24px. The `danger`
  button now carries ink text (5.75∶1), the pairing `ToothedBanner` and `VerdictStamp` already
  used. Cream-on-coral survives only where the brief allows it: large and bold.
- **Eighteen pixel-font labels were 8px**, against the design system's own ≥10px floor. All
  bumped; the admin's two-column chip grids wrap a line rather than shrink.
- **`text-blue-frame` was 4.42∶1 on the panel background** — a near miss, and a miss. Its
  eleven _text_ uses became `text-cream/80`; the token stays what it was named for, a frame
  colour, where 4.42 clears the 3∶1 bar for non-text.
- **The LCD caption was `lcd-glow/70`, 3.71∶1**, and is now the full glow (5.87∶1).

Plus the keyboard work: a shared amber `FOCUS_RING` on every button, tab, chip, card, link and
text field (the pressed state was `:active` only, so a keyboard user got the browser default —
on a 2px-bordered dark button, close to invisible); a `SKIP TO CONTENT` link over the
four-button nav that opens every screen, with `id="main"` + `tabIndex={-1}` on all ten `<main>`
elements so the jump moves focus and not only the scroll; `has-[:focus-visible]` rings on the
category and status radios, whose real inputs are `sr-only`; and the NEW SIGHTING star swapped
from a `title` tooltip (useless on a phone) to `aria-hidden` + `sr-only` text. Nothing new
animates, so `prefers-reduced-motion` needed no new rule — the map and the market panel are
both static by design.

---

## Phase 9 — Manual box art (UploadThing)

Plan A for images is still pops.today (ADR-001, email sent 2026-08-06, no reply). This phase
ships plan B so the shelf does not have to wait for it: **the owner uploads the box art
himself**, one figure at a time, from the edit screen. ADR-011 supersedes ADR-004's "no user
uploads" for the interim — there is exactly one user, and he is the owner.

| Step                                                 | Status | PR  | Notes                                                                                                                                      |
| ---------------------------------------------------- | ------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| UploadThing integration + admin-verified file router | 🟢     | #11 | `uploadthing@7.7.4` + `@uploadthing/react@7.3.3`; one route `boxArt`, session re-verified inside `.middleware()`, conditional Origin check |
| Client-side normalization (800×800 WebP on navy)     | 🟢     | #11 | pure geometry in `src/lib/box-art.ts`, the canvas isolated in `src/lib/box-art-canvas.ts` and mocked in the panel's tests                  |
| Pixel upload UI on `/admin/collection/[id]/edit`     | 🟢     | #11 | `BoxArtPanel`: LCD block bar, `NORMALIZING…` → `UPLOADING… n%` → green `BOX ART SECURED!`, coral failures, scanline sweep                  |
| Real art everywhere it used to be a placeholder      | 🟢     | #11 | one `BoxArt` component over 8 call sites; `PixelSpiderArt` is both the no-image and the `onError` fallback                                 |
| Live verification (real token, no-env build)         | 🟢     | #11 | full round trip against the live app + database, then reverted: `image_path` back to NULL, bucket back to 0 files                          |
| Docs: ADR-011, wiki pages, open-source README        | 🟢     | #11 | README rewritten for a public audience. **No LICENSE — the owner has not chosen one**                                                      |
| The owner actually uploads box art                   | ⬜     |     | 247 catalog rows, `image_path` NULL on all of them. The pipeline is what shipped; the pictures are his to add                              |

**The uniform look survived the plan changing.** ADR-004 wanted one pipeline (fetch → sharp →
800×800 WebP → bucket) and ADR-008 blocked it on rights. ADR-011 keeps the _output_ and moves
the _input_: the browser does what sharp was going to do — decode, **contain** (never crop; a
Funko box is portrait, and covering a square with it beheads every figure), centre on
`--navy-panel`, 800×800, WebP q0.8, ~100–250 KB. The geometry is pure and unit-tested; only
the canvas call is not. A phone on a shop's wifi uploads 150 KB instead of 4 MB, and the 2 GB
free tier holds ~10,000 figures against a 247-row catalog.

**One conditional in the route handler is this phase's sharp edge.** The session is
re-verified inside the router's `.middleware()`, before a presigned URL exists, because
`src/proxy.ts` does not cover `/api/*` and CVE-2025-29927 says a proxy check would not count
even if it did. On top of that the Route Handler checks `Origin`, per the Next.js
data-security guidance, since the SDK does not. That check **must skip UploadThing's own
callback**: the `uploadthing-hook: callback` POST comes from a machine, carries no `Origin`,
and is authenticated by HMAC signature — and it is the request that runs `onUploadComplete`,
which is the only thing that writes `image_path`. A blanket check would pass every browser
test and then silently store files no figure ever points at.

**Which env var? Only `UPLOADTHING_TOKEN`.** Both it and `UPLOADTHING_SECRET` were sitting in
`.env`; the v6 secret is dead weight. Proven rather than assumed: with `UPLOADTHING_SECRET`
hidden everything worked, and with `UPLOADTHING_TOKEN` hidden `new UTApi()` fails with
`Missing token. Please set the UPLOADTHING_TOKEN environment variable`. ⚠️ **The owner must
add `UPLOADTHING_TOKEN` to Vercel (Production + Preview) and redeploy** — nothing else on the
site depends on it, so the symptom of forgetting is "the upload button does nothing".

**Fixed in passing: every edit screen was answering 500.** `emptyOwnedFigureFormState` was
exported from `src/app/admin/collection/actions.ts`, which carries `"use server"` — and such a
module may only export async functions, so Next replaced the constant with `undefined` across
the boundary instead of complaining. `useActionState`'s first render then read
`state.errors.length` off nothing. It predates this phase (checked against `main`) and had to
go, because `/admin/collection/[id]/edit` is where the BOX ART panel lives. The constant moved
into the client component; the type still comes from the action module.

**What was verified live** — against the real token, the real CDN and the live Railway
database, all of it reverted afterwards:

- a temporary `UTApi` script: upload → the CDN serves it `200 image/webp` → delete → `404`.
  The URL came back as `https://si4zn51deh.ufs.sh/f/<key>`, which is the host pinned in
  `next.config.ts` — a wildcard `*.ufs.sh` would make `/_next/image` an open optimizer proxy
  for every UploadThing account there is, and Hobby bills 5,000 transformations a month;
- the **whole browser flow**, driven by hand against `npm run dev` with a self-signed session
  cookie: presign → ingest PUT → `onUploadComplete` → `image_path` written on
  `pop-marvel-spider-man-3` → `/figure/…` rendering `alt="Spider-Man box art"` through
  `/_next/image` (`200`, 758 bytes at `w=384`);
- **replace deletes**: a second upload onto the same figure moved `image_path` to the new key
  and left the old one answering `404`;
- **anonymous is refused three ways**, all JSON and never a redirect: no `Origin` →
  `403 {"error":"Cross-origin upload requests are not accepted."}`, a foreign `Origin` → the
  same, and a correct `Origin` with no session → `403 {"message":"Not signed in as the
owner."}`;
- **the public site is unchanged**: `/`, `/search`, `/wishlist`, `/stats` and `/figure/[slug]`
  render zero `<img>`, zero `ufs.sh`, zero `uploadthing` and zero `/_next/image` while no art
  exists, and the 47 KB UploadThing chunk is referenced by exactly one built client-reference
  manifest — `admin/collection/[id]/edit`;
- cleanup confirmed: `image_path` back to NULL, `utapi.listFiles()` back to **0 files**.

## Phase 10 — Admin navigation & map modal (owner feedback)

Three things the owner said after living with Phase 9, none of them a bug and all of them the
kind of thing only the person who uses the site every day notices.

| Step                                                   | Status | PR  | Notes                                                                                                                         |
| ------------------------------------------------------ | ------ | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| Session-aware nav: a fifth `CONSOLE` tab for the owner | 🟢     | #12 | `navItemsFor(isAdmin)` — a guest's HTML contains no `CONSOLE` and no `/admin`, verified against the running server            |
| Every admin screen renders the same nav                | 🟢     | #12 | `/admin`, `/admin/collection`, `…/[id]/edit` and all six Quick Add frames; `activeNavHref()` lights CONSOLE on each           |
| `logoutAction` lands on the public shelf               | 🟢     | #12 | `303 → /` with the cookie expired, instead of dead-ending on the password box                                                 |
| Box art on THE VAULT's cards                           | 🟢     | #12 | `VaultCard` extracted from the page and given a 64/80px `BoxArt` — the same component the public grid uses                    |
| The SIGHTINGS MAP expands                              | 🟢     | #12 | `MapModal`: `⤢ EXPAND` chip, native `<dialog>` + `showModal()`, the map at 2.5× inside an `overflow: auto` panel, amber CLOSE |
| Tests + gates                                          | 🟢     | #12 | 661 tests (641 + 20); format, lint, typecheck, build, and `next build` with `.env` hidden                                     |

**The login page is still a typed URL, and that is deliberate.** Nothing here advertises
`/login` to a visitor. What changed is everything after it: the console was reachable and then
inescapable — every admin screen linked only to other admin screens, `LOG OUT` landed on a
password box with no way off it, and the public site had no door into the console even for the
one person allowed through it. The nav is the escape hatch in both directions; the in-page
`QUICK ADD` and `BACK TO THE VAULT` buttons stay, because they are shortcuts between two
screens rather than a way out of the building.

**The fifth tab is not in the row on a phone, and could not be.** `WISHLIST` at 10px in Press
Start 2P is ~80px wide; four cells fit 375px with about 5px to spare, and a fifth would leave
65px each. So CONSOLE is `col-span-4` — a full-width amber bar under the four tabs, which is
also the easiest target on the screen — and `sm:col-span-1` once there is width for five
labels. Amber rather than cream because it leaves the public site: it is a door, not a fifth
screen. Ink-on-amber is 10.41∶1 when it is the current page, amber-on-navy 8.79∶1 when it is
not.

**The session is checked on the page, not inside the nav.** `PublicNav` stays a pure server
component that takes `isAdmin` as a prop, and each page answers it with `isAdminSession()` from
the DAL. Making the nav itself `async` and having it read cookies would have been one line
fewer and would have cost the four screen components their testability — `ShelfScreen` and its
three siblings are rendered directly in jsdom by 100-odd existing tests, and an async server
component cannot be. It is the same trade the project already made for the screens: they are
pure functions of fetched data, and the page is the shell that fetches. The check itself is a
**full JWT verification** rather than a cookie-presence test, so `spidey_session=nonsense`
renders a guest's nav — confirmed against the dev server.

**The map modal keeps the map on the server.** `SightingsMap` is handed to `MapModal` as a
rendered ReactNode, exactly like Phase 9's `BoxArtImage` fallback, so the 27 KB landmass path
and `src/lib/geo.ts` never reach a browser bundle; what ships is a button, a `<dialog>` and one
boolean. The dialog's contents render only while it is open, so a closed `/stats` carries the
map once, not twice. Escape, the top layer, the backdrop and the focus trap are the platform's
— the component adds only what `<dialog>` does not do: the body scroll lock, a centred initial
scroll position, and closing when the click lands on the gutter rather than on the panel.

**jsdom has a `<dialog>` element and none of its methods.** `HTMLDialogElement.prototype` in
jsdom 29 owns exactly `constructor` and `open` — no `show()`, no `showModal()`, no `close()`.
Rather than shape the component around that, `vitest.setup.ts` adds the three methods (about
ten lines, `close()` dispatching the `close` event the way a browser does). What no polyfill
can supply is the modality itself, so `map-modal.test.tsx` asserts the contract — is it open,
is the map inside it, is the page behind it locked, does the gutter close it — and leaves the
top layer to a real browser.

**Verified against the running dev server and the live database** (then stopped, and the
self-signed cookie deleted):

- `/`, `/search`, `/wishlist`, `/stats` as a guest: exactly **4** nav items, and **zero**
  occurrences of the string `CONSOLE` or `/admin` anywhere in the HTML — the item is never
  constructed, so there is nothing to find in view-source;
- the same four pages plus `/figure/<slug>` with a valid session: **5** items, the fifth
  `CONSOLE → /admin`; with a forged cookie: back to 4;
- `/admin`, `/admin/collection` and `/admin/add` all render the nav with
  `aria-current="page"` on CONSOLE;
- `/admin/collection`: 19 cards, 19 thumbnails — **18 drawn spiders and one `<img>`**, which is
  the box art the owner had already uploaded and could not see anywhere in the admin. That was
  the complaint, and one `<img>` is it fixed;
- the logout server action posted by hand: `303 See Other`, `Location: /`,
  `Set-Cookie: spidey_session=; Expires=Thu, 01 Jan 1970`;
- `/stats`: one `⤢ EXPAND` chip, one `<dialog aria-label="SIGHTINGS MAP">` rendered **closed**
  and empty, the trigger labelled `Expand the sightings map`, and the legend's city list still
  on the page rather than behind the tap.

## Log

| Date       | Event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-06 | Research done: no official Funko API; pops.today best source (permission email sent); hobbyDB ruled out (ToS). Architecture v2: Vercel + Railway Postgres, no Notion, no Supabase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-06 | Design brief written; mockups built in Claude Design (docs/design).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-08-06 | Repo bootstrapped; governance PR opened.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-06 | PR #1 merged; branch protection on main (PR + CI required). Phase 0 scaffold in PR #2. SESSION_SECRET + ADMIN_PASSWORD_HASH generated into local .env.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-08-06 | Phase 1 in PR #3: Drizzle schema + 2 migrations, admin session (jose cookie, bcrypt env hash, `src/proxy.ts`), 22 tests. Two env gotchas found: `.env` carries Railway's internal `DATABASE_URL` (live migration still pending), and Next.js dotenv-expand eats an unescaped bcrypt `$`. Railway backups are Pro-only → `scripts/backup-db.sh` as plan B.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-06 | Phase 2 in PR #4: plan B taken (no pops.today reply yet) — 240-row Spider-Man catalog compiled from checklist facts with a `source_url` per row (ADR-008), seeded live with `npm run db:seed` (idempotent upsert on `slug`; second run: 0 inserted / 240 updated, row count unchanged). Live: 240 rows, 121 `counts_toward_total`, 18 `needs_review`, `image_path` NULL everywhere — images stay out until rights are cleared, so the storage ADR is deferred. 64 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-06 | Phase 3 in PR #5: category taxonomy (ADR-009 — `peter` / `spider_verse` / `friends_foes` / `other`, `counts_toward_total` ⇔ `peter`, denominator 121 → 120) in migration 0002 (column + CHECK + index, view rebuilt to expose `category`); `data/catalog/others-manual.csv` (7 owner figures) joins the seed → 247 rows; `data/collection/owned.csv` + `npm run db:seed:owned` resolved all 19 shelf rows to catalog figures (15 mine / 4 gone, idempotent on `reference_figure_id + acquired_at`); minimal admin CRUD at `/admin/collection` (search-first add, edit, confirm-then-delete), every action re-verifying the session. 120 tests. 22 ambiguous categorizations flagged for owner triage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-06 | Phase 4 in PR #6: the public showcase is live — `/` (header, LCD `11 / 120`, NEW SIGHTINGS ribbon, `?cat=` tabs over the four buckets, 2/3/4-column grid of all 19 public rows, ticker) and `/figure/[slug]` (hero art, chips, SIGHTING LOG, wrap-around prev/next). Every DB-reading page is `export const dynamic = "force-dynamic"` — no ISR yet (friends-scale traffic, fra1↔ams latency is fine) and, more importantly, that is what keeps `next build` from querying Railway in CI. Box art is `PixelSpiderArt`, a deterministic pixel sprite, until image rights are cleared. Public reads live in `src/lib/showcase-queries.ts` (is_public only, no `needs_review`/`source` columns); all the decisions are pure functions in `src/lib/showcase.ts` + `src/lib/format.ts`. 177 tests (123 + 54). Found and fixed: the webfonts were never applied (font variables on `<body>` vs Tailwind's `:root` tokens) and Testing Library was not cleaning up between renders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-06 | Phase 5 in PR #7: the gift check is live — `/search?q=` (one GET form, no client JS; digits → exact `pop_number` against the whole 247-row catalog, words → the same `search_vector` FTS + `pg_trgm` fallback the admin uses) answers with a stamped verdict per matching variant: OWNED, NOT OWNED YET + GIFT IDEA, or NOT OWNED + "was in the collection once". `/wishlist` is the `owned_count = 0` half of the view (232 rows, PETER PARKER tab first at 109) with a `navigator.share` SHARE button per card — the only client component on the public site. `/stats` computes 11/120 · 12/180 · 15/247 live, plus the WebRadar (pure SVG geometry in `src/lib/radar.ts`), the 2023–2026 timeline and the flags row. Shared pixel nav on all four screens. 283 tests (177 + 106). Found and fixed while building: drizzle renders an interpolated column **unqualified** inside a SELECT-list `sql` template, so the hand-written "had this once" correlated subquery compiled to `"reference_figure_id" = "id"` — valid SQL, always false, and a silent NOT OWNED YET on every figure that had left the shelf. Rebuilt with `exists()` + the query builder, which qualifies both sides.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-06 | Phase 6 in PR #8: Quick Add is live at `/admin/add` — five frames on one route, `?step=` deciding which, and **not one line of client JavaScript**: the search box is a GET form, every result is a link, both writes are plain form POSTs to server actions, and a rejected submit comes back as `?err=CODE` against a closed table of codes (a message lifted out of the address bar and painted on the page is content injection with extra steps). Steps are URLs, so the back button works and a half-finished add survives a locked phone. The confirm step is mandatory: it offers every row sharing the box number plus same-base-name variants inside the same product line, and refuses to group two identically-named figures from different waves (otherwise #3 would offer half the catalog). The duplicate guard turns the primary button into `ADD DUPLICATE (+1)`, which bumps `quantity` on the existing shelf row — one entry per figure, so the counters and the public grid cannot double-count — and skips the details step. `SKIP FOR NOW` writes `needs_story`, counted on the console as `STORIES OWED: n` and filtered at `/admin/collection?filter=needs_story`; the edit form clears the flag on save. `/admin/collection/new` now 307s to `/admin/add`. 368 tests (283 + 85). Walked live against Railway with a self-signed session cookie: search → confirm (4 variants for #3, duplicate warning `ALREADY IN THE VAULT (SINCE DEC 2023)` on the owned one) → details prefilled with today + Moscow/RU → a real insert (counters 11/120 → 12/120, `STORIES OWED: 1`) → `ADD DUPLICATE (+1)` (quantity 2, counters unchanged) → row deleted, `owned_figures` back to 19 / 15 mine / 11 peter / 0 owed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-08-07 | Phase 7 in PR #9: the scanner. `⌖ SCAN THE BOX` on step 1 opens a full-screen overlay — `getUserMedia({ facingMode: "environment" })`, a web-corner viewfinder over the exact band handed to the decoder, and `TYPE INSTEAD` in every single state. zxing-wasm is the engine and the native `BarcodeDetector` is the bonus: it is used only when `getSupportedFormats()` reports `ean_13` + `upc_a` **and** a real `detect()` on a scratch frame comes back clean, because iOS Safari's implementation exists and resolves empty forever (ADR-006). The `.wasm` is served from our own `public/` — zxing bakes a jsDelivr URL into its build, so `locateFile` is overridden and `scripts/copy-zxing-wasm.mjs` (postinstall + prebuild) copies the 1.0 MB binary out of `node_modules`; proved by interception that the module's only network request is `/barcode/zxing_reader.wasm`, zero CDN calls. None of it reaches the public site: `ScanButton` is one button, the overlay is a dynamic import behind it, the wasm is a dynamic import behind that. **The catalog's `upc` column was empty on all 247 rows**, so the scanner is an enrichment loop rather than a lookup: catalog (both UPC-A and EAN-13 spellings) → exactly one UPCitemdb call, never retried → a heuristic name out of the product title → fuzzy match → the owner confirms → the code is written onto that row, and the next scan of that box costs nothing. A clash never overwrites (exclusives share UPCs): `needs_review` + both codes into the new `review_note` column (migration 0003, applied live). 457 tests (368 + 89). Smoke against the live database with a self-signed cookie: step 1 renders the enabled button; a bad check digit is refused before the network (`THAT BARCODE DOES NOT CHECK OUT`); the live call for `889698636759` returned `Funko Pop! Marvel: M.A.Wish - Spider-Man Vinyl Bobblehead`, which the heuristic reduced to `Spider-Man` and the catalog answered with 8 candidates on the `IS IT ONE OF THESE?` screen, every link carrying `upc=0889698636759`. **Not verified: the camera decode itself** — that needs the owner's iPhone against the Vercel preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-07 | Phase 7 closed 🟢: the owner ran the scanner on his iPhone against the Vercel preview — the camera permission prompt appeared, a real box decoded in a second or two rather than thirty, and `TYPE INSTEAD` was comfortable to reach. That was the one thing CI could not check, and it is now checked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-07 | Phase 8 in PR #10: polish. **PWA** — `src/app/manifest.ts` (standalone, navy splash, 192/512 in both `any` and `maskable`), real pixel-spider PNGs generated from the SAME 16×16 grid `PixelSpiderArt` draws on every card (the geometry moved to `src/lib/spider-sprite.ts` so the icon and the box art cannot drift), a hand-packed 16/32/48 `favicon.ico` replacing create-next-app's default, and `metadata.appleWebApp` so "Add to Home Screen" launches full-screen instead of producing a Safari bookmark. No install button: iOS has no `beforeinstallprompt`, so `/stats` ends with one line of copy instead of a button that opens a tutorial. **SIGHTINGS MAP** on `/stats`, between the radar and the years — inline SVG, equirectangular, Natural Earth 1:110m landmass (public domain, converted once by `scripts/generate-world-land.mjs` into 27 KB of whole-degree path data; the antimeridian is split at the map edge, or Eurasia draws a line across the Pacific), a 30° graticule, and 5×5 pixel spiders on the nine cities, clustered per city with an amber count badge. The crop is computed from the markers themselves with padding, a min-span guard and an aspect guard — Los Angeles to Tbilisi is a 20:1 slit otherwise. Coordinates come from `src/lib/geo.ts`, a dictionary of nine cities, **not** from `acquired_lat`/`acquired_lng`: retroactive, no backfill, no geocoder in the admin flow, and an unknown city becomes an `UNCHARTED SECTORS` line rather than a crash. **eBay MARKET SIGNAL** built keys-optional and currently invisible: `isEbayConfigured()` gates every path, `price_snapshots` (migration 0004, applied live) caches one row per figure for 24h, a figure page refreshes inline within a 5s budget and serves a stale snapshot with its age when eBay does not answer, and the wishlist reads the cache but can never fill it (232 cards would spend the 5,000/day tier in twenty-two page views). Written against eBay's documented shapes and tested against fixtures — **live-shape verification is owed when the owner's keys arrive**. **Accessibility**: cream-on-coral at 10px was 3.00∶1 and is now ink-on-coral; eighteen 8px pixel labels went back over the 10px floor; `text-blue-frame` (4.42∶1) stopped being a text colour; a shared amber focus ring landed on every control; `SKIP TO CONTENT` over the nav on all ten screens. 579 tests (457 + 122). Verified with `.env` hidden: `next build` passes with no environment at all, and patching `fetch` around the real orchestrator proves the key-less deployment makes **zero** eBay calls.                                                                                                                                       |
| 2026-08-07 | Phase 9 in PR #11: box art the owner uploads himself, because pops.today still has not answered. `/admin/collection/[id]/edit` grew a BOX ART panel — custom UI over `useUploadThing` rather than the stock button, so it is a `PixelButton`, an LCD block bar (`▓▓▓▓▓░░░░░`), `NORMALIZING…` → `UPLOADING… n%` → a green `BOX ART SECURED!` plaque, and the scanner's scanline sweeping the preview while it works. **The uniform look moved rather than went away**: the browser does what sharp was going to do — decode, contain (never crop; a Funko box is portrait and covering a square with it beheads every figure), centre on `--navy-panel`, 800×800, WebP q0.8, ~100–250 KB — so a phone uploads 150 KB instead of 4 MB and the 2 GB free tier holds ~10,000 figures. `BoxArt` is now the one place a figure's picture is chosen (8 call sites); `PixelSpiderArt` stays as both the empty state and the `onError` fallback, and the only client JavaScript this adds to the public site is that swap — the placeholder is handed over as a rendered ReactNode, so the sprite never enters a browser bundle. Auth is inside the router's `.middleware()`, before a presigned URL exists (`src/proxy.ts` does not cover `/api/*`, and CVE-2025-29927 says it would not count anyway), plus an `Origin` check on the Route Handler that **deliberately exempts UploadThing's signed callback** — a blanket check passes every browser test and then silently stops `image_path` from ever being written. Replacing art deletes the file it replaces, writing the new URL first. 641 tests (579 + 62). Verified live and then reverted: `UTApi` upload → CDN `200 image/webp` → delete → `404`; the whole browser flow by hand against the dev server (presign → ingest PUT → `onUploadComplete` → `image_path` on `pop-marvel-spider-man-3` → the figure page serving it through `/_next/image`); replace-deletes-the-old-key; three flavours of anonymous POST all `403` JSON; public pages carrying zero `<img>`, zero `ufs.sh` and zero uploadthing; then `image_path` back to NULL and the bucket back to 0 files. **Only `UPLOADTHING_TOKEN` is read** — the v6 `UPLOADTHING_SECRET` in `.env` is dead weight (with the token hidden, `new UTApi()` says `Missing token`), and the owner still has to add the token to Vercel. Found and fixed on the way: **every edit screen was answering 500 on `main`** — `emptyOwnedFigureFormState` was exported from a `"use server"` module, which may only export async functions, so Next silently replaced it with `undefined` and `useActionState`'s first render read `.errors.length` off nothing. README rewritten for an open-source audience; **no LICENSE file — the owner has not picked one.** |
| 2026-08-07 | Phase 10 in PR #12: the owner's own feedback after a week with the site, and every item is a way out of somewhere. **The console was a cul-de-sac** — admin screens linked only to admin screens, `LOG OUT` landed on a password box with nothing on it, and the public site had no door into the console. `PublicNav` is now session-aware: `navItemsFor(isAdmin)` adds a fifth amber `CONSOLE` tab for a **verified** session (a forged `spidey_session` gets a guest's nav, checked live), every admin screen renders the same nav with CONSOLE lit, and `logoutAction` redirects to `/` instead of `/login`. The tab cannot join the row on a phone — `WISHLIST` at 10px is ~80px and a fifth column leaves 65px — so it is `col-span-4` under the four tabs and `sm:col-span-1` above. The session is read on the **page** (`isAdminSession()` in the DAL) and passed down as a prop rather than read inside an async nav component: the four screen components are rendered directly in jsdom by a hundred existing tests, and an async server component cannot be. **THE VAULT shows the box art** — `VaultCard` came out of the page file and got a 64/80px `BoxArt`, the same component the public grid uses, so the admin can never disagree with what a visitor sees; against the live database that is 18 drawn spiders and one real `<img>`, which is the art the owner had uploaded and could not find anywhere in the admin. **The SIGHTINGS MAP expands** — a `⤢ EXPAND` chip, the whole panel as a button, and a native `<dialog>` + `showModal()` holding the map at 2.5× inside an `overflow: auto` panel with an amber CLOSE pinned at the bottom; the map is handed over as a rendered ReactNode so it stays a server component (27 KB of coastline never enters a browser bundle) and the dialog's contents exist only while it is open. Found on the way: **jsdom 29's `HTMLDialogElement` has the `open` property and none of the methods** (`constructor, open` is the whole prototype), so `vitest.setup.ts` gained a ten-line `show`/`showModal`/`close` polyfill rather than the component gaining a workaround. 661 tests (641 + 20). Verified against the dev server and the live DB, then stopped: guest pages carry exactly 4 nav items and zero occurrences of `CONSOLE` or `/admin`; a signed session gets 5; the logout action answers `303 → /` with the cookie expired; `/stats` ships one closed `<dialog aria-label="SIGHTINGS MAP">` and keeps the legend on the page. `next build` passes with `.env` hidden, and `.env` was restored byte-identical.                                                                                                                                                                     |
