# Deployment Notes

## Vercel production

The correct production project is:

```text
https://chapterops-lite.vercel.app/
```

Deploy from the repository root:

```bash
vercel --prod
```

Root-level `vercel.json` runs:

```bash
node scripts/build-sites.mjs
```

and serves:

```text
dist/
```

## Supabase connection

The app is configured for the existing ChapterOps Supabase project:

```text
https://hjgyigdxlempsfqgjttt.supabase.co
```

It uses Supabase Auth plus an RLS-protected cloud workspace table. The frontend key in `config.js` is a publishable key and is safe for browser use. Do not add a service-role key to the app.

After deploy, confirm Supabase Authentication URL settings include:

- Site URL: `https://chapterops-lite.vercel.app`
- Redirect URLs:
  - `https://chapterops-lite.vercel.app`
  - `http://localhost:4173`

## Product-grade next step

The current app is ready for a chapter demo and early controlled use. For a stronger multi-user production release, convert the JSON workspace into normalized Supabase tables:

- organizations
- organization_members
- members
- pnms
- events
- attendance
- finance_items
- tasks
- leadership_roles
- activity_log
- settings

Then add per-table RLS policies for Admin, President, Treasurer, Recruitment/VPMD, Exec Board, Committee Chair, Active Member, and Read-only Advisor.
