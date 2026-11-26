/**
 * Phase 0 sync report (docs/PROMPTS.md P0.8, docs/PLAN.md §16 Phase 0 "Done when", Appendix A2).
 *
 *   pnpm sync-report --env staging --days 7
 *   pnpm sync-report --env local --days 7 [--now 2027-01-11T17:00:00Z]
 *
 * For each tester and each of their last N locked home-zone days: was a sync in by the noon lock,
 * counted steps (daily_stats) vs the Health app (phase0_checks) with % error, and sources seen. Then
 * a Watch vs phone-only summary and the two PASS/FAIL lines. The rules are in
 * packages/engine/src/sync-report.ts and docs/PLAN.md §19.
 *
 * Testers are the users whose users.dev_note is "Watch wearer" or "Phone only" (seed.sql locally,
 * the docs/STAGING.md §6 snippet on staging). Everyone else is left out.
 *
 * Credentials (service role, read-only use) come from the environment or the repo-root .env.local:
 *   --env local:   LOCAL_SUPABASE_URL + LOCAL_SUPABASE_SERVICE_ROLE_KEY, else `supabase status`.
 *   --env staging: STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_ROLE_KEY.
 * Keys are only ever sent as request headers. They are never printed.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ERROR_TARGET_PERCENT,
  ERROR_TOLERANCE_PERCENT,
  evaluateDay,
  formatPercentError,
  GROUP_LABELS,
  reportDates,
  summarize,
  SYNC_TARGET_PERCENT,
  systemClock,
  testerGroup,
  toInstant,
  type EvaluatedDay,
  type TesterGroup,
  type Verdict,
} from '../packages/engine/src/index.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

type Env = 'local' | 'staging';

interface Args {
  env: Env;
  days: number;
  now: string | null;
}

function fail(message: string): never {
  console.error(`sync-report: ${message}`);
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  let env: Env | null = null;
  let days = 7;
  let now: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--') continue;
    if (flag === '--env' && (value === 'local' || value === 'staging')) env = value;
    else if (flag === '--days' && value && /^\d+$/.test(value) && Number(value) > 0)
      days = Number(value);
    else if (flag === '--now' && value) now = toInstant(value).toISO();
    else fail(`unknown or bad argument: ${flag ?? ''} ${value ?? ''}\n${USAGE}`);
    i += 1;
  }
  if (!env) fail(`--env is required\n${USAGE}`);
  return { env, days, now };
}

const USAGE = 'usage: pnpm sync-report --env local|staging [--days 7] [--now <ISO instant>]';

// ---------------------------------------------------------------- credentials
interface Connection {
  url: string;
  key: string;
}

function localStatus(): Record<string, string> {
  try {
    // A fixed command string (no user input), so running it through the shell is safe.
    const out = execSync('pnpm exec supabase status -o env', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const vars: Record<string, string> = {};
    for (const line of out.split(/\r?\n/)) {
      const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
      if (m?.[1] && m[2] !== undefined) vars[m[1]] = m[2];
    }
    return vars;
  } catch {
    return {};
  }
}

function connection(env: Env): Connection {
  const envFile = `${ROOT}.env.local`;
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const prefix = env === 'local' ? 'LOCAL' : 'STAGING';
  let url = process.env[`${prefix}_SUPABASE_URL`];
  let key = process.env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`];
  if (env === 'local' && (!url || !key)) {
    const status = localStatus();
    url ||= status['API_URL'];
    key ||= status['SERVICE_ROLE_KEY'];
  }
  if (!url || !key) {
    fail(
      `missing ${prefix}_SUPABASE_URL or ${prefix}_SUPABASE_SERVICE_ROLE_KEY (set them in .env.local, see .env.example)` +
        (env === 'local' ? ', or start the local stack' : ''),
    );
  }
  return { url: url.replace(/\/+$/, ''), key };
}

// ---------------------------------------------------------------- PostgREST reads
const PAGE = 1000;

/** GET every row of a PostgREST query, paging with Range so the server row cap can't truncate it. */
async function selectAll<T>(conn: Connection, table: string, query: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${conn.url}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: conn.key,
        Authorization: `Bearer ${conn.key}`,
        Range: `${from}-${from + PAGE - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      fail(`reading ${table} failed: HTTP ${res.status} ${body}`);
    }
    const page = (await res.json()) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

interface UserRow {
  id: string;
  display_name: string;
  default_tz: string;
  dev_note: string | null;
}
interface DailyRow {
  user_id: string;
  local_date: string;
  steps: number;
  sources: string[];
}
interface CheckRow {
  user_id: string;
  local_date: string;
  health_steps: number;
}
interface LogRow {
  user_id: string;
  synced_at: string;
}

const inList = (values: string[]) => `in.(${values.map((v) => `"${v}"`).join(',')})`;

// ---------------------------------------------------------------- output
function localTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(toInstant(iso).toJSDate());
}

function table(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) =>
    cells
      .map((c, i) => c.padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd();
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

function dayRow(d: EvaluatedDay): string[] {
  const synced = d.syncedByLock ? 'yes' : 'NO';
  const first = d.firstSyncAfterDayEnd ? localTime(d.firstSyncAfterDayEnd, d.tz) : 'none yet';
  const counted = d.countedSteps === null ? '0 (no row)' : String(d.countedSteps);
  let health = 'not entered';
  let error = 'no Health number';
  if (d.error.kind === 'measured' && d.healthSteps !== null) {
    health = String(d.healthSteps);
    error = `${formatPercentError(d.countedSteps ?? 0, d.healthSteps)} ${d.error.within ? 'ok' : 'OVER'}`;
  }
  return [d.localDate, synced, first, counted, health, error, d.sources.join(', ') || '-'];
}

const TESTER_LABELS: Record<TesterGroup, string> = { watch: 'Watch wearer', phone: 'Phone only' };

const pct = (n: number, d: number) => (d === 0 ? '-' : `${((n * 100) / d).toFixed(1)}%`);
const verdictLine = (label: string, v: Verdict) =>
  `${v.pass ? 'PASS' : 'FAIL'}  ${label}${v.reasons.length ? `\n        ${v.reasons.join('\n        ')}` : ''}`;

// ---------------------------------------------------------------- main
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const conn = connection(args.env);
  const now = args.now ?? systemClock.now().toISO();

  const users = await selectAll<UserRow>(
    conn,
    'users',
    'select=id,display_name,default_tz,dev_note&order=display_name',
  );
  const testers = users
    .map((u) => ({ ...u, group: testerGroup(u.dev_note) }))
    .filter((u): u is UserRow & { group: TesterGroup } => u.group !== null);
  const skipped = users.length - testers.length;

  const datesByUser = new Map(
    testers.map((t) => [t.id, reportDates(now, t.default_tz, args.days)]),
  );
  const allDates = [...datesByUser.values()].flat().sort();
  const ids = testers.map((t) => t.id);
  const evaluated: EvaluatedDay[] = [];

  if (testers.length > 0) {
    const first = allDates[0] ?? '';
    const last = allDates[allDates.length - 1] ?? '';
    const range = `local_date=gte.${first}&local_date=lte.${last}&user_id=${inList(ids)}`;
    const [daily, checks, log] = await Promise.all([
      selectAll<DailyRow>(conn, 'daily_stats', `select=user_id,local_date,steps,sources&${range}`),
      selectAll<CheckRow>(conn, 'phase0_checks', `select=user_id,local_date,health_steps&${range}`),
      // Syncs from the first report date on (a sync can only cover a day after that day ends).
      selectAll<LogRow>(
        conn,
        'sync_log',
        `select=user_id,synced_at&user_id=${inList(ids)}&synced_at=gte.${first}&order=synced_at`,
      ),
    ]);
    const key = (u: string, d: string) => `${u} ${d}`;
    const dailyBy = new Map(daily.map((r) => [key(r.user_id, r.local_date), r]));
    const checkBy = new Map(checks.map((r) => [key(r.user_id, r.local_date), r]));
    for (const t of testers) {
      const syncTimes = log.filter((r) => r.user_id === t.id).map((r) => r.synced_at);
      for (const localDate of datesByUser.get(t.id) ?? []) {
        const row = dailyBy.get(key(t.id, localDate));
        evaluated.push(
          evaluateDay({
            userId: t.id,
            name: t.display_name,
            group: t.group,
            localDate,
            tz: t.default_tz,
            countedSteps: row?.steps ?? null,
            healthSteps: checkBy.get(key(t.id, localDate))?.health_steps ?? null,
            sources: row?.sources ?? [],
            syncTimes,
          }),
        );
      }
    }
  }

  const out: string[] = [];
  out.push(`Toe to Toe — Phase 0 sync report (${args.env})`);
  out.push(
    `Generated ${now}. Last ${args.days} locked day(s) per tester, in each tester's home zone.`,
  );
  out.push(
    `Testers: ${testers.length} (users.dev_note "Watch wearer" / "Phone only"); ${skipped} other user(s) left out.`,
  );
  for (const group of ['watch', 'phone'] as const) {
    for (const t of testers.filter((x) => x.group === group)) {
      const days = evaluated.filter((d) => d.userId === t.id);
      out.push('');
      out.push(`${t.display_name} — ${TESTER_LABELS[group]}, ${t.default_tz}`);
      out.push(
        table(
          [
            'Date',
            'Synced by lock',
            'First sync after day end',
            'Counted',
            'Health',
            'Error',
            'Sources seen',
          ],
          days.map(dayRow),
        ),
      );
    }
  }

  const summary = summarize(evaluated);
  out.push('');
  out.push('Summary');
  out.push(
    table(
      [
        'Group',
        'Testers',
        'Player-days',
        'Synced by lock',
        'Health entered',
        `Within ${ERROR_TOLERANCE_PERCENT}%`,
        'No Health number',
      ],
      Object.values(summary.groups).map((g) => [
        GROUP_LABELS[g.group],
        String(g.testers),
        String(g.playerDays),
        `${g.synced} (${pct(g.synced, g.playerDays)})`,
        String(g.measured),
        `${g.within} (${pct(g.within, g.measured)})`,
        String(g.noHealth),
      ]),
    ),
  );
  out.push('');
  out.push(
    'Rules: "synced by lock" = an accepted sync arrived after the day ended and before its 12:00 PM lock.',
  );
  out.push(
    `Days with no Health number count for the sync line and are left out of the error line; a group with none measured fails it.`,
  );
  out.push('Each line must pass for Watch wearers and phone-only players separately.');
  out.push('');
  out.push(
    verdictLine(`>= ${SYNC_TARGET_PERCENT}% of player-days synced by lock`, summary.syncLine),
  );
  out.push(
    verdictLine(
      `<= ${ERROR_TOLERANCE_PERCENT}% error on >= ${ERROR_TARGET_PERCENT}% of days, both groups`,
      summary.errorLine,
    ),
  );
  console.log(out.join('\n'));
}

await main();
