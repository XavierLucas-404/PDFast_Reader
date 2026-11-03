import test from "node:test";
import assert from "node:assert/strict";
import {
  orderedBooks,
  placeBook,
  stepBook,
  adjacentTab,
} from "../src/libraryOrder";
import { cropRectangle } from "../src/coverCrop";
import { catalog, mergeLibrary } from "../src/librarySync";
import type { Document } from "../src/core";
const book = (hash: string, extra: Partial<Document> = {}): Document => ({
  hash,
  title: hash + ".pdf",
  uri: "private.pdf",
  words: [{ text: "word", page: 1, paragraphEnd: false }],
  position: 0,
  seen: [],
  pageCount: 4,
  ...extra,
});
test("ordering preserves initial order, moves between empty shelves, and retains reading and private artwork", () => {
  const state = {
    shelves: [{ id: "s", name: "Shelf" }],
    documents: [
      book("c"),
      book("b"),
      book("a", { seen: [0], position: 0, customCover: "private.jpg" }),
    ],
  };
  assert.deepEqual(
    orderedBooks(state.documents).map((d) => d.hash),
    ["c", "b", "a"],
  );
  const reordered = placeBook(state, "a", "", "b");
  assert.deepEqual(
    orderedBooks(reordered.documents).map((d) => d.hash),
    ["c", "a", "b"],
  );
  const moved = placeBook(reordered, "a", "s");
  assert.deepEqual(
    orderedBooks(moved.documents, "s").map((d) => d.hash),
    ["a"],
  );
  assert.equal(moved.documents[2].customCover, "private.jpg");
  assert.deepEqual(moved.documents[2].seen, [0]);
  assert.equal(placeBook(state, "a", "missing"), state);
  assert.deepEqual(
    orderedBooks(stepBook(state, "a", -1).documents).map((d) => d.hash),
    ["c", "a", "b"],
  );
  assert.equal(stepBook(state, "c", -1), state);
  assert.deepEqual(
    orderedBooks([
      book("b", { libraryOrder: 1 }),
      book("a", { libraryOrder: 1 }),
    ]).map((d) => d.hash),
    ["a", "b"],
  );
});
test("tab swipes require deliberate horizontal movement and never wrap", () => {
  assert.equal(adjacentTab(0, -100, 5), 1);
  assert.equal(adjacentTab(3, -100, 0), 3);
  assert.equal(adjacentTab(0, 100, 0), 0);
  assert.equal(adjacentTab(2, 100, 5), 1);
  assert.equal(adjacentTab(1, -40, 0), 1);
  assert.equal(adjacentTab(1, -100, 110), 1);
});
test("crop remains within image bounds at every aspect ratio, zoom and drag offset", () => {
  for (const [w, h] of [
    [1200, 600],
    [600, 1200],
    [240, 360],
    [1, 1],
  ])
    for (const zoom of [1, 1.5, 3])
      for (const x of [-10000, 0, 10000]) {
        const r = cropRectangle(w, h, zoom, x, -x);
        assert.ok(r.originX >= 0 && r.originY >= 0);
        assert.ok(r.originX + r.width <= w + 0.001);
        assert.ok(r.originY + r.height <= h + 0.001);
        assert.ok(Math.abs(r.width / r.height - 2 / 3) < 0.001);
      }
});
test("catalog syncs only page and order, preserves local gallery override and uses three-way metadata merge", () => {
  const state = {
    documents: [
      book("a", { coverPage: 2, libraryOrder: 3, customCover: "private.jpg" }),
    ],
    shelves: [],
  };
  const base = catalog(state);
  const serialized = JSON.stringify(base);
  assert.ok(!serialized.includes("private"));
  assert.equal(base.documents[0].coverPage, 2);
  assert.equal(base.documents[0].libraryOrder, 3);
  const remote = structuredClone(base);
  remote.documents[0].coverPage = 4;
  remote.documents[0].libraryOrder = 1;
  const merged = mergeLibrary(
    { ...state, cloud: { revision: 1, base } },
    { revision: 2, data: remote },
  );
  assert.equal(merged.documents[0].coverPage, 4);
  assert.equal(merged.documents[0].customCover, "private.jpg");
  assert.deepEqual(merged.documents[0].seen, []);
  const localChanged = {
    ...state,
    documents: [{ ...state.documents[0], coverPage: 1, libraryOrder: 9 }],
    cloud: { revision: 1, base },
  };
  const concurrent = mergeLibrary(localChanged, { revision: 2, data: remote });
  assert.equal(concurrent.documents[0].coverPage, 1);
  assert.equal(concurrent.documents[0].libraryOrder, 9);
});
