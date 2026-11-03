import { test } from "node:test";
import assert from "node:assert/strict";
import { activityStamp, periodData, dailyCounts } from "../src/progression";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("local calendars include zero days, exclude future days and survive DST/month boundaries", () => {
  assert.equal(
    activityStamp(new Date("2026-11-02T02:00:00Z"), "America/Moncton").day,
    "2026-11-01",
  );
  const week = periodData({ "2026-11-02": 10 }, "week", 0, "2026-11-03");
  assert.equal(week.elapsed, 2);
  assert.equal(week.average, 5);
  assert.equal(periodData({}, "week", -1, "2026-11-03").elapsed, 7);
  assert.equal(periodData({}, "month", -1, "2026-03-01").elapsed, 28);
});
test("pending activity excludes confirmed and other owners without duplicate words", () => {
  const q = {
    id: "a",
    owner: "a",
    hash: "h",
    total: 4,
    positions: [0, 1],
    novelPositions: [0, 1],
    wpm: 1000,
    activeMs: 120,
    startedAt: "2026-11-03T10:00:00Z",
    day: "2026-11-03",
    zone: "UTC",
  };
  assert.deepEqual(
    dailyCounts(
      { daily: { "2026-11-03": 1 }, undated: 0, known: { h: [[0, 0]] } },
      [q, { ...q, id: "b" }],
      "a",
    ),
    { "2026-11-03": 2 },
  );
  assert.deepEqual(dailyCounts(undefined, [q], "b"), {});
});
test("personal activity validates 1000 ppm, owner isolation, legacy and earlier offline dates", async () => {
  const db = new PGlite(),
    a = "00000000-0000-0000-0000-000000000001",
    b = "00000000-0000-0000-0000-000000000002",
    h = "a".repeat(64);
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
    );
    for (const f of [
      "001_initial.sql",
      "002_reading_start.sql",
      "20261103180248_personal_reading_activity.sql",
    ])
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${a}'),('${b}');set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);select set_reading_start('${h}',4,0);select record_activity_baseline('${h}',4,array[0]);`,
    );
    const send = (id: number, p: number[], date: string, wpm = 1000) =>
      db.query("select submit_reading_activity($1,$2,4,$3,$4,$5,$6,$7,$8)", [
        `10000000-0000-0000-0000-${String(id).padStart(12, "0")}`,
        h,
        p,
        wpm,
        p.length * 60,
        date + "T10:00:00Z",
        date,
        "UTC",
      ]);
    await send(1, [0, 1], "2026-10-03");
    await send(1, [0, 1], "2026-10-03");
    await send(2, [1, 2], "2026-10-02");
    const s = (await db.query<any>("select reading_progress() p")).rows[0].p;
    assert.equal(s.undated, 1);
    assert.deepEqual(s.daily, { "2026-10-02": 2 });
    await assert.rejects(send(3, [3], "2026-10-03", 1001));
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    assert.deepEqual(
      (await db.query<any>("select reading_progress() p")).rows[0].p.daily,
      {},
    );
    await assert.rejects(send(1, [0], "2026-10-03"));
  } finally {
    await db.close();
  }
});
