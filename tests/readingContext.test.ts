import { test } from "node:test";
import assert from "node:assert/strict";
import { getReadingContext } from "../src/readingContext";
import type { Word } from "../src/core";
const words = (text: string): Word[] =>
  text.split(" ").map((text) => ({ text, page: 1, paragraphEnd: false }));
test("context starts at the current sentence and stops at its own ending", () => {
  const source = words("Antes. Esta frase termina aqui. Depois vem outra.");
  assert.equal(getReadingContext(source, 1), "Esta frase termina aqui.");
  assert.equal(getReadingContext(source, 4), "Esta frase termina aqui.");
  assert.equal(getReadingContext(source, 5), "Depois vem outra.");
});
for (const distance of [1, 9, 10])
  test(`sentence ending ${distance} words ahead respects exclusive ten-word limit`, () => {
    const source = words(
      `Antes. Já ${Array.from({ length: distance }, (_, i) => (i === distance - 1 ? "fim!" : `palavra${i}`)).join(" ")}`,
    );
    assert.equal(
      getReadingContext(source, 1),
      distance < 10
        ? source
            .slice(1)
            .map((w) => w.text)
            .join(" ")
        : "Já",
    );
  });
test("without a nearby ending, context contains only words through the pause", () => {
  const source = words("Uma frase longa ainda sem pontuação");
  assert.equal(getReadingContext(source, 3), "Uma frase longa ainda");
});
test("closing quotes and brackets belong to the sentence, and lines/pages do not split it", () => {
  for (const punctuation of [
    'fim."',
    "fim?”",
    "fim!')",
    "fim.)",
    "fim!]",
    "fim.}",
  ]) {
    const source = words(`Antes. Uma frase ${punctuation} Outra frase.`);
    source[2].paragraphEnd = true;
    source[3].page = 2;
    assert.equal(getReadingContext(source, 2), `Uma frase ${punctuation}`);
    assert.equal(getReadingContext(source, 4), "Outra frase.");
  }
});
test("moving backward or forward computes the context without modifying reading data", () => {
  const source = words("Um fim. Outro fim!");
  const snapshot = JSON.stringify(source);
  assert.equal(getReadingContext(source, 2), "Outro fim!");
  assert.equal(getReadingContext(source, 1), "Um fim.");
  assert.equal(JSON.stringify(source), snapshot);
});
test("empty and invalid positions have no context", () => {
  assert.equal(getReadingContext([], 0), "");
  for (const position of [-1, 2, 0.5, NaN])
    assert.equal(getReadingContext(words("Uma palavra"), position), "");
});

test("chapter headings are boundaries for paused context", () => {
  const words = [
    { text: "antes.", page: 1, paragraphEnd: false },
    { text: "Capítulo", page: 2, paragraphEnd: false, heading: true },
    { text: "1", page: 2, paragraphEnd: false, heading: true },
    { text: "MEU", page: 2, paragraphEnd: false },
    { text: "pai.", page: 2, paragraphEnd: false },
  ];
  assert.equal(getReadingContext(words, 3), "MEU pai.");
});
