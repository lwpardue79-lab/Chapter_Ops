# ChapterOps Lite Deployment Path

## Fastest public URL

Use Vercel as a static site:

1. Create a GitHub repo.
2. Push the `chapterops-web` folder.
3. In Vercel, import the repo.
4. Set the project root to `chapterops-web`.
5. Leave build command blank.
6. Leave output directory blank.
7. Deploy.

That gives you a public Vercel URL.

## CLI deploy option

If the Vercel CLI is available:

```bash
cd "/Users/lukepardue/Documents/Greek life dashboard/chapterops-web"
vercel
vercel --prod
```

If Vercel asks for framework settings, use:

- Framework preset: Other
- Build command: leave blank
- Output directory: leave blank
- Install command: leave blank

## Supabase connection

This build is already configured for the existing Supabase project:

```text
https://hjgyigdxlempsfqgjttt.supabase.co
```

It uses Supabase Auth plus a cloud workspace sync table protected by RLS. The publishable frontend key is safe to ship in browser code. Do not add a service-role key to this app.

After the Vercel deployment is live, update Supabase Auth URL settings:

1. Go to Supabase Dashboard → ChapterOps → Authentication → URL Configuration.
2. Set Site URL to your Vercel production URL.
3. Add redirect URLs:
   - `http://localhost:4173`
   - your Vercel production URL

Without this, email sign-in links may redirect to the wrong place.

## Important product warning

The current version syncs the entire ChapterOps workspace as one Supabase JSON document. That is fine for a beta/demo URL and weekend pilot. For real multi-officer production, the next step is a normalized relational schema with invites, officer roles, and per-table queries.

## Real production architecture

- Frontend: Next.js app using this UI
- Auth: Supabase Auth
- Database: Supabase Postgres
- Tables: organizations, members, events, attendance, dues, reimbursements, reports, settings
- Roles: admin, president, treasurer, secretary, read-only advisor
- Storage: receipt uploads
- Email: weekly report via Resend, SendGrid, or Supabase Edge Function
- Payments: Stripe for dues collection and reconciliation

## Suggested build order

1. Convert this static UI into Next.js pages/components.
2. Add Supabase schema and Row Level Security.
3. Add login and organization-level roles.
4. Move local state to Supabase queries/mutations.
5. Add receipt upload.
6. Add hosted executive report emails.
7. Add Stripe dues payment links.
