import { useState, useRef, useCallback, useEffect } from "react";
import { Toolbar } from "./toolbar/Toolbar";
import { StatusBar } from "./status/StatusBar";
import { MonacoEditor } from "./editor/MonacoEditor";
import { VisualEditor } from "./visual/VisualEditor";
import { Preview } from "./preview/Preview";
import { SealModal } from "./modals/SealModal";
import { VerifyModal } from "./modals/VerifyModal";
import { HistoryModal } from "./modals/HistoryModal";
import { AmendModal } from "./modals/AmendModal";
import { ConvertModal } from "./modals/ConvertModal";
import { HelpOverlay } from "./modals/HelpOverlay";
import { useWorkspace } from "./hooks/useWorkspace";
import { useFile } from "./hooks/useFile";
import { useAutoSave } from "./hooks/useAutoSave";
import { useDocument } from "./hooks/useDocument";
import type { EditorMode } from "./visual/types";
import type * as monaco from "monaco-editor";

const WELCOME = `// Welcome to IntentText Editor
// Open a .it file or start writing below.

title: My First Document
summary: A document written in IntentText

section: Getting Started
text: Every line in IntentText starts with a keyword.
text: The preview on the right updates as you type.
tip: Try changing the theme using the Theme picker above.

section: Learn More
link: Documentation | to: https://itdocs.vercel.app
link: Browse Templates | to: https://intenttext-hub.vercel.app
link: GitHub | to: https://github.com/intenttext/IntentText
`;

export type LayoutMode = "split" | "editor" | "preview";
export type EditorThemeMode = "dark" | "light";
export type ModalType =
  | "seal"
  | "verify"
  | "history"
  | "amend"
  | "convert"
  | "help"
  | null;

export default function App() {
  const workspace = useWorkspace();
  const { content, setContent, filename, setFilename, isUnsaved, markSaved } =
    workspace;

  const docState = useDocument(content);
  const { openFile, saveFile, newFile } = useFile(workspace);
  const { hasRestore, restore, dismiss } = useAutoSave(content, setContent);

  const [layout, setLayout] = useState<LayoutMode>("split");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("it-editor-theme") || "corporate",
  );
  const [editorTheme, setEditorTheme] = useState<EditorThemeMode>(
    () =>
      (localStorage.getItem("it-editor-color") as EditorThemeMode) || "light",
  );
  const [modal, setModal] = useState<ModalType>(null);
  const [dividerPos, setDividerPos] = useState(50);
  const [editorMode, setEditorMode] = useState<EditorMode>(
    () => (localStorage.getItem("it-editor-mode") as EditorMode) || "visual",
  );
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const panelsRef = useRef<HTMLDivElement>(null);

  // Persist theme choices and toggle app-level light/dark class
  useEffect(() => {
    localStorage.setItem("it-editor-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("it-editor-color", editorTheme);
    document.documentElement.setAttribute("data-theme", editorTheme);
  }, [editorTheme]);
  useEffect(() => {
    localStorage.setItem("it-editor-mode", editorMode);
  }, [editorMode]);

  // Load from URL ?source= parameter (hub "Open in Editor")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source) {
      setContent(source);
      markSaved();
      // Clean the URL so a refresh doesn't reload from param
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!content && !hasRestore) {
      setContent(WELCOME);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        saveFile();
      } else if (mod && e.key === "o") {
        e.preventDefault();
        openFile();
      } else if (mod && e.key === "n") {
        e.preventDefault();
        newFile(WELCOME);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        if (e.shiftKey) {
          setLayout("preview");
        } else {
          setLayout((l) => (l === "split" ? "editor" : "split"));
        }
      } else if (mod && e.shiftKey && e.key === "E") {
        e.preventDefault();
        // PDF export: call window.print on preview iframe
        const iframe = document.querySelector<HTMLIFrameElement>(
          ".panel-preview iframe",
        );
        if (iframe?.contentWindow) iframe.contentWindow.print();
      } else if (mod && e.shiftKey && e.key === "V") {
        e.preventDefault();
        setModal("verify");
      } else if (e.key === "Escape") {
        setModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, openFile, newFile]);

  // Divider drag
  const onDividerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const panels = panelsRef.current;
      if (!panels) return;
      const startX = e.clientX;
      const startPos = dividerPos;
      const rect = panels.getBoundingClientRect();
      const divEl = e.currentTarget as HTMLElement;
      divEl.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const pct = startPos + (dx / rect.width) * 100;
        setDividerPos(Math.max(20, Math.min(80, pct)));
      };
      const onUp = () => {
        divEl.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [dividerPos],
  );

  // Drag and drop files
  useEffect(() => {
    const handler = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      if (file.name.endsWith(".it") || file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          if (file.name.endsWith(".json")) {
            // JSON merge — not implemented inline, open convert modal
            setModal("convert");
          } else {
            setContent(text);
            setFilename(file.name);
            markSaved();
          }
        };
        reader.readAsText(file);
      }
    };
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", handler);
    window.addEventListener("dragover", prevent);
    return () => {
      window.removeEventListener("drop", handler);
      window.removeEventListener("dragover", prevent);
    };
  }, [setContent, setFilename, markSaved]);

  const showEditor = layout !== "preview";
  const showPreview = layout !== "editor";

  return (
    <>
      {hasRestore && (
        <div className="restore-banner">
          <span>Unsaved session found. Restore previous work?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={restore}>
              Restore
            </button>
            <button className="btn-secondary" onClick={dismiss}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <Toolbar
        filename={filename}
        onFilenameChange={setFilename}
        layout={layout}
        onLayoutChange={setLayout}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        theme={theme}
        onThemeChange={setTheme}
        onNew={() => newFile(WELCOME)}
        onOpen={openFile}
        onSave={saveFile}
        onModal={setModal}
        content={content}
        onContentChange={setContent}
      />

      <div
        className="panels"
        ref={panelsRef}
        style={layout === "split" ? {} : {}}
      >
        {showEditor && (
          <div
            className="panel-editor"
            style={
              layout === "split" ? { flex: `0 0 ${dividerPos}%` } : undefined
            }
          >
            {editorMode === "source" ? (
              <MonacoEditor
                value={content}
                onChange={setContent}
                editorRef={editorRef}
                editorTheme={editorTheme}
              />
            ) : (
              <VisualEditor value={content} onChange={setContent} />
            )}
          </div>
        )}

        {layout === "split" && (
          <div className="panel-divider" onMouseDown={onDividerDown} />
        )}

        {showPreview && (
          <div
            className="panel-preview"
            style={
              layout === "split"
                ? { flex: `0 0 ${100 - dividerPos}%` }
                : undefined
            }
          >
            <Preview content={content} theme={theme} errors={docState.errors} />
          </div>
        )}
      </div>

      <StatusBar
        blocks={docState.blocks}
        lines={docState.lines}
        keywords={docState.keywords}
        words={docState.words}
        errors={docState.errorCount}
        theme={theme}
        isUnsaved={isUnsaved}
        editorTheme={editorTheme}
        onToggleEditorTheme={() =>
          setEditorTheme((t) => (t === "dark" ? "light" : "dark"))
        }
        onErrorClick={() => {
          if (docState.firstErrorLine && editorRef.current) {
            editorRef.current.revealLineInCenter(docState.firstErrorLine);
            editorRef.current.setPosition({
              lineNumber: docState.firstErrorLine,
              column: 1,
            });
          }
        }}
      />

      {/* Modals */}
      {modal === "seal" && (
        <SealModal
          content={content}
          onApply={setContent}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "verify" && (
        <VerifyModal content={content} onClose={() => setModal(null)} />
      )}
      {modal === "history" && (
        <HistoryModal content={content} onClose={() => setModal(null)} />
      )}
      {modal === "amend" && (
        <AmendModal
          content={content}
          onApply={setContent}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "convert" && (
        <ConvertModal
          onApply={(text) => {
            setContent(text);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "help" && <HelpOverlay onClose={() => setModal(null)} />}
    </>
  );
}
