// ── Property Panel ──────────────────────────────────────────
// Inline panel for editing block pipe properties.

import type { IntentBlock } from "@intenttext/core";
import { BLOCK_SCHEMAS, type PropertySchema } from "./block-schemas";

export type PropertySaveCallback = (
  blockId: string,
  props: Record<string, string>,
) => void;

export class PropertyPanel {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private blockId: string = "";
  private onSave: PropertySaveCallback;

  constructor(onSave: PropertySaveCallback) {
    this.onSave = onSave;

    this.overlay = document.createElement("div");
    this.overlay.className = "it-property-overlay hidden";
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.panel = document.createElement("div");
    this.panel.className = "it-property-panel";
    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);
  }

  show(anchorEl: HTMLElement, block: IntentBlock): void {
    this.blockId = block.id;
    const blockType = block.type;
    const schemas = BLOCK_SCHEMAS[blockType] ?? [];
    const currentProps = block.properties ?? {};

    // Position near the block
    const rect = anchorEl.getBoundingClientRect();
    this.panel.style.top = `${rect.bottom + 4}px`;
    this.panel.style.left = `${Math.max(rect.left, 20)}px`;
    this.panel.style.maxWidth = `${Math.min(rect.width + 100, 500)}px`;

    this.renderPanel(blockType, schemas, currentProps);
    this.overlay.classList.remove("hidden");

    // Focus first input
    const firstInput = this.panel.querySelector("input, select") as HTMLElement;
    if (firstInput) firstInput.focus();

    // Handle Escape
    this.handleKeydown = this.handleKeydown.bind(this);
    document.addEventListener("keydown", this.handleKeydown);
  }

  hide(): void {
    this.overlay.classList.add("hidden");
    document.removeEventListener("keydown", this.handleKeydown);
  }

  destroy(): void {
    this.hide();
    this.overlay.remove();
  }

  private renderPanel(
    blockType: string,
    schemas: PropertySchema[],
    currentProps: Record<string, string | number>,
  ): void {
    let html = `<div class="it-property-panel__header">${this.escapeHtml(blockType)} properties</div>`;
    html += `<div class="it-property-panel__fields">`;

    for (const schema of schemas) {
      const value =
        currentProps[schema.key] != null
          ? String(currentProps[schema.key])
          : "";

      if (schema.type === "select" && schema.options) {
        html += `<div class="it-property-field">
          <label class="it-property-field__label">${this.escapeHtml(schema.label)}</label>
          <select class="it-property-field__input" data-key="${schema.key}">
            <option value="">—</option>
            ${schema.options.map((opt) => `<option value="${this.escapeHtml(opt)}" ${opt === value ? "selected" : ""}>${this.escapeHtml(opt)}</option>`).join("")}
          </select>
        </div>`;
      } else {
        html += `<div class="it-property-field">
          <label class="it-property-field__label">${this.escapeHtml(schema.label)}</label>
          <input class="it-property-field__input" data-key="${schema.key}"
            type="text"
            value="${this.escapeHtml(value)}"
            placeholder="${this.escapeHtml(schema.placeholder ?? "")}" />
        </div>`;
      }
    }

    html += `</div>`;
    html += `<div class="it-property-panel__actions">
      <button class="it-property-btn it-property-btn--done" type="button">Done</button>
      <button class="it-property-btn it-property-btn--cancel" type="button">Cancel</button>
    </div>`;

    this.panel.innerHTML = html;

    // Bind buttons
    this.panel
      .querySelector(".it-property-btn--done")!
      .addEventListener("click", () => this.save());
    this.panel
      .querySelector(".it-property-btn--cancel")!
      .addEventListener("click", () => this.hide());
  }

  private save(): void {
    const inputs = this.panel.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("[data-key]");
    const props: Record<string, string> = {};
    inputs.forEach((input) => {
      const key = input.dataset.key!;
      const val = input.value.trim();
      if (val) props[key] = val;
    });
    this.hide();
    this.onSave(this.blockId, props);
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.save();
    }
  };

  private escapeHtml(text: string): string {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }
}
