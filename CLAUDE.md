# CLAUDE.md — Spidey Shelf

Personal Funko Pop (Spider-Man) collection tracker for one owner (Ilya). Public read-only
showcase + search ("does Ilya already own this one?") for friends picking gifts; a single-admin
quick-add flow (barcode scan → confirm variant → details). Mobile-first, dark pixel-gadget
aesthetic inspired by the movie "Spidey Tracker".

## Communication

- Chat with the user: **Russian**.
- UI copy: **English**. Code, comments, commits, PRs, and docs: **English**.

## Model orchestration policy

- **Fable** (main loop): planning, orchestration, review, synthesis. Do not grind large
  features inline — decompose and delegate.
- **Opus** subagents: complex tasks — DB schema & migrations, auth, image pipeline,
  scanner integration, non-trivial UI flows.
- **Sonnet** subagents: small/mechanical tasks — boilerplate, simple components,
  doc/wiki sync edits, test scaffolds.

## Git & PR workflow (mandatory)

- **Never commit to `main` directly.** Every change lands via a PR from a feature branch.
- Branch names: `feat/…`, `fix/…`, `chore/…`, `docs/…`. Conventional commit messages.
- Every PR MUST:
  1. update **IMPLEMENTATION_PLAN.md** statuses — it is the single source of progress truth;
  2. update the relevant **docs/wiki/** page(s) when architecture, behavior, or env changes
     (docs/wiki auto-syncs to the GitHub Wiki on merge to main);
  3. pass CI: lint, typecheck, vitest, build.
- Claude opens PRs; Ilya reviews and merges. Do not merge or self-approve.

## Stack (locked — change only via a new ADR in docs/wiki/Decisions.md)

- Next.js App Router + TypeScript, Tailwind (tokens from the design brief), deployed on
  **Vercel Hobby**.
- **Postgres on Railway** via **Drizzle ORM** (small always-on instance; volume backups
  enabled in Railway settings).
- Images: one-time normalized box art (800×800 WebP) in object storage (Cloudflare R2 or
  Railway Bucket), always served through `next/image`. No user uploads.
- Auth: hand-rolled single-admin session — `jose`-signed httpOnly cookie + bcrypt password
  hash from env. **No auth libraries, no Supabase.**
- Tests: **Vitest** + Testing Library.

## Security rules

- Secrets only via env vars; never commit `.env*` (`.env.example` is the only committed one).
- Re-verify the admin session **inside every server action and route handler** — a
  middleware/proxy check alone is not auth (lesson of CVE-2025-29927).
- All DB access through Drizzle (parameterized). No string-built SQL.
- Public pages must never leak admin-only fields or the catalog's `needs_review` internals.

## Testing bar

- Colocate `*.test.ts(x)` next to source.
- Pure logic (slug generation, search-query parsing, stats math) — fully covered.
- Server actions — covered with mocked session/db. Components — smoke tests.
- `npm run test -- --run` must pass before any PR is opened.

## Design

- Source of truth: `docs/design/spidey-collection-design-brief.md` + Claude Design mockups
  in `docs/design/mockups/`.
- Mobile-first; pixel font (Press Start 2P) only for short labels/buttons/counters; body text
  in a readable sans. Dark theme only — that is a deliberate product choice.

## Data ground rules

- `pop_number` is **not unique** (Funko reuses numbers across lines; variants share numbers).
  `slug` is the natural key. `counts_toward_total` drives the stats denominator.
- Never scrape sources whose ToS forbids it (hobbyDB). pops.today only with written consent
  (request emailed 2026-08-06 — check status before building the seed importer on it;
  fallback: checklist sites per the research, images as placeholders until cleared).
