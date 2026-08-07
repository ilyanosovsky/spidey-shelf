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
UploadThing (free 2 GB) ─────► si4zn51deh.ufs.sh/f/<key>
  owner-uploaded box art, already 800×800 WebP when it arrives
  one file per catalog figure; replaced files are deleted
```

- **Frontend + admin** on Vercel Hobby: free CDN, image optimizer (5k transformations/mo,
  project needs ~600), 100 GB transfer.
- **DB** on Railway: a small always-on Postgres (~0.25 GB RAM ≈ $2.5–3.5/mo) fits inside the
  already-paid $5 Hobby credit. Running the whole app on Railway was measured against
  official rates and does NOT fit ($9–11/mo) — see [[Decisions]].
- **Images**: hot-linking rejected (uniform-look requirement + Referer-blocked optimizer
  fetches + link rot). Everything is served through `next/image` — see the image story below.

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

## Box art: three sources, one component

A figure's picture has had three answers on this project, and all three are live code:

| #   | Source                            | Status                                      | What draws it                  |
| --- | --------------------------------- | ------------------------------------------- | ------------------------------ |
| 1   | **drawn pixel spider** (Phase 4)  | the default — `image_path` is NULL          | `PixelSpiderArt`               |
| 2   | **owner upload** (Phase 9)        | **live** — ADR-011, nothing uploaded yet    | `next/image` via `BoxArtImage` |
| 3   | **pops.today pipeline** (ADR-004) | unbuilt — permission email still unanswered | would write the same column    |

`src/components/box-art.tsx` is where that choice is made, once, for the eight places a
figure is drawn (`FigureCard`, `WantedCard`, `SearchResultCard`, the figure page hero, and
Quick Add's hero / summary / result cards). Everything else just passes `imagePath` down.

### 1 · The drawn spider is not a "missing image" state

`PixelSpiderArt` renders a 16×16 inline-SVG spider tinted by the figure's category with the
pop number as cover text, and it is deterministic — an FNV-1a hash of the slug picks three
background specks and nothing else varies — so a figure looks identical on the grid, on its
own page, and after a redeploy. It is also the **`onError` fallback**: a stored URL that
stops resolving (a file deleted from the dashboard, a bad CDN minute) shows the drawn art
again rather than a broken-image glyph.

### 2 · The owner's upload (Phase 9)

`/admin/collection/[id]/edit` → BOX ART panel → pick a file → the **browser** normalizes it
→ UploadThing → `reference_figures.image_path`.

```
pick  ─► rejectPickedFile()      not an image / over 4MB → refused before a decode
        ─► normalizeBoxArt()     decode → contain on #123b5c → 800×800 → WebP q0.8
          ─► useUploadThing()    POST /api/uploadthing?actionType=upload
            ─► .middleware()     ★ jose session re-verified; figure id resolved
              ─► UT ingest       the file itself never touches our server
                ─► .onUploadComplete()   image_path = ufsUrl, then delete the old key
                  ─► router.refresh()
```

- **The normalization is `contain`, never `cover`.** A Funko box is portrait; covering an
  800×800 square with it slices the head off every figure. The picture is scaled whole and
  padded onto `--navy-panel`, which is the card's own background, so a tall box reads as
  artwork rather than as a photo with bars. `containRect()` is pure and unit-tested.
- **It happens in the browser** because there is no server to do it on: Vercel Hobby
  functions are not where a 12 MP decode belongs, and UploadThing stores what it is handed.
  The upload is ~150 KB instead of 4 MB, which matters on a shop's wifi.
- **`.middleware()` is the real gate.** `src/proxy.ts` does not cover `/api/*` and a proxy
  check would not count anyway (CVE-2025-29927), so the session is verified off the request's
  own `Cookie` header inside the middleware — before a presigned URL exists. An anonymous
  POST gets `403 {"message":"Not signed in as the owner."}`, never a redirect.
- **The route handler adds a same-origin check** (Next.js data-security guidance for Route
  Handlers; the SDK does not do it). It is **conditional**, and that condition is
  load-bearing: UploadThing's own server posts the `uploadthing-hook: callback` request that
  triggers `onUploadComplete`, from a machine, with no `Origin` header. A blanket check would
  pass every browser test and silently stop `image_path` from ever being written in
  production. The callback is authenticated by its HMAC signature instead.
- **A replacement deletes what it replaces**, in that order: write the new URL, then delete
  the old key. The other order leaves a figure pointing at a 404; this one leaves, at worst,
  an orphan in a 2 GB bucket. `replacedFileKey()` also refuses to delete a key equal to the
  new one — UploadThing deduplicates identical bytes to a single key, and deleting that would
  delete the image just saved.
- **The only client JavaScript this adds to the public site** is `BoxArtImage`, the `onError`
  swap. The placeholder is handed to it as a rendered ReactNode, so `PixelSpiderArt`, the
  sprite geometry and the category tokens all stay on the server; the 47 KB UploadThing chunk
  is on `/admin/collection/[id]/edit` and nowhere else (checked against the built
  client-reference manifests).

### 3 · The pipeline that is still not built

ADR-004's fetch-once-and-normalize job stays unbuilt and un-needed: if pops.today ever
answers, it writes the same `image_path` column and the renderer does not change. That is
what makes Phase 9 an interim rather than a fork in the road.

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
  shelf for the FINANCES section, the SIGHTINGS MAP, the year timeline and the country flags.
  The WebRadar's geometry is pure arithmetic in `src/lib/radar.ts`; the map's is in
  `src/lib/geo.ts`; the money is in `src/lib/finances.ts` and reads only the price cache.
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
- **Session-aware nav** (Phase 10): every page asks `isAdminSession()` (`src/lib/dal.ts`) and
  passes the boolean to `PublicNav`, which appends a fifth `CONSOLE → /admin` tab for the
  owner. Three things make that safe rather than clever: it is a **verified signature**, not
  cookie presence, so a forged `spidey_session` renders a guest's nav; the item is **never
  constructed** for a guest, so no `CONSOLE` label and no `/admin` href exists in the HTML to
  find; and reading cookies costs nothing here because every public page is already
  `force-dynamic` (a static page would have been opted out by the read). It is UX only — the
  gate is still `requireAdmin()`. `logoutAction` now lands on `/`, since leaving the back
  office should not mean arriving at a password box.
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

## The SIGHTINGS MAP (Phase 8, geocoded since Phase 13)

`/stats`, between the WEB RADAR and the ACQUISITION LOG: a dark navy world with a thin
graticule and a pixel spider on every city the collection came from. No map library, no tiles,
no runtime dependency — three files and one path.

### Where the coordinates come from: the dictionary, then the row

Two sources, read in this order by `sightingCoordinate()` in `src/lib/sightings-map.ts`:

1. **`owned_figures.acquired_lat` / `acquired_lng`** — filled in when the row was written
   (Phase 13, see below). The specific answer.
2. **`src/lib/geo.ts`** — a dictionary of the nine founding cities keyed
   `<alpha-2>:<normalised city>`, hand-checked in Phase 8. The general one.
3. Neither: an `UNCHARTED SECTORS` line under the map — the figure is named and its place
   printed, rather than dropped. A map that silently loses a figure is worse than one that
   admits it does not know where Milan is.

The dictionary is still first in every sense that matters, and the founding nine were
deliberately **not** backfilled: their coordinates were verified by a person, including two
judgement calls a gazetteer gets wrong (`US:la` resolves to Los Angeles because that is where
the figure was bought; `ES:mallorca` is an island pinned to Palma). The normaliser folds case,
accents and apostrophes (`München` → `munchen`, `T'bilisi` → `tbilisi`), and aliases are
**listed explicitly, never fuzzy-matched**. A map is a factual claim; "close enough" is how a
figure ends up on the wrong continent.

**A city is placed if ANY of its rows can be placed.** Clustering is keyed on
`(country, city)` as it always was, and the cluster takes the first coordinate any of its rows
knows, in shelf order — so a Kuala Lumpur bought before Phase 13 and one bought after are one
pin with a count of two, not a pin and an orphan line.

### Geocoding happens once, on the write path (Phase 13)

Phase 8 put the coordinates in code and wrote down why, and it held until the shelf grew: the
owner bought a figure in **Kuala Lumpur**, logged it from his phone, and the map answered by
listing it underneath itself, because the only way to add a pin was a pull request. `src/lib/geocode/`
is the fix, and ADR-012 is the reasoning. The shape:

- **`nominatim.ts`** — pure. The endpoint, the identifying `User-Agent`, the 5s budget, the
  structured `city=` + `countrycodes=` URL (a hard country filter is what stops `LA` becoming
  Louisiana), the response parser, and the rounding to **two decimals** — about a kilometre,
  which is all a five-pixel marker can show and all a public site should publish about a place
  the owner physically stood in.
- **`resolve.ts`** — pure, with the network call injected, so "does this reach OpenStreetMap?"
  is a spy in a test rather than a socket. The skip logic in order: **dictionary → a row
  already on the shelf with the same country+city → one request.** The first two make zero
  network calls.
- **`lookup.ts`** — the one `fetch`. One attempt, no retries, never throws.
- **`queries.ts` / `index.ts`** — `server-only`. `resolveAcquiredCoordinate()` is what the two
  server actions call, and `index.ts` is where the `server-only` marker lives rather than on
  `lookup.ts`, because `scripts/backfill-geocode.ts` reuses the socket module under `tsx`,
  where that package throws by design.

**Exactly two callers, both writes**: Quick Add's details submit and the collection edit
submit. **No page, layout, route handler or cron job geocodes** — a rendered `/stats` is a read
of columns that were filled in long before, so a visitor cannot cost the OSM Foundation a
request. The cost of the whole feature is one lookup per city the collection has never been to.

A failure — timeout, 429, an HTML error page, a town nobody has mapped — is **two NULLs and a
saved sighting**, never a failed save. Nothing is written down, so re-saving the row from
`/admin/collection/[id]/edit` is the retry.

### Equirectangular, because it is linear

The projection is the whole trick: `x = lng + 180`, `y = 90 - lat`. Nothing else. That makes the
map's coordinate space **degree space**, so:

- the landmass is one SVG path with `viewBox="0 0 360 180"` and never needs re-projecting;
- cropping to "the places he has been" is a narrower `viewBox` **and nothing else** — the crop
  is computed from the markers by `mapBounds()`, which is pure and unit-tested;
- an SVG with a `viewBox` and `h-auto w-full` takes its aspect ratio from the crop, so a wide
  crop is a wide panel rather than a letterboxed one.

`mapBounds()` applies three guards in order, each because of the picture it otherwise produces:
**padding** (markers on the frame read as cut off), a **26° minimum span** (one city on its own
would zoom to a pixel of coastline), and an **aspect clamp** (Los Angeles to Tbilisi is 163° of
longitude against 20° of latitude — a 7:1 slit). Everything is finally clamped to the world, so
a crop can never run off the antimeridian into empty space.

### The landmass

`src/lib/world-land.ts` — **Natural Earth 1:110m "land", public domain (CC0)**, taken from the
`world-atlas` package and converted once by `scripts/generate-world-land.mjs`. The JSON is
fetched, converted and thrown away; the repo carries 27 KB of derived path data and no
dependency. Two details are load-bearing:

- **The antimeridian is split at the map edge.** Eurasia is a single ring that runs off the
  right side and comes back on the left, so a naive `L` between those two points draws a
  straight line across the entire Pacific. Any segment wider than 180° ends the current subpath
  at the border and starts a new one on the opposite side.
- **Precision is the simplification.** Coordinates are rounded to whole degrees and consecutive
  duplicates dropped: 54 KB → 27 KB, and coastlines that step rather than curve. That is the
  right look for this project rather than a cost it tolerates.

### Markers

5×5 pixel spiders — `PixelSpiderArt`'s 16×16 sprite reduced to what survives at 25px — sized in
**degrees rather than pixels**, so a marker is the same fraction of the panel on a 375px phone
and on a desktop. Same-city figures are one marker with an amber count badge, coloured by the
bucket most of that city's figures belong to. Cities 250 km apart on a 20,000 km map overlap and
always will; markers are drawn smallest-first so the busier city ends up on top, and the legend
beneath — flag, city, count, as real text — is where the numbers are actually read. The SVG is
`aria-hidden`, the same rule `WebRadar` follows.

## eBay MARKET SIGNAL (Phase 8) — live since 2026-08-07

`src/lib/ebay/`. Everything starts at `isEbayConfigured()`: the feature is keys-optional by
design, and a key-less deployment **renders no panel, issues no query and makes no request** —
verified, not assumed, by patching `globalThis.fetch` around the real `getMarketPanel()` and
`listPriceChips()` against the live database (zero calls recorded). The owner's production
keyset is now configured locally and on Vercel, so the panel is live in production.

| Module        | What it is                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| `config.ts`   | the gate. Pure over an env-shaped object, so "no keys" is a tested state       |
| `query.ts`    | the search string and the outbound eBay URL — pure                             |
| `parse.ts`    | Browse + OAuth response parsing, total and throw-free — pure, fixture-tested   |
| `snapshot.ts` | the three TTLs, the refresh decision, and every formatted string — pure        |
| `refresh.ts`  | Phase 11: the cron's door and its loop, over injected deps — pure, testable    |
| `client.ts`   | `server-only`: the secret, the two fetches, the timeout, the token cache       |
| `queries.ts`  | `server-only`: read / upsert / list `price_snapshots`, and the sweep's targets |
| `market.ts`   | `server-only`: the orchestration, and the only thing a page imports            |

✅ **Live-verified 2026-08-07** against the real API with the owner's production keyset:
OAuth client-credentials → 200 (`Application Access Token`, 7200s) parsed by
`parseTokenResponse` unchanged; a real `item_summary/search` (54 total listings) →
`interpretBrowseResponse` → `ok · 25 sampled · min $5.00 · median $15.99 USD`. The published
shapes the fixtures in `parse.test.ts` were written against matched the live responses with
**zero parser changes**. End-to-end through the app, `/figure/…-1450` rendered the panel and
wrote the first `price_snapshots` row.

### The budget, honestly

The free Browse tier is **5,000 calls per day**. The rules that keep us nowhere near it:

- **The nightly sweep is the only thing that spends calls in bulk**, and it is bounded by the
  shelf: 19 owned figures, one call each, **≤19 calls a day** (see below).
- **A figure page still refreshes its own snapshot** when it finds one older than 24 hours,
  which is at most another 19 calls a day and in practice near zero, because the sweep has
  usually just been. Worst case, both together: **~38 calls, 0.76% of the allowance.**
- **No other page can trigger a lookup — ever.** The wishlist is 232 cards, the shelf is ~20,
  and `/stats` sums the whole collection; one call per card would spend the entire day's
  allowance in twenty-two wishlist views. `listPriceChips()` and `getCollectionFinances()`
  read the cache and stop, and the rule is written down and tested (`mayShowPriceChip()`)
  rather than left as an absent `await`.
- **One attempt, no retries** (the same rule the UPCitemdb client follows) and a **5-second
  budget for the whole refresh**, token included. A 429 answered by trying again is how a quota
  disappears in an afternoon.
- **The token is cached in module scope** until it expires, so it costs one round trip per
  serverless instance rather than one per page view. `parseTokenResponse` shaves a minute off
  eBay's two-hour lifetime, so a token cannot expire between the check and the request.

### What the page does with a failure

`decideMarketFetch()` is pure and tested, and the case worth stating is the last one: **a stale
snapshot is still served**. If eBay is down, `≈$24 · CHECKED 3D AGO · EBAY DID NOT ANSWER` is a
better answer than a blank panel, and the age is on screen so nobody mistakes it for live. A
missing snapshot with a failed fetch renders **nothing at all** — there is no honest number to
put there, and a public showcase does not narrate its own integrations. Nothing in this path
throws: it runs inside the render of `/figure/[slug]`, and a rejected promise would replace a
figure's page with an error boundary because a price could not be loaded.

## The nightly price sweep (Phase 11)

`vercel.json` → `0 6 * * *` → `GET /api/cron/refresh-prices`. One scheduled job, and it
exists so that **no page ever fetches a price**.

That rule is the whole architecture of Phase 11. Phase 8 could let a figure page pay for its
own lookup because a figure page is one figure; Phase 11 puts a price on every card of the
shelf and a total on `/stats`, and those are twenty and nineteen figures on one screen. The
arithmetic is not close: one visitor to the home page would cost twenty Browse calls, and the
free tier would be gone by lunchtime. So the cache became the source of truth for every page
and the cron became the only thing that fills it.

```
06:00 UTC   Vercel ──Authorization: Bearer $CRON_SECRET──► /api/cron/refresh-prices
                                                             │ isCronAuthorized()   401 otherwise
                                                             │ isEbayConfigured()   {skipped} otherwise
                                                             ▼
                                            listRefreshTargets()   19 owned figures + their snapshots
                                                             │
                                            for each, sequentially, one attempt:
                                              older than 12h? ──no──► skippedFresh
                                                    │ yes
                                                    ▼
                                              fetchMarketSignal() ──not ok──► failed (never retried)
                                                    │ ok
                                                    ▼
                                              upsertPriceSnapshot()  ──► refreshed
                                                             │
                                                             ▼
                                          {checked, refreshed, failed, skippedFresh}
```

- **Daily is the ceiling on Hobby**, and Vercel schedules a Hobby cron anywhere inside a
  **one-hour window** — 06:00 is a request, not a promise. Two consecutive runs can therefore
  be 25 hours apart, which is why the two TTLs either side of 24 hours exist:
  `PRICE_REFRESH_AFTER_MS` is **12h** (so a daily run always refreshes everything it looks at,
  and never finds something already expired) and `PRICE_DISPLAY_TTL_MS` is **48h** (so a chip
  or a total is not blanked by an hour of scheduling drift, or by one failed night).
  `PRICE_SNAPSHOT_TTL_MS` stays 24h and stays the figure page's rule.
- **The door is in the handler.** `Authorization: Bearer $CRON_SECRET`, which Vercel attaches
  by itself whenever that variable exists on the project. A missing or blank secret authorizes
  **nobody** — the other reading turns a forgotten environment variable into a public endpoint
  that spends the day's allowance for whoever finds the URL. Same lesson as CVE-2025-29927: the
  check lives in the handler, not in `src/proxy.ts`, which does not cover `/api/*` anyway.
- **No keys, no work.** `isEbayConfigured()` false → `200 {"skipped":"ebay-not-configured"}`
  without touching the database, so a deployment with prices switched off does not have a cron
  job that fails every morning at six.
- **It reports counts and never listings.** The URL is reachable from the internet with the
  right header; a price feed is not what a cron log is for.
- **The shelf, not the catalog.** `listRefreshTargets()` joins `owned_figures` INNER, so the
  232 wishlist figures are never swept — a wishlist chip is still only ever a figure page's
  leftovers. Every status is swept, `not_mine_anymore` included: those figures still have
  pages, and the FINANCES rules about who counts live in `countsTowardValue()`, not here.
- **A 50-second budget** inside a 60-second `maxDuration`. Nineteen figures at eBay's 5-second
  ceiling is 95 seconds in the worst imaginable case, and a function killed at its limit
  reports nothing at all — not even the figures it did refresh, which are written one at a
  time as they arrive.

### FINANCES on `/stats`

`src/lib/finances.ts` is pure arithmetic over the same `PublicShelfEntry[]` every other view
of the collection uses, plus the snapshots. Three claims it has to be able to defend:

- **only `status = 'mine'` counts** — a figure that left the shelf keeps its card, its story
  and its place in the counters, but it is not part of what the shelf is worth today. Neither
  is a row with no status: that is a half-finished quick-add. (Deliberately stricter than
  `catalog_with_ownership.owned_count`, which does count a NULL status — that view answers
  "is it collected", this answers "what is on the shelf".)
- **quantity multiplies** — two boxes of #1450 are one card and one price, and two boxes'
  worth of money;
- **one currency, never averaged**, and figures with no snapshot are excluded from the total
  and surfaced as coverage (`PRICED: 15 / 15`) rather than counted as free.

Zero priced figures renders **nothing at all** — the same invisibility rule MARKET SIGNAL
follows, for the same reason: `TOTAL VAULT VALUE: $0` is worse than silence.

## SEO and social previews (Phase 12)

Three new files, and their rendering modes as `next build` reports them:

| Route              | File                          | Mode      |
| ------------------ | ----------------------------- | --------- |
| `/opengraph-image` | `src/app/opengraph-image.tsx` | ○ static  |
| `/robots.txt`      | `src/app/robots.ts`           | ○ static  |
| `/sitemap.xml`     | `src/app/sitemap.ts`          | ƒ dynamic |

**The OG image is static on purpose**: no DB, no session, no `searchParams`, so Next
prerenders it once and serves a file. A link pasted into a group chat is fetched by half a
dozen crawlers at once and none of them should be able to wake up Railway. Reading the
bundled TTF off disk is the only thing the module does at request time.

**The sitemap must NOT be static**, and that is the same constraint every DB-reading page in
this project lives under: `export const dynamic = "force-dynamic"`, or `next build` would
evaluate it while collecting page data and query Railway from CI, where there is no
`DATABASE_URL`. It also wraps its query in a `try` and degrades to the four static screens —
a sitemap is the least important document the app serves and there is no version of "Railway
is asleep" worth answering with a 500 to Googlebot.

Which URLs are listed: `/`, `/search`, `/wishlist`, `/stats`, plus one entry per **public
shelf** figure (`listPublicShelf()`), `lastModified` from the sighting's own `acquired_at`.
The catalog's other ~228 rows are deliberately absent — `/figure/<slug>` 404s for anything
nobody owns (Phase 4), and wishlist figures are reachable only through `/search?q=<number>`,
which is a query string, not a document.

**`robots.txt` disallows `/admin`, `/api` and `/login` — and that is not a security
measure.** `robots.txt` is a request; the real gate is `requireAdmin()` inside every admin
page, server action and route handler (ADR-005, CVE-2025-29927). What it buys is that a
crawler does not spend its budget on a login form and that the console never surfaces in a
search result. Every admin page also carries `robots: { index: false }` in its own metadata,
which is the half a crawler actually obeys.

**Metadata inheritance, and the trap in it.** The root layout declares `metadataBase`,
`openGraph` (type website, siteName, locale en) and `twitter: summary_large_image` once, and
App Router metadata merges down the tree **per key, not per object**. A page that says nothing
therefore inherits the site's generic `og:title`, which would put `SPIDEY SHELF` on every
shared figure link — so `/figure/[slug]` sets its own `openGraph` in `generateMetadata`. Doing
that costs the inherited `images` along with it: Next attaches `opengraph-image.tsx` to the
whole tree only while a segment leaves the key alone, and the loss is silent, because the page
still renders and the tags are simply absent. The figure page names the card back from
`OG_IMAGE` in `src/lib/site.ts`, the same constant the image route re-exports its `alt` and
`size` from, so the declared 1200×630 is the 1200×630 Satori draws.

`metadataBase` is what makes any of this fetchable. Without it Next emits `og:image` as a
path, and a crawler has no page context to resolve one with — the preview then renders as
grey text, which is exactly the bug this phase was opened for.

## External data sources

| Source                                                | Role                                                 | Status                                     |
| ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| pops.today                                            | catalog + UPC + box art (27k pops, 418 spider pages) | permission email sent 2026-08-06, no reply |
| UploadThing (free 2 GB)                               | where the owner's own box-art uploads live           | **live (phase 9)** — ADR-011, 0 files yet  |
| Checklist sites (funkypriceguide 117, Pop Shop Guide) | plan-B catalog seed                                  | **seeded (plan B)** — 240 rows, ADR-008    |
| UPCitemdb (free 100 req/day)                          | scan-time UPC fallback                               | **live (phase 7)** — 1 call/scan, no key   |
| eBay Browse API (free 5k req/day)                     | live prices                                          | **live** — nightly cron since phase 11     |
| Natural Earth 110m land (CC0)                         | the SIGHTINGS MAP's landmass                         | **vendored (phase 8)** — derived once      |
| hobbyDB / Funko official                              | —                                                    | ruled out (ToS / no API)                   |

## Catalog seed

`data/catalog/*.csv` (247 rows — 240 Spider-Man + 7 owner-owned others, facts and a
`source_url` each) is the reviewable input; `npm run db:seed` parses every file as one
catalog with the strict RFC 4180 reader in `src/lib/csv.ts`, computes the `slug` in
`src/lib/catalog.ts` and upserts `reference_figures` on that slug. The seeder never deletes
and never touches `image_path`, `upc` or `is_vaulted`, so re-running it is safe once later
phases start filling those in — which is what makes a scanned barcode (ADR-010) and an
owner-uploaded box art (ADR-011) survive a re-seed. No box art is fetched — see ADR-008.

## Collection seed and admin CRUD

`data/collection/owned.csv` (19 rows from the owner's Notion) → `npm run db:seed:owned` →
`owned_figures`. Each row is resolved to a catalog figure by `pop_number` + a fuzzy name
match (`src/lib/collection.ts`, pure and unit-tested); an unresolved row fails the run rather
than land as a dangling name. Idempotency key: `reference_figure_id + acquired_at`.

The same data is editable at `/admin/collection` — a server-rendered list with `ALL` /
`NEEDS STORY` filter chips, a **box-art thumbnail per row** (Phase 10, the same `BoxArt` the
public grid uses, so the two can never disagree about a figure's picture), and an edit form.
Adding moved to Quick Add (`/admin/add`) in Phase 6; the client components left in the admin
are the delete confirm, the scanner and the upload panel. Every server
action calls `requireAdmin()` before it touches a row — `src/proxy.ts` is an optimistic
redirect and CVE-2025-29927 showed a proxy check can be skipped outright, so the check inside
the action is the real gate, and `src/app/admin/add/actions.test.ts` asserts that each of the
three Quick Add writes performs it _before_ the first insert or update.
