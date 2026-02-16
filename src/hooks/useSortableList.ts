import { useState, useCallback, useRef } from "react";

export function useSortableList<T extends { id: string; sort_order: number }>(
  items: T[],
  onReorder: (reordered: { id: string; sort_order: number }[]) => void
) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchItemIndex = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    (index: number) => {
      if (dragIndex === null || dragIndex === index) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }
      const reordered = [...items];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(index, 0, moved);
      const updates = reordered.map((item, i) => ({ id: item.id, sort_order: i }));
      onReorder(updates);
      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex, items, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const moveItem = useCallback(
    (fromIndex: number, direction: "up" | "down") => {
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= items.length) return;
      const reordered = [...items];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const updates = reordered.map((item, i) => ({ id: item.id, sort_order: i }));
      onReorder(updates);
    },
    [items, onReorder]
  );

  return {
    dragIndex,
    overIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    moveItem,
  };
}
