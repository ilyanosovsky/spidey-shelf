# Environment & Runbook

## Env vars

`.env.example` in the repo lists all of them. Never commit real values.

### Needed from Phase 1

| Var                   | What                                                                      | Where to set                                 |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`        | Railway Postgres connection string (public URL)                           | local `.env` · Vercel (Production + Preview) |
| `SESSION_SECRET`      | ≥32 random bytes for signing the admin cookie (`openssl rand -base64 32`) | local `.env` · Vercel                        |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (never the password itself)             | local `.env` · Vercel                        |

> **`DATABASE_URL` must be the _public_ url.** Railway's service variables ship the
> internal one (`postgres.railway.internal`), which only resolves inside Railway's private
> network — from a laptop or from Vercel it fails with `ENOTFOUND`. Take the value Railway
> labels `DATABASE_PUBLIC_URL` (host ends in `.proxy.rlwy.net`).

> **Escape `$` in `ADMIN_PASSWORD_HASH` inside `.env`.** Next.js parses env files with
> dotenv-expand, so an unescaped `$2b$12$…` is read as variable references and most of the
> hash disappears — quoting does not help, `\$` does:
> `ADMIN_PASSWORD_HASH=\$2b\$12\$abc…`. The login action logs a specific error when the
> hash does not look like bcrypt, instead of silently answering `ACCESS DENIED`. Values
> pasted into the Vercel dashboard need no escaping.

### Needed from Phase 2 (images)

| Var                                                                      | What                                                                            | Where                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------ |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | object storage for normalized box art (only used by the one-time seed pipeline) | local `.env` (pipeline runs locally) |
| `NEXT_PUBLIC_IMAGE_BASE_URL`                                             | public base URL of the bucket (custom domain)                                   | local · Vercel                       |

If ADR picks Railway Bucket instead of R2, the S3-compatible equivalents replace the `R2_*` set.

### Optional (Phase 8)

| Var                                    | What                          |
| -------------------------------------- | ----------------------------- |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | eBay Browse API (live prices) |

### GitHub Actions secrets

| Secret       | When                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `WIKI_TOKEN` | only if the default `GITHUB_TOKEN` gets 403 pushing to the wiki repo — classic PAT with `repo` scope |

CI runs unit tests without a real database (mocked db); no DB secrets in CI.

## One-time manual steps (owner)

1. **GitHub**: Settings → enable **Wiki**; create any first page via UI (so `.wiki.git` exists).
   Recommended: branch protection on `main` — require PR + the `checks` status.
2. **Railway**: create Postgres service; copy `DATABASE_PUBLIC_URL` into `DATABASE_URL`
   (Vercel connects from outside Railway, so the internal host will not do).
3. **Vercel**: import the GitHub repo (personal account — Hobby can't use org repos);
   add env vars above for Production + Preview.
4. **Secrets hygiene**: generate `SESSION_SECRET` with `openssl rand -base64 32`; generate
   `ADMIN_PASSWORD_HASH` with `node scripts/hash-password.mjs 'your password'`.

## Backups — plan B

Railway's native volume/database backups are a **Pro-plan feature**; this project runs on
Hobby, so the "enable Backups in Railway settings" step from the original plan is not
available. Until Phase 2 brings object storage online, backups are manual dumps:

```bash
./scripts/backup-db.sh              # → backups/spidey-shelf-<utc-timestamp>.dump
pg_restore --clean --if-exists -d "$DATABASE_URL" backups/<file>.dump
```

`backups/` is git-ignored. Phase 2 schedules the same dump into R2 (or the Railway Bucket,
per the storage ADR) so the collection is never one bad migration away from gone.

## Database scripts

| Script                   | What it does                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| `npm run db:generate`    | diffs `src/db/schema.ts` against the last snapshot → new SQL file in `drizzle/` |
| `npm run db:migrate`     | applies pending migrations to `DATABASE_URL`                                    |
| `npm run db:studio`      | opens Drizzle Studio against `DATABASE_URL`                                     |
| `npm run db:seed`        | upserts `data/catalog/spiderman.csv` into `reference_figures` (safe to re-run)  |
| `./scripts/backup-db.sh` | `pg_dump` of the whole database (see above)                                     |

Never run `drizzle-kit push`: it diffs the live database against `schema.ts` and would drop
the generated `search_vector` column, the trigram index and the `catalog_with_ownership`
view, all of which live in the hand-written `drizzle/0001_search_vector_and_view.sql`.
Custom SQL goes into a new file via `npm run db:generate -- --custom --name=<what>`.

## Local dev

```bash
npm i
cp .env.example .env   # fill values (escape `$` in the bcrypt hash)
npm run dev
npm run test -- --run
npm run lint && npm run typecheck
```
