-- Separate annual operating budgets from member receivables. No chapter data is seeded.
begin;
insert into public.app_role_permissions(role,permission_key)
select r,p from unnest(array['admin','president','treasurer','assistant_treasurer','advisor']) r
cross join unnest(array['budget.view','budget.report']) p on conflict do nothing;
insert into public.app_role_permissions(role,permission_key)
select r,'budget.manage' from unnest(array['admin','treasurer','assistant_treasurer']) r on conflict do nothing;

create table public.annual_budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check(length(btrim(name)) between 1 and 120),
  starts_on date not null check(extract(day from starts_on)=1),
  status text not null default 'Draft' check(status in ('Draft','Active','Closed','Archived')),
  revision integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(organization_id,id), unique(organization_id,starts_on,name)
);
create table public.annual_budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  budget_id uuid not null,
  title text not null check(length(btrim(title)) between 1 and 160),
  category text not null default 'Operations' check(length(category)<=120),
  owner_position text not null default '' check(length(owner_position)<=120),
  kind text not null check(kind in ('income','expense')),
  monthly_plan_cents bigint[] not null check(array_length(monthly_plan_cents,1)=12 and array_position(monthly_plan_cents,null) is null and 0<=all(monthly_plan_cents) and 100000000000>=all(monthly_plan_cents)),
  archived boolean not null default false,
  source_key text check(length(source_key)<=250),
  updated_at timestamptz not null default clock_timestamp(),
  unique(organization_id,budget_id,id), unique(budget_id,source_key),
  foreign key(organization_id,budget_id) references public.annual_budgets(organization_id,id)
);
create table public.annual_budget_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  budget_id uuid not null,
  line_id uuid not null,
  transaction_date date not null,
  amount_cents bigint not null check(abs(amount_cents)<=100000000000),
  description text not null check(length(btrim(description)) between 1 and 500),
  vendor text not null default '' check(length(vendor)<=160),
  private_notes text not null default '' check(length(private_notes)<=4000),
  source_key text check(length(source_key)<=250),
  voided_at timestamptz,
  void_reason text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(budget_id,source_key),
  foreign key(organization_id,budget_id,line_id) references public.annual_budget_lines(organization_id,budget_id,id)
);
create index annual_budget_entries_period on public.annual_budget_entries(organization_id,budget_id,transaction_date) where voided_at is null;
create index annual_budget_lines_org on public.annual_budget_lines(organization_id,budget_id);
create table public.annual_budget_changes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  budget_id uuid not null references public.annual_budgets(id), actor_id uuid not null references auth.users(id),
  action text not null, previous_value jsonb, new_value jsonb, created_at timestamptz not null default clock_timestamp()
);
create index annual_budget_changes_org on public.annual_budget_changes(organization_id,budget_id,created_at desc);
create table app_private.budget_requests (
  request_id uuid primary key, organization_id uuid not null, actor_id uuid not null,
  budget_id uuid not null references public.annual_budgets(id), fingerprint text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table app_private.budget_requests enable row level security;
revoke all on app_private.budget_requests from public,anon,authenticated;

alter table public.annual_budgets enable row level security;
alter table public.annual_budget_lines enable row level security;
alter table public.annual_budget_entries enable row level security;
alter table public.annual_budget_changes enable row level security;
revoke all on public.annual_budgets,public.annual_budget_lines,public.annual_budget_entries,public.annual_budget_changes from public,anon,authenticated;
grant select on public.annual_budgets,public.annual_budget_lines,public.annual_budget_entries,public.annual_budget_changes to authenticated;
create policy budget_private_read on public.annual_budgets for select to authenticated using(public.has_chapter_permission(organization_id,'budget.manage'));
create policy budget_lines_private_read on public.annual_budget_lines for select to authenticated using(public.has_chapter_permission(organization_id,'budget.manage'));
create policy budget_entries_private_read on public.annual_budget_entries for select to authenticated using(public.has_chapter_permission(organization_id,'budget.manage'));
create policy budget_changes_private_read on public.annual_budget_changes for select to authenticated using(public.has_chapter_permission(organization_id,'budget.manage'));
-- No direct client writes. Versioned RPC validates fields, locks the budget, and audits atomically.

create function public.read_annual_budget(p_organization_id uuid,p_budget_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_budget public.annual_budgets%rowtype; v_lines jsonb; v_entries jsonb:='[]'; v_months jsonb;
begin
  v_org:=app_private.require_workspace_org(p_organization_id);
  if not public.has_chapter_permission(v_org,'budget.view') then raise exception 'Budget access is restricted.' using errcode='42501'; end if;
  if p_budget_id is not null then
    select * into v_budget from public.annual_budgets where id=p_budget_id and organization_id=v_org;
    if not found then raise exception 'Budget not found in your chapter.' using errcode='42501'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'category',l.category,'owner_position',l.owner_position,'kind',l.kind,
      'monthly_plan_cents',l.monthly_plan_cents,'archived',l.archived,'source_key',l.source_key,'actual_cents',(
        select jsonb_agg(coalesce((select sum(e.amount_cents) from public.annual_budget_entries e where e.line_id=l.id and e.budget_id=v_budget.id and e.organization_id=v_org and e.voided_at is null
          and e.transaction_date>=v_budget.starts_on+(m||' months')::interval and e.transaction_date<v_budget.starts_on+((m+1)||' months')::interval),0) order by m)
        from generate_series(0,11) m
      )) order by l.kind,l.category,l.title),'[]') into v_lines from public.annual_budget_lines l where budget_id=v_budget.id and organization_id=v_org;
    if public.has_chapter_permission(v_org,'budget.manage') then
      select coalesce(jsonb_agg(to_jsonb(e) order by e.transaction_date desc,e.created_at desc),'[]') into v_entries from public.annual_budget_entries e where e.budget_id=v_budget.id and e.organization_id=v_org;
    end if;
  end if;
  return jsonb_build_object('budgets',coalesce((select jsonb_agg(to_jsonb(b) order by b.starts_on desc,b.name) from public.annual_budgets b where organization_id=v_org),'[]'),
    'budget',case when v_budget.id is null then null else to_jsonb(v_budget) end,'lines',coalesce(v_lines,'[]'),'entries',v_entries,
    'can_manage',public.has_chapter_permission(v_org,'budget.manage'));
end;
$$;

create function public.save_annual_budget(p_organization_id uuid,p_budget_id uuid,p_expected_revision integer,p_request_id uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_budget public.annual_budgets%rowtype; v_prior jsonb; v_next jsonb; v_id uuid;
  v_plan bigint[]; v_line jsonb; v_entry jsonb; v_line_id uuid; v_month integer; v_request app_private.budget_requests%rowtype; v_fingerprint text;
begin
  v_org:=app_private.require_workspace_org(p_organization_id);
  if not public.has_chapter_permission(v_org,'budget.manage') then raise exception 'Only authorized finance officers can change budgets.' using errcode='42501'; end if;
  if p_request_id is null or p_budget_id is null then raise exception 'Request and budget identifiers are required.'; end if;
  if octet_length(p_data::text)>1000000 then raise exception 'Budget upload is too large.'; end if;
  v_fingerprint:=md5(jsonb_build_array(p_budget_id,p_action,p_data)::text);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_request from app_private.budget_requests where request_id=p_request_id;
  if found then
    if v_request.organization_id<>v_org or v_request.actor_id<>auth.uid() or v_request.fingerprint<>v_fingerprint then raise exception 'Request identifier already used.' using errcode='23505'; end if;
    return public.read_annual_budget(v_org,v_request.budget_id);
  end if;
  if p_action='create' then
    insert into public.annual_budgets(id,organization_id,name,starts_on,created_by,updated_by)
      values(p_budget_id,v_org,btrim(p_data->>'name'),(p_data->>'starts_on')::date,auth.uid(),auth.uid()) returning * into v_budget;
    v_next:=to_jsonb(v_budget);
  else
    select * into v_budget from public.annual_budgets where id=p_budget_id and organization_id=v_org for update;
    if not found then raise exception 'Budget not found in your chapter.' using errcode='42501'; end if;
    if p_expected_revision is null or v_budget.revision<>p_expected_revision then raise exception 'This budget changed. Refresh it before saving again.' using errcode='PT409'; end if;
    if v_budget.status in ('Closed','Archived') and p_action<>'header' then raise exception 'Reopen this budget before editing.' using errcode='42501'; end if;
    if p_action='header' then
      v_prior:=to_jsonb(v_budget);
      update public.annual_budgets set name=btrim(p_data->>'name'),status=p_data->>'status' where id=v_budget.id returning to_jsonb(annual_budgets.*) into v_next;
    elsif p_action='line' then
      v_id:=(p_data->>'id')::uuid;
      select to_jsonb(l) into v_prior from public.annual_budget_lines l where l.id=v_id and l.budget_id=v_budget.id and l.organization_id=v_org;
      if exists(select 1 from public.annual_budget_lines where id=v_id and budget_id<>v_budget.id) then raise exception 'Invalid budget line.' using errcode='42501'; end if;
      select array_agg(value::bigint order by ordinality) into v_plan from jsonb_array_elements_text(p_data->'monthly_plan_cents') with ordinality;
      if jsonb_typeof(p_data->'monthly_plan_cents')<>'array' or cardinality(v_plan)<>12 then raise exception 'Enter all twelve monthly allocations.'; end if;
      insert into public.annual_budget_lines(id,organization_id,budget_id,title,category,owner_position,kind,monthly_plan_cents,archived)
        values(v_id,v_org,v_budget.id,btrim(p_data->>'title'),coalesce(nullif(btrim(p_data->>'category'),''),'Operations'),coalesce(p_data->>'owner_position',''),p_data->>'kind',v_plan,coalesce((p_data->>'archived')::boolean,false))
      on conflict(id) do update set title=excluded.title,category=excluded.category,owner_position=excluded.owner_position,kind=excluded.kind,
        monthly_plan_cents=excluded.monthly_plan_cents,archived=excluded.archived,updated_at=clock_timestamp() returning to_jsonb(annual_budget_lines.*) into v_next;
      if v_prior is not null and v_prior->>'kind'<>p_data->>'kind' and exists(select 1 from public.annual_budget_entries where line_id=v_id) then raise exception 'A line with history cannot change between income and expense.'; end if;
    elsif p_action='entry' then
      v_id:=(p_data->>'id')::uuid; v_line_id:=(p_data->>'line_id')::uuid;
      if not exists(select 1 from public.annual_budget_lines where id=v_line_id and organization_id=v_org and budget_id=v_budget.id and not archived) then raise exception 'Choose an active line in this budget.' using errcode='42501'; end if;
      if (p_data->>'transaction_date')::date<v_budget.starts_on or (p_data->>'transaction_date')::date>=v_budget.starts_on+interval '1 year' then raise exception 'Transaction date must be inside the budget year.'; end if;
      select to_jsonb(e) into v_prior from public.annual_budget_entries e where id=v_id and organization_id=v_org and budget_id=v_budget.id;
      if exists(select 1 from public.annual_budget_entries where id=v_id and budget_id<>v_budget.id) then raise exception 'Invalid transaction.' using errcode='42501'; end if;
      if v_prior is not null and (nullif(v_prior->>'voided_at','') is not null or length(btrim(coalesce(p_data->>'reason','')))<3) then raise exception 'A correction reason is required; voided entries cannot be edited.'; end if;
      insert into public.annual_budget_entries(id,organization_id,budget_id,line_id,transaction_date,amount_cents,description,vendor,private_notes,created_by,updated_by)
        values(v_id,v_org,v_budget.id,v_line_id,(p_data->>'transaction_date')::date,(p_data->>'amount_cents')::bigint,btrim(p_data->>'description'),coalesce(p_data->>'vendor',''),coalesce(p_data->>'private_notes',''),auth.uid(),auth.uid())
      on conflict(id) do update set line_id=excluded.line_id,transaction_date=excluded.transaction_date,amount_cents=excluded.amount_cents,description=excluded.description,vendor=excluded.vendor,private_notes=excluded.private_notes,updated_by=auth.uid(),updated_at=clock_timestamp()
      returning to_jsonb(annual_budget_entries.*) into v_next;
    elsif p_action='void' then
      if length(btrim(coalesce(p_data->>'reason','')))<3 then raise exception 'A reason is required to void a transaction.'; end if;
      select to_jsonb(e) into v_prior from public.annual_budget_entries e where id=(p_data->>'id')::uuid and organization_id=v_org and budget_id=v_budget.id and voided_at is null;
      if v_prior is null then raise exception 'Transaction not found or already voided.'; end if;
      update public.annual_budget_entries set voided_at=clock_timestamp(),void_reason=p_data->>'reason',updated_by=auth.uid(),updated_at=clock_timestamp()
      where id=(p_data->>'id')::uuid returning to_jsonb(annual_budget_entries.*) into v_next;
    elsif p_action='import' then
      if jsonb_typeof(p_data->'lines')<>'array' or jsonb_array_length(p_data->'lines') not between 1 and 200 then raise exception 'Import needs 1–200 lines.'; end if;
      v_prior:=jsonb_build_object('line_count',(select count(*) from public.annual_budget_lines where budget_id=v_budget.id));
      for v_line in select value from jsonb_array_elements(p_data->'lines') loop
        if nullif(v_line->>'source_key','') is null then raise exception 'Import source key is required.'; end if;
        if v_line?'actual_cents' and (jsonb_typeof(v_line->'actual_cents')<>'array' or jsonb_array_length(v_line->'actual_cents')<>12) then raise exception 'Invalid actuals array.'; end if;
        select array_agg(value::bigint order by ordinality) into v_plan from jsonb_array_elements_text(v_line->'monthly_plan_cents') with ordinality;
        if cardinality(v_plan)<>12 then raise exception 'Invalid monthly allocation.'; end if;
        insert into public.annual_budget_lines(organization_id,budget_id,title,category,owner_position,kind,monthly_plan_cents,source_key)
          values(v_org,v_budget.id,btrim(v_line->>'title'),coalesce(v_line->>'category','Operations'),coalesce(v_line->>'owner_position',''),v_line->>'kind',v_plan,v_line->>'source_key')
          on conflict(budget_id,source_key) do nothing returning id into v_line_id;
        if v_line_id is null then
          -- Re-import never overwrites officer edits or silently doubles opening actuals.
          select id into v_line_id from public.annual_budget_lines where budget_id=v_budget.id and source_key=v_line->>'source_key';
          continue;
        end if;
        for v_month in 0..11 loop
          if jsonb_typeof(v_line->'actual_cents'->v_month)='number' then
            insert into public.annual_budget_entries(organization_id,budget_id,line_id,transaction_date,amount_cents,description,source_key,created_by,updated_by)
              values(v_org,v_budget.id,v_line_id,(v_budget.starts_on+(v_month||' months')::interval)::date,(v_line->'actual_cents'->>v_month)::bigint,
                'Imported monthly actual — '||btrim(v_line->>'title'),(v_line->>'source_key')||':actual:'||v_month,auth.uid(),auth.uid());
          end if;
        end loop;
      end loop;
      v_next:=jsonb_build_object('line_count',(select count(*) from public.annual_budget_lines where budget_id=v_budget.id));
    else raise exception 'Unknown budget action.';
    end if;
    update public.annual_budgets set revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=v_budget.id;
  end if;
  insert into public.annual_budget_changes(organization_id,budget_id,actor_id,action,previous_value,new_value)
    values(v_org,v_budget.id,auth.uid(),p_action,v_prior,jsonb_build_object('record',v_next,'reason',p_data->>'reason'));
  insert into public.audit_logs(organization_id,actor_user_id,action,target_type,target_id,summary,success,source)
    values(v_org,auth.uid(),'Budget '||p_action,'annual_budget',v_budget.id::text,jsonb_build_object('budget_id',v_budget.id),true,'annual_budget_api');
  insert into app_private.budget_requests(request_id,organization_id,actor_id,budget_id,fingerprint) values(p_request_id,v_org,auth.uid(),v_budget.id,v_fingerprint);
  return public.read_annual_budget(v_org,v_budget.id);
end;
$$;
revoke all on function public.read_annual_budget(uuid,uuid),public.save_annual_budget(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.read_annual_budget(uuid,uuid),public.save_annual_budget(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
