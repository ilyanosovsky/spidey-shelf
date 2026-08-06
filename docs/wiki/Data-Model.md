# Data Model

> Ground rule: **`pop_number` is NOT unique** — Funko reuses numbers across product lines and
> variants (chase/GITD/metallic) share the base number. `slug` is the natural key.

## reference_figures — catalog of everything that exists

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| slug | text unique not null | e.g. `marvel-spider-man-last-stand-1450` |
| pop_number | int, indexed | NOT unique |
| name | text not null | |
| character | text | Spider-Man / Miles Morales / Spider-Gwen … |
| product_line | text | e.g. `Pop! Marvel: No Way Home` |
| release_year | int | |
| exclusivity | text | Common / Walgreens / SDCC… |
| variant_flags | text[] | chase, glow, metallic, flocked, 10inch… |
| is_vaulted | bool | |
| upc | text, indexed | scanner target; exclusives may share it |
| image_path | text | normalized 800×800 WebP in bucket |
| counts_toward_total | bool default true | THE stats denominator switch |
| source, source_url | text | provenance per row |
| needs_review | bool default false | seed triage |
| search_vector | tsvector generated | name + character + product_line |
| created_at / updated_at | timestamptz | |

Indexes: `pop_number`; GIN on `search_vector`; GIN `gin_trgm_ops` on `name` (fuzzy search).

## owned_figures — the collection + acquisition story

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| reference_figure_id | uuid fk, **nullable** | figure can be added before it's catalogued |
| custom_name / custom_number | text / int | used only when reference is null |
| status | text | `mine` / `not_mine_anymore` (from Notion semantics) |
| quantity | int default 1 | |
| is_public | bool default true | stage before revealing |
| is_favorite | bool default false | |
| acquired_at | date | |
| acquired_city / acquired_country | text / char(2) | travel log |
| acquired_lat / acquired_lng | numeric | future travel map |
| acquisition_type | text | bought / gift / trade |
| gifted_by | text | |
| story_title / story | text | markdown |
| needs_story | bool default false | "write it later" queue |
| created_at / updated_at | timestamptz | |

No photo table: box art lives on the catalog row (`image_path`). A personal-photos table can
be added later without breaking anything.

## View: catalog_with_ownership

`reference_figures LEFT JOIN owned_figures` → `is_owned`, `owned_count`.

- Powers public search verdicts AND stats from one definition.
- Its NULL rows (not owned) ARE the wishlist — no extra table.
- "New sightings" ribbon orders by `owned_figures.created_at` (when it was added to the
  site), not `acquired_at` (when it was bought) — backfilled old figures are still "new"
  to visitors.
