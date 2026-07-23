/** AO Command — Google Apps Script for the companion workbook. */
const CO = {
  sheets: { members:'Members', events:'Events', attendance:'Attendance', dues:'Dues', reimbursements:'Reimbursements', dashboard:'Dashboard', settings:'Settings', report:'Weekly_Report' },
  dashboardStartRow: 5,
  followUpStartRow: 19
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('AO Command')
    .addItem('Run Trial Setup Check','runTrialSetupCheck')
    .addSeparator()
    .addItem('Generate Weekly Exec Report','generateWeeklyExecReport')
    .addItem('Refresh Command Center','refreshDashboard')
    .addItem('Email Exec Report','emailExecReport')
    .addSeparator()
    .addItem('Create Attendance Form Link','createAttendanceFormLink')
    .addToUi();
}

function runTrialSetupCheck() {
  const ss=SpreadsheetApp.getActive();
  const required={
    Members:['member_id','first_name','last_name','email','phone','status','class_year','role','join_date','active_status','notes'],
    Events:['event_id','event_name','event_date','event_time','event_category','required','location','created_by','notes'],
    Attendance:['attendance_id','event_id','member_id','check_in_time','attendance_status','excuse_status','notes'],
    Dues:['dues_id','member_id','semester','amount_owed','amount_paid','balance','due_date','payment_status','payment_plan','notes'],
    Reimbursements:['reimbursement_id','member_id','request_date','amount','budget_category','event_id','receipt_link','description','approval_status','paid_status','notes'],
    Dashboard:[],
    Settings:['setting_name','setting_value'],
    Weekly_Report:[]
  };
  const issues=[];
  Object.keys(required).forEach(name=>{
    const sh=ss.getSheetByName(name);
    if(!sh) { issues.push('Missing tab: '+name); return; }
    if(required[name].length) {
      const headers=sh.getRange(1,1,1,required[name].length).getValues()[0].map(String);
      required[name].forEach((h,i)=>{ if(headers[i]!==h) issues.push(name+' header '+(i+1)+' should be "'+h+'" but is "'+headers[i]+'"'); });
    }
  });
  const s=settings_();
  ['chapter_name','exec_email_list','attendance_threshold','report_day','report_sender_name'].forEach(k=>{ if(!s[k]) issues.push('Settings missing value for '+k); });
  const activeMembers=getData_(CO.sheets.members).filter(m=>String(m.active_status)==='Active').length;
  const eventCount=getData_(CO.sheets.events).length;
  const formUrl=PropertiesService.getDocumentProperties().getProperty('attendance_form_url');
  const msg=issues.length
    ? 'Setup check found items to fix:\n\n'+issues.join('\n')
    : 'Setup check passed.\n\nActive members: '+activeMembers+'\nEvents loaded: '+eventCount+'\nAttendance form: '+(formUrl||'not created yet')+'\n\nNext: run Refresh Command Center, then Generate Weekly Exec Report.';
  SpreadsheetApp.getUi().alert('AO Command setup check', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function getData_(sheetName) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw new Error('Missing sheet: '+sheetName);
  const values=sh.getDataRange().getValues();
  if (!values.length) return [];
  const headers=values.shift().map(String);
  return values.filter(r=>r.some(v=>v!=='')) .map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
}

function settings_() {
  return Object.fromEntries(getData_(CO.sheets.settings).map(r=>[String(r.setting_name).trim(),r.setting_value]));
}

function memberMap_() {
  return Object.fromEntries(getData_(CO.sheets.members).map(m=>[String(m.member_id),m]));
}

function isRequiredEvent_(event) { return String(event.required).toLowerCase()==='yes'; }
function dateOnly_(v) { const d=new Date(v); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function money_(v) { return '$'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pct_(v) { return (Number(v||0)*100).toFixed(1)+'%'; }

function attendanceStats_() {
  const members=getData_(CO.sheets.members).filter(m=>String(m.active_status)==='Active');
  const events=Object.fromEntries(getData_(CO.sheets.events).map(e=>[String(e.event_id),e]));
  const requiredAttendance=getData_(CO.sheets.attendance).filter(a=>events[String(a.event_id)] && isRequiredEvent_(events[String(a.event_id)]));
  const byMember={}; members.forEach(m=>byMember[String(m.member_id)]={member:m,attended:0,total:0,rate:0});
  requiredAttendance.forEach(a=>{ const x=byMember[String(a.member_id)]; if(!x) return; x.total++; if(['Present','Late'].includes(String(a.attendance_status))) x.attended++; });
  Object.values(byMember).forEach(x=>x.rate=x.total ? x.attended/x.total : 0);
  const attended=requiredAttendance.filter(a=>['Present','Late'].includes(String(a.attendance_status))).length;
  return { rate: requiredAttendance.length ? attended/requiredAttendance.length : 0, attended, total:requiredAttendance.length, byMember };
}

function membersUnderAttendanceThreshold() {
  const threshold=Number(settings_().attendance_threshold||0.8);
  return Object.values(attendanceStats_().byMember).filter(x=>x.total>0 && x.rate<threshold);
}

function membersWithOverdueDues() {
  const today=dateOnly_(new Date());
  return getData_(CO.sheets.dues).filter(d=>Number(d.balance)>0 && d.due_date && dateOnly_(d.due_date)<today);
}

function calculateDashboardMetrics_() {
  const members=getData_(CO.sheets.members), dues=getData_(CO.sheets.dues), reimb=getData_(CO.sheets.reimbursements), events=getData_(CO.sheets.events);
  const attendance=attendanceStats_(), today=dateOnly_(new Date()), week=new Date(today); week.setDate(week.getDate()+7);
  return [
    members.filter(m=>String(m.active_status)==='Active').length,
    members.filter(m=>String(m.active_status)==='Active' && String(m.status)==='Associate/New Member').length,
    attendance.rate,
    membersUnderAttendanceThreshold().length,
    dues.reduce((s,d)=>s+Number(d.amount_owed||0),0),
    dues.reduce((s,d)=>s+Number(d.amount_paid||0),0),
    dues.reduce((s,d)=>s+Number(d.balance||0),0),
    membersWithOverdueDues().length,
    reimb.filter(r=>String(r.approval_status)==='Pending').length,
    reimb.filter(r=>String(r.approval_status)==='Approved' && String(r.paid_status)==='Unpaid').length,
    events.filter(e=>{const d=dateOnly_(e.event_date); return d>=today && d<=week;}).length
  ];
}

function refreshDashboard() {
  const sh=SpreadsheetApp.getActive().getSheetByName(CO.sheets.dashboard);
  const metrics=calculateDashboardMetrics_();
  sh.getRange(CO.dashboardStartRow,3,metrics.length,1).setValues(metrics.map(v=>[v]));
  sh.getRange(7,3).setNumberFormat('0.0%'); sh.getRange(9,3,3,1).setNumberFormat('$#,##0.00');
  sh.getRange(CO.followUpStartRow,1,Math.max(sh.getMaxRows()-CO.followUpStartRow+1,1),4).clearContent();
  const rows=membersUnderAttendanceThreshold().map(x=>[x.member.member_id,x.member.first_name+' '+x.member.last_name,x.rate,'Follow up privately']);
  if(rows.length) { sh.getRange(CO.followUpStartRow,1,rows.length,4).setValues(rows); sh.getRange(CO.followUpStartRow,3,rows.length,1).setNumberFormat('0.0%'); }
  SpreadsheetApp.getActive().toast('Dashboard refreshed.','AO Command',4);
}

function generateWeeklyExecReport() {
  refreshDashboard();
  const ss=SpreadsheetApp.getActive(), sh=ss.getSheetByName(CO.sheets.report), settings=settings_(), people=memberMap_();
  const attendance=attendanceStats_(), follow=membersUnderAttendanceThreshold(), dues=getData_(CO.sheets.dues), overdue=membersWithOverdueDues(), reimb=getData_(CO.sheets.reimbursements), events=getData_(CO.sheets.events);
  const today=dateOnly_(new Date()), week=new Date(today); week.setDate(week.getDate()+7);
  const upcoming=events.filter(e=>{const d=dateOnly_(e.event_date); return d>=today && d<=week;}).sort((a,b)=>new Date(a.event_date)-new Date(b.event_date));
  const rows=[];
  const section=t=>rows.push([t,'','','','','']);
  section('ATTENDANCE SUMMARY'); rows.push(['Required-event attendance rate',pct_(attendance.rate),'Recorded check-ins / records',attendance.attended+' / '+attendance.total,'','']);
  section('MEMBERS NEEDING FOLLOW-UP'); follow.forEach(x=>rows.push([x.member.member_id,x.member.first_name+' '+x.member.last_name,pct_(x.rate),'Private follow-up recommended','',''])); if(!follow.length) rows.push(['No follow-up items','','','','','']);
  section('DUES COLLECTION SUMMARY'); const owed=dues.reduce((s,d)=>s+Number(d.amount_owed||0),0), paid=dues.reduce((s,d)=>s+Number(d.amount_paid||0),0); rows.push(['Total owed',money_(owed),'Collected',money_(paid),'Outstanding',money_(owed-paid)]);
  section('OVERDUE BALANCES'); overdue.forEach(d=>{const m=people[String(d.member_id)]||{}; rows.push([d.member_id,(m.first_name||'')+' '+(m.last_name||''),money_(d.balance),'Due '+Utilities.formatDate(new Date(d.due_date),Session.getScriptTimeZone(),'yyyy-MM-dd'),'','']);}); if(!overdue.length) rows.push(['No overdue balances','','','','','']);
  section('REIMBURSEMENT SUMMARY'); const pending=reimb.filter(r=>String(r.approval_status)==='Pending'), unpaid=reimb.filter(r=>String(r.approval_status)==='Approved'&&String(r.paid_status)==='Unpaid'); rows.push(['Pending requests',pending.length,'Approved unpaid',unpaid.length,'Approved unpaid total',money_(unpaid.reduce((s,r)=>s+Number(r.amount||0),0))]);
  section('UPCOMING EVENTS'); upcoming.forEach(e=>rows.push([Utilities.formatDate(new Date(e.event_date),Session.getScriptTimeZone(),'yyyy-MM-dd'),e.event_name,e.event_time,e.location,isRequiredEvent_(e)?'Required':'Optional',''])); if(!upcoming.length) rows.push(['No events in the next 7 days','','','','','']);
  section('ACTION ITEMS'); let n=1; if(follow.length) rows.push([n++,'Follow up privately with members below the attendance threshold.','','','','']); if(overdue.length) rows.push([n++,'Contact members with overdue balances and document payment plans.','','','','']); if(pending.length||unpaid.length) rows.push([n++,'Review pending requests and process approved unpaid reimbursements.','','','','']); if(n===1) rows.push([1,'No urgent action items this week.','','','','']);
  sh.clear(); sh.getRange('A1:F1').merge().setValue('Weekly Executive Report').setBackground('#17324D').setFontColor('#FFFFFF').setFontSize(18).setFontWeight('bold');
  sh.getRange('A2:F2').merge().setValue((settings.chapter_name||'Chapter / Organization')+' • Generated '+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd h:mm a')).setFontColor('#64748B');
  sh.getRange(4,1,rows.length,6).setValues(rows).setWrap(true).setVerticalAlignment('top');
  rows.forEach((r,i)=>{ if(String(r[0]).match(/^[A-Z][A-Z ]+$/)) sh.getRange(i+4,1,1,6).setBackground('#17324D').setFontColor('#FFFFFF').setFontWeight('bold'); });
  sh.setColumnWidths(1,6,145); sh.setColumnWidth(2,220); sh.setColumnWidth(4,230); sh.setFrozenRows(2); sh.setHiddenGridlines(true);
  SpreadsheetApp.getActive().toast('Weekly report generated.','AO Command',4);
}

function emailExecReport() {
  generateWeeklyExecReport();
  const settings=settings_(), recipients=String(settings.exec_email_list||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!recipients.length) throw new Error('Add exec_email_list in Settings.');
  const sh=SpreadsheetApp.getActive().getSheetByName(CO.sheets.report), values=sh.getDataRange().getDisplayValues();
  const html='<div style="font-family:Arial,sans-serif"><h2>'+escapeHtml_(settings.chapter_name||'AO Command')+' Weekly Executive Report</h2><table style="border-collapse:collapse">'+values.map((r,i)=>'<tr>'+r.map(c=>'<td style="border:1px solid #dbe3ec;padding:7px;'+(i===0?'background:#17324D;color:white;font-weight:bold':'')+'">'+escapeHtml_(c)+'</td>').join('')+'</tr>').join('')+'</table></div>';
  MailApp.sendEmail({to:recipients.join(','),subject:(settings.chapter_name||'Chapter / Organization')+' — Weekly Executive Report',htmlBody:html,name:settings.report_sender_name||'AO Command'});
  SpreadsheetApp.getActive().toast('Report emailed to '+recipients.length+' recipient(s).','AO Command',5);
}

function createAttendanceFormLink() {
  const ss=SpreadsheetApp.getActive(), props=PropertiesService.getDocumentProperties(), existing=props.getProperty('attendance_form_url');
  if(existing) {
    SpreadsheetApp.getUi().alert('Attendance form already exists', 'Use this link or create a new form manually if you need to rotate it:\n\n'+existing, SpreadsheetApp.getUi().ButtonSet.OK);
    return existing;
  }
  const form=FormApp.create((settings_().chapter_name||'Chapter / Organization')+' Attendance Check-In');
  form.setDescription('Use this form to record attendance. Submit only your own check-in.');
  form.addListItem().setTitle('event_id').setChoiceValues(getData_(CO.sheets.events).map(e=>String(e.event_id)+' — '+e.event_name)).setRequired(true);
  form.addTextItem().setTitle('member_id').setHelpText('Enter your assigned member ID.').setRequired(true);
  form.addMultipleChoiceItem().setTitle('attendance_status').setChoiceValues(['Present','Late']).setRequired(true);
  form.setDestination(FormApp.DestinationType.SPREADSHEET,ss.getId());
  if (!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='handleAttendanceFormSubmit')) {
    ScriptApp.newTrigger('handleAttendanceFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
  }
  const url=form.getPublishedUrl(); props.setProperty('attendance_form_url',url);
  SpreadsheetApp.getUi().alert('Attendance form created', 'Share this link or turn it into a QR code:\n\n'+url+'\n\nSee the setup guide for mapping form responses into Attendance.', SpreadsheetApp.getUi().ButtonSet.OK);
  return url;
}

function handleAttendanceFormSubmit(e) {
  if (!e || !e.namedValues) return;
  const nv=e.namedValues, first=k=>Array.isArray(nv[k])?nv[k][0]:nv[k];
  const eventId=String(first('event_id')||'').split(' — ')[0].trim(), memberId=String(first('member_id')||'').trim();
  if(!eventId || !memberId) return;
  const stamp=e.values && e.values[0] ? new Date(e.values[0]) : new Date();
  const id='A-'+Utilities.formatDate(stamp,Session.getScriptTimeZone(),'yyyyMMdd-HHmmss')+'-'+Utilities.getUuid().slice(0,4).toUpperCase();
  const ss=e.source || SpreadsheetApp.getActive(), sh=ss.getSheetByName(CO.sheets.attendance), values=sh.getDataRange().getValues();
  const headers=values[0].map(String), eventCol=headers.indexOf('event_id'), memberCol=headers.indexOf('member_id'), timeCol=headers.indexOf('check_in_time'), statusCol=headers.indexOf('attendance_status'), notesCol=headers.indexOf('notes');
  const duplicateIndex=values.findIndex((r,i)=>i>0 && String(r[eventCol])===eventId && String(r[memberCol])===memberId);
  if(duplicateIndex>0) {
    sh.getRange(duplicateIndex+1,timeCol+1).setValue(stamp);
    sh.getRange(duplicateIndex+1,statusCol+1).setValue(first('attendance_status')||'Present');
    sh.getRange(duplicateIndex+1,notesCol+1).setValue('Latest Google Form check-in; duplicate submission updated');
    return;
  }
  sh.appendRow([id,eventId,memberId,stamp,first('attendance_status')||'Present','Not Needed','Google Form check-in']);
}

function escapeHtml_(v) { return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
