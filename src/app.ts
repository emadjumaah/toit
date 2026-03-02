import * as monaco from "monaco-editor";
import {
  parseIntentText,
  renderHTML,
  convertMarkdownToIntentText,
} from "@intenttext/core";
import { convertHtmlToIntentText } from "./html-converter";

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

type InputTab = "html" | "markdown";
type OutputTab = "source" | "preview";

export class WebToItApp {
  private itEditor!: monaco.editor.IStandaloneCodeEditor;
  private activeInput: InputTab = "html";
  private activeOutput: OutputTab = "source";
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
        readOnly: true,
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
  }

  // ── Event binding ────────────────────────────────────────────────────────────

  private bindEvents(): void {
    // Input tabs
    document
      .querySelectorAll<HTMLElement>("[data-input-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.switchInput(btn.dataset.inputTab as InputTab),
        );
      });

    // Output tabs
    document
      .querySelectorAll<HTMLElement>("[data-output-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.switchOutput(btn.dataset.outputTab as OutputTab),
        );
      });

    // HTML editor — paste
    const htmlEditor = document.getElementById("html-editor")!;
    htmlEditor.addEventListener("paste", (e) => {
      e.preventDefault();
      const html = e.clipboardData?.getData("text/html") || "";
      const text = e.clipboardData?.getData("text/plain") || "";

      if (html) {
        // Insert HTML immediately for instant visual feedback
        document.execCommand("insertHTML", false, html);

        // Sanitize and convert asynchronously to avoid blocking
        requestAnimationFrame(() => {
          const currentHtml = htmlEditor.innerHTML;
          const sanitized = this.sanitize(currentHtml);
          if (sanitized !== currentHtml) {
            htmlEditor.innerHTML = sanitized;
          }
          this.runConvert();
        });
      } else if (text) {
        document.execCommand("insertText", false, text);
        requestAnimationFrame(() => this.runConvert());
      }
    });
    htmlEditor.addEventListener("input", () =>
      this.debounce(() => this.runConvert(), 300),
    );

    // Markdown editor — input
    document
      .getElementById("md-editor")!
      .addEventListener("input", () =>
        this.debounce(() => this.runConvert(), 300),
      );

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
    this.activeInput = tab;
    document
      .querySelectorAll<HTMLElement>("[data-input-tab]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.inputTab === tab),
      );
    document
      .getElementById("html-tab-content")!
      .classList.toggle("active", tab === "html");
    document
      .getElementById("md-tab-content")!
      .classList.toggle("active", tab === "markdown");
    this.runConvert();
  }

  private switchOutput(tab: OutputTab): void {
    this.activeOutput = tab;
    document
      .querySelectorAll<HTMLElement>("[data-output-tab]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.outputTab === tab),
      );
    document
      .getElementById("source-tab-content")!
      .classList.toggle("active", tab === "source");
    document
      .getElementById("preview-tab-content")!
      .classList.toggle("active", tab === "preview");
    if (tab === "source") {
      setTimeout(() => this.itEditor.layout(), 10);
    } else {
      this.renderPreview();
    }
  }

  // ── Conversion ────────────────────────────────────────────────────────────

  private runConvert(): void {
    let itText = "";
    if (this.activeInput === "html") {
      const html = document.getElementById("html-editor")!.innerHTML;
      if (html && html !== "<br>") {
        itText = convertHtmlToIntentText(html);
      }
    } else {
      const md = (document.getElementById("md-editor") as HTMLTextAreaElement)
        .value;
      if (md.trim()) {
        itText = convertMarkdownToIntentText(md);
      }
    }
    this.setOutput(itText);
  }

  private setOutput(itText: string): void {
    this.itEditor.setValue(itText);
    this.updateStats(itText);
    if (this.activeOutput === "preview") this.renderPreview();
  }

  private renderPreview(): void {
    const itText = this.itEditor.getValue();
    const preview = document.getElementById("it-preview")!;
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
    if (this.activeInput === "html") {
      document.getElementById("html-editor")!.innerHTML = "";
    } else {
      (document.getElementById("md-editor") as HTMLTextAreaElement).value = "";
    }
    this.setOutput("");
  }

  private async copy(): Promise<void> {
    const text = this.itEditor.getValue();
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
    const text = this.itEditor.getValue();
    if (!text.trim()) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "document.it";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  private debounce(fn: () => void, delay: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(fn, delay);
  }
}
