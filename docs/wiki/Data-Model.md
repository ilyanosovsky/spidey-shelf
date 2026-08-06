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
| product_line            | text                 | e.g. `Pop! Marvel: No Way Home`            |
| release_year            | int                  |                                            |
| exclusivity             | text                 | Common / Walgreens / SDCC…                 |
| variant_flags           | text[]               | chase, glow, metallic, flocked, 10inch…    |
| is_vaulted              | bool                 |                                            |
| upc                     | text, indexed        | scanner target; exclusives may share it    |
| image_path              | text                 | normalized 800×800 WebP in bucket          |
| counts_toward_total     | bool default true    | THE stats denominator switch               |
| source, source_url      | text                 | provenance per row                         |
| needs_review            | bool default false   | seed triage                                |
| search_vector           | tsvector generated   | name + character + product_line            |
| created_at / updated_at | timestamptz          |                                            |

Indexes: unique on `slug`; btree on `pop_number` and `upc`; GIN on `search_vector`; GIN
`gin_trgm_ops` on `name` (fuzzy search, needs the `pg_trgm` extension).

`search_vector` is a **stored generated** column, weighted `name` (A) > `character` (B) >
`product_line` (C), built with the `simple` text-search config — character names are proper
nouns, so English stemming would only mangle them.

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

No photo table: box art lives on the catalog row (`image_path`). A personal-photos table can
be added later without breaking anything.

## View: catalog_with_ownership

`reference_figures LEFT JOIN owned_figures` → every catalog column plus `is_owned` (bool),
`owned_count` (int) and `first_owned_at` (timestamptz).

- Powers public search verdicts AND stats from one definition.
- Its `is_owned = false` rows ARE the wishlist — no extra table.
- `owned_count` is `SUM(quantity)` over the matching owned rows; rows whose `status` is
  `not_mine_anymore` are excluded, a NULL `status` still counts (a half-finished quick-add
  must not make a figure vanish from the collection).
- `first_owned_at` = `MIN(owned_figures.created_at)` — when it was added to the **site**,
  not `acquired_at` (when it was bought). Backfilled old figures are still "new" to
  visitors, which is what the "new sightings" ribbon orders by.
- Created in `drizzle/0001_search_vector_and_view.sql` and declared in `src/db/schema.ts`
  as an `.existing()` view so queries are typed without drizzle-kit owning its DDL.
