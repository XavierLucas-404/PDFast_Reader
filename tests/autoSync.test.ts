import { test } from "node:test";
import assert from "node:assert/strict";
import { AutoSync } from "../src/autoSync";
import { sealedSessions } from "../src/syncQueue";
import { libraryCounts } from "../src/libraryLogic";
import type { ReadingSession } from "../src/core";
const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
test("automatic sync retries progressively, clears failure on recovery, and stops when disposed", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0,
    failures = 0,
    successes = 0;
  const sync = new AutoSync(
    async () => {
      if (++calls <= 5) throw Error("offline");
    },
    () => failures++,
    () => successes++,
  );
  await sync.request();
  for (const wait of [30000, 60000, 120000, 300000, 300000]) {
    t.mock.timers.tick(wait - 1);
    await settle();
    const before = calls;
    await sync.request(); // ordinary activity respects the retry delay
    assert.equal(calls, before);
    t.mock.timers.tick(1);
    await settle();
    assert.equal(calls, before + 1);
  }
  assert.equal(failures, 5);
  assert.equal(successes, 1);
  sync.dispose();
  await sync.request(true);
  t.mock.timers.tick(1000000);
  await settle();
  assert.equal(calls, 6);
});
test("concurrent sealed chunks are drained serially without losing a request", async () => {
  let release!: () => void,
    calls = 0,
    active = 0,
    peak = 0;
  const first = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sync = new AutoSync(
    async () => {
      calls++;
      peak = Math.max(peak, ++active);
      if (calls === 1) await first;
      active--;
    },
    () => assert.fail(),
    () => {},
  );
  const done = sync.request();
  await settle();
  void sync.request();
  void sync.request();
  release();
  await done;
  assert.equal(calls, 2);
  assert.equal(peak, 1);
  sync.dispose();
});
test("manual retry bypasses delay; disposed owner cannot display stale errors or retry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0,
    failures = 0;
  const sync = new AutoSync(
    async () => {
      calls++;
      throw Error("offline");
    },
    () => failures++,
    () => {},
  );
  await sync.request();
  await sync.request(true);
  assert.equal(calls, 2);
  sync.dispose();
  t.mock.timers.tick(1000000);
  await settle();
  assert.equal(calls, 2);
  let reject!: (error: Error) => void;
  const pending = new AutoSync(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
    () => failures++,
    () => {},
  );
  const task = pending.request();
  await settle();
  pending.dispose();
  reject(Error("old owner"));
  await task;
  assert.equal(failures, 2);
});
test("only closed sessions of the authenticated owner are uploaded; restored chunks are recoverable", () => {
  const make = (id: string, owner: string): ReadingSession => ({
    id,
    owner,
    hash: "pdf",
    total: 10,
    positions: [1],
    wpm: 250,
    activeMs: 240,
  });
  const queue = [make("closed", "a"), make("active", "a"), make("other", "b")];
  assert.deepEqual(
    sealedSessions(queue, "a", "active").map((s) => s.id),
    ["closed"],
  );
  assert.deepEqual(
    sealedSessions(queue, "a").map((s) => s.id),
    ["closed", "active"],
  );
  assert.equal(queue.length, 3);
});
test("library counters use Portuguese singular only for one", () => {
  assert.equal(libraryCounts(0, 0), "0 PDFs · 0 estantes · No seu dispositivo");
  assert.equal(libraryCounts(1, 1), "1 PDF · 1 estante · No seu dispositivo");
  assert.equal(libraryCounts(2, 2), "2 PDFs · 2 estantes · No seu dispositivo");
});
