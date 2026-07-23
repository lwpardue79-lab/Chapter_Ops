# AO Command Competitive Product Roadmap

AO Command is the private chapter-management platform for the Alpha Omega Chapter of Pi Kappa Alpha at Kansas State University. The product should win by being faster for officers, safer with student data, better for treasurer work, and easier to hand off between chapter leadership teams.

This roadmap turns the broad product goals into buildable phases. Do not add fake members, fake dues, fake events, fake PNMs, or demo chapter records. Every feature should work with clean empty states and real data entered by authorized users.

## Product positioning

AO Command should feel like chapter operating software, not a spreadsheet replacement with nicer colors.

Core promise:

- One secure workspace for chapter leadership.
- Fast weekly officer workflows.
- Clear accountability without public leaderboards or punishment mechanics.
- Treasurer-ready dues and balance tracking.
- Secretary-ready attendance.
- Member-safe self-service portal.
- Advisor-ready reports.

## What should make AO Command better than competitors

1. It is built around chapter operations, not generic CRM language.
2. It treats finance, attendance, recruitment, leadership, and reports as connected modules.
3. It has role-based experiences for President, Treasurer, Secretary, Recruitment, VPMD, Active Member, and Advisor.
4. It protects student and finance data by default.
5. It uses fast workflows for real chapter nights, especially attendance and dues.
6. It produces useful executive summaries without manual spreadsheet cleanup.
7. It supports handoff between officers through activity history, exports, settings, and clear workflows.

## Phase 1 — Make the app feel operational

Status: started.

Goals:

- Improve Command Center with real-data alerts.
- Add launch-readiness checklist.
- Add role-focus cards for President, Treasurer, Secretary, Recruitment, and VPMD/Brotherhood.
- Add platform-control language in Administration.
- Keep all data real and persistent.

Acceptance tests:

- Empty workspaces still look useful.
- Dashboard cards use live data only.
- No demo records are inserted.
- Each card links to the correct module.
- Mobile layout stays readable.

## Phase 2 — Officer speed workflows

Build the fastest repeated officer actions:

- Treasurer: import balances, edit ledger rows, record payment, export outstanding balances.
- Secretary: start chapter attendance, mark roster, close attendance, export attendance.
- President: review overdue priorities, KPI reports, officer tasks, and exec summary.
- Recruitment: add PNM, update status, track follow-up, export pipeline.
- VPMD/Brotherhood: track member follow-ups, brotherhood events, engagement, and retention concerns.

Acceptance tests:

- Every key officer task can be started from the Command Center.
- A weekly chapter attendance session can be opened in one click.
- Treasurer can export a report without touching raw data.
- President can see “what needs attention” in under 30 seconds.

## Phase 3 — Privacy and role-based access as a selling point

Goals:

- Keep full executive modules hidden from Active Members.
- Keep finance data limited to Admin, President, Treasurer, and Assistant Treasurer unless changed.
- Keep each Active Member’s portal limited to their own profile, balance, payments, attendance, tasks, calendar, and announcements.
- Maintain Supabase Row Level Security for all private tables or RPC access paths.

Acceptance tests:

- Active Member cannot fetch another member’s finance, attendance, or profile records.
- Treasurer can manage finance and export reports.
- Advisor can view reports without editing records.
- Switching accounts clears cached data.
- No service-role key is exposed in frontend code.

## Phase 4 — Treasurer excellence

Make AO Command outstanding for the treasurer.

Recommended features:

- Billing periods by semester.
- Payment-plan schedule and notes.
- Late-fee settings.
- Exportable member statements.
- Filtered “collect this week” list.
- Finance activity log.
- Treasurer dashboard with recent payments, past due, credits, waived balances, and payment plans.

Acceptance tests:

- Importing the same finance CSV twice updates records without duplicates.
- Zero balances and credits import correctly.
- Deleted or archived members do not appear in active finance views by default.
- Historical finance transactions remain preserved.

## Phase 5 — Advisor-ready reports

Recommended reports:

- Executive board summary.
- Attendance summary.
- Finance summary.
- Outstanding balance report.
- Recruitment summary.
- KPI meeting packet.
- Open action items.
- Member follow-up list.

Acceptance tests:

- Reports can be printed.
- CSV exports contain one row per canonical member.
- Clicking a report number opens the filtered data behind it.
- Advisor role can view report output without editing private records.

## Phase 6 — Notifications and reminders

Start with in-app reminders, then expand.

Recommended alerts:

- Payment due soon.
- Past-due balance.
- Attendance not closed.
- Missing attendance records.
- PNM follow-up due.
- Officer task due soon.
- KPI report not submitted.
- Member profile not linked to account.

Future channels:

- Email reminders.
- SMS only if members opt in.
- Push notifications only after privacy review.

Acceptance tests:

- Notifications are generated from real data.
- Users see only reminders they are authorized to see.
- No private finance or attendance details are sent to unauthorized users.

## Phase 7 — Database normalization and SaaS hardening

This is the bigger platform step. Do it carefully with migrations and RLS tests.

Priorities:

- Move more JSON workspace data into normalized Supabase tables.
- Keep `chapter_id` on every chapter-owned row.
- Add stable unique constraints for member finance accounts, attendance records, officer assignments, and KPI report sections.
- Keep `workspace_state` only for transitional or backup state if needed.
- Move privileged RPCs to safer schemas where practical.
- Run Supabase advisors and direct RLS tests after every migration.

Acceptance tests:

- No duplicate member rows from officer assignments.
- Imports persist after refresh and sign-in.
- Deletes/archive actions persist after refresh and sign-in.
- RLS blocks another chapter’s user.
- Production and local Supabase projects are clearly identified.

## Phase 8 — Product packaging

Prepare AO Command for future chapter/customer use.

Recommended assets:

- One-page product overview.
- Treasurer quick-start.
- Secretary attendance quick-start.
- Admin setup guide.
- Privacy and security explanation.
- Import templates.
- Sample onboarding checklist with no sample data.
- Pricing hypothesis and sales page copy.

Future packaging:

- Multi-chapter provisioning.
- Chapter templates.
- Stripe billing.
- Supabase organization model.
- Vercel production environment guide.

## Non-negotiable safety rules

- Do not add fake chapter records.
- Do not expose member or finance data publicly.
- Do not use hazing, pledge, ranking, punishment, or competition language.
- Do not merge VPMD/Brotherhood with Recruitment.
- Do not create duplicate member records for officer assignments.
- Do not store secrets in frontend code.
- Do not disable Supabase RLS globally.

## Next recommended build

The next best build after this roadmap is:

1. Add a dedicated Notifications / Command Alerts page using real data.
2. Add exportable President/Treasurer/Secretary report packets.
3. Add per-role dashboard variants after login.
4. Add more direct RLS tests around member portal, finance, attendance, and KPI data.
