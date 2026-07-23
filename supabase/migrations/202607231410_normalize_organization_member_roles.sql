create or replace function public.normalize_organization_member_role_value(p_role text)
returns text
language plpgsql
immutable
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
  elsif normalized in ('committee_chair', 'chair') then
    return 'committee_chair';
  elsif normalized in ('advisor', 'read_only_advisor', 'readonly_advisor') then
    return 'advisor';
  elsif normalized in ('member', 'active_member') then
    return 'member';
  elsif normalized = 'officer' then
    return 'officer';
  end if;

  return normalized;
end;
$$;

create or replace function public.normalize_organization_member_role_trigger()
returns trigger
language plpgsql
as $$
begin
  new.role := public.normalize_organization_member_role_value(new.role);
  return new;
end;
$$;

drop trigger if exists normalize_organization_member_role_before_write on public.organization_members;
create trigger normalize_organization_member_role_before_write
before insert or update of role on public.organization_members
for each row
execute function public.normalize_organization_member_role_trigger();

update public.organization_members
set role = public.normalize_organization_member_role_value(role)
where role is distinct from public.normalize_organization_member_role_value(role);

grant execute on function public.normalize_organization_member_role_value(text) to authenticated;
