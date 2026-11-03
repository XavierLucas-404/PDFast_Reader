import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("chosen starts change completion requirements but never score skipped words or complete twice", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  for (const file of ["001_initial.sql", "002_reading_start.sql"])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  const user = "00000000-0000-0000-0000-000000000001",
    hash = "a".repeat(64);
  await db.exec(
    `insert into auth.users values('${user}');set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
  );
  const profile = async () =>
    (
      await db.query<{ total_words: number; completed_pdfs: number }>(
        "select * from my_profile()",
      )
    ).rows[0];
  await db.query("select set_reading_start($1,5,3)", [hash]);
  assert.equal((await profile()).total_words, 0);
  assert.equal((await profile()).completed_pdfs, 0);
  const args = ["10000000-0000-0000-0000-000000000001", hash, [3, 4]];
  await db.query("select submit_session($1,$2,5,$3,250,480)", args);
  assert.equal((await profile()).total_words, 2);
  assert.equal((await profile()).completed_pdfs, 1);
  await db.query("select submit_session($1,$2,5,$3,250,480)", args);
  assert.equal((await profile()).total_words, 2);
  await db.query("select set_reading_start($1,5,0)", [hash]);
  assert.equal((await profile()).completed_pdfs, 1);
  await db.query("select set_reading_start($1,5,4)", [hash]);
  assert.equal((await profile()).completed_pdfs, 1);
  await assert.rejects(db.query("select set_reading_start($1,5,5)", [hash]));
  await assert.rejects(db.query("select set_reading_start($1,6,1)", [hash]));
  await assert.rejects(
    db.query("select complete_reading($1,$2)", [user, hash]),
  );
  await assert.rejects(
    db.query("select submit_session_words($1,$2,5,$3,250,480)", args),
  );
  await db.exec(
    "set role anon;select set_config('request.jwt.claim.sub','',false);",
  );
  await assert.rejects(db.query("select set_reading_start($1,5,0)", [hash]));
  await db.close();
});
