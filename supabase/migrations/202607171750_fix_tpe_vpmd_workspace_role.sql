-- Correct legacy TPE_VP of Membership Development records that should be VPMD.

update public.workspace_state ws
set data = jsonb_set(
  ws.data,
  '{leadership}',
  (
    select coalesce(jsonb_agg(
      case
        when lower(regexp_replace(replace(coalesce(item->>'role', ''), '_', ' '), '[^a-zA-Z0-9]+', ' ', 'g')) in (
          'tpe vp of membership development',
          'tpe vp membership development',
          'vp of membership development',
          'vp membership development',
          'vice president of membership development',
          'vice president membership development'
        )
        then item || jsonb_build_object(
          'role', 'VPMD',
          'formalPosition', 'VPMD',
          'fullPositionTitle', 'Vice President of Membership Development',
          'responsibilityLabel', 'Brotherhood',
          'isExecutive', true,
          'is_executive', true
        )
        else item
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(coalesce(ws.data->'leadership', '[]'::jsonb)) item
  ),
  true
),
updated_at = now()
where ws.data ? 'leadership';
