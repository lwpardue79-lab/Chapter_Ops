const storeKey = "chapterops_alpha_omega_real_v2";
const oldStoreKeys = ["chapterops_alpha_omega_v1", "chapterops-lite-web-v1"];
const orgStoreKey = "chapterops_cloud_org_id";

const todayIso = () => new Date().toISOString().slice(0, 10);
const money = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n, d) => d ? `${Math.round((n / d) * 100)}%` : "0%";
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const safe = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
const parseMoney = (v) => parseMoneyToCents(v) / 100;
const setupDebug = (...args) => console.info("[ChapterOps setup]", ...args);

const viewNames = {
  dashboard: "Dashboard",
  members: "Members",
  leadership: "Executive Team",
  recruitment: "Recruitment",
  events: "Attendance",
  finance: "Finance",
  kpis: "KPI Reports",
  tasks: "Tasks",
  reports: "Reports",
  settings: "Settings",
  portal: "Member Portal"
};

const permissionRoles = ["Admin", "President", "Treasurer", "Assistant Treasurer", "Secretary", "VPMD", "Recruitment", "Exec Board", "Committee Chair", "Active Member", "Read-only Advisor"];
const roleRules = {
  Admin: ["all"],
  President: ["workspace.full.read", "dashboard.executive.view", "members.list.view", "members.private_contact.view", "members.create", "members.update", "members.archive", "members.import", "members.export", "officers.view", "officers.manage", "recruitment.view", "recruitment.manage", "attendance.view", "attendance.manage", "finance.summary.view", "finance.member_balances.view", "reports.executive.view", "reports.finance.view", "reports.export", "kpi.view", "kpi.manage_all", "tasks.view_all", "tasks.manage", "settings.view", "backup.create"],
  Treasurer: ["workspace.full.read", "dashboard.executive.view", "members.list.view", "members.private_contact.view", "members.export", "officers.view", "attendance.view", "finance.summary.view", "finance.member_balances.view", "finance.manage", "finance.import", "finance.export", "reports.finance.view", "reports.export", "kpi.view", "kpi.submit_own", "tasks.view_all", "tasks.manage"],
  "Assistant Treasurer": ["workspace.full.read", "dashboard.executive.view", "members.list.view", "members.private_contact.view", "members.export", "officers.view", "attendance.view", "finance.summary.view", "finance.member_balances.view", "finance.manage", "finance.import", "finance.export", "reports.finance.view", "reports.export", "kpi.view", "kpi.submit_own", "tasks.view_all", "tasks.manage"],
  Secretary: ["workspace.full.read", "dashboard.executive.view", "members.list.view", "members.private_contact.view", "members.create", "members.update", "members.import", "members.export", "officers.view", "attendance.view", "attendance.manage", "reports.executive.view", "reports.export", "kpi.view", "kpi.manage_all", "tasks.view_all", "tasks.manage"],
  VPMD: ["workspace.full.read", "dashboard.executive.view", "members.list.view", "members.private_contact.view", "members.update", "members.export", "officers.view", "attendance.view", "attendance.manage", "reports.executive.view", "kpi.view", "kpi.submit_own", "tasks.view_all", "tasks.manage"],
  Recruitment: ["workspace.full.read", "dashboard.executive.view", "members.list.view", "officers.view", "recruitment.view", "recruitment.manage", "attendance.view", "attendance.manage", "reports.executive.view", "kpi.view", "kpi.submit_own", "tasks.view_all", "tasks.manage"],
  "Exec Board": ["workspace.full.read", "dashboard.executive.view", "members.list.view", "members.private_contact.view", "members.export", "officers.view", "recruitment.view", "attendance.view", "reports.executive.view", "kpi.view", "kpi.submit_own", "tasks.view_all"],
  "Committee Chair": ["workspace.full.read", "members.list.view", "officers.view", "attendance.view", "attendance.manage", "kpi.view", "kpi.submit_own", "tasks.view_all", "tasks.manage"],
  "Active Member": ["member.portal.view", "members.self.view", "finance.self.view", "attendance.self.view", "tasks.view_own"],
  "Read-only Advisor": ["workspace.full.read", "dashboard.executive.view", "members.list.view", "officers.view", "attendance.view", "reports.executive.view", "reports.finance.view", "kpi.view"]
};
const legacyPermissionMap = {
  view_all: "members.list.view",
  view_basic: "member.portal.view",
  view_finance: "finance.member_balances.view",
  view_reports: "reports.executive.view",
  manage_members: "members.update",
  manage_recruitment: "recruitment.manage",
  manage_events: "attendance.manage",
  manage_finance: "finance.manage",
  manage_tasks: "tasks.manage",
  manage_own_tasks: "tasks.view_own"
};
const navigationItems = [
  { view: "dashboard", label: "Dashboard", permission: "dashboard.executive.view" },
  { view: "members", label: "Members", permission: "members.list.view" },
  { view: "leadership", label: "Executive Team", permission: "officers.view" },
  { view: "recruitment", label: "Recruitment", permission: "recruitment.view" },
  { view: "events", label: "Attendance", permission: "attendance.view" },
  { view: "finance", label: "Finance", permission: "finance.member_balances.view" },
  { view: "kpis", label: "KPI Reports", permission: "kpi.view" },
  { view: "tasks", label: "Tasks", permission: "tasks.view_all" },
  { view: "reports", label: "Reports", permission: "reports.executive.view" },
  { view: "settings", label: "Settings", permission: "settings.view" }
];
const routePermissions = Object.fromEntries(navigationItems.map((item) => [item.view, item.permission]));

const defaults = {
  officerRoles: ["President", "Internal Vice President", "External Vice President", "Treasurer", "Assistant Treasurer", "VPMD", "Recruitment", "Secretary", "Risk Management", "Health and Safety", "Scholarship", "New Member Education", "Sergeant at Arms", "Alumni Relations", "Social", "House Manager", "Philanthropy", "General member"],
  memberStatuses: ["Active", "New Member", "Inactive", "Alumni", "Archived"],
  eventTypes: ["Chapter", "Brotherhood", "Recruitment", "Philanthropy", "Social", "New member education", "Executive meeting", "Committee meeting", "Risk management", "Alumni", "Other"],
  committees: ["Executive", "Recruitment", "Brotherhood", "Philanthropy", "Risk Management", "Social", "Finance", "Alumni Relations", "Operations"],
  executiveOfficerRoles: ["President", "Internal Vice President", "External Vice President", "Treasurer", "Assistant Treasurer", "VPMD", "Recruitment", "Secretary", "Risk Management", "Health and Safety", "Scholarship", "New Member Education", "Sergeant at Arms", "Alumni Relations", "Social", "House Manager", "Philanthropy"],
  paymentStatuses: ["Not billed", "Unpaid", "Partially paid", "Paid", "Past due", "Payment plan", "Waived", "Archived"]
};

let activeView = "dashboard";
let activeFilters = {};
let historyStack = [];
let cloud = { client: null, user: null, profile: null, profiles: [], organizationId: localStorage.getItem(orgStoreKey) };
let state = load();
let setupSave = { saving: false, error: "", success: "", fieldErrors: {} };
let importState = { importing: false, result: null, error: "", rows: [], target: "", validation: null };
const pendingDeletes = new Set();
let financeSort = { key: "lastName", dir: "asc" };

function resolvedRole() {
  const role = cloud.profile?.approval_status === "approved" ? cloud.profile?.role : "";
  return permissionRoles.includes(role) ? role : (role ? normalizeAppRole(role) : (cloud.client ? "Active Member" : state.settings.currentRole || "Admin"));
}

function normalizeAppRole(role = "") {
  const key = normalizeTitle(role);
  if (key.includes("admin")) return "Admin";
  if (key.includes("assistant treasurer")) return "Assistant Treasurer";
  if (key.includes("treasurer")) return "Treasurer";
  if (key.includes("president")) return "President";
  if (key.includes("secretary")) return "Secretary";
  if (["vpmd", "brotherhood", "membership development", "vp membership development", "vice president of membership development"].some((v) => key.includes(v))) return "VPMD";
  if (key.includes("recruitment") || key.includes("rush")) return "Recruitment";
  if (key.includes("exec")) return "Exec Board";
  if (key.includes("committee")) return "Committee Chair";
  if (key.includes("advisor")) return "Read-only Advisor";
  return "Active Member";
}

function permissionsForRole(role = resolvedRole()) {
  const normalized = normalizeAppRole(role);
  return new Set([...(roleRules[normalized] || roleRules["Active Member"] || [])]);
}

const can = (permission) => {
  const resolved = legacyPermissionMap[permission] || permission;
  const permissions = permissionsForRole();
  return permissions.has("all") || permissions.has(resolved);
};
const canManage = (area) => can(`manage_${area}`);
const canAny = (permissions = []) => permissions.some(can);
const isFullWorkspaceAllowed = () => can("workspace.full.read") || can("all");

function toDbRole(role = "") {
  const key = normalizeTitle(role);
  if (key.includes("admin")) return "admin";
  if (key.includes("president")) return "president";
  if (key.includes("assistant treasurer")) return "assistant_treasurer";
  if (key.includes("treasurer")) return "treasurer";
  if (key.includes("secretary")) return "secretary";
  if (key.includes("vpmd") || key.includes("brotherhood")) return "vpmd";
  if (key.includes("recruitment") || key.includes("rush")) return "recruitment";
  if (key.includes("exec")) return "executive";
  if (key.includes("committee")) return "committee_chair";
  if (key.includes("advisor")) return "advisor";
  return "member";
}

function formatSupabaseError(err, fallback = "Request failed.") {
  if (!err) return fallback;
  const parts = [err.message, err.details, err.hint, err.code].filter(Boolean);
  return parts.length ? parts.join(" ") : fallback;
}

function logSupabaseError(scope, err) {
  console.error(`[ChapterOps ${scope}]`, {
    code: err?.code || "",
    message: err?.message || "",
    details: err?.details || "",
    hint: err?.hint || ""
  });
}

function importDebug(...args) {
  console.info("[ChapterOps import]", ...args);
}

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
      executiveOfficerRoles: [...defaults.executiveOfficerRoles],
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
    financeAccounts: [],
    tasks: [],
    leadership: [],
    kpiMeetings: [],
    kpiDefinitions: [],
    kpiPositionReports: [],
    kpiResults: [],
    kpiActionItems: [],
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
    financeAccounts: data.financeAccounts || data.finance_accounts || [],
    tasks: data.tasks || [],
    leadership: normalizeLeadershipAssignments(data.leadership || []),
    kpiMeetings: data.kpiMeetings || data.kpi_meetings || [],
    kpiDefinitions: data.kpiDefinitions || data.kpi_definitions || [],
    kpiPositionReports: data.kpiPositionReports || data.kpi_position_reports || [],
    kpiResults: data.kpiResults || data.kpi_results || [],
    kpiActionItems: data.kpiActionItems || data.kpi_action_items || [],
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
  cloud.client.auth.onAuthStateChange(async (event, session) => {
    const previousUserId = cloud.user?.id || "";
    cloud.user = session?.user || null;
    cloud.profile = null;
    cloud.profiles = [];
    if (!cloud.user || previousUserId !== cloud.user.id) resetSensitiveClientState();
    updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Sign in required");
    if (event === "PASSWORD_RECOVERY") openNewPasswordModal();
    if (cloud.user) await bootstrapUser();
    render();
  });
  if (cloud.user) await bootstrapUser();
  updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Sign in required");
}

function updateCloudUi(message) {
  document.getElementById("cloudStatus").textContent = message;
  document.getElementById("signInBtn").classList.toggle("hidden", !!cloud.user);
  document.getElementById("syncBtn").classList.toggle("hidden", !cloud.user || !isFullWorkspaceAllowed());
  document.getElementById("signOutBtn").classList.toggle("hidden", !cloud.user);
  document.getElementById("importBtn").classList.toggle("hidden", cloud.client && !canAny(["members.import", "finance.import", "backup.restore", "all"]));
  document.getElementById("exportBtn").classList.toggle("hidden", cloud.client && !canAny(["backup.create", "reports.export", "members.export", "finance.export", "all"]));
  document.getElementById("resetBtn").classList.toggle("hidden", cloud.client && !can("workspace.clear"));
}

async function signIn() {
  openAuthModal("signin");
}

async function signInWithPassword(email, password) {
  if (!cloud.client) return toast("Cloud sync is not configured.");
  const { error } = await cloud.client.auth.signInWithPassword({ email, password });
  if (error) return toast(error.message);
  closeModal();
  toast("Signed in.");
}

async function createAccount(email, password, confirmPassword, fullName, requestedRole = "Active Member", requestNotes = "") {
  if (!cloud.client) return toast("Cloud sync is not configured.");
  if (password.length < 8) return toast("Password must be at least 8 characters.");
  if (password !== confirmPassword) return toast("Passwords do not match.");
  const { data, error } = await cloud.client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: fullName || "", requested_role: requestedRole, request_notes: requestNotes }
    }
  });
  if (error) return toast(error.message);
  if (data?.session?.user) {
    cloud.user = data.session.user;
    await ensureOwnProfile({ fullName, requestedRole, requestNotes });
  }
  closeModal();
  toast("Request submitted. An admin must approve your account before you can access chapter data.");
}

async function sendPasswordReset(email) {
  if (!cloud.client) return toast("Cloud sync is not configured.");
  if (!email) return toast("Enter your email address first.");
  const { error } = await cloud.client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  toast(error ? error.message : "Password reset email sent.");
}

async function updateAccountPassword(password, confirmPassword) {
  if (!cloud.client) return toast("Cloud sync is not configured.");
  if (password.length < 8) return toast("Password must be at least 8 characters.");
  if (password !== confirmPassword) return toast("Passwords do not match.");
  const { error } = await cloud.client.auth.updateUser({ password });
  if (error) return toast(error.message);
  closeModal();
  toast("Password updated.");
}

async function signOut() {
  if (cloud.client) await cloud.client.auth.signOut({ scope: "local" });
  cloud.user = null;
  cloud.profile = null;
  cloud.profiles = [];
  cloud.organizationId = "";
  localStorage.removeItem(orgStoreKey);
  resetSensitiveClientState();
  updateCloudUi("Signed out");
  render();
}

async function bootstrapUser() {
  await ensureOwnProfile();
  if (cloud.profile?.approval_status === "approved") {
    state.settings.currentRole = resolvedRole();
    if (isFullWorkspaceAllowed()) await loadCloudWorkspace();
    else resetSensitiveClientState(state.settings.currentRole);
    if (can("all")) await loadProfilesForAdmin();
  }
}

function resetSensitiveClientState(role = "Active Member") {
  state = emptyWorkspace();
  state.settings.currentRole = role;
  activeFilters = {};
  importState = { importing: false, result: null, error: "", rows: [], target: "", validation: null };
  historyStack = [];
  try {
    localStorage.removeItem(storeKey);
  } catch {}
}

async function ensureOwnProfile(input = {}) {
  if (!cloud.client || !cloud.user) return null;
  const { data: existing, error: selectError } = await cloud.client.from("profiles").select("*").eq("id", cloud.user.id).maybeSingle();
  if (selectError && selectError.code !== "PGRST116") throw selectError;
  if (!existing) {
    const meta = cloud.user.user_metadata || {};
    const profile = {
      id: cloud.user.id,
      email: cloud.user.email,
      full_name: input.fullName || meta.full_name || "",
      requested_role: input.requestedRole || meta.requested_role || "Active Member",
      role: "Active Member",
      approval_status: "pending",
      request_notes: input.requestNotes || meta.request_notes || ""
    };
    const { error: insertError } = await cloud.client.from("profiles").insert(profile);
    if (insertError) throw insertError;
    cloud.profile = profile;
  } else {
    cloud.profile = existing;
  }
  const { data: membership } = await cloud.client.from("organization_members").select("organization_id, role").eq("user_id", cloud.user.id).limit(1).maybeSingle();
  if (toDbRole(membership?.role) === "admin" && cloud.profile.approval_status !== "approved") {
    const { data: updated, error: updateError } = await cloud.client.from("profiles").update({ approval_status: "approved", role: "Admin", updated_at: new Date().toISOString() }).eq("id", cloud.user.id).select("*").single();
    if (!updateError && updated) cloud.profile = updated;
  }
  if (membership?.organization_id) {
    cloud.organizationId = membership.organization_id;
    localStorage.setItem(orgStoreKey, membership.organization_id);
  }
  return cloud.profile;
}

async function loadProfilesForAdmin() {
  if (!cloud.client || !can("all")) return;
  const { data, error } = await cloud.client.from("profiles").select("*").order("created_at", { ascending: false });
  if (!error) cloud.profiles = data || [];
}

async function ensureCloudWorkspace() {
  if (!cloud.client || !cloud.user) throw new Error("Sign in before syncing chapter data.");
  if (cloud.profile?.approval_status !== "approved") throw new Error("Your account is pending admin approval.");
  if (cloud.organizationId) return cloud.organizationId;
  const { data: existing } = await cloud.client.from("organization_members").select("organization_id").eq("user_id", cloud.user.id).limit(1).maybeSingle();
  if (existing?.organization_id) {
    cloud.organizationId = existing.organization_id;
    localStorage.setItem(orgStoreKey, cloud.organizationId);
    return cloud.organizationId;
  }
  if (cloud.profile?.role !== "Admin") throw new Error("Your account is approved but not assigned to a chapter yet.");
  const { data: org, error: orgError } = await cloud.client.from("organizations").insert({ name: state.settings.chapterName, created_by: cloud.user.id }).select("id").single();
  if (orgError) throw orgError;
  const { error: memberError } = await cloud.client.from("organization_members").insert({ organization_id: org.id, user_id: cloud.user.id, role: "admin", email: cloud.user.email });
  if (memberError) throw memberError;
  cloud.organizationId = org.id;
  localStorage.setItem(orgStoreKey, org.id);
  return org.id;
}

async function loadCloudWorkspace(options = {}) {
  try {
    const organizationId = await ensureCloudWorkspace();
    const { data, error } = await cloud.client.from("workspace_state").select("*").eq("organization_id", organizationId).maybeSingle();
    if (error) throw error;
    if (data?.data || data?.state) state = normalize(data.data || data.state);
    else await syncCloudWorkspace(false);
    save();
  } catch (err) {
    logSupabaseError("load workspace failed", err);
    toast(formatSupabaseError(err, "Could not load chapter data."));
    if (options.throwOnError) throw err;
  }
}

async function syncCloudWorkspace(showToast = true) {
  try {
    const organizationId = await ensureCloudWorkspace();
    state = normalize(state);
    const { error } = await cloud.client.from("workspace_state").upsert({ organization_id: organizationId, data: state, updated_by: cloud.user.id, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
    if (error) throw error;
    if (showToast) toast("Changes synced.");
  } catch (err) {
    logSupabaseError("cloud sync failed", err);
    toast(formatSupabaseError(err, "Sync failed."));
  }
}

const uniqueMembersById = (members = []) => [...new Map(members.filter((m) => m?.id).map((m) => [m.id, m])).values()];
const activeMembers = () => uniqueMembersById(state.members).filter((m) => !m.archived && !m.deletedAt && m.lifecycle !== "Archived" && m.memberStatus !== "Archived");
const memberName = (id) => state.members.find((m) => m.id === id) ? `${state.members.find((m) => m.id === id).firstName} ${state.members.find((m) => m.id === id).lastName}` : "";
const pnmName = (id) => state.pnms.find((p) => p.id === id) ? `${state.pnms.find((p) => p.id === id).firstName} ${state.pnms.find((p) => p.id === id).lastName}` : "";
const eventName = (id) => state.events.find((e) => e.id === id)?.name || "";
const activePnms = () => state.pnms.filter((p) => !p.archived && p.status !== "Archived");
const upcomingEvents = () => state.events.filter((e) => !e.archived && e.date && e.date >= todayIso()).sort((a,b) => a.date.localeCompare(b.date));
const openTasks = () => state.tasks.filter((t) => !t.archived && !["Done", "Archived"].includes(t.status));

function financeRows() {
  return state.finance.filter((f) => !f.archived && f.status !== "Archived");
}

function parseMoneyToCents(value) {
  if (value === undefined || value === null || value === "") return 0;
  let raw = String(value).trim();
  if (!raw) return 0;
  let negative = false;
  if (/^\(.+\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  raw = raw.replace(/[$,\s]/g, "");
  if (raw.startsWith("-")) {
    negative = true;
    raw = raw.slice(1);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return NaN;
  const cents = Math.round(parsed * 100);
  return negative ? -Math.abs(cents) : cents;
}

function moneyFromCents(cents) {
  return money((Number(cents) || 0) / 100);
}

function memberIdentifier(member = {}) {
  return String(member.memberId || member.rollNumber || member.nationalMemberNumber || member.badgeNumber || member.memberNumber || member.id || "").trim();
}

function memberType(member = {}) {
  return member.memberType || member.initiationStatus || member.memberStatus || "Member";
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function financeAccountFor(memberId) {
  const account = (state.financeAccounts || []).find((f) => f.memberId === memberId && !f.archived && !f.deletedAt) || {};
  return {
    memberId,
    pendingChargeCents: Number(account.pendingChargeCents ?? account.pending_charge_cents ?? 0) || 0,
    currentBalanceCents: Number(account.currentBalanceCents ?? account.current_balance_cents ?? 0) || 0,
    paymentPlanStatus: account.paymentPlanStatus || account.payment_plan_status || "None",
    paymentPlanAmountCents: Number(account.paymentPlanAmountCents ?? account.payment_plan_amount_cents ?? 0) || 0,
    paymentPlanFrequency: account.paymentPlanFrequency || account.payment_plan_frequency || "",
    paymentPlanStartDate: account.paymentPlanStartDate || account.payment_plan_start_date || "",
    paymentPlanEndDate: account.paymentPlanEndDate || account.payment_plan_end_date || "",
    dueDate: account.dueDate || account.due_date || "",
    notes: account.notes || "",
    financialStatus: account.financialStatus || account.financial_status || "",
    updatedAt: account.updatedAt || account.updated_at || "",
    updatedBy: account.updatedBy || account.updated_by || ""
  };
}

function financeLedgerRows(scope = "filtered") {
  let rows = activeMembers().map((member) => {
    const account = financeAccountFor(member.id);
    const pendingChargeCents = account.pendingChargeCents;
    const currentBalanceCents = account.currentBalanceCents;
    const totalBalanceCents = pendingChargeCents + currentBalanceCents;
    return {
      id: member.id,
      memberId: member.id,
      member,
      lastName: member.lastName || "",
      firstName: member.firstName || "",
      memberIdentifier: memberIdentifier(member),
      status: member.memberStatus || member.lifecycle || "Active",
      memberType: memberType(member),
      pendingChargeCents,
      currentBalanceCents,
      totalBalanceCents,
      paymentPlanStatus: account.paymentPlanStatus,
      dueDate: account.dueDate,
      notes: account.notes,
      updatedAt: account.updatedAt,
      updatedBy: account.updatedBy
    };
  });

  if (scope === "filtered") {
    const filter = activeFilters.finance || {};
    const q = String(filter.q || "").toLowerCase();
    if (q) {
      rows = rows.filter((row) => [
        row.lastName, row.firstName, row.memberIdentifier, row.status, row.memberType,
        row.paymentPlanStatus, String(row.pendingChargeCents / 100), String(row.currentBalanceCents / 100), String(row.totalBalanceCents / 100)
      ].some((value) => String(value || "").toLowerCase().includes(q)));
    }
    if (filter.quick === "balance") rows = rows.filter((row) => row.totalBalanceCents > 0);
    if (filter.quick === "paid") rows = rows.filter((row) => row.totalBalanceCents === 0);
    if (filter.quick === "credits") rows = rows.filter((row) => row.totalBalanceCents < 0 || row.currentBalanceCents < 0);
    if (filter.quick === "plans") rows = rows.filter((row) => row.paymentPlanStatus && row.paymentPlanStatus !== "None");
    if (filter.quick === "overdue") rows = rows.filter((row) => row.totalBalanceCents > 0 && row.dueDate && row.dueDate < todayIso());
    if (filter.quick === "nocharge") rows = rows.filter((row) => row.pendingChargeCents === 0);
  }

  const dir = financeSort.dir === "desc" ? -1 : 1;
  const sortKey = financeSort.key || "lastName";
  rows.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "number" || typeof bv === "number") return ((av || 0) - (bv || 0)) * dir;
    return String(av || "").localeCompare(String(bv || "")) * dir;
  });
  return rows;
}

function financeLedgerTotals(rows = financeLedgerRows("all")) {
  const pending = rows.reduce((sum, row) => sum + row.pendingChargeCents, 0);
  const current = rows.reduce((sum, row) => sum + row.currentBalanceCents, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.totalBalanceCents, 0);
  return {
    pending,
    current,
    outstanding,
    withBalance: rows.filter((row) => row.totalBalanceCents > 0).length,
    paidInFull: rows.filter((row) => row.totalBalanceCents === 0).length,
    credits: rows.filter((row) => row.totalBalanceCents < 0 || row.currentBalanceCents < 0).length,
    paymentPlans: rows.filter((row) => row.paymentPlanStatus && row.paymentPlanStatus !== "None").length
  };
}

function memberFinance(memberId) {
  const rows = financeRows().filter((f) => f.memberId === memberId);
  const account = financeAccountFor(memberId);
  const charges = rows.filter((f) => f.type === "Charge").reduce((s, f) => s + parseMoney(f.amount), 0);
  const payments = rows.filter((f) => f.type === "Payment").reduce((s, f) => s + parseMoney(f.amount), 0);
  const waived = rows.filter((f) => f.status === "Waived").reduce((s, f) => s + parseMoney(f.amount), 0);
  const accountBalance = (account.pendingChargeCents + account.currentBalanceCents) / 100;
  const balance = account.pendingChargeCents || account.currentBalanceCents ? accountBalance : Math.max(0, charges - payments - waived);
  const nextDue = rows.filter((f) => f.type === "Charge" && f.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate || "";
  const status = account.paymentPlanStatus && account.paymentPlanStatus !== "None" ? "Payment plan" : balance === 0 && (charges > 0 || account.pendingChargeCents || account.currentBalanceCents) ? "Paid" : rows.some((f) => f.dueDate && f.dueDate < todayIso() && balance > 0) || (account.dueDate && account.dueDate < todayIso() && balance > 0) ? "Past due" : payments > 0 ? "Partially paid" : balance > 0 ? "Unpaid" : "Not billed";
  return { rows, charges, payments, waived, balance, nextDue: account.dueDate || nextDue, status, account };
}

function metrics() {
  const ledgerRows = financeLedgerRows("all");
  const ledgerTotals = financeLedgerTotals(ledgerRows);
  const totalCollected = financeRows().filter((f) => f.type === "Payment").reduce((s, f) => s + parseMoney(f.amount), 0);
  const bidsExtended = state.pnms.filter((p) => ["Bid extended", "Accepted", "Declined"].includes(p.status) || p.bidExtendedDate).length;
  const bidsAccepted = state.pnms.filter((p) => p.status === "Accepted" || p.bidAcceptedDate).length;
  return {
    members: activeMembers().length,
    newMembers: activeMembers().filter((m) => m.initiationStatus === "New Member" || m.memberStatus === "New Member").length,
    pnms: activePnms().length,
    events: upcomingEvents().length,
    tasks: openTasks().length,
    totalBilled: ledgerTotals.pending / 100,
    totalCollected,
    currentBalances: ledgerTotals.current / 100,
    outstanding: ledgerTotals.outstanding / 100,
    unpaid: ledgerRows.filter((row) => row.totalBalanceCents > 0 && row.paymentPlanStatus === "None").length,
    partial: ledgerRows.filter((row) => row.totalBalanceCents > 0 && row.paymentPlanStatus !== "None").length,
    paid: ledgerTotals.paidInFull,
    pastDue: ledgerRows.filter((row) => row.totalBalanceCents > 0 && row.dueDate && row.dueDate < todayIso()).length,
    plans: ledgerTotals.paymentPlans,
    credits: ledgerTotals.credits,
    pnmFollowUps: activePnms().filter((p) => p.followUpDate && p.followUpDate <= todayIso()).length,
    bidsExtended,
    bidsAccepted,
    acceptanceRate: pct(bidsAccepted, bidsExtended)
  };
}

function normalizeTitle(title = "") {
  return String(title || "")
    .toLowerCase()
    .replace(/^tpe[_\s-]*/i, "")
    .replace(/chairman/g, "chair")
    .replace(/vp of membership development/g, "vice president of membership development")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalPositionTitle(role = "") {
  const key = normalizeTitle(role);
  if (!key) return "";
  if (["vpmd", "vp membership development", "vice president of membership development", "vice president membership development", "membership development", "brotherhood", "brotherhood chair", "brotherhood vpmd", "vpmd brotherhood"].includes(key)) return "VPMD";
  if (["recruitment", "recruitment chair", "rush", "new member recruitment"].includes(key)) return "Recruitment";
  if (["risk manager", "risk management", "health safety", "health and safety", "health and safety officer"].includes(key)) return key.includes("health") ? "Health and Safety" : "Risk Management";
  if (["new member educator", "new member education", "tpe new member educator"].includes(key)) return "New Member Education";
  if (["alumni relations", "alumni relations chair"].includes(key)) return "Alumni Relations";
  if (["social chair", "social"].includes(key)) return "Social";
  if (["philanthropy chair", "philanthropy"].includes(key)) return "Philanthropy";
  if (["sergeant at arms"].includes(key)) return "Sergeant at Arms";
  return String(role || "").replace(/^TPE[_\s-]*/i, "").replace(/\s+/g, " ").trim();
}

function positionFullTitle(position = "") {
  if (position === "VPMD") return "Vice President of Membership Development";
  return position;
}

function positionResponsibilityLabel(position = "", original = "") {
  if (position === "VPMD") return "Brotherhood";
  if (position === "Recruitment") return "Recruitment";
  const key = normalizeTitle(original || position);
  if (key.includes("risk")) return "Risk Management";
  if (key.includes("health") || key.includes("safety")) return "Health and Safety";
  return "";
}

function displayPosition(position = "", original = "") {
  const label = positionResponsibilityLabel(position, original);
  return label && label !== position ? `${position} — ${label}` : position;
}

function normalizeLeadershipAssignments(assignments = []) {
  const seen = new Set();
  return (assignments || []).map((assignment) => {
    const role = canonicalPositionTitle(assignment.role || assignment.position || "");
    return {
      ...assignment,
      role: role || assignment.role || "",
      formalPosition: role || assignment.formalPosition || assignment.role || "",
      fullPositionTitle: positionFullTitle(role || assignment.role || ""),
      responsibilityLabel: positionResponsibilityLabel(role || assignment.role || "", assignment.role),
      isExecutive: assignment.archived ? Boolean(assignment.isExecutive) : true,
      is_executive: assignment.archived ? Boolean(assignment.is_executive) : true
    };
  }).filter((assignment) => {
    const memberId = assignment.assignedMember || assignment.member_id || assignment.memberId || assignment.user_id || assignment.userId || assignment.profile_id || assignment.profileId || "";
    const key = `${memberId}:${normalizeTitle(assignment.role)}:${assignment.termStartDate || assignment.term_start_date || ""}:${assignment.termEndDate || assignment.term_end_date || ""}:${assignment.archived ? "archived" : "active"}`;
    if (!memberId || !assignment.role || assignment.archived) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isExecutiveRole(role = "", assignment = {}) {
  if (!assignment.archived && role && canonicalPositionTitle(role) !== "General member") return true;
  if (assignment.is_executive === true || assignment.isExecutive === true || assignment.executive_board === true || assignment.executiveBoard === true) return true;
  if (["executive", "executive board", "exec", "exec board"].includes(normalizeTitle(assignment.officer_type || assignment.officerType || assignment.position_category || assignment.positionCategory || assignment.role_category || assignment.roleCategory))) return true;
  const executiveRoles = state.settings.executiveOfficerRoles || defaults.executiveOfficerRoles;
  const roleKey = normalizeTitle(canonicalPositionTitle(role));
  return executiveRoles.map((r) => normalizeTitle(canonicalPositionTitle(r))).includes(roleKey);
}

function addOfficerRole(group, item) {
  const title = canonicalPositionTitle(item.role || item.position || "");
  if (!title) return;
  if (!group.roleKeys.has(normalizeTitle(title))) {
    group.roles.push(title);
    group.roleKeys.add(normalizeTitle(title));
  }
  const responsibility = item.responsibilityLabel || positionResponsibilityLabel(title, item.role);
  if (item.committee && !group.committees.includes(item.committee)) group.committees.push(item.committee);
  if (responsibility && !group.responsibilityLabels.includes(responsibility)) group.responsibilityLabels.push(responsibility);
  if (item.responsibilities && !group.responsibilities.includes(item.responsibilities)) group.responsibilities.push(item.responsibilities);
  if (item.id && !group.assignmentIds.includes(item.id)) group.assignmentIds.push(item.id);
  group.termStartDate = group.termStartDate || item.termStartDate || item.term_start_date || "";
  group.termEndDate = group.termEndDate || item.termEndDate || item.term_end_date || "";
  group.hasExecutiveRole = group.hasExecutiveRole || isExecutiveRole(title, item);
}

function buildOfficerDirectory() {
  const byMember = new Map();
  const ensureGroup = (memberId) => {
    const member = state.members.find((m) => m.id === memberId);
    if (!member || member.archived || member.deletedAt || member.lifecycle === "Archived") return null;
    if (!byMember.has(memberId)) {
      byMember.set(memberId, {
        memberId,
        member,
        roles: [],
        roleKeys: new Set(),
        committees: [],
        responsibilityLabels: [],
        responsibilities: [],
        assignmentIds: [],
        termStartDate: "",
        termEndDate: "",
        hasExecutiveRole: false
      });
    }
    return byMember.get(memberId);
  };

  state.leadership.filter((l) => !l.archived).forEach((assignment) => {
    const memberId = assignment.assignedMember || assignment.member_id || assignment.memberId || assignment.user_id || assignment.userId || assignment.profile_id || assignment.profileId;
    const group = ensureGroup(memberId);
    if (group) addOfficerRole(group, assignment);
  });

  state.members.filter((m) => !m.archived && m.lifecycle !== "Archived" && m.officerRole).forEach((member) => {
    const group = ensureGroup(member.id);
    if (group) addOfficerRole(group, { id: `member-role:${member.id}:${member.officerRole}`, assignedMember: member.id, role: member.officerRole, committee: member.committee });
  });

  const groups = [...byMember.values()].map((group) => ({ ...group, roleKeys: undefined })).sort((a, b) => memberName(a.memberId).localeCompare(memberName(b.memberId)));
  return { executiveOfficers: groups, otherOfficers: [], allOfficers: groups };
}

const collectionMeta = {
  members: {
    title: "Member roster",
    permission: "manage_members",
    addLabel: "Add member",
    emptyTitle: "No members added",
    emptyText: "Add a member manually or import the chapter roster.",
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
    emptyTitle: "No PNMs added",
    emptyText: "Add a potential new member or import a recruitment list.",
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
    emptyTitle: "No events added",
    emptyText: "Create an event to begin tracking attendance.",
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
    emptyTitle: "No finance records available",
    emptyText: "Import balances or add the first charge.",
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
    emptyTitle: "No tasks created",
    emptyText: "Create an action item for chapter follow-up.",
    search: ["title", "description", "assignedPerson", "priority", "status", "relatedType", "notes"],
    columns: ["title", "assignedPerson", "dueDate", "priority", "status", "relatedType", "notes"],
    fields: [
      ["title", "Title", "text", "required"], ["description", "Description", "textarea"], ["assignedPerson", "Assigned person", "select", "members"], ["dueDate", "Due date", "date"], ["priority", "Priority", "select", ["High", "Medium", "Low"]], ["status", "Status", "select", ["Not started", "In progress", "Waiting", "Done", "Archived"]],
      ["relatedMember", "Related member", "select", "members"], ["relatedEvent", "Related event", "select", "events"], ["relatedFinanceItem", "Related finance item ID", "text"], ["notes", "Notes", "textarea"]
    ]
  }
};

function render() {
  refreshNavigation();
  if (cloud.client && cloud.user && cloud.profile?.approval_status === "approved" && !routeAllowed(activeView)) activeView = defaultViewForRole();
  document.getElementById("viewTitle").textContent = viewNames[activeView];
  document.getElementById("orgLabel").textContent = `${state.settings.chapterName} · ${state.settings.schoolName}`;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === activeView));
  document.getElementById("resetBtn").textContent = "Clear local data";
  updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Sign in required");
  const root = document.getElementById("appRoot");
  if (cloud.client && !cloud.user) {
    root.innerHTML = renderLoginGate();
    bindAuthActions(root);
    return;
  }
  if (cloud.client && cloud.user && cloud.profile?.approval_status !== "approved") {
    root.innerHTML = renderApprovalGate();
    bindAuthActions(root);
    return;
  }
  if (cloud.client && cloud.user && cloud.profile?.approval_status === "approved" && !isFullWorkspaceAllowed()) {
    root.innerHTML = renderMemberPortal();
    bindViewActions(root);
    bindAuthActions(root);
    return;
  }
  if (!routeAllowed(activeView)) {
    root.innerHTML = renderRestrictedPage();
    bindViewActions(root);
    bindAuthActions(root);
    return;
  }
  root.innerHTML = ({
    dashboard: renderDashboard,
    members: () => renderCollection("members"),
    recruitment: () => renderCollection("pnms"),
    events: () => renderCollection("events"),
    finance: () => renderCollection("finance"),
    kpis: renderKpiReports,
    tasks: () => renderCollection("tasks"),
    leadership: renderLeadership,
    reports: renderReports,
    settings: renderSettings
  }[activeView] || renderDashboard)();
  bindViewActions(root);
  bindAuthActions(root);
}

function refreshNavigation() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  const items = navigationItems.filter((item) => !cloud.client || !cloud.user || can(item.permission));
  nav.innerHTML = items.map((item) => `<button class="nav-item ${item.view === activeView ? "active" : ""}" data-view="${safe(item.view)}">${safe(item.label)}</button>`).join("");
  nav.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
}

function routeAllowed(view = activeView) {
  const permission = routePermissions[view];
  return !permission || can(permission);
}

function defaultViewForRole() {
  return isFullWorkspaceAllowed() ? "dashboard" : "portal";
}

function renderRestrictedPage() {
  return `<section class="auth-shell">
    <div class="auth-card">
      <p class="eyebrow">Access Restricted</p>
      <h3>You do not have permission to view this section.</h3>
      <p class="muted">Executive and administrative tools are available only to authorized chapter officers.</p>
      <button class="primary" data-go="${safe(defaultViewForRole())}">Return to Home</button>
    </div>
  </section>`;
}

function renderMemberPortal() {
  return `<section class="auth-shell member-portal">
    <div class="auth-card">
      <p class="eyebrow">Member Portal</p>
      <h3>Your account is active.</h3>
      <p class="muted">Executive and administrative tools are available only to authorized chapter officers.</p>
      <div class="profile-grid">
        <div><span>Email</span><strong>${safe(cloud.profile?.email || cloud.user?.email || "")}</strong></div>
        <div><span>Role</span><strong>${safe(resolvedRole())}</strong></div>
        <div><span>Status</span><strong>${safe(cloud.profile?.approval_status || "approved")}</strong></div>
        <div><span>Chapter</span><strong>Alpha Omega</strong></div>
      </div>
      <p class="muted">Member-facing profile, balance, attendance, and task pages can be enabled after matching row-level policies are added for those limited fields.</p>
    </div>
  </section>`;
}

function renderPageHeader(title, subtitle = "", actions = []) {
  return `<section class="page-header">
    <div>
      <h3>${safe(title)}</h3>
      ${subtitle ? `<p>${safe(subtitle)}</p>` : ""}
    </div>
    ${actions.length ? `<div class="button-row">${actions.map(([label, style, target]) => renderHeaderAction(label, style, target)).join("")}</div>` : ""}
  </section>`;
}

function renderHeaderAction(label, style = "ghost", target = "") {
  if (target.endsWith(":add")) return `<button class="${safe(style)}" data-add="${safe(target.split(":")[0])}">${safe(label)}</button>`;
  if (target.endsWith(":import")) return `<button class="${safe(style)}" data-import="${safe(target.split(":")[0])}">${safe(label)}</button>`;
  if (target.startsWith("export:")) return `<button class="${safe(style)}" data-export="${safe(target.split(":")[1])}">${safe(label)}</button>`;
  if (target === "print") return `<button class="${safe(style)}" data-print>${safe(label)}</button>`;
  return `<button class="${safe(style)}" data-go="${safe(target)}">${safe(label)}</button>`;
}

function renderLoginGate() {
  return `<section class="auth-shell">
    <div class="auth-card">
      <p class="eyebrow">ChapterOps</p>
      <h3>Alpha Omega Chapter</h3>
      <p class="muted">Kansas State University · Pi Kappa Alpha</p>
      <p>Sign in to access chapter operations.</p>
      <form id="loginForm" class="auth-form">
        <label>Email address<input name="email" type="email" autocomplete="email" placeholder="name@email.com" required /></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="primary" type="submit">Sign in</button>
      </form>
      <div class="button-row">
        <button class="ghost" data-auth-mode="signup">Request access</button>
        <button class="ghost" data-auth-mode="reset">Forgot password</button>
      </div>
    </div>
  </section>`;
}

function renderApprovalGate() {
  const status = cloud.profile?.approval_status || "pending";
  const title = status === "rejected" ? "Access request rejected" : status === "disabled" ? "Account disabled" : "Account pending approval";
  const body = status === "pending"
    ? "Your request was submitted. An Admin must approve your account and assign a role before you can access private chapter data."
    : status === "disabled"
      ? "This account has been disabled. Contact an Admin if this is unexpected."
      : "This account is not approved for ChapterOps access. Contact an Admin if this is unexpected.";
  return `<section class="auth-shell">
    <div class="auth-card">
      <p class="eyebrow">Request access</p>
      <h3>${title}</h3>
      <p class="muted">${body}</p>
      <div class="profile-grid">
        <div><span>Email</span><strong>${safe(cloud.profile?.email || cloud.user.email)}</strong></div>
        <div><span>Requested role</span><strong>${safe(cloud.profile?.requested_role || "Active Member")}</strong></div>
        <div><span>Status</span><strong>${safe(status)}</strong></div>
        <div><span>Requested</span><strong>${safe(cloud.profile?.created_at ? new Date(cloud.profile.created_at).toLocaleString() : "")}</strong></div>
      </div>
      <div class="button-row"><button class="ghost" id="pendingSignOut">Sign out</button></div>
    </div>
  </section>`;
}

function renderDashboard() {
  const m = metrics();
  const needsSetup = !state.settings.setupComplete || !state.settings.term || !state.settings.academicYear;
  return `
    ${renderPageHeader("Alpha Omega Chapter Operations", "Kansas State University · Pi Kappa Alpha", [
      needsSetup ? ["Complete Setup", "primary", "settings"] : ["Add Member", "primary", "members:add"],
      ["Import Roster", "ghost", "members:import"]
    ])}
    ${needsSetup ? renderSetupPrompt() : ""}
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
      <div class="panel-head"><h3>Quick actions</h3></div>
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
  const steps = [
    Boolean(state.settings.chapterName && state.settings.schoolName),
    Boolean(state.settings.term),
    Boolean(state.settings.academicYear),
    Boolean(state.settings.defaultDuesAmount),
    Boolean(state.settings.officerRoles?.length)
  ];
  const complete = steps.filter(Boolean).length;
  return `<section class="panel setup-panel compact-panel">
    <div class="panel-head"><div><p class="eyebrow">Setup</p><h3>Chapter setup</h3><p class="muted">${complete} of ${steps.length} steps complete</p></div><button class="primary" data-go="settings">Continue setup</button></div>
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
  if (key === "finance" && !can("finance.member_balances.view") && !can("all")) return restrictedPanel("Financial data is restricted to authorized finance roles.");
  if (key === "finance") return renderFinanceLedger();
  const meta = collectionMeta[key];
  const rows = filteredRows(key);
  const importPermission = { members: "members.import", pnms: "recruitment.manage", events: "attendance.manage", tasks: "tasks.manage" }[key];
  const exportPermission = { members: "members.export", pnms: "recruitment.view", events: "attendance.view", tasks: "reports.export" }[key];
  return `<section class="panel">
    <div class="panel-head page-panel-head">
      <div><h3>${safe(pageTitleForKey(key))}</h3><p class="muted">${safe(pageSubtitleForKey(key))}</p></div>
      <div class="button-row">
        <input class="search" id="searchInput" placeholder="Search ${meta.title.toLowerCase()}" value="${safe(activeFilters[key]?.q || "")}" />
        ${can(importPermission) ? `<button class="ghost" data-import="${key}">Import CSV</button>` : ""}
        ${can(exportPermission) ? `<button class="ghost" data-export="${key}">Export CSV</button>` : ""}
        ${actionAllowed(key) ? `<button class="primary" data-add="${key}">${meta.addLabel}</button>` : ""}
      </div>
    </div>
    ${key === "finance" ? renderTreasurerDashboard() : ""}
    ${key === "events" ? renderCheckinPanel() : ""}
    ${key === "pnms" ? renderRecruitmentSummary() : ""}
    ${renderTable(key, rows)}
  </section>`;
}

function pageTitleForKey(key) {
  return { members: "Members", pnms: "Recruitment", events: "Attendance", finance: "Finance", tasks: "Tasks" }[key] || collectionMeta[key]?.title || labelize(key);
}

function pageSubtitleForKey(key) {
  return {
    members: "Manage the active chapter roster and member information.",
    pnms: "Track potential new members, events, and bids.",
    events: "Manage event attendance and participation.",
    finance: "Track chapter charges, balances, payments, and plans.",
    tasks: "Assign and monitor chapter action items."
  }[key] || "";
}

function renderFinanceLedger() {
  const filtered = financeLedgerRows("filtered");
  const allRows = financeLedgerRows("all");
  const filteredTotals = financeLedgerTotals(filtered);
  const fullTotals = financeLedgerTotals(allRows);
  const filter = activeFilters.finance || {};
  const quickFilters = [
    ["all", "All members"],
    ["balance", "With a balance"],
    ["paid", "Paid in full"],
    ["credits", "Credits"],
    ["plans", "Payment plans"],
    ["overdue", "Overdue"],
    ["nocharge", "No current charge"]
  ];
  return `<section class="panel finance-ledger">
    <div class="panel-head page-panel-head">
      <div><h3>Finance</h3><p class="muted">Member balances, charges, payments, and payment plans.</p></div>
      <div class="button-row">
        <input class="search" id="searchInput" placeholder="Search name, member ID, status, balances" value="${safe(filter.q || "")}" />
        ${can("finance.import") ? `<button class="ghost" data-import="finance">Import Finance CSV</button>` : ""}
        ${can("finance.export") ? `<button class="ghost" data-export="finance-filtered">Export filtered</button><button class="ghost" data-export="finance-all">Export all</button><button class="ghost" data-finance-template>Template</button>` : ""}
      </div>
    </div>
    ${renderFinanceTotals("Filtered totals", filteredTotals)}
    ${renderFinanceTotals("Full chapter totals", fullTotals)}
    <div class="status-strip finance-filters">${quickFilters.map(([value, label]) => `<button class="${(filter.quick || "all") === value ? "active" : ""}" data-finance-filter="${value}">${safe(label)}<strong>${value === "all" ? allRows.length : quickFilterCount(value, allRows)}</strong></button>`).join("")}</div>
    ${filtered.length ? renderFinanceLedgerTable(filtered) : renderFinanceEmptyState()}
  </section>`;
}

function renderFinanceTotals(title, totals) {
  return `<section class="treasurer-dash finance-totals">
    <p class="eyebrow">${safe(title)}</p>
    <div class="mini-grid">
      ${mini("Pending Charges", moneyFromCents(totals.pending))}
      ${mini("Current Balances", moneyFromCents(totals.current))}
      ${mini("Total Outstanding", moneyFromCents(totals.outstanding))}
      ${mini("With Balance", totals.withBalance)}
      ${mini("Paid in Full", totals.paidInFull)}
      ${mini("Credits", totals.credits)}
      ${mini("Payment Plans", totals.paymentPlans)}
    </div>
  </section>`;
}

function quickFilterCount(filter, rows) {
  if (filter === "balance") return rows.filter((row) => row.totalBalanceCents > 0).length;
  if (filter === "paid") return rows.filter((row) => row.totalBalanceCents === 0).length;
  if (filter === "credits") return rows.filter((row) => row.totalBalanceCents < 0 || row.currentBalanceCents < 0).length;
  if (filter === "plans") return rows.filter((row) => row.paymentPlanStatus && row.paymentPlanStatus !== "None").length;
  if (filter === "overdue") return rows.filter((row) => row.totalBalanceCents > 0 && row.dueDate && row.dueDate < todayIso()).length;
  if (filter === "nocharge") return rows.filter((row) => row.pendingChargeCents === 0).length;
  return rows.length;
}

function renderFinanceLedgerTable(rows) {
  const cols = [
    ["lastName", "Last Name"],
    ["firstName", "First Name"],
    ["memberIdentifier", "Member ID"],
    ["status", "Status"],
    ["memberType", "Member Type"],
    ["pendingChargeCents", "Pending Charge"],
    ["paymentPlanStatus", "Payment Plan"],
    ["currentBalanceCents", "Current Balance"],
    ["totalBalanceCents", "Total Balance", "Pending charges plus current balance"]
  ];
  return `<div class="table-wrap finance-table-wrap"><table class="finance-ledger-table"><thead><tr>${cols.map(([key, label, title]) => `<th title="${safe(title || "")}"><button class="th-sort" data-finance-sort="${key}">${safe(label)}${financeSort.key === key ? ` ${financeSort.dir === "asc" ? "▲" : "▼"}` : ""}</button></th>`).join("")}<th>Actions</th></tr></thead><tbody>
    ${rows.map((row) => `<tr data-finance-member="${safe(row.memberId)}">
      ${cols.map(([key, label]) => `<td data-label="${safe(label)}">${formatFinanceCell(row, key)}</td>`).join("")}
      <td data-label="Actions"><div class="row-actions">${actionAllowed("finance") ? `<button class="small ghost" data-edit-finance="${safe(row.memberId)}">Edit ledger</button><button class="small ghost" data-record-payment="${safe(row.memberId)}">Record payment</button>` : `<button class="small ghost" data-view-finance="${safe(row.memberId)}">View</button>`}</div></td>
    </tr>`).join("")}
    <tr class="table-total-row"><td data-label="Totals" colspan="5"><strong>Filtered totals</strong></td><td data-label="Pending Charge"><strong>${moneyFromCents(financeLedgerTotals(rows).pending)}</strong></td><td></td><td data-label="Current Balance"><strong>${moneyFromCents(financeLedgerTotals(rows).current)}</strong></td><td data-label="Total Balance"><strong>${moneyFromCents(financeLedgerTotals(rows).outstanding)}</strong></td><td></td></tr>
  </tbody></table></div>`;
}

function formatFinanceCell(row, key) {
  if (["pendingChargeCents", "currentBalanceCents", "totalBalanceCents"].includes(key)) {
    const cls = row[key] < 0 ? "credit" : row[key] > 0 ? "balance" : "paid";
    return `<span class="money ${cls}">${moneyFromCents(row[key])}</span>`;
  }
  if (key === "paymentPlanStatus") {
    const value = row.paymentPlanStatus || "None";
    return `<span class="status-pill">${safe(value)}</span>`;
  }
  return safe(row[key]);
}

function renderFinanceEmptyState() {
  if (!activeMembers().length) return `<div class="empty-state"><h3>No members added</h3><p>Add members before entering balances.</p><div class="button-row centered"><button class="primary" data-go="members">Open Members</button><button class="ghost" data-import="members">Import Roster</button></div></div>`;
  return `<div class="empty-state"><h3>No finance rows match</h3><p>Adjust filters or import balances.</p><div class="button-row centered"><button class="primary" data-finance-filter="all">Clear Filters</button><button class="ghost" data-import="finance">Import Finance</button></div></div>`;
}

function actionAllowed(key) {
  if (key === "pnms") return can("all") || can("recruitment.manage");
  if (key === "members") return can("all") || can("members.create") || can("members.update");
  if (key === "events") return can("all") || can("attendance.manage");
  if (key === "finance") return can("all") || can("finance.manage");
  if (key === "tasks") return can("all") || can("tasks.manage");
  return can("all");
}

function filteredRows(key) {
  const q = (activeFilters[key]?.q || "").toLowerCase();
  let rows = (state[key] || []).filter((r) => !r.archived && !r.deletedAt && r.status !== "Archived" && r.lifecycle !== "Archived");
  if (key === "members") rows = uniqueMembersById(rows);
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
  const deleting = pendingDeletes.has(`${key}:${row.id}`);
  return `<div class="row-actions">${quick}${editable ? `<button class="small ghost" data-edit="${key}:${row.id}" ${deleting ? "disabled" : ""}>Edit</button><button class="small ghost" data-archive="${key}:${row.id}" ${deleting ? "disabled" : ""}>Archive</button>${can("all") ? `<button class="small danger" data-delete="${key}:${row.id}" ${deleting ? "disabled" : ""}>${deleting ? "Removing…" : "Delete"}</button>` : ""}` : ""}</div>`;
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

function mini(label, value, view = "finance") {
  return `<button class="mini-card" data-go="${safe(view)}"><span>${label}</span><strong>${value}</strong></button>`;
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
  const directory = buildOfficerDirectory();
  const hasRows = directory.allOfficers.length;
  return `<section class="panel">
    <div class="panel-head page-panel-head"><div><h3>Executive Team</h3><p class="muted">Current chapter leadership and officer assignments.</p></div><button class="primary" data-add-leadership>Add Role</button></div>
    ${hasRows ? `
      ${renderOfficerSection("Current Officers", directory.executiveOfficers, "")}
      ${renderLeadershipRoster()}
    ` : `<div class="empty-state"><h3>No Executive Team roles assigned</h3><p>Add officer assignments to build the leadership directory.</p><button class="primary" data-add-leadership>Add Role</button></div>`}
  </section>`;
}

function renderOfficerSection(title, officers, emptyText) {
  if (!officers.length) return "";
  return `<section class="leadership-section">
    <div class="section-head"><h4>${safe(title)}</h4>${emptyText ? `<p>${safe(emptyText)}</p>` : ""}</div>
    <div class="card-grid">${officers.map(renderOfficerCard).join("")}</div>
  </section>`;
}

function renderOfficerCard(officer) {
  const primaryRole = officer.roles[0] || "Executive Team";
  const member = officer.member || state.members.find((m) => m.id === officer.memberId) || {};
  const term = [officer.termStartDate || officer.term_start_date, officer.termEndDate || officer.term_end_date].filter(Boolean).join(" – ");
  return `<article class="profile-card" data-open="members" data-id="${safe(officer.memberId)}">
    <p class="eyebrow">${safe(officer.responsibilityLabels.join(" · ") || "Executive Team")}</p>
    <h3>${safe(memberName(officer.memberId) || "Unassigned")}</h3>
    <p><strong>${safe(officer.roles.map((role) => displayPosition(role)).join(", "))}</strong></p>
    <p class="muted">${safe(positionFullTitle(primaryRole))}</p>
    <p>${safe([member.email, member.phone].filter(Boolean).join(" · ") || "No contact info on member profile")}</p>
    ${term ? `<p class="muted">Term: ${safe(term)}</p>` : ""}
    <p><span class="status-pill">${safe(member.memberStatus || member.lifecycle || "Active")}</span></p>
    ${officer.responsibilities.length ? `<p>${safe(officer.responsibilities[0])}</p>` : ""}
    <div class="button-row">
      <button class="ghost small" data-open="members" data-id="${safe(officer.memberId)}">Open profile</button>
      ${officer.assignmentIds.find((id) => !String(id).startsWith("member-role:")) ? `<button class="ghost small" data-edit-leadership="${safe(officer.assignmentIds.find((id) => !String(id).startsWith("member-role:")))}">Edit assignment</button>` : ""}
    </div>
  </article>`;
}

function renderLeadershipRoster() {
  const members = activeMembers();
  if (!members.length) return "";
  return `<section class="leadership-section">
    <div class="section-head"><h4>Roster View</h4></div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Officer role</th><th>Committee</th><th>Status</th></tr></thead><tbody>
      ${members.map((m) => `<tr data-open="members" data-id="${safe(m.id)}"><td data-label="Name"><button class="linklike">${safe(memberName(m.id))}</button></td><td data-label="Officer role">${safe(m.officerRole || "—")}</td><td data-label="Committee">${safe(m.committee || "—")}</td><td data-label="Status">${safe(m.memberStatus || m.lifecycle || "Active")}</td></tr>`).join("")}
    </tbody></table></div>
  </section>`;
}

function renderReports() {
  const m = metrics();
  const officerDirectory = buildOfficerDirectory();
  const reportsEmpty = !state.members.length && !state.finance.length && !state.events.length && !state.tasks.length;
  return `<section class="panel printable">
    <div class="panel-head"><div><p class="eyebrow">Reports</p><h3>Executive and Treasurer reports</h3></div><div class="button-row"><button class="ghost" data-export="reports">Export summary CSV</button><button class="primary" data-print>PDF / Print</button></div></div>
    ${reportsEmpty ? `<div class="empty-state"><h3>Reports will populate once data is entered.</h3><p>Add members, dues charges, payments, events, attendance, and tasks to generate useful reports.</p><div class="button-row centered"><button class="primary" data-go="members">Add members</button><button class="ghost" data-go="finance">Open finance</button></div></div>` : ""}
    <div class="mini-grid">
      ${mini("Member roster", state.members.filter((m) => !m.archived).length)}
      ${mini("Dues report", money(m.totalBilled))}
      ${mini("Outstanding balances", money(m.outstanding))}
      ${mini("Payment history", state.finance.filter((f) => f.type === "Payment").length)}
      ${mini("Attendance records", state.attendance.length)}
      ${mini("Executive Team", officerDirectory.executiveOfficers.length)}
      ${mini("KPI meetings", state.kpiMeetings.length)}
      ${mini("Open officer tasks", m.tasks)}
    </div>
    <div class="two-col">
      ${reportBlock("Executive Team", officerDirectory.executiveOfficers.map((o) => `${memberName(o.memberId)}: ${o.roles.map((r) => displayPosition(r)).join(", ")}`))}
      ${reportBlock("KPI reporting", (state.kpiMeetings || []).slice(0, 10).map((meeting) => `${meeting.title || "KPI Meeting"} · ${meeting.meetingDate || ""} · ${meeting.status || "Draft"}`))}
      ${reportBlock("Outstanding balances", activeMembers().map((m) => ({ name: memberName(m.id), ...memberFinance(m.id) })).filter((x) => x.balance > 0).map((x) => `${x.name}: ${money(x.balance)} · ${x.status}`))}
      ${reportBlock("Payment history", financeRows().filter((f) => f.type === "Payment").slice(0, 25).map((f) => `${memberName(f.memberId)} · ${money(f.amount)} · ${f.paymentDate || ""}`))}
      ${reportBlock("Attendance report", state.attendance.slice(0, 25).map((a) => `${eventName(a.eventId)} · ${a.personType === "Member" ? memberName(a.personId) : pnmName(a.personId)} · ${a.status}`))}
      ${reportBlock("Officer task report", openTasks().slice(0, 25).map((t) => `${t.title} · ${t.status} · due ${t.dueDate || "not set"}`))}
    </div>
  </section>`;
}

function activeExecutivePositions() {
  const byPosition = new Map();
  buildOfficerDirectory().executiveOfficers.forEach((officer) => {
    officer.roles.forEach((role) => {
      const position = canonicalPositionTitle(role);
      if (!position || position === "General member") return;
      if (!byPosition.has(position)) {
        byPosition.set(position, {
          position,
          label: displayPosition(position),
          fullTitle: positionFullTitle(position),
          responsibilityLabel: positionResponsibilityLabel(position),
          officerMemberIds: [],
          officers: []
        });
      }
      const row = byPosition.get(position);
      if (!row.officerMemberIds.includes(officer.memberId)) row.officerMemberIds.push(officer.memberId);
      if (!row.officers.find((o) => o.memberId === officer.memberId)) row.officers.push(officer);
    });
  });
  return [...byPosition.values()].sort((a, b) => a.position.localeCompare(b.position));
}

function renderKpiReports() {
  if (!can("kpi.view") && !can("all")) return restrictedPanel("KPI Reports are restricted to authorized Executive Team, reporting, and advisor roles.");
  const meetings = [...(state.kpiMeetings || [])].filter((m) => m.status !== "Archived").sort((a, b) => String(b.meetingDate || b.meeting_date || "").localeCompare(String(a.meetingDate || a.meeting_date || "")));
  const selectedId = activeFilters.kpis?.meetingId || meetings[0]?.id || "";
  const meeting = meetings.find((m) => m.id === selectedId);
  return `<section class="panel kpi-page printable">
    <div class="panel-head page-panel-head">
      <div><h3>KPI Reports</h3><p class="muted">Track executive goals, results, blockers, and follow-up actions.</p></div>
      <div class="button-row">
        ${canManageKpis() ? `<button class="primary" data-create-kpi-meeting>New KPI Meeting</button><button class="ghost" data-add-kpi-definition>Add KPI</button>` : ""}
        <button class="ghost" data-export="kpis">Export Report</button>
        <button class="ghost" data-print>Print / PDF</button>
      </div>
    </div>
    ${meetings.length ? renderKpiMeetingPicker(meetings, selectedId) : ""}
    ${meeting ? renderSelectedKpiMeeting(meeting) : renderKpiEmptyState()}
  </section>`;
}

function renderKpiEmptyState() {
  const positions = activeExecutivePositions();
  return `<div class="empty-state"><h3>No KPI meetings yet</h3><p>Create the first meeting to collect executive updates and action items.</p><div class="button-row centered">${canManageKpis() ? `<button class="primary" data-create-kpi-meeting>Create KPI Meeting</button><button class="ghost" data-go="leadership">Executive Team</button>` : `<button class="ghost" data-go="leadership">Executive Team</button>`}</div></div>`;
}

function renderKpiMeetingPicker(meetings, selectedId) {
  return `<div class="button-row kpi-picker">
    <label>Selected meeting<select id="kpiMeetingSelect">${meetings.map((m) => `<option value="${safe(m.id)}" ${m.id === selectedId ? "selected" : ""}>${safe(m.title || "KPI meeting")} · ${safe(m.meetingDate || "")}</option>`).join("")}</select></label>
    ${selectedId ? `<button class="ghost" data-copy-kpi-meeting="${safe(selectedId)}">Copy as next meeting</button>` : ""}
  </div>`;
}

function renderSelectedKpiMeeting(meeting) {
  ensureKpiReportsForMeeting(meeting, false);
  const reports = kpiReportsForMeeting(meeting.id);
  const summary = kpiMeetingSummary(meeting.id);
  return `<section class="kpi-meeting">
    <div class="notice">
      <div class="panel-head">
        <div>
          <p class="eyebrow">${safe(meeting.status || "Draft")}</p>
          <h3>${safe(meeting.title || "KPI Meeting")}</h3>
          <p class="muted">Meeting date: ${safe(meeting.meetingDate || "Not set")} · Reporting period: ${safe(meeting.reportingPeriodStart || "—")} to ${safe(meeting.reportingPeriodEnd || "—")}</p>
        </div>
        ${canManageKpis() ? `<button class="ghost" data-edit-kpi-meeting="${safe(meeting.id)}">Edit meeting</button>` : ""}
      </div>
    </div>
    <div class="mini-grid">
      ${mini("Reports completed", `${summary.completedReports} of ${summary.totalReports}`, "kpis")}
      ${mini("Reports missing", summary.missingReports, "kpis")}
      ${mini("KPIs On Track", summary.onTrack, "kpis")}
      ${mini("KPIs At Risk", summary.atRisk, "kpis")}
      ${mini("KPIs Off Track", summary.offTrack, "kpis")}
      ${mini("Overdue actions", summary.overdueActions, "kpis")}
      ${mini("Due this week", summary.actionsDueThisWeek, "kpis")}
      ${mini("Meeting readiness", `${summary.readiness}%`, "kpis")}
    </div>
    ${renderKpiMeetingTable(meeting, reports)}
    ${renderKpiDefinitionsPanel()}
    ${renderKpiHistory(meeting.id)}
  </section>`;
}

function renderKpiMeetingTable(meeting, reports) {
  if (!reports.length) return `<div class="empty-state"><h3>No Executive Team positions found.</h3><p>Add Executive Team roles before generating KPI report sections.</p><button class="primary" data-go="leadership">Open Executive Team</button></div>`;
  return `<section class="leadership-section">
    <div class="section-head"><h4>Executive Reports</h4></div>
    <div class="table-wrap"><table><thead><tr><th>Executive Position</th><th>Officer</th><th>Report Status</th><th>On Track</th><th>At Risk</th><th>Off Track</th><th>Blockers</th><th>Follow-Up Actions</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>
      ${reports.map((report) => renderKpiReportRow(meeting, report)).join("")}
    </tbody></table></div>
  </section>`;
}

function renderKpiReportRow(meeting, report) {
  const results = state.kpiResults.filter((r) => r.positionReportId === report.id);
  const actions = state.kpiActionItems.filter((a) => a.positionReportId === report.id && a.status !== "Completed" && a.status !== "Cancelled");
  const officerNames = (report.officerMemberIds || [report.officerMemberId]).filter(Boolean).map(memberName).filter(Boolean).join(", ") || "Unassigned";
  return `<tr data-open-kpi-report="${safe(report.id)}">
    <td data-label="Executive Position"><strong>${safe(displayPosition(report.position))}</strong></td>
    <td data-label="Officer">${safe(officerNames)}</td>
    <td data-label="Report Status"><span class="status-pill">${safe(report.status || "Draft")}</span></td>
    <td data-label="On Track">${results.filter((r) => r.status === "On Track").length}</td>
    <td data-label="At Risk">${results.filter((r) => r.status === "At Risk").length}</td>
    <td data-label="Off Track">${results.filter((r) => r.status === "Off Track").length}</td>
    <td data-label="Blockers">${safe(report.biggestBlocker || "—")}</td>
    <td data-label="Follow-Up Actions">${actions.length}</td>
    <td data-label="Last Updated">${safe(report.updatedAt ? new Date(report.updatedAt).toLocaleString() : "—")}</td>
    <td data-label="Actions"><div class="row-actions"><button class="small ghost" data-open-kpi-report="${safe(report.id)}">Open report</button></div></td>
  </tr>`;
}

function renderKpiDefinitionsPanel() {
  const definitions = (state.kpiDefinitions || []).filter((k) => k.isActive !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return `<section class="leadership-section">
    <div class="section-head"><h4>Configured KPIs</h4></div>
    ${definitions.length ? `<div class="table-wrap"><table><thead><tr><th>Position</th><th>KPI</th><th>Type</th><th>Target</th><th>Direction</th><th>Status</th></tr></thead><tbody>${definitions.map((k) => `<tr><td data-label="Position">${safe(displayPosition(k.position))}</td><td data-label="KPI">${safe(k.name)}</td><td data-label="Type">${safe(k.valueType)}</td><td data-label="Target">${safe(k.targetValue || "—")}</td><td data-label="Direction">${safe(k.direction || "Informational")}</td><td data-label="Status">${k.isActive === false ? "Inactive" : "Active"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><h3>No KPIs configured</h3><p>Add the metrics your Executive Team wants to review.</p>${canManageKpis() ? `<button class="primary" data-add-kpi-definition>Add KPI</button>` : ""}</div>`}
  </section>`;
}

function renderKpiHistory(selectedId) {
  const meetings = (state.kpiMeetings || []).filter((m) => m.id !== selectedId && m.status !== "Archived").sort((a, b) => String(b.meetingDate || "").localeCompare(String(a.meetingDate || ""))).slice(0, 8);
  return `<section class="leadership-section">
    <div class="section-head"><h4>Meeting History</h4></div>
    ${meetings.length ? `<div class="stack-list">${meetings.map((m) => `<button class="stack-item" data-select-kpi-meeting="${safe(m.id)}">${safe(m.title || "KPI Meeting")}<span>${safe(m.meetingDate || "")} · ${safe(m.status || "Draft")}</span></button>`).join("")}</div>` : emptySmall("No previous KPI meetings yet.")}
  </section>`;
}

function canManageKpis() {
  return can("all") || can("kpi.manage_all");
}

function canEditKpiReport(report) {
  if (canManageKpis()) return true;
  if (can("kpi.submit_own")) return true;
  return (report.officerMemberIds || [report.officerMemberId]).includes(cloud.profile?.member_id || cloud.profile?.memberId || "");
}

function kpiReportsForMeeting(meetingId) {
  return (state.kpiPositionReports || []).filter((r) => r.kpiMeetingId === meetingId && r.status !== "Archived").sort((a, b) => a.position.localeCompare(b.position));
}

function kpiMeetingSummary(meetingId) {
  const reports = kpiReportsForMeeting(meetingId);
  const results = state.kpiResults.filter((r) => reports.some((report) => report.id === r.positionReportId));
  const actions = state.kpiActionItems.filter((a) => a.kpiMeetingId === meetingId && a.status !== "Completed" && a.status !== "Cancelled");
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const completedReports = reports.filter((r) => r.status === "Submitted" || r.status === "Completed").length;
  return {
    totalReports: reports.length,
    completedReports,
    missingReports: reports.length - completedReports,
    onTrack: results.filter((r) => r.status === "On Track").length,
    atRisk: results.filter((r) => r.status === "At Risk").length,
    offTrack: results.filter((r) => r.status === "Off Track").length,
    overdueActions: actions.filter((a) => a.dueDate && a.dueDate < todayIso()).length,
    actionsDueThisWeek: actions.filter((a) => a.dueDate && a.dueDate >= todayIso() && a.dueDate <= weekEnd.toISOString().slice(0, 10)).length,
    readiness: reports.length ? Math.round((completedReports / reports.length) * 100) : 0
  };
}

function ensureKpiReportsForMeeting(meeting, mutate = true) {
  const existingPositions = new Set(kpiReportsForMeeting(meeting.id).map((r) => canonicalPositionTitle(r.position)));
  const created = activeExecutivePositions().filter((p) => !existingPositions.has(p.position)).map((p) => ({
    id: uid("kpir"),
    kpiMeetingId: meeting.id,
    position: p.position,
    positionLabel: displayPosition(p.position),
    officerMemberId: p.officerMemberIds[0] || "",
    officerMemberIds: p.officerMemberIds,
    overallUpdate: "",
    mainAccomplishment: "",
    biggestBlocker: "",
    nextPriority: "",
    status: "Draft",
    submittedAt: "",
    submittedBy: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  if (mutate && created.length) state.kpiPositionReports.unshift(...created);
  return created;
}

function openKpiMeetingForm(id = "") {
  const existing = state.kpiMeetings.find((m) => m.id === id);
  openModal(`<h3>${existing ? "Edit KPI meeting" : "Create KPI meeting"}</h3><form id="kpiMeetingForm" class="form-grid">
    <label class="wide">Title<input name="title" value="${safe(existing?.title || `KPI Meeting ${todayIso()}`)}" required /></label>
    <label>Meeting date<input name="meetingDate" type="date" value="${safe(existing?.meetingDate || todayIso())}" required /></label>
    <label>Status<select name="status">${["Draft", "Open", "Completed", "Archived"].map((s) => `<option ${existing?.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <label>Reporting period start<input name="reportingPeriodStart" type="date" value="${safe(existing?.reportingPeriodStart || "")}" /></label>
    <label>Reporting period end<input name="reportingPeriodEnd" type="date" value="${safe(existing?.reportingPeriodEnd || "")}" /></label>
    <div class="wide notice"><strong>Meeting setup</strong><p>Review the meeting details before saving.</p></div>
    <div class="wide button-row"><button class="primary">Save meeting</button><button class="ghost" type="button" data-close-modal>Cancel</button></div>
  </form>`);
  document.getElementById("kpiMeetingForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.currentTarget).entries());
    const now = new Date().toISOString();
    snapshot(existing ? "KPI meeting edited" : "KPI meeting created", { type: "kpis", id });
    const meeting = existing || { id: uid("kpim"), createdBy: cloud.user?.id || "", createdAt: now };
    Object.assign(meeting, form, { updatedAt: now });
    if (!existing) state.kpiMeetings.unshift(meeting);
    ensureKpiReportsForMeeting(meeting, true);
    activeFilters.kpis = { meetingId: meeting.id };
    await persistWorkspace("KPI meeting saved.");
    closeModal();
    render();
  });
}

function openKpiDefinitionForm(id = "") {
  const existing = state.kpiDefinitions.find((k) => k.id === id);
  const positions = activeExecutivePositions();
  openModal(`<h3>${existing ? "Edit KPI" : "Add configurable KPI"}</h3><form id="kpiDefinitionForm" class="form-grid">
    <label>Executive position<select name="position">${positions.map((p) => `<option value="${safe(p.position)}" ${existing?.position === p.position ? "selected" : ""}>${safe(displayPosition(p.position))}</option>`).join("")}</select></label>
    <label>KPI name<input name="name" value="${safe(existing?.name || "")}" required /></label>
    <label class="wide">Description<textarea name="description">${safe(existing?.description || "")}</textarea></label>
    <label>Value type<select name="valueType">${["Number", "Currency", "Percentage", "Text", "Yes/No"].map((v) => `<option ${existing?.valueType === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label>Target<input name="targetValue" value="${safe(existing?.targetValue || "")}" /></label>
    <label>Improvement direction<select name="direction">${["Higher is better", "Lower is better", "Target range", "Informational only"].map((v) => `<option ${existing?.direction === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label>Display order<input name="displayOrder" type="number" value="${safe(existing?.displayOrder ?? 0)}" /></label>
    <label>Active<select name="isActive"><option value="true" ${existing?.isActive !== false ? "selected" : ""}>Active</option><option value="false" ${existing?.isActive === false ? "selected" : ""}>Inactive</option></select></label>
    <div class="wide button-row"><button class="primary">Save KPI</button><button class="ghost" type="button" data-close-modal>Cancel</button></div>
  </form>`);
  document.getElementById("kpiDefinitionForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.currentTarget).entries());
    const now = new Date().toISOString();
    const row = { ...form, position: canonicalPositionTitle(form.position), isActive: form.isActive === "true", displayOrder: Number(form.displayOrder || 0), updatedAt: now };
    snapshot(existing ? "KPI definition edited" : "KPI definition added", { type: "kpis", id });
    if (existing) Object.assign(existing, row); else state.kpiDefinitions.unshift({ id: uid("kpid"), ...row, createdAt: now });
    await persistWorkspace("KPI definition saved.");
    closeModal();
    render();
  });
}

function openKpiReportForm(reportId) {
  const report = state.kpiPositionReports.find((r) => r.id === reportId);
  if (!report) return toast("KPI report section not found.");
  const editable = canEditKpiReport(report);
  const definitions = state.kpiDefinitions.filter((k) => k.isActive !== false && canonicalPositionTitle(k.position) === canonicalPositionTitle(report.position)).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const resultFor = (definition) => state.kpiResults.find((r) => r.positionReportId === report.id && r.kpiDefinitionId === definition.id) || {};
  const actions = state.kpiActionItems.filter((a) => a.positionReportId === report.id && a.status !== "Cancelled");
  openModal(`<h3>${safe(displayPosition(report.position))} KPI report</h3>
    <p class="muted">${safe((report.officerMemberIds || [report.officerMemberId]).filter(Boolean).map(memberName).join(", ") || "Unassigned")}</p>
    <form id="kpiReportForm" class="form-grid">
      <label class="wide">Overall update<textarea name="overallUpdate" ${editable ? "" : "disabled"}>${safe(report.overallUpdate || "")}</textarea></label>
      <label class="wide">Main accomplishment<textarea name="mainAccomplishment" ${editable ? "" : "disabled"}>${safe(report.mainAccomplishment || "")}</textarea></label>
      <label class="wide">Biggest blocker<textarea name="biggestBlocker" ${editable ? "" : "disabled"}>${safe(report.biggestBlocker || "")}</textarea></label>
      <label class="wide">Main priority before next meeting<textarea name="nextPriority" ${editable ? "" : "disabled"}>${safe(report.nextPriority || "")}</textarea></label>
      <h4 class="wide">KPI results</h4>
      ${definitions.length ? definitions.map((definition) => renderKpiResultInputs(definition, resultFor(definition), editable, report.id)).join("") : `<div class="wide empty-state"><h3>No KPIs configured for ${safe(displayPosition(report.position))}.</h3><p>Add configurable KPIs when the Executive Team decides what to track.</p></div>`}
      <h4 class="wide">Follow-up action</h4>
      <label>Action title<input name="actionTitle" ${editable ? "" : "disabled"} /></label>
      <label>Owner<select name="actionOwner" ${editable ? "" : "disabled"}><option value="">Unassigned</option>${selectOptions("members").map(([v,t]) => `<option value="${safe(v)}">${safe(t)}</option>`).join("")}</select></label>
      <label>Due date<input name="actionDueDate" type="date" ${editable ? "" : "disabled"} /></label>
      <label>Status<select name="actionStatus" ${editable ? "" : "disabled"}>${["Not Started", "In Progress", "Blocked", "Completed", "Cancelled"].map((s) => `<option>${s}</option>`).join("")}</select></label>
      <label class="wide">Action description<textarea name="actionDescription" ${editable ? "" : "disabled"}></textarea></label>
      ${actions.length ? `<div class="wide notice"><h4>Existing follow-up actions</h4><ul>${actions.map((a) => `<li>${safe(a.title)} · ${safe(a.status)} · ${safe(a.dueDate || "no due date")} · ${safe(memberName(a.assignedMemberId) || "Unassigned")}</li>`).join("")}</ul></div>` : ""}
      <div class="wide button-row">${editable ? `<button class="primary" name="saveMode" value="Draft">Save draft</button><button class="ghost" name="saveMode" value="Submitted">Submit report</button>` : ""}<button class="ghost" type="button" data-close-modal>Close</button></div>
    </form>`);
  document.getElementById("kpiReportForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    await saveKpiReport(report, Object.fromEntries(new FormData(ev.currentTarget).entries()), definitions, ev.submitter?.value || "Draft");
  });
}

function renderKpiResultInputs(definition, result, editable, reportId) {
  const previous = previousKpiResult(definition.id, definition.position, reportId)?.actualValue || "";
  return `<div class="wide notice kpi-result-editor"><h4>${safe(definition.name)}</h4><p class="muted">${safe(definition.description || "")}</p><div class="form-grid">
    <label>Target<input value="${safe(definition.targetValue || "")}" disabled /></label>
    <label>Previous result<input value="${safe(previous || result.previousValue || "")}" disabled /></label>
    <label>Actual result<input name="actual_${safe(definition.id)}" value="${safe(result.actualValue || "")}" ${editable ? "" : "disabled"} /></label>
    <label>Status<select name="status_${safe(definition.id)}" ${editable ? "" : "disabled"}>${["Not Reported", "On Track", "At Risk", "Off Track", "Completed"].map((s) => `<option ${result.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <label class="wide">Notes<textarea name="notes_${safe(definition.id)}" ${editable ? "" : "disabled"}>${safe(result.notes || "")}</textarea></label>
  </div></div>`;
}

function previousKpiResult(definitionId, position, currentReportId = "") {
  const report = state.kpiPositionReports.find((r) => r.id === currentReportId);
  const currentMeeting = state.kpiMeetings.find((m) => m.id === report?.kpiMeetingId);
  const priorMeetings = state.kpiMeetings
    .filter((m) => m.id !== currentMeeting?.id && (m.meetingDate || "") < (currentMeeting?.meetingDate || "9999-12-31"))
    .sort((a, b) => String(b.meetingDate || "").localeCompare(String(a.meetingDate || "")));
  for (const meeting of priorMeetings) {
    const priorReport = state.kpiPositionReports.find((r) => r.kpiMeetingId === meeting.id && canonicalPositionTitle(r.position) === canonicalPositionTitle(position));
    const priorResult = state.kpiResults.find((r) => r.positionReportId === priorReport?.id && r.kpiDefinitionId === definitionId);
    if (priorResult) return priorResult;
  }
  return null;
}

async function saveKpiReport(report, form, definitions, status) {
  const now = new Date().toISOString();
  Object.assign(report, {
    overallUpdate: form.overallUpdate || "",
    mainAccomplishment: form.mainAccomplishment || "",
    biggestBlocker: form.biggestBlocker || "",
    nextPriority: form.nextPriority || "",
    status,
    submittedAt: status === "Submitted" ? now : report.submittedAt || "",
    submittedBy: status === "Submitted" ? cloud.user?.id || "" : report.submittedBy || "",
    updatedAt: now
  });
  definitions.forEach((definition) => {
    const existing = state.kpiResults.find((r) => r.positionReportId === report.id && r.kpiDefinitionId === definition.id);
    const previous = previousKpiResult(definition.id, definition.position, report.id);
    const row = {
      positionReportId: report.id,
      kpiDefinitionId: definition.id,
      kpiNameSnapshot: definition.name,
      targetValue: definition.targetValue || "",
      actualValue: form[`actual_${definition.id}`] || "",
      previousValue: previous?.actualValue || "",
      status: form[`status_${definition.id}`] || "Not Reported",
      notes: form[`notes_${definition.id}`] || "",
      updatedAt: now
    };
    if (existing) Object.assign(existing, row);
    else state.kpiResults.unshift({ id: uid("kpirv"), ...row, createdAt: now });
  });
  if (form.actionTitle) {
    state.kpiActionItems.unshift({
      id: uid("kpia"),
      kpiMeetingId: report.kpiMeetingId,
      positionReportId: report.id,
      title: form.actionTitle,
      description: form.actionDescription || "",
      assignedMemberId: form.actionOwner || "",
      dueDate: form.actionDueDate || "",
      status: form.actionStatus || "Not Started",
      completedAt: form.actionStatus === "Completed" ? now : "",
      createdBy: cloud.user?.id || "",
      createdAt: now,
      updatedAt: now
    });
  }
  snapshot(status === "Submitted" ? "KPI report submitted" : "KPI report draft saved", { type: "kpis", id: report.id, description: displayPosition(report.position) });
  await persistWorkspace(status === "Submitted" ? "KPI report submitted." : "KPI draft saved.");
  closeModal();
  render();
}

async function copyKpiMeeting(id) {
  const source = state.kpiMeetings.find((m) => m.id === id);
  if (!source) return toast("KPI meeting not found.");
  const now = new Date().toISOString();
  const copy = { ...source, id: uid("kpim"), title: `Copy of ${source.title || "KPI Meeting"}`, status: "Draft", meetingDate: todayIso(), createdAt: now, updatedAt: now, createdBy: cloud.user?.id || "" };
  state.kpiMeetings.unshift(copy);
  ensureKpiReportsForMeeting(copy, true);
  const unresolved = state.kpiActionItems.filter((a) => a.kpiMeetingId === id && !["Completed", "Cancelled"].includes(a.status));
  if (unresolved.length && confirm(`Carry forward ${unresolved.length} unresolved action items?`)) {
    unresolved.forEach((a) => state.kpiActionItems.unshift({ ...a, id: uid("kpia"), kpiMeetingId: copy.id, positionReportId: "", createdAt: now, updatedAt: now }));
  }
  snapshot("KPI meeting copied", { type: "kpis", id });
  await persistWorkspace("KPI meeting copied.");
  activeFilters.kpis = { meetingId: copy.id };
  render();
}

async function persistWorkspace(successMessage = "Saved.") {
  save();
  if (cloud.user) {
    await syncCloudWorkspace(false);
    await loadCloudWorkspace({ throwOnError: true });
  }
  toast(successMessage);
}

function reportBlock(title, lines) {
  return `<section class="report-block"><h4>${title}</h4>${lines.length ? `<ul>${lines.map((l) => `<li>${safe(l)}</li>`).join("")}</ul>` : emptySmall("No records yet.")}</section>`;
}

function renderSettings() {
  if (!can("settings.view") && !can("settings.manage") && !can("all")) return restrictedPanel("Settings are restricted to chapter administrators.");
  const saveLabel = setupSave.saving ? "Saving…" : "Save setup";
  const fieldError = (key) => setupSave.fieldErrors?.[key] ? `<p class="field-error">${safe(setupSave.fieldErrors[key])}</p>` : "";
  return `<section class="panel">
    <div class="panel-head"><div><p class="eyebrow">First-time setup</p><h3>Chapter configuration</h3></div>${can("settings.manage") || can("chapter.setup") || can("all") ? `<button class="primary" data-save-settings ${setupSave.saving ? "disabled" : ""}>${saveLabel}</button>` : ""}</div>
    ${setupSave.error ? `<div class="notice error-notice"><h4>Setup could not be saved</h4><p>${safe(setupSave.error)}</p><button class="ghost" data-save-settings ${setupSave.saving ? "disabled" : ""}>Retry save</button></div>` : ""}
    ${setupSave.success ? `<div class="notice success-notice"><h4>Chapter setup saved successfully</h4><p>${safe(setupSave.success)}</p></div>` : ""}
    <div class="form-grid">
      ${settingInput("chapterName", "Chapter name", "text", fieldError("chapterName"))}
      ${settingInput("schoolName", "School", "text", fieldError("schoolName"))}
      ${settingInput("term", "Term / semester", "text", fieldError("term"))}
      ${settingInput("academicYear", "Academic year", "text", fieldError("academicYear"))}
      ${settingInput("defaultDuesAmount", "Default dues amount", "number")}
      ${settingInput("duesDueDates", "Dues due dates")}
      <label>Current role<input value="${safe(cloud.profile?.role || state.settings.currentRole)}" disabled /></label>
      <label>Attendance threshold<input id="set_attendanceThreshold" type="number" min="0" max="100" value="${safe(state.settings.attendanceThreshold)}" /></label>
      ${listSetting("officerRoles", "Executive Team positions")}
      ${listSetting("executiveOfficerRoles", "Executive Team positions treated as executive")}
      ${listSetting("memberStatuses", "Member statuses")}
      ${listSetting("eventTypes", "Event types")}
      ${listSetting("committees", "Committees")}
      ${listSetting("permissionRoles", "Permission roles")}
      <label class="wide">Privacy notice<textarea id="set_privacyNotice">${safe(state.settings.privacyNotice)}</textarea></label>
    </div>
    <div class="settings-grid">
      <div class="notice"><h4>Security</h4><p>Only approved users can access chapter records.</p></div>
      <div class="notice"><h4>Financial access</h4><p>Finance tools are limited to authorized chapter roles.</p></div>
      <div class="notice"><h4>Imports</h4><p>Use CSV imports to add rosters, balances, and attendance records.</p></div>
    </div>
  </section>
  ${can("all") ? renderAdminUserManagement() : ""}`;
}

function renderAdminUserManagement() {
  const rows = cloud.profiles || [];
  return `<section class="panel">
    <div class="panel-head">
      <div><p class="eyebrow">Admin only</p><h3>User approvals and roles</h3></div>
      <button class="ghost" data-refresh-users>Refresh users</button>
    </div>
    <p class="muted">Personal emails are allowed. New accounts stay pending until an Admin approves them and assigns a role.</p>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Requested role</th><th>Assigned role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>${rows.map((p) => `<tr>
      <td data-label="Name">${safe(p.full_name || "")}</td>
      <td data-label="Email">${safe(p.email)}</td>
      <td data-label="Requested role">${safe(p.requested_role)}</td>
      <td data-label="Assigned role"><select data-user-role="${p.id}">${permissionRoles.map((r) => `<option ${p.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></td>
      <td data-label="Status"><span class="pill">${safe(p.approval_status)}</span></td>
      <td data-label="Joined">${safe(p.created_at ? new Date(p.created_at).toLocaleDateString() : "")}</td>
      <td data-label="Actions"><div class="row-actions">
        <button class="small ghost" data-user-action="approve:${p.id}">Approve</button>
        <button class="small ghost" data-user-action="reject:${p.id}">Reject</button>
        <button class="small ghost" data-user-action="disable:${p.id}">Disable</button>
        <button class="small ghost" data-user-action="role:${p.id}">Save role</button>
      </div></td>
    </tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><h3>No access requests yet.</h3><p>When your Treasurer or another officer creates an account with a personal email, they will appear here for approval.</p></div>`}
  </section>`;
}

function settingInput(key, label, type = "text", help = "") {
  return `<label>${label}<input id="set_${key}" type="${type}" value="${safe(state.settings[key])}" />${help}</label>`;
}

function listSetting(key, label) {
  return `<label class="wide">${label}<textarea id="set_${key}">${safe((state.settings[key] || []).join(", "))}</textarea></label>`;
}

function restrictedPanel(message) {
  return `<section class="panel empty-state"><h3>Access Restricted</h3><p>${safe(message)}</p><button class="ghost" data-go="${safe(defaultViewForRole())}">Return to Home</button></section>`;
}

function emptySmall(text) {
  return `<p class="muted">${safe(text)}</p>`;
}

function bindViewActions(root) {
  root.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => { applyFilter(el.dataset.go, el.dataset.filter || ""); setView(el.dataset.go); }));
  root.querySelectorAll("[data-add]").forEach((el) => el.addEventListener("click", () => el.dataset.add === "finance" ? openBulkChargeForm() : openForm(el.dataset.add)));
  root.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); const [key, id] = el.dataset.edit.split(":"); openForm(key, id); }));
  root.querySelectorAll("[data-archive]").forEach((el) => el.addEventListener("click", async (ev) => { ev.stopPropagation(); const [key, id] = el.dataset.archive.split(":"); await archiveRow(key, id); }));
  root.querySelectorAll("[data-delete]").forEach((el) => el.addEventListener("click", async (ev) => { ev.stopPropagation(); const [key, id] = el.dataset.delete.split(":"); await deleteRow(key, id); }));
  root.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", (ev) => { if (ev.target.closest(".row-actions, [data-edit-leadership], [data-edit], [data-archive], [data-delete]")) return; openProfile(el.dataset.open, el.dataset.id); }));
  root.querySelectorAll("[data-export]").forEach((el) => el.addEventListener("click", () => exportCsv(el.dataset.export)));
  root.querySelectorAll("[data-import]").forEach((el) => el.addEventListener("click", () => beginImport(el.dataset.import)));
  root.querySelectorAll("[data-finance-template]").forEach((el) => el.addEventListener("click", downloadFinanceTemplate));
  root.querySelectorAll("[data-finance-filter]").forEach((el) => el.addEventListener("click", () => { activeFilters.finance = { ...(activeFilters.finance || {}), quick: el.dataset.financeFilter === "all" ? "" : el.dataset.financeFilter }; render(); }));
  root.querySelectorAll("[data-finance-sort]").forEach((el) => el.addEventListener("click", () => {
    const key = el.dataset.financeSort;
    financeSort = financeSort.key === key ? { key, dir: financeSort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
    render();
  }));
  root.querySelectorAll("[data-edit-finance], [data-view-finance]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); openFinanceAccountForm(el.dataset.editFinance || el.dataset.viewFinance); }));
  root.querySelectorAll("[data-finance-member]").forEach((el) => el.addEventListener("click", (ev) => { if (ev.target.closest(".row-actions, button")) return; openFinanceAccountForm(el.dataset.financeMember); }));
  root.querySelectorAll("[data-print]").forEach((el) => el.addEventListener("click", () => window.print()));
  root.querySelectorAll("[data-filter-status]").forEach((el) => el.addEventListener("click", () => { activeFilters.pnms = { status: el.dataset.filterStatus }; render(); }));
  root.querySelectorAll("[data-bulk-charge]").forEach((el) => el.addEventListener("click", openBulkChargeForm));
  root.querySelectorAll("[data-record-payment]").forEach((el) => el.addEventListener("click", () => openPaymentForm(el.dataset.recordPayment || "")));
  root.querySelectorAll("[data-task-done]").forEach((el) => el.addEventListener("click", () => markTaskDone(el.dataset.taskDone)));
  root.querySelectorAll("[data-add-leadership]").forEach((el) => el.addEventListener("click", () => openLeadershipForm()));
  root.querySelectorAll("[data-edit-leadership]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); openLeadershipForm(el.dataset.editLeadership); }));
  root.querySelectorAll("[data-create-kpi-meeting]").forEach((el) => el.addEventListener("click", () => openKpiMeetingForm()));
  root.querySelectorAll("[data-edit-kpi-meeting]").forEach((el) => el.addEventListener("click", () => openKpiMeetingForm(el.dataset.editKpiMeeting)));
  root.querySelectorAll("[data-add-kpi-definition]").forEach((el) => el.addEventListener("click", () => openKpiDefinitionForm()));
  root.querySelectorAll("[data-open-kpi-report]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); openKpiReportForm(el.dataset.openKpiReport); }));
  root.querySelectorAll("[data-copy-kpi-meeting]").forEach((el) => el.addEventListener("click", () => copyKpiMeeting(el.dataset.copyKpiMeeting)));
  root.querySelectorAll("[data-select-kpi-meeting]").forEach((el) => el.addEventListener("click", () => { activeFilters.kpis = { meetingId: el.dataset.selectKpiMeeting }; render(); }));
  root.querySelector("#kpiMeetingSelect")?.addEventListener("change", (ev) => { activeFilters.kpis = { meetingId: ev.target.value }; render(); });
  root.querySelectorAll("[data-user-action]").forEach((el) => el.addEventListener("click", () => {
    const [action, userId] = el.dataset.userAction.split(":");
    const role = root.querySelector(`[data-user-role="${userId}"]`)?.value;
    updateUserAccess(action, userId, role);
  }));
  root.querySelector("[data-refresh-users]")?.addEventListener("click", async () => { await loadProfilesForAdmin(); render(); toast("Users refreshed."); });
  root.querySelectorAll("[data-save-settings]").forEach((saveSettings) => saveSettings.addEventListener("click", saveSettingsForm));
  const search = root.querySelector("#searchInput");
  if (search) search.addEventListener("input", () => { const key = activeView === "recruitment" ? "pnms" : activeView; activeFilters[key] = { ...(activeFilters[key] || {}), q: search.value }; render(); });
  const checkType = root.querySelector("#checkType");
  if (checkType) checkType.addEventListener("change", refreshCheckPerson);
  const record = root.querySelector("[data-record-checkin]");
  if (record) record.addEventListener("click", recordCheckin);
}

async function updateUserAccess(action, userId, role) {
  if (!cloud.client || !can("all")) return toast("Admin access required.");
  const target = cloud.profiles.find((p) => p.id === userId);
  if (!target) return toast("User not found.");
  const status = action === "approve" || action === "role" ? "approved" : action === "reject" ? "rejected" : "disabled";
  if (action !== "role" && !confirm(`${labelize(action)} ${target.email}?`)) return;
  const { error: profileError } = await cloud.client.from("profiles").update({ approval_status: status, role, updated_at: new Date().toISOString() }).eq("id", userId);
  if (profileError) return toast(profileError.message);
  if (status === "approved") {
    const organizationId = await ensureCloudWorkspace();
    const dbRole = toDbRole(role);
    const { data: existing } = await cloud.client.from("organization_members").select("id").eq("user_id", userId).maybeSingle();
    if (existing?.id) {
      const { error } = await cloud.client.from("organization_members").update({ role: dbRole, email: target.email }).eq("id", existing.id);
      if (error) return toast(error.message);
    } else {
      const { error } = await cloud.client.from("organization_members").insert({ organization_id: organizationId, user_id: userId, email: target.email, role: dbRole });
      if (error) return toast(error.message);
    }
  }
  await loadProfilesForAdmin();
  render();
  toast("User access updated.");
}

function bindAuthActions(root = document) {
  root.querySelectorAll("[data-auth-mode]").forEach((el) => el.addEventListener("click", () => openAuthModal(el.dataset.authMode)));
  root.querySelector("#pendingSignOut")?.addEventListener("click", signOut);
  root.querySelector("#loginForm")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.currentTarget).entries());
    await signInWithPassword(form.email, form.password);
  });
}

function openAuthModal(mode = "signin") {
  if (!cloud.client) return toast("Cloud sync is not configured.");
  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  openModal(`<section class="auth-modal">
    <p class="eyebrow">${isSignup ? "Request access" : isReset ? "Password reset" : "Sign in"}</p>
    <h3>${isSignup ? "Request a ChapterOps account" : isReset ? "Reset your password" : "Sign in to ChapterOps"}</h3>
    <p class="muted">${isSignup ? "Use an email and password. You may need to confirm your email before signing in." : isReset ? "Enter your email and we will send a secure reset link." : "Enter the email and password for your ChapterOps account."}</p>
    <form id="authModalForm" class="form-grid">
      ${isSignup ? `<label class="wide">Full name<input name="fullName" autocomplete="name" /></label>` : ""}
      <label class="wide">Email address<input name="email" type="email" autocomplete="email" placeholder="name@email.com" required /></label>
      ${!isReset ? `<label class="wide">Password<input name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="8" required /></label>` : ""}
      ${isSignup ? `<label class="wide">Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label>` : ""}
      ${isSignup ? `<label>Requested role<select name="requestedRole">${permissionRoles.filter((r) => r !== "Admin").map((r) => `<option>${r}</option>`).join("")}</select></label><label class="wide">Reason / notes optional<textarea name="requestNotes" placeholder="Example: Treasurer account for dues management"></textarea></label>` : ""}
      <div class="wide button-row">
        <button class="primary" type="submit">${isSignup ? "Submit request" : isReset ? "Send reset email" : "Sign in"}</button>
        ${!isSignup ? `<button class="ghost" type="button" data-auth-mode="signup">Request access</button>` : `<button class="ghost" type="button" data-auth-mode="signin">I already have an account</button>`}
        ${!isReset ? `<button class="ghost" type="button" data-auth-mode="reset">Forgot password</button>` : `<button class="ghost" type="button" data-auth-mode="signin">Back to sign in</button>`}
        <button class="ghost" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  </section>`);
  bindAuthActions(document.getElementById("modal"));
  document.getElementById("authModalForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.currentTarget).entries());
    if (isSignup) await createAccount(form.email, form.password, form.confirmPassword, form.fullName, form.requestedRole, form.requestNotes);
    else if (isReset) await sendPasswordReset(form.email);
    else await signInWithPassword(form.email, form.password);
  });
}

function openNewPasswordModal() {
  openModal(`<section class="auth-modal">
    <p class="eyebrow">Set new password</p>
    <h3>Create a new ChapterOps password</h3>
    <p class="muted">Your reset link was accepted. Enter a new password to finish account recovery.</p>
    <form id="newPasswordForm" class="form-grid">
      <label class="wide">New password<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <label class="wide">Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
      <div class="wide button-row"><button class="primary" type="submit">Update password</button><button class="ghost" type="button" data-close-modal>Cancel</button></div>
    </form>
  </section>`);
  document.getElementById("newPasswordForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.currentTarget).entries());
    await updateAccountPassword(form.password, form.confirmPassword);
  });
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
  if (view === "portal") {
    activeView = defaultViewForRole();
    render();
    return;
  }
  if (cloud.client && cloud.user && cloud.profile?.approval_status === "approved" && !routeAllowed(view)) {
    activeView = defaultViewForRole();
    render();
    return;
  }
  activeView = view;
  render();
}

function openForm(key, id) {
  const meta = collectionMeta[key];
  if (!meta) return;
  if (!actionAllowed(key)) return toast("You do not have permission to change these records.");
  const existing = state[key].find((r) => r.id === id);
  openModal(`<h3>${existing ? `Edit ${meta.title}` : meta.addLabel}</h3><form id="recordForm" class="form-grid">${meta.fields.map((f) => formField(f, existing)).join("")}<div class="wide button-row"><button class="primary" type="submit">Save</button><button class="ghost" type="button" data-close-modal>Cancel</button></div></form>`);
  document.getElementById("recordForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    await saveRow(key, Object.fromEntries(new FormData(ev.currentTarget).entries()), id);
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

async function saveRow(key, row, id) {
  const validation = validateRow(key, row, id);
  if (validation) return toast(validation);
  snapshot(id ? `${labelize(key)} edited` : `${labelize(key)} added`, { type: key, id, description: row.firstName ? `${row.firstName} ${row.lastName}` : row.title || row.name || row.type });
  if (key === "finance") row.amount = parseMoney(row.amount);
  if (id) state[key] = state[key].map((r) => r.id === id ? { ...r, ...row } : r);
  else state[key].unshift({ id: uid(key[0]), ...row, archived: false });
  recalcMemberDues();
  save(); closeModal(); render();
  if (cloud.user) await syncCloudWorkspace(false);
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

async function archiveRow(key, id) {
  if (key === "members") return deleteRow(key, id);
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
  if (cloud.user) await syncCloudWorkspace(false);
}

async function deleteRow(key, id) {
  if (key === "members") return archiveMemberInCloud(id);
  if (!confirm("Permanently delete this record? Archive is safer. Continue only if you are sure.")) return;
  snapshot(`${labelize(key)} deleted`, { type: key, id });
  state[key] = state[key].filter((r) => r.id !== id);
  recalcMemberDues();
  save(); render(); toast("Deleted. Use Undo if needed.");
  if (cloud.user) await syncCloudWorkspace(false);
}

function memberDependencySummary(memberId) {
  return {
    finance: state.finance.filter((f) => !f.archived && (f.memberId === memberId || f.member_id === memberId)).length,
    attendance: state.attendance.filter((a) => a.personId === memberId || a.memberId === memberId || a.member_id === memberId).length,
    tasks: state.tasks.filter((t) => !t.archived && [t.assignedPerson, t.relatedMember, t.memberId, t.member_id].includes(memberId)).length,
    leadership: state.leadership.filter((l) => !l.archived && [l.assignedMember, l.memberId, l.member_id, l.profileId, l.profile_id].includes(memberId)).length
  };
}

async function archiveMemberInCloud(memberId) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return toast("Member not found.");
  const deps = memberDependencySummary(memberId);
  const hasHistory = deps.finance || deps.attendance || deps.tasks || deps.leadership;
  const message = hasHistory
    ? `${memberName(memberId)} has linked records (${deps.finance} finance, ${deps.attendance} attendance, ${deps.tasks} tasks, ${deps.leadership} officer assignments). They will be archived and removed from active rosters, while historical records are preserved. Continue?`
    : `Remove ${memberName(memberId)} from the active roster? This archives the member and preserves chapter history.`;
  if (!confirm(message)) return;
  if (!cloud.client) return toast("Cloud sync is not configured.");
  pendingDeletes.add(`members:${memberId}`);
  render();
  try {
    const { data: sessionData, error: sessionError } = await cloud.client.auth.getSession();
    if (sessionError) throw sessionError;
    cloud.user = sessionData.session?.user || cloud.user;
    if (!cloud.user?.id) throw new Error("You must be signed in to remove a member.");
    const organizationId = await ensureCloudWorkspace();
    console.info("[ChapterOps delete]", { userId: cloud.user.id, organizationId, memberId, dependencySummary: deps });
    const { data, error } = await cloud.client.rpc("archive_member_in_workspace", { p_member_id: memberId });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.workspace_data) throw new Error("Member archive completed without returning saved workspace data.");
    await loadCloudWorkspace({ throwOnError: true });
    pendingDeletes.delete(`members:${memberId}`);
    render();
    toast(result.alreadyArchived ? "Member was already archived." : "Member removed from active roster.");
  } catch (err) {
    logSupabaseError("member archive failed", err);
    pendingDeletes.delete(`members:${memberId}`);
    render();
    toast(formatSupabaseError(err, "The delete request failed. The member was not removed."));
  }
}

function openProfile(key, id) {
  const row = state[key].find((r) => r.id === id);
  if (!row) return;
  const title = key === "members" ? memberName(id) : key === "pnms" ? pnmName(id) : row.name || row.title || row.type;
  const dues = key === "members" ? memberFinance(id) : null;
  openModal(`<h3>${safe(title)}</h3>
    ${dues ? renderMemberDuesProfile(id, dues) : ""}
    ${key === "members" ? renderMemberLeadershipProfile(id) : ""}
    <div class="profile-grid">${Object.entries(row).map(([k,v]) => `<div><span>${labelize(k)}</span><strong>${safe(Array.isArray(v) ? v.join(", ") : v)}</strong></div>`).join("")}</div>
    ${renderRelatedAttendance(key, id)}
    <div class="button-row"><button class="primary" data-edit="${key}:${id}">Edit</button>${key === "members" && can("view_finance") ? `<button class="ghost" data-edit-finance="${id}">Edit finance ledger</button><button class="ghost" data-record-payment="${id}">Record payment</button>` : ""}<button class="ghost" data-close-modal>Close</button></div>`);
  document.querySelector("#modal [data-edit]")?.addEventListener("click", () => { closeModal(); openForm(key, id); });
  document.querySelector("#modal [data-edit-finance]")?.addEventListener("click", (ev) => { closeModal(); openFinanceAccountForm(ev.currentTarget.dataset.editFinance); });
  document.querySelector("#modal [data-record-payment]")?.addEventListener("click", (ev) => { closeModal(); openPaymentForm(ev.currentTarget.dataset.recordPayment); });
}

function renderMemberLeadershipProfile(memberId) {
  const officer = buildOfficerDirectory().allOfficers.find((o) => o.memberId === memberId);
  if (!officer) return "";
  return `<section class="notice"><h4>Leadership positions</h4><p>${safe(officer.roles.join(", "))}</p>${officer.committees.length ? `<p class="muted">${safe(officer.committees.join(" · "))}</p>` : ""}</section>`;
}

function renderMemberDuesProfile(memberId, dues) {
  const account = financeAccountFor(memberId);
  return `<section class="notice"><h4>Member finance profile</h4><div class="mini-grid">
    ${mini("Pending Charge", moneyFromCents(account.pendingChargeCents))}
    ${mini("Current Balance", moneyFromCents(account.currentBalanceCents))}
    ${mini("Total Balance", moneyFromCents(account.pendingChargeCents + account.currentBalanceCents))}
    ${mini("Payment Plan", account.paymentPlanStatus || "None")}
  </div>
  <p class="muted">Payment and charge history is preserved below. Editing the current ledger row does not delete historical transactions.</p>
  <ul>${dues.rows.length ? dues.rows.map((r) => `<li>${safe(r.type)} · ${money(r.amount)} · ${safe(r.status)} · ${safe(r.paymentDate || r.dueDate || "")}</li>`).join("") : "<li>No historical dues activity yet.</li>"}</ul></section>`;
}

function openFinanceAccountForm(memberId) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return toast("Member not found.");
  const account = financeAccountFor(memberId);
  const canEdit = actionAllowed("finance");
  openModal(`<h3>${canEdit ? "Edit member billing ledger" : "Member finance detail"}</h3>
    <p class="muted">${safe(memberName(memberId))} · Member ID ${safe(memberIdentifier(member))}</p>
    <form id="financeAccountForm" class="form-grid">
      <label>Pending Charge<input name="pendingCharge" type="text" inputmode="decimal" value="${safe((account.pendingChargeCents / 100).toFixed(2))}" ${canEdit ? "" : "disabled"} /></label>
      <label>Current Balance<input name="currentBalance" type="text" inputmode="decimal" value="${safe((account.currentBalanceCents / 100).toFixed(2))}" ${canEdit ? "" : "disabled"} /></label>
      <label>Payment Plan<select name="paymentPlanStatus" ${canEdit ? "" : "disabled"}>${["None", "Active", "Past Due", "Completed", "Custom"].map((v) => `<option ${account.paymentPlanStatus === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Due date<input name="dueDate" type="date" value="${safe(account.dueDate)}" ${canEdit ? "" : "disabled"} /></label>
      <label>Financial status<input name="financialStatus" value="${safe(account.financialStatus)}" ${canEdit ? "" : "disabled"} /></label>
      <label>Payment-plan amount<input name="paymentPlanAmount" type="text" inputmode="decimal" value="${safe((account.paymentPlanAmountCents / 100).toFixed(2))}" ${canEdit ? "" : "disabled"} /></label>
      <label>Payment-plan frequency<input name="paymentPlanFrequency" value="${safe(account.paymentPlanFrequency)}" placeholder="Monthly, weekly, custom" ${canEdit ? "" : "disabled"} /></label>
      <label>Payment-plan end<input name="paymentPlanEndDate" type="date" value="${safe(account.paymentPlanEndDate)}" ${canEdit ? "" : "disabled"} /></label>
      <label class="wide">Notes<textarea name="notes" ${canEdit ? "" : "disabled"}>${safe(account.notes)}</textarea></label>
      <div class="wide notice">
        <strong>Total Balance</strong>
        <p id="financeTotalPreview">${moneyFromCents(account.pendingChargeCents + account.currentBalanceCents)}</p>
        <p class="muted">Calculated automatically as Pending Charge + Current Balance.</p>
      </div>
      <div class="wide button-row">
        ${canEdit ? `<button class="primary" type="submit">Save ledger row</button>` : ""}
        <button class="ghost" type="button" data-record-payment="${safe(memberId)}">Record payment</button>
        <button class="ghost" type="button" data-close-modal>Close</button>
      </div>
    </form>`);
  const form = document.getElementById("financeAccountForm");
  const preview = () => {
    const pending = parseMoneyToCents(form.pendingCharge.value);
    const current = parseMoneyToCents(form.currentBalance.value);
    document.getElementById("financeTotalPreview").textContent = Number.isNaN(pending) || Number.isNaN(current) ? "Invalid amount" : moneyFromCents(pending + current);
  };
  form.pendingCharge?.addEventListener("input", preview);
  form.currentBalance?.addEventListener("input", preview);
  document.querySelector("#modal [data-record-payment]")?.addEventListener("click", (ev) => { closeModal(); openPaymentForm(ev.currentTarget.dataset.recordPayment); });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());
    await saveFinanceAccounts([cleanFinanceAccountForm(memberId, formData)], "Finance ledger row saved.");
  });
}

function cleanFinanceAccountForm(memberId, formData) {
  const pendingChargeCents = parseMoneyToCents(formData.pendingCharge);
  const currentBalanceCents = parseMoneyToCents(formData.currentBalance);
  const paymentPlanAmountCents = parseMoneyToCents(formData.paymentPlanAmount);
  if ([pendingChargeCents, currentBalanceCents, paymentPlanAmountCents].some(Number.isNaN)) throw new Error("Enter valid dollar amounts before saving.");
  return {
    memberId,
    pendingChargeCents,
    currentBalanceCents,
    paymentPlanStatus: formData.paymentPlanStatus || "None",
    paymentPlanAmountCents,
    paymentPlanFrequency: formData.paymentPlanFrequency || "",
    paymentPlanStartDate: formData.paymentPlanStartDate || "",
    paymentPlanEndDate: formData.paymentPlanEndDate || "",
    dueDate: formData.dueDate || "",
    notes: formData.notes || "",
    financialStatus: formData.financialStatus || ""
  };
}

async function saveFinanceAccounts(accounts, successMessage = "Finance ledger saved.", options = {}) {
  if (!accounts.length) return;
  if (!cloud.client) return toast("Cloud sync is not configured for finance.");
  try {
    const { data: sessionData, error: sessionError } = await cloud.client.auth.getSession();
    if (sessionError) throw sessionError;
    cloud.user = sessionData.session?.user || cloud.user;
    if (!cloud.user?.id) throw new Error("You must be signed in to save finance data.");
    const organizationId = await ensureCloudWorkspace();
    console.info("[ChapterOps finance]", { userId: cloud.user.id, organizationId, rows: accounts.length, targetTable: "workspace_state.data.financeAccounts" });
    const { data, error } = await cloud.client.rpc("upsert_finance_accounts_to_workspace", { p_accounts: accounts, p_transactions: options.transactions || [] });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.workspace_data) throw new Error("Finance save completed without returning saved workspace data.");
    await loadCloudWorkspace({ throwOnError: true });
    if (options.closeModal !== false) closeModal();
    render();
    toast(successMessage);
    return result;
  } catch (err) {
    logSupabaseError("finance save failed", err);
    toast(formatSupabaseError(err, "Finance data could not be saved."));
    throw err;
  }
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
  document.getElementById("bulkChargeForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.currentTarget).entries());
    const targets = activeMembers().filter((m) => form.target === "active" || m.initiationStatus === "New Member" || m.memberStatus === "New Member");
    if (!confirm(`Create a ${money(form.amount)} charge for ${targets.length} members?`)) return;
    const pendingChargeCents = parseMoneyToCents(form.amount);
    if (Number.isNaN(pendingChargeCents)) return toast("Enter a valid charge amount.");
    snapshot("Bulk dues ledger charges added", { type: "finance", description: `${targets.length} charges` });
    const accounts = targets.map((member) => {
      const current = financeAccountFor(member.id);
      return {
        memberId: member.id,
        pendingChargeCents,
        currentBalanceCents: current.currentBalanceCents,
        paymentPlanStatus: form.status === "Payment plan" ? "Active" : current.paymentPlanStatus || "None",
        dueDate: form.dueDate || current.dueDate,
        notes: [current.notes, form.notes].filter(Boolean).join("\n"),
        financialStatus: form.status || current.financialStatus || ""
      };
    });
    const transactions = targets.map((m) => ({ id: uid("f"), type: "Charge", memberId: m.id, amount: pendingChargeCents / 100, category: form.category, status: form.status, dueDate: form.dueDate, paymentDate: "", paymentMethod: "", paymentPlan: form.status === "Payment plan" ? "Yes" : "No", notes: form.notes, treasurerNotes: "", archived: false }));
    await saveFinanceAccounts(accounts, "Bulk dues charges saved to the ledger.", { transactions });
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
  document.getElementById("paymentForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const row = Object.fromEntries(new FormData(ev.currentTarget).entries());
    const amountCents = parseMoneyToCents(row.amount);
    if (Number.isNaN(amountCents) || amountCents <= 0) return toast("Enter a valid payment amount.");
    row.type = "Payment";
    row.category = "Dues payment";
    row.id = uid("f");
    row.amount = amountCents / 100;
    row.archived = false;
    const current = financeAccountFor(row.memberId);
    const account = {
      memberId: row.memberId,
      pendingChargeCents: current.pendingChargeCents,
      currentBalanceCents: current.currentBalanceCents - amountCents,
      paymentPlanStatus: row.paymentPlan === "Yes" ? "Active" : current.paymentPlanStatus || "None",
      dueDate: current.dueDate,
      notes: current.notes,
      financialStatus: current.pendingChargeCents + current.currentBalanceCents - amountCents > 0 ? row.status : "Paid in full"
    };
    await saveFinanceAccounts([account], "Payment recorded and ledger balance updated.", { transactions: [row] });
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

function collectSettingsFromForm() {
  const next = { ...state.settings };
  ["chapterName", "schoolName", "term", "academicYear", "defaultDuesAmount", "duesDueDates", "attendanceThreshold", "privacyNotice"].forEach((k) => {
    const el = document.getElementById(`set_${k}`);
    if (el) next[k] = el.value;
  });
  ["officerRoles", "executiveOfficerRoles", "memberStatuses", "eventTypes", "committees", "permissionRoles"].forEach((k) => {
    const el = document.getElementById(`set_${k}`);
    if (el) next[k] = el.value.split(",").map((x) => x.trim()).filter(Boolean);
  });
  next.officerRoles = [...new Set((next.officerRoles || []).map(canonicalPositionTitle).filter(Boolean))];
  next.executiveOfficerRoles = [...new Set([...(next.executiveOfficerRoles || []), ...(next.officerRoles || [])].map(canonicalPositionTitle).filter((role) => role && role !== "General member"))];
  next.setupComplete = Boolean(next.chapterName && next.schoolName && next.term && next.academicYear);
  return next;
}

function validateSetupSettings(settings) {
  const fieldErrors = {};
  if (!String(settings.chapterName || "").trim()) fieldErrors.chapterName = "Chapter name is required.";
  if (!String(settings.schoolName || "").trim()) fieldErrors.schoolName = "School is required.";
  if (!String(settings.term || "").trim()) fieldErrors.term = "Term / semester is required.";
  if (!String(settings.academicYear || "").trim()) fieldErrors.academicYear = "Academic year is required.";
  return fieldErrors;
}

async function saveSettingsForm() {
  if (!can("settings.manage") && !can("chapter.setup") && !can("all")) return toast("Admin access required to save settings.");
  if (setupSave.saving) return;
  const nextSettings = collectSettingsFromForm();
  const fieldErrors = validateSetupSettings(nextSettings);
  state.settings = nextSettings;
  setupSave = { saving: false, error: "", success: "", fieldErrors };
  if (Object.keys(fieldErrors).length) {
    render();
    toast("Please finish the required setup fields.");
    return;
  }
  if (!cloud.client) {
    setupSave.error = "Cloud sync is not configured for this deployment.";
    render();
    return;
  }
  const { data: sessionData, error: sessionError } = await cloud.client.auth.getSession();
  if (sessionError) {
    logSupabaseError("session check failed", sessionError);
    setupSave.error = formatSupabaseError(sessionError, "We could not confirm your sign-in session.");
    render();
    return;
  }
  cloud.user = sessionData.session?.user || cloud.user;
  if (!cloud.user?.id) {
    setupSave.error = "You must be signed in to finish setup.";
    render();
    return;
  }

  snapshot("Settings updated", { type: "settings" });
  setupSave = { saving: true, error: "", success: "", fieldErrors: {} };
  render();
  setupDebug("submitting", {
    hasSession: Boolean(sessionData.session),
    userId: cloud.user.id,
    email: cloud.user.email,
    submittedSettings: {
      chapterName: nextSettings.chapterName,
      schoolName: nextSettings.schoolName,
      term: nextSettings.term,
      academicYear: nextSettings.academicYear
    }
  });

  try {
    const workspacePayload = normalize({ ...state, settings: nextSettings });
    const { data, error } = await cloud.client.rpc("save_chapter_setup", {
      p_setup: nextSettings,
      p_workspace: workspacePayload
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.organization_id) throw new Error("Setup saved without a returned organization id.");
    cloud.organizationId = result.organization_id;
    localStorage.setItem(orgStoreKey, cloud.organizationId);
    setupDebug("database response", { organizationId: cloud.organizationId, hasWorkspaceData: Boolean(result.workspace_data) });
    await ensureOwnProfile();
    if (cloud.profile?.approval_status === "approved") state.settings.currentRole = cloud.profile.role || "Admin";
    await loadCloudWorkspace({ throwOnError: true });
    setupSave = { saving: false, error: "", success: "Chapter setup saved successfully.", fieldErrors: {} };
    save();
    render();
    toast("Chapter setup saved successfully.");
  } catch (err) {
    logSupabaseError("setup save failed", err);
    setupSave = { saving: false, error: formatSupabaseError(err, "Setup could not be saved. No information was changed."), success: "", fieldErrors: {} };
    render();
    toast("Setup could not be saved.");
  }
}

function openLeadershipForm(id) {
  const existing = state.leadership.find((l) => l.id === id);
  const normalizedExisting = existing ? { ...existing, role: canonicalPositionTitle(existing.role), responsibilityLabel: existing.responsibilityLabel || positionResponsibilityLabel(canonicalPositionTitle(existing.role), existing.role) } : null;
  const fields = [["role", "Formal executive position", "select", "officerRoles"], ["assignedMember", "Assigned member", "select", "members"], ["responsibilityLabel", "Plain-language responsibility label", "text"], ["committee", "Committee", "select", "committees"], ["termStartDate", "Term start date", "date"], ["termEndDate", "Term end date", "date"], ["responsibilities", "Responsibilities", "textarea"], ["relatedReports", "Related reports", "text"]];
  openModal(`<h3>${existing ? "Edit Executive Team role" : "Add Executive Team role"}</h3><form id="leadershipForm" class="form-grid">${fields.map((f) => formField(f, normalizedExisting)).join("")}<div class="wide button-row"><button class="primary">Save</button><button class="ghost" type="button" data-close-modal>Cancel</button></div></form>`);
  document.getElementById("leadershipForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const row = Object.fromEntries(new FormData(ev.currentTarget).entries());
    row.role = canonicalPositionTitle(row.role);
    row.formalPosition = row.role;
    row.fullPositionTitle = positionFullTitle(row.role);
    row.responsibilityLabel = row.responsibilityLabel || positionResponsibilityLabel(row.role);
    row.isExecutive = true;
    row.is_executive = true;
    if (isDuplicateLeadershipAssignment(row, id)) return toast("That member already has this officer assignment.");
    snapshot(existing ? "Officer role edited" : "Officer role added", { type: "leadership", id });
    if (existing) Object.assign(existing, row); else state.leadership.unshift({ id: uid("l"), ...row });
    save(); closeModal(); render();
    if (cloud.user) await syncCloudWorkspace(false);
  });
}

function isDuplicateLeadershipAssignment(row, existingId = "") {
  const roleKey = normalizeTitle(row.role);
  const memberId = row.assignedMember || row.member_id || row.memberId || row.user_id || row.userId || row.profile_id || row.profileId;
  if (!memberId || !roleKey) return false;
  return state.leadership.some((l) => l.id !== existingId && !l.archived && (l.assignedMember || l.member_id || l.memberId || l.user_id || l.userId || l.profile_id || l.profileId) === memberId && normalizeTitle(l.role) === roleKey);
}

function beginImport(target) {
  const permission = target === "finance" ? "finance.import" : target === "members" ? "members.import" : target === "pnms" ? "recruitment.manage" : target === "events" ? "attendance.manage" : "backup.restore";
  if (!can(permission) && !can("all")) return toast("You do not have permission to import this data.");
  document.getElementById("importFile").dataset.target = target;
  document.getElementById("importFile").click();
}

function importFile(file) {
  const target = document.getElementById("importFile").dataset.target || "members";
  if (file.name.endsWith(".json") && !can("backup.restore") && !can("all")) return toast("Admin access required to restore backups.");
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (file.name.endsWith(".json")) {
        if (!confirm("Import full JSON backup? This will replace local data in this browser.")) return;
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
  importState = { importing: false, result: null, error: "", rows, target, validation };
  renderImportPreview();
}

function renderImportPreview() {
  const { target, rows, validation, importing, result, error } = importState;
  const goodCount = target === "finance" ? (validation.previewRows || []).length : rows.length - validation.errors.length;
  const disableImport = importing || !rows.length || (target !== "members" && target !== "finance" && validation.errors.length) || (target === "members" && goodCount === 0) || (target === "finance" && goodCount === 0);
  openModal(`<h3>Preview ${labelize(target)} import</h3><p>${goodCount} valid rows, ${validation.errors.length} rows need attention.</p>
    ${validation.errors.length ? `<div class="notice"><h4>Errors</h4><ul>${validation.errors.slice(0, 12).map((e) => `<li>${safe(e)}</li>`).join("")}</ul></div>` : ""}
    ${validation.warnings?.length ? `<div class="notice"><h4>Warnings</h4><ul>${validation.warnings.slice(0, 12).map((e) => `<li>${safe(e)}</li>`).join("")}</ul></div>` : ""}
    ${error ? `<div class="notice error-notice"><h4>Import failed</h4><p>${safe(error)}</p></div>` : ""}
    ${result ? renderImportResult(result) : ""}
    ${target === "finance" ? renderFinanceImportPreviewTable(validation.previewRows || []) : `<div class="table-wrap"><table><thead><tr>${Object.keys(rows[0] || {}).map((h) => `<th>${safe(h)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 8).map((r) => `<tr>${Object.values(r).map((v) => `<td>${safe(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
    <div class="button-row"><button class="primary" id="confirmImport" ${disableImport ? "disabled" : ""}>${importing ? "Importing…" : result?.failed ? "Retry import" : "Import rows"}</button><button class="ghost" data-close-modal>${result ? "Close" : "Cancel"}</button></div>`);
  document.getElementById("confirmImport")?.addEventListener("click", confirmCsvImport);
}

function renderFinanceImportPreviewTable(rows) {
  if (!rows.length) return `<div class="empty-state"><h3>No valid finance rows ready to import.</h3><p>Fix the CSV rows above, then upload again.</p></div>`;
  const cols = [
    ["lastName", "Last Name"],
    ["firstName", "First Name"],
    ["memberIdentifier", "Member ID"],
    ["status", "Status"],
    ["memberType", "Member Type"],
    ["pendingChargeCents", "Pending Charge"],
    ["paymentPlanStatus", "Payment Plan"],
    ["currentBalanceCents", "Current Balance"],
    ["totalBalanceCents", "Total Balance"]
  ];
  return `<div class="table-wrap"><table><thead><tr>${cols.map(([, label]) => `<th>${safe(label)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 12).map((row) => `<tr>${cols.map(([key, label]) => `<td data-label="${safe(label)}">${["pendingChargeCents", "currentBalanceCents", "totalBalanceCents"].includes(key) ? moneyFromCents(row[key]) : safe(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderImportResult(result) {
  return `<div class="notice success-notice"><h4>Import result</h4>
    <div class="mini-grid">
      ${mini("Total rows", result.totalRows ?? 0)}
      ${mini("Valid rows", result.validRows ?? 0)}
      ${mini("Inserted", result.inserted ?? 0)}
      ${mini("Updated", result.updated ?? 0)}
      ${mini("Skipped", result.skipped ?? 0)}
      ${mini("Failed", result.failed ?? 0)}
    </div>
    ${result.totalPendingImported !== undefined ? `<div class="mini-grid">
      ${mini("Pending imported", moneyFromCents(result.totalPendingImported))}
      ${mini("Current imported", moneyFromCents(result.totalCurrentImported))}
      ${mini("Total imported", moneyFromCents(result.totalBalanceImported))}
    </div>` : ""}
    ${result.warnings?.length ? `<h4>Warnings</h4><ul>${result.warnings.slice(0, 20).map((r) => `<li>${safe(r)}</li>`).join("")}</ul>` : ""}
    ${result.failedRows?.length ? `<ul>${result.failedRows.slice(0, 20).map((r) => `<li>Row ${safe(r.rowNumber || "")}: ${safe(r.name || "Unnamed")} — ${safe(r.reason || "Failed")}</li>`).join("")}</ul>` : ""}
  </div>`;
}

async function confirmCsvImport() {
  const { target, rows } = importState;
  if (importState.importing) return;
  if (target === "members") return importMembersCsv(rows);
  if (target === "finance") return importFinanceCsv();

  try {
    importState.importing = true;
    renderImportPreview();
    snapshot(`${labelize(target)} CSV imported`, { type: "import", description: `${rows.length} rows` });
    rows.forEach((row) => importRow(target, row));
    recalcMemberDues();
    save();
    if (cloud.user) await syncCloudWorkspace(false);
    importState.result = { totalRows: rows.length, validRows: rows.length, inserted: rows.length, updated: 0, skipped: 0, failed: 0, failedRows: [] };
    importState.error = "";
    importState.importing = false;
    render();
    renderImportPreview();
    toast("CSV import complete.");
  } catch (err) {
    logSupabaseError("CSV import failed", err);
    importState.importing = false;
    importState.error = formatSupabaseError(err, "CSV import failed.");
    renderImportPreview();
  }
}

async function importMembersCsv(rows) {
  importState.importing = true;
  importState.error = "";
  renderImportPreview();

  try {
    if (!cloud.client) throw new Error("Cloud sync is not configured for this deployment.");
    const { data: sessionData, error: sessionError } = await cloud.client.auth.getSession();
    if (sessionError) throw sessionError;
    cloud.user = sessionData.session?.user || cloud.user;
    if (!cloud.user?.id) throw new Error("You must be signed in to import members.");
    const organizationId = await ensureCloudWorkspace();
    const validRows = rows.map((row, i) => cleanMemberImportRow(row, i + 2)).filter(isValidMemberImportRow);

    importDebug("submitting member CSV import", {
      userId: cloud.user.id,
      organizationId,
      validRows: validRows.length,
      totalRows: rows.length,
      targetTable: "workspace_state.data.members"
    });

    const { data, error } = await cloud.client.rpc("import_members_to_workspace", { p_members: validRows });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.workspace_data) throw new Error("Import completed without returning saved workspace data.");
    await loadCloudWorkspace({ throwOnError: true });
    importState.importing = false;
    importState.result = {
      totalRows: result.totalRows ?? rows.length,
      validRows: result.validRows ?? validRows.length,
      inserted: result.inserted ?? 0,
      updated: result.updated ?? 0,
      skipped: result.skipped ?? 0,
      failed: (result.failed ?? 0) + (importState.validation?.failedRows?.length || 0),
      failedRows: [...(importState.validation?.failedRows || []), ...(result.failedRows || [])]
    };
    importState.error = "";
    render();
    renderImportPreview();
    toast("Member import saved.");
  } catch (err) {
    logSupabaseError("member CSV import failed", err);
    importState.importing = false;
    importState.result = null;
    importState.error = formatSupabaseError(err, "Member import failed.");
    renderImportPreview();
    toast("Member import failed.");
  }
}

async function importFinanceCsv() {
  importState.importing = true;
  importState.error = "";
  renderImportPreview();
  try {
    const validation = importState.validation || validateFinanceImport(importState.rows);
    const rows = validation.previewRows || [];
    if (!rows.length) throw new Error("No valid finance rows are ready to import.");
    const accounts = rows.map((row) => ({
      memberId: row.memberId,
      pendingChargeCents: row.pendingChargeCents,
      currentBalanceCents: row.currentBalanceCents,
      paymentPlanStatus: row.paymentPlanStatus || "None",
      dueDate: row.dueDate || "",
      notes: row.notes || "",
      financialStatus: row.totalBalanceCents > 0 ? "Outstanding" : row.totalBalanceCents < 0 ? "Credit" : "Paid in full"
    }));
    const result = await saveFinanceAccounts(accounts, "Finance import saved.", { closeModal: false });
    const totals = financeLedgerTotals(rows);
    importState.importing = false;
    importState.result = {
      totalRows: importState.rows.length,
      validRows: rows.length,
      inserted: result?.inserted ?? 0,
      updated: result?.updated ?? 0,
      skipped: result?.skipped ?? 0,
      failed: validation.failedRows?.length || 0,
      failedRows: validation.failedRows || [],
      warnings: validation.warnings || [],
      totalPendingImported: totals.pending,
      totalCurrentImported: totals.current,
      totalBalanceImported: totals.outstanding
    };
    importState.error = "";
    render();
    renderImportPreview();
  } catch (err) {
    logSupabaseError("finance CSV import failed", err);
    importState.importing = false;
    importState.result = null;
    importState.error = formatSupabaseError(err, "Finance import failed.");
    renderImportPreview();
    toast("Finance import failed.");
  }
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
  if (target === "finance") return validateFinanceImport(rows);
  const errors = [];
  const failedRows = [];
  rows.forEach((row, i) => {
    const clean = target === "members" ? cleanMemberImportRow(row, i + 2) : cleanImportRow(row);
    if (["members", "pnms"].includes(target) && (!clean.firstName || !clean.lastName)) {
      errors.push(`Row ${i + 2}: firstName and lastName are required.`);
      failedRows.push({ rowNumber: i + 2, name: `${clean.firstName || ""} ${clean.lastName || ""}`.trim(), reason: "Missing first name or last name." });
    }
    if (target === "members" && clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
      errors.push(`Row ${i + 2}: invalid email format.`);
      failedRows.push({ rowNumber: i + 2, name: `${clean.firstName || ""} ${clean.lastName || ""}`.trim(), reason: "Invalid email format." });
    }
  });
  return { errors, failedRows };
}

function validateFinanceImport(rows) {
  const errors = [];
  const warnings = [];
  const failedRows = [];
  const previewRows = [];
  const seenMemberIds = new Set();
  rows.forEach((row, i) => {
    const clean = cleanFinanceImportRow(row, i + 2);
    const member = findMemberForFinanceImport(clean);
    const name = `${clean.firstName || ""} ${clean.lastName || ""}`.trim() || clean.memberId || clean.email || "Unnamed";
    if (!clean.memberId && !clean.email && !clean.phone) {
      const reason = "Finance import needs memberId, email, or phone.";
      errors.push(`Row ${i + 2}: ${reason}`);
      failedRows.push({ rowNumber: i + 2, name, reason });
      return;
    }
    if (!member) {
      const reason = "No existing active member matched this Member ID, email, or phone.";
      errors.push(`Row ${i + 2}: ${reason}`);
      failedRows.push({ rowNumber: i + 2, name, reason });
      return;
    }
    if (seenMemberIds.has(member.id)) {
      const reason = "Duplicate Member ID in this CSV.";
      errors.push(`Row ${i + 2}: ${reason}`);
      failedRows.push({ rowNumber: i + 2, name, reason });
      return;
    }
    seenMemberIds.add(member.id);
    if ([clean.pendingChargeCents, clean.currentBalanceCents, clean.totalBalanceCents].some(Number.isNaN)) {
      const reason = "Invalid dollar amount.";
      errors.push(`Row ${i + 2}: ${reason}`);
      failedRows.push({ rowNumber: i + 2, name, reason });
      return;
    }
    const calculatedTotalCents = clean.pendingChargeCents + clean.currentBalanceCents;
    if (clean.totalBalanceProvided && clean.totalBalanceCents !== calculatedTotalCents) {
      warnings.push(`Row ${i + 2}: totalBalance did not match pendingCharge + currentBalance. The calculated value ${moneyFromCents(calculatedTotalCents)} will be used.`);
    }
    previewRows.push({
      rowNumber: i + 2,
      memberId: member.id,
      lastName: clean.lastName || member.lastName || "",
      firstName: clean.firstName || member.firstName || "",
      memberIdentifier: memberIdentifier(member),
      status: clean.status || member.memberStatus || "Active",
      memberType: clean.memberType || memberType(member),
      pendingChargeCents: clean.pendingChargeCents,
      paymentPlanStatus: clean.paymentPlan || "None",
      currentBalanceCents: clean.currentBalanceCents,
      totalBalanceCents: calculatedTotalCents
    });
  });
  return { errors, warnings, failedRows, previewRows };
}

function cleanFinanceImportRow(row, csvRowNumber) {
  const clean = cleanImportRow(row);
  const pendingRaw = clean.pendingCharge ?? clean.amount ?? clean.owed ?? clean.charge ?? "0";
  const currentRaw = clean.currentBalance ?? clean.previousBalance ?? clean.balance ?? "0";
  const totalRaw = clean.totalBalance;
  const rollNumber = clean.memberId || clean.rollNumber || clean.nationalMemberNumber || clean.badgeNumber || clean.memberNumber || "";
  return {
    csvRowNumber,
    memberId: String(rollNumber || "").trim(),
    email: String(clean.email || "").trim().toLowerCase(),
    phone: String(clean.phone || "").replace(/\D/g, ""),
    firstName: clean.firstName || "",
    lastName: clean.lastName || "",
    status: clean.status || "",
    memberType: clean.memberType || "",
    paymentPlan: clean.paymentPlan || clean.paymentPlanStatus || "None",
    pendingChargeCents: parseMoneyToCents(pendingRaw),
    currentBalanceCents: parseMoneyToCents(currentRaw),
    totalBalanceCents: totalRaw === undefined || totalRaw === null || totalRaw === "" ? 0 : parseMoneyToCents(totalRaw),
    totalBalanceProvided: !(totalRaw === undefined || totalRaw === null || totalRaw === ""),
    dueDate: clean.dueDate || "",
    notes: clean.notes || ""
  };
}

function findMemberForFinanceImport(row) {
  const members = activeMembers();
  const id = normalizeIdentifier(row.memberId);
  const email = normalizeIdentifier(row.email);
  const phone = String(row.phone || "").replace(/\D/g, "");
  return members.find((m) => id && normalizeIdentifier(memberIdentifier(m)) === id)
    || members.find((m) => id && normalizeIdentifier(m.id) === id)
    || members.find((m) => email && normalizeIdentifier(m.email) === email)
    || members.find((m) => phone && String(m.phone || "").replace(/\D/g, "") === phone);
}

function importRow(target, row) {
  const clean = cleanImportRow(row);
  if (target === "members") state.members.push({ id: uid("m"), firstName: clean.firstName, lastName: clean.lastName, phone: clean.phone || "", email: clean.email || "", schoolYear: clean.schoolYear || "", major: clean.major || "", hometown: clean.hometown || "", memberStatus: clean.memberStatus || "Active", initiationStatus: clean.initiationStatus || "Member", officerRole: clean.officerRole || "", committee: clean.committee || "", housingStatus: clean.housingStatus || "Not tracked", duesStatus: clean.duesStatus || "Not billed", notes: clean.notes || "", tags: clean.tags || "", lifecycle: clean.lifecycle || "Active", archived: false });
  if (target === "pnms") state.pnms.push({ id: uid("p"), ...clean, status: clean.status || "New lead", archived: false });
  if (target === "finance") {
    const member = findMemberForImport(clean);
    state.finance.push({ id: uid("f"), type: clean.type || "Charge", memberId: member?.id || clean.memberId || "", amount: parseMoney(clean.amount || clean.owed || clean.paid), category: clean.category || "Imported dues", status: clean.status || "Unpaid", dueDate: clean.dueDate || "", paymentDate: clean.paymentDate || "", paymentMethod: clean.paymentMethod || "", paymentPlan: clean.paymentPlan || "No", notes: clean.notes || "", treasurerNotes: clean.treasurerNotes || "", archived: false });
  }
}

function cleanImportRow(row) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), typeof v === "string" ? v.trim().replace(/\s+/g, " ") : v]));
}

function cleanMemberImportRow(row, csvRowNumber) {
  const clean = cleanImportRow(row);
  const email = String(clean.email || "").trim().toLowerCase();
  const phone = String(clean.phone || "").replace(/\D/g, "");
  const rollNumber = clean.rollNumber || clean.roll || clean.nationalMemberNumber || clean.badgeNumber || clean.memberNumber || "";
  return {
    id: clean.id || clean.memberId || "",
    csvRowNumber,
    firstName: clean.firstName || "",
    lastName: clean.lastName || "",
    phone,
    email,
    schoolYear: clean.schoolYear || clean.classYear || clean.year || "",
    major: clean.major || "",
    hometown: clean.hometown || "",
    rollNumber: String(rollNumber || "").trim(),
    nationalMemberNumber: String(clean.nationalMemberNumber || "").trim(),
    badgeNumber: String(clean.badgeNumber || "").trim(),
    memberNumber: String(clean.memberNumber || "").trim(),
    memberStatus: clean.memberStatus || "Active",
    initiationStatus: clean.initiationStatus || "Member",
    officerRole: clean.officerRole || "",
    committee: clean.committee || "",
    housingStatus: clean.housingStatus || "Not tracked",
    duesStatus: clean.duesStatus || "Not billed",
    notes: clean.notes || "",
    tags: clean.tags || "",
    lifecycle: clean.lifecycle || "Active",
    archived: false
  };
}

function isValidMemberImportRow(row) {
  return Boolean(row.firstName && row.lastName && (!row.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)));
}

function camel(key) {
  const cleaned = String(key || "").trim().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase());
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function findMemberForImport(row) {
  return state.members.find((m) => (row.memberId && m.id === row.memberId) || (row.email && m.email?.toLowerCase() === row.email.toLowerCase()) || (row.phone && m.phone?.replace(/\D/g, "") === row.phone.replace(/\D/g, "")));
}

function exportCsv(key) {
  if (!canExportKey(key)) return toast("You do not have permission to export this data.");
  const rows = exportRows(key);
  const headers = Object.keys(rows[0] || { empty: "" });
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  download(`${key}-export.csv`, csv, "text/csv");
}

function canExportKey(key) {
  if (key.startsWith("finance") || key === "outstanding") return can("finance.export") || can("reports.finance.view") || can("all");
  if (key === "members") return can("members.export") || can("all");
  if (key === "kpis") return can("reports.export") || can("kpi.view") || can("all");
  if (key === "reports") return can("reports.export") || can("all");
  if (key === "attendance") return can("attendance.view") || can("reports.export") || can("all");
  return can("reports.export") || can("all");
}

function exportRows(key) {
  if (key === "finance" || key === "finance-filtered" || key === "finance-all") {
    const rows = financeLedgerRows(key === "finance-all" ? "all" : "filtered");
    return rows.map((row) => ({
      lastName: row.lastName,
      firstName: row.firstName,
      memberId: row.memberIdentifier,
      status: row.status,
      memberType: row.memberType,
      pendingCharge: (row.pendingChargeCents / 100).toFixed(2),
      paymentPlan: row.paymentPlanStatus || "None",
      currentBalance: (row.currentBalanceCents / 100).toFixed(2),
      totalBalance: (row.totalBalanceCents / 100).toFixed(2)
    }));
  }
  if (key === "outstanding") return activeMembers().map((m) => ({ member: memberName(m.id), email: m.email, status: memberFinance(m.id).status, balance: memberFinance(m.id).balance, nextDue: memberFinance(m.id).nextDue })).filter((r) => r.balance > 0);
  if (key === "kpis") {
    const meetingId = activeFilters.kpis?.meetingId || state.kpiMeetings[0]?.id || "";
    const meeting = state.kpiMeetings.find((m) => m.id === meetingId) || {};
    const reports = kpiReportsForMeeting(meetingId);
    return reports.flatMap((report) => {
      const results = state.kpiResults.filter((r) => r.positionReportId === report.id);
      const actions = state.kpiActionItems.filter((a) => a.positionReportId === report.id);
      const base = {
        meetingTitle: meeting.title || "",
        meetingDate: meeting.meetingDate || "",
        reportingPeriodStart: meeting.reportingPeriodStart || "",
        reportingPeriodEnd: meeting.reportingPeriodEnd || "",
        executivePosition: displayPosition(report.position),
        officer: (report.officerMemberIds || [report.officerMemberId]).filter(Boolean).map(memberName).join(", "),
        reportStatus: report.status || "Draft",
        overallUpdate: report.overallUpdate || "",
        mainAccomplishment: report.mainAccomplishment || "",
        biggestBlocker: report.biggestBlocker || "",
        nextPriority: report.nextPriority || ""
      };
      const resultRows = results.length ? results.map((r) => ({ ...base, rowType: "KPI Result", kpiName: r.kpiNameSnapshot || "", target: r.targetValue || "", actual: r.actualValue || "", previous: r.previousValue || "", kpiStatus: r.status || "Not Reported", notes: r.notes || "", actionTitle: "", actionOwner: "", actionDueDate: "", actionStatus: "" })) : [{ ...base, rowType: "Position Report", kpiName: "", target: "", actual: "", previous: "", kpiStatus: "", notes: "", actionTitle: "", actionOwner: "", actionDueDate: "", actionStatus: "" }];
      const actionRows = actions.map((a) => ({ ...base, rowType: "Action Item", kpiName: "", target: "", actual: "", previous: "", kpiStatus: "", notes: a.description || "", actionTitle: a.title || "", actionOwner: memberName(a.assignedMemberId) || "", actionDueDate: a.dueDate || "", actionStatus: a.status || "" }));
      return [...resultRows, ...actionRows];
    });
  }
  if (key === "reports") {
    const officerDirectory = buildOfficerDirectory();
    return [{ report: "Member count", value: metrics().members }, { report: "Executive Team members", value: officerDirectory.executiveOfficers.length }, { report: "Total dues billed", value: metrics().totalBilled }, { report: "Total collected", value: metrics().totalCollected }, { report: "Outstanding", value: metrics().outstanding }, { report: "Open tasks", value: metrics().tasks }];
  }
  if (key === "attendance") return state.attendance;
  return (state[key] || filteredRows(key)).map((r) => ({ ...r, memberName: r.memberId ? memberName(r.memberId) : "" }));
}

function downloadFinanceTemplate() {
  download("chapterops-finance-template.csv", [
    "lastName,firstName,memberId,status,memberType,pendingCharge,paymentPlan,currentBalance,totalBalance"
  ].join("\n"), "text/csv");
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  if (!can("backup.create") && !can("all")) return toast("Admin access required to create backups.");
  download("chapterops-alpha-omega-backup.json", JSON.stringify(state, null, 2), "application/json");
}

function undo() {
  const last = historyStack.pop();
  if (!last) return toast("Nothing to undo.");
  state = normalize(JSON.parse(last));
  save(); render(); toast("Last change undone.");
}

function clearWorkspace() {
  if (!can("workspace.clear") && !can("all")) return toast("Admin access required to clear the workspace.");
  const phrase = "CLEAR LOCAL DATA";
  const entered = prompt(`Type ${phrase} to clear local data from this browser.`);
  if (entered !== phrase) return toast("Clear workspace cancelled.");
  snapshot("Workspace cleared", { type: "settings" });
  state = emptyWorkspace();
  oldStoreKeys.forEach((key) => localStorage.removeItem(key));
  save(); render(); toast("Local data cleared.");
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
