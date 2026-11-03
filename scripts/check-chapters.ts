// Private reference PDFs remain outside the repository. Print only diagnostic facts.
import fs from "node:fs";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPage } from "../src/extraction";
import {
  chapterCandidates,
  detectChapterStarts,
  readChapterBookmarks,
} from "../src/chapters";
import {
  migrateDocument,
  migratePendingSessions,
} from "../src/extractionMigration";
async function main() {
  const filename = process.argv[2];
  if (!filename) throw Error("Informe o PDF de referência.");
  const pdf = await getDocument({
    data: new Uint8Array(fs.readFileSync(filename)),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;
  const words: any[] = [],
    sources: number[][] = [],
    legacyWords: any[] = [],
    legacySources: number[][] = [],
    candidates: any[] = [];
  let offset = 0;
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    const next = extractPage(content.items, n),
      old = extractPage(content.items, n, 2);
    candidates.push(
      ...chapterCandidates(content.items, next, n).map((c) => ({
        ...c,
        index: c.index + words.length,
      })),
    );
    for (const w of next.words) words.push(w);
    for (const s of next.sources) sources.push(s.map((p) => p + offset));
    for (const w of old.words) legacyWords.push(w);
    for (const s of old.sources) legacySources.push(s.map((p) => p + offset));
    offset += next.rawCount;
  }
  const bookmarks = await readChapterBookmarks(pdf),
    starts = detectChapterStarts(words, candidates, bookmarks);
  const rawToOld = new Map<number, number>();
  legacySources.forEach((s, i) => s.forEach((p) => rawToOld.set(p, i)));
  const result = {
    words,
    sources,
    pageCount: pdf.numPages,
    extractionVersion: 3,
    chapterStarts: starts,
    legacy: {
      words: legacyWords,
      sources: legacySources,
      chapterStarts: starts.map((i) => rawToOld.get(sources[i][0])!),
    },
  };
  const verity = filename.includes("verity");
  const it = filename.toLowerCase().includes("stephen-king");
  if (it) {
    const second = starts.find((i) => words[i].page === 21);
    assert.notEqual(second, undefined);
    assert.equal(words[second!].text, "C");
    assert.equal(starts.length, 23);
    for (const page of [20, 22, 23, 24])
      assert.ok(!starts.some((i) => words[i].page === page));
  }
  for (const [page, expected] of it
    ? []
    : verity
      ? ([
          [12, "Ouço"],
          [19, "Há"],
        ] as const)
      : ([
          [8, "MEU"],
          [12, "FUI"],
          [24, "EU"],
        ] as const)) {
    assert.equal(
      words.find((w) => w.page === page && !w.heading)?.text,
      expected,
    );
    assert.ok(starts.some((i) => words[i].page === page));
  }
  console.log({
    pages: pdf.numPages,
    chapters: starts.length,
    chapterPages: starts.map((i) => words[i].page),
    oldTotal: legacyWords.length,
    newTotal: words.length,
  });
  if (process.argv[3] && verity) {
    const local = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
    const d = local.documents.find((d: any) => d.title.includes("Verity"));
    const original = process.argv[4]
      ? JSON.parse(fs.readFileSync(process.argv[4], "utf8"))
      : legacyWords;
    const migrated = migrateDocument({ ...d, words: original }, result);
    const queue = migratePendingSessions(
      local.queue,
      d.hash,
      migrated.sources,
      words.length,
    );
    assert.equal(
      queue.reduce((s, q) => s + q.positions.length, 0) <=
        local.queue.reduce((s: number, q: any) => s + q.positions.length, 0),
      true,
    );
    console.log({
      oldSeen: d.seen.length,
      newSeen: migrated.document.seen.length,
      oldPosition: d.position,
      newPosition: migrated.document.position,
      oldPending: local.queue.length,
      newPending: queue.length,
    });
  }
  if (process.argv[5])
    fs.writeFileSync(process.argv[5], JSON.stringify(result));
  await pdf.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
