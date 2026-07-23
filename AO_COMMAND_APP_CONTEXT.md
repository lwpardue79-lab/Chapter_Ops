# AO Command App Context

Use this file as the main handoff/context document for anyone or any AI tool helping improve AO Command.

## Product identity

Product name: AO Command

Product description: Alpha Omega Chapter Management Platform

Primary tagline: The operating system for Alpha Omega.

Chapter: Alpha Omega Chapter of Pi Kappa Alpha

School: Kansas State University

Current production URL: https://chapterops-lite.vercel.app/

Important branding note: The app is built for the Alpha Omega Chapter’s private use. Do not imply that this application is officially sponsored, licensed, endorsed, or approved by Pi Kappa Alpha International Fraternity.

## Product purpose

AO Command is a private chapter-management platform for day-to-day fraternity chapter operations. It is designed to help authorized chapter leadership manage members, recruitment, finances, attendance, events, officer responsibilities, KPI meetings, reports, and member-facing information in one secure workspace.

The product should feel like polished administrative/business software: secure, professional, mobile-friendly, fast, and reliable.

## Current architecture

AO Command is currently a static web application backed by Supabase.

Frontend:

- Plain HTML/CSS/JavaScript.
- Main app folder: `ao-command-web/`.
- Primary frontend file: `ao-command-web/app.js`.
- Styles: `ao-command-web/styles.css`.
- HTML shell: `ao-command-web/index.html`.
- Runtime config: `ao-command-web/config.js`.

Build/deploy:

- Root build script: `scripts/build-sites.mjs`.
- Root package script: `npm run build`.
- Build output: `dist/`.
- Deployed through Vercel.
- The Vercel project still uses the legacy project/domain name, but the product branding inside the app is AO Command.

Backend:

- Supabase Auth for email/password login.
- Supabase Postgres for persistence.
- Supabase Row Level Security is enabled for protected tables.
- Several secure RPC functions are used to scope writes and member-facing reads.

Current database design:

- Some operational data is still stored in `public.workspace_state.data` as one JSON workspace document.
- Newer features add relational/RPC-backed structures where needed, especially attendance and member portal security.
- Do not reset or delete production data.
- Do not add fake/demo data.

## Current modules

### Command Center

The main executive dashboard.

Shows professional chapter-level metrics such as:

- Active Members
- Outstanding Dues
- Open Officer Tasks
- Upcoming Events
- PNMs Requiring Follow-Up
- Chapter Attendance Rate
- Budget Remaining
- Reports Awaiting Review

Also includes Executive Priorities:

- Overdue dues
- Overdue officer tasks
- PNMs needing follow-up
- Missing attendance records
- Upcoming deadlines
- Reports needing review

### Member Directory

Roster management for chapter members.

Current capabilities:

- Add member
- Edit member
- Archive/delete with confirmation
- Member profiles
- Search and filters
- CSV import
- CSV export
- Duplicate prevention using member identifiers, email, and phone where available

Important data rule:

There should be one canonical permanent member record per real person. Officer assignments, dues, attendance, tasks, and profile/account links should connect to that member record. Do not create duplicate member records for officers.

### Recruitment Pipeline

Tracks PNMs and recruitment workflow.

Current PNM statuses include:

- New lead
- Contacted
- Interested
- Event attended
- Ready for review
- Approved for bid
- Bid extended
- Accepted
- Declined
- Not a fit
- Archived

Recruitment must remain separate from VPMD/Brotherhood.

### Events & Attendance

Attendance is now designed around a Secretary-managed roster checklist rather than QR-first attendance.

Workflow:

1. Secretary opens Events & Attendance.
2. Clicks Start Chapter Attendance.
3. AO Command creates a chapter attendance session using saved defaults.
4. Active roster loads with one row per active member.
5. Every member starts Unmarked.
6. Secretary marks Present, Late, Excused, or Absent.
7. Secretary can bulk mark remaining unmarked members Absent.
8. Secretary closes attendance.
9. Attendance persists to Supabase.

Attendance statuses:

- unmarked
- present
- late
- excused
- absent

Relational attendance tables:

- `attendance_sessions`
- `attendance_records`

Important attendance rule:

Use one attendance record per `attendance_session_id + member_id`. A database uniqueness constraint prevents duplicate rows for the same member/session.

### Financial Operations

Finance/Dues tracking works as a member billing ledger.

Main ledger concept:

- Pending Charge: newly charged amount for the current billing period.
- Current Balance: previous unpaid balance or credit.
- Total Balance: Pending Charge + Current Balance.

Supports:

- Member finance rows
- Charges
- Payments
- Credits/adjustments
- Payment plan status
- Due dates
- Treasurer notes
- CSV finance import
- CSV finance export
- Finance summary cards

Finance privacy rule:

Financial data should be restricted to Admin, Treasurer, Assistant Treasurer, President, and other explicitly authorized finance roles. Regular Active Members should only see their own balance and transactions.

### Action Center

Officer/task follow-up system.

Tasks can include:

- Title
- Description
- Assigned person
- Due date
- Priority
- Status
- Related member/event/finance item
- Notes

### Leadership

Tracks Executive Team/officer assignments.

Current rule:

Everyone assigned as an officer is treated as part of Leadership/Executive Team display.

VPMD/Brotherhood rule:

- VPMD is the formal title.
- Brotherhood is the responsibility label.
- Display as `VPMD · Brotherhood` where useful.
- VPMD/Brotherhood must not be categorized as Recruitment.
- Recruitment remains a separate leadership and reporting area.

Officer deduplication rule:

Each officer should appear once per leadership section, deduplicated by permanent member ID, not by name.

### KPI Reports

Recurring chapter leadership/KPI meeting system.

Supports:

- KPI meetings
- One report section per active leadership position
- KPI definitions
- KPI results
- Action items
- Meeting history
- Reports completed/missing
- KPI status tracking
- Print/export

KPI status options:

- On Track
- At Risk
- Off Track
- Completed
- Not Reported

KPI value types:

- Number
- Currency
- Percentage
- Text
- Yes/No

### Reports & Analytics

Leadership reporting area for:

- Member count
- Active/inactive members
- Attendance summaries
- Dues summaries
- Recruitment summaries
- Event participation
- Members needing follow-up
- PNMs needing follow-up
- Overdue tasks
- Finance summary
- Executive summary

### Administration

Configuration/admin area for:

- Chapter name
- School name
- Term/semester
- Academic year
- Default dues amount
- Dues due dates
- Officer roles
- Member statuses
- Event types
- Committees
- Permission roles
- Privacy notice
- User approvals and role assignments

Version label:

AO Command v1.0

## Authentication and roles

AO Command uses Supabase Auth with email/password.

Personal email addresses are allowed:

- Gmail
- iCloud
- Outlook
- Yahoo
- Kansas State emails
- Other normal valid email domains

Do not restrict login to `@ksu.edu`.

Access model:

1. User signs up or requests access.
2. Profile is created as pending.
3. Pending users cannot access private chapter data.
4. Admin approves user and assigns role.
5. Approved user can access features based on role permissions.

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

Important:

Do not expose service-role keys in frontend code. Browser code should use only publishable/anon Supabase keys.

## Member Portal

Active Members do not see executive/admin navigation.

Member Portal routes:

- `/member`
- `/member/profile`
- `/member/balance`
- `/member/payments`
- `/member/attendance`
- `/member/tasks`
- `/member/calendar`
- `/member/announcements`

Active Members can access only:

- Their own profile
- Their own balance
- Their own payment history
- Their own attendance
- Their own assigned/member-visible tasks
- Member-visible calendar events
- Announcements intended for them

Active Members must not access:

- Executive Dashboard / Command Center
- Full private member roster
- Other members’ balances
- Other members’ payment history
- Chapter-wide finance totals
- Officer management tools
- Recruitment management tools
- Attendance admin roster
- KPI admin reports
- Administration/settings
- Imports/exports/backups
- Permission management

Account linking should use:

`auth.uid()` → `organization_members.user_id` → `organization_members.member_id`

Do not identify a signed-in member using URL parameters, local storage, editable metadata, or client-supplied member IDs.

## Supabase/RLS expectations

Security is a core feature.

Maintain:

- Login required for private data.
- No public access to member, PNM, finance, attendance, task, report, or admin data.
- Row Level Security enabled.
- Chapter isolation in every policy.
- Role permissions enforced in frontend and backend.
- Admin-only user approval/role management.
- Finance data restricted to authorized roles.
- Member Portal reads scoped to the signed-in linked member.
- Audit/activity logging for important changes.

Do not fetch unauthorized data and merely hide it in the UI.

## Important Supabase functions/RPCs

Existing RPC/function concepts include:

- Chapter setup persistence
- Member CSV import persistence
- Member archive/delete persistence
- Finance ledger save/import
- Executive team/KPI workspace save
- Member portal scoped reads
- Member profile update
- Attendance manager workspace
- Start chapter attendance
- Create event attendance session
- Set attendance status
- Bulk set attendance status
- Close attendance session

Before changing database behavior:

1. Inspect the existing schema/migrations.
2. Preserve production data.
3. Create safe SQL migrations.
4. Do not reset production.
5. Do not disable RLS globally.
6. Test direct RLS behavior.

## Current files and folders

Main web app:

- `ao-command-web/index.html`
- `ao-command-web/app.js`
- `ao-command-web/styles.css`
- `ao-command-web/config.js`

Build:

- `scripts/build-sites.mjs`
- `package.json`
- `vercel.json`

Supabase:

- `supabase/migrations/`

Docs:

- `docs/security-audit.md`
- `docs/member-portal-security.md`
- `docs/attendance-checklist-security.md`

Legacy/companion Google Sheets artifact:

- `AO_Command.gs`
- `build_ao_command.mjs`
- `outputs/ao-command/`

## Current build commands

From repo root:

```bash
node --check ao-command-web/app.js
node scripts/build-sites.mjs
```

The project currently has no full lint/typecheck/test script beyond static JS syntax checks and the production build script.

## Deployment notes

Production is currently deployed through Vercel.

Current public URL:

https://chapterops-lite.vercel.app/

The domain/project URL is legacy, but app branding should show AO Command everywhere.

If deploying from local:

```bash
vercel --prod
```

If using a temporary package runner:

```bash
pnpm dlx vercel --prod --yes
```

Do not print or expose Vercel tokens.

## Branding rules for future improvements

Use:

- AO Command
- Alpha Omega Chapter Management Platform
- The operating system for Alpha Omega.
- One secure workspace for chapter leadership.
- Command Center
- Member Directory
- Recruitment Pipeline
- Events & Attendance
- Financial Operations
- Action Center
- Leadership
- Reports & Analytics
- Administration

Do not use:

- ChapterOps Lite
- Chapter Ops Lite
- AO Chapter Ops
- ChapterOps
- Lite
- Demo
- Prototype
- Test app
- Real chapter workspace
- Development/prototype wording visible to users

## Product language and safety rules

Use professional chapter-operations language.

Avoid:

- Hazing-related language
- Pledge terminology
- Punishment framing
- Big/little matching
- Big brother fields
- Rankings
- Leaderboards
- Competitions
- Public callouts
- Anything implying hierarchy-based new member tracking

Focus on:

- Operations
- Accountability
- Communication
- Attendance
- Dues
- Reimbursements
- Officer responsibilities
- Reporting
- Member support

## Improvement priorities

Good next improvements:

1. Normalize more JSON workspace data into Supabase tables.
2. Add robust automated tests for permissions and RLS.
3. Improve import previews and failed-row correction workflows.
4. Add richer finance transaction history.
5. Add better mobile attendance and task UX.
6. Add notifications/reminders.
7. Add executive report PDF exports.
8. Add advisor read-only dashboards.
9. Add member privacy preferences.
10. Add activity log filtering and export.

## Must-preserve constraints

When improving AO Command:

- Preserve all existing production data.
- Preserve authentication.
- Preserve personal email login support.
- Preserve admin approval flow.
- Preserve RLS and role restrictions.
- Preserve member privacy.
- Preserve finance privacy.
- Preserve member import/export.
- Preserve finance import/export.
- Preserve attendance persistence.
- Preserve member portal privacy.
- Preserve VPMD/Brotherhood as one position.
- Preserve Recruitment as separate from VPMD/Brotherhood.
- Do not add fake/demo records to production.
- Do not expose service-role keys.
- Do not change the product back to old branding.

## Suggested prompt to use with this file

If uploading this to another AI/developer tool, use something like:

> This file describes AO Command, a private chapter-management platform for the Alpha Omega Chapter of Pi Kappa Alpha at Kansas State University. Read the entire context file first. Then inspect the repository before making changes. Preserve existing data, authentication, Supabase RLS, member privacy, finance privacy, and AO Command branding. Do not add fake/demo data. Propose and implement improvements in small safe steps, run the build, and list every file changed.

