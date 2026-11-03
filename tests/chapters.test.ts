import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { extractPage } from "../src/extraction";
import {
  CHAPTER_DETECTION_VERSION,
  normalizeChapterLabel,
  chapterCandidates,
  detectChapterStarts,
  chapterWait,
  readChapterBookmarks,
} from "../src/chapters";
import {
  migrateDocument,
  migratePendingSessions,
  addChapterMetadata,
} from "../src/extractionMigration";
import { PlaybackClock } from "../src/playback";
import { delay, type Document, type ReadingSession } from "../src/core";
const item = (
  str: string,
  height: number,
  x: number,
  y: number,
  width = str.length * 7,
) => ({ str, height, width, transform: [height, 0, 0, height, x, y] });
const pageItems = (cap = "O", stem = "uço", gap = 0.00342) => [
  item("1", 26.64, 72, 421.92, 13.32),
  item(cap, 26.64, 72, 332.64, 19.23408),
  item(stem + " uma frase.", 14.4, 91.23408 + gap, 332.64),
  item("Outro parágrafo longo.", 14.4, 72, 295.92),
];
test("Tight vowel drop caps join long fragments; spaced articles and explicit spaces stay separate", () => {
  assert.equal(extractPage(pageItems(), 12).words[1].text, "Ouço");
  assert.equal(extractPage(pageItems("H", "á"), 19).words[1].text, "Há");
  assert.equal(extractPage(pageItems("O", "homem", 4), 12).words[1].text, "O");
  assert.equal(extractPage(pageItems(), 12, 2).words[1].text, "O");
  const spaced = pageItems();
  spaced[1].str = "O ";
  assert.equal(extractPage(spaced, 12).words[1].text, "O");
});
test("Bookmarks identify real chapters and exclude front matter; plain page breaks never create chapters", () => {
  const p = extractPage(pageItems(), 12),
    c = chapterCandidates(pageItems(), p, 12);
  assert.deepEqual(
    detectChapterStarts(p.words, c, [
      { title: "Sumário", page: 12 },
      { title: "Capítulo 1", page: 12 },
    ]),
    [0],
  );
  assert.deepEqual(
    detectChapterStarts(p.words, [], [{ title: "Créditos", page: 12 }]),
    [],
  );
  assert.deepEqual(detectChapterStarts(p.words, c, []), []); // One numeric heading alone is insufficient.
  const next = c.map((x) => ({
    ...x,
    page: 19,
    index: p.words.length,
    label: "2",
    number: 2,
  }));
  assert.deepEqual(
    detectChapterStarts(
      [...p.words, ...p.words.map((w) => ({ ...w, page: 19 }))],
      [...c, ...next],
      [],
    ),
    [0, p.words.length],
  );
  assert.deepEqual(
    detectChapterStarts(
      p.words,
      c.map((x) => ({ ...x, strong: false })),
      [],
    ),
    [],
  );
});
test("Explicit chapter headings work without bookmarks and invalid bookmark destinations fail softly", async () => {
  const input = pageItems();
  input[0] = { ...input[0], str: "Capítulo 1" };
  const p = extractPage(input, 12);
  assert.deepEqual(
    detectChapterStarts(p.words, chapterCandidates(input, p, 12), []),
    [0],
  );
  const bookmarks = await readChapterBookmarks({
    getOutline: async () => [
      { title: "Sumário", dest: [0] },
      { title: "Capítulo 1", dest: "one" },
      { title: "Capítulo 2", dest: "bad" },
    ],
    getDestination: async (s) => {
      if (s === "bad") throw Error();
      return [11];
    },
    getPageIndex: async () => 0,
  });
  assert.deepEqual(bookmarks, [{ title: "Capítulo 1", page: 12 }]);
});
function result() {
  const items = pageItems(),
    old = extractPage(items, 12, 2),
    next = extractPage(items, 12);
  return {
    words: next.words,
    sources: next.sources,
    pageCount: 20,
    extractionVersion: 3,
    chapterStarts: [0],
    legacy: { words: old.words, sources: old.sources, chapterStarts: [0] },
  };
}
const document = (): Document => ({
  hash: "a".repeat(64),
  title: "Teste",
  uri: "local",
  words: result().legacy.words,
  position: 2,
  readingStart: 1,
  seen: [1, 2],
  extractionVersion: 2,
});
const session = (
  id: string,
  positions: number[],
  wpm = 250,
  owner = "a",
): ReadingSession => ({
  id,
  owner,
  hash: "a".repeat(64),
  total: result().legacy.words.length,
  positions,
  wpm,
  activeMs: positions.length * 600,
});
test("v2-to-v3 composes raw IDs, preserves merged history only with all fragments, and preserves indexed documents", () => {
  const d = document(),
    m = migrateDocument(d, result());
  assert.equal(m.document.words[1].text, "Ouço");
  assert.equal(m.document.position, 1);
  assert.equal(m.document.readingStart, 1);
  assert.deepEqual(m.document.seen, [1]);
  assert.deepEqual(
    migrateDocument({ ...d, seen: [1] }, result()).document.seen,
    [],
  );
  const kept = addChapterMetadata({ ...d, synced: true }, result());
  assert.equal(kept.words, d.words);
  assert.equal(kept.extractionVersion, 2);
  assert.deepEqual(kept.chapterStarts, [0]);
  assert.throws(() => migrateDocument({ ...d, words: [] }, result()));
});
test("Pending sessions merge across chunks, deduplicate, preserve owners, timing, IDs and conservative eligibility", () => {
  const { sources, document: d } = migrateDocument(document(), result());
  const q = [
    session("1", [1]),
    session("2", [2, 3]),
    session("3", [1, 2]),
    session("4", [1, 2], 250, "b"),
  ];
  const next = migratePendingSessions(q, d.hash, sources, d.words.length);
  assert.deepEqual(
    next.map((s) => [s.id, s.owner, s.positions]),
    [
      ["2", "a", [2]],
      ["3", "a", [1]],
      ["4", "b", [1]],
    ],
  );
  next.forEach((s) => {
    assert.equal(s.total, d.words.length);
    assert.equal(s.activeMs, q.find((x) => x.id === s.id)!.activeMs);
  });
  assert.deepEqual(
    migratePendingSessions(
      [session("1", [1])],
      d.hash,
      sources,
      d.words.length,
    ),
    [],
  );
  const mixed = migratePendingSessions(
    [session("1", [1]), session("2", [2], 700)],
    d.hash,
    sources,
    d.words.length,
  );
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].wpm, 700);
  assert.deepEqual(mixed[0].positions, [1]);
});
test("Chapter transition shows the next word before waiting, excludes dwell from credit, and can be cancelled", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const wpm of [100, 250, 800]) {
      const clock = new PlaybackClock();
      const duration = delay(
        { text: "fim.", page: 1, paragraphEnd: false },
        wpm,
      );
      let position = 2,
        count = 0,
        activeMs = 0,
        transition = false;
      clock.schedule(() => {
        count++;
        activeMs += duration;
        transition = !!chapterWait([3], position);
        position++;
        clock.schedule(
          () => {
            transition = false;
          },
          chapterWait([3], position - 1),
        );
      }, duration);
      mock.timers.tick(duration);
      assert.equal(position, 3);
      assert.equal(transition, true);
      assert.equal(count, 1);
      assert.equal(activeMs, duration);
      mock.timers.tick(1999);
      assert.equal(transition, true);
      mock.timers.tick(1);
      assert.equal(transition, false);
      assert.equal(activeMs, duration);
      assert.equal(count, 1);
      clock.schedule(() => count++, 2000);
      clock.cancel();
      mock.timers.tick(2000);
      assert.equal(count, 1);
      clock.schedule(() => count++, duration);
      mock.timers.tick(duration);
      assert.equal(count, 2);
      assert.equal(chapterWait([3], 3), 0);
    }
  } finally {
    mock.timers.reset();
  }
});

test("Tracked chapter keywords normalize only the leading label, with Portuguese accents and Unicode spacing", () => {
  assert.equal(normalizeChapterLabel("C H A P T E R 2"), "CHAPTER 2");
  assert.equal(
    normalizeChapterLabel("C\u200bH\u200bA\u200bP\u200bT\u200bE\u200bR\u00a02"),
    "CHAPTER 2",
  );
  assert.equal(
    normalizeChapterLabel("C A P I\u0301 T U L O : 2"),
    "CAPÍTULO 2",
  );
  assert.equal(
    normalizeChapterLabel("Chapter 2 A N O V E L"),
    "Chapter 2 A N O V E L",
  );
  assert.equal(normalizeChapterLabel("Chapterhouse"), "Chapterhouse");
  assert.equal(
    normalizeChapterLabel("The C H A P T E R 2 reference"),
    "The C H A P T E R 2 reference",
  );
});
test("A tracked opening title is detected without bookmarks or drop caps, without changing stored words or counting subsections", () => {
  const input = [
    item("C H A P T E R 2", 17.25, 246.75, 708, 118.1524),
    item("An example title (1984)", 15, 235.5, 677.25),
    item("1", 13.5, 302.25, 627),
    item(
      "This synthetic paragraph starts below the heading.",
      11.25,
      94.5,
      602.25,
    ),
    item("The next line continues the same paragraph.", 11.25, 94.5, 589.5),
    item("2", 13.5, 302.25, 440),
    item("A numbered subsection is ordinary body text.", 11.25, 94.5, 415),
  ];
  const page = extractPage(input, 21),
    before = JSON.stringify(page.words);
  const candidates = chapterCandidates(input, page, 21);
  assert.deepEqual(
    candidates.map((c) => c.label),
    ["CHAPTER 2"],
  );
  const starts = detectChapterStarts(page.words, candidates, []);
  assert.deepEqual(starts, [0]);
  const saved: Document = {
    hash: "a".repeat(64),
    title: "Reference.pdf",
    uri: "local",
    words: page.words,
    position: 12,
    readingStart: 8,
    seen: [8, 9, 10],
    extractionVersion: 3,
    chapterDetectionVersion: 1,
    chapterStarts: [],
  };
  const result = {
    words: page.words,
    sources: page.sources,
    pageCount: 21,
    extractionVersion: 3,
    chapterStarts: starts,
  };
  const upgraded = addChapterMetadata(saved, result);
  assert.equal(upgraded.chapterDetectionVersion, CHAPTER_DETECTION_VERSION);
  assert.strictEqual(upgraded.words, saved.words);
  assert.strictEqual(upgraded.seen, saved.seen);
  assert.equal(upgraded.position, 12);
  assert.equal(upgraded.readingStart, 8);
  assert.equal(JSON.stringify(page.words), before);
  assert.equal(upgraded.words[0].text, "C"); // recognition must not merge indexed heading letters
  const body = input.map((i) => ({
    ...i,
    height: 11.25,
    transform: [11.25, 0, 0, 11.25, i.transform[4], i.transform[5]],
  }));
  const ordinary = extractPage(body, 21);
  assert.deepEqual(chapterCandidates(body, ordinary, 21), []);
});
test("Tracked bookmark labels match conventional headings while ordinary front matter is excluded", async () => {
  const bookmarks = await readChapterBookmarks({
    getOutline: async () => [
      { title: "C H A P T E R 2", dest: [20] },
      { title: "C O N T E N T S", dest: [1] },
    ],
    getDestination: async () => null,
    getPageIndex: async () => 0,
  });
  assert.deepEqual(bookmarks, [{ title: "C H A P T E R 2", page: 21 }]);
  const input = [
    item("Chapter 2", 20, 72, 450),
    item("A synthetic paragraph for this chapter.", 12, 72, 350),
    item("Another normal line of body text.", 12, 72, 330),
  ];
  const page = extractPage(input, 21);
  assert.deepEqual(
    detectChapterStarts(
      page.words,
      chapterCandidates(input, page, 21),
      bookmarks,
    ),
    [0],
  );
});
