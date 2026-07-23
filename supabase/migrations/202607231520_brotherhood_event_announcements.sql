create or replace function app_private.create_brotherhood_event_announcement(
  p_org_id uuid,
  p_event public.brotherhood_events,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_title text;
  v_body text;
  v_expires_at timestamptz;
begin
  if p_event.id is null then
    return;
  end if;

  if p_event.status not in ('Published', 'Cancelled') and p_action not in ('published', 'cancelled') then
    return;
  end if;

  v_expires_at := coalesce(p_event.ends_at + interval '7 days', now() + interval '30 days');

  if p_action = 'cancelled' or p_event.status = 'Cancelled' then
    v_title := 'Event cancelled: ' || p_event.title;
    v_body := concat_ws(
      ' ',
      'The event scheduled for',
      to_char(p_event.starts_at at time zone 'America/Chicago', 'Mon FMDD, YYYY at FMHH:MI AM'),
      'has been cancelled.',
      case when nullif(trim(p_event.member_visible_notes), '') is not null then p_event.member_visible_notes else null end
    );
  elsif p_action = 'updated' then
    v_title := 'Event updated: ' || p_event.title;
    v_body := concat_ws(
      ' ',
      to_char(p_event.starts_at at time zone 'America/Chicago', 'Mon FMDD, YYYY at FMHH:MI AM'),
      '·',
      coalesce(nullif(trim(p_event.location), ''), 'Location TBA'),
      case when p_event.required then 'Required event.' else 'Optional event.' end,
      case when p_event.rsvp_deadline is not null then 'RSVP by ' || to_char(p_event.rsvp_deadline at time zone 'America/Chicago', 'Mon FMDD at FMHH:MI AM') || '.' else null end
    );
  else
    v_title := 'New event: ' || p_event.title;
    v_body := concat_ws(
      ' ',
      to_char(p_event.starts_at at time zone 'America/Chicago', 'Mon FMDD, YYYY at FMHH:MI AM'),
      '·',
      coalesce(nullif(trim(p_event.location), ''), 'Location TBA'),
      case when p_event.required then 'Required event.' else 'Optional event.' end,
      case when p_event.rsvp_deadline is not null then 'RSVP by ' || to_char(p_event.rsvp_deadline at time zone 'America/Chicago', 'Mon FMDD at FMHH:MI AM') || '.' else null end
    );
  end if;

  insert into public.portal_announcements (
    organization_id,
    title,
    body,
    audience,
    published_at,
    expires_at,
    created_by,
    updated_at
  )
  values (
    p_org_id,
    v_title,
    v_body,
    'All Active Members',
    now(),
    v_expires_at,
    (select auth.uid()),
    now()
  );
end;
$$;

create or replace function public.upsert_brotherhood_event(p_event_id uuid, p_event jsonb)
returns public.brotherhood_events
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_row public.brotherhood_events%rowtype;
  v_previous_status text;
  v_status text := coalesce(p_event->>'status', 'Draft');
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  v_org_id := app_private.current_org_for_permission('brotherhood.events.manage');
  if v_org_id is null then
    raise exception 'VPMD, President, or Admin access is required to manage Brotherhood Events.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_event->>'title', '')), '') is null then
    raise exception 'Event title is required.' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_event->>'description', '')), '') is null then
    raise exception 'Event description is required.' using errcode = '22023';
  end if;
  if (p_event->>'startsAt')::timestamptz is null or (p_event->>'endsAt')::timestamptz is null then
    raise exception 'Start and end date/time are required.' using errcode = '22023';
  end if;
  if (p_event->>'endsAt')::timestamptz <= (p_event->>'startsAt')::timestamptz then
    raise exception 'End time must be after start time.' using errcode = '22023';
  end if;
  if v_status not in ('Draft', 'Published', 'Completed', 'Cancelled', 'Archived') then
    raise exception 'Invalid event status.' using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.brotherhood_events (
      chapter_id, title, description, category, starts_at, ends_at, location,
      location_instructions, organizer_member_id, assigned_officer_member_id,
      required, audience, rsvp_deadline, capacity, waitlist_enabled, allow_maybe,
      excuse_required_for_required, attendance_method, attendance_opens_at,
      attendance_closes_at, participation_point_value, cover_image_url,
      member_visible_notes, status, published_at, created_by, updated_by
    )
    values (
      v_org_id,
      trim(p_event->>'title'),
      trim(coalesce(p_event->>'description', '')),
      coalesce(nullif(p_event->>'category', ''), 'Brotherhood'),
      (p_event->>'startsAt')::timestamptz,
      (p_event->>'endsAt')::timestamptz,
      trim(coalesce(p_event->>'location', '')),
      coalesce(p_event->>'locationInstructions', ''),
      nullif(p_event->>'organizerMemberId', ''),
      nullif(p_event->>'assignedOfficerMemberId', ''),
      coalesce((p_event->>'required')::boolean, false),
      coalesce(nullif(p_event->>'audience', ''), 'All Active Members'),
      nullif(p_event->>'rsvpDeadline', '')::timestamptz,
      nullif(p_event->>'capacity', '')::integer,
      coalesce((p_event->>'waitlistEnabled')::boolean, false),
      coalesce((p_event->>'allowMaybe')::boolean, true),
      coalesce((p_event->>'excuseRequiredForRequired')::boolean, true),
      coalesce(nullif(p_event->>'attendanceMethod', ''), 'Member roster check-off'),
      nullif(p_event->>'attendanceOpensAt', '')::timestamptz,
      nullif(p_event->>'attendanceClosesAt', '')::timestamptz,
      coalesce((p_event->>'participationPointValue')::numeric, 0),
      coalesce(p_event->>'coverImageUrl', ''),
      coalesce(p_event->>'memberVisibleNotes', ''),
      v_status,
      case when v_status = 'Published' then now() else null end,
      (select auth.uid()),
      (select auth.uid())
    )
    returning * into v_row;
    perform public.log_audit_event(v_org_id, 'brotherhood_event_created', 'brotherhood_event', v_row.id::text, jsonb_build_object('title', v_row.title, 'status', v_row.status), true, 'brotherhood_events');
    if v_row.status = 'Published' then
      perform app_private.create_brotherhood_event_announcement(v_org_id, v_row, 'published');
    end if;
  else
    select status into v_previous_status
    from public.brotherhood_events
    where id = p_event_id and chapter_id = v_org_id
    for update;

    update public.brotherhood_events
       set title = trim(p_event->>'title'),
           description = trim(coalesce(p_event->>'description', '')),
           category = coalesce(nullif(p_event->>'category', ''), 'Brotherhood'),
           starts_at = (p_event->>'startsAt')::timestamptz,
           ends_at = (p_event->>'endsAt')::timestamptz,
           location = trim(coalesce(p_event->>'location', '')),
           location_instructions = coalesce(p_event->>'locationInstructions', ''),
           organizer_member_id = nullif(p_event->>'organizerMemberId', ''),
           assigned_officer_member_id = nullif(p_event->>'assignedOfficerMemberId', ''),
           required = coalesce((p_event->>'required')::boolean, false),
           audience = coalesce(nullif(p_event->>'audience', ''), 'All Active Members'),
           rsvp_deadline = nullif(p_event->>'rsvpDeadline', '')::timestamptz,
           capacity = nullif(p_event->>'capacity', '')::integer,
           waitlist_enabled = coalesce((p_event->>'waitlistEnabled')::boolean, false),
           allow_maybe = coalesce((p_event->>'allowMaybe')::boolean, true),
           excuse_required_for_required = coalesce((p_event->>'excuseRequiredForRequired')::boolean, true),
           attendance_method = coalesce(nullif(p_event->>'attendanceMethod', ''), 'Member roster check-off'),
           attendance_opens_at = nullif(p_event->>'attendanceOpensAt', '')::timestamptz,
           attendance_closes_at = nullif(p_event->>'attendanceClosesAt', '')::timestamptz,
           participation_point_value = coalesce((p_event->>'participationPointValue')::numeric, 0),
           cover_image_url = coalesce(p_event->>'coverImageUrl', ''),
           member_visible_notes = coalesce(p_event->>'memberVisibleNotes', ''),
           status = v_status,
           published_at = case when v_status = 'Published' and published_at is null then now() else published_at end,
           updated_by = (select auth.uid()),
           updated_at = now()
     where id = p_event_id
       and chapter_id = v_org_id
     returning * into v_row;
    if not found then
      raise exception 'Brotherhood Event not found.' using errcode = '02000';
    end if;
    perform public.log_audit_event(v_org_id, 'brotherhood_event_edited', 'brotherhood_event', v_row.id::text, jsonb_build_object('title', v_row.title, 'status', v_row.status), true, 'brotherhood_events');
    if v_row.status = 'Published' and coalesce(v_previous_status, '') <> 'Published' then
      perform app_private.create_brotherhood_event_announcement(v_org_id, v_row, 'published');
    elsif v_row.status = 'Published' then
      perform app_private.create_brotherhood_event_announcement(v_org_id, v_row, 'updated');
    end if;
  end if;

  insert into public.brotherhood_event_private_notes (chapter_id, event_id, private_officer_notes, created_by, updated_by)
  values (v_org_id, v_row.id, coalesce(p_event->>'privateOfficerNotes', ''), (select auth.uid()), (select auth.uid()))
  on conflict (event_id) do update
     set private_officer_notes = excluded.private_officer_notes,
         updated_by = (select auth.uid()),
         updated_at = now();

  return v_row;
end;
$$;

create or replace function public.set_brotherhood_event_status(p_event_id uuid, p_status text)
returns public.brotherhood_events
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_previous text;
  v_row public.brotherhood_events%rowtype;
begin
  v_org_id := app_private.current_org_for_permission('brotherhood.events.manage');
  if v_org_id is null then
    raise exception 'VPMD, President, or Admin access is required.' using errcode = '42501';
  end if;
  if p_status not in ('Draft', 'Published', 'Completed', 'Cancelled', 'Archived') then
    raise exception 'Invalid event status.' using errcode = '22023';
  end if;
  select status into v_previous from public.brotherhood_events where id = p_event_id and chapter_id = v_org_id for update;
  if not found then
    raise exception 'Brotherhood Event not found.' using errcode = '02000';
  end if;
  update public.brotherhood_events
     set status = p_status,
         published_at = case when p_status = 'Published' and published_at is null then now() else published_at end,
         updated_by = (select auth.uid()),
         updated_at = now()
   where id = p_event_id and chapter_id = v_org_id
   returning * into v_row;
  perform public.log_audit_event(v_org_id, 'brotherhood_event_status_changed', 'brotherhood_event', p_event_id::text, jsonb_build_object('previous', v_previous, 'next', p_status, 'title', v_row.title), true, 'brotherhood_events');
  if p_status = 'Published' and coalesce(v_previous, '') <> 'Published' then
    perform app_private.create_brotherhood_event_announcement(v_org_id, v_row, 'published');
  elsif p_status = 'Cancelled' and coalesce(v_previous, '') <> 'Cancelled' then
    perform app_private.create_brotherhood_event_announcement(v_org_id, v_row, 'cancelled');
  end if;
  return v_row;
end;
$$;

revoke all on function app_private.create_brotherhood_event_announcement(uuid, public.brotherhood_events, text) from public;
revoke all on function app_private.create_brotherhood_event_announcement(uuid, public.brotherhood_events, text) from anon;
