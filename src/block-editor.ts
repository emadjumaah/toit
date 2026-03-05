// ── Block Editor ────────────────────────────────────────────
// The WYSIWYG block editor: renders blocks as contenteditable divs.
// Implements the full native editor UX contract from Editor.md.

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
import { UndoStack } from "./undo-stack";

/** Placeholder text by block type */
const PLACEHOLDERS: Record<string, string> = {
  note: "Write something…",
  title: "Document title",
  section: "Section heading",
  sub: "Subsection heading",
  task: "Task description",
  step: "Step description",
  ask: "Your question…",
  quote: "Quoted text…",
  summary: "Summary…",
  info: "Info…",
  warning: "Warning…",
  tip: "Tip…",
  success: "Success…",
};

export class BlockEditor {
  private container: HTMLElement;
  private sync: SyncEngine;
  private slashMenu: SlashMenu;
  private propertyPanel: PropertyPanel;
  private focusedBlockId: string | null = null;
  private undoStack: UndoStack;
  private typingSnapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private hasUnsavedChanges = false;

  constructor(container: HTMLElement, sync: SyncEngine) {
    this.container = container;
    this.sync = sync;
    this.slashMenu = new SlashMenu(this.onSlashSelect.bind(this));
    this.propertyPanel = new PropertyPanel(this.onPropertySave.bind(this));
    this.undoStack = new UndoStack();
    this.undoStack.push(this.sync.getSource());
    this.render();
    this.bindEvents();
    // Focus first block on load
    requestAnimationFrame(() => this.focusFirstBlock());
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
      // Set placeholder
      const contentEl = el.querySelector(".it-block__content") as HTMLElement;
      if (contentEl) {
        const placeholder = PLACEHOLDERS[block.type] || `${block.type}…`;
        contentEl.setAttribute("data-placeholder", placeholder);
      }
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
        this.focusBlockStart(newId);
      });
      canvas.appendChild(placeholder);
    }

    // Restore focus
    if (this.focusedBlockId) {
      this.focusBlockEnd(this.focusedBlockId);
    }
  }

  /** Get the undo stack (for external use by TabManager etc.) */
  getUndoStack(): UndoStack {
    return this.undoStack;
  }

  /** Whether there are unsaved changes */
  getHasUnsavedChanges(): boolean {
    return this.hasUnsavedChanges;
  }

  /** Mark as saved */
  markSaved(): void {
    this.hasUnsavedChanges = false;
    document.title = "IntentText Editor";
  }

  /** Mark as unsaved */
  private markUnsaved(): void {
    this.hasUnsavedChanges = true;
    document.title = "● IntentText Editor";
  }

  destroy(): void {
    this.slashMenu.destroy();
    this.propertyPanel.destroy();
    if (this.typingSnapshotTimer) clearTimeout(this.typingSnapshotTimer);
  }

  /** Convert DOM innerText (which has real \n from <br>) to .it source content (literal \\n escape) */
  private domTextToSource(innerText: string): string {
    return innerText.replace(/\n$/, "").replace(/\n/g, "\\n");
  }

  // ── Cursor utilities ──────────────────────────────────────

  /** Get character offset of cursor within a contenteditable element */
  private getCursorOffset(element: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  }

  /** Focus a specific block's content area at the start */
  focusBlockStart(blockId: string): void {
    this.focusedBlockId = blockId;
    const contentEl = this.container.querySelector(
      `[data-block-id="${blockId}"] .it-block__content`,
    ) as HTMLElement;
    if (!contentEl) return;
    contentEl.focus();
    const range = document.createRange();
    range.setStart(contentEl, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /** Focus a specific block's content area at the end */
  focusBlockEnd(blockId: string): void {
    this.focusedBlockId = blockId;
    const contentEl = this.container.querySelector(
      `[data-block-id="${blockId}"] .it-block__content`,
    ) as HTMLElement;
    if (!contentEl) return;
    contentEl.focus();
    const range = document.createRange();
    if (contentEl.childNodes.length > 0) {
      range.selectNodeContents(contentEl);
      range.collapse(false);
    } else {
      range.setStart(contentEl, 0);
      range.collapse(true);
    }
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /** Focus block at a specific character offset */
  private focusBlockAtOffset(blockId: string, offset: number): void {
    this.focusedBlockId = blockId;
    const contentEl = this.container.querySelector(
      `[data-block-id="${blockId}"] .it-block__content`,
    ) as HTMLElement;
    if (!contentEl) return;
    contentEl.focus();

    // Walk text nodes to find offset position
    const range = document.createRange();
    let remaining = offset;
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
      remaining -= len;
    }
    // If offset exceeds content, go to end
    range.selectNodeContents(contentEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /** Focus the first content block */
  private focusFirstBlock(): void {
    const firstBlock = this.container.querySelector(".it-block") as HTMLElement;
    if (firstBlock) {
      const blockId = firstBlock.dataset.blockId;
      if (blockId) this.focusBlockStart(blockId);
    }
  }

  // ── Undo snapshot scheduling ──────────────────────────────

  private scheduleTypingSnapshot(): void {
    if (this.typingSnapshotTimer) clearTimeout(this.typingSnapshotTimer);
    this.typingSnapshotTimer = setTimeout(() => {
      this.undoStack.push(this.sync.getSource());
    }, 2000);
  }

  private pushUndoSnapshot(): void {
    if (this.typingSnapshotTimer) clearTimeout(this.typingSnapshotTimer);
    this.undoStack.push(this.sync.getSource());
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
      const newText = this.domTextToSource(target.innerText);
      this.sync.updateBlockContent(blockId, newText);
      this.markUnsaved();
      this.scheduleTypingSnapshot();
    });

    // Keydown for block-level actions
    this.container.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("it-block__content")) return;
      const blockEl = target.closest(".it-block") as HTMLElement;
      if (!blockEl) return;

      const blockId = blockEl.dataset.blockId!;
      this.focusedBlockId = blockId;

      // ── Enter handling (PART 1 of Editor.md) ──────────
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd+Enter → insert line break within same block
          this.insertLineBreakInBlock(target, blockId);
        } else {
          // Enter → create new block below (with split if mid-block)
          this.createBlockBelow(target, blockEl, blockId);
        }
        return;
      }

      // ── Backspace handling (PART 2 of Editor.md) ──────
      if (e.key === "Backspace") {
        const isEmpty = (target.innerText ?? "").trim() === "";
        const cursorAtStart = this.getCursorOffset(target) === 0;

        if (isEmpty) {
          // Empty block → delete and move focus to previous
          e.preventDefault();
          const allBlocks = this.getVisibleBlockElements();
          const idx = allBlocks.findIndex(
            (el) => el.dataset.blockId === blockId,
          );
          this.sync.deleteBlock(blockId);
          this.pushUndoSnapshot();
          this.markUnsaved();
          this.render();
          if (idx > 0) {
            const prevId = allBlocks[idx - 1].dataset.blockId!;
            this.focusBlockEnd(prevId);
          }
          return;
        }

        if (cursorAtStart && !isEmpty) {
          // Cursor at start of non-empty block → merge with previous
          e.preventDefault();
          const allBlocks = this.getVisibleBlockElements();
          const idx = allBlocks.findIndex(
            (el) => el.dataset.blockId === blockId,
          );
          if (idx <= 0) return;

          const prevBlockEl = allBlocks[idx - 1];
          const prevId = prevBlockEl.dataset.blockId!;
          const prevContentEl = prevBlockEl.querySelector(
            ".it-block__content",
          ) as HTMLElement;
          if (!prevContentEl) return;

          const prevLength = (prevContentEl.innerText ?? "").replace(
            /\n$/,
            "",
          ).length;
          const currentContent = this.domTextToSource(target.innerText);

          // Merge: append current content to previous block
          this.sync.mergeBlocks(prevId, blockId);
          this.pushUndoSnapshot();
          this.markUnsaved();
          this.render();

          // Focus previous block at the merge point
          this.focusBlockAtOffset(prevId, prevLength);
          return;
        }
        // Otherwise let browser handle normal backspace within content
        return;
      }

      // ── Delete at end of block → merge next block ─────
      if (e.key === "Delete") {
        const cursorAtEnd =
          this.getCursorOffset(target) >= (target.innerText ?? "").length;
        if (cursorAtEnd) {
          const allBlocks = this.getVisibleBlockElements();
          const idx = allBlocks.findIndex(
            (el) => el.dataset.blockId === blockId,
          );
          if (idx < allBlocks.length - 1) {
            e.preventDefault();
            const nextId = allBlocks[idx + 1].dataset.blockId!;
            const curLength = (target.innerText ?? "").length;
            this.sync.mergeBlocks(blockId, nextId);
            this.pushUndoSnapshot();
            this.markUnsaved();
            this.render();
            this.focusBlockAtOffset(blockId, curLength);
          }
          return;
        }
      }

      // ── Arrow up at start → focus previous block ──────
      if (e.key === "ArrowUp" && !e.altKey) {
        const sel = window.getSelection();
        if (sel && this.isCaretAtStart(target, sel)) {
          e.preventDefault();
          this.focusAdjacentBlock(blockId, "up");
          return;
        }
      }

      // ── Arrow down at end → focus next block ──────────
      if (e.key === "ArrowDown" && !e.altKey) {
        const sel = window.getSelection();
        if (sel && this.isCaretAtEnd(target, sel)) {
          e.preventDefault();
          this.focusAdjacentBlock(blockId, "down");
          return;
        }
      }

      // ── Alt+Arrow → move block ────────────────────────
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        this.sync.moveBlock(blockId, "up");
        this.pushUndoSnapshot();
        this.markUnsaved();
        this.render();
        this.focusBlockEnd(blockId);
        return;
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        this.sync.moveBlock(blockId, "down");
        this.pushUndoSnapshot();
        this.markUnsaved();
        this.render();
        this.focusBlockEnd(blockId);
        return;
      }

      // ── Tab on empty block → open slash menu ──────────
      if (e.key === "Tab" && (target.innerText ?? "").trim() === "") {
        e.preventDefault();
        this.slashMenu.show(target, blockId);
        return;
      }

      // ── Slash at start of empty block → slash menu ────
      if (e.key === "/" && (target.innerText ?? "").trim() === "") {
        e.preventDefault();
        this.slashMenu.show(target, blockId);
        return;
      }

      // ── Escape → close slash menu or blur ─────────────
      if (e.key === "Escape") {
        this.slashMenu.hide();
        return;
      }

      // ── Keyboard shortcuts (Ctrl/Cmd + key) ──────────
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "b":
            e.preventDefault();
            this.wrapSelectionWith("*", "*");
            return;
          case "i":
            e.preventDefault();
            this.wrapSelectionWith("_", "_");
            return;
          case "k":
            e.preventDefault();
            this.promptLinkAndWrap();
            return;
          case "z":
            if (e.shiftKey) {
              // Redo
              e.preventDefault();
              this.doRedo();
            } else {
              // Undo
              e.preventDefault();
              this.doUndo();
            }
            return;
          case "p":
            // Switch to print tab (handled at document level, but prevent default)
            break;
          case "1":
            e.preventDefault();
            this.sync.changeBlockType(blockId, "title");
            this.pushUndoSnapshot();
            this.render();
            this.focusBlockEnd(blockId);
            return;
          case "2":
            e.preventDefault();
            this.sync.changeBlockType(blockId, "section");
            this.pushUndoSnapshot();
            this.render();
            this.focusBlockEnd(blockId);
            return;
          case "3":
            e.preventDefault();
            this.sync.changeBlockType(blockId, "sub");
            this.pushUndoSnapshot();
            this.render();
            this.focusBlockEnd(blockId);
            return;
        }

        // Ctrl+Shift+X → strikethrough
        if (e.shiftKey && e.key === "X") {
          e.preventDefault();
          this.wrapSelectionWith("~", "~");
          return;
        }
      }
    });

    // ── Paste handling (PART 6 of Editor.md) ──────────────
    this.container.addEventListener("paste", (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("it-block__content")) return;
      const blockEl = target.closest(".it-block") as HTMLElement;
      if (!blockEl) return;

      e.preventDefault();
      const blockId = blockEl.dataset.blockId!;
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Always get plain text — never HTML
      const text = clipboardData.getData("text/plain");
      if (!text) return;

      const lines = text.split("\n").filter((l) => l.trim());

      if (lines.length === 1) {
        // Single line — insert at cursor position within current block
        this.insertTextAtCursor(lines[0], target, blockId);
      } else {
        // Multiple lines — insert first into current block, new blocks for rest
        this.insertTextAtCursor(lines[0], target, blockId);
        let lastId = blockId;
        for (let i = 1; i < lines.length; i++) {
          const isItKeyword = /^\w+:\s/.test(lines[i]);
          const blockType = isItKeyword ? lines[i].split(":")[0] : "note";
          const content = isItKeyword
            ? lines[i].slice(lines[i].indexOf(":") + 1).trim()
            : lines[i];
          lastId = this.sync.insertBlockAfter(lastId, blockType, content);
        }
        this.render();
        this.focusBlockEnd(lastId);
      }

      this.pushUndoSnapshot();
      this.markUnsaved();
    });

    // ── Click on property badges → open property panel ──
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
          this.pushUndoSnapshot();
          this.render();
        }
        return;
      }

      // Click anywhere on a block → focus its content area
      const blockEl = (e.target as HTMLElement).closest(
        ".it-block",
      ) as HTMLElement;
      if (blockEl) {
        const contentEl = blockEl.querySelector(
          ".it-block__content",
        ) as HTMLElement;
        if (
          contentEl &&
          e.target !== contentEl &&
          !contentEl.contains(e.target as Node)
        ) {
          const blockId = blockEl.dataset.blockId;
          if (blockId) this.focusBlockEnd(blockId);
        }
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

    // Warn before closing with unsaved changes
    window.addEventListener("beforeunload", (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  // ── Enter key actions ─────────────────────────────────────

  /** Insert a line break within the current block (Ctrl+Enter) */
  private insertLineBreakInBlock(
    contentEl: HTMLElement,
    blockId: string,
  ): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);

    // If <br> is at the very end we need a sentinel so the new line is visible
    if (
      !br.nextSibling ||
      (br.nextSibling.nodeType === Node.TEXT_NODE &&
        br.nextSibling.textContent === "")
    ) {
      const sentinel = document.createElement("br");
      br.parentNode!.insertBefore(sentinel, br.nextSibling);
    }

    // Move cursor after the <br>
    const newRange = document.createRange();
    newRange.setStartAfter(br);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    // Sync this block's content to .it source
    const newText = this.domTextToSource(contentEl.innerText);
    this.sync.updateBlockContent(blockId, newText);
    this.markUnsaved();
    this.scheduleTypingSnapshot();
  }

  /** Create a new block below the current one (Enter key) */
  private createBlockBelow(
    contentEl: HTMLElement,
    blockEl: HTMLElement,
    blockId: string,
  ): void {
    const cursorOffset = this.getCursorOffset(contentEl);
    const fullText = this.domTextToSource(contentEl.innerText);
    const atEnd = cursorOffset >= fullText.length;

    let newBlockContent = "";

    if (!atEnd && cursorOffset > 0) {
      // Split — text after cursor goes to new block
      const before = fullText.slice(0, cursorOffset);
      const after = fullText.slice(cursorOffset);
      newBlockContent = after;

      // Update current block with only the text before cursor
      this.sync.updateBlockContent(blockId, before);
    } else if (cursorOffset === 0 && fullText.length > 0) {
      // Cursor at very start of non-empty block: push content down
      newBlockContent = fullText;
      this.sync.updateBlockContent(blockId, "");
    }

    // Create the new block
    const newId = this.sync.insertBlockAfter(
      blockId,
      "note",
      cursorOffset === 0 && fullText.length > 0 ? "" : newBlockContent,
    );

    // If cursor was at position 0, the new empty block is above, content stays below
    // Actually we need: cursor at 0 → new empty block inserted BEFORE and content stays,
    // but insertBlockAfter inserts after. Let's keep it simple: new block below
    // with the split content
    if (cursorOffset === 0 && fullText.length > 0) {
      // Swap: current block becomes empty, new block gets the content
      this.sync.updateBlockContent(newId, fullText);
      this.sync.updateBlockContent(blockId, "");
    }

    this.pushUndoSnapshot();
    this.markUnsaved();
    this.render();
    if (cursorOffset === 0 && fullText.length > 0) {
      // Focus the current (now empty) block — user pressed Enter at start
      this.focusBlockStart(newId);
    } else {
      this.focusBlockStart(newId);
    }
  }

  // ── Undo / Redo ───────────────────────────────────────────

  private doUndo(): void {
    const source = this.undoStack.undo();
    if (source === null) return;
    this.sync.setSource(source);
    this.render();
    this.focusFirstBlock();
  }

  private doRedo(): void {
    const source = this.undoStack.redo();
    if (source === null) return;
    this.sync.setSource(source);
    this.render();
    this.focusFirstBlock();
  }

  // ── Paste helpers ─────────────────────────────────────────

  private insertTextAtCursor(
    text: string,
    contentEl: HTMLElement,
    blockId: string,
  ): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // Sync
    const newText = this.domTextToSource(contentEl.innerText);
    this.sync.updateBlockContent(blockId, newText);
  }

  // ── Inline formatting ─────────────────────────────────────

  private wrapSelectionWith(before: string, after: string): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const selectedText = selection.toString();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);

    // Toggle: if already wrapped with markers, unwrap
    let result: string;
    if (
      selectedText.startsWith(before) &&
      selectedText.endsWith(after) &&
      selectedText.length > before.length + after.length
    ) {
      result = selectedText.slice(before.length, -after.length);
    } else {
      result = `${before}${selectedText}${after}`;
    }

    range.deleteContents();
    const textNode = document.createTextNode(result);
    range.insertNode(textNode);

    // Select the result text so user can toggle again
    range.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // Sync active block
    this.syncActiveBlockToSource();
  }

  private promptLinkAndWrap(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const text = selection.toString();
    if (!text) return;

    const url = prompt("URL:");
    if (!url) return;

    const range = selection.getRangeAt(0);
    const linked = `[${text}](${url})`;
    range.deleteContents();
    range.insertNode(document.createTextNode(linked));

    this.syncActiveBlockToSource();
  }

  private syncActiveBlockToSource(): void {
    const blockEl = this.container.querySelector(
      ".it-block--active",
    ) as HTMLElement;
    if (!blockEl) return;
    const blockId = blockEl.dataset.blockId!;
    const contentEl = blockEl.querySelector(
      ".it-block__content",
    ) as HTMLElement;
    if (contentEl) {
      this.sync.updateBlockContent(
        blockId,
        this.domTextToSource(contentEl.innerText),
      );
      this.markUnsaved();
      this.scheduleTypingSnapshot();
    }
  }

  // ── Slash menu callback ───────────────────────────────────

  private onSlashSelect(blockId: string, type: string): void {
    this.sync.changeBlockType(blockId, type);
    this.pushUndoSnapshot();
    this.markUnsaved();
    this.render();
    this.focusBlockStart(blockId);

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
    this.pushUndoSnapshot();
    this.markUnsaved();
    this.render();
    this.focusBlockEnd(blockId);
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
      const targetId = allBlocks[targetIdx].dataset.blockId!;
      if (direction === "up") {
        this.focusBlockEnd(targetId);
      } else {
        this.focusBlockStart(targetId);
      }
    }
  }

  private isCaretAtStart(el: HTMLElement, sel: Selection): boolean {
    if (!sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    return this.getCursorOffset(el) === 0;
  }

  private isCaretAtEnd(el: HTMLElement, sel: Selection): boolean {
    if (!sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    return this.getCursorOffset(el) >= (el.innerText ?? "").length;
  }
}
