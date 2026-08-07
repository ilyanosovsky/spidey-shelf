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

### Needed from Phase 9 (box art the owner uploads)

| Var                 | What                                                        | Where                 |
| ------------------- | ----------------------------------------------------------- | --------------------- |
| `UPLOADTHING_TOKEN` | the **v7 token** from uploadthing.com → your app → API Keys | local `.env` · Vercel |

**One variable, and it must be the v7 one.** It is a base64 blob carrying the API key, the
app id and the region together, which is why it replaces uploadthing v6's
`UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID` pair on its own. Verified against
`uploadthing@7.7.4`: with only `UPLOADTHING_SECRET` set, `new UTApi()` fails with
`Missing token. Please set the UPLOADTHING_TOKEN environment variable…`. If a
`UPLOADTHING_SECRET` is still lying around in a `.env`, **nothing reads it** — delete it.

> ⚠️ **Add `UPLOADTHING_TOKEN` to Vercel (Production + Preview) and redeploy.** Without it the
> upload route errors and `onUploadComplete` can never write `image_path`; every other part of
> the site is unaffected, so the failure looks like "the upload button does nothing" rather
> than like a missing env var.

No `$`-escaping worry — the token is base64 (alphanumeric plus `=` padding).

The app's CDN host is **pinned in `next.config.ts`** as `si4zn51deh.ufs.sh`, not read from an
env var. The app id is public — it is in the URL of every image the site serves — and pinning
it rather than allowing `*.ufs.sh` keeps `/_next/image` from being an open optimizer proxy for
every UploadThing account on the internet, which on Hobby's 5,000 transformations/month is a
bill somebody else could run up. **If the UploadThing app is ever recreated, that string and
the token change together.**

Budget: the free tier is **2 GB**, and a normalized figure is 100–250 KB — roughly 10,000
figures against a 247-row catalog. Replacing a figure's art deletes the file it replaces, so
the bucket holds at most one file per figure.

### Deferred: the pops.today pipeline (ADR-004)

| Var                                                                      | What                                                               | Where                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------ |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | object storage for a bulk box-art pipeline that does not exist yet | local `.env` (pipeline runs locally) |
| `NEXT_PUBLIC_IMAGE_BASE_URL`                                             | public base URL of that bucket (custom domain)                     | local · Vercel                       |

**Nothing reads these today.** They stay in `.env.example` because the pipeline is still the
plan if image rights are ever cleared (ADR-011 is explicitly an interim); until then, box art
comes from the owner and lives in UploadThing.

### Needed for Phase 7 (scanner): nothing

The barcode scanner adds **no environment variables at all**, and that is worth writing down
rather than leaving as an absence:

- **UPCitemdb's free trial tier takes no key** — no header, no account. The cost of that is
  a hard **100 lookups per day per IP** with no way to raise it, so the budget is defended in
  code instead of in config (one call per scan, no retries, catalog checked first). If the
  ceiling ever starts biting, the paid tier introduces a `user_key`/`key_type` pair and
  `src/lib/barcode/lookup.ts` is the only file that would learn about them.
- **The barcode reader's WebAssembly is a build artifact, not config.**
  `scripts/copy-zxing-wasm.mjs` runs on `postinstall` and `prebuild` and copies
  `zxing-wasm`'s 1.0 MB `zxing_reader.wasm` into `public/barcode/`, which is git-ignored.
  Nothing to set on Vercel; `npm ci` does it. If that copy is ever missing, the scanner says
  `THE CAMERA DID NOT START.` and the typed path still works.
- **The camera needs HTTPS.** `getUserMedia` refuses an insecure context, so the scanner can
  only be exercised on the Vercel preview/production URL, never on `http://localhost:3000`
  from a phone. The overlay detects this and says `THE CAMERA NEEDS HTTPS.` rather than
  hanging.

### Optional (Phase 8): eBay prices

| Var                  | What                                                | Where                 |
| -------------------- | --------------------------------------------------- | --------------------- |
| `EBAY_CLIENT_ID`     | the production keyset's **App ID (Client ID)**      | local `.env` · Vercel |
| `EBAY_CLIENT_SECRET` | the production keyset's **Cert ID (Client Secret)** | local `.env` · Vercel |

**Both or neither.** `isEbayConfigured()` needs the pair; a half-filled dashboard is treated as
unconfigured, and with the feature off **nothing about prices renders, is queried or is
fetched** — no panel on `/figure/[slug]`, no chips on `/wishlist`, no empty state explaining
itself. **Status: the owner's production keyset is configured (local + Vercel) and the client
was live-verified on 2026-08-07** — real OAuth and Browse responses matched the fixtures with
zero parser changes.

#### How to get them

1. Sign in at **developer.ebay.com** with a normal eBay account and join the developer program
   (free; it asks for a name and an email, not a business).
2. **Application Keys** → create an application. Two keysets appear, **Sandbox** and
   **Production**. Take the **Production** one — sandbox has no real listings, so a sandbox
   median is a number about nothing.
3. **The compliance blocker everyone hits**: the app shows as **(Non Compliant)** and the
   production keys stay inert until eBay's "Marketplace Account Deletion" requirement is
   answered. This project persists **no eBay user data** (only per-figure price aggregates),
   so the right answer is the exemption: the keyset's **Alerts & Notifications** tab →
   delivery method **Marketplace Account Deletion** → toggle **"Exempted from Marketplace
   Account Deletion"** ON and confirm. No endpoint, no verification token, no email needed.
   (Verified in practice 2026-08-07 — this was the one non-obvious step.)
4. From that keyset: **App ID (Client ID)** → `EBAY_CLIENT_ID`, **Cert ID (Client Secret)** →
   `EBAY_CLIENT_SECRET`. The Dev ID is not used, and neither is a user token — the Browse
   search this project makes is an _application_ call, so the client-credentials grant with the
   `api_scope` scope is all it needs. Nothing here can act on the owner's eBay account.
5. Add both to local `.env` and to Vercel (Production + Preview), then redeploy. No `$`-escaping
   worry here — unlike the bcrypt hash, eBay keys are alphanumeric with dashes.

> ✅ **Live-shape verification done (2026-08-07).** OAuth client-credentials → 200
> (`Application Access Token`, 7200s), one real `item_summary/search` → 200 with 54 listings,
> both parsed by the existing fixtures-backed parsers with zero changes; `/figure/…-1450`
> then rendered `MARKET SIGNAL ~$16 · 25 LISTINGS` end-to-end and wrote the first
> `price_snapshots` row. If eBay ever changes the shapes, the panel degrades to nothing and
> the fix starts by diffing one real body against `src/lib/ebay/parse.test.ts`.

The free tier is **5,000 Browse calls per day**, and the app is nowhere near it by design: the
cache in `price_snapshots`, one nightly sweep over the 19 owned figures, one attempt with no
retries, and every other page reading the cache without ever being able to fill it. See
[[Architecture]] for the arithmetic.

### Needed from Phase 11 (the nightly price sweep)

| Var           | What                                                           | Where                                       |
| ------------- | -------------------------------------------------------------- | ------------------------------------------- |
| `CRON_SECRET` | the bearer token that authenticates `/api/cron/refresh-prices` | local `.env` ✅ · **Vercel — owner action** |

> ⚠️ **This is the one manual step of Phase 11.** Add `CRON_SECRET` to Vercel (Production —
> Preview too if you want to test it there) and redeploy. **Vercel attaches it by itself**:
> whenever that variable exists on the project, every scheduled invocation carries
> `Authorization: Bearer $CRON_SECRET`, so there is nothing to configure on the cron side and
> no header to set by hand. Until it is set on Vercel, the schedule fires and the endpoint
> answers **401** — prices simply stop being refreshed in production; nothing else on the site
> is affected, which is exactly why this failure is easy to miss.

Generate one the same way as the session secret: `openssl rand -base64 32`. It is alphanumeric
plus `+/=`, so no `$`-escaping worry. It is already in local `.env`, which is what let the
cache be seeded by hand before the first scheduled run.

**The schedule lives in `vercel.json`**, not in the dashboard:

```json
{ "crons": [{ "path": "/api/cron/refresh-prices", "schedule": "0 6 * * *" }] }
```

Two things about that file are worth knowing before it gets edited:

- **Hobby allows daily crons only** (one run per job per day, and a small number of jobs). A
  finer schedule is rejected at deploy time, not at run time.
- **The hour is a request, not a promise.** Vercel runs a Hobby cron somewhere inside a
  **one-hour window** after the scheduled time, so consecutive runs can be 25 hours apart. The
  two TTLs either side of 24 hours (`PRICE_REFRESH_AFTER_MS` 12h, `PRICE_DISPLAY_TTL_MS` 48h)
  exist to absorb exactly that — see [[Architecture]].

Testing it by hand, without printing the secret:

```bash
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env | cut -d= -f2-)" \
  http://localhost:3000/api/cron/refresh-prices
# {"checked":19,"refreshed":17,"failed":0,"skippedFresh":2}
```

### Optional (Phase 12): the site's own address

| Var                    | What                                                         | Where                                       |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | the canonical origin, e.g. `https://spidey-shelf.vercel.app` | optional — local `.env` · Vercel Production |

It feeds `metadataBase` in the root layout, the absolute `og:image` URL, the `Sitemap:` line
in `/robots.txt`, and every `<loc>` in `/sitemap.xml`. `NEXT_PUBLIC_` because it is not a
secret and is inlined at build time.

Blank falls back to `https://spidey-shelf.vercel.app` (`DEFAULT_SITE_URL` in
`src/lib/site.ts`) and **never throws** — a missing or malformed value must not be able to
fail `next build`, because the no-env build is a gate on every PR; the worst case is a
preview card pointing at production. A bare host is accepted (`https://` is added). Set it on
Vercel Production once a custom domain exists.

Absolute URLs are not optional for social previews: Messenger, WhatsApp, iMessage and Twitter
fetch `og:image` from a bare crawler with no page context, so a relative path is simply not
fetched and the link renders as grey text — which was the actual reported symptom.

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
   add env vars above for Production + Preview. **`UPLOADTHING_TOKEN` is the one Phase 9
   added** — without it the BOX ART panel cannot save anything. **`CRON_SECRET` is the one
   Phase 11 added** — without it the nightly price sweep answers 401 to Vercel's own
   scheduler and every price on the site quietly stops moving.
4. **UploadThing**: create the app at uploadthing.com, copy the **V7 token** (not the v6
   `sk_live_…` secret) into `UPLOADTHING_TOKEN`. If the app is recreated, update
   `UPLOADTHING_CDN_HOST` in `next.config.ts` to the new `<app-id>.ufs.sh` in the same PR.
5. **Secrets hygiene**: generate `SESSION_SECRET` with `openssl rand -base64 32`; generate
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

| Script                   | What it does                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npm run db:generate`    | diffs `src/db/schema.ts` against the last snapshot → new SQL file in `drizzle/`   |
| `npm run db:migrate`     | applies pending migrations to `DATABASE_URL`                                      |
| `npm run db:studio`      | opens Drizzle Studio against `DATABASE_URL`                                       |
| `npm run db:seed`        | upserts every `data/catalog/*.csv` into `reference_figures` (safe to re-run)      |
| `npm run db:seed:owned`  | upserts `data/collection/owned.csv` into `owned_figures` — run it after `db:seed` |
| `./scripts/backup-db.sh` | `pg_dump` of the whole database (see above)                                       |

## Asset scripts (run by hand, output committed)

| Script                   | What it does                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npm run icons:generate` | redraws `public/icons/*.png`, `public/apple-touch-icon.png` and `src/app/favicon.ico` from the sprite |
| `npm run map:generate`   | refetches Natural Earth 110m land and rewrites `src/lib/world-land.ts`                                |

Neither runs in CI or on Vercel, and both write files that are **committed**. That is the point:
`icons:generate` needs sharp (a native module) and `map:generate` needs the network, and a
deploy that can fail because a CDN is slow or a prebuilt binary is missing — in order to produce
a favicon — is a deploy with a new way to break. Re-run them when the spider changes.

Never run `drizzle-kit push`: it diffs the live database against `schema.ts` and would drop
the generated `search_vector` column, the trigram index and the `catalog_with_ownership`
view, all of which live in the hand-written `drizzle/0001_search_vector_and_view.sql` and
`drizzle/0002_category_taxonomy.sql`.
Custom SQL goes into a new file via `npm run db:generate -- --custom --name=<what>`.

## Local dev

```bash
npm i
cp .env.example .env   # fill values (escape `$` in the bcrypt hash)
npm run dev
npm run test -- --run
npm run lint && npm run typecheck
```
