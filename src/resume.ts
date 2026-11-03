import type { Document } from "./core";

export function validPage(page: unknown, count?: number): page is number {
  return (
    Number.isInteger(page) &&
    Number(page) >= 1 &&
    Number(page) <= (count || 100000)
  );
}
/** Preserve the old local pointer; a remote-only record never invents an exact resume. */
export function migrateResume(d: Document): Document {
  return {
    ...d,
    legacyPosition:
      d.legacyPosition ?? d.conflict?.remote.position ?? d.position,
    localResumeValid: d.localResumeValid ?? d.words.length > 0,
    resumePage: validPage(d.resumePage, d.pageCount)
      ? d.resumePage
      : d.words[d.position]?.page,
    conflict: undefined,
  };
}
export function resumePage(d: Document) {
  return validPage(d.resumePage, d.pageCount)
    ? d.resumePage
    : d.words[d.position]?.page || 1;
}
export function localResume(d: Document, page: number): number | undefined {
  return d.localResumeValid && d.words[d.position]?.page === page
    ? d.position
    : undefined;
}
export function bookmark(d: Document, page: number): Document {
  return validPage(page, d.pageCount) && d.resumePage !== page
    ? { ...d, resumePage: page }
    : d;
}
export function wordPosition(
  d: Document,
  position: number,
  forcePage = false,
): Document {
  const next = Math.max(0, Math.min(d.words.length - 1, position));
  const value = { ...d, position: next, localResumeValid: true };
  const page = d.words[next]?.page || 1;
  return forcePage || page !== d.words[d.position]?.page
    ? bookmark(value, page)
    : value;
}
