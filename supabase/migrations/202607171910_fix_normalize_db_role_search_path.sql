-- Fix Supabase advisor warning: app_private.normalize_db_role must have
-- an explicit search_path.

create or replace function app_private.normalize_db_role(p_role text)
returns text
language sql
immutable
set search_path = pg_catalog
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

grant execute on function app_private.normalize_db_role(text) to authenticated;
