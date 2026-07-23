-- Tighten Officer Handoff Center visibility after initial handoff migration.
-- Role-specific officers should manage their own handoff workspace without
-- automatically receiving broad access to every officer's private transition notes.

delete from public.app_role_permissions
where permission_key = 'handoffs.view'
  and role in (
    'vpmd',
    'recruitment',
    'treasurer',
    'assistant_treasurer',
    'secretary',
    'committee_chair'
  );

insert into public.app_role_permissions (role, permission_key)
values
  ('admin', 'handoffs.view'),
  ('admin', 'handoffs.manage'),
  ('president', 'handoffs.view'),
  ('president', 'handoffs.manage'),
  ('executive', 'handoffs.view'),
  ('advisor', 'handoffs.view'),
  ('vpmd', 'handoffs.manage_own'),
  ('recruitment', 'handoffs.manage_own'),
  ('treasurer', 'handoffs.manage_own'),
  ('assistant_treasurer', 'handoffs.manage_own'),
  ('secretary', 'handoffs.manage_own'),
  ('committee_chair', 'handoffs.manage_own')
on conflict (role, permission_key) do nothing;
