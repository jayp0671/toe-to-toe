-- P0.5: database functions behind /sync and /api/sync-key/rotate (docs/PLAN.md Appendix A5, A9).
-- They are called only by Edge Functions with the service role.
begin;
select plan(23);

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.sync_auth(text)', 'execute'), 'anon cannot call sync_auth');
select ok(not has_function_privilege('authenticated', 'public.sync_auth(text)', 'execute'),
  'authenticated cannot call sync_auth');
select ok(not has_function_privilege('anon', 'public.sync_apply(uuid, text, jsonb, jsonb, jsonb)', 'execute'),
  'anon cannot call sync_apply');
select ok(not has_function_privilege('authenticated', 'public.sync_apply(uuid, text, jsonb, jsonb, jsonb)', 'execute'),
  'authenticated cannot call sync_apply');
select ok(not has_function_privilege('authenticated', 'public.sync_key_rotate(uuid, text)', 'execute'),
  'authenticated cannot call sync_key_rotate');
select ok(has_function_privilege('service_role', 'public.sync_apply(uuid, text, jsonb, jsonb, jsonb)', 'execute'),
  'service_role can call sync_apply');

-- ---------------------------------------------------------------- fixture
update public.app_config set test_mode = true, fake_now = '2027-01-11 14:00:00+00'; -- 9:00 AM ET Jan 11
insert into auth.users (id, email) values ('00000000-0000-4000-e000-00000000000a', 'fn-ann@test.local');
insert into public.users (id, email, display_name, username, default_tz) values
  ('00000000-0000-4000-e000-00000000000a', 'fn-ann@test.local', 'Ann', 'fn_ann', 'America/New_York');
insert into public.sync_keys (user_id, key_hash) values
  ('00000000-0000-4000-e000-00000000000a', encode(extensions.digest('ann-key', 'sha256'), 'hex'));

-- ---------------------------------------------------------------- sync_auth
select is_empty($$ select * from public.sync_auth(encode(extensions.digest('nope', 'sha256'), 'hex')) $$,
  'an unknown key hash finds nobody');
select results_eq(
  $$ select user_id, home_tz, server_now, rate_limited
     from public.sync_auth(encode(extensions.digest('ann-key', 'sha256'), 'hex')) $$,
  $$ values ('00000000-0000-4000-e000-00000000000a'::uuid, 'America/New_York', '2027-01-11 14:00:00+00'::timestamptz, false) $$,
  'a known key returns the user, home zone, app_now() and no rate limit');

-- ---------------------------------------------------------------- sync_apply
-- Jan 9 locked at noon Jan 10; Jan 10 is finalizing; Jan 11 is live.
select is(
  public.sync_apply('00000000-0000-4000-e000-00000000000a', 'America/New_York',
    '[{"local_date":"2027-01-09","steps":500,"flights":0,"distance_m":0,"sources":["A"],"status":"finalizing"},
      {"local_date":"2027-01-10","steps":2000,"flights":3,"distance_m":1021,"sources":["A","B"],"status":"finalizing"},
      {"local_date":"2027-01-11","steps":100,"flights":0,"distance_m":0,"sources":["A"],"status":"live"}]',
    '[{"hour_start_utc":"2027-01-09T15:00:00Z","local_date":"2027-01-09","steps":500,"flights":0,"distance_m":0},
      {"hour_start_utc":"2027-01-10T13:00:00Z","local_date":"2027-01-10","steps":2000,"flights":3,"distance_m":1021},
      {"hour_start_utc":"2027-01-11T13:00:00Z","local_date":"2027-01-11","steps":100,"flights":0,"distance_m":0}]',
    '[{"hour_start_utc":"2027-01-09T15:00:00Z","local_date":"2027-01-09","source_name":"A","steps":500,"flights":0,"distance_m":0},
      {"hour_start_utc":"2027-01-10T13:00:00Z","local_date":"2027-01-10","source_name":"A","steps":2000,"flights":3,"distance_m":1021},
      {"hour_start_utc":"2027-01-10T13:00:00Z","local_date":"2027-01-10","source_name":"B","steps":900,"flights":2,"distance_m":700},
      {"hour_start_utc":"2027-01-11T13:00:00Z","local_date":"2027-01-11","source_name":"A","steps":100,"flights":0,"distance_m":0}]'),
  '{"rate_limited": false, "dates": ["2027-01-10", "2027-01-11"]}'::jsonb,
  'sync_apply writes open dates and skips the locked one');
select set_eq($$ select local_date::text || ' ' || steps || ' ' || status from public.daily_stats
                 where user_id = '00000000-0000-4000-e000-00000000000a' $$,
  array['2027-01-10 2000 finalizing', '2027-01-11 100 live'], 'daily_stats rows for open dates only');
select set_eq($$ select steps from public.hours where user_id = '00000000-0000-4000-e000-00000000000a' $$,
  array[2000, 100], 'hours for open dates only');
select is((select count(*)::int from public.source_hours where user_id = '00000000-0000-4000-e000-00000000000a'),
  3, 'source_hours for open dates only');
select is((select last_used_at from public.sync_keys where user_id = '00000000-0000-4000-e000-00000000000a'),
  '2027-01-11 14:00:00+00'::timestamptz, 'last_used_at is app_now()');
select is((select rate_limited from public.sync_auth(encode(extensions.digest('ann-key', 'sha256'), 'hex'))),
  true, 'sync_auth reports the rate limit right after a sync');
select is(
  public.sync_apply('00000000-0000-4000-e000-00000000000a', 'America/New_York', '[]', '[]', '[]'),
  '{"rate_limited": true}'::jsonb, 'a second sync inside 30 seconds is refused');

update public.app_config set fake_now = '2027-01-11 14:00:30+00';
select is((select rate_limited from public.sync_auth(encode(extensions.digest('ann-key', 'sha256'), 'hex'))),
  false, '30 seconds later the key may sync again');

-- A day locked by status (a review) is skipped even before noon.
update public.daily_stats set status = 'review'
  where user_id = '00000000-0000-4000-e000-00000000000a' and local_date = '2027-01-10';
select is(
  public.sync_apply('00000000-0000-4000-e000-00000000000a', 'America/New_York',
    '[{"local_date":"2027-01-10","steps":9999,"flights":0,"distance_m":0,"sources":["A"],"status":"finalizing"}]',
    '[{"hour_start_utc":"2027-01-10T13:00:00Z","local_date":"2027-01-10","steps":9999,"flights":0,"distance_m":0}]',
    '[]'),
  '{"rate_limited": false, "dates": []}'::jsonb, 'a day under review is not open');
select is((select steps from public.daily_stats
           where user_id = '00000000-0000-4000-e000-00000000000a' and local_date = '2027-01-10'),
  2000, 'the day under review keeps its total');
select is((select steps from public.hours
           where user_id = '00000000-0000-4000-e000-00000000000a' and hour_start_utc = '2027-01-10 13:00:00+00'),
  2000, 'the day under review keeps its hours');

-- ---------------------------------------------------------------- sync_key_rotate
select lives_ok($$ select public.sync_key_rotate('00000000-0000-4000-e000-00000000000a',
                     encode(extensions.digest('ann-key-2', 'sha256'), 'hex')) $$, 'rotate runs');
select is_empty($$ select * from public.sync_auth(encode(extensions.digest('ann-key', 'sha256'), 'hex')) $$,
  'the old key stops working');
select isnt_empty($$ select * from public.sync_auth(encode(extensions.digest('ann-key-2', 'sha256'), 'hex')) $$,
  'the new key works');
select is((select count(*)::int from public.audit_log
           where actor = '00000000-0000-4000-e000-00000000000a' and action = 'sync_key.rotate'),
  1, 'rotation is written to the audit log');

select * from finish();
rollback;
