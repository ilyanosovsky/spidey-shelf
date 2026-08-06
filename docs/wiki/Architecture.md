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

## Key mechanisms

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
- **Stats denominator**: `counts_toward_total` flag in the catalog; UI shows both
  "core canon 12/117" and "full Spider-Verse 12/~400" with a "catalog updated" date.

## External data sources

| Source                                                | Role                                                 | Status                           |
| ----------------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| pops.today                                            | catalog + UPC + box art (27k pops, 418 spider pages) | permission email sent 2026-08-06 |
| Checklist sites (funkypriceguide 117, Pop Shop Guide) | plan-B catalog seed                                  | ready                            |
| UPCitemdb (free 100 req/day)                          | scan-time UPC fallback                               | planned, phase 7                 |
| eBay Browse API (free 5k req/day)                     | live prices                                          | optional, phase 8                |
| hobbyDB / Funko official                              | —                                                    | ruled out (ToS / no API)         |
