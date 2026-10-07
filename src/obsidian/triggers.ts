import { MarkdownView, type Plugin } from "obsidian";

const ICON = "printer";
const TITLE = "Print / export";

/**
 * Header icon on every Markdown view (SPEC 3.7). Re-attached on layout-change and file-open,
 * never duplicated, and removed on unload or when the setting is turned off.
 */
export class HeaderActions {
  private readonly actions = new Map<MarkdownView, HTMLElement>();

  constructor(
    private readonly plugin: Plugin,
    private readonly enabled: () => boolean,
    private readonly onClick: (view: MarkdownView, evt: MouseEvent) => void,
  ) {}

  refresh(): void {
    for (const [view, el] of this.actions) {
      if (!el.isConnected || !this.enabled()) {
        el.remove();
        this.actions.delete(view);
      }
    }
    if (!this.enabled()) return;
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || this.actions.has(view)) continue;
      const el = view.addAction(ICON, TITLE, (evt) => this.onClick(view, evt));
      this.actions.set(view, el);
    }
  }

  removeAll(): void {
    for (const el of this.actions.values()) el.remove();
    this.actions.clear();
  }
}
