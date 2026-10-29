import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs/promises";

const runtimeSource = await fs.readFile(new URL("../ao-command-web/runtime.js", import.meta.url), "utf8");
const appSource = await fs.readFile(new URL("../ao-command-web/app.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(runtimeSource, context);
const { createSaveQueue, withBusyForm } = context.AOCommandRuntime;

test("save queue preserves submission order and recovers after a rejected write", async () => {
  const queue = createSaveQueue();
  const events = [];
  let release;
  const first = queue(async () => { events.push("first-start"); await new Promise((resolve) => { release = resolve; }); events.push("first-done"); });
  const second = queue(async () => { events.push("second"); throw new Error("permission denied"); });
  const rejection = assert.rejects(second, /permission denied/);
  const third = queue(async () => events.push("third"));
  await Promise.resolve();
  assert.deepEqual(events, ["first-start"]);
  release();
  await Promise.all([first, rejection, third]);
  assert.deepEqual(events, ["first-start", "first-done", "second", "third"]);
});

test("form helper blocks duplicate submission and restores buttons on error", async () => {
  const button = { disabled: false, textContent: "Save" };
  const form = { dataset: {}, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [button] };
  let release;
  let calls = 0;
  const operation = withBusyForm(form, async () => { calls++; await new Promise((resolve) => { release = resolve; }); throw new Error("offline"); });
  const rejection = assert.rejects(operation, /offline/);
  await withBusyForm(form, () => { calls++; });
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  release();
  await rejection;
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Save");
  assert.equal(form.dataset.saving, undefined);
});

function saveRowHarness(saveResult) {
  const events = [];
  const scope = vm.createContext({
    cloud: { user: { id: "authorized-user" } }, state: { tasks: [], activity: [] }, historyStack: [],
    actionAllowed: () => true, validateRow: () => "", uid: () => "task-id", labelize: (value) => value,
    snapshot: () => scope.historyStack.push("previous"), recalcMemberDues() {},
    syncCloudWorkspace: async () => { events.push("database-response"); return saveResult; },
    save: () => events.push("cache"), closeModal: () => events.push("close"), render: () => events.push("render"), toast: () => events.push("toast")
  });
  vm.runInContext(appSource.slice(appSource.indexOf("async function saveRow("), appSource.indexOf("function validateRow(")), scope);
  return { scope, events };
}

test("failed record write rolls back data and keeps the entered form open", async () => {
  const { scope, events } = saveRowHarness(false);
  await scope.saveRow("tasks", { title: "Real task" });
  assert.equal(scope.state.tasks.length, 0);
  assert.equal(scope.historyStack.length, 0);
  assert.deepEqual(events, ["database-response"]);
});

test("record form closes only after database confirmation", async () => {
  const { scope, events } = saveRowHarness(true);
  await scope.saveRow("tasks", { title: "Real task" });
  assert.equal(scope.state.tasks.length, 1);
  assert.deepEqual(events, ["database-response", "cache", "close", "render", "toast"]);
});

test("unauthenticated record write never reaches the database", async () => {
  const { scope, events } = saveRowHarness(true);
  scope.cloud.user = null;
  await scope.saveRow("tasks", { title: "Blocked" });
  assert.equal(scope.state.tasks.length, 0);
  assert.deepEqual(events, ["toast"]);
});

test("auth listener releases callback before doing database bootstrap", async () => {
  let callback;
  let bootstraps = 0;
  const timers = [];
  const scope = vm.createContext({
    cloud: {}, authReady: false, authRefreshTimer: undefined,
    window: { AO_COMMAND_CONFIG: { supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "public-key" },
      supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: (fn) => { callback = fn; } } }) },
      setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {} },
    bootstrapUser: async () => { bootstraps++; }, resetSensitiveClientState() {}, updateCloudUi() {}, render() {},
    openNewPasswordModal() {}, logSupabaseError() {}, setConnectionStatus() {}
  });
  vm.runInContext(appSource.slice(appSource.indexOf("async function initCloud("), appSource.indexOf("function setConnectionStatus(")), scope);
  await scope.initCloud();
  assert.equal(callback("SIGNED_IN", { user: { id: "user" } }), undefined);
  assert.equal(bootstraps, 0);
  await timers[0]();
  assert.equal(bootstraps, 1);
  callback("TOKEN_REFRESHED", { user: { id: "user" } });
  assert.equal(timers.length, 1);
});
