# Toe to Toe — Build prompts (Appendix C2)

> Extracted from `docs/Toe_to_Toe_Plan.pdf`. One prompt per session.

```text
C2. Build prompts and checkpoints

Every prompt to build Toe to Toe, in order. After each prompt there's a checkpoint: the exact commands to
run and what you should see before moving on. Rules referenced as §x and Appendix x are in
docs/PLAN.md.

How to run this playbook

  1. One prompt per session. Start each prompt with /clear so Claude Code begins with a clean context.
     It reads CLAUDE.md automatically.

  2. Plan first on big prompts. Prompts marked [PLAN] go in plan mode (Shift+Tab until "plan mode"
     shows). Read the plan, push back if it drifts from docs/PLAN.md, then approve.

  3. Paste the prompt exactly. Fill in anything in <angle brackets>.

  4. Run the checkpoint yourself. Don't take "done" on faith. Run the commands and compare against
     "You should see".

  5. If a checkpoint fails, paste the failing output back with: "Fix this. Don't change or delete tests unless
     the test contradicts docs/PLAN.md. If it does, tell me which rule and stop."

  6. When it passes: git add -A && git commit -m "<prompt id>: <summary>" && git tag cp-

      <id> && git push --follow-tags

  7. To roll back: git reset --hard cp-<previous id>.
  8. Never let Claude edit a test just to make it pass. Tests encode the rules.
  9. If Claude asks a rules question, answer from docs/PLAN.md. If the plan doesn't cover it, decide, then

     add the decision to docs/PLAN.md §19 so it's written down.

Phase −1 — Setup (manual, about 1 hour)

Install: Node (current LTS), pnpm (corepack enable), Docker Desktop, Supabase CLI, GitHub CLI (gh),
Claude Code, age (brew install age or your OS's package manager). Any OS works. No Mac required.

Accounts (all free):
     GitHub: private repos toe-to-toe (code) and toe-to-toe-backups (encrypted backups).
     Supabase: two projects, t2t-staging and t2t-prod (the free plan allows 2 active projects).
     Cloudflare: Pages project connected to toe-to-toe (the build is configured in P1.7).

Repo starter files:

CLAUDE.md                 (from  the starter  kit)
                                              kit)
docs/PLAN.md              (from  the starter
docs/PROMPTS.md           (this  file)        kit)
docs/Toe_to_Toe_Plan.pdf  (from  the starter

Backup key: age-keygen -o t2t-backup.key. Put the private key in your password manager and delete
the file. Keep the public key (age1...) for P1.7.

Checkpoint −1: node -v, pnpm -v, docker info, supabase -v, gh auth status and claude --version
all work. Tag cp--1.

Phase 0 — Sync proof (target Nov 30 – Dec 7)

P0.1 Scaffold the monorepo and CI [PLAN]

  Read CLAUDE.md and docs/PLAN.md Appendix A1, A2, A4 and A11.
  Scaffold the monorepo exactly as Appendix A1 describes, using pnpm workspaces:
  - apps/web: React + TypeScript + Vite app that renders "Toe to Toe" (no features
  yet).
  - packages/engine: TypeScript library with Vitest configured, plus one trivial
  passing test.
  - supabase/: run `supabase init`. Enable pg_cron, pg_net and pgcrypto in the first
  migration. Add a pgTAP test that checks those extensions exist.
  - supabase/functions/health: Deno function that returns {ok:true, version}. Add one
  Deno test.
  - Root scripts from Appendix A2. Scripts whose features don't exist yet print "not
  implemented" and exit 0, except `check`, which must really run lint, typecheck,
  test, test:db and test:functions.
  - ESLint (typescript-eslint, strict), Prettier, and lefthook running `pnpm check` on
  pre-push.
  - .github/workflows/ci.yml per Appendix A4. Lint, typecheck, unit, start Supabase,
  db tests and function tests are real. sim and e2e are placeholders that pass.
  - .gitignore, .env.example (keys listed in Appendix A9, no values), README with
  setup steps.
  Use the current stable version of each tool and pin exact versions. Don't add any
  dependency that isn't listed in Appendix A11.

Checkpoint P0.1
     Run: pnpm install && pnpm check, then git push and watch Actions.
     You should see: check green locally, CI green on GitHub, pnpm dev showing "Toe to Toe" in the
     browser.
     Tag cp-0.1.

P0.2 Clock and time-zone module

  Read CLAUDE.md golden rules 2 and 3, and docs/PLAN.md §4 and Appendix A8.
  In packages/engine create:
  - clock.ts: a Clock interface with now(), a systemClock, and a FakeClock with
  set(iso) and advance(duration).
  - time.ts, built on Luxon:

      - localDateOf(instant, tz)
      - dayWindow(localDate, tz) → [startUtc, endUtc)
      - lockInstant(localDate, tz) → noon the next local day
      - isLocked(localDate, tz, now)
      - splitIntervalByLocalDay(startUtc, endUtc, tz) for intervals that cross midnight
      - minutesOf(interval)
  Write tests FIRST (Appendix A3 layer 3): New York, Halifax, Vancouver and Kolkata
  boundaries. The 2027 spring-forward day (23 h) and fall-back day (25 h). The lock-
  time examples table in §4. Travel (the phone's zone differs from the home zone, and
  the home zone always wins).
  In the first SQL migration that needs it, add app_now(): it returns now() unless
  test mode is on in an app_config table. Add a pgTAP test that test mode defaults to
  off.

Checkpoint P0.2

     Run: pnpm test:engine && pnpm test:db

     You should see: every §4 example reproduced in the test output. DST tests asserting 23 and 25 hours.
     app_now() test passing.

     Tag cp-0.2.

P0.3 Sync schema and security

  Read docs/PLAN.md §13 and Appendix A9.
  Create migrations for: users (linked to auth.users), crews, crew_members, sync_keys
  (key_hash only), source_hours, hours, daily_stats, audit_log. Use exactly the fields
  in §13; daily_stats.status is an enum (live, finalizing, locked, review, voided).
  RLS: users see only rows for members of their own crews. No client may insert,
  update or delete source_hours, hours, daily_stats or audit_log. sync_keys.key_hash
  is never selectable by clients.
  pgTAP tests FIRST (Appendix A3 layer 5): two crews, three users. Prove each policy
  allows the right reads and denies the wrong ones, and that clients can't write any
  of those tables.
  Update supabase/seed.sql: crew "Local Crew" with 9 users (zones: 7 New York, 1
  Halifax, 1 Vancouver; 4 marked as Watch wearers in a dev-only note column), plus a
  separate "Smoke Crew" with 1 user.
  Run pnpm gen:types.

Checkpoint P0.3

     Run: pnpm db:reset && pnpm test:db

     You should see: every policy test green, including at least one "denied" test per table. The seed loads
     10 users.

     Tag cp-0.3.

P0.4 De-duplication engine and fixtures

  Read docs/PLAN.md §12.2 and Appendix A3 layer 4.
  In packages/engine create dedup.ts:
  - Input: samples {s, e, n, src} per metric (steps, flights, distance_m), plus the
  user's home zone.
  - Spread each sample's count evenly across the UTC minutes it covers, using integer
  math. Hand leftover units to the earliest minutes so totals stay exact.
  - For each minute, keep the source with the largest count. Ties break by source
  name.
  - Output per-source hourly totals and de-duplicated hourly totals (UTC hours). Add a
  helper that sums de-duplicated hours into home-zone daily totals using time.ts.
  - Drop samples whose src is "Health" (manual entries) and report how many were
  dropped.
  Also support the fallback input kind "hours" ({h, n, src}): keep the largest source
  per hour.
  Create tests/fixtures as JSON with an expected total for each: watch-and-phone-same-
  walk, phone-only, watch-on-charger-midday, third-party-band, manual-entry, crosses-
  midnight, dst-spring-day, kolkata-half-hour, freak-day-40k. Write the tests first.

Checkpoint P0.4

     Run: pnpm test:engine

     You should see: every fixture matching its expected total exactly. Re-running the same input twice
     gives identical output.

     Tag cp-0.4.

P0.5 /sync Edge Function

  Read docs/PLAN.md Appendix A5 and A9.
  Implement supabase/functions/sync:
  - Auth: Bearer sync key → SHA-256 → look up in sync_keys. On success, update
  last_used_at.
  - Validate the body with a Zod schema in packages/engine/schemas. Enforce the limits
  and status codes in Appendix A5 (401, 413, 422, 426, 429, plus 200 with ignored
  counts).
  - Run dedup.ts. Upsert source_hours and hours for that user (idempotent). Recompute
  daily_stats for every affected home-zone date that isn't locked. Ignore data for
  locked dates.
  - Use app_now() / clock for every time check.
  - Response body exactly as in Appendix A5. Points come from a stub until P2.1: steps
  × 1, in hundredths.
  Also add supabase/functions/api with POST /api/sync-key/rotate: returns a new random
  32-byte key once and stores only its hash.
  Deno tests FIRST (Appendix A3 layer 6): good sync, each error code, an identical
  payload sent twice changes nothing, late data for a locked day is ignored, a manual
  entry is ignored.

Checkpoint P0.5

     Run: pnpm test:functions. Then pnpm dev, and with curl, POST tests/fixtures/watch-and-
     phone-same-walk.json to the local /sync using a seeded key.

     You should see: tests green. curl returns 200 with the expected step total. Sending it again returns the
     same numbers.
     Tag cp-0.5.

P0.6 Shortcut build guide (then you build it)

  Read docs/PLAN.md §12 and Appendix A10.
  Write shortcut/BUILD.md: a step-by-step guide for building the "Toe to Toe Sync"
  Shortcut by hand in the iPhone Shortcuts app. Name the exact action for each step,
  every setting to choose, and the import question for the sync key. Explain how to
  point it at staging vs production, and how to share it as an iCloud link.
  Also write shortcut/AUTOMATIONS.md: the friend-facing guide for creating "When <app>
  is opened" automations set to Run Immediately with notifications off.
  Write shortcut/VERSION containing 1.0.
  Write shortcut/VERIFY.md: a 5-minute test that the Shortcut drops manual entries and
  survives the phone being locked partway through.

Manual (you, about 30 min on your iPhone): build the Shortcut from BUILD.md, run it against local or
staging, and confirm it returns 200. Check that "Source is not Health" is really available as a filter. If it isn't,
note it in BUILD.md; the server drops manual entries anyway.

Checkpoint P0.6

     You should see: your real steps arriving in daily_stats (staging), within a few percent of the Health
     app. A manual "Add Data" entry in Health doesn't change the total.
     Tag cp-0.6.

P0.7 Debug page and staging deploy

  Read docs/PLAN.md §16 Phase 0 and Appendix A4.
  In apps/web build a single /debug page (no design work yet):
  - Email one-time-code sign-in with Supabase Auth.
  - "Generate sync key" button (calls /api/sync-key/rotate) that shows the key once
  with a Copy button.
  - Today's and yesterday's counted steps, last sync time and sources (read through
  RLS).
  - "Health says ___ steps" input that saves to a phase0_checks table (user, date,
  health_steps), with RLS limited to the user's own rows.
  Add a deploy-staging GitHub Actions workflow: on push to main, apply migrations to
  t2t-staging, deploy functions, and build the web app to the Cloudflare Pages
  preview/staging URL. Read secrets from GitHub secrets per Appendix A9. List the
  exact secrets I need to create.

Checkpoint P0.7

     Run: create the GitHub secrets Claude listed, then push to main.
     You should see: staging URL loads on your iPhone. You can sign in, get a key, sync with the Shortcut
     and see your steps.
     Tag cp-0.7.

P0.8 Sync report

  Read docs/PLAN.md §16 Phase 0 "Done when" and Appendix A2.
  Implement scripts/sync-report.ts (run with tsx): `pnpm sync-report --env staging --
  days 7`.
  For each tester and day it shows:
  - whether a sync arrived before that day's local noon lock
  - counted vs Health-reported steps (from phase0_checks), with % error
  - sources seen
  Split the summary into Watch wearers vs phone-only.
  Finish with PASS/FAIL against: ≥95% of player-days synced by lock, and ≤2% error on
  ≥90% of days for both groups.
  Use the service role key from .env.local. Never print keys.

Checkpoint P0.8 = Phase 0 exit

     Do: 4 testers (2 Watch, 2 phone-only) install the debug page and Shortcut, set up automations, and
     enter their Health number each morning for 7 days.
     Run: pnpm sync-report --env staging --days 7

     You should see: PASS on both lines. If it fails, apply the §18 fallbacks (more trigger apps, kind "hours",
     or a 6 PM lock) and run another week.
     Tag cp-0.8 / phase-0.

Phase 1 — Foundation (target Dec 8 – 14)

P1.1 App shell, design tokens, install support [PLAN]

  Read docs/PLAN.md Appendix B (all of it) and §8.
  Build the app shell in apps/web:
  - Design tokens from Appendix B1–B3 as CSS variables plus a Tailwind theme (dark and
  light, following the system setting). No raw hex values in components.
  - Layout per Appendix B4: safe-area insets, top bar with the avatar button, bottom
  tab bar (Home, Fantasy, Challenges, Journey, Crew), React Router routes for each tab
  with placeholder screens.
  - Core components from Appendix B5 with all their states: Button, Card, StatusPill,
  SyncChip, ProgressRing, Avatar, SegmentedControl, Sheet, Toast, Skeleton,
  EmptyState. Add a /dev/components page that shows every component in every state.
  - PWA: vite-plugin-pwa manifest (name "Toe to Toe", display standalone, theme colors
  from tokens). Service worker caches the app shell. Offline banner.
  - scripts/gen-icons: generates the app icon and Apple splash images from a single
  SVG (Appendix B6) using pwa-asset-generator.
  Component tests with Vitest + Testing Library for each component's states and
  accessible labels.

Checkpoint P1.1

     Run: pnpm check, then push to staging. On your iPhone: Safari → Share → Add to Home Screen.
     You should see: the Toe to Toe icon on the Home Screen. It opens full screen with no Safari bars, the
     tab bar sits above the home indicator, and dark mode follows the system. /dev/components shows

     every state.

     Tag cp-1.1.

P1.2 Auth, profile and home zone

  Read docs/PLAN.md Appendix B7 (screens 1–3 of onboarding) and §4.
  Implement:
  - Sign-in screen: email → 6-digit code (Supabase OTP). Persist the session. Don't
  use magic links.
  - Profile setup: display name, username (unique), avatar (emoji or photo upload to
  Supabase Storage, max 1 MB, resized on the client), default home zone (preselected
  from the browser's zone, searchable IANA list with friendly names like "Eastern –
  New York").
  - Profile is editable from the avatar menu.
  - E2E (Playwright, WebKit, iPhone 15 viewport): sign in using the code read from the
  local Supabase mail catcher, complete the profile, reload, still signed in.

Checkpoint P1.2

     Run: pnpm check && pnpm e2e
     You should see: the E2E sign-in flow green. On a real iPhone, the code email arrives and sign-in works
     inside the Home Screen app.
     Tag cp-1.2.

P1.3 Crews and invites

Read docs/PLAN.md §2, §5.8 and Appendix A6.                                    member
Implement crews:
- Create crew (the creator becomes commissioner). Max 12 members.
- Invite link /join/<code> and code entry. POST /api/crew/join.
- Crew screen (Appendix B7) listing members with avatars and "last synced".
- Commissioner transfer rule: if the commissioner leaves, the longest-tenured
becomes commissioner. Write it to audit_log.
pgTAP: a non-member can't read crew data, the 13th join is rejected, the
commissioner transfer works.
Function tests for /api/crew/join (bad code, full crew, already a member).

Checkpoint P1.3

     Run: pnpm check && pnpm e2e
     You should see: two test accounts in the same crew can see each other. A third account in another
     crew can't.
     Tag cp-1.3.

P1.4 Onboarding flow, push opt-in, sync setup

  Read docs/PLAN.md Appendix B7 "Onboarding" and §12.1.
  Build the full onboarding flow:
  Welcome → Install (if not in standalone mode, show the Add to Home Screen
  illustration and stop until installed) → Sign in → Profile → Join crew →
  Notifications (ask permission only after a button tap, then save the push
  subscription via /api/push/subscribe) → Sync setup (copy key, "Get the Shortcut"
  iCloud link from env, Run once, automation guide from shortcut/AUTOMATIONS.md) →
  Verify ("We counted X steps today. Does Health say about the same?" Yes / No → help
  sheet) → Done.
  Each step is resumable. Progress is stored per user. Settings → "Sync health" can
  reopen sync setup at any time.
  Push subscription storage only for now (sending comes in P4.1).
  E2E for the whole flow with standalone mode and push permission stubbed.

Checkpoint P1.4

     Do: a friend who has never seen the app goes through onboarding on their own phone while you
     watch without helping.
     You should see: they finish in about 5 minutes, and their steps appear on staging.
     Tag cp-1.4.

P1.5 Home and daily leaderboard

  Read docs/PLAN.md §7.1, §8 Home and Appendix B7 "Home".
  Build the Home tab:
  - 10K ProgressRing with today's counted steps and points (stub scoring until P2.1).
  - SyncChip ("Synced 12 min ago", turning amber after 3 h and red after 12 h), plus a
  "Sync now" button that opens the Shortcut via its shortcuts:// URL.
  - Daily leaderboard: everyone in the crew ranked by their own local today. Filters
  Today / Yesterday / This week / This month.
  - Live updates via Supabase Realtime on daily_stats for the crew.
  - Placeholder slots for matchup, modifier, challenges and Journey cards (filled in
  later phases).
  - Loading skeleton, empty state ("Nobody has synced yet today"), error state,
  offline state.
  Tests: leaderboard ordering and ties, local-today logic for a Vancouver player at 11
  PM Eastern.

Checkpoint P1.5

     Do: two phones sync a few minutes apart.
     You should see: the other phone's leaderboard updates within about 5 seconds without a refresh.
     Tag cp-1.5.

P1.6 Settings, account deletion, privacy page

  Read docs/PLAN.md §14 and Appendix B7 "Profile".
  Build Profile/Settings: career stats placeholder, home zone, Sync health (last sync,
  sources, rotate key), notification toggles (all types from §9, saved in
  push_subscriptions.prefs), sign out, Delete account (typed confirmation → POST
  /api/account/delete removes the user, Health totals, keys and subscriptions; past
  games will show "Former player").
  Add a public /privacy page with the §14 text in plain English.
  Tests: deletion removes everything listed. pgTAP proves no orphaned Health rows
  remain.

Checkpoint P1.6

     Run: pnpm check && pnpm e2e
     You should see: a deleted test user is gone from every table except anonymized game history.
     /privacy loads without signing in.
     Tag cp-1.6.

P1.7 Production pipeline, smoke, backups [PLAN]

  Read docs/PLAN.md Appendix A4, A9, A12 and D3.
  Implement:
  - deploy.yml: push to main → staging deploy → `pnpm smoke --env staging`. Git tag
  v*.*.* → production deploy to t2t-prod and the Cloudflare Pages production branch →
  `pnpm smoke --env prod`.
  - scripts/smoke.ts per Appendix A3 layer 9, using the hidden Smoke Crew user and its
  sync key from secrets. Exit non-zero on any failure, printing a short reason.
  - smoke.yml every 3 hours against staging and prod.
  - backup.yml nightly at 3:30 AM ET: supabase db dump for prod → age-encrypt with the
  public key secret → commit to toe-to-toe-backups.
  - scripts/restore-drill.ts: decrypt (private key passed via an env var, never
  stored), restore into the local stack, run invariants.
  - A failed workflow emails me (GitHub's default notifications are fine; document how
  to make sure they're on).
  List every secret and setting I need to create, step by step.

Checkpoint P1.7 = Phase 1 exit

     Run: tag v0.1.0 and push. Watch both deploys and both smoke runs. Trigger backup.yml by hand,
     then run pnpm restore-drill.
     You should see: production URL live. Smoke green on both environments. An encrypted dump in the
     backups repo. The restore drill reports invariants OK.
     Tag cp-1.7 / phase-1.

Phase 2 — Fantasy engine (target Dec 15 – 21)

P2.1 Scoring engine

  Read docs/PLAN.md §5.3 and §5.4 (modifier effects only), plus CLAUDE.md golden rule
  1.
  In packages/engine create scoring.ts: scoreDay(input) → {totalHundredths,
  breakdown[]}.
  Input: hourly de-duplicated steps (in home-zone order), flights, the season's frozen
  scoring config, today's modifier (or none).
  Rules: 1 step = 1 hundredth. Only the first 30,000 steps in time order score. 10K
  bonus and penalties use raw counted steps. Flights at the config value with a daily
  cap. Every modifier in §5.4. 1.5× windows summed and rounded half up once. Negative
  totals allowed.
  Tests FIRST: every row of the §5.3 examples table as a golden test (including 34,210
  and the Early Bird example), each modifier on/off, Pure Steps, No Excuses with both
  penalties, Stairs Day with flights off (never drawn), the cap landing inside a Final
  Push hour.
  Replace the stub in /sync with real scoring.

Checkpoint P2.1

     Run: pnpm test:engine
     You should see: all golden examples pass to the hundredth.
     Tag cp-2.1.

P2.2 Crew Game, standings, tiebreakers

  Read docs/PLAN.md §5.5, §5.6 and §5.8 (forfeits).
  In packages/engine create crewGame.ts and standings.ts.
  Crew Game: for each active player, count how many they beat and how many beat them →
  W/L/T. Inactive players are excluded. Bye players are included.
  Standings: H2H W-L-T, Crew W-L-T, Win % = (W + 0.5T) / (H2H games + Crew games), PF
  (all regular-season days), PA (H2H opponents), streak. Tiebreakers: Win % → PF →
  total counted steps → seeded random draw (the seed and result are returned so they
  can be logged).
  Forfeits: a game against an Inactive player is a win for the opponent, who keeps
  their real score for PF.
  Tests FIRST: 8-player day (top 4 win), 9-player day (middle ties), score ties at the
  boundary, a three-way tie resolved at each tiebreak level, forfeit math.

Checkpoint P2.2

     Run: pnpm test:engine
     You should see: green, with explicit tests for every tiebreak level.
     Tag cp-2.2.

P2.3 Scheduler [PLAN]

  Read docs/PLAN.md §6 (table and scheduler rules) and Appendix A3 layer 2.
  In packages/engine create scheduler.ts: buildSeason({players, monthStart,
  daysInMonth, seed}) → {regularDays, restDays, playoffDays, days[{date, games[[a,b]],
  byes[]}], perPlayer{games, byes}}.
  Rules in priority order exactly as §6. Odd crews use three-bye days only when
  needed. Meetings differ by at most 1. No same opponent on consecutive days. No back-
  to-back byes. The result is deterministic for a given seed.
  Tests FIRST:
  1. A golden test that loops crew sizes 4–12 and month lengths 28–31 and asserts the
  exact §6 cell values (games, byes, regular days, rest days).
  2. fast-check properties over 200 seeds per combination: equal games and byes,
  nobody plays twice a day, meeting spread ≤ 1, no back-to-back opponent, no back-to-
  back byes, rest ≥ 1, playoffs fit.
  If any §6 cell is mathematically impossible, stop and tell me which one instead of
  changing the test.

Checkpoint P2.3

     Run: pnpm test:engine

     You should see: 36 golden cells green and all properties green. Run time under about 60 seconds.
     Tag cp-2.3.

P2.4 Season schema and lifecycle job

  Read docs/PLAN.md §5.1, §5.8, §13 and Appendix A6–A8.
  Migrations: seasons, season_players, games, crew_games, byes, playoff_series,
  modifiers, plus a view revealed_modifiers. RLS per Appendix A9: modifiers are
  readable only through the view.
  Implement supabase/functions/jobs-season (cron, every 15 min, CRON_SECRET):
  - 20th 9:00 AM crew clock: create next month's season in signup.
  - POST /api/season/signup {season_id, home_tz}, /api/season/leave.
  - Last day 8:00 PM crew clock: lock rosters and home zones. Fewer than 4 players →
  cancelled.
  - 9:00 PM: build the schedule (scheduler.ts) and draw hidden modifiers (frequency
  from config, max 1 per day, never consecutive, skip any that need a disabled
  metric).
  - Commissioner settings (POST /api/admin/settings) allowed only before the roster
  lock. Freeze scoring_config at lock.
  - Short first season mid-month: allowed only if ≥7 regular days fit.
  - Every transition goes to audit_log.
  Tests with FakeClock: the full lifecycle for a Jan 2027 season, settings rejected
  after lock, cancelled with 3 players.

Checkpoint P2.4

     Run: pnpm test:db && pnpm test:functions

     You should see: green. A seeded staging season shows a full January schedule.
     Tag cp-2.4.

P2.5 Locks and finalization (jobs-tick) [PLAN]

  Read docs/PLAN.md §4, §5.2, §5.5, §5.6 and Appendix A7–A8.
  Implement supabase/functions/jobs-tick (cron every 15 min):
  - Move player days live → finalizing at local midnight and → locked at local noon
  (flag check runs here, review comes in P4.4).
  - Finalize a game when both players' days are locked (and not under review): write
  score_a/score_b from scoreDay, the winner, status final.
  - When every active player's day for a date is locked: compute Crew Games for that
  date.
  - Update season_players standings with standings.ts.
  - Idempotent and catch-up: process everything due as of app_now().
  Function tests with FakeClock: an ET vs Vancouver game goes final at 3:00 PM ET.
  Halifax locks at 11:00 AM ET. Running the job twice changes nothing. Skipping 3
  hours of runs then running once catches up correctly.

Checkpoint P2.5

     Run: pnpm test:functions
     You should see: the §4 example timings reproduced exactly.
     Tag cp-2.5.

P2.6 Season simulator and invariants

  Read docs/PLAN.md Appendix A3 layers 7 and 10.
  Implement:
  - packages/engine/invariants.ts: pure checks (equal games/byes, stored standings ==
  recomputed, every final game has two locked days, scores == recompute from hours, no
  unrevealed modifier exposed).
  - scripts/sim.ts: `pnpm sim --players N --month YYYY-MM --zones ET,AT|PT --seed S [-
  -chaos]`.

      Spin up against the local stack in test mode. Create a crew and season. Generate
  synthetic hourly steps per player (seeded, realistic daily shapes, Watch vs phone
  patterns). Advance FakeClock in 15-minute ticks, calling /sync and the jobs exactly
  like production. At the end, recompute everything independently with the engine and
  compare to the database.

      --chaos: late syncs, a missed day, a mid-season dropout (after P3.3), a voided day
  (after P4.4).

      Print a summary: champion (after P3), standings table, invariant results, runtime.
  - Turn on the sim step in ci.yml (9 players, 2027-01, ET+PT, seed 42).

Checkpoint P2.6

     Run: pnpm sim --players 9 --month 2027-01 --zones ET,PT --seed 42 and the same with --
     players 8 and --players 10.
     You should see: "invariants: all pass", DB == engine for every game, and a regular season that matches
     the §6 cells.
     Tag cp-2.6.

P2.7 Fantasy UI: Matchup, Game detail, Schedule, Standings

  Read docs/PLAN.md §8 and Appendix B7 "Fantasy" and "Game detail".
  Build the Fantasy tab with sub-tabs Matchup, Schedule and Standings (Bracket, Stats,
  History and Reviews come later; show "Coming soon").
  - Matchup: today's game card (both scores live, margin, "X steps to take the lead",
  status pill, each player's sync chip), Crew Game rank today, this season's results
  list.
  - Game detail: hourly step bars for both players (Recharts), score breakdown line by
  line from scoreDay's breakdown, reactions placeholder.
  - Schedule: whole month by day, byes marked, rest and playoff days shaded.
  - Standings: table per §5.6 with the playoff cut line.
  Realtime updates. Skeleton, empty, error states. VoiceOver labels per Appendix B8.
  E2E: a simulated day shows live → finalizing → final on the Matchup card.

Checkpoint P2.7 = Phase 2 exit
     Do: run a 3-day sim on staging (test mode) with 4 test accounts on real phones.
     You should see: live scores moving, finals at the right local times, standings updating. All test layers 1–7
     green in CI.
     Tag cp-2.7 / phase-2.

Phase 3 — Playoffs and history (target Dec 22 – 26)

P3.1 Playoffs engine

  Read docs/PLAN.md §5.7, §5.1 (rest days) and §6.
  Engine: seedPlayoffs(standings, bracketSize), series logic (fixed 3-day blocks, Game
  3 skipped at 2-0), playoff game tiebreak (more counted steps, then higher seed),
  Inactive seed replacement, opponent advances if a player leaves.
  jobs-tick: after the last regular-season day locks for everyone, seed, write
  playoff_series and games, and auto-create the Consolation Race challenge record (the
  engine for it comes in P5.1; store the entry list now).
  Champion when the final series is decided.
  Tests FIRST for Top 2 and Top 4, 2-0 and 2-1 series, a tied playoff game, an
  Inactive top seed.

Checkpoint P3.1
     Run: pnpm sim --players 8 --month 2027-01 --zones ET,PT --seed 7
     You should see: semis Jan 26–28, final Jan 29–31, and a champion named. Invariants pass.
     Tag cp-3.1.

P3.2 Bracket UI

  Read Appendix B7 "Bracket".
  Build the Bracket sub-tab: seeds, series scores (game dots), the current game
  highlighted, and the champion banner with a trophy. Before seeding, show a
  "Projected bracket" based on current standings, clearly labeled. Confetti on the
  champion view, respecting reduced motion.

Checkpoint P3.2: the bracket from P3.1's sim renders correctly on an iPhone viewport. Tag cp-3.2.

P3.3 Dropouts, commissioner powers, audit log

  Read docs/PLAN.md §5.8 and Appendix A6.
  Implement /api/season/leave after start (becomes Inactive), /api/admin/remove-
  player, /api/admin/cancel-season, forfeit handling in jobs-tick, Crew Game
  exclusion, playoff seed replacement, the "Former player" display, and the
  commissioner settings screen (gear icon), which is read-only after the lock.
  Add an Audit log view per season (Fantasy → History).
  Enable --chaos dropout in sim.

Checkpoint P3.3

     Run: pnpm sim --players 9 --month 2027-01 --zones ET,AT --seed 3 --chaos
     You should see: the dropout's remaining games are forfeits, the Crew Game excludes them, and
     invariants pass.
     Tag cp-3.3.

P3.4 History, careers, head-to-head, record book, trophies

  Read docs/PLAN.md §7.5.
  Build SQL views (with RLS) and screens: season archive, player career, head-to-head
  between any two players, record book, trophy room with badges (champion, Consolation
  Race winner, Crew Game MVP, 7-day 10K streak). Records update in jobs-tick when
  games finalize.
  Tests: views match hand-computed values from a fixed sim seed (snapshot).

Checkpoint P3.4: after two simulated seasons, careers and records match the snapshot. Tag cp-3.4.

P3.5 Nightly invariants and admin page

  Read Appendix A3 layer 10 and Appendix D3.
  Implement supabase/functions/jobs-invariants (nightly via pg_cron) using
  engine/invariants.ts against production data. Write results to an invariant_runs
  table. On failure, show it on the admin page and send a push to the commissioner
  (once P4.1 exists; log it for now).
  Admin page (/admin, only for users flagged admin): last sync per player, cron run
  history (cron.job_run_details), failed pushes, open reviews, DB size, invariant
  results.

Checkpoint P3.5 = Phase 3 exit: pnpm sim full seasons for 8, 9 and 10 players to a champion with zero
invariant failures. The admin page shows healthy staging. Tag cp-3.5 / phase-3.

Phase 4 — Engagement (target Dec 27 – 30)

P4.1 Push infrastructure [PLAN]

  Read docs/PLAN.md §9 and Appendix A6.
  Implement supabase/functions/push plus a dispatcher inside jobs-tick:
  - Web Push with VAPID (JSR web push library from Appendix A11). Payload: title,
  body, url.
  - A notification_queue table with due_at_utc, computed from each player's home zone.
  Catch-up sending. Dedupe key per (user, type, game/date).
  - Respect per-type toggles. Rate-limit opponent alerts to 1 per hour per game.
  - Delete subscriptions that return 404/410.
  - The service worker shows the notification and opens the url on tap.
  Tests: due times for ET/AT/PT users, dedupe, rate limit, 410 cleanup.

Checkpoint P4.1: a test push arrives on your iPhone (Home Screen app, notifications allowed), and tapping
it opens the right screen. Tag cp-4.1.

P4.2 Notification catalog

  Implement every notification in docs/PLAN.md §9 with the copy from Appendix B9. Each
  has a unit test for its trigger condition and local time, plus a sim assertion that
  it fires exactly once per eligible player per day.

Checkpoint P4.2: pnpm sim --players 8 --month 2027-01 --zones ET,PT --seed 11 reports the
expected count of each notification type. Tag cp-4.2.

P4.3 Modifier reveal and UI

  Read docs/PLAN.md §5.4.
  jobs-tick reveals tomorrow's modifier at 8:00 PM in each player's home zone (per-
  player visibility through revealed_modifiers, using a per-user reveal check). Show a
  ModifierBadge on Home and Matchup, with an explainer sheet. Scoring already applies
  modifiers (P2.1). Test that a player can't read a modifier before their own 8 PM.

Checkpoint P4.3: pgTAP and function tests green. The sim shows the expected number of modifier days
with no back-to-backs. Tag cp-4.3.

P4.4 Flags and crew review

  Read docs/PLAN.md §5.10.
  At lock, flag days over 40,000 steps, over 2.5× the 30-day average (once 7 days of
  history exist), or with any hour over 12,000. Flagged → daily_stats.review, and its
  games → review for 24 h. POST /api/review/vote, /api/day/note. Outcome: more than
  half of the other active players vote void → voided (scored as 0 steps, no
  penalties). Otherwise it stands. Finalize afterward. Crew Game for that date waits
  for the review.
  Reviews sub-tab UI. Enable --chaos voided day in sim.
  Tests for each flag trigger, vote math with 8/9/10 players, and the review closing
  on time with no votes.

Checkpoint P4.4: the chaos sim shows one voided day and every dependent result recomputed. Invariants
pass. Tag cp-4.4.

P4.5 Social

  Read docs/PLAN.md §7.4.
  Reactions (fixed emoji set) and one-line trash talk (max 140 characters) on game
  cards, Realtime-updated. Nudges (one per pair per day) send a push. Users can delete
  their own comments. Basic profanity isn't filtered (friends app), but HTML is
  escaped. RLS and function tests.

Checkpoint P4.5: two phones trade reactions live, and the nudge push arrives. Tag cp-4.5.

P4.6 Full end-to-end suite

  Read Appendix A3 layer 8.
  Complete the Playwright suite (WebKit, iPhone 15 viewport): onboarding; join crew;
  season signup with home zone; live matchup update after a sync; review vote;
  commissioner settings locked after start; account deletion. Run it in CI against the
  local stack with FakeClock control through a test-only endpoint that exists only
  when test mode is on (a pgTAP test proves it's off in prod).

Checkpoint P4.6 = Phase 4 exit: CI fully green including e2e. Tag cp-4.6 / phase-4.

Phase 5 — Journey and challenges (target early Jan)

P5.1 Challenges engine and API

  Read docs/PLAN.md §7.2.
  Engine + tables + API for challenges: create (type, invitees, dates 1–14 days,
  scoring config), accept/decline, daily points from locked days, results. Types:
  Race, King of the Hill (reigns, total crowns), Consolation Race (auto-created in
  P3.1). Challenges never touch Fantasy tables. No modifiers. Watch metrics allowed
  (opt-in).
  Tests FIRST for each type, including ties and a member who leaves.

Checkpoint P5.1: a sim with a concurrent Race and King of the Hill gives correct winners. Tag cp-5.1.

P5.2 Challenges UI

Read Appendix B7 "Challenges".                                    → players →   Home
Challenges tab: Active / Upcoming / Completed. Create flow: type  daily chart.
duration → scoring → review. Challenge detail with standings and
shows active challenge cards.

Checkpoint P5.2: you create a 3-day Race on your phone and a friend accepts it. Tag cp-5.2.

P5.3 Journey

  Read docs/PLAN.md §7.3 and Appendix B7 "Journey".
  scripts/gen-routes.ts: build routes/*.geojson for the 5 starter routes from a small
  list of waypoints per route (city name + lat/lng + cumulative miles). Lines are
  straight or great-circle segments between waypoints. No paid APIs.
  Journey tables, progress from crew distance (locked days only), milestone cards when
  a city is passed (with a push), the commissioner picks the next route when one
  finishes.
  Journey screen: MapLibre with OpenFreeMap tiles (fallback: SVG route), marker,
  period filter, contribution list, milestones.

Checkpoint P5.3 = Phase 5 exit: a sim month moves the marker the right number of miles, and milestones
fire once. Tag cp-5.3 / phase-5.

Phase 6 — Launch and beta season (January 2027)

P6.1 Launch hardening [PLAN]

  Read Appendix D2 (launch checklist).
  Do a hardening pass and report findings before fixing anything:
  1. RLS audit: list every table and view with its policies and prove each with a
  pgTAP test.
  2. Abuse limits: payload limits, rate limits, invite code brute force.
  3. Accessibility audit of every screen against Appendix B8.
  4. Every screen has loading, empty, error and offline states.
  5. Performance: the Home tab is interactive in under 2 s on a mid-range iPhone over
  4G (Lighthouse mobile ≥ 90 for performance and accessibility).
  6. Error messages are human and never leak internals.
  Then fix the findings in priority order.

Checkpoint P6.1: every item on the launch checklist (Appendix D2) is checked. Tag v1.0.0 → production.

Manual: launch

Follow Appendix D2: invite the crew, run onboarding sessions, open January sign-ups, and watch the first
72 hours using the Appendix D3 runbook.

Checkpoint P6 = Beta exit: January season completes. Success metrics in Appendix D1 are met.

Phase 7 — Polish (Feb and later)

     P7.1 Design pass: "Read Appendix B. Review every screen against it, list inconsistencies, then fix them.
     Add delight: score tick-up animations, win confetti, crown animation for King of the Hill, all respecting
     reduced motion."
     P7.2 V1.1 challenges: First to X, Personal Best, Team Battle, Survival, each test-first per §7.2.
     P7.3 Native upgrade (optional, needs the $99 Apple Developer Program): "Read §10 option D. Wrap
     apps/web with Capacitor. Add a HealthKit plugin that uses statistics collection queries (de-duplicated
     by Apple) plus background delivery and posts kind 'hours' to /sync. Add native push via APNs, keeping
     Web Push working for web users. Keep one codebase."

```
