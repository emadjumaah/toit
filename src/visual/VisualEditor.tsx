import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { BlockPicker, AddBlockButton } from "./BlockPicker";
import { parseToVisualBlocks, extractDocumentMeta } from "./parser-bridge";
import { serializeBlocks, createEmptyBlock } from "./serializer";
import type { VisualBlock } from "./types";

interface Props {
  value: string;
  onChange: (source: string) => void;
}

// Sortable wrapper for each block
interface SortableBlockProps {
  block: VisualBlock;
  index: number;
  isSelected: boolean;
  isFrozen: boolean;
  onSelect: () => void;
  onUpdate: (block: VisualBlock) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBlock: () => void;
}

function SortableBlock({
  block,
  index: _index,
  isSelected,
  isFrozen,
  onSelect,
  onUpdate,
  onDelete,
  onInsertAfter,
  onMoveUp,
  onMoveDown,
  onAddBlock,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="it-block-wrapper">
      <BlockRenderer
        block={block}
        isSelected={isSelected}
        isFrozen={isFrozen}
        onSelect={onSelect}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onInsertAfter={onInsertAfter}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        dragHandleProps={{ ...attributes, ...listeners }}
      />

      {/* "+" button between blocks */}
      {!isFrozen && (
        <AddBlockButton onClick={onAddBlock} />
      )}
    </div>
  );
}

export function VisualEditor({ value, onChange }: Props) {
  const [blocks, setBlocks] = useState<VisualBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSourceRef = useRef<string>("");
  const isInternalUpdate = useRef(false);

  // dnd-kit sensors — pointer with slight activation distance to avoid conflicts with clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Parse source → blocks when source changes externally
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (value !== lastSourceRef.current) {
      const parsed = parseToVisualBlocks(value);
      const meta = extractDocumentMeta(value);
      setBlocks(parsed);
      setIsFrozen(meta.isFrozen);
      lastSourceRef.current = value;
    }
  }, [value]);

  // Serialize blocks → source when blocks change from visual edits
  const syncToSource = useCallback((newBlocks: VisualBlock[]) => {
    setBlocks(newBlocks);
    const source = serializeBlocks(newBlocks);
    lastSourceRef.current = source;
    isInternalUpdate.current = true;
    onChange(source);
  }, [onChange]);

  // Block operations
  const updateBlock = useCallback((index: number, updated: VisualBlock) => {
    const newBlocks = [...blocks];
    newBlocks[index] = updated;
    syncToSource(newBlocks);
  }, [blocks, syncToSource]);

  const deleteBlock = useCallback((index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    syncToSource(newBlocks);
    setSelectedId(null);
  }, [blocks, syncToSource]);

  const insertBlock = useCallback((after: number, type: string) => {
    const newBlock = createEmptyBlock(type);
    const newBlocks = [...blocks];
    newBlocks.splice(after + 1, 0, newBlock);
    syncToSource(newBlocks);
    setSelectedId(newBlock.id);
    setPickerIndex(null);
  }, [blocks, syncToSource]);

  const moveBlock = useCallback((from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(from, 1);
    newBlocks.splice(to, 0, moved);
    syncToSource(newBlocks);
  }, [blocks, syncToSource]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        moveBlock(oldIndex, newIndex);
      }
    }
  }, [blocks, moveBlock]);

  // Click outside to deselect
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        setPickerIndex(null);
      }
      // "/" to open block picker at end
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && document.activeElement === containerRef.current) {
        e.preventDefault();
        setPickerIndex(blocks.length - 1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [blocks.length]);

  return (
    <div className="it-visual-editor" ref={containerRef} tabIndex={0}>
      {/* Frozen banner */}
      {isFrozen && (
        <div className="it-frozen-overlay">
          <span>🔒</span> Document is sealed — read only
        </div>
      )}

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="it-empty-state">
          <p>No blocks yet</p>
          <button
            className="btn-primary"
            onClick={() => setPickerIndex(-1)}
          >
            + Add first block
          </button>
        </div>
      )}

      {/* Block list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="it-block-list">
            {blocks.map((block, index) => (
              <SortableBlock
                key={block.id}
                block={block}
                index={index}
                isSelected={selectedId === block.id}
                isFrozen={isFrozen}
                onSelect={() => setSelectedId(block.id)}
                onUpdate={(updated) => updateBlock(index, updated)}
                onDelete={() => deleteBlock(index)}
                onInsertAfter={() => setPickerIndex(index)}
                onMoveUp={() => moveBlock(index, index - 1)}
                onMoveDown={() => moveBlock(index, index + 1)}
                onAddBlock={() => setPickerIndex(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Block picker modal */}
      {pickerIndex !== null && (
        <BlockPicker
          onSelect={(keyword) => insertBlock(pickerIndex, keyword)}
          onClose={() => setPickerIndex(null)}
        />
      )}
    </div>
  );
}
