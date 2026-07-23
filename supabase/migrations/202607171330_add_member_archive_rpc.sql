-- Persist AO Command member deletion as a safe archive in workspace_state.
-- Canonical roster records are stored in workspace_state.data.members.
-- This function archives the member and active officer assignments while preserving
-- dues, attendance, payment, task, and historical records that reference the member id.

create or replace function public.archive_member_in_workspace(p_member_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_workspace jsonb;
  v_members jsonb;
  v_leadership jsonb;
  v_member jsonb;
  v_assignment jsonb;
  v_member_index integer := null;
  v_archived_member jsonb;
  v_idx integer;
  v_now text := now()::text;
  v_finance_count integer := 0;
  v_attendance_count integer := 0;
  v_task_count integer := 0;
  v_archived_assignments integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to remove a member.'
      using errcode = '28000';
  end if;

  if nullif(trim(coalesce(p_member_id, '')), '') is null then
    raise exception 'A member id is required.'
      using errcode = '22023';
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
    array['Admin', 'President', 'Treasurer', 'Assistant Treasurer']
  ) then
    raise exception 'You do not have permission to remove this member.'
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

  v_members := coalesce(v_workspace->'members', '[]'::jsonb);
  v_leadership := coalesce(v_workspace->'leadership', '[]'::jsonb);

  for v_idx in 0..greatest(jsonb_array_length(v_members) - 1, -1) loop
    v_member := v_members->v_idx;
    if v_member->>'id' = p_member_id then
      v_member_index := v_idx;
      exit;
    end if;
  end loop;

  if v_member_index is null then
    raise exception 'Member record was not found.'
      using errcode = 'P0002';
  end if;

  v_member := v_members->v_member_index;

  if lower(coalesce(v_member->>'archived', 'false')) = 'true'
    or lower(coalesce(v_member->>'lifecycle', '')) = 'archived'
    or v_member ? 'deletedAt'
  then
    return jsonb_build_object(
      'organization_id', v_org_id,
      'member_id', p_member_id,
      'alreadyArchived', true,
      'financeRecordsPreserved', 0,
      'attendanceRecordsPreserved', 0,
      'tasksPreserved', 0,
      'officerAssignmentsArchived', 0,
      'workspace_data', v_workspace
    );
  end if;

  select count(*)
    into v_finance_count
  from jsonb_array_elements(coalesce(v_workspace->'finance', '[]'::jsonb)) f
  where f->>'memberId' = p_member_id
     or f->>'member_id' = p_member_id;

  select count(*)
    into v_attendance_count
  from jsonb_array_elements(coalesce(v_workspace->'attendance', '[]'::jsonb)) a
  where a->>'personId' = p_member_id
     or a->>'memberId' = p_member_id
     or a->>'member_id' = p_member_id;

  select count(*)
    into v_task_count
  from jsonb_array_elements(coalesce(v_workspace->'tasks', '[]'::jsonb)) t
  where t->>'assignedPerson' = p_member_id
     or t->>'relatedMember' = p_member_id
     or t->>'memberId' = p_member_id
     or t->>'member_id' = p_member_id;

  v_archived_member := v_member
    || jsonb_build_object(
      'archived', true,
      'archivedAt', v_now,
      'deletedAt', v_now,
      'lifecycle', 'Archived',
      'memberStatus', 'Archived'
    );

  v_members := jsonb_set(v_members, array[v_member_index::text], v_archived_member, false);

  for v_idx in 0..greatest(jsonb_array_length(v_leadership) - 1, -1) loop
    v_assignment := v_leadership->v_idx;
    if coalesce(
      v_assignment->>'assignedMember',
      v_assignment->>'memberId',
      v_assignment->>'member_id',
      v_assignment->>'profileId',
      v_assignment->>'profile_id'
    ) = p_member_id then
      v_assignment := v_assignment
        || jsonb_build_object(
          'archived', true,
          'archivedAt', v_now,
          'deletedAt', v_now
        );
      v_leadership := jsonb_set(v_leadership, array[v_idx::text], v_assignment, false);
      v_archived_assignments := v_archived_assignments + 1;
    end if;
  end loop;

  v_workspace := jsonb_set(v_workspace, '{members}', v_members, true);
  v_workspace := jsonb_set(v_workspace, '{leadership}', v_leadership, true);

  insert into public.workspace_state (organization_id, data, updated_by, updated_at)
  values (v_org_id, v_workspace, v_user_id, now())
  on conflict on constraint workspace_state_pkey do update
     set data = excluded.data,
         updated_by = excluded.updated_by,
         updated_at = now();

  return jsonb_build_object(
    'organization_id', v_org_id,
    'member_id', p_member_id,
    'alreadyArchived', false,
    'financeRecordsPreserved', v_finance_count,
    'attendanceRecordsPreserved', v_attendance_count,
    'tasksPreserved', v_task_count,
    'officerAssignmentsArchived', v_archived_assignments,
    'workspace_data', v_workspace
  );
end;
$$;

revoke all on function public.archive_member_in_workspace(text) from public;
revoke all on function public.archive_member_in_workspace(text) from anon;
grant execute on function public.archive_member_in_workspace(text) to authenticated;

-- Update CSV import so archived/deleted members are not silently restored or duplicated.
create or replace function public.import_members_to_workspace(p_members jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_workspace jsonb;
  v_members jsonb;
  v_member jsonb;
  v_existing jsonb;
  v_merged jsonb;
  v_failed jsonb := '[]'::jsonb;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_failed_count integer := 0;
  v_total integer := 0;
  v_valid integer := 0;
  v_idx integer;
  v_found_index integer;
  v_existing_id text;
  v_incoming_id text;
  v_email text;
  v_roll text;
  v_first text;
  v_last text;
  v_existing_email text;
  v_existing_roll text;
  v_existing_first text;
  v_existing_last text;
  v_key text;
  v_value jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to import members.'
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
    array['Admin', 'President', 'Treasurer', 'Assistant Treasurer', 'Exec Board', 'Committee Chair']
  ) then
    raise exception 'Your account does not have permission to import members.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_members, '[]'::jsonb)) <> 'array' then
    raise exception 'Import payload must be a JSON array.'
      using errcode = '22023';
  end if;

  select ws.data
    into v_workspace
  from public.workspace_state ws
  where ws.organization_id = v_org_id
  for update;

  if v_workspace is null then
    v_workspace := jsonb_build_object(
      'version', 2,
      'members', '[]'::jsonb,
      'pnms', '[]'::jsonb,
      'events', '[]'::jsonb,
      'attendance', '[]'::jsonb,
      'finance', '[]'::jsonb,
      'tasks', '[]'::jsonb,
      'leadership', '[]'::jsonb,
      'activity', '[]'::jsonb
    );
  end if;

  v_members := coalesce(v_workspace->'members', '[]'::jsonb);

  for v_member in
    select value
    from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    v_total := v_total + 1;
    v_found_index := null;
    v_existing := null;

    v_incoming_id := nullif(trim(coalesce(v_member->>'id', v_member->>'memberId', v_member->>'member_id', '')), '');
    v_email := lower(nullif(trim(coalesce(v_member->>'email', '')), ''));
    v_roll := lower(nullif(trim(coalesce(
      v_member->>'rollNumber',
      v_member->>'roll_number',
      v_member->>'nationalMemberNumber',
      v_member->>'national_member_number',
      v_member->>'badgeNumber',
      v_member->>'badge_number',
      v_member->>'memberNumber',
      v_member->>'member_number',
      ''
    )), ''));
    v_first := lower(nullif(trim(coalesce(v_member->>'firstName', v_member->>'first_name', '')), ''));
    v_last := lower(nullif(trim(coalesce(v_member->>'lastName', v_member->>'last_name', '')), ''));

    if v_first is null or v_last is null then
      v_failed_count := v_failed_count + 1;
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'rowNumber', coalesce((v_member->>'csvRowNumber')::integer, v_total + 1),
        'name', trim(coalesce(v_member->>'firstName', '') || ' ' || coalesce(v_member->>'lastName', '')),
        'reason', 'Missing first name or last name.'
      ));
      continue;
    end if;

    v_valid := v_valid + 1;

    for v_idx in 0..greatest(jsonb_array_length(v_members) - 1, -1) loop
      v_existing := v_members->v_idx;
      v_existing_id := nullif(trim(coalesce(v_existing->>'id', '')), '');
      v_existing_email := lower(nullif(trim(coalesce(v_existing->>'email', '')), ''));
      v_existing_roll := lower(nullif(trim(coalesce(
        v_existing->>'rollNumber',
        v_existing->>'roll_number',
        v_existing->>'nationalMemberNumber',
        v_existing->>'national_member_number',
        v_existing->>'badgeNumber',
        v_existing->>'badge_number',
        v_existing->>'memberNumber',
        v_existing->>'member_number',
        ''
      )), ''));
      v_existing_first := lower(nullif(trim(coalesce(v_existing->>'firstName', v_existing->>'first_name', '')), ''));
      v_existing_last := lower(nullif(trim(coalesce(v_existing->>'lastName', v_existing->>'last_name', '')), ''));

      if (v_incoming_id is not null and v_existing_id = v_incoming_id)
        or (v_roll is not null and v_existing_roll = v_roll)
        or (v_email is not null and v_existing_email = v_email)
        or (v_email is null and v_roll is null and v_existing_first = v_first and v_existing_last = v_last)
      then
        v_found_index := v_idx;
        exit;
      end if;
    end loop;

    if v_found_index is null then
      v_member := v_member
        || jsonb_build_object(
          'id', coalesce(v_incoming_id, 'm_' || replace(gen_random_uuid()::text, '-', '')),
          'firstName', trim(coalesce(v_member->>'firstName', v_member->>'first_name', '')),
          'lastName', trim(coalesce(v_member->>'lastName', v_member->>'last_name', '')),
          'email', coalesce(v_email, ''),
          'phone', coalesce(regexp_replace(coalesce(v_member->>'phone', ''), '\D', '', 'g'), ''),
          'memberStatus', coalesce(nullif(trim(coalesce(v_member->>'memberStatus', v_member->>'member_status', '')), ''), 'Active'),
          'initiationStatus', coalesce(nullif(trim(coalesce(v_member->>'initiationStatus', v_member->>'initiation_status', '')), ''), 'Member'),
          'lifecycle', coalesce(nullif(trim(coalesce(v_member->>'lifecycle', '')), ''), 'Active'),
          'archived', false
        );
      v_members := v_members || jsonb_build_array(v_member);
      v_inserted := v_inserted + 1;
    else
      v_existing := v_members->v_found_index;

      if lower(coalesce(v_existing->>'archived', 'false')) = 'true'
        or lower(coalesce(v_existing->>'lifecycle', '')) = 'archived'
        or lower(coalesce(v_existing->>'memberStatus', '')) = 'archived'
        or v_existing ? 'deletedAt'
      then
        v_failed_count := v_failed_count + 1;
        v_failed := v_failed || jsonb_build_array(jsonb_build_object(
          'rowNumber', coalesce((v_member->>'csvRowNumber')::integer, v_total + 1),
          'name', trim(coalesce(v_member->>'firstName', '') || ' ' || coalesce(v_member->>'lastName', '')),
          'reason', 'An archived member already matches this row. Restore the archived member intentionally before importing.'
        ));
        continue;
      end if;

      v_merged := v_existing;

      for v_key, v_value in
        select key, value
        from jsonb_each(v_member)
      loop
        if v_key in ('id', 'csvRowNumber', 'archived', 'archivedAt', 'deletedAt') then
          continue;
        end if;

        if jsonb_typeof(v_value) = 'string' and trim(v_value #>> '{}') = '' then
          continue;
        end if;

        if v_value = 'null'::jsonb then
          continue;
        end if;

        v_merged := jsonb_set(v_merged, array[v_key], v_value, true);
      end loop;

      if v_email is not null then
        v_merged := jsonb_set(v_merged, '{email}', to_jsonb(v_email), true);
      end if;

      if v_member ? 'phone' then
        v_merged := jsonb_set(v_merged, '{phone}', to_jsonb(regexp_replace(coalesce(v_member->>'phone', ''), '\D', '', 'g')), true);
      end if;

      v_members := jsonb_set(v_members, array[v_found_index::text], v_merged, false);

      if v_merged = v_existing then
        v_skipped := v_skipped + 1;
      else
        v_updated := v_updated + 1;
      end if;
    end if;
  end loop;

  v_workspace := jsonb_set(v_workspace, '{members}', v_members, true);

  insert into public.workspace_state (organization_id, data, updated_by, updated_at)
  values (v_org_id, v_workspace, v_user_id, now())
  on conflict on constraint workspace_state_pkey do update
     set data = excluded.data,
         updated_by = excluded.updated_by,
         updated_at = now();

  return jsonb_build_object(
    'organization_id', v_org_id,
    'totalRows', v_total,
    'validRows', v_valid,
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'failed', v_failed_count,
    'failedRows', v_failed,
    'workspace_data', v_workspace
  );
end;
$$;

revoke all on function public.import_members_to_workspace(jsonb) from public;
revoke all on function public.import_members_to_workspace(jsonb) from anon;
grant execute on function public.import_members_to_workspace(jsonb) to authenticated;
