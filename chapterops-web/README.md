# Alpha Omega Chapter Operations

ChapterOps Lite is now configured as **Alpha Omega Chapter Operations** for the Alpha Omega Chapter of Pi Kappa Alpha. It is a mobile-friendly chapter operations web app for executive dashboarding, member management, recruitment/PNM tracking, events, attendance, dues, tasks, committees, reports, and settings.

## Live app

Production URL:

```text
https://chapterops-lite.vercel.app/
```

## Run locally

From the repo root:

```bash
npm run dev
```

Or from this folder:

```bash
python3 -m http.server 4173 --directory .
```

Then open:

```text
http://localhost:4173
```

## What is included

- Executive dashboard with active members, new members, PNMs, upcoming events, attendance alerts, dues summary, open tasks, follow-ups, activity, and quick actions.
- Member roster with add/edit/archive/delete, search, filters, profiles, committees, dues status, attendance rate, notes, tags, and CSV export.
- Recruitment / PNM module with assigned recruiter, referral source, events, follow-up date, status workflow, bid extended/accepted/declined dates, and recruitment reports.
- Events and attendance module with event types, required/optional status, member and PNM attendance, excused/unexcused attendance, and phone-friendly check-in.
- Finance / dues tracking for dues owed/paid, past due balances, budget categories, expenses, reimbursements, event budgets, fundraising income, and finance summaries.
- Tasks and follow-ups for officer work, member follow-ups, PNM follow-ups, finance follow-ups, event logistics, and exec action items.
- Officers and committees module for leadership assignments, responsibilities, and related reports.
- Reports page with chapter overview, attendance summary, dues summary, recruitment summary, event participation, follow-ups, overdue tasks, finance summary, CSV export, and print/PDF export.
- Settings for chapter name, school, term, academic year, role selection, attendance threshold, privacy notice, demo reset, and import/export.
- Demo data for 50 fake members, 20 fake PNMs, 8 events, finance rows, attendance records, tasks, and leadership assignments.

## Privacy and safety model

- Demo/local mode is safe for walkthroughs.
- Sign in before adding real member, PNM, finance, or attendance information.
- Supabase Auth and RLS protect the cloud workspace.
- The browser app uses a publishable Supabase key only; never add a service-role key to frontend code.
- Finance and sensitive recruitment views are role-aware in the UI.
- Archive is preferred over permanent delete.
- Important status changes require confirmation and can be undone.
- Avoid unnecessary sensitive notes.

## Current architecture

This is a static Vercel app with Supabase Auth and a cloud workspace sync table. For speed and reliability in the current MVP, the app stores the chapter workspace as one JSON document per organization.

Next production step: normalize the workspace into Supabase tables for members, PNMs, events, attendance, finance, tasks, leadership, activity logs, and per-role policies.

## Deployment

The root project contains the Vercel build config. Deploy from the repo root:

```bash
vercel --prod
```

The build copies `chapterops-web/` into `dist/` for Vercel.
