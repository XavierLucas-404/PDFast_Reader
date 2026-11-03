import type { Document } from "./core";
import type { LibraryState } from "./shelves";
export const orderValue = (d: Document, index = 0) =>
  Number.isSafeInteger(d.libraryOrder) && d.libraryOrder! >= 0
    ? d.libraryOrder!
    : index;
export function orderedBooks(documents: Document[], shelfId = "") {
  return documents
    .map((d, i) => ({ d, order: orderValue(d, i) }))
    .filter(({ d }) => (d.shelfId || "") === shelfId)
    .sort((a, b) => a.order - b.order || a.d.hash.localeCompare(b.d.hash))
    .map(({ d }) => d);
}
export function placeBook<T extends LibraryState>(
  state: T,
  hash: string,
  shelfId: string,
  before?: string,
): T {
  if (shelfId && !state.shelves.some((s) => s.id === shelfId)) return state;
  const book = state.documents.find((d) => d.hash === hash);
  if (!book) return state;
  if (before === hash && (book.shelfId || "") === shelfId) return state;
  const target = orderedBooks(state.documents, shelfId).filter(
    (d) => d.hash !== hash,
  );
  const at = before ? target.findIndex((d) => d.hash === before) : -1;
  target.splice(at < 0 ? target.length : at, 0, {
    ...book,
    shelfId: shelfId || undefined,
  });
  const updates = new Map(
    target.map((d, i) => [d.hash, { ...d, libraryOrder: i }]),
  );
  return {
    ...state,
    documents: state.documents.map((d) => updates.get(d.hash) || d),
  };
}
export function stepBook<T extends LibraryState>(
  state: T,
  hash: string,
  direction: -1 | 1,
): T {
  const book = state.documents.find((d) => d.hash === hash);
  if (!book) return state;
  const list = orderedBooks(state.documents, book.shelfId),
    i = list.findIndex((d) => d.hash === hash),
    next = i + direction;
  if (next < 0 || next >= list.length) return state;
  return placeBook(
    state,
    hash,
    book.shelfId || "",
    direction === -1 ? list[next].hash : list[next + 1]?.hash,
  );
}
export function adjacentTab(index: number, dx: number, dy: number, count = 4) {
  return Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5
    ? Math.max(0, Math.min(count - 1, index + (dx < 0 ? 1 : -1)))
    : index;
}

/** Apply a draft only to books still on this shelf; retain newly synced books at the end. */
export function applyShelfOrder<T extends LibraryState>(
  state: T,
  shelfId: string,
  ids: string[],
): T {
  const current = orderedBooks(state.documents, shelfId),
    valid = new Set(current.map((d) => d.hash));
  const ordered = [...new Set(ids)].filter((id) => valid.has(id));
  ordered.push(
    ...current.map((d) => d.hash).filter((id) => !ordered.includes(id)),
  );
  const ranks = new Map(ordered.map((id, i) => [id, i]));
  return {
    ...state,
    documents: state.documents.map((d) =>
      ranks.has(d.hash) ? { ...d, libraryOrder: ranks.get(d.hash) } : d,
    ),
  };
}
