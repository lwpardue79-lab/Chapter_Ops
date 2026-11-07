# Annual budget and alumni reporting

## Delivery status (November 6, 2026)

Deployed to https://chapterops-lite.vercel.app/ on November 6, 2026. Vercel deployment `dpl_GZCZ3WCbmDsk2Hdk7Tm74h2wgNWn` is READY and assigned to the production domain. The live app and budget-module checksums match the tested source. The versioned migration below is applied to Supabase project `hjgyigdxlempsfqgjttt`. No workbook amounts, member records, or sample budget records have been inserted in production.

## Workflow

1. Open **Finance → Annual Budget**.
2. Create **Chapter operating budget**, beginning **2026-07-01**.
3. Choose **Import budget** and upload the private transfer at `outputs/private-budget/alpha-omega-2026-2027-budget.json`. Select the operating budget in the preview.
4. Review the categories and totals. The optional opening-actuals checkbox is off by default. Only enable it after reconciling the source July–October amounts. Once a source line is imported, re-import skips it; adding opening actuals later requires individual activity entries or a reviewed correction, not another blind import.
5. Separately create **Executive allocations** with the same start date and import the executive section of the transfer. These allocations may overlap operating expenses. The app deliberately does not add budgets together.
6. Add/edit monthly plans and record each expense or income receipt against one line. Negative actuals are reversals/refunds; zero is valid. Dates must fall within the selected budget year.
7. Corrections require a reason. Voiding excludes a transaction from totals while retaining its record and change history. Closed/archived budgets cannot receive entries until reopened.
8. Select the reporting month and choose **Alumni meeting view**. Present the category-level and monthly summary or use **Print / Save PDF**. **Export summary** produces a category-level CSV.

There is no public alumni link and no new alumni user provisioning. An authorized presenter opens the report or deliberately shares the printed PDF/CSV. Private vendor/transaction descriptions, financial notes, individual member balances, and payment histories are absent from the report.

## Source workbook interpretation

Source: `Pike_Annual_Budget_October_Colors.xlsx`, supplied by the user. The July 2026–June 2027 period was explicitly confirmed in chat.

- Annual plans use leaf rows from **Annual Budget**. Totals, headcounts, forecasts, and duplicate executive subrows are excluded. Chapter operating expenses already include its Executive Team and Misc subrows.
- Existing monthly actuals are cached formula results, not recalculated or reconciled bank transactions. Only July–October values are offered as optional opening summaries. November–June remain unreported.
- Miscellaneous credits are placed in income and explicitly flagged for review; a refund may instead belong as a negative expense on its original category.
- Monthly monetary inputs are rounded to integer cents. The source contains sub-cent values and formula-driven budget amounts; rounded month totals can differ slightly from its cached annual totals.
- Executive fall allocations are assigned to August and spring allocations to January. This records allocation timing, not actual spending.
- Recruitment's year-long amount is allocated once in July. Sergeant at Arms and Public Relations use the current annual amounts listed in the workbook. These interpretations are visible import warnings and need confirmation.
- Brotherhood is assigned to VPMD. Recruitment remains a separate allocation.
- Broken references in **Exec Expenses** are not copied. No executive actuals are invented.
- Bank transaction descriptions and vendor lists are not embedded into public web assets. The transfer is git-ignored and is not part of `dist`.

Regenerate the private transfer:

```sh
python3 scripts/prepare-budget-transfer.py /path/to/source.xlsx outputs/private-budget/alpha-omega-2026-2027-budget.json --starts-on 2026-07-01
```

The converter supports this supplied workbook layout, not arbitrary Excel workbooks. The app accepts the validated JSON transfer, not a raw `.xlsx` upload. It does not evaluate workbook formulas.

## Calculation definitions

- Annual plan: sum of 12 monthly allocations.
- Plan to date: planned months from fiscal start through the selected reporting month.
- Actual to date: non-voided recorded activity through the selected reporting month.
- Expense variance: plan to date minus expense actuals. A negative variance is unfavorable.
- Income variance: income actuals minus plan to date. A negative variance is unfavorable.
- Unspent allocation: annual expense plan minus expenses through the reporting month.
- Net activity: income received minus expenses recorded through that month.

Net activity and unspent allocation are **not reconciled bank balances**. No beginning cash, bank reconciliation, automatic accounting integrations, or automatic dues cash-recognition is claimed. Existing member receivables are preserved and separate. Each actual receipt/payment should be recorded once in the budget; do not import both monthly opening summaries and detailed bank activity for the same amounts. Archived lines retain their financial history in totals.

## Security and persistence

Migration: `supabase/migrations/20261107012252_annual_executive_budget.sql`.

Tables:

- `annual_budgets`: chapter/year, status, revision, and authenticated creator/editor.
- `annual_budget_lines`: category, position, expense/income type, 12 integer-cent monthly allocations, archive state, import source key.
- `annual_budget_entries`: dated signed integer-cent actuals, private description/payee/notes, correction and void metadata.
- `annual_budget_changes`: immutable application change history, previous/new values, actor, reason, database timestamp.
- `app_private.budget_requests`: private idempotency receipts. Browser access is denied and its RLS intentionally has no allow policy.

Public tables have RLS enabled. `budget_private_read`, `budget_lines_private_read`, `budget_entries_private_read`, and `budget_changes_private_read` allow only approved active chapter memberships with `budget.manage`. Direct client inserts/updates/deletes are revoked. All mutations go through a checked transactional RPC.

RPCs:

- `read_annual_budget(uuid,uuid)`: requires trusted chapter membership and `budget.view`. Finance managers receive transaction details. Read-only report viewers receive line-level plans/aggregates and **no transactions**.
- `save_annual_budget(uuid,uuid,integer,uuid,text,jsonb)`: requires `budget.manage`, trusted chapter context, a request ID and current revision. It locks the budget, validates chapter-owned foreign keys/dates/amounts, records history, increments the revision, and commits atomically. Stale edits raise `PT409`. Retries with the same request token/payload return the saved result without duplication.

`budget.view` and `budget.report`: Admin, President, Treasurer, Assistant Treasurer, Read-only Advisor. `budget.manage`: Admin, Treasurer, Assistant Treasurer. Other roles have no access by default. This does not expand Recruitment/VPMD or regular-member financial access. Existing officer identities and permissions are unchanged.

The checked API entry points intentionally use `SECURITY DEFINER` with fixed empty search paths and explicit active-membership/permission checks. Anonymous execution is revoked. Supabase advisors report authenticated security-definer API functions for review; this is intentional, not an open anonymous grant. The private idempotency table's no-policy RLS advisory is an intentional deny-all condition.

The client sends no trusted actor IDs and uses no localStorage budget cache. It waits for database confirmation and performs a separate readback. Failed saves retain form inputs. Uncertain connection retries keep the same request token. Account changes clear budget state and discard stale in-flight responses. No service-role credential or new environment variable is required.

## Verification

Passed locally:

- 60 Node/Postgres tests, including 14 new direct SQL budget cases and 7 budget math/import tests.
- Browser save failure/retry, retained input, stable retry token, readback, read-only and unauthorized gates, alumni privacy, CSV, and printable PDF.
- 1440px desktop, 768px tablet, and 390px mobile overflow checks and visual review.
- JavaScript syntax checks, build, and `git diff --check`.

Production read-only checks after migration:

- Existing approved Admin can call the API; zero budget records are present (no seeded data).
- Existing approved Active Member receives a permission rejection and sees no base-table financial entries.
- Anonymous API execution is denied. All four public tables have RLS enabled; direct browser inserts are revoked.
- Existing workspace checksum is unchanged: `06bc1e67ab4dab2a7f949cdf097bf06f`.

Production signed-out browser checks passed at 1440px and 390px: sign-in form, loaded auth SDK/budget modules, private-navigation gate, password-reset dialog, Escape dismissal, no page errors or page-width overflow. Still required: a real authorized account must create/import the reviewed budget and confirm refresh, logout/login, and a second-device readback. No claim is made that this authenticated live workflow was tested. The project has no separate lint/TypeScript configuration; JS syntax and automated tests were run instead.

## Deployment

The annual-budget migration is already applied; do not rerun it manually against the same production project. No Vercel environment changes were necessary. The frontend was deployed with the official Vercel CLI after interactive login approval. Both new JS files are included by the production build. `.vercelignore` excludes private transfer files, spreadsheets, tests, migrations, and documentation from upload.

The previously approved secure-workspace release's final restriction migration was applied after verifying that Vercel serves the matching frontend; see `docs/secure-workspace-rollout.md`. Budget data is not stored in the old whole-workspace JSON.

Modified/new files for this feature:

- `.gitignore`
- `.vercelignore`
- `ao-command-web/app.js`
- `ao-command-web/index.html`
- `ao-command-web/styles.css`
- `ao-command-web/budget-core.js`
- `ao-command-web/budget-ui.js`
- `package.json`
- `scripts/build-sites.mjs`
- `scripts/prepare-budget-transfer.py`
- `scripts/test-budget-browser.mjs`
- `supabase/migrations/20261107012252_annual_executive_budget.sql`
- `tests/budget.test.mjs`
- `tests/database/workspace-security.test.mjs`
- `docs/annual-budget.md`
