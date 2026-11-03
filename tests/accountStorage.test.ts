import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { attachFile, checkImportedHash } from "../src/libraryFiles";
import type { Document } from "../src/core";
const a = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002";
const words = [
  { text: "Um", page: 1, paragraphEnd: false },
  { text: "teste.", page: 1, paragraphEnd: true },
];
const document: Document = {
  hash: "a".repeat(64),
  title: "Meu PDF.pdf",
  uri: "local/a.pdf",
  words,
  position: 1,
  readingStart: 1,
  seen: [0],
  extractionVersion: 2,
};
test("account snapshots isolate libraries, preserve legacy owners, survive missing files and claim failures", async () => {
  const files = new Map<string, string>();
  let fail = false,
    failMarker = false;
  const fs = {
    documentDirectory: "local/",
    deleteAsync: async (p: string) => {
      for (const name of files.keys())
        if (name.startsWith(p)) files.delete(name);
    },
    getInfoAsync: async (p: string) => ({ exists: files.has(p) }),
    readAsStringAsync: async (p: string) => {
      if (!files.has(p)) throw Error("missing");
      return files.get(p)!;
    },
    writeAsStringAsync: async (p: string, v: string) => {
      if (fail && p.includes("account-" + a + "-state"))
        throw Error("disk full");
      if (failMarker && p.endsWith("pdfast-legacy-claim.json"))
        throw Error("marker failure");
      files.set(p, v);
    },
  };
  const built = await build({
    entryPoints: ["src/storage.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    plugins: [
      {
        name: "memory",
        setup(b) {
          b.onResolve({ filter: /^expo-file-system\/legacy$/ }, () => ({
            path: "fs",
            namespace: "memory",
          }));
          b.onLoad({ filter: /.*/, namespace: "memory" }, () => ({
            contents:
              "export const deleteAsync=fs.deleteAsync;export const documentDirectory=fs.documentDirectory;export const getInfoAsync=fs.getInfoAsync;export const readAsStringAsync=fs.readAsStringAsync;export const writeAsStringAsync=fs.writeAsStringAsync;",
          }));
        },
      },
    ],
  });
  const load = () =>
    new Function(
      "fs",
      `const module={exports:{}};${built.outputFiles[0].text};return module.exports;`,
    )(fs);
  let store = load();
  const session = (id: string, owner: string) => ({
    id,
    owner,
    hash: document.hash,
    total: 2,
    positions: [0],
    wpm: 250,
    activeMs: 240,
  });
  const old = {
    documents: [document],
    shelves: [{ id: "s", name: "Favoritos" }],
    queue: [session("a-session", a), session("b-session", b)],
  };
  await store.writeLocal(old);
  const original = files.get("local/pdfast-state-1.json");
  files.set("local/" + document.hash + ".pdf", "PDF bytes");
  assert.equal((await store.readLocal(null)).documents.length, 0);
  let stateA = await store.readLocal(a),
    stateB = await store.readLocal(b);
  assert.equal(stateA.documents.length, 0);
  assert.equal(stateB.documents.length, 0);
  assert.deepEqual(
    stateA.queue.map((q: any) => q.id),
    ["a-session"],
  );
  assert.deepEqual(
    stateB.queue.map((q: any) => q.id),
    ["b-session"],
  );
  fail = true;
  await assert.rejects(store.claimLegacy(a, stateA));
  fail = false;
  assert.equal(await store.legacyAvailable(), true);
  assert.equal(files.get("local/pdfast-state-1.json"), original);
  failMarker = true;
  await assert.rejects(store.claimLegacy(a, stateA));
  await assert.rejects(store.claimLegacy(b, stateB));
  failMarker = false;
  stateA = await store.readLocal(a);
  assert.equal(stateA.documents[0].position, 1);
  assert.equal(await store.legacyAvailable(), false);
  await assert.rejects(store.claimLegacy(b, stateB));
  assert.equal((await store.readLocal(b)).documents.length, 0);
  assert.equal((await store.readLocal(null)).documents.length, 0);
  stateA = { ...stateA, queue: [] };
  await store.writeLocal(stateA, a);
  store = load();
  stateA = await store.readLocal(a);
  assert.equal(stateA.queue.length, 0);
  assert.deepEqual(stateA.documents[0].seen, [0]);
  assert.equal(stateA.documents[0].available, true);
  files.delete("local/" + document.hash + ".pdf");
  store = load();
  stateA = await store.readLocal(a);
  assert.equal(stateA.documents[0].available, false);
  assert.equal(stateA.documents[0].wordCount, 2);
  assert.equal(stateA.documents[0].position, 1);
  assert.deepEqual(stateA.documents[0].words, []);
  await store.clearWorkspace(a);
  store = load();
  assert.equal((await store.readLocal(a)).documents.length, 0);
  assert.equal((await store.readLocal(b)).queue[0].owner, b);
  assert.equal(files.get("local/pdfast-state-1.json"), original);
});
test("reimport validates hash and restores the canonical v2 sequence without credit or resetting progress", () => {
  const extraction = {
    words: [{ text: "Combined", page: 1, paragraphEnd: false }],
    sources: [[0, 1]],
    extractionVersion: 3,
    pageCount: 1,
    chapterStarts: [0],
    legacy: { words, sources: [[0], [1]], chapterStarts: [0] },
  };
  const attached = attachFile(
    { ...document, available: false, wordCount: 2, words: [] },
    extraction,
    "new/file",
  );
  assert.deepEqual(attached.words, words);
  assert.equal(attached.position, 1);
  assert.equal(attached.readingStart, 1);
  assert.deepEqual(attached.seen, [0]);
  assert.equal(attached.extractionVersion, 2);
  assert.throws(() => checkImportedHash("different", document.hash));
  assert.doesNotThrow(() => checkImportedHash(document.hash, document.hash));
  assert.throws(
    () => attachFile({ ...document, wordCount: 3 }, extraction, "new/file"),
    /histórico/,
  );
  const v3 = attachFile(
    { ...document, extractionVersion: 3, wordCount: 1 },
    extraction,
    "new/file",
  );
  assert.equal(v3.words.length, 1);
});
