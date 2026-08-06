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
