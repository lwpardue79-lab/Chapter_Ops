import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const db = new PGlite();
const org = '10000000-0000-0000-0000-000000000001';
const otherOrg = '10000000-0000-0000-0000-000000000002';
const admin = '20000000-0000-0000-0000-000000000001';
const assistant = '20000000-0000-0000-0000-000000000002';
const recruiter = '20000000-0000-0000-0000-000000000003';
const officer = '20000000-0000-0000-0000-000000000004';
const member = '20000000-0000-0000-0000-000000000005';
const outsider = '20000000-0000-0000-0000-000000000006';

await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema app_private;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth,public,app_private to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
  create table auth.users(id uuid primary key,email text);
  create table public.organizations(id uuid primary key default gen_random_uuid(),name text,created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
  create table public.profiles(id uuid primary key,email text,full_name text,requested_role text,role text,approval_status text,updated_at timestamptz default now());
  create table public.organization_members(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,email text,role text,member_id text,status text default 'active',created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,user_id));
  create table public.workspace_state(organization_id uuid primary key,data jsonb not null,updated_by uuid,updated_at timestamptz not null default now());
  create table public.app_role_permissions(role text,permission_key text,primary key(role,permission_key));
  create table public.audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid,actor_user_id uuid,action text,target_type text,target_id text,summary jsonb,success boolean,source text,created_at timestamptz default now());
  create function app_private.normalize_db_role(text) returns text language sql immutable as $$ select case when lower($1)='admin' then 'admin' else lower(replace($1,' ','_')) end $$;
  create function app_private.is_admin(uuid) returns boolean language sql as $$select exists(select 1 from public.organization_members where user_id=$1 and role='admin')$$;
  create function app_private.is_approved_org_member(uuid,uuid,text[]) returns boolean language sql as $$select true$$;
  create function app_private.canonical_officer_position(text) returns text language sql immutable as $$select lower($1)$$;
  create function public.normalize_organization_member_role_trigger() returns trigger language plpgsql as $$begin return new; end$$;
  create function public.normalize_executive_team_kpi_workspace() returns jsonb language sql as $$select '{}'::jsonb$$;
  grant select,insert,update on public.workspace_state to authenticated;
`);

async function loadLegacy(file, name) {
  const source = await fs.readFile(new URL(`supabase/migrations/${file}`, root), 'utf8');
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `Missing legacy function ${name}`);
  const end = source.indexOf('\n$$;', start);
  await db.exec(source.slice(start, end + 4));
}
await loadLegacy('202607171330_add_member_archive_rpc.sql','archive_member_in_workspace');
await loadLegacy('202607171330_add_member_archive_rpc.sql','import_members_to_workspace');
await loadLegacy('202607171545_add_finance_ledger_rpc.sql','upsert_finance_accounts_to_workspace');
await loadLegacy('202607132018_fix_save_chapter_setup_return_ambiguity.sql','save_chapter_setup');
for (const filename of ['20261029151909_secure_workspace_api.sql','20261029152433_enforce_workspace_api.sql']) {
  await db.exec(await fs.readFile(new URL(`supabase/migrations/${filename}`, root),'utf8'));
}

await db.query('insert into organizations(id,name) values($1,$2),($3,$4)',[org,'Local test chapter',otherOrg,'Other local chapter']);
const actors = [[admin,'admin','m-admin',org],[assistant,'assistant_treasurer','m-assistant',org],[recruiter,'recruitment','m-recruiter',org],[officer,'executive','m-officer',org],[member,'member','m-member',org],[outsider,'executive','m-outsider',otherOrg]];
for (const [id,role,memberId,chapter] of actors) {
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${role}@example.test`]);
  await db.query('insert into profiles(id,role,approval_status) values($1,$2,$3)',[id,role,'approved']);
  await db.query('insert into organization_members(organization_id,user_id,role,member_id) values($1,$2,$3,$4)',[chapter,id,role,memberId]);
}
const permissions = {
  admin:['all'],
  assistant_treasurer:['members.list.view','members.private_contact.view','finance.member_balances.view','finance.manage'],
  recruitment:['members.list.view','recruitment.view','recruitment.manage','view_kpi_meetings','kpi.submit_own'],
  executive:['members.list.view','view_kpi_meetings','kpi.submit_own','reports.executive.view'],
  member:['member.portal.view']
};
for(const [role,keys] of Object.entries(permissions)) for(const key of keys) await db.query('insert into app_role_permissions values($1,$2)',[role,key]);
const document = {
  version:2, settings:{chapterName:'Local test chapter',schoolName:'School',term:'Fall',academicYear:'2026',setupComplete:true},
  members:[{id:'m-officer',firstName:'Local',lastName:'Officer',email:'private@example.test',notes:'private member note',duesStatus:'Past due',officerRole:'VPMD'},{id:'m-member',firstName:'Local',lastName:'Member'}],
  pnms:[{id:'pnm-local',notes:'recruitment private note'}],finance:[{id:'f-local',memberId:'m-officer',amount:100,type:'Charge'}],financeAccounts:[{memberId:'m-officer',notes:'treasurer private note'}],
  leadership:[],tasks:[],events:[],attendance:[],
  kpiMeetings:[{id:'meeting-local'}],kpiDefinitions:[{id:'definition-local',position:'VPMD',name:'Participation',targetValue:'80'}],
  kpiPositionReports:[{id:'report-local',kpiMeetingId:'meeting-local',position:'VPMD',officerMemberId:'m-officer',status:'Draft'},{id:'report-other',position:'Treasurer',officerMemberId:'m-assistant',status:'Draft'}],
  kpiResults:[],kpiActionItems:[]
};
await db.query('insert into workspace_state(organization_id,data) values($1,$2)',[org,document]);
await db.query('insert into workspace_state(organization_id,data) values($1,$2)',[otherOrg,document]);

async function asUser(id, operation) {
  await db.exec('begin');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
  await db.exec('set local role authenticated');
  try { return await operation(); } finally { await db.exec('rollback'); }
}
const read = async(chapter=org) => (await db.query('select public.read_chapter_workspace($1) value',[chapter])).rows[0].value;
const write = async(view,changes) => (await db.query('select public.save_chapter_workspace($1,$2,$3) value',[org,view.updated_at,changes])).rows[0].value;

test('Assistant Treasurer receives finance but no KPI, PNM or private member notes',async()=>asUser(assistant,async()=>{
  const view=await read(); assert.equal(view.data.finance.length,1);
  for(const key of ['kpiMeetings','kpiDefinitions','kpiPositionReports','kpiResults','kpiActionItems','pnms']) assert.equal(Object.hasOwn(view.data,key),false);
  assert.equal(view.data.members[0].notes,undefined);
}));
test('Recruitment receives PNMs but no finance, personal contacts or finance status',async()=>asUser(recruiter,async()=>{
  const view=await read(); assert.equal(view.data.pnms.length,1); assert.equal(view.data.finance,undefined);
  assert.equal(view.data.leadership,undefined);
  assert.equal(view.data.members[0].email,undefined); assert.equal(view.data.members[0].duesStatus,undefined);
}));
test('Active Member cannot read the operations workspace',async()=>asUser(member,async()=>assert.rejects(read(),{code:'42501'})));
test('Another chapter cannot read this workspace',async()=>asUser(outsider,async()=>assert.rejects(read(),{code:'42501'})));
test('Anonymous callers cannot invoke the read API',async()=>{
  await db.exec('begin; set local role anon');
  try { await assert.rejects(read(),{code:'42501'}); } finally { await db.exec('rollback'); }
});
test('No browser role, including Admin, can query raw workspace data',async()=>asUser(admin,async()=>assert.rejects(db.query('select data from workspace_state'),{code:'42501'})));
test('Admin can still read the complete authorized workspace',async()=>asUser(admin,async()=>assert.deepEqual((await read()).data,document)));
test('Assistant Treasurer cannot write KPI modules through a direct RPC',async()=>asUser(assistant,async()=>{
  const view=await read(); await assert.rejects(write(view,{kpiMeetings:[]}),{code:'42501'});
}));
test('Recruitment cannot write finances through a direct RPC',async()=>asUser(recruiter,async()=>{
  const view=await read(); await assert.rejects(write(view,{finance:[]}),{code:'42501'});
}));
test('A stale version is rejected by Postgres and the first saved change remains',async()=>asUser(admin,async()=>{
  const view=await read(); await write(view,{tasks:[{id:'task-local',title:'first save'}]});
  await db.exec('savepoint stale');
  await assert.rejects(write(view,{tasks:[]}),{code:'PT409'});
  await db.exec('rollback to savepoint stale');
  assert.equal((await read()).data.tasks[0].title,'first save');
}));
test('Settings edits cannot promote an Active Member to Admin',async()=>asUser(member,async()=>{
  await assert.rejects(db.query('select public.save_setup_secure($1,$2,$3)',[document.settings,{},'2026-01-01']),{code:'42501'});
}));
test('Legacy setup API is no longer callable',async()=>asUser(member,async()=>assert.rejects(db.query('select public.save_chapter_setup($1,$2)',[document.settings,{}]),{code:'42501'})));
test('Legacy finance API cannot leak an entire workspace',async()=>asUser(assistant,async()=>assert.rejects(db.query('select public.upsert_finance_accounts_to_workspace($1,$2)',[[],[]]),{code:'42501'})));
test('Officers cannot edit another assigned position report',async()=>asUser(officer,async()=>{
  const view=await read(); const reports=structuredClone(view.data.kpiPositionReports); reports[1].overallUpdate='forbidden';
  await assert.rejects(write(view,{kpiPositionReports:reports}),{code:'42501'});
}));
test('An officer can submit their own report and results atomically',async()=>asUser(officer,async()=>{
  const view=await read(); const reports=structuredClone(view.data.kpiPositionReports); reports[0].overallUpdate='Officer update'; reports[0].status='Submitted';
  const result=await write(view,{kpiPositionReports:reports,kpiResults:[{id:'result-local',positionReportId:'report-local',kpiDefinitionId:'definition-local',actualValue:'85',status:'On Track'}]});
  assert.equal(result.data.kpiPositionReports[0].submittedBy,officer);
  assert.equal(result.data.kpiResults[0].targetValue,'80');
}));
test('Workspace writes create an audit record with the authenticated actor',async()=>asUser(admin,async()=>{
  const view=await read(); await write(view,{tasks:[{id:'audit-task'}]});
  await db.exec('reset role');
  const result=await db.query("select actor_user_id,summary from audit_logs where actor_user_id=$1 order by created_at desc limit 1",[admin]);
  assert.equal(result.rows[0].actor_user_id,admin); assert.ok(result.rows[0].summary.modules.includes('tasks'));
}));
test('Dedicated finance writes require the current version and return only authorized modules',async()=>asUser(assistant,async()=>{
  const view=await read(); const result=(await db.query('select public.save_finance_secure($1,$2,$3) value',[[],[],view.updated_at])).rows[0].value;
  assert.equal(result.workspace_data.kpiMeetings,undefined); assert.ok(result.workspace_data.finance);
}));
test('Admin settings save preserves roles and every non-settings module',async()=>asUser(admin,async()=>{
  const view=await read(); await db.query('select public.save_setup_secure($1,$2,$3)',[{...document.settings,term:'Spring'},{finance:[]},view.updated_at]);
  const saved=await read(); assert.equal(saved.data.settings.term,'Spring'); assert.deepEqual(saved.data.finance,document.finance);
}));
test('An inactive membership cannot read chapter operations',async()=>{
  await db.query("update organization_members set status='disabled' where user_id=$1",[officer]);
  try { await asUser(officer,async()=>assert.rejects(read(),{code:'42501'})); }
  finally { await db.query("update organization_members set status='active' where user_id=$1",[officer]); }
});
test('Missing singular officer ownership cannot bypass report permissions',async()=>{
  const altered=structuredClone(document); delete altered.kpiPositionReports[1].officerMemberId; altered.kpiPositionReports[1].officerMemberIds=['m-assistant'];
  await db.query('update workspace_state set data=$1 where organization_id=$2',[altered,org]);
  try { await asUser(officer,async()=>{
    const view=await read(); view.data.kpiPositionReports[1].overallUpdate='forbidden';
    await assert.rejects(write(view,{kpiPositionReports:view.data.kpiPositionReports}),{code:'42501'});
  }); } finally { await db.query('update workspace_state set data=$1 where organization_id=$2',[document,org]); }
});
test('A repeated financial transaction ID cannot create duplicate payments',async()=>asUser(assistant,async()=>{
  let view=await read(); const transaction={id:'payment-once',memberId:'m-officer',type:'Payment',amount:25};
  await db.query('select public.save_finance_secure($1,$2,$3)',[[],[transaction],view.updated_at]);
  view=await read(); await db.query('select public.save_finance_secure($1,$2,$3)',[[],[transaction],view.updated_at]);
  assert.equal((await read()).data.finance.filter(row=>row.id==='payment-once').length,1);
}));
test('Finance transactions cannot refer to a member outside the chapter',async()=>asUser(assistant,async()=>{
  const view=await read();
  await assert.rejects(db.query('select public.save_finance_secure($1,$2,$3)',[[],[{id:'foreign-payment',memberId:'foreign-member',type:'Payment',amount:10}],view.updated_at]),{code:'42501'});
}));
test('Dedicated finance endpoint rejects stale versions',async()=>asUser(assistant,async()=>{
  const view=await read();
  await db.query('select public.save_finance_secure($1,$2,$3)',[[],[],view.updated_at]);
  await assert.rejects(db.query('select public.save_finance_secure($1,$2,$3)',[[],[],view.updated_at]),{code:'PT409'});
}));
test('Whole-workspace replacement and unknown modules are rejected',async()=>asUser(admin,async()=>{
  const view=await read(); await assert.rejects(write(view,{data:{members:[]}}),{code:'42501'});
}));
test('A disabled Admin membership cannot use the admin policy helper',async()=>{
  await db.query("update organization_members set status='disabled' where user_id=$1",[admin]);
  try { await asUser(admin,async()=>assert.equal((await db.query('select public.current_user_is_admin() value')).rows[0].value,false)); }
  finally { await db.query("update organization_members set status='active' where user_id=$1",[admin]); }
});
test('Roster import is versioned and importing the same person twice preserves one ID',async()=>asUser(admin,async()=>{
  let view=await read(); const incoming=[{firstName:'Import',lastName:'Check',email:'import-check@example.test'}];
  await db.query('select public.import_members_secure($1,$2)',[incoming,view.updated_at]);
  view=await read(); await db.query('select public.import_members_secure($1,$2)',[incoming,view.updated_at]);
  assert.equal((await read()).data.members.filter(m=>m.email==='import-check@example.test').length,1);
}));
test('Archiving preserves historical finance records and rejects a stale retry',async()=>asUser(admin,async()=>{
  const view=await read(); await db.query('select public.archive_member_secure($1,$2)',['m-officer',view.updated_at]);
  const saved=await read(); assert.equal(saved.data.members.find(m=>m.id==='m-officer').archived,true);
  assert.deepEqual(saved.data.finance,document.finance);
  await assert.rejects(db.query('select public.archive_member_secure($1,$2)',['m-officer',view.updated_at]),{code:'PT409'});
}));
test('The settings endpoint rejects a stale version',async()=>asUser(admin,async()=>{
  const view=await read(); await write(view,{tasks:[]});
  await assert.rejects(db.query('select public.save_setup_secure($1,$2,$3)',[document.settings,{},view.updated_at]),{code:'PT409'});
}));
test('A browser cannot directly update the raw workspace row',async()=>asUser(admin,async()=>assert.rejects(db.query('update workspace_state set data=$1 where organization_id=$2',[{},org]),{code:'42501'})));
test.after(async()=>{ await db.close(); });
