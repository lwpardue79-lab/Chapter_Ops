const today = new Date();
today.setHours(12, 0, 0, 0);
const storeKey = "chapterops-lite-web-v1";
const orgStoreKey = "chapterops-lite-org-id-v1";
const config = window.CHAPTEROPS_CONFIG || {};
const cloud = {
  client: null,
  user: null,
  organizationId: localStorage.getItem(orgStoreKey)
};

const seed = {
  settings: {
    chapter_name: "Demo Chapter / Student Organization",
    exec_email_list: "president@example.org, treasurer@example.org, secretary@example.org",
    attendance_threshold: 80,
    report_day: "Monday",
    report_sender_name: "ChapterOps Lite"
  },
  members: [
    { member_id:"M001", first_name:"Avery", last_name:"Johnson", email:"avery@example.org", phone:"555-0101", status:"Member", class_year:"2027", role:"President", join_date:"2024-08-20", active_status:"Active", notes:"" },
    { member_id:"M002", first_name:"Jordan", last_name:"Lee", email:"jordan@example.org", phone:"555-0102", status:"Member", class_year:"2026", role:"Treasurer", join_date:"2023-08-22", active_status:"Active", notes:"" },
    { member_id:"M003", first_name:"Cameron", last_name:"Patel", email:"cameron@example.org", phone:"555-0103", status:"Member", class_year:"2028", role:"Secretary", join_date:"2025-01-15", active_status:"Active", notes:"" },
    { member_id:"M004", first_name:"Taylor", last_name:"Morgan", email:"taylor@example.org", phone:"555-0104", status:"Associate/New Member", class_year:"2029", role:"Member", join_date:"2026-01-20", active_status:"Active", notes:"" },
    { member_id:"M005", first_name:"Riley", last_name:"Nguyen", email:"riley@example.org", phone:"555-0105", status:"Member", class_year:"2027", role:"Member", join_date:"2024-08-20", active_status:"Active", notes:"" },
    { member_id:"M006", first_name:"Casey", last_name:"Brown", email:"casey@example.org", phone:"555-0106", status:"Associate/New Member", class_year:"2029", role:"Member", join_date:"2026-01-20", active_status:"Active", notes:"" },
    { member_id:"M008", first_name:"Sam", last_name:"Wilson", email:"sam@example.org", phone:"555-0108", status:"Member", class_year:"2028", role:"Community Service Chair", join_date:"2025-01-15", active_status:"Active", notes:"" }
  ],
  events: [
    { event_id:"E001", event_name:"Chapter Operations Meeting", event_date:"2026-06-10", event_time:"19:00", event_category:"Operations", required:"Yes", location:"Student Center 201", created_by:"M003", notes:"" },
    { event_id:"E002", event_name:"Community Service Project", event_date:"2026-06-17", event_time:"09:00", event_category:"Service", required:"Yes", location:"Riverside Park", created_by:"M008", notes:"Wear closed-toe shoes" },
    { event_id:"E003", event_name:"Financial Planning Workshop", event_date:"2026-06-24", event_time:"18:30", event_category:"Education", required:"Yes", location:"Library 104", created_by:"M002", notes:"" },
    { event_id:"E004", event_name:"Member Social", event_date:"2026-07-11", event_time:"19:30", event_category:"Social", required:"No", location:"Campus Green", created_by:"M005", notes:"" },
    { event_id:"E005", event_name:"Executive Planning Session", event_date:"2026-07-12", event_time:"17:00", event_category:"Operations", required:"No", location:"Student Center 110", created_by:"M001", notes:"" }
  ],
  attendance: [
    ["M001","M002","M003","M005","M008"].map((id, i)=>({ attendance_id:`A00${i+1}`, event_id:"E001", member_id:id, check_in_time:"2026-06-10T19:0"+i, attendance_status:"Present", excuse_status:"Not Needed", notes:"" })),
    [{ attendance_id:"A006", event_id:"E001", member_id:"M004", check_in_time:"", attendance_status:"Absent", excuse_status:"Approved", notes:"Academic conflict" }],
    [{ attendance_id:"A007", event_id:"E001", member_id:"M006", check_in_time:"", attendance_status:"Absent", excuse_status:"Pending", notes:"" }],
    ["M001","M002","M004","M005","M008"].map((id, i)=>({ attendance_id:`A01${i}`, event_id:"E002", member_id:id, check_in_time:"2026-06-17T09:0"+i, attendance_status:"Present", excuse_status:"Not Needed", notes:"" })),
    [{ attendance_id:"A015", event_id:"E002", member_id:"M003", check_in_time:"", attendance_status:"Absent", excuse_status:"Approved", notes:"Work conflict" }],
    [{ attendance_id:"A016", event_id:"E002", member_id:"M006", check_in_time:"", attendance_status:"Absent", excuse_status:"Not Requested", notes:"" }],
    ["M001","M002","M003","M006","M008"].map((id, i)=>({ attendance_id:`A02${i}`, event_id:"E003", member_id:id, check_in_time:"2026-06-24T18:3"+i, attendance_status:"Present", excuse_status:"Not Needed", notes:"" })),
    [{ attendance_id:"A025", event_id:"E003", member_id:"M004", check_in_time:"2026-06-24T18:35", attendance_status:"Late", excuse_status:"Not Needed", notes:"" }],
    [{ attendance_id:"A026", event_id:"E003", member_id:"M005", check_in_time:"", attendance_status:"Absent", excuse_status:"Not Requested", notes:"" }]
  ].flat(2),
  dues: [
    { dues_id:"D001", member_id:"M001", semester:"Fall 2026", amount_owed:450, amount_paid:450, due_date:"2026-06-15", payment_status:"Paid", payment_plan:"No", notes:"" },
    { dues_id:"D002", member_id:"M002", semester:"Fall 2026", amount_owed:450, amount_paid:300, due_date:"2026-06-15", payment_status:"Partial", payment_plan:"Yes", notes:"Two installments" },
    { dues_id:"D003", member_id:"M003", semester:"Fall 2026", amount_owed:450, amount_paid:0, due_date:"2026-06-25", payment_status:"Overdue", payment_plan:"No", notes:"" },
    { dues_id:"D004", member_id:"M004", semester:"Fall 2026", amount_owed:350, amount_paid:350, due_date:"2026-07-15", payment_status:"Paid", payment_plan:"No", notes:"" },
    { dues_id:"D005", member_id:"M005", semester:"Fall 2026", amount_owed:450, amount_paid:200, due_date:"2026-06-20", payment_status:"Overdue", payment_plan:"Yes", notes:"" },
    { dues_id:"D006", member_id:"M006", semester:"Fall 2026", amount_owed:350, amount_paid:0, due_date:"2026-07-15", payment_status:"Unpaid", payment_plan:"No", notes:"" },
    { dues_id:"D007", member_id:"M008", semester:"Fall 2026", amount_owed:450, amount_paid:450, due_date:"2026-06-15", payment_status:"Paid", payment_plan:"No", notes:"" }
  ],
  reimbursements: [
    { reimbursement_id:"R001", member_id:"M008", request_date:"2026-06-18", amount:84.25, budget_category:"Service", event_id:"E002", receipt_link:"https://example.org/receipt-1", description:"Project supplies", approval_status:"Approved", paid_status:"Paid", notes:"" },
    { reimbursement_id:"R002", member_id:"M003", request_date:"2026-06-25", amount:32.10, budget_category:"Operations", event_id:"E003", receipt_link:"https://example.org/receipt-2", description:"Workshop materials", approval_status:"Pending", paid_status:"Unpaid", notes:"" },
    { reimbursement_id:"R003", member_id:"M005", request_date:"2026-06-28", amount:61.75, budget_category:"Member Events", event_id:"E004", receipt_link:"https://example.org/receipt-3", description:"Event refreshments", approval_status:"Approved", paid_status:"Unpaid", notes:"" }
  ]
};

let state = load();

async function initCloud() {
  if (!window.supabase || !config.supabaseUrl || !config.supabasePublishableKey) {
    updateCloudUi("Local mode");
    return;
  }
  cloud.client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const { data } = await cloud.client.auth.getSession();
  cloud.user = data.session?.user || null;
  cloud.client.auth.onAuthStateChange(async (_event, session) => {
    cloud.user = session?.user || null;
    if (cloud.user) await loadCloudWorkspace();
    render();
  });
  if (cloud.user) await loadCloudWorkspace();
  updateCloudUi();
}

function load() {
  const saved = localStorage.getItem(storeKey);
  return saved ? JSON.parse(saved) : structuredClone(seed);
}
function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}
function updateCloudUi(message) {
  const status = document.getElementById("cloudStatus");
  const signIn = document.getElementById("signInBtn");
  const signOut = document.getElementById("signOutBtn");
  const sync = document.getElementById("syncBtn");
  if (!status) return;
  if (!cloud.client) {
    status.textContent = message || "Local mode";
    signIn?.classList.add("hidden");
    signOut?.classList.add("hidden");
    sync?.classList.add("hidden");
    return;
  }
  if (!cloud.user) {
    status.textContent = message || "Not signed in";
    signIn?.classList.remove("hidden");
    signOut?.classList.add("hidden");
    sync?.classList.add("hidden");
    return;
  }
  status.textContent = message || `Cloud: ${cloud.user.email}`;
  signIn?.classList.add("hidden");
  signOut?.classList.remove("hidden");
  sync?.classList.remove("hidden");
}
function id(prefix, rows, field) {
  const nums = rows.map(r => Number(String(r[field] || "").replace(/\D/g, ""))).filter(Boolean);
  return prefix + String((Math.max(0, ...nums) + 1)).padStart(3, "0");
}
function money(n) { return Number(n || 0).toLocaleString("en-US", { style:"currency", currency:"USD" }); }
function percent(n) { return `${Math.round(Number(n || 0) * 100)}%`; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function memberName(memberId) {
  const m = state.members.find(x => x.member_id === memberId);
  return m ? `${m.first_name} ${m.last_name}` : memberId;
}
function eventName(eventId) {
  const e = state.events.find(x => x.event_id === eventId);
  return e ? e.event_name : eventId;
}
function balance(row) { return Number(row.amount_owed || 0) - Number(row.amount_paid || 0); }

function metrics() {
  const activeMembers = state.members.filter(m => m.active_status === "Active");
  const requiredEvents = new Set(state.events.filter(e => e.required === "Yes").map(e => e.event_id));
  const requiredAttendance = state.attendance.filter(a => requiredEvents.has(a.event_id));
  const attended = requiredAttendance.filter(a => ["Present", "Late"].includes(a.attendance_status)).length;
  const rate = requiredAttendance.length ? attended / requiredAttendance.length : 0;
  const byMember = activeMembers.map(m => {
    const rows = requiredAttendance.filter(a => a.member_id === m.member_id);
    const present = rows.filter(a => ["Present", "Late"].includes(a.attendance_status)).length;
    return { ...m, attendanceRate: rows.length ? present / rows.length : 0, attendanceRows: rows.length };
  });
  const threshold = Number(state.settings.attendance_threshold || 80) / 100;
  const duesOwed = state.dues.reduce((s, d) => s + Number(d.amount_owed || 0), 0);
  const duesCollected = state.dues.reduce((s, d) => s + Number(d.amount_paid || 0), 0);
  const outstanding = state.dues.reduce((s, d) => s + balance(d), 0);
  const overdue = state.dues.filter(d => balance(d) > 0 && d.due_date && new Date(d.due_date) < today);
  const upcoming = state.events.filter(e => {
    const d = new Date(e.event_date + "T12:00:00");
    const end = new Date(today); end.setDate(end.getDate() + 7);
    return d >= today && d <= end;
  }).sort((a,b) => a.event_date.localeCompare(b.event_date));
  return {
    activeMembers,
    requiredAttendance,
    attended,
    rate,
    byMember,
    followUp: byMember.filter(m => m.attendanceRows > 0 && m.attendanceRate < threshold),
    duesOwed,
    duesCollected,
    outstanding,
    overdue,
    pendingReimbursements: state.reimbursements.filter(r => r.approval_status === "Pending"),
    approvedUnpaid: state.reimbursements.filter(r => r.approval_status === "Approved" && r.paid_status === "Unpaid"),
    upcoming
  };
}

function render() {
  document.getElementById("orgLabel").textContent = state.settings.chapter_name;
  updateCloudUi();
  renderOptions();
  renderDashboard();
  renderTables();
  renderReport();
  renderSettings();
}

async function signIn() {
  if (!cloud.client) return toast("Supabase is not configured");
  const email = prompt("Enter your email for a secure sign-in link");
  if (!email) return;
  const { error } = await cloud.client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) return toast(error.message);
  updateCloudUi("Check your email for the sign-in link");
  toast("Check your email for the sign-in link");
}

async function signOut() {
  if (!cloud.client) return;
  await cloud.client.auth.signOut();
  cloud.user = null;
  updateCloudUi("Signed out");
  render();
}

async function ensureCloudWorkspace() {
  if (!cloud.client || !cloud.user) throw new Error("Sign in first");
  if (cloud.organizationId) return cloud.organizationId;
  const { data: membership, error: membershipError } = await cloud.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", cloud.user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (membership?.organization_id) {
    cloud.organizationId = membership.organization_id;
    localStorage.setItem(orgStoreKey, cloud.organizationId);
    return cloud.organizationId;
  }
  const { data: organization, error: orgError } = await cloud.client
    .from("organizations")
    .insert({ name: state.settings.chapter_name || "ChapterOps Workspace", created_by: cloud.user.id })
    .select("id")
    .single();
  if (orgError) throw orgError;
  cloud.organizationId = organization.id;
  localStorage.setItem(orgStoreKey, cloud.organizationId);
  const { error: memberError } = await cloud.client
    .from("organization_members")
    .insert({ organization_id: cloud.organizationId, user_id: cloud.user.id, email: cloud.user.email, role: "admin" });
  if (memberError) throw memberError;
  return cloud.organizationId;
}

async function loadCloudWorkspace() {
  if (!cloud.client || !cloud.user) return;
  try {
    const organizationId = await ensureCloudWorkspace();
    const { data, error } = await cloud.client
      .from("workspace_state")
      .select("data")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    if (data?.data && Object.keys(data.data).length) {
      state = data.data;
      save();
      toast("Loaded cloud workspace");
    } else {
      await syncCloudWorkspace(false);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || "Cloud load failed");
  } finally {
    updateCloudUi();
  }
}

async function syncCloudWorkspace(showToast = true) {
  if (!cloud.client || !cloud.user) return toast("Sign in before syncing");
  try {
    const organizationId = await ensureCloudWorkspace();
    const { error } = await cloud.client.from("workspace_state").upsert({
      organization_id: organizationId,
      data: state,
      updated_by: cloud.user.id,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    updateCloudUi("Cloud synced");
    if (showToast) toast("Cloud synced");
  } catch (error) {
    console.error(error);
    toast(error.message || "Cloud sync failed");
  }
}

function renderOptions() {
  document.querySelectorAll("[data-member-options]").forEach(sel => {
    const current = sel.value;
    sel.innerHTML = state.members.map(m => `<option value="${m.member_id}">${m.member_id} — ${m.first_name} ${m.last_name}</option>`).join("");
    if (current) sel.value = current;
  });
  document.querySelectorAll("[data-event-options]").forEach(sel => {
    const current = sel.value;
    sel.innerHTML = state.events.map(e => `<option value="${e.event_id}">${e.event_id} — ${e.event_name}</option>`).join("");
    if (current) sel.value = current;
  });
}

function renderDashboard() {
  const m = metrics();
  const cards = [
    ["Active members", m.activeMembers.length, "Current active roster"],
    ["Associate/new members", m.activeMembers.filter(x => x.status === "Associate/New Member").length, "Included without hierarchy tracking"],
    ["Required attendance", percent(m.rate), `${m.attended} of ${m.requiredAttendance.length} records`],
    ["Members under threshold", m.followUp.length, `${state.settings.attendance_threshold}% threshold`],
    ["Dues owed", money(m.duesOwed), "Total assessed"],
    ["Dues collected", money(m.duesCollected), "Payments recorded"],
    ["Outstanding balance", money(m.outstanding), "Remaining balance"],
    ["Overdue balances", m.overdue.length, "Rows past due date"],
    ["Pending reimbursements", m.pendingReimbursements.length, "Need review"],
    ["Approved unpaid", m.approvedUnpaid.length, money(m.approvedUnpaid.reduce((s,r)=>s+Number(r.amount||0),0))],
    ["Upcoming events", m.upcoming.length, "Next 7 days"]
  ];
  document.getElementById("kpiGrid").innerHTML = cards.map(c => `<article class="kpi"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></article>`).join("");
  document.getElementById("followUpList").innerHTML = m.followUp.length ? m.followUp.map(x => `<div class="list-item"><div><strong>${x.first_name} ${x.last_name}</strong><span>${x.member_id} · required attendance ${percent(x.attendanceRate)}</span></div><span class="pill">Follow up</span></div>`).join("") : `<p class="muted">No members are below the current attendance threshold.</p>`;
  document.getElementById("upcomingList").innerHTML = m.upcoming.length ? m.upcoming.map(e => `<div class="list-item"><div><strong>${e.event_name}</strong><span>${e.event_date} · ${e.event_time || "Time TBD"} · ${e.location || "Location TBD"}</span></div><span class="pill">${e.required === "Yes" ? "Required" : "Optional"}</span></div>`).join("") : `<p class="muted">No events scheduled in the next seven days.</p>`;
}

const tableConfig = {
  members: ["member_id","first_name","last_name","email","phone","status","class_year","role","active_status"],
  events: ["event_id","event_name","event_date","event_time","event_category","required","location","created_by"],
  attendance: ["attendance_id","event_id","member_id","check_in_time","attendance_status","excuse_status","notes"],
  dues: ["dues_id","member_id","semester","amount_owed","amount_paid","balance","due_date","payment_status","payment_plan"],
  reimbursements: ["reimbursement_id","member_id","request_date","amount","budget_category","event_id","description","approval_status","paid_status"]
};

function renderTables() {
  renderTable("membersTable", "members", state.members);
  renderTable("eventsTable", "events", state.events);
  renderTable("attendanceTable", "attendance", state.attendance.map(a => ({...a, member_id:`${a.member_id} · ${memberName(a.member_id)}`, event_id:`${a.event_id} · ${eventName(a.event_id)}`})));
  renderTable("duesTable", "dues", state.dues.map(d => ({...d, member_id:`${d.member_id} · ${memberName(d.member_id)}`, balance: money(balance(d)), amount_owed: money(d.amount_owed), amount_paid: money(d.amount_paid)})));
  renderTable("reimbursementsTable", "reimbursements", state.reimbursements.map(r => ({...r, member_id:`${r.member_id} · ${memberName(r.member_id)}`, event_id:r.event_id ? `${r.event_id} · ${eventName(r.event_id)}` : "", amount: money(r.amount)})));
}

function renderTable(tableId, key, rows) {
  const fields = tableConfig[key];
  const table = document.getElementById(tableId);
  table.innerHTML = `<thead><tr>${fields.map(f => `<th>${f.replaceAll("_"," ")}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows.map((row, i) => `<tr>${fields.map(f => `<td>${escapeHtml(row[f])}</td>`).join("")}<td class="actions">${actionButtons(key, i)}</td></tr>`).join("")}</tbody>`;
}

function actionButtons(key, i) {
  const common = `<button class="mini delete" data-delete="${key}:${i}">Delete</button>`;
  if (key === "members") return `<button class="mini" data-action="members:${i}:toggle-active">Toggle active</button>${common}`;
  if (key === "events") return `<button class="mini" data-action="events:${i}:toggle-required">Toggle required</button>${common}`;
  if (key === "attendance") return `<button class="mini" data-action="attendance:${i}:present">Present</button><button class="mini" data-action="attendance:${i}:absent">Absent</button>${common}`;
  if (key === "dues") return `<button class="mini" data-action="dues:${i}:paid">Mark paid</button><button class="mini" data-action="dues:${i}:partial">Update paid</button>${common}`;
  if (key === "reimbursements") return `<button class="mini" data-action="reimbursements:${i}:approve">Approve</button><button class="mini" data-action="reimbursements:${i}:paid">Mark paid</button>${common}`;
  return common;
}

function renderReport() {
  const m = metrics();
  const overdue = m.overdue.map(d => `${memberName(d.member_id)} — ${money(balance(d))} due ${d.due_date}`);
  const html = [
    ["Attendance summary", [`Required-event attendance is ${percent(m.rate)} (${m.attended} of ${m.requiredAttendance.length} records).`]],
    ["Members needing follow-up", m.followUp.length ? m.followUp.map(x => `${x.first_name} ${x.last_name} — ${percent(x.attendanceRate)} required-event attendance`) : ["No follow-up items based on current records."]],
    ["Dues collection summary", [`Total owed: ${money(m.duesOwed)}`, `Collected: ${money(m.duesCollected)}`, `Outstanding: ${money(m.outstanding)}`]],
    ["Overdue balances", overdue.length ? overdue : ["No overdue balances recorded."]],
    ["Reimbursement summary", [`Pending requests: ${m.pendingReimbursements.length}`, `Approved unpaid: ${m.approvedUnpaid.length}`, `Approved unpaid total: ${money(m.approvedUnpaid.reduce((s,r)=>s+Number(r.amount||0),0))}`]],
    ["Upcoming events", m.upcoming.length ? m.upcoming.map(e => `${e.event_date} — ${e.event_name} (${e.required === "Yes" ? "Required" : "Optional"})`) : ["No upcoming events in the next seven days."]],
    ["Action items", [
      m.followUp.length ? "Follow up privately with members below the attendance threshold." : "No attendance follow-up needed from current records.",
      m.overdue.length ? "Contact members with overdue balances and document payment plans." : "No overdue dues action needed.",
      (m.pendingReimbursements.length || m.approvedUnpaid.length) ? "Review pending requests and process approved unpaid reimbursements." : "No reimbursement action needed."
    ]]
  ];
  document.getElementById("weeklyReport").innerHTML = html.map(([title, items]) => `<section class="report-section"><h4>${title}</h4><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></section>`).join("");
}

function renderSettings() {
  const form = document.getElementById("settingsForm");
  Object.entries(state.settings).forEach(([k,v]) => { if (form.elements[k]) form.elements[k].value = v; });
}

function addRow(key, form) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (key === "members") data.member_id = id("M", state.members, "member_id");
  if (key === "events") data.event_id = id("E", state.events, "event_id");
  if (key === "attendance") {
    const existing = state.attendance.find(a => a.event_id === data.event_id && a.member_id === data.member_id);
    const payload = { ...data, check_in_time: new Date().toISOString(), attendance_id: existing?.attendance_id || id("A", state.attendance, "attendance_id") };
    if (existing) Object.assign(existing, payload);
    else state.attendance.push(payload);
    save(); render(); toast(existing ? "Updated existing check-in" : "Check-in recorded"); form.reset(); return;
  }
  if (key === "dues") data.dues_id = id("D", state.dues, "dues_id");
  if (key === "reimbursements") data.reimbursement_id = id("R", state.reimbursements, "reimbursement_id");
  state[key].push(data);
  save(); render(); toast("Saved");
  form.reset();
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

document.querySelectorAll(".nav-item, [data-open-view]").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view || btn.dataset.openView;
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === view));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
    document.getElementById("viewTitle").textContent = view.replace(/^./, c => c.toUpperCase()).replace("-", " ");
  });
});

document.querySelectorAll("[data-form]").forEach(form => {
  form.addEventListener("submit", e => { e.preventDefault(); addRow(form.dataset.form, form); });
});

document.addEventListener("click", e => {
  const actionTarget = e.target.closest("[data-action]");
  if (actionTarget) {
    const [key, i, action] = actionTarget.dataset.action.split(":");
    runAction(key, Number(i), action);
    return;
  }
  const target = e.target.closest("[data-delete]");
  if (!target) return;
  const [key, i] = target.dataset.delete.split(":");
  state[key].splice(Number(i), 1);
  save(); render(); toast("Deleted");
});

function runAction(key, index, action) {
  const row = state[key][index];
  if (!row) return;
  if (key === "members" && action === "toggle-active") {
    row.active_status = row.active_status === "Active" ? "Inactive" : "Active";
  }
  if (key === "events" && action === "toggle-required") {
    row.required = row.required === "Yes" ? "No" : "Yes";
  }
  if (key === "attendance" && action === "present") {
    row.attendance_status = "Present";
    row.check_in_time = new Date().toISOString();
    row.excuse_status = "Not Needed";
  }
  if (key === "attendance" && action === "absent") {
    row.attendance_status = "Absent";
    row.check_in_time = "";
    row.excuse_status = row.excuse_status || "Not Requested";
  }
  if (key === "dues" && action === "paid") {
    row.amount_paid = Number(row.amount_owed || 0);
    row.payment_status = "Paid";
  }
  if (key === "dues" && action === "partial") {
    const next = prompt("Enter updated amount paid", row.amount_paid || "0");
    if (next === null) return;
    row.amount_paid = Number(next || 0);
    row.payment_status = balance(row) <= 0 ? "Paid" : row.amount_paid > 0 ? "Partial" : "Unpaid";
  }
  if (key === "reimbursements" && action === "approve") {
    row.approval_status = "Approved";
  }
  if (key === "reimbursements" && action === "paid") {
    row.paid_status = "Paid";
    if (row.approval_status === "Pending") row.approval_status = "Approved";
  }
  save();
  render();
  toast("Updated");
}

document.querySelectorAll("[data-search]").forEach(input => {
  input.addEventListener("input", () => {
    const table = document.getElementById(input.dataset.search);
    const q = input.value.toLowerCase();
    table.querySelectorAll("tbody tr").forEach(row => row.hidden = !row.textContent.toLowerCase().includes(q));
  });
});

document.getElementById("settingsForm").addEventListener("submit", e => {
  e.preventDefault();
  state.settings = Object.fromEntries(new FormData(e.target).entries());
  state.settings.attendance_threshold = Number(state.settings.attendance_threshold || 80);
  save(); render(); toast("Settings saved");
});
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `chapterops-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  state = JSON.parse(await file.text());
  save(); render(); toast("Imported backup");
});
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Reset to demo data? Export first if you want to keep your trial data.")) return;
  state = structuredClone(seed);
  save(); render(); toast("Demo data restored");
});
document.getElementById("copyReportBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.getElementById("weeklyReport").innerText);
  toast("Report copied");
});
document.getElementById("signInBtn").addEventListener("click", signIn);
document.getElementById("signOutBtn").addEventListener("click", signOut);
document.getElementById("syncBtn").addEventListener("click", () => syncCloudWorkspace(true));

render();
initCloud();
