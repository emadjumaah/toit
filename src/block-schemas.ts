// ── Block Property Schemas ──────────────────────────────────
// Defines known properties per block type for the property panel.

export interface PropertySchema {
  key: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: string[];
}

export const BLOCK_SCHEMAS: Record<string, PropertySchema[]> = {
  step: [
    {
      key: "tool",
      label: "Tool",
      type: "text",
      placeholder: "e.g. email.send",
    },
    {
      key: "input",
      label: "Input",
      type: "text",
      placeholder: "e.g. {{userId}}",
    },
    {
      key: "output",
      label: "Output",
      type: "text",
      placeholder: "variable name",
    },
    {
      key: "depends",
      label: "Depends on",
      type: "text",
      placeholder: "e.g. step-1",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["pending", "running", "blocked", "failed", "done", "skipped"],
    },
    { key: "timeout", label: "Timeout", type: "text", placeholder: "e.g. 30s" },
  ],
  gate: [
    {
      key: "approver",
      label: "Approver",
      type: "text",
      placeholder: "person or role",
    },
    { key: "timeout", label: "Timeout", type: "text", placeholder: "e.g. 24h" },
    {
      key: "fallback",
      label: "Fallback",
      type: "text",
      placeholder: "step ID or exit",
    },
  ],
  task: [
    { key: "owner", label: "Owner", type: "text" },
    { key: "due", label: "Due", type: "text", placeholder: "e.g. Friday" },
    { key: "priority", label: "Priority", type: "text" },
  ],
  decision: [
    {
      key: "if",
      label: "Condition",
      type: "text",
      placeholder: "e.g. {{score}} > 0.9",
    },
    { key: "then", label: "Then (step ID)", type: "text" },
    { key: "else", label: "Else (step ID)", type: "text" },
  ],
  parallel: [
    { key: "steps", label: "Steps (comma-separated)", type: "text" },
    {
      key: "join",
      label: "Join",
      type: "select",
      options: ["all", "any", "none"],
    },
  ],
  retry: [
    { key: "max", label: "Max attempts", type: "text", placeholder: "3" },
    { key: "delay", label: "Delay", type: "text", placeholder: "1000ms" },
    {
      key: "backoff",
      label: "Backoff",
      type: "select",
      options: ["linear", "exponential"],
    },
  ],
  wait: [
    {
      key: "on",
      label: "Wait for event",
      type: "text",
      placeholder: "e.g. tests.complete",
    },
    { key: "timeout", label: "Timeout", type: "text" },
    { key: "fallback", label: "Fallback", type: "text" },
  ],
  handoff: [
    { key: "from", label: "From agent", type: "text" },
    { key: "to", label: "To agent", type: "text" },
  ],
  call: [
    { key: "input", label: "Input", type: "text" },
    { key: "output", label: "Output", type: "text" },
  ],
  font: [
    {
      key: "family",
      label: "Font family",
      type: "text",
      placeholder: "Georgia",
    },
    { key: "size", label: "Size", type: "text", placeholder: "12pt" },
    { key: "leading", label: "Line height", type: "text", placeholder: "1.6" },
  ],
  page: [
    {
      key: "size",
      label: "Page size",
      type: "select",
      options: ["A4", "A5", "Letter", "Legal"],
    },
    { key: "margins", label: "Margins", type: "text", placeholder: "20mm" },
    { key: "header", label: "Header text", type: "text" },
    { key: "footer", label: "Footer text", type: "text" },
    {
      key: "numbering",
      label: "Page numbers",
      type: "select",
      options: ["true", "false"],
    },
  ],
  byline: [
    { key: "date", label: "Date", type: "text" },
    { key: "publication", label: "Publication", type: "text" },
    { key: "role", label: "Role", type: "text" },
  ],
  footnote: [{ key: "text", label: "Footnote text", type: "text" }],
  toc: [
    { key: "depth", label: "Depth", type: "select", options: ["1", "2", "3"] },
    { key: "title", label: "Title", type: "text", placeholder: "Contents" },
  ],
  image: [
    { key: "at", label: "Path or URL", type: "text" },
    { key: "caption", label: "Caption", type: "text" },
  ],
  link: [{ key: "to", label: "URL", type: "text" }],
  quote: [{ key: "by", label: "Attribution", type: "text" }],
  epigraph: [{ key: "by", label: "Attribution", type: "text" }],
};

/** Block types that are document-level settings (not inline content) */
export const DOCUMENT_SETTING_TYPES = ["font", "page"];

/** Block types with required properties that need auto-open of property panel */
export const REQUIRES_PROPERTIES = [
  "step",
  "gate",
  "decision",
  "parallel",
  "retry",
  "wait",
  "handoff",
  "call",
];

/** Slash menu categories and entries */
export interface SlashMenuItem {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: string;
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  // Writer
  {
    type: "title",
    label: "title",
    description: "Document title",
    icon: "📄",
    category: "Writer",
  },
  {
    type: "section",
    label: "section",
    description: "New section",
    icon: "📑",
    category: "Writer",
  },
  {
    type: "sub",
    label: "sub",
    description: "Subsection",
    icon: "📂",
    category: "Writer",
  },
  {
    type: "note",
    label: "note",
    description: "Paragraph",
    icon: "📝",
    category: "Writer",
  },
  {
    type: "task",
    label: "task",
    description: "Action item",
    icon: "✅",
    category: "Writer",
  },
  {
    type: "done",
    label: "done",
    description: "Completed item",
    icon: "☑️",
    category: "Writer",
  },
  {
    type: "ask",
    label: "ask",
    description: "Question",
    icon: "❓",
    category: "Writer",
  },
  {
    type: "quote",
    label: "quote",
    description: "Quoted text",
    icon: "💬",
    category: "Writer",
  },
  {
    type: "summary",
    label: "summary",
    description: "Summary text",
    icon: "📋",
    category: "Writer",
  },
  // Document
  {
    type: "byline",
    label: "byline",
    description: "Author line",
    icon: "📰",
    category: "Document",
  },
  {
    type: "epigraph",
    label: "epigraph",
    description: "Opening quote",
    icon: "🔖",
    category: "Document",
  },
  {
    type: "caption",
    label: "caption",
    description: "Figure label",
    icon: "📷",
    category: "Document",
  },
  {
    type: "footnote",
    label: "footnote",
    description: "Reference note",
    icon: "[^]",
    category: "Document",
  },
  {
    type: "toc",
    label: "toc",
    description: "Table of contents",
    icon: "📚",
    category: "Document",
  },
  {
    type: "dedication",
    label: "dedication",
    description: "Book dedication",
    icon: "💝",
    category: "Document",
  },
  // Callouts
  {
    type: "info",
    label: "info",
    description: "Info callout",
    icon: "ℹ️",
    category: "Callouts",
  },
  {
    type: "warning",
    label: "warning",
    description: "Warning callout",
    icon: "⚠️",
    category: "Callouts",
  },
  {
    type: "tip",
    label: "tip",
    description: "Tip callout",
    icon: "💡",
    category: "Callouts",
  },
  {
    type: "success",
    label: "success",
    description: "Success callout",
    icon: "✅",
    category: "Callouts",
  },
  // Agentic
  {
    type: "step",
    label: "step",
    description: "Workflow step",
    icon: "▶",
    category: "Agentic",
  },
  {
    type: "decision",
    label: "decision",
    description: "Branch",
    icon: "◆",
    category: "Agentic",
  },
  {
    type: "gate",
    label: "gate",
    description: "Human approval",
    icon: "🔒",
    category: "Agentic",
  },
  {
    type: "trigger",
    label: "trigger",
    description: "Start event",
    icon: "⚡",
    category: "Agentic",
  },
  {
    type: "handoff",
    label: "handoff",
    description: "Agent handoff",
    icon: "🤝",
    category: "Agentic",
  },
  {
    type: "wait",
    label: "wait",
    description: "Wait for event",
    icon: "⏳",
    category: "Agentic",
  },
  {
    type: "parallel",
    label: "parallel",
    description: "Parallel steps",
    icon: "⏩",
    category: "Agentic",
  },
  {
    type: "retry",
    label: "retry",
    description: "Retry with backoff",
    icon: "🔄",
    category: "Agentic",
  },
  {
    type: "checkpoint",
    label: "checkpoint",
    description: "Checkpoint",
    icon: "🏁",
    category: "Agentic",
  },
  {
    type: "error",
    label: "error",
    description: "Error handler",
    icon: "❌",
    category: "Agentic",
  },
  {
    type: "emit",
    label: "emit",
    description: "Emit event",
    icon: "📡",
    category: "Agentic",
  },
  {
    type: "result",
    label: "result",
    description: "Result output",
    icon: "✅",
    category: "Agentic",
  },
  {
    type: "call",
    label: "call",
    description: "Function call",
    icon: "📞",
    category: "Agentic",
  },
  {
    type: "audit",
    label: "audit",
    description: "Audit log",
    icon: "📝",
    category: "Agentic",
  },
  // Structure
  {
    type: "divider",
    label: "---",
    description: "Divider",
    icon: "──",
    category: "Structure",
  },
  {
    type: "code",
    label: "code",
    description: "Code block",
    icon: "💻",
    category: "Structure",
  },
  {
    type: "link",
    label: "link",
    description: "Hyperlink",
    icon: "🔗",
    category: "Structure",
  },
  {
    type: "image",
    label: "image",
    description: "Image",
    icon: "🖼",
    category: "Structure",
  },
];
