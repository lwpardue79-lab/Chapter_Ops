const storeKey = "chapterops_alpha_omega_v1";
const orgStoreKey = "chapterops_cloud_org_id";
const todayIso = () => new Date().toISOString().slice(0, 10);
const dateOffset = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const money = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n, d) => d ? `${Math.round((n / d) * 100)}%` : "0%";
const safe = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const viewNames = {
  dashboard: "Executive Dashboard",
  members: "Member Management",
  recruitment: "Recruitment / PNM Tracking",
  events: "Events & Attendance",
  finance: "Finance / Dues",
  tasks: "Tasks / Follow-Ups",
  leadership: "Officers & Committees",
  reports: "Reports",
  settings: "Settings"
};

const roles = ["Admin", "President", "Treasurer", "Recruitment/VPMD", "Exec Board", "Committee Chair", "Active Member", "Read-only Advisor"];
const roleRules = {
  "Admin": ["all"],
  "President": ["view_all", "edit_members", "edit_events", "edit_tasks", "view_finance", "view_sensitive"],
  "Treasurer": ["view_all", "edit_finance", "view_finance", "edit_tasks"],
  "Recruitment/VPMD": ["view_all", "edit_pnms", "edit_events", "edit_tasks", "view_sensitive"],
  "Exec Board": ["view_all", "view_reports", "view_sensitive"],
  "Committee Chair": ["view_basic", "edit_events", "edit_tasks"],
  "Active Member": ["view_basic", "add_pnms", "complete_tasks"],
  "Read-only Advisor": ["view_reports"]
};
const can = (permission) => roleRules[state.settings.currentRole]?.includes("all") || roleRules[state.settings.currentRole]?.includes(permission);

let activeView = "dashboard";
let activeFilters = {};
let historyStack = [];
let cloud = { client: null, user: null, organizationId: localStorage.getItem(orgStoreKey) };
let state = load();

function buildDemoData() {
  const first = ["Luke","Andrew","Jack","Caleb","Nolan","Ethan","Mason","Ryan","Will","Cole","Ben","Tyler","Hayden","Parker","Sam","Grant","Owen","Gavin","Connor","Logan","Alex","Brady","Jake","Max","Drew"];
  const last = ["Anderson","Bennett","Carter","Davis","Edwards","Foster","Griffin","Hayes","Johnson","Kelly","Lewis","Martin","Nelson","Owens","Parker","Reed","Smith","Taylor","Walker","Young"];
  const majors = ["Finance","Marketing","Mechanical Engineering","Accounting","Business Analytics","Biology","Political Science","Computer Science","Construction Management","Communications"];
  const hometowns = ["Springfield, MO","St. Louis, MO","Kansas City, MO","Columbia, MO","Tulsa, OK","Memphis, TN","Little Rock, AR","Dallas, TX","Nashville, TN","Chicago, IL"];
  const committees = ["Recruitment","Brotherhood","Philanthropy","Risk Management","Social","Finance","Alumni Relations","Operations"];
  const members = Array.from({ length: 50 }, (_, i) => ({
    id: `m_${String(i + 1).padStart(3, "0")}`,
    firstName: first[i % first.length],
    lastName: last[(i * 3) % last.length],
    phone: `(417) 555-${String(1000 + i).slice(-4)}`,
    email: `${first[i % first.length].toLowerCase()}.${last[(i * 3) % last.length].toLowerCase()}@example.edu`,
    schoolYear: ["Freshman","Sophomore","Junior","Senior"][i % 4],
    major: majors[i % majors.length],
    hometown: hometowns[i % hometowns.length],
    memberStatus: i < 7 ? "New Member" : "Active",
    officerRole: ["President","Treasurer","Recruitment Chair / VPMD","Secretary","Risk Manager","Brotherhood Chair","General member"][i % 7],
    committee: committees[i % committees.length],
    duesStatus: ["Paid","Partial","Past Due","Paid","Paid"][i % 5],
    attendanceRate: 62 + (i * 7) % 39,
    notes: i % 9 === 0 ? "Needs a quick wellness/check-in conversation this week." : "",
    tags: i % 6 === 0 ? "needs follow-up" : i % 5 === 0 ? "committee lead" : "",
    lifecycle: i > 45 ? "Inactive" : "Active",
    archived: false
  }));
  const pnmStatuses = ["New lead","Contacted","Interested","Event attended","Ready for review","Approved for bid","Bid extended","Accepted","Declined","Not a fit"];
  const sources = ["Member referral","Rush table","Instagram","Campus event","Friend of member","Class connection","Alumni referral"];
  const pnms = Array.from({ length: 20 }, (_, i) => ({
    id: `p_${String(i + 1).padStart(3, "0")}`,
    firstName: first[(i + 5) % first.length],
    lastName: last[(i + 7) % last.length],
    phone: `(573) 555-${String(2200 + i).slice(-4)}`,
    email: `pnm${i + 1}@example.edu`,
    social: `instagram.com/pnm${i + 1}`,
    hometown: hometowns[(i + 2) % hometowns.length],
    major: majors[(i + 1) % majors.length],
    schoolYear: ["Freshman","Freshman","Sophomore","Junior"][i % 4],
    referralSource: sources[i % sources.length],
    referredBy: `${members[(i * 2) % members.length].firstName} ${members[(i * 2) % members.length].lastName}`,
    assignedRecruiter: members[(i * 3) % members.length].id,
    eventsAttended: [],
    followUpDate: dateOffset((i % 7) - 2),
    status: pnmStatuses[i % pnmStatuses.length],
    bidExtendedDate: i % 5 === 0 ? dateOffset(-3) : "",
    bidAcceptedDate: i % 10 === 7 ? dateOffset(-1) : "",
    bidDeclinedDate: i % 10 === 8 ? dateOffset(-1) : "",
    joinedClass: i % 10 === 7 ? "Yes" : "No",
    notes: i % 4 === 0 ? "High interest; follow up after next event." : "",
    tags: i % 3 === 0 ? "high priority, needs follow-up" : "new contact",
    archived: false
  }));
  const eventTypes = ["Chapter","Brotherhood","Recruitment","Philanthropy","Social","New member education","Executive meeting","Risk management"];
  const events = Array.from({ length: 8 }, (_, i) => ({
    id: `e_${String(i + 1).padStart(3, "0")}`,
    name: ["Chapter Meeting","Brotherhood Dinner","Recruitment Cookout","Philanthropy Planning","Alumni Tailgate","Risk Management Training","Executive Board","Service Project"][i],
    date: dateOffset(i - 2),
    time: ["18:00","19:00","17:30","20:00"][i % 4],
    location: ["Chapter house","Student union","Campus lawn","Downtown venue"][i % 4],
    type: eventTypes[i % eventTypes.length],
    required: i % 3 !== 1 ? "Required" : "Optional",
    memberAttendance: [],
    pnmAttendance: [],
    brothersAssigned: [members[i].id, members[i + 4].id],
    notes: i === 2 ? "Recruitment event; assign follow-ups afterward." : "",
    archived: false
  }));
  const attendance = [];
  events.forEach((event, i) => {
    members.slice(0, 36).forEach((member, j) => {
      if ((i + j) % 5 !== 0) attendance.push({ id: uid("a"), eventId: event.id, personType: "Member", personId: member.id, status: j % 9 === 0 ? "Excused" : "Present", timestamp: `${event.date}T${event.time}`, notes: "" });
    });
    pnms.slice(0, 12).forEach((pnm, j) => {
      if (event.type === "Recruitment" || j % 4 === i % 4) attendance.push({ id: uid("a"), eventId: event.id, personType: "PNM", personId: pnm.id, status: "Present", timestamp: `${event.date}T${event.time}`, notes: "" });
    });
  });
  const finance = members.map((member, i) => ({
    id: `f_${String(i + 1).padStart(3, "0")}`,
    type: "Dues",
    memberId: member.id,
    category: "Semester dues",
    owed: 650,
    paid: member.duesStatus === "Paid" ? 650 : member.duesStatus === "Partial" ? 300 : 0,
    dueDate: dateOffset(i % 5 === 0 ? -10 : 15),
    status: member.duesStatus,
    notes: member.duesStatus === "Past Due" ? "Treasurer follow-up needed." : ""
  })).concat([
    { id: uid("f"), type: "Expense", memberId: "", category: "Brotherhood", owed: 0, paid: 420, dueDate: todayIso(), status: "Paid", notes: "Dinner supplies" },
    { id: uid("f"), type: "Reimbursement", memberId: "m_006", category: "Recruitment", owed: 0, paid: 115, dueDate: todayIso(), status: "Pending", notes: "Event materials reimbursement" },
    { id: uid("f"), type: "Income", memberId: "", category: "Fundraising", owed: 0, paid: 780, dueDate: todayIso(), status: "Collected", notes: "Philanthropy fundraiser income" }
  ]);
  const tasks = [
    "Follow up with PNMs due today","Collect past due balances","Confirm chapter meeting room","Prepare exec board summary","Update recruitment event attendance","Order philanthropy supplies","Check in with inactive members","Send alumni event reminder"
  ].map((title, i) => ({
    id: `t_${String(i + 1).padStart(3, "0")}`,
    title,
    description: "Operational follow-up for the chapter team.",
    assignedPerson: members[(i * 4) % members.length].id,
    dueDate: dateOffset(i - 2),
    priority: ["High","Medium","Low"][i % 3],
    status: ["Not started","In progress","Waiting","Done"][i % 4],
    relatedType: ["PNM","Finance","Event","Report","Member"][i % 5],
    relatedId: i % 2 ? pnms[i % pnms.length].id : events[i % events.length].id,
    notes: "",
    archived: false
  }));
  const leadership = [
    "President","Internal Vice President","External Vice President","Treasurer","Assistant Treasurer","Recruitment Chair / VPMD","Secretary","Risk Manager","Brotherhood Chair","Philanthropy Chair","Social Chair","New Member Educator","Sergeant at Arms","Alumni Relations"
  ].map((role, i) => ({
    id: `l_${i + 1}`,
    role,
    assignedMember: members[i].id,
    responsibilities: `${role} owns weekly execution, communication, and reporting for their area.`,
    committee: committees[i % committees.length],
    relatedReports: ["Weekly exec summary","Attendance summary","Finance summary","Recruitment funnel"][i % 4]
  }));
  return {
    settings: {
      chapterName: "Alpha Omega Chapter",
      organizationName: "Pi Kappa Alpha",
      schoolName: "Missouri S&T",
      term: "Fall",
      academicYear: "2026-2027",
      currentRole: "Admin",
      attendanceThreshold: 80,
      privacyNotice: "This system is for chapter operations only. Sign in before entering real member, finance, attendance, or PNM information. Archive records when possible and avoid unnecessary sensitive notes."
    },
    members, pnms, events, attendance, finance, tasks, leadership,
    activity: [{ id: uid("log"), at: new Date().toISOString(), actor: "System", text: "Demo workspace created for Alpha Omega Chapter Operations." }]
  };
}

function load() {
  try {
    const saved = localStorage.getItem(storeKey);
    return saved ? normalize(JSON.parse(saved)) : buildDemoData();
  } catch {
    return buildDemoData();
  }
}
function normalize(data) {
  const base = buildDemoData();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    members: data.members || base.members,
    pnms: data.pnms || base.pnms,
    events: data.events || base.events,
    attendance: data.attendance || [],
    finance: data.finance || data.dues || base.finance,
    tasks: data.tasks || base.tasks,
    leadership: data.leadership || base.leadership,
    activity: data.activity || base.activity
  };
}
function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}
function snapshot(label) {
  historyStack.push(JSON.stringify(state));
  if (historyStack.length > 20) historyStack.shift();
  logActivity(label);
}
function logActivity(text) {
  state.activity.unshift({ id: uid("log"), at: new Date().toISOString(), actor: state.settings.currentRole || "User", text });
  state.activity = state.activity.slice(0, 80);
}

async function initCloud() {
  const cfg = window.CHAPTEROPS_CONFIG;
  if (!window.supabase || !cfg?.supabaseUrl || !cfg?.supabasePublishableKey) return updateCloudUi("Local demo mode");
  cloud.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const { data } = await cloud.client.auth.getSession();
  cloud.user = data.session?.user || null;
  cloud.client.auth.onAuthStateChange(async (_event, session) => {
    cloud.user = session?.user || null;
    updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Demo / local mode");
    if (cloud.user) await loadCloudWorkspace();
    render();
  });
  if (cloud.user) await loadCloudWorkspace();
  updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Demo / local mode");
}
function updateCloudUi(message) {
  document.getElementById("cloudStatus").textContent = message;
  document.getElementById("signInBtn").classList.toggle("hidden", !!cloud.user);
  document.getElementById("syncBtn").classList.toggle("hidden", !cloud.user);
  document.getElementById("signOutBtn").classList.toggle("hidden", !cloud.user);
}
async function signIn() {
  if (!cloud.client) return toast("Supabase is not configured.");
  const email = prompt("Enter the email address to receive a secure sign-in link:");
  if (!email) return;
  const { error } = await cloud.client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  toast(error ? error.message : "Check your email for the sign-in link.");
}
async function signOut() {
  if (cloud.client) await cloud.client.auth.signOut();
  cloud.user = null;
  render();
}
async function ensureCloudWorkspace() {
  if (!cloud.client || !cloud.user) throw new Error("Sign in before syncing real chapter data.");
  if (cloud.organizationId) return cloud.organizationId;
  const { data: existing } = await cloud.client.from("organization_members").select("organization_id").eq("user_id", cloud.user.id).limit(1).maybeSingle();
  if (existing?.organization_id) {
    cloud.organizationId = existing.organization_id;
    localStorage.setItem(orgStoreKey, cloud.organizationId);
    return cloud.organizationId;
  }
  const { data: org, error: orgError } = await cloud.client.from("organizations").insert({ name: state.settings.chapterName }).select("id").single();
  if (orgError) throw orgError;
  const { error: memberError } = await cloud.client.from("organization_members").insert({ organization_id: org.id, user_id: cloud.user.id, role: "Admin" });
  if (memberError) throw memberError;
  cloud.organizationId = org.id;
  localStorage.setItem(orgStoreKey, org.id);
  return org.id;
}
async function loadCloudWorkspace() {
  try {
    const organizationId = await ensureCloudWorkspace();
    const { data, error } = await cloud.client.from("workspace_state").select("state").eq("organization_id", organizationId).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      state = normalize(data.state);
      save();
      toast("Cloud workspace loaded.");
    } else {
      await syncCloudWorkspace(false);
    }
  } catch (err) {
    toast(err.message || "Could not load cloud workspace.");
  }
}
async function syncCloudWorkspace(showToast = true) {
  try {
    const organizationId = await ensureCloudWorkspace();
    const { error } = await cloud.client.from("workspace_state").upsert({ organization_id: organizationId, state, updated_by: cloud.user.id, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
    if (error) throw error;
    if (showToast) toast("Cloud workspace synced.");
  } catch (err) {
    toast(err.message || "Cloud sync failed.");
  }
}

const memberName = (id) => {
  const m = state.members.find((x) => x.id === id);
  return m ? `${m.firstName} ${m.lastName}` : id || "";
};
const pnmName = (id) => {
  const p = state.pnms.find((x) => x.id === id);
  return p ? `${p.firstName} ${p.lastName}` : id || "";
};
const eventName = (id) => state.events.find((e) => e.id === id)?.name || id || "";
const activeMembers = () => state.members.filter((m) => !m.archived && m.lifecycle === "Active");
const activePnms = () => state.pnms.filter((p) => !p.archived && !["Archived","Declined","Not a fit"].includes(p.status));
const upcomingEvents = () => state.events.filter((e) => !e.archived && e.date >= todayIso()).sort((a,b) => a.date.localeCompare(b.date));
const pastDueFinance = () => state.finance.filter((f) => f.type === "Dues" && Number(f.owed) > Number(f.paid) && f.dueDate < todayIso());
const followUpMembers = () => activeMembers().filter((m) => Number(m.attendanceRate) < Number(state.settings.attendanceThreshold) || /follow-up|risk|inactive/i.test(m.tags + " " + m.notes));
const followUpPnms = () => activePnms().filter((p) => p.followUpDate && p.followUpDate <= todayIso());
const openTasks = () => state.tasks.filter((t) => !t.archived && !["Done","Archived"].includes(t.status));

function metrics() {
  const dues = state.finance.filter((f) => f.type === "Dues");
  const owed = dues.reduce((s, f) => s + Number(f.owed || 0), 0);
  const paid = dues.reduce((s, f) => s + Number(f.paid || 0), 0);
  const bidsExtended = state.pnms.filter((p) => ["Bid extended","Accepted","Declined"].includes(p.status) || p.bidExtendedDate).length;
  const bidsAccepted = state.pnms.filter((p) => p.status === "Accepted" || p.bidAcceptedDate).length;
  return {
    activeMembers: activeMembers().length,
    newMembers: state.members.filter((m) => !m.archived && m.memberStatus === "New Member").length,
    pnms: activePnms().length,
    upcoming: upcomingEvents().length,
    attendanceIssues: followUpMembers().length,
    duesCollected: paid,
    duesOutstanding: owed - paid,
    pastDue: pastDueFinance().length,
    openTasks: openTasks().length,
    memberFollowUps: followUpMembers().length,
    pnmFollowUps: followUpPnms().length,
    bidsExtended,
    bidsAccepted,
    bidsDeclined: state.pnms.filter((p) => p.status === "Declined" || p.bidDeclinedDate).length,
    acceptanceRate: pct(bidsAccepted, bidsExtended)
  };
}

function render() {
  document.getElementById("viewTitle").textContent = viewNames[activeView];
  document.getElementById("orgLabel").textContent = `${state.settings.chapterName} · ${state.settings.organizationName}`;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === activeView));
  const root = document.getElementById("appRoot");
  root.innerHTML = ({
    dashboard: renderDashboard,
    members: () => renderCollection("members"),
    recruitment: () => renderCollection("pnms"),
    events: () => renderCollection("events"),
    finance: () => renderCollection("finance"),
    tasks: () => renderCollection("tasks"),
    leadership: renderLeadership,
    reports: renderReports,
    settings: renderSettings
  }[activeView] || renderDashboard)();
  bindViewActions(root);
}

function renderDashboard() {
  const m = metrics();
  const cards = [
    ["Active members", m.activeMembers, "members", "lifecycle=Active"],
    ["New members", m.newMembers, "members", "memberStatus=New Member"],
    ["Active PNMs", m.pnms, "recruitment", ""],
    ["Upcoming events", m.upcoming, "events", ""],
    ["Attendance issues", m.attendanceIssues, "members", "attendance=issues"],
    ["Dues collected", money(m.duesCollected), "finance", "type=Dues"],
    ["Outstanding dues", money(m.duesOutstanding), "finance", "pastdue=true"],
    ["Open tasks", m.openTasks, "tasks", "status=open"],
    ["Members needing follow-up", m.memberFollowUps, "members", "followup=true"],
    ["PNMs needing follow-up", m.pnmFollowUps, "recruitment", "followup=true"],
    ["Bids accepted", m.bidsAccepted, "recruitment", "status=Accepted"],
    ["Acceptance rate", m.acceptanceRate, "reports", ""]
  ];
  return `
    <section class="hero">
      <div>
        <p class="eyebrow">Operating snapshot</p>
        <h3>Alpha Omega command center for members, recruitment, events, finances, and executive follow-up.</h3>
        <p>Demo data is safe for walkthroughs. Sign in and sync before using real chapter records.</p>
      </div>
      <div class="hero-actions">
        <button class="primary" data-add="members">Add member</button>
        <button class="primary" data-add="pnms">Add PNM</button>
        <button class="ghost" data-add="events">Add event</button>
        <button class="ghost" data-add="tasks">Create task</button>
      </div>
    </section>
    <div class="kpi-grid">${cards.map(([label, value, view, filter]) => metricCard(label, value, view, filter)).join("")}</div>
    <div class="three-col">
      ${listPanel("Upcoming events", upcomingEvents().slice(0, 6).map((e) => `${e.date} · ${e.name}<span>${e.type} · ${e.location}</span>`), "events")}
      ${listPanel("Needs follow-up", followUpMembers().slice(0, 6).map((m) => `${memberName(m.id)}<span>${m.attendanceRate}% attendance · ${m.committee}</span>`), "members")}
      ${listPanel("Recent activity", state.activity.slice(0, 8).map((a) => `${new Date(a.at).toLocaleString()}<span>${safe(a.text)}</span>`), "reports")}
    </div>
    <section class="panel">
      <div class="panel-head"><h3>Quick actions</h3><span class="pill">Mobile friendly</span></div>
      <div class="quick-grid">
        <button class="action-tile" data-add="members">Add member</button>
        <button class="action-tile" data-add="pnms">Add PNM</button>
        <button class="action-tile" data-add="events">Add event</button>
        <button class="action-tile" data-checkin>Record attendance</button>
        <button class="action-tile" data-add="finance">Add dues/payment note</button>
        <button class="action-tile" data-add="tasks">Create task</button>
        <button class="action-tile" data-export="reports">Export report</button>
      </div>
    </section>`;
}
function metricCard(label, value, view, filter) {
  return `<button class="kpi-card" data-go="${view}" data-filter="${safe(filter)}"><span>${label}</span><strong>${value}</strong><em>Open details</em></button>`;
}
function listPanel(title, rows, view) {
  return `<section class="panel"><div class="panel-head"><h3>${title}</h3><button class="ghost small" data-go="${view}">View</button></div><div class="stack-list">${rows.length ? rows.map((r) => `<div class="stack-item">${r}</div>`).join("") : emptySmall("Nothing needs attention.")}</div></section>`;
}

const collectionMeta = {
  members: {
    title: "Chapter roster", permission: "edit_members", addLabel: "Add member",
    search: ["firstName","lastName","email","phone","schoolYear","major","hometown","memberStatus","officerRole","committee","duesStatus","tags"],
    columns: ["name","phone","email","schoolYear","major","memberStatus","officerRole","committee","duesStatus","attendanceRate","lifecycle"],
    fields: [
      ["firstName","First name","text","required"],["lastName","Last name","text","required"],["phone","Phone","tel"],["email","Email","email"],["schoolYear","Year in school","select",["Freshman","Sophomore","Junior","Senior","Graduate"]],
      ["major","Major","text"],["hometown","Hometown","text"],["memberStatus","Member status","select",["Active","New Member","Inactive","Alumni"]],["officerRole","Officer role","select","officerRoles"],["committee","Committee","select","committees"],
      ["duesStatus","Dues status","select",["Paid","Partial","Past Due","Unpaid"]],["attendanceRate","Attendance %","number"],["notes","Notes","textarea"],["tags","Tags","text"],["lifecycle","Lifecycle","select",["Active","Inactive","Alumni","Archived"]]
    ]
  },
  pnms: {
    title: "Recruitment / PNM board", permission: "edit_pnms", addLabel: "Add PNM",
    search: ["firstName","lastName","phone","email","hometown","major","schoolYear","referralSource","referredBy","status","tags"],
    columns: ["name","phone","schoolYear","major","referralSource","referredBy","assignedRecruiter","status","followUpDate","joinedClass"],
    fields: [
      ["firstName","First name","text","required"],["lastName","Last name","text","required"],["phone","Phone","tel"],["email","Email","email"],["social","Instagram / social link","text"],["hometown","Hometown","text"],["major","Major","text"],["schoolYear","Grade year","select",["Freshman","Sophomore","Junior","Senior"]],
      ["referralSource","Referral source","text"],["referredBy","Who referred them","text"],["assignedRecruiter","Assigned brother/recruiter","select","members"],["status","Current status","select",["New lead","Contacted","Interested","Event attended","Ready for review","Approved for bid","Bid extended","Accepted","Declined","Not a fit","Archived"]],
      ["followUpDate","Follow-up date","date"],["bidExtendedDate","Bid extended date","date"],["bidAcceptedDate","Bid accepted date","date"],["bidDeclinedDate","Bid declined date","date"],["joinedClass","Joined new member class","select",["No","Yes"]],["notes","Notes","textarea"],["tags","Tags","text"]
    ]
  },
  events: {
    title: "Events and attendance", permission: "edit_events", addLabel: "Create event",
    search: ["name","date","location","type","required","notes"],
    columns: ["name","date","time","location","type","required","memberAttendanceCount","pnmAttendanceCount","brothersAssigned"],
    fields: [
      ["name","Event name","text","required"],["date","Date","date","required"],["time","Time","time"],["location","Location","text"],["type","Event type","select",["Chapter","Brotherhood","Recruitment","Philanthropy","Social","New member education","Executive meeting","Committee meeting","Risk management","Alumni","Other"]],
      ["required","Required/optional","select",["Required","Optional"]],["brothersAssigned","Brothers assigned","text"],["notes","Notes","textarea"]
    ]
  },
  finance: {
    title: "Finance and dues", permission: "edit_finance", addLabel: "Add finance row",
    search: ["type","category","status","notes"],
    columns: ["type","memberId","category","owed","paid","balance","dueDate","status","notes"],
    fields: [
      ["type","Type","select",["Dues","Expense","Reimbursement","Income","Event budget"]],["memberId","Member","select","members"],["category","Budget category","text"],["owed","Amount owed / budget","number"],["paid","Amount paid / actual","number"],["dueDate","Due date","date"],["status","Status","select",["Unpaid","Partial","Paid","Past Due","Pending","Approved","Collected"]],["notes","Payment notes","textarea"]
    ]
  },
  tasks: {
    title: "Tasks and follow-ups", permission: "edit_tasks", addLabel: "Create task",
    search: ["title","description","priority","status","relatedType","notes"],
    columns: ["title","assignedPerson","dueDate","priority","status","relatedType","notes"],
    fields: [
      ["title","Title","text","required"],["description","Description","textarea"],["assignedPerson","Assigned person","select","members"],["dueDate","Due date","date"],["priority","Priority","select",["High","Medium","Low"]],["status","Status","select",["Not started","In progress","Waiting","Done","Archived"]],["relatedType","Related to","select",["Member","PNM","Event","Finance","Report","Other"]],["relatedId","Related record ID","text"],["notes","Notes","textarea"]
    ]
  }
};

function renderCollection(key) {
  if (key === "finance" && !can("view_finance") && !can("all")) return restrictedPanel("Finance is restricted to Admin, President, and Treasurer roles.");
  const meta = collectionMeta[key];
  const rows = filteredRows(key);
  const extras = key === "recruitment" ? "" : "";
  return `
    <section class="panel">
      <div class="panel-head">
        <div><p class="eyebrow">${key === "pnms" ? "Recruitment module" : "Chapter module"}</p><h3>${meta.title}</h3></div>
        <div class="button-row">
          <input class="search" id="searchInput" placeholder="Search ${meta.title.toLowerCase()}" value="${safe(activeFilters[key]?.q || "")}" />
          <button class="ghost" data-export="${key}">Export CSV</button>
          ${can(meta.permission) || (key === "pnms" && can("add_pnms")) ? `<button class="primary" data-add="${key}">${meta.addLabel}</button>` : ""}
        </div>
      </div>
      ${key === "events" ? renderCheckinPanel() : ""}
      ${key === "pnms" ? renderRecruitmentSummary() : ""}
      ${key === "finance" ? renderFinanceSummary() : ""}
      ${extras}
      ${renderTable(key, rows)}
    </section>`;
}
function filteredRows(key) {
  const q = (activeFilters[key]?.q || "").toLowerCase();
  let rows = (state[key] || []).filter((r) => !r.archived && r.status !== "Archived" && r.lifecycle !== "Archived");
  if (activeFilters[key]?.followup) rows = key === "members" ? followUpMembers() : key === "pnms" ? followUpPnms() : rows;
  if (activeFilters[key]?.pastdue) rows = pastDueFinance();
  if (activeFilters[key]?.status) rows = rows.filter((r) => r.status === activeFilters[key].status || r.memberStatus === activeFilters[key].status);
  if (!q) return rows;
  const fields = collectionMeta[key].search || [];
  return rows.filter((row) => fields.some((field) => String(row[field] || "").toLowerCase().includes(q)));
}
function renderTable(key, rows) {
  const cols = collectionMeta[key].columns;
  if (!rows.length) return `<div class="empty-state"><h3>No records match these filters.</h3><p>Add a record, import CSV data, or clear your search.</p><button class="primary" data-add="${key}">Add first record</button></div>`;
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${labelize(c)}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr data-open="${key}" data-id="${row.id}">${cols.map((c) => `<td data-label="${labelize(c)}">${formatCell(key, row, c)}</td>`).join("")}<td data-label="Actions">${rowActions(key, row)}</td></tr>`).join("")}</tbody></table></div>`;
}
function rowActions(key, row) {
  const meta = collectionMeta[key];
  const allowed = can(meta.permission) || (key === "pnms" && can("add_pnms"));
  const statusButtons = key === "pnms" ? `<button class="small ghost" data-status="${row.id}:Contacted">Contacted</button><button class="small ghost" data-status="${row.id}:Bid extended">Extend bid</button><button class="small ghost" data-status="${row.id}:Accepted">Accepted</button>` : key === "tasks" ? `<button class="small ghost" data-status="${row.id}:Done">Done</button>` : "";
  return `<div class="row-actions">${statusButtons}${allowed ? `<button class="small ghost" data-edit="${key}:${row.id}">Edit</button><button class="small ghost" data-archive="${key}:${row.id}">Archive</button>${can("all") ? `<button class="small danger" data-delete="${key}:${row.id}">Delete</button>` : ""}` : ""}</div>`;
}
function formatCell(key, row, col) {
  if (col === "name") return `<button class="linklike" data-open="${key}" data-id="${row.id}">${safe(row.firstName)} ${safe(row.lastName)}</button>`;
  if (col === "assignedRecruiter" || col === "assignedPerson" || col === "memberId") return safe(memberName(row[col]));
  if (col === "brothersAssigned") return Array.isArray(row.brothersAssigned) ? row.brothersAssigned.map(memberName).join(", ") : safe(row.brothersAssigned || "");
  if (col === "memberAttendanceCount") return state.attendance.filter((a) => a.eventId === row.id && a.personType === "Member").length;
  if (col === "pnmAttendanceCount") return state.attendance.filter((a) => a.eventId === row.id && a.personType === "PNM").length;
  if (col === "owed" || col === "paid" || col === "balance") return money(col === "balance" ? Number(row.owed || 0) - Number(row.paid || 0) : row[col]);
  if (col === "attendanceRate") return `${row.attendanceRate || 0}%`;
  return safe(row[col]);
}
function labelize(text) {
  return text.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function renderRecruitmentSummary() {
  const m = metrics();
  const statuses = ["New lead","Contacted","Interested","Event attended","Ready for review","Approved for bid","Bid extended","Accepted","Declined"];
  return `<div class="mini-grid">${[
    ["Bids extended", m.bidsExtended], ["Bids accepted", m.bidsAccepted], ["Bids declined", m.bidsDeclined], ["Acceptance rate", m.acceptanceRate],
    ["Need follow-up", m.pnmFollowUps], ["Joined class", state.pnms.filter((p) => p.joinedClass === "Yes").length]
  ].map(([a,b]) => `<button class="mini-card" data-go="reports"><span>${a}</span><strong>${b}</strong></button>`).join("")}</div>
  <div class="status-strip">${statuses.map((s) => `<button data-filter-status="${s}">${s}<strong>${state.pnms.filter((p) => p.status === s).length}</strong></button>`).join("")}</div>`;
}
function renderFinanceSummary() {
  const m = metrics();
  const expenseByCategory = groupSum(state.finance.filter((f) => ["Expense","Reimbursement","Event budget"].includes(f.type)), "category", "paid");
  return `<div class="mini-grid">${[
    ["Dues collected", money(m.duesCollected)], ["Outstanding dues", money(m.duesOutstanding)], ["Members past due", m.pastDue], ["Expense categories", Object.keys(expenseByCategory).length]
  ].map(([a,b]) => `<button class="mini-card" data-go="reports"><span>${a}</span><strong>${b}</strong></button>`).join("")}</div>`;
}
function renderCheckinPanel() {
  return `<details class="checkin"><summary>Mobile attendance check-in</summary>
    <div class="form-grid compact">
      <label>Event<select id="checkEvent">${state.events.filter((e) => !e.archived).map((e) => `<option value="${e.id}">${safe(e.date)} · ${safe(e.name)}</option>`).join("")}</select></label>
      <label>Person type<select id="checkType"><option>Member</option><option>PNM</option></select></label>
      <label>Person<select id="checkPerson">${activeMembers().map((m) => `<option value="${m.id}">${safe(memberName(m.id))}</option>`).join("")}</select></label>
      <label>Status<select id="checkStatus"><option>Present</option><option>Late</option><option>Excused</option><option>Unexcused</option></select></label>
      <button class="primary" data-record-checkin>Record attendance</button>
    </div>
  </details>`;
}

function renderLeadership() {
  return `<section class="panel"><div class="panel-head"><div><p class="eyebrow">Officers and committees</p><h3>Leadership assignments</h3></div><button class="primary" data-add-leadership>Add role</button></div>
  ${renderLeadershipCards()}</section>`;
}
function renderLeadershipCards() {
  return `<div class="card-grid">${state.leadership.map((l) => `<article class="profile-card"><p class="eyebrow">${safe(l.committee)}</p><h3>${safe(l.role)}</h3><p><strong>${safe(memberName(l.assignedMember))}</strong></p><p>${safe(l.responsibilities)}</p><p class="muted">${safe(l.relatedReports)}</p><div class="button-row"><button class="ghost small" data-edit-leadership="${l.id}">Edit</button></div></article>`).join("")}</div>`;
}

function renderReports() {
  const m = metrics();
  const pnmByStatus = groupCount(state.pnms.filter((p) => !p.archived), "status");
  const eventParticipation = state.events.filter((e) => !e.archived).map((e) => `${e.name}: ${state.attendance.filter((a) => a.eventId === e.id).length}`);
  return `<section class="panel printable">
    <div class="panel-head"><div><p class="eyebrow">Executive reports</p><h3>Chapter operations summary</h3></div><div class="button-row"><button class="ghost" data-export="reports">Export CSV</button><button class="primary" data-print>PDF / Print</button></div></div>
    <div class="mini-grid">${[
      ["Member count", state.members.filter((x) => !x.archived).length],
      ["Active / inactive", `${activeMembers().length} / ${state.members.filter((x) => x.lifecycle === "Inactive").length}`],
      ["Attendance alerts", m.attendanceIssues],
      ["Dues outstanding", money(m.duesOutstanding)],
      ["Recruitment acceptance", m.acceptanceRate],
      ["Overdue tasks", state.tasks.filter((t) => t.dueDate < todayIso() && !["Done","Archived"].includes(t.status)).length]
    ].map(([a,b]) => `<button class="mini-card"><span>${a}</span><strong>${b}</strong></button>`).join("")}</div>
    <div class="two-col">
      ${reportBlock("Recruitment summary", Object.entries(pnmByStatus).map(([k,v]) => `${k}: ${v}`))}
      ${reportBlock("Event participation", eventParticipation)}
      ${reportBlock("Members needing follow-up", followUpMembers().map((m) => `${memberName(m.id)} · ${m.attendanceRate}% attendance`))}
      ${reportBlock("PNMs needing follow-up", followUpPnms().map((p) => `${pnmName(p.id)} · due ${p.followUpDate}`))}
      ${reportBlock("Finance summary", [`Dues collected: ${money(m.duesCollected)}`, `Outstanding dues: ${money(m.duesOutstanding)}`, `Past due members: ${m.pastDue}`])}
      ${reportBlock("Exec action items", openTasks().slice(0, 10).map((t) => `${t.title} · ${t.priority} · due ${t.dueDate}`))}
    </div>
  </section>`;
}
function reportBlock(title, lines) {
  return `<section class="report-block"><h4>${title}</h4>${lines.length ? `<ul>${lines.map((l) => `<li>${safe(l)}</li>`).join("")}</ul>` : emptySmall("No items for this report.")}</section>`;
}

function renderSettings() {
  return `<section class="panel">
    <div class="panel-head"><div><p class="eyebrow">Workspace settings</p><h3>Chapter configuration</h3></div><button class="primary" data-save-settings>Save settings</button></div>
    <div class="form-grid">
      ${settingInput("chapterName","Chapter name")}
      ${settingInput("organizationName","Organization")}
      ${settingInput("schoolName","School name")}
      ${settingInput("term","Semester / term")}
      ${settingInput("academicYear","Academic year")}
      <label>Current role<select id="set_currentRole">${roles.map((r) => `<option ${state.settings.currentRole === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <label>Attendance threshold<input id="set_attendanceThreshold" type="number" min="0" max="100" value="${state.settings.attendanceThreshold}" /></label>
      <label class="wide">Privacy notice<textarea id="set_privacyNotice">${safe(state.settings.privacyNotice)}</textarea></label>
    </div>
    <div class="settings-grid">
      <div class="notice"><h4>Privacy and security</h4><p>Sign-in is required for cloud data. Real records are stored only in the chapter workspace protected by Supabase RLS. Finance and sensitive recruitment data are role-restricted in the app UI.</p></div>
      <div class="notice"><h4>Import / export</h4><p>Use CSV export for roster, recruitment, attendance, finance, and reports. JSON backup preserves the entire workspace.</p></div>
      <div class="notice"><h4>Demo data</h4><p>Reset demo creates 50 fake members, 20 fake PNMs, 8 events, finance examples, attendance examples, tasks, and committee assignments.</p></div>
    </div>
  </section>`;
}
function settingInput(key, label) {
  return `<label>${label}<input id="set_${key}" value="${safe(state.settings[key])}" /></label>`;
}
function restrictedPanel(message) {
  return `<section class="panel empty-state"><h3>Restricted area</h3><p>${safe(message)}</p><button class="ghost" data-go="settings">Switch role in settings</button></section>`;
}
function emptySmall(text) {
  return `<p class="muted">${safe(text)}</p>`;
}

function bindViewActions(root) {
  root.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => {
    const filter = el.dataset.filter;
    if (filter) applyFilter(el.dataset.go, filter);
    setView(el.dataset.go);
  }));
  root.querySelectorAll("[data-add]").forEach((el) => el.addEventListener("click", () => openForm(el.dataset.add)));
  root.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [key,id] = el.dataset.edit.split(":"); openForm(key, id); }));
  root.querySelectorAll("[data-archive]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [key,id] = el.dataset.archive.split(":"); archiveRow(key, id); }));
  root.querySelectorAll("[data-delete]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [key,id] = el.dataset.delete.split(":"); deleteRow(key, id); }));
  root.querySelectorAll("[data-status]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [id,status] = el.dataset.status.split(":"); updateStatus(id, status); }));
  root.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", (ev) => { if (ev.target.closest(".row-actions")) return; openProfile(el.dataset.open, el.dataset.id); }));
  root.querySelectorAll("[data-export]").forEach((el) => el.addEventListener("click", () => exportCsv(el.dataset.export)));
  root.querySelectorAll("[data-print]").forEach((el) => el.addEventListener("click", () => window.print()));
  root.querySelectorAll("[data-filter-status]").forEach((el) => el.addEventListener("click", () => { activeFilters.pnms = { status: el.dataset.filterStatus }; render(); }));
  const search = root.querySelector("#searchInput");
  if (search) search.addEventListener("input", () => { activeFilters[activeView === "recruitment" ? "pnms" : activeView] = { ...(activeFilters[activeView] || {}), q: search.value }; render(); });
  const checkType = root.querySelector("#checkType");
  if (checkType) checkType.addEventListener("change", refreshCheckPerson);
  const record = root.querySelector("[data-record-checkin]");
  if (record) record.addEventListener("click", recordCheckin);
  root.querySelectorAll("[data-checkin]").forEach((el) => el.addEventListener("click", () => setView("events")));
  const saveSettings = root.querySelector("[data-save-settings]");
  if (saveSettings) saveSettings.addEventListener("click", saveSettingsForm);
  root.querySelectorAll("[data-add-leadership]").forEach((el) => el.addEventListener("click", () => openLeadershipForm()));
  root.querySelectorAll("[data-edit-leadership]").forEach((el) => el.addEventListener("click", () => openLeadershipForm(el.dataset.editLeadership)));
}
function applyFilter(view, filter) {
  const key = view === "recruitment" ? "pnms" : view;
  activeFilters[key] = {};
  if (filter.includes("followup=true")) activeFilters[key].followup = true;
  if (filter.includes("pastdue=true")) activeFilters[key].pastdue = true;
  if (filter.includes("status=")) activeFilters[key].status = filter.split("status=")[1];
}
function setView(view) {
  activeView = view;
  render();
}

function openForm(key, id) {
  const meta = collectionMeta[key];
  if (!meta) return;
  const existing = state[key].find((r) => r.id === id);
  const title = existing ? `Edit ${meta.title}` : meta.addLabel;
  openModal(`<h3>${title}</h3><form id="recordForm" class="form-grid">${meta.fields.map((f) => formField(f, existing)).join("")}<div class="wide button-row"><button class="primary" type="submit">Save</button><button class="ghost" type="button" data-close-modal>Cancel</button></div></form>`);
  document.getElementById("recordForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const row = Object.fromEntries(new FormData(ev.currentTarget).entries());
    saveRow(key, row, id);
  });
}
function formField(field, existing = {}) {
  const [name,label,type,opts] = field;
  const value = existing?.[name] ?? "";
  if (type === "textarea") return `<label class="wide">${label}<textarea name="${name}">${safe(value)}</textarea></label>`;
  if (type === "select") {
    const options = opts === "members" ? activeMembers().map((m) => [m.id, memberName(m.id)]) : opts === "officerRoles" ? ["President","Internal Vice President","External Vice President","Treasurer","Assistant Treasurer","Recruitment Chair / VPMD","Secretary","Risk Manager","Brotherhood Chair","Philanthropy Chair","Social Chair","New Member Educator","Sergeant at Arms","Alumni Relations","General member"] : opts === "committees" ? ["Recruitment","Brotherhood","Philanthropy","Risk Management","Social","Finance","Alumni Relations","Operations"] : opts;
    return `<label>${label}<select name="${name}">${options.map((o) => { const val = Array.isArray(o) ? o[0] : o; const txt = Array.isArray(o) ? o[1] : o; return `<option value="${safe(val)}" ${String(value) === String(val) ? "selected" : ""}>${safe(txt)}</option>`; }).join("")}</select></label>`;
  }
  return `<label>${label}<input name="${name}" type="${type}" value="${safe(value)}" ${opts === "required" ? "required" : ""} /></label>`;
}
function saveRow(key, row, id) {
  if ((key === "members" || key === "pnms") && (!row.firstName || !row.lastName)) return toast("First and last name are required.");
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return toast("Please enter a valid email.");
  const duplicate = ["members","pnms"].includes(key) && !id && state[key].some((r) => `${r.firstName} ${r.lastName}`.toLowerCase() === `${row.firstName} ${row.lastName}`.toLowerCase() && (r.email === row.email || r.phone === row.phone));
  if (duplicate && !confirm("A similar record already exists. Create it anyway?")) return;
  snapshot(id ? `Updated ${key} record.` : `Added ${key} record.`);
  if (key === "events" && typeof row.brothersAssigned === "string") row.brothersAssigned = row.brothersAssigned.split(",").map((s) => s.trim()).filter(Boolean);
  if (id) state[key] = state[key].map((r) => r.id === id ? { ...r, ...row } : r);
  else state[key].unshift({ id: uid(key.slice(0, 1)), ...row, archived: false });
  save(); closeModal(); render();
}
function archiveRow(key, id) {
  if (!confirm("Archive this record? It will be hidden but not permanently deleted.")) return;
  snapshot(`Archived ${key} record.`);
  const row = state[key].find((r) => r.id === id);
  if (row) {
    row.archived = true;
    if (row.status) row.status = "Archived";
    if (row.lifecycle) row.lifecycle = "Archived";
  }
  save(); render(); toast("Archived. Use Undo if this was accidental.");
}
function deleteRow(key, id) {
  if (!confirm("Permanently delete this record? Archive is usually safer. Click OK only if you are sure.")) return;
  snapshot(`Deleted ${key} record.`);
  state[key] = state[key].filter((r) => r.id !== id);
  save(); render(); toast("Deleted. Use Undo if this was accidental.");
}
function updateStatus(id, status) {
  const key = activeView === "tasks" ? "tasks" : "pnms";
  const row = state[key].find((r) => r.id === id);
  if (!row) return;
  if (["Bid extended","Accepted","Declined","Archived"].includes(status) && !confirm(`Mark as ${status}? You can undo this from the top bar.`)) return;
  snapshot(`Changed ${key} status to ${status}.`);
  row.status = status;
  if (status === "Bid extended") row.bidExtendedDate ||= todayIso();
  if (status === "Accepted") { row.bidAcceptedDate ||= todayIso(); row.joinedClass = "Yes"; }
  if (status === "Declined") row.bidDeclinedDate ||= todayIso();
  save(); render(); toast("Status updated.");
}
function openProfile(key, id) {
  const row = state[key].find((r) => r.id === id);
  if (!row) return;
  const title = key === "members" ? memberName(id) : key === "pnms" ? pnmName(id) : row.name || row.title || row.type;
  const relatedAttendance = state.attendance.filter((a) => a.personId === id || a.eventId === id);
  openModal(`<h3>${safe(title)}</h3><div class="profile-grid">${Object.entries(row).map(([k,v]) => `<div><span>${labelize(k)}</span><strong>${safe(Array.isArray(v) ? v.join(", ") : v)}</strong></div>`).join("")}</div>${relatedAttendance.length ? `<h4>Attendance history</h4><ul>${relatedAttendance.map((a) => `<li>${safe(eventName(a.eventId))} · ${safe(a.personType)} · ${safe(a.status)}</li>`).join("")}</ul>` : ""}<div class="button-row"><button class="primary" data-edit="${key}:${id}">Edit</button><button class="ghost" data-close-modal>Close</button></div>`);
  document.querySelector("#modal [data-edit]")?.addEventListener("click", () => { closeModal(); openForm(key, id); });
}
function recordCheckin() {
  snapshot("Recorded attendance.");
  const personType = document.getElementById("checkType").value;
  state.attendance.unshift({ id: uid("a"), eventId: document.getElementById("checkEvent").value, personType, personId: document.getElementById("checkPerson").value, status: document.getElementById("checkStatus").value, timestamp: new Date().toISOString(), notes: "" });
  save(); render(); toast("Attendance recorded.");
}
function refreshCheckPerson() {
  const type = document.getElementById("checkType").value;
  const select = document.getElementById("checkPerson");
  const rows = type === "Member" ? activeMembers().map((m) => [m.id, memberName(m.id)]) : activePnms().map((p) => [p.id, pnmName(p.id)]);
  select.innerHTML = rows.map(([id,name]) => `<option value="${id}">${safe(name)}</option>`).join("");
}
function saveSettingsForm() {
  snapshot("Updated settings.");
  ["chapterName","organizationName","schoolName","term","academicYear","attendanceThreshold","privacyNotice","currentRole"].forEach((k) => {
    const el = document.getElementById(`set_${k}`);
    if (el) state.settings[k] = el.value;
  });
  save(); render(); toast("Settings saved.");
}
function openLeadershipForm(id) {
  const existing = state.leadership.find((l) => l.id === id);
  const fields = [["role","Role","text","required"],["assignedMember","Assigned member","select","members"],["committee","Committee","text"],["responsibilities","Responsibilities","textarea"],["relatedReports","Related reports","text"]];
  openModal(`<h3>${existing ? "Edit leadership role" : "Add leadership role"}</h3><form id="leadershipForm" class="form-grid">${fields.map((f) => formField(f, existing)).join("")}<div class="wide button-row"><button class="primary">Save</button><button class="ghost" type="button" data-close-modal>Cancel</button></div></form>`);
  document.getElementById("leadershipForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    snapshot(existing ? "Updated leadership role." : "Added leadership role.");
    const row = Object.fromEntries(new FormData(ev.currentTarget).entries());
    if (existing) Object.assign(existing, row); else state.leadership.unshift({ id: uid("l"), ...row });
    save(); closeModal(); render();
  });
}

function groupCount(rows, field) {
  return rows.reduce((acc, row) => ((acc[row[field] || "Unspecified"] = (acc[row[field] || "Unspecified"] || 0) + 1), acc), {});
}
function groupSum(rows, groupField, sumField) {
  return rows.reduce((acc, row) => ((acc[row[groupField] || "Unspecified"] = (acc[row[groupField] || "Unspecified"] || 0) + Number(row[sumField] || 0)), acc), {});
}
function openModal(html) {
  document.getElementById("modal").innerHTML = html;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModal));
}
function closeModal() {
  document.getElementById("modalBackdrop").classList.add("hidden");
}
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2800);
}
function exportCsv(key) {
  const rows = key === "reports" ? [
    { report: "Active members", value: metrics().activeMembers },
    { report: "PNMs needing follow-up", value: metrics().pnmFollowUps },
    { report: "Outstanding dues", value: metrics().duesOutstanding },
    { report: "Open tasks", value: metrics().openTasks }
  ] : key === "attendance" ? state.attendance : (state[key] || filteredRows(key));
  const flatRows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([k,v]) => [k, Array.isArray(v) ? v.join("; ") : v])));
  const headers = Object.keys(flatRows[0] || { empty: "" });
  const csv = [headers.join(","), ...flatRows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"','""')}"`).join(","))].join("\n");
  download(`${key}-export.csv`, csv, "text/csv");
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
function exportBackup() {
  download("chapterops-alpha-omega-backup.json", JSON.stringify(state, null, 2), "application/json");
}
function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      snapshot("Imported workspace data.");
      if (file.name.endsWith(".json")) state = normalize(JSON.parse(reader.result));
      else importCsvRows(reader.result);
      save(); render(); toast("Import complete.");
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
}
function importCsvRows(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const headers = head.split(",").map((h) => h.trim());
  const rows = lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [headers[i], v.replace(/^"|"$/g, "")])));
  const target = confirm("Import these rows as PNMs? Click Cancel to import as members.") ? "pnms" : "members";
  rows.forEach((row) => state[target].push({ id: uid(target[0]), archived: false, ...row }));
}
function undo() {
  const last = historyStack.pop();
  if (!last) return toast("Nothing to undo.");
  state = normalize(JSON.parse(last));
  save(); render(); toast("Last change undone.");
}

document.addEventListener("click", (ev) => {
  if (ev.target.id === "modalBackdrop") closeModal();
});
document.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
document.getElementById("signInBtn").addEventListener("click", signIn);
document.getElementById("signOutBtn").addEventListener("click", signOut);
document.getElementById("syncBtn").addEventListener("click", () => syncCloudWorkspace(true));
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("exportBtn").addEventListener("click", exportBackup);
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (ev) => ev.target.files[0] && importFile(ev.target.files[0]));
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Reset to fresh demo data? Export a backup first if you have real edits.")) return;
  snapshot("Reset demo data.");
  state = buildDemoData();
  save(); render(); toast("Demo data reset.");
});

initCloud().finally(render);
