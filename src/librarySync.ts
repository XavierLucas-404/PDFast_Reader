import { validPage } from "./resume";
import { orderValue } from "./libraryOrder";
import { AppError } from "./i18n";
import type { Document } from "./core";
import type { Shelf } from "./shelves";
export type Range = [number, number];
export type CloudDocument = {
  hash: string;
  title: string;
  customTitle: boolean;
  total: number;
  extractionVersion: number;
  pageCount: number;
  position: number;
  readingStart: number;
  seen: Range[];
  completed: boolean;
  shelfId: string;
  libraryOrder?: number;
  coverPage?: number;
  resumePage?: number;
};
export type CloudData = { documents: CloudDocument[]; shelves: Shelf[] };
export type CloudState = { revision: number; base: CloudData };
export type LibraryReply = {
  revision: number;
  data: CloudData;
  presented?: Record<string, number[] | Range[]>;
  accepted?: boolean;
};
export const emptyCatalog = (): CloudData => ({ documents: [], shelves: [] });
export const totalWords = (d: Pick<Document, "words" | "wordCount">) =>
  d.wordCount ?? d.words.length;
export function ranges(positions: readonly number[]): Range[] {
  const result: Range[] = [];
  for (const p of [...new Set(positions)].sort((a, b) => a - b)) {
    const last = result[result.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else result.push([p, p]);
  }
  return result;
}
export function expand(ranges: readonly Range[], total: number): number[] {
  const result = new Set<number>();
  for (const [first, last] of ranges)
    for (let p = Math.max(0, first); p <= Math.min(total - 1, last); p++)
      result.add(p);
  return [...result].sort((a, b) => a - b);
}
export function cloudDocument(d: Document): CloudDocument {
  return {
    hash: d.hash,
    title: d.title,
    customTitle: !!d.customTitle,
    total: totalWords(d),
    extractionVersion: d.extractionVersion || 1,
    pageCount: d.pageCount || d.words[d.words.length - 1]?.page || 1,
    position: d.legacyPosition ?? 0,
    readingStart: d.readingStart || 0,
    seen: ranges(d.seen),
    completed: !!d.completed,
    shelfId: d.shelfId || "",
    libraryOrder: orderValue(d),
    coverPage: d.coverPage || 0,
    ...(validPage(d.resumePage, d.pageCount)
      ? { resumePage: d.resumePage }
      : {}),
  };
}
export function catalog(local: {
  documents: Document[];
  shelves: Shelf[];
}): CloudData {
  return {
    documents: local.documents
      .map((d, i) => cloudDocument({ ...d, libraryOrder: orderValue(d, i) }))
      .sort((a, b) => a.hash.localeCompare(b.hash)),
    shelves: [...local.shelves].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
const stable = (v: unknown) =>
  JSON.stringify(v, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, value[k]]),
        )
      : value,
  );
const equal = (a: unknown, b: unknown) => stable(a) === stable(b);
export function sameCatalog(a: CloudData, b: CloudData) {
  const sort = (c: CloudData) => ({
    documents: [...c.documents].sort((a, b) => a.hash.localeCompare(b.hash)),
    shelves: [...c.shelves].sort((a, b) => a.id.localeCompare(b.id)),
  });
  return equal(sort(a), sort(b));
}
/** History is a union; exact words stay local; concurrent pages prefer the server. */
export function mergeLibrary<
  T extends { documents: Document[]; shelves: Shelf[]; cloud?: CloudState },
>(local: T, reply: LibraryReply, _openHash?: string | null): T {
  if (local.cloud && reply.revision < local.cloud.revision) return local;
  const base = local.cloud?.base || emptyCatalog();
  const localShelves = new Map(local.shelves.map((s) => [s.id, s]));
  const remoteShelves = new Map(reply.data.shelves.map((s) => [s.id, s]));
  const baseShelves = new Map(base.shelves.map((s) => [s.id, s]));
  const shelves: Shelf[] = [];
  for (const id of new Set([...localShelves.keys(), ...remoteShelves.keys()])) {
    const l = localShelves.get(id),
      r = remoteShelves.get(id),
      b = baseShelves.get(id);
    const chosen = b ? (equal(l, b) ? r : l) : l || r;
    if (chosen) shelves.push(chosen);
  }
  const docs = new Map(local.documents.map((d) => [d.hash, d]));
  const bases = new Map(base.documents.map((d) => [d.hash, d]));
  for (const r of reply.data.documents) {
    const l = docs.get(r.hash),
      b = bases.get(r.hash);
    if (
      l &&
      (totalWords(l) !== r.total ||
        (l.extractionVersion || 1) !== r.extractionVersion)
    )
      throw new AppError("errors.cloudExtraction");
    const localMetadata = l ? cloudDocument({ ...l, conflict: undefined }) : r;
    const initialLocal =
      l &&
      !b &&
      l.seen.length === 0 &&
      l.position === 0 &&
      !(l.readingStart || 0);
    const choose = <K extends keyof CloudDocument>(key: K): CloudDocument[K] =>
      !l || initialLocal || (b && equal(localMetadata[key], b[key]))
        ? r[key]
        : localMetadata[key];
    const readingStart = choose("readingStart");
    const remotePage = validPage(r.resumePage, r.pageCount)
      ? r.resumePage
      : undefined;
    const remotePageChanged =
      remotePage !== undefined && remotePage !== b?.resumePage;
    const page = remotePageChanged ? remotePage : (l?.resumePage ?? remotePage);
    const seen = [
      ...new Set([
        ...(l?.seen || []),
        ...expand(r.seen, r.total),
        ...presentedPositions(reply.presented?.[r.hash], r.total),
      ]),
    ]
      .filter((p) => p >= 0 && p < r.total)
      .sort((a, b) => a - b);
    docs.set(r.hash, {
      ...(l || { hash: r.hash, uri: "", words: [], available: false }),
      title: choose("title"),
      customTitle: choose("customTitle"),
      wordCount: r.total,
      extractionVersion: r.extractionVersion,
      pageCount: r.pageCount,
      position: l?.position ?? 0,
      legacyPosition: r.position,
      localResumeValid: l?.localResumeValid ?? !!l?.words.length,
      resumePage: page,
      readingStart,
      seen,
      completed: !!l?.completed || r.completed,
      shelfId: choose("shelfId") || undefined,
      libraryOrder:
        choose("libraryOrder") ??
        l?.libraryOrder ??
        reply.data.documents.indexOf(r),
      coverPage: choose("coverPage") || 0,
      synced: true,
      conflict: undefined,
    });
  }
  const documents = [...docs.values()].map((d) => ({
    ...d,
    shelfId: shelves.some((s) => s.id === d.shelfId) ? d.shelfId : undefined,
  }));
  return {
    ...local,
    documents,
    shelves: uniqueShelves(shelves),
    cloud: { revision: reply.revision, base: reply.data },
  };
}
export function uniqueShelves(input: Shelf[]): Shelf[] {
  const names = new Set<string>();
  return [...input]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => {
      const original = s.name.normalize("NFC").trim();
      let name = original,
        i = 2;
      const key = (n: string) => n.toLocaleLowerCase("pt-BR");
      while (names.has(key(name))) {
        const suffix = ` (${i++})`;
        name = original.slice(0, 60 - suffix.length) + suffix;
      }
      names.add(key(name));
      return { ...s, name };
    });
}

function presentedPositions(
  value: number[] | Range[] | undefined,
  total: number,
): number[] {
  if (!value?.length) return [];
  return Array.isArray(value[0])
    ? expand(value as Range[], total)
    : (value as number[]);
}
