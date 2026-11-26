-- P0.3: sync schema and row-level security (docs/PLAN.md §13, Appendix A3 layer 5, Appendix A9).
-- Fixture: two crews, three users. Ann and Ben share Crew One; Cat is alone in Crew Two.
begin;
select plan(81);

-- ---------------------------------------------------------------- schema
select has_table('public', 'users', 'users exists');
select has_table('public', 'crews', 'crews exists');
select has_table('public', 'crew_members', 'crew_members exists');
select has_table('public', 'sync_keys', 'sync_keys exists');
select has_table('public', 'source_hours', 'source_hours exists');
select has_table('public', 'hours', 'hours exists');
select has_table('public', 'daily_stats', 'daily_stats exists');
select has_table('public', 'audit_log', 'audit_log exists');

select columns_are('public', 'users',
  array['id', 'email', 'display_name', 'username', 'avatar_url', 'default_tz', 'created_at', 'dev_note'],
  'users has the §13 fields (plus the dev-only note)');
select columns_are('public', 'crews',
  array['id', 'name', 'invite_code', 'commissioner_id', 'crew_tz'],
  'crews has the §13 fields');
select columns_are('public', 'crew_members',
  array['crew_id', 'user_id', 'role', 'joined_at', 'status'],
  'crew_members has the §13 fields');
select columns_are('public', 'sync_keys',
  array['user_id', 'key_hash', 'created_at', 'last_used_at'],
  'sync_keys stores only the hash');
select columns_are('public', 'source_hours',
  array['user_id', 'hour_start_utc', 'source_name', 'steps', 'flights', 'distance_m'],
  'source_hours has the §13 fields');
select columns_are('public', 'hours',
  array['user_id', 'hour_start_utc', 'steps', 'flights', 'distance_m'],
  'hours has the §13 fields');
select columns_are('public', 'daily_stats',
  array['id', 'user_id', 'local_date', 'home_tz', 'steps', 'flights', 'distance_m', 'sources',
        'status', 'locked_at', 'flags', 'note'],
  'daily_stats has the §13 fields');
select columns_are('public', 'audit_log',
  array['id', 'season_id', 'actor', 'action', 'before', 'after', 'at'],
  'audit_log has the §13 fields');

select enum_has_labels('public', 'daily_status',
  array['live', 'finalizing', 'locked', 'review', 'voided'],
  'daily_stats.status is the five-value enum');
select col_type_is('public', 'daily_stats', 'status', 'daily_status', 'daily_stats.status uses the enum');
select col_type_is('public', 'users', 'id', 'uuid', 'users.id is a uuid');
select fk_ok('public', 'users', 'id', 'auth', 'users', 'id', 'users are linked to auth.users');
select col_is_pk('public', 'hours', array['user_id', 'hour_start_utc'], 'one de-duplicated row per user hour');
select col_is_pk('public', 'source_hours', array['user_id', 'hour_start_utc', 'source_name'],
  'one row per user hour per source');
select col_is_unique('public', 'daily_stats', array['user_id', 'local_date'], 'one daily_stats row per user day');

-- ---------------------------------------------------------------- fixture (as postgres)
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'ann@test.local'),
  ('00000000-0000-4000-a000-00000000000b', 'ben@test.local'),
  ('00000000-0000-4000-a000-00000000000c', 'cat@test.local');
insert into public.users (id, email, display_name, username, default_tz) values
  ('00000000-0000-4000-a000-00000000000a', 'ann@test.local', 'Ann', 'ann', 'America/New_York'),
  ('00000000-0000-4000-a000-00000000000b', 'ben@test.local', 'Ben', 'ben', 'America/Halifax'),
  ('00000000-0000-4000-a000-00000000000c', 'cat@test.local', 'Cat', 'cat', 'America/Vancouver');
insert into public.crews (id, name, invite_code, commissioner_id) values
  ('00000000-0000-4000-b000-000000000001', 'Crew One', 'ONE111', '00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-b000-000000000002', 'Crew Two', 'TWO222', '00000000-0000-4000-a000-00000000000c');
insert into public.crew_members (crew_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000000a', 'commissioner'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000000b', 'member'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-00000000000c', 'commissioner');
insert into public.sync_keys (user_id, key_hash) values
  ('00000000-0000-4000-a000-00000000000a', encode(extensions.digest('ann-key', 'sha256'), 'hex')),
  ('00000000-0000-4000-a000-00000000000c', encode(extensions.digest('cat-key', 'sha256'), 'hex'));
insert into public.source_hours (user_id, hour_start_utc, source_name, steps) values
  ('00000000-0000-4000-a000-00000000000a', '2027-01-11 15:00:00+00', 'Ann iPhone', 900),
  ('00000000-0000-4000-a000-00000000000a', '2027-01-11 15:00:00+00', 'Ann Watch', 1000);
insert into public.hours (user_id, hour_start_utc, steps) values
  ('00000000-0000-4000-a000-00000000000a', '2027-01-11 15:00:00+00', 1000),
  ('00000000-0000-4000-a000-00000000000b', '2027-01-11 15:00:00+00', 2000),
  ('00000000-0000-4000-a000-00000000000c', '2027-01-11 15:00:00+00', 3000);
insert into public.daily_stats (user_id, local_date, home_tz, steps) values
  ('00000000-0000-4000-a000-00000000000a', '2027-01-11', 'America/New_York', 1000),
  ('00000000-0000-4000-a000-00000000000b', '2027-01-11', 'America/Halifax', 2000),
  ('00000000-0000-4000-a000-00000000000c', '2027-01-11', 'America/Vancouver', 3000);
insert into public.audit_log (actor, action, after) values
  ('00000000-0000-4000-a000-00000000000a', 'sync_key.rotate', '{"user":"ann"}');

-- ---------------------------------------------------------------- constraints
select is((select status::text from public.daily_stats where user_id = '00000000-0000-4000-a000-00000000000a'),
  'live', 'daily_stats.status defaults to live');
select throws_ok(
  $$ insert into public.daily_stats (user_id, local_date, home_tz, status)
     values ('00000000-0000-4000-a000-00000000000a', '2027-01-12', 'America/New_York', 'final') $$,
  '22P02', null, 'daily_stats.status rejects values outside the enum');
select throws_ok(
  $$ insert into public.hours (user_id, hour_start_utc) values
     ('00000000-0000-4000-a000-00000000000a', '2027-01-11 15:30:00+00') $$,
  '23514', null, 'hours must start on a UTC hour');
select throws_ok(
  $$ insert into public.hours (user_id, hour_start_utc, steps) values
     ('00000000-0000-4000-a000-00000000000a', '2027-01-11 16:00:00+00', -1) $$,
  '23514', null, 'step counts cannot be negative');
select throws_ok(
  $$ update public.users set default_tz = 'EST' where username = 'ann' $$,
  '23514', null, 'home zones must be IANA names');
select throws_ok(
  $$ insert into public.daily_stats (user_id, local_date, home_tz)
     values ('00000000-0000-4000-a000-00000000000a', '2027-01-11', 'America/New_York') $$,
  '23505', null, 'a user cannot have two daily_stats rows for one date');

-- ---------------------------------------------------------------- as Ann (Crew One)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

-- users
select set_eq($$ select username from public.users $$, array['ann', 'ben'],
  'Ann sees herself and her crew-mate');
select is_empty($$ select 1 from public.users where username = 'cat' $$,
  'denied: Ann cannot see a user in another crew');
select lives_ok($$ update public.users set display_name = 'Annie' where username = 'ann' $$,
  'Ann can edit her own profile');
select lives_ok($$ update public.users set display_name = 'Hacked' where username = 'ben' $$,
  'an update of a crew-mate runs but matches no rows');
select throws_ok($$ update public.users set email = 'x@test.local' where username = 'ann' $$,
  '42501', null, 'denied: Ann cannot change her email');
select throws_ok($$ insert into public.users (id, email, display_name, username, default_tz)
  values ('00000000-0000-4000-a000-00000000000d', 'd@test.local', 'D', 'd', 'America/New_York') $$,
  '42501', null, 'denied: clients cannot insert users');
select throws_ok($$ delete from public.users where username = 'ann' $$,
  '42501', null, 'denied: clients cannot delete users');

-- crews and crew_members
select set_eq($$ select name from public.crews $$, array['Crew One'], 'Ann sees only her crew');
select is_empty($$ select 1 from public.crews where name = 'Crew Two' $$,
  'denied: Ann cannot see another crew');
select is((select count(*)::int from public.crew_members), 2, 'Ann sees both Crew One memberships');
select is_empty($$ select 1 from public.crew_members where user_id = '00000000-0000-4000-a000-00000000000c' $$,
  'denied: Ann cannot see another crew''s members');
select throws_ok($$ insert into public.crews (name, invite_code, commissioner_id)
  values ('Rogue', 'RRR333', '00000000-0000-4000-a000-00000000000a') $$,
  '42501', null, 'denied: clients cannot create crews directly');
select throws_ok($$ update public.crews set name = 'Renamed' $$,
  '42501', null, 'denied: clients cannot update crews directly');
select throws_ok($$ insert into public.crew_members (crew_id, user_id)
  values ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-00000000000a') $$,
  '42501', null, 'denied: clients cannot join a crew directly');
select throws_ok($$ delete from public.crew_members $$,
  '42501', null, 'denied: clients cannot remove crew members directly');

-- hours and daily_stats
select set_eq($$ select steps from public.hours $$, array[1000, 2000],
  'Ann reads her own and her crew-mate''s hours');
select is_empty($$ select 1 from public.hours where user_id = '00000000-0000-4000-a000-00000000000c' $$,
  'denied: Ann cannot read another crew''s hours');
select set_eq($$ select steps from public.daily_stats $$, array[1000, 2000],
  'Ann reads her own and her crew-mate''s daily stats');
select is_empty($$ select 1 from public.daily_stats where user_id = '00000000-0000-4000-a000-00000000000c' $$,
  'denied: Ann cannot read another crew''s daily stats');
select throws_ok($$ insert into public.hours (user_id, hour_start_utc, steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-11 16:00:00+00', 99999) $$,
  '42501', null, 'denied: clients cannot insert hours');
select throws_ok($$ update public.hours set steps = 99999 $$,
  '42501', null, 'denied: clients cannot update hours');
select throws_ok($$ delete from public.hours $$,
  '42501', null, 'denied: clients cannot delete hours');
select throws_ok($$ insert into public.daily_stats (user_id, local_date, home_tz, steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-12', 'America/New_York', 99999) $$,
  '42501', null, 'denied: clients cannot insert daily stats');
select throws_ok($$ update public.daily_stats set steps = 99999, status = 'locked' $$,
  '42501', null, 'denied: clients cannot update daily stats');
select throws_ok($$ delete from public.daily_stats $$,
  '42501', null, 'denied: clients cannot delete daily stats');

-- source_hours: no client access at all
select throws_ok($$ select * from public.source_hours $$,
  '42501', null, 'denied: clients cannot read source_hours, even their own');
select throws_ok($$ insert into public.source_hours (user_id, hour_start_utc, source_name, steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-11 16:00:00+00', 'Fake', 5) $$,
  '42501', null, 'denied: clients cannot insert source_hours');
select throws_ok($$ update public.source_hours set steps = 0 $$,
  '42501', null, 'denied: clients cannot update source_hours');
select throws_ok($$ delete from public.source_hours $$,
  '42501', null, 'denied: clients cannot delete source_hours');

-- sync_keys: no client access, key_hash never selectable
select throws_ok($$ select key_hash from public.sync_keys $$,
  '42501', null, 'denied: clients cannot select key_hash, even their own');
select throws_ok($$ select user_id, created_at from public.sync_keys $$,
  '42501', null, 'denied: clients cannot read sync_keys at all');
select throws_ok($$ insert into public.sync_keys (user_id, key_hash)
  values ('00000000-0000-4000-a000-00000000000a', 'deadbeef') $$,
  '42501', null, 'denied: clients cannot insert sync keys');
select throws_ok($$ update public.sync_keys set key_hash = 'deadbeef' $$,
  '42501', null, 'denied: clients cannot update sync keys');
select throws_ok($$ delete from public.sync_keys $$,
  '42501', null, 'denied: clients cannot delete sync keys');

-- audit_log: written only by server functions
select throws_ok($$ select * from public.audit_log $$,
  '42501', null, 'denied: clients cannot read audit_log directly');
select throws_ok($$ insert into public.audit_log (actor, action)
  values ('00000000-0000-4000-a000-00000000000a', 'forge') $$,
  '42501', null, 'denied: clients cannot insert audit_log');
select throws_ok($$ update public.audit_log set action = 'forge' $$,
  '42501', null, 'denied: clients cannot update audit_log');
select throws_ok($$ delete from public.audit_log $$,
  '42501', null, 'denied: clients cannot delete audit_log');

-- ---------------------------------------------------------------- as Cat (Crew Two)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select set_eq($$ select username from public.users $$, array['cat'], 'Cat sees only herself');
select set_eq($$ select name from public.crews $$, array['Crew Two'], 'Cat sees only Crew Two');
select set_eq($$ select steps from public.hours $$, array[3000], 'Cat reads only her own hours');
select is_empty($$ select 1 from public.daily_stats where user_id <> '00000000-0000-4000-a000-00000000000c' $$,
  'denied: Cat cannot read Crew One daily stats');

-- ---------------------------------------------------------------- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.users $$, '42501', null, 'denied: anon cannot read users');
select throws_ok($$ select * from public.crews $$, '42501', null, 'denied: anon cannot read crews');
select throws_ok($$ select * from public.crew_members $$, '42501', null, 'denied: anon cannot read crew_members');
select throws_ok($$ select * from public.hours $$, '42501', null, 'denied: anon cannot read hours');
select throws_ok($$ select * from public.daily_stats $$, '42501', null, 'denied: anon cannot read daily_stats');

-- ---------------------------------------------------------------- service role (Edge Functions)
reset role;
set local role service_role;
select lives_ok($$ insert into public.hours (user_id, hour_start_utc, steps)
  values ('00000000-0000-4000-a000-00000000000a', '2027-01-11 16:00:00+00', 500) $$,
  'the service role can write hours');
select lives_ok($$ update public.daily_stats set status = 'locked', locked_at = public.app_now()
  where user_id = '00000000-0000-4000-a000-00000000000a' $$,
  'the service role can lock a day');
select is((select count(*)::int from public.sync_keys where user_id::text like '00000000-0000-4000-a000-%'), 2,
  'the service role can read sync keys');

-- ---------------------------------------------------------------- results of the client attempts
reset role;
select is((select display_name from public.users where username = 'ann'), 'Annie', 'Ann''s own edit stuck');
select is((select display_name from public.users where username = 'ben'), 'Ben', 'Ben''s profile was not changed by Ann');

select * from finish();
rollback;
