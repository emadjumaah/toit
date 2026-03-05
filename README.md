# Web to IntentText

> Two simple tools: Convert web content to IntentText (.it) or convert IntentText back to HTML/Markdown.

**Live:** [https://iteditor.vercel.app/](https://iteditor.vercel.app/) &nbsp;|&nbsp; **Repo:** [github.com/intenttext/intenttext-editor](https://github.com/intenttext/intenttext-editor)

---

## What it does

This project includes two separate pages for bidirectional conversion:

**Web-to-IT** (`index.html`): Copy content from a web page, Google Doc, Notion, email or any rich-text source and paste it into the left panel. The right panel updates in real time with clean IntentText.

**IT-to-Web** (`it-to-web.html`): Type or paste IntentText (.it) content in the left panel, and get instant HTML and Markdown output in the right panel.

Switch between pages using the navigation buttons in the header. Each page is focused and does one conversion direction perfectly.

Everything runs in your browser — nothing is uploaded or stored.

## Features

- **Two dedicated pages** - One for each conversion direction, no complex switching
- **Clean interface** - Each page has a single purpose and intuitive layout
- **Paste anything** - Tables, headings, bold/italic, lists, code blocks, blockquotes, links and images all convert correctly
- **Dual input modes** - Switch between HTML and Markdown input (web-to-it) or HTML and Markdown output (it-to-web)
- **Instant paste performance** - Content appears immediately, then processes in the background
- **Monaco editor** - Syntax-highlighted IntentText editing (the same engine that powers VS Code)
- **Live preview** - Toggle to a rendered HTML preview at any time
- **Stats bar** - Live block, line and character count
- **Copy / Download** - One-click copy to clipboard or save as `.it`, `.html`, or `.md` files
- **No server, no tracking** - 100% client-side

## Getting started

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

## Pages

### Web-to-IT (`index.html`)

- **Input:** HTML or Markdown (left panel)
- **Output:** IntentText .it (right panel)
- **Use Case:** Convert web content to structured IntentText

### IT-to-Web (`it-to-web.html`)

- **Input:** IntentText .it (left panel)
- **Output:** HTML or Markdown (right panel)
- **Use Case:** Convert IntentText back to web formats

## Tech stack

| Library                                                      | Purpose                                                |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| [@intenttext/core](https://github.com/intenttext/IntentText) | IntentText parsing, rendering, and Markdown conversion |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/)  | Syntax-highlighted IntentText editor                   |
| [Vite](https://vitejs.dev) + TypeScript                      | Build tooling and type safety                          |

## Project structure

```
src/
  app.ts           Web-to-IT app class
  it-to-web.ts     IT-to-Web app class
  html-converter.ts Browser-native HTML → IntentText conversion
  main.ts          Entry point

public/
  favicon.ico      PNG favicon

index.html         Web-to-IT page
it-to-web.html     IT-to-Web page
vite.config.ts     Build config (Monaco split into its own chunk)
```

## Performance notes

The paste handler is optimized for large content:

- Content appears instantly in the editor for immediate visual feedback
- Sanitization and conversion happen asynchronously using `requestAnimationFrame`
- This prevents the main thread from blocking during large HTML processing

## Usage

### Web-to-IT (index.html)

1. Copy rich content from any web page or application
2. Paste into the HTML or Markdown panel on the left
3. See clean IntentText output on the right
4. Copy, download, or preview the result

### IT-to-Web (it-to-web.html)

1. Type or paste IntentText content in the left panel
2. See HTML and Markdown output on the right
3. Switch between HTML and Markdown tabs as needed
4. Copy or download the converted content
5. Use the Preview tab to see rendered HTML

## License

MIT
