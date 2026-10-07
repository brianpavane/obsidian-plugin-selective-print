import { App, Modal, Setting } from "obsidian";

/** Asks for a name; `validate` returns an error message or null. Resolves null on cancel. */
export function promptForName(
  app: App,
  title: string,
  validate: (name: string) => string | null,
): Promise<string | null> {
  return promptForText(app, { title, label: "Name", action: "Save", validate });
}

/** Asks for one line of text. Resolves null on cancel. */
export function promptForText(
  app: App,
  opts: {
    title: string;
    label: string;
    action: string;
    placeholder?: string;
    validate: (text: string) => string | null;
  },
): Promise<string | null> {
  return new Promise((resolve) => {
    new NamePromptModal(app, opts, resolve).open();
  });
}

class NamePromptModal extends Modal {
  private value = "";
  private done = false;

  constructor(
    app: App,
    private readonly opts: {
      title: string;
      label: string;
      action: string;
      placeholder?: string;
      validate: (text: string) => string | null;
    },
    private readonly resolve: (name: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.opts.title);
    const error = this.contentEl.createDiv({ cls: "selective-print-error" });
    let input: HTMLInputElement | null = null;
    new Setting(this.contentEl).setName(this.opts.label).addText((t) => {
      input = t.inputEl;
      if (this.opts.placeholder) t.setPlaceholder(this.opts.placeholder);
      t.onChange((v) => {
        this.value = v;
        error.setText("");
      });
    });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const save = buttons.createEl("button", { text: this.opts.action, cls: "mod-cta" });
    const submit = (): void => {
      const problem = this.opts.validate(this.value);
      if (problem) {
        error.setText(problem);
        return;
      }
      this.done = true;
      this.resolve(this.value.trim());
      this.close();
    };
    save.addEventListener("click", submit);
    this.scope.register([], "Enter", () => {
      submit();
      return false;
    });
    window.setTimeout(() => input?.focus(), 0);
  }

  onClose(): void {
    if (!this.done) this.resolve(null);
    this.contentEl.empty();
  }
}
