import { migrateResume } from "./resume";
import { AppError } from "./i18n";
import type { Document } from "./core";
import type { PdfExtraction } from "./extraction";
import { CHAPTER_DETECTION_VERSION } from "./chapters";
import { totalWords } from "./librarySync";
export function checkImportedHash(actual: string, expected?: string) {
  if (expected && actual !== expected)
    throw new AppError("errors.differentFile");
}
export function attachFile(
  document: Document,
  result: PdfExtraction,
  uri: string,
): Document {
  const version = document.extractionVersion || 1;
  const extraction =
    version === 2 ? result.legacy : version === 1 ? result.original : result;
  if (!extraction || extraction.words.length !== totalWords(document))
    throw new AppError("errors.extractionHistory");
  return migrateResume({
    ...document,
    uri,
    words: extraction.words,
    available: true,
    chapterStarts: extraction.chapterStarts || [],
    chapterDetectionVersion: CHAPTER_DETECTION_VERSION,
    resumePage:
      document.resumePage ??
      extraction.words[document.legacyPosition ?? document.position]?.page,
  });
}
