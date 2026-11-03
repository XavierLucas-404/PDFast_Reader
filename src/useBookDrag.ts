import { useEffect, useRef, useState } from "react";
import { AppState, type ScrollView, type View } from "react-native";
import type { Document } from "./core";
export type Drop = { shelf: string; before?: string };
type Rect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shelf: string;
  kind: "group" | "book";
};
export function useBookDrag(
  documents: Document[],
  scrollRef: React.RefObject<ScrollView | null> | undefined,
  scrollOffset: React.RefObject<number> | undefined,
  layoutKey: string,
  onDrop: (d: Document, target: Drop) => void,
  horizontal?: {
    rows: React.RefObject<Map<string, ScrollView>>;
    offsets: React.RefObject<Map<string, number>>;
  },
) {
  const groups = useRef(new Map<string, View>()),
    books = useRef(new Map<string, View>()),
    root = useRef<View>(null),
    active = useRef<Document | null>(null),
    rects = useRef<Rect[]>([]),
    pointer = useRef({ x: 0, y: 0 }),
    origin = useRef({ x: 0, y: 0 }),
    offset = useRef(0),
    coordinateOffset = useRef({ x: 0, y: 0 }),
    target = useRef<Drop | null>(null),
    horizontalStart = useRef(new Map<string, number>());
  const [drag, setDrag] = useState<Document | null>(null),
    [ghost, setGhost] = useState({ x: 0, y: 0 }),
    [drop, setDrop] = useState<Drop | null>(null);
  function cancel() {
    active.current = null;
    target.current = null;
    setDrag(null);
    setDrop(null);
  }
  function move(x: number, y: number) {
    if (!active.current) return;
    pointer.current = { x, y };
    x -= coordinateOffset.current.x;
    y -= coordinateOffset.current.y;
    const delta = (scrollOffset?.current || 0) - offset.current;
    setGhost({
      x: x - origin.current.x - 40,
      y: y - origin.current.y + delta - 45,
    });
    const group = rects.current.find(
      (r) =>
        r.kind === "group" &&
        x >= r.x &&
        x <= r.x + r.w &&
        y + delta >= r.y &&
        y + delta <= r.y + r.h,
    );
    let next: Drop | null = null;
    if (group) {
      const dx =
        (horizontal?.offsets.current.get(group.id) || 0) -
        (horizontalStart.current.get(group.id) || 0);
      const candidates = rects.current
        .filter(
          (r) =>
            r.kind === "book" &&
            r.shelf === group.id &&
            r.id !== active.current?.hash,
        )
        .map((r) => ({ ...r, x: r.x - dx }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      const before = candidates.find(
        (r) => y + delta < r.y || (y + delta <= r.y + r.h && x < r.x + r.w / 2),
      );
      next = { shelf: group.id, before: before?.id };
    }
    target.current = next;
    setDrop(next);
  }
  const measure = (v: View) =>
    new Promise<{ x: number; y: number; w: number; h: number }>((resolve) =>
      v.measureInWindow((x, y, w, h) => resolve({ x, y, w, h })),
    );
  async function start(
    d: Document,
    x: number,
    y: number,
    localX: number,
    localY: number,
  ) {
    rects.current = [];
    coordinateOffset.current = { x: 0, y: 0 };
    active.current = d;
    setDrag(d);
    offset.current = scrollOffset?.current || 0;
    horizontalStart.current = new Map(horizontal?.offsets.current || []);
    pointer.current = { x, y };
    if (root.current) origin.current = await measure(root.current);
    const a = await Promise.all(
      [...groups.current].map(async ([id, v]) => ({
        ...(await measure(v)),
        id,
        kind: "group" as const,
        shelf: id,
      })),
    );
    const b = await Promise.all(
      [...books.current].map(async ([id, v]) => ({
        ...(await measure(v)),
        id,
        kind: "book" as const,
        shelf: documents.find((d) => d.hash === id)?.shelfId || "",
      })),
    );
    if (active.current?.hash !== d.hash) return;
    const source = b.find((r) => r.id === d.hash);
    if (source)
      coordinateOffset.current = {
        x: x - localX - source.x,
        y: y - localY - source.y,
      };
    rects.current = [...a, ...b];
    move(pointer.current.x, pointer.current.y);
  }
  function end() {
    if (active.current && target.current)
      onDrop(active.current, target.current);
    cancel();
  }
  useEffect(() => {
    cancel();
  }, [layoutKey]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") cancel();
    });
    return () => {
      active.current = null;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!drag) return;
    const timer = setInterval(
      () =>
        scrollRef?.current
          ?.getNativeScrollRef()
          ?.measureInWindow((_x, top, _w, h) => {
            if (!active.current || !rects.current.length) return;
            const { x, y } = pointer.current,
              localY = y - coordinateOffset.current.y,
              step = localY < top + 70 ? -14 : localY > top + h - 70 ? 14 : 0;
            if (step)
              scrollRef.current?.scrollTo({
                y: Math.max(0, (scrollOffset?.current || 0) + step),
                animated: false,
              });
            const localX = x - coordinateOffset.current.x,
              delta = (scrollOffset?.current || 0) - offset.current;
            const group = rects.current.find(
              (r) =>
                r.kind === "group" &&
                localY + delta >= r.y &&
                localY + delta <= r.y + r.h &&
                localX >= r.x &&
                localX <= r.x + r.w,
            );
            if (group) {
              const dx =
                localX < group.x + 50
                  ? -12
                  : localX > group.x + group.w - 50
                    ? 12
                    : 0;
              if (dx)
                horizontal?.rows.current
                  .get(group.id)
                  ?.scrollTo({
                    x: Math.max(
                      0,
                      (horizontal.offsets.current.get(group.id) || 0) + dx,
                    ),
                    animated: false,
                  });
            }
            move(x, y);
          }),
      32,
    );
    return () => clearInterval(timer);
  }, [drag]);
  return { groups, books, root, drag, ghost, drop, start, move, end, cancel };
}
