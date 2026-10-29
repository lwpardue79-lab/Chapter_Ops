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

  root.AOCommandRuntime = Object.freeze({ createSaveQueue, withBusyForm });
})(globalThis);
