# ChapterOps Lite Web App

This is the website version of ChapterOps Lite. It is designed for a weekend pilot with a treasurer or executive officer, and structured so it can be moved to Vercel/Supabase when you are ready for a public multi-user version.

## Run it as a local website

From this folder:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Deploy to Vercel

The app is static-site ready. Import this folder into Vercel, or run:

```bash
vercel --prod
```

Use the project root:

```text
chapterops-web
```

## How to use it this weekend

1. Open the local URL above.
2. Go to Settings and update the chapter / organization name.
3. Add 5–10 real members.
4. Add one real event.
5. Use Attendance to record a test check-in.
6. Add or update dues rows with the treasurer.
7. Add one reimbursement request.
8. Review Dashboard.
9. Open Weekly Report and copy or print it.
10. Use Export to save a JSON backup of the trial data.

## What works now

- Dashboard metrics
- Member database
- Event tracker
- Attendance check-in with duplicate check-in updating
- Dues and balance tracking
- Reimbursement tracking
- Weekly executive report
- Settings
- Searchable tables
- Quick actions for common officer tasks
- Local browser storage
- Supabase Auth and cloud workspace sync
- JSON import/export backup

## Important limitation

This version now supports Supabase cloud sync, but the data is synced as a whole workspace document for speed. The next product-grade step is converting the workspace document into normalized Supabase tables with per-page queries, role-specific screens, and invite flows.
