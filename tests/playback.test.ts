import { test } from "node:test";
import assert from "node:assert/strict";
import { PlaybackClock } from "../src/playback";
test("pausing before the word interval prevents progress and scoring", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const clock = new PlaybackClock();
  let presented = 0;
  clock.schedule(() => presented++, 240);
  t.mock.timers.tick(239);
  clock.cancel();
  t.mock.timers.tick(1000);
  assert.equal(presented, 0);
  // Resuming presents the same word once after its full interval.
  clock.schedule(() => presented++, 240);
  t.mock.timers.tick(239);
  assert.equal(presented, 0);
  t.mock.timers.tick(1);
  assert.equal(presented, 1);
  t.mock.timers.tick(500);
  assert.equal(presented, 1);
});
test("replacing a pending interval leaves only one active callback", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const clock = new PlaybackClock();
  const words: number[] = [];
  clock.schedule(() => words.push(0), 240);
  clock.schedule(() => words.push(1), 600);
  t.mock.timers.tick(240);
  assert.deepEqual(words, []);
  t.mock.timers.tick(360);
  assert.deepEqual(words, [1]);
  clock.cancel();
});
test("background interruption cancels every pending presentation", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const clock = new PlaybackClock();
  let presented = 0;
  clock.schedule(() => presented++, 100);
  clock.cancel();
  clock.cancel();
  t.mock.timers.tick(10000);
  assert.equal(presented, 0);
});
