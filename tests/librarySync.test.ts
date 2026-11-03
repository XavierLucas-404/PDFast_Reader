import { test } from "node:test";
import assert from "node:assert/strict";
import type { Document } from "../src/core";
import {
  catalog,
  mergeLibrary,
  sameCatalog,
  ranges,
  expand,
  emptyCatalog,
  uniqueShelves,
} from "../src/librarySync";
import { progress } from "../src/readingStart";
const doc = (extra: Partial<Document> = {}): Document => ({
  hash: "a".repeat(64),
  title: "Título.pdf",
  uri: "local/pdf",
  words: Array.from({ length: 10 }, (_, i) => ({
    text: String(i),
    page: 1,
    paragraphEnd: false,
  })),
  position: 0,
  readingStart: 0,
  seen: [],
  extractionVersion: 3,
  pageCount: 3,
  resumePage: 1,
  localResumeValid: true,
  legacyPosition: 0,
  ...extra,
});
const local = (d = doc()) => ({
  documents: [d],
  shelves: [{ id: "s", name: "Romances" }],
});
test("a fresh installation restores only cloud metadata and preserves progress without a PDF", () => {
  const data = catalog(
    local(
      doc({ position: 5, legacyPosition: 5, seen: [0, 1, 4], shelfId: "s" }),
    ),
  );
  const restored = mergeLibrary(
    { documents: [] as Document[], shelves: [] },
    { revision: 1, data, presented: { ["a".repeat(64)]: [[2, 2]] } },
  );
  assert.equal(restored.documents[0].available, false);
  assert.equal(restored.documents[0].words.length, 0);
  assert.equal(restored.documents[0].position, 0);
  assert.equal(restored.documents[0].legacyPosition, 5);
  assert.equal(restored.documents[0].resumePage, 1);
  assert.equal(restored.documents[0].localResumeValid, false);
  assert.equal(restored.documents[0].shelfId, "s");
  assert.equal(progress(restored.documents[0]).percent, 40);
  assert.deepEqual(restored.documents[0].seen, [0, 1, 2, 4]);
  assert.equal(JSON.stringify(catalog(restored)).includes('"words"'), false);
  assert.equal(JSON.stringify(catalog(restored)).includes('"uri"'), false);
});
test("opening unchanged data does not overwrite remote bookmarks; names and shelves merge independently", () => {
  const base = catalog(local());
  const state = { ...local(), cloud: { revision: 1, base } };
  const remote = {
    ...base,
    documents: base.documents.map((d) => ({
      ...d,
      position: 8,
      title: "Outro nome",
    })),
    shelves: [{ id: "s", name: "Favoritos" }],
  };
  const merged = mergeLibrary(state, { revision: 2, data: remote });
  assert.equal(merged.documents[0].position, 0);
  assert.equal(merged.documents[0].legacyPosition, 8);
  assert.equal(merged.documents[0].title, "Outro nome");
  assert.equal(merged.shelves[0].name, "Favoritos");
  assert.ok(sameCatalog(catalog(merged), remote));
  assert.ok(
    sameCatalog(base, {
      documents: base.documents.map(
        (d) => Object.fromEntries(Object.entries(d).reverse()) as any,
      ),
      shelves: base.shelves,
    }),
  );
});
test("remote pages do not replace local words or create open-document conflicts; history is merged", () => {
  const base = catalog(local());
  const state = {
    ...local(doc({ position: 3, seen: [0, 1] })),
    cloud: { revision: 1, base },
  };
  const remote = {
    ...base,
    documents: base.documents.map((d) => ({
      ...d,
      position: 7,
      resumePage: 2,
      readingStart: 2,
      seen: [[2, 4] as [number, number]],
    })),
  };
  const merged = mergeLibrary(state, { revision: 2, data: remote });
  const d = merged.documents[0];
  assert.equal(d.position, 3);
  assert.equal(d.conflict, undefined);
  assert.equal(d.resumePage, 2);
  assert.deepEqual(d.seen, [0, 1, 2, 3, 4]);
  assert.equal(catalog(merged).documents[0].position, 7);
  const open = mergeLibrary(state, { revision: 2, data: remote }, d.hash);
  assert.equal(open.documents[0].conflict, undefined);
  assert.equal(open.documents[0].position, 3);
});
test("history compression and canonical extraction cannot alter competitive indices", () => {
  assert.deepEqual(ranges([3, 1, 2, 2, 8]), [
    [1, 3],
    [8, 8],
  ]);
  assert.deepEqual(
    expand(
      [
        [1, 3],
        [8, 20],
      ],
      10,
    ),
    [1, 2, 3, 8, 9],
  );
  const state = local();
  const remote = catalog(state);
  remote.documents[0].extractionVersion = 2;
  assert.throws(
    () => mergeLibrary(state, { revision: 1, data: remote }),
    /extração/,
  );
  const names = uniqueShelves([
    { id: "b", name: "Ficção" },
    { id: "a", name: "Ficção" },
  ]);
  assert.equal(new Set(names.map((s) => s.name)).size, 2);
  assert.deepEqual(emptyCatalog(), { documents: [], shelves: [] });
});
