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
  `source_url` are never selected on a public path.

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
- **Public search**: `/search?q=` accepts a pop number or a name; answers with a full-screen
  OWNED / NOT OWNED verdict. Backed by the `catalog_with_ownership` view.
- **Quick Add** (admin): identify (scan UPC via zxing-wasm | type number | type name) →
  confirm variant (mandatory — exclusives may share a UPC) → details (place/date/status,
  story skippable) → done; box art comes from the catalog automatically.
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
- **Stats denominator**: the `peter` category (ADR-009), mirrored by `counts_toward_total`;
  UI shows both "PETER PARKER 11/120" and the full catalog "19/247" with a "catalog updated"
  date. Both numbers come from the seeded catalog and move whenever the CSVs are re-seeded.

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

The same data is editable at `/admin/collection` — a server-rendered list, a search-first add
screen (`pop_number` exact, or `search_vector` FTS OR'd with a `pg_trgm` match on the name)
and an edit form. Client components exist only where interaction demands them (the search box
and the delete confirm); every server action calls `requireAdmin()` before it touches a row.
