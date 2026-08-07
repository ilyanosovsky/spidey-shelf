# Data Model

> Ground rule: **`pop_number` is NOT unique** — Funko reuses numbers across product lines and
> variants (chase/GITD/metallic) share the base number. `slug` is the natural key.

Live definition: `src/db/schema.ts` + `drizzle/`. Column names below are the snake_case SQL
names; Drizzle exposes them camelCased.

## reference_figures — catalog of everything that exists

| Column                  | Type                 | Notes                                      |
| ----------------------- | -------------------- | ------------------------------------------ |
| id                      | uuid pk              | `gen_random_uuid()`                        |
| slug                    | text unique not null | e.g. `marvel-spider-man-last-stand-1450`   |
| pop_number              | int, indexed         | NOT unique                                 |
| name                    | text not null        |                                            |
| character               | text                 | Spider-Man / Miles Morales / Spider-Gwen … |
| category                | text not null, idx   | taxonomy bucket, CHECKed — see below       |
| product_line            | text                 | e.g. `Pop! Marvel: No Way Home`            |
| release_year            | int                  |                                            |
| exclusivity             | text                 | Common / Walgreens / SDCC…                 |
| variant_flags           | text[]               | chase, glow, metallic, flocked, 10inch…    |
| is_vaulted              | bool                 |                                            |
| upc                     | text, indexed        | scanner target; exclusives may share it    |
| image_path              | text                 | 800×800 WebP — see below                   |
| counts_toward_total     | bool default true    | THE stats denominator switch               |
| source, source_url      | text                 | provenance per row                         |
| needs_review            | bool default false   | seed triage                                |
| review_note             | text                 | WHY a machine flagged it (Phase 7)         |
| search_vector           | tsvector generated   | name + character + product_line            |
| created_at / updated_at | timestamptz          |                                            |

Indexes: unique on `slug`; btree on `pop_number`, `upc` and `category`; GIN on
`search_vector`; GIN `gin_trgm_ops` on `name` (fuzzy search, needs the `pg_trgm` extension).

`search_vector` is a **stored generated** column, weighted `name` (A) > `character` (B) >
`product_line` (C), built with the `simple` text-search config — character names are proper
nouns, so English stemming would only mangle them.

### category — the taxonomy (ADR-009)

| Value          | UI label         | What lands in it                                                   |
| -------------- | ---------------- | ------------------------------------------------------------------ |
| `peter`        | `PETER PARKER`   | Peter's own Spider-Man (and unmasked Peter) — **the denominator**  |
| `spider_verse` | `SPIDER-VERSE`   | every other web-slinger: Miles, Gwen, Spider-Ham, Mayday, 2099 …   |
| `friends_foes` | `FRIENDS & FOES` | the people around him: Venom, Doc Ock, MJ, Aunt May, Deadpool …    |
| `other`        | `OTHER`          | outside Spider-Man entirely (the owner's Stitches, Harry Potter …) |

`text` + a `CHECK` constraint, not a Postgres enum: adding a fifth bucket is then an ALTER of
one constraint instead of an enum type change that cannot be undone in a transaction. The
column is `NOT NULL DEFAULT 'other'` — the default is for rows written by the admin UI; the
seeder refuses a CSV row with a blank category rather than silently bucket it.

**The invariant:** `counts_toward_total = (category = 'peter')`. It is what makes the LCD
counter honest — "11 / 120 PETER PARKER COLLECTED" counts the same figures the tab does.
Enforced by the CSV (a test asserts it over both files) rather than by a DB constraint, so a
future one-off exception stays possible without a migration. Live today: 120 `peter`,
60 `spider_verse`, 62 `friends_foes`, 5 `other` = 247 rows.

The labels above are the single source of UI copy, exported from `src/lib/categories.ts`
(`FIGURE_CATEGORY_LABELS`) — see Design-System.md.

### image_path — where a figure's picture is (Phase 9)

**Absolute URL, not a bucket key.** Today the only thing that writes it is the owner's own
upload (ADR-011), so the value is an UploadThing CDN URL:
`https://si4zn51deh.ufs.sh/f/<FILE_KEY>`. Storing the whole URL rather than a key is what
lets the column survive the plan changing: a future pops.today pipeline (ADR-004) can put a
relative bucket path in the same column, and `isRemoteImagePath()` is the one function that
tells the two apart. Anything that is not an absolute `https://` URL renders as the drawn
pixel spider instead of as a broken image.

- **NULL on all 247 rows today.** ADR-008 seeded facts, not pictures, and the owner has not
  uploaded any yet. NULL is not an error state — `PixelSpiderArt` is a deliberate look, and
  it is also the `onError` fallback when a stored URL stops resolving.
- **One file per figure, ever.** Replacing the art writes the new URL and then deletes the
  superseded file from UploadThing (`replacedFileKey()` parses its key back out of the old
  URL). In that order: an orphaned 150 KB file is a better failure than a figure pointing at
  a 404.
- **The art belongs to the CATALOG row, not to a sighting.** Two copies of #1450 on the shelf
  are one box, so the upload panel lives on the edit screen but writes
  `reference_figures`, and every `owned_figures` row pointing at that figure shows the same
  picture. This is also why there is no photo table — a personal-photos table can still be
  added later without touching any of it.
- **The seeder never writes it on update**, so a re-seed of the CSV cannot wipe an upload —
  the same guarantee `upc` and `is_vaulted` have.
- **It is a public column.** Unlike `needs_review`, `source`, `source_url` and `review_note`,
  `image_path` is selected by the public queries and exposed on `catalog_with_ownership`:
  the picture is the one catalog field a visitor came to look at.

### upc and review_note — what the scanner writes (Phase 7)

`upc` shipped empty: the checklist sources the catalog was seeded from (ADR-008) carry pop
numbers and names, not barcodes, so **all 247 rows had `upc IS NULL`** the day the scanner
landed. It is filled by use, one confirmed scan at a time — ADR-010, and the UPC backfill
loop in [[Architecture]].

- **Stored form: EAN-13, thirteen digits.** A UPC-A is the same code with a leading `0`, so
  one canonical spelling in the column keeps comparisons honest. Lookups still ask about
  **both** spellings (`upcLookupForms()`), because a row filled by hand may hold either.
- **Never overwritten.** A scan that reads a different code onto a row that already carries
  one sets `needs_review = true` and writes both codes into `review_note` instead. Funko
  exclusives genuinely share a UPC (ADR-006), so a second code is evidence of ambiguity, not
  a correction — and trading a hand-checked fact for a camera's guess is not an upgrade.
- **`review_note` is admin-only**, exactly like `needs_review`, `source` and `source_url`:
  `catalog_with_ownership` names its columns explicitly and does not select it, so no public
  query can reach it. Added by `drizzle/0003_review_note.sql` (additive, idempotent, view
  untouched).
- The seeder still never writes `upc` on update, so backfilled codes survive a re-seed.

### How the catalog is filled (Phase 2 · Phase 3)

Every `data/catalog/*.csv` → `npm run db:seed` → `reference_figures`. Two files:

- **`spiderman.csv`** — the 240-row curated Spider-Man catalog (ADR-008).
- **`others-manual.csv`** — 7 rows for the non-Spider-Man figures the owner actually owns,
  so his shelf points at real catalog rows instead of free text. All 7 are
  `counts_toward_total = false`.

They are parsed as **one catalog with one slug namespace**, in that order, so the Spider-Man
rows keep the slugs they were seeded with in Phase 2 and no `owned_figures` FK is orphaned.

What the seeder does with each column:

- **`slug`** is computed, never authored: `figureSlug(product_line, name, pop_number)`, and if
  that is already claimed by an earlier row, the row falls through a fixed ladder — variant
  flags, then exclusivity, then a `-2` tail. Suffix parts already spelled out in the base are
  skipped, so `Spider-Man Metallic` #15 becomes
  `pop-marvel-spider-man-metallic-15-sdcc-2012`, not `…-metallic-metallic`. First row in the
  file to claim a slug keeps it, so appending rows never rewrites an existing figure's URL.
- **`variant_flags`** is the CSV's pipe-list (`chase|glow`) split into `text[]`; a figure with
  no flags gets `{}`, not NULL, so queries need no null guard.
- **`image_path` stays NULL** for every seeded row — the seed has no rights to any box art
  (ADR-008), and the pictures now arrive one at a time from the owner instead (ADR-011).
- **`upc`, `is_vaulted` and `image_path` are never written by the seeder on update**, so
  values added by later phases survive a re-seed.
- The CSV's `notes` column is triage prose (which checklist corroborated the row) and has no
  database column — it stays in the file for the human review pass.
- The seeder **never deletes**: dropping a row from the CSV leaves the figure in the database,
  because `owned_figures` may point at it.

## owned_figures — the collection + acquisition story

| Column                           | Type                  | Notes                                               |
| -------------------------------- | --------------------- | --------------------------------------------------- |
| id                               | uuid pk               |                                                     |
| reference_figure_id              | uuid fk, **nullable** | figure can be added before it's catalogued          |
| custom_name / custom_number      | text / int            | used only when reference is null                    |
| status                           | text                  | `mine` / `not_mine_anymore` (from Notion semantics) |
| quantity                         | int default 1         |                                                     |
| is_public                        | bool default true     | stage before revealing                              |
| is_favorite                      | bool default false    |                                                     |
| acquired_at                      | date                  |                                                     |
| acquired_city / acquired_country | text / char(2)        | travel log                                          |
| acquired_lat / acquired_lng      | numeric               | future travel map                                   |
| acquisition_type                 | text                  | bought / gift / trade                               |
| gifted_by                        | text                  |                                                     |
| story_title / story              | text                  | markdown                                            |
| needs_story                      | bool default false    | "write it later" queue                              |
| created_at / updated_at          | timestamptz           |                                                     |

`acquired_country` is `varchar(2)` (Postgres `char(2)` blank-pads, which bites on
comparisons). The FK is `ON DELETE SET NULL` — deleting a catalog row must never delete the
memory of owning the figure. Indexes: `reference_figure_id` (the view's join) and
`created_at` (the "new sightings" ribbon).

### `acquired_lat` / `acquired_lng` are unused, and stay that way for now (Phase 8)

Both columns are **NULL on all 19 rows** and the SIGHTINGS MAP does not read them. The map's
coordinates come from `src/lib/geo.ts`, a dictionary of the nine cities this collection came
from, keyed `<alpha-2>:<normalised city>`. The dictionary wins on three counts:

- **Retroactive.** It places every row that already exists, with no backfill pass over
  hand-typed city names from a Notion export.
- **No migration, no new failure mode.** A city it has never heard of becomes an
  `UNCHARTED SECTORS` line under the map — the figure is named and its place printed — rather
  than a NULL that has to be handled at three call sites.
- **The admin flow is unchanged.** Quick Add stays "date, city, country, done". Filling these
  columns honestly would mean a geocoder between the owner and a saved sighting, on a phone, in
  a shop — the exact latency Phase 6 was designed to remove.

The columns are kept rather than dropped: if per-figure precision ever matters (two shops in one
city, or a figure bought at an airport rather than in the city it is filed under), they become
the source and the dictionary becomes the fallback. Nothing is lost by waiting, and a column
nobody writes costs 8 bytes of NULL bitmap. See [[Architecture]] for the map itself.

No photo table: box art lives on the catalog row (`image_path` — see above). A
personal-photos table can be added later without breaking anything.

### How the shelf is filled (Phase 3)

`data/collection/owned.csv` → `npm run db:seed:owned` → `owned_figures`. 19 rows transcribed
from the owner's Notion table, so the collection can be rebuilt from the repo instead of
retyped. Run it **after** `npm run db:seed`.

- **Matching**: each row is resolved to a catalog figure by exact `pop_number`, then by name.
  `pop_number` is not unique (#3 alone has four Spider-Man variants), so the number narrows
  and the name decides: exact-after-normalization wins; word order does not matter
  (`Deadpool Sleepover` = `Sleepover Deadpool`); containment scores high but never top. A
  number with a single candidate is taken as-is. A tie is a **miss, not a coin flip**.
- **The seeder hard-fails** and lists every unresolved row rather than write a shelf with
  dangling names — all 19 must resolve, which is why `others-manual.csv` exists.
- **Idempotency key**: `(reference_figure_id, acquired_at)`. Re-running updates in place;
  the second run reports `0 inserted, 19 updated` and the row count does not move. The same
  key backs the admin's "ALREADY IN THE VAULT" duplicate guard.
- **`acquisition_type` is left NULL** — the Notion export does not say bought vs gifted, and
  inventing "bought" would be a lie in the data. `is_public` is `true` for all 19.
- The seeder **never deletes**: rows added through the admin are untouched, and dropping a
  line from the CSV leaves the figure (and its story) in the database.

Live today: 19 rows — 15 `mine`, 4 `not_mine_anymore`, 0 without a catalog row; by category
11 `peter`, 1 `spider_verse`, 2 `friends_foes`, 5 `other`.

## price_snapshots — what eBay said, last time anyone looked (Phase 8)

| Column              | Type                         | Notes                                 |
| ------------------- | ---------------------------- | ------------------------------------- |
| id                  | uuid pk                      |                                       |
| reference_figure_id | uuid fk **unique**, not null | `ON DELETE CASCADE`                   |
| currency            | varchar(3) not null          | ISO 4217, uppercase                   |
| min_cents           | int                          | cheapest active listing in the sample |
| median_cents        | int                          | the headline number                   |
| listing_count       | int not null default 0       | how many listings the median covers   |
| fetched_at          | timestamptz not null         | the TTL is measured from here         |

Added by `drizzle/0004_price_snapshots.sql` (applied to the live database; 0 rows, because the
owner has no eBay keys yet). Index on `fetched_at`, which is what the wishlist's "fresh
snapshots only" read filters on.

- **It is a cache, and it is the only table here that is.** `TRUNCATE price_snapshots` loses
  nothing the collection is about, which is exactly why it is the only table with
  `ON DELETE CASCADE`: a figure's prices are meaningless without the figure, unlike
  `owned_figures`, where the memory of owning something outlives the catalog row
  (`ON DELETE SET NULL`).
- **One row per figure, ever.** The unique constraint on `reference_figure_id` is what makes
  the write an `INSERT … ON CONFLICT DO UPDATE` instead of an insert plus a cleanup job.
- **Money is integer cents, never a float.** `12.99` has no exact binary representation, and a
  market signal that drifts by a cent per round trip is a bug report waiting to happen.
- **`varchar(3)`, not `char(3)`** — the same lesson as `acquired_country`: Postgres' `char`
  blank-pads, and the padding bites on every comparison.
- **TTL is 24 hours**, applied both in SQL (the wishlist read) and in TypeScript
  (`isSnapshotFresh()`, which is where the rule is written down and tested). Funko prices move
  on release news and conventions, not on the hour.

## View: catalog_with_ownership

`reference_figures LEFT JOIN owned_figures` → every catalog column plus `is_owned` (bool),
`owned_count` (int) and `first_owned_at` (timestamptz).

- Powers public search verdicts AND stats from one definition.
- Its `is_owned = false` rows ARE the wishlist — no extra table.
- Because `owned_count` excludes `not_mine_anymore`, the view alone cannot tell "he never
  had it" from "he had it once". Public search adds that second signal itself, as an
  `exists()` over the public shelf rows (`src/lib/catalog-queries.ts`) — which is what turns
  a coral `NOT OWNED YET` into `NOT OWNED · was in the collection once`.
- `owned_count` is `SUM(quantity)` over the matching owned rows; rows whose `status` is
  `not_mine_anymore` are excluded, a NULL `status` still counts (a half-finished quick-add
  must not make a figure vanish from the collection).
- `first_owned_at` = `MIN(owned_figures.created_at)` — when it was added to the **site**,
  not `acquired_at` (when it was bought). Backfilled old figures are still "new" to
  visitors, which is what the "new sightings" ribbon orders by.
- Created in `drizzle/0001_search_vector_and_view.sql` and declared in `src/db/schema.ts`
  as an `.existing()` view so queries are typed without drizzle-kit owning its DDL.
- **`category` was added to it in `drizzle/0002_category_taxonomy.sql`**, so the public tabs
  and the admin console can filter and count buckets straight off the view. Changing the
  view's column list is always a hand-written migration: `CREATE OR REPLACE VIEW` can only
  append columns at the end, so 0002 does `DROP VIEW` + `CREATE VIEW` to keep `category`
  next to `character`. Nothing else depends on the view (no materialized view, no grants
  beyond the owner role), which is what makes the drop safe.
