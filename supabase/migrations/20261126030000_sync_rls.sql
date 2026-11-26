-- P0.3: row-level security for the sync schema (docs/PLAN.md §13, Appendix A9).
-- Members read only their own crew. Clients never write Health totals or the audit log; those are
-- written only by Edge Functions with the service role (CLAUDE.md golden rule 5).
-- source_hours, sync_keys and audit_log have no client access at all.

-- Start from nothing: Supabase's default privileges grant everything to anon and authenticated.
revoke all on table
  public.users, public.crews, public.crew_members, public.sync_keys,
  public.source_hours, public.hours, public.daily_stats, public.audit_log
from anon, authenticated;

alter table public.users enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.sync_keys enable row level security;
alter table public.source_hours enable row level security;
alter table public.hours enable row level security;
alter table public.daily_stats enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------- helpers
-- Security definer so policies on crew_members can ask about crew_members without recursing.
-- They live in the private schema, which the API does not expose.
create function private.my_crew_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.crew_id from public.crew_members m where m.user_id = (select auth.uid());
$$;

-- True when the target is the caller or shares a crew with the caller.
create function private.can_see_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = (select auth.uid())
    or exists (
      select 1
      from public.crew_members mine
      join public.crew_members theirs on theirs.crew_id = mine.crew_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = target
    );
$$;

revoke all on function private.my_crew_ids(), private.can_see_user(uuid), private.is_iana_zone(text) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.my_crew_ids(), private.can_see_user(uuid) to authenticated;
-- Zone check constraints run as the writing role.
grant execute on function private.is_iana_zone(text) to authenticated, service_role;

-- ---------------------------------------------------------------- users
grant select on table public.users to authenticated;
-- Users can edit only their own profile (A9). Email and id stay with auth.
grant update (display_name, username, avatar_url, default_tz) on table public.users to authenticated;

create policy users_select_crew on public.users
  for select to authenticated
  using (private.can_see_user(id));

create policy users_update_own on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- crews
-- Creating and joining crews goes through server functions in a later prompt.
grant select on table public.crews, public.crew_members to authenticated;

create policy crews_select_member on public.crews
  for select to authenticated
  using (id in (select private.my_crew_ids()));

create policy crew_members_select_member on public.crew_members
  for select to authenticated
  using (crew_id in (select private.my_crew_ids()));

-- ---------------------------------------------------------------- Health totals (read-only)
grant select on table public.hours, public.daily_stats to authenticated;

create policy hours_select_crew on public.hours
  for select to authenticated
  using (private.can_see_user(user_id));

create policy daily_stats_select_crew on public.daily_stats
  for select to authenticated
  using (private.can_see_user(user_id));

-- sync_keys, source_hours and audit_log: RLS on, no policies, no grants. Service role only.
