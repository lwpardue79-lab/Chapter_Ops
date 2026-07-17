# Alpha Omega Chapter Operations

ChapterOps Lite is configured for the **Alpha Omega Chapter of Pi Kappa Alpha at Kansas State University**.

This build is for real setup and real data entry by chapter leadership and the Treasurer. It does not seed member, dues, PNM, event, finance, or attendance records.

## Live app

```text
https://chapterops-lite.vercel.app/
```

## Core modules

- First-time setup for chapter name, school, term, academic year, default dues amount, due dates, roles, statuses, event types, committees, permissions, and privacy notice.
- Member roster with add/edit/archive/delete, profiles, search, filters, duplicate detection, CSV import, and CSV export.
- Treasurer / dues tracker with charges, payments, payment status, payment plans, waived entries, due dates, payment methods, Treasurer notes, member balances, and exports.
- Treasurer dashboard with billed, collected, outstanding, unpaid, partially paid, paid, past due, plans, and quick actions.
- Events and attendance with event creation, required/optional tracking, member/PNM attendance, excused/unexcused statuses, and attendance export.
- Tasks and officer follow-ups.
- Officers and committees.
- Reports for roster, dues, outstanding balances, payment history, attendance, event participation, officer tasks, and executive summary.
- Activity log for important changes.
- Active Member Portal with member-only Home, My Profile, My Balance, My Payments, My Attendance, My Tasks, Chapter Calendar, and Announcements.

## Privacy and security

- Create an account or sign in with email/password before entering real chapter data.
- Personal emails are allowed, including Gmail, iCloud, Outlook, Yahoo, and Kansas State addresses.
- New account requests are pending until an Admin approves the user and assigns a role.
- Password reset is handled through Supabase Auth.
- Supabase Auth and RLS protect the cloud workspace.
- The browser app uses only a publishable Supabase key. Do not add a service-role key to frontend code.
- Role-based access is capability-based. Active Members do not load the full executive workspace.
- Active Member Portal data is loaded through member-scoped Supabase RPCs. A member account must be linked to a canonical roster member before portal data appears.
- Financial views are restricted to authorized finance roles.
- Archive is preferred over permanent delete.
- Delete actions require confirmation.

## Testing multiple accounts safely

Supabase stores the active browser session for this site in browser storage. To test an Admin account and an Active Member account at the same time, use separate browser storage contexts:

- Admin account in Chrome Profile A and test account in Chrome Profile B.
- Or Admin in a normal browser window and test account in an Incognito/Private window.
- Or use two different browsers.

Do not test two accounts in two tabs of the same browser profile. Signing into the second account can replace the first profile's stored session.

## Local development

From the repo root:

```bash
npm run dev
```

Or serve this folder:

```bash
python3 -m http.server 4173 --directory chapterops-web
```

## Deployment

Deploy from the repository root:

```bash
vercel --prod
```

The root build copies `chapterops-web/` into `dist/` for Vercel.
