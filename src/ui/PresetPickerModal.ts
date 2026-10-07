import { App, FuzzySuggestModal, TFile } from "obsidian";

/** "Open print preset…": pick a preset file and open it for editing. */
export class PresetPickerModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly files: TFile[],
  ) {
    super(app);
    this.setPlaceholder("Open a print preset file");
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    void this.app.workspace.getLeaf(false).openFile(file);
  }
}
