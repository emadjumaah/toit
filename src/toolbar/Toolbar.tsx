import { useState, useRef, useEffect } from "react";
import { ThemePicker } from "./ThemePicker";
import { ExportMenu } from "./ExportMenu";
import { TrustMenu } from "./TrustMenu";
import { ToolsMenu } from "./ToolsMenu";
import type { ModalType } from "../App";
import type { EditorMode } from "../visual/types";

interface Props {
  filename: string;
  onFilenameChange: (name: string) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onModal: (m: ModalType) => void;
  content: string;
  onContentChange: (c: string) => void;
}

export function Toolbar({
  filename,
  onFilenameChange,
  editorMode,
  onEditorModeChange,
  theme,
  onThemeChange,
  onNew,
  onOpen,
  onSave,
  onModal,
  content,
  onContentChange,
}: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (name: string) =>
    setOpenMenu((cur) => (cur === name ? null : name));

  return (
    <div
      ref={toolbarRef}
      style={{
        height: "var(--toolbar-h)",
        background: "var(--bg-toolbar)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* Left — file controls */}
      <button className="tbtn" onClick={onNew} title="New file (Cmd+N)">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 1h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zm6.5 1H3v12h9V4.5L9.5 2z" />
        </svg>
        New
      </button>
      <button className="tbtn" onClick={onOpen} title="Open file (Cmd+O)">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44L8.56 3.56A.5.5 0 008.854 3.5H13.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM2.5 3a.5.5 0 00-.5.5V6h12V5a.5.5 0 00-.5-.5H8.854a1.5 1.5 0 01-1.06-.44L6.672 2.94A.5.5 0 006.379 3H2.5z" />
        </svg>
        Open
      </button>
      <button className="tbtn" onClick={onSave} title="Save file (Cmd+S)">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zM11.986 3L13 4.014 11.014 6 10 4.986 11.986 3z" />
        </svg>
        Save
      </button>
      <input
        className="filename-input"
        value={filename}
        onChange={(e) => onFilenameChange(e.target.value)}
        spellCheck={false}
      />

      <div style={{ flex: 1 }} />

      {/* Center — mode toggle */}
      <div className="it-mode-toggle">
        <button
          className={`tbtn ${editorMode === "visual" ? "active" : ""}`}
          onClick={() => onEditorModeChange("visual")}
          title="Visual mode"
        >
          ✏️ Visual
        </button>
        <button
          className={`tbtn ${editorMode === "source" ? "active" : ""}`}
          onClick={() => onEditorModeChange("source")}
          title="Source mode"
        >
          &lt;/&gt; Source
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right — tools */}
      <div className="dropdown">
        <button className="tbtn" onClick={() => toggle("theme")}>
          Theme ▾
        </button>
        {openMenu === "theme" && (
          <ThemePicker
            active={theme}
            onSelect={(t) => {
              onThemeChange(t);
              setOpenMenu(null);
            }}
          />
        )}
      </div>

      <div className="dropdown">
        <button className="tbtn" onClick={() => toggle("export")}>
          Export ▾
        </button>
        {openMenu === "export" && (
          <ExportMenu
            content={content}
            theme={theme}
            onClose={() => setOpenMenu(null)}
          />
        )}
      </div>

      <div className="dropdown">
        <button className="tbtn" onClick={() => toggle("trust")}>
          Trust ▾
        </button>
        {openMenu === "trust" && (
          <TrustMenu
            onAction={(action) => {
              setOpenMenu(null);
              onModal(action as ModalType);
            }}
          />
        )}
      </div>

      <div className="dropdown">
        <button className="tbtn" onClick={() => toggle("tools")}>
          Tools ▾
        </button>
        {openMenu === "tools" && (
          <ToolsMenu
            content={content}
            onContentChange={onContentChange}
            onClose={() => setOpenMenu(null)}
            onModal={onModal}
          />
        )}
      </div>

      <button className="tbtn" onClick={() => onModal("help")} title="Help (?)">
        ?
      </button>
    </div>
  );
}
