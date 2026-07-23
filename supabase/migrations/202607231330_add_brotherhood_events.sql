-- Brotherhood Events production slice for AO Command.
-- Adds Supabase-backed event management, RSVPs, attendance, recaps, auditability,
-- duplicate prevention, and server-side permissions for VPMD/President/Admin.

create table if not exists public.brotherhood_events (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'Brotherhood',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  location_instructions text not null default '',
  organizer_member_id text,
  assigned_officer_member_id text,
  required boolean not null default false,
  audience text not null default 'All Active Members',
  rsvp_deadline timestamptz,
  capacity integer,
  waitlist_enabled boolean not null default false,
  allow_maybe boolean not null default true,
  excuse_required_for_required boolean not null default true,
  attendance_method text not null default 'Member roster check-off',
  attendance_opens_at timestamptz,
  attendance_closes_at timestamptz,
  participation_point_value numeric not null default 0,
  cover_image_url text not null default '',
  member_visible_notes text not null default '',
  status text not null default 'Draft',
  published_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brotherhood_events_category_check check (category in ('Brotherhood', 'Member Development', 'Chapter Meeting', 'Service', 'Philanthropy', 'Social', 'Academic', 'Alumni', 'Recruitment', 'Other')),
  constraint brotherhood_events_status_check check (status in ('Draft', 'Published', 'Completed', 'Cancelled', 'Archived')),
  constraint brotherhood_events_time_check check (ends_at > starts_at),
  constraint brotherhood_events_capacity_check check (capacity is null or capacity >= 0),
  constraint brotherhood_events_points_check check (participation_point_value >= 0)
);

create table if not exists public.brotherhood_event_private_notes (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.brotherhood_events(id) on delete cascade,
  private_officer_notes text not null default '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brotherhood_event_private_notes_unique unique (event_id)
);

create table if not exists public.brotherhood_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.brotherhood_events(id) on delete cascade,
  member_id text not null,
  user_id uuid,
  status text not null,
  excuse_note text not null default '',
  waitlist_status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brotherhood_event_rsvps_status_check check (status in ('Attending', 'Not attending', 'Maybe')),
  constraint brotherhood_event_rsvps_waitlist_check check (waitlist_status in ('confirmed', 'waitlisted', 'not_applicable')),
  constraint brotherhood_event_rsvps_unique unique (event_id, member_id)
);

create table if not exists public.brotherhood_event_attendance (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.brotherhood_events(id) on delete cascade,
  member_id text not null,
  status text not null,
  check_in_at timestamptz,
  check_in_method text not null default 'Officer manual check-in',
  suspicious boolean not null default false,
  previous_status text,
  correction_reason text not null default '',
  marked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brotherhood_event_attendance_status_check check (status in ('Present', 'Absent', 'Excused', 'Late', 'Left early')),
  constraint brotherhood_event_attendance_unique unique (event_id, member_id)
);

create table if not exists public.brotherhood_event_recaps (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.brotherhood_events(id) on delete cascade,
  attendance_count integer not null default 0,
  rsvp_count integer not null default 0,
  estimated_cost_cents integer not null default 0,
  actual_cost_cents integer not null default 0,
  went_well text not null default '',
  improvements text not null default '',
  member_feedback text not null default '',
  recommended_changes text not null default '',
  repeat_event text not null default 'Not sure',
  files_url text not null default '',
  private_officer_notes text not null default '',
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brotherhood_event_recaps_unique unique (event_id),
  constraint brotherhood_event_recaps_repeat_check check (repeat_event in ('Yes', 'No', 'Not sure'))
);

alter table public.brotherhood_events enable row level security;
alter table public.brotherhood_event_private_notes enable row level security;
alter table public.brotherhood_event_rsvps enable row level security;
alter table public.brotherhood_event_attendance enable row level security;
alter table public.brotherhood_event_recaps enable row level security;

create index if not exists brotherhood_events_chapter_starts_idx on public.brotherhood_events(chapter_id, starts_at desc);
create index if not exists brotherhood_events_chapter_status_idx on public.brotherhood_events(chapter_id, status, starts_at);
create index if not exists brotherhood_rsvps_event_status_idx on public.brotherhood_event_rsvps(event_id, status, waitlist_status);
create index if not exists brotherhood_attendance_event_status_idx on public.brotherhood_event_attendance(event_id, status);

insert into public.app_role_permissions (role, permission_key)
select role, permission_key
from (
  values
    ('admin', 'events.view'),
    ('admin', 'events.member.view'),
    ('admin', 'events.rsvp'),
    ('admin', 'brotherhood.events.admin.view'),
    ('admin', 'brotherhood.events.manage'),
    ('president', 'events.view'),
    ('president', 'brotherhood.events.admin.view'),
    ('president', 'brotherhood.events.manage'),
    ('vpmd', 'events.view'),
    ('vpmd', 'brotherhood.events.admin.view'),
    ('vpmd', 'brotherhood.events.manage'),
    ('executive', 'events.view'),
    ('executive', 'brotherhood.events.admin.view'),
    ('secretary', 'events.view'),
    ('secretary', 'brotherhood.events.admin.view'),
    ('treasurer', 'events.view'),
    ('treasurer', 'brotherhood.events.admin.view'),
    ('assistant_treasurer', 'events.view'),
    ('assistant_treasurer', 'brotherhood.events.admin.view'),
    ('recruitment', 'events.view'),
    ('recruitment', 'brotherhood.events.admin.view'),
    ('committee_chair', 'events.view'),
    ('committee_chair', 'brotherhood.events.admin.view'),
    ('advisor', 'events.view'),
    ('advisor', 'brotherhood.events.admin.view'),
    ('member', 'events.member.view'),
    ('member', 'events.rsvp')
) as permissions(role, permission_key)
on conflict (role, permission_key) do nothing;

create or replace function app_private.current_org_for_permission(p_permission text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select om.organization_id
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  where om.user_id = (select auth.uid())
    and p.approval_status = 'approved'
    and coalesce(om.status, 'active') = 'active'
    and (
      public.has_chapter_permission(om.organization_id, p_permission)
      or public.has_chapter_permission(om.organization_id, 'all')
    )
  order by om.created_at asc
  limit 1;
$$;

create or replace function app_private.workspace_member_exists(p_chapter_id uuid, p_member_id text)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.workspace_state ws,
         jsonb_array_elements(coalesce(ws.data->'members', '[]'::jsonb)) member
    where ws.organization_id = p_chapter_id
      and member->>'id' = p_member_id
      and coalesce(member->>'archived', 'false') <> 'true'
      and coalesce(member->>'deletedAt', '') = ''
      and coalesce(member->>'lifecycle', '') <> 'Archived'
      and coalesce(member->>'memberStatus', '') not in ('Archived', 'Alumni', 'Inactive')
  );
$$;

create or replace function app_private.brotherhood_member_can_see(p_event public.brotherhood_events)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_event.status = 'Published'
     and p_event.chapter_id = public.current_member_organization_id()
     and public.current_member_id(p_event.chapter_id) is not null;
$$;

create or replace function public.upsert_brotherhood_event(p_event_id uuid, p_event jsonb)
returns public.brotherhood_events
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_row public.brotherhood_events%rowtype;
  v_status text := coalesce(p_event->>'status', 'Draft');
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  v_org_id := app_private.current_org_for_permission('brotherhood.events.manage');
  if v_org_id is null then
    raise exception 'VPMD, President, or Admin access is required to manage Brotherhood Events.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_event->>'title', '')), '') is null then
    raise exception 'Event title is required.' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_event->>'description', '')), '') is null then
    raise exception 'Event description is required.' using errcode = '22023';
  end if;
  if (p_event->>'startsAt')::timestamptz is null or (p_event->>'endsAt')::timestamptz is null then
    raise exception 'Start and end date/time are required.' using errcode = '22023';
  end if;
  if (p_event->>'endsAt')::timestamptz <= (p_event->>'startsAt')::timestamptz then
    raise exception 'End time must be after start time.' using errcode = '22023';
  end if;
  if v_status not in ('Draft', 'Published', 'Completed', 'Cancelled', 'Archived') then
    raise exception 'Invalid event status.' using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.brotherhood_events (
      chapter_id, title, description, category, starts_at, ends_at, location,
      location_instructions, organizer_member_id, assigned_officer_member_id,
      required, audience, rsvp_deadline, capacity, waitlist_enabled, allow_maybe,
      excuse_required_for_required, attendance_method, attendance_opens_at,
      attendance_closes_at, participation_point_value, cover_image_url,
      member_visible_notes, status, published_at, created_by, updated_by
    )
    values (
      v_org_id,
      trim(p_event->>'title'),
      trim(coalesce(p_event->>'description', '')),
      coalesce(nullif(p_event->>'category', ''), 'Brotherhood'),
      (p_event->>'startsAt')::timestamptz,
      (p_event->>'endsAt')::timestamptz,
      trim(coalesce(p_event->>'location', '')),
      coalesce(p_event->>'locationInstructions', ''),
      nullif(p_event->>'organizerMemberId', ''),
      nullif(p_event->>'assignedOfficerMemberId', ''),
      coalesce((p_event->>'required')::boolean, false),
      coalesce(nullif(p_event->>'audience', ''), 'All Active Members'),
      nullif(p_event->>'rsvpDeadline', '')::timestamptz,
      nullif(p_event->>'capacity', '')::integer,
      coalesce((p_event->>'waitlistEnabled')::boolean, false),
      coalesce((p_event->>'allowMaybe')::boolean, true),
      coalesce((p_event->>'excuseRequiredForRequired')::boolean, true),
      coalesce(nullif(p_event->>'attendanceMethod', ''), 'Member roster check-off'),
      nullif(p_event->>'attendanceOpensAt', '')::timestamptz,
      nullif(p_event->>'attendanceClosesAt', '')::timestamptz,
      coalesce((p_event->>'participationPointValue')::numeric, 0),
      coalesce(p_event->>'coverImageUrl', ''),
      coalesce(p_event->>'memberVisibleNotes', ''),
      v_status,
      case when v_status = 'Published' then now() else null end,
      (select auth.uid()),
      (select auth.uid())
    )
    returning * into v_row;
    perform public.log_audit_event(v_org_id, 'brotherhood_event_created', 'brotherhood_event', v_row.id::text, jsonb_build_object('title', v_row.title, 'status', v_row.status), true, 'brotherhood_events');
  else
    update public.brotherhood_events
       set title = trim(p_event->>'title'),
           description = trim(coalesce(p_event->>'description', '')),
           category = coalesce(nullif(p_event->>'category', ''), 'Brotherhood'),
           starts_at = (p_event->>'startsAt')::timestamptz,
           ends_at = (p_event->>'endsAt')::timestamptz,
           location = trim(coalesce(p_event->>'location', '')),
           location_instructions = coalesce(p_event->>'locationInstructions', ''),
           organizer_member_id = nullif(p_event->>'organizerMemberId', ''),
           assigned_officer_member_id = nullif(p_event->>'assignedOfficerMemberId', ''),
           required = coalesce((p_event->>'required')::boolean, false),
           audience = coalesce(nullif(p_event->>'audience', ''), 'All Active Members'),
           rsvp_deadline = nullif(p_event->>'rsvpDeadline', '')::timestamptz,
           capacity = nullif(p_event->>'capacity', '')::integer,
           waitlist_enabled = coalesce((p_event->>'waitlistEnabled')::boolean, false),
           allow_maybe = coalesce((p_event->>'allowMaybe')::boolean, true),
           excuse_required_for_required = coalesce((p_event->>'excuseRequiredForRequired')::boolean, true),
           attendance_method = coalesce(nullif(p_event->>'attendanceMethod', ''), 'Member roster check-off'),
           attendance_opens_at = nullif(p_event->>'attendanceOpensAt', '')::timestamptz,
           attendance_closes_at = nullif(p_event->>'attendanceClosesAt', '')::timestamptz,
           participation_point_value = coalesce((p_event->>'participationPointValue')::numeric, 0),
           cover_image_url = coalesce(p_event->>'coverImageUrl', ''),
           member_visible_notes = coalesce(p_event->>'memberVisibleNotes', ''),
           status = v_status,
           published_at = case when v_status = 'Published' and published_at is null then now() else published_at end,
           updated_by = (select auth.uid()),
           updated_at = now()
     where id = p_event_id
       and chapter_id = v_org_id
     returning * into v_row;
    if not found then
      raise exception 'Brotherhood Event not found.' using errcode = '02000';
    end if;
    perform public.log_audit_event(v_org_id, 'brotherhood_event_edited', 'brotherhood_event', v_row.id::text, jsonb_build_object('title', v_row.title, 'status', v_row.status), true, 'brotherhood_events');
  end if;

  insert into public.brotherhood_event_private_notes (chapter_id, event_id, private_officer_notes, created_by, updated_by)
  values (v_org_id, v_row.id, coalesce(p_event->>'privateOfficerNotes', ''), (select auth.uid()), (select auth.uid()))
  on conflict (event_id) do update
     set private_officer_notes = excluded.private_officer_notes,
         updated_by = (select auth.uid()),
         updated_at = now();

  return v_row;
end;
$$;

create or replace function public.set_brotherhood_event_status(p_event_id uuid, p_status text)
returns public.brotherhood_events
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_previous text;
  v_row public.brotherhood_events%rowtype;
begin
  v_org_id := app_private.current_org_for_permission('brotherhood.events.manage');
  if v_org_id is null then
    raise exception 'VPMD, President, or Admin access is required.' using errcode = '42501';
  end if;
  if p_status not in ('Draft', 'Published', 'Completed', 'Cancelled', 'Archived') then
    raise exception 'Invalid event status.' using errcode = '22023';
  end if;
  select status into v_previous from public.brotherhood_events where id = p_event_id and chapter_id = v_org_id for update;
  if not found then
    raise exception 'Brotherhood Event not found.' using errcode = '02000';
  end if;
  update public.brotherhood_events
     set status = p_status,
         published_at = case when p_status = 'Published' and published_at is null then now() else published_at end,
         updated_by = (select auth.uid()),
         updated_at = now()
   where id = p_event_id and chapter_id = v_org_id
   returning * into v_row;
  perform public.log_audit_event(v_org_id, 'brotherhood_event_status_changed', 'brotherhood_event', p_event_id::text, jsonb_build_object('previous', v_previous, 'next', p_status, 'title', v_row.title), true, 'brotherhood_events');
  return v_row;
end;
$$;

create or replace function public.delete_brotherhood_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_event public.brotherhood_events%rowtype;
  v_related integer;
begin
  v_org_id := app_private.current_org_for_permission('brotherhood.events.manage');
  if v_org_id is null then
    raise exception 'VPMD, President, or Admin access is required.' using errcode = '42501';
  end if;
  select * into v_event from public.brotherhood_events where id = p_event_id and chapter_id = v_org_id for update;
  if not found then
    raise exception 'Brotherhood Event not found.' using errcode = '02000';
  end if;
  select count(*) into v_related
  from (
    select id from public.brotherhood_event_rsvps where event_id = p_event_id
    union all
    select id from public.brotherhood_event_attendance where event_id = p_event_id
  ) related;
  perform public.log_audit_event(v_org_id, 'brotherhood_event_deleted', 'brotherhood_event', p_event_id::text, jsonb_build_object('title', v_event.title, 'relatedRecords', v_related), true, 'brotherhood_events');
  delete from public.brotherhood_events where id = p_event_id and chapter_id = v_org_id;
  return true;
end;
$$;

create or replace function public.set_brotherhood_rsvp(p_event_id uuid, p_status text, p_excuse_note text default '')
returns public.brotherhood_event_rsvps
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_member_id text;
  v_event public.brotherhood_events%rowtype;
  v_attending integer;
  v_waitlist text := 'confirmed';
  v_row public.brotherhood_event_rsvps%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  v_org_id := public.current_member_organization_id();
  v_member_id := public.current_member_id(v_org_id);
  if v_org_id is null or v_member_id is null then
    raise exception 'Your account is not linked to an active member profile.' using errcode = '42501';
  end if;
  if not public.has_chapter_permission(v_org_id, 'events.rsvp') and not public.has_chapter_permission(v_org_id, 'all') then
    raise exception 'You do not have RSVP access.' using errcode = '42501';
  end if;
  if p_status not in ('Attending', 'Not attending', 'Maybe') then
    raise exception 'Invalid RSVP status.' using errcode = '22023';
  end if;
  select * into v_event from public.brotherhood_events where id = p_event_id and chapter_id = v_org_id;
  if not found or v_event.status <> 'Published' then
    raise exception 'This event is not open for RSVP.' using errcode = '42501';
  end if;
  if v_event.rsvp_deadline is not null and now() > v_event.rsvp_deadline then
    raise exception 'The RSVP deadline has passed.' using errcode = '22023';
  end if;
  if p_status = 'Maybe' and not v_event.allow_maybe then
    raise exception 'Maybe is not enabled for this event.' using errcode = '22023';
  end if;
  if v_event.required and p_status = 'Not attending' and v_event.excuse_required_for_required and nullif(trim(coalesce(p_excuse_note, '')), '') is null then
    raise exception 'An excuse note is required for required events.' using errcode = '22023';
  end if;
  select count(*) into v_attending
  from public.brotherhood_event_rsvps
  where event_id = p_event_id and status = 'Attending' and waitlist_status = 'confirmed' and member_id <> v_member_id;
  if p_status = 'Attending' and v_event.capacity is not null and v_attending >= v_event.capacity then
    if v_event.waitlist_enabled then
      v_waitlist := 'waitlisted';
    else
      raise exception 'This event has reached capacity.' using errcode = '22023';
    end if;
  end if;
  if p_status <> 'Attending' then
    v_waitlist := 'not_applicable';
  end if;
  insert into public.brotherhood_event_rsvps (chapter_id, event_id, member_id, user_id, status, excuse_note, waitlist_status)
  values (v_org_id, p_event_id, v_member_id, (select auth.uid()), p_status, coalesce(p_excuse_note, ''), v_waitlist)
  on conflict (event_id, member_id) do update
     set status = excluded.status,
         excuse_note = excluded.excuse_note,
         waitlist_status = excluded.waitlist_status,
         user_id = (select auth.uid()),
         updated_at = now()
  returning * into v_row;
  perform public.log_audit_event(v_org_id, 'brotherhood_rsvp_changed', 'brotherhood_event', p_event_id::text, jsonb_build_object('memberId', v_member_id, 'status', p_status, 'waitlistStatus', v_waitlist), true, 'brotherhood_events');
  return v_row;
end;
$$;

create or replace function public.set_brotherhood_attendance(p_event_id uuid, p_member_id text, p_status text, p_reason text default '')
returns public.brotherhood_event_attendance
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_event public.brotherhood_events%rowtype;
  v_previous text;
  v_row public.brotherhood_event_attendance%rowtype;
begin
  v_org_id := app_private.current_org_for_permission('brotherhood.events.manage');
  if v_org_id is null then
    raise exception 'VPMD, President, or Admin access is required to manage event attendance.' using errcode = '42501';
  end if;
  if p_status not in ('Present', 'Absent', 'Excused', 'Late', 'Left early') then
    raise exception 'Invalid attendance status.' using errcode = '22023';
  end if;
  select * into v_event from public.brotherhood_events where id = p_event_id and chapter_id = v_org_id;
  if not found then
    raise exception 'Brotherhood Event not found.' using errcode = '02000';
  end if;
  if not app_private.workspace_member_exists(v_org_id, p_member_id) then
    raise exception 'Member is not active in this chapter.' using errcode = '22023';
  end if;
  select status into v_previous from public.brotherhood_event_attendance where event_id = p_event_id and member_id = p_member_id;
  if v_previous is not null and v_previous <> p_status and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A correction reason is required.' using errcode = '22023';
  end if;
  insert into public.brotherhood_event_attendance (
    chapter_id, event_id, member_id, status, check_in_at, check_in_method, suspicious, previous_status, correction_reason, marked_by
  )
  values (
    v_org_id, p_event_id, p_member_id, p_status,
    case when p_status in ('Present', 'Late', 'Left early') then now() else null end,
    'Officer manual check-in',
    p_status = 'Late',
    v_previous,
    coalesce(p_reason, ''),
    (select auth.uid())
  )
  on conflict (event_id, member_id) do update
     set status = excluded.status,
         check_in_at = excluded.check_in_at,
         check_in_method = excluded.check_in_method,
         suspicious = excluded.suspicious,
         previous_status = brotherhood_event_attendance.status,
         correction_reason = excluded.correction_reason,
         marked_by = (select auth.uid()),
         updated_at = now()
  returning * into v_row;
  perform public.log_audit_event(v_org_id, case when v_previous is null then 'brotherhood_attendance_marked' else 'brotherhood_attendance_corrected' end, 'brotherhood_event', p_event_id::text, jsonb_build_object('memberId', p_member_id, 'previous', v_previous, 'next', p_status, 'reason', p_reason), true, 'brotherhood_events');
  return v_row;
end;
$$;

create or replace function public.upsert_brotherhood_event_recap(p_event_id uuid, p_recap jsonb)
returns public.brotherhood_event_recaps
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_row public.brotherhood_event_recaps%rowtype;
begin
  v_org_id := app_private.current_org_for_permission('brotherhood.events.manage');
  if v_org_id is null then
    raise exception 'VPMD, President, or Admin access is required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.brotherhood_events where id = p_event_id and chapter_id = v_org_id) then
    raise exception 'Brotherhood Event not found.' using errcode = '02000';
  end if;
  insert into public.brotherhood_event_recaps (
    chapter_id, event_id, attendance_count, rsvp_count, estimated_cost_cents,
    actual_cost_cents, went_well, improvements, member_feedback,
    recommended_changes, repeat_event, files_url, private_officer_notes,
    completed_by, completed_at
  )
  values (
    v_org_id, p_event_id,
    coalesce((p_recap->>'attendanceCount')::integer, 0),
    coalesce((p_recap->>'rsvpCount')::integer, 0),
    coalesce((p_recap->>'estimatedCostCents')::integer, 0),
    coalesce((p_recap->>'actualCostCents')::integer, 0),
    coalesce(p_recap->>'wentWell', ''),
    coalesce(p_recap->>'improvements', ''),
    coalesce(p_recap->>'memberFeedback', ''),
    coalesce(p_recap->>'recommendedChanges', ''),
    coalesce(nullif(p_recap->>'repeatEvent', ''), 'Not sure'),
    coalesce(p_recap->>'filesUrl', ''),
    coalesce(p_recap->>'privateOfficerNotes', ''),
    (select auth.uid()),
    now()
  )
  on conflict (event_id) do update
     set attendance_count = excluded.attendance_count,
         rsvp_count = excluded.rsvp_count,
         estimated_cost_cents = excluded.estimated_cost_cents,
         actual_cost_cents = excluded.actual_cost_cents,
         went_well = excluded.went_well,
         improvements = excluded.improvements,
         member_feedback = excluded.member_feedback,
         recommended_changes = excluded.recommended_changes,
         repeat_event = excluded.repeat_event,
         files_url = excluded.files_url,
         private_officer_notes = excluded.private_officer_notes,
         completed_by = (select auth.uid()),
         completed_at = now(),
         updated_at = now()
  returning * into v_row;
  update public.brotherhood_events set status = 'Completed', updated_by = (select auth.uid()), updated_at = now()
   where id = p_event_id and chapter_id = v_org_id and status <> 'Archived';
  perform public.log_audit_event(v_org_id, 'brotherhood_event_recap_saved', 'brotherhood_event', p_event_id::text, jsonb_build_object('repeatEvent', v_row.repeat_event), true, 'brotherhood_events');
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
      and tablename in ('brotherhood_events', 'brotherhood_event_private_notes', 'brotherhood_event_rsvps', 'brotherhood_event_attendance', 'brotherhood_event_recaps')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy "Chapter users can read allowed brotherhood events"
on public.brotherhood_events
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'brotherhood.events.admin.view')
  or public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
  or app_private.brotherhood_member_can_see(brotherhood_events)
);

create policy "Managers can manage brotherhood events"
on public.brotherhood_events
for all
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
)
with check (
  public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
);

create policy "Only authorized officers can read private event notes"
on public.brotherhood_event_private_notes
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'brotherhood.events.admin.view')
  or public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
);

create policy "Managers can manage private event notes"
on public.brotherhood_event_private_notes
for all
to authenticated
using (public.has_chapter_permission(chapter_id, 'brotherhood.events.manage') or public.has_chapter_permission(chapter_id, 'all'))
with check (public.has_chapter_permission(chapter_id, 'brotherhood.events.manage') or public.has_chapter_permission(chapter_id, 'all'));

create policy "Users can read permitted RSVPs"
on public.brotherhood_event_rsvps
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'brotherhood.events.admin.view')
  or public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
  or member_id = public.current_member_id(chapter_id)
);

create policy "Members can write their own RSVP"
on public.brotherhood_event_rsvps
for insert
to authenticated
with check (
  chapter_id = public.current_member_organization_id()
  and member_id = public.current_member_id(chapter_id)
);

create policy "Members can update their own RSVP"
on public.brotherhood_event_rsvps
for update
to authenticated
using (
  member_id = public.current_member_id(chapter_id)
  or public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
)
with check (
  member_id = public.current_member_id(chapter_id)
  or public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
);

create policy "Users can read permitted brotherhood attendance"
on public.brotherhood_event_attendance
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'brotherhood.events.admin.view')
  or public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
  or member_id = public.current_member_id(chapter_id)
);

create policy "Managers can manage brotherhood attendance"
on public.brotherhood_event_attendance
for all
to authenticated
using (public.has_chapter_permission(chapter_id, 'brotherhood.events.manage') or public.has_chapter_permission(chapter_id, 'all'))
with check (public.has_chapter_permission(chapter_id, 'brotherhood.events.manage') or public.has_chapter_permission(chapter_id, 'all'));

create policy "Authorized users can read brotherhood recaps"
on public.brotherhood_event_recaps
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'brotherhood.events.admin.view')
  or public.has_chapter_permission(chapter_id, 'brotherhood.events.manage')
  or public.has_chapter_permission(chapter_id, 'all')
);

create policy "Managers can manage brotherhood recaps"
on public.brotherhood_event_recaps
for all
to authenticated
using (public.has_chapter_permission(chapter_id, 'brotherhood.events.manage') or public.has_chapter_permission(chapter_id, 'all'))
with check (public.has_chapter_permission(chapter_id, 'brotherhood.events.manage') or public.has_chapter_permission(chapter_id, 'all'));

revoke all on public.brotherhood_events from anon;
revoke all on public.brotherhood_event_private_notes from anon;
revoke all on public.brotherhood_event_rsvps from anon;
revoke all on public.brotherhood_event_attendance from anon;
revoke all on public.brotherhood_event_recaps from anon;

grant select, insert, update, delete on public.brotherhood_events to authenticated;
grant select, insert, update, delete on public.brotherhood_event_private_notes to authenticated;
grant select, insert, update on public.brotherhood_event_rsvps to authenticated;
grant select, insert, update on public.brotherhood_event_attendance to authenticated;
grant select, insert, update on public.brotherhood_event_recaps to authenticated;

revoke all on function public.upsert_brotherhood_event(uuid, jsonb) from public;
revoke all on function public.upsert_brotherhood_event(uuid, jsonb) from anon;
grant execute on function public.upsert_brotherhood_event(uuid, jsonb) to authenticated;

revoke all on function public.set_brotherhood_event_status(uuid, text) from public;
revoke all on function public.set_brotherhood_event_status(uuid, text) from anon;
grant execute on function public.set_brotherhood_event_status(uuid, text) to authenticated;

revoke all on function public.delete_brotherhood_event(uuid) from public;
revoke all on function public.delete_brotherhood_event(uuid) from anon;
grant execute on function public.delete_brotherhood_event(uuid) to authenticated;

revoke all on function public.set_brotherhood_rsvp(uuid, text, text) from public;
revoke all on function public.set_brotherhood_rsvp(uuid, text, text) from anon;
grant execute on function public.set_brotherhood_rsvp(uuid, text, text) to authenticated;

revoke all on function public.set_brotherhood_attendance(uuid, text, text, text) from public;
revoke all on function public.set_brotherhood_attendance(uuid, text, text, text) from anon;
grant execute on function public.set_brotherhood_attendance(uuid, text, text, text) to authenticated;

revoke all on function public.upsert_brotherhood_event_recap(uuid, jsonb) from public;
revoke all on function public.upsert_brotherhood_event_recap(uuid, jsonb) from anon;
grant execute on function public.upsert_brotherhood_event_recap(uuid, jsonb) to authenticated;
