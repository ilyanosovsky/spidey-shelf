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

## ADR-009 · Category taxonomy: four buckets, `peter` is the denominator

**2026-08-06 · accepted** (owner's call, decided in chat). Every `reference_figures` row
carries a `category`: `peter` · `spider_verse` · `friends_foes` · `other`, labelled
`PETER PARKER` · `SPIDER-VERSE` · `FRIENDS & FOES` · `OTHER` in the UI.

> **Extended to six buckets by ADR-013** (`stitch` and `grogu` joined on 2026-11-23). The text
> below is the decision as it was made and is left as written.

- **Why buckets at all.** "Spider-Man figures" was never one thing: the shelf mixes Peter's
  own suits with Miles and Gwen, with Venom and Doc Ock, and with figures that have nothing
  to do with Spider-Man. One flat list makes the counter meaningless and the tabs arbitrary.
- **`counts_toward_total` ⇔ `category = 'peter'`.** The stats denominator is now derived from
  the taxonomy instead of being a separate judgement call per row, so "11 / 120 PETER PARKER
  COLLECTED" counts exactly what the PETER PARKER tab shows. This moved the denominator from
  121 to 120: the recategorization pass re-decided a handful of rows in both directions.
- **Depicted base character wins** for crossovers: a venomized/poisoned Peter is `peter`, a
  venomized Miles is `spider_verse`, and a suit worn by somebody else (Superior Spider-Man is
  Otto Octavius) is `friends_foes`. The 22 rows where that rule needed an explicit call are
  flagged `needs_review` and listed in IMPLEMENTATION_PLAN.md under Phase 2.
- **`text` + `CHECK`, not a pg enum.** A fifth bucket later is an ALTER of one constraint;
  an enum type change is not reversible inside a transaction. The column is
  `NOT NULL DEFAULT 'other'` for admin-written rows, but the seeder refuses a curated CSV row
  with a blank category rather than bucket it silently.
- **`other` exists so the vault can hold non-Spider-Man figures** — 7 of the owner's 19 are
  Deadpools, Stitches, Harry Potter and the Little Prince. Without the bucket they would need
  a second table or free-text names, and the shelf could not link them to a catalog row.

## ADR-010 · The scanner is an enrichment loop, and a barcode is never overwritten

**2026-08-07 · accepted.** ADR-006 fixed the scanner's engine; this one fixes what the
scanner is FOR. `reference_figures.upc` shipped empty on all 247 rows — ADR-008 seeded the
catalog from public checklists, and checklists print pop numbers, not barcodes. So "scan a
box, look it up" was never available on day one, and building for it would have shipped a
button that always missed.

- **The loop instead.** scan → catalog (miss, at first) → **one** UPCitemdb call → a
  heuristic figure name out of the product title → fuzzy match against our own catalog
  (the same FTS + `pg_trgm` pair public search uses) → the owner confirms which row it is →
  **the code is written onto that row**. The next scan of that box is a catalog hit costing
  nothing. The API bill therefore shrinks toward zero as the shelf gets scanned, instead of
  growing with use.
- **Confirm stays mandatory** (ADR-006) and gets a second reason: before the backfill the
  match is a _guess made from a retailer's product title_, not a barcode match. The screen
  says which one it is — `MATCHED BY BARCODE` appears only when the catalog itself knew the
  code.
- **A different code never overwrites an existing one.** Funko exclusives genuinely share
  UPCs, so a clash is evidence of ambiguity, not a correction: the old value stays, the row
  gets `needs_review`, and the new `review_note` column records both codes for triage.
  Trading a hand-checked fact for a camera's guess is not an upgrade. (Rejected
  alternative: last-write-wins, which loses exactly the rows a human had already resolved.)
- **Stored as EAN-13, looked up as both.** A UPC-A is the same code with a leading `0`; one
  canonical spelling in the column keeps "is this the same barcode?" a decidable question,
  while lookups query both forms because hand-entered rows may hold either.
- **Budget over cleverness.** The free tier is 100 lookups/day/IP with no key, so: catalog
  first, one call per scan, no retries on 429, a 5s timeout, and every failure rendered as a
  sentence with the keyboard next to it. A retry loop would burn a day's quota in an
  afternoon and buy nothing the owner could not type in five seconds.

## ADR-011 · The owner uploads the box art himself (UploadThing) — supersedes ADR-004's "no uploads"

**2026-08-07 · accepted** (owner's call, decided in chat). ADR-004 planned one pipeline —
fetch box art once, normalize with sharp, put it in a bucket — and ADR-008 then blocked it on
image rights: pops.today, the source that has the art, has not answered the permission email
sent 2026-08-06. Nine months of a catalog with drawn placeholders is not a plan, so the
interim source is **the owner**: he uploads one image per figure from
`/admin/collection/[id]/edit`, and `reference_figures.image_path` points at it.

- **"No user uploads" is not the rule being broken.** ADR-004's clause was about visitors and
  about the add flow never demanding a photo — both still hold. There is exactly one account
  on this site, it belongs to the owner, and the upload lives on an admin screen behind the
  same jose session everything else is. What changed is only _who supplies the file_, from a
  scraper we are not allowed to run to the person who owns the shelf.
- **The uniform look survives, because normalization moved rather than disappeared.** The
  browser does what sharp was going to do: decode → **contain** (never crop — a Funko box is
  portrait, and covering a square with it beheads every figure) → centre on `--navy-panel`
  → 800×800 → WebP q0.8, about 100–250 KB. So the grid still holds one shape and one
  background, and a phone on a shop's wifi uploads 150 KB instead of a 4 MB photo. The
  geometry is pure and unit-tested (`src/lib/box-art.ts`); only the canvas call is not.
- **Client-side, because there is no server to do it on.** Vercel Hobby functions are not
  where a 12 MP decode belongs, `sharp` is not in the deployed bundle, and UploadThing stores
  whatever it is handed. The route's 4 MB / one-file / image-only limits are the backstop for
  a hand-built POST, not the plan.
- **UploadThing over R2/Railway Bucket**, and the storage sub-ADR ADR-008 deferred is
  answered by this one for the interim. R2 would need presigned-URL plumbing, a CORS policy
  and an account the owner does not have; UploadThing is a file router with the auth check
  where we already put auth checks, and the free tier is 2 GB — roughly **10,000 normalized
  figures** against a 247-row catalog, so the ceiling is not a constraint this project can
  reach. It costs one dependency pair (`uploadthing` + `@uploadthing/react`, 47 KB of client
  JavaScript **on the admin edit route only**).
- **The session is re-verified inside `.middleware()`**, before a presigned URL exists — the
  CVE-2025-29927 rule, applied to a Route Handler that `src/proxy.ts` does not even cover.
  The browser's upload action must additionally be same-origin; UploadThing's server callback
  is exempted from that check because it carries no `Origin` and is authenticated by HMAC
  signature instead. Getting that wrong silently breaks `onUploadComplete`, which is the only
  thing that writes `image_path`.
- **A replaced file is deleted, and the order is deliberate.** `image_path` is written first,
  the superseded key deleted second: a crash between them leaves one orphan in a 2 GB bucket,
  while the other order leaves a figure pointing at a 404. A delete failure is logged and
  swallowed — it must never cost the owner the upload he just did.
- **Reversible, which is the whole point.** If pops.today (or anyone) grants image rights
  later, the ADR-004 pipeline writes the same column and simply overwrites `image_path`; the
  renderer (`BoxArt`) already treats an absolute URL and a future bucket path as the same
  thing, and `PixelSpiderArt` stays as both the empty state and the `onError` fallback.
  Nothing has to be torn down first — the same property ADR-008 was written to preserve.

## ADR-012 · A new city is geocoded once, at write time — never at request time

**2026-08-07 · accepted** (owner's call, decided in chat). Phase 8 put the SIGHTINGS MAP's
coordinates in a dictionary in code and wrote down why: nine cities, hand-checked, retroactive
over rows seeded from a Notion export, no migration, and a city it had never heard of degrades
to an `UNCHARTED SECTORS` line rather than a crash. That held for exactly as long as the shelf
stopped growing. The owner bought a Spider-Man in **Kuala Lumpur**, logged it from his phone,
and the map answered by listing it underneath itself — because the only way to put a new pin
on it was a pull request. A travel map that needs a deploy to acknowledge travel is not a
travel map.

- **The trade Phase 8 refused is not the trade being made.** Phase 8 rejected "a geocoder in
  the admin flow" as a second thing to type on a phone. Nothing new is typed: the owner still
  enters date, city, country. What changed is that the server action now RESOLVES the city he
  already gave it, in the milliseconds between validating the form and the `INSERT`.
- **The dormant columns become the store.** `owned_figures.acquired_lat` / `acquired_lng` have
  existed since Phase 1 and were NULL on every row. They now hold the answer, and the map reads
  **`column ?? dictionary`** — specific answer first, general one second.
- **The founding nine are NOT backfilled.** Haifa, Munich, Tbilisi, Batumi, Moscow, LA, Madrid,
  Mallorca and Amsterdam stay NULL and stay dictionary-placed. Their coordinates were checked
  by a human, including two judgement calls a gazetteer would get wrong (`US:la` is Los Angeles
  because that is where the figure was bought; `ES:mallorca` is an island pinned to Palma), and
  spending nine requests to move some of them by a few hundred metres is not an improvement.
- **OpenStreetMap's Nominatim, and the usage policy is a term of the decision**
  (<https://operations.osmfoundation.org/policies/nominatim/>). It is free, needs no key and
  runs on the OSM Foundation's donated hardware, so the terms it asks for are strict and this
  project meets them by construction rather than by discipline: a real identifying
  `User-Agent`, **one request per NEW city over the lifetime of the collection** (the
  dictionary and the rows already on the shelf answer first, so the second figure from Kuala
  Lumpur costs nothing), one attempt with no retries, a 5-second budget, and the answer stored
  permanently — which is exactly the caching the policy asks for. A structured
  `city=` + `countrycodes=` query rather than free-text `q=`, because a hard country filter is
  what stops `LA` resolving to Louisiana.
- **No request-time geocoding, ever.** The call happens in two server actions and nowhere else.
  A page renders from columns that were filled in when the row was written, so a visitor — or a
  crawler, or a link pasted into a group chat — cannot cost OSM a single request. This is the
  same inversion Phase 11 made for eBay prices, and for the same reason: a per-visitor call to
  a third party is a bill and an outage waiting to be someone else's decision.
- **Two decimals, by design.** About a kilometre at the equator. A marker is five pixels of
  spider on a crop 8,000 km wide, so nothing finer is visible — and this is a public site
  where the geocoder is being asked about a place the owner physically stood in. Full precision
  for a small town is close to the shop's doorstep. It applies to geocoded answers only; a
  dictionary value is already a city centre and is stored as written.
- **It can never cost a sighting.** A timeout, a 429, an HTML error page or a town nobody has
  mapped all resolve to the same thing: the row is saved with NULL coordinates, exactly as
  every row was before this ADR, and the figure lands on the shelf. Nothing is written down, so
  the collection edit screen IS the retry — saving that form resolves the place again, for
  free, if it is now known. (Rejected alternative: fail the save, or retry the lookup. Both
  trade a figure the owner is holding for a pin nobody has asked for yet.)
- **One-time backfill, by script.** `scripts/backfill-geocode.ts` (`npm run geo:backfill`,
  `--dry-run` supported) fills the rows written before this ADR whose city the dictionary does
  not know — one distinct city today, and one request. It is rerunnable and idempotent: a row
  with a coordinate is never selected again. `db:seed:owned` deliberately does **not** geocode
  — it is a bulk upsert of the whole CSV, and a loop of network calls inside a seeder is the
  "heavy use" the policy names; the script covers that job with the 1-per-second spacing a bulk
  pass actually needs.

## ADR-013 · Veronika's figures: a third status and two categories, not an owner column

**2026-11-23 · accepted** (owner's call, decided in chat). The owner still collects
Spider-Man. His partner Veronika now collects alongside him — only two lines, Stitch and
Grogu — and her figures already stand on the same shelf: the three Lilo & Stitch Pops in the
seed (Hula Stitch, Leroy, Stitch As Pineapple) had been entered as `not_mine_anymore`, the only
way the data model had to say "on the shelf, but not his". The owner asked for three things:
the box-art photo in the Quick Add flow itself (it could only be uploaded through EDIT, after
the figure was saved), a third ownership option plus categories for her two lines, and her
figures framed in pink on the shelf and drawn with their own icons on the sightings map.

- **A third value of `owned_figures.status`, not an owner column.** `OWNED_STATUSES` is now
  `mine` · `not_mine_anymore` · `veronika`, labelled `MINE` · `NOT MINE ANYMORE` ·
  `VERONIKA'S`. Ownership and presence are one question here: a figure is on the shelf (and then
  it is someone's) or it is gone. A separate `owner` column would have made that two questions
  with four combinations, one of them (hers, and gone) with no UI and no counter for it, and it
  would have been a migration to a view and a query set that all already switch on `status`.
  (Rejected alternative: `owner` column. It is the more extensible model if a third collector
  ever appears, and that is the day to revisit it.)
- **No DDL for the status.** `status` is a plain `text` column with no `CHECK`; the app
  validates against `OWNED_STATUSES`. The `catalog_with_ownership` view already counts every
  status except `not_mine_anymore` as owned, so a `veronika` row makes its catalog figure
  OWNED in search with no change to the view.
- **Two categories, six buckets.** `FIGURE_CATEGORIES` is now `peter` · `spider_verse` ·
  `friends_foes` · `stitch` · `grogu` · `other`, with `other` kept last as the catch-all.
  `counts_toward_total ⇔ category = 'peter'` is untouched, so "11 / 120 PETER PARKER
  COLLECTED" still counts exactly the figures it counted. Because the radar and the tabs are
  both built from `FIGURE_CATEGORIES`, the WEB RADAR has six sectors and the home shelf gained
  STITCH and GROGU tabs without a line of per-category layout code. `stitch` and `grogu` are
  also exported as `VERONIKA_CATEGORIES`, which is what drives the smart default (a figure from
  one of them is preselected `VERONIKA'S` in Quick Add) and the wishlist (see below).
- **The `CHECK` is widened by migration `0005_veronika_stitch_grogu.sql`.** The category
  constraint on `reference_figures` is dropped and recreated with six values — the "one
  `ALTER` rather than an enum change" that ADR-009 chose `text` + `CHECK` for. After the
  generated statements the file carries a hand-written, idempotent backfill: `other` rows that
  are Stitch or Grogu are recategorised, and `not_mine_anymore` rows in those two categories
  become `veronika` (that status was the workaround for her figures). `mine` rows are
  deliberately not touched — a Stitch logged as `mine` is the owner's own call. The seed CSVs
  (`data/catalog/others-manual.csv`, `data/collection/owned.csv`) were updated to the same end
  state, so a fresh seed and a migrated database agree.
- **"Is mine" became "is on the shelf" in three places.** The Quick Add duplicate guard
  (`findOwnedDuplicate`), TOTAL VAULT VALUE (`countsTowardValue` in `src/lib/finances.ts`) and
  the console's FIGURES ON THE SHELF counter (`getVaultStats().onShelf`, renamed from `mine`)
  now ask `isOnTheShelf(status)` — `mine` or `veronika`. It is one shelf and one vault: a
  second Hula Stitch is a duplicate whether the first is his or hers, and her figures are part
  of what the shelf is worth. This is a deliberate change of meaning and the one to remember
  when reading older text in this log that says "only `mine`".
- **Her figures are told apart by pink and by an icon, never by colour alone.** `FigureCard`
  and the figure page frame a `veronika` row in the new `--color-pink` with a `VERONIKA'S` chip
  (not dimmed, unlike `not_mine_anymore` — the figure is on the shelf). On the sightings map a
  city shows one icon per kind found there (spider, Stitch, Grogu) with per-kind counts, and
  Stitch and Grogu figures without box art get a pixel Stitch or Grogu instead of the spider.
  The sprites are drawn for this site in the existing hand, not copied artwork.
- **The wishlist hides an empty Veronika tab.** Her lines have no hunt catalog — only figures
  that are on the shelf get catalogued — so a permanent STITCH `0` tab would be noise. It
  appears the moment an unowned Stitch or Grogu is catalogued.
- **Box art moved into Quick Add.** `BoxArtPanel` moved to `src/app/admin/box-art-panel.tsx`
  and is mounted on the details step as well as on the edit screen. It uploads immediately to
  the catalog row (which exists from the moment the figure is picked), with no SAVE, so nothing
  in the sighting form has to wait for it.
- **The honest trade-off.** Because ownership is a status, a figure of hers that later leaves
  the shelf can only become `not_mine_anymore` — there is no "was Veronika's" state — so it
  loses the pink frame and reads as a plain departed figure. The same single-status model means
  a figure cannot be both: a Stitch the two of them own jointly is whichever one the form says.
  The backfill has a matching imperfection: a Stitch that really had left the shelf and was
  filed as `not_mine_anymore` is moved to `veronika`, and is one EDIT away from being put back.
  All three were judged cheaper than a second column for a two-person shelf.
- **Rollout order matters.** Until `npm run db:migrate` is run against the live database, the
  new code runs but creating a `stitch` or `grogu` figure fails the old category `CHECK`, and
  the existing rows keep their old `other` / `not_mine_anymore` state. It was run on
  2026-11-23, the day PR #17 merged.
