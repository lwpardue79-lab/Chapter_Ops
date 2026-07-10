# Deployment Notes

## Production URL

```text
https://chapterops-lite.vercel.app/
```

## Deploy to Vercel

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

It uses Supabase Auth email/password accounts plus an RLS-protected cloud workspace table. The frontend key in `config.js` is a publishable key and is safe for browser use. Do not add a service-role key to this app.

After deploy, confirm Supabase Authentication URL settings include:

- Site URL: `https://chapterops-lite.vercel.app`
- Redirect URLs:
  - `https://chapterops-lite.vercel.app`
  - `http://localhost:4173`

## Next production hardening step

The current app stores the chapter workspace as one RLS-protected JSON document for fast MVP use. For broader multi-user production, normalize into Supabase tables:

- organizations
- organization_members
- members
- pnms
- events
- attendance
- dues_charges
- payments
- tasks
- leadership_roles
- activity_log
- settings

Then add per-table RLS policies for Admin, Treasurer, Assistant Treasurer, President, Exec Board, Committee Chair, Active Member, and Read-only Advisor.
