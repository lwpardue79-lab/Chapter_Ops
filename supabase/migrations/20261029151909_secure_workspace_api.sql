-- Stage 1: authenticated, chapter-scoped workspace APIs. No chapter data is reset.
begin;

create or replace function public.has_chapter_permission(requested_chapter_id uuid, requested_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    join public.profiles p on p.id = om.user_id
    join public.app_role_permissions rp on rp.role = app_private.normalize_db_role(om.role)
    where om.organization_id = requested_chapter_id and om.user_id = auth.uid()
      and coalesce(om.status, 'active') = 'active' and p.approval_status = 'approved'
      and rp.permission_key in (requested_permission, 'all')
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members om join public.profiles p on p.id=om.user_id
    where om.user_id=auth.uid() and coalesce(om.status,'active')='active' and p.approval_status='approved'
      and app_private.normalize_db_role(om.role)='admin');
$$;
revoke all on function public.current_user_is_admin() from public,anon;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function app_private.json_pick(p_value jsonb, p_keys text[])
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(coalesce(p_value, '{}'::jsonb)) where key = any(p_keys);
$$;

create or replace function app_private.require_workspace_org(p_org uuid default null)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode='28000'; end if;
  select om.organization_id into v_org from public.organization_members om
    join public.profiles p on p.id=om.user_id
    where om.user_id=auth.uid() and p.approval_status='approved'
      and coalesce(om.status,'active')='active' and (p_org is null or om.organization_id=p_org)
    order by om.created_at limit 1;
  if v_org is null then raise exception 'Approved chapter access required.' using errcode='42501'; end if;
  return v_org;
end;
$$;

create or replace function app_private.workspace_writable_keys(p_org uuid)
returns text[] language plpgsql stable set search_path = '' as $$
declare v_keys text[] := array[]::text[]; v_key text; v_perm text;
begin
  for v_key,v_perm in select * from (values
    ('members','members.update'),('pnms','recruitment.manage'),('events','attendance.manage'),
    ('attendance','attendance.manage'),('finance','finance.manage'),('financeAccounts','finance.manage'),
    ('tasks','tasks.manage'),('leadership','officers.manage'),('settings','settings.manage')
  ) permissions(key,perm) loop
    if public.has_chapter_permission(p_org,v_perm) then v_keys:=array_append(v_keys,v_key); end if;
  end loop;
  if public.has_chapter_permission(p_org,'members.create') and not 'members'=any(v_keys) then v_keys:=array_append(v_keys,'members'); end if;
  if public.has_chapter_permission(p_org,'view_kpi_meetings') then
    if public.has_chapter_permission(p_org,'kpi.manage_all') then
      v_keys:=v_keys||array['kpiMeetings','kpiDefinitions','kpiPositionReports','kpiResults','kpiActionItems'];
    elsif public.has_chapter_permission(p_org,'kpi.submit_own') then
      v_keys:=v_keys||array['kpiPositionReports','kpiResults','kpiActionItems'];
    end if;
  end if;
  return v_keys;
end;
$$;

create or replace function app_private.project_workspace(p_org uuid,p_data jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_view jsonb := jsonb_build_object('version',2); v_key text; v_perm text; v_members jsonb; v_fields text[];
begin
  if public.has_chapter_permission(p_org,'all') then return p_data; end if;
  v_view:=v_view||jsonb_build_object('settings',app_private.json_pick(p_data->'settings',array[
    'chapterName','schoolName','term','academicYear','setupComplete','officerRoles','executiveOfficerRoles',
    'memberStatuses','eventTypes','committees','attendanceThreshold','defaultMeetingName','lateThresholdMinutes',
    'lateCountsAs','excusedHandling','defaultAttendanceEventType','defaultAttendanceRequired','privacyNotice'
  ]));
  if public.has_chapter_permission(p_org,'settings.manage') then v_view:=jsonb_set(v_view,'{settings}',p_data->'settings'); end if;
  if public.has_chapter_permission(p_org,'finance.member_balances.view') then
    v_view:=jsonb_set(v_view,'{settings}',(v_view->'settings')||app_private.json_pick(p_data->'settings',array['defaultDuesAmount','duesDueDates']));
  end if;
  if public.has_chapter_permission(p_org,'members.list.view') then
    v_fields:=array['id','firstName','lastName','preferredName','schoolYear','graduationYear','major','hometown',
      'memberStatus','initiationStatus','officerRole','committee','lifecycle','archived','deletedAt','archivedAt'];
    if public.has_chapter_permission(p_org,'members.private_contact.view') then
      v_fields:=v_fields||array['email','phone','rollNumber','memberNumber','nationalMemberNumber','badgeNumber','housingStatus','tags'];
    end if;
    if public.has_chapter_permission(p_org,'finance.member_balances.view') then v_fields:=array_append(v_fields,'duesStatus'); end if;
    select coalesce(jsonb_agg(app_private.json_pick(m,v_fields)),'[]'::jsonb) into v_members
      from jsonb_array_elements(coalesce(p_data->'members','[]'::jsonb)) m;
    v_view:=v_view||jsonb_build_object('members',v_members);
  end if;
  for v_key,v_perm in select * from (values
    ('pnms','recruitment.view'),('finance','finance.member_balances.view'),('financeAccounts','finance.member_balances.view'),
    ('events','events.view'),('attendance','attendance.view'),('tasks','tasks.view_all'),('leadership','officers.view')
  ) permissions(key,perm) loop
    if public.has_chapter_permission(p_org,v_perm) then
      v_view:=v_view||jsonb_build_object(v_key,coalesce(p_data->v_key,'[]'::jsonb));
    end if;
  end loop;
  if public.has_chapter_permission(p_org,'attendance.view') and not v_view?'events' then
    v_view:=v_view||jsonb_build_object('events',coalesce(p_data->'events','[]'::jsonb));
  end if;
  if public.has_chapter_permission(p_org,'view_kpi_meetings') then
    foreach v_key in array array['kpiMeetings','kpiDefinitions','kpiPositionReports','kpiResults','kpiActionItems'] loop
      v_view:=v_view||jsonb_build_object(v_key,coalesce(p_data->v_key,'[]'::jsonb));
    end loop;
  end if;
  return v_view;
end;
$$;

create or replace function app_private.workspace_envelope(p_org uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_row public.workspace_state%rowtype;
begin
  select * into v_row from public.workspace_state where organization_id=p_org;
  return jsonb_build_object('organization_id',p_org,'updated_at',v_row.updated_at,
    'data',app_private.project_workspace(p_org,coalesce(v_row.data,'{}'::jsonb)),
    'writable_keys',to_jsonb(app_private.workspace_writable_keys(p_org)));
end;
$$;

create or replace function public.read_chapter_workspace(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  v_org:=app_private.require_workspace_org(p_organization_id);
  if not (public.has_chapter_permission(v_org,'members.list.view') or public.has_chapter_permission(v_org,'dashboard.executive.view')) then
    raise exception 'Use your Member Portal to access your own records.' using errcode='42501';
  end if;
  return app_private.workspace_envelope(v_org);
end;
$$;

create or replace function app_private.lock_workspace_version(p_org uuid,p_expected text)
returns jsonb language plpgsql set search_path = '' as $$
declare v_row public.workspace_state%rowtype;
begin
  select * into v_row from public.workspace_state where organization_id=p_org for update;
  if not found then raise exception 'Chapter workspace not found.' using errcode='P0002'; end if;
  if p_expected is null or v_row.updated_at is distinct from p_expected::timestamptz then
    raise exception 'Someone saved newer chapter data. Load the latest data before saving again.' using errcode='PT409';
  end if;
  return v_row.data;
end;
$$;

create or replace function app_private.merge_member_changes(p_org uuid,p_existing jsonb,p_incoming jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_row jsonb; v_old jsonb; v_next jsonb:='[]'::jsonb; v_keys text[]; v_key text;
begin
  -- Hidden fields are retained; dropping rows or changing assignments is not a roster edit.
  if exists(select 1 from jsonb_array_elements(p_existing) old where not exists(
    select 1 from jsonb_array_elements(p_incoming) new where new->>'id'=old->>'id')) then
    raise exception 'Archive members using the member removal action.' using errcode='42501';
  end if;
  v_keys:=array['id','firstName','lastName','preferredName','phone','email','schoolYear','graduationYear','major','hometown','memberStatus','initiationStatus','housingStatus','tags'];
  if public.has_chapter_permission(p_org,'officers.manage') then v_keys:=v_keys||array['officerRole','committee']; end if;
  if public.has_chapter_permission(p_org,'members.archive') then v_keys:=v_keys||array['lifecycle','archived','deletedAt','archivedAt']; end if;
  if public.has_chapter_permission(p_org,'all') then v_keys:=array_append(v_keys,'notes'); end if;
  for v_row in select value from jsonb_array_elements(p_incoming) loop
    select value into v_old from jsonb_array_elements(p_existing) where value->>'id'=v_row->>'id';
    if v_old is null and not public.has_chapter_permission(p_org,'members.create') then
      raise exception 'Member creation is restricted.' using errcode='42501';
    elsif v_old is not null and not public.has_chapter_permission(p_org,'members.update') then
      if v_row is distinct from app_private.project_workspace(p_org,jsonb_build_object('members',jsonb_build_array(v_old)))->'members'->0 then
        raise exception 'Member editing is restricted.' using errcode='42501';
      end if;
    end if;
    foreach v_key in array array['officerRole','committee','lifecycle','archived','deletedAt','archivedAt','notes'] loop
      if not v_key=any(v_keys) and v_row?v_key and (v_row->v_key) is distinct from (v_old->v_key) then
        raise exception 'Changing member field % is restricted.',v_key using errcode='42501';
      end if;
    end loop;
    v_next:=v_next||jsonb_build_array(coalesce(v_old,jsonb_build_object('archived',false,'lifecycle','Active'))||app_private.json_pick(v_row,v_keys));
  end loop;
  return v_next;
end;
$$;

create or replace function app_private.merge_own_kpi_changes(p_org uuid,p_key text,p_data jsonb,p_incoming jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_member text; v_row jsonb; v_old jsonb; v_report jsonb; v_allowed text[]; v_next jsonb:='[]'::jsonb; v_definition jsonb;
begin
  select member_id into v_member from public.organization_members where organization_id=p_org and user_id=auth.uid() and coalesce(status,'active')='active';
  if v_member is null then raise exception 'Your account must be linked to an officer member profile.' using errcode='42501'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_data->p_key,'[]'::jsonb)) old where not exists(
    select 1 from jsonb_array_elements(p_incoming) new where new->>'id'=old->>'id')) then
    raise exception 'Deleting KPI records requires reporting administration.' using errcode='42501';
  end if;
  for v_row in select value from jsonb_array_elements(p_incoming) loop
    select value into v_old from jsonb_array_elements(coalesce(p_data->p_key,'[]'::jsonb)) where value->>'id'=v_row->>'id';
    if v_row=v_old then v_next:=v_next||jsonb_build_array(v_row); continue; end if;
    if p_key='kpiPositionReports' then
      v_report:=v_old;
      v_allowed:=array['overallUpdate','mainAccomplishment','biggestBlocker','nextPriority','status','submittedAt','submittedBy','updatedAt'];
    else
      select value into v_report from jsonb_array_elements(coalesce(p_data->'kpiPositionReports','[]'::jsonb)) where value->>'id'=v_row->>'positionReportId';
      v_allowed:=case when p_key='kpiResults' then array['id','positionReportId','kpiDefinitionId','kpiNameSnapshot','targetValue','actualValue','previousValue','status','notes','createdAt','updatedAt']
        else array['id','kpiMeetingId','positionReportId','title','description','assignedMemberId','dueDate','status','completedAt','createdBy','createdAt','updatedAt'] end;
    end if;
    if v_report is null or not (coalesce(v_report->>'officerMemberId','')=v_member or coalesce(v_report->'officerMemberIds','[]'::jsonb)?v_member) then
      raise exception 'You can only change your assigned KPI reports.' using errcode='42501';
    end if;
    if v_report->>'status'='Submitted' then raise exception 'An administrator must reopen this report before editing.' using errcode='42501'; end if;
    if (v_row-v_allowed) is distinct from (coalesce(v_old,'{}'::jsonb)-v_allowed) then
      raise exception 'KPI assignment and ownership fields cannot be changed.' using errcode='42501';
    end if;
    if p_key='kpiPositionReports' and coalesce(v_row->>'status','Draft') not in ('Draft','Submitted') then raise exception 'Invalid report status.' using errcode='22023'; end if;
    if p_key='kpiResults' and v_old is not null and (v_old->>'positionReportId' is distinct from v_row->>'positionReportId' or v_old->>'kpiDefinitionId' is distinct from v_row->>'kpiDefinitionId') then
      raise exception 'KPI result ownership cannot be changed.' using errcode='42501';
    end if;
    if p_key='kpiActionItems' then
      if v_old is not null and v_old->>'positionReportId' is distinct from v_row->>'positionReportId' then raise exception 'Action ownership cannot be changed.' using errcode='42501'; end if;
      if coalesce(v_row->>'assignedMemberId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(p_data->'members','[]'::jsonb)) m where m->>'id'=v_row->>'assignedMemberId') then
        raise exception 'Action owner must belong to this chapter.' using errcode='42501';
      end if;
      v_row:=v_row||jsonb_build_object('createdBy',coalesce(v_old->>'createdBy',auth.uid()::text));
    elsif p_key='kpiResults' then
      select value into v_definition from jsonb_array_elements(coalesce(p_data->'kpiDefinitions','[]'::jsonb)) where value->>'id'=v_row->>'kpiDefinitionId';
      if v_definition is null or app_private.canonical_officer_position(v_definition->>'position') is distinct from app_private.canonical_officer_position(v_report->>'position') then
        raise exception 'KPI definition must belong to the assigned position.' using errcode='42501';
      end if;
      v_row:=v_row||jsonb_build_object('targetValue',v_definition->'targetValue','kpiNameSnapshot',v_definition->>'name');
    elsif v_row->>'status'='Submitted' then
      v_row:=v_row||jsonb_build_object('submittedBy',auth.uid()::text,'submittedAt',clock_timestamp());
    end if;
    v_row:=v_row||jsonb_build_object('updatedAt',clock_timestamp());
    v_next:=v_next||jsonb_build_array(v_row);
  end loop;
  return v_next;
end;
$$;

create or replace function public.save_chapter_workspace(p_organization_id uuid,p_expected_updated_at text,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_data jsonb; v_before jsonb; v_key text; v_value jsonb; v_allowed text[];
begin
  v_org:=app_private.require_workspace_org(p_organization_id);
  if coalesce(jsonb_typeof(p_changes),'null')<>'object' then raise exception 'Changes must be an object.' using errcode='22023'; end if;
  v_allowed:=app_private.workspace_writable_keys(v_org);
  v_data:=app_private.lock_workspace_version(v_org,p_expected_updated_at);
  v_before:=v_data;
  for v_key,v_value in select key,value from jsonb_each(p_changes) loop
    if not v_key=any(v_allowed) then raise exception 'You do not have permission to change module %.',v_key using errcode='42501'; end if;
    if v_key='settings' then
      if jsonb_typeof(v_value)<>'object' then raise exception 'Settings must be an object.' using errcode='22023'; end if;
    else
      if jsonb_typeof(v_value)<>'array' then raise exception 'Module % must be a list.',v_key using errcode='22023'; end if;
      if v_key<>'financeAccounts' and exists(select 1 from jsonb_array_elements(v_value) e where nullif(e->>'id','') is null) then
        raise exception 'Every record must have a permanent ID.' using errcode='22023';
      end if;
      if (select count(*) from jsonb_array_elements(v_value))<>(select count(distinct coalesce(e->>'id',e->>'memberId')) from jsonb_array_elements(v_value) e) then
        raise exception 'Duplicate record identifiers are not allowed.' using errcode='23505';
      end if;
    end if;
    if v_key='members' then v_value:=app_private.merge_member_changes(v_org,coalesce(v_data->'members','[]'::jsonb),v_value); end if;
    if v_key in ('kpiPositionReports','kpiResults','kpiActionItems') and not public.has_chapter_permission(v_org,'kpi.manage_all') then
      v_value:=app_private.merge_own_kpi_changes(v_org,v_key,v_before,v_value);
    end if;
    v_data:=jsonb_set(v_data,array[v_key],v_value,true);
  end loop;
  update public.workspace_state set data=v_data,updated_by=auth.uid(),updated_at=clock_timestamp() where organization_id=v_org;
  return app_private.workspace_envelope(v_org);
end;
$$;

-- Copy the existing well-tested import/archive/finance algorithms to a private
-- schema. Only the new wrappers expose them, after permission and version checks.
do $migration$
declare v_name text; v_sig text; v_perm text; v_def text;
begin
  for v_name,v_sig,v_perm in select * from (values
    ('import_members_to_workspace','jsonb','members.import'),
    ('archive_member_in_workspace','text','members.archive'),
    ('upsert_finance_accounts_to_workspace','jsonb,jsonb','finance.manage'),
    ('save_chapter_setup','jsonb,jsonb','settings.manage')
  ) f(name,sig,perm) loop
    select pg_get_functiondef(to_regprocedure('public.'||v_name||'('||v_sig||')')) into v_def;
    v_def:=replace(v_def,'FUNCTION public.'||v_name||'(','FUNCTION app_private.legacy_'||v_name||'(');
    v_def:=regexp_replace(v_def,'if not app_private\.is_approved_org_member\((.*?)\) then',format('if not public.has_chapter_permission(v_org_id, %L) then',v_perm),'s');
    execute v_def;
    execute format('revoke all on function app_private.legacy_%s(%s) from public, anon, authenticated',v_name,v_sig);
  end loop;
end;
$migration$;

create or replace function public.import_members_secure(p_members jsonb,p_expected_updated_at text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_result jsonb; v_row jsonb; v_fields text[]; v_clean jsonb:='[]'::jsonb;
begin
  v_org:=app_private.require_workspace_org();
  if not public.has_chapter_permission(v_org,'members.import') then raise exception 'Roster import is restricted.' using errcode='42501'; end if;
  perform app_private.lock_workspace_version(v_org,p_expected_updated_at);
  v_fields:=array['id','csvRowNumber','firstName','lastName','preferredName','phone','email','schoolYear','graduationYear',
    'major','hometown','memberStatus','initiationStatus','housingStatus','tags','rollNumber','nationalMemberNumber','badgeNumber','memberNumber'];
  if public.has_chapter_permission(v_org,'officers.manage') then v_fields:=v_fields||array['officerRole','committee']; end if;
  if public.has_chapter_permission(v_org,'all') then v_fields:=v_fields||array['notes','lifecycle']; end if;
  if coalesce(jsonb_typeof(p_members),'null')<>'array' then raise exception 'Import must be a list.' using errcode='22023'; end if;
  for v_row in select value from jsonb_array_elements(p_members) loop
    if not public.has_chapter_permission(v_org,'officers.manage') and (coalesce(v_row->>'officerRole','')<>'' or coalesce(v_row->>'committee','')<>'') then
      raise exception 'Officer assignments must be imported by an administrator.' using errcode='42501';
    end if;
    if not public.has_chapter_permission(v_org,'all') and coalesce(v_row->>'notes','')<>'' then raise exception 'Private member notes require an administrator.' using errcode='42501'; end if;
    v_clean:=v_clean||jsonb_build_array(app_private.json_pick(v_row,v_fields));
  end loop;
  v_result:=app_private.legacy_import_members_to_workspace(v_clean);
  return (v_result-'workspace_data')||jsonb_build_object('workspace_data',app_private.project_workspace(v_org,v_result->'workspace_data'));
end; $$;

create or replace function public.archive_member_secure(p_member_id text,p_expected_updated_at text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_result jsonb;
begin
  v_org:=app_private.require_workspace_org();
  if not public.has_chapter_permission(v_org,'members.archive') then raise exception 'Member removal is restricted.' using errcode='42501'; end if;
  perform app_private.lock_workspace_version(v_org,p_expected_updated_at);
  v_result:=app_private.legacy_archive_member_in_workspace(p_member_id);
  return (v_result-'workspace_data')||jsonb_build_object('workspace_data',app_private.project_workspace(v_org,v_result->'workspace_data'));
end; $$;

create or replace function public.save_finance_secure(p_accounts jsonb,p_transactions jsonb,p_expected_updated_at text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_result jsonb; v_data jsonb; v_tx jsonb; v_old jsonb; v_transactions jsonb:='[]'::jsonb;
begin
  v_org:=app_private.require_workspace_org();
  if not public.has_chapter_permission(v_org,'finance.manage') then raise exception 'Finance editing is restricted.' using errcode='42501'; end if;
  v_data:=app_private.lock_workspace_version(v_org,p_expected_updated_at);
  if coalesce(jsonb_typeof(p_transactions),'null')<>'array' then raise exception 'Transactions must be a list.' using errcode='22023'; end if;
  for v_tx in select value from jsonb_array_elements(p_transactions) loop
    if nullif(v_tx->>'id','') is null then raise exception 'Every transaction needs a permanent identifier.' using errcode='22023'; end if;
    if coalesce(v_tx->>'memberId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(v_data->'members','[]'::jsonb)) m where m->>'id'=v_tx->>'memberId') then
      raise exception 'Transaction member must belong to this chapter.' using errcode='42501';
    end if;
    select value into v_old from jsonb_array_elements(coalesce(v_data->'finance','[]'::jsonb)) where value->>'id'=v_tx->>'id';
    if v_old is not null then
      if app_private.json_pick(v_tx,array['id','memberId','type','amount']) is distinct from app_private.json_pick(v_old,array['id','memberId','type','amount']) then
        raise exception 'Transaction identifier already exists. Edit the existing transaction instead.' using errcode='22023';
      end if;
      continue;
    end if;
    if exists(select 1 from jsonb_array_elements(v_transactions) t where t->>'id'=v_tx->>'id') then raise exception 'Duplicate transaction identifiers.' using errcode='22023'; end if;
    v_transactions:=v_transactions||jsonb_build_array(v_tx);
  end loop;
  v_result:=app_private.legacy_upsert_finance_accounts_to_workspace(p_accounts,v_transactions);
  return (v_result-'workspace_data')||jsonb_build_object('workspace_data',app_private.project_workspace(v_org,v_result->'workspace_data'));
end; $$;

create or replace function public.save_setup_secure(p_setup jsonb,p_workspace jsonb,p_expected_updated_at text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_data jsonb;
begin
  v_org:=app_private.require_workspace_org();
  if not public.has_chapter_permission(v_org,'settings.manage') then raise exception 'Only a chapter administrator may configure this chapter.' using errcode='42501'; end if;
  v_data:=app_private.lock_workspace_version(v_org,p_expected_updated_at);
  if exists(select 1 from unnest(array['chapterName','schoolName','term','academicYear']) k where nullif(trim(p_setup->>k),'') is null) then
    raise exception 'Chapter, school, term and academic year are required.' using errcode='22023';
  end if;
  -- Settings changes never write profiles, login roles, or other modules.
  update public.organizations set name=trim(p_setup->>'chapterName'),updated_at=clock_timestamp() where id=v_org;
  update public.workspace_state set data=jsonb_set(v_data,'{settings}',p_setup||jsonb_build_object('setupComplete',true),true),updated_by=auth.uid()
    where organization_id=v_org;
  return jsonb_build_object('organization_id',v_org,'workspace_data',(app_private.workspace_envelope(v_org))->'data');
end; $$;

-- Close the old setup privilege-escalation path immediately, before the client
-- rollout. Stage 2 removes this legacy endpoint entirely.
create or replace function public.save_chapter_setup(p_setup jsonb,p_workspace jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_data jsonb;
begin
  v_org:=app_private.require_workspace_org();
  if not public.has_chapter_permission(v_org,'settings.manage') then raise exception 'Only a chapter administrator may configure this chapter.' using errcode='42501'; end if;
  select data into v_data from public.workspace_state where organization_id=v_org for update;
  return app_private.legacy_save_chapter_setup(p_setup,v_data);
end; $$;

-- Every writer (including existing member-self RPCs) gets a server timestamp.
create or replace function app_private.stamp_workspace_write()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at:=clock_timestamp();
  if tg_op='UPDATE' and new.updated_at<=old.updated_at then new.updated_at:=old.updated_at+interval '1 microsecond'; end if;
  if auth.uid() is not null then new.updated_by:=auth.uid(); end if;
  return new;
end; $$;
create trigger workspace_server_timestamp before insert or update on public.workspace_state
  for each row execute function app_private.stamp_workspace_write();

create or replace function app_private.audit_workspace_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_keys jsonb;
begin
  select coalesce(jsonb_agg(key),'[]'::jsonb) into v_keys from jsonb_object_keys(new.data) key
    where tg_op='INSERT' or new.data->key is distinct from old.data->key;
  insert into public.audit_logs(organization_id,actor_user_id,action,target_type,target_id,summary,success,source)
    values(new.organization_id,auth.uid(),'workspace.updated','workspace',new.organization_id::text,jsonb_build_object('modules',v_keys),true,'secure-workspace');
  return new;
end; $$;
create trigger workspace_write_audit after insert or update on public.workspace_state
  for each row execute function app_private.audit_workspace_write();

alter function public.normalize_organization_member_role_trigger() set search_path=public,pg_temp;

-- New endpoints are explicitly authenticated; internal helpers are not APIs.
revoke all on function public.read_chapter_workspace(uuid), public.save_chapter_workspace(uuid,text,jsonb),
  public.import_members_secure(jsonb,text),public.archive_member_secure(text,text),
  public.save_finance_secure(jsonb,jsonb,text),public.save_setup_secure(jsonb,jsonb,text) from public,anon;
grant execute on function public.read_chapter_workspace(uuid), public.save_chapter_workspace(uuid,text,jsonb),
  public.import_members_secure(jsonb,text),public.archive_member_secure(text,text),
  public.save_finance_secure(jsonb,jsonb,text),public.save_setup_secure(jsonb,jsonb,text) to authenticated;

revoke all on function app_private.json_pick(jsonb,text[]),app_private.require_workspace_org(uuid),
  app_private.workspace_writable_keys(uuid),app_private.project_workspace(uuid,jsonb),app_private.workspace_envelope(uuid),
  app_private.lock_workspace_version(uuid,text),app_private.merge_member_changes(uuid,jsonb,jsonb),
  app_private.merge_own_kpi_changes(uuid,text,jsonb,jsonb),app_private.stamp_workspace_write(),app_private.audit_workspace_write()
  from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
