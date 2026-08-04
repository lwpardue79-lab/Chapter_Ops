-- Tighten role access after the Committee Chair retirement and AO-only pilot.
-- This keeps Assistant Treasurer finance-focused while preserving the JSON
-- workspace read permission currently required by the static frontend.

begin;

delete from public.app_role_permissions
where role = 'committee_chair';

delete from public.app_role_permissions
where role = 'assistant_treasurer'
  and permission_key in (
    'attendance.view',
    'attendance.manage',
    'brotherhood.events.admin.view',
    'brotherhood.events.manage',
    'dashboard.executive.view',
    'events.view',
    'officers.view',
    'recruitment.view',
    'recruitment.manage',
    'reports.executive.view',
    'view_kpi_meetings',
    'kpi.view',
    'kpi.submit_own',
    'kpi.manage_all',
    'settings.view',
    'settings.manage'
  );

insert into public.app_role_permissions (role, permission_key)
select 'assistant_treasurer', permission_key
from (values
  ('workspace.full.read'),
  ('dashboard.role.view'),
  ('members.list.view'),
  ('members.private_contact.view'),
  ('members.export'),
  ('handoffs.manage_own'),
  ('handoffs.access'),
  ('finance.summary.view'),
  ('finance.member_balances.view'),
  ('finance.manage'),
  ('finance.import'),
  ('finance.export'),
  ('reports.finance.view'),
  ('reports.export'),
  ('tasks.view_all'),
  ('tasks.manage')
) as permissions(permission_key)
on conflict (role, permission_key) do nothing;

-- Keep Recruitment focused on recruitment operations and its own KPI reporting.
delete from public.app_role_permissions
where role = 'recruitment'
  and permission_key in (
    'workspace.full.read',
    'dashboard.executive.view',
    'members.private_contact.view',
    'officers.view',
    'attendance.manage',
    'finance.summary.view',
    'finance.member_balances.view',
    'finance.manage',
    'reports.executive.view',
    'reports.finance.view',
    'settings.view',
    'settings.manage'
  );

insert into public.app_role_permissions (role, permission_key)
select 'recruitment', permission_key
from (values
  ('dashboard.role.view'),
  ('members.list.view'),
  ('handoffs.manage_own'),
  ('handoffs.access'),
  ('recruitment.view'),
  ('recruitment.manage'),
  ('reports.recruitment.view'),
  ('view_kpi_meetings'),
  ('kpi.view'),
  ('kpi.submit_own')
) as permissions(permission_key)
on conflict (role, permission_key) do nothing;

commit;
