const storeKey = "chapterops_alpha_omega_real_v2";
const oldStoreKeys = ["chapterops_alpha_omega_v1", "chapterops-lite-web-v1"];
const orgStoreKey = "chapterops_cloud_org_id";

const todayIso = () => new Date().toISOString().slice(0, 10);
const money = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n, d) => d ? `${Math.round((n / d) * 100)}%` : "0%";
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const safe = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
const parseMoney = (v) => Number(String(v || 0).replace(/[$,]/g, "")) || 0;

const viewNames = {
  dashboard: "Executive Dashboard",
  members: "Member Roster",
  recruitment: "Recruitment / PNMs",
  events: "Events & Attendance",
  finance: "Treasurer / Dues",
  tasks: "Tasks / Follow-Ups",
  leadership: "Officers & Committees",
  reports: "Reports",
  settings: "Setup / Settings"
};

const permissionRoles = ["Admin", "Treasurer", "Assistant Treasurer", "President", "Exec Board", "Committee Chair", "Active Member", "Read-only Advisor"];
const roleRules = {
  Admin: ["all"],
  Treasurer: ["view_all", "manage_finance", "view_finance", "manage_tasks"],
  "Assistant Treasurer": ["view_all", "manage_finance", "view_finance", "manage_tasks"],
  President: ["view_all", "view_finance", "manage_members", "manage_events", "manage_tasks", "view_reports"],
  "Exec Board": ["view_all", "view_reports"],
  "Committee Chair": ["view_basic", "manage_events", "manage_tasks"],
  "Active Member": ["view_basic", "manage_own_tasks"],
  "Read-only Advisor": ["view_reports"]
};

const defaults = {
  officerRoles: ["President", "Internal Vice President", "External Vice President", "Treasurer", "Assistant Treasurer", "Recruitment Chair / VPMD", "Secretary", "Risk Manager", "Brotherhood Chair", "Philanthropy Chair", "Social Chair", "New Member Educator", "Sergeant at Arms", "Alumni Relations", "General member"],
  memberStatuses: ["Active", "New Member", "Inactive", "Alumni", "Archived"],
  eventTypes: ["Chapter", "Brotherhood", "Recruitment", "Philanthropy", "Social", "New member education", "Executive meeting", "Committee meeting", "Risk management", "Alumni", "Other"],
  committees: ["Executive", "Recruitment", "Brotherhood", "Philanthropy", "Risk Management", "Social", "Finance", "Alumni Relations", "Operations"],
  paymentStatuses: ["Not billed", "Unpaid", "Partially paid", "Paid", "Past due", "Payment plan", "Waived", "Archived"]
};

let activeView = "dashboard";
let activeFilters = {};
let historyStack = [];
let cloud = { client: null, user: null, organizationId: localStorage.getItem(orgStoreKey) };
let state = load();

const can = (permission) => roleRules[state.settings.currentRole]?.includes("all") || roleRules[state.settings.currentRole]?.includes(permission);
const canManage = (area) => can("all") || can(`manage_${area}`);

function emptyWorkspace() {
  return {
    version: 2,
    settings: {
      chapterName: "Alpha Omega Chapter of Pi Kappa Alpha",
      organizationName: "Pi Kappa Alpha",
      schoolName: "Kansas State University",
      term: "",
      academicYear: "",
      defaultDuesAmount: "",
      duesDueDates: "",
      attendanceThreshold: 80,
      currentRole: "Admin",
      officerRoles: [...defaults.officerRoles],
      memberStatuses: [...defaults.memberStatuses],
      eventTypes: [...defaults.eventTypes],
      committees: [...defaults.committees],
      permissionRoles: [...permissionRoles],
      setupComplete: false,
      privacyNotice: "ChapterOps Lite is for Alpha Omega chapter operations only. Sign in before entering real member, dues, attendance, PNM, or finance information. Financial notes and sensitive notes should be limited to necessary chapter operations."
    },
    members: [],
    pnms: [],
    events: [],
    attendance: [],
    finance: [],
    tasks: [],
    leadership: [],
    activity: []
  };
}

function load() {
  try {
    const saved = localStorage.getItem(storeKey);
    return saved ? normalize(JSON.parse(saved)) : emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

function normalize(data = {}) {
  if (looksLikeLegacySample(data)) return emptyWorkspace();
  const base = emptyWorkspace();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    members: data.members || [],
    pnms: data.pnms || [],
    events: data.events || [],
    attendance: data.attendance || [],
    finance: data.finance || data.dues || [],
    tasks: data.tasks || [],
    leadership: data.leadership || [],
    activity: data.activity || []
  };
}

function looksLikeLegacySample(data) {
  return data.version !== 2 && data.members?.length >= 40 && data.pnms?.length >= 15;
}

function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function snapshot(action, related = {}) {
  historyStack.push(JSON.stringify(state));
  if (historyStack.length > 25) historyStack.shift();
  logActivity(action, related);
}

function logActivity(action, related = {}) {
  state.activity.unshift({
    id: uid("log"),
    action,
    actor: cloud.user?.email || state.settings.currentRole || "Local user",
    at: new Date().toISOString(),
    relatedType: related.type || "",
    relatedId: related.id || "",
    description: related.description || action
  });
  state.activity = state.activity.slice(0, 150);
}

async function initCloud() {
  const cfg = window.CHAPTEROPS_CONFIG;
  if (!window.supabase || !cfg?.supabaseUrl || !cfg?.supabasePublishableKey) return updateCloudUi("Local mode — sign-in unavailable");
  cloud.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const { data } = await cloud.client.auth.getSession();
  cloud.user = data.session?.user || null;
  cloud.client.auth.onAuthStateChange(async (_event, session) => {
    cloud.user = session?.user || null;
    updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Sign in required for real cloud data");
    if (cloud.user) await loadCloudWorkspace();
    render();
  });
  if (cloud.user) await loadCloudWorkspace();
  updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Sign in required for real cloud data");
}

function updateCloudUi(message) {
  document.getElementById("cloudStatus").textContent = message;
  document.getElementById("signInBtn").classList.toggle("hidden", !!cloud.user);
  document.getElementById("syncBtn").classList.toggle("hidden", !cloud.user);
  document.getElementById("signOutBtn").classList.toggle("hidden", !cloud.user);
}

async function signIn() {
  if (!cloud.client) return toast("Supabase is not configured.");
  const email = prompt("Enter your email address for a secure sign-in link:");
  if (!email) return;
  const { error } = await cloud.client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  toast(error ? error.message : "Check your email for the sign-in link.");
}

async function signOut() {
  if (cloud.client) await cloud.client.auth.signOut();
  cloud.user = null;
  updateCloudUi("Signed out");
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
    if (data?.state) state = normalize(data.state);
    else await syncCloudWorkspace(false);
    save();
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

const activeMembers = () => state.members.filter((m) => !m.archived && m.lifecycle !== "Archived" && m.memberStatus !== "Archived");
const memberName = (id) => state.members.find((m) => m.id === id) ? `${state.members.find((m) => m.id === id).firstName} ${state.members.find((m) => m.id === id).lastName}` : "";
const pnmName = (id) => state.pnms.find((p) => p.id === id) ? `${state.pnms.find((p) => p.id === id).firstName} ${state.pnms.find((p) => p.id === id).lastName}` : "";
const eventName = (id) => state.events.find((e) => e.id === id)?.name || "";
const activePnms = () => state.pnms.filter((p) => !p.archived && p.status !== "Archived");
const upcomingEvents = () => state.events.filter((e) => !e.archived && e.date && e.date >= todayIso()).sort((a,b) => a.date.localeCompare(b.date));
const openTasks = () => state.tasks.filter((t) => !t.archived && !["Done", "Archived"].includes(t.status));

function financeRows() {
  return state.finance.filter((f) => !f.archived && f.status !== "Archived");
}

function memberFinance(memberId) {
  const rows = financeRows().filter((f) => f.memberId === memberId);
  const charges = rows.filter((f) => f.type === "Charge").reduce((s, f) => s + parseMoney(f.amount), 0);
  const payments = rows.filter((f) => f.type === "Payment").reduce((s, f) => s + parseMoney(f.amount), 0);
  const waived = rows.filter((f) => f.status === "Waived").reduce((s, f) => s + parseMoney(f.amount), 0);
  const balance = Math.max(0, charges - payments - waived);
  const nextDue = rows.filter((f) => f.type === "Charge" && f.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate || "";
  const status = balance === 0 && charges > 0 ? "Paid" : rows.some((f) => f.status === "Payment plan") ? "Payment plan" : rows.some((f) => f.dueDate && f.dueDate < todayIso() && balance > 0) ? "Past due" : payments > 0 ? "Partially paid" : charges > 0 ? "Unpaid" : "Not billed";
  return { rows, charges, payments, waived, balance, nextDue, status };
}

function metrics() {
  const memberBalances = activeMembers().map((m) => memberFinance(m.id));
  const totalBilled = financeRows().filter((f) => f.type === "Charge").reduce((s, f) => s + parseMoney(f.amount), 0);
  const totalCollected = financeRows().filter((f) => f.type === "Payment").reduce((s, f) => s + parseMoney(f.amount), 0);
  const outstanding = memberBalances.reduce((s, f) => s + f.balance, 0);
  const bidsExtended = state.pnms.filter((p) => ["Bid extended", "Accepted", "Declined"].includes(p.status) || p.bidExtendedDate).length;
  const bidsAccepted = state.pnms.filter((p) => p.status === "Accepted" || p.bidAcceptedDate).length;
  return {
    members: activeMembers().length,
    newMembers: activeMembers().filter((m) => m.initiationStatus === "New Member" || m.memberStatus === "New Member").length,
    pnms: activePnms().length,
    events: upcomingEvents().length,
    tasks: openTasks().length,
    totalBilled,
    totalCollected,
    outstanding,
    unpaid: memberBalances.filter((f) => f.status === "Unpaid").length,
    partial: memberBalances.filter((f) => f.status === "Partially paid").length,
    paid: memberBalances.filter((f) => f.status === "Paid").length,
    pastDue: memberBalances.filter((f) => f.status === "Past due").length,
    plans: memberBalances.filter((f) => f.status === "Payment plan").length,
    pnmFollowUps: activePnms().filter((p) => p.followUpDate && p.followUpDate <= todayIso()).length,
    bidsExtended,
    bidsAccepted,
    acceptanceRate: pct(bidsAccepted, bidsExtended)
  };
}

const collectionMeta = {
  members: {
    title: "Member roster",
    permission: "manage_members",
    addLabel: "Add member",
    emptyTitle: "No members added yet.",
    emptyText: "Add your first member or import a roster to begin building the Alpha Omega database.",
    search: ["firstName", "lastName", "phone", "email", "schoolYear", "major", "hometown", "memberStatus", "initiationStatus", "officerRole", "committee", "duesStatus", "tags"],
    columns: ["name", "phone", "email", "schoolYear", "memberStatus", "initiationStatus", "officerRole", "committee", "duesStatus", "lifecycle"],
    fields: [
      ["firstName", "First name", "text", "required"], ["lastName", "Last name", "text", "required"], ["phone", "Phone number", "tel"], ["email", "Email", "email"], ["schoolYear", "School year", "select", ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]],
      ["major", "Major", "text"], ["hometown", "Hometown", "text"], ["memberStatus", "Member status", "select", "memberStatuses"], ["initiationStatus", "Initiation/new member status", "select", ["Member", "New Member", "Alumni", "Not applicable"]],
      ["officerRole", "Officer role", "select", "officerRoles"], ["committee", "Committee", "select", "committees"], ["housingStatus", "Housing status", "select", ["Not tracked", "In house", "Out of house"]], ["duesStatus", "Dues status", "select", defaults.paymentStatuses],
      ["notes", "Notes", "textarea"], ["tags", "Tags", "text"], ["lifecycle", "Active / inactive / alumni / archived", "select", ["Active", "Inactive", "Alumni", "Archived"]]
    ]
  },
  pnms: {
    title: "PNM tracking",
    permission: "manage_recruitment",
    addLabel: "Add PNM",
    emptyTitle: "No PNMs added yet.",
    emptyText: "Add a potential new member when recruitment starts, or import a PNM list.",
    search: ["firstName", "lastName", "phone", "email", "hometown", "major", "schoolYear", "referralSource", "referredBy", "assignedRecruiter", "status", "tags"],
    columns: ["name", "phone", "email", "schoolYear", "referralSource", "assignedRecruiter", "status", "followUpDate"],
    fields: [
      ["firstName", "First name", "text", "required"], ["lastName", "Last name", "text", "required"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["social", "Instagram / social link", "text"], ["hometown", "Hometown", "text"], ["major", "Major", "text"], ["schoolYear", "School year", "select", ["Freshman", "Sophomore", "Junior", "Senior"]],
      ["referralSource", "Referral source", "text"], ["referredBy", "Who referred them", "text"], ["assignedRecruiter", "Assigned brother/recruiter", "select", "members"], ["status", "Current status", "select", ["New lead", "Contacted", "Interested", "Event attended", "Ready for review", "Approved for bid", "Bid extended", "Accepted", "Declined", "Not a fit", "Archived"]],
      ["followUpDate", "Follow-up date", "date"], ["bidExtendedDate", "Bid extended date", "date"], ["bidAcceptedDate", "Bid accepted date", "date"], ["bidDeclinedDate", "Bid declined date", "date"], ["joinedClass", "Joined new member class", "select", ["No", "Yes"]], ["notes", "Notes", "textarea"], ["tags", "Tags", "text"]
    ]
  },
  events: {
    title: "Events and attendance",
    permission: "manage_events",
    addLabel: "Add event",
    emptyTitle: "No events added yet.",
    emptyText: "Add your first chapter event, then mark attendance from a phone or laptop.",
    search: ["name", "date", "location", "type", "required", "description", "notes"],
    columns: ["name", "date", "time", "location", "type", "required", "memberAttendanceCount", "pnmAttendanceCount"],
    fields: [
      ["name", "Event name", "text", "required"], ["date", "Date", "date", "required"], ["time", "Time", "time"], ["location", "Location", "text"], ["type", "Event type", "select", "eventTypes"], ["required", "Required or optional", "select", ["Required", "Optional"]],
      ["description", "Description", "textarea"], ["notes", "Notes", "textarea"]
    ]
  },
  finance: {
    title: "Treasurer dues ledger",
    permission: "manage_finance",
    addLabel: "Add dues charge / payment",
    emptyTitle: "No dues records yet.",
    emptyText: "Create a dues charge for one member, bill multiple members, or import existing balances.",
    search: ["type", "memberId", "category", "status", "paymentMethod", "notes", "treasurerNotes"],
    columns: ["type", "memberId", "amount", "status", "dueDate", "paymentDate", "paymentMethod", "balanceAfter", "treasurerNotes"],
    fields: [
      ["type", "Entry type", "select", ["Charge", "Payment", "Adjustment"]], ["memberId", "Member", "select", "members"], ["amount", "Amount", "number", "required"], ["category", "Category", "text"], ["status", "Payment status", "select", defaults.paymentStatuses],
      ["dueDate", "Due date", "date"], ["paymentDate", "Payment date", "date"], ["paymentMethod", "Payment method", "select", ["", "Cash", "Check", "Venmo", "Zelle", "Card", "Bank transfer", "Other"]], ["paymentPlan", "Payment plan", "select", ["No", "Yes"]],
      ["notes", "Payment notes", "textarea"], ["treasurerNotes", "Treasurer notes", "textarea"]
    ]
  },
  tasks: {
    title: "Officer tasks and follow-ups",
    permission: "manage_tasks",
    addLabel: "Create task",
    emptyTitle: "No tasks created yet.",
    emptyText: "Create a task for dues follow-up, event logistics, reports, roster cleanup, or officer work.",
    search: ["title", "description", "assignedPerson", "priority", "status", "relatedType", "notes"],
    columns: ["title", "assignedPerson", "dueDate", "priority", "status", "relatedType", "notes"],
    fields: [
      ["title", "Title", "text", "required"], ["description", "Description", "textarea"], ["assignedPerson", "Assigned person", "select", "members"], ["dueDate", "Due date", "date"], ["priority", "Priority", "select", ["High", "Medium", "Low"]], ["status", "Status", "select", ["Not started", "In progress", "Waiting", "Done", "Archived"]],
      ["relatedMember", "Related member", "select", "members"], ["relatedEvent", "Related event", "select", "events"], ["relatedFinanceItem", "Related finance item ID", "text"], ["notes", "Notes", "textarea"]
    ]
  }
};

function render() {
  document.getElementById("viewTitle").textContent = viewNames[activeView];
  document.getElementById("orgLabel").textContent = `${state.settings.chapterName} · ${state.settings.schoolName}`;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === activeView));
  document.getElementById("resetBtn").textContent = "Clear workspace";
  const root = document.getElementById("appRoot");
  if (cloud.client && !cloud.user) {
    root.innerHTML = renderLoginGate();
    return;
  }
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

function renderLoginGate() {
  return `<section class="hero">
    <div>
      <p class="eyebrow">Private chapter operations</p>
      <h3>Sign in to access Alpha Omega Chapter Operations.</h3>
      <p>This workspace can contain member records, dues, payments, attendance, tasks, and notes. For privacy, chapter data is not shown until you sign in.</p>
    </div>
    <div class="hero-actions">
      <button class="primary" onclick="document.getElementById('signInBtn').click()">Sign in</button>
    </div>
  </section>
  <section class="panel">
    <div class="panel-head"><h3>Ready for real setup</h3><span class="pill">Kansas State · Alpha Omega PIKE</span></div>
    <p class="muted">After login, complete setup and start entering or importing the real roster and dues records with the Treasurer.</p>
  </section>`;
}

function renderDashboard() {
  const m = metrics();
  const needsSetup = !state.settings.setupComplete || !state.settings.term || !state.settings.academicYear;
  return `
    ${needsSetup ? renderSetupPrompt() : ""}
    <section class="hero">
      <div>
        <p class="eyebrow">Real Alpha Omega workspace</p>
        <h3>Ready for Kansas State PIKE chapter operations.</h3>
        <p>No sample chapter records are seeded. Start by completing setup, then add or import the real roster and dues records with the Treasurer.</p>
      </div>
      <div class="hero-actions">
        <button class="primary" data-go="settings">Finish setup</button>
        <button class="primary" data-add="members">Add member</button>
        <button class="ghost" data-import="members">Import roster</button>
      </div>
    </section>
    <div class="kpi-grid">
      ${metricCard("Active members", m.members, "members")}
      ${metricCard("New members", m.newMembers, "members", "memberStatus=New Member")}
      ${metricCard("PNMs", m.pnms, "recruitment")}
      ${metricCard("Upcoming events", m.events, "events")}
      ${metricCard("Total dues billed", money(m.totalBilled), "finance")}
      ${metricCard("Dues collected", money(m.totalCollected), "finance", "type=Payment")}
      ${metricCard("Outstanding balance", money(m.outstanding), "finance", "outstanding=true")}
      ${metricCard("Past due members", m.pastDue, "finance", "pastdue=true")}
      ${metricCard("Unpaid", m.unpaid, "finance", "status=Unpaid")}
      ${metricCard("Partially paid", m.partial, "finance", "status=Partially paid")}
      ${metricCard("Paid", m.paid, "finance", "status=Paid")}
      ${metricCard("Open tasks", m.tasks, "tasks", "status=open")}
    </div>
    <div class="three-col">
      ${listPanel("Treasurer snapshot", [
        `Expected total: ${money(m.totalBilled)}<span>Based on dues charges entered</span>`,
        `Collected: ${money(m.totalCollected)}<span>Payments recorded</span>`,
        `Payment plans: ${m.plans}<span>Members marked on payment plans</span>`
      ], "finance")}
      ${listPanel("Next steps", getNextSteps(), "settings")}
      ${listPanel("Recent activity", state.activity.slice(0, 8).map((a) => `${new Date(a.at).toLocaleString()}<span>${safe(a.action)}</span>`), "reports")}
    </div>
    <section class="panel">
      <div class="panel-head"><h3>Quick actions</h3><span class="pill">Built for Treasurer + exec entry</span></div>
      <div class="quick-grid">
        <button class="action-tile" data-add="members">Add member</button>
        <button class="action-tile" data-import="members">Import roster</button>
        <button class="action-tile" data-add="finance">Add dues charge</button>
        <button class="action-tile" data-bulk-charge>Bill multiple members</button>
        <button class="action-tile" data-record-payment>Record payment</button>
        <button class="action-tile" data-add="events">Add event</button>
        <button class="action-tile" data-add="tasks">Create task</button>
      </div>
    </section>`;
}

function renderSetupPrompt() {
  return `<section class="panel setup-panel">
    <div class="panel-head"><div><p class="eyebrow">First-time setup</p><h3>Configure Alpha Omega before entering real data.</h3></div><button class="primary" data-go="settings">Open setup</button></div>
    <p class="muted">Set term, academic year, default dues amount, due dates, roles, committees, and permissions. The app stays useful even while every data table is empty.</p>
  </section>`;
}

function getNextSteps() {
  const steps = [];
  if (!state.settings.setupComplete) steps.push("Complete setup<span>Term, academic year, dues defaults, roles</span>");
  if (!state.members.length) steps.push("Add or import members<span>Roster is the foundation for dues and attendance</span>");
  if (!state.finance.length) steps.push("Create dues charges<span>Use one member or bulk billing</span>");
  if (!state.events.length) steps.push("Add first chapter event<span>Then record attendance</span>");
  if (!steps.length) steps.push("Workspace is ready<span>Keep syncing cloud backups</span>");
  return steps;
}

function metricCard(label, value, view, filter = "") {
  return `<button class="kpi-card" data-go="${view}" data-filter="${safe(filter)}"><span>${label}</span><strong>${value}</strong><em>Open records</em></button>`;
}

function listPanel(title, rows, view) {
  return `<section class="panel"><div class="panel-head"><h3>${title}</h3><button class="ghost small" data-go="${view}">Open</button></div><div class="stack-list">${rows.length ? rows.map((r) => `<div class="stack-item">${r}</div>`).join("") : emptySmall("Nothing to show yet.")}</div></section>`;
}

function renderCollection(key) {
  if (key === "finance" && !can("view_finance") && !can("all")) return restrictedPanel("Financial data is restricted to Admin, Treasurer, Assistant Treasurer, and President roles.");
  const meta = collectionMeta[key];
  const rows = filteredRows(key);
  return `<section class="panel">
    <div class="panel-head">
      <div><p class="eyebrow">${key === "finance" ? "Treasurer module" : "Chapter module"}</p><h3>${meta.title}</h3></div>
      <div class="button-row">
        <input class="search" id="searchInput" placeholder="Search ${meta.title.toLowerCase()}" value="${safe(activeFilters[key]?.q || "")}" />
        <button class="ghost" data-import="${key}">Import CSV</button>
        <button class="ghost" data-export="${key}">Export CSV</button>
        ${actionAllowed(key) ? `<button class="primary" data-add="${key}">${meta.addLabel}</button>` : ""}
      </div>
    </div>
    ${key === "finance" ? renderTreasurerDashboard() : ""}
    ${key === "events" ? renderCheckinPanel() : ""}
    ${key === "pnms" ? renderRecruitmentSummary() : ""}
    ${renderTable(key, rows)}
  </section>`;
}

function actionAllowed(key) {
  if (key === "pnms") return can("all") || can("manage_recruitment") || can("view_all");
  if (key === "members") return can("all") || can("manage_members") || can("view_all");
  if (key === "events") return can("all") || can("manage_events");
  if (key === "finance") return can("all") || can("manage_finance");
  if (key === "tasks") return can("all") || can("manage_tasks");
  return can("all");
}

function filteredRows(key) {
  const q = (activeFilters[key]?.q || "").toLowerCase();
  let rows = (state[key] || []).filter((r) => !r.archived && r.status !== "Archived" && r.lifecycle !== "Archived");
  if (key === "finance" && activeFilters[key]?.outstanding) rows = activeMembers().map((m) => ({ ...memberFinance(m.id), id: m.id, memberId: m.id, type: "Member balance", amount: memberFinance(m.id).charges, balanceAfter: memberFinance(m.id).balance, status: memberFinance(m.id).status, dueDate: memberFinance(m.id).nextDue })).filter((r) => r.balance > 0);
  if (key === "finance" && activeFilters[key]?.pastdue) rows = activeMembers().map((m) => ({ ...memberFinance(m.id), id: m.id, memberId: m.id, type: "Member balance", amount: memberFinance(m.id).charges, balanceAfter: memberFinance(m.id).balance, status: memberFinance(m.id).status, dueDate: memberFinance(m.id).nextDue })).filter((r) => r.status === "Past due");
  if (activeFilters[key]?.status) rows = rows.filter((r) => r.status === activeFilters[key].status || r.memberStatus === activeFilters[key].status);
  if (activeFilters[key]?.type) rows = rows.filter((r) => r.type === activeFilters[key].type);
  if (!q) return rows;
  const fields = collectionMeta[key].search || [];
  return rows.filter((row) => fields.some((field) => String(field === "memberId" ? memberName(row[field]) : row[field] || "").toLowerCase().includes(q)));
}

function renderTable(key, rows) {
  const meta = collectionMeta[key];
  if (!rows.length) return renderEmptyState(key);
  const cols = meta.columns;
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${labelize(c)}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr data-open="${key}" data-id="${row.id}">${cols.map((c) => `<td data-label="${labelize(c)}">${formatCell(key, row, c)}</td>`).join("")}<td data-label="Actions">${rowActions(key, row)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderEmptyState(key) {
  const meta = collectionMeta[key];
  return `<div class="empty-state">
    <h3>${meta.emptyTitle}</h3>
    <p>${meta.emptyText}</p>
    <div class="button-row centered">
      ${actionAllowed(key) ? `<button class="primary" data-add="${key}">${meta.addLabel}</button>` : ""}
      <button class="ghost" data-import="${key}">Import CSV</button>
      ${key === "finance" ? `<button class="ghost" data-bulk-charge>Bill multiple members</button>` : ""}
    </div>
  </div>`;
}

function rowActions(key, row) {
  if (key === "finance" && row.type === "Member balance") {
    return `<div class="row-actions"><button class="small ghost" data-record-payment="${row.memberId || row.id || ""}">Record payment</button></div>`;
  }
  const editable = actionAllowed(key);
  const quick = key === "finance" ? `<button class="small ghost" data-record-payment="${row.memberId || ""}">Record payment</button>` : key === "tasks" ? `<button class="small ghost" data-task-done="${row.id}">Done</button>` : "";
  return `<div class="row-actions">${quick}${editable ? `<button class="small ghost" data-edit="${key}:${row.id}">Edit</button><button class="small ghost" data-archive="${key}:${row.id}">Archive</button>${can("all") ? `<button class="small danger" data-delete="${key}:${row.id}">Delete</button>` : ""}` : ""}</div>`;
}

function formatCell(key, row, col) {
  if (col === "name") return `<button class="linklike">${safe(row.firstName)} ${safe(row.lastName)}</button>`;
  if (["memberId", "assignedPerson", "assignedRecruiter", "relatedMember"].includes(col)) return safe(memberName(row[col]));
  if (col === "relatedEvent") return safe(eventName(row[col]));
  if (col === "amount" || col === "balanceAfter") return money(col === "balanceAfter" ? (row.balanceAfter ?? memberFinance(row.memberId).balance) : row[col]);
  if (col === "memberAttendanceCount") return state.attendance.filter((a) => a.eventId === row.id && a.personType === "Member").length;
  if (col === "pnmAttendanceCount") return state.attendance.filter((a) => a.eventId === row.id && a.personType === "PNM").length;
  return safe(row[col]);
}

function labelize(text) {
  return text.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function renderTreasurerDashboard() {
  const m = metrics();
  return `<section class="treasurer-dash">
    <div class="mini-grid">
      ${mini("Total dues billed", money(m.totalBilled))}
      ${mini("Total collected", money(m.totalCollected))}
      ${mini("Outstanding", money(m.outstanding))}
      ${mini("Unpaid", m.unpaid)}
      ${mini("Partially paid", m.partial)}
      ${mini("Past due", m.pastDue)}
    </div>
    <div class="button-row">
      <button class="primary" data-add="finance">Add charge/payment</button>
      <button class="ghost" data-bulk-charge>Bulk dues charge</button>
      <button class="ghost" data-record-payment>Record payment</button>
      <button class="ghost" data-export="outstanding">Export outstanding balances</button>
      <button class="ghost" data-print>PDF / Print summary</button>
    </div>
  </section>`;
}

function mini(label, value) {
  return `<button class="mini-card" data-go="finance"><span>${label}</span><strong>${value}</strong></button>`;
}

function renderRecruitmentSummary() {
  const statuses = ["New lead", "Contacted", "Interested", "Event attended", "Ready for review", "Approved for bid", "Bid extended", "Accepted", "Declined"];
  return `<div class="status-strip">${statuses.map((s) => `<button data-filter-status="${s}">${s}<strong>${state.pnms.filter((p) => p.status === s).length}</strong></button>`).join("")}</div>`;
}

function renderCheckinPanel() {
  const events = state.events.filter((e) => !e.archived);
  if (!events.length) return "";
  return `<details class="checkin"><summary>Mobile attendance check-in</summary>
    <div class="form-grid compact">
      <label>Event<select id="checkEvent">${events.map((e) => `<option value="${e.id}">${safe(e.date)} · ${safe(e.name)}</option>`).join("")}</select></label>
      <label>Person type<select id="checkType"><option>Member</option><option>PNM</option></select></label>
      <label>Person<select id="checkPerson">${activeMembers().map((m) => `<option value="${m.id}">${safe(memberName(m.id))}</option>`).join("")}</select></label>
      <label>Status<select id="checkStatus"><option>Present</option><option>Late</option><option>Excused</option><option>Unexcused</option></select></label>
      <button class="primary" data-record-checkin>Record attendance</button>
    </div>
  </details>`;
}

function renderLeadership() {
  const hasRows = state.leadership.length;
  return `<section class="panel">
    <div class="panel-head"><div><p class="eyebrow">Officers and committees</p><h3>Leadership assignments</h3></div><button class="primary" data-add-leadership>Add officer / committee role</button></div>
    ${hasRows ? `<div class="card-grid">${state.leadership.map((l) => `<article class="profile-card"><p class="eyebrow">${safe(l.committee)}</p><h3>${safe(l.role)}</h3><p><strong>${safe(memberName(l.assignedMember) || "Unassigned")}</strong></p><p>${safe(l.responsibilities)}</p><div class="button-row"><button class="ghost small" data-edit-leadership="${l.id}">Edit</button></div></article>`).join("")}</div>` : `<div class="empty-state"><h3>No officer roles assigned yet.</h3><p>Add the Treasurer, President, Assistant Treasurer, and other roles once the real roster is entered.</p><button class="primary" data-add-leadership>Add first role</button></div>`}
  </section>`;
}

function renderReports() {
  const m = metrics();
  const reportsEmpty = !state.members.length && !state.finance.length && !state.events.length && !state.tasks.length;
  return `<section class="panel printable">
    <div class="panel-head"><div><p class="eyebrow">Reports</p><h3>Executive and Treasurer reports</h3></div><div class="button-row"><button class="ghost" data-export="reports">Export summary CSV</button><button class="primary" data-print>PDF / Print</button></div></div>
    ${reportsEmpty ? `<div class="empty-state"><h3>Reports will populate once real data is entered.</h3><p>Add members, dues charges, payments, events, attendance, and tasks to generate useful reports.</p><div class="button-row centered"><button class="primary" data-go="members">Add members</button><button class="ghost" data-go="finance">Open dues tracker</button></div></div>` : ""}
    <div class="mini-grid">
      ${mini("Member roster", state.members.filter((m) => !m.archived).length)}
      ${mini("Dues report", money(m.totalBilled))}
      ${mini("Outstanding balances", money(m.outstanding))}
      ${mini("Payment history", state.finance.filter((f) => f.type === "Payment").length)}
      ${mini("Attendance records", state.attendance.length)}
      ${mini("Open officer tasks", m.tasks)}
    </div>
    <div class="two-col">
      ${reportBlock("Outstanding balances", activeMembers().map((m) => ({ name: memberName(m.id), ...memberFinance(m.id) })).filter((x) => x.balance > 0).map((x) => `${x.name}: ${money(x.balance)} · ${x.status}`))}
      ${reportBlock("Payment history", financeRows().filter((f) => f.type === "Payment").slice(0, 25).map((f) => `${memberName(f.memberId)} · ${money(f.amount)} · ${f.paymentDate || ""}`))}
      ${reportBlock("Attendance report", state.attendance.slice(0, 25).map((a) => `${eventName(a.eventId)} · ${a.personType === "Member" ? memberName(a.personId) : pnmName(a.personId)} · ${a.status}`))}
      ${reportBlock("Officer task report", openTasks().slice(0, 25).map((t) => `${t.title} · ${t.status} · due ${t.dueDate || "not set"}`))}
    </div>
  </section>`;
}

function reportBlock(title, lines) {
  return `<section class="report-block"><h4>${title}</h4>${lines.length ? `<ul>${lines.map((l) => `<li>${safe(l)}</li>`).join("")}</ul>` : emptySmall("No records yet.")}</section>`;
}

function renderSettings() {
  return `<section class="panel">
    <div class="panel-head"><div><p class="eyebrow">First-time setup</p><h3>Chapter configuration</h3></div><button class="primary" data-save-settings>Save setup</button></div>
    <div class="form-grid">
      ${settingInput("chapterName", "Chapter name")}
      ${settingInput("schoolName", "School")}
      ${settingInput("term", "Term / semester")}
      ${settingInput("academicYear", "Academic year")}
      ${settingInput("defaultDuesAmount", "Default dues amount", "number")}
      ${settingInput("duesDueDates", "Dues due dates")}
      <label>Current role<select id="set_currentRole">${permissionRoles.map((r) => `<option ${state.settings.currentRole === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <label>Attendance threshold<input id="set_attendanceThreshold" type="number" min="0" max="100" value="${safe(state.settings.attendanceThreshold)}" /></label>
      ${listSetting("officerRoles", "Officer roles")}
      ${listSetting("memberStatuses", "Member statuses")}
      ${listSetting("eventTypes", "Event types")}
      ${listSetting("committees", "Committees")}
      ${listSetting("permissionRoles", "Permission roles")}
      <label class="wide">Privacy notice<textarea id="set_privacyNotice">${safe(state.settings.privacyNotice)}</textarea></label>
    </div>
    <div class="settings-grid">
      <div class="notice"><h4>Security</h4><p>Login is required for cloud sync. Supabase RLS protects workspace rows, and the frontend never ships a service-role key.</p></div>
      <div class="notice"><h4>Financial access</h4><p>Finance pages are restricted to Admin, Treasurer, Assistant Treasurer, and President roles unless permissions are expanded later.</p></div>
      <div class="notice"><h4>Empty workspace</h4><p>No sample members, dues, PNMs, or events are seeded. Use Add or Import to enter Alpha Omega’s real records.</p></div>
    </div>
  </section>`;
}

function settingInput(key, label, type = "text") {
  return `<label>${label}<input id="set_${key}" type="${type}" value="${safe(state.settings[key])}" /></label>`;
}

function listSetting(key, label) {
  return `<label class="wide">${label}<textarea id="set_${key}">${safe((state.settings[key] || []).join(", "))}</textarea></label>`;
}

function restrictedPanel(message) {
  return `<section class="panel empty-state"><h3>Restricted area</h3><p>${safe(message)}</p><button class="ghost" data-go="settings">Switch role in settings</button></section>`;
}

function emptySmall(text) {
  return `<p class="muted">${safe(text)}</p>`;
}

function bindViewActions(root) {
  root.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => { applyFilter(el.dataset.go, el.dataset.filter || ""); setView(el.dataset.go); }));
  root.querySelectorAll("[data-add]").forEach((el) => el.addEventListener("click", () => openForm(el.dataset.add)));
  root.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [key, id] = el.dataset.edit.split(":"); openForm(key, id); }));
  root.querySelectorAll("[data-archive]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [key, id] = el.dataset.archive.split(":"); archiveRow(key, id); }));
  root.querySelectorAll("[data-delete]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [key, id] = el.dataset.delete.split(":"); deleteRow(key, id); }));
  root.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", (ev) => { if (ev.target.closest(".row-actions")) return; openProfile(el.dataset.open, el.dataset.id); }));
  root.querySelectorAll("[data-export]").forEach((el) => el.addEventListener("click", () => exportCsv(el.dataset.export)));
  root.querySelectorAll("[data-import]").forEach((el) => el.addEventListener("click", () => beginImport(el.dataset.import)));
  root.querySelectorAll("[data-print]").forEach((el) => el.addEventListener("click", () => window.print()));
  root.querySelectorAll("[data-filter-status]").forEach((el) => el.addEventListener("click", () => { activeFilters.pnms = { status: el.dataset.filterStatus }; render(); }));
  root.querySelectorAll("[data-bulk-charge]").forEach((el) => el.addEventListener("click", openBulkChargeForm));
  root.querySelectorAll("[data-record-payment]").forEach((el) => el.addEventListener("click", () => openPaymentForm(el.dataset.recordPayment || "")));
  root.querySelectorAll("[data-task-done]").forEach((el) => el.addEventListener("click", () => markTaskDone(el.dataset.taskDone)));
  root.querySelectorAll("[data-add-leadership]").forEach((el) => el.addEventListener("click", () => openLeadershipForm()));
  root.querySelectorAll("[data-edit-leadership]").forEach((el) => el.addEventListener("click", () => openLeadershipForm(el.dataset.editLeadership)));
  const saveSettings = root.querySelector("[data-save-settings]");
  if (saveSettings) saveSettings.addEventListener("click", saveSettingsForm);
  const search = root.querySelector("#searchInput");
  if (search) search.addEventListener("input", () => { const key = activeView === "recruitment" ? "pnms" : activeView; activeFilters[key] = { ...(activeFilters[key] || {}), q: search.value }; render(); });
  const checkType = root.querySelector("#checkType");
  if (checkType) checkType.addEventListener("change", refreshCheckPerson);
  const record = root.querySelector("[data-record-checkin]");
  if (record) record.addEventListener("click", recordCheckin);
}

function applyFilter(view, filter) {
  const key = view === "recruitment" ? "pnms" : view;
  if (!filter) return;
  activeFilters[key] = {};
  if (filter.includes("outstanding=true")) activeFilters[key].outstanding = true;
  if (filter.includes("pastdue=true")) activeFilters[key].pastdue = true;
  if (filter.includes("status=")) activeFilters[key].status = filter.split("status=")[1];
  if (filter.includes("type=")) activeFilters[key].type = filter.split("type=")[1];
}

function setView(view) {
  activeView = view;
  render();
}

function openForm(key, id) {
  const meta = collectionMeta[key];
  if (!meta) return;
  const existing = state[key].find((r) => r.id === id);
  openModal(`<h3>${existing ? `Edit ${meta.title}` : meta.addLabel}</h3><form id="recordForm" class="form-grid">${meta.fields.map((f) => formField(f, existing)).join("")}<div class="wide button-row"><button class="primary" type="submit">Save</button><button class="ghost" type="button" data-close-modal>Cancel</button></div></form>`);
  document.getElementById("recordForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    saveRow(key, Object.fromEntries(new FormData(ev.currentTarget).entries()), id);
  });
}

function formField(field, existing = {}) {
  const [name, label, type, opts] = field;
  const value = existing?.[name] ?? defaultFieldValue(name);
  if (type === "textarea") return `<label class="wide">${label}<textarea name="${name}">${safe(value)}</textarea></label>`;
  if (type === "select") {
    const options = selectOptions(opts);
    return `<label>${label}<select name="${name}">${options.map(([val, txt]) => `<option value="${safe(val)}" ${String(value) === String(val) ? "selected" : ""}>${safe(txt)}</option>`).join("")}</select></label>`;
  }
  return `<label>${label}<input name="${name}" type="${type}" value="${safe(value)}" ${opts === "required" ? "required" : ""} /></label>`;
}

function defaultFieldValue(name) {
  if (name === "status") return "Not started";
  if (name === "memberStatus") return "Active";
  if (name === "initiationStatus") return "Member";
  if (name === "lifecycle") return "Active";
  if (name === "type") return "Charge";
  if (name === "amount") return state.settings.defaultDuesAmount || "";
  if (name === "dueDate" && state.settings.duesDueDates) return state.settings.duesDueDates.split(",")[0].trim();
  if (name === "paymentDate") return todayIso();
  return "";
}

function selectOptions(opts) {
  if (opts === "members") return [["", "Select member"], ...activeMembers().map((m) => [m.id, memberName(m.id)])];
  if (opts === "events") return [["", "Select event"], ...state.events.filter((e) => !e.archived).map((e) => [e.id, e.name])];
  if (opts === "officerRoles") return state.settings.officerRoles.map((x) => [x, x]);
  if (opts === "memberStatuses") return state.settings.memberStatuses.map((x) => [x, x]);
  if (opts === "eventTypes") return state.settings.eventTypes.map((x) => [x, x]);
  if (opts === "committees") return state.settings.committees.map((x) => [x, x]);
  return (opts || []).map((x) => [x, x]);
}

function saveRow(key, row, id) {
  const validation = validateRow(key, row, id);
  if (validation) return toast(validation);
  snapshot(id ? `${labelize(key)} edited` : `${labelize(key)} added`, { type: key, id, description: row.firstName ? `${row.firstName} ${row.lastName}` : row.title || row.name || row.type });
  if (key === "finance") row.amount = parseMoney(row.amount);
  if (id) state[key] = state[key].map((r) => r.id === id ? { ...r, ...row } : r);
  else state[key].unshift({ id: uid(key[0]), ...row, archived: false });
  recalcMemberDues();
  save(); closeModal(); render();
}

function validateRow(key, row, id) {
  if ((key === "members" || key === "pnms") && (!row.firstName || !row.lastName)) return "First and last name are required.";
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return "Please enter a valid email address.";
  if (key === "finance" && !row.memberId) return "Select a member for dues/payment records.";
  if (key === "finance" && !parseMoney(row.amount)) return "Enter a valid amount.";
  if (key === "events" && !row.name) return "Event name is required.";
  if (key === "tasks" && !row.title) return "Task title is required.";
  if ((key === "members" || key === "pnms") && !id) {
    const dup = state[key].find((r) => !r.archived && samePerson(r, row));
    if (dup && !confirm("Possible duplicate found by name, phone, or email. Create this record anyway?")) return "Duplicate creation cancelled.";
  }
  return "";
}

function samePerson(a, b) {
  const sameName = `${a.firstName} ${a.lastName}`.trim().toLowerCase() === `${b.firstName} ${b.lastName}`.trim().toLowerCase();
  const samePhone = a.phone && b.phone && a.phone.replace(/\D/g, "") === b.phone.replace(/\D/g, "");
  const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
  return sameName || samePhone || sameEmail;
}

function archiveRow(key, id) {
  if (!confirm("Archive this record? It will be hidden but not permanently deleted.")) return;
  snapshot(`${labelize(key)} archived`, { type: key, id });
  const row = state[key].find((r) => r.id === id);
  if (row) {
    row.archived = true;
    if (row.status) row.status = "Archived";
    if (row.lifecycle) row.lifecycle = "Archived";
  }
  recalcMemberDues();
  save(); render(); toast("Archived. Use Undo if needed.");
}

function deleteRow(key, id) {
  if (!confirm("Permanently delete this record? Archive is safer. Continue only if you are sure.")) return;
  snapshot(`${labelize(key)} deleted`, { type: key, id });
  state[key] = state[key].filter((r) => r.id !== id);
  recalcMemberDues();
  save(); render(); toast("Deleted. Use Undo if needed.");
}

function openProfile(key, id) {
  const row = state[key].find((r) => r.id === id);
  if (!row) return;
  const title = key === "members" ? memberName(id) : key === "pnms" ? pnmName(id) : row.name || row.title || row.type;
  const dues = key === "members" ? memberFinance(id) : null;
  openModal(`<h3>${safe(title)}</h3>
    ${dues ? renderMemberDuesProfile(id, dues) : ""}
    <div class="profile-grid">${Object.entries(row).map(([k,v]) => `<div><span>${labelize(k)}</span><strong>${safe(Array.isArray(v) ? v.join(", ") : v)}</strong></div>`).join("")}</div>
    ${renderRelatedAttendance(key, id)}
    <div class="button-row"><button class="primary" data-edit="${key}:${id}">Edit</button>${key === "members" && can("view_finance") ? `<button class="ghost" data-record-payment="${id}">Record payment</button>` : ""}<button class="ghost" data-close-modal>Close</button></div>`);
  document.querySelector("#modal [data-edit]")?.addEventListener("click", () => { closeModal(); openForm(key, id); });
  document.querySelector("#modal [data-record-payment]")?.addEventListener("click", (ev) => { closeModal(); openPaymentForm(ev.currentTarget.dataset.recordPayment); });
}

function renderMemberDuesProfile(memberId, dues) {
  return `<section class="notice"><h4>Member dues profile</h4><div class="mini-grid">
    ${mini("Charges", money(dues.charges))}${mini("Payments", money(dues.payments))}${mini("Balance", money(dues.balance))}${mini("Status", dues.status)}
  </div><ul>${dues.rows.length ? dues.rows.map((r) => `<li>${safe(r.type)} · ${money(r.amount)} · ${safe(r.status)} · ${safe(r.paymentDate || r.dueDate || "")}</li>`).join("") : "<li>No dues activity yet.</li>"}</ul></section>`;
}

function renderRelatedAttendance(key, id) {
  const rows = state.attendance.filter((a) => a.personId === id || a.eventId === id);
  return rows.length ? `<h4>Attendance history</h4><ul>${rows.map((a) => `<li>${safe(eventName(a.eventId))} · ${safe(a.personType)} · ${safe(a.status)}</li>`).join("")}</ul>` : "";
}

function openBulkChargeForm() {
  if (!activeMembers().length) return toast("Add or import members before creating dues charges.");
  openModal(`<h3>Add dues charge to multiple members</h3><form id="bulkChargeForm" class="form-grid">
    <label>Amount<input name="amount" type="number" step="0.01" required value="${safe(state.settings.defaultDuesAmount)}" /></label>
    <label>Due date<input name="dueDate" type="date" value="${safe((state.settings.duesDueDates || "").split(",")[0]?.trim())}" /></label>
    <label>Category<input name="category" value="Semester dues" /></label>
    <label>Status<select name="status"><option>Unpaid</option><option>Not billed</option><option>Payment plan</option></select></label>
    <label class="wide">Apply to<select name="target"><option value="active">All active members</option><option value="new">New members only</option></select></label>
    <label class="wide">Notes<textarea name="notes"></textarea></label>
    <div class="wide button-row"><button class="primary">Create charges</button><button class="ghost" type="button" data-close-modal>Cancel</button></div>
  </form>`);
  document.getElementById("bulkChargeForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.currentTarget).entries());
    const targets = activeMembers().filter((m) => form.target === "active" || m.initiationStatus === "New Member" || m.memberStatus === "New Member");
    if (!confirm(`Create a ${money(form.amount)} charge for ${targets.length} members?`)) return;
    snapshot("Bulk dues charges added", { type: "finance", description: `${targets.length} charges` });
    targets.forEach((m) => state.finance.unshift({ id: uid("f"), type: "Charge", memberId: m.id, amount: parseMoney(form.amount), category: form.category, status: form.status, dueDate: form.dueDate, paymentDate: "", paymentMethod: "", paymentPlan: "No", notes: form.notes, treasurerNotes: "", archived: false }));
    recalcMemberDues();
    save(); closeModal(); render(); toast("Bulk charges created.");
  });
}

function openPaymentForm(memberId = "") {
  if (!activeMembers().length) return toast("Add members before recording payments.");
  openModal(`<h3>Record payment</h3><form id="paymentForm" class="form-grid">
    <label>Member<select name="memberId">${selectOptions("members").map(([v,t]) => `<option value="${safe(v)}" ${memberId === v ? "selected" : ""}>${safe(t)}</option>`).join("")}</select></label>
    <label>Amount<input name="amount" type="number" step="0.01" required /></label>
    <label>Payment date<input name="paymentDate" type="date" value="${todayIso()}" /></label>
    <label>Payment method<select name="paymentMethod"><option>Cash</option><option>Check</option><option>Venmo</option><option>Zelle</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></label>
    <label>Status<select name="status"><option>Paid</option><option>Partially paid</option><option>Payment plan</option><option>Waived</option></select></label>
    <label>Payment plan<select name="paymentPlan"><option>No</option><option>Yes</option></select></label>
    <label class="wide">Payment notes<textarea name="notes"></textarea></label>
    <label class="wide">Treasurer notes<textarea name="treasurerNotes"></textarea></label>
    <div class="wide button-row"><button class="primary">Save payment</button><button class="ghost" type="button" data-close-modal>Cancel</button></div>
  </form>`);
  document.getElementById("paymentForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const row = Object.fromEntries(new FormData(ev.currentTarget).entries());
    row.type = "Payment";
    row.category = "Dues payment";
    saveRow("finance", row);
  });
}

function recordCheckin() {
  if (!document.getElementById("checkEvent")?.value || !document.getElementById("checkPerson")?.value) return toast("Select an event and person first.");
  snapshot("Attendance updated", { type: "attendance" });
  state.attendance.unshift({ id: uid("a"), eventId: document.getElementById("checkEvent").value, personType: document.getElementById("checkType").value, personId: document.getElementById("checkPerson").value, status: document.getElementById("checkStatus").value, timestamp: new Date().toISOString(), notes: "" });
  save(); render(); toast("Attendance recorded.");
}

function refreshCheckPerson() {
  const type = document.getElementById("checkType").value;
  const rows = type === "Member" ? activeMembers().map((m) => [m.id, memberName(m.id)]) : activePnms().map((p) => [p.id, pnmName(p.id)]);
  document.getElementById("checkPerson").innerHTML = rows.map(([id, name]) => `<option value="${id}">${safe(name)}</option>`).join("");
}

function markTaskDone(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  snapshot("Task completed", { type: "tasks", id, description: task.title });
  task.status = "Done";
  save(); render(); toast("Task marked done.");
}

function recalcMemberDues() {
  state.members.forEach((m) => {
    const f = memberFinance(m.id);
    m.duesStatus = f.status;
  });
}

function saveSettingsForm() {
  snapshot("Settings updated", { type: "settings" });
  ["chapterName", "schoolName", "term", "academicYear", "defaultDuesAmount", "duesDueDates", "attendanceThreshold", "privacyNotice", "currentRole"].forEach((k) => {
    const el = document.getElementById(`set_${k}`);
    if (el) state.settings[k] = el.value;
  });
  ["officerRoles", "memberStatuses", "eventTypes", "committees", "permissionRoles"].forEach((k) => {
    const el = document.getElementById(`set_${k}`);
    if (el) state.settings[k] = el.value.split(",").map((x) => x.trim()).filter(Boolean);
  });
  state.settings.setupComplete = Boolean(state.settings.term && state.settings.academicYear);
  save(); render(); toast("Setup saved.");
}

function openLeadershipForm(id) {
  const existing = state.leadership.find((l) => l.id === id);
  const fields = [["role", "Role", "select", "officerRoles"], ["assignedMember", "Assigned member", "select", "members"], ["committee", "Committee", "select", "committees"], ["responsibilities", "Responsibilities", "textarea"], ["relatedReports", "Related reports", "text"]];
  openModal(`<h3>${existing ? "Edit officer role" : "Add officer role"}</h3><form id="leadershipForm" class="form-grid">${fields.map((f) => formField(f, existing)).join("")}<div class="wide button-row"><button class="primary">Save</button><button class="ghost" type="button" data-close-modal>Cancel</button></div></form>`);
  document.getElementById("leadershipForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const row = Object.fromEntries(new FormData(ev.currentTarget).entries());
    snapshot(existing ? "Officer role edited" : "Officer role added", { type: "leadership", id });
    if (existing) Object.assign(existing, row); else state.leadership.unshift({ id: uid("l"), ...row });
    save(); closeModal(); render();
  });
}

function beginImport(target) {
  document.getElementById("importFile").dataset.target = target;
  document.getElementById("importFile").click();
}

function importFile(file) {
  const target = document.getElementById("importFile").dataset.target || "members";
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (file.name.endsWith(".json")) {
        if (!confirm("Import full JSON backup? This will replace the current local workspace.")) return;
        snapshot("Workspace backup imported", { type: "import" });
        state = normalize(JSON.parse(reader.result));
        save(); render(); toast("Workspace imported.");
      } else previewCsvImport(target, reader.result);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function previewCsvImport(target, text) {
  const rows = parseCsv(text);
  const validation = validateImport(target, rows);
  const goodCount = rows.length - validation.errors.length;
  openModal(`<h3>Preview ${labelize(target)} import</h3><p>${goodCount} valid rows, ${validation.errors.length} rows need attention.</p>
    ${validation.errors.length ? `<div class="notice"><h4>Errors</h4><ul>${validation.errors.slice(0, 12).map((e) => `<li>${safe(e)}</li>`).join("")}</ul></div>` : ""}
    <div class="table-wrap"><table><thead><tr>${Object.keys(rows[0] || {}).map((h) => `<th>${safe(h)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 8).map((r) => `<tr>${Object.values(r).map((v) => `<td>${safe(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="button-row"><button class="primary" id="confirmImport" ${validation.errors.length ? "disabled" : ""}>Import rows</button><button class="ghost" data-close-modal>Cancel</button></div>`);
  document.getElementById("confirmImport")?.addEventListener("click", () => {
    snapshot(`${labelize(target)} CSV imported`, { type: "import", description: `${rows.length} rows` });
    rows.forEach((row) => importRow(target, row));
    recalcMemberDues();
    save(); closeModal(); render(); toast("CSV import complete.");
  });
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines.shift() || "").map((h) => h.trim());
  return lines.map((line) => Object.fromEntries(splitCsvLine(line).map((v, i) => [headers[i], v.trim()])));
}

function splitCsvLine(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function validateImport(target, rows) {
  const errors = [];
  rows.forEach((row, i) => {
    if (["members", "pnms"].includes(target) && (!row.firstName && !row.first_name || !row.lastName && !row.last_name)) errors.push(`Row ${i + 2}: firstName and lastName are required.`);
    if (target === "finance" && (!row.memberId && !row.email && !row.phone)) errors.push(`Row ${i + 2}: finance import needs memberId, email, or phone.`);
    if (target === "finance" && !parseMoney(row.amount || row.owed || row.paid)) errors.push(`Row ${i + 2}: amount is required.`);
  });
  return { errors };
}

function importRow(target, row) {
  const clean = Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), v]));
  if (target === "members") state.members.push({ id: uid("m"), firstName: clean.firstName, lastName: clean.lastName, phone: clean.phone || "", email: clean.email || "", schoolYear: clean.schoolYear || "", major: clean.major || "", hometown: clean.hometown || "", memberStatus: clean.memberStatus || "Active", initiationStatus: clean.initiationStatus || "Member", officerRole: clean.officerRole || "", committee: clean.committee || "", housingStatus: clean.housingStatus || "Not tracked", duesStatus: clean.duesStatus || "Not billed", notes: clean.notes || "", tags: clean.tags || "", lifecycle: clean.lifecycle || "Active", archived: false });
  if (target === "pnms") state.pnms.push({ id: uid("p"), ...clean, status: clean.status || "New lead", archived: false });
  if (target === "finance") {
    const member = findMemberForImport(clean);
    state.finance.push({ id: uid("f"), type: clean.type || "Charge", memberId: member?.id || clean.memberId || "", amount: parseMoney(clean.amount || clean.owed || clean.paid), category: clean.category || "Imported dues", status: clean.status || "Unpaid", dueDate: clean.dueDate || "", paymentDate: clean.paymentDate || "", paymentMethod: clean.paymentMethod || "", paymentPlan: clean.paymentPlan || "No", notes: clean.notes || "", treasurerNotes: clean.treasurerNotes || "", archived: false });
  }
}

function camel(key) {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/\s+([a-z])/g, (_, c) => c.toUpperCase());
}

function findMemberForImport(row) {
  return state.members.find((m) => (row.memberId && m.id === row.memberId) || (row.email && m.email?.toLowerCase() === row.email.toLowerCase()) || (row.phone && m.phone?.replace(/\D/g, "") === row.phone.replace(/\D/g, "")));
}

function exportCsv(key) {
  const rows = exportRows(key);
  const headers = Object.keys(rows[0] || { empty: "" });
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  download(`${key}-export.csv`, csv, "text/csv");
}

function exportRows(key) {
  if (key === "outstanding") return activeMembers().map((m) => ({ member: memberName(m.id), email: m.email, status: memberFinance(m.id).status, balance: memberFinance(m.id).balance, nextDue: memberFinance(m.id).nextDue })).filter((r) => r.balance > 0);
  if (key === "reports") return [{ report: "Member count", value: metrics().members }, { report: "Total dues billed", value: metrics().totalBilled }, { report: "Total collected", value: metrics().totalCollected }, { report: "Outstanding", value: metrics().outstanding }, { report: "Open tasks", value: metrics().tasks }];
  if (key === "attendance") return state.attendance;
  return (state[key] || filteredRows(key)).map((r) => ({ ...r, memberName: r.memberId ? memberName(r.memberId) : "" }));
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  download("chapterops-alpha-omega-real-backup.json", JSON.stringify(state, null, 2), "application/json");
}

function undo() {
  const last = historyStack.pop();
  if (!last) return toast("Nothing to undo.");
  state = normalize(JSON.parse(last));
  save(); render(); toast("Last change undone.");
}

function clearWorkspace() {
  if (!confirm("Clear the local workspace? This removes local records on this browser. Export a backup first if needed.")) return;
  snapshot("Workspace cleared", { type: "settings" });
  state = emptyWorkspace();
  oldStoreKeys.forEach((key) => localStorage.removeItem(key));
  save(); render(); toast("Workspace cleared.");
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
  setTimeout(() => el.classList.add("hidden"), 3000);
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
document.getElementById("importBtn").addEventListener("click", () => {
  const map = { recruitment: "pnms", members: "members", events: "events", finance: "finance", tasks: "tasks" };
  beginImport(map[activeView] || "members");
});
document.getElementById("importFile").addEventListener("change", (ev) => ev.target.files[0] && importFile(ev.target.files[0]));
document.getElementById("resetBtn").addEventListener("click", clearWorkspace);

initCloud().finally(render);
