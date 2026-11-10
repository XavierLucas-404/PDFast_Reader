import test from "node:test";
import assert from "node:assert/strict";
import { chapterDisplayWord, chapterWait } from "../src/chapters";
import { completionMessage, progress } from "../src/readingStart";
import type { Document, Word } from "../src/core";
import { delay } from "../src/core";
import { PlaybackClock } from "../src/playback";
const words = (label: string): Word[] =>
  label
    .split(" ")
    .map((text, i, a) => ({
      text,
      page: 21,
      paragraphEnd: i === a.length - 1,
    }));
test("chapter labels remain whole at every original position without changing extraction or timing", () => {
  for (const label of [
    "C H A P T E R 2",
    "C A P Í T U L O IV",
    "CHAPTER 12",
    "Capítulo IX",
  ]) {
    const heading = words(label),
      source = [...heading, ...words("Texto seguinte.")];
    const snapshot = JSON.stringify(source);
    for (let i = 0; i < heading.length; i++)
      assert.equal(
        chapterDisplayWord(source, [0], i),
        label.startsWith("C H")
          ? "CHAPTER 2"
          : label.startsWith("C A")
            ? "CAPÍTULO IV"
            : label,
      );
    assert.equal(chapterDisplayWord(source, [0], heading.length), "Texto");
    assert.equal(JSON.stringify(source), snapshot);
    assert.ok(
      heading.reduce((n, w) => n + delay(w, 250), 0) >= heading.length * 240,
    );
  }
  const ambiguous = words("C H A P T E R unknown text");
  assert.equal(chapterDisplayWord(ambiguous, [0], 1), "H");
  assert.equal(chapterDisplayWord(words("C H A P T E R 2"), [], 1), "H");
  assert.equal(chapterDisplayWord(words("Chapter 2"), [0], 200), "");
});
test("chapter pause presents no positions and cancellation resumes the same original word", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const clock = new PlaybackClock();
  let transitions = 0,
    presented = 0;
  assert.equal(chapterWait([5], 4), 2000);
  clock.schedule(() => transitions++, 2000);
  t.mock.timers.tick(1999);
  assert.equal(transitions, 0);
  assert.equal(presented, 0);
  clock.cancel();
  t.mock.timers.tick(1);
  assert.equal(transitions, 0);
  clock.schedule(() => presented++, 240);
  t.mock.timers.tick(240);
  assert.equal(presented, 1);
});
test("completion announcement survives reopening and rereading without duplicate completion", () => {
  const base: Document = {
    hash: "a",
    title: "sample",
    uri: "sample.pdf",
    words: words("One two."),
    position: 1,
    seen: [0],
    readingStart: 0,
  };
  const completed = { ...base, seen: [0, 1], completed: true };
  assert.equal(completionMessage(base, completed, true), "reader.complete");
  const reopened = JSON.parse(JSON.stringify(completed));
  assert.equal(completionMessage(reopened, completed, true), null);
  assert.equal(
    completionMessage({ ...completed, completed: undefined }, completed, true),
    null,
  );
  assert.equal(
    completionMessage({ ...base, completed: true }, base, true),
    null,
  );
  assert.equal(
    completionMessage({ ...base, seen: [] }, base, true),
    "reader.incomplete",
  );
  assert.equal(completionMessage(base, base, false), null);
  assert.equal(progress(completed).presented, 2);
  assert.equal(completionMessage(base, completed, false), "reader.complete");
});
