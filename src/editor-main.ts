// ── IntentText Editor — Entry Point ─────────────────────────
import "./editor.css";
import * as monaco from "monaco-editor";
import { SyncEngine } from "./sync-engine";
import { TabManager } from "./tab-manager";
import { FileOps } from "./file-ops";
import { Toolbar } from "./toolbar";

// ── Monaco language registration ────────────────────────────
function registerIntentTextLanguage(): void {
  monaco.languages.register({ id: "intenttext" });

  monaco.languages.setMonarchTokensProvider("intenttext", {
    tokenizer: {
      root: [
        [
          /^(title|summary|section|sub|note|step|decision|parallel|loop|call|gate|wait|retry|error|trigger|checkpoint|handoff|audit|emit|result|progress|task|done|ask|quote|info|warning|tip|success|link|image|import|export|context|font|page|break|byline|epigraph|caption|footnote|toc|dedication):/,
          "keyword.control",
        ],
        [/\|/, "delimiter.pipe"],
        [/(?<=\|\s*)(\w+):/, "variable.name"],
        [/\{\{[^}]+\}\}/, "variable.other"],
        [/\*[^*]+\*/, "markup.bold"],
        [/_[^_]+_/, "markup.italic"],
        [/`[^`]+`/, "markup.inline.code"],
        [/\/\/.*$/, "comment"],
        [/^---$/, "keyword.operator"],
      ],
    },
  });

  monaco.editor.defineTheme("it-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword.control", foreground: "6D28D9", fontStyle: "bold" },
      { token: "delimiter.pipe", foreground: "9CA3AF" },
      { token: "variable.name", foreground: "0891B2" },
      { token: "variable.other", foreground: "B45309", fontStyle: "bold" },
      { token: "markup.bold", fontStyle: "bold" },
      { token: "markup.italic", fontStyle: "italic" },
      { token: "markup.inline.code", foreground: "059669" },
      { token: "comment", foreground: "9CA3AF", fontStyle: "italic" },
      { token: "keyword.operator", foreground: "9CA3AF" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#F8FAFC",
    },
  });

  // Completion provider
  const keywords = [
    "title",
    "summary",
    "section",
    "sub",
    "note",
    "task",
    "done",
    "ask",
    "quote",
    "info",
    "warning",
    "tip",
    "success",
    "link",
    "image",
    "code",
    "step",
    "decision",
    "trigger",
    "loop",
    "checkpoint",
    "audit",
    "error",
    "context",
    "handoff",
    "wait",
    "parallel",
    "retry",
    "result",
    "gate",
    "call",
    "emit",
    "font",
    "page",
    "break",
    "byline",
    "epigraph",
    "caption",
    "footnote",
    "toc",
    "dedication",
  ];

  const props = [
    "owner",
    "due",
    "priority",
    "time",
    "status",
    "at",
    "to",
    "caption",
    "tool",
    "input",
    "output",
    "depends",
    "id",
    "event",
    "if",
    "then",
    "else",
    "over",
    "do",
    "fallback",
    "notify",
    "from",
    "timeout",
    "max",
    "delay",
    "backoff",
    "steps",
    "code",
    "data",
    "phase",
    "level",
    "model",
    "agent",
    "retries",
    "join",
    "on",
    "approver",
    "family",
    "size",
    "leading",
    "weight",
    "heading",
    "mono",
    "margins",
    "header",
    "footer",
    "numbering",
    "depth",
    "role",
  ];

  monaco.languages.registerCompletionItemProvider("intenttext", {
    triggerCharacters: [":", "|", " "],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );
      const linePrefix = model
        .getLineContent(position.lineNumber)
        .slice(0, position.column - 1);
      const suggestions: monaco.languages.CompletionItem[] = [];

      if (/^\s*[a-z-]*$/i.test(linePrefix)) {
        suggestions.push(
          ...keywords.map((k) => ({
            label: `${k}:`,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: `${k}: `,
            detail: "IntentText keyword",
            range,
          })),
        );
      }

      if (linePrefix.includes("|")) {
        suggestions.push(
          ...props.map((p) => ({
            label: `${p}:`,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: `${p}: `,
            detail: "IntentText property",
            range,
          })),
        );
      }

      return { suggestions };
    },
  });
}

// ── Bootstrap ───────────────────────────────────────────────
registerIntentTextLanguage();

const sync = new SyncEngine();
const tabManager = new TabManager(sync);
const fileOps = new FileOps(sync, tabManager);
const toolbar = new Toolbar(sync);

// Export dropdown toggle
const exportBtn = document.getElementById("btn-export");
const exportMenu = document.getElementById("export-menu");
exportBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  exportMenu?.classList.toggle("open");
});
document.addEventListener("click", () => exportMenu?.classList.remove("open"));

// Wire up the block editor to toolbar and file-ops
const blockEditor = tabManager.getBlockEditor();
if (blockEditor) {
  toolbar.setBlockEditor(blockEditor);
  fileOps.setBlockEditor(blockEditor);
}
