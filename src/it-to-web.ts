import * as monaco from "monaco-editor";
import { parseIntentText, renderHTML } from "@intenttext/core";

// Minimal blob worker — sufficient for custom tokenization without IntelliSense
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

type InputTab = "intenttext" | "preview";
type OutputTab = "html" | "markdown";

export class ItToWebApp {
  private itEditor!: monaco.editor.IStandaloneCodeEditor;
  private activeOutput: OutputTab = "html";
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.registerLanguage();
    this.initMonaco();
    this.bindEvents();
  }

  // ── Monaco setup ────────────────────────────────────────────────────────────

  private registerLanguage(): void {
    monaco.languages.register({ id: "intenttext" });

    monaco.languages.setMonarchTokensProvider("intenttext", {
      tokenizer: {
        root: [
          // Comments
          [/^\/\/.*$/, "comment"],
          // Divider
          [/^---$/, "keyword.divider"],
          // Fenced code fence
          [/^```.*$/, "string"],
          // Keywords at line start
          [
            /^(title|section|sub|subsection|note|task|done|ask|question|quote|image|link|ref|summary|info|warning|tip|success|headers|row|embed|code|end):/,
            "keyword",
          ],
          // Pipe metadata separator
          [/\|/, "operator"],
          // Bold *text*
          [/\*[^*\n]+\*/, "strong"],
          // Italic _text_
          [/_[^_\n]+_/, "emphasis"],
          // Strikethrough ~text~
          [/~[^~\n]+~/, "invalid.deprecated"],
          // Inline code `text`
          [/`[^`\n]+`/, "string.code"],
          // Inline link [text](url)
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

  private initMonaco(): void {
    this.itEditor = monaco.editor.create(
      document.getElementById("it-editor")!,
      {
        language: "intenttext",
        theme: "it-light",
        readOnly: false,
        fontSize: 13,
        lineHeight: 21,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        renderLineHighlight: "line",
        padding: { top: 14, bottom: 14 },
        fontFamily: '"Monaco", "Menlo", "Consolas", monospace',
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
      },
    );

    // IntentText editor input
    this.itEditor.onDidChangeModelContent(() => {
      this.debounce(() => this.runConvert(), 300);
    });
  }

  // ── Event binding ────────────────────────────────────────────────────────────

  private bindEvents(): void {
    // Input tabs (left panel)
    document
      .querySelectorAll<HTMLElement>("[data-input-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.switchInput(btn.dataset.inputTab as InputTab),
        );
      });

    // Output tabs (right panel)
    document
      .querySelectorAll<HTMLElement>("[data-output-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.switchOutput(btn.dataset.outputTab as OutputTab),
        );
      });

    // Clear
    document
      .getElementById("clear-btn")!
      .addEventListener("click", () => this.clear());

    // Copy
    document
      .getElementById("copy-btn")!
      .addEventListener("click", () => this.copy());

    // Download
    document
      .getElementById("download-btn")!
      .addEventListener("click", () => this.download());

    // Resize Monaco on window resize
    window.addEventListener("resize", () => this.itEditor.layout());
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

  private switchInput(tab: InputTab): void {
    document
      .querySelectorAll<HTMLElement>("[data-input-tab]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.inputTab === tab),
      );

    // Show/hide input tabs
    const intenttextTabContent = document.getElementById(
      "intenttext-tab-content",
    )!;
    const previewTabContent = document.getElementById("preview-tab-content")!;

    intenttextTabContent.style.display = tab === "intenttext" ? "flex" : "none";
    previewTabContent.style.display = tab === "preview" ? "flex" : "none";

    if (tab === "preview") {
      this.renderPreview();
    }
  }

  private switchOutput(tab: OutputTab): void {
    this.activeOutput = tab;
    document
      .querySelectorAll<HTMLElement>("[data-output-tab]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.outputTab === tab),
      );

    // Show/hide output tabs
    const htmlTabContent = document.getElementById("html-tab-content")!;
    const markdownTabContent = document.getElementById("markdown-tab-content")!;

    htmlTabContent.style.display = tab === "html" ? "flex" : "none";
    markdownTabContent.style.display = tab === "markdown" ? "flex" : "none";
  }

  // ── Conversion ────────────────────────────────────────────────────────────

  private runConvert(): void {
    const itText = this.itEditor.getValue();
    if (!itText.trim()) {
      this.setOutput("", "");
      return;
    }

    try {
      const doc = parseIntentText(itText);
      const html = renderHTML(doc);
      const markdown = this.convertToMarkdown(doc);
      this.setOutput(html, markdown);
    } catch (error) {
      console.error("Error parsing IntentText:", error);
      this.setOutput("", "");
    }
  }

  private setOutput(html: string, markdown: string): void {
    // Update HTML output
    const htmlOutput = document.getElementById("html-output")!;
    htmlOutput.innerHTML = html || "";

    // Update Markdown output
    const mdOutput = document.getElementById(
      "md-output",
    ) as HTMLTextAreaElement;
    mdOutput.value = markdown || "";
  }

  private convertToMarkdown(doc: any): string {
    // Basic IntentText to Markdown conversion
    const lines: string[] = [];

    if (doc.blocks) {
      for (const block of doc.blocks) {
        switch (block.type) {
          case "title":
            lines.push(`# ${block.content}`);
            lines.push("");
            break;
          case "section":
            lines.push(`## ${block.content}`);
            lines.push("");
            break;
          case "sub":
            lines.push(`### ${block.content}`);
            lines.push("");
            break;
          case "note":
            lines.push(block.content);
            lines.push("");
            break;
          case "task":
            lines.push(`- [ ] ${block.content}`);
            break;
          case "done":
            lines.push(`- [x] ${block.content}`);
            break;
          case "quote":
            lines.push(`> ${block.content}`);
            lines.push("");
            break;
          case "code":
            lines.push("```");
            if (block.content) lines.push(block.content);
            lines.push("```");
            lines.push("");
            break;
          case "link":
            lines.push(`[${block.text || block.content}](${block.to})`);
            lines.push("");
            break;
          case "image":
            lines.push(`![${block.content}](${block.at})`);
            lines.push("");
            break;
          case "divider":
            lines.push("---");
            lines.push("");
            break;
          default:
            if (block.content) {
              lines.push(block.content);
              lines.push("");
            }
        }
      }
    }

    return lines.join("\n").trim();
  }

  private renderPreview(): void {
    const preview = document.getElementById("preview")!;
    const itText = this.itEditor.getValue();

    if (!itText.trim()) {
      preview.innerHTML =
        '<p class="preview-empty">Preview will appear here once you add content…</p>';
      return;
    }

    const doc = parseIntentText(itText);
    preview.innerHTML = renderHTML(doc);
  }

  private updateStats(itText: string): void {
    const doc = itText.trim() ? parseIntentText(itText) : null;
    const blocks = doc?.blocks.length ?? 0;
    const lines = itText.split("\n").filter((l) => l.trim()).length;
    document.getElementById("stats-bar")!.textContent =
      `${blocks} blocks · ${lines} lines · ${itText.length} chars`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private clear(): void {
    this.itEditor.setValue("");
    this.setOutput("", "");
  }

  private async copy(): Promise<void> {
    let text = "";

    if (this.activeOutput === "html") {
      text = document.getElementById("html-output")!.innerHTML;
    } else if (this.activeOutput === "markdown") {
      text = (document.getElementById("md-output") as HTMLTextAreaElement)
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
    let content = "";
    let filename = "";
    let mimeType = "";

    if (this.activeOutput === "html") {
      content = document.getElementById("html-output")!.innerHTML;
      filename = "document.html";
      mimeType = "text/html";
    } else if (this.activeOutput === "markdown") {
      content = (document.getElementById("md-output") as HTMLTextAreaElement)
        .value;
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  private debounce(fn: () => void, delay: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(fn, delay);
  }
}

// Initialize app
new ItToWebApp();
