-- Allow Active Member self-service RPCs to write audit events for their own
-- chapter without granting access to the administrative audit log.

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

  if not (
    public.has_chapter_permission(p_organization_id, 'workspace.full.read')
    or public.has_chapter_permission(p_organization_id, 'member.portal.view')
    or public.has_chapter_permission(p_organization_id, 'all')
  ) then
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

revoke all on function public.log_audit_event(uuid, text, text, text, jsonb, boolean, text) from public;
revoke all on function public.log_audit_event(uuid, text, text, text, jsonb, boolean, text) from anon;
grant execute on function public.log_audit_event(uuid, text, text, text, jsonb, boolean, text) to authenticated;
