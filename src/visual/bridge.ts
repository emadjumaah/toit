// Bridge: IntentText source ↔ TipTap JSON document
// Converts .it source text to TipTap-compatible JSON and back

import { parseIntentText } from "@intenttext/core";
import type { JSONContent } from "@tiptap/core";

// IT keywords that map to dedicated TipTap nodes
const CALLOUT_TYPES = new Set(["tip", "info", "warning", "danger", "success"]);
const HEADING_MAP: Record<string, string> = {
  title: "itTitle",
  section: "itSection",
  sub: "itSub",
};

/**
 * Convert IntentText source to TipTap JSON content
 */
export function sourceToDoc(source: string): JSONContent {
  if (!source.trim()) {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  const doc = parseIntentText(source);
  const content: JSONContent[] = [];

  for (const block of doc.blocks) {
    const node = blockToNode(block);
    if (node) content.push(node);
  }

  // Also handle comment lines (// ...) that the parser might skip
  const lines = source.split("\n");
  let blockIdx = 0;
  const result: JSONContent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Comment lines
    if (trimmed.startsWith("//")) {
      result.push({
        type: "itComment",
        content: trimmed.slice(2).trim()
          ? [{ type: "text", text: trimmed.slice(2).trim() }]
          : [],
      });
      continue;
    }

    // Code block fence — skip, handled by parser
    if (trimmed.startsWith("```")) continue;

    // Use the next parsed block
    if (blockIdx < content.length) {
      result.push(content[blockIdx]);
      blockIdx++;
    }
  }

  // If we missed any blocks, append them
  while (blockIdx < content.length) {
    result.push(content[blockIdx]);
    blockIdx++;
  }

  return {
    type: "doc",
    content: result.length > 0 ? result : [{ type: "paragraph" }],
  };
}

function blockToNode(block: {
  type: string;
  content?: string;
  properties?: Record<string, string | number>;
}): JSONContent | null {
  const { type, content, properties } = block;
  const text = content || "";
  const textContent: JSONContent[] = text
    ? [{ type: "text", text }]
    : [];

  // Serialize all props to JSON string for TipTap attrs
  const propsJson = properties
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(properties).map(([k, v]) => [k, String(v)]),
        ),
      )
    : "{}";

  // Title, Section, Sub → dedicated heading nodes
  if (type in HEADING_MAP) {
    return {
      type: HEADING_MAP[type],
      attrs: { props: propsJson },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Summary
  if (type === "summary") {
    return {
      type: "itSummary",
      attrs: { props: propsJson },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Text → paragraph (paragraphs don't carry props in TipTap)
  if (type === "text") {
    return { type: "paragraph", content: textContent.length ? textContent : undefined };
  }

  // Callouts
  if (CALLOUT_TYPES.has(type)) {
    return {
      type: "itCallout",
      attrs: { variant: type, props: propsJson },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Quote
  if (type === "quote") {
    return {
      type: "itQuote",
      attrs: { by: properties?.by ? String(properties.by) : "", props: propsJson },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Code
  if (type === "code") {
    return {
      type: "itCode",
      attrs: { lang: properties?.lang ? String(properties.lang) : "", props: propsJson },
      content: text ? [{ type: "text", text }] : undefined,
    };
  }

  // Divider
  if (type === "divider") {
    return { type: "itDivider" };
  }

  // Break (page break)
  if (type === "break") {
    return { type: "itBreak" };
  }

  // All other keywords → generic block
  const propStr = properties
    ? Object.entries(properties)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ")
    : "";

  return {
    type: "itGenericBlock",
    attrs: { keyword: type, properties: propStr, props: propsJson },
    content: textContent.length ? textContent : undefined,
  };
}

/**
 * Convert TipTap JSON back to IntentText source
 */
export function docToSource(doc: JSONContent): string {
  if (!doc.content) return "";

  const lines: string[] = [];

  for (const node of doc.content) {
    const line = nodeToLine(node);
    if (line !== null) lines.push(line);
  }

  return lines.join("\n");
}

function nodeToLine(node: JSONContent): string | null {
  const text = extractText(node);

  // Helper to reconstruct pipe props from the JSON-encoded props attr
  const propsStr = (attrs?: Record<string, unknown>, exclude?: string[]): string => {
    const raw = attrs?.props;
    if (!raw || raw === "{}") return "";
    try {
      const obj: Record<string, string> = JSON.parse(raw as string);
      const entries = Object.entries(obj).filter(
        ([k]) => !exclude || !exclude.includes(k),
      );
      if (entries.length === 0) return "";
      return " | " + entries.map(([k, v]) => `${k}: ${v}`).join(" | ");
    } catch {
      return "";
    }
  };

  switch (node.type) {
    case "itTitle":
      return `title: ${text}${propsStr(node.attrs)}`;

    case "itSummary":
      return `summary: ${text}${propsStr(node.attrs)}`;

    case "itSection":
      return `section: ${text}${propsStr(node.attrs)}`;

    case "itSub":
      return `sub: ${text}${propsStr(node.attrs)}`;

    case "paragraph":
      return `text: ${text}`;

    case "itCallout": {
      const variant = node.attrs?.variant || "tip";
      return `${variant}: ${text}${propsStr(node.attrs)}`;
    }

    case "itQuote": {
      const by = node.attrs?.by;
      const byPart = by ? ` | by: ${by}` : "";
      return `quote: ${text}${byPart}${propsStr(node.attrs, ["by"])}`;
    }

    case "itCode": {
      const lang = node.attrs?.lang || "";
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }

    case "itDivider":
      return "divider:";

    case "itBreak":
      return "break:";

    case "itComment":
      return text ? `// ${text}` : "//";

    case "itGenericBlock": {
      const kw = node.attrs?.keyword || "text";
      const props = node.attrs?.properties || "";
      const propPart = props ? ` | ${props}` : "";
      return `${kw}: ${text}${propPart}`;
    }

    default:
      return text ? `text: ${text}` : null;
  }
}

function extractText(node: JSONContent): string {
  if (!node.content) return "";
  return node.content
    .map((child) => {
      if (child.type === "text") return child.text || "";
      // Recursive for nested content
      return extractText(child);
    })
    .join("");
}
