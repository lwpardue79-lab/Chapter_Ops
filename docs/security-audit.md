# AO Command RBAC and Supabase RLS Audit

Date: 2026-07-17  
App: AO Command production deployment

## Summary

AO Command currently stores chapter operational records in `public.workspace_state.data` as one JSON workspace document. That design is simple and has worked for rapid deployment, but it means row-level security cannot expose only one member's dues, attendance, or profile fields from that same row. If a user can read `workspace_state`, they can receive the whole chapter workspace.

The security fix in this pass hardens access around that reality:

- Active Members do not receive the full `workspace_state` row.
- Executive, finance, reporting, and admin roles receive only modules allowed by the centralized capability map.
- The frontend clears cached workspace data when accounts change.
- Supabase RLS now gates the full workspace row through trusted `profiles` and `organization_members` records.
- A database permission helper, `public.has_chapter_permission(chapter_id, permission)`, is now the central RLS authorization check.

## Current access-control problems found

1. Frontend authorization used `state.settings.currentRole`, which is client-controlled workspace data.
2. Navigation items were always rendered in static HTML, regardless of resolved role.
3. Approved Active Members could reach executive-oriented UI if the frontend role state allowed it.
4. The full workspace was loaded for approved users before checking whether that role should receive executive data.
5. Browser-local cached workspace data could survive account switching inside the same browser profile.
6. Logout used Supabase's default sign-out behavior, which can revoke sessions globally instead of only the current browser session.
7. RLS was enabled in prior migrations, but the repo did not contain a complete policy set for all core exposed tables.
8. The app has RPC functions that mutate `workspace_state`; they are `SECURITY DEFINER` and need explicit grants plus internal permission checks.
9. The current JSON workspace model cannot safely provide field-level member portal data without a normalized-table or secure-RPC follow-up.

## Role model

The app now uses capability-based permissions resolved from trusted role records.

Roles:

- Admin
- President
- Treasurer
- Assistant Treasurer
- Secretary
- VPMD
- Recruitment
- Exec Board
- Committee Chair
- Active Member
- Read-only Advisor

VPMD and Brotherhood are treated as one canonical role area. Recruitment remains separate.

## Capability examples

- `workspace.full.read`
- `dashboard.executive.view`
- `members.list.view`
- `members.private_contact.view`
- `members.create`
- `members.update`
- `members.archive`
- `members.import`
- `members.export`
- `officers.view`
- `officers.manage`
- `recruitment.view`
- `recruitment.manage`
- `attendance.view`
- `attendance.manage`
- `finance.summary.view`
- `finance.member_balances.view`
- `finance.manage`
- `finance.import`
- `finance.export`
- `reports.executive.view`
- `reports.finance.view`
- `reports.export`
- `kpi.view`
- `kpi.submit_own`
- `kpi.manage_all`
- `tasks.view_own`
- `tasks.view_all`
- `tasks.manage`
- `settings.view`
- `settings.manage`
- `chapter.setup`
- `backup.create`
- `backup.restore`
- `workspace.clear`

## Navigation by role

Active Member:

- Member Portal only in this version.
- The full workspace is not loaded.
- Command Center, Member Directory, Leadership, Recruitment Pipeline, Events & Attendance admin, Financial Operations, KPI Reports, Action Center admin, Reports & Analytics, Administration, imports, exports, backups, and workspace clearing are hidden and guarded.

Treasurer / Assistant Treasurer:

- Command Center
- Member Directory
- Executive Team
- Attendance
- Finance
- KPI Reports
- Tasks
- Reports, finance-oriented exports

President:

- Command Center
- Member Directory
- Executive Team
- Recruitment
- Attendance
- Finance summaries
- KPI Reports
- Tasks
- Reports
- Backup creation

VPMD:

- Command Center
- Member Directory
- Executive Team
- Attendance
- KPI Reports
- Tasks
- Reports
- No automatic Recruitment or Finance management access.

Recruitment:

- Command Center
- Member Directory
- Executive Team
- Recruitment
- Attendance
- KPI Reports
- Tasks
- Reports
- No automatic VPMD/Brotherhood or Finance management access.

Admin:

- Full chapter-management access.

## RLS changes

Migration:

- `supabase/migrations/202607171900_harden_rbac_rls.sql`
- `supabase/migrations/202607171910_fix_normalize_db_role_search_path.sql`

Tables with RLS enabled or confirmed:

- `public.organizations`
- `public.organization_members`
- `public.profiles`
- `public.workspace_state`
- `public.app_role_permissions`
- `public.audit_logs`

Policies replaced or created:

- `organizations`
  - Approved members can read their organization.
  - Admins can insert organizations.
  - Admins can update their organization.
- `organization_members`
  - Users can read their own membership.
  - Admins can insert memberships.
  - Admins can update memberships.
- `profiles`
  - Users can read own profile and admins can read profiles.
  - Users can request their own profile.
  - Users can update own non-admin profile and admins can update profiles.
- `workspace_state`
  - Authorized roles can read full workspace.
  - Authorized roles can insert workspace.
  - Authorized roles can update workspace.
- `app_role_permissions`
  - Admins can manage app role permissions.
- `audit_logs`
  - Authorized roles can read audit logs.
  - Authorized roles can insert audit logs.

## RPC functions audited

Current public RPCs:

- `public.save_chapter_setup(jsonb, jsonb)`
- `public.import_members_to_workspace(jsonb)`
- `public.archive_member_in_workspace(text)`
- `public.upsert_finance_accounts_to_workspace(jsonb, jsonb)`
- `public.normalize_executive_team_kpi_workspace()`
- `public.has_chapter_permission(uuid, text)`
- `public.current_user_is_admin()`
- `public.log_audit_event(uuid, text, text, text, jsonb, boolean, text)`

The existing workspace mutation RPCs already include authenticated-user and role checks. The new migration keeps execution restricted to authenticated users and adds centralized permission helpers for RLS. The next security improvement should refactor older RPCs to call `has_chapter_permission` directly instead of maintaining role arrays inside each function.

## Views

No application views were found in the local migrations. If views are added later in `public`, create them with `security_invoker = true` on Postgres 15+ or revoke `anon`/`authenticated` access and expose data through secure RPCs.

## Storage

No Supabase Storage bucket configuration is present in this repo. The app currently exports files in the browser rather than storing backups or reports in Supabase Storage. If Storage is added later:

- Buckets containing backups, reports, finance exports, or attachments must be private.
- Object paths should include `chapter_id`.
- Access should use signed URLs.
- Upload, read, and delete policies must check `has_chapter_permission`.

## Account switching and cache protection

The frontend now:

- Clears workspace data, import previews, filters, and history when the signed-in user changes.
- Does not load `workspace_state` for Active Member roles.
- Uses local sign-out: `supabase.auth.signOut({ scope: "local" })`.
- Hides global sync/import/export/backup/clear controls unless the resolved role has the matching capability.

## Remaining risks

1. Field-level member portal access is intentionally not enabled yet because the current source of truth is one JSON workspace row.
2. To let Active Members view only their own profile, own balance, own attendance, or own tasks, move those records to normalized tables or expose carefully scoped RPC functions.
3. Existing RPC functions should be refactored in a later migration to call `has_chapter_permission` so database and frontend capability names stay perfectly aligned.
4. Supabase security advisors still warn that several authenticated `SECURITY DEFINER` RPCs are executable. This is intentional for the current static frontend because those RPCs are the controlled write API and include internal user/chapter/role checks, but they should be moved to a private schema or replaced with normalized-table RLS in a future hardening pass.
5. Direct API tests as real Active Member, Treasurer, VPMD, Recruitment, President, Admin, archived, and another-chapter accounts still require test credentials for those users.

## Manual Supabase actions required

These migrations were applied to the production Supabase project during the 2026-07-17 hardening pass:

```text
supabase/migrations/202607171900_harden_rbac_rls.sql
supabase/migrations/202607171910_fix_normalize_db_role_search_path.sql
```

After role-specific test accounts are available, test with:

- Admin account
- Active Member account
- Treasurer account
- VPMD account
- Recruitment account

Direct Supabase calls should confirm Active Members cannot select from `workspace_state`.

## Safe multi-account testing

Use separate browser storage contexts:

- Admin account in Chrome Profile A.
- Active Member test account in Chrome Profile B.

Alternatives:

- Admin in a normal browser window and test account in an Incognito/Private window.
- Admin in Chrome and test account in Safari/Firefox.

Do not test two accounts in two tabs of the same browser profile, because the Supabase browser client stores the active session in browser storage for that site.
