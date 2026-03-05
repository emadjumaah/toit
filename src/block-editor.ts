// ── Block Editor ────────────────────────────────────────────
// The WYSIWYG block editor: renders blocks as contenteditable divs.

import type { IntentBlock } from "@intenttext/core";
import { SyncEngine } from "./sync-engine";
import {
  renderBlockElement,
  renderDocSettingsBar,
  isDocumentSetting,
} from "./block-renderer";
import { PropertyPanel } from "./property-panel";
import { REQUIRES_PROPERTIES } from "./block-schemas";
import { SlashMenu } from "./slash-menu";

export class BlockEditor {
  private container: HTMLElement;
  private sync: SyncEngine;
  private slashMenu: SlashMenu;
  private propertyPanel: PropertyPanel;
  private focusedBlockId: string | null = null;

  constructor(container: HTMLElement, sync: SyncEngine) {
    this.container = container;
    this.sync = sync;
    this.slashMenu = new SlashMenu(this.onSlashSelect.bind(this));
    this.propertyPanel = new PropertyPanel(this.onPropertySave.bind(this));
    this.render();
    this.bindEvents();
  }

  /** Full re-render from the sync engine's document */
  render(): void {
    const doc = this.sync.getDocument();
    const blocks = this.flattenBlocks(doc.blocks);

    this.container.innerHTML = "";

    // Document settings bar
    const settingsBar = renderDocSettingsBar(blocks);
    this.container.appendChild(settingsBar);

    // Settings toggle
    const toggle = settingsBar.querySelector(".it-doc-settings__toggle");
    const panel = settingsBar.querySelector(".it-doc-settings__panel");
    if (toggle && panel) {
      toggle.addEventListener("click", () => panel.classList.toggle("hidden"));
    }

    // Content canvas
    const canvas = document.createElement("div");
    canvas.className = "it-editor-canvas";
    this.container.appendChild(canvas);

    // Render each non-setting block
    for (const block of blocks) {
      if (isDocumentSetting(block.type)) continue;
      const el = renderBlockElement(block);
      canvas.appendChild(el);
    }

    // Empty state: add a default note block placeholder
    if (blocks.filter((b) => !isDocumentSetting(b.type)).length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "it-editor-placeholder";
      placeholder.textContent = "Start typing or press / for commands...";
      placeholder.addEventListener("click", () => {
        const newId = this.sync.insertBlockAfter(null, "note", "");
        this.render();
        this.focusBlock(newId);
      });
      canvas.appendChild(placeholder);
    }

    // Restore focus
    if (this.focusedBlockId) {
      this.focusBlock(this.focusedBlockId);
    }
  }

  /** Focus a specific block's content area */
  focusBlock(blockId: string): void {
    this.focusedBlockId = blockId;
    const el = this.container.querySelector(
      `[data-block-id="${blockId}"] .it-block__content`,
    ) as HTMLElement;
    if (el) {
      el.focus();
      // Place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      if (el.childNodes.length > 0) {
        range.selectNodeContents(el);
        range.collapse(false);
      } else {
        range.setStart(el, 0);
        range.collapse(true);
      }
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  destroy(): void {
    this.slashMenu.destroy();
    this.propertyPanel.destroy();
  }

  // ── Event handling ────────────────────────────────────────

  private bindEvents(): void {
    // Delegate input events from contenteditable areas
    this.container.addEventListener("input", (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("it-block__content")) return;
      const blockEl = target.closest(".it-block") as HTMLElement;
      if (!blockEl) return;

      const blockId = blockEl.dataset.blockId!;
      const newText = target.textContent ?? "";
      this.sync.updateBlockContent(blockId, newText);
    });

    // Keydown for block-level actions
    this.container.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("it-block__content")) return;
      const blockEl = target.closest(".it-block") as HTMLElement;
      if (!blockEl) return;

      const blockId = blockEl.dataset.blockId!;
      this.focusedBlockId = blockId;

      // Enter → new block
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const newId = this.sync.insertBlockAfter(blockId, "note", "");
        this.render();
        this.focusBlock(newId);
        return;
      }

      // Ctrl+Enter → new block with slash menu
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newId = this.sync.insertBlockAfter(blockId, "note", "");
        this.render();
        this.focusBlock(newId);
        // Open slash menu on the new block
        requestAnimationFrame(() => {
          const newEl = this.container.querySelector(
            `[data-block-id="${newId}"] .it-block__content`,
          ) as HTMLElement;
          if (newEl) this.slashMenu.show(newEl, newId);
        });
        return;
      }

      // Backspace on empty block → delete and focus previous
      if (e.key === "Backspace" && (target.textContent ?? "").trim() === "") {
        e.preventDefault();
        const allBlocks = this.getVisibleBlockElements();
        const idx = allBlocks.findIndex((el) => el.dataset.blockId === blockId);
        this.sync.deleteBlock(blockId);
        this.render();
        if (idx > 0) {
          const prevId = allBlocks[idx - 1].dataset.blockId!;
          this.focusBlock(prevId);
        }
        return;
      }

      // Arrow up at start → focus previous block
      if (e.key === "ArrowUp") {
        const sel = window.getSelection();
        if (sel && this.isCaretAtStart(target, sel)) {
          e.preventDefault();
          this.focusAdjacentBlock(blockId, "up");
          return;
        }
      }

      // Arrow down at end → focus next block
      if (e.key === "ArrowDown") {
        const sel = window.getSelection();
        if (sel && this.isCaretAtEnd(target, sel)) {
          e.preventDefault();
          this.focusAdjacentBlock(blockId, "down");
          return;
        }
      }

      // Slash at start of empty block → slash menu
      if (e.key === "/" && (target.textContent ?? "").trim() === "") {
        e.preventDefault();
        this.slashMenu.show(target, blockId);
        return;
      }

      // Keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "b") {
          e.preventDefault();
          this.toggleInlineFormat("*");
          return;
        }
        if (e.key === "i") {
          e.preventDefault();
          this.toggleInlineFormat("_");
          return;
        }
        if (e.key === "1") {
          e.preventDefault();
          this.sync.changeBlockType(blockId, "title");
          this.render();
          this.focusBlock(blockId);
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          this.sync.changeBlockType(blockId, "section");
          this.render();
          this.focusBlock(blockId);
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          this.sync.changeBlockType(blockId, "sub");
          this.render();
          this.focusBlock(blockId);
          return;
        }
      }
    });

    // Click on property badges → open property panel
    this.container.addEventListener("click", (e) => {
      const badge = (e.target as HTMLElement).closest(
        ".it-prop-badge",
      ) as HTMLElement;
      if (badge) {
        const blockEl = badge.closest(".it-block") as HTMLElement;
        if (blockEl) {
          const blockId = blockEl.dataset.blockId!;
          const block = this.findBlock(blockId);
          if (block) {
            this.propertyPanel.show(blockEl, block);
          }
        }
        return;
      }

      // Click on checkbox → toggle task/done
      const checkbox = (e.target as HTMLElement).closest(
        ".it-block__checkbox",
      ) as HTMLInputElement;
      if (checkbox) {
        e.preventDefault();
        const blockEl = checkbox.closest(".it-block") as HTMLElement;
        if (blockEl) {
          const blockId = blockEl.dataset.blockId!;
          const blockType = blockEl.dataset.blockType;
          const newType = blockType === "task" ? "done" : "task";
          this.sync.changeBlockType(blockId, newType);
          this.render();
        }
        return;
      }
    });

    // Focus tracking
    this.container.addEventListener("focusin", (e) => {
      const target = e.target as HTMLElement;
      const blockEl = target.closest(".it-block") as HTMLElement;
      if (blockEl) {
        this.focusedBlockId = blockEl.dataset.blockId ?? null;
        // Clear active state on all blocks, set on current
        this.container
          .querySelectorAll(".it-block--active")
          .forEach((el) => el.classList.remove("it-block--active"));
        blockEl.classList.add("it-block--active");
      }
    });
  }

  // ── Slash menu callback ───────────────────────────────────

  private onSlashSelect(blockId: string, type: string): void {
    this.sync.changeBlockType(blockId, type);
    this.render();
    this.focusBlock(blockId);

    // Auto-open property panel for blocks with required properties
    if (REQUIRES_PROPERTIES.includes(type)) {
      requestAnimationFrame(() => {
        const blockEl = this.container.querySelector(
          `[data-block-id="${blockId}"]`,
        ) as HTMLElement;
        const block = this.findBlock(blockId);
        if (blockEl && block) {
          this.propertyPanel.show(blockEl, block);
        }
      });
    }
  }

  // ── Property panel callback ───────────────────────────────

  private onPropertySave(blockId: string, props: Record<string, string>): void {
    this.sync.updateBlockProperties(blockId, props);
    this.render();
    this.focusBlock(blockId);
  }

  // ── Helpers ───────────────────────────────────────────────

  private flattenBlocks(blocks: IntentBlock[]): IntentBlock[] {
    const result: IntentBlock[] = [];
    for (const b of blocks) {
      result.push(b);
      if (b.children?.length) result.push(...this.flattenBlocks(b.children));
    }
    return result;
  }

  private findBlock(blockId: string): IntentBlock | undefined {
    return this.flattenBlocks(this.sync.getDocument().blocks).find(
      (b) => b.id === blockId,
    );
  }

  private getVisibleBlockElements(): HTMLElement[] {
    return Array.from(
      this.container.querySelectorAll(".it-block[data-block-id]"),
    );
  }

  private focusAdjacentBlock(
    currentId: string,
    direction: "up" | "down",
  ): void {
    const allBlocks = this.getVisibleBlockElements();
    const idx = allBlocks.findIndex((el) => el.dataset.blockId === currentId);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < allBlocks.length) {
      this.focusBlock(allBlocks[targetIdx].dataset.blockId!);
    }
  }

  private isCaretAtStart(el: HTMLElement, sel: Selection): boolean {
    if (!sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    return (
      range.collapsed &&
      range.startOffset === 0 &&
      (range.startContainer === el || range.startContainer === el.firstChild)
    );
  }

  private isCaretAtEnd(el: HTMLElement, sel: Selection): boolean {
    if (!sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    if (range.startContainer === el)
      return range.startOffset >= el.childNodes.length;
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      return (
        range.startOffset >= (range.startContainer.textContent?.length ?? 0) &&
        range.startContainer === el.lastChild
      );
    }
    return false;
  }

  private toggleInlineFormat(marker: string): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const text = sel.toString();
    if (!text) return;

    const range = sel.getRangeAt(0);
    const wrapped = `${marker}${text}${marker}`;
    range.deleteContents();
    range.insertNode(document.createTextNode(wrapped));

    // Update sync
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
}
