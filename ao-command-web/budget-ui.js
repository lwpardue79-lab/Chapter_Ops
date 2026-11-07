(function (root) {
  "use strict";
  const B = root.AOCommandBudget;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const id = () => crypto.randomUUID();
  let host;
  let data = { budgets: [], budget: null, lines: [], entries: [], can_manage: false };
  let loaded = false, loading = false, error = "", selected = "", epoch = 0, saving = false;
  let tab = "plan", through = 3, query = "", importDocument = null, lastMessage = "";
  let alumni = false;
  const permitted = () => host?.can("budget.view");
  const manage = () => permitted() && host.can("budget.manage") && data.can_manage && !alumni;
  const editable = () => manage() && !["Closed", "Archived"].includes(data.budget?.status);
  const fail = (e) => [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(" ") || "The request failed. Try again.";
  const field = (name, label, value = "", type = "text", extra = "") => `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const option = (value, label, chosen) => `<option value="${esc(value)}" ${String(value) === String(chosen) ? "selected" : ""}>${esc(label)}</option>`;
  const summary = () => B.summarize(data.lines, through);
  const card = (label, value) => `<div class="budget-stat"><span>${esc(label)}</span><strong>${B.amount(value)}</strong></div>`;
  const lineFor = (entry) => data.lines.find((l) => l.id === entry.line_id);
  function reset() {
    epoch++; data = { budgets: [], budget: null, lines: [], entries: [], can_manage: false };
    loaded = false; loading = false; error = ""; selected = ""; saving = false; importDocument = null; alumni = false; lastMessage = "";
    document.body.classList.remove("budget-alumni-mode");
  }
  async function rpc(name, args) {
    const ctx = host.context();
    if (!ctx.client || !ctx.userId || !ctx.organizationId || !permitted()) throw new Error("Sign in with authorized chapter budget access.");
    const response = await ctx.client.rpc(name, { p_organization_id: ctx.organizationId, ...args });
    if (response.error) throw response.error;
    return response.data;
  }
  async function load(budgetId = selected) {
    if (!permitted() || loading) return;
    const version = epoch;
    loading = true; error = ""; host.render();
    try {
      let result = await rpc("read_annual_budget", { p_budget_id: budgetId || null });
      if (version !== epoch) return;
      if (!budgetId && result.budgets?.length) result = await rpc("read_annual_budget", { p_budget_id: result.budgets[0].id });
      if (version !== epoch) return;
      data = result; selected = data.budget?.id || ""; loaded = true;
      if (data.budget) {
        const current = new Date().toISOString().slice(0, 7);
        through = Math.max(0, B.months(data.budget.starts_on).findIndex((m) => m.key === current) - 1);
        if (current > B.months(data.budget.starts_on)[11].key) through = 11;
      }
    } catch (e) { if (version === epoch) { error = fail(e); loaded = true; } }
    finally { if (version === epoch) { loading = false; host.render(); } }
  }
  async function save(action, payload, form, budgetId = selected, revision = data.budget?.revision) {
    if (saving || !host.can("budget.manage")) return;
    saving = true;
    const version = epoch;
    const buttons = [...(form?.querySelectorAll("button") || [])];
    buttons.forEach((b) => { b.disabled = true; });
    const status = form?.querySelector("[data-budget-form-status]");
    if (status) status.textContent = "Saving…";
    // Keep the same request token for a retry when a connection drops after commit.
    const signature = JSON.stringify([action, payload, budgetId, revision]);
    if (form && form.dataset.signature !== signature) { form.dataset.signature = signature; form.dataset.request = id(); }
    const requestId = form?.dataset.request || id();
    try {
      const result = await rpc("save_annual_budget", { p_budget_id: budgetId, p_expected_revision: revision ?? null, p_request_id: requestId, p_action: action, p_data: payload });
      if (version !== epoch) return;
      data = result; selected = result.budget.id; loaded = true;
      // A readback is deliberately separate from write confirmation.
      let reloadError = "";
      try { data = await rpc("read_annual_budget", { p_budget_id: selected }); } catch (e) { reloadError = `Saved, but the latest view could not load: ${fail(e)}`; }
      if (version !== epoch) return;
      host.closeModal(); lastMessage = reloadError || "Budget changes saved."; error = reloadError;
      host.render(); host.toast(reloadError || "Budget changes saved.");
      return true;
    } catch (e) {
      if (version !== epoch) return;
      if (status) { status.textContent = fail(e); status.setAttribute("role", "alert"); }
      else host.toast(fail(e));
      return false;
    } finally {
      if (version === epoch) saving = false;
      buttons.forEach((b) => { b.disabled = false; });
    }
  }
  function form(html, submit) {
    host.openModal(`<h3>${html.title}</h3><form id="annualBudgetForm" class="form-grid">${html.body}<p class="wide budget-form-status" data-budget-form-status role="status" aria-live="polite"></p><div class="wide button-row"><button type="submit" class="primary">${html.submit || "Save"}</button><button type="button" class="ghost" data-close-modal>Cancel</button></div></form>`);
    document.getElementById("annualBudgetForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const node = ev.currentTarget;
      try { await submit(Object.fromEntries(new FormData(node)), node); }
      catch (e) { const status = node.querySelector("[data-budget-form-status]"); status.textContent = fail(e); status.setAttribute("role", "alert"); }
    });
  }
  function create() {
    if (!host.can("budget.manage")) return;
    const budgetId = id();
    form({ title: "Create annual budget", body: `${field("name", "Budget name", "", "text", 'required maxlength="120" placeholder="Chapter operating budget"')}${field("starts_on", "Budget year begins", "2026-07-01", "date", "required")}<p class="wide muted">Use separate budgets for operating finances and executive allocations when their expenses overlap.</p>` },
      (values, node) => { B.months(values.starts_on); return save("create", values, node, budgetId, null); });
  }
  function editHeader() {
    if (!manage()) return;
    form({ title: "Budget settings", body: `${field("name", "Budget name", data.budget.name, "text", 'required maxlength="120"')}<label>Status<select name="status">${["Draft", "Active", "Closed", "Archived"].map((s) => option(s, s, data.budget.status)).join("")}</select></label><p class="wide muted">Closed and archived budgets preserve history and cannot receive new entries until reopened.</p>` }, (v, f) => save("header", v, f));
  }
  function editLine(lineId) {
    if (!editable()) return;
    const line = data.lines.find((l) => l.id === lineId) || { id: id(), monthly_plan_cents: Array(12).fill(0), kind: "expense" };
    form({ title: lineId ? "Edit budget line" : "Add budget line", body: `${field("title", "Line item", line.title, "text", 'required maxlength="160"')}${field("category", "Category", line.category, "text", 'required maxlength="120"')}${field("owner_position", "Responsible position", line.owner_position, "text", 'maxlength="120" placeholder="VPMD, Treasurer, Recruitment…"')}<label>Type<select name="kind">${option("expense", "Expense allocation", line.kind)}${option("income", "Income plan", line.kind)}</select></label><div class="wide budget-month-inputs">${B.months(data.budget.starts_on).map((m, i) => field(`month_${i}`, m.label, (line.monthly_plan_cents[i] / 100).toFixed(2), "number", 'step="0.01" min="0" required')).join("")}</div><label>Status<select name="archived">${option("false", "Active", String(!!line.archived))}${option("true", "Archived", String(!!line.archived))}</select></label>` }, (v, f) => save("line", {
      id: line.id, title: v.title.trim(), category: v.category.trim(), owner_position: host.canonicalPosition ? host.canonicalPosition(v.owner_position) : v.owner_position.trim(), kind: v.kind, archived: v.archived === "true",
      monthly_plan_cents: Array.from({ length: 12 }, (_, i) => { const n = B.cents(v[`month_${i}`]); if (n < 0) throw new Error("Planned allocations cannot be negative."); return n; })
    }, f));
  }
  function editEntry(entryId) {
    if (!editable()) return;
    const entry = data.entries.find((e) => e.id === entryId) || { id: id() };
    const lines = data.lines.filter((l) => !l.archived);
    if (!lines.length) return host.toast("Add a budget line before recording activity.");
    form({ title: entryId ? "Correct financial activity" : "Record income or expense", body: `<label class="wide">Budget line<select name="line_id" required>${lines.map((l) => option(l.id, `${l.kind === "income" ? "Income" : "Expense"} · ${l.title}`, entry.line_id)).join("")}</select></label>${field("transaction_date", "Transaction date", entry.transaction_date || new Date().toISOString().slice(0, 10), "date", "required")}${field("amount", "Amount (USD)", entry.amount_cents === undefined ? "" : (entry.amount_cents / 100).toFixed(2), "number", 'step="0.01" required')}<p class="wide muted">Positive amounts record income received or expenses paid. Use negative amounts for reversals or refunds on the same line. Record each receipt or payment once; member dues balances are not automatically counted as cash received.</p>${field("description", "Description", entry.description, "text", 'required maxlength="500"')}${field("vendor", "Payee / source", entry.vendor, "text", 'maxlength="160"')}<label class="wide">Private finance notes<textarea name="private_notes" maxlength="4000">${esc(entry.private_notes)}</textarea></label>${entryId ? field("reason", "Correction reason", "", "text", 'required minlength="3"') : ""}` }, (v, f) => save("entry", { ...v, id: entry.id, amount_cents: B.cents(v.amount) }, f));
  }
  function voidEntry(entryId) {
    if (!editable()) return;
    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry || entry.voided_at) return;
    form({ title: "Void financial activity", submit: "Confirm void", body: `<p class="wide">Void ${esc(entry.description)} (${B.amount(entry.amount_cents)})? It will no longer affect totals, but its history will remain available.</p>${field("reason", "Reason", "", "text", 'required minlength="3"')}` }, (v, f) => save("void", { id: entryId, reason: v.reason }, f));
  }
  function render() {
    if (!permitted()) return `<section class="panel empty-state"><h3>Access restricted</h3><p>Annual budgets are limited to authorized finance users and advisors.</p></section>`;
    if (!loaded && !loading) queueMicrotask(() => load());
    const header = `<div class="budget-page-head"><div><h2>Annual Budget</h2><p class="muted">Executive allocations and chapter finances throughout the year.</p></div><div class="button-row">${host.can("budget.manage") ? '<button class="primary" data-budget-create>Create budget</button>' : ""}<button class="ghost" data-budget-refresh>Refresh</button></div></div>`;
    if (loading) return `${header}<section class="panel" role="status">Loading annual budgets…</section>`;
    if (error) return `${header}<section class="panel error-notice" role="alert"><h3>Budget unavailable</h3><p>${esc(error)}</p><button class="ghost" data-budget-refresh>Retry</button></section>`;
    if (!data.budgets.length) return `${header}<section class="panel empty-state"><h3>No annual budgets yet</h3><p>Create a budget for the year, then add monthly allocations or import your workbook transfer.</p>${host.can("budget.manage") ? '<button class="primary" data-budget-create>Create budget</button>' : ""}</section>`;
    const budget = data.budget;
    if (!budget) return header;
    if (alumni) return renderAlumni();
    const s = summary();
    return `${header}<section class="panel budget-workspace">
      <div class="budget-toolbar"><label>Budget<select id="annualBudgetSelect">${data.budgets.map((b) => option(b.id, `${b.name} · ${b.starts_on.slice(0, 4)}–${Number(b.starts_on.slice(0, 4)) + 1} · ${b.status}`, selected)).join("")}</select></label><label>Actuals through<select id="budgetThrough">${B.months(budget.starts_on).map((m, i) => option(i, m.label, through)).join("")}</select></label><div class="button-row"><button class="ghost" data-budget-alumni>Alumni meeting view</button><button class="ghost" data-budget-export>Export summary</button>${manage() ? '<button class="ghost" data-budget-settings>Settings</button><button class="ghost" data-budget-import>Import budget</button>' : ""}</div></div>
      ${lastMessage ? `<p class="budget-feedback" role="status">${esc(lastMessage)}</p>` : ""}
      <div class="budget-stats">${card("Annual expense budget", s.expensePlan)}${card("Expenses to date", s.expenseActual)}${card("Unspent allocation", s.remaining)}${card("Income received", s.incomeActual)}${card("Net activity", s.netActual)}</div>
      <div class="budget-tabs" aria-label="Budget views">${[["plan", "Budget vs actual"], ["monthly", "Monthly overview"], ...(data.can_manage ? [["activity", "Financial activity"]] : [])].map(([t, label]) => `<button class="${tab === t ? "primary" : "ghost"}" data-budget-tab="${t}" aria-pressed="${tab === t}">${label}</button>`).join("")}</div>
      <div class="budget-toolbar"><label>Search line items<input id="budgetQuery" type="search" value="${esc(query)}" placeholder="Category, position, or line item"></label>${manage() && !["Closed", "Archived"].includes(budget.status) ? '<div class="button-row"><button class="ghost" data-budget-line>Add budget line</button><button class="primary" data-budget-entry>Record activity</button></div>' : ""}</div>
      ${tab === "activity" && data.can_manage ? renderActivity() : tab === "monthly" ? monthlyTable() : planTable()}
      <p class="budget-footnote">${esc(budget.status)} · Updated ${esc(new Date(budget.updated_at).toLocaleString())}. Unspent allocation is not a bank balance. Separate budgets are not consolidated.</p>
    </section>`;
  }
  function filteredLines() {
    return data.lines.filter((l) => !query || `${l.title} ${l.category} ${l.owner_position}`.toLowerCase().includes(query.toLowerCase()));
  }
  function table(headers, rows) {
    return `<div class="table-wrap budget-table"><table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v, i) => `<td data-label="${esc(headers[i])}">${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function planTable() {
    const lines = filteredLines();
    if (!lines.length) return `<div class="empty-state"><h3>${data.lines.length ? "No matching line items" : "No allocations yet"}</h3><p>${data.lines.length ? "Try a different search." : "Add a budget line or import monthly allocations."}</p></div>`;
    return table(["Line item", "Category", "Position", "Annual plan", "Plan to date", "Actual to date", "Variance", "Actions"], lines.map((l) => {
      const s = B.summarize([l], through); const p = l.kind === "income" ? "income" : "expense";
      const variance = s[`${p}Variance`];
      return [`<strong>${esc(l.title)}</strong><small>${esc(l.kind)}${l.archived ? " · Archived" : ""}</small>`, esc(l.category), esc(l.owner_position || "—"), B.amount(s[`${p}Plan`]), B.amount(s[`${p}YtdPlan`]), B.amount(s[`${p}Actual`]), `<span class="${variance < 0 ? "budget-over" : ""}">${B.amount(variance)}<small>${variance < 0 ? "Unfavorable" : "Favorable / on budget"}</small></span>`, editable() ? `<button class="small ghost" data-budget-line="${l.id}" aria-label="Edit ${esc(l.title)}">Edit</button>` : "—"];
    }));
  }
  function monthlyTable() {
    const lines = filteredLines();
    return table(["Month", "Planned income", "Income received", "Planned expenses", "Expenses paid", "Net activity"], B.months(data.budget.starts_on).map((m, i) => {
      const totals = (kind, key) => lines.filter((l) => l.kind === kind).reduce((n, l) => n + Number(l[key]?.[i] || 0), 0);
      const income = totals("income", "actual_cents"), expense = totals("expense", "actual_cents");
      return [esc(m.label), B.amount(totals("income", "monthly_plan_cents")), i <= through ? B.amount(income) : "—", B.amount(totals("expense", "monthly_plan_cents")), i <= through ? B.amount(expense) : "—", i <= through ? B.amount(income - expense) : "—"];
    }));
  }
  function renderActivity() {
    const lineIds = new Set(filteredLines().map((l) => l.id));
    const entries = data.entries.filter((e) => lineIds.has(e.line_id));
    if (!entries.length) return `<div class="empty-state"><h3>No financial activity</h3><p>Record an expense or income receipt against a budget line.</p></div>`;
    return table(["Date", "Budget line", "Description", "Amount", "Status", "Actions"], entries.map((e) => [esc(e.transaction_date), esc(lineFor(e)?.title), esc(e.description), B.amount(e.amount_cents), e.voided_at ? "Voided" : "Recorded", editable() && !e.voided_at ? `<div class="row-actions"><button class="small ghost" data-budget-entry="${e.id}">Correct</button><button class="small danger" data-budget-void="${e.id}">Void</button></div>` : "—"]));
  }
  function alumniGroups() {
    const groups = new Map();
    data.lines.forEach((l) => { const key = `${l.kind}:${l.category}`; if (!groups.has(key)) groups.set(key, { kind: l.kind, category: l.category, lines: [] }); groups.get(key).lines.push(l); });
    return [...groups.values()];
  }
  function renderAlumni() {
    const s = summary(), month = B.months(data.budget.starts_on)[through];
    return `<section class="budget-alumni-report"><div class="budget-report-actions button-row"><button class="ghost" data-budget-alumni-exit>Back to budget</button><button class="primary" data-budget-print>Print / Save PDF</button><button class="ghost" data-budget-export>Export summary</button></div><header class="budget-report-head"><p>AO Command · Alumni meeting report</p><h1>Alpha Omega Chapter</h1><p>Pi Kappa Alpha · Kansas State University</p><h2>${esc(data.budget.name)}</h2><p>July–June reporting year · Actuals through ${esc(month.label)} · ${esc(data.budget.status)}</p></header><div class="budget-stats">${card("Annual expense plan", s.expensePlan)}${card("Expenses through period", s.expenseActual)}${card("Income through period", s.incomeActual)}${card("Net activity", s.netActual)}</div><section class="budget-report-section"><h2>Budget by category</h2>${table(["Category", "Type", "Annual plan", "Plan to date", "Actual to date", "Variance"], alumniGroups().map((g) => { const t = B.summarize(g.lines, through); return [esc(g.category), esc(g.kind), B.amount(t[`${g.kind}Plan`]), B.amount(t[`${g.kind}YtdPlan`]), B.amount(t[`${g.kind}Actual`]), B.amount(t[`${g.kind}Variance`])]; }))}</section><section class="budget-report-section"><h2>Monthly financial activity</h2>${monthlyTable()}</section><section class="budget-report-section"><h2>Meeting discussion</h2><p>Unspent expense allocation: <strong>${B.amount(s.remaining)}</strong>. Expense variance through ${esc(month.label)}: <strong>${B.amount(s.expenseVariance)}</strong>.</p><p>Net activity reflects recorded income less recorded expenses, not a reconciled bank balance. Future periods are not presented as completed actuals.</p></section><footer>Prepared ${esc(new Date().toLocaleDateString())} · Chapter financial summary · Member and transaction details omitted</footer></section>`;
  }
  function exportSummary() {
    if (!permitted() || !data.budget) return;
    const rows = [["budget", "period_through", "category", "type", "annual_plan", "plan_to_date", "actual_to_date", "variance"]];
    alumniGroups().forEach((g) => { const s = B.summarize(g.lines, through); rows.push([data.budget.name, B.months(data.budget.starts_on)[through].key, g.category, g.kind, ...["Plan", "YtdPlan", "Actual", "Variance"].map((k) => (s[`${g.kind}${k}`] / 100).toFixed(2))]); });
    host.download("ao-command-budget-summary.csv", B.csv(rows), "text/csv;charset=utf-8");
  }
  function importForm() {
    if (!editable()) return host.toast("Reopen this budget in Settings before importing.");
    host.openModal('<h3>Import annual budget</h3><p>Choose an AO Command budget transfer (.json). Review the preview before saving. Re-imported source lines are skipped; existing edits are preserved.</p><label>Transfer file<input type="file" id="annualBudgetFile" accept=".json,application/json"></label><p role="alert" id="budgetImportError"></p><div id="budgetImportPreview"></div><button class="ghost" data-close-modal>Cancel</button>');
    document.getElementById("annualBudgetFile").addEventListener("change", async (ev) => {
      try {
        const file = ev.target.files[0]; if (!file) return;
        if (file.size > 1000000) throw new Error("Use a transfer file smaller than 1 MB.");
        importDocument = B.validateImport(JSON.parse(await file.text()));
        showImportPreview(0);
      } catch (e) { document.getElementById("budgetImportError").textContent = fail(e); }
    });
  }
  function showImportPreview(index) {
    const source = importDocument.budgets[index];
    const existingKeys = new Set(data.lines.map((l) => l.source_key));
    const newLines = source.lines.filter((l) => !existingKeys.has(l.source_key));
    const preview = document.getElementById("budgetImportPreview");
    const sourceTotals = B.summarize(source.lines, 3);
    preview.innerHTML = `<label>Source budget<select id="budgetSource">${importDocument.budgets.map((b, i) => option(i, b.name, index)).join("")}</select></label><p>${esc(source.lines.length)} source lines · ${newLines.length} new · ${source.lines.length - newLines.length} already imported</p><p>Source period: ${esc(source.starts_on)}. Destination: ${esc(data.budget.name)} (${esc(data.budget.starts_on)}).</p>${source.starts_on !== data.budget.starts_on ? '<p role="alert">The budget years do not match. Create a budget with the correct start date first.</p>' : ""}<div class="budget-stats">${card("Expense plan", sourceTotals.expensePlan)}${card("Income plan", sourceTotals.incomePlan)}</div><p>Monthly actuals are opening summaries, not individual bank transactions. Do not import bank activity for the same months again.</p>${(source.warnings || []).map((w) => `<p class="budget-import-warning">${esc(w)}</p>`).join("")}<div class="budget-preview-scroll">${table(["Line item", "Type", "Position", "Annual plan"], source.lines.map((l) => [esc(l.title), esc(l.kind), esc(l.owner_position || "—"), B.amount(l.monthly_plan_cents.reduce((a, b) => a + b, 0))]))}</div><form id="budgetImportConfirm">${source.lines.some((l) => l.actual_cents?.some((v) => v !== null)) ? '<label><input type="checkbox" name="include_actuals"> Include the source opening monthly actuals (reviewed and reconciled).</label>' : ""}<label><input type="checkbox" name="confirm" required> I have reviewed the source period, totals, and import warnings.</label><p data-budget-form-status role="status"></p><button class="primary" type="submit" ${source.starts_on !== data.budget.starts_on || !newLines.length ? "disabled" : ""}>Import ${newLines.length} new lines</button></form>`;
    preview.querySelector("#budgetSource").addEventListener("change", (e) => showImportPreview(Number(e.target.value)));
    preview.querySelector("#budgetImportConfirm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const count = newLines.length;
      const includeActuals = new FormData(e.currentTarget).get("include_actuals") === "on";
      const lines = source.lines.map((l) => { const copy = { ...l }; if (!includeActuals) delete copy.actual_cents; return copy; });
      if (await save("import", { lines }, e.currentTarget)) { lastMessage = `Imported ${count} new lines. Skipped ${source.lines.length - count} existing lines. ${includeActuals ? "Opening actuals included." : "No opening actuals imported."} All changes saved.`; host.render(); }
    });
  }
  function bind(node) {
    if (!host) return;
    const on = (selector, fn) => node.querySelectorAll(selector).forEach((el) => el.addEventListener("click", () => fn(el)));
    on("[data-budget-create]", create);
    on("[data-budget-refresh]", () => load());
    on("[data-budget-settings]", editHeader);
    on("[data-budget-line]", (el) => editLine(el.dataset.budgetLine));
    on("[data-budget-entry]", (el) => editEntry(el.dataset.budgetEntry));
    on("[data-budget-void]", (el) => voidEntry(el.dataset.budgetVoid));
    on("[data-budget-import]", importForm);
    on("[data-budget-tab]", (el) => { tab = el.dataset.budgetTab; host.render(); });
    on("[data-budget-export]", exportSummary);
    on("[data-budget-alumni]", () => { alumni = true; query = ""; document.body.classList.add("budget-alumni-mode"); host.render(); });
    on("[data-budget-alumni-exit]", () => { alumni = false; document.body.classList.remove("budget-alumni-mode"); host.render(); });
    on("[data-budget-print]", () => window.print());
    node.querySelector("#annualBudgetSelect")?.addEventListener("change", (e) => { selected = e.target.value; query = ""; load(); });
    node.querySelector("#budgetThrough")?.addEventListener("change", (e) => { through = Number(e.target.value); host.render(); });
    node.querySelector("#budgetQuery")?.addEventListener("input", (e) => { const start = e.target.selectionStart; query = e.target.value; host.render(); const input = document.getElementById("budgetQuery"); input.focus(); input.setSelectionRange(start, start); });
  }
  function leave() { alumni = false; document.body.classList.remove("budget-alumni-mode"); }
  root.AOCommandBudgetUI = Object.freeze({ configure: (adapter) => { host = adapter; }, render, bind, reset, leave });
})(globalThis);
