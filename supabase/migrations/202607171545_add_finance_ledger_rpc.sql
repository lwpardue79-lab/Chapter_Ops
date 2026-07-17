-- Add ChapterOps finance ledger persistence to the existing workspace_state JSON model.
-- Current app data is stored in workspace_state.data, with members as the canonical roster.
-- This RPC upserts one current finance account per active member and optionally appends
-- historical finance transactions without creating duplicate member records.

create or replace function public.upsert_finance_accounts_to_workspace(
  p_accounts jsonb,
  p_transactions jsonb default '[]'::jsonb
)
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
  v_accounts jsonb;
  v_finance jsonb;
  v_account jsonb;
  v_transaction jsonb;
  v_member jsonb;
  v_existing jsonb;
  v_upserted jsonb;
  v_failed jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_valid integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_failed_count integer := 0;
  v_idx integer;
  v_member_index integer;
  v_account_index integer;
  v_member_id text;
  v_pending_cents integer;
  v_current_cents integer;
  v_plan text;
  v_now text := now()::text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to save finance data.'
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
    array['Admin', 'President', 'Treasurer', 'Assistant Treasurer']
  ) then
    raise exception 'Your account does not have permission to manage finance data.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_accounts, '[]'::jsonb)) <> 'array' then
    raise exception 'Finance account payload must be a JSON array.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_transactions, '[]'::jsonb)) <> 'array' then
    raise exception 'Finance transaction payload must be a JSON array.'
      using errcode = '22023';
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
  v_accounts := coalesce(v_workspace->'financeAccounts', '[]'::jsonb);
  v_finance := coalesce(v_workspace->'finance', '[]'::jsonb);

  for v_account in
    select value
    from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb))
  loop
    v_total := v_total + 1;
    v_member_id := nullif(trim(coalesce(v_account->>'memberId', v_account->>'member_id', '')), '');
    v_member_index := null;
    v_account_index := null;
    v_existing := null;

    if v_member_id is null then
      v_failed_count := v_failed_count + 1;
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_total,
        'reason', 'Member ID is required for finance ledger rows.'
      ));
      continue;
    end if;

    for v_idx in 0..greatest(jsonb_array_length(v_members) - 1, -1) loop
      v_member := v_members->v_idx;
      if v_member->>'id' = v_member_id then
        v_member_index := v_idx;
        exit;
      end if;
    end loop;

    if v_member_index is null then
      v_failed_count := v_failed_count + 1;
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_total,
        'memberId', v_member_id,
        'reason', 'Member record was not found.'
      ));
      continue;
    end if;

    v_member := v_members->v_member_index;
    if lower(coalesce(v_member->>'archived', 'false')) = 'true'
      or lower(coalesce(v_member->>'lifecycle', '')) = 'archived'
      or v_member ? 'deletedAt'
    then
      v_failed_count := v_failed_count + 1;
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_total,
        'memberId', v_member_id,
        'reason', 'Archived members are excluded from the active finance ledger.'
      ));
      continue;
    end if;

    v_pending_cents := coalesce(nullif(v_account->>'pendingChargeCents', '')::integer, 0);
    v_current_cents := coalesce(nullif(v_account->>'currentBalanceCents', '')::integer, 0);
    v_plan := coalesce(nullif(trim(coalesce(v_account->>'paymentPlanStatus', '')), ''), 'None');
    v_valid := v_valid + 1;

    for v_idx in 0..greatest(jsonb_array_length(v_accounts) - 1, -1) loop
      v_existing := v_accounts->v_idx;
      if v_existing->>'memberId' = v_member_id then
        v_account_index := v_idx;
        exit;
      end if;
    end loop;

    v_upserted := jsonb_build_object(
      'memberId', v_member_id,
      'pendingChargeCents', v_pending_cents,
      'currentBalanceCents', v_current_cents,
      'paymentPlanStatus', v_plan,
      'paymentPlanAmountCents', coalesce(nullif(v_account->>'paymentPlanAmountCents', '')::integer, 0),
      'paymentPlanFrequency', coalesce(v_account->>'paymentPlanFrequency', ''),
      'paymentPlanStartDate', coalesce(v_account->>'paymentPlanStartDate', ''),
      'paymentPlanEndDate', coalesce(v_account->>'paymentPlanEndDate', ''),
      'dueDate', coalesce(v_account->>'dueDate', ''),
      'notes', coalesce(v_account->>'notes', ''),
      'financialStatus', coalesce(v_account->>'financialStatus', ''),
      'updatedAt', v_now,
      'updatedBy', v_user_id::text
    );

    if v_account_index is null then
      v_accounts := v_accounts || jsonb_build_array(v_upserted);
      v_inserted := v_inserted + 1;
    else
      if (v_accounts->v_account_index) = v_upserted then
        v_skipped := v_skipped + 1;
      else
        v_accounts := jsonb_set(v_accounts, array[v_account_index::text], v_upserted, false);
        v_updated := v_updated + 1;
      end if;
    end if;
  end loop;

  for v_transaction in
    select value
    from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb))
  loop
    v_finance := jsonb_build_array(v_transaction || jsonb_build_object(
      'id', coalesce(nullif(v_transaction->>'id', ''), 'f_' || replace(gen_random_uuid()::text, '-', '')),
      'createdAt', v_now,
      'createdBy', v_user_id::text,
      'archived', false
    )) || v_finance;
  end loop;

  v_workspace := jsonb_set(v_workspace, '{financeAccounts}', v_accounts, true);
  v_workspace := jsonb_set(v_workspace, '{finance}', v_finance, true);

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

revoke all on function public.upsert_finance_accounts_to_workspace(jsonb, jsonb) from public;
revoke all on function public.upsert_finance_accounts_to_workspace(jsonb, jsonb) from anon;
grant execute on function public.upsert_finance_accounts_to_workspace(jsonb, jsonb) to authenticated;
