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
  executiveOfficerRoles: ["President", "Internal Vice President", "External Vice President", "Treasurer", "Secretary", "Sergeant at Arms"],
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

const can = (permission) => roleRules[state.settings.currentRole]?.includes("all") || roleRules[state.settings.currentRole]?.includes(permission);
const canManage = (area) => can("all") || can(`manage_${area}`);

function toDbRole(role = "") {
  const key = String(role || "").toLowerCase();
  if (key.includes("admin")) return "admin";
  if (key.includes("president")) return "president";
  if (key.includes("treasurer")) return "treasurer";
  if (key.includes("secretary")) return "secretary";
  if (key.includes("advisor")) return "advisor";
  return "member";
}

function formatSupabaseError(err, fallback = "Supabase request failed.") {
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
  cloud.client.auth.onAuthStateChange(async (event, session) => {
    cloud.user = session?.user || null;
    cloud.profile = null;
    updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Sign in required for real cloud data");
    if (event === "PASSWORD_RECOVERY") openNewPasswordModal();
    if (cloud.user) await bootstrapUser();
    render();
  });
  if (cloud.user) await bootstrapUser();
  updateCloudUi(cloud.user ? `Signed in as ${cloud.user.email}` : "Sign in required for real cloud data");
}

function updateCloudUi(message) {
  document.getElementById("cloudStatus").textContent = message;
  document.getElementById("signInBtn").classList.toggle("hidden", !!cloud.user);
  document.getElementById("syncBtn").classList.toggle("hidden", !cloud.user);
  document.getElementById("signOutBtn").classList.toggle("hidden", !cloud.user);
}

async function signIn() {
  openAuthModal("signin");
}

async function signInWithPassword(email, password) {
  if (!cloud.client) return toast("Supabase is not configured.");
  const { error } = await cloud.client.auth.signInWithPassword({ email, password });
  if (error) return toast(error.message);
  closeModal();
  toast("Signed in.");
}

async function createAccount(email, password, confirmPassword, fullName, requestedRole = "Active Member", requestNotes = "") {
  if (!cloud.client) return toast("Supabase is not configured.");
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
  if (!cloud.client) return toast("Supabase is not configured.");
  if (!email) return toast("Enter your email address first.");
  const { error } = await cloud.client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  toast(error ? error.message : "Password reset email sent.");
}

async function updateAccountPassword(password, confirmPassword) {
  if (!cloud.client) return toast("Supabase is not configured.");
  if (password.length < 8) return toast("Password must be at least 8 characters.");
  if (password !== confirmPassword) return toast("Passwords do not match.");
  const { error } = await cloud.client.auth.updateUser({ password });
  if (error) return toast(error.message);
  closeModal();
  toast("Password updated.");
}

async function signOut() {
  if (cloud.client) await cloud.client.auth.signOut();
  cloud.user = null;
  updateCloudUi("Signed out");
  render();
}

async function bootstrapUser() {
  await ensureOwnProfile();
  if (cloud.profile?.approval_status === "approved") {
    state.settings.currentRole = cloud.profile.role || "Active Member";
    await loadCloudWorkspace();
    if (can("all")) await loadProfilesForAdmin();
  }
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
  if (!cloud.client || !cloud.user) throw new Error("Sign in before syncing real chapter data.");
  if (cloud.profile?.approval_status !== "approved") throw new Error("Your account is pending admin approval.");
  if (cloud.organizationId) return cloud.organizationId;
  const { data: existing } = await cloud.client.from("organization_members").select("organization_id").eq("user_id", cloud.user.id).limit(1).maybeSingle();
  if (existing?.organization_id) {
    cloud.organizationId = existing.organization_id;
    localStorage.setItem(orgStoreKey, cloud.organizationId);
    return cloud.organizationId;
  }
  if (cloud.profile?.role !== "Admin") throw new Error("Your account is approved but not assigned to a chapter workspace yet.");
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
    toast(formatSupabaseError(err, "Could not load cloud workspace."));
    if (options.throwOnError) throw err;
  }
}

async function syncCloudWorkspace(showToast = true) {
  try {
    const organizationId = await ensureCloudWorkspace();
    const { error } = await cloud.client.from("workspace_state").upsert({ organization_id: organizationId, data: state, updated_by: cloud.user.id, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
    if (error) throw error;
    if (showToast) toast("Cloud workspace synced.");
  } catch (err) {
    logSupabaseError("cloud sync failed", err);
    toast(formatSupabaseError(err, "Cloud sync failed."));
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
    .replace(/vp of membership development/g, "recruitment chair / vpmd")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isExecutiveRole(role = "", assignment = {}) {
  if (assignment.is_executive === true || assignment.isExecutive === true || assignment.executive_board === true || assignment.executiveBoard === true) return true;
  if (["executive", "executive board", "exec", "exec board"].includes(normalizeTitle(assignment.officer_type || assignment.officerType || assignment.position_category || assignment.positionCategory || assignment.role_category || assignment.roleCategory))) return true;
  const executiveRoles = state.settings.executiveOfficerRoles || defaults.executiveOfficerRoles;
  const roleKey = normalizeTitle(role);
  return executiveRoles.map(normalizeTitle).includes(roleKey);
}

function addOfficerRole(group, item) {
  const title = String(item.role || "").trim();
  if (!title) return;
  if (!group.roleKeys.has(normalizeTitle(title))) {
    group.roles.push(title);
    group.roleKeys.add(normalizeTitle(title));
  }
  if (item.committee && !group.committees.includes(item.committee)) group.committees.push(item.committee);
  if (item.responsibilities && !group.responsibilities.includes(item.responsibilities)) group.responsibilities.push(item.responsibilities);
  if (item.id && !group.assignmentIds.includes(item.id)) group.assignmentIds.push(item.id);
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
        responsibilities: [],
        assignmentIds: [],
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

  const groups = [...byMember.values()].map((group) => ({ ...group, roleKeys: undefined }));
  const executiveOfficers = groups.filter((group) => group.hasExecutiveRole).sort((a, b) => memberName(a.memberId).localeCompare(memberName(b.memberId)));
  const executiveMemberIds = new Set(executiveOfficers.map((group) => group.memberId));
  const otherOfficers = groups.filter((group) => !executiveMemberIds.has(group.memberId)).sort((a, b) => memberName(a.memberId).localeCompare(memberName(b.memberId)));
  return { executiveOfficers, otherOfficers, allOfficers: groups };
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
    bindAuthActions(root);
    return;
  }
  if (cloud.client && cloud.user && cloud.profile?.approval_status !== "approved") {
    root.innerHTML = renderApprovalGate();
    bindAuthActions(root);
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
  bindAuthActions(root);
}

function renderLoginGate() {
  return `<section class="auth-shell">
    <div class="auth-card">
      <p class="eyebrow">Private chapter operations</p>
      <h3>Sign in to Alpha Omega Chapter Operations</h3>
      <p class="muted">Use your email and password. Supabase handles password storage and sessions securely.</p>
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
  </section>
  <section class="hero">
    <div>
      <p class="eyebrow">Privacy first</p>
      <h3>Chapter data stays behind login.</h3>
      <p>This workspace can contain member records, dues, payments, attendance, tasks, and notes. For privacy, chapter data is not shown until you sign in.</p>
    </div>
    <div class="hero-actions">
      <button class="primary" data-auth-mode="signin">Sign in</button>
      <button class="ghost" data-auth-mode="signup">Request access</button>
    </div>
  </section>
  <section class="panel">
    <div class="panel-head"><h3>Ready for real setup</h3><span class="pill">Kansas State · Alpha Omega PIKE</span></div>
    <p class="muted">After login, complete setup and start entering or importing the real roster and dues records with the Treasurer.</p>
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
  if (key === "finance") return renderFinanceLedger();
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
    <div class="panel-head">
      <div><p class="eyebrow">Treasurer module</p><h3>Member billing ledger</h3><p class="muted">One current finance row per active member. Total Balance = Pending Charge + Current Balance.</p></div>
      <div class="button-row">
        <input class="search" id="searchInput" placeholder="Search name, member ID, status, balances" value="${safe(filter.q || "")}" />
        <button class="ghost" data-import="finance">Import Finance CSV</button>
        <button class="ghost" data-export="finance-filtered">Export filtered</button>
        <button class="ghost" data-export="finance-all">Export all</button>
        <button class="ghost" data-finance-template>Template</button>
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
      ${mini("Total Pending Charges", moneyFromCents(totals.pending))}
      ${mini("Total Current Balances", moneyFromCents(totals.current))}
      ${mini("Total Outstanding Balance", moneyFromCents(totals.outstanding))}
      ${mini("Members with Balance", totals.withBalance)}
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
    ["totalBalanceCents", "Total Balance"]
  ];
  return `<div class="table-wrap finance-table-wrap"><table class="finance-ledger-table"><thead><tr>${cols.map(([key, label]) => `<th><button class="th-sort" data-finance-sort="${key}">${safe(label)}${financeSort.key === key ? ` ${financeSort.dir === "asc" ? "▲" : "▼"}` : ""}</button></th>`).join("")}<th>Actions</th></tr></thead><tbody>
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
  if (!activeMembers().length) return `<div class="empty-state"><h3>No active members yet.</h3><p>Add or import your member roster first, then this ledger will show one finance row per member.</p><div class="button-row centered"><button class="primary" data-go="members">Go to members</button><button class="ghost" data-import="members">Import roster</button></div></div>`;
  return `<div class="empty-state"><h3>No members match these finance filters.</h3><p>Clear filters, import finance balances, or edit a member ledger row.</p><div class="button-row centered"><button class="primary" data-finance-filter="all">Show all members</button><button class="ghost" data-import="finance">Import finance CSV</button></div></div>`;
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
  const directory = buildOfficerDirectory();
  const hasRows = directory.allOfficers.length;
  return `<section class="panel">
    <div class="panel-head"><div><p class="eyebrow">Officers and committees</p><h3>Leadership assignments</h3></div><button class="primary" data-add-leadership>Add officer / committee role</button></div>
    ${hasRows ? `
      ${renderOfficerSection("Executive Officers", directory.executiveOfficers, "Executive positions are controlled in Settings. Each executive member appears once here.")}
      ${renderOfficerSection("Other Chapter Officers", directory.otherOfficers, "Non-executive officers appear here unless they are already listed as executive officers.")}
      ${renderLeadershipRoster()}
    ` : `<div class="empty-state"><h3>No officer roles assigned yet.</h3><p>Add the Treasurer, President, Assistant Treasurer, and other roles once the real roster is entered.</p><button class="primary" data-add-leadership>Add first role</button></div>`}
  </section>`;
}

function renderOfficerSection(title, officers, emptyText) {
  if (!officers.length) return "";
  return `<section class="leadership-section">
    <div class="section-head"><h4>${safe(title)}</h4><p>${safe(emptyText)}</p></div>
    <div class="card-grid">${officers.map(renderOfficerCard).join("")}</div>
  </section>`;
}

function renderOfficerCard(officer) {
  return `<article class="profile-card" data-open="members" data-id="${safe(officer.memberId)}">
    <p class="eyebrow">${safe(officer.committees.join(" · ") || "Chapter leadership")}</p>
    <h3>${safe(memberName(officer.memberId) || "Unassigned")}</h3>
    <p><strong>${safe(officer.roles.join(", "))}</strong></p>
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
    <div class="section-head"><h4>All Members</h4><p>Officers remain in the normal chapter roster. Holding a position does not remove anyone from the member list.</p></div>
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
    ${reportsEmpty ? `<div class="empty-state"><h3>Reports will populate once real data is entered.</h3><p>Add members, dues charges, payments, events, attendance, and tasks to generate useful reports.</p><div class="button-row centered"><button class="primary" data-go="members">Add members</button><button class="ghost" data-go="finance">Open dues tracker</button></div></div>` : ""}
    <div class="mini-grid">
      ${mini("Member roster", state.members.filter((m) => !m.archived).length)}
      ${mini("Dues report", money(m.totalBilled))}
      ${mini("Outstanding balances", money(m.outstanding))}
      ${mini("Payment history", state.finance.filter((f) => f.type === "Payment").length)}
      ${mini("Attendance records", state.attendance.length)}
      ${mini("Executive officers", officerDirectory.executiveOfficers.length)}
      ${mini("Other officers", officerDirectory.otherOfficers.length)}
      ${mini("Open officer tasks", m.tasks)}
    </div>
    <div class="two-col">
      ${reportBlock("Executive officers", officerDirectory.executiveOfficers.map((o) => `${memberName(o.memberId)}: ${o.roles.join(", ")}`))}
      ${reportBlock("Other chapter officers", officerDirectory.otherOfficers.map((o) => `${memberName(o.memberId)}: ${o.roles.join(", ")}`))}
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
  const saveLabel = setupSave.saving ? "Saving…" : "Save setup";
  const fieldError = (key) => setupSave.fieldErrors?.[key] ? `<p class="field-error">${safe(setupSave.fieldErrors[key])}</p>` : "";
  return `<section class="panel">
    <div class="panel-head"><div><p class="eyebrow">First-time setup</p><h3>Chapter configuration</h3></div><button class="primary" data-save-settings ${setupSave.saving ? "disabled" : ""}>${saveLabel}</button></div>
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
      ${listSetting("officerRoles", "Officer roles")}
      ${listSetting("executiveOfficerRoles", "Executive officer roles")}
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
  return `<section class="panel empty-state"><h3>Restricted area</h3><p>${safe(message)}</p><button class="ghost" data-go="settings">Switch role in settings</button></section>`;
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
  if (!cloud.client) return toast("Supabase is not configured.");
  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  openModal(`<section class="auth-modal">
    <p class="eyebrow">${isSignup ? "Request access" : isReset ? "Password reset" : "Sign in"}</p>
    <h3>${isSignup ? "Request a ChapterOps account" : isReset ? "Reset your password" : "Sign in to ChapterOps"}</h3>
    <p class="muted">${isSignup ? "Use an email and password. If email confirmation is enabled, Supabase will send a confirmation email." : isReset ? "Enter your email and Supabase will send a secure reset link." : "Enter the email and password for your ChapterOps account."}</p>
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
  activeView = view;
  render();
}

function openForm(key, id) {
  const meta = collectionMeta[key];
  if (!meta) return;
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
    : `Remove ${memberName(memberId)} from the active roster? This archives the member in Supabase.`;
  if (!confirm(message)) return;
  if (!cloud.client) return toast("Supabase is not configured.");
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
  if (!cloud.client) return toast("Supabase is not configured for finance persistence.");
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
    setupSave.error = "Supabase is not configured for this deployment.";
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
    setupSave = { saving: false, error: "", success: "Your chapter setup was saved to Supabase and reloaded from the database.", fieldErrors: {} };
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
  const fields = [["role", "Role", "select", "officerRoles"], ["assignedMember", "Assigned member", "select", "members"], ["committee", "Committee", "select", "committees"], ["responsibilities", "Responsibilities", "textarea"], ["relatedReports", "Related reports", "text"]];
  openModal(`<h3>${existing ? "Edit officer role" : "Add officer role"}</h3><form id="leadershipForm" class="form-grid">${fields.map((f) => formField(f, existing)).join("")}<div class="wide button-row"><button class="primary">Save</button><button class="ghost" type="button" data-close-modal>Cancel</button></div></form>`);
  document.getElementById("leadershipForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const row = Object.fromEntries(new FormData(ev.currentTarget).entries());
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
    if (!cloud.client) throw new Error("Supabase is not configured for this deployment.");
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
    toast("Member import saved to Supabase.");
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
    const result = await saveFinanceAccounts(accounts, "Finance import saved to Supabase.", { closeModal: false });
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
  const rows = exportRows(key);
  const headers = Object.keys(rows[0] || { empty: "" });
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  download(`${key}-export.csv`, csv, "text/csv");
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
  if (key === "reports") {
    const officerDirectory = buildOfficerDirectory();
    return [{ report: "Member count", value: metrics().members }, { report: "Executive officers", value: officerDirectory.executiveOfficers.length }, { report: "Other officers", value: officerDirectory.otherOfficers.length }, { report: "Total dues billed", value: metrics().totalBilled }, { report: "Total collected", value: metrics().totalCollected }, { report: "Outstanding", value: metrics().outstanding }, { report: "Open tasks", value: metrics().tasks }];
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
