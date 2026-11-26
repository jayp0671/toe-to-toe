-- P0.7: the debug page's data (docs/PROMPTS.md P0.7, docs/PLAN.md Appendix A9).
--   phase0_checks: "Health says ___ steps" entries. Each user reads and writes only their own rows.
--   my_sync_status(): the caller's home zone, today and yesterday (from app_now()) and last sync
--   time, without opening sync_keys to clients.
-- Fixture: Ann and Ben share a crew; Cat is alone. Ann has synced, Ben has a key but never synced.
begin;
select plan(39);

-- ---------------------------------------------------------------- schema
select has_table('public', 'phase0_checks', 'phase0_checks exists');
select columns_are('public', 'phase0_checks',
  array['user_id', 'local_date', 'health_steps', 'entered_at'],
  'phase0_checks has user, date, health_steps and when it was entered');
select col_is_pk('public', 'phase0_checks', array['user_id', 'local_date'], 'one Health number per user day');
select fk_ok('public', 'phase0_checks', 'user_id', 'public', 'users', 'id', 'phase0_checks belong to a user');
select col_type_is('public', 'phase0_checks', 'health_steps', 'integer', 'health_steps is an integer');
select has_function('public', 'my_sync_status', array[]::text[], 'my_sync_status() exists');

-- ---------------------------------------------------------------- fixture (as postgres)
update public.app_config set test_mode = true, fake_now = '2027-01-11 04:30:00+00';

insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'ann@test.local'),
  ('00000000-0000-4000-a000-00000000000b', 'ben@test.local'),
  ('00000000-0000-4000-a000-00000000000c', 'cat@test.local'),
  ('00000000-0000-4000-a000-00000000000d', 'dan@test.local'); -- signed up, no profile yet
insert into public.users (id, email, display_name, username, default_tz) values
  ('00000000-0000-4000-a000-00000000000a', 'ann@test.local', 'Ann', 'ann', 'America/New_York'),
  ('00000000-0000-4000-a000-00000000000b', 'ben@test.local', 'Ben', 'ben', 'America/Halifax'),
  ('00000000-0000-4000-a000-00000000000c', 'cat@test.local', 'Cat', 'cat', 'America/Vancouver');
with crew as (
  insert into public.crews (id, name, invite_code, commissioner_id) values
    ('00000000-0000-4000-b000-000000000001', 'Crew One', 'ONE111', '00000000-0000-4000-a000-00000000000a')
  returning id
)
insert into public.crew_members (crew_id, user_id, role)
select crew.id, u.id, u.role from crew, (values
  ('00000000-0000-4000-a000-00000000000a'::uuid, 'commissioner'),
  ('00000000-0000-4000-a000-00000000000b'::uuid, 'member')) as u (id, role);
with crew as (
  insert into public.crews (id, name, invite_code, commissioner_id) values
    ('00000000-0000-4000-b000-000000000002', 'Crew Two', 'TWO222', '00000000-0000-4000-a000-00000000000c')
  returning id
)
insert into public.crew_members (crew_id, user_id, role)
select crew.id, '00000000-0000-4000-a000-00000000000c', 'commissioner' from crew;
insert into public.sync_keys (user_id, key_hash, last_used_at) values
  ('00000000-0000-4000-a000-00000000000a', encode(extensions.digest('ann-key', 'sha256'), 'hex'), '2027-01-11 03:55:00+00'),
  ('00000000-0000-4000-a000-00000000000b', encode(extensions.digest('ben-key', 'sha256'), 'hex'), null);
insert into public.phase0_checks (user_id, local_date, health_steps) values
  ('00000000-0000-4000-a000-00000000000b', '2027-01-09', 8000),
  ('00000000-0000-4000-a000-00000000000c', '2027-01-09', 9000);

select is((select entered_at from public.phase0_checks where health_steps = 8000),
  '2027-01-11 04:30:00+00'::timestamptz, 'entered_at defaults to app_now()');
select throws_ok($$ insert into public.phase0_checks (user_id, local_date, health_steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-09', -1) $$,
  '23514', null, 'health_steps cannot be negative');
select throws_ok($$ insert into public.phase0_checks (user_id, local_date, health_steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-09', 1000001) $$,
  '23514', null, 'health_steps has the same 1,000,000 bound as /sync');

-- ---------------------------------------------------------------- anon
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.phase0_checks $$, '42501', null, 'anon cannot read phase0_checks');
select throws_ok($$ insert into public.phase0_checks (user_id, local_date, health_steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-10', 1) $$,
  '42501', null, 'anon cannot write phase0_checks');
select throws_ok($$ select * from public.my_sync_status() $$, '42501', null, 'anon cannot call my_sync_status()');
reset role;

-- ---------------------------------------------------------------- Ann (authenticated)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

-- 04:30 UTC on Jan 11 is 11:30 PM on Jan 10 in New York.
select results_eq($$ select home_tz, today, yesterday, last_sync_at from public.my_sync_status() $$,
  $$ values ('America/New_York'::text, '2027-01-10'::date, '2027-01-09'::date, '2027-01-11 03:55:00+00'::timestamptz) $$,
  'my_sync_status() gives Ann''s home zone, her today and yesterday from app_now(), and her last sync');

select lives_ok($$ insert into public.phase0_checks (user_id, local_date, health_steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-10', 10250) $$,
  'Ann can save her own Health number');
select lives_ok($$ insert into public.phase0_checks (local_date, health_steps) values ('2027-01-09', 7000) $$,
  'user_id defaults to the signed-in user');
select lives_ok($$ insert into public.phase0_checks as c (user_id, local_date, health_steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-10', 10300)
  on conflict (user_id, local_date) do update
  set user_id = excluded.user_id, local_date = excluded.local_date, health_steps = excluded.health_steps $$,
  'Ann can correct her number with an upsert (how the page saves it)');
select results_eq($$ select local_date, health_steps from public.phase0_checks order by local_date $$,
  $$ values ('2027-01-09'::date, 7000), ('2027-01-10'::date, 10300) $$,
  'Ann sees only her own rows, with the corrected number');
select throws_ok($$ insert into public.phase0_checks (user_id, local_date, health_steps)
  values ('00000000-0000-4000-a000-00000000000b', '2027-01-10', 1) $$,
  '42501', null, 'Ann cannot write a row for Ben, even in her crew');
select throws_ok($$ insert into public.phase0_checks (user_id, local_date, health_steps)
  values ('00000000-0000-4000-a000-00000000000c', '2027-01-10', 1) $$,
  '42501', null, 'Ann cannot write a row for Cat');
select throws_ok($$ update public.phase0_checks set user_id = '00000000-0000-4000-a000-00000000000b'
  where local_date = '2027-01-10' $$,
  '42501', null, 'Ann cannot hand her row to Ben');
select is_empty($$ update public.phase0_checks set health_steps = 1
  where user_id = '00000000-0000-4000-a000-00000000000b' returning 1 $$,
  'Ann cannot change Ben''s row');
select throws_ok($$ update public.phase0_checks set entered_at = '2020-01-01' $$,
  '42501', null, 'entered_at is server-set');
select throws_ok($$ delete from public.phase0_checks $$, '42501', null, 'clients cannot delete Health numbers');
select throws_ok($$ select * from public.sync_keys $$, '42501', null, 'sync_keys stays closed to clients');
reset role;

-- ---------------------------------------------------------------- Ben: key but never synced
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
-- 04:30 UTC is 12:30 AM on Jan 11 in Halifax (UTC−4 in January).
select results_eq($$ select home_tz, today, yesterday, last_sync_at from public.my_sync_status() $$,
  $$ values ('America/Halifax'::text, '2027-01-11'::date, '2027-01-10'::date, null::timestamptz) $$,
  'Ben''s days follow Halifax; no sync yet gives a null last sync');
select results_eq($$ select local_date, health_steps from public.phase0_checks $$,
  $$ values ('2027-01-09'::date, 8000) $$,
  'Ben sees only his own row');
reset role;

-- ---------------------------------------------------------------- Cat: no sync key at all
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select results_eq($$ select home_tz, today, yesterday, last_sync_at from public.my_sync_status() $$,
  $$ values ('America/Vancouver'::text, '2027-01-10'::date, '2027-01-09'::date, null::timestamptz) $$,
  'Cat (no key yet) gets her Vancouver days and a null last sync');
select is((select count(*)::int from public.phase0_checks), 1, 'Cat sees only her own row');
reset role;

-- ---------------------------------------------------------------- Dan: signed in, no profile
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);
select is_empty($$ select * from public.my_sync_status() $$, 'a user without a profile gets no status row');
select is_empty($$ select * from public.phase0_checks $$, 'a user without a profile sees no Health numbers');
select throws_ok($$ insert into public.phase0_checks (local_date, health_steps) values ('2027-01-10', 5) $$,
  '23503', null, 'a user without a profile cannot save a Health number');
reset role;

-- ---------------------------------------------------------------- service role
set local role service_role;
select is((select count(*)::int from public.phase0_checks where user_id::text like '00000000-0000-4000-a000-%'), 4,
  'the service role reads every row (sync report)');
reset role;

-- ---------------------------------------------------------------- entered_at moves on correction
update public.app_config set fake_now = '2027-01-11 13:00:00+00';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ update public.phase0_checks set health_steps = 10400 where local_date = '2027-01-10' $$,
  'Ann can update her own row');
reset role;
select is((select entered_at from public.phase0_checks
  where user_id = '00000000-0000-4000-a000-00000000000a' and local_date = '2027-01-10'),
  '2027-01-11 13:00:00+00'::timestamptz, 'a correction stamps entered_at with app_now()');
select is((select health_steps from public.phase0_checks
  where user_id = '00000000-0000-4000-a000-00000000000a' and local_date = '2027-01-10'),
  10400, 'the corrected number is stored');
select is((select health_steps from public.phase0_checks
  where user_id = '00000000-0000-4000-a000-00000000000b'),
  8000, 'Ben''s row was never changed by Ann');
select is((select count(*)::int from public.phase0_checks where user_id = '00000000-0000-4000-a000-00000000000c'),
  1, 'Cat''s row was never changed by Ann');

-- ---------------------------------------------------------------- function hygiene
select is((select prosecdef from pg_proc where oid = 'public.my_sync_status()'::regprocedure), true,
  'my_sync_status() is security definer (it reads sync_keys for the caller only)');
select is((select proconfig from pg_proc where oid = 'public.my_sync_status()'::regprocedure),
  array['search_path=""'], 'my_sync_status() pins an empty search_path');

select * from finish();
rollback;
