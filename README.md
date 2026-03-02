# Web to IntentText

> Paste any rich web content — get clean, structured IntentText instantly.

**Live:** [web-to-it.vercel.app](https://web-to-it.vercel.app) &nbsp;|&nbsp; **Repo:** [github.com/emadjumaah/web-to-it](https://github.com/emadjumaah/web-to-it)

---

## What it does

Copy content from a web page, Google Doc, Notion, email or any rich-text source and paste it into the left panel. The right panel updates in real time with clean IntentText. You can switch between HTML and Markdown input, preview the rendered result, copy it to your clipboard, or download it as an `.it` file.

Everything runs in your browser — nothing is uploaded or stored.

## Features

- **Paste anything** — tables, headings, bold/italic, lists, code blocks, blockquotes, links and images all convert correctly
- **Dual input modes** — switch between HTML and Markdown input with real-time conversion
- **Instant paste performance** — content appears immediately, then processes in the background
- **Monaco editor** — syntax-highlighted IntentText editing (the same engine that powers VS Code)
- **Live preview** — toggle to a rendered HTML preview at any time
- **Stats bar** — live block, line and character count
- **Copy / Download** — one-click copy to clipboard or save as `.it`
- **No server, no tracking** — 100% client-side

## Getting started

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

## Tech stack

| Library | Purpose |
|---|---|
| [@intenttext/core](https://github.com/emadjumaah/IntentText) | IntentText parsing, rendering, and Markdown conversion |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Syntax-highlighted IntentText editor |
| [Vite](https://vitejs.dev) + TypeScript | Build tooling and type safety |

## Project structure

```
src/
  app.ts           Main app class — UI, paste handling, tab switching, stats
  html-converter.ts Browser-native HTML → IntentText conversion
  main.ts          Entry point

public/
  favicon.svg      SVG favicon

index.html         Single-page shell + all CSS styles
vite.config.ts     Build config (Monaco split into its own chunk)
```

## Performance notes

The paste handler is optimized for large content:
- Content appears instantly in the editor for immediate visual feedback
- Sanitization and conversion happen asynchronously using `requestAnimationFrame`
- This prevents the main thread from blocking during large HTML processing

## License

MIT
