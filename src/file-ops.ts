// ── File Operations ─────────────────────────────────────────
// New / Open / Save / Export / Autosave

import { renderHTML, renderPrint } from "@intenttext/core";
import { SyncEngine } from "./sync-engine";
import type { TabManager } from "./tab-manager";
import type { BlockEditor } from "./block-editor";

const AUTOSAVE_KEY = "intenttext-editor-autosave";
const AUTOSAVE_INTERVAL = 30_000; // 30 seconds

const STARTER_TEMPLATE = `title: Untitled Document

note: `;

export class FileOps {
  private sync: SyncEngine;
  private tabManager: TabManager;
  private blockEditor: BlockEditor | null = null;

  constructor(sync: SyncEngine, tabManager: TabManager) {
    this.sync = sync;
    this.tabManager = tabManager;
    this.bindEvents();
    this.startAutosave();
    this.checkRestore();
  }

  /** Set the block editor reference (for unsaved indicator) */
  setBlockEditor(editor: BlockEditor): void {
    this.blockEditor = editor;
  }

  private bindEvents(): void {
    document
      .getElementById("btn-new")
      ?.addEventListener("click", () => this.newDocument());
    document
      .getElementById("btn-open")
      ?.addEventListener("click", () => this.openFile());
    document
      .getElementById("btn-save")
      ?.addEventListener("click", () => this.saveFile());

    // Export menu
    document.getElementById("export-menu")?.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(
        "[data-export]",
      ) as HTMLElement;
      if (item) this.handleExport(item.dataset.export!);
    });

    // Keyboard shortcut: Ctrl+S
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        this.saveFile();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        this.newDocument();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        this.openFile();
      }
    });

    // Save on tab switch
    this.sync.onChange(() => this.scheduleSave());
  }

  // ── New Document ──────────────────────────────────────────

  newDocument(): void {
    this.sync.setSource(STARTER_TEMPLATE);
    this.tabManager.switchTab("edit");
  }

  // ── Open File ─────────────────────────────────────────────

  async openFile(): Promise<void> {
    if ("showOpenFilePicker" in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: "IntentText files",
              accept: { "text/plain": [".it", ".txt"] },
            },
            {
              description: "JSON files",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const file = await handle.getFile();
        const text = await file.text();
        this.loadContent(text, file.name);
        return;
      } catch {
        return;
      }
    }

    // Fallback: file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".it,.txt,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const text = await file.text();
        this.loadContent(text, file.name);
      }
    };
    input.click();
  }

  private loadContent(text: string, filename: string): void {
    // Check if it's JSON
    if (filename.endsWith(".json")) {
      try {
        const data = JSON.parse(text);
        if (data.blocks) {
          // Convert IntentText JSON back to .it source
          const source = this.documentToSource(data);
          this.sync.setSource(source);
          this.tabManager.switchTab("edit");
          return;
        }
      } catch {
        // Not valid JSON, treat as text
      }
    }

    this.sync.setSource(text);
    this.tabManager.switchTab("edit");
  }

  /** Convert an IntentText document JSON back to .it source */
  private documentToSource(doc: {
    blocks: Array<{
      type: string;
      content?: string;
      properties?: Record<string, unknown>;
    }>;
  }): string {
    const lines: string[] = [];
    for (const block of doc.blocks) {
      if (block.type === "divider") {
        lines.push("---");
        continue;
      }

      let line = `${block.type}: ${block.content ?? ""}`;
      const props = block.properties;
      if (props && Object.keys(props).length > 0) {
        const pipeParts = Object.entries(props)
          .filter(([, v]) => v != null && String(v).trim())
          .map(([k, v]) => `${k}: ${v}`);
        if (pipeParts.length > 0) {
          line += " | " + pipeParts.join(" | ");
        }
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  // ── Save File ─────────────────────────────────────────────

  async saveFile(): Promise<void> {
    const source = this.sync.getSource();
    const filename = this.getFilename();

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "IntentText file",
              accept: { "text/plain": [".it"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(source);
        await writable.close();
        this.showStatus("File saved");
        this.blockEditor?.markSaved();
        return;
      } catch {
        return;
      }
    }

    this.downloadFile(source, filename, "text/plain");
    this.showStatus("Downloaded");
    this.blockEditor?.markSaved();
  }

  // ── Export ────────────────────────────────────────────────

  private handleExport(format: string): void {
    const source = this.sync.getSource();
    if (!source.trim()) return;
    const doc = this.sync.getDocument();
    const filename = this.getFilename();

    switch (format) {
      case "it":
        this.downloadFile(source, filename, "text/plain");
        break;
      case "json":
        this.downloadFile(
          JSON.stringify(doc, null, 2),
          filename.replace(".it", ".json"),
          "application/json",
        );
        break;
      case "html":
        this.downloadFile(
          renderHTML(doc),
          filename.replace(".it", ".html"),
          "text/html",
        );
        break;
      case "print":
        this.downloadFile(
          renderPrint(doc),
          filename.replace(".it", "-print.html"),
          "text/html",
        );
        break;
      case "copy-it":
        navigator.clipboard
          .writeText(source)
          .then(() => this.showStatus("Copied .it"));
        break;
      case "copy-json":
        navigator.clipboard
          .writeText(JSON.stringify(doc, null, 2))
          .then(() => this.showStatus("Copied JSON"));
        break;
      case "pdf":
        window.print();
        break;
    }
  }

  // ── Autosave ──────────────────────────────────────────────

  private startAutosave(): void {
    window.setInterval(() => {
      this.doAutosave();
    }, AUTOSAVE_INTERVAL);
  }

  private scheduleSave(): void {
    // Also save on every change (debounced by sync engine)
    this.doAutosave();
  }

  private doAutosave(): void {
    try {
      const source = this.sync.getSource();
      if (!source.trim()) return;
      localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          source,
          timestamp: Date.now(),
        }),
      );
      this.showStatus("Auto-saved");
    } catch {
      // localStorage full or unavailable
    }
  }

  private checkRestore(): void {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (!saved) {
        // Load starter template
        this.sync.setSource(STARTER_TEMPLATE);
        return;
      }

      const data = JSON.parse(saved);
      if (!data.source || !data.timestamp) {
        this.sync.setSource(STARTER_TEMPLATE);
        return;
      }

      const age = Date.now() - data.timestamp;
      const ageText =
        age < 60_000
          ? "less than a minute ago"
          : age < 3_600_000
            ? `${Math.floor(age / 60_000)} minutes ago`
            : `${Math.floor(age / 3_600_000)} hours ago`;

      // Show restore banner
      const banner = document.getElementById("restore-banner")!;
      const ageEl = banner.querySelector(".restore-age");
      if (ageEl) ageEl.textContent = ageText;
      banner.classList.remove("hidden");

      banner.querySelector(".restore-yes")?.addEventListener("click", () => {
        this.sync.setSource(data.source);
        this.tabManager.switchTab("edit");
        banner.classList.add("hidden");
      });

      banner.querySelector(".restore-no")?.addEventListener("click", () => {
        localStorage.removeItem(AUTOSAVE_KEY);
        this.sync.setSource(STARTER_TEMPLATE);
        banner.classList.add("hidden");
      });
    } catch {
      this.sync.setSource(STARTER_TEMPLATE);
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private getFilename(): string {
    const doc = this.sync.getDocument();
    const titleBlock = doc.blocks.find((b) => b.type === "title");
    if (titleBlock?.content) {
      return (
        titleBlock.content
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/-+$/, "") + ".it"
      );
    }
    return "document.it";
  }

  private downloadFile(
    content: string,
    filename: string,
    mimeType: string,
  ): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private showStatus(msg: string): void {
    const el = document.getElementById("status-message");
    if (el) {
      el.textContent = msg;
      setTimeout(() => {
        el.textContent = "";
      }, 2000);
    }
  }
}
