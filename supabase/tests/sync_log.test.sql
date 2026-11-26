-- P0.8: sync_log, one row per accepted sync (docs/PROMPTS.md P0.8, docs/PLAN.md §16 Phase 0).
-- The sync report needs to know, per player-day, whether a sync arrived between the end of the day
-- and its noon lock. sync_keys.last_used_at only keeps the latest sync, so sync_apply also appends
-- here. Server-written only (golden rule 5): clients can't read or write it.
begin;
select plan(14);

-- ---------------------------------------------------------------- schema and privileges
select has_table('public', 'sync_log', 'sync_log exists');
select columns_are('public', 'sync_log', array['id', 'user_id', 'synced_at', 'dates'],
  'sync_log has id, user, time and the dates written');
select col_type_is('public', 'sync_log', 'synced_at', 'timestamp with time zone', 'synced_at is a timestamptz');
select fk_ok('public', 'sync_log', 'user_id', 'public', 'users', 'id', 'sync_log rows belong to a user');
select ok(not has_table_privilege('anon', 'public.sync_log', 'select'), 'anon cannot read sync_log');
select ok(not has_table_privilege('authenticated', 'public.sync_log', 'select'),
  'authenticated cannot read sync_log');
select ok(not has_table_privilege('authenticated', 'public.sync_log', 'insert'),
  'authenticated cannot write sync_log');
select ok((select relrowsecurity from pg_class where oid = 'public.sync_log'::regclass), 'sync_log has RLS on');

-- ---------------------------------------------------------------- fixture
update public.app_config set test_mode = true, fake_now = '2027-01-11 14:00:00+00'; -- 9:00 AM ET Jan 11
insert into auth.users (id, email) values ('00000000-0000-4000-f000-00000000000a', 'log-ann@test.local');
insert into public.users (id, email, display_name, username, default_tz) values
  ('00000000-0000-4000-f000-00000000000a', 'log-ann@test.local', 'Ann', 'log_ann', 'America/New_York');
insert into public.sync_keys (user_id, key_hash) values
  ('00000000-0000-4000-f000-00000000000a', encode(extensions.digest('log-ann-key', 'sha256'), 'hex'));

-- ---------------------------------------------------------------- sync_apply appends
select is(
  public.sync_apply('00000000-0000-4000-f000-00000000000a', 'America/New_York',
    '[{"local_date":"2027-01-09","steps":500,"flights":0,"distance_m":0,"sources":["A"],"status":"finalizing"},
      {"local_date":"2027-01-10","steps":2000,"flights":0,"distance_m":0,"sources":["A"],"status":"finalizing"}]',
    '[]', '[]'),
  '{"rate_limited": false, "dates": ["2027-01-10"]}'::jsonb, 'an accepted sync still returns its open dates');
select results_eq(
  $$ select synced_at, dates from public.sync_log where user_id = '00000000-0000-4000-f000-00000000000a' $$,
  $$ values ('2027-01-11 14:00:00+00'::timestamptz, array['2027-01-10']::date[]) $$,
  'the accepted sync is logged at app_now() with the open dates it wrote');

select is(
  public.sync_apply('00000000-0000-4000-f000-00000000000a', 'America/New_York', '[]', '[]', '[]'),
  '{"rate_limited": true}'::jsonb, 'a sync inside 30 seconds is refused');
select is((select count(*)::int from public.sync_log where user_id = '00000000-0000-4000-f000-00000000000a'),
  1, 'a rate-limited sync is not logged');

-- An empty sync (no samples) still proves the Shortcut ran, so it is logged with no dates.
update public.app_config set fake_now = '2027-01-11 15:00:00+00';
select lives_ok(
  $$ select public.sync_apply('00000000-0000-4000-f000-00000000000a', 'America/New_York', '[]', '[]', '[]') $$,
  'an empty sync is accepted');
select results_eq(
  $$ select synced_at, dates from public.sync_log where user_id = '00000000-0000-4000-f000-00000000000a'
     order by synced_at $$,
  $$ values ('2027-01-11 14:00:00+00'::timestamptz, array['2027-01-10']::date[]),
            ('2027-01-11 15:00:00+00'::timestamptz, array[]::date[]) $$,
  'each accepted sync gets its own row');

select * from finish();
rollback;
