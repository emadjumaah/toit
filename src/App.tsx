import { useState, useRef, useCallback, useEffect } from "react";
import { Toolbar } from "./toolbar/Toolbar";
import { StatusBar } from "./status/StatusBar";
import { MonacoEditor } from "./editor/MonacoEditor";
import { VisualEditor } from "./visual/VisualEditor";
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

const WELCOME = `title: My First Document
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

  const [theme, setTheme] = useState(
    () => localStorage.getItem("it-editor-theme") || "corporate",
  );
  const [modal, setModal] = useState<ModalType>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(
    () => (localStorage.getItem("it-editor-mode") as EditorMode) || "visual",
  );
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Always light mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);
  useEffect(() => {
    localStorage.setItem("it-editor-theme", theme);
  }, [theme]);
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

      <div className="panels" style={{ flex: 1 }}>
        <div className="panel-editor" style={{ flex: 1 }}>
          {editorMode === "source" ? (
            <MonacoEditor
              value={content}
              onChange={setContent}
              editorRef={editorRef}
            />
          ) : (
            <VisualEditor value={content} onChange={setContent} />
          )}
        </div>
      </div>

      <StatusBar
        blocks={docState.blocks}
        lines={docState.lines}
        keywords={docState.keywords}
        words={docState.words}
        errors={docState.errorCount}
        theme={theme}
        isUnsaved={isUnsaved}
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
