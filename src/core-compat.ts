import * as core from "@intenttext/core/dist/index.js";
import {
  _resetIdCounter as resetTsIdCounter,
  parseIntentText as parseIntentTextTs,
  parseIntentTextSafe as parseIntentTextSafeTs,
} from "@intenttext/core/dist/parser.js";
import { renderHTML as renderHtmlTs } from "@intenttext/core/dist/renderer.js";
import { validateDocumentSemantic as validateSemanticTs } from "@intenttext/core/dist/validate.js";

export * from "@intenttext/core/dist/index.js";

export const parseIntentText: typeof core.parseIntentText = (
  source,
  options,
) => {
  try {
    return core.parseIntentText(source, options);
  } catch {
    return parseIntentTextTs(source, options);
  }
};

export const parseIntentTextSafe: typeof core.parseIntentTextSafe = (
  source,
  options,
) => {
  try {
    return core.parseIntentTextSafe(source, options);
  } catch {
    return parseIntentTextSafeTs(source, options);
  }
};

export const renderHTML: typeof core.renderHTML = (doc, options) => {
  try {
    return core.renderHTML(doc, options);
  } catch {
    return renderHtmlTs(doc, options);
  }
};

export const validateDocumentSemantic: typeof core.validateDocumentSemantic = (
  doc,
) => {
  try {
    return core.validateDocumentSemantic(doc);
  } catch {
    return validateSemanticTs(doc);
  }
};

export const _resetIdCounter: typeof core._resetIdCounter = () => {
  try {
    core._resetIdCounter();
  } catch {
    resetTsIdCounter();
  }
};
