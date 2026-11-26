# Toe to Toe

Private step-competition app for one friend crew (8-10 people, all iPhone). Apple Health steps become
Fantasy points. Monthly seasons with daily head-to-head games plus a daily Crew Game, challenges and a
shared Journey map.

**The rules are law.** The full product rules, data model, APIs and test plan are in `docs/PLAN.md` (with the
same content in `docs/Toe_to_Toe_Plan.pdf`). Never invent or change a game rule. If a rule is unclear or
seems wrong, stop and ask Jay. The design system and screen mockups are in `docs/PLAN.md` Appendix B.
The mockups are drawings, so read those pages of the PDF before building UI. Build prompts are in
`docs/PROMPTS.md`.

## Stack

- `apps/web`: React + TypeScript + Vite, installable Home Screen web app (vite-plugin-pwa), Tailwind,
  React Router, TanStack Query, Recharts, MapLibre GL, Lucide icons.
- `packages/engine`: pure TypeScript with zero I/O: scoring, Crew Game, standings, tiebreakers,
  scheduler, de-duplication, time zones, clock. Shared by the web app and Edge Functions.
- `supabase/`: Postgres (migrations, RLS, views, pg_cron + pg_net), Edge Functions (Deno), pgTAP tests,
  seed.
- Health data arrives from the "Toe to Toe Sync" Apple Shortcut via `POST /functions/v1/sync`.
- Hosting: Cloudflare Pages. CI/CD: GitHub Actions. Everything is free tier.

## Golden rules (never break these)

1. **Scores are integers in hundredths.** 108.43 is stored as 10843. Never use floats for points. Round half
   up once per day, only where `docs/PLAN.md` says to.
2. **Time comes from the clock.** Call `clock.now()` (TS) or `app_now()` (SQL). Never call `Date.now()`, `new
Date()` without arguments, or `now()` directly in game logic.
3. **Time zones are IANA names** (America/New_York, America/Halifax, America/Vancouver). A player's
   game day is midnight to midnight in their season home zone. Use Luxon in TS and `AT TIME ZONE` in
   SQL. Never do hand math with UTC offsets.
4. **The engine is pure.** No network, database, `process.env` or clock reads inside `packages/engine`. Pass
   everything in.
5. **Clients never write results.** Health totals, scores, games, standings and reviews are written only by
   Edge Functions using the service role. RLS must deny everything else.
6. **Tests first.** For any rule or bug, write a failing test, then make it pass. Every rule in `docs/PLAN.md` §5
   has a test in `packages/engine`.
7. **Migrations are append-only.** Never edit a merged migration. Add a new one.
8. **Jobs are idempotent and catch-up based.** Each run processes everything that's due. Running twice
   changes nothing.
9. **No new dependencies without asking Jay first.** No paid services. No analytics or tracking SDKs.
10. **No secrets in code.** Use `.env.local` (gitignored), Supabase function secrets and GitHub secrets.

## Commands

| Command                                                        | Use                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                                                     | Local Supabase + web app                                      |
| `pnpm db:reset`                                                | Rebuild local DB from migrations + seed                       |
| `pnpm test` / `pnpm test:engine`                               | Vitest unit tests                                             |
| `pnpm test:db`                                                 | pgTAP database tests                                          |
| `pnpm test:functions`                                          | Deno tests for Edge Functions                                 |
| `pnpm sim --players 9 --month 2027-01 --zones ET,AT --seed 42` | Full fake-clock season through the real stack                 |
| `pnpm e2e`                                                     | Playwright (WebKit, iPhone 15 viewport)                       |
| `pnpm smoke --env staging\|prod`                               | Smoke tests against a deployed environment                    |
| `pnpm check`                                                   | lint + typecheck + test + test:db + test:functions (pre-push) |
| `pnpm gen:types`                                               | Regenerate DB types after a migration                         |

## Definition of done (every task)

- `pnpm check` passes locally. If you touched game flow, `pnpm sim` and `pnpm e2e` pass too.
- New behavior has tests. Bug fixes include a regression test.
- No TODO left without an issue reference. No skipped tests.
- `pnpm gen:types` was run if the schema changed.
- Short summary given: what changed, which tests prove it, anything not done.

## Conventions

- TypeScript strict. No `any`. Validate inputs with Zod, using shared schemas from
  `packages/engine/schemas`.
- File names in kebab-case. React components in PascalCase. One component per file.
- Points in UI always show two decimals (`formatPoints(10843)` returns `"108.43"`).
- UI follows `docs/PLAN.md` Appendix B (tokens, components, screen specs). Use design tokens, never
  raw hex values in components.
- Accessibility: tap targets 44pt or larger, VoiceOver labels on scores and rings, respect
  `prefers-reduced-motion`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`). After each checkpoint passes,
  Jay tags it (`cp-1.3`).

## Repo map

| Path                   | Contents                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| `apps/web/`            | React web app                                                    |
| `packages/engine/`     | pure rules engine + schemas + clock                              |
| `supabase/migrations/` | SQL (append-only)                                                |
| `supabase/functions/`  | sync, api, jobs-tick, jobs-season, jobs-invariants, push         |
| `supabase/tests/`      | pgTAP                                                            |
| `supabase/seed.sql`    | local crew (9 players, ET/AT/PT, half with Watches) + smoke crew |
| `tests/e2e/`           | Playwright                                                       |
| `tests/fixtures/`      | step-sample fixtures                                             |
| `scripts/`             | sim, smoke, sync-report, restore-drill, gen-routes, gen-icons    |
| `routes/`              | Journey GeoJSON                                                  |
| `shortcut/`            | Shortcut build guide + version                                   |
| `docs/`                | PLAN.md, PROMPTS.md, Toe_to_Toe_Plan.pdf                         |
