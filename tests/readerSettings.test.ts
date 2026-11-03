import test from "node:test";
import assert from "node:assert/strict";
import {
  contrast,
  readerPalette,
  readerDefaults,
  readerPresets,
  parseReaderColors,
  validColor,
  hsvColor,
  colorHsv,
} from "../src/readerPalette";
import { applyShelfOrder, orderedBooks } from "../src/libraryOrder";
import type { Document } from "../src/core";
test("reader preferences validate hexadecimal values and recover malformed saved values", () => {
  for (const value of [
    null,
    {},
    { background: "#FFF", word: "#000000" },
    { background: "#123456", word: "bad" },
  ])
    assert.deepEqual(parseReaderColors(value), readerDefaults);
  assert.deepEqual(
    parseReaderColors({ background: "#aBc123", word: "#ffffff" }),
    { background: "#ABC123", word: "#FFFFFF" },
  );
  assert.equal(validColor("#123456"), true);
  assert.equal(validColor("#12345678"), false);
  assert.equal(validColor("123456"), false);
  assert.equal(hsvColor(0, 1, 1), "#FF0000");
  assert.equal(hsvColor(120, 1, 1), "#00FF00");
  assert.equal(hsvColor(240, 1, 1), "#0000FF");
  for (const color of [
    "#000000",
    "#FFFFFF",
    "#777777",
    "#15181D",
    "#F5F0E7",
    "#FF0000",
  ]) {
    const next = colorHsv(color);
    assert.equal(hsvColor(next.h, next.s, next.v), color);
  }
});
test("reader palettes keep controls readable without replacing the chosen word color", () => {
  for (const background of [
    "#000000",
    "#FFFFFF",
    "#777777",
    "#FF0000",
    "#00FFFF",
    "#550F1D",
  ])
    for (const word of ["#000000", "#FFFFFF", background, "#FFFF00"]) {
      const p = readerPalette({ background, word });
      assert.equal(p.word, word);
      assert.equal(p.background, background);
      assert.ok(contrast(p.background, p.ink) >= 4.5);
      assert.ok(contrast(p.soft, p.secondaryInk) >= 4.5);
      assert.ok(contrast(p.accent, p.onAccent) >= 4.5);
      assert.ok(contrast(p.background, p.border) >= 3);
      assert.equal(p.lowContrast, contrast(background, word) < 4.5);
    }
  for (const preset of Object.values(readerPresets))
    assert.equal(readerPalette(preset).lowContrast, false);
  assert.equal(readerPalette(readerPresets.dark).statusStyle, "light");
  assert.equal(readerPalette(readerPresets.light).statusStyle, "dark");
});
test("saving a shelf draft retains remote moves and appends books added while it was open", () => {
  const book = (
    hash: string,
    shelfId: string,
    libraryOrder: number,
  ): Document => ({
    hash,
    title: hash,
    words: [],
    uri: "private",
    seen: [1],
    position: 1,
    shelfId,
    libraryOrder,
  });
  const state = {
    shelves: [
      { id: "s", name: "Shelf" },
      { id: "other", name: "Other" },
    ],
    documents: [
      book("a", "s", 0),
      book("b", "s", 1),
      book("c", "other", 9),
      book("new", "s", 2),
    ],
  };
  const saved = applyShelfOrder(state, "s", ["c", "b", "a"]);
  assert.deepEqual(
    orderedBooks(saved.documents, "s").map((d) => d.hash),
    ["b", "a", "new"],
  );
  assert.deepEqual(
    saved.documents.find((d) => d.hash === "c"),
    state.documents[2],
  );
  assert.deepEqual(saved.documents[0].seen, [1]);
  assert.equal(saved.documents[0].position, 1);
});
