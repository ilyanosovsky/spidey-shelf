# Environment & Runbook

## Env vars

`.env.example` in the repo lists all of them. Never commit real values.

### Needed from Phase 1

| Var                   | What                                                                      | Where to set                                       |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`        | Railway Postgres connection string (public URL)                           | local `.env.local` · Vercel (Production + Preview) |
| `SESSION_SECRET`      | ≥32 random bytes for signing the admin cookie (`openssl rand -base64 32`) | local `.env.local` · Vercel                        |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (never the password itself)             | local `.env.local` · Vercel                        |

### Needed from Phase 2 (images)

| Var                                                                      | What                                                                            | Where                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | object storage for normalized box art (only used by the one-time seed pipeline) | local `.env.local` (pipeline runs locally) |
| `NEXT_PUBLIC_IMAGE_BASE_URL`                                             | public base URL of the bucket (custom domain)                                   | local · Vercel                             |

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
2. **Railway**: create Postgres service; Settings → volume → enable **Backups** (Daily);
   copy `DATABASE_URL` (public network URL — Vercel connects from outside Railway).
3. **Vercel**: import the GitHub repo (personal account — Hobby can't use org repos);
   add env vars above for Production + Preview.
4. **Secrets hygiene**: generate `SESSION_SECRET`; generate `ADMIN_PASSWORD_HASH` with
   `npx bcrypt-cli` or the provided script (Phase 1 adds `scripts/hash-password.ts`).

## Local dev

```bash
npm i
cp .env.example .env.local   # fill values
npm run dev
npm run test -- --run
npm run lint && npm run typecheck
```
