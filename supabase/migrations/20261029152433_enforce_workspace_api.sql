-- Stage 2: apply only together with the secure-API frontend. Old tabs must reload.
begin;
alter table public.workspace_state enable row level security;
revoke all on public.workspace_state from anon,authenticated;
-- No browser role (including Admin) needs raw document access. Controlled
-- SECURITY DEFINER endpoints still operate using their owner privileges.
drop policy if exists "Authorized roles can read full workspace" on public.workspace_state;
drop policy if exists "Authorized roles can insert workspace" on public.workspace_state;
drop policy if exists "Authorized roles can update workspace" on public.workspace_state;

revoke all on function public.import_members_to_workspace(jsonb),
  public.archive_member_in_workspace(text),
  public.upsert_finance_accounts_to_workspace(jsonb,jsonb),public.save_chapter_setup(jsonb,jsonb),
  public.normalize_executive_team_kpi_workspace() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
