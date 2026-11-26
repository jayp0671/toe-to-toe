-- Local dev seed (P0.3). Runs after migrations on `pnpm db:reset`. Never run against staging or prod.
-- Local Crew: 9 players, 7 in New York, 1 in Halifax, 1 in Vancouver; 4 wear an Apple Watch
-- (users.dev_note). Smoke Crew: 1 hidden user for smoke tests. 10 users total.
-- Names follow the Appendix B mockups. Emails use the reserved .test domain.

with people (n, name, username, tz, note) as (
  values
    (1,  'Jay',   'jay',   'America/New_York',  'Watch wearer'),
    (2,  'Priya', 'priya', 'America/Vancouver', 'Watch wearer'),
    (3,  'Sam',   'sam',   'America/New_York',  'Watch wearer'),
    (4,  'Maya',  'maya',  'America/New_York',  'Watch wearer'),
    (5,  'Dev',   'dev',   'America/New_York',  'Phone only'),
    (6,  'Nisha', 'nisha', 'America/New_York',  'Phone only'),
    (7,  'Rohan', 'rohan', 'America/New_York',  'Phone only'),
    (8,  'Kiran', 'kiran', 'America/Halifax',   'Phone only'),
    (9,  'Ankit', 'ankit', 'America/New_York',  'Phone only'),
    (10, 'Smoke', 'smoke', 'America/New_York',  'Smoke test user (hidden crew)')
),
seeded as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    username || '@toe-to-toe.test' as email,
    name, username, tz, note
  from people
),
auth_rows as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  from seeded
  returning id
),
identity_rows as (
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  select id, id, id::text, 'email',
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now()
  from seeded
  returning id
)
insert into public.users (id, email, display_name, username, default_tz, dev_note)
select id, email, name, username, tz, note from seeded;

-- One statement per crew: crews.commissioner_id and the commissioner's crew_members row are checked
-- together at commit (migration 20261126040000), so they go in together.
with crew as (
  insert into public.crews (id, name, invite_code, commissioner_id) values
    ('00000000-0000-4000-9000-000000000001', 'Local Crew', 'LOCAL1', '00000000-0000-4000-8000-000000000001')
  returning id
)
insert into public.crew_members (crew_id, user_id, role)
select
  crew.id,
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  case when n = 1 then 'commissioner' else 'member' end
from crew, generate_series(1, 9) n;

with crew as (
  insert into public.crews (id, name, invite_code, commissioner_id) values
    ('00000000-0000-4000-9000-000000000002', 'Smoke Crew', 'SMOKE1', '00000000-0000-4000-8000-000000000010')
  returning id
)
insert into public.crew_members (crew_id, user_id, role)
select crew.id, '00000000-0000-4000-8000-000000000010', 'commissioner' from crew;

-- Dev-only sync key for Jay, for curl checks against the local /sync (P0.5 checkpoint):
--   Authorization: Bearer local-dev-sync-key-jay
-- LOCAL ONLY. This seed never runs against staging or prod, and real keys come from
-- POST /api/sync-key/rotate (only their SHA-256 is stored).
insert into public.sync_keys (user_id, key_hash) values
  ('00000000-0000-4000-8000-000000000001', encode(extensions.digest('local-dev-sync-key-jay', 'sha256'), 'hex'));

-- Counted days for the /debug page (P0.7): today and yesterday in each Local Crew player's zone,
-- relative to when the seed runs. Watch wearers show both sources. Yesterday is finalizing until its
-- noon lock, then locked. Jay last synced 20 minutes before the seed ran.
insert into public.daily_stats (user_id, local_date, home_tz, steps, sources, status, locked_at)
select
  u.id,
  d.local_date,
  u.default_tz,
  (case when d.offset_days = 0 then 4000 else 9000 end) + 371 * n,
  case when u.dev_note = 'Watch wearer'
    then array[u.display_name || '''s Apple Watch', u.display_name || '''s iPhone']
    else array[u.display_name || '''s iPhone'] end,
  case
    when d.offset_days = 0 then 'live'
    when now() >= private.lock_instant(d.local_date, u.default_tz) then 'locked'
    else 'finalizing'
  end::public.daily_status,
  case when d.offset_days = 1 and now() >= private.lock_instant(d.local_date, u.default_tz)
    then private.lock_instant(d.local_date, u.default_tz) end
from generate_series(1, 9) n
join public.users u on u.id = ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
cross join lateral (
  select o as offset_days, (now() at time zone u.default_tz)::date - o as local_date
  from (values (0), (1)) v (o)
) d;

update public.sync_keys set last_used_at = now() - interval '20 minutes'
where user_id = '00000000-0000-4000-8000-000000000001';

-- Phase 0 sync-report history (P0.8): the 7 days before yesterday as locked days, plus a sync log and
-- "Health says" numbers for yesterday and those 7 days, so `pnpm sync-report --env local --days 7`
-- has a week to read. Every player syncs at 8:15 AM local the morning after each day, except Rohan,
-- whose sync for 3 days ago came at 2:00 PM (after the lock). Health numbers sit within 1% of the
-- counted total, except Sam 4 days ago (3% off). Nisha didn't enter a number 2 and 5 days ago.
insert into public.daily_stats (user_id, local_date, home_tz, steps, sources, status, locked_at)
select
  u.id,
  (now() at time zone u.default_tz)::date - o,
  u.default_tz,
  7000 + 523 * n + 97 * o,
  case when u.dev_note = 'Watch wearer'
    then array[u.display_name || '''s Apple Watch', u.display_name || '''s iPhone']
    else array[u.display_name || '''s iPhone'] end,
  'locked',
  private.lock_instant((now() at time zone u.default_tz)::date - o, u.default_tz)
from generate_series(1, 9) n
join public.users u on u.id = ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
cross join generate_series(2, 8) o;

insert into public.sync_log (user_id, synced_at, dates)
select s.user_id, s.synced_at, array[s.local_date]
from (
  select
    d.user_id, d.local_date,
    private.lock_instant(d.local_date, d.home_tz)
      + case when d.user_id = '00000000-0000-4000-8000-000000000007'
               and d.local_date = (now() at time zone d.home_tz)::date - 3
          then interval '2 hours' else interval '-3 hours -45 minutes' end as synced_at
  from public.daily_stats d
  where d.local_date < (now() at time zone d.home_tz)::date
) s
where s.synced_at <= now()
union all
select '00000000-0000-4000-8000-000000000001', now() - interval '20 minutes', '{}';

insert into public.phase0_checks (user_id, local_date, health_steps)
select
  d.user_id, d.local_date,
  case when d.user_id = '00000000-0000-4000-8000-000000000003'
         and d.local_date = (now() at time zone d.home_tz)::date - 4
    then d.steps * 100 / 97
    else d.steps + d.steps * ((extract(day from d.local_date)::int % 5) - 2) / 200 end
from public.daily_stats d
where d.local_date < (now() at time zone d.home_tz)::date
  and not (d.user_id = '00000000-0000-4000-8000-000000000006'
           and d.local_date in ((now() at time zone d.home_tz)::date - 2, (now() at time zone d.home_tz)::date - 5));
