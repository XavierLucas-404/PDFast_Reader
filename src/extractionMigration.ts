import { AppError } from "./i18n";
import type { Document, ReadingSession } from "./core";
import type { PdfExtraction } from "./extraction";
import { CHAPTER_DETECTION_VERSION } from "./chapters";
import { normalizeTitle } from "./titles";

/** Compose raw PDF source IDs through the old tokenization; v2 IDs are NOT raw IDs. */
export function migrationSources(
  document: Document,
  result: PdfExtraction,
): number[][] {
  if ((document.extractionVersion || 1) < 2) return result.sources;
  const legacy = result.legacy;
  if (
    !legacy ||
    legacy.words.length !== document.words.length ||
    legacy.words.some(
      (w, i) =>
        w.text !== document.words[i].text || w.page !== document.words[i].page,
    )
  )
    throw new AppError("errors.previousExtraction");
  const rawToOld = new Map<number, number>();
  legacy.sources.forEach((s, i) => s.forEach((p) => rawToOld.set(p, i)));
  return result.sources.map((s) => [
    ...new Set(
      s.map((p) => {
        const index = rawToOld.get(p);
        if (index === undefined) throw new AppError("errors.extractionMap");
        return index;
      }),
    ),
  ]);
}
export function addChapterMetadata(
  document: Document,
  result: PdfExtraction,
): Document {
  const same = (words: Document["words"]) =>
    words.length === document.words.length &&
    words.every(
      (w, i) =>
        w.text === document.words[i].text && w.page === document.words[i].page,
    );
  let starts: number[];
  if (same(result.words)) starts = result.chapterStarts || [];
  else if (result.legacy && same(result.legacy.words))
    starts = result.legacy.chapterStarts;
  else if ((document.extractionVersion || 1) < 2)
    starts = (result.chapterStarts || []).map((i) =>
      Math.min(...result.sources[i]),
    );
  else throw new AppError("errors.chapterMap");
  return {
    ...document,
    chapterStarts: starts,
    chapterDetectionVersion: CHAPTER_DETECTION_VERSION,
  };
}
export function migrateDocument(
  document: Document,
  result: PdfExtraction,
): { document: Document; sources: number[][] } {
  const sources = migrationSources(document, result),
    oldToNew = new Map<number, number>();
  sources.forEach((s, i) =>
    s.forEach((p) => {
      if (oldToNew.has(p) && oldToNew.get(p) !== i)
        throw new AppError("errors.wordSplit");
      oldToNew.set(p, i);
    }),
  );
  const seen = new Set(document.seen);
  return {
    sources,
    document: {
      ...document,
      title: document.customTitle
        ? document.title
        : normalizeTitle(document.title),
      words: result.words,
      wordCount: result.words.length,
      pageCount: result.pageCount,
      extractionVersion: result.extractionVersion,
      position: oldToNew.get(document.position) ?? 0,
      legacyPosition:
        document.legacyPosition === undefined
          ? undefined
          : (oldToNew.get(document.legacyPosition) ?? 0),
      readingStart: oldToNew.get(document.readingStart || 0) ?? 0,
      seen: sources.flatMap((s, i) => (s.every((p) => seen.has(p)) ? [i] : [])),
      chapterStarts: result.chapterStarts || [],
      chapterDetectionVersion: CHAPTER_DETECTION_VERSION,
    },
  };
}
/** Each owner gets at most one queued occurrence per reconstructed word. */
export function migratePendingSessions(
  queue: readonly ReadingSession[],
  hash: string,
  sources: readonly number[][],
  total: number,
): ReadingSession[] {
  const replacements = new Map<string, ReadingSession>();
  const owners = new Set(
    queue.filter((q) => q.hash === hash).map((q) => q.owner),
  );
  for (const owner of owners) {
    const sessions = queue.filter((q) => q.hash === hash && q.owner === owner);
    const occurrences = new Map<number, number[]>();
    sessions.forEach((session, i) => {
      replacements.set(session.id, { ...session, total, positions: [] });
      for (const p of new Set(session.positions)) {
        const list = occurrences.get(p) || [];
        list.push(i);
        occurrences.set(p, list);
      }
    });
    sources.forEach((old, newIndex) => {
      if (!old.every((p) => occurrences.has(p))) return;
      const eligible = (i: number) =>
        sessions[i].wpm >= 100 && sessions[i].wpm <= 600;
      const canScore = old.every((p) => occurrences.get(p)!.some(eligible));
      const choices = old
        .flatMap((p) => occurrences.get(p)!)
        .filter((i) => (canScore ? eligible(i) : !eligible(i)));
      if (!choices.length) return;
      const target = sessions[Math.max(...choices)];
      replacements.get(target.id)!.positions.push(newIndex);
    });
  }
  return queue.flatMap((q) => {
    if (q.hash !== hash) return [q];
    const next = replacements.get(q.id)!;
    return next.positions.length ? [next] : [];
  });
}
