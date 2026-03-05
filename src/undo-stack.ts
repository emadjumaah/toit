// ── Undo Stack ──────────────────────────────────────────────
// Source snapshot stack for undo/redo.

export class UndoStack {
  private stack: string[] = [];
  private pointer: number = -1;
  private maxSize: number = 100;

  push(source: string): void {
    // Don't push if identical to current
    if (this.pointer >= 0 && this.stack[this.pointer] === source) return;

    // Drop any redo history
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(source);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    } else {
      this.pointer++;
    }
  }

  undo(): string | null {
    if (this.pointer <= 0) return null;
    this.pointer--;
    return this.stack[this.pointer];
  }

  redo(): string | null {
    if (this.pointer >= this.stack.length - 1) return null;
    this.pointer++;
    return this.stack[this.pointer];
  }

  canUndo(): boolean {
    return this.pointer > 0;
  }

  canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }
}
