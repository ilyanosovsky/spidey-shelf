# Implementation Plan — Spidey Shelf

> **This file is the single source of progress truth.** Every PR updates the status of the
> steps it touches. Statuses: ⬜ todo · 🟡 in progress · 🟢 done · ⛔ blocked.

| Phase | Goal                            | Status                                                     |
| ----- | ------------------------------- | ---------------------------------------------------------- |
| 0     | Scaffold & CI                   | 🟡 (code done — Vercel connect pending)                    |
| 1     | Database & admin auth           | 🟡 (auth + schema done — backups workaround pending merge) |
| 2     | Reference catalog seed + images | 🟡 (catalog seeded from plan B — images blocked on rights) |
| 3     | Owner data entry (19 figures)   | ⬜                                                         |
| 4     | Public showcase                 | ⬜                                                         |
| 5     | Search, wishlist & stats        | ⬜                                                         |
| 6     | Admin Quick Add flow            | ⬜                                                         |
| 7     | Barcode scanner                 | ⬜                                                         |
| 8     | Polish: PWA, map, prices        | ⬜                                                         |

Governance: 🟢 [PR #1](https://github.com/ilyanosovsky/spidey-shelf/pull/1)

---

## Phase 0 — Scaffold & CI

| Step                                                       | Status | PR  | Notes                          |
| ---------------------------------------------------------- | ------ | --- | ------------------------------ |
| Next.js App Router + TS + Tailwind scaffold                | 🟢     | #2  | Next 16.3, React 19.2, Node 22 |
| Design tokens from brief → Tailwind theme + Press Start 2P | 🟢     | #2  | dark-only                      |
| ESLint + Prettier + typecheck scripts                      | 🟢     | #2  | docs/ excluded from lint       |
| Vitest + Testing Library setup, sample test                | 🟢     | #2  | 7 tests: slug lib + Home smoke |
| CI becomes real (remove no-app guard in ci.yml)            | 🟢     | #2  | + format:check                 |
| Vercel project connected, hello page deployed              | ⬜     |     | manual: connect repo in Vercel |

## Phase 1 — Database & admin auth

| Step                                                                        | Status | PR  | Notes                                                                                                                            |
| --------------------------------------------------------------------------- | ------ | --- | -------------------------------------------------------------------------------------------------------------------------------- |
| Railway Postgres provisioned + volume backups enabled                       | 🟡     |     | provisioned ✅; native backups are Pro-only → manual `pg_dump` script for now, scheduled dumps to R2 arrive with Phase 2 storage |
| Drizzle setup, connection pooling                                           | 🟢     | #3  | postgres.js, `max: 1` + `prepare: false`, client cached on `globalThis`                                                          |
| Schema: `reference_figures`, `owned_figures`, view `catalog_with_ownership` | 🟢     | #3  | `slug` unique, `pop_number` indexed non-unique; `search_vector` + trigram index in custom SQL                                    |
| Migrations pipeline (`drizzle-kit`)                                         | 🟢     | #3  | `db:generate` / `db:migrate` / `db:studio`; never `push`                                                                         |
| Admin session: jose cookie + bcrypt env hash, login page                    | 🟢     | #3  | re-verify in every server action; `src/proxy.ts` is optimistic UX only                                                           |
| Unit tests: slug gen, session verify                                        | 🟢     | #3  | 25 tests (7 existing + 18 new: session, authenticate, hash sanity)                                                               |

⚠️ **Blocked on the owner before merge:** the local `.env` holds Railway's _internal_
`DATABASE_URL` (`postgres.railway.internal`), which resolves only inside Railway — the
migration therefore could not be applied to the live database yet. Both migrations were
verified end-to-end against a throwaway Postgres 17. Paste `DATABASE_PUBLIC_URL` into
`.env` and run `npm run db:migrate`. Same file: escape every `$` of
`ADMIN_PASSWORD_HASH` as `\$` or Next.js's dotenv-expand eats the hash and login always
answers `ACCESS DENIED`.

## Phase 2 — Reference catalog seed + images

| Step                                                        | Status | PR  | Notes                                                                                      |
| ----------------------------------------------------------- | ------ | --- | ------------------------------------------------------------------------------------------ |
| Decision: pops.today (plan A) vs checklist sites (plan B)   | 🟡     | #4  | plan B (checklist facts) seeded; pops.today reply may upgrade source + unlock images later |
| Seed script (idempotent, CSV in repo, `source_url` per row) | 🟢     | #4  | `npm run db:seed`; 240 rows upserted on `slug`, 121 count toward the total                 |
| Manual review pass (`needs_review` triage)                  | 🟡     | #4  | 18 rows flagged `needs_review` — owner triage still to do                                  |
| Image pipeline: fetch once → 800×800 WebP → object storage  | ⛔     |     | blocked on image rights; `image_path` stays NULL, pixel placeholders in Phase 4 UI         |
| Storage choice: R2 vs Railway Bucket (ADR)                  | ⬜     |     | deferred until images are cleared                                                          |

## Phase 3 — Owner data entry

| Step                                        | Status | PR  | Notes                                                   |
| ------------------------------------------- | ------ | --- | ------------------------------------------------------- |
| Minimal admin CRUD for owned figures        | ⬜     |     |                                                         |
| Enter 12 spiders + 7 other figures manually | ⬜     |     | data in design brief table; first live test of the flow |

## Phase 4 — Public showcase

| Step                                                                             | Status | PR  | Notes        |
| -------------------------------------------------------------------------------- | ------ | --- | ------------ |
| Component library: FigureCard, PixelButton, LCDCounter, ToothedBanner, TickerBar | ⬜     |     | per mockups  |
| Home: grid, tabs (All Spiders / Other), LCD counter, new sightings ribbon        | ⬜     |     | mobile-first |
| Figure page: box art, sighting log (place/date/story), prev/next                 | ⬜     |     |              |
| Ticker with latest sighting                                                      | ⬜     |     |              |

## Phase 5 — Search, wishlist & stats

| Step                                                    | Status | PR  | Notes                                      |
| ------------------------------------------------------- | ------ | --- | ------------------------------------------ |
| Search by number/name, OWNED / NOT OWNED verdict stamp  | ⬜     |     | shareable `/search?q=1450`                 |
| Variant disambiguation in results                       | ⬜     |     | shared numbers                             |
| Wishlist page (NULL rows of the ownership view)         | ⬜     |     | gift-idea CTA                              |
| Stats: LCD counters 12/121 + 12/240, web-radar progress | ⬜     |     | honest denominator (`counts_toward_total`) |

## Phase 6 — Admin Quick Add flow

| Step                                                                             | Status | PR  | Notes                             |
| -------------------------------------------------------------------------------- | ------ | --- | --------------------------------- |
| Search-first add screen (number/name)                                            | ⬜     |     |                                   |
| Confirm screen with variant picker                                               | ⬜     |     | mandatory step                    |
| Details step: place (last-used default), date (today), status, story (skippable) | ⬜     |     |                                   |
| Success screen + duplicate guard ("already in the vault")                        | ⬜     |     |                                   |
| Not-in-catalog path ("add as new figure")                                        | ⬜     |     | never block on incomplete catalog |

## Phase 7 — Barcode scanner

| Step                                                     | Status | PR  | Notes                                              |
| -------------------------------------------------------- | ------ | --- | -------------------------------------------------- |
| zxing-wasm integration + BarcodeDetector feature-detect  | ⬜     |     | iOS Safari native API is broken — wasm is the path |
| Scanner overlay UI (viewfinder, fallback to typing)      | ⬜     |     |                                                    |
| UPC lookup in catalog + UPCitemdb fallback (100 req/day) | ⬜     |     | exclusives may share UPC → always confirm          |

## Phase 8 — Polish

| Step                                          | Status | PR  | Notes                     |
| --------------------------------------------- | ------ | --- | ------------------------- |
| PWA: manifest, icons, install prompt          | ⬜     |     |                           |
| Travel map with pixel spider markers per city | ⬜     |     | lat/lng already in schema |
| eBay Browse API prices (optional)             | ⬜     |     | 5000 req/day free         |
| Accessibility & perf audit, reduced-motion    | ⬜     |     |                           |

---

## Log

| Date       | Event                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-06 | Research done: no official Funko API; pops.today best source (permission email sent); hobbyDB ruled out (ToS). Architecture v2: Vercel + Railway Postgres, no Notion, no Supabase.                                                                                                                                                                                                                                                                                       |
| 2026-08-06 | Design brief written; mockups built in Claude Design (docs/design).                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-06 | Repo bootstrapped; governance PR opened.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-06 | PR #1 merged; branch protection on main (PR + CI required). Phase 0 scaffold in PR #2. SESSION_SECRET + ADMIN_PASSWORD_HASH generated into local .env.                                                                                                                                                                                                                                                                                                                   |
| 2026-08-06 | Phase 1 in PR #3: Drizzle schema + 2 migrations, admin session (jose cookie, bcrypt env hash, `src/proxy.ts`), 22 tests. Two env gotchas found: `.env` carries Railway's internal `DATABASE_URL` (live migration still pending), and Next.js dotenv-expand eats an unescaped bcrypt `$`. Railway backups are Pro-only → `scripts/backup-db.sh` as plan B.                                                                                                                |
| 2026-08-06 | Phase 2 in PR #4: plan B taken (no pops.today reply yet) — 240-row Spider-Man catalog compiled from checklist facts with a `source_url` per row (ADR-008), seeded live with `npm run db:seed` (idempotent upsert on `slug`; second run: 0 inserted / 240 updated, row count unchanged). Live: 240 rows, 121 `counts_toward_total`, 18 `needs_review`, `image_path` NULL everywhere — images stay out until rights are cleared, so the storage ADR is deferred. 64 tests. |
