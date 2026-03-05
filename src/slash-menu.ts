// ── Slash Menu ──────────────────────────────────────────────
// Floating command menu triggered by "/" in an empty block.

import { SLASH_MENU_ITEMS, type SlashMenuItem } from "./block-schemas";

export type SlashSelectCallback = (blockId: string, type: string) => void;

export class SlashMenu {
  private overlay: HTMLElement;
  private menu: HTMLElement;
  private items: SlashMenuItem[] = SLASH_MENU_ITEMS;
  private filteredItems: SlashMenuItem[] = [...this.items];
  private selectedIndex = 0;
  private blockId: string = "";
  private onSelect: SlashSelectCallback;
  private filter = "";

  constructor(onSelect: SlashSelectCallback) {
    this.onSelect = onSelect;

    // Create overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "it-slash-overlay hidden";
    this.overlay.addEventListener("click", () => this.hide());

    // Create menu
    this.menu = document.createElement("div");
    this.menu.className = "it-slash-menu";
    this.overlay.appendChild(this.menu);
    document.body.appendChild(this.overlay);
  }

  show(anchor: HTMLElement, blockId: string): void {
    this.blockId = blockId;
    this.filter = "";
    this.selectedIndex = 0;
    this.filteredItems = [...this.items];

    // Position near the anchor
    const rect = anchor.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + 4}px`;
    this.menu.style.left = `${rect.left}px`;

    this.renderMenu();
    this.overlay.classList.remove("hidden");

    // Handle typing in the menu
    this.handleKeydown = this.handleKeydown.bind(this);
    document.addEventListener("keydown", this.handleKeydown, true);
  }

  hide(): void {
    this.overlay.classList.add("hidden");
    document.removeEventListener("keydown", this.handleKeydown, true);
  }

  destroy(): void {
    this.hide();
    this.overlay.remove();
  }

  private renderMenu(): void {
    const items = this.filteredItems;
    let html = `<div class="it-slash-search">
      <span class="it-slash-search__icon">🔍</span>
      <span class="it-slash-search__text">/${this.escapeHtml(this.filter)}</span>
    </div>`;

    let currentCategory = "";
    items.forEach((item, i) => {
      if (item.category !== currentCategory) {
        currentCategory = item.category;
        html += `<div class="it-slash-category">${this.escapeHtml(currentCategory)}</div>`;
      }
      const selected =
        i === this.selectedIndex ? "it-slash-item--selected" : "";
      html += `<div class="it-slash-item ${selected}" data-index="${i}" data-type="${item.type}">
        <span class="it-slash-item__icon">${item.icon}</span>
        <span class="it-slash-item__label">${this.escapeHtml(item.label)}</span>
        <span class="it-slash-item__desc">${this.escapeHtml(item.description)}</span>
      </div>`;
    });

    if (items.length === 0) {
      html += `<div class="it-slash-empty">No matching commands</div>`;
    }

    this.menu.innerHTML = html;

    // Click on items
    this.menu.querySelectorAll(".it-slash-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt((el as HTMLElement).dataset.index!);
        this.selectItem(idx);
      });
    });

    // Scroll selected into view
    const selectedEl = this.menu.querySelector(".it-slash-item--selected");
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.min(
        this.selectedIndex + 1,
        this.filteredItems.length - 1,
      );
      this.renderMenu();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.renderMenu();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      this.selectItem(this.selectedIndex);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      if (this.filter.length > 0) {
        this.filter = this.filter.slice(0, -1);
        this.applyFilter();
      } else {
        this.hide();
      }
      return;
    }

    // Character keys → filter
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      this.filter += e.key;
      this.applyFilter();
    }
  };

  private applyFilter(): void {
    const query = this.filter.toLowerCase();
    this.filteredItems = this.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query),
    );
    this.selectedIndex = 0;
    this.renderMenu();
  }

  private selectItem(index: number): void {
    const item = this.filteredItems[index];
    if (!item) return;
    this.hide();
    this.onSelect(this.blockId, item.type);
  }

  private escapeHtml(text: string): string {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }
}
