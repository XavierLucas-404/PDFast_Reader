import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPage } from "../src/extraction";
import { normalizeTitle } from "../src/titles";
import {
  sentenceChoices,
  progress,
  migrateExtraction,
} from "../src/readingStart";
import type { Document, Word } from "../src/core";
const item = (
  str: string,
  height = 15,
  x = 70,
  y = 600,
  width = str.length * 7,
) => ({
  str,
  height,
  width,
  transform: [height, 0, 0, height, x, y],
  hasEOL: false,
});
const source = () => [
  item("M", 60, 70, 575, 50),
  item("Capítulo 1", 25, 230, 690),
  item("EU", 10.5, 123, 600),
  item("PAI ERA REI.", 10.5, 145, 600),
  item("Outra frase.", 15, 70, 540),
];
test("a drop cap preceding a chapter heading joins the body fragment without joining the heading", () => {
  const page = extractPage(source(), 8);
  assert.equal(page.words[0].text, "Capítulo");
  assert.ok(page.words[0].heading);
  assert.equal(page.words[2].text, "MEU");
  assert.deepEqual(page.sources[2], [0, 3]);
  assert.equal(page.rawCount, 9);
  assert.equal(page.words.length, 8);
  const choices = sentenceChoices(page.words, 8);
  assert.equal(choices[0].text, "MEU PAI ERA REI.");
});
test("vowel drop cap can join the small fragment on the highest body line", () => {
  const page = extractPage(
    [
      item("E", 60, 70, 575, 36),
      item("Capítulo 3", 25, 230, 690),
      item("U", 10.5, 111, 600),
      item("ESTAVA", 10.5, 128, 600),
      item("PALAVRA ABAIXO", 15, 111, 577),
    ],
    24,
  );
  assert.ok(page.words.some((w) => w.text === "EU"));
  assert.ok(!page.words.some((w) => w.text === "EPALAVRA"));
});
test("standalone articles, initials, ordinary letters and distant columns remain separate", () => {
  for (const items of [
    [
      item("A", 60, 70, 575, 40),
      item("casa", 15, 114, 600),
      item("Texto normal longo", 15, 70, 540),
    ],
    [
      item("M", 15, 70, 600),
      item("Silva", 15, 82, 600),
      item("Texto normal longo", 15, 70, 540),
    ],
    [
      item("M", 60, 70, 575, 50),
      item("EU", 15, 300, 600),
      item("Texto normal longo", 15, 70, 540),
    ],
  ]) {
    const page = extractPage(items, 1);
    assert.equal(page.words[0].text, items[0].str);
  }
});
test("an ambiguous pair of nearby fragments is not automatically merged", () => {
  const page = extractPage(
    [
      item("M", 60, 70, 575, 50),
      item("EU", 15, 122, 600),
      item("TU", 15, 125, 600),
      item("Texto normal longo", 15, 70, 540),
    ],
    1,
  );
  assert.equal(page.words[0].text, "M");
});
test("file names recover NFC mojibake and HTML entities conservatively", () => {
  for (const raw of [
    "A CanÃ§Ã£o de Aquiles.pdf",
    "A CanÃ§Ã£o de Aquiles.pdf",
    "A Can&#xC3;&#xA7;&#xC3;&#xA3;o de Aquiles.pdf",
    "A%20Can%C3%A7%C3%A3o%20de%20Aquiles.pdf",
  ])
    assert.equal(normalizeTitle(raw), "A Canção de Aquiles.pdf");
  for (const raw of [
    "A Canção de Aquiles.pdf",
    "João e Ana 📚.pdf",
    "Arquivo 100%.pdf",
    "Ã.pdf",
    "Não recuperar �.pdf",
  ])
    assert.equal(normalizeTitle(raw), raw);
  assert.equal(
    normalizeTitle("Livro &amp;amp; notas.pdf"),
    "Livro & notas.pdf",
  );
});
test("choosing a sentence across pages keeps its original first index", () => {
  const words: Word[] = [
    { text: "Título", page: 1, paragraphEnd: false, heading: true },
    ...["Uma", "frase", "longa", "termina.", "Outra."].map((text, index) => ({
      text,
      page: index < 2 ? 1 : 2,
      paragraphEnd: index === 1,
    })),
  ];
  const choices = sentenceChoices(words, 2);
  assert.equal(choices[0].start, 1);
  assert.equal(choices[0].page, 1);
  assert.equal(choices[0].endPage, 2);
  assert.equal(choices.length, 2);
  assert.deepEqual(sentenceChoices(words, 3), []);
});
test("progress from a chosen starting point never counts skipped positions", () => {
  const words = Array.from({ length: 5 }, () => ({
    text: "palavra",
    page: 1,
    paragraphEnd: false,
  }));
  assert.deepEqual(progress({ words, seen: [0, 1], readingStart: 2 }), {
    presented: 0,
    total: 3,
    percent: 0,
    complete: false,
  });
  assert.ok(progress({ words, seen: [2, 3, 4], readingStart: 2 }).complete);
  assert.ok(!progress({ words, seen: [2, 2, 4], readingStart: 2 }).complete);
});
test("re-extraction preserves positions and only marks a joined word when every fragment was read", () => {
  const page = extractPage(source(), 8);
  const document: Document = {
    hash: "a".repeat(64),
    uri: "test",
    title: "CanÃ§Ã£o",
    words: [],
    position: 3,
    readingStart: 3,
    seen: [0],
  };
  const result = {
    words: page.words,
    sources: page.sources,
    pageCount: 10,
    extractionVersion: 2,
  };
  const migrated = migrateExtraction(document, result);
  assert.equal(migrated.position, 2);
  assert.equal(migrated.readingStart, 2);
  assert.deepEqual(migrated.seen, []);
  assert.equal(migrated.title, "Canção");
  assert.deepEqual(
    migrateExtraction({ ...document, seen: [0, 3] }, result).seen,
    [2],
  );
});

test("a physically blank page cannot offer a sentence crossing over it", () => {
  const words: Word[] = [
    { text: "Uma", page: 1, paragraphEnd: false },
    { text: "frase.", page: 3, paragraphEnd: false },
  ];
  assert.deepEqual(sentenceChoices(words, 2), []);
  assert.equal(sentenceChoices(words, 3)[0].start, 0);
});
