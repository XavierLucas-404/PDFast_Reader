import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const a = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002",
  c = "00000000-0000-0000-0000-000000000003";
const hash = "a".repeat(64);
test("Postgres enforces deduplication, authorization, completion and reward idempotence", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(await readFile("supabase/migrations/001_initial.sql", "utf8"));
  await db.exec(
    await readFile("supabase/migrations/002_reading_start.sql", "utf8"),
  );
  await db.exec(`insert into auth.users values('${a}'),('${b}'),('${c}');`);
  async function as(id: string) {
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
    );
  }
  await as(a);
  await db.query(`select set_username('ana')`);
  await as(b);
  await assert.rejects(db.query("select set_username('ana')"), /unique/i);
  await assert.rejects(db.query("select set_username('bad name')"), /check/i);
  await db.exec(
    "set role anon;select set_config('request.jwt.claim.sub','',false)",
  );
  await assert.rejects(db.query("select * from my_profile()"));
  await as(a);
  const submit = (
    id: string,
    positions: number[],
    wpm = 250,
    ms = positions.length * 240,
  ) =>
    db.query<{ submit_session: number }>(
      `select submit_session($1,$2,4,$3,$4,$5)`,
      [id, hash, positions, wpm, ms],
    );
  const first = "10000000-0000-0000-0000-000000000001";
  assert.equal((await submit(first, [0, 1])).rows[0].submit_session, 2);
  assert.equal((await submit(first, [0, 1])).rows[0].submit_session, 0);
  assert.equal(
    (await submit("10000000-0000-0000-0000-000000000002", [1, 2])).rows[0]
      .submit_session,
    1,
  );
  assert.equal(
    (await submit("10000000-0000-0000-0000-000000000003", [3], 650, 100))
      .rows[0].submit_session,
    0,
  );
  assert.equal(
    (await db.query<{ completed_pdfs: number }>("select * from my_profile()"))
      .rows[0].completed_pdfs,
    1,
  );
  await assert.rejects(
    submit("10000000-0000-0000-0000-000000000004", [0], 250, 10),
  );
  await assert.rejects(submit("10000000-0000-0000-0000-000000000005", [4]));
  await assert.rejects(db.query("select * from scored"));
  await assert.rejects(
    db.query("select close_week(utc_week(now())-interval '7 days')"),
  );
  await as(b);
  await db.query("select set_username('bia')");
  await db.query("select request_friend($1)", [a]);
  const request = (
    await db.query<{ id: string }>("select * from list_friends()")
  ).rows[0].id;
  await as(c);
  await db.query("select set_username('caio')");
  await db.query("select respond_friend($1,true)", [request]);
  assert.equal((await db.query("select * from list_friends()")).rows.length, 0);
  await as(a);
  await db.query("select respond_friend($1,true)", [request]);
  assert.equal(
    (await db.query<{ status: string }>("select * from list_friends()")).rows[0]
      .status,
    "accepted",
  );
  await as(b);
  await submit("10000000-0000-0000-0000-000000000006", [0, 1, 2]);
  const ranks = await db.query<{ placement: number }>(
    "select * from weekly_ranking()",
  );
  assert.deepEqual(
    ranks.rows.map((r) => Number(r.placement)),
    [1, 1],
  );
  await db.exec(
    `reset role;update scored set week=utc_week(now())-interval '7 days';`,
  );
  assert.equal(
    (
      await db.query<{ close_week: number }>(
        "select close_week(utc_week(now())-interval '7 days')",
      )
    ).rows[0].close_week,
    2,
  );
  assert.equal(
    (
      await db.query<{ close_week: number }>(
        "select close_week(utc_week(now())-interval '7 days')",
      )
    ).rows[0].close_week,
    0,
  );
  await as(a);
  assert.equal((await db.query("select * from my_rewards()")).rows.length, 1);
  await db.query("select delete_account()");
  await db.exec("reset role");
  assert.equal(
    (await db.query("select * from scored where user_id=$1", [a])).rows.length,
    0,
  );
  await db.close();
});
