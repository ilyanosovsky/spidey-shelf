# Decisions (ADR log)

Append-only. Changing a locked decision requires a new ADR entry, not an edit.

## ADR-001 · No public Funko API exists — build our own scoped catalog

**2026-08-06 · accepted.** Live probes: funko.com is Salesforce Commerce Cloud with no catalog
endpoint, `api.funko.com` returns 502; hobbyDB API is partner-only ($1,200+ setup) and its ToS
bans scraping; open datasets are 4–5 years stale and lack pop numbers. Consequence: a curated
Spider-Man-scoped `reference_figures` catalog (~117 core + variants), seeded from pops.today
(with written consent, requested 2026-08-06) or checklist sites (plan B), maintained via admin.

## ADR-002 · Vercel (app) + Railway (Postgres), not all-Railway, not Supabase

**2026-08-06 · accepted.** Railway rates ($10/GB RAM/mo, $20/vCPU/mo): an always-on Next.js
container alone exceeds the $5 Hobby credit; app+DB ≈ $9–11/mo. A 0.25 GB Postgres (~$3/mo)
fits inside the already-paid credit and never sleeps (kills Supabase Free's pause problem +
keepalive cron). Vercel Hobby adds free CDN + image optimizer Railway doesn't have.
Supabase dropped entirely.

## ADR-003 · No Notion in the loop

**2026-08-06 · accepted.** 19 existing figures are entered manually via our own admin (one
evening, doubles as the first live test of Quick Add). Notion-as-backend was rejected earlier:
its file URLs are 1-hour signed S3 links — incompatible with static generation.

## ADR-004 · Images: one-time normalized copies, no hot-linking, no uploads

**2026-08-06 · accepted.** Requirements demand a uniform look → one-time pipeline: fetch box
art once → sharp → 800×800 WebP → object storage (R2 or Railway Bucket — sub-ADR pending),
served only through `next/image`. Hot-linking rejected: optimizer sends no Referer (naive
hotlink protection breaks it), link rot shows broken images with no fallback, foreign
sizes/backgrounds break the uniform grid. Personal photos: never required in the add flow.

## ADR-005 · Hand-rolled single-admin auth

**2026-08-06 · accepted.** jose-signed httpOnly cookie + bcrypt hash in env, per the official
Next.js auth guide; session re-verified in every server action (CVE-2025-29927). Auth.js is
feature-frozen under new stewardship; better-auth brings its own multi-table schema — both
over-provisioned for exactly one permanent user.

## ADR-006 · Scanner targets UPC barcodes via WASM

**2026-08-06 · accepted.** Boxes carry UPC-A/EAN-13; QR appears only on select event
exclusives and encodes an Octane5 anti-counterfeit code, not a product link. iOS Safari's
native BarcodeDetector is flag-disabled and regressed (open WebKit bug) → zxing-wasm with
feature-detect for Android's native API; typed number input stays a first-class path.
Exclusives may share a UPC → the confirm-variant screen is mandatory.

## ADR-007 · Docs-as-code wiki

**2026-08-06 · accepted.** `docs/wiki/` in the main repo is the reviewable source of truth,
updated in the same PR as the change; a GitHub Action mirrors it to the GitHub Wiki on merge.
Direct wiki edits are not allowed (they'd be overwritten by the next sync).

## ADR-008 · Catalog seeded from checklist facts (plan B)

**2026-08-06 · accepted.** pops.today (plan A, ADR-001) has not answered the permission email,
so the catalog ships on plan B: `data/catalog/spiderman.csv`, 240 Spider-Man rows compiled by
us from public checklists (funkypriceguide, Pop Shop Guide, Cardboard Connection), loaded by
`npm run db:seed`.

What that decision rests on:

- **Facts only.** Each row carries a pop number, a figure name, a product line, a release year
  and an exclusivity label — unoriginal facts about physical products, not anyone's creative
  expression. No descriptions, no editorial text, no price data, no images were copied.
- **Attribution per row.** `source` and `source_url` are stored on every row, so any figure on
  the site can be traced back to where its facts came from; `notes` in the CSV records
  cross-checks between lists.
- **Images deliberately excluded.** Box art _is_ protected expression, so `image_path` stays
  NULL for all 240 rows until we have written permission for a specific image source. Phase 4
  renders pixel-art placeholders instead; the ADR-004 pipeline stays unbuilt, and the R2 vs
  Railway Bucket storage ADR is deferred with it (nothing to store yet).
- **Our own compilation, in the open.** The CSV lives in the public repo as a reviewable,
  hand-curated artifact — the selection, the `counts_toward_total` calls and the `needs_review`
  triage are ours. The site is non-commercial and single-owner.
- **Reversible.** If pops.today (or another source) grants permission later, the same seeder
  re-runs with a richer CSV: rows are matched on `slug`, `source`/`source_url` are overwritten
  in place, and `image_path` becomes fillable — nothing has to be torn down first.
