-- Harden AO Command role-based access control and RLS around the current
-- workspace_state JSON source of truth. This migration preserves all data.

create schema if not exists app_private;

create table if not exists public.app_role_permissions (
  role text not null,
  permission_key text not null,
  created_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  actor_user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  summary jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  source text not null default 'database',
  created_at timestamptz not null default now()
);

alter table if exists public.app_role_permissions enable row level security;
alter table if exists public.audit_logs enable row level security;
alter table if exists public.organizations enable row level security;
alter table if exists public.organization_members enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.workspace_state enable row level security;

insert into public.app_role_permissions (role, permission_key)
select role, permission_key
from (
  values
    ('admin', 'all'),
    ('president', 'workspace.full.read'),
    ('president', 'dashboard.executive.view'),
    ('president', 'members.list.view'),
    ('president', 'members.private_contact.view'),
    ('president', 'members.create'),
    ('president', 'members.update'),
    ('president', 'members.archive'),
    ('president', 'members.import'),
    ('president', 'members.export'),
    ('president', 'officers.view'),
    ('president', 'officers.manage'),
    ('president', 'recruitment.view'),
    ('president', 'recruitment.manage'),
    ('president', 'attendance.view'),
    ('president', 'attendance.manage'),
    ('president', 'finance.summary.view'),
    ('president', 'finance.member_balances.view'),
    ('president', 'reports.executive.view'),
    ('president', 'reports.finance.view'),
    ('president', 'reports.export'),
    ('president', 'kpi.view'),
    ('president', 'kpi.manage_all'),
    ('president', 'tasks.view_all'),
    ('president', 'tasks.manage'),
    ('president', 'settings.view'),
    ('president', 'backup.create'),
    ('treasurer', 'workspace.full.read'),
    ('treasurer', 'dashboard.executive.view'),
    ('treasurer', 'members.list.view'),
    ('treasurer', 'members.private_contact.view'),
    ('treasurer', 'members.export'),
    ('treasurer', 'officers.view'),
    ('treasurer', 'attendance.view'),
    ('treasurer', 'finance.summary.view'),
    ('treasurer', 'finance.member_balances.view'),
    ('treasurer', 'finance.manage'),
    ('treasurer', 'finance.import'),
    ('treasurer', 'finance.export'),
    ('treasurer', 'reports.finance.view'),
    ('treasurer', 'reports.export'),
    ('treasurer', 'kpi.view'),
    ('treasurer', 'kpi.submit_own'),
    ('treasurer', 'tasks.view_all'),
    ('treasurer', 'tasks.manage'),
    ('assistant_treasurer', 'workspace.full.read'),
    ('assistant_treasurer', 'dashboard.executive.view'),
    ('assistant_treasurer', 'members.list.view'),
    ('assistant_treasurer', 'members.private_contact.view'),
    ('assistant_treasurer', 'members.export'),
    ('assistant_treasurer', 'officers.view'),
    ('assistant_treasurer', 'attendance.view'),
    ('assistant_treasurer', 'finance.summary.view'),
    ('assistant_treasurer', 'finance.member_balances.view'),
    ('assistant_treasurer', 'finance.manage'),
    ('assistant_treasurer', 'finance.import'),
    ('assistant_treasurer', 'finance.export'),
    ('assistant_treasurer', 'reports.finance.view'),
    ('assistant_treasurer', 'reports.export'),
    ('assistant_treasurer', 'kpi.view'),
    ('assistant_treasurer', 'kpi.submit_own'),
    ('assistant_treasurer', 'tasks.view_all'),
    ('assistant_treasurer', 'tasks.manage'),
    ('secretary', 'workspace.full.read'),
    ('secretary', 'dashboard.executive.view'),
    ('secretary', 'members.list.view'),
    ('secretary', 'members.private_contact.view'),
    ('secretary', 'members.create'),
    ('secretary', 'members.update'),
    ('secretary', 'members.import'),
    ('secretary', 'members.export'),
    ('secretary', 'officers.view'),
    ('secretary', 'attendance.view'),
    ('secretary', 'attendance.manage'),
    ('secretary', 'reports.executive.view'),
    ('secretary', 'reports.export'),
    ('secretary', 'kpi.view'),
    ('secretary', 'kpi.manage_all'),
    ('secretary', 'tasks.view_all'),
    ('secretary', 'tasks.manage'),
    ('vpmd', 'workspace.full.read'),
    ('vpmd', 'dashboard.executive.view'),
    ('vpmd', 'members.list.view'),
    ('vpmd', 'members.private_contact.view'),
    ('vpmd', 'members.update'),
    ('vpmd', 'members.export'),
    ('vpmd', 'officers.view'),
    ('vpmd', 'attendance.view'),
    ('vpmd', 'attendance.manage'),
    ('vpmd', 'reports.executive.view'),
    ('vpmd', 'kpi.view'),
    ('vpmd', 'kpi.submit_own'),
    ('vpmd', 'tasks.view_all'),
    ('vpmd', 'tasks.manage'),
    ('recruitment', 'workspace.full.read'),
    ('recruitment', 'dashboard.executive.view'),
    ('recruitment', 'members.list.view'),
    ('recruitment', 'officers.view'),
    ('recruitment', 'recruitment.view'),
    ('recruitment', 'recruitment.manage'),
    ('recruitment', 'attendance.view'),
    ('recruitment', 'attendance.manage'),
    ('recruitment', 'reports.executive.view'),
    ('recruitment', 'kpi.view'),
    ('recruitment', 'kpi.submit_own'),
    ('recruitment', 'tasks.view_all'),
    ('recruitment', 'tasks.manage'),
    ('executive', 'workspace.full.read'),
    ('executive', 'dashboard.executive.view'),
    ('executive', 'members.list.view'),
    ('executive', 'members.private_contact.view'),
    ('executive', 'members.export'),
    ('executive', 'officers.view'),
    ('executive', 'recruitment.view'),
    ('executive', 'attendance.view'),
    ('executive', 'reports.executive.view'),
    ('executive', 'kpi.view'),
    ('executive', 'kpi.submit_own'),
    ('executive', 'tasks.view_all'),
    ('committee_chair', 'workspace.full.read'),
    ('committee_chair', 'members.list.view'),
    ('committee_chair', 'officers.view'),
    ('committee_chair', 'attendance.view'),
    ('committee_chair', 'attendance.manage'),
    ('committee_chair', 'kpi.view'),
    ('committee_chair', 'kpi.submit_own'),
    ('committee_chair', 'tasks.view_all'),
    ('committee_chair', 'tasks.manage'),
    ('member', 'member.portal.view'),
    ('member', 'members.self.view'),
    ('member', 'finance.self.view'),
    ('member', 'attendance.self.view'),
    ('member', 'tasks.view_own'),
    ('advisor', 'workspace.full.read'),
    ('advisor', 'dashboard.executive.view'),
    ('advisor', 'members.list.view'),
    ('advisor', 'officers.view'),
    ('advisor', 'attendance.view'),
    ('advisor', 'reports.executive.view'),
    ('advisor', 'reports.finance.view'),
    ('advisor', 'kpi.view')
) as permissions(role, permission_key)
on conflict (role, permission_key) do nothing;

create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_members_org_user_idx on public.organization_members(organization_id, user_id);
create index if not exists organization_members_org_role_idx on public.organization_members(organization_id, role);
create index if not exists profiles_approval_role_idx on public.profiles(approval_status, role);
create index if not exists audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function app_private.normalize_db_role(p_role text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_role, '')) like '%admin%' then 'admin'
    when lower(coalesce(p_role, '')) like '%assistant%treasurer%' then 'assistant_treasurer'
    when lower(coalesce(p_role, '')) like '%treasurer%' then 'treasurer'
    when lower(coalesce(p_role, '')) like '%president%' then 'president'
    when lower(coalesce(p_role, '')) like '%secretary%' then 'secretary'
    when lower(coalesce(p_role, '')) like '%vpmd%' or lower(coalesce(p_role, '')) like '%brotherhood%' or lower(coalesce(p_role, '')) like '%membership%development%' then 'vpmd'
    when lower(coalesce(p_role, '')) like '%recruitment%' or lower(coalesce(p_role, '')) like '%rush%' then 'recruitment'
    when lower(coalesce(p_role, '')) like '%exec%' then 'executive'
    when lower(coalesce(p_role, '')) like '%committee%' then 'committee_chair'
    when lower(coalesce(p_role, '')) like '%advisor%' then 'advisor'
    else 'member'
  end;
$$;

grant usage on schema app_private to authenticated;
grant execute on function app_private.normalize_db_role(text) to authenticated;

create or replace function public.has_chapter_permission(requested_chapter_id uuid, requested_permission text)
returns boolean
language sql
security definer
set search_path = app_private, public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    left join public.app_role_permissions rp
      on rp.role = app_private.normalize_db_role(coalesce(om.role, p.role))
    where om.organization_id = requested_chapter_id
      and om.user_id = (select auth.uid())
      and p.approval_status = 'approved'
      and (
        rp.permission_key = requested_permission
        or rp.permission_key = 'all'
      )
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = app_private, public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.user_id = (select auth.uid())
      and p.approval_status = 'approved'
      and app_private.normalize_db_role(coalesce(om.role, p.role)) = 'admin'
  );
$$;

create or replace function public.log_audit_event(
  p_organization_id uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_summary jsonb default '{}'::jsonb,
  p_success boolean default true,
  p_source text default 'rpc'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;

  if not public.has_chapter_permission(p_organization_id, 'workspace.full.read') then
    raise exception 'You do not have permission to write audit logs for this chapter.'
      using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    summary,
    success,
    source
  )
  values (
    p_organization_id,
    (select auth.uid()),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_summary, '{}'::jsonb),
    coalesce(p_success, true),
    coalesce(p_source, 'rpc')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.has_chapter_permission(uuid, text) from public;
revoke all on function public.has_chapter_permission(uuid, text) from anon;
grant execute on function public.has_chapter_permission(uuid, text) to authenticated;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_admin() from anon;
grant execute on function public.current_user_is_admin() to authenticated;

revoke all on function public.log_audit_event(uuid, text, text, text, jsonb, boolean, text) from public;
revoke all on function public.log_audit_event(uuid, text, text, text, jsonb, boolean, text) from anon;
grant execute on function public.log_audit_event(uuid, text, text, text, jsonb, boolean, text) to authenticated;

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('organizations', 'organization_members', 'profiles', 'workspace_state', 'app_role_permissions', 'audit_logs')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy "Approved members can read their organization"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.organization_id = organizations.id
      and om.user_id = (select auth.uid())
      and p.approval_status = 'approved'
  )
);

create policy "Admins can insert organizations"
on public.organizations
for insert
to authenticated
with check (public.current_user_is_admin());

create policy "Admins can update their organization"
on public.organizations
for update
to authenticated
using (public.has_chapter_permission(id, 'settings.manage') or public.has_chapter_permission(id, 'all'))
with check (public.has_chapter_permission(id, 'settings.manage') or public.has_chapter_permission(id, 'all'));

create policy "Users can read their own membership"
on public.organization_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_chapter_permission(organization_id, 'settings.view')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Admins can insert memberships"
on public.organization_members
for insert
to authenticated
with check (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Admins can update memberships"
on public.organization_members
for update
to authenticated
using (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
)
with check (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Users can read own profile and admins can read profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.current_user_is_admin()
);

create policy "Users can request their own profile"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  and approval_status = 'pending'
  and app_private.normalize_db_role(role) = 'member'
);

create policy "Users can update own non-admin profile and admins can update profiles"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  or public.current_user_is_admin()
)
with check (
  public.current_user_is_admin()
  or (
    id = (select auth.uid())
    and approval_status = 'pending'
    and app_private.normalize_db_role(role) = 'member'
  )
);

create policy "Authorized roles can read full workspace"
on public.workspace_state
for select
to authenticated
using (public.has_chapter_permission(organization_id, 'workspace.full.read'));

create policy "Authorized roles can insert workspace"
on public.workspace_state
for insert
to authenticated
with check (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'chapter.setup')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Authorized roles can update workspace"
on public.workspace_state
for update
to authenticated
using (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'members.update')
  or public.has_chapter_permission(organization_id, 'finance.manage')
  or public.has_chapter_permission(organization_id, 'recruitment.manage')
  or public.has_chapter_permission(organization_id, 'attendance.manage')
  or public.has_chapter_permission(organization_id, 'tasks.manage')
  or public.has_chapter_permission(organization_id, 'kpi.submit_own')
  or public.has_chapter_permission(organization_id, 'kpi.manage_all')
  or public.has_chapter_permission(organization_id, 'all')
)
with check (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'members.update')
  or public.has_chapter_permission(organization_id, 'finance.manage')
  or public.has_chapter_permission(organization_id, 'recruitment.manage')
  or public.has_chapter_permission(organization_id, 'attendance.manage')
  or public.has_chapter_permission(organization_id, 'tasks.manage')
  or public.has_chapter_permission(organization_id, 'kpi.submit_own')
  or public.has_chapter_permission(organization_id, 'kpi.manage_all')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Admins can manage app role permissions"
on public.app_role_permissions
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create policy "Authorized roles can read audit logs"
on public.audit_logs
for select
to authenticated
using (
  public.has_chapter_permission(organization_id, 'settings.view')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Authorized roles can insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (
    public.has_chapter_permission(organization_id, 'workspace.full.read')
    or public.has_chapter_permission(organization_id, 'all')
  )
);

grant select on public.app_role_permissions to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update on public.organization_members to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workspace_state to authenticated;
revoke all on public.app_role_permissions from anon;
revoke all on public.audit_logs from anon;
revoke all on public.organizations from anon;
revoke all on public.organization_members from anon;
revoke all on public.profiles from anon;
revoke all on public.workspace_state from anon;
