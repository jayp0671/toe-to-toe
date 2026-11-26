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

insert into public.crews (id, name, invite_code, commissioner_id) values
  ('00000000-0000-4000-9000-000000000001', 'Local Crew', 'LOCAL1', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-9000-000000000002', 'Smoke Crew', 'SMOKE1', '00000000-0000-4000-8000-000000000010');

insert into public.crew_members (crew_id, user_id, role)
select
  '00000000-0000-4000-9000-000000000001',
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  case when n = 1 then 'commissioner' else 'member' end
from generate_series(1, 9) n;

insert into public.crew_members (crew_id, user_id, role) values
  ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-000000000010', 'commissioner');
