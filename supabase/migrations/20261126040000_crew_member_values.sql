-- Crew membership values (docs/PLAN.md §13, §19). P0.3 left crew_members.role and .status as free
-- text and let any membership row grant crew reads. This migration:
--   1. constrains role to commissioner | member and status to active | left | removed;
--   2. allows at most one commissioner per crew, who must be active;
--   3. keeps crews.commissioner_id and the commissioner row in step (checked at commit);
--   4. lets only active members read a crew's data.
--
-- Source of truth: crews.commissioner_id names the commissioner. The crew_members row with
-- role = 'commissioner' must be that same user, so the two can never disagree. Hand over by
-- changing both in one transaction.

alter table public.crew_members
  add constraint crew_members_role_check check (role in ('commissioner', 'member')),
  add constraint crew_members_status_check check (status in ('active', 'left', 'removed')),
  -- A commissioner who leaves or is removed must hand over first.
  add constraint crew_members_commissioner_active_check check (role <> 'commissioner' or status = 'active');

create unique index crew_members_one_commissioner_idx
  on public.crew_members (crew_id) where role = 'commissioner';

-- ---------------------------------------------------------------- commissioner consistency
-- Raises unless the crew's commissioner_id has the crew's commissioner row. With the unique index
-- above, that means exactly one commissioner, and it is crews.commissioner_id.
create function private.check_crew_commissioner(p_crew_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_commissioner uuid;
begin
  select c.commissioner_id into v_commissioner from public.crews c where c.id = p_crew_id;
  if not found then
    return; -- the crew was deleted
  end if;
  if not exists (
    select 1 from public.crew_members m
    where m.crew_id = p_crew_id and m.user_id = v_commissioner and m.role = 'commissioner'
  ) then
    raise exception 'crew % must have its commissioner_id % as its commissioner member', p_crew_id, v_commissioner
      using errcode = 'check_violation';
  end if;
end;
$$;

create function private.crews_commissioner_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_crew_commissioner(new.id);
  return null;
end;
$$;

create function private.crew_members_commissioner_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.check_crew_commissioner(old.crew_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.check_crew_commissioner(new.crew_id);
  end if;
  return null;
end;
$$;

-- Deferred to commit so a crew and its first member, or a hand-over, can be written in any order.
create constraint trigger crews_commissioner_check
  after insert or update of commissioner_id on public.crews
  deferrable initially deferred
  for each row execute function private.crews_commissioner_trigger();

create constraint trigger crew_members_commissioner_check
  after insert or update or delete on public.crew_members
  deferrable initially deferred
  for each row execute function private.crew_members_commissioner_trigger();

revoke all on function
  private.check_crew_commissioner(uuid),
  private.crews_commissioner_trigger(),
  private.crew_members_commissioner_trigger()
from public;

-- ---------------------------------------------------------------- active-only reads
-- Same signatures as P0.3, so every policy that calls them picks up the change.
-- Only the caller's ACTIVE memberships count. A crew-mate is anyone with a membership row in one of
-- those crews, whatever its status, so active members still see former players' past days.
create or replace function private.my_crew_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.crew_id from public.crew_members m
  where m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create or replace function private.can_see_user(target uuid)
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
      where mine.user_id = (select auth.uid()) and mine.status = 'active' and theirs.user_id = target
    );
$$;
