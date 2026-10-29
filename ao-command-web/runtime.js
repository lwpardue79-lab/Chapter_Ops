/* Small browser helpers, also exercised by the Node regression suite. */
(function (root) {
  "use strict";
  function createSaveQueue() {
    let tail = Promise.resolve();
    return (operation) => {
      const result = tail.then(operation);
      tail = result.catch(() => {});
      return result;
    };
  }

  async function withBusyForm(form, operation) {
    if (form.dataset.saving === "true") return;
    form.dataset.saving = "true";
    form.setAttribute("aria-busy", "true");
    const buttons = [...form.querySelectorAll('button[type="submit"], button:not([type])')];
    const previous = buttons.map((button) => ({ button, disabled: button.disabled, text: button.textContent }));
    previous.forEach(({ button }) => { button.disabled = true; button.textContent = "Saving…"; });
    try {
      return await operation();
    } finally {
      delete form.dataset.saving;
      form.removeAttribute("aria-busy");
      previous.forEach(({ button, disabled, text }) => { button.disabled = disabled; button.textContent = text; });
    }
  }

  function workspaceConflict() {
    return Object.assign(new Error("Someone saved newer chapter data. Load the latest data before saving again."), { code: "WORKSPACE_CONFLICT" });
  }

  async function saveWorkspaceVersion(client, { organizationId, userId, payload, version }) {
    if (!version || version.organizationId !== organizationId) throw new Error("Reload chapter data before saving.");
    if (!userId || !version.updatedAt || !Array.isArray(version.writableKeys)) throw new Error("Reload chapter data before saving.");
    const changes = {};
    for (const key of version.writableKeys) {
      if (Object.hasOwn(payload, key) && JSON.stringify(payload[key]) !== JSON.stringify(version.baseline?.[key])) changes[key] = payload[key];
    }
    // The server derives the actor, checks every changed module, locks the row,
    // checks this version, and supplies the timestamp. Hidden modules stay there.
    const { data, error } = await client.rpc("save_chapter_workspace", {
      p_organization_id: organizationId,
      p_expected_updated_at: version.updatedAt,
      p_changes: changes
    });
    if (error?.code === "PT409") throw workspaceConflict();
    if (error) throw error;
    if (!data?.updated_at) throw workspaceConflict();
    return { organizationId: data.organization_id, updatedAt: data.updated_at, exists: true, writableKeys: data.writable_keys, baseline: data.data };
  }

  root.AOCommandRuntime = Object.freeze({ createSaveQueue, withBusyForm, saveWorkspaceVersion });
})(globalThis);
