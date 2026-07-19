-- Secretary-managed roster checklist attendance.
-- Uses the existing workspace_state member roster as the canonical roster source,
-- and stores official attendance sessions/records in relational tables.

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  event_id text,
  name text not null,
  event_type text not null default 'Chapter Meeting',
  meeting_date date not null default current_date,
  starts_at timestamptz not null default now(),
  late_after timestamptz,
  status text not null default 'Open',
  required boolean not null default true,
  attendance_weight numeric not null default 1,
  include_new_members boolean not null default true,
  exclude_inactive_members boolean not null default true,
  created_by uuid,
  opened_by uuid,
  closed_by uuid,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_status_check check (status in ('Draft', 'Open', 'Closed', 'Archived'))
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.organizations(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  member_id text not null,
  status text not null default 'unmarked',
  marked_at timestamptz,
  marked_by uuid,
  arrival_time timestamptz,
  excused boolean not null default false,
  note text,
  manually_adjusted boolean not null default false,
  adjustment_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_status_check check (status in ('unmarked', 'present', 'late', 'excused', 'absent')),
  constraint attendance_records_session_member_unique unique (attendance_session_id, member_id)
);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

create index if not exists attendance_sessions_chapter_date_idx
  on public.attendance_sessions(chapter_id, meeting_date desc, created_at desc);

create index if not exists attendance_sessions_chapter_status_idx
  on public.attendance_sessions(chapter_id, status, starts_at desc);

create index if not exists attendance_records_chapter_member_idx
  on public.attendance_records(chapter_id, member_id, created_at desc);

create index if not exists attendance_records_session_status_idx
  on public.attendance_records(attendance_session_id, status);

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

create or replace function app_private.attendance_roster(p_chapter_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  with workspace as (
    select data
    from public.workspace_state
    where organization_id = p_chapter_id
    limit 1
  ),
  members as (
    select m
    from workspace, jsonb_array_elements(coalesce(data->'members', '[]'::jsonb)) m
    where coalesce(m->>'archived', 'false') <> 'true'
      and coalesce(m->>'deletedAt', '') = ''
      and coalesce(m->>'lifecycle', '') not in ('Archived')
      and coalesce(m->>'memberStatus', '') not in ('Archived', 'Alumni', 'Inactive')
      and coalesce(m->>'id', '') <> ''
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m->>'id',
        'firstName', coalesce(m->>'firstName', ''),
        'lastName', coalesce(m->>'lastName', ''),
        'memberStatus', coalesce(m->>'memberStatus', 'Active'),
        'initiationStatus', coalesce(m->>'initiationStatus', ''),
        'schoolYear', coalesce(m->>'schoolYear', ''),
        'officerRole', coalesce(m->>'officerRole', ''),
        'email', coalesce(m->>'email', ''),
        'phone', coalesce(m->>'phone', '')
      )
      order by lower(coalesce(m->>'lastName', '')), lower(coalesce(m->>'firstName', '')), m->>'id'
    ),
    '[]'::jsonb
  )
  from members;
$$;

create or replace function app_private.attendance_manager_payload(p_chapter_id uuid, p_selected_session_id uuid default null)
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  with selected as (
    select coalesce(
      p_selected_session_id,
      (
        select id
        from public.attendance_sessions
        where chapter_id = p_chapter_id and status = 'Open'
        order by starts_at desc
        limit 1
      )
    ) as id
  ),
  session_rows as (
    select s.*,
      count(r.id) filter (where r.status in ('present', 'late', 'excused')) as counted_present,
      count(r.id) filter (where r.status = 'present') as present_count,
      count(r.id) filter (where r.status = 'late') as late_count,
      count(r.id) filter (where r.status = 'excused') as excused_count,
      count(r.id) filter (where r.status = 'absent') as absent_count,
      count(r.id) filter (where r.status = 'unmarked') as unmarked_count,
      count(r.id) as expected_count
    from public.attendance_sessions s
    left join public.attendance_records r on r.attendance_session_id = s.id
    where s.chapter_id = p_chapter_id
    group by s.id
    order by s.starts_at desc
    limit 100
  ),
  record_rows as (
    select r.*
    from public.attendance_records r
    where r.chapter_id = p_chapter_id
      and (p_selected_session_id is null or r.attendance_session_id = p_selected_session_id)
      and (
        exists (select 1 from selected where selected.id is null)
        or r.attendance_session_id in (select id from selected)
        or p_selected_session_id is null
      )
  )
  select jsonb_build_object(
    'roster', app_private.attendance_roster(p_chapter_id),
    'selectedSessionId', (select id::text from selected),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'eventId', event_id,
        'name', name,
        'eventType', event_type,
        'meetingDate', meeting_date,
        'startsAt', starts_at,
        'lateAfter', late_after,
        'status', status,
        'required', required,
        'expectedCount', expected_count,
        'presentCount', present_count,
        'lateCount', late_count,
        'excusedCount', excused_count,
        'absentCount', absent_count,
        'unmarkedCount', unmarked_count,
        'attendanceRate', case when expected_count > 0 then round(((present_count + late_count + excused_count)::numeric / expected_count) * 100, 1) else 0 end,
        'openedAt', opened_at,
        'closedAt', closed_at,
        'createdAt', created_at,
        'updatedAt', updated_at
      ))
      from session_rows
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'attendanceSessionId', attendance_session_id,
        'memberId', member_id,
        'status', status,
        'markedAt', marked_at,
        'markedBy', marked_by,
        'arrivalTime', arrival_time,
        'excused', excused,
        'note', note,
        'manuallyAdjusted', manually_adjusted,
        'adjustmentReason', adjustment_reason,
        'updatedAt', updated_at
      ))
      from record_rows
    ), '[]'::jsonb),
    'settings', jsonb_build_object(
      'defaultMeetingName', coalesce((select data#>>'{settings,defaultMeetingName}' from public.workspace_state where organization_id = p_chapter_id), 'Chapter Meeting'),
      'lateThresholdMinutes', coalesce(nullif((select data#>>'{settings,lateThresholdMinutes}' from public.workspace_state where organization_id = p_chapter_id), '')::integer, 10),
      'attendanceThreshold', coalesce(nullif((select data#>>'{settings,attendanceThreshold}' from public.workspace_state where organization_id = p_chapter_id), '')::integer, 80),
      'lateCountsAs', coalesce((select data#>>'{settings,lateCountsAs}' from public.workspace_state where organization_id = p_chapter_id), 'full'),
      'excusedHandling', coalesce((select data#>>'{settings,excusedHandling}' from public.workspace_state where organization_id = p_chapter_id), 'counts')
    )
  );
$$;

create or replace function public.get_attendance_manager_workspace(p_session_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  v_org_id := app_private.current_org_for_permission('attendance.view');
  if v_org_id is null then
    raise exception 'You do not have permission to view attendance.' using errcode = '42501';
  end if;

  return app_private.attendance_manager_payload(v_org_id, p_session_id);
end;
$$;

create or replace function public.start_chapter_attendance()
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_workspace jsonb;
  v_settings jsonb;
  v_session_id uuid;
  v_name text;
  v_late_minutes integer;
begin
  v_org_id := app_private.current_org_for_permission('attendance.manage');
  if v_org_id is null then
    raise exception 'You do not have permission to start attendance.' using errcode = '42501';
  end if;

  select data into v_workspace from public.workspace_state where organization_id = v_org_id limit 1;
  v_settings := coalesce(v_workspace->'settings', '{}'::jsonb);
  v_name := coalesce(nullif(v_settings->>'defaultMeetingName', ''), 'Chapter Meeting');
  v_late_minutes := coalesce(nullif(v_settings->>'lateThresholdMinutes', '')::integer, 10);

  insert into public.attendance_sessions (
    chapter_id, name, event_type, meeting_date, starts_at, late_after, status, required,
    attendance_weight, include_new_members, exclude_inactive_members, created_by, opened_by, opened_at
  )
  values (
    v_org_id,
    v_name,
    coalesce(nullif(v_settings->>'defaultAttendanceEventType', ''), 'Chapter Meeting'),
    current_date,
    now(),
    now() + make_interval(mins => v_late_minutes),
    'Open',
    coalesce(nullif(v_settings->>'defaultAttendanceRequired', '')::boolean, true),
    coalesce(nullif(v_settings->>'attendancePercentageWeight', '')::numeric, 1),
    coalesce(nullif(v_settings->>'includeNewMembersInAttendance', '')::boolean, true),
    coalesce(nullif(v_settings->>'excludeInactiveMembersFromAttendance', '')::boolean, true),
    (select auth.uid()),
    (select auth.uid()),
    now()
  )
  returning id into v_session_id;

  insert into public.attendance_records (chapter_id, attendance_session_id, member_id, status)
  select v_org_id, v_session_id, member->>'id', 'unmarked'
  from jsonb_array_elements(app_private.attendance_roster(v_org_id)) member
  on conflict (attendance_session_id, member_id) do nothing;

  perform public.log_audit_event(v_org_id, 'attendance_session_started', 'attendance_session', v_session_id::text, jsonb_build_object('name', v_name), true, 'attendance');

  return app_private.attendance_manager_payload(v_org_id, v_session_id);
end;
$$;

create or replace function public.create_event_attendance_session(
  p_name text,
  p_event_type text default 'Other',
  p_meeting_date date default current_date,
  p_starts_at timestamptz default now(),
  p_required boolean default true,
  p_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_session_id uuid;
begin
  v_org_id := app_private.current_org_for_permission('attendance.manage');
  if v_org_id is null then
    raise exception 'You do not have permission to create attendance sessions.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Session name is required.' using errcode = '22023';
  end if;

  insert into public.attendance_sessions (
    chapter_id, event_id, name, event_type, meeting_date, starts_at, status, required,
    created_by, opened_by, opened_at
  )
  values (
    v_org_id, nullif(trim(coalesce(p_event_id, '')), ''), trim(p_name), coalesce(nullif(trim(p_event_type), ''), 'Other'),
    coalesce(p_meeting_date, current_date), coalesce(p_starts_at, now()), 'Open', coalesce(p_required, true),
    (select auth.uid()), (select auth.uid()), now()
  )
  returning id into v_session_id;

  insert into public.attendance_records (chapter_id, attendance_session_id, member_id, status)
  select v_org_id, v_session_id, member->>'id', 'unmarked'
  from jsonb_array_elements(app_private.attendance_roster(v_org_id)) member
  on conflict (attendance_session_id, member_id) do nothing;

  perform public.log_audit_event(v_org_id, 'attendance_session_created', 'attendance_session', v_session_id::text, jsonb_build_object('name', p_name, 'eventType', p_event_type), true, 'attendance');

  return app_private.attendance_manager_payload(v_org_id, v_session_id);
end;
$$;

create or replace function public.set_attendance_status(
  p_session_id uuid,
  p_target_member_id text,
  p_new_status text,
  p_note text default null,
  p_adjustment_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_session public.attendance_sessions%rowtype;
  v_member_exists boolean;
  v_status text := lower(trim(coalesce(p_new_status, '')));
  v_is_correction boolean := false;
begin
  v_org_id := app_private.current_org_for_permission('attendance.manage');
  if v_org_id is null then
    raise exception 'You do not have permission to mark attendance.' using errcode = '42501';
  end if;
  if v_status not in ('unmarked', 'present', 'late', 'excused', 'absent') then
    raise exception 'Unsupported attendance status.' using errcode = '22023';
  end if;

  select * into v_session
  from public.attendance_sessions
  where id = p_session_id and chapter_id = v_org_id
  for update;

  if not found then
    raise exception 'Attendance session not found.' using errcode = '02000';
  end if;

  if v_session.status = 'Closed' then
    v_is_correction := true;
    if nullif(trim(coalesce(p_adjustment_reason, '')), '') is null then
      raise exception 'A correction reason is required after attendance is closed.' using errcode = '22023';
    end if;
  elsif v_session.status <> 'Open' then
    raise exception 'Attendance session is not open.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(app_private.attendance_roster(v_org_id)) member
    where member->>'id' = p_target_member_id
  ) into v_member_exists;

  if not v_member_exists then
    raise exception 'Member is not in the active attendance roster.' using errcode = '22023';
  end if;

  insert into public.attendance_records (
    chapter_id, attendance_session_id, member_id, status, marked_at, marked_by, arrival_time,
    excused, note, manually_adjusted, adjustment_reason, updated_at
  )
  values (
    v_org_id, p_session_id, p_target_member_id, v_status,
    case when v_status = 'unmarked' then null else now() end,
    (select auth.uid()),
    case when v_status in ('present', 'late') then now() else null end,
    v_status = 'excused',
    nullif(trim(coalesce(p_note, '')), ''),
    v_is_correction,
    nullif(trim(coalesce(p_adjustment_reason, '')), ''),
    now()
  )
  on conflict (attendance_session_id, member_id)
  do update set
    status = excluded.status,
    marked_at = excluded.marked_at,
    marked_by = excluded.marked_by,
    arrival_time = excluded.arrival_time,
    excused = excluded.excused,
    note = excluded.note,
    manually_adjusted = excluded.manually_adjusted,
    adjustment_reason = excluded.adjustment_reason,
    updated_at = now();

  update public.attendance_sessions set updated_at = now() where id = p_session_id;

  perform public.log_audit_event(v_org_id, case when v_is_correction then 'attendance_record_corrected' else 'attendance_record_marked' end, 'attendance_record', p_target_member_id, jsonb_build_object('sessionId', p_session_id, 'status', v_status, 'correction', v_is_correction), true, 'attendance');

  return app_private.attendance_manager_payload(v_org_id, p_session_id);
end;
$$;

create or replace function public.bulk_set_attendance_status(
  p_session_id uuid,
  p_new_status text,
  p_only_unmarked boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_session public.attendance_sessions%rowtype;
  v_status text := lower(trim(coalesce(p_new_status, '')));
begin
  v_org_id := app_private.current_org_for_permission('attendance.manage');
  if v_org_id is null then
    raise exception 'You do not have permission to bulk mark attendance.' using errcode = '42501';
  end if;
  if v_status not in ('unmarked', 'present', 'late', 'excused', 'absent') then
    raise exception 'Unsupported attendance status.' using errcode = '22023';
  end if;

  select * into v_session
  from public.attendance_sessions
  where id = p_session_id and chapter_id = v_org_id
  for update;

  if not found or v_session.status <> 'Open' then
    raise exception 'Attendance session is not open.' using errcode = '42501';
  end if;

  update public.attendance_records
     set status = v_status,
         marked_at = case when v_status = 'unmarked' then null else now() end,
         marked_by = (select auth.uid()),
         arrival_time = case when v_status in ('present', 'late') then now() else null end,
         excused = v_status = 'excused',
         updated_at = now()
   where chapter_id = v_org_id
     and attendance_session_id = p_session_id
     and (not p_only_unmarked or status = 'unmarked');

  update public.attendance_sessions set updated_at = now() where id = p_session_id;

  perform public.log_audit_event(v_org_id, 'attendance_bulk_marked', 'attendance_session', p_session_id::text, jsonb_build_object('status', v_status, 'onlyUnmarked', p_only_unmarked), true, 'attendance');

  return app_private.attendance_manager_payload(v_org_id, p_session_id);
end;
$$;

create or replace function public.close_attendance_session(
  p_session_id uuid,
  p_mark_unmarked_absent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_unmarked integer;
begin
  v_org_id := app_private.current_org_for_permission('attendance.manage');
  if v_org_id is null then
    raise exception 'You do not have permission to close attendance.' using errcode = '42501';
  end if;

  select count(*) into v_unmarked
  from public.attendance_records
  where chapter_id = v_org_id
    and attendance_session_id = p_session_id
    and status = 'unmarked';

  if v_unmarked > 0 and not p_mark_unmarked_absent then
    raise exception 'Attendance still has unmarked members.' using errcode = '22023';
  end if;

  if p_mark_unmarked_absent then
    update public.attendance_records
       set status = 'absent',
           marked_at = now(),
           marked_by = (select auth.uid()),
           updated_at = now()
     where chapter_id = v_org_id
       and attendance_session_id = p_session_id
       and status = 'unmarked';
  end if;

  update public.attendance_sessions
     set status = 'Closed',
         closed_by = (select auth.uid()),
         closed_at = now(),
         updated_at = now()
   where id = p_session_id
     and chapter_id = v_org_id
     and status = 'Open';

  if not found then
    raise exception 'Open attendance session not found.' using errcode = '02000';
  end if;

  perform public.log_audit_event(v_org_id, 'attendance_session_closed', 'attendance_session', p_session_id::text, jsonb_build_object('markedUnmarkedAbsent', p_mark_unmarked_absent), true, 'attendance');

  return app_private.attendance_manager_payload(v_org_id, p_session_id);
end;
$$;

create or replace function public.get_my_member_portal()
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_member_id text;
  v_base jsonb;
  v_attendance jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_attended integer := 0;
  v_late integer := 0;
  v_excused integer := 0;
  v_absent integer := 0;
  v_required integer := 0;
  v_rate numeric := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required.'
      using errcode = '28000';
  end if;

  v_org_id := public.current_member_organization_id();
  v_member_id := public.current_member_id(v_org_id);

  if v_org_id is null or v_member_id is null then
    return jsonb_build_object('linked', false, 'reason', 'member_link_missing');
  end if;

  v_base := app_private.workspace_member_portal(v_org_id, v_member_id);

  select
    count(*) filter (where r.status = 'present'),
    count(*) filter (where r.status = 'late'),
    count(*) filter (where r.status = 'excused'),
    count(*) filter (where r.status = 'absent'),
    count(*) filter (where s.required)
  into v_attended, v_late, v_excused, v_absent, v_required
  from public.attendance_records r
  join public.attendance_sessions s on s.id = r.attendance_session_id
  where r.chapter_id = v_org_id
    and r.member_id = v_member_id
    and s.status in ('Open', 'Closed', 'Archived');

  if v_required > 0 then
    v_rate := round(((v_attended + v_late + v_excused)::numeric / v_required) * 100, 1);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'eventId', coalesce(s.event_id, s.id::text),
    'eventName', s.name,
    'eventDate', s.meeting_date,
    'eventType', s.event_type,
    'required', s.required,
    'status', initcap(r.status),
    'excuseStatus', case when r.status = 'excused' then 'Excused' else '' end,
    'memberVisibleNotes', coalesce(r.note, ''),
    'markedAt', r.marked_at,
    'arrivalTime', r.arrival_time
  ) order by s.meeting_date desc, s.starts_at desc), '[]'::jsonb)
  into v_attendance
  from public.attendance_records r
  join public.attendance_sessions s on s.id = r.attendance_session_id
  where r.chapter_id = v_org_id
    and r.member_id = v_member_id
    and s.status in ('Open', 'Closed', 'Archived');

  v_summary := jsonb_build_object(
    'attended', coalesce(v_attended, 0) + coalesce(v_late, 0),
    'present', coalesce(v_attended, 0),
    'late', coalesce(v_late, 0),
    'missed', coalesce(v_absent, 0),
    'excused', coalesce(v_excused, 0),
    'attendanceRate', v_rate,
    'threshold', coalesce((v_base#>>'{attendanceSummary,threshold}')::integer, 80),
    'standing', case when v_required = 0 then 'No records' when v_rate >= coalesce((v_base#>>'{attendanceSummary,threshold}')::integer, 80) then 'Current' else 'Needs attention' end
  );

  return jsonb_set(jsonb_set(v_base, '{attendance}', v_attendance, true), '{attendanceSummary}', v_summary, true);
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
      and tablename in ('attendance_sessions', 'attendance_records')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy "Authorized users can view attendance sessions"
on public.attendance_sessions
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'attendance.view')
  or public.has_chapter_permission(chapter_id, 'attendance.manage')
  or public.has_chapter_permission(chapter_id, 'all')
  or chapter_id = public.current_member_organization_id()
);

create policy "Authorized users can manage attendance sessions"
on public.attendance_sessions
for all
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'attendance.manage')
  or public.has_chapter_permission(chapter_id, 'all')
)
with check (
  public.has_chapter_permission(chapter_id, 'attendance.manage')
  or public.has_chapter_permission(chapter_id, 'all')
);

create policy "Authorized users and owners can view attendance records"
on public.attendance_records
for select
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'attendance.view')
  or public.has_chapter_permission(chapter_id, 'attendance.manage')
  or public.has_chapter_permission(chapter_id, 'all')
  or member_id = public.current_member_id(chapter_id)
);

create policy "Authorized users can manage attendance records"
on public.attendance_records
for all
to authenticated
using (
  public.has_chapter_permission(chapter_id, 'attendance.manage')
  or public.has_chapter_permission(chapter_id, 'all')
)
with check (
  public.has_chapter_permission(chapter_id, 'attendance.manage')
  or public.has_chapter_permission(chapter_id, 'all')
);

revoke all on public.attendance_sessions from anon;
revoke all on public.attendance_records from anon;
grant select, insert, update on public.attendance_sessions to authenticated;
grant select, insert, update on public.attendance_records to authenticated;

revoke all on function public.get_attendance_manager_workspace(uuid) from public;
revoke all on function public.get_attendance_manager_workspace(uuid) from anon;
grant execute on function public.get_attendance_manager_workspace(uuid) to authenticated;

revoke all on function public.start_chapter_attendance() from public;
revoke all on function public.start_chapter_attendance() from anon;
grant execute on function public.start_chapter_attendance() to authenticated;

revoke all on function public.create_event_attendance_session(text, text, date, timestamptz, boolean, text) from public;
revoke all on function public.create_event_attendance_session(text, text, date, timestamptz, boolean, text) from anon;
grant execute on function public.create_event_attendance_session(text, text, date, timestamptz, boolean, text) to authenticated;

revoke all on function public.set_attendance_status(uuid, text, text, text, text) from public;
revoke all on function public.set_attendance_status(uuid, text, text, text, text) from anon;
grant execute on function public.set_attendance_status(uuid, text, text, text, text) to authenticated;

revoke all on function public.bulk_set_attendance_status(uuid, text, boolean) from public;
revoke all on function public.bulk_set_attendance_status(uuid, text, boolean) from anon;
grant execute on function public.bulk_set_attendance_status(uuid, text, boolean) to authenticated;

revoke all on function public.close_attendance_session(uuid, boolean) from public;
revoke all on function public.close_attendance_session(uuid, boolean) from anon;
grant execute on function public.close_attendance_session(uuid, boolean) to authenticated;
