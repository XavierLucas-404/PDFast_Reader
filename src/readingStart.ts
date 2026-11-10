import { totalWords } from "./librarySync";
import type { Document, Word } from "./core";
import type { PdfExtraction } from "./extraction";
import { migrateDocument } from "./extractionMigration";
export type SentenceChoice = {
  start: number;
  end: number;
  page: number;
  endPage: number;
  text: string;
};
const end = /[.!?]["'”’»)\]}]*$/u;
export function sentenceChoices(
  words: readonly Word[],
  page: number,
): SentenceChoice[] {
  if (!words.some((word) => word.page === page && !word.heading)) return [];
  const choices: SentenceChoice[] = [];
  let start = -1;
  function finish(last: number) {
    if (start < 0) return;
    const first = start;
    start = -1;
    if (words[first].page <= page && words[last].page >= page)
      choices.push({
        start: first,
        end: last,
        page: words[first].page,
        endPage: words[last].page,
        text: words
          .slice(first, last + 1)
          .map((w) => w.text)
          .join(" "),
      });
  }
  for (let index = 0; index < words.length; index++) {
    if (words[index].heading) {
      finish(index - 1);
      continue;
    }
    if (start < 0) start = index;
    if (end.test(words[index].text)) finish(index);
  }
  finish(words.length - 1);
  return choices;
}
export function progress(
  document: Pick<Document, "words" | "seen" | "readingStart" | "wordCount">,
) {
  const start = document.readingStart || 0;
  const total = Math.max(0, totalWords(document) - start);
  const presented = new Set(
    document.seen.filter((p) => p >= start && p < totalWords(document)),
  ).size;
  return {
    presented,
    total,
    percent: total ? Math.round((presented / total) * 100) : 0,
    complete: total > 0 && presented === total,
  };
}
export function migrateExtraction(
  document: Document,
  result: PdfExtraction,
): Document {
  return migrateDocument(document, result).document;
}

/** A persisted completion is announced once; reaching the end again is ordinary rereading. */
export function completionMessage(
  before: Document,
  after: Document,
  atEnd: boolean,
): "reader.complete" | "reader.incomplete" | null {
  const alreadyComplete = !!before.completed || progress(before).complete;
  const nowComplete = progress(after).complete;
  if (!alreadyComplete && nowComplete) return "reader.complete";
  if (atEnd && !alreadyComplete && !nowComplete) return "reader.incomplete";
  return null;
}
