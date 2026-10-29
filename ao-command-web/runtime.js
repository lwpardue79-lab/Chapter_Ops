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
    // Always advance the token, including two writes within a millisecond.
    const updatedAt = new Date(Math.max(Date.now(), (Date.parse(version.updatedAt) || 0) + 1)).toISOString();
    const patch = { data: payload, updated_by: userId, updated_at: updatedAt };
    let query;
    if (version.exists) {
      query = client.from("workspace_state").update(patch).eq("organization_id", organizationId);
      query = version.updatedAt == null ? query.is("updated_at", null) : query.eq("updated_at", version.updatedAt);
    } else {
      // A competing initial save must fail, rather than replacing its data.
      query = client.from("workspace_state").insert({ organization_id: organizationId, ...patch });
    }
    const { data, error } = await query.select("organization_id,updated_at").maybeSingle();
    if (error?.code === "23505") throw workspaceConflict();
    if (error) throw error;
    if (!data?.updated_at) throw workspaceConflict();
    return { organizationId: data.organization_id, updatedAt: data.updated_at, exists: true };
  }

  root.AOCommandRuntime = Object.freeze({ createSaveQueue, withBusyForm, saveWorkspaceVersion });
})(globalThis);
