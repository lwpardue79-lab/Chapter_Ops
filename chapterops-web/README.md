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

## Privacy and security

- Sign in before entering real chapter data.
- Supabase Auth and RLS protect the cloud workspace.
- The browser app uses only a publishable Supabase key. Do not add a service-role key to frontend code.
- Financial views are restricted in the UI to Admin, Treasurer, Assistant Treasurer, and President roles.
- Archive is preferred over permanent delete.
- Delete actions require confirmation.

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
