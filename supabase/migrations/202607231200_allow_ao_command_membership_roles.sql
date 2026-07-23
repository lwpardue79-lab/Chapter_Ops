-- Allow every AO Command application role to be saved on chapter memberships.
-- The previous organization_members.role check only allowed the original
-- baseline roles, which caused Admin role assignment to fail for Recruitment,
-- VPMD, Assistant Treasurer, Exec Board, and Committee Chair.

alter table if exists public.organization_members
  drop constraint if exists organization_members_role_check;

alter table if exists public.organization_members
  add constraint organization_members_role_check
  check (
    role in (
      'admin',
      'president',
      'treasurer',
      'assistant_treasurer',
      'secretary',
      'vpmd',
      'recruitment',
      'executive',
      'exec_board',
      'committee_chair',
      'member',
      'active_member',
      'advisor',
      'read_only_advisor',
      'officer'
    )
  );

create or replace function app_private.normalize_db_role(p_role text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_role, '')) in ('admin', 'administrator')
      or lower(coalesce(p_role, '')) like '%admin%' then 'admin'
    when lower(coalesce(p_role, '')) in ('assistant_treasurer', 'assistant treasurer')
      or lower(coalesce(p_role, '')) like '%assistant%treasurer%' then 'assistant_treasurer'
    when lower(coalesce(p_role, '')) in ('treasurer')
      or lower(coalesce(p_role, '')) like '%treasurer%' then 'treasurer'
    when lower(coalesce(p_role, '')) in ('president')
      or lower(coalesce(p_role, '')) like '%president%' then 'president'
    when lower(coalesce(p_role, '')) in ('secretary')
      or lower(coalesce(p_role, '')) like '%secretary%' then 'secretary'
    when lower(coalesce(p_role, '')) in ('vpmd', 'brotherhood', 'vp membership development', 'vice president of membership development')
      or lower(coalesce(p_role, '')) like '%brotherhood%'
      or lower(coalesce(p_role, '')) like '%membership%development%' then 'vpmd'
    when lower(coalesce(p_role, '')) in ('recruitment', 'recruitment chair', 'rush', 'new member recruitment')
      or lower(coalesce(p_role, '')) like '%recruitment%'
      or lower(coalesce(p_role, '')) like '%rush%' then 'recruitment'
    when lower(coalesce(p_role, '')) in ('executive', 'exec_board', 'executive board', 'exec board')
      or lower(coalesce(p_role, '')) like '%exec%' then 'executive'
    when lower(coalesce(p_role, '')) in ('committee_chair', 'committee chair')
      or lower(coalesce(p_role, '')) like '%committee%' then 'committee_chair'
    when lower(coalesce(p_role, '')) in ('advisor', 'read_only_advisor', 'read only advisor', 'read-only advisor')
      or lower(coalesce(p_role, '')) like '%advisor%' then 'advisor'
    when lower(coalesce(p_role, '')) in ('member', 'active_member', 'active member') then 'member'
    else 'member'
  end
$$;

grant execute on function app_private.normalize_db_role(text) to authenticated;

-- Keep Recruitment scoped to recruitment operations and active-member context.
-- It should not inherit President/Admin style dashboard/report permissions.
delete from public.app_role_permissions
where role = 'recruitment'
  and permission_key in (
    'dashboard.executive.view',
    'reports.executive.view',
    'attendance.manage'
  );

insert into public.app_role_permissions (role, permission_key)
select role, permission_key
from (
  values
    ('recruitment', 'workspace.full.read'),
    ('recruitment', 'dashboard.role.view'),
    ('recruitment', 'members.list.view'),
    ('recruitment', 'recruitment.view'),
    ('recruitment', 'recruitment.manage'),
    ('recruitment', 'attendance.view'),
    ('recruitment', 'reports.recruitment.view'),
    ('recruitment', 'kpi.view'),
    ('recruitment', 'kpi.submit_own'),
    ('recruitment', 'tasks.view_all'),
    ('recruitment', 'tasks.manage')
) as permissions(role, permission_key)
on conflict (role, permission_key) do nothing;
