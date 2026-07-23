-- Fix AO Command first-time setup persistence.
-- Creates a secure RPC used by the static frontend to save chapter setup as one transaction.

create schema if not exists app_private;

create or replace function app_private.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.organization_members om on om.user_id = p.id
    where p.id = check_user_id
      and p.approval_status = 'approved'
      and lower(om.role) = 'admin'
  );
$$;

create or replace function app_private.is_approved_org_member(
  check_org_id uuid,
  check_user_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.organization_members om on om.user_id = p.id
    where p.id = check_user_id
      and om.organization_id = check_org_id
      and p.approval_status = 'approved'
      and lower(om.role) = any (
        select lower(role_name)
        from unnest(allowed_roles) as role_name
      )
  );
$$;

create or replace function public.save_chapter_setup(
  p_setup jsonb,
  p_workspace jsonb
)
returns table (
  organization_id uuid,
  workspace_data jsonb
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_org_id uuid;
  v_chapter_name text := nullif(trim(coalesce(p_setup->>'chapterName', '')), '');
  v_school_name text := nullif(trim(coalesce(p_setup->>'schoolName', '')), '');
  v_term text := nullif(trim(coalesce(p_setup->>'term', '')), '');
  v_academic_year text := nullif(trim(coalesce(p_setup->>'academicYear', '')), '');
  v_existing_members integer := 0;
  v_is_initial_setup boolean := false;
  v_is_existing_admin boolean := false;
  v_workspace jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to finish setup.'
      using errcode = '28000';
  end if;

  if v_chapter_name is null then
    raise exception 'Chapter name is required.'
      using errcode = '22023';
  end if;

  if v_school_name is null then
    raise exception 'School is required.'
      using errcode = '22023';
  end if;

  if v_term is null then
    raise exception 'Term / semester is required.'
      using errcode = '22023';
  end if;

  if v_academic_year is null then
    raise exception 'Academic year is required.'
      using errcode = '22023';
  end if;

  select email
    into v_user_email
  from auth.users
  where id = v_user_id;

  select count(*)
    into v_existing_members
  from public.organization_members;

  v_is_initial_setup := v_existing_members = 0;
  v_is_existing_admin := app_private.is_admin(v_user_id);

  select om.organization_id
    into v_org_id
  from public.organization_members om
  where om.user_id = v_user_id
  order by om.created_at asc
  limit 1;

  if v_org_id is null and not v_is_initial_setup and not v_is_existing_admin then
    raise exception 'We could not create the chapter because your account does not have database permission.'
      using errcode = '42501';
  end if;

  if v_org_id is null then
    select id
      into v_org_id
    from public.organizations
    order by created_at asc
    limit 1;
  end if;

  if v_org_id is null then
    insert into public.organizations (name, created_by)
    values (v_chapter_name, v_user_id)
    returning id into v_org_id;
  else
    update public.organizations
       set name = v_chapter_name,
           updated_at = now()
     where id = v_org_id;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    requested_role,
    role,
    approval_status,
    updated_at
  )
  values (
    v_user_id,
    coalesce(v_user_email, ''),
    '',
    'Admin',
    'Admin',
    'approved',
    now()
  )
  on conflict (id) do update
     set email = coalesce(excluded.email, public.profiles.email),
         role = 'Admin',
         approval_status = 'approved',
         updated_at = now();

  insert into public.organization_members (
    organization_id,
    user_id,
    email,
    role
  )
  values (
    v_org_id,
    v_user_id,
    v_user_email,
    'admin'
  )
  on conflict (organization_id, user_id) do update
     set email = excluded.email,
         role = 'admin';

  v_workspace := coalesce(p_workspace, '{}'::jsonb)
    || jsonb_build_object(
      'settings',
      coalesce(p_setup, '{}'::jsonb) || jsonb_build_object('setupComplete', true)
    );

  insert into public.workspace_state (
    organization_id,
    data,
    updated_by,
    updated_at
  )
  values (
    v_org_id,
    v_workspace,
    v_user_id,
    now()
  )
  on conflict (organization_id) do update
     set data = excluded.data,
         updated_by = excluded.updated_by,
         updated_at = now();

  return query
  select v_org_id, v_workspace;
end;
$$;

revoke all on function public.save_chapter_setup(jsonb, jsonb) from public;
revoke all on function public.save_chapter_setup(jsonb, jsonb) from anon;
grant execute on function public.save_chapter_setup(jsonb, jsonb) to authenticated;

alter table if exists public.organizations enable row level security;
alter table if exists public.organization_members enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.workspace_state enable row level security;
