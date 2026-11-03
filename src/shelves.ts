import { placeBook, orderValue, orderedBooks } from "./libraryOrder";
import { messageForText } from "./i18n";
import { t, AppError } from "./i18n";
import type { Document } from "./core";
export type Shelf = { id: string; name: string };
export type LibraryState = { shelves: Shelf[]; documents: Document[] };
const key = (name: string) =>
  name.trim().normalize("NFC").toLocaleLowerCase("pt-BR");
export function shelfNameError(
  name: string,
  shelves: Shelf[],
  except?: string,
  allowReserved = false,
) {
  const value = name.trim();
  if (!value || value.length > 60) return t("errors.shelfLength");
  if (
    !allowReserved &&
    isReservedShelfName(value) &&
    !shelves.some((s) => s.id === except && key(s.name) === key(value))
  )
    return t("errors.shelfReserved");
  if (shelves.some((s) => s.id !== except && key(s.name) === key(value)))
    return t("errors.shelfDuplicate");
  return "";
}
export function saveShelf<T extends LibraryState>(state: T, shelf: Shelf): T {
  const error = shelfNameError(shelf.name, state.shelves, shelf.id);
  if (error) {
    const descriptor = messageForText(error);
    throw new AppError(descriptor?.key || "errors.generic");
  }
  const value = { ...shelf, name: shelf.name.trim() };
  return {
    ...state,
    shelves: state.shelves.some((s) => s.id === shelf.id)
      ? state.shelves.map((s) => (s.id === shelf.id ? value : s))
      : [...state.shelves, value],
  };
}
export function moveDocument<T extends LibraryState>(
  state: T,
  hash: string,
  shelfId?: string,
): T {
  if (shelfId && !state.shelves.some((s) => s.id === shelfId))
    throw new AppError("errors.shelfMissing");
  return placeBook(state, hash, shelfId || "");
}
export function deleteShelf<T extends LibraryState>(state: T, id: string): T {
  let next = {
    ...state,
    shelves: state.shelves.filter((s) => s.id !== id),
  } as T;
  for (const d of orderedBooks(state.documents, id))
    next = placeBook(next, d.hash, "");
  return next;
}
export function restoreShelves<
  T extends { documents: Document[]; shelves?: Shelf[] },
>(state: T) {
  const shelves: Shelf[] = [];
  for (const s of Array.isArray(state.shelves) ? state.shelves : []) {
    if (
      s &&
      typeof s.id === "string" &&
      s.id &&
      typeof s.name === "string" &&
      !shelves.some((v) => v.id === s.id) &&
      !shelfNameError(s.name, shelves, s.id, true)
    )
      shelves.push({ id: s.id, name: s.name.trim() });
  }
  return {
    ...state,
    shelves,
    documents: state.documents.map((d, i) => ({
      libraryOrder: orderValue(d, i),
      ...d,
      shelfId: shelves.some((s) => s.id === d.shelfId) ? d.shelfId : undefined,
    })),
  };
}
export function coverIndex(hash: string) {
  return (
    Array.from(hash).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % 3
  );
}

export function isReservedShelfName(name: string) {
  return [
    t("library.unassigned", {}, "pt"),
    t("library.unassigned", {}, "en"),
  ].some((value) => key(value) === key(name));
}
