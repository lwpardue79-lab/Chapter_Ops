# AO Command — MVP Setup Guide

This package contains an import-ready workbook and its Google Apps Script. It is designed for fraternities, sororities, clubs, and student organizations, with neutral, professional operations language.

## 1. Create the Google Sheet

1. Upload `AO_Command_MVP.xlsx` to Google Drive.
2. Open it with Google Sheets, then choose **File → Save as Google Sheets**.
3. Confirm these tabs exist: Members, Events, Attendance, Dues, Reimbursements, Dashboard, Settings, and Weekly_Report.
4. Replace the starter records, but keep the header names unchanged.

## 2. Install Apps Script

1. In the Google Sheet, choose **Extensions → Apps Script**.
2. Replace the starter code with the contents of `AO_Command.gs`.
3. Save the project as **AO Command**.
4. Run `onOpen` once and approve the requested Google permissions.
5. Reload the spreadsheet. The **AO Command** menu will appear.
6. Run **AO Command → Run Trial Setup Check** before entering real data.

The first setup check, email, or form creation may ask for Google authorization. Verify with your own email before using the executive list.

## 3. Configure Settings

Use one row per setting:

| setting_name | example setting_value |
|---|---|
| chapter_name | Alpha Example Chapter |
| exec_email_list | president@example.org, treasurer@example.org |
| attendance_threshold | 80% |
| report_day | Monday |
| report_sender_name | Alpha Example Operations |

`report_day` is informational in the MVP. To automate the report, add a weekly time-driven trigger for `emailExecReport` in Apps Script under **Triggers**.

## 4. Dashboard formulas

The workbook already includes formulas. Google Sheets equivalents include:

- Active members: `=COUNTIF(Members!J2:J200,"Active")`
- Associate/new members: `=COUNTIFS(Members!F2:F200,"Associate/New Member",Members!J2:J200,"Active")`
- Dues owed: `=SUM(Dues!D2:D200)`
- Dues collected: `=SUM(Dues!E2:E200)`
- Outstanding balance: `=SUM(Dues!F2:F200)`
- Overdue count: `=COUNTIFS(Dues!F2:F200,">0",Dues!G2:G200,"<"&TODAY())`
- Pending reimbursements: `=COUNTIF(Reimbursements!I2:I200,"Pending")`
- Approved unpaid: `=COUNTIFS(Reimbursements!I2:I200,"Approved",Reimbursements!J2:J200,"Unpaid")`
- Upcoming events in seven days: `=COUNTIFS(Events!C2:C200,">="&TODAY(),Events!C2:C200,"<="&TODAY()+7)`

Use **AO Command → Refresh Command Center** as the authoritative refresh. It calculates required-event attendance by joining Attendance.event_id to Events.event_id and only includes events marked required.

## 5. Attendance form and QR check-in

### Fastest setup

1. Choose **AO Command → Create Attendance Form Link**.
2. The script creates a Google Form with event ID, member ID, and attendance status, and links its responses to the spreadsheet.
3. The script also installs a spreadsheet form-submit trigger that maps each new response into Attendance.
4. Open the returned form link and submit a test response.
5. Confirm a new row appears in Attendance. If it does not, open **Extensions → Apps Script → Triggers** and verify `handleAttendanceFormSubmit` is authorized and active.

The Google Form event dropdown contains a readable value such as `E006 — Chapter Operations Meeting`. The trigger retains the leading event ID (`E006`), uses the form timestamp as `check_in_time`, and creates a unique attendance ID.

If the same member submits the form twice for the same event, the script updates the existing Attendance row instead of counting the person twice.

### QR code

Copy the form link into a trusted QR-code generator, download the QR image, and display it at the event check-in location. Rotate or replace the link if it is shared beyond the intended audience. The MVP records submissions; it does not verify physical location or identity.

## 6. Weekly workflow

1. Run **Trial Setup Check** if this is a new copy or a new officer is using it.
2. Update Events and Attendance.
3. Update dues payments and reimbursement decisions.
4. Choose **Refresh Command Center**.
5. Choose **Generate Weekly Exec Report** and review the output.
6. Resolve any sensitive notes before sending.
7. Choose **Email Exec Report**.

Follow-ups should be private, supportive, and based on accurate records. Limit sheet access to authorized officers and follow campus and organizational privacy policies.

## 7. Data conventions

- Keep IDs unique and stable: `M001`, `E001`, `A001`, `D001`, `R001`.
- Use `Active` / `Inactive` for active_status.
- Use `Member`, `Associate/New Member`, `Advisor`, or `Alumni` for status.
- Mark Events.required as `Yes` or `No`.
- Attendance status is `Present`, `Late`, or `Absent`.
- Approved absences may use excuse_status `Approved`; the current attendance-rate metric still reports recorded attendance and does not silently remove records.
- Dues balance is `amount_owed - amount_paid`.
- Store receipt files in a restricted Drive folder and paste their links into receipt_link.

## 8. Sellable deployment checklist

- Duplicate a clean master copy for each organization.
- Replace all starter data and example email addresses.
- Protect Settings, Dashboard formulas, and report formatting.
- Grant edit access only to designated officers; give others form-only access.
- Add your support contact and a short privacy statement.
- Verify menu functions with a non-production copy.
- Document data retention and officer-transition procedures.

## 9. Future web-app path

- **Supabase:** Postgres tables matching the eight tabs; Row Level Security by organization and officer role; Supabase Auth; Storage for receipts; audit tables for financial changes.
- **React:** responsive dashboard, event management, mobile check-in, member self-service profile, reimbursement workflow, accessible reporting, and organization-level theming.
- **Stripe:** Checkout or Payment Links for dues, webhook-based payment reconciliation, payment-plan schedules, refunds, and receipts. Never store card data directly.
- **Multi-tenant SaaS:** organizations, memberships, roles, subscription plans, onboarding, data export, backups, and admin support tools.
- **Operational upgrades:** expiring event QR tokens, duplicate check-in prevention, automated reminders, calendar sync, receipt OCR, and scheduled executive reports.

Before a commercial launch, obtain legal review for privacy, payment handling, tax treatment, campus rules, and any organization-specific policies.
