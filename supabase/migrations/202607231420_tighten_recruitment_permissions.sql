delete from public.app_role_permissions
where role = 'recruitment'
  and permission_key in (
    'workspace.full.read',
    'dashboard.executive.view',
    'settings.view',
    'settings.manage',
    'officers.view',
    'officers.manage',
    'events.view',
    'brotherhood.events.admin.view',
    'brotherhood.events.manage',
    'attendance.view',
    'attendance.manage',
    'finance.summary.view',
    'finance.member_balances.view',
    'finance.manage',
    'reports.executive.view',
    'reports.finance.view',
    'tasks.view_all',
    'tasks.manage'
  );

insert into public.app_role_permissions (role, permission_key)
values
  ('recruitment', 'dashboard.role.view'),
  ('recruitment', 'members.list.view'),
  ('recruitment', 'recruitment.view'),
  ('recruitment', 'recruitment.manage'),
  ('recruitment', 'reports.recruitment.view'),
  ('recruitment', 'kpi.view'),
  ('recruitment', 'kpi.submit_own')
on conflict (role, permission_key) do nothing;
