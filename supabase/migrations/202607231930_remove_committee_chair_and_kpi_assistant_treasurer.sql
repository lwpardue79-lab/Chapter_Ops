-- Remove the retired Committee Chair application role and gate KPI Meetings
-- behind the centralized view_kpi_meetings permission.

begin;

-- Convert any existing Committee Chair memberships to standard member access.
-- If a person also holds another officer assignment in app data, that remains
-- connected to the member record; this only changes the app-login role.
update public.organization_members
set role = 'member'
where lower(coalesce(role, '')) in ('committee_chair', 'committee chair')
   or lower(coalesce(role, '')) like '%committee%';

update public.profiles
set role = 'Active Member'
where lower(coalesce(role, '')) in ('committee_chair', 'committee chair')
   or lower(coalesce(role, '')) like '%committee%';

update public.profiles
set requested_role = 'Active Member'
where lower(coalesce(requested_role, '')) in ('committee_chair', 'committee chair')
   or lower(coalesce(requested_role, '')) like '%committee%';

-- Remove role grants for the retired role and remove KPI grants from Assistant Treasurer.
delete from public.app_role_permissions
where role = 'committee_chair'
   or (
    role = 'assistant_treasurer'
    and permission_key in ('view_kpi_meetings', 'kpi.view', 'kpi.submit_own', 'kpi.manage_all')
  );

-- Central KPI view permission. Existing authorized executive/reporting roles
-- keep access; Assistant Treasurer intentionally does not.
insert into public.app_role_permissions (role, permission_key)
select role, 'view_kpi_meetings'
from (values
  ('admin'),
  ('president'),
  ('treasurer'),
  ('secretary'),
  ('vpmd'),
  ('recruitment'),
  ('executive'),
  ('advisor')
) as roles(role)
on conflict (role, permission_key) do nothing;

-- Keep legacy KPI submit/manage permissions aligned with the new view gate.
delete from public.app_role_permissions
where permission_key in ('kpi.view', 'kpi.submit_own', 'kpi.manage_all')
  and role in ('assistant_treasurer', 'committee_chair');

-- Recreate the role check without Committee Chair.
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
    when lower(coalesce(p_role, '')) like '%committee%' then 'member'
    when lower(coalesce(p_role, '')) in ('advisor', 'read_only_advisor', 'read only advisor', 'read-only advisor')
      or lower(coalesce(p_role, '')) like '%advisor%' then 'advisor'
    when lower(coalesce(p_role, '')) in ('member', 'active_member', 'active member') then 'member'
    else 'member'
  end
$$;

grant execute on function app_private.normalize_db_role(text) to authenticated;

create or replace function public.normalize_organization_member_role_value(p_role text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text := lower(trim(coalesce(p_role, 'member')));
begin
  normalized := replace(replace(normalized, '-', '_'), ' ', '_');

  if normalized in ('admin', 'administrator') then
    return 'admin';
  elsif normalized in ('president', 'chapter_president') then
    return 'president';
  elsif normalized in ('assistant_treasurer', 'asst_treasurer') then
    return 'assistant_treasurer';
  elsif normalized = 'treasurer' then
    return 'treasurer';
  elsif normalized = 'secretary' then
    return 'secretary';
  elsif normalized in ('vpmd', 'brotherhood', 'membership_development', 'vp_membership_development', 'vice_president_of_membership_development') then
    return 'vpmd';
  elsif normalized in ('recruitment', 'rush', 'recruitment_chair', 'recruitment_chairman') then
    return 'recruitment';
  elsif normalized in ('executive', 'exec_board', 'executive_board', 'exec') then
    return 'executive';
  elsif normalized in ('committee_chair', 'committee', 'committeechair', 'chair') then
    return 'member';
  elsif normalized in ('advisor', 'read_only_advisor', 'readonly_advisor') then
    return 'advisor';
  elsif normalized in ('member', 'active_member') then
    return 'member';
  elsif normalized = 'officer' then
    return 'officer';
  end if;

  return 'member';
end;
$$;

grant execute on function public.normalize_organization_member_role_value(text) to authenticated;

commit;
