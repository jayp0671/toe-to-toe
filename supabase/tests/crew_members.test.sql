-- Crew membership values and active-only crew reads (docs/PLAN.md §13, §19, Appendix A9).
-- Fixture: Crew One has Ann (commissioner), Ben (member, later leaves) and Dan (member).
begin;
select plan(25);

-- ---------------------------------------------------------------- schema
select col_default_is('public', 'crew_members', 'role', 'member', 'role defaults to member');
select col_default_is('public', 'crew_members', 'status', 'active', 'status defaults to active');

-- ---------------------------------------------------------------- fixture (as postgres)
insert into auth.users (id, email) values
  ('00000000-0000-4000-c000-00000000000a', 'ann@crew.test'),
  ('00000000-0000-4000-c000-00000000000b', 'ben@crew.test'),
  ('00000000-0000-4000-c000-00000000000d', 'dan@crew.test');
insert into public.users (id, email, display_name, username, default_tz) values
  ('00000000-0000-4000-c000-00000000000a', 'ann@crew.test', 'Ann', 'crew_ann', 'America/New_York'),
  ('00000000-0000-4000-c000-00000000000b', 'ben@crew.test', 'Ben', 'crew_ben', 'America/Halifax'),
  ('00000000-0000-4000-c000-00000000000d', 'dan@crew.test', 'Dan', 'crew_dan', 'America/Vancouver');
insert into public.crews (id, name, invite_code, commissioner_id) values
  ('00000000-0000-4000-d000-000000000001', 'Crew One', 'CREW01', '00000000-0000-4000-c000-00000000000a');
insert into public.crew_members (crew_id, user_id, role) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-00000000000a', 'commissioner');
insert into public.crew_members (crew_id, user_id) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-00000000000b'),
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-00000000000d');
insert into public.hours (user_id, hour_start_utc, steps) values
  ('00000000-0000-4000-c000-00000000000a', '2027-01-11 15:00:00+00', 1000),
  ('00000000-0000-4000-c000-00000000000b', '2027-01-11 15:00:00+00', 2000),
  ('00000000-0000-4000-c000-00000000000d', '2027-01-11 15:00:00+00', 3000);
insert into public.daily_stats (user_id, local_date, home_tz, steps) values
  ('00000000-0000-4000-c000-00000000000a', '2027-01-11', 'America/New_York', 1000),
  ('00000000-0000-4000-c000-00000000000b', '2027-01-11', 'America/Halifax', 2000),
  ('00000000-0000-4000-c000-00000000000d', '2027-01-11', 'America/Vancouver', 3000);

-- The commissioner check is deferred to commit; force it now so each case is checked on its own.
set constraints all immediate;
select pass('fixture is consistent: Ann is commissioner on both crews and crew_members');

select is((select role from public.crew_members where user_id = '00000000-0000-4000-c000-00000000000b'),
  'member', 'a new member gets role member');
select is((select status from public.crew_members where user_id = '00000000-0000-4000-c000-00000000000b'),
  'active', 'a new member gets status active');

-- ---------------------------------------------------------------- bad values
select throws_ok(
  $$ update public.crew_members set role = 'admin' where user_id = '00000000-0000-4000-c000-00000000000b' $$,
  '23514', null, 'role rejects values other than commissioner / member');
select throws_ok(
  $$ update public.crew_members set status = 'banned' where user_id = '00000000-0000-4000-c000-00000000000b' $$,
  '23514', null, 'status rejects values other than active / left / removed');
select throws_ok(
  $$ update public.crew_members set role = null where user_id = '00000000-0000-4000-c000-00000000000b' $$,
  '23502', null, 'role cannot be null');
select lives_ok(
  $$ update public.crew_members set status = 'removed' where user_id = '00000000-0000-4000-c000-00000000000d';
     update public.crew_members set status = 'active' where user_id = '00000000-0000-4000-c000-00000000000d' $$,
  'status accepts removed and active');

-- ---------------------------------------------------------------- one commissioner
select throws_ok(
  $$ update public.crew_members set role = 'commissioner' where user_id = '00000000-0000-4000-c000-00000000000b' $$,
  '23505', null, 'a second commissioner in one crew is rejected');
select throws_ok(
  $$ update public.crew_members set status = 'left' where user_id = '00000000-0000-4000-c000-00000000000a' $$,
  '23514', null, 'the commissioner cannot leave without handing over first');
select throws_ok(
  $$ update public.crew_members set role = 'member' where user_id = '00000000-0000-4000-c000-00000000000a' $$,
  '23514', null, 'a crew cannot be left without a commissioner row');
select throws_ok(
  $$ update public.crews set commissioner_id = '00000000-0000-4000-c000-00000000000b'
     where id = '00000000-0000-4000-d000-000000000001' $$,
  '23514', null, 'crews.commissioner_id must match the commissioner row');
select throws_ok(
  $$ delete from public.crew_members where user_id = '00000000-0000-4000-c000-00000000000a' $$,
  '23514', null, 'the commissioner row cannot be deleted while the crew points at it');
select throws_ok(
  $$ insert into public.crews (name, invite_code, commissioner_id)
     values ('Empty', 'EMPTY1', '00000000-0000-4000-c000-00000000000b') $$,
  '23514', null, 'a crew needs its commissioner as a member');

-- Handing over in one transaction (deferred check) works.
set constraints all deferred;
select lives_ok(
  $$ update public.crew_members set role = 'member' where user_id = '00000000-0000-4000-c000-00000000000a';
     update public.crew_members set role = 'commissioner' where user_id = '00000000-0000-4000-c000-00000000000d';
     update public.crews set commissioner_id = '00000000-0000-4000-c000-00000000000d'
       where id = '00000000-0000-4000-d000-000000000001' $$,
  'the commissioner can be handed over');
set constraints all immediate;
select pass('hand-over leaves crews and crew_members consistent');
select is((select commissioner_id from public.crews where id = '00000000-0000-4000-d000-000000000001'),
  '00000000-0000-4000-c000-00000000000d'::uuid, 'Dan is now commissioner');

-- Ben leaves.
update public.crew_members set status = 'left' where user_id = '00000000-0000-4000-c000-00000000000b';

-- ---------------------------------------------------------------- as Ben (left)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-00000000000b","role":"authenticated"}', true);

select is_empty($$ select 1 from public.crews $$, 'denied: a member who left cannot read the crew');
select is_empty($$ select 1 from public.crew_members $$, 'denied: a member who left cannot read memberships');
select set_eq($$ select username from public.users $$, array['crew_ben'],
  'denied: a member who left sees only himself in users');
select set_eq($$ select steps from public.daily_stats $$, array[2000],
  'denied: a member who left sees only his own daily_stats');
select set_eq($$ select steps from public.hours $$, array[2000],
  'denied: a member who left sees only his own hours');

-- ---------------------------------------------------------------- as Ann (active)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-00000000000a","role":"authenticated"}', true);

select set_eq($$ select name from public.crews $$, array['Crew One'], 'an active member still reads her crew');
select set_eq($$ select steps from public.daily_stats $$, array[1000, 2000, 3000],
  'an active member reads crew daily_stats, including a former member''s past days');

reset role;
select * from finish();
rollback;
