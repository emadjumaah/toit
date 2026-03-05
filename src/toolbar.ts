// ── Toolbar ─────────────────────────────────────────────────
// Selection toolbar (floating on text select) + fixed block toolbar.

import { SyncEngine } from "./sync-engine";

export class Toolbar {
  private sync: SyncEngine;
  private floatingToolbar: HTMLElement;
  private fixedToolbar: HTMLElement;

  constructor(sync: SyncEngine) {
    this.sync = sync;

    // Create floating selection toolbar
    this.floatingToolbar = document.createElement("div");
    this.floatingToolbar.className = "it-floating-toolbar hidden";
    this.floatingToolbar.innerHTML = `
      <button class="it-ftb-btn" data-format="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
      <button class="it-ftb-btn" data-format="italic" title="Italic (Ctrl+I)"><em>I</em></button>
      <button class="it-ftb-btn" data-format="strike" title="Strikethrough">~</button>
      <button class="it-ftb-btn" data-format="highlight" title="Highlight">^</button>
      <button class="it-ftb-btn" data-format="link" title="Link (Ctrl+K)">🔗</button>
      <button class="it-ftb-btn" data-format="clear" title="Clear formatting">✕</button>
    `;
    document.body.appendChild(this.floatingToolbar);

    // Bind to the fixed toolbar in the DOM
    this.fixedToolbar = document.getElementById("block-toolbar")!;

    this.bindEvents();
  }

  destroy(): void {
    this.floatingToolbar.remove();
    document.removeEventListener("selectionchange", this.onSelectionChange);
  }

  private bindEvents(): void {
    // Floating toolbar buttons
    this.floatingToolbar.addEventListener("mousedown", (e) => {
      e.preventDefault(); // Preserve selection
      const btn = (e.target as HTMLElement).closest(
        ".it-ftb-btn",
      ) as HTMLElement;
      if (!btn) return;
      const format = btn.dataset.format!;
      this.applyFormat(format);
    });

    // Fixed toolbar buttons
    if (this.fixedToolbar) {
      this.fixedToolbar.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest(
          "[data-action]",
        ) as HTMLElement;
        if (!btn) return;
        const action = btn.dataset.action!;
        this.handleBlockAction(action);
      });
    }

    // Show/hide floating toolbar on selection change
    this.onSelectionChange = this.onSelectionChange.bind(this);
    document.addEventListener("selectionchange", this.onSelectionChange);
  }

  private onSelectionChange(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      this.floatingToolbar.classList.add("hidden");
      return;
    }

    // Only show for content within the editor blocks
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer as HTMLElement;
    const block =
      container.nodeType === Node.ELEMENT_NODE
        ? (container as HTMLElement).closest(".it-block")
        : container.parentElement?.closest(".it-block");

    if (!block) {
      this.floatingToolbar.classList.add("hidden");
      return;
    }

    const rect = range.getBoundingClientRect();
    this.floatingToolbar.style.top = `${rect.top - 40}px`;
    this.floatingToolbar.style.left = `${rect.left + rect.width / 2 - 100}px`;
    this.floatingToolbar.classList.remove("hidden");
  }

  private applyFormat(format: string): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const text = sel.toString();
    if (!text) return;

    const range = sel.getRangeAt(0);
    const markers: Record<string, [string, string]> = {
      bold: ["*", "*"],
      italic: ["_", "_"],
      strike: ["~", "~"],
      highlight: ["^", "^"],
    };

    if (format === "link") {
      const url = prompt("URL:");
      if (!url) return;
      const wrapped = `[${text}](${url})`;
      range.deleteContents();
      range.insertNode(document.createTextNode(wrapped));
    } else if (format === "clear") {
      // Remove formatting markers
      const clean = text.replace(/[*_~^`]/g, "");
      range.deleteContents();
      range.insertNode(document.createTextNode(clean));
    } else if (markers[format]) {
      const [open, close] = markers[format];
      const wrapped = `${open}${text}${close}`;
      range.deleteContents();
      range.insertNode(document.createTextNode(wrapped));
    }

    this.floatingToolbar.classList.add("hidden");

    // Sync back to .it source
    const blockEl = range.startContainer.parentElement?.closest(
      ".it-block",
    ) as HTMLElement;
    if (blockEl) {
      const blockId = blockEl.dataset.blockId!;
      const contentEl = blockEl.querySelector(
        ".it-block__content",
      ) as HTMLElement;
      if (contentEl) {
        this.sync.updateBlockContent(blockId, contentEl.textContent ?? "");
      }
    }
  }

  private handleBlockAction(action: string): void {
    // Find the currently focused block
    const activeBlock = document.querySelector(
      ".it-block--active",
    ) as HTMLElement;
    if (!activeBlock) return;

    const blockId = activeBlock.dataset.blockId!;

    switch (action) {
      case "add-block":
        this.sync.insertBlockAfter(blockId, "note", "");
        break;
      case "move-up":
        this.sync.moveBlock(blockId, "up");
        break;
      case "move-down":
        this.sync.moveBlock(blockId, "down");
        break;
      case "delete-block":
        this.sync.deleteBlock(blockId);
        break;
    }
  }
}
