/* Annual budget calculations. Amounts are integer cents; no member billing data. */
(function (root) {
  "use strict";
  const cents = (value) => {
    const text = String(value ?? "").trim().replace(/[$,]/g, "").replace(/^\((.*)\)$/, "-$1");
    if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error("Enter a dollar amount with at most two decimal places.");
    const n = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(n) || Math.abs(n) > 100000000000) throw new Error("Amount is outside the supported range.");
    return n;
  };
  const amount = (n) => (Number(n) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const months = (start) => {
    if (!/^\d{4}-\d{2}-01$/.test(start)) throw new Error("Choose the first day of the budget year.");
    const [year, month] = start.split("-").map(Number);
    if (month < 1 || month > 12) throw new Error("Invalid budget month.");
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(year, month - 1 + i, 1));
      return { key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) };
    });
  };
  function summarize(lines = [], through = 11) {
    const sum = (a, count = 12) => (a || []).slice(0, count).reduce((n, v) => n + Number(v || 0), 0);
    const result = { incomePlan: 0, expensePlan: 0, incomeActual: 0, expenseActual: 0, incomeYtdPlan: 0, expenseYtdPlan: 0 };
    lines.forEach((l) => {
      const prefix = l.kind === "income" ? "income" : "expense";
      result[`${prefix}Plan`] += sum(l.monthly_plan_cents);
      result[`${prefix}YtdPlan`] += sum(l.monthly_plan_cents, through + 1);
      result[`${prefix}Actual`] += sum(l.actual_cents, through + 1);
    });
    return { ...result, remaining: result.expensePlan - result.expenseActual, netPlan: result.incomePlan - result.expensePlan,
      netActual: result.incomeActual - result.expenseActual, expenseVariance: result.expenseYtdPlan - result.expenseActual,
      incomeVariance: result.incomeActual - result.incomeYtdPlan };
  }
  function validateImport(document) {
    if (document?.format !== "ao-command-budget-v1" || !Array.isArray(document.budgets) || !document.budgets.length) throw new Error("Choose an AO Command budget transfer file.");
    if (document.budgets.length > 10) throw new Error("Import at most ten budgets at a time.");
    for (const budget of document.budgets) {
      months(budget.starts_on);
      if (!budget.name?.trim() || !Array.isArray(budget.lines) || !budget.lines.length || budget.lines.length > 200) throw new Error("Each budget needs a name and 1–200 line items.");
      const keys = new Set();
      for (const line of budget.lines) {
        if (!line.title?.trim() || !["income", "expense"].includes(line.kind) || !line.source_key || keys.has(line.source_key)) throw new Error("A line has a missing title, invalid type, or duplicate source key.");
        keys.add(line.source_key);
        if (!Array.isArray(line.monthly_plan_cents) || line.monthly_plan_cents.length !== 12 || line.monthly_plan_cents.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 100000000000)) throw new Error(`Invalid monthly plan for ${line.title}.`);
        if (line.actual_cents && (line.actual_cents.length !== 12 || line.actual_cents.some((n) => n !== null && (!Number.isSafeInteger(n) || Math.abs(n) > 100000000000)))) throw new Error(`Invalid actuals for ${line.title}.`);
      }
    }
    return document;
  }
  const csv = (rows) => rows.map((row) => row.map((v) => {
    let text = String(v ?? "");
    if (/^[=+@\t\r]/.test(text) || /^-[^\d]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  root.AOCommandBudget = Object.freeze({ cents, amount, months, summarize, validateImport, csv });
})(globalThis);
