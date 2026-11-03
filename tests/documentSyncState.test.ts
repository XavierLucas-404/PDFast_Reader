import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Document sync preflight is authenticated, private, and scoped to the current owner", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
    );
    for (const name of (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
    const a = "00000000-0000-0000-0000-000000000001",
      b = "00000000-0000-0000-0000-000000000002",
      hash = "a".repeat(64);
    await db.exec(
      `insert into auth.users values('${a}'),('${b}');set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    const check = async () =>
      Boolean(
        (
          await db.query<{ registered: boolean }>(
            "select public.document_sync_state($1) as registered",
            [hash],
          )
        ).rows[0].registered,
      );
    assert.equal(await check(), false);
    await db.query("select set_reading_start($1,3,0)", [hash]);
    assert.equal(await check(), true);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    assert.equal(await check(), false);
    await assert.rejects(db.query("select public.document_sync_state(null)"));
    await db.exec(
      "set role anon;select set_config('request.jwt.claim.sub','',false)",
    );
    await assert.rejects(check());
    await db.exec("reset role");
    const unsafe = await db.query(
      "select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='document_sync_state'",
    );
    assert.equal(unsafe.rows[0].prosecdef, false);
  } finally {
    await db.close();
  }
});
