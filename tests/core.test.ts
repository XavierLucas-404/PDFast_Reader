import { test } from "node:test";
import assert from "node:assert/strict";
import { delay, eligible, weekStart, rank, nextWeek } from "../src/core";
test("week switches only at Monday UTC, including year boundary", () => {
  assert.equal(
    weekStart(new Date("2026-01-04T23:59:59Z")),
    "2025-12-29T00:00:00.000Z",
  );
  assert.equal(
    weekStart(new Date("2026-01-05T00:00:00Z")),
    "2026-01-05T00:00:00.000Z",
  );
  assert.equal(
    nextWeek(new Date("2026-01-05")).toISOString(),
    "2026-01-12T00:00:00.000Z",
  );
});
test("competition ranking shares placements and skips following positions", () => {
  assert.deepEqual(
    rank([{ words: 40 }, { words: 40 }, { words: 20 }, { words: 10 }]).map(
      (x) => x.rank,
    ),
    [1, 1, 3, 4],
  );
});
test("only active sessions at 100 through 600 ppm can score", () => {
  assert.ok(eligible(600, true));
  assert.ok(!eligible(650, true));
  assert.ok(!eligible(250, false));
});
test("punctuation and line breaks add time", () => {
  assert.equal(
    delay({ text: "palavra", page: 1, paragraphEnd: false }, 250),
    240,
  );
  assert.equal(delay({ text: "fim.", page: 1, paragraphEnd: false }, 250), 384);
  assert.equal(delay({ text: "fim", page: 1, paragraphEnd: true }, 250), 480);
});
