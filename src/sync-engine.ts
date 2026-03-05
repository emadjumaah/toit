// ── Sync Engine ─────────────────────────────────────────────
// Bridges the WYSIWYG block editor ↔ .it source string.
// Single source of truth is the .it string.

import { parseIntentText } from "@intenttext/core";
import type { IntentDocument, IntentBlock } from "@intenttext/core";

export type SyncListener = (doc: IntentDocument, source: string) => void;

export class SyncEngine {
  private source: string;
  private doc: IntentDocument;
  private listeners: SyncListener[] = [];

  constructor(initialSource: string = "") {
    this.source = initialSource;
    this.doc = this.safeParse(initialSource);
  }

  /** Get current .it source */
  getSource(): string {
    return this.source;
  }

  /** Get current parsed document */
  getDocument(): IntentDocument {
    return this.doc;
  }

  /** Set source from external (e.g. Source tab, file open) — triggers full re-parse */
  setSource(newSource: string): void {
    this.source = newSource;
    this.doc = this.safeParse(newSource);
    this.notify();
  }

  /** Update a single block's content by its ID (lightweight sync from WYSIWYG edit) */
  updateBlockContent(blockId: string, newText: string): void {
    const lines = this.source.split("\n");
    const block = this.findBlock(blockId);
    if (!block) return;

    const lineIdx = this.findBlockLineIndex(block, lines);
    if (lineIdx === -1) return;

    const oldLine = lines[lineIdx];
    const newLine = this.reconstructLine(block.type, newText, block.properties);
    if (oldLine === newLine) return;

    lines[lineIdx] = newLine;
    this.source = lines.join("\n");
    // Update block content directly — do NOT re-parse.
    // Re-parsing would regenerate all block IDs, breaking DOM references.
    block.content = newText;
  }

  /** Change block type (e.g. slash menu selection) */
  changeBlockType(blockId: string, newType: string): void {
    const lines = this.source.split("\n");
    const block = this.findBlock(blockId);
    if (!block) return;

    const lineIdx = this.findBlockLineIndex(block, lines);
    if (lineIdx === -1) return;

    if (newType === "divider") {
      lines[lineIdx] = "---";
    } else {
      const content = block.content ?? "";
      lines[lineIdx] = this.reconstructLine(newType, content, block.properties);
    }

    this.source = lines.join("\n");
    this.doc = this.safeParse(this.source);
    this.notify();
  }

  /** Insert a new block after a given block ID */
  insertBlockAfter(
    afterId: string | null,
    type: string,
    content: string = "",
  ): string {
    const lines = this.source.split("\n");
    let insertIdx: number;
    let blockPosition = -1; // position in flattened block list

    if (afterId) {
      const block = this.findBlock(afterId);
      if (block) {
        insertIdx = this.findBlockLineIndex(block, lines) + 1;
        const allBlocks = this.flattenBlocks(this.doc.blocks);
        blockPosition = allBlocks.indexOf(block);
      } else {
        insertIdx = lines.length;
      }
    } else {
      insertIdx = lines.length;
    }

    const newLine = type === "divider" ? "---" : `${type}: ${content}`;
    lines.splice(insertIdx, 0, newLine);
    this.source = lines.join("\n");
    this.doc = this.safeParse(this.source);

    // Find the newly created block by positional index
    // (can't match by old IDs since re-parse generates new ones)
    const allNewBlocks = this.flattenBlocks(this.doc.blocks);
    let newBlock;
    if (blockPosition >= 0 && blockPosition + 1 < allNewBlocks.length) {
      newBlock = allNewBlocks[blockPosition + 1];
    } else {
      newBlock = allNewBlocks[allNewBlocks.length - 1];
    }
    this.notify();
    return newBlock?.id ?? "";
  }

  /** Delete a block by ID */
  deleteBlock(blockId: string): void {
    const lines = this.source.split("\n");
    const block = this.findBlock(blockId);
    if (!block) return;

    const lineIdx = this.findBlockLineIndex(block, lines);
    if (lineIdx === -1) return;

    lines.splice(lineIdx, 1);
    this.source = lines.join("\n");
    this.doc = this.safeParse(this.source);
    this.notify();
  }

  /** Move a block up or down */
  moveBlock(blockId: string, direction: "up" | "down"): void {
    const lines = this.source.split("\n");
    const block = this.findBlock(blockId);
    if (!block) return;

    const lineIdx = this.findBlockLineIndex(block, lines);
    if (lineIdx === -1) return;

    const targetIdx = direction === "up" ? lineIdx - 1 : lineIdx + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    // Swap lines
    [lines[lineIdx], lines[targetIdx]] = [lines[targetIdx], lines[lineIdx]];
    this.source = lines.join("\n");
    this.doc = this.safeParse(this.source);
    this.notify();
  }

  /** Merge two blocks: append secondId's content to firstId, then delete secondId */
  mergeBlocks(firstId: string, secondId: string): void {
    const firstBlock = this.findBlock(firstId);
    const secondBlock = this.findBlock(secondId);
    if (!firstBlock || !secondBlock) return;

    const lines = this.source.split("\n");
    const firstLineIdx = this.findBlockLineIndex(firstBlock, lines);
    const secondLineIdx = this.findBlockLineIndex(secondBlock, lines);
    if (firstLineIdx === -1 || secondLineIdx === -1) return;

    const mergedContent =
      (firstBlock.content ?? "") + (secondBlock.content ?? "");
    lines[firstLineIdx] = this.reconstructLine(
      firstBlock.type,
      mergedContent,
      firstBlock.properties,
    );
    lines.splice(secondLineIdx, 1);
    this.source = lines.join("\n");
    this.doc = this.safeParse(this.source);
    this.notify();
  }

  /** Update block properties */
  updateBlockProperties(blockId: string, props: Record<string, string>): void {
    const lines = this.source.split("\n");
    const block = this.findBlock(blockId);
    if (!block) return;

    const lineIdx = this.findBlockLineIndex(block, lines);
    if (lineIdx === -1) return;

    const content = block.content ?? "";
    lines[lineIdx] = this.reconstructLine(block.type, content, props);
    this.source = lines.join("\n");
    this.doc = this.safeParse(this.source);
    this.notify();
  }

  /** Subscribe to source changes */
  onChange(listener: SyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ── Private helpers ───────────────────────────────────────

  private notify(): void {
    for (const ln of this.listeners) {
      ln(this.doc, this.source);
    }
  }

  private safeParse(source: string): IntentDocument {
    try {
      return parseIntentText(source);
    } catch {
      return { blocks: [], metadata: {} } as unknown as IntentDocument;
    }
  }

  private findBlock(blockId: string): IntentBlock | undefined {
    return this.flattenBlocks(this.doc.blocks).find((b) => b.id === blockId);
  }

  private flattenBlocks(blocks: IntentBlock[]): IntentBlock[] {
    const result: IntentBlock[] = [];
    for (const b of blocks) {
      result.push(b);
      if (b.children?.length) result.push(...this.flattenBlocks(b.children));
    }
    return result;
  }

  /** Find the line index in .it source that corresponds to a block */
  private findBlockLineIndex(block: IntentBlock, lines: string[]): number {
    // Strategy: match block type + content against source lines
    const allBlocks = this.flattenBlocks(this.doc.blocks);
    const blockIdx = allBlocks.indexOf(block);
    if (blockIdx === -1) return -1;

    // Walk through lines, counting parsed blocks
    let parsedCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("//")) {
        parsedCount++;
        if (parsedCount - 1 === blockIdx) return i;
        continue;
      }
      if (line === "---") {
        if (parsedCount === blockIdx) return i;
        parsedCount++;
        continue;
      }

      // Check for keyword lines
      const kwMatch = line.match(/^(\w+):\s*/);
      if (kwMatch || line.startsWith("|")) {
        if (parsedCount === blockIdx) return i;
        parsedCount++;
        continue;
      }

      // Fallback — any non-empty line counts
      if (parsedCount === blockIdx) return i;
      parsedCount++;
    }

    return -1;
  }

  /** Reconstruct a .it line from type, content, and properties */
  private reconstructLine(
    type: string,
    content: string,
    props?: Record<string, string | number> | null,
  ): string {
    if (type === "divider") return "---";

    let line = `${type}: ${content}`;
    if (props && Object.keys(props).length > 0) {
      const pipeParts = Object.entries(props)
        .filter(([, v]) => v != null && String(v).trim())
        .map(([k, v]) => `${k}: ${v}`);
      if (pipeParts.length > 0) {
        line += " | " + pipeParts.join(" | ");
      }
    }
    return line;
  }
}
