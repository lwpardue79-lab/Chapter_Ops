# Attendance checklist security

AO Command now uses a Secretary-managed roster checklist for normal chapter and event attendance.

## Weekly chapter workflow

Authorized users with `attendance.manage` open Attendance and choose **Start Chapter Attendance**. The database creates an open `attendance_sessions` row, loads the canonical active roster from the chapter workspace, and creates one `attendance_records` row per expected member with status `unmarked`.

The Secretary can mark each member:

- `present`
- `late`
- `excused`
- `absent`
- `unmarked`

Status changes are saved through Supabase RPCs, not only local browser state. Closing attendance optionally marks remaining unmarked records absent, writes `closed_by` and `closed_at`, and locks normal edits.

## Event attendance workflow

Authorized attendance managers can choose **Create Event Attendance**, enter a name, event type, date, start time, and required/optional status, then use the same roster checklist and close flow.

## Canonical roster rules

The checklist roster comes from `workspace_state.data.members`. The RPC excludes deleted, archived, alumni, and inactive members by default, and deduplicates by the permanent member `id`. Officer assignments are displayed as context only and cannot create duplicate attendance rows.

## Tables

- `attendance_sessions`: one row per meeting or event attendance session.
- `attendance_records`: one row per `attendance_session_id + member_id`.

`attendance_records_session_member_unique` prevents duplicate records for the same member and session.

## RPC functions

- `get_attendance_manager_workspace(session_id uuid default null)`: returns sessions, selected records, roster, and settings for authorized attendance viewers.
- `start_chapter_attendance()`: creates an open chapter meeting attendance session from saved defaults.
- `create_event_attendance_session(...)`: creates an open event attendance session.
- `set_attendance_status(session_id, target_member_id, new_status, note, adjustment_reason)`: validates permissions, session, member, status, and writes the status using database time.
- `bulk_set_attendance_status(session_id, new_status, only_unmarked)`: bulk-updates open-session records.
- `close_attendance_session(session_id, mark_unmarked_absent)`: closes an open session and records close metadata.

Closed-session corrections require an adjustment reason unless the record is being edited while the session is still open.

## RLS model

Row Level Security remains enabled.

Active Members can:

- Read their own attendance records.
- Read session details for their chapter.
- See their own attendance in the Member Portal.

Active Members cannot:

- Create attendance sessions.
- Mark themselves present.
- Edit official attendance records.
- Read the full chapter roster through attendance records.

Secretaries, Admins, Presidents, and attendance-authorized officers can:

- Create sessions for their chapter.
- Read the chapter attendance roster.
- Insert and update attendance records for their chapter.
- Close sessions.

Policies always check the caller's authenticated chapter membership. A user from another chapter cannot read or update Alpha Omega attendance data.

## Member Portal

`get_my_member_portal()` returns official checklist attendance for the signed-in member by joining:

`auth.uid()` → `organization_members.user_id` → `organization_members.member_id` → `attendance_records.member_id`

The portal does not trust client-supplied member IDs, URLs, local storage, or editable user metadata.

## Attendance calculation

The current checklist summary treats `present`, `late`, and `excused` as counted for the displayed attendance rate:

`(present + late + excused) / expected members`

Chapter settings store attendance threshold, late handling, and excused handling so this can be refined without changing the UI workflow.

## Required verification

Before deploying attendance changes, verify:

1. Secretary/Admin can start chapter attendance.
2. One roster row appears per active member.
3. Status changes persist after refresh.
4. Bulk absent and close work.
5. Closed-session corrections require a reason.
6. Active Members can read only their own attendance.
7. Active Members cannot call attendance-management RPCs.
8. Officers do not duplicate attendance rows.
