# IntentText Editor

# Agent Implementation Prompt — Transform toit into a WYSIWYG Editor

# Project: github.com/intenttext/intenttext-editor

# Parser: github.com/intenttext/IntentText (@intenttext/core)

---

## MISSION

#

Transform the existing `toit` web app (currently a two-panel conversion tool) into
**IntentText Editor** — a professional WYSIWYG document editor where the `.it` format
is the underlying data layer, invisible to the writer during normal use.

The writer sees a clean, styled document. They click and type. Behind the scenes,
every action produces valid `.it` syntax. The raw `.it`, JSON, and print preview
are available on demand via view tabs — but the default experience is a real editor,
not a syntax tool.

Think: Google Docs simplicity + IntentText structure underneath.

---

## WHAT EXISTS TODAY (the toit repo)

```
toit/
├── src/
│   ├── app.ts              Web-to-IT converter (left: HTML/MD input, right: .it output)
│   ├── it-to-web.ts        IT-to-Web converter (left: .it input, right: HTML/MD output)
│   ├── html-converter.ts   Browser-native HTML → IntentText conversion logic
│   └── main.ts             Entry point
├── public/
│   └── favicon.ico
├── index.html              Web-to-IT page
├── it-to-web.html          IT-to-Web page
├── package.json
├── vite.config.ts
└── tsconfig.json
```

**Current tech stack:**

- Vite + TypeScript
- Monaco editor (syntax-highlighted .it editing, same engine as VS Code)
- `@intenttext/core` — parser, renderer, Markdown conversion
- No framework (vanilla TypeScript)
- Deployed to Vercel

**Keep everything that works.** The conversion tools are useful and should remain
accessible. The new editor is the primary experience. The conversion tools become
secondary tools reachable from the editor.

---

## THE NEW ARCHITECTURE

### Page Structure

Replace the two-page structure with a single-page application with distinct modes:

```
editor.html     ← NEW primary page — the WYSIWYG editor (rename or replace index.html)
index.html      ← Keep as the conversion tools hub (web-to-IT + IT-to-web), linked from editor
```

Or alternatively, make the editor the new `index.html` and move conversion tools to
`convert.html`. Your choice — but the editor must be the landing page.

### The Editor Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: [IntentText Editor logo] ........... [New] [Open] [Save] [Export ▾] │
├─────────────────────────────────────────────────────────────────┤
│  TAB BAR: [✎ Edit] [< > Source] [{ } JSON] [⎙ Print]           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                    CONTENT AREA                                   │
│                                                                   │
│   Edit tab:   WYSIWYG block editor (primary)                      │
│   Source tab: Monaco editor showing raw .it                       │
│   JSON tab:   Monaco editor showing parsed JSON (read-only)       │
│   Print tab:  Rendered print preview (renderPrint output)         │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  STATUS BAR: [blocks: 12] [words: 340] [lines: 28] [.it ✓]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## PART 1 — THE WYSIWYG BLOCK EDITOR

This is the core of the project. Implement in `src/block-editor.ts`.

### Core Concept

The document is a list of blocks. Each block is a `div` element with:

- A `data-block-type` attribute (e.g. `"note"`, `"step"`, `"title"`)
- A `data-block-id` attribute (the block's ID from the parser)
- `contenteditable="true"` on the content area
- A type indicator in the left margin (the keyword label, styled as a monospace badge)

The editor maintains a single source of truth: the `.it` string.
Every edit updates the `.it` source. Every `.it` change re-renders the block list.
The cycle is: **keystroke → update .it → parse → re-render blocks → restore cursor**.

To avoid cursor jumping on every keystroke, use a **dirty block** approach:
only re-parse and re-render the block that was edited, not the whole document.
Full re-render happens only on: tab switch, paste, block type change, block deletion.

### Block Rendering

Each block renders as:

```html
<div
  class="it-block it-block--note"
  data-block-type="note"
  data-block-id="uuid-123"
>
  <span class="it-block__type-indicator">note:</span>
  <div class="it-block__content" contenteditable="true">
    Remember to backup the database before migrating.
  </div>
</div>
```

The `.it-block__type-indicator` is always visible in the left margin as a styled
monospace label — this is the keyword label styling we defined: monospace, subtle
background, small. It tells the writer what kind of block they are in without
being intrusive.

**Block type → visual style mapping:**

| Block type    | Indicator label    | Visual treatment                           |
| ------------- | ------------------ | ------------------------------------------ |
| `title:`      | `title:`           | Large, bold, h1-size                       |
| `summary:`    | `summary:`         | Medium, italic, muted                      |
| `section:`    | `section:`         | Bold, slightly larger, top margin          |
| `sub:`        | `sub:`             | Bold, normal size                          |
| `note:`       | (hidden for prose) | Normal paragraph — indicator only on hover |
| `task:`       | `task:`            | Checkbox + text, indented                  |
| `done:`       | `done:`            | Checkbox (checked) + strikethrough text    |
| `ask:`        | `ask:`             | Question mark icon + italic text           |
| `quote:`      | `quote:`           | Left border, italic, indented              |
| `epigraph:`   | `epigraph:`        | Centered, italic, no border                |
| `byline:`     | `byline:`          | Small, author name bold                    |
| `caption:`    | `caption:`         | Small italic, centered                     |
| `footnote:`   | `fn:`              | Small, muted, numbered                     |
| `dedication:` | `dedication:`      | Centered, italic                           |
| `info:`       | `info:`            | Blue left border callout                   |
| `warning:`    | `warning:`         | Orange left border callout                 |
| `tip:`        | `tip:`             | Green left border callout                  |
| `success:`    | `success:`         | Green filled callout                       |
| `step:`       | `step:`            | Bullet with tool badge                     |
| `decision:`   | `decision:`        | Diamond icon + if/then/else inline         |
| `gate:`       | `gate:`            | Lock icon, prominent background            |
| `checkpoint:` | `checkpoint:`      | Flag icon                                  |
| `error:`      | `error:`           | Red callout                                |
| `wait:`       | `wait:`            | Clock icon                                 |
| `parallel:`   | `parallel:`        | Split arrow icon                           |
| `retry:`      | `retry:`           | Refresh icon                               |
| `audit:`      | `audit:`           | Monospace log style                        |
| `emit:`       | `emit:`            | Broadcast icon, muted                      |
| `result:`     | `result:`          | Bold green, terminal style                 |
| `handoff:`    | `handoff:`         | Arrow between two agent names              |
| `call:`       | `call:`            | Function call style                        |
| `toc:`        | `toc:`             | Renders actual TOC from document sections  |
| `code:`       | `code:`            | Monospace code block                       |
| `link:`       | `link:`            | Hyperlink style                            |
| `image:`      | `image:`           | Image placeholder with alt text            |
| `---`         | (no indicator)     | Horizontal rule                            |
| `//`          | (no indicator)     | Muted italic comment                       |

For `note:` blocks — hide the type indicator by default. Show it only on hover.
This is the most common block for prose and the indicator would be distracting.
All other blocks show their indicator always.

### Pipe Properties Display

For blocks with pipe properties (`| tool: email.send | status: pending`),
render the properties as small inline badges after the content:

```html
<div class="it-block it-block--step" data-block-type="step">
  <span class="it-block__type-indicator">step:</span>
  <div class="it-block__content" contenteditable="true">Send welcome email</div>
  <div class="it-block__props">
    <span class="it-prop-badge">tool: email.send</span>
    <span class="it-prop-badge">status: pending</span>
  </div>
</div>
```

Properties are NOT editable inline in the first version. Clicking a property badge
opens a small inline property editor panel (see Part 3 — Property Panel).

### The .it Sync Engine

Implement in `src/sync-engine.ts`.

The sync engine is the bridge between the visual editor and the `.it` source.

**On block content edit (keystroke):**

1. Get the edited block's `data-block-type` and `data-block-id`
2. Get the new text content from the `contenteditable` div
3. Reconstruct the `.it` line: `{type}: {content} {pipe-properties}`
4. Find the corresponding line in the `.it` source by block ID
5. Replace that line in the `.it` string
6. Update the Source tab silently (don't re-render the edit view)

**On Source tab edit (user edits raw .it):**

1. Parse the new `.it` source with `parseIntentText()`
2. Full re-render of the block editor
3. Restore cursor to approximately the same position

**On tab switch to Source:**

1. Sync current editor state to `.it`
2. Load `.it` into Monaco editor

**On tab switch from Source:**

1. Get `.it` from Monaco editor
2. Parse and full re-render block editor

This bidirectional sync is the core technical challenge. Keep it simple in v1:
Source tab edits always trigger a full re-render when switching back to Edit.
Edit tab keystrokes do a lightweight line-replacement in the `.it` string.

---

## PART 2 — THE SLASH COMMAND MENU

Implement in `src/slash-menu.ts`.

When the user is in a `note:` block (or any empty block) and types `/` as the
first character of a new line, show a floating command menu.

### Menu Trigger

- Trigger: `/` typed at position 0 of an empty content area, OR at start of line
- Dismiss: `Escape`, click outside, or typing characters that don't match any command
- Navigate: `↑` `↓` arrow keys, `Enter` to select

### Menu Design

Floating panel, appears just below the current cursor line:

```
┌─────────────────────────────┐
│ 🔍 /section                 │
├─────────────────────────────┤
│ 📄 title      Document title│
│ 📑 section    New section   │
│ 📝 note       Paragraph     │  ← highlighted
│ ✅ task       Action item   │
│ 💬 quote      Quoted text   │
│ ─────── Writer ────────     │
│ 📰 byline     Author line   │
│ 🔖 epigraph   Opening quote │
│ 📷 caption    Figure label  │
│ [^] footnote  Reference note│
│ 📚 toc        Table of cont.│
│ 💝 dedication Book dedication│
│ ─────── Agentic ────────    │
│ ▶  step       Workflow step │
│ ◆  decision   Branch        │
│ 🔒 gate       Human approval│
│ ⚡ trigger    Start event   │
│ ─────── Structure ──────    │
│ ── ---        Divider       │
│ 💻 code       Code block    │
│ 🔗 link       Hyperlink     │
│ 🖼  image      Image         │
└─────────────────────────────┘
```

### Menu Behaviour

On selection, the current block's type is changed:

1. Remove the `/` and any typed filter text from the content
2. Change `data-block-type` to the selected type
3. Update the `.it` source line to use the new keyword
4. Re-render the block with the correct styling
5. Focus the content area, cursor at start

For block types with required properties (`step:` needs `tool:`, `gate:` needs `approver:`),
after inserting the block, immediately open the Property Panel for that block.

### Keyboard Shortcuts (alternative to slash menu)

```
Ctrl+1          → title:
Ctrl+2          → section:
Ctrl+3          → sub:
Enter           → new note: block (default)
Ctrl+Enter      → new block, type picker opens
Tab             → indent (converts note: to sub: if at start of section)
Backspace       → on empty block, delete block and merge with previous
Ctrl+B          → toggle *bold* on selection
Ctrl+I          → toggle _italic_ on selection
Ctrl+K          → insert [link](url)
```

---

## PART 3 — PROPERTY PANEL

Implement in `src/property-panel.ts`.

A minimal inline panel that appears when:

- A user clicks a property badge on a block
- A new agentic block is created via slash menu (auto-opens)
- A user presses `Tab` while in a block content area

### Panel Design

Appears as a floating panel anchored to the block, below the content:

```
┌─── step properties ──────────────────────────┐
│ tool:     [ email.send              ]         │
│ input:    [ {{userId}}              ]         │
│ output:   [ sent                    ]         │
│ depends:  [ step-1                  ]         │
│ status:   [ pending ▾              ]          │
│                              [Done] [Cancel]  │
└──────────────────────────────────────────────┘
```

Each known block type has a predefined list of its properties with appropriate
input types:

- Text input for most properties
- Dropdown for `status:` (pending/running/blocked/failed/done/skipped)
- Dropdown for `join:` on parallel (all/any/none)
- Dropdown for `backoff:` on retry (linear/exponential)
- Checkbox for `numbering:` on page
- Time input hint for `timeout:` (e.g. `30s`, `5m`, `24h`)

On `Done`, serialize the properties back to pipe syntax and update the `.it` line.

Property schema (define in `src/block-schemas.ts`):

```typescript
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
```

---

## PART 4 — DOCUMENT HEADER BAR

For `font:`, `page:`, `agent:`, `context:` blocks — these are document-level settings,
not content blocks. They should NOT appear inline in the block editor flow.

Instead, render a collapsible **Document Settings** panel at the very top of the editor,
above all content blocks. It shows a summary line when collapsed:

```
⚙ A4 · Georgia 12pt · agent: deploy-agent · 3 context vars    [Edit Settings ▾]
```

Clicking "Edit Settings" expands a panel using the Property Panel component showing
all document-level properties in a clean form. On save, it updates the `font:`,
`page:`, `agent:`, `context:` lines at the top of the `.it` source.

---

## PART 5 — TOOLBAR

A minimal floating toolbar that appears on text selection (like Google Docs).

```
[ B ] [ I ] [ ~ ] [ ^ ] [ Link ] [ Clear ]
```

- `B` → wraps selection in `*bold*`
- `I` → wraps selection in `_italic_`
- `~` → wraps selection in `~strikethrough~`
- `^` → wraps selection in `^highlight^`
- `Link` → prompts for URL, wraps in `[text](url)`
- `Clear` → removes all inline formatting from selection

Fixed toolbar at top of editor (always visible, not floating) for block-level actions:

```
[ + Block ] [ ↑ Move up ] [ ↓ Move down ] [ ⌫ Delete block ]
```

---

## PART 6 — THE FOUR VIEW TABS

### Tab 1: Edit (WYSIWYG)

The block editor described above. Default view.

### Tab 2: Source

Monaco editor loaded with the current `.it` content.
Language: register `intenttext` as a Monaco language with the keyword tokenizer
already defined in the IntentText VS Code extension grammar.

Tokenizer rules for Monaco (register with `monaco.languages.setMonarchTokensProvider`):

```javascript
{
  tokenizer: {
    root: [
      // Keywords at start of line
      [
        /^(title|summary|section|sub|note|step|decision|parallel|loop|call|gate|wait|retry|error|trigger|checkpoint|handoff|audit|emit|result|progress|task|done|ask|quote|info|warning|tip|success|link|image|import|export|context|font|page|break|byline|epigraph|caption|footnote|toc|dedication):/,
        "keyword.control",
      ],
      // Pipe separator
      [/\|/, "delimiter.pipe"],
      // Property keys after pipe
      [/(?<=\|\s*)(\w+):/, "variable.name"],
      // Variable references
      [/\{\{[^}]+\}\}/, "variable.other"],
      // Inline bold
      [/\*[^*]+\*/, "markup.bold"],
      // Inline italic
      [/_[^_]+_/, "markup.italic"],
      // Inline code
      [/`[^`]+`/, "markup.inline.code"],
      // Comments
      [/\/\/.*$/, "comment"],
      // Section divider
      [/^---$/, "keyword.operator"],
    ];
  }
}
```

When user switches away from Source tab, sync content back to the block editor.

### Tab 3: JSON

Read-only Monaco editor (language: `json`) showing the parsed document JSON.
Updates every time the `.it` source changes (debounced 300ms).
Users can copy from this view but not edit.

Add a small copy button in the top-right corner of the JSON view.

### Tab 4: Print

Renders `renderPrint(doc)` output in an iframe.
Applies the `font:` and `page:` block settings from the document.
Shows the document as it would look when printed or exported to PDF.

Add a "Print" button and a "Download PDF" button (PDF via `window.print()` in the
iframe, or via puppeteer if available server-side — for web version, `window.print()`
is sufficient).

---

## PART 7 — FILE OPERATIONS

### New Document

Clears the editor and loads a starter template:

```
title: Untitled Document

note:
```

Cursor is placed on the `title:` content.

### Open File

`<input type="file" accept=".it,.txt">` — reads the file content, parses it,
renders it in the block editor. Also accepts `.json` files where the root object
is an IntentText document JSON (converts back to `.it` using a `documentToSource()`
function you must implement).

### Save

Downloads the current `.it` content as a file named from the document title
(slug of the `title:` block content, or `document.it` if no title).

### Export Menu

Dropdown with:

- **Export as .it** — download raw IntentText source
- **Export as JSON** — download parsed JSON
- **Export as HTML** — download `renderHTML()` output
- **Export as Print HTML** — download `renderPrint()` output
- **Copy .it to clipboard**
- **Copy JSON to clipboard**

### Auto-save

Auto-save to `localStorage` every 30 seconds and on every tab switch.
Key: `intenttext-editor-autosave`.
On load, check for autosaved content and offer to restore:

```
┌──────────────────────────────────────────────────┐
│ 💾 Unsaved document found from 5 minutes ago.    │
│               [Restore]  [Discard]               │
└──────────────────────────────────────────────────┘
```

---

## PART 8 — DOCUMENT SETTINGS SIDEBAR (optional, v1.1)

A collapsible right sidebar showing:

- Document stats (blocks, words, reading time)
- Block type distribution (how many steps, tasks, notes etc.)
- Variable references found (`{{variables}}` list)
- Unresolved variables (highlighted in red)

This is optional for v1 — mark it as a stub with a `// TODO: v1.1` comment.

---

## PART 9 — KEEPING THE CONVERSION TOOLS

The existing conversion tools (`Web-to-IT` and `IT-to-Web`) are useful and must remain.

Move them to `convert.html`. Update `html-converter.ts` and `app.ts` to reference
the new page. Add a link in the editor header: `Tools →` that opens `convert.html`.

The conversion tools need no functional changes — just relocate them.

---

## PART 10 — STYLING

Create `src/editor.css`. The editor must feel like a professional writing tool.

### Design principles

- White canvas, generous margins, comfortable reading width
- Maximum content width: `720px`, centered
- No visual noise — the document is the UI
- Block type indicators are subtle, not prominent
- The editor chrome (header, tabs, status bar) is minimal and dark
- Print view matches what a physical document would look like

### Color palette

```css
:root {
  /* Chrome */
  --chrome-bg: #1e1e2e;
  --chrome-text: #cdd6f4;
  --chrome-border: #313244;
  --tab-active: #cba6f7;
  --tab-hover: #45475a;

  /* Canvas */
  --canvas-bg: #ffffff;
  --canvas-text: #1a1a2e;
  --canvas-width: 720px;
  --canvas-padding: 60px 80px;

  /* Block indicators */
  --indicator-bg: rgba(175, 184, 193, 0.15);
  --indicator-text: #64748b;
  --indicator-font: "SFMono-Regular", Consolas, monospace;
  --indicator-size: 0.75em;
  --indicator-radius: 4px;
  --indicator-padding: 1px 6px;

  /* Property badges */
  --prop-bg: rgba(100, 116, 139, 0.1);
  --prop-text: #475569;
  --prop-border: rgba(100, 116, 139, 0.2);

  /* Block type colors */
  --color-title: #1a1a2e;
  --color-section: #1e40af;
  --color-step: #0f766e;
  --color-gate: #7c3aed;
  --color-error: #dc2626;
  --color-warning: #d97706;
  --color-info: #2563eb;
  --color-success: #16a34a;
  --color-done: #6b7280;
  --color-audit: #78716c;
  --color-muted: #94a3b8;
}
```

### Block indicator styling

```css
.it-block__type-indicator {
  font-family: var(--indicator-font);
  font-size: var(--indicator-size);
  background: var(--indicator-bg);
  color: var(--indicator-text);
  border-radius: var(--indicator-radius);
  padding: var(--indicator-padding);
  user-select: none;
  position: absolute;
  left: -90px;
  white-space: nowrap;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.it-block:hover .it-block__type-indicator,
.it-block:focus-within .it-block__type-indicator {
  opacity: 1;
}

/* Hide note: indicator until hover */
.it-block--note .it-block__type-indicator {
  opacity: 0;
}
.it-block--note:hover .it-block__type-indicator,
.it-block--note:focus-within .it-block__type-indicator {
  opacity: 0.5;
}
```

---

## FILE STRUCTURE AFTER IMPLEMENTATION

```
toit/
├── src/
│   ├── main.ts                  Entry point — loads editor
│   ├── block-editor.ts          NEW — WYSIWYG block editor
│   ├── sync-engine.ts           NEW — .it ↔ block sync
│   ├── slash-menu.ts            NEW — / command menu
│   ├── property-panel.ts        NEW — block property editor
│   ├── block-schemas.ts         NEW — property schemas per block type
│   ├── block-renderer.ts        NEW — renders IntentBlock → HTML element
│   ├── toolbar.ts               NEW — selection toolbar + fixed toolbar
│   ├── file-ops.ts              NEW — new/open/save/export/autosave
│   ├── tab-manager.ts           NEW — Edit/Source/JSON/Print tab logic
│   ├── app.ts                   KEEP — Web-to-IT (moved to convert.html)
│   ├── it-to-web.ts             KEEP — IT-to-Web (moved to convert.html)
│   └── html-converter.ts        KEEP — conversion logic unchanged
├── public/
│   └── favicon.ico
├── index.html                   NEW — IntentText Editor (primary page)
├── convert.html                 NEW — Conversion tools (was index.html + it-to-web.html)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## IMPLEMENTATION ORDER

1. **`block-schemas.ts`** — define all property schemas first (no dependencies)
2. **`block-renderer.ts`** — render a single IntentBlock to an HTMLElement
3. **`block-editor.ts`** — the main editor: block list, contenteditable, basic typing
4. **`sync-engine.ts`** — .it ↔ visual sync, dirty block updates
5. **`tab-manager.ts`** — four tabs: Edit, Source, JSON, Print
6. **`slash-menu.ts`** — / command menu
7. **`property-panel.ts`** — block property editor
8. **`toolbar.ts`** — selection toolbar + fixed toolbar
9. **`file-ops.ts`** — new, open, save, export, autosave
10. **`index.html`** — new editor page layout
11. **`convert.html`** — move conversion tools here
12. **CSS** — editor.css with full design system
13. **Monaco integration** — register intenttext language, wire Source tab

---

## CONSTRAINTS

- No framework (keep vanilla TypeScript — no React, Vue, or Angular)
- No new build dependencies beyond what already exists in package.json
- Monaco editor is already installed — use it for Source and JSON tabs
- `@intenttext/core` is already installed — use `parseIntentText`, `renderHTML`, `renderPrint`
- Mobile is not a priority for v1 — desktop browser first
- The editor must work offline (no server calls during editing)
- Auto-save to localStorage is mandatory — writers lose work if this is missing
- All existing conversion tool functionality must continue to work unchanged

---

## VERIFICATION CHECKLIST

After implementation, verify:

- [ ] Opening the app shows the WYSIWYG editor with a blank document
- [ ] Typing in the editor creates `note:` blocks by default
- [ ] Pressing `/` opens the slash command menu
- [ ] Selecting `section:` from slash menu changes the block type and styling
- [ ] Clicking a step: block's property badge opens the property panel
- [ ] Source tab shows valid `.it` that matches what was typed
- [ ] JSON tab shows parsed document matching the .it source
- [ ] Print tab shows a styled print preview
- [ ] Editing in Source tab and switching back to Edit re-renders correctly
- [ ] Save button downloads a `.it` file
- [ ] Export menu works for all formats
- [ ] Auto-save fires after 30 seconds and the restore banner appears on reload
- [ ] Conversion tools still work at convert.html
- [ ] Cmd/Ctrl+B toggles bold on selected text
- [ ] Document settings (font:, page:) appear in the header settings panel, not inline
- [ ] A complete invoice template (paste the invoice.it from IntentText examples) renders correctly with all blocks styled

---

## THE GOAL IN ONE SENTENCE

A writer opens IntentText Editor, sees a clean white page, starts typing, and never
thinks about `.it` syntax — but every word they write is structured, parseable,
exportable, and storable as clean JSON. That is the product.

_IntentText Editor — Implementation Prompt v1.0 — March 2026_
