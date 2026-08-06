# Implementation Plan — Spidey Shelf

> **This file is the single source of progress truth.** Every PR updates the status of the
> steps it touches. Statuses: ⬜ todo · 🟡 in progress · 🟢 done · ⛔ blocked.

| Phase | Goal | Status |
|---|---|---|
| 0 | Scaffold & CI | ⬜ |
| 1 | Database & admin auth | ⬜ |
| 2 | Reference catalog seed + images | ⛔ partially (pops.today reply pending — plan B ready) |
| 3 | Owner data entry (19 figures) | ⬜ |
| 4 | Public showcase | ⬜ |
| 5 | Search, wishlist & stats | ⬜ |
| 6 | Admin Quick Add flow | ⬜ |
| 7 | Barcode scanner | ⬜ |
| 8 | Polish: PWA, map, prices | ⬜ |

Governance (this PR): 🟡

---

## Phase 0 — Scaffold & CI

| Step | Status | PR | Notes |
|---|---|---|---|
| Next.js App Router + TS + Tailwind scaffold | ⬜ | | Node 22, `output` default |
| Design tokens from brief → Tailwind theme + Press Start 2P | ⬜ | | dark-only |
| ESLint + Prettier + typecheck scripts | ⬜ | | |
| Vitest + Testing Library setup, sample test | ⬜ | | |
| CI becomes real (remove no-app guard in ci.yml) | ⬜ | | lint · typecheck · test · build |
| Vercel project connected, hello page deployed | ⬜ | | manual: connect repo in Vercel |

## Phase 1 — Database & admin auth

| Step | Status | PR | Notes |
|---|---|---|---|
| Railway Postgres provisioned + volume backups enabled | ⬜ | | manual in Railway UI |
| Drizzle setup, connection pooling | ⬜ | | |
| Schema: `reference_figures`, `owned_figures`, view `catalog_with_ownership` | ⬜ | | `slug` unique, `pop_number` indexed non-unique |
| Migrations pipeline (`drizzle-kit`) | ⬜ | | |
| Admin session: jose cookie + bcrypt env hash, login page | ⬜ | | re-verify in every server action |
| Unit tests: slug gen, session verify | ⬜ | | |

## Phase 2 — Reference catalog seed + images

| Step | Status | PR | Notes |
|---|---|---|---|
| Decision: pops.today (plan A) vs checklist sites (plan B) | ⛔ | | blocked on email reply; B is default after 2 weeks silence |
| Seed script (idempotent, CSV in repo, `source_url` per row) | ⬜ | | Spider-Man scope ~117 core + variants |
| Manual review pass (`needs_review` triage) | ⬜ | | |
| Image pipeline: fetch once → 800×800 WebP → object storage | ⬜ | | pixel-art placeholder until images cleared |
| Storage choice: R2 vs Railway Bucket (ADR) | ⬜ | | |

## Phase 3 — Owner data entry

| Step | Status | PR | Notes |
|---|---|---|---|
| Minimal admin CRUD for owned figures | ⬜ | | |
| Enter 12 spiders + 7 other figures manually | ⬜ | | data in design brief table; first live test of the flow |

## Phase 4 — Public showcase

| Step | Status | PR | Notes |
|---|---|---|---|
| Component library: FigureCard, PixelButton, LCDCounter, ToothedBanner, TickerBar | ⬜ | | per mockups |
| Home: grid, tabs (All Spiders / Other), LCD counter, new sightings ribbon | ⬜ | | mobile-first |
| Figure page: box art, sighting log (place/date/story), prev/next | ⬜ | | |
| Ticker with latest sighting | ⬜ | | |

## Phase 5 — Search, wishlist & stats

| Step | Status | PR | Notes |
|---|---|---|---|
| Search by number/name, OWNED / NOT OWNED verdict stamp | ⬜ | | shareable `/search?q=1450` |
| Variant disambiguation in results | ⬜ | | shared numbers |
| Wishlist page (NULL rows of the ownership view) | ⬜ | | gift-idea CTA |
| Stats: LCD counters 12/117 + 12/~400, web-radar progress | ⬜ | | honest denominator (`counts_toward_total`) |

## Phase 6 — Admin Quick Add flow

| Step | Status | PR | Notes |
|---|---|---|---|
| Search-first add screen (number/name) | ⬜ | | |
| Confirm screen with variant picker | ⬜ | | mandatory step |
| Details step: place (last-used default), date (today), status, story (skippable) | ⬜ | | |
| Success screen + duplicate guard ("already in the vault") | ⬜ | | |
| Not-in-catalog path ("add as new figure") | ⬜ | | never block on incomplete catalog |

## Phase 7 — Barcode scanner

| Step | Status | PR | Notes |
|---|---|---|---|
| zxing-wasm integration + BarcodeDetector feature-detect | ⬜ | | iOS Safari native API is broken — wasm is the path |
| Scanner overlay UI (viewfinder, fallback to typing) | ⬜ | | |
| UPC lookup in catalog + UPCitemdb fallback (100 req/day) | ⬜ | | exclusives may share UPC → always confirm |

## Phase 8 — Polish

| Step | Status | PR | Notes |
|---|---|---|---|
| PWA: manifest, icons, install prompt | ⬜ | | |
| Travel map with pixel spider markers per city | ⬜ | | lat/lng already in schema |
| eBay Browse API prices (optional) | ⬜ | | 5000 req/day free |
| Accessibility & perf audit, reduced-motion | ⬜ | | |

---

## Log

| Date | Event |
|---|---|
| 2026-08-06 | Research done: no official Funko API; pops.today best source (permission email sent); hobbyDB ruled out (ToS). Architecture v2: Vercel + Railway Postgres, no Notion, no Supabase. |
| 2026-08-06 | Design brief written; mockups built in Claude Design (docs/design). |
| 2026-08-06 | Repo bootstrapped; governance PR opened. |
