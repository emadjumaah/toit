// ── Block Renderer ──────────────────────────────────────────
// Renders a single IntentBlock into an HTMLElement for the WYSIWYG editor.

import type { IntentBlock } from "@intenttext/core";
import { DOCUMENT_SETTING_TYPES } from "./block-schemas";

/** Escape HTML entities */
function esc(text: string): string {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

/** Render inline nodes to HTML string */
function renderInline(block: IntentBlock): string {
  if (!block.inline || block.inline.length === 0)
    return esc(block.content ?? "");
  return block.inline
    .map((n) => {
      switch (n.type) {
        case "bold":
          return `<strong>${esc(n.value)}</strong>`;
        case "italic":
          return `<em>${esc(n.value)}</em>`;
        case "strike":
          return `<s>${esc(n.value)}</s>`;
        case "code":
          return `<code>${esc(n.value)}</code>`;
        case "highlight":
          return `<mark>${esc(n.value)}</mark>`;
        case "link":
          return `<a href="${esc(n.href)}">${esc(n.value)}</a>`;
        default:
          return esc((n as { value: string }).value ?? "");
      }
    })
    .join("");
}

/** Format properties as pipe badges HTML */
function renderPropBadges(block: IntentBlock): string {
  const props = block.properties;
  if (!props || Object.keys(props).length === 0) return "";
  const badges = Object.entries(props)
    .filter(([, v]) => v != null && String(v).trim())
    .map(
      ([k, v]) =>
        `<span class="it-prop-badge" data-prop-key="${esc(k)}">${esc(k)}: ${esc(String(v))}</span>`,
    )
    .join("");
  return badges ? `<div class="it-block__props">${badges}</div>` : "";
}

/** Icon map for block types */
const TYPE_ICONS: Record<string, string> = {
  task: "☐",
  done: "☑",
  ask: "?",
  info: "ℹ",
  warning: "⚠",
  tip: "💡",
  success: "✓",
  step: "▶",
  decision: "◆",
  gate: "🔒",
  checkpoint: "🏁",
  error: "✕",
  wait: "⏳",
  parallel: "⇉",
  retry: "↻",
  audit: "📋",
  emit: "📡",
  result: "✓",
  handoff: "→",
  call: "ƒ",
  trigger: "⚡",
};

/** Check if block type is a document-level setting */
export function isDocumentSetting(type: string): boolean {
  return DOCUMENT_SETTING_TYPES.includes(type);
}

/** Create the HTMLElement for a single block in the WYSIWYG editor */
export function renderBlockElement(block: IntentBlock): HTMLElement {
  const el = document.createElement("div");
  const blockType = block.type;
  el.className = `it-block it-block--${blockType}`;
  el.dataset.blockType = blockType;
  el.dataset.blockId = block.id;

  // Special cases
  if (blockType === "divider") {
    el.innerHTML = `<hr class="it-block__divider" />`;
    return el;
  }

  if (block.content?.startsWith("//") && blockType === "note") {
    el.innerHTML = `<div class="it-block__comment">${esc(block.content ?? "")}</div>`;
    return el;
  }

  // Type indicator
  const indicator = document.createElement("span");
  indicator.className = "it-block__type-indicator";
  const icon = TYPE_ICONS[blockType];
  indicator.textContent = icon ? `${icon} ${blockType}:` : `${blockType}:`;
  el.appendChild(indicator);

  // Content area
  const content = document.createElement("div");
  content.className = "it-block__content";
  content.contentEditable = "true";
  content.setAttribute("spellcheck", "true");
  content.innerHTML = renderInline(block);
  el.appendChild(content);

  // Special rendering for certain types
  if (blockType === "task") {
    el.classList.add("it-block--has-checkbox");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "it-block__checkbox";
    cb.tabIndex = -1;
    el.insertBefore(cb, content);
  } else if (blockType === "done") {
    el.classList.add("it-block--has-checkbox");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "it-block__checkbox";
    cb.checked = true;
    cb.tabIndex = -1;
    el.insertBefore(cb, content);
  } else if (blockType === "code") {
    content.classList.add("it-block__code-content");
  } else if (blockType === "toc") {
    content.contentEditable = "false";
    content.innerHTML = "<em>Table of Contents</em>";
  }

  // Property badges
  const badges = renderPropBadges(block);
  if (badges) {
    const badgesContainer = document.createElement("div");
    badgesContainer.innerHTML = badges;
    el.appendChild(badgesContainer.firstElementChild!);
  }

  return el;
}

/** Render the document settings header bar */
export function renderDocSettingsBar(blocks: IntentBlock[]): HTMLElement {
  const settingBlocks = blocks.filter((b) => isDocumentSetting(b.type));
  const bar = document.createElement("div");
  bar.className = "it-doc-settings";

  if (settingBlocks.length === 0) {
    bar.classList.add("it-doc-settings--empty");
    return bar;
  }

  const summary: string[] = [];
  for (const b of settingBlocks) {
    const props = b.properties ?? {};
    if (b.type === "page") {
      const parts: string[] = [];
      if (props.size) parts.push(String(props.size));
      if (props.margins) parts.push(`margins: ${props.margins}`);
      summary.push(parts.join(" · ") || "page");
    } else if (b.type === "font") {
      const parts: string[] = [];
      if (props.family) parts.push(String(props.family));
      if (props.size) parts.push(String(props.size));
      summary.push(parts.join(" ") || "font");
    } else {
      summary.push(`${b.type}: ${b.content ?? "..."}`);
    }
  }

  bar.innerHTML = `
    <div class="it-doc-settings__summary">
      <span class="it-doc-settings__icon">⚙</span>
      <span class="it-doc-settings__text">${esc(summary.join(" · "))}</span>
      <button class="it-doc-settings__toggle" type="button">Edit Settings ▾</button>
    </div>
    <div class="it-doc-settings__panel hidden"></div>
  `;

  return bar;
}
