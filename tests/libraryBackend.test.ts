import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("library RPCs isolate accounts, reject content, preserve canonical indices and detect concurrent writes without awarding points", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    const a = "00000000-0000-0000-0000-000000000001",
      b = "00000000-0000-0000-0000-000000000002",
      hash = "a".repeat(64);
    await db.exec(
      `insert into auth.users values('${a}'),('${b}');set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const get = async () =>
      (await db.query<{ value: any }>("select public.library_get() value"))
        .rows[0].value;
    const put = async (rev: number, data: any) =>
      (
        await db.query<{ value: any }>(
          "select public.library_put($1,$2::jsonb) value",
          [rev, JSON.stringify(data)],
        )
      ).rows[0].value;
    const data = {
      documents: [
        {
          hash,
          title: "Aquiles.pdf",
          total: 10,
          extractionVersion: 2,
          pageCount: 2,
          position: 4,
          readingStart: 1,
          seen: [[1, 3]],
          completed: false,
          customTitle: false,
          shelfId: "s",
        },
      ],
      shelves: [{ id: "s", name: "Romances" }],
    };
    assert.deepEqual((await get()).data, { documents: [], shelves: [] });
    const first = await put(0, data);
    assert.equal(first.accepted, true);
    assert.equal(first.revision, 1);
    assert.equal(
      (await put(0, { ...data, shelves: [{ id: "s", name: "Local" }] }))
        .accepted,
      false,
    );
    assert.equal((await get()).data.shelves[0].name, "Romances");
    await assert.rejects(put(1, { ...data, words: ["private text"] }));
    await assert.rejects(
      put(1, {
        ...data,
        documents: [{ ...data.documents[0], content: "PDF bytes" }],
      }),
    );
    await assert.rejects(
      put(1, { ...data, documents: [{ ...data.documents[0], position: 10 }] }),
    );
    await assert.rejects(db.query("select * from pdfast_private.libraries"));
    await db.query("select public.set_reading_start($1,10,1)", [hash]);
    await db.query(
      "select public.submit_session($1,$2,10,array[1,2],250,1000)",
      ["00000000-0000-0000-0000-000000000009", hash],
    );
    assert.deepEqual((await get()).presented[hash], [[1, 2]]);
    await assert.rejects(
      put(1, {
        ...data,
        documents: [{ ...data.documents[0], extractionVersion: 3 }],
      }),
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    await db.query("select public.set_reading_start($1,10,0)", [hash]); // legacy competitive rows never populate a library
    assert.deepEqual((await get()).data.documents, []);
    await put(0, {
      documents: [],
      shelves: [{ id: "b", name: "Minha estante" }],
    });
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false)`);
    assert.equal((await get()).data.shelves[0].name, "Romances");
    const artwork = await put(1, {
      ...data,
      documents: [{ ...data.documents[0], libraryOrder: 7, coverPage: 2 }],
    });
    assert.equal(artwork.accepted, true);
    const legacy = await put(2, data);
    assert.equal(legacy.data.documents[0].coverPage, 2);
    assert.equal(legacy.data.documents[0].libraryOrder, 7);
    for (const extra of [
      { coverPage: 3 },
      { coverPage: -1 },
      { coverPage: null },
      { libraryOrder: -1 },
      { libraryOrder: 1.5 },
      { customCover: "private.jpg" },
      { thumbnail: "base64" },
    ])
      await assert.rejects(
        put(3, { ...data, documents: [{ ...data.documents[0], ...extra }] }),
      );

    const bookmark = await put(3, {
      ...legacy.data,
      documents: legacy.data.documents.map((d: any) => ({
        ...d,
        resumePage: 2,
      })),
    });
    assert.equal(bookmark.data.documents[0].resumePage, 2);
    const oldClient = await put(4, data);
    assert.equal(oldClient.data.documents[0].resumePage, 2);
    for (const resumePage of [0, 3, -1, 1.5, null, "1"])
      await assert.rejects(
        put(5, {
          ...oldClient.data,
          documents: oldClient.data.documents.map((d: any) => ({
            ...d,
            resumePage,
          })),
        }),
      );

    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int n from public.scored")).rows[0].n,
      2,
    );
    await db.query("delete from auth.users where id=$1", [a]);
    assert.equal(
      (await db.query("select count(*)::int n from pdfast_private.libraries"))
        .rows[0].n,
      1,
    );
    await db.exec(
      "set role anon;select set_config('request.jwt.claim.sub','',false)",
    );
    await assert.rejects(get());
    await assert.rejects(put(0, data));
  } finally {
    await db.close();
  }
});
