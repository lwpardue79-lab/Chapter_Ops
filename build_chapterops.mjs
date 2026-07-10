import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outDir = 'outputs/chapterops-lite';
await fs.mkdir(outDir, { recursive: true });
const wb = Workbook.create();
const names = ['Members','Events','Attendance','Dues','Reimbursements','Dashboard','Settings','Weekly_Report'];
const sheets = Object.fromEntries(names.map(n => [n, wb.worksheets.add(n)]));

const navy = '#17324D', blue = '#2563EB', lightBlue = '#EAF2FF', green = '#DCFCE7', amber = '#FEF3C7', red = '#FEE2E2', gray = '#64748B', pale = '#F8FAFC', white = '#FFFFFF';
const headers = {
  Members:['member_id','first_name','last_name','email','phone','status','class_year','role','join_date','active_status','notes'],
  Events:['event_id','event_name','event_date','event_time','event_category','required','location','created_by','notes'],
  Attendance:['attendance_id','event_id','member_id','check_in_time','attendance_status','excuse_status','notes'],
  Dues:['dues_id','member_id','semester','amount_owed','amount_paid','balance','due_date','payment_status','payment_plan','notes'],
  Reimbursements:['reimbursement_id','member_id','request_date','amount','budget_category','event_id','receipt_link','description','approval_status','paid_status','notes'],
  Settings:['setting_name','setting_value']
};
const members = [
 ['M001','Avery','Johnson','avery@example.org','555-0101','Member',2027,'President',new Date('2024-08-20'),'Active',''],
 ['M002','Jordan','Lee','jordan@example.org','555-0102','Member',2026,'Treasurer',new Date('2023-08-22'),'Active',''],
 ['M003','Cameron','Patel','cameron@example.org','555-0103','Member',2028,'Secretary',new Date('2025-01-15'),'Active',''],
 ['M004','Taylor','Morgan','taylor@example.org','555-0104','Associate/New Member',2029,'Member',new Date('2026-01-20'),'Active',''],
 ['M005','Riley','Nguyen','riley@example.org','555-0105','Member',2027,'Member',new Date('2024-08-20'),'Active',''],
 ['M006','Casey','Brown','casey@example.org','555-0106','Associate/New Member',2029,'Member',new Date('2026-01-20'),'Active',''],
 ['M007','Morgan','Garcia','morgan@example.org','555-0107','Member',2026,'Member',new Date('2023-08-22'),'Inactive','Study abroad'],
 ['M008','Sam','Wilson','sam@example.org','555-0108','Member',2028,'Community Service Chair',new Date('2025-01-15'),'Active','']
];
const events = [
 ['E001','Chapter Operations Meeting',new Date('2026-06-10'),'7:00 PM','Operations','Yes','Student Center 201','M003',''],
 ['E002','Community Service Project',new Date('2026-06-17'),'9:00 AM','Service','Yes','Riverside Park','M008','Wear closed-toe shoes'],
 ['E003','Financial Planning Workshop',new Date('2026-06-24'),'6:30 PM','Education','Yes','Library 104','M002',''],
 ['E004','Member Social',new Date('2026-06-27'),'7:30 PM','Social','No','Campus Green','M005',''],
 ['E005','Executive Planning Session',new Date('2026-07-02'),'5:00 PM','Operations','No','Student Center 110','M001',''],
 ['E006','Chapter Operations Meeting',new Date('2026-07-05'),'7:00 PM','Operations','Yes','Student Center 201','M003','']
];
const attendance = [
 ['A001','E001','M001',new Date('2026-06-10T19:01:00'),'Present','Not Needed',''],['A002','E001','M002',new Date('2026-06-10T19:02:00'),'Present','Not Needed',''],['A003','E001','M003',new Date('2026-06-10T19:00:00'),'Present','Not Needed',''],['A004','E001','M004',null,'Absent','Approved','Academic conflict'],['A005','E001','M005',new Date('2026-06-10T19:05:00'),'Present','Not Needed',''],['A006','E001','M006',null,'Absent','Pending',''],['A007','E001','M008',new Date('2026-06-10T19:03:00'),'Present','Not Needed',''],
 ['A008','E002','M001',new Date('2026-06-17T08:55:00'),'Present','Not Needed',''],['A009','E002','M002',new Date('2026-06-17T08:58:00'),'Present','Not Needed',''],['A010','E002','M003',null,'Absent','Approved','Work conflict'],['A011','E002','M004',new Date('2026-06-17T09:04:00'),'Present','Not Needed',''],['A012','E002','M005',new Date('2026-06-17T09:00:00'),'Present','Not Needed',''],['A013','E002','M006',null,'Absent','Not Requested',''],['A014','E002','M008',new Date('2026-06-17T08:50:00'),'Present','Not Needed',''],
 ['A015','E003','M001',new Date('2026-06-24T18:25:00'),'Present','Not Needed',''],['A016','E003','M002',new Date('2026-06-24T18:20:00'),'Present','Not Needed',''],['A017','E003','M003',new Date('2026-06-24T18:28:00'),'Present','Not Needed',''],['A018','E003','M004',new Date('2026-06-24T18:32:00'),'Late','Not Needed',''],['A019','E003','M005',null,'Absent','Not Requested',''],['A020','E003','M006',new Date('2026-06-24T18:29:00'),'Present','Not Needed',''],['A021','E003','M008',new Date('2026-06-24T18:27:00'),'Present','Not Needed','']
];
const dues = [
 ['D001','M001','Fall 2026',450,450,null,new Date('2026-06-15'),'Paid','No',''],['D002','M002','Fall 2026',450,300,null,new Date('2026-06-15'),'Partial','Yes','Two installments'],['D003','M003','Fall 2026',450,0,null,new Date('2026-06-25'),'Overdue','No',''],['D004','M004','Fall 2026',350,350,null,new Date('2026-07-15'),'Paid','No',''],['D005','M005','Fall 2026',450,200,null,new Date('2026-06-20'),'Overdue','Yes',''],['D006','M006','Fall 2026',350,0,null,new Date('2026-07-15'),'Unpaid','No',''],['D007','M008','Fall 2026',450,450,null,new Date('2026-06-15'),'Paid','No','']
];
const reimbursements = [
 ['R001','M008',new Date('2026-06-18'),84.25,'Service','E002','https://example.org/receipt-1','Project supplies','Approved','Paid',''],
 ['R002','M003',new Date('2026-06-25'),32.10,'Operations','E003','https://example.org/receipt-2','Workshop materials','Pending','Unpaid',''],
 ['R003','M005',new Date('2026-06-28'),61.75,'Member Events','E004','https://example.org/receipt-3','Event refreshments','Approved','Unpaid','']
];

function setupData(name, rows, widths) {
  const s=sheets[name], h=headers[name];
  s.getRangeByIndexes(0,0,1,h.length).values=[h];
  if(rows.length) s.getRangeByIndexes(1,0,rows.length,h.length).values=rows;
  const used=s.getRangeByIndexes(0,0,Math.max(rows.length+1,2),h.length);
  used.format.font={name:'Arial',size:10,color:'#0F172A'};
  const hr=s.getRangeByIndexes(0,0,1,h.length); hr.format.fill=navy; hr.format.font={name:'Arial',size:10,bold:true,color:white}; hr.format.rowHeight=28; hr.format.wrapText=true;
  widths.forEach((w,i)=>s.getRangeByIndexes(0,i,Math.max(rows.length+1,2),1).format.columnWidth=w);
  s.freezePanes.freezeRows(1); s.showGridLines=false;
  used.format.borders={insideHorizontal:{style:'thin',color:'#E2E8F0'},bottom:{style:'thin',color:'#CBD5E1'}};
  s.tables.add(`A1:${String.fromCharCode(64+h.length)}${rows.length+1}`,true,`${name}Table`).style='TableStyleMedium2';
}

setupData('Members',members,[14,14,16,26,15,22,12,23,14,14,28]);
setupData('Events',events,[13,28,14,13,18,11,24,15,30]);
setupData('Attendance',attendance,[15,13,13,21,18,18,28]);
setupData('Dues',dues,[13,13,16,15,15,15,14,18,15,28]);
setupData('Reimbursements',reimbursements,[20,13,14,14,20,13,28,30,18,15,28]);
sheets.Members.getRange('I2:I200').setNumberFormat('yyyy-mm-dd');
sheets.Events.getRange('C2:C200').setNumberFormat('yyyy-mm-dd');
sheets.Attendance.getRange('D2:D500').setNumberFormat('yyyy-mm-dd h:mm AM/PM');
sheets.Dues.getRange('D2:F200').setNumberFormat('$#,##0.00'); sheets.Dues.getRange('G2:G200').setNumberFormat('yyyy-mm-dd');
sheets.Dues.getRange('F2').formulas=[['=D2-E2']]; sheets.Dues.getRange('F2:F8').fillDown();
sheets.Reimbursements.getRange('C2:C200').setNumberFormat('yyyy-mm-dd'); sheets.Reimbursements.getRange('D2:D200').setNumberFormat('$#,##0.00');

// Validations
sheets.Members.getRange('F2:F200').dataValidation={rule:{type:'list',values:['Member','Associate/New Member','Advisor','Alumni']}};
sheets.Members.getRange('J2:J200').dataValidation={rule:{type:'list',values:['Active','Inactive']}};
sheets.Events.getRange('F2:F200').dataValidation={rule:{type:'list',values:['Yes','No']}};
sheets.Attendance.getRange('E2:E500').dataValidation={rule:{type:'list',values:['Present','Late','Absent']}};
sheets.Attendance.getRange('F2:F500').dataValidation={rule:{type:'list',values:['Not Needed','Not Requested','Pending','Approved','Denied']}};
sheets.Dues.getRange('H2:H200').dataValidation={rule:{type:'list',values:['Paid','Partial','Unpaid','Overdue']}};
sheets.Dues.getRange('I2:I200').dataValidation={rule:{type:'list',values:['Yes','No']}};
sheets.Reimbursements.getRange('I2:I200').dataValidation={rule:{type:'list',values:['Pending','Approved','Denied']}};
sheets.Reimbursements.getRange('J2:J200').dataValidation={rule:{type:'list',values:['Paid','Unpaid']}};

// Conditional flags
sheets.Dues.getRange('F2:F200').conditionalFormats.add('cellIs',{operator:'greaterThan',formula:0,format:{fill:red,font:{color:'#991B1B',bold:true}}});
sheets.Reimbursements.getRange('I2:I200').conditionalFormats.add('containsText',{text:'Pending',format:{fill:amber,font:{color:'#92400E'}}});

// Settings
const settings=[['chapter_name','Demo Chapter / Student Organization'],['exec_email_list','president@example.org, treasurer@example.org, secretary@example.org'],['attendance_threshold',0.8],['report_day','Monday'],['report_sender_name','ChapterOps Lite']];
setupData('Settings',settings,[28,68]); sheets.Settings.getRange('B4').setNumberFormat('0%');

// Dashboard
const d=sheets.Dashboard; d.showGridLines=false; d.getRange('A1:F1').merge(); d.getRange('A1').values=[['ChapterOps Lite Dashboard']];
d.getRange('A1:F1').format.fill=navy; d.getRange('A1:F1').format.font={name:'Arial',size:18,bold:true,color:white}; d.getRange('A1:F1').format.rowHeight=40;
d.getRange('A2:F2').merge(); d.getRange('A2').values=[['Live operating snapshot • Use the ChapterOps menu in Google Sheets to refresh']]; d.getRange('A2:F2').format.font={name:'Arial',size:10,color:gray};
const metrics=[
 ['Membership','Total active members',"=COUNTIF('Members'!$J$2:$J$200,\"Active\")",'people'],
 ['Membership','Total associate/new members',"=COUNTIFS('Members'!$F$2:$F$200,\"Associate/New Member\",'Members'!$J$2:$J$200,\"Active\")",'people'],
 ['Attendance','Attendance rate for required events',"=IFERROR((COUNTIFS('Attendance'!$E$2:$E$500,\"Present\",'Attendance'!$B$2:$B$500,\"<>\")+COUNTIFS('Attendance'!$E$2:$E$500,\"Late\",'Attendance'!$B$2:$B$500,\"<>\"))/COUNTIF('Attendance'!$B$2:$B$500,\"<>\"),0)",'percent'],
 ['Attendance','Members under attendance threshold',"=COUNTIF($C$25:$C$31,\"<\"&'Settings'!$B$4)",'people'],
 ['Finance','Total dues owed',"=SUM('Dues'!$D$2:$D$200)",'currency'],
 ['Finance','Total dues collected',"=SUM('Dues'!$E$2:$E$200)",'currency'],
 ['Finance','Outstanding dues balance',"=SUM('Dues'!$F$2:$F$200)",'currency'],
 ['Finance','Overdue dues count',"=COUNTIFS('Dues'!$F$2:$F$200,\">0\",'Dues'!$G$2:$G$200,\"<\"&TODAY())",'count'],
 ['Reimbursements','Pending reimbursements',"=COUNTIF('Reimbursements'!$I$2:$I$200,\"Pending\")",'count'],
 ['Reimbursements','Approved unpaid reimbursements',"=COUNTIFS('Reimbursements'!$I$2:$I$200,\"Approved\",'Reimbursements'!$J$2:$J$200,\"Unpaid\")",'count'],
 ['Events','Upcoming events this week',"=COUNTIFS('Events'!$C$2:$C$200,\">=\"&TODAY(),'Events'!$C$2:$C$200,\"<=\"&TODAY()+7)",'count']
];
d.getRange('A4:D4').values=[['Category','Metric','Value','Format']]; d.getRange('A4:D4').format.fill=blue; d.getRange('A4:D4').format.font={bold:true,color:white};
d.getRange('A5:D15').values=metrics.map(x=>[x[0],x[1],null,x[3]]); d.getRange('C5:C15').formulas=metrics.map(x=>[x[2]]);
d.getRange('C7').setNumberFormat('0.0%'); d.getRange('C9:C11').setNumberFormat('$#,##0.00');
d.getRange('A4:D15').format.borders={preset:'all',style:'thin',color:'#D8E1EA'}; d.getRange('A5:D15').format.fill=pale; d.getRange('C5:C15').format.font={bold:true,color:navy,size:12};
d.getRange('A17:F17').merge(); d.getRange('A17').values=[['Members needing attendance follow-up']]; d.getRange('A17:F17').format.fill=navy; d.getRange('A17:F17').format.font={bold:true,color:white};
d.getRange('A18:D18').values=[['member_id','member_name','required attendance rate','follow_up']]; d.getRange('A18:D18').format.fill=lightBlue; d.getRange('A18:D18').format.font={bold:true,color:navy};
d.getRange('A19:D19').values=[['Run “Refresh Dashboard” in Google Sheets to populate this list.','','','']];
d.getRange('A24:C24').values=[['Attendance calculation helper','Member','Rate']]; d.getRange('A24:C24').format.fill=lightBlue; d.getRange('A24:C24').format.font={bold:true,color:navy};
const activeMembers=members.filter(m=>m[9]==='Active');
d.getRange('A25:B31').values=activeMembers.map(m=>[m[0],m[1]+' '+m[2]]);
d.getRange('C25:C31').formulas=activeMembers.map((m,i)=>[`=IFERROR((COUNTIFS('Attendance'!$C$2:$C$500,A${25+i},'Attendance'!$E$2:$E$500,\"Present\")+COUNTIFS('Attendance'!$C$2:$C$500,A${25+i},'Attendance'!$E$2:$E$500,\"Late\"))/COUNTIF('Attendance'!$C$2:$C$500,A${25+i}),0)`]);
d.getRange('C25:C31').setNumberFormat('0.0%');
d.getRange('A1:A30').format.columnWidth=22; d.getRange('B1:B30').format.columnWidth=38; d.getRange('C1:C30').format.columnWidth=20; d.getRange('D1:D30').format.columnWidth=18; d.freezePanes.freezeRows(2);

// Weekly report template with sample generated content
const w=sheets.Weekly_Report; w.showGridLines=false; w.getRange('A1:F1').merge(); w.getRange('A1').values=[['Weekly Executive Report']]; w.getRange('A1:F1').format.fill=navy; w.getRange('A1:F1').format.font={name:'Arial',size:18,bold:true,color:white}; w.getRange('A1:F1').format.rowHeight=40;
w.getRange('A2:F2').merge(); w.getRange('A2').values=[['Demo Chapter / Student Organization • Week ending 2026-06-30']]; w.getRange('A2:F2').format.font={color:gray,italic:true};
const reportRows=[
 ['ATTENDANCE SUMMARY','','','','',''],['Required-event attendance rate','76.2%','','','',''],['Recorded check-ins / records','16 / 21','','','',''],
 ['MEMBERS NEEDING FOLLOW-UP','','','','',''],['M004','Taylor Morgan','66.7%','Review attendance record','',''],['M005','Riley Nguyen','66.7%','Check in about recent absence','',''],['M006','Casey Brown','33.3%','Offer support and confirm future availability','',''],
 ['DUES COLLECTION SUMMARY','','','','',''],['Total owed','$2,950.00','Collected','$1,750.00','Outstanding','$1,200.00'],
 ['OVERDUE BALANCES','','','','',''],['M002','Jordan Lee','$150.00','Due 2026-06-15','',''],['M003','Cameron Patel','$450.00','Due 2026-06-25','',''],['M005','Riley Nguyen','$250.00','Due 2026-06-20','',''],
 ['REIMBURSEMENT SUMMARY','','','','',''],['Pending requests','1','Approved unpaid','1','Unpaid total','$93.85'],
 ['UPCOMING EVENTS','','','','',''],['2026-07-02','Executive Planning Session','5:00 PM','Student Center 110','',''],['2026-07-05','Chapter Operations Meeting','7:00 PM','Student Center 201','Required',''],
 ['ACTION ITEMS','','','','',''],['1','Follow up privately with members below the attendance threshold.','','','',''],['2','Contact members with overdue balances and document payment plans.','','','',''],['3','Review pending reimbursement and process approved unpaid request.','','','','']
];
w.getRangeByIndexes(3,0,reportRows.length,6).values=reportRows;
for(const r of [4,7,11,13,17,19,22]) { w.getRange(`A${r}:F${r}`).format.fill=navy; w.getRange(`A${r}:F${r}`).format.font={bold:true,color:white}; }
w.getRange('A1:A26').format.columnWidth=24; w.getRange('B1:B26').format.columnWidth=42; w.getRange('C1:C26').format.columnWidth=18; w.getRange('D1:D26').format.columnWidth=36; w.getRange('E1:F26').format.columnWidth=18; w.getRange('A4:F25').format.wrapText=true;

// Friendly alternating section and formula legend
d.getRange('F4:F9').values=[['Formula examples'],['Active members: COUNTIF'],['Associate/new members: COUNTIFS'],['Attendance: COUNTIFS / total records'],['Dues: SUM'],['Upcoming: COUNTIFS + TODAY']];
d.getRange('F4:F9').format.fill=lightBlue; d.getRange('F4:F4').format.font={bold:true,color:navy}; d.getRange('F1:F30').format.columnWidth=31;

const output=await SpreadsheetFile.exportXlsx(wb); await output.save(`${outDir}/ChapterOps_Lite_MVP.xlsx`);
const inspect=await wb.inspect({kind:'table',range:'Dashboard!A1:F20',include:'values,formulas',tableMaxRows:20,tableMaxCols:6,maxChars:7000}); console.log(inspect.ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:100},summary:'formula errors',maxChars:3000}); console.log(errors.ndjson);
for (const n of names) { const blob=await wb.render({sheetName:n,autoCrop:'all',scale:0.8,format:'png'}); await fs.writeFile(`${outDir}/preview_${n}.png`,new Uint8Array(await blob.arrayBuffer())); }
