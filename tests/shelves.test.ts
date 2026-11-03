import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import {
  coverIndex,
  deleteShelf,
  moveDocument,
  restoreShelves,
  saveShelf,
  shelfNameError,
} from "../src/shelves";
import type { Document } from "../src/core";
const document: Document = {
  hash: "abc",
  title: "Meu título",
  customTitle: true,
  uri: "old",
  words: [{ text: "Livro", page: 1, paragraphEnd: false }],
  position: 0,
  seen: [0],
  readingStart: 0,
};
const original = () => ({
  shelves: [],
  documents: [document],
  queue: [
    {
      id: "pending",
      owner: "user",
      hash: "abc",
      total: 1,
      positions: [0],
      wpm: 250,
      activeMs: 240,
    },
  ],
});
test("shelves validate names, retain creation order and preserve reading data", () => {
  let state = saveShelf(original(), { id: "a", name: "  Ficção  " });
  state = saveShelf(state, { id: "b", name: "Estudos" });
  assert.equal(state.shelves[0].name, "Ficção");
  assert.equal(shelfNameError(" ficção ", state.shelves, "a"), "");
  assert.ok(shelfNameError("Ficção", state.shelves));
  for (const name of ["", "   ", "a".repeat(61), " FICÇÃO ", "Sem estante"])
    assert.ok(shelfNameError(name, state.shelves));
  assert.throws(() => saveShelf(state, { id: "c", name: "ficção" }));
  state = saveShelf(state, { id: "a", name: "Romances" });
  assert.deepEqual(
    state.shelves.map((s) => s.id),
    ["a", "b"],
  );
  state = moveDocument(state, "abc", "a");
  assert.equal(state.documents[0].shelfId, "a");
  assert.strictEqual(state.documents[0].words, document.words);
  assert.deepEqual(state.documents[0].seen, [0]);
  assert.throws(() => moveDocument(state, "abc", "missing"));
  assert.equal(moveDocument(state, "abc").documents[0].shelfId, undefined);
  state = deleteShelf(state, "a");
  assert.equal(state.documents[0].shelfId, undefined);
  assert.deepEqual(state.queue, original().queue);
  assert.deepEqual(original().documents[0], document);
});
test("legacy and dangling shelf assignments restore safely", () => {
  const restored = restoreShelves({
    documents: [{ ...document, shelfId: "gone" }],
  });
  assert.deepEqual(restored.shelves, []);
  assert.equal(restored.documents[0].shelfId, undefined);
  assert.equal(restored.documents[0].title, document.title);
  assert.equal(
    coverIndex(document.hash),
    coverIndex({ ...document, title: "Other" }.hash),
  );
});
test("actual storage snapshots retain shelves across restart and migrate legacy snapshots", async () => {
  const files = new Map<string, string>();
  const fs = {
    documentDirectory: "local/",
    getInfoAsync: async (path: string) => ({ exists: files.has(path) }),
    readAsStringAsync: async (path: string) => {
      if (!files.has(path)) throw Error("missing");
      return files.get(path)!;
    },
    writeAsStringAsync: async (path: string, value: string) => {
      files.set(path, value);
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
        name: "memory-files",
        setup(b) {
          b.onResolve({ filter: /^expo-file-system\/legacy$/ }, () => ({
            path: "fs",
            namespace: "memory",
          }));
          b.onLoad({ filter: /.*/, namespace: "memory" }, () => ({
            contents:
              "export const getInfoAsync=fs.getInfoAsync; export const documentDirectory = fs.documentDirectory; export const readAsStringAsync = fs.readAsStringAsync; export const writeAsStringAsync = fs.writeAsStringAsync;",
          }));
        },
      },
    ],
  });
  const load = () =>
    new Function(
      "fs",
      `const module = { exports: {} }; ${built.outputFiles[0].text}; return module.exports;`,
    )(fs);
  let storage = load();
  const state = moveDocument(
    saveShelf(original(), { id: "a", name: "Ficção" }),
    document.hash,
    "a",
  );
  state.documents[0] = {
    ...state.documents[0],
    conflict: { remote: { position: 0, readingStart: 0 }, revision: 8 },
  };
  await storage.writeLocal(state);
  storage = load();
  const restored = await storage.readLocal();
  assert.deepEqual(restored.shelves, state.shelves);
  assert.deepEqual(restored.queue, state.queue);
  assert.equal(restored.documents[0].shelfId, "a");
  assert.deepEqual(restored.documents[0].words, document.words);
  assert.equal(restored.documents[0].customTitle, true);
  assert.equal(restored.documents[0].title, document.title);
  const backup = [...files.keys()].find((k) =>
    k.endsWith("resume-v1-backup.json"),
  )!;
  assert.ok(backup);
  assert.equal(
    JSON.parse(files.get(backup)!).documents[0].conflict.revision,
    8,
  );
  assert.equal(restored.resumeMigrationVersion, 1);
  assert.equal(restored.documents[0].conflict, undefined);
  assert.equal(restored.documents[0].localResumeValid, true);
  const slot = [...files.keys()]
    .filter((k) => /state-[01]\.json$/.test(k))
    .sort(
      (a, b) =>
        JSON.parse(files.get(b)!).revision - JSON.parse(files.get(a)!).revision,
    )[0];
  const snapshot = JSON.parse(files.get(slot)!);
  delete snapshot.shelves;
  files.set(slot, JSON.stringify(snapshot));
  const legacy = await load().readLocal();
  assert.deepEqual(legacy.shelves, []);
  assert.equal(legacy.documents[0].shelfId, undefined);
  assert.deepEqual(legacy.documents[0].seen, document.seen);
  files.set("local/pdfast-state-0.json", "interrupted write");
  assert.deepEqual(
    (await load().readLocal()).documents[0].words,
    document.words,
  );
});
