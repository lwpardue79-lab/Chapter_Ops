-- Normalize Executive Team roles and initialize KPI workspace arrays in ChapterOps.
-- The current production app stores operational records in workspace_state.data JSON.
-- This RPC preserves member/finance/attendance/task data, canonicalizes VPMD/Brotherhood
-- into one VPMD role, keeps Recruitment separate, marks active officer assignments as
-- executive, and deduplicates only exact active same-member/same-position/same-term rows.

create or replace function public.normalize_executive_team_kpi_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_workspace jsonb;
  v_leadership jsonb;
  v_next_leadership jsonb := '[]'::jsonb;
  v_assignment jsonb;
  v_role text;
  v_key text;
  v_seen text[] := array[]::text[];
  v_idx integer;
  v_member_id text;
  v_deduped integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to normalize Executive Team data.'
      using errcode = '28000';
  end if;

  select om.organization_id
    into v_org_id
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  where om.user_id = v_user_id
    and p.approval_status = 'approved'
  order by om.created_at asc
  limit 1;

  if v_org_id is null then
    raise exception 'Your account is not connected to an approved chapter workspace.'
      using errcode = '42501';
  end if;

  if not app_private.is_approved_org_member(
    v_org_id,
    v_user_id,
    array['Admin', 'President']
  ) then
    raise exception 'Only Admin or President roles can normalize Executive Team data.'
      using errcode = '42501';
  end if;

  select ws.data
    into v_workspace
  from public.workspace_state ws
  where ws.organization_id = v_org_id
  for update;

  if v_workspace is null then
    raise exception 'Chapter workspace was not found.'
      using errcode = 'P0002';
  end if;

  v_leadership := coalesce(v_workspace->'leadership', '[]'::jsonb);

  for v_idx in 0..greatest(jsonb_array_length(v_leadership) - 1, -1) loop
    v_assignment := v_leadership->v_idx;
    v_role := lower(regexp_replace(coalesce(v_assignment->>'role', ''), '[^a-zA-Z0-9]+', ' ', 'g'));
    v_role := trim(regexp_replace(v_role, '^tpe\\s+', '', 'i'));
    v_role := replace(v_role, 'chairman', 'chair');

    if v_role in ('vpmd', 'vp membership development', 'vice president of membership development', 'vice president membership development', 'membership development', 'brotherhood', 'brotherhood chair', 'brotherhood vpmd', 'vpmd brotherhood') then
      v_assignment := v_assignment
        || jsonb_build_object(
          'role', 'VPMD',
          'formalPosition', 'VPMD',
          'fullPositionTitle', 'Vice President of Membership Development',
          'responsibilityLabel', 'Brotherhood',
          'isExecutive', true,
          'is_executive', true
        );
    elsif v_role in ('recruitment', 'recruitment chair', 'rush', 'new member recruitment') then
      v_assignment := v_assignment
        || jsonb_build_object(
          'role', 'Recruitment',
          'formalPosition', 'Recruitment',
          'responsibilityLabel', 'Recruitment',
          'isExecutive', true,
          'is_executive', true
        );
    elsif v_role in ('risk manager', 'risk management') then
      v_assignment := v_assignment || jsonb_build_object('role', 'Risk Management', 'formalPosition', 'Risk Management', 'responsibilityLabel', 'Risk Management', 'isExecutive', true, 'is_executive', true);
    elsif v_role in ('health safety', 'health and safety', 'health and safety officer') then
      v_assignment := v_assignment || jsonb_build_object('role', 'Health and Safety', 'formalPosition', 'Health and Safety', 'responsibilityLabel', 'Health and Safety', 'isExecutive', true, 'is_executive', true);
    elsif v_role in ('new member educator', 'new member education') then
      v_assignment := v_assignment || jsonb_build_object('role', 'New Member Education', 'formalPosition', 'New Member Education', 'isExecutive', true, 'is_executive', true);
    elsif coalesce(v_assignment->>'role', '') <> '' and coalesce(v_assignment->>'role', '') <> 'General member' then
      v_assignment := v_assignment || jsonb_build_object('isExecutive', true, 'is_executive', true);
    end if;

    v_member_id := coalesce(
      v_assignment->>'assignedMember',
      v_assignment->>'memberId',
      v_assignment->>'member_id',
      v_assignment->>'userId',
      v_assignment->>'user_id',
      v_assignment->>'profileId',
      v_assignment->>'profile_id',
      ''
    );
    v_key := v_member_id || ':' || lower(coalesce(v_assignment->>'role', '')) || ':' || coalesce(v_assignment->>'termStartDate', v_assignment->>'term_start_date', '') || ':' || coalesce(v_assignment->>'termEndDate', v_assignment->>'term_end_date', '') || ':' || coalesce(v_assignment->>'archived', 'false');

    if coalesce(v_assignment->>'archived', 'false') = 'false'
      and v_member_id <> ''
      and coalesce(v_assignment->>'role', '') <> ''
      and v_key = any(v_seen)
    then
      v_deduped := v_deduped + 1;
      continue;
    end if;

    if coalesce(v_assignment->>'archived', 'false') = 'false' then
      v_seen := array_append(v_seen, v_key);
    end if;
    v_next_leadership := v_next_leadership || jsonb_build_array(v_assignment);
  end loop;

  v_workspace := jsonb_set(v_workspace, '{leadership}', v_next_leadership, true);
  v_workspace := jsonb_set(v_workspace, '{kpiMeetings}', coalesce(v_workspace->'kpiMeetings', '[]'::jsonb), true);
  v_workspace := jsonb_set(v_workspace, '{kpiDefinitions}', coalesce(v_workspace->'kpiDefinitions', '[]'::jsonb), true);
  v_workspace := jsonb_set(v_workspace, '{kpiPositionReports}', coalesce(v_workspace->'kpiPositionReports', '[]'::jsonb), true);
  v_workspace := jsonb_set(v_workspace, '{kpiResults}', coalesce(v_workspace->'kpiResults', '[]'::jsonb), true);
  v_workspace := jsonb_set(v_workspace, '{kpiActionItems}', coalesce(v_workspace->'kpiActionItems', '[]'::jsonb), true);

  insert into public.workspace_state (organization_id, data, updated_by, updated_at)
  values (v_org_id, v_workspace, v_user_id, now())
  on conflict on constraint workspace_state_pkey do update
     set data = excluded.data,
         updated_by = excluded.updated_by,
         updated_at = now();

  return jsonb_build_object(
    'organization_id', v_org_id,
    'dedupedAssignments', v_deduped,
    'workspace_data', v_workspace
  );
end;
$$;

revoke all on function public.normalize_executive_team_kpi_workspace() from public;
revoke all on function public.normalize_executive_team_kpi_workspace() from anon;
grant execute on function public.normalize_executive_team_kpi_workspace() to authenticated;
