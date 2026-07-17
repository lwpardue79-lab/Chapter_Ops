# Member Portal Security

Date: 2026-07-17  
App: https://chapterops-lite.vercel.app/

## Purpose

The Active Member Portal gives regular members access to their own chapter information without exposing executive, finance-admin, recruitment, settings, import/export, backup, or workspace data.

## Account linking

The trusted link is:

```text
auth.uid() -> public.organization_members.user_id -> public.organization_members.member_id -> workspace_state.data.members[].id
```

The browser never supplies the member ID for portal reads. If `organization_members.member_id` is missing, the portal returns:

```text
Account setup incomplete
```

Admins link accounts to canonical roster members from the Admin user-management table.

## Member-facing routes

The static app uses member-portal tabs rather than a full router:

- Member Portal Home
- My Profile
- My Balance
- My Payments
- My Attendance
- My Tasks
- Chapter Calendar
- Announcements

Active Members do not receive the executive navigation.

## Data source

Operational records are currently stored in `public.workspace_state.data` as JSON. Active Members are not allowed to select `workspace_state`. Instead, the portal calls scoped RPC functions that resolve the signed-in user and return only that member's approved data.

## RPC functions

Created in `supabase/migrations/202607171930_add_member_portal_rpc.sql`:

- `public.current_member_id(requested_chapter_id uuid)`
- `public.current_member_organization_id()`
- `public.get_my_member_portal()`
- `public.update_my_member_profile(...)`
- `public.update_my_task_status(p_task_id text, p_status text)`
- `public.submit_my_excuse_request(...)`
- `app_private.workspace_member_portal(p_org_id uuid, p_member_id text)`
- `app_private.money_to_cents(p_value text)`

Follow-up migration:

- `supabase/migrations/202607171940_allow_member_portal_audit_events.sql`
- `supabase/migrations/202607171950_refine_portal_announcement_policies.sql`

## Secure views

Created with `security_invoker = true`:

- `public.member_portal_announcements`
- `public.member_portal_excuse_requests`

The app primarily uses RPCs for the JSON workspace data because restricted views cannot safely expose selected fields from one JSON workspace row without reading that row first.

## New tables

- `public.portal_announcements`
- `public.member_excuse_requests`

Both have RLS enabled.

## RLS policies

Announcements:

- Members can read intended announcements.
- Authorized users can create announcements.
- Authorized users can update announcements.
- Authorized users can delete announcements.

Excuse requests:

- Members can read their own excuse requests.
- Members can submit their own excuse requests.
- Authorized users can update excuse requests.

Existing `workspace_state` RLS remains in place: Active Members cannot select the full workspace row.

## Editable profile fields

Members can update only these fields through `update_my_member_profile`:

- Preferred name
- Phone
- Email
- School year
- Graduation year

Admin-only fields are ignored by the RPC and are not accepted from the member form:

- Member status
- Initiation status
- Officer position
- Committee
- Member ID
- Finance status
- Archived status
- Permissions

## Finance privacy

`get_my_member_portal` returns only the linked member's finance account and transactions. It does not return:

- Other members' balances
- Chapter-wide finance totals
- Finance imports
- Record-payment controls
- Treasurer notes
- Finance exports

## Attendance privacy

The portal returns only attendance records where the member ID matches the linked member. It does not return:

- Other members' attendance
- Full event attendance rosters
- Private officer notes
- Attendance editing controls

## Task privacy

The portal returns:

- Tasks assigned to the linked member
- Tasks explicitly marked `visibility = members`

Members can update only their own assigned task status to supported safe values. They cannot reassign, delete, or edit ownership/private fields.

## Event visibility

The Chapter Calendar returns only events with:

```text
visibility = members
```

Existing events without a visibility value are not exposed to Active Members until an authorized officer marks them member-visible.

## Announcement visibility

Members can receive announcements where:

- Audience is `All Active Members`
- The announcement targets their linked member ID
- The announcement targets their officer position

## Tests performed

Production Supabase direct checks:

- Active Member simulated via JWT role saw `0` rows from `workspace_state`.
- Admin simulated via JWT role saw `1` row from `workspace_state`.
- Unlinked Active Member received `linked: false` from `get_my_member_portal`.
- Rollback-only linked-member simulation returned one member's portal data.
- Rollback-only profile update simulation updated an allowed field and then rolled back.
- Rollback-only excuse request simulation inserted a member-owned request, verified it through the member portal view, and then rolled back.

Frontend checks:

- JavaScript syntax check passed.
- Production build passed.
- Active Member portal UI contains no technical RLS placeholder language.

## Remaining manual tests

After you link a real Active Member account to a roster member, test in a separate browser profile:

1. Active Member sees only member navigation.
2. Active Member can view My Profile.
3. Active Member can edit only allowed profile fields.
4. Active Member sees only their own balance and payments.
5. Active Member sees only their own attendance.
6. Active Member sees only their own tasks.
7. Active Member sees only member-visible events.
8. Active Member sees only intended announcements.
9. Active Member cannot access executive routes.
10. Admin and Treasurer access still works in another browser profile.
