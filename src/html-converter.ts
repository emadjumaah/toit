/**
 * Browser-native HTML → IntentText converter.
 * Uses the native DOMParser — no external dependencies.
 */

const STRIP_TAGS = new Set([
  "script", "style", "meta", "link", "noscript", "head",
]);

const TRANSPARENT_TAGS = new Set([
  "div", "span", "main", "article", "header", "footer",
  "nav", "aside", "figure", "figcaption", "details", "summary",
  "body", "html", "section",
]);

export function convertHtmlToIntentText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  processChildren(doc.body, lines);

  // Collapse multiple blank lines, trim trailing blank
  const cleaned: string[] = [];
  let blankCount = 0;
  for (const line of lines) {
    if (line === "") {
      if (++blankCount <= 1) cleaned.push("");
    } else {
      blankCount = 0;
      cleaned.push(line);
    }
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned.join("\n");
}

function processChildren(node: Node, lines: string[]): void {
  for (const child of node.childNodes) processNode(child, lines);
}

function processNode(node: Node, lines: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || "").trim();
    if (text) lines.push(`note: ${text}`);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (STRIP_TAGS.has(tag)) return;
  if (TRANSPARENT_TAGS.has(tag)) { processChildren(el, lines); return; }

  switch (tag) {
    case "h1":
      lines.push(`title: ${getInlineText(el)}`);
      lines.push("");
      break;
    case "h2":
      lines.push(`section: ${getInlineText(el)}`);
      lines.push("");
      break;
    case "h3": case "h4": case "h5": case "h6":
      lines.push(`sub: ${getInlineText(el)}`);
      lines.push("");
      break;
    case "p":
      handleParagraph(el, lines);
      lines.push("");
      break;
    case "ul":
      processListItems(el, lines, "unordered");
      lines.push("");
      break;
    case "ol":
      processListItems(el, lines, "ordered");
      lines.push("");
      break;
    case "blockquote":
      lines.push(`quote: ${getInlineText(el)}`);
      lines.push("");
      break;
    case "pre":
      processCodeBlock(el, lines);
      lines.push("");
      break;
    case "table":
      processTable(el, lines);
      lines.push("");
      break;
    case "img":
      processImage(el, lines);
      break;
    case "a":
      processBlockLink(el, lines);
      break;
    case "hr":
      lines.push("---");
      lines.push("");
      break;
    default:
      processChildren(el, lines);
  }
}

function handleParagraph(el: Element, lines: string[]): void {
  const meaningful = [...el.childNodes].filter(
    (c) => c.nodeType === Node.ELEMENT_NODE ||
           (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()),
  );
  if (meaningful.length === 1 && meaningful[0].nodeType === Node.ELEMENT_NODE) {
    const child = meaningful[0] as Element;
    const childTag = child.tagName.toLowerCase();
    if (childTag === "img") { processImage(child, lines); return; }
    if (childTag === "a") { processBlockLink(child, lines); return; }
  }
  const text = getInlineText(el);
  if (text) lines.push(`note: ${text}`);
}

function getInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = [...el.childNodes].map(getInlineText).join("");

  switch (tag) {
    case "strong": case "b": return `*${inner.trim()}*`;
    case "em": case "i":     return `_${inner.trim()}_`;
    case "del": case "s": case "strike": return `~${inner.trim()}~`;
    case "code": return `\`${inner}\``;
    case "a": {
      const href = el.getAttribute("href") || "";
      if (!href || /^(javascript|data):/i.test(href)) return inner;
      return `[${inner.trim()}](${href})`;
    }
    case "br":  return "\n";
    case "img": return el.getAttribute("alt") || "";
    default:    return inner;
  }
}

function processListItems(
  el: Element,
  lines: string[],
  type: "ordered" | "unordered",
): void {
  let index = 1;
  for (const child of el.children) {
    if (child.tagName.toLowerCase() !== "li") continue;
    const cb = child.querySelector("input[type='checkbox']") as HTMLInputElement | null;
    if (cb) {
      const checked = cb.checked || cb.hasAttribute("checked");
      const text = getInlineText(child).replace(/^\s*\[.\]\s*/, "").trim();
      lines.push(checked ? `done: ${text}` : `task: ${text}`);
    } else {
      const text = getInlineText(child).trim();
      lines.push(type === "ordered" ? `${index++}. ${text}` : `- ${text}`);
    }
  }
}

function processCodeBlock(el: Element, lines: string[]): void {
  const codeEl = el.querySelector("code");
  const content = (codeEl || el).textContent || "";
  const codeLines = content.split("\n");
  if (codeLines.length > 0 && !codeLines[codeLines.length - 1].trim()) codeLines.pop();
  if (codeLines.length > 0 && !codeLines[0].trim()) codeLines.shift();
  lines.push("```", ...codeLines, "```");
}

function processTable(el: Element, lines: string[]): void {
  for (const row of el.querySelectorAll("tr")) {
    const cells = [...row.querySelectorAll("th, td")];
    if (!cells.length) continue;
    lines.push(`| ${cells.map((c) => getInlineText(c).trim()).join(" | ")} |`);
  }
}

function processImage(el: Element, lines: string[]): void {
  const src = el.getAttribute("src") || "";
  if (!src) return;
  const alt = el.getAttribute("alt") || "image";
  const caption = el.getAttribute("title") || "";
  lines.push(`image: ${alt} | at: ${src}${caption ? ` | caption: ${caption}` : ""}`);
}

function processBlockLink(el: Element, lines: string[]): void {
  const href = el.getAttribute("href") || "";
  const text = getInlineText(el).trim();
  if (!href || /^(javascript|data):/i.test(href)) {
    if (text) lines.push(`note: ${text}`);
    return;
  }
  lines.push(`link: ${text || href} | to: ${href}`);
}
