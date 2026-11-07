# Secure workspace API: review and rollout

Status: **deployed to production**. The user approved the concrete release. Migration 1 was applied October 29, 2026. On November 6, the matching frontend was deployed to Vercel and its public file checksums verified; migration 2 was then applied. Existing browser tabs must reload. No chapter records were reset, deleted, or seeded.

Production verification: authenticated Admin workspace/budget reads succeed; a versioned workspace save succeeded inside a rolled-back transaction. Raw browser table reads/updates and legacy setup/import endpoints are denied. Transaction-scoped role tests confirm Assistant Treasurer receives finance without KPI/recruitment and Recruitment receives PNMs without finance/accounts. Role changes and writes were rolled back. The workspace checksum remains `06bc1e67ab4dab2a7f949cdf097bf06f`. Signed-out desktop/mobile browser checks passed. Live authenticated browser imports, edits, logout/login and second-device persistence remain user acceptance tests; do not infer them from the SQL tests.

## Why this release is needed

The old browser interface can read a complete `workspace_state.data` document when the account has `workspace.full.read`. Hiding KPI or finance pages does not remove those records from the API response. Several old mutation functions also return the full document. The existing `save_chapter_setup` additionally promotes a caller with an existing chapter membership to Admin; its existing-membership path does not first require administrative permission.

This release replaces direct document reads and writes with server-authorized operations and closes the setup escalation path. It keeps the current chapter data and the import, archive, and finance algorithms rather than creating replacement member tables.

## Migrations, in order

1. `supabase/migrations/20261029151909_secure_workspace_api.sql`
   - Active, approved membership is required for permission decisions, including Admin policy checks.
   - `read_chapter_workspace` projects only permitted modules and member fields.
   - `save_chapter_workspace` locks the row, checks the loaded version, validates every changed module, and preserves omitted modules.
   - `import_members_secure`, `archive_member_secure`, `save_finance_secure`, and `save_setup_secure` check current versions and permissions. Legacy mutation implementations are copied to private functions with no browser execution grants.
   - Member fields, officer assignments, private notes, KPI assignment ownership, and transaction IDs are validated server-side.
   - KPI submission timestamps and actors come from the server. Submitting an assigned report and its results is atomic.
   - Settings edits never change account roles or replace unrelated modules. The old setup function is immediately guarded during the staged rollout.
   - A timestamp trigger advances every workspace writer's token. An audit trigger records changed module names and the authenticated actor without copying private values.
2. `supabase/migrations/20261029152433_enforce_workspace_api.sql`
   - Removes browser SELECT/INSERT/UPDATE access to the raw workspace table while retaining RLS.
   - Removes execution access to the old full-document import, archive, finance, setup, and normalization APIs.
   - Apply only after the matching frontend is deployed and its new API requests have been verified.

No chapter records are deleted, reset, or seeded. No new production data tables or frontend secrets are introduced. The helper implementations use fixed search paths; only explicitly authenticated entry points are granted browser execution access.

## Access behavior

| Account | Workspace API behavior |
| --- | --- |
| Admin | Complete chapter workspace through the authorized API; raw table access denied |
| Assistant Treasurer | Authorized finance and basic roster fields; no KPI or recruitment payloads |
| Recruitment | PNMs, permitted member lookup, authorized KPI reporting; no finance or private member contacts |
| Authorized executive | Permitted modules; own assigned KPI reports editable unless reporting administration is granted |
| Active Member | Operations workspace denied; existing self-only Member Portal endpoints remain in use |
| Pending, disabled, signed out, other chapter | Chapter operations denied |

The server reads roles from approved profiles and active `organization_members` links. Browser IDs, displayed role names, and editable auth metadata do not grant access.

## Tests completed

`node --test tests/*.test.mjs tests/database/*.test.mjs` passes 39 checks: 29 SQL checks executed in isolated PGlite/Postgres and 10 JavaScript regression checks. Database fixtures are local test records only. The SQL tests load the existing repository import/archive/finance/setup implementations before applying both migrations.

Coverage includes raw-table denial, anonymous and cross-chapter denial, Assistant Treasurer KPI denial, Recruitment finance denial, disabled memberships, disabled Admin policy checks, own-report-only editing, a missing scalar owner field, atomic report/result submission, stale writes, duplicate financial transaction IDs, cross-chapter transaction references, server-side audit identity, legacy endpoint denial, and settings preservation.

JavaScript syntax checks and the static production build pass. Desktop and phone smoke tests cover the signed-out gate, layout, modal focus, and conflict recovery. These are local tests, not production role or persistence verification.

Install the isolated database test dependency with `pnpm --dir tests/database install --frozen-lockfile --ignore-scripts`. Its exact version and lockfile are committed alongside the suite. Node 22+ is recommended.

## Deployment sequence after approval

1. Confirm the production Supabase project is `hjgyigdxlempsfqgjttt`, confirm a recoverable database backup, and capture workspace record count and a checksum without exporting private contents.
2. Apply migration 1. It is transactional. Verify the setup guard and new read API before proceeding.
3. Commit/push the matching frontend through the existing GitHub/Vercel integration. Verify that its workspace calls use the new APIs. There are no environment-variable changes.
4. Apply migration 2. Reload existing tabs. Old tabs will be denied raw document access and must use the new frontend.
5. Run direct authenticated production read/denial checks with approved chapter accounts. Write checks should run in rolled-back transactions, not add demonstration records.
6. Verify member/finance/settings saves, refresh persistence, KPI ownership, and import/archive behavior. Compare workspace counts and checksums where no user edits occurred.
7. Re-run Supabase advisors. Authenticated SECURITY DEFINER entry points remain intentional controlled APIs and must retain their internal authorization checks. Leaked-password protection is a separate existing Auth setting; it is not changed by these migrations.

## Rollback and limits

Each migration is atomic; a SQL failure before commit leaves its changes unapplied. Stop the rollout before migration 2 if the new frontend is not confirmed. After enforcement, retain the secure API while repairing a regression; reverting to a frontend that requires raw table access would break it. Do not automatically restore the old broad grants or old setup function.

The schema remains a shared JSON document. Global version checks can reject simultaneous edits to unrelated modules, so users may need to reload and reapply an edit. Module-specific relational tables remain a future improvement. Existing relational attendance and brotherhood-event functions use their own checked, record-level mutation paths; this release does not add stale-form versions to those separate event/attendance tables.
