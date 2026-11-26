-- P0.2: app_config test mode and app_now() (docs/PLAN.md Appendix A8, CLAUDE.md golden rule 2).
begin;
select plan(12);

select has_table('public', 'app_config', 'app_config exists');
select col_default_is('public', 'app_config', 'test_mode', 'false', 'test_mode defaults to false');
select is(
  (select count(*)::int from public.app_config), 1, 'app_config has exactly one row'
);
select is(
  (select test_mode from public.app_config), false, 'test mode is off after migrations'
);
select is(
  (select fake_now from public.app_config), null::timestamptz, 'no fake time is set'
);

select has_function('public', 'app_now', array[]::text[], 'app_now() exists');
select function_returns('public', 'app_now', array[]::text[], 'timestamp with time zone', 'app_now() returns timestamptz');
select is(public.app_now(), now(), 'app_now() returns now() while test mode is off');

select throws_ok(
  $$ insert into public.app_config default values $$,
  '23505', null, 'app_config cannot get a second row'
);
select throws_ok(
  $$ update public.app_config set test_mode = true $$,
  '23514', null, 'test mode needs a fake time'
);

update public.app_config set test_mode = true, fake_now = '2027-01-11 17:00:00+00';
select is(public.app_now(), '2027-01-11 17:00:00+00'::timestamptz, 'app_now() returns the fake time in test mode');

set local role anon;
select throws_ok(
  $$ select test_mode from public.app_config $$,
  '42501', null, 'clients cannot read app_config'
);
reset role;

select * from finish();
rollback;
