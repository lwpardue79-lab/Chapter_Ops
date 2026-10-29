# AO Command modernization — October 2026

## Delivered

- Supabase browser SDK pinned to 2.118.0 with a verified SHA-384 integrity hash. The production browser bundle remains compatible with the existing script-based frontend.
- Authentication database loading runs outside the synchronous auth-state callback. Token refresh no longer clears the current profile and reloads every module.
- Startup requires authentication initialization before displaying operational pages. Missing client configuration or an unavailable SDK shows a connection error.
- Workspace saves are serialized within each browser. Every request captures its submitted version and checks the current signed-in user before writing.
- Workspace writes request a returned organization ID to confirm database success. Errors now return failure to callers.
- Member/PNM/event/task record forms and leadership forms wait for confirmed saves. Failed writes restore the previous state and keep form inputs available.
- Generic CSV import failures roll back imported state so retrying does not duplicate unsaved rows.
- Record archive/delete operations report success after confirmation. Undo saves the restored state back to Supabase.
- Visible connection/save status, offline handling, screen-reader status updates, keyboard modal focus containment/restoration, Escape dismissal, skip navigation, and reduced-motion support.
- Home-screen manifest and AO icon. There is no service worker caching private chapter information or pretending offline writes are saved.
- Both Vercel configurations deny framing.

## Verification

Run `npm run check`, `npm test`, and `npm run build` using Node 22 or newer.

The tests exercise queue ordering and recovery after errors, duplicate submit prevention, record-write rollback, success ordering, authentication checks, and synchronous auth callbacks. They do not use production accounts or insert production records.

An isolated Chrome smoke test passed at 1440px and 390px: signed-out navigation is empty, the page has no horizontal overflow, the sign-in modal contains keyboard focus, Escape dismisses it, and the underlying page becomes interactive again. This test used the pinned SDK with production API requests blocked. Real-account login was not exercised. The phone check exposed a pre-existing header margin overflow, which was corrected.

## Remaining database work

Chapter operations still use `workspace_state.data`, a shared JSON document. Workspace saves now use an atomic conditional update matching the `updated_at` value that was loaded. The first save advances that token; a second stale save updates zero rows and is rejected. Initial saves use insert rather than upsert, preventing a competing initialization from replacing an existing workspace. Account changes and fresh workspace loads invalidate queued snapshots.

Conflict recovery offers **Load latest data** in the status area and inside any open form. The user confirms before discarding unsaved entries. The app keeps the original form available when a save fails. Tests simulate two independent editors, repeated saves, competing initialization, and permission failures; no production data was edited to run them. A read-only production schema query confirmed `updated_at` is a non-null timestamp with time zone.

This check protects the updated client workspace-sync path. Older deployed clients and existing dedicated RPCs do not automatically inherit it. Database enforcement across every writer still needs a version-aware RPC/trigger and module-specific tables or restricted RPCs. In particular, a read check followed by an unconditional write would not provide the same protection; this implementation places the version predicate on the update itself.

Existing `workspace.full.read` grants expose the entire JSON document to those roles at the Data API level. Client-side KPI redaction is not database privacy. Assistant Treasurer KPI isolation and module-specific finance privacy require a restricted server read/write interface or normalized tables before they can be called fully enforced.

The new helpers preserve the current role map and production data. This pass does not change grants, RLS, schema, or existing chapter records. Live permission tests, multi-device persistence, and real-account login must be verified with authorized chapter accounts; local unit tests are not evidence that those production tests passed.

## Deploy

Use the existing GitHub-to-Vercel integration with `node scripts/build-sites.mjs` and output directory `dist`. The build includes `runtime.js`, the manifest, and the icon. There are no new secrets, environment variables, or SQL migrations.

Source: [Supabase auth event reference](https://supabase.com/docs/reference/javascript/auth-onauthstatechange). The npm registry reported 2.118.0 as the latest Supabase client at implementation time; releases should be checked and smoke-tested intentionally before future updates.
