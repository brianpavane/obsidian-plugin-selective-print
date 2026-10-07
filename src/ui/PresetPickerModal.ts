import { App, FuzzySuggestModal, Notice, TFile } from "obsidian";
import { PLUGIN_NAME } from "../constants";

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
    this.app.workspace
      .getLeaf(false)
      .openFile(file)
      .catch((err: unknown) => {
        new Notice(
          `${PLUGIN_NAME}: could not open ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}
