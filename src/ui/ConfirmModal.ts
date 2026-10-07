import { App, Modal } from "obsidian";

/** Ask a yes/no question. Resolves false on cancel or Esc. */
export function confirm(
  app: App,
  title: string,
  message: string,
  okLabel: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, title, message, okLabel, resolve).open();
  });
}

class ConfirmModal extends Modal {
  private answered = false;

  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly okLabel: string,
    private readonly resolve: (ok: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.createEl("p", { text: this.message });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const ok = buttons.createEl("button", { text: this.okLabel, cls: "mod-cta" });
    ok.addEventListener("click", () => {
      this.answered = true;
      this.resolve(true);
      this.close();
    });
    ok.focus();
  }

  onClose(): void {
    if (!this.answered) this.resolve(false);
    this.contentEl.empty();
  }
}
