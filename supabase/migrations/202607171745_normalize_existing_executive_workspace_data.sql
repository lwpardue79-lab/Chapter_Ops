-- Data-safe one-time normalization for existing AO Command workspace_state rows.
-- This updates existing leadership JSON records in-place without deleting members or history.

do $$
declare
  v_row record;
  v_leadership jsonb;
  v_next_leadership jsonb;
  v_assignment jsonb;
  v_role text;
  v_key text;
  v_seen text[];
  v_idx integer;
  v_member_id text;
begin
  for v_row in
    select organization_id, data
    from public.workspace_state
    where data ? 'leadership'
  loop
    v_leadership := coalesce(v_row.data->'leadership', '[]'::jsonb);
    v_next_leadership := '[]'::jsonb;
    v_seen := array[]::text[];

    for v_idx in 0..greatest(jsonb_array_length(v_leadership) - 1, -1) loop
      v_assignment := v_leadership->v_idx;
      v_role := lower(regexp_replace(coalesce(v_assignment->>'role', ''), '[^a-zA-Z0-9]+', ' ', 'g'));
      v_role := trim(regexp_replace(v_role, '^tpe\\s+', '', 'i'));
      v_role := replace(v_role, 'chairman', 'chair');

      if v_role in ('vpmd', 'vp membership development', 'vice president of membership development', 'vice president membership development', 'membership development', 'brotherhood', 'brotherhood chair', 'brotherhood vpmd', 'vpmd brotherhood') then
        v_assignment := v_assignment || jsonb_build_object('role', 'VPMD', 'formalPosition', 'VPMD', 'fullPositionTitle', 'Vice President of Membership Development', 'responsibilityLabel', 'Brotherhood', 'isExecutive', true, 'is_executive', true);
      elsif v_role in ('recruitment', 'recruitment chair', 'rush', 'new member recruitment') then
        v_assignment := v_assignment || jsonb_build_object('role', 'Recruitment', 'formalPosition', 'Recruitment', 'responsibilityLabel', 'Recruitment', 'isExecutive', true, 'is_executive', true);
      elsif v_role in ('risk manager', 'risk management') then
        v_assignment := v_assignment || jsonb_build_object('role', 'Risk Management', 'formalPosition', 'Risk Management', 'responsibilityLabel', 'Risk Management', 'isExecutive', true, 'is_executive', true);
      elsif v_role in ('health safety', 'health and safety', 'health and safety officer') then
        v_assignment := v_assignment || jsonb_build_object('role', 'Health and Safety', 'formalPosition', 'Health and Safety', 'responsibilityLabel', 'Health and Safety', 'isExecutive', true, 'is_executive', true);
      elsif v_role in ('new member educator', 'new member education') then
        v_assignment := v_assignment || jsonb_build_object('role', 'New Member Education', 'formalPosition', 'New Member Education', 'isExecutive', true, 'is_executive', true);
      elsif coalesce(v_assignment->>'role', '') <> '' and coalesce(v_assignment->>'role', '') <> 'General member' then
        v_assignment := v_assignment || jsonb_build_object('isExecutive', true, 'is_executive', true);
      end if;

      v_member_id := coalesce(v_assignment->>'assignedMember', v_assignment->>'memberId', v_assignment->>'member_id', v_assignment->>'userId', v_assignment->>'user_id', v_assignment->>'profileId', v_assignment->>'profile_id', '');
      v_key := v_member_id || ':' || lower(coalesce(v_assignment->>'role', '')) || ':' || coalesce(v_assignment->>'termStartDate', v_assignment->>'term_start_date', '') || ':' || coalesce(v_assignment->>'termEndDate', v_assignment->>'term_end_date', '') || ':' || coalesce(v_assignment->>'archived', 'false');

      if coalesce(v_assignment->>'archived', 'false') = 'false'
        and v_member_id <> ''
        and coalesce(v_assignment->>'role', '') <> ''
        and v_key = any(v_seen)
      then
        continue;
      end if;

      if coalesce(v_assignment->>'archived', 'false') = 'false' then
        v_seen := array_append(v_seen, v_key);
      end if;

      v_next_leadership := v_next_leadership || jsonb_build_array(v_assignment);
    end loop;

    update public.workspace_state
    set data = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(v_row.data, '{leadership}', v_next_leadership, true),
                  '{kpiMeetings}', coalesce(v_row.data->'kpiMeetings', '[]'::jsonb), true
                ),
                '{kpiDefinitions}', coalesce(v_row.data->'kpiDefinitions', '[]'::jsonb), true
              ),
              '{kpiPositionReports}', coalesce(v_row.data->'kpiPositionReports', '[]'::jsonb), true
            ),
            '{kpiResults}', coalesce(v_row.data->'kpiResults', '[]'::jsonb), true
          ),
          '{kpiActionItems}', coalesce(v_row.data->'kpiActionItems', '[]'::jsonb), true
        ),
        updated_at = now()
    where organization_id = v_row.organization_id;
  end loop;
end $$;
