import * as monaco from "monaco-editor";
import {
  parseIntentText,
  renderHTML,
  convertMarkdownToIntentText,
  queryBlocks,
} from "@intenttext/core";
import type { IntentDocument, IntentBlock } from "@intenttext/core";
import { convertHtmlToIntentText } from "./html-converter";
import { TEMPLATES } from "./templates";

// ── Constants ──────────────────────────────────────────────
const AUTOSAVE_KEY = "intenttext-doc";
const AUTOSAVE_DELAY = 800; // ms

// ── Monaco language registration ───────────────────────────
function registerIntentTextLanguage(): void {
  monaco.languages.register({ id: "intenttext" });

  monaco.languages.setMonarchTokensProvider("intenttext", {
    tokenizer: {
      root: [
        // Structural keywords
        [/^(title|section|sub):/, "keyword.structure"],
        // Task keywords
        [/^(task|done):/, "keyword.task"],
        // Checkbox shorthand
        [/^\[[ x]\]/, "keyword.task"],
        // Agentic keywords (v2)
        [
          /^(step|decision|trigger|loop|checkpoint|audit|error|context):/,
          "keyword.agentic",
        ],
        // Inter-agent keywords (v2.1)
        [/^(handoff|wait|parallel|retry|result|status):/, "keyword.interagent"],
        // Content keywords
        [/^(note|quote|summary|question|ask):/, "keyword.content"],
        // Callout keywords
        [/^(info|warning|tip|success):/, "keyword.callout"],
        // Media & link keywords
        [/^(link|image|code|end):/, "keyword.media"],
        // Divider
        [/^---+$/, "keyword.divider"],
        // Table rows
        [/^\|/, "keyword.table"],
        // Metadata pipes
        [/\|/, "delimiter.pipe"],
        // Metadata keys
        [
          /\b(owner|due|priority|time|status|at|to|caption|tool|input|depends|id|event|if|then|else|over|do|fallback|notify|from|timeout|max|delay|backoff|steps|code|data|phase|level|model|agent|retries)(?=:)/,
          "type.metadata",
        ],
        // Shorthand tokens
        [/@\w+/, "type.owner"],
        [/!\w+/, "type.priority"],
        // Inline formatting
        [/\*[^*]+\*/, "strong"],
        [/_[^_]+_/, "emphasis"],
        [/~[^~]+~/, "strikethrough"],
        [/`[^`]+`/, "string.code"],
        // Inline links [text](url)
        [/\[[^\]]+\]\([^)]+\)/, "string.link"],
        // Comments
        [/^\/\/.*$/, "comment"],
      ],
    },
  });

  monaco.editor.defineTheme("it-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword.structure", foreground: "6D28D9", fontStyle: "bold" },
      { token: "keyword.task", foreground: "D97706", fontStyle: "bold" },
      { token: "keyword.content", foreground: "2563EB" },
      { token: "keyword.callout", foreground: "059669", fontStyle: "bold" },
      { token: "keyword.agentic", foreground: "0369A1", fontStyle: "bold" },
      { token: "keyword.interagent", foreground: "9333EA", fontStyle: "bold" },
      { token: "keyword.media", foreground: "7C3AED" },
      { token: "keyword.divider", foreground: "9CA3AF" },
      { token: "keyword.table", foreground: "6366F1" },
      { token: "delimiter.pipe", foreground: "9CA3AF" },
      { token: "type.metadata", foreground: "0891B2" },
      { token: "type.owner", foreground: "DB2777" },
      { token: "type.priority", foreground: "DC2626" },
      { token: "strong", fontStyle: "bold" },
      { token: "emphasis", fontStyle: "italic" },
      { token: "strikethrough", foreground: "9CA3AF" },
      { token: "string.code", foreground: "059669" },
      { token: "string.link", foreground: "6D28D9" },
      { token: "comment", foreground: "9CA3AF", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#F8FAFC",
    },
  });
}

// ── Helper: IntentText to Markdown ─────────────────────────
function convertToMarkdown(doc: IntentDocument): string {
  const lines: string[] = [];

  // Collect metadata header if present
  const metaProps: string[] = [];
  if (doc.metadata) {
    const m = doc.metadata;
    if (m.agent) metaProps.push(`**Agent:** ${m.agent}`);
    if (m.model) metaProps.push(`**Model:** ${m.model}`);
    if (m.version) metaProps.push(`**Version:** ${m.version}`);
  }

  // Helper: format pipe-separated properties as inline metadata
  function fmtProps(props: Record<string, unknown>, keys: string[]): string {
    const parts: string[] = [];
    for (const k of keys) {
      if (props[k] != null && String(props[k]).trim()) {
        parts.push(`\`${k}: ${props[k]}\``);
      }
    }
    return parts.length ? "  " + parts.join("  ") : "";
  }

  for (const block of doc.blocks) {
    const content = block.content ?? "";
    const props = block.properties ?? {};

    switch (block.type) {
      // ── Structure ──
      case "title":
        lines.push(`# ${content}`);
        if (metaProps.length) {
          lines.push("");
          lines.push(metaProps.join(" · "));
        }
        break;
      case "section":
        lines.push(`\n## ${content}`);
        break;
      case "sub":
        lines.push(`\n### ${content}`);
        break;
      case "divider":
        lines.push("\n---\n");
        break;

      // ── Content ──
      case "note":
      case "body-text":
        lines.push(`\n${content}`);
        break;
      case "task": {
        const meta: string[] = [];
        if (props.owner) meta.push(`@${props.owner}`);
        if (props.due) meta.push(`due: ${props.due}`);
        if (props.priority) meta.push(`!${props.priority}`);
        const suffix = meta.length ? `  *(${meta.join(", ")})*` : "";
        lines.push(`- [ ] ${content}${suffix}`);
        break;
      }
      case "done": {
        const meta: string[] = [];
        if (props.owner) meta.push(`@${props.owner}`);
        if (props.time) meta.push(`${props.time}`);
        const suffix = meta.length ? `  *(${meta.join(", ")})*` : "";
        lines.push(`- [x] ~~${content}~~${suffix}`);
        break;
      }
      case "ask":
        lines.push(`\n> **❓ Question:** ${content}`);
        break;
      case "quote": {
        const cite = props.by ? `\n> — *${props.by}*` : "";
        lines.push(`\n> ${content}${cite}`);
        break;
      }
      case "summary":
        lines.push(`\n> **Summary:** ${content}`);
        break;

      // ── Callouts ──
      case "info":
        lines.push(`\n> **ℹ️ Info:** ${content}`);
        break;
      case "warning":
        lines.push(`\n> **⚠️ Warning:** ${content}`);
        break;
      case "tip":
        lines.push(`\n> **💡 Tip:** ${content}`);
        break;
      case "success":
        lines.push(`\n> **✅ Success:** ${content}`);
        break;

      // ── Media ──
      case "link":
        lines.push(`[${content}](${props.to ?? props.url ?? "#"})`);
        break;
      case "image":
        lines.push(
          `![${props.caption ?? content}](${props.at ?? props.src ?? ""})`,
        );
        break;
      case "code":
        lines.push("```");
        lines.push(content);
        lines.push("```");
        break;
      case "table":
        if (block.table) {
          if (block.table.headers) {
            lines.push(`\n| ${block.table.headers.join(" | ")} |`);
            lines.push(
              `| ${block.table.headers.map(() => "---").join(" | ")} |`,
            );
          }
          for (const row of block.table?.rows ?? []) {
            lines.push(`| ${row.join(" | ")} |`);
          }
        }
        break;

      // ── Agentic v2 ──
      case "step": {
        const meta = fmtProps(props, [
          "id",
          "tool",
          "input",
          "depends",
          "timeout",
          "status",
        ]);
        lines.push(`- ▶ **Step:** ${content}${meta}`);
        break;
      }
      case "decision": {
        const cond = props.if ? `\n  - if \`${props.if}\`` : "";
        const then_ = props.then ? ` → \`${props.then}\`` : "";
        const else_ = props.else ? ` · else → \`${props.else}\`` : "";
        lines.push(`- ◆ **Decision:** ${content}${cond}${then_}${else_}`);
        break;
      }
      case "trigger": {
        const meta = fmtProps(props, ["event"]);
        lines.push(`- ⚡ **Trigger:** ${content}${meta}`);
        break;
      }
      case "loop": {
        const over = props.over ? ` over \`${props.over}\`` : "";
        const do_ = props.do ? ` → \`${props.do}\`` : "";
        lines.push(`- 🔁 **Loop:** ${content}${over}${do_}`);
        break;
      }
      case "checkpoint":
        lines.push(`\n---  🏁 **Checkpoint:** ${content}  ---\n`);
        break;
      case "audit": {
        const by = props.by ? ` — *${props.by}*` : "";
        const at = props.at ? ` at ${props.at}` : "";
        lines.push(`> 📝 *Audit:* ${content}${by}${at}`);
        break;
      }
      case "error": {
        const fallback = props.fallback
          ? ` → fallback: \`${props.fallback}\``
          : "";
        const notify = props.notify ? ` · notify: ${props.notify}` : "";
        lines.push(`> ❌ **Error:** ${content}${fallback}${notify}`);
        break;
      }
      case "context": {
        // context blocks often hold key=value pairs
        lines.push(`> 🔧 *Context:* \`${content}\``);
        break;
      }
      case "progress": {
        lines.push(`> 📊 *Progress:* ${content}`);
        break;
      }

      // ── Inter-Agent v2.1 ──
      case "handoff": {
        const from = props.from ? `\`${props.from}\`` : "?";
        const to = props.to ? `\`${props.to}\`` : "?";
        lines.push(`- 🤝 **Handoff:** ${content}  ${from} → ${to}`);
        break;
      }
      case "wait": {
        const meta = fmtProps(props, ["timeout", "fallback"]);
        lines.push(`- ⏳ **Wait:** ${content}${meta}`);
        break;
      }
      case "parallel": {
        const steps = props.steps ? `  steps: \`${props.steps}\`` : "";
        lines.push(`- ⏩ **Parallel:** ${content}${steps}`);
        break;
      }
      case "retry": {
        const meta = fmtProps(props, ["max", "delay", "backoff"]);
        lines.push(`- 🔄 **Retry:** ${content}${meta}`);
        break;
      }
      case "result": {
        const code = props.code ? ` \`[${props.code}]\`` : "";
        const data = props.data
          ? `\n  \`\`\`json\n  ${props.data}\n  \`\`\``
          : "";
        lines.push(`- ✅ **Result:** ${content}${code}${data}`);
        break;
      }
      case "status": {
        const meta = fmtProps(props, ["phase", "level"]);
        lines.push(`> 📌 **Status:** ${content}${meta}`);
        break;
      }

      default:
        if (content) lines.push(content);
    }
  }
  return lines.join("\n").trim();
}

// ── Main App ───────────────────────────────────────────────
export class IntentTextApp {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private currentDoc: IntentDocument | null = null;
  private autosaveTimer: number | null = null;
  private queryOpen = false;
  private importMode: "markdown" | "html" = "markdown";

  constructor() {
    registerIntentTextLanguage();
    this.createEditor();
    this.bindEvents();
    this.buildTemplateMenu();
    this.loadAutosave();
    this.updatePreview();

    // Resize Monaco on window resize
    window.addEventListener("resize", () => this.editor.layout());
  }

  // ── Editor setup ──────────────────────────────────────────
  private createEditor(): void {
    const container = document.getElementById("monaco-editor")!;
    this.editor = monaco.editor.create(container, {
      value: "",
      language: "intenttext",
      theme: "it-light",
      fontSize: 14,
      lineHeight: 22,
      fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
      minimap: { enabled: false },
      wordWrap: "on",
      padding: { top: 12, bottom: 12 },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      renderLineHighlight: "line",
      suggestOnTriggerCharacters: false,
      quickSuggestions: false,
      tabSize: 2,
      lineNumbers: "off",
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 8,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
    });

    // Live preview on change
    this.editor.onDidChangeModelContent(() => {
      this.updatePreview();
      this.scheduleAutosave();
    });
  }

  // ── Bind all UI events ────────────────────────────────────
  private bindEvents(): void {
    // Keyword toolbar
    document
      .getElementById("keyword-toolbar")!
      .addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest(
          ".kw-btn",
        ) as HTMLElement | null;
        if (btn) {
          const kw = btn.dataset.kw ?? "";
          this.insertAtCursor(kw);
        }
      });

    // New / template dropdown
    this.setupDropdown("new-btn", "new-menu");

    // Export dropdown
    this.setupDropdown("export-btn", "export-menu");
    document.getElementById("export-menu")!.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(
        "[data-export]",
      ) as HTMLElement | null;
      if (item) {
        this.handleExport(item.dataset.export!);
        this.closeDropdowns();
      }
    });

    // Open file
    document
      .getElementById("open-btn")!
      .addEventListener("click", () => this.openFile());

    // Save file
    document
      .getElementById("save-btn")!
      .addEventListener("click", () => this.saveFile());

    // Import
    document
      .getElementById("import-btn")!
      .addEventListener("click", () => this.showModal("import-modal"));
    document
      .getElementById("import-close")!
      .addEventListener("click", () => this.hideModal("import-modal"));
    document
      .getElementById("import-cancel")!
      .addEventListener("click", () => this.hideModal("import-modal"));
    document
      .getElementById("import-confirm")!
      .addEventListener("click", () => this.handleImport());

    // Import tabs
    document.querySelectorAll(".import-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll(".import-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.importMode = (tab as HTMLElement).dataset.import as
          | "markdown"
          | "html";
        const textarea = document.getElementById(
          "import-input",
        ) as HTMLTextAreaElement;
        textarea.placeholder =
          this.importMode === "html"
            ? "Paste your HTML here\u2026"
            : "Paste your Markdown here\u2026";
      });
    });

    // Query panel
    document
      .getElementById("query-btn")!
      .addEventListener("click", () => this.toggleQuery());
    document
      .getElementById("query-close")!
      .addEventListener("click", () => this.toggleQuery());
    document
      .getElementById("query-apply")!
      .addEventListener("click", () => this.runQuery());

    // Help modal
    document
      .getElementById("help-btn")!
      .addEventListener("click", () => this.showModal("help-modal"));
    document
      .getElementById("help-close")!
      .addEventListener("click", () => this.hideModal("help-modal"));

    // Modal overlay click-to-close
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          (overlay as HTMLElement).classList.add("hidden");
        }
      });
    });

    // Preview tabs
    document.querySelectorAll(".preview-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = (tab as HTMLElement).dataset.preview!;
        document
          .querySelectorAll(".preview-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        document
          .querySelectorAll(".preview-content")
          .forEach((c) => c.classList.remove("active"));
        document
          .querySelector(`.preview-content[data-preview="${target}"]`)!
          .classList.add("active");
      });
    });

    // Close dropdowns on outside click
    document.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest(".dropdown")) {
        this.closeDropdowns();
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        this.saveFile();
      }
      if (e.key === "Escape") {
        this.closeDropdowns();
        document
          .querySelectorAll(".modal-overlay")
          .forEach((m) => m.classList.add("hidden"));
      }
    });

    // Resize handle
    this.setupResizeHandle();
  }

  // ── Dropdown helper ───────────────────────────────────────
  private setupDropdown(btnId: string, menuId: string): void {
    const btn = document.getElementById(btnId)!;
    const menu = document.getElementById(menuId)!;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains("open");
      this.closeDropdowns();
      if (!isOpen) menu.classList.add("open");
    });
  }

  private closeDropdowns(): void {
    document
      .querySelectorAll(".dropdown-menu")
      .forEach((m) => m.classList.remove("open"));
  }

  // ── Template menu ─────────────────────────────────────────
  private buildTemplateMenu(): void {
    const menu = document.getElementById("new-menu")!;
    menu.innerHTML = "";

    const categoryLabels: Record<string, string> = {
      agent: "🤖 Agent Workflows",
      human: "👤 Human Documents",
      docs: "📄 Docs & Planning",
    };

    const categories = ["agent", "human", "docs"];
    for (const cat of categories) {
      const catTemplates = TEMPLATES.filter((t) => t.category === cat);
      if (catTemplates.length === 0) continue;

      const header = document.createElement("div");
      header.className = "dropdown-header";
      header.textContent = categoryLabels[cat] ?? cat;
      menu.appendChild(header);

      for (const tpl of catTemplates) {
        const item = document.createElement("button");
        item.className = "dropdown-item";
        item.innerHTML = `<span class="template-icon">${tpl.icon}</span>${tpl.name}<span class="template-desc">${tpl.description}</span>`;
        item.addEventListener("click", () => {
          this.editor.setValue(tpl.content);
          this.editor.setPosition({ lineNumber: 1, column: 1 });
          this.editor.focus();
          this.closeDropdowns();
        });
        menu.appendChild(item);
      }
    }
  }

  // ── Insert at cursor ──────────────────────────────────────
  private insertAtCursor(text: string): void {
    const position = this.editor.getPosition();
    if (!position) return;

    const model = this.editor.getModel();
    if (!model) return;

    // If at start of a non-empty line, insert on a new line above
    const lineContent = model.getLineContent(position.lineNumber);
    const isStartOfLine = position.column === 1;
    const isEmptyLine = lineContent.trim() === "";

    let insertText = text;
    let insertPosition = position;

    if (!isEmptyLine && isStartOfLine) {
      // Insert before current line
      insertText = text + (text.endsWith("\n") ? "" : "\n");
    } else if (!isEmptyLine) {
      // Insert on next line
      insertText = "\n" + text;
    }

    this.editor.executeEdits("keyword-toolbar", [
      {
        range: new monaco.Range(
          insertPosition.lineNumber,
          insertPosition.column,
          insertPosition.lineNumber,
          insertPosition.column,
        ),
        text: insertText,
        forceMoveMarkers: true,
      },
    ]);

    this.editor.focus();
  }

  // ── Live preview ──────────────────────────────────────────
  private updatePreview(): void {
    const source = this.editor.getValue();

    // Parse
    let doc: IntentDocument;
    try {
      doc = parseIntentText(source);
    } catch {
      return;
    }
    this.currentDoc = doc;

    // Rendered preview
    const rendered = document.getElementById("preview-rendered")!;
    const welcome = rendered.querySelector(".preview-welcome");
    if (!source.trim()) {
      // Show welcome if it exists, otherwise add empty message
      if (!welcome) {
        rendered.innerHTML =
          '<p class="preview-empty">Start writing on the left to see a live preview\u2026</p>';
      }
    } else {
      rendered.innerHTML = renderHTML(doc);
    }

    // JSON code view
    const jsonCode = document.getElementById("json-code")!;
    jsonCode.textContent = source.trim() ? JSON.stringify(doc, null, 2) : "";

    // HTML code view
    const htmlCode = document.getElementById("html-code")!;
    htmlCode.textContent = source.trim() ? renderHTML(doc) : "";

    // Markdown view
    const mdCode = document.getElementById("markdown-code")!;
    mdCode.textContent = source.trim() ? convertToMarkdown(doc) : "";

    // Stats
    const stats = document.getElementById("stats")!;
    const lineCount = source.split("\n").length;
    const blockCount = doc.blocks.length;
    stats.textContent = `${blockCount} block${blockCount !== 1 ? "s" : ""} \u00B7 ${lineCount} line${lineCount !== 1 ? "s" : ""}`;
  }

  // ── Autosave ──────────────────────────────────────────────
  private scheduleAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    const statusEl = document.getElementById("save-status")!;
    statusEl.textContent = "";
    this.autosaveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, this.editor.getValue());
        statusEl.textContent = "Saved";
        setTimeout(() => {
          statusEl.textContent = "";
        }, 2000);
      } catch {
        // localStorage full or unavailable
      }
    }, AUTOSAVE_DELAY);
  }

  private loadAutosave(): void {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        this.editor.setValue(saved);
      }
    } catch {
      // Ignore
    }
  }

  // ── File operations ───────────────────────────────────────
  private async openFile(): Promise<void> {
    // Try File System Access API first
    if ("showOpenFilePicker" in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: "IntentText files",
              accept: { "text/plain": [".it", ".txt"] },
            },
          ],
        });
        const file = await handle.getFile();
        const text = await file.text();
        this.editor.setValue(text);
        this.editor.focus();
        return;
      } catch {
        // User cancelled or API not available
        return;
      }
    }

    // Fallback: file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".it,.txt,.md";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const text = await file.text();
        this.editor.setValue(text);
        this.editor.focus();
      }
    };
    input.click();
  }

  private async saveFile(): Promise<void> {
    const source = this.editor.getValue();

    // Try File System Access API
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: "document.it",
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
        const statusEl = document.getElementById("save-status")!;
        statusEl.textContent = "File saved";
        setTimeout(() => {
          statusEl.textContent = "";
        }, 2000);
        return;
      } catch {
        return; // User cancelled
      }
    }

    // Fallback: download
    this.downloadFile(source, "document.it", "text/plain");
  }

  // ── Export ────────────────────────────────────────────────
  private handleExport(format: string): void {
    const source = this.editor.getValue();
    if (!source.trim()) return;

    switch (format) {
      case "it":
        this.downloadFile(source, "document.it", "text/plain");
        break;
      case "html":
        if (this.currentDoc) {
          const html = renderHTML(this.currentDoc);
          const fullHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${this.getTitle()}</title>\n<style>\nbody { font-family: system-ui, sans-serif; max-width: 800px; margin: 2em auto; padding: 0 1em; line-height: 1.6; }\ntable { border-collapse: collapse; width: 100%; }\nth, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\nth { background: #f5f5f5; }\nblockquote { border-left: 3px solid #ccc; margin: 1em 0; padding: 0.5em 1em; color: #555; }\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
          this.downloadFile(fullHtml, "document.html", "text/html");
        }
        break;
      case "md":
        if (this.currentDoc) {
          const md = convertToMarkdown(this.currentDoc);
          this.downloadFile(md, "document.md", "text/markdown");
        }
        break;
      case "pdf":
        window.print();
        break;
      case "copy":
        navigator.clipboard.writeText(source).then(() => {
          const statusEl = document.getElementById("save-status")!;
          statusEl.textContent = "Copied!";
          setTimeout(() => {
            statusEl.textContent = "";
          }, 2000);
        });
        break;
    }
  }

  private getTitle(): string {
    if (this.currentDoc) {
      const titleBlock = this.currentDoc.blocks.find((b) => b.type === "title");
      if (titleBlock?.content) return titleBlock.content;
    }
    return "IntentText Document";
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

  // ── Import ────────────────────────────────────────────────
  private handleImport(): void {
    const textarea = document.getElementById(
      "import-input",
    ) as HTMLTextAreaElement;
    const content = textarea.value.trim();
    if (!content) return;

    let itContent: string;
    if (this.importMode === "html") {
      itContent = convertHtmlToIntentText(content);
    } else {
      itContent = convertMarkdownToIntentText(content);
    }

    // Append or replace
    const current = this.editor.getValue();
    if (current.trim()) {
      this.editor.setValue(current + "\n\n" + itContent);
    } else {
      this.editor.setValue(itContent);
    }

    textarea.value = "";
    this.hideModal("import-modal");
    this.editor.focus();
  }

  // ── Query panel ───────────────────────────────────────────
  private toggleQuery(): void {
    this.queryOpen = !this.queryOpen;
    const panel = document.getElementById("query-panel")!;
    panel.classList.toggle("hidden", !this.queryOpen);
    const btn = document.getElementById("query-btn")!;
    btn.style.background = this.queryOpen ? "rgba(255,255,255,0.2)" : "";
  }

  private runQuery(): void {
    const source = this.editor.getValue();
    if (!source.trim()) return;

    const typeSelect = document.getElementById(
      "query-type",
    ) as HTMLSelectElement;
    const textInput = document.getElementById("query-text") as HTMLInputElement;
    const ownerInput = document.getElementById(
      "query-owner",
    ) as HTMLInputElement;
    const resultsDiv = document.getElementById("query-results")!;

    const typeFilter = typeSelect.value;
    const textFilter = textInput.value.trim();
    const ownerFilter = ownerInput.value.trim();

    // Build query string
    const parts: string[] = [];
    if (typeFilter) parts.push(`type:${typeFilter}`);
    if (textFilter) parts.push(`content:${textFilter}`);
    if (ownerFilter) parts.push(`owner:${ownerFilter}`);

    if (parts.length === 0) {
      // Show all blocks
      const doc = parseIntentText(source);
      this.renderQueryResults(resultsDiv, doc.blocks, doc.blocks.length);
      return;
    }

    const queryStr = parts.join(" ");
    try {
      const doc = parseIntentText(source);
      const result = queryBlocks(doc, queryStr);
      this.renderQueryResults(resultsDiv, result.blocks, result.total);
    } catch {
      resultsDiv.innerHTML = '<p class="query-empty">Invalid query.</p>';
    }
  }

  private renderQueryResults(
    container: HTMLElement,
    blocks: IntentBlock[],
    total: number,
  ): void {
    if (blocks.length === 0) {
      container.innerHTML = '<p class="query-empty">No matching blocks.</p>';
      return;
    }

    let html = `<div class="query-count">${blocks.length} of ${total} blocks</div>`;
    for (const block of blocks) {
      const props = block.properties ?? {};
      const metaParts: string[] = [];
      if (props.owner) metaParts.push(`owner: ${props.owner}`);
      if (props.due) metaParts.push(`due: ${props.due}`);
      if (props.priority) metaParts.push(`priority: ${props.priority}`);

      html += `<div class="query-result-item">
        <div class="result-type">${block.type}</div>
        <div class="result-content">${this.escapeHtml(block.content ?? "")}</div>
        ${metaParts.length ? `<div class="result-meta">${metaParts.join(" \u00B7 ")}</div>` : ""}
      </div>`;
    }
    container.innerHTML = html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Modal helpers ─────────────────────────────────────────
  private showModal(id: string): void {
    document.getElementById(id)!.classList.remove("hidden");
  }

  private hideModal(id: string): void {
    document.getElementById(id)!.classList.add("hidden");
  }

  // ── Resize handle ─────────────────────────────────────────
  private setupResizeHandle(): void {
    const handle = document.getElementById("resize-handle")!;
    const editorPanel = document.getElementById("editor-panel")!;
    const previewPanel = document.getElementById("preview-panel")!;
    const workspace = document.querySelector(".workspace") as HTMLElement;
    let dragging = false;

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      dragging = true;
      handle.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const rect = workspace.getBoundingClientRect();
      const offset = e.clientX - rect.left;
      const total = rect.width;
      const pct = Math.max(20, Math.min(80, (offset / total) * 100));
      editorPanel.style.flex = "none";
      editorPanel.style.width = `${pct}%`;
      previewPanel.style.flex = "none";
      previewPanel.style.width = `${100 - pct}%`;
      this.editor.layout();
    });

    document.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        handle.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });
  }
}
