-- Add secure Active Member Portal access on top of the existing
-- workspace_state JSON source of truth. This preserves all chapter data.

alter table public.organization_members
  add column if not exists member_id text,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists organization_members_org_member_idx
  on public.organization_members(organization_id, member_id);

create table if not exists public.portal_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null default '',
  audience text not null default 'All Active Members',
  position text,
  member_id text,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_excuse_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id text not null,
  event_id text not null,
  reason text not null,
  note text,
  status text not null default 'Submitted',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portal_announcements enable row level security;
alter table public.member_excuse_requests enable row level security;

create index if not exists portal_announcements_org_audience_idx
  on public.portal_announcements(organization_id, audience, published_at desc);
create index if not exists member_excuse_requests_org_member_idx
  on public.member_excuse_requests(organization_id, member_id, submitted_at desc);

create or replace function public.current_member_id(requested_chapter_id uuid default null)
returns text
language sql
security definer
set search_path = app_private, public
as $$
  select om.member_id
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  where om.user_id = (select auth.uid())
    and p.approval_status = 'approved'
    and coalesce(om.status, 'active') = 'active'
    and om.member_id is not null
    and (requested_chapter_id is null or om.organization_id = requested_chapter_id)
  order by om.created_at asc
  limit 1;
$$;

create or replace function public.current_member_organization_id()
returns uuid
language sql
security definer
set search_path = app_private, public
as $$
  select om.organization_id
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  where om.user_id = (select auth.uid())
    and p.approval_status = 'approved'
    and coalesce(om.status, 'active') = 'active'
    and om.member_id is not null
  order by om.created_at asc
  limit 1;
$$;

create or replace function app_private.money_to_cents(p_value text)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(round(nullif(regexp_replace(coalesce(p_value, '0'), '[^0-9.-]', '', 'g'), '')::numeric * 100), 0)::integer;
$$;

create or replace function app_private.workspace_member_portal(p_org_id uuid, p_member_id text)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_workspace jsonb;
  v_member jsonb;
  v_finance_account jsonb := '{}'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_attendance jsonb := '[]'::jsonb;
  v_tasks jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_announcements jsonb := '[]'::jsonb;
  v_threshold integer := 0;
  v_attended integer := 0;
  v_missed integer := 0;
  v_excused integer := 0;
  v_total_required integer := 0;
  v_rate integer := 0;
  v_amount_paid integer := 0;
  v_last_payment_date text := '';
  v_pending integer := 0;
  v_current integer := 0;
  v_total integer := 0;
begin
  select ws.data into v_workspace
  from public.workspace_state ws
  where ws.organization_id = p_org_id;

  if v_workspace is null then
    return jsonb_build_object('linked', false, 'reason', 'workspace_not_found');
  end if;

  select m into v_member
  from jsonb_array_elements(coalesce(v_workspace->'members', '[]'::jsonb)) m
  where m->>'id' = p_member_id
  limit 1;

  if v_member is null
    or coalesce(v_member->>'archived', 'false') = 'true'
    or coalesce(v_member->>'lifecycle', '') = 'Archived'
    or coalesce(v_member->>'memberStatus', '') = 'Archived'
  then
    return jsonb_build_object('linked', false, 'reason', 'member_not_active');
  end if;

  select coalesce(a, '{}'::jsonb) into v_finance_account
  from jsonb_array_elements(coalesce(v_workspace->'financeAccounts', '[]'::jsonb)) a
  where a->>'memberId' = p_member_id
     or a->>'member_id' = p_member_id
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', f->>'id',
      'date', coalesce(f->>'paymentDate', f->>'transactionDate', f->>'dueDate', ''),
      'type', coalesce(f->>'type', f->>'transactionType', ''),
      'description', coalesce(f->>'description', f->>'notes', ''),
      'amountCents', app_private.money_to_cents(coalesce(f->>'amount', f->>'amountPaid', '0')),
      'amountDisplay', to_char(app_private.money_to_cents(coalesce(f->>'amount', f->>'amountPaid', '0'))::numeric / 100, 'FM$999,999,990.00'),
      'chargeDisplay', case when coalesce(f->>'type', '') in ('Charge', 'Late Fee') then to_char(app_private.money_to_cents(coalesce(f->>'amount', '0'))::numeric / 100, 'FM$999,999,990.00') else '' end,
      'paymentDisplay', case when coalesce(f->>'type', '') in ('Payment', 'Payment Plan Payment') then to_char(app_private.money_to_cents(coalesce(f->>'amount', f->>'amountPaid', '0'))::numeric / 100, 'FM$999,999,990.00') else '' end,
      'creditDisplay', case when coalesce(f->>'type', '') in ('Credit', 'Scholarship', 'Refund') then to_char(abs(app_private.money_to_cents(coalesce(f->>'amount', '0')))::numeric / 100, 'FM$999,999,990.00') else '' end,
      'remainingBalanceDisplay', coalesce(f->>'balanceAfter', ''),
      'status', coalesce(f->>'status', f->>'paymentStatus', '')
    )
    order by coalesce(f->>'paymentDate', f->>'transactionDate', f->>'dueDate', '') desc
  ), '[]'::jsonb)
  into v_payments
  from jsonb_array_elements(coalesce(v_workspace->'finance', '[]'::jsonb)) f
  where f->>'memberId' = p_member_id
     or f->>'member_id' = p_member_id;

  select coalesce(sum(app_private.money_to_cents(coalesce(f->>'amount', f->>'amountPaid', '0'))), 0)
    into v_amount_paid
  from jsonb_array_elements(coalesce(v_workspace->'finance', '[]'::jsonb)) f
  where (f->>'memberId' = p_member_id or f->>'member_id' = p_member_id)
    and coalesce(f->>'type', '') in ('Payment', 'Payment Plan Payment');

  select coalesce(max(coalesce(f->>'paymentDate', f->>'transactionDate')), '')
    into v_last_payment_date
  from jsonb_array_elements(coalesce(v_workspace->'finance', '[]'::jsonb)) f
  where (f->>'memberId' = p_member_id or f->>'member_id' = p_member_id)
    and coalesce(f->>'type', '') in ('Payment', 'Payment Plan Payment');

  v_pending := coalesce((v_finance_account->>'pendingChargeCents')::integer, 0);
  v_current := coalesce((v_finance_account->>'currentBalanceCents')::integer, 0);
  v_total := v_pending + v_current;

  select count(*) filter (where coalesce(a->>'status', '') in ('Present', 'Attended', 'Checked in')),
         count(*) filter (where coalesce(a->>'status', '') in ('Absent', 'Missed')),
         count(*) filter (where coalesce(a->>'excuseStatus', '') in ('Excused', 'Approved')),
         count(*) filter (where coalesce(e->>'required', '') = 'Required')
    into v_attended, v_missed, v_excused, v_total_required
  from jsonb_array_elements(coalesce(v_workspace->'attendance', '[]'::jsonb)) a
  left join lateral (
    select e
    from jsonb_array_elements(coalesce(v_workspace->'events', '[]'::jsonb)) e
    where e->>'id' = a->>'eventId'
    limit 1
  ) ev on true
  where coalesce(a->>'personType', 'Member') = 'Member'
    and coalesce(a->>'personId', a->>'memberId', a->>'member_id') = p_member_id;

  v_threshold := coalesce((v_workspace#>>'{settings,attendanceThreshold}')::integer, 0);
  if (v_attended + v_missed) > 0 then
    v_rate := round((v_attended::numeric / (v_attended + v_missed)) * 100);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a->>'id',
      'eventId', a->>'eventId',
      'eventName', coalesce(e->>'name', 'Event'),
      'eventDate', coalesce(e->>'date', ''),
      'eventType', coalesce(e->>'type', ''),
      'status', coalesce(a->>'status', ''),
      'excuseStatus', coalesce(a->>'excuseStatus', ''),
      'memberVisibleNotes', coalesce(a->>'memberVisibleNotes', '')
    )
    order by coalesce(e->>'date', '') desc
  ), '[]'::jsonb)
  into v_attendance
  from jsonb_array_elements(coalesce(v_workspace->'attendance', '[]'::jsonb)) a
  left join lateral (
    select e
    from jsonb_array_elements(coalesce(v_workspace->'events', '[]'::jsonb)) e
    where e->>'id' = a->>'eventId'
    limit 1
  ) ev on true
  where coalesce(a->>'personType', 'Member') = 'Member'
    and coalesce(a->>'personId', a->>'memberId', a->>'member_id') = p_member_id;

  select coalesce(jsonb_agg(t order by coalesce(t->>'dueDate', '') asc), '[]'::jsonb)
    into v_tasks
  from jsonb_array_elements(coalesce(v_workspace->'tasks', '[]'::jsonb)) t
  where coalesce(t->>'archived', 'false') <> 'true'
    and (
      coalesce(t->>'assignedPerson', t->>'assigned_member_id', t->>'assignedMemberId') = p_member_id
      or coalesce(t->>'visibility', '') = 'members'
    )
    and coalesce(t->>'private', 'false') <> 'true';

  select coalesce(jsonb_agg(e order by coalesce(e->>'date', '') asc), '[]'::jsonb)
    into v_events
  from jsonb_array_elements(coalesce(v_workspace->'events', '[]'::jsonb)) e
  where coalesce(e->>'archived', 'false') <> 'true'
    and coalesce(e->>'visibility', '') = 'members'
    and coalesce(e->>'date', '9999-12-31') >= current_date::text;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pa.id,
    'title', pa.title,
    'body', pa.body,
    'audience', pa.audience,
    'publishedAt', pa.published_at::text,
    'expiresAt', pa.expires_at::text
  ) order by pa.published_at desc), '[]'::jsonb)
  into v_announcements
  from public.portal_announcements pa
  where pa.organization_id = p_org_id
    and pa.published_at <= now()
    and (pa.expires_at is null or pa.expires_at > now())
    and (
      pa.audience = 'All Active Members'
      or pa.member_id = p_member_id
      or lower(coalesce(pa.position, '')) = lower(coalesce(v_member->>'officerRole', ''))
    );

  return jsonb_build_object(
    'linked', true,
    'memberId', p_member_id,
    'profile', jsonb_build_object(
      'firstName', coalesce(v_member->>'firstName', ''),
      'lastName', coalesce(v_member->>'lastName', ''),
      'preferredName', coalesce(v_member->>'preferredName', ''),
      'memberStatus', coalesce(v_member->>'memberStatus', ''),
      'initiationStatus', coalesce(v_member->>'initiationStatus', ''),
      'schoolYear', coalesce(v_member->>'schoolYear', ''),
      'graduationYear', coalesce(v_member->>'graduationYear', ''),
      'officerRole', coalesce(v_member->>'officerRole', ''),
      'committee', coalesce(v_member->>'committee', ''),
      'email', coalesce(v_member->>'email', ''),
      'phone', coalesce(v_member->>'phone', ''),
      'emergencyContactStatus', case when coalesce(v_member->>'emergencyContactName', v_member->>'emergencyContactPhone', '') <> '' then 'On file' else 'Not on file' end
    ),
    'finance', jsonb_build_object(
      'pendingChargeCents', v_pending,
      'currentBalanceCents', v_current,
      'totalBalanceCents', v_total,
      'amountPaidCents', v_amount_paid,
      'remainingBalanceCents', greatest(v_total - v_amount_paid, 0),
      'dueDate', coalesce(v_finance_account->>'dueDate', ''),
      'paymentPlanStatus', coalesce(v_finance_account->>'paymentPlanStatus', 'None'),
      'lastPaymentDate', v_last_payment_date,
      'financialStatus', coalesce(v_finance_account->>'financialStatus', coalesce(v_member->>'duesStatus', 'Current'))
    ),
    'payments', v_payments,
    'attendanceSummary', jsonb_build_object(
      'attended', coalesce(v_attended, 0),
      'missed', coalesce(v_missed, 0),
      'excused', coalesce(v_excused, 0),
      'attendanceRate', v_rate,
      'threshold', v_threshold,
      'standing', case when v_rate >= v_threshold then 'Current' when (v_attended + v_missed) = 0 then 'No records' else 'Needs attention' end
    ),
    'attendance', v_attendance,
    'tasks', v_tasks,
    'events', v_events,
    'announcements', v_announcements
  );
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

  return app_private.workspace_member_portal(v_org_id, v_member_id);
end;
$$;

create or replace function public.update_my_member_profile(
  p_preferred_name text default '',
  p_phone text default '',
  p_email text default '',
  p_school_year text default '',
  p_graduation_year text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_member_id text;
  v_workspace jsonb;
  v_members jsonb;
  v_member jsonb;
  v_next_members jsonb := '[]'::jsonb;
  v_idx integer;
begin
  v_org_id := public.current_member_organization_id();
  v_member_id := public.current_member_id(v_org_id);

  if v_org_id is null or v_member_id is null then
    raise exception 'Your account is not linked to an active member profile.'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is not null
    and p_email !~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  then
    raise exception 'Enter a valid email address.'
      using errcode = '22023';
  end if;

  select ws.data into v_workspace
  from public.workspace_state ws
  where ws.organization_id = v_org_id
  for update;

  v_members := coalesce(v_workspace->'members', '[]'::jsonb);

  for v_idx in 0..greatest(jsonb_array_length(v_members) - 1, -1) loop
    v_member := v_members->v_idx;
    if v_member->>'id' = v_member_id then
      v_member := v_member
        || jsonb_build_object(
          'preferredName', trim(coalesce(p_preferred_name, '')),
          'phone', trim(coalesce(p_phone, '')),
          'email', lower(trim(coalesce(p_email, ''))),
          'schoolYear', trim(coalesce(p_school_year, '')),
          'graduationYear', trim(coalesce(p_graduation_year, '')),
          'updatedAt', now()::text
        );
    end if;
    v_next_members := v_next_members || jsonb_build_array(v_member);
  end loop;

  v_workspace := jsonb_set(v_workspace, '{members}', v_next_members, true);

  update public.workspace_state
     set data = v_workspace,
         updated_by = (select auth.uid()),
         updated_at = now()
   where organization_id = v_org_id;

  perform public.log_audit_event(v_org_id, 'member_profile_self_updated', 'member', v_member_id, jsonb_build_object('fields', array['preferredName','phone','email','schoolYear','graduationYear']), true, 'member_portal');

  return app_private.workspace_member_portal(v_org_id, v_member_id);
end;
$$;

create or replace function public.update_my_task_status(p_task_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_member_id text;
  v_workspace jsonb;
  v_tasks jsonb;
  v_task jsonb;
  v_next_tasks jsonb := '[]'::jsonb;
  v_idx integer;
  v_found boolean := false;
begin
  v_org_id := public.current_member_organization_id();
  v_member_id := public.current_member_id(v_org_id);

  if v_org_id is null or v_member_id is null then
    raise exception 'Your account is not linked to an active member profile.'
      using errcode = '42501';
  end if;

  if p_status not in ('Not Started', 'In Progress', 'Completed', 'Done') then
    raise exception 'Unsupported task status.'
      using errcode = '22023';
  end if;

  select ws.data into v_workspace
  from public.workspace_state ws
  where ws.organization_id = v_org_id
  for update;

  v_tasks := coalesce(v_workspace->'tasks', '[]'::jsonb);

  for v_idx in 0..greatest(jsonb_array_length(v_tasks) - 1, -1) loop
    v_task := v_tasks->v_idx;
    if v_task->>'id' = p_task_id
      and coalesce(v_task->>'assignedPerson', v_task->>'assigned_member_id', v_task->>'assignedMemberId') = v_member_id
    then
      v_task := v_task || jsonb_build_object('status', p_status, 'updatedAt', now()::text);
      v_found := true;
    end if;
    v_next_tasks := v_next_tasks || jsonb_build_array(v_task);
  end loop;

  if not v_found then
    raise exception 'Task was not found or is not assigned to you.'
      using errcode = '42501';
  end if;

  v_workspace := jsonb_set(v_workspace, '{tasks}', v_next_tasks, true);

  update public.workspace_state
     set data = v_workspace,
         updated_by = (select auth.uid()),
         updated_at = now()
   where organization_id = v_org_id;

  perform public.log_audit_event(v_org_id, 'member_task_status_updated', 'task', p_task_id, jsonb_build_object('status', p_status), true, 'member_portal');

  return app_private.workspace_member_portal(v_org_id, v_member_id);
end;
$$;

create or replace function public.submit_my_excuse_request(
  p_event_id text,
  p_reason text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_member_id text;
begin
  v_org_id := public.current_member_organization_id();
  v_member_id := public.current_member_id(v_org_id);

  if v_org_id is null or v_member_id is null then
    raise exception 'Your account is not linked to an active member profile.'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_event_id, '')), '') is null or nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Event and reason are required.'
      using errcode = '22023';
  end if;

  insert into public.member_excuse_requests (organization_id, member_id, event_id, reason, note)
  values (v_org_id, v_member_id, p_event_id, trim(p_reason), trim(coalesce(p_note, '')));

  perform public.log_audit_event(v_org_id, 'member_excuse_requested', 'event', p_event_id, jsonb_build_object('memberId', v_member_id), true, 'member_portal');

  return app_private.workspace_member_portal(v_org_id, v_member_id);
end;
$$;

revoke all on function public.current_member_id(uuid) from public;
revoke all on function public.current_member_id(uuid) from anon;
grant execute on function public.current_member_id(uuid) to authenticated;

revoke all on function public.current_member_organization_id() from public;
revoke all on function public.current_member_organization_id() from anon;
grant execute on function public.current_member_organization_id() to authenticated;

revoke all on function public.get_my_member_portal() from public;
revoke all on function public.get_my_member_portal() from anon;
grant execute on function public.get_my_member_portal() to authenticated;

revoke all on function public.update_my_member_profile(text, text, text, text, text) from public;
revoke all on function public.update_my_member_profile(text, text, text, text, text) from anon;
grant execute on function public.update_my_member_profile(text, text, text, text, text) to authenticated;

revoke all on function public.update_my_task_status(text, text) from public;
revoke all on function public.update_my_task_status(text, text) from anon;
grant execute on function public.update_my_task_status(text, text) to authenticated;

revoke all on function public.submit_my_excuse_request(text, text, text) from public;
revoke all on function public.submit_my_excuse_request(text, text, text) from anon;
grant execute on function public.submit_my_excuse_request(text, text, text) to authenticated;

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('portal_announcements', 'member_excuse_requests')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy "Members can read intended announcements"
on public.portal_announcements
for select
to authenticated
using (
  organization_id = public.current_member_organization_id()
  and published_at <= now()
  and (expires_at is null or expires_at > now())
  and (
    audience = 'All Active Members'
    or member_id = public.current_member_id(organization_id)
    or public.has_chapter_permission(organization_id, 'settings.view')
    or public.has_chapter_permission(organization_id, 'all')
  )
);

create policy "Authorized users can manage announcements"
on public.portal_announcements
for all
to authenticated
using (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
)
with check (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Members can read their own excuse requests"
on public.member_excuse_requests
for select
to authenticated
using (
  organization_id = public.current_member_organization_id()
  and (
    member_id = public.current_member_id(organization_id)
    or public.has_chapter_permission(organization_id, 'attendance.manage')
    or public.has_chapter_permission(organization_id, 'all')
  )
);

create policy "Members can submit their own excuse requests"
on public.member_excuse_requests
for insert
to authenticated
with check (
  organization_id = public.current_member_organization_id()
  and member_id = public.current_member_id(organization_id)
);

create policy "Authorized users can update excuse requests"
on public.member_excuse_requests
for update
to authenticated
using (
  public.has_chapter_permission(organization_id, 'attendance.manage')
  or public.has_chapter_permission(organization_id, 'all')
)
with check (
  public.has_chapter_permission(organization_id, 'attendance.manage')
  or public.has_chapter_permission(organization_id, 'all')
);

create or replace view public.member_portal_announcements
with (security_invoker = true)
as
select id, organization_id, title, body, audience, published_at, expires_at
from public.portal_announcements
where published_at <= now()
  and (expires_at is null or expires_at > now());

create or replace view public.member_portal_excuse_requests
with (security_invoker = true)
as
select id, organization_id, member_id, event_id, reason, note, status, submitted_at, reviewed_at
from public.member_excuse_requests;

grant select on public.member_portal_announcements to authenticated;
grant select on public.member_portal_excuse_requests to authenticated;
grant select, insert, update on public.portal_announcements to authenticated;
grant select, insert, update on public.member_excuse_requests to authenticated;
revoke all on public.portal_announcements from anon;
revoke all on public.member_excuse_requests from anon;
