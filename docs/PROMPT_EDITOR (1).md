# IntentText Editor — Professional Rewrite
## Implementation Prompt for Opus — Single Session

---

## CONTEXT

Current state: `intenttext-editor` repo at github.com/intenttext/intenttext-editor
Currently deployed at: https://toit-psi.vercel.app
Stack: Vite + TypeScript + Monaco Editor + @intenttext/core

The current editor is a conversion tool — web-to-IT and IT-to-web.
It is not a real editor. It is not where someone goes to write .it files.

This prompt replaces it entirely with a professional writing and editing
environment for .it files. The goal is: open it and feel like you're
using a real tool — not a demo.

The reference feeling: iA Writer's calm focus + VS Code's editing power
+ a document tool's output quality. All in the browser. No Electron.
No install. Just open and write.

Project root: `/Users/emad/projects/dotit/intenttext-editor`
Deploy: Vercel (existing deployment, same URL or new)
Core package: `@intenttext/core@^2.11.0`

Read the entire existing codebase before touching anything.
Preserve the Monaco integration — it is the right foundation.
Everything else is replaced.

---

## WHAT THIS EDITOR IS

A single-page web application for writing, editing, previewing,
and exporting `.it` documents. It does one thing and does it completely.

**The one sentence:** A professional editor for .it files that feels
like a real writing tool.

**Who uses it:**
- Journalists writing articles in .it format
- HR managers writing job offers and policies
- Lawyers reviewing and signing contracts
- Developers writing agent pipelines and specs
- Anyone who doesn't use the CLI but needs the full .it experience

**What it replaces:** The current `toit-psi.vercel.app` tool.
The conversion tools (web-to-IT, IT-to-web) become secondary features
accessible from a menu — not the main interface.

---

## THE LAYOUT

Three-panel layout. Fixed. No collapsing on desktop.

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR — file controls, theme picker, export, trust        │
├────────────────────────┬────────────────────────────────────┤
│                        │                                     │
│   EDITOR PANEL         │   PREVIEW PANEL                    │
│   Monaco editor        │   Rendered .it output              │
│   Full .it syntax      │   Live — updates as you type       │
│   highlighting         │   Themed — matches selected theme  │
│                        │                                     │
├────────────────────────┴────────────────────────────────────┤
│  STATUS BAR — blocks, words, keywords, version, save state  │
└─────────────────────────────────────────────────────────────┘
```

**Panel sizing:** Editor 50% / Preview 50% default. Draggable divider.
**Keyboard shortcut:** `Cmd/Ctrl + \` to toggle preview off for focus mode.
**Mobile:** Single panel, toggle button between editor and preview.

---

## THE TOOLBAR

Single row. Left group / center group / right group.

### Left — file controls
```
[New]  [Open]  [Save]  [filename.it ✎]
```
- **New** — clears editor, prompts if unsaved
- **Open** — file picker, `.it` files only
- **Save** — saves via File System Access API, falls back to download
- **Filename** — editable inline text field

### Center — layout modes
```
[⇔ Split]  [◧ Editor]  [◨ Preview]
```
Active mode highlighted. Toggle with keyboard shortcuts.

### Right — tools
```
[Theme ▾]  [Export ▾]  [Trust ▾]  [Tools ▾]  [?]
```

**Theme picker dropdown — all 8 built-in themes:**
```
● corporate   (active)
  minimal
  warm
  technical
  print
  legal
  editorial
  dark
```
Selecting applies to preview instantly. No reload.

**Export dropdown:**
- Export as PDF
- Export as HTML
- Export as Markdown
- Copy HTML to clipboard

**Trust dropdown:**
- Seal document
- Verify document
- View history
- Add amendment

**Tools dropdown:**
- Convert from HTML/web
- Convert from Markdown
- Merge template data
- Validate document
- Browse Hub templates

**? button:** Opens keyboard shortcut help overlay.

---

## THE EDITOR PANEL — MONACO

Monaco Editor is the core. Non-negotiable.

### Monaco configuration

```typescript
monaco.editor.create(container, {
  language: 'intenttext',
  theme: 'intenttext-dark',
  fontSize: 14,
  lineHeight: 24,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontLigatures: true,
  wordWrap: 'on',
  wordWrapColumn: 100,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  padding: { top: 24, bottom: 24 },
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  quickSuggestions: true,
})
```

### Custom language: `intenttext`

Register a Monaco language tokenizer for `.it` files.

**Token rules — keyword at start of line:**

| Token | Keywords | Dark theme color |
|---|---|---|
| `keyword.trust` | track, approve, sign, freeze, revision, policy, amendment | #f59e0b gold |
| `keyword.identity` | title, summary, meta, context | #60a5fa blue |
| `keyword.structure` | section, sub, break, group, ref, deadline | #4ade80 green |
| `keyword.content` | note, quote, warning, tip, code, image, link, cite, def, figure, contact | #e2e8f0 white |
| `keyword.data` | input, output, table, metric | #c084fc purple |
| `keyword.agent` | step, gate, trigger, emit, decision, memory, prompt, tool, audit, done, error | #fb923c orange |
| `keyword.layout` | page, font, header, footer, watermark, signline | #94a3b8 gray |
| `delimiter.pipe` | `\|` | #475569 muted |
| `property.key` | word before `:` after a pipe | #7dd3fc light blue |
| `template.variable` | `{{...}}` | #fbbf24 amber |
| `comment` | lines starting with `//` | #4b5563 dark gray |
| `boundary` | `---` alone on a line | #374151 very dark |

**Section folding:** Lines between `section:` keywords fold as blocks.

### Custom editor themes

**`intenttext-dark`** — default
```
background:      #0f1117
line highlight:  #1a1f2e
gutter:          #0d1117
selection:       #1e3a5f
```

**`intenttext-light`** — alternate
```
background:      #ffffff
line highlight:  #f8fafc
gutter:          #f1f5f9
```

Sun/moon icon in status bar toggles between them.

### Autocomplete provider

Register a Monaco completion provider.

**At line start:** suggest all 55 keywords + 47 aliases.
Each suggestion includes:
- Label: the keyword
- Detail: category name
- Documentation: one-line description
- Insert text: snippet with tab stops

Key snippets:
```
section:  → section: ${1:Section Title}
note:     → note: ${1:content}
approve:  → approve: ${1:Reviewed} | by: ${2:Name} | role: ${3:Role}
sign:     → sign: ${1:Full Name} | role: ${2:Title} | at: ${3:$CURRENT_DATE}
metric:   → metric: ${1:Name} | value: ${2:0} | unit: ${3:USD} | target: ${4:0}
contact:  → contact: ${1:Full Name} | role: ${2:Title} | email: ${3:}
deadline: → deadline: ${1:Description} | date: ${2:YYYY-MM-DD} | consequence: ${3:}
def:      → def: ${1:Term} | meaning: ${2:Definition}
ref:      → ref: ${1:Document name} | file: ${2:./path.it} | rel: ${3:relates-to}
figure:   → figure: ${1:Caption} | src: ${2:./image.png} | caption: ${3:}
```

**After `|`:** suggest common pipe properties for the current keyword.

### Hover documentation provider

Hovering any recognized keyword shows a card:
- Keyword name + category badge
- One-line description
- Syntax pattern
- "→ Full reference" link to docs.intenttext.io

---

## THE PREVIEW PANEL

Live rendered output. Updates 300ms after last keystroke.

### Implementation

```typescript
const updatePreview = debounce((source: string, theme: string) => {
  try {
    const doc = parseIntentText(source)
    const html = renderHtml(doc, { theme })
    iframe.srcdoc = wrapWithThemeStyles(html, theme)
    clearErrors()
  } catch (err) {
    showErrors(err)
  }
}, 300)
```

Render inside `<iframe srcdoc>` — scopes theme CSS, prevents bleed.

### Error banner

Parse errors show as a red banner at top of preview.
Preview still renders as far as it can — errors don't block output.

### Trust indicators

The @intenttext/core renderer handles these — the editor just uses
the correct render mode. The preview should show:
- `freeze:` → sealed banner across preview top
- `sign:` → signature badge
- `approve:` → approval stamp
- `amendment:` → amendment notice below seal banner

### Scroll sync

When editor scrolls, preview scrolls to the corresponding section.
Clicking a `section:` line in the editor jumps preview to that section.
Implemented via block position mapping from parse output.

---

## THE STATUS BAR

```
Left:   Blocks: 24  |  Lines: 67  |  Keywords: 14  |  Words: 312
Right:  v2.11.0  |  Theme: corporate  |  ● Unsaved
```

- `● Unsaved` — orange dot on changes, clears on save
- `✓ Saved` — green confirmation after save
- `⚠ 2 errors` — red, clickable, jumps to first error
- Sun/moon icon — toggles editor color theme

---

## THE TRUST MODALS

**Seal document:**
- Fields: Signer name, Role
- Action: calls `sealDocument()` from @intenttext/core
- On success: updates editor content, shows success toast

**Verify document:**
- No input needed
- Calls `verifyDocument()` from @intenttext/core
- Shows: ✅ Valid / ❌ Tampered, hash, signer, timestamp, amendment count

**View history:**
- Calls `getHistory()` from @intenttext/core
- Renders revision timeline — date, author, change summary per row

**Add amendment:**
- Fields: Section, Was, Now, Ref (default: "Amendment #N")
- Validates: document must be frozen first
- Calls `addAmendment()` from @intenttext/core
- On success: updates editor content

---

## FILE HANDLING

**Open:** File System Access API (`showOpenFilePicker`) where available.
Fall back to `<input type="file" accept=".it">`.

**Save:** File System Access API (`showSaveFilePicker`) for true save-in-place.
Fall back to download. Keyboard shortcut: `Cmd/Ctrl + S`.

**Auto-save:** localStorage every 30 seconds.
On load: if unsaved session exists, offer to restore with a banner.

**Drag and drop:**
- `.it` file → open in editor
- `.json` file → merge as template data

---

## KEYBOARD SHORTCUTS

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + N` | New file |
| `Cmd/Ctrl + O` | Open file |
| `Cmd/Ctrl + Shift + E` | Export as PDF |
| `Cmd/Ctrl + \` | Toggle preview panel |
| `Cmd/Ctrl + Shift + \` | Preview only mode |
| `Cmd/Ctrl + K, T` | Open theme picker |
| `Cmd/Ctrl + Shift + V` | Validate document |
| `Escape` | Close modal |
| `?` | Help overlay |

---

## INITIAL STATE — WELCOME DOCUMENT

On first open show this — not a blank editor:

```
// Welcome to IntentText Editor
// Open a .it file or start writing below.

title: My First Document
summary: A document written in IntentText

section: Getting Started
note: Every line in IntentText starts with a keyword.
note: The preview on the right updates as you type.
tip: Try changing the theme using the Theme picker above.

section: Learn More
link: Documentation | to: https://docs.intenttext.io
link: Browse Templates | to: https://intenttext-hub.vercel.app
link: GitHub | to: https://github.com/intenttext/IntentText
```

This renders immediately in the preview and shows the format in action.

---

## DESIGN

**App chrome palette:**
```css
--bg-app:       #0d1117
--bg-toolbar:   #161b22
--bg-panel:     #0f1117
--bg-modal:     #1c2128
--border:       #30363d
--text-primary: #e6edf3
--text-muted:   #7d8590
--accent:       #2563eb
--success:      #3fb950
--warning:      #d29922
--error:        #f85149
```

**Typography:**
- UI chrome: Inter, system-ui
- Editor: JetBrains Mono
- Status bar: Inter, 12px, tabular-nums

**Dimensions:**
- Toolbar: 48px height
- Status bar: 28px height
- No panel padding (Monaco fills edge to edge)
- Preview: 24px padding inside iframe

**Feel:**
- Dark by default — editors are dark
- No gradients, no decorative elements
- Generous spacing — nothing cramped
- Smooth transitions on panel resize and theme change

---

## TECH STACK

```
Vite + TypeScript    existing — keep
Monaco Editor        existing — keep and upgrade
@intenttext/core     bump to ^2.11.0
React                ADD — for toolbar, modals, status bar
```

React and Monaco coexist cleanly: Monaco owns its container DOM node,
React owns everything else — toolbar, modals, status bar, panels.

### File structure

```
src/
├── main.tsx
├── App.tsx
├── editor/
│   ├── MonacoEditor.tsx
│   ├── language.ts        # tokenizer, folding
│   ├── theme.ts           # dark + light editor themes
│   ├── completion.ts      # autocomplete provider
│   └── hover.ts           # hover docs provider
├── preview/
│   ├── Preview.tsx
│   └── scroll-sync.ts
├── toolbar/
│   ├── Toolbar.tsx
│   ├── ThemePicker.tsx
│   ├── ExportMenu.tsx
│   └── TrustMenu.tsx
├── modals/
│   ├── SealModal.tsx
│   ├── VerifyModal.tsx
│   ├── HistoryModal.tsx
│   ├── AmendModal.tsx
│   └── ConvertModal.tsx
├── status/
│   └── StatusBar.tsx
├── hooks/
│   ├── useDocument.ts     # parse state, errors, block count
│   ├── useFile.ts         # File System Access API + fallback
│   ├── useAutoSave.ts     # localStorage auto-save
│   └── useWorkspace.ts    # FOUNDATION ONLY — see below
└── styles/
    ├── global.css
    └── preview.css        # injected into iframe
```

---

## WORKSPACE FOUNDATION — For Future Tauri Desktop App

**Do not build any sidebar UI.** The web editor stays simple — no file
explorer, no sidebar panels, no workspace switcher visible to the user.

**Do build the workspace state foundation.** This is the internal
architecture that the Tauri desktop app will plug into later. Getting
the state shape right now means zero refactoring when the desktop app
is built. It costs nothing in the web editor — it just lives beneath
the surface.

### Why Tauri (not Electron)

When the desktop app is built it will use Tauri — Rust-based, tiny
binary, native performance, no bundled Chromium. When v3.0 ships the
IntentText Rust core and the Tauri shell will be the same language.
The Tauri app is this web editor running natively with real file system
access, OS file associations, and a taskbar presence. No rewrite needed.

### `src/hooks/useWorkspace.ts`

Implement this hook now. It is not used visibly in the web editor —
but it is the single source of truth for what folder and files are open.
The web editor uses it with a null workspace (single file mode).
The Tauri desktop app will inject a real folder handle into it.

```typescript
export interface ItFileEntry {
  name: string                    // filename.it
  path: string                    // full path or relative path
  handle?: FileSystemFileHandle   // File System Access API handle
  isFrozen: boolean               // has freeze: block
  hasErrors: boolean              // parse errors present
  isUnsaved: boolean              // unsaved changes
  lastModified: Date
  title?: string                  // parsed from title: block
  domain?: string                 // from meta: | domain:
}

export interface WorkspaceState {
  // Null in web editor — populated in Tauri desktop app
  folderHandle: FileSystemDirectoryHandle | null
  folderName: string | null
  folderPath: string | null

  // All .it files in the open folder
  // Empty array in web editor (single file mode)
  files: ItFileEntry[]

  // The currently active file
  activeFile: ItFileEntry | null
  activeContent: string

  // Index cache — loaded from .it-index if present in folder
  // Enables fast search and query in desktop app
  indexCache: Record<string, unknown> | null

  // UI state — persisted
  recentFiles: string[]           // paths of recently opened files
  activeTheme: string             // current document theme
}

export interface WorkspaceActions {
  openFolder: (handle: FileSystemDirectoryHandle) => Promise<void>
  openFile: (entry: ItFileEntry) => Promise<void>
  saveFile: () => Promise<void>
  newFile: () => void
  setContent: (content: string) => void
  setTheme: (theme: string) => void
  refreshFiles: () => Promise<void>    // re-scan folder
  loadIndex: () => Promise<void>       // load .it-index if present
}
```

### How it works in web editor (current)

`folderHandle` is null. `files` is empty. `activeFile` is a synthetic
entry created when the user opens a single file. All file operations go
through `useFile.ts` which uses File System Access API or download fallback.

The workspace hook is wired into App.tsx as the root state container but
nothing about folders or file lists is shown in the UI.

### How it works in Tauri desktop app (future)

Tauri injects a real `FileSystemDirectoryHandle` equivalent via its
file system API. `openFolder()` scans the directory, populates `files[]`,
loads `.it-index` if present. The sidebar reads `files[]` and renders
the file tree. Search and query panels read `indexCache`.

The editor, preview, toolbar, modals — unchanged. Zero refactoring.
The workspace hook is the bridge between web and desktop.

### State persistence

Persist to localStorage (web) / app data directory (Tauri):
- `activeTheme` — remember last selected theme
- `recentFiles` — last 10 opened file paths
- `folderPath` — remember last opened folder (Tauri only)

---

## IMPLEMENTATION ORDER

**Phase 1 — Foundation**
1. Read entire existing codebase
2. Install React: `npm install react react-dom @types/react @types/react-dom`
3. Update `vite.config.ts` for React + JSX
4. Create `src/main.tsx`, `src/App.tsx` with three-panel layout
5. Port Monaco init to `src/editor/MonacoEditor.tsx`

**Phase 2 — Editor core**
6. Register .it language tokenizer — `src/editor/language.ts`
7. Register editor themes — `src/editor/theme.ts`
8. Implement autocomplete — `src/editor/completion.ts`
9. Implement hover docs — `src/editor/hover.ts`
10. Implement section folding

**Phase 3 — Preview**
11. Build `src/preview/Preview.tsx` — iframe, debounced render
12. Wire theme selection to preview re-render
13. Implement parse error banner in preview
14. Implement scroll sync

**Phase 4 — Toolbar and status**
15. Build `Toolbar.tsx` with all groups
16. Build `ThemePicker.tsx`
17. Build `ExportMenu.tsx` — PDF, HTML, Markdown
18. Build `TrustMenu.tsx`
19. Build `StatusBar.tsx` — live stats, save state, editor theme toggle

**Phase 5 — File handling**
20. Implement `useWorkspace.ts` — full interface and state shape,
    web mode only (null folder, single file), persists theme + recent files
21. Implement `useFile.ts` — wired through useWorkspace
22. Implement `useAutoSave.ts`
23. Implement drag and drop
24. Wire keyboard shortcuts

**Phase 6 — Modals**
24. Build all 5 modals
25. Wire trust modals to @intenttext/core functions
26. Wire convert modal to existing conversion logic

**Phase 7 — Polish**
27. Welcome document initial state
28. Keyboard shortcut help overlay
29. Mobile layout — single panel, toggle button
30. CSS polish — transitions, focus states, spacing
31. `npm run build` — 0 errors, 0 warnings
32. Test: Chrome, Firefox, Safari
33. Deploy to Vercel

---

## VERIFICATION CHECKLIST

**Editor**
- [ ] .it syntax highlighting with correct colors for all 7 categories
- [ ] Pipe `|` renders muted
- [ ] Property keys render light blue after pipe
- [ ] Template variables `{{...}}` render amber
- [ ] Comments `//` render dark gray
- [ ] `---` boundary renders very dark
- [ ] Sections fold and unfold
- [ ] Autocomplete triggers at line start with all 55 keywords
- [ ] Aliases appear in autocomplete
- [ ] Pipe property suggestions appear after `|`
- [ ] Hover docs show for all keywords
- [ ] Hover card links to docs.intenttext.io

**Preview**
- [ ] Updates 300ms after last keystroke
- [ ] All 8 themes render correctly
- [ ] Theme change applies instantly
- [ ] Parse errors shown in red banner — preview still renders
- [ ] Trust indicators visible in preview
- [ ] Scroll sync works

**Toolbar**
- [ ] New, Open, Save work
- [ ] Filename editable inline
- [ ] Three layout modes work
- [ ] Theme picker shows and applies all 8 themes
- [ ] Export PDF works with selected theme
- [ ] Export HTML works
- [ ] Export Markdown works

**Trust**
- [ ] Seal modal: adds seal block to document on confirm
- [ ] Verify modal: shows correct hash result
- [ ] History modal: shows revision timeline
- [ ] Amend modal: adds amendment block to frozen document
- [ ] Amend modal: shows error if document is not frozen

**File handling**
- [ ] Open .it file works
- [ ] Save downloads .it file (or saves in place via File System Access API)
- [ ] Cmd/Ctrl+S triggers save
- [ ] Drag and drop .it file opens it
- [ ] Auto-save runs every 30 seconds
- [ ] Session restore offered on reload

**Status bar**
- [ ] Block count live
- [ ] Word count live
- [ ] Keyword count live
- [ ] Unsaved indicator appears and clears
- [ ] Error count clickable
- [ ] Version shows 2.11.0
- [ ] Editor theme toggle works

**Design**
- [ ] Dark theme default
- [ ] Light editor theme works
- [ ] No visual clutter
- [ ] Modals centered with backdrop
- [ ] Smooth transitions
- [ ] Mobile single-panel toggle works

**Workspace foundation**
- [ ] `useWorkspace.ts` implemented with full `WorkspaceState` interface
- [ ] `WorkspaceActions` all implemented — openFolder stub, openFile, saveFile, newFile, setContent, setTheme
- [ ] `folderHandle` is null in web mode — no folder UI shown
- [ ] `activeTheme` persisted to localStorage — survives page reload
- [ ] `recentFiles` persisted to localStorage — last 10 files remembered
- [ ] `ItFileEntry` interface complete — isFrozen, hasErrors, isUnsaved flags
- [ ] TypeScript compiles with 0 errors against the full workspace types

**Build**
- [ ] `npm run build` — 0 errors, 0 warnings
- [ ] Monaco chunk splits correctly in production
- [ ] No console errors in production
- [ ] Deploys to Vercel successfully
- [ ] Loads in under 3 seconds
