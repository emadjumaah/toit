import { useMemo, useState } from "react";
import {
  runtimeAdapter,
  type WorkflowRuntimeState,
} from "./runtimeAdapter";

interface Props {
  content: string;
}

export function WorkflowShowcasePanel({ content }: Props) {
  const [state, setState] = useState<WorkflowRuntimeState>({
    running: false,
    cursor: 0,
    nodes: [],
  });

  const nodes = useMemo(() => {
    return runtimeAdapter.getNodes(content);
  }, [content]);

  const viewState: WorkflowRuntimeState = {
    ...state,
    nodes,
    cursor: nodes.length === 0 ? 0 : Math.min(state.cursor, nodes.length - 1),
  };

  const runStep = () => {
    setState((prev) => runtimeAdapter.advance({ ...prev, nodes }));
  };

  return (
    <aside className="showcase-panel">
      <div className="showcase-panel-header">
        <h3>Workflow Execution</h3>
        <p>
          Live step pipeline view, ready for future Rust/Tauri runtime wiring.
        </p>
      </div>

      <div className="showcase-statline">
        <span>{nodes.length} executable blocks</span>
        <span>{viewState.running ? `Running (${runtimeAdapter.mode})` : "Idle"}</span>
      </div>

      <div className="workflow-list">
        {nodes.length === 0 && (
          <div className="showcase-empty">
            No workflow blocks in current document.
          </div>
        )}
        {nodes.map((n, i) => {
          const status =
            i < viewState.cursor
              ? "done"
              : i === viewState.cursor && viewState.running
                ? "active"
                : "queued";
          return (
            <div key={`${n.id}-${i}`} className={`workflow-item ${status}`}>
              <div className="workflow-type">{n.type}</div>
              <div className="workflow-label">{n.label}</div>
              {n.depends && (
                <div className="workflow-dep">depends: {n.depends}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="showcase-actions">
        <button onClick={runStep}>Advance Step</button>
        <button
          onClick={() => setState((prev) => runtimeAdapter.reset({ ...prev, nodes }))}
        >
          Reset
        </button>
      </div>
    </aside>
  );
}
