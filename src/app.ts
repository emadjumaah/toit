import * as monaco from "monaco-editor";
import {
  parseIntentText,
  renderHTML,
  convertMarkdownToIntentText,
} from "@intenttext/core";
import { convertHtmlToIntentText } from "./html-converter";

// Minimal blob worker
(window as any).MonacoEnvironment = {
  getWorker(_moduleId: string, _label: string): Worker {
    return new Worker(
      URL.createObjectURL(
        new Blob(["self.onmessage = function() {};"], {
          type: "application/javascript",
        }),
      ),
    );
  },
};

type Mode = "web-to-it" | "it-to-web";

const EXAMPLE_IT = `title: Project Kickoff Notes

section: Overview
note: This document demonstrates IntentText — a *human-readable*, _structured_ document format.
note: Every line begins with a keyword like *title:*, *note:*, or *task:*.

section: Action Items
task: Set up CI/CD pipeline | owner: Ahmed | due: 2026-03-15 | priority: high
task: Write API documentation | owner: Sarah | priority: medium
done: Repository setup | owner: Ahmed | time: 1h
[ ] Review architecture proposal @mike !high

section: Discussion
question: Should we use REST or GraphQL for the public API?
quote: Keep it simple — start with REST, add GraphQL later if needed.

info: All decisions are tracked in this document.
warning: Deadline for Phase 1 is March 31, 2026.
tip: Use pipe | to add metadata to any block.

---

| Feature | Status | Owner |
| Parser | Done | Ahmed |
| Renderer | Done | Sarah |
| Query Engine | Done | Mike |

summary: Kickoff complete. Next sync on Monday.`;

const EXAMPLE_MD = `# Project Kickoff Notes

## Overview

This document demonstrates IntentText — a **human-readable**, *structured* document format.

Every line begins with a keyword like **title:**, **note:**, or **task:**.

## Action Items

- [ ] Set up CI/CD pipeline
- [ ] Write API documentation
- [x] Repository setup

## Discussion

> Should we use REST or GraphQL for the public API?

---

| Feature | Status | Owner |
|---------|--------|-------|
| Parser | Done | Ahmed |
| Renderer | Done | Sarah |

*Kickoff complete. Next sync on Monday.*`;

export class IntentTextApp {
  private mode: Mode = "web-to-it";
  private inputItEditor!: monaco.editor.IStandaloneCodeEditor;
  private outputItEditor!: monaco.editor.IStandaloneCodeEditor;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.registerLanguage();
    this.initMonaco();
    this.bindEvents();
    this.setMode("web-to-it");
  }

  private registerLanguage(): void {
    monaco.languages.register({ id: "intenttext" });
    monaco.languages.setMonarchTokensProvider("intenttext", {
      tokenizer: {
        root: [
          [/^\/\/.*$/, "comment"],
          [/^---$/, "keyword.divider"],
          [/^```.*$/, "string"],
          [
            /^(title|section|sub|subsection|note|task|done|ask|question|quote|image|link|ref|summary|info|warning|tip|success|headers|row|embed|code|end):/,
            "keyword",
          ],
          [/^\[[ x]\]/, "keyword"],
          [/\|/, "operator"],
          [/\*[^*\n]+\*/, "strong"],
          [/_[^_\n]+_/, "emphasis"],
          [/~[^~\n]+~/, "invalid.deprecated"],
          [/`[^`\n]+`/, "string.code"],
          [/\[[^\]]+\]\([^)]+\)/, "string.link"],
        ],
      },
    });
    monaco.editor.defineTheme("it-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "5b21b6", fontStyle: "bold" },
        { token: "keyword.divider", foreground: "94a3b8" },
        { token: "comment", foreground: "94a3b8", fontStyle: "italic" },
        { token: "operator", foreground: "cbd5e1" },
        { token: "strong", foreground: "0f172a", fontStyle: "bold" },
        { token: "emphasis", foreground: "475569", fontStyle: "italic" },
        { token: "string", foreground: "15803d" },
        { token: "string.code", foreground: "7c3aed" },
        { token: "string.link", foreground: "4f46e5" },
        { token: "invalid.deprecated", foreground: "9f1239" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.lineHighlightBackground": "#f8fafc",
      },
    });
  }

  private monacoOptions(
    readOnly: boolean,
  ): monaco.editor.IStandaloneEditorConstructionOptions {
    return {
      language: "intenttext",
      theme: "it-light",
      readOnly,
      fontSize: 13,
      lineHeight: 21,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      renderLineHighlight: "line",
      padding: { top: 14, bottom: 14 },
      fontFamily: '"Monaco", "Menlo", "Consolas", monospace',
      scrollbar: {
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
      },
    };
  }

  private initMonaco(): void {
    this.outputItEditor = monaco.editor.create(
      document.getElementById("it-output-editor")!,
      this.monacoOptions(true),
    );
    this.inputItEditor = monaco.editor.create(
      document.getElementById("it-input-editor")!,
      this.monacoOptions(false),
    );
    this.inputItEditor.onDidChangeModelContent(() => {
      if (this.mode === "it-to-web") {
        this.debounce(() => this.convertItToWeb(), 300);
      }
    });
  }

  private bindEvents(): void {
    // Mode toggle
    document
      .querySelectorAll<HTMLElement>(".mode-btn[data-mode]")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.setMode(btn.dataset.mode as Mode),
        );
      });

    // Tab switching
    document.querySelectorAll<HTMLElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab(btn));
    });

    // HTML editor
    const htmlEditor = document.getElementById("html-editor")!;
    htmlEditor.addEventListener("paste", (e) =>
      this.handleHtmlPaste(e as ClipboardEvent),
    );
    htmlEditor.addEventListener("input", () =>
      this.debounce(() => this.convertWebToIt(), 300),
    );

    // Markdown input
    document
      .getElementById("md-input-area")!
      .addEventListener("input", () =>
        this.debounce(() => this.convertWebToIt(), 300),
      );

    // Toolbar
    document
      .getElementById("clear-btn")!
      .addEventListener("click", () => this.clear());
    document
      .getElementById("copy-btn")!
      .addEventListener("click", () => this.copy());
    document
      .getElementById("download-btn")!
      .addEventListener("click", () => this.download());
    document
      .getElementById("example-btn")!
      .addEventListener("click", () => this.loadExample());

    this.setupDragDrop();

    window.addEventListener("resize", () => {
      this.inputItEditor.layout();
      this.outputItEditor.layout();
    });
  }

  /* ------------------------------------------------------------ *
   *  Mode & tab management
   * ------------------------------------------------------------ */

  private setMode(mode: Mode): void {
    this.mode = mode;

    // Toggle mode buttons
    document
      .querySelectorAll<HTMLElement>(".mode-btn[data-mode]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.mode === mode),
      );

    const isWti = mode === "web-to-it";

    // Show / hide tab groups
    document.getElementById("wti-input-tabs")!.hidden = !isWti;
    document.getElementById("itw-input-tabs")!.hidden = isWti;
    document.getElementById("wti-output-tabs")!.hidden = !isWti;
    document.getElementById("itw-output-tabs")!.hidden = isWti;

    // Deactivate all panes and tab buttons
    document
      .querySelectorAll<HTMLElement>(".tab-pane")
      .forEach((p) => p.classList.remove("active"));
    document
      .querySelectorAll<HTMLElement>(".tab-btn[data-tab]")
      .forEach((btn) => btn.classList.remove("active"));

    // Activate defaults for the selected mode
    if (isWti) {
      this.activatePane("pane-html-input");
      this.activatePane("pane-it-output");
      this.activateFirstTabBtn("wti-input-tabs");
      this.activateFirstTabBtn("wti-output-tabs");
    } else {
      this.activatePane("pane-it-input");
      this.activatePane("pane-html-output");
      this.activateFirstTabBtn("itw-input-tabs");
      this.activateFirstTabBtn("itw-output-tabs");
    }

    document.getElementById("download-btn")!.textContent = isWti
      ? "Download .it"
      : "Download";

    requestAnimationFrame(() => {
      this.inputItEditor.layout();
      this.outputItEditor.layout();
      if (isWti) this.convertWebToIt();
      else this.convertItToWeb();
    });
  }

  private activatePane(paneId: string): void {
    document.getElementById(paneId)?.classList.add("active");
  }

  private activateFirstTabBtn(tabsId: string): void {
    document
      .querySelector<HTMLElement>(`#${tabsId} .tab-btn`)
      ?.classList.add("active");
  }

  private switchTab(btn: HTMLElement): void {
    const targetPane = btn.dataset.tab!;
    const tabsContainer = btn.parentElement!;

    // Deactivate sibling tab buttons
    tabsContainer
      .querySelectorAll<HTMLElement>(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Deactivate sibling panes within the same panel & mode
    const panel = tabsContainer.closest(".panel")!;
    const modeAttr = this.mode === "web-to-it" ? "wti" : "itw";
    panel
      .querySelectorAll<HTMLElement>(`.tab-pane[data-mode="${modeAttr}"]`)
      .forEach((p) => p.classList.remove("active"));

    document.getElementById(targetPane)?.classList.add("active");

    requestAnimationFrame(() => {
      this.inputItEditor.layout();
      this.outputItEditor.layout();
    });

    // Render preview if switching to a preview tab
    if (targetPane === "pane-it-input-preview") this.renderInputPreview();
    else if (targetPane === "pane-it-output-preview")
      this.renderOutputPreview();
  }

  /* ------------------------------------------------------------ *
   *  Conversion logic
   * ------------------------------------------------------------ */

  private convertWebToIt(): void {
    let itText = "";
    const htmlActive = document
      .getElementById("pane-html-input")!
      .classList.contains("active");

    if (htmlActive) {
      const html = document.getElementById("html-editor")!.innerHTML;
      if (html && html !== "<br>") itText = convertHtmlToIntentText(html);
    } else {
      const md = (
        document.getElementById("md-input-area") as HTMLTextAreaElement
      ).value;
      if (md.trim()) itText = convertMarkdownToIntentText(md);
    }

    this.outputItEditor.setValue(itText);
    this.updateStats(itText);

    if (
      document
        .getElementById("pane-it-output-preview")!
        .classList.contains("active")
    ) {
      this.renderOutputPreview();
    }
  }

  private convertItToWeb(): void {
    const itText = this.inputItEditor.getValue();

    if (!itText.trim()) {
      document.getElementById("html-output-content")!.innerHTML = "";
      (document.getElementById("md-output-area") as HTMLTextAreaElement).value =
        "";
      this.updateStats("");
      return;
    }

    try {
      const doc = parseIntentText(itText);
      document.getElementById("html-output-content")!.innerHTML =
        renderHTML(doc);
      (document.getElementById("md-output-area") as HTMLTextAreaElement).value =
        this.convertToMarkdown(doc);
      this.updateStats(itText);
    } catch (err) {
      console.error("Parse error:", err);
    }
  }

  private convertToMarkdown(doc: any): string {
    const lines: string[] = [];
    if (!doc.blocks) return "";

    for (const block of doc.blocks) {
      const props = block.properties || {};
      switch (block.type) {
        case "title":
          lines.push(`# ${block.content}`, "");
          break;
        case "section":
          lines.push(`## ${block.content}`, "");
          break;
        case "sub":
          lines.push(`### ${block.content}`, "");
          break;
        case "note":
        case "body-text":
          lines.push(block.content, "");
          break;
        case "task": {
          const meta = this.fmtProps(props, ["owner", "due", "priority"]);
          lines.push(`- [ ] ${block.content}${meta}`);
          break;
        }
        case "done": {
          const meta = this.fmtProps(props, ["owner", "time"]);
          lines.push(`- [x] ${block.content}${meta}`);
          break;
        }
        case "question":
        case "ask":
          lines.push(`> **Q:** ${block.content}`, "");
          break;
        case "quote":
          lines.push(`> ${block.content}`, "");
          break;
        case "summary":
          lines.push(`> **Summary:** ${block.content}`, "");
          break;
        case "code":
          lines.push("```");
          if (block.content) lines.push(block.content);
          lines.push("```", "");
          break;
        case "link":
          lines.push(`[${block.content}](${props.to || ""})`, "");
          break;
        case "image":
          lines.push(`![${block.content}](${props.at || ""})`, "");
          break;
        case "info":
          lines.push(`> **ℹ️ Info:** ${block.content}`, "");
          break;
        case "warning":
          lines.push(`> **⚠️ Warning:** ${block.content}`, "");
          break;
        case "tip":
          lines.push(`> **💡 Tip:** ${block.content}`, "");
          break;
        case "success":
          lines.push(`> **✅ Success:** ${block.content}`, "");
          break;
        case "table":
          if (block.table) {
            const { headers, rows } = block.table;
            if (headers?.length) {
              lines.push(`| ${headers.join(" | ")} |`);
              lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
            }
            for (const row of rows || []) lines.push(`| ${row.join(" | ")} |`);
            lines.push("");
          }
          break;
        case "divider":
          lines.push("---", "");
          break;
        default:
          if (block.content) lines.push(block.content, "");
      }
    }
    return lines.join("\n").trim();
  }

  private fmtProps(props: Record<string, string>, keys: string[]): string {
    const parts = keys.filter((k) => props[k]).map((k) => `${k}: ${props[k]}`);
    return parts.length ? ` *(${parts.join(", ")})* ` : "";
  }

  /* ------------------------------------------------------------ *
   *  Preview rendering
   * ------------------------------------------------------------ */

  private renderInputPreview(): void {
    const itText = this.inputItEditor.getValue();
    const el = document.getElementById("input-preview")!;
    if (!itText.trim()) {
      el.innerHTML =
        '<p class="preview-empty">Preview will appear here once you add content…</p>';
      return;
    }
    el.innerHTML = renderHTML(parseIntentText(itText));
  }

  private renderOutputPreview(): void {
    const itText = this.outputItEditor.getValue();
    const el = document.getElementById("output-preview")!;
    if (!itText.trim()) {
      el.innerHTML =
        '<p class="preview-empty">Preview will appear here once you add content…</p>';
      return;
    }
    el.innerHTML = renderHTML(parseIntentText(itText));
  }

  /* ------------------------------------------------------------ *
   *  Stats
   * ------------------------------------------------------------ */

  private updateStats(itText: string): void {
    const doc = itText.trim() ? parseIntentText(itText) : null;
    const blocks = doc?.blocks.length ?? 0;
    const lineCount = itText.split("\n").filter((l) => l.trim()).length;
    document.getElementById("stats-bar")!.textContent =
      `${blocks} blocks · ${lineCount} lines · ${itText.length} chars`;
  }

  /* ------------------------------------------------------------ *
   *  Paste handling
   * ------------------------------------------------------------ */

  private handleHtmlPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const htmlEditor = document.getElementById("html-editor")!;
    const html = e.clipboardData?.getData("text/html") || "";
    const text = e.clipboardData?.getData("text/plain") || "";

    if (html) {
      this.insertHtmlAtCursor(htmlEditor, html);
      requestAnimationFrame(() => {
        const current = htmlEditor.innerHTML;
        const sanitized = this.sanitize(current);
        if (sanitized !== current) htmlEditor.innerHTML = sanitized;
        this.convertWebToIt();
      });
    } else if (text) {
      this.insertHtmlAtCursor(
        htmlEditor,
        text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>"),
      );
      requestAnimationFrame(() => this.convertWebToIt());
    }
  }

  /* ------------------------------------------------------------ *
   *  Toolbar actions
   * ------------------------------------------------------------ */

  private clear(): void {
    if (this.mode === "web-to-it") {
      document.getElementById("html-editor")!.innerHTML = "";
      (document.getElementById("md-input-area") as HTMLTextAreaElement).value =
        "";
      this.outputItEditor.setValue("");
    } else {
      this.inputItEditor.setValue("");
      document.getElementById("html-output-content")!.innerHTML = "";
      (document.getElementById("md-output-area") as HTMLTextAreaElement).value =
        "";
    }
    this.updateStats("");
  }

  private async copy(): Promise<void> {
    let text = "";
    if (this.mode === "web-to-it") {
      text = this.outputItEditor.getValue();
    } else if (
      document.getElementById("pane-html-output")!.classList.contains("active")
    ) {
      text = document.getElementById("html-output-content")!.innerHTML;
    } else {
      text = (document.getElementById("md-output-area") as HTMLTextAreaElement)
        .value;
    }
    if (!text) return;
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById("copy-btn")!;
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("success");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("success");
    }, 1500);
  }

  private download(): void {
    let content = "",
      filename = "",
      mimeType = "";

    if (this.mode === "web-to-it") {
      content = this.outputItEditor.getValue();
      filename = "document.it";
      mimeType = "text/plain";
    } else if (
      document.getElementById("pane-html-output")!.classList.contains("active")
    ) {
      content = document.getElementById("html-output-content")!.innerHTML;
      filename = "document.html";
      mimeType = "text/html";
    } else {
      content = (
        document.getElementById("md-output-area") as HTMLTextAreaElement
      ).value;
      filename = "document.md";
      mimeType = "text/markdown";
    }
    if (!content) return;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private loadExample(): void {
    if (this.mode === "web-to-it") {
      const mdBtn = document.querySelector<HTMLElement>(
        '[data-tab="pane-md-input"]',
      )!;
      this.switchTab(mdBtn);
      (document.getElementById("md-input-area") as HTMLTextAreaElement).value =
        EXAMPLE_MD;
      this.convertWebToIt();
    } else {
      this.inputItEditor.setValue(EXAMPLE_IT);
    }
  }

  /* ------------------------------------------------------------ *
   *  Drag & drop
   * ------------------------------------------------------------ */

  private setupDragDrop(): void {
    const inputPanel = document.getElementById("input-panel")!;
    let dragCounter = 0;

    inputPanel.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      inputPanel.classList.add("drag-over");
    });

    inputPanel.addEventListener("dragleave", () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        inputPanel.classList.remove("drag-over");
      }
    });

    inputPanel.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    inputPanel.addEventListener("drop", async (e) => {
      e.preventDefault();
      dragCounter = 0;
      inputPanel.classList.remove("drag-over");

      const file = e.dataTransfer?.files[0];
      if (!file) return;
      const text = await file.text();

      if (this.mode === "web-to-it") {
        if (file.name.endsWith(".md") || file.name.endsWith(".markdown")) {
          const mdBtn = document.querySelector<HTMLElement>(
            '[data-tab="pane-md-input"]',
          )!;
          this.switchTab(mdBtn);
          (
            document.getElementById("md-input-area") as HTMLTextAreaElement
          ).value = text;
        } else {
          const htmlBtn = document.querySelector<HTMLElement>(
            '[data-tab="pane-html-input"]',
          )!;
          this.switchTab(htmlBtn);
          document.getElementById("html-editor")!.innerText = text;
        }
        this.convertWebToIt();
      } else {
        this.inputItEditor.setValue(text);
      }
    });
  }

  /* ------------------------------------------------------------ *
   *  Utilities
   * ------------------------------------------------------------ */

  private sanitize(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    div
      .querySelectorAll("script, style, meta, link, noscript")
      .forEach((el) => el.remove());
    div.querySelectorAll("*").forEach((el) => {
      const keep = [
        "href",
        "src",
        "alt",
        "title",
        "colspan",
        "rowspan",
        "type",
        "checked",
      ];
      for (const attr of [...el.attributes]) {
        if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
      }
      const href = el.getAttribute("href");
      if (href && /^(javascript|data):/i.test(href)) el.removeAttribute("href");
    });
    return div.innerHTML;
  }

  private insertHtmlAtCursor(container: HTMLElement, html: string): void {
    container.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      container.insertAdjacentHTML("beforeend", html);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      container.insertAdjacentHTML("beforeend", html);
      return;
    }
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
  }

  private debounce(fn: () => void, delay: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(fn, delay);
  }
}
