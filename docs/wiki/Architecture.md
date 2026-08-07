# Architecture

## Hosting layout

```
Friends / Ilya (mobile-first)
        │
        ▼
Vercel Hobby ($0) ────────────► Railway Postgres (~$3/mo, inside paid credit)
  Next.js App Router              reference_figures + owned_figures
  next/image (optimizer + CDN)    never sleeps; manual pg_dump backups (Pro-only natively)
  server actions (admin)
  jose-cookie admin session
        │
        ▼
Object storage (R2 Free or Railway Bucket)
  normalized 800×800 WebP box art, zero-egress
  one-time seeded; no user uploads ever
```

- **Frontend + admin** on Vercel Hobby: free CDN, image optimizer (5k transformations/mo,
  project needs ~600), 100 GB transfer.
- **DB** on Railway: a small always-on Postgres (~0.25 GB RAM ≈ $2.5–3.5/mo) fits inside the
  already-paid $5 Hobby credit. Running the whole app on Railway was measured against
  official rates and does NOT fit ($9–11/mo) — see [[Decisions]].
- **Images**: hot-linking rejected (uniform-look requirement + Referer-blocked optimizer
  fetches + link rot). One-time pipeline: fetch box art → sharp → 800×800 WebP → bucket.
  Served exclusively through `next/image`.

## Rendering strategy

Every page that reads the database declares `export const dynamic = "force-dynamic"`.

- **Required, not a preference.** `src/db/index.ts` initialises lazily so a missing
  `DATABASE_URL` does not explode at import time, but a prerendered page still _queries_
  during `next build`'s page-data collection — and CI has no `DATABASE_URL`. That mistake
  has already broken CI once. The rule: a page that touches Drizzle is dynamic.
- **No ISR yet.** Friends-scale traffic, a ~20-row shelf, and the Vercel function region
  (fra1) sits next to Railway (EU West), so the round trip is a few milliseconds. The owner
  also expects an admin edit to show up on the next reload; a revalidation window would make
  that a "why is it still the old one?" bug report. Revisit if the site ever gets real
  traffic — the queries are already in one place (`src/lib/showcase-queries.ts`).
- The public queries select only visible columns of `is_public = true` rows, and join
  `reference_figures` INNER (no slug ⇒ no public URL). `needs_review`, `source` and
  `source_url` are never selected on a public path. The catalog-wide public reads (search,
  wishlist, stats) live in `src/lib/catalog-queries.ts` under the same rules; the shelf
  reads stay in `src/lib/showcase-queries.ts`.

## Placeholder box art

`image_path` is NULL everywhere while image rights are unresolved (ADR-008), so Phase 4
draws the box art instead of leaving holes: `PixelSpiderArt` renders a 16×16 inline-SVG
pixel spider tinted by the figure's category, with the pop number as cover text. It is
deterministic — an FNV-1a hash of the slug picks three background specks and nothing else
varies — so a figure looks identical on the grid, on its own page, and after a redeploy.
When the rights question is settled, this component is what `next/image` replaces; no page
layout depends on anything else about it.

## Key mechanisms

- **Public showcase**: `/` renders the whole shelf (header + LCD `peter` counter, a NEW
  SIGHTINGS ribbon, `?cat=` tabs over the four buckets, a 2/3/4-column grid) and
  `/figure/[slug]` renders one figure with its sighting log and wrap-around prev/next.
  Ordering is by `acquired_at` desc, **not** `created_at`: the collection was backfilled in
  a single seed run, so every row shares one `created_at` instant. All the decisions
  (filtering, neighbours, the ticker line, the formatters) are pure functions in
  `src/lib/showcase.ts` and `src/lib/format.ts`; `src/lib/showcase-queries.ts` only fetches.
- **Public search**: `/search?q=` is one GET form (shareable URL, no client JS). A run of
  digits — `1450`, `#1450`, `# 1450` — is an **exact `pop_number` match against the whole
  catalog**, not just the collection, and returns every variant sharing that number;
  anything else is a name, matched by the `search_vector` FTS index OR'd with a `pg_trgm`
  similarity on `name`, ranked by the better of the two. Both branches sort owned matches
  first, so the limit (60) can never hide the answer to the gift question. Verdicts come
  from `catalog_with_ownership.owned_count` plus two `exists()` signals on the public shelf
  rows: `hadOnce` (a `not_mine_anymore` row → "NOT OWNED · was in the collection once") and
  `hasPublicPage` (whether `/figure/<slug>` exists to link to). ⚠️ Those subqueries are built
  with drizzle's `exists()` and NOT with a raw `sql` template: drizzle renders an
  interpolated column unqualified inside a SELECT-list template, which silently compiled
  `reference_figure_id = "id"` against `owned_figures`' own `id`.
- **Wishlist**: `/wishlist` is the `owned_count = 0` half of the same view — no table, no
  flag. Default tab is PETER PARKER (the bucket the counters are about), ordered by box
  number with the numberless multi-packs last; each card links to `/search?q=<number>`,
  which is the canonical shareable answer and stays correct after the gift arrives.
- **Stats**: `/stats` reads owned/total per bucket off the view (`PETER CANON 11/120`,
  `ALL SPIDERS 12/180`, `WHOLE VAULT 15/247` — all computed, never constants) and the public
  shelf for the year timeline and the country flags. The WebRadar's geometry is pure
  arithmetic in `src/lib/radar.ts`.
- **Quick Add** (admin): `/admin/add` is one route with six frames — `?step=` picks between
  `identify` · `scan-result` · `new` · `confirm` · `details` · `done`, and
  `/admin/collection/new` 307s here.
  Steps are URLs, not client state, so the back button works, a half-finished add survives a
  locked phone, and **the typed flow still ships zero client JavaScript**: step 1 is a GET form
  over the catalog, results and variants are links, and both writes are plain form POSTs to
  server actions (progressive enhancement, so they work before hydration). The one exception
  is the Phase 7 SCAN button, which is a camera and could never be anything else — everything
  it needs is dynamically imported when it is pressed. There is no
  `useActionState` to hold errors in, so a rejected submit redirects back to its own step with
  `?err=CODE`; the codes are a closed table in `src/lib/quick-add.ts` and anything else in the
  parameter is dropped, because painting a message straight out of the address bar is content
  injection with extra steps. The trade — a rejected submit loses what was typed — is
  acceptable: every field a parser can reject is already constrained by the input itself
  (`type="date"`, `maxlength`, radio groups), so reaching an error means a hand-built POST.
  - **Confirm is mandatory.** Numbers repeat and exclusives can share a UPC, so the step
    offers every row with the same `pop_number` plus same-base-name variants inside the same
    product line, and deliberately refuses to group two identically-spelled figures from
    different waves — "Spider-Man" names some forty unrelated Pops, and without that clause
    the confirm screen for #3 would offer half the catalog. SQL casts a wide candidate net;
    the rule itself is `variantSiblings()`, pure and unit-tested.
  - **Duplicate guard.** When a `mine` shelf row already holds the figure, the primary button
    becomes `ADD DUPLICATE (+1)`: it bumps `quantity` on the existing row (as a SQL
    expression, not a computed constant) and jumps straight to the success screen. One entry
    per figure is what keeps the grid and every counter honest — a second box is not a second
    sighting. A `not_mine_anymore` row never triggers the warning: re-buying a Pop he gave
    away is how this collection grows.
  - **Story queue.** `SKIP FOR NOW` is a second submit on the details form and writes
    `needs_story`. The invariant both write paths keep is _a sighting with no story is a story
    owed_ (`needs_story ⇔ story IS NULL`), so the console's `STORIES OWED: n` line →
    `/admin/collection?filter=needs_story` can never drift, and saving the edit form is what
    clears it.
  - **Smart defaults.** Step 3 opens with today's date, `MINE`, and the city/country of the
    most recent shelf row — the "whole trip in one tap" trick, since figures arrive in
    clusters. Box art comes from the catalog automatically; no photo is ever uploaded.
  - Step 1's `⌖ SCAN THE BOX` button is the Phase 7 scanner and the flow's only client
    JavaScript — see below.
- **Scanner** (Phase 7): see [Barcode scanner](#barcode-scanner-phase-7).
- **Auth**: single admin; jose-signed httpOnly cookie (`spidey_session`, HS256, 30 days);
  bcrypt hash in env; the session is re-verified through `requireAdmin()` in
  `src/lib/dal.ts` inside every admin page and server action. `src/proxy.ts` (Next 16's
  renamed middleware) only redirects optimistically on cookie presence — a proxy check
  alone is not auth (CVE-2025-29927).
- **Backups**: Railway's native database backups need the Pro plan, so Hobby gets
  `scripts/backup-db.sh` (`pg_dump --format=custom`) run by hand; Phase 2 moves the same
  dump onto a schedule into object storage. See [[Environment]].
- **Stats denominator**: the `peter` category (ADR-009), mirrored by `counts_toward_total`.
  The numerator everywhere is the view's `is_owned` — distinct catalog figures, so two copies
  of #1450 count once and a figure that left the shelf counts zero. Live today: 11/120 peter,
  12/180 spiders, 15/247 the whole vault. Every one of them is computed per request and moves
  whenever the CSVs are re-seeded.

## Barcode scanner (Phase 7)

`⌖ SCAN THE BOX` on step 1 of Quick Add → camera → a number → the confirm step. All of it
is admin-only, and none of it exists on the public site.

### The engine

`src/lib/barcode/` — pure helpers, plus one module per moving part:

| Module         | What it is                                                                          |
| -------------- | ----------------------------------------------------------------------------------- |
| `upc.ts`       | check digits, UPC-A ⇄ EAN-13 normalisation, format guards — pure, fully unit-tested |
| `decode.ts`    | one `decode(frame)` over the native `BarcodeDetector` and zxing-wasm (client only)  |
| `upcitemdb.ts` | the response parser + the product-title heuristic — pure                            |
| `lookup.ts`    | the single `fetch`, `server-only`, never throws                                     |
| `scan-flow.ts` | the graded routing between camera and screen + all the wording                      |
| `backfill.ts`  | what happens to `reference_figures.upc` when a scan is confirmed                    |

- **zxing-wasm is the engine, native is the bonus.** iOS Safari's `BarcodeDetector` is
  flag-disabled and regressed (ADR-006), and the owner's phone is an iPhone. Detection is
  therefore not a `typeof` check: `createFrameDecoder()` asks `getSupportedFormats()` for
  `ean_13` + `upc_a` **and** runs one real `detect()` on a scratch frame, so an
  implementation that exists but resolves empty forever falls through to wasm.
- **The `.wasm` is served from our own origin.** zxing-wasm bakes a jsDelivr URL into its
  build and fetches from there on first decode; `decode.ts` overrides emscripten's
  `locateFile` to `/barcode/zxing_reader.wasm`, and `scripts/copy-zxing-wasm.mjs` (wired to
  `postinstall` **and** `prebuild`) copies the 1.0 MB binary out of `node_modules` into
  `public/`. The file is git-ignored: it is a build artifact of a pinned dependency, and the
  version that ships is always the one in `node_modules`. Verified: with the override in
  place the module's only network request is `/barcode/zxing_reader.wasm`, zero CDN calls.
- **Nothing about the scanner reaches a public bundle.** `ScanButton` is a one-button client
  component; the overlay behind it is `next/dynamic(..., { ssr: false })`, and `decode.ts`
  (and the megabyte of WebAssembly behind it) is dynamically imported inside the overlay
  only once a camera has actually opened. `/`, `/search`, `/wishlist` and `/stats` carry no
  reference to either.
- **The camera is one resource with one teardown.** Stream, decode timer and video element
  all die in the same cleanup, which runs on close, on unmount and on `pagehide`. Failure
  modes each get a sentence rather than a spinner: `NotAllowedError` → permission copy, no
  `mediaDevices` → the fallback painted on the first render (no viewfinder is drawn that
  cannot fill), `isSecureContext === false` → "THE CAMERA NEEDS HTTPS". `TYPE INSTEAD` is on
  screen in **every** state, because typing a number the owner already knows is faster than
  aiming, and ADR-006 made the keyboard a first-class path on purpose.

### The UPC backfill loop — why the scanner is worth having

ADR-010. `reference_figures.upc` was **empty on all 247 rows** the day this shipped (ADR-008
seeded facts from checklists; checklists do not print barcodes). So a scan cannot begin as a
lookup. It begins as a question, and answering it teaches the catalog:

```
scan → catalog knows the code?  ── yes ──►  confirm step ("MATCHED BY BARCODE")   [0 API calls]
                │ no
                ▼
        UPCitemdb, exactly once ──► product title ──► heuristic name/#
                │                                          │
                │ 404 / 429 / down                         ▼
                ▼                                  fuzzy match our catalog
        new-figure form, code carried              (FTS + pg_trgm, same as search)
                │                                          │
                └──────────────► owner confirms ◄──────────┘
                                       │
                                       ▼
                        write the code onto THAT row  ⇒ the next scan is a catalog hit
```

The write happens in `saveSightingAction` and `addDuplicateAction` — both are moments when
a human has just looked at a box and said "yes, this row" — and always **after** the
sighting is inserted, so a failed enrichment can never cost the entry it came with. The
decision itself is `decideUpcBackfill()`, pure and unit-tested: NULL → write; the same code
in either spelling → no-op; a **different** code → keep the old one, set `needs_review` and
record both in `review_note` (exclusives share UPCs, ADR-006). A figure invented on the spot
takes the code straight into its INSERT with `source = 'scan'`.

### The UPCitemdb budget

The free trial tier is **100 lookups per day, per IP, no key** — and on Vercel that IP is
shared. The rules that keep it inside the budget are load-bearing, not hygiene:

- the catalog is asked first, so every figure costs at most **one** call ever;
- a code that fails its own check digit never reaches the network (`normalizeScannedCode()`);
- **exactly one call per scan and no retries.** A 429 answered by trying again is how a
  daily quota disappears in an afternoon — the screen says `LOOKUP BUSY — TYPE THE NUMBER?`
  and offers the form instead;
- a 5-second `AbortSignal.timeout`, `cache: "no-store"`, and every failure (timeout, DNS, a
  captive portal's HTML, a 500) parsed into an outcome rather than thrown — this runs inside
  a page render, and a thrown fetch would replace the whole flow with an error boundary.

## External data sources

| Source                                                | Role                                                 | Status                                     |
| ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| pops.today                                            | catalog + UPC + box art (27k pops, 418 spider pages) | permission email sent 2026-08-06, no reply |
| Checklist sites (funkypriceguide 117, Pop Shop Guide) | plan-B catalog seed                                  | **seeded (plan B)** — 240 rows, ADR-008    |
| UPCitemdb (free 100 req/day)                          | scan-time UPC fallback                               | **live (phase 7)** — 1 call/scan, no key   |
| eBay Browse API (free 5k req/day)                     | live prices                                          | optional, phase 8                          |
| hobbyDB / Funko official                              | —                                                    | ruled out (ToS / no API)                   |

## Catalog seed

`data/catalog/*.csv` (247 rows — 240 Spider-Man + 7 owner-owned others, facts and a
`source_url` each) is the reviewable input; `npm run db:seed` parses every file as one
catalog with the strict RFC 4180 reader in `src/lib/csv.ts`, computes the `slug` in
`src/lib/catalog.ts` and upserts `reference_figures` on that slug. The seeder never deletes
and never touches `image_path`, `upc` or `is_vaulted`, so re-running it is safe once later
phases start filling those in. No box art is fetched — see ADR-008.

## Collection seed and admin CRUD

`data/collection/owned.csv` (19 rows from the owner's Notion) → `npm run db:seed:owned` →
`owned_figures`. Each row is resolved to a catalog figure by `pop_number` + a fuzzy name
match (`src/lib/collection.ts`, pure and unit-tested); an unresolved row fails the run rather
than land as a dangling name. Idempotency key: `reference_figure_id + acquired_at`.

The same data is editable at `/admin/collection` — a server-rendered list with `ALL` /
`NEEDS STORY` filter chips, and an edit form. Adding moved to Quick Add (`/admin/add`) in
Phase 6; the only client component left in the admin is the delete confirm. Every server
action calls `requireAdmin()` before it touches a row — `src/proxy.ts` is an optimistic
redirect and CVE-2025-29927 showed a proxy check can be skipped outright, so the check inside
the action is the real gate, and `src/app/admin/add/actions.test.ts` asserts that each of the
three Quick Add writes performs it _before_ the first insert or update.
