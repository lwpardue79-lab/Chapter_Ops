# ChapterOps Lite — Start Here for This Weekend

Use this file as your trial-run command center. The goal is not to make the system perfect on day one. The goal is to prove that you and the treasurer can manage members, events, attendance, dues, reimbursements, and an executive report from one clean operating file.

## What to have ready before you meet

- A Google Drive folder named `ChapterOps Lite Trial`.
- A Google Sheet created from `outputs/chapterops-lite/ChapterOps_Lite_MVP.xlsx`.
- The Apps Script installed from `outputs/chapterops-lite/ChapterOps_Lite.gs`.
- Your treasurer’s email added to `Settings.exec_email_list`.
- 5–10 real members entered into Members for the trial.
- 1 real upcoming event entered into Events.
- A few real or mock dues rows entered into Dues.
- One mock reimbursement row entered into Reimbursements.

## 30-minute treasurer walkthrough

### 0–5 minutes: Explain the why

Say:

“This is ChapterOps Lite. It replaces scattered spreadsheets and manual reminders with one operating dashboard. It is not a social ranking tool. It is just for operations: roster, events, attendance, dues, reimbursements, and weekly executive reporting.”

Show these tabs:

- Members = roster source of truth
- Events = calendar and required/optional event list
- Attendance = check-in log
- Dues = treasurer payment tracker
- Reimbursements = request tracker
- Dashboard = current snapshot
- Weekly_Report = executive summary
- Settings = chapter-level configuration

### 5–12 minutes: Treasurer setup

In Settings:

- Set `chapter_name`.
- Set `exec_email_list` to your email plus the treasurer’s email first.
- Keep `attendance_threshold` at `80%` for the test unless you want a different standard.
- Set `report_sender_name`.

In Dues:

- Confirm `amount_owed`, `amount_paid`, and `balance`.
- Use `Paid`, `Partial`, `Unpaid`, or `Overdue`.
- Add notes only when they help the next officer understand the record.

### 12–20 minutes: Attendance demo

1. Go to **ChapterOps → Run Trial Setup Check**.
2. Fix anything it flags.
3. Go to **ChapterOps → Create Attendance Form Link**.
4. Submit one test check-in together.
5. Confirm the new row appears in Attendance.
6. Convert the form link into a QR code if you are going to test live check-in.

Important: if someone submits twice for the same event, the script updates their existing row instead of double-counting them.

### 20–27 minutes: Dashboard and report

1. Go to **ChapterOps → Refresh Dashboard**.
2. Review the key metrics.
3. Go to **ChapterOps → Generate Weekly Exec Report**.
4. Read the action items out loud.
5. If everything looks right, use **ChapterOps → Email Exec Report**.

For the first test, send only to yourself and the treasurer.

### 27–30 minutes: Decide the pilot scope

Pick one weekend or one week:

- One real event check-in
- One dues update session
- One reimbursement update
- One executive report

Do not roll it out to everyone until those four pieces work once.

## What to say if someone asks what this is

“It’s a lightweight operations dashboard for the chapter. It helps officers keep clean records for attendance, dues, reimbursements, events, and weekly reporting. It is designed to reduce manual follow-up and make officer transitions easier.”

## What not to say or build into it

Avoid anything that sounds like personal comparison, public callouts, status games, or member-vs-member scoring. Keep the framing on operations, accountability, communication, and accurate records.

## First weekend trial checklist

- [ ] Import workbook into Google Sheets.
- [ ] Install Apps Script.
- [ ] Reload sheet and confirm the ChapterOps menu appears.
- [ ] Run Trial Setup Check.
- [ ] Replace sample Settings.
- [ ] Add a small real member sample.
- [ ] Add one real event.
- [ ] Create attendance form link.
- [ ] Submit test attendance.
- [ ] Refresh Dashboard.
- [ ] Generate Weekly Exec Report.
- [ ] Email report to yourself and treasurer.
- [ ] Write down any confusing parts immediately after the trial.

## Notes to collect during the trial

Use these questions after the meeting:

1. What did the treasurer understand immediately?
2. What felt confusing?
3. Which columns need examples?
4. Did the attendance form work smoothly on a phone?
5. Were dues balances easy to explain?
6. Would this save officer time every week?
7. What would make it worth paying for?
