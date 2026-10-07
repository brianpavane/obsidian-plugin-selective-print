import { App, FuzzySuggestModal, TFolder } from "obsidian";

/** "Print a folder…": pick any folder in the vault. */
export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private readonly onPick: (folder: TFolder) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose a folder to print");
  }

  getItems(): TFolder[] {
    return this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
  }

  getItemText(folder: TFolder): string {
    return folder.isRoot() ? "/" : folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onPick(folder);
  }
}
