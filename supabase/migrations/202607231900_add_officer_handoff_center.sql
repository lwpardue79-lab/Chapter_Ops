-- Officer Handoff Center for AO Command.
-- Adds persistent, RLS-protected transition records for each Executive Team position.

create table if not exists public.officer_handoffs (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  position_title text not null,
  outgoing_member_id text,
  incoming_member_id text,
  term_label text not null default '',
  responsibilities text not null default '',
  recurring_duties text not null default '',
  important_dates text not null default '',
  current_projects text not null default '',
  open_tasks text not null default '',
  key_contacts text not null default '',
  files_url text not null default '',
  procedures text not null default '',
  lessons_learned text not null default '',
  recommendations text not null default '',
  private_transition_notes text not null default '',
  status text not null default 'Not started',
  incoming_acknowledged_at timestamptz,
  president_acknowledged_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint officer_handoffs_status_check check (status in ('Not started', 'In progress', 'Ready for review', 'Completed', 'Archived')),
  constraint officer_handoffs_position_not_blank check (length(trim(position_title)) > 0)
);

alter table public.officer_handoffs enable row level security;

create index if not exists officer_handoffs_chapter_position_idx on public.officer_handoffs(chapter_id, position_title);
create index if not exists officer_handoffs_chapter_status_idx on public.officer_handoffs(chapter_id, status, updated_at desc);

insert into public.app_role_permissions (role, permission_key)
select role, permission_key
from (
  values
    ('admin', 'handoffs.view'),
    ('admin', 'handoffs.manage'),
    ('president', 'handoffs.view'),
    ('president', 'handoffs.manage'),
    ('vpmd', 'handoffs.view'),
    ('vpmd', 'handoffs.manage_own'),
    ('recruitment', 'handoffs.view'),
    ('recruitment', 'handoffs.manage_own'),
    ('treasurer', 'handoffs.view'),
    ('treasurer', 'handoffs.manage_own'),
    ('assistant_treasurer', 'handoffs.view'),
    ('assistant_treasurer', 'handoffs.manage_own'),
    ('secretary', 'handoffs.view'),
    ('secretary', 'handoffs.manage_own'),
    ('executive', 'handoffs.view'),
    ('executive', 'handoffs.manage_own'),
    ('committee_chair', 'handoffs.view'),
    ('committee_chair', 'handoffs.manage_own'),
    ('advisor', 'handoffs.view')
) as permissions(role, permission_key)
on conflict (role, permission_key) do nothing;

create or replace function app_private.canonical_officer_position(p_position text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text := lower(trim(coalesce(p_position, '')));
begin
  v_key := regexp_replace(v_key, '^tpe[_\s-]*', '', 'i');
  v_key := regexp_replace(v_key, '[^a-z0-9]+', ' ', 'g');
  v_key := trim(replace(v_key, 'chairman', 'chair'));

  if v_key in ('vpmd', 'vp membership development', 'vice president of membership development', 'vice president membership development', 'membership development', 'brotherhood', 'brotherhood chair', 'brotherhood vpmd', 'vpmd brotherhood') then
    return 'VPMD';
  elsif v_key in ('recruitment', 'recruitment chair', 'rush', 'new member recruitment') then
    return 'Recruitment';
  elsif v_key in ('risk manager', 'risk management') then
    return 'Risk Management';
  elsif v_key in ('health safety', 'health and safety', 'health and safety officer') then
    return 'Health and Safety';
  elsif v_key in ('new member educator', 'new member education') then
    return 'New Member Education';
  elsif v_key in ('alumni relations', 'alumni relations chair') then
    return 'Alumni Relations';
  elsif v_key in ('social chair', 'social') then
    return 'Social';
  elsif v_key in ('philanthropy chair', 'philanthropy') then
    return 'Philanthropy';
  elsif v_key = 'sergeant at arms' then
    return 'Sergeant at Arms';
  end if;

  return trim(regexp_replace(coalesce(p_position, ''), '^TPE[_\s-]*', '', 'i'));
end;
$$;

create or replace function app_private.current_user_holds_officer_position(p_chapter_id uuid, p_position text)
returns boolean
language sql
security definer
set search_path = app_private, public, pg_catalog
as $$
  with current_member as (
    select public.current_member_id(p_chapter_id) as member_id
  ),
  workspace as (
    select coalesce(ws.data, '{}'::jsonb) as data
    from public.workspace_state ws
    where ws.organization_id = p_chapter_id
  ),
  assignments as (
    select item
    from workspace, jsonb_array_elements(coalesce(data->'leadership', '[]'::jsonb)) item
    union all
    select jsonb_build_object('assignedMember', member->>'id', 'role', member->>'officerRole')
    from workspace, jsonb_array_elements(coalesce(data->'members', '[]'::jsonb)) member
    where coalesce(member->>'officerRole', '') <> ''
  )
  select exists (
    select 1
    from assignments, current_member
    where current_member.member_id is not null
      and coalesce(item->>'archived', 'false') <> 'true'
      and coalesce(item->>'assignedMember', item->>'memberId', item->>'member_id') = current_member.member_id
      and app_private.canonical_officer_position(item->>'role') = app_private.canonical_officer_position(p_position)
  );
$$;

create or replace function app_private.can_manage_handoff(p_chapter_id uuid, p_position text)
returns boolean
language sql
security definer
set search_path = app_private, public
as $$
  select public.has_chapter_permission(p_chapter_id, 'handoffs.manage')
      or public.has_chapter_permission(p_chapter_id, 'all')
      or (
        public.has_chapter_permission(p_chapter_id, 'handoffs.manage_own')
        and app_private.current_user_holds_officer_position(p_chapter_id, p_position)
      );
$$;

create or replace function public.upsert_officer_handoff(p_handoff_id uuid, p_handoff jsonb)
returns public.officer_handoffs
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_position text;
  v_status text := coalesce(nullif(p_handoff->>'status', ''), 'Not started');
  v_row public.officer_handoffs%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  v_org_id := coalesce(
    app_private.current_org_for_permission('handoffs.manage'),
    app_private.current_org_for_permission('handoffs.manage_own')
  );
  if v_org_id is null then
    raise exception 'Officer handoff access is required.' using errcode = '42501';
  end if;

  v_position := app_private.canonical_officer_position(p_handoff->>'positionTitle');
  if nullif(trim(v_position), '') is null then
    raise exception 'Executive position is required.' using errcode = '22023';
  end if;
  if v_status not in ('Not started', 'In progress', 'Ready for review', 'Completed', 'Archived') then
    raise exception 'Invalid handoff status.' using errcode = '22023';
  end if;
  if not app_private.can_manage_handoff(v_org_id, v_position) then
    raise exception 'You can only edit handoffs for your own position unless you are President or Admin.' using errcode = '42501';
  end if;

  if p_handoff_id is null then
    insert into public.officer_handoffs (
      chapter_id, position_title, outgoing_member_id, incoming_member_id,
      term_label, responsibilities, recurring_duties, important_dates,
      current_projects, open_tasks, key_contacts, files_url, procedures,
      lessons_learned, recommendations, private_transition_notes, status,
      created_by, updated_by
    )
    values (
      v_org_id,
      v_position,
      nullif(p_handoff->>'outgoingMemberId', ''),
      nullif(p_handoff->>'incomingMemberId', ''),
      coalesce(p_handoff->>'termLabel', ''),
      coalesce(p_handoff->>'responsibilities', ''),
      coalesce(p_handoff->>'recurringDuties', ''),
      coalesce(p_handoff->>'importantDates', ''),
      coalesce(p_handoff->>'currentProjects', ''),
      coalesce(p_handoff->>'openTasks', ''),
      coalesce(p_handoff->>'keyContacts', ''),
      coalesce(p_handoff->>'filesUrl', ''),
      coalesce(p_handoff->>'procedures', ''),
      coalesce(p_handoff->>'lessonsLearned', ''),
      coalesce(p_handoff->>'recommendations', ''),
      coalesce(p_handoff->>'privateTransitionNotes', ''),
      v_status,
      (select auth.uid()),
      (select auth.uid())
    )
    returning * into v_row;
    perform public.log_audit_event(v_org_id, 'officer_handoff_created', 'officer_handoff', v_row.id::text, jsonb_build_object('position', v_position, 'status', v_status), true, 'officer_handoffs');
  else
    update public.officer_handoffs
       set position_title = v_position,
           outgoing_member_id = nullif(p_handoff->>'outgoingMemberId', ''),
           incoming_member_id = nullif(p_handoff->>'incomingMemberId', ''),
           term_label = coalesce(p_handoff->>'termLabel', ''),
           responsibilities = coalesce(p_handoff->>'responsibilities', ''),
           recurring_duties = coalesce(p_handoff->>'recurringDuties', ''),
           important_dates = coalesce(p_handoff->>'importantDates', ''),
           current_projects = coalesce(p_handoff->>'currentProjects', ''),
           open_tasks = coalesce(p_handoff->>'openTasks', ''),
           key_contacts = coalesce(p_handoff->>'keyContacts', ''),
           files_url = coalesce(p_handoff->>'filesUrl', ''),
           procedures = coalesce(p_handoff->>'procedures', ''),
           lessons_learned = coalesce(p_handoff->>'lessonsLearned', ''),
           recommendations = coalesce(p_handoff->>'recommendations', ''),
           private_transition_notes = coalesce(p_handoff->>'privateTransitionNotes', ''),
           status = v_status,
           updated_by = (select auth.uid()),
           updated_at = now()
     where id = p_handoff_id
       and chapter_id = v_org_id
     returning * into v_row;
    if not found then
      raise exception 'Officer handoff record was not found.' using errcode = '02000';
    end if;
    perform public.log_audit_event(v_org_id, 'officer_handoff_updated', 'officer_handoff', v_row.id::text, jsonb_build_object('position', v_position, 'status', v_status), true, 'officer_handoffs');
  end if;

  return v_row;
end;
$$;

create or replace function public.acknowledge_officer_handoff(p_handoff_id uuid, p_acknowledgement text)
returns public.officer_handoffs
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_row public.officer_handoffs%rowtype;
begin
  select * into v_row
  from public.officer_handoffs
  where id = p_handoff_id
    and (
      app_private.can_manage_handoff(chapter_id, position_title)
      or public.has_chapter_permission(chapter_id, 'handoffs.manage')
      or public.has_chapter_permission(chapter_id, 'all')
    )
  for update;

  if not found then
    raise exception 'Officer handoff record was not found or access is restricted.' using errcode = '42501';
  end if;

  if lower(coalesce(p_acknowledgement, '')) = 'president' then
    if not (public.has_chapter_permission(v_row.chapter_id, 'handoffs.manage') or public.has_chapter_permission(v_row.chapter_id, 'all')) then
      raise exception 'President or Admin access is required for president acknowledgement.' using errcode = '42501';
    end if;
    update public.officer_handoffs
       set president_acknowledged_at = now(),
           updated_by = (select auth.uid()),
           updated_at = now()
     where id = p_handoff_id
     returning * into v_row;
  else
    update public.officer_handoffs
       set incoming_acknowledged_at = now(),
           updated_by = (select auth.uid()),
           updated_at = now()
     where id = p_handoff_id
     returning * into v_row;
  end if;

  perform public.log_audit_event(v_row.chapter_id, 'officer_handoff_acknowledged', 'officer_handoff', v_row.id::text, jsonb_build_object('position', v_row.position_title, 'acknowledgement', p_acknowledgement), true, 'officer_handoffs');
  return v_row;
end;
$$;

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'officer_handoffs'
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy "Authorized users can read officer handoffs"
on public.officer_handoffs
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'handoffs.view')
  or public.has_chapter_permission(chapter_id, 'handoffs.manage')
  or public.has_chapter_permission(chapter_id, 'all')
  or app_private.can_manage_handoff(chapter_id, position_title)
);

create policy "Authorized users can create officer handoffs"
on public.officer_handoffs
for insert
to authenticated
with check (app_private.can_manage_handoff(chapter_id, position_title));

create policy "Authorized users can update officer handoffs"
on public.officer_handoffs
for update
to authenticated
using (app_private.can_manage_handoff(chapter_id, position_title))
with check (app_private.can_manage_handoff(chapter_id, position_title));

revoke all on public.officer_handoffs from anon;
grant select, insert, update on public.officer_handoffs to authenticated;

revoke all on function public.upsert_officer_handoff(uuid, jsonb) from public;
revoke all on function public.upsert_officer_handoff(uuid, jsonb) from anon;
grant execute on function public.upsert_officer_handoff(uuid, jsonb) to authenticated;

revoke all on function public.acknowledge_officer_handoff(uuid, text) from public;
revoke all on function public.acknowledge_officer_handoff(uuid, text) from anon;
grant execute on function public.acknowledge_officer_handoff(uuid, text) to authenticated;

revoke all on function app_private.canonical_officer_position(text) from public;
revoke all on function app_private.canonical_officer_position(text) from anon;
grant execute on function app_private.canonical_officer_position(text) to authenticated;

revoke all on function app_private.current_user_holds_officer_position(uuid, text) from public;
revoke all on function app_private.current_user_holds_officer_position(uuid, text) from anon;
grant execute on function app_private.current_user_holds_officer_position(uuid, text) to authenticated;

revoke all on function app_private.can_manage_handoff(uuid, text) from public;
revoke all on function app_private.can_manage_handoff(uuid, text) from anon;
grant execute on function app_private.can_manage_handoff(uuid, text) to authenticated;
