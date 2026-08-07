# 🕷️ SPIDEY SHELF

A personal Funko Pop collection tracker, scoped to Spider-Man, built as a public read-only
showcase with a single-admin back office.

It exists to answer one question, fast, from a phone: **"does Ilya already own this one?"** A
friend is standing in a shop with a box in his hand, types the number printed on it, and gets
a stamped verdict — OWNED, NOT OWNED YET, or NOT OWNED · was in the collection once. No
account, no app, no message to send.

The look is a pixel handheld gadget: dark navy, Press Start 2P labels, LCD counters, toothed
plaques, hard 2px shadows. Dark theme only, on purpose.

---

## What it does

| Feature                    | What it actually is                                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The shelf** (`/`)        | every figure the owner has, newest sighting first, with `?cat=` tabs over four buckets and an LCD `11 / 120 PETER PARKER COLLECTED` counter that is computed, never a constant                                                                                                              |
| **Gift check** (`/search`) | one GET form, no client JavaScript. Digits are an exact `pop_number` match against the whole 247-row catalog (numbers are **not** unique — every variant comes back with its own verdict); words go through Postgres FTS OR'd with a `pg_trgm` fuzzy match, so a typo still finds something |
| **Wishlist**               | the `owned_count = 0` half of one database view. No second table, no flag to keep in sync                                                                                                                                                                                                   |
| **Sighting log**           | `/figure/<slug>` — where and when each figure was picked up, and the story behind it                                                                                                                                                                                                        |
| **Stats**                  | owned/total per bucket, a spider-web radar, an acquisition timeline, and a **sightings map** of the cities the collection came from — an inline SVG over public-domain Natural Earth data, no map library and no tiles                                                                      |
| **Quick Add** (admin)      | search or scan → confirm the variant → date, city, story. Six frames on one route, `?step=` deciding which, and no client JavaScript except the camera                                                                                                                                      |
| **Barcode scanner**        | zxing-wasm in the browser. The catalog shipped with **zero** barcodes, so a scan is not a lookup but an enrichment loop: catalog → one UPCitemdb call → a guess → the owner confirms → the code is written onto that row, and the next scan of that box is free                             |
| **Box art**                | a deterministic pixel spider per figure by default; the owner can upload real box art per figure, normalized in the browser to 800×800 WebP so the grid keeps one look                                                                                                                      |
| **PWA**                    | manifest, real pixel-spider icons, `appleWebApp` so Add to Home Screen produces an app rather than a bookmark                                                                                                                                                                               |
| **eBay prices**            | a MARKET SIGNAL panel per figure — `~$median · N listings` from live eBay Browse data, cached per figure in Postgres, with an honest "active listings, not sold prices" fine print. Keys-optional: a deployment without eBay credentials renders nothing and calls nothing                  |
| **Finances**               | what the shelf is worth: a FINANCES block on `/stats` (total, dearest, cheapest, and how many figures the total actually covers) and a `~$24` chip per shelf card. **No page ever fetches a price** — a nightly Vercel cron refreshes the cache, and every page reads it and stops          |

## Stack

- **Next.js 16** (App Router, TypeScript, React 19) on **Vercel Hobby**
- **Postgres on Railway** via **Drizzle ORM** — one always-on instance inside the free credit
- **Tailwind v4**, tokens straight from the design brief
- Auth: hand-rolled single admin — a `jose`-signed httpOnly cookie plus a bcrypt hash in env.
  No auth library: there is exactly one permanent user, and both Auth.js and better-auth are
  over-provisioned for that
- **UploadThing** for the owner's box-art uploads
- **Vitest** + Testing Library — 641 tests, all colocated next to their source

Every page that reads the database is `export const dynamic = "force-dynamic"`. That is a rule
rather than a preference: a prerendered page still queries during `next build`, and CI has no
`DATABASE_URL`.

## Design

The source of truth is the brief and the mockups, not screenshots in this file:

- **[`docs/design/spidey-collection-design-brief.md`](docs/design/spidey-collection-design-brief.md)**
  — palette, typography, component language, screen-by-screen intent (written in Russian)
- **`docs/design/mockups/`** — the Claude Design export the components were built from
- **[docs/wiki/Design-System.md](docs/wiki/Design-System.md)** — what actually got built:
  every component, its props, the wording tables, and a measured contrast audit

The visual reference is Ned's "Spidey Tracker" from _Spider-Man: Brand New Day_ — **inspired
by, never copied**. No Marvel or Sony assets are used anywhere in this repo.

## Running it locally

```bash
npm i
cp .env.example .env      # fill it in — see the table below
npm run db:migrate        # apply migrations to your database
npm run db:seed           # 247 catalog rows from data/catalog/*.csv
npm run db:seed:owned     # 19 shelf rows from data/collection/owned.csv
npm run dev
```

### Environment

| Var                                     | Needed for      | Notes                                                                                                                                                                                    |
| --------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | everything      | Railway's **public** URL (`*.proxy.rlwy.net`) — the internal host resolves only inside Railway                                                                                           |
| `SESSION_SECRET`                        | admin login     | `openssl rand -base64 32`                                                                                                                                                                |
| `ADMIN_PASSWORD_HASH`                   | admin login     | `node scripts/hash-password.mjs 'your password'`. **Escape every `$` as `\$` in `.env`** — Next.js parses env files with dotenv-expand and silently eats most of a bcrypt hash otherwise |
| `UPLOADTHING_TOKEN`                     | box-art uploads | the **v7** token. `UPLOADTHING_SECRET` is v6 and is not read by anything                                                                                                                 |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | live prices     | optional, both or neither. Blank ⇒ the feature does not exist at runtime                                                                                                                 |
| `CRON_SECRET`                           | the price sweep | `openssl rand -base64 32`. Vercel attaches it to the scheduled call by itself; blank or missing ⇒ the endpoint answers 401 to everybody, which is the safe direction                     |

Full details, the runbook and the per-service gotchas: **[docs/wiki/Environment.md](docs/wiki/Environment.md)**.

### Scripts

| Command                  | What it does                                                      |
| ------------------------ | ----------------------------------------------------------------- |
| `npm run dev`            | dev server                                                        |
| `npm run test -- --run`  | the whole suite once                                              |
| `npm run lint`           | ESLint                                                            |
| `npm run typecheck`      | `tsc --noEmit`                                                    |
| `npm run format:check`   | Prettier                                                          |
| `npm run build`          | production build                                                  |
| `npm run db:generate`    | schema diff → a new SQL migration                                 |
| `npm run db:migrate`     | apply pending migrations                                          |
| `npm run db:seed`        | upsert `data/catalog/*.csv` into the catalog (safe to re-run)     |
| `npm run db:seed:owned`  | upsert `data/collection/owned.csv` into the shelf — run it second |
| `./scripts/backup-db.sh` | `pg_dump --format=custom` (Railway's native backups are Pro-only) |

> Never run `drizzle-kit push`. Three things live in hand-written SQL that it cannot model —
> a generated `tsvector` column, a `gin_trgm_ops` index and the `catalog_with_ownership` view
> — and push would happily drop all three.

## Testing and CI

Tests sit next to the code they test (`*.test.ts(x)`). Pure logic is covered properly — slug
generation, search-query parsing, verdicts, stats maths, crop geometry, UPC check digits, map
projection; server actions are covered with a mocked session and database; components get
smoke tests. **CI runs with no database at all** — that is why the mocked-db seam exists.

GitHub Actions runs lint, `format:check`, typecheck, Vitest and a full build on every PR.
Everything lands through a PR from a feature branch; `main` is protected.

## Docs

`docs/wiki/` is the reviewable source of truth and mirrors to the [GitHub Wiki](../../wiki)
on merge.

- **[Architecture](docs/wiki/Architecture.md)** — hosting, rendering strategy, the scanner's
  enrichment loop, the sightings map, the box-art story
- **[Data-Model](docs/wiki/Data-Model.md)** — every table and column, and why it is shaped
  that way
- **[Decisions](docs/wiki/Decisions.md)** — the ADR log, append-only. Start here if you want
  to know why something is the way it is
- **[Design-System](docs/wiki/Design-System.md)** · **[Environment](docs/wiki/Environment.md)**
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** — the single source of progress truth,
  updated in every PR, with a dated log of what was actually verified
- **[CLAUDE.md](CLAUDE.md)** — the working agreement for AI agents on this repo

## About the data, honestly

**The catalog is our own compilation of facts, not a scrape.** There is no public Funko API
(hobbyDB's is partner-only and its ToS bans scraping; `api.funko.com` returns 502), so
`data/catalog/*.csv` was hand-curated from public checklists: a pop number, a name, a product
line, a release year, an exclusivity label, and a `source_url` on **every row**. No
descriptions, no editorial text, no prices, no images were copied. The selection, the category
calls and the review triage are ours, and the CSVs are in the repo so all of that is
reviewable rather than asserted. See **ADR-008** in the decision log.

**Images are rights-aware.** Box art is protected expression, so none is bundled or fetched:
`image_path` ships NULL and the site draws a pixel spider instead. The only real images are
ones the owner uploads himself, one figure at a time (**ADR-011**). A request for permission
to use a licensed image source was sent on 2026-08-06 and has not been answered; if it ever
is, the same column takes the result and nothing else changes.

**Not affiliated with Funko, Marvel or Sony.** Spider-Man and all related characters are their
owners'. This is a non-commercial personal project about a shelf in someone's flat.

## License

[MIT](LICENSE). The code is free to use; the catalog CSV is a hand-curated, facts-only
compilation with per-row source attribution, and box-art images are the owner's uploads —
neither carries Marvel/Sony/Funko assets from this repo.
