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
- **Quick Add** (admin): `/admin/add` is one route with five frames — `?step=` picks between
  `identify` · `new` · `confirm` · `details` · `done`, and `/admin/collection/new` 307s here.
  Steps are URLs, not client state, so the back button works, a half-finished add survives a
  locked phone, and **the whole flow ships zero client JavaScript**: step 1 is a GET form over
  the catalog, results and variants are links, and both writes are plain form POSTs to server
  actions (progressive enhancement, so they work before hydration). There is no
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
  - Step 1 carries a `⌖ SCAN — SOON` button rendered `disabled` + `aria-disabled` with no
    handler: the Phase 7 slot, visible but not lying.
- **Scanner**: BarcodeDetector is broken on iOS Safari (open WebKit bug) → feature-detect,
  fall back to zxing-wasm; typing the number is always a first-class path.
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

## External data sources

| Source                                                | Role                                                 | Status                                     |
| ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| pops.today                                            | catalog + UPC + box art (27k pops, 418 spider pages) | permission email sent 2026-08-06, no reply |
| Checklist sites (funkypriceguide 117, Pop Shop Guide) | plan-B catalog seed                                  | **seeded (plan B)** — 240 rows, ADR-008    |
| UPCitemdb (free 100 req/day)                          | scan-time UPC fallback                               | planned, phase 7                           |
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
