import test from "node:test";
import assert from "node:assert/strict";
import type { Document } from "../src/core";
import {
  bookmark,
  localResume,
  migrateResume,
  resumePage,
  wordPosition,
} from "../src/resume";
import { catalog, mergeLibrary } from "../src/librarySync";
import { attachFile } from "../src/libraryFiles";
import { progress } from "../src/readingStart";
const make = (extra: Partial<Document> = {}): Document => ({
  hash: "a".repeat(64),
  title: "PDF",
  uri: "private",
  words: Array.from({ length: 12 }, (_, i) => ({
    text: "word.",
    page: Math.floor(i / 4) + 1,
    paragraphEnd: false,
  })),
  position: 5,
  readingStart: 2,
  pageCount: 4,
  extractionVersion: 3,
  seen: [2, 3, 4],
  ...extra,
});
test("legacy migration preserves local words and history; cloud pages remain separate from exact positions", () => {
  const old = make({
    conflict: { remote: { position: 8, readingStart: 2 }, revision: 3 },
  });
  const d = migrateResume(old);
  assert.equal(d.position, 5);
  assert.equal(d.localResumeValid, true);
  assert.equal(d.resumePage, 2);
  assert.equal(d.conflict, undefined);
  assert.deepEqual(d.seen, old.seen);
  assert.equal(localResume(d, 2), 5);
  assert.equal(localResume(d, 3), undefined);
  const moved = bookmark(d, 4);
  assert.equal(resumePage(moved), 4);
  assert.equal(moved.position, 5);
  assert.deepEqual(progress(moved), progress(d));
  assert.equal(bookmark(moved, 0), moved);
  const outgoing = catalog({ documents: [moved], shelves: [] }).documents[0];
  assert.equal(outgoing.position, 8);
  assert.equal(outgoing.resumePage, 4);
  assert.ok(!("localResumeValid" in outgoing));
  const absent = migrateResume(
    make({ words: [], wordCount: 12, available: false }),
  );
  assert.equal(absent.resumePage, undefined);
  assert.equal(absent.localResumeValid, false);
  const remote = mergeLibrary(
    { documents: [], shelves: [] },
    { revision: 1, data: { documents: [outgoing], shelves: [] } },
  ).documents[0];
  assert.equal(remote.position, 0);
  assert.equal(remote.localResumeValid, false);
  assert.equal(remote.resumePage, 4);
  const restored = attachFile(
    remote,
    { words: d.words, extractionVersion: 3, pageCount: 4 } as any,
    "correct-hash-file",
  );
  assert.equal(restored.resumePage, 4);
  assert.equal(restored.localResumeValid, false);
  const legacy = { ...remote, resumePage: undefined };
  const restoredOld = attachFile(
    legacy,
    { words: d.words, extractionVersion: 3, pageCount: 4 } as any,
    "same",
  );
  assert.equal(restoredOld.resumePage, 3);
  assert.equal(restoredOld.localResumeValid, false);
});
test("opening, reading, closing and reopening never recreates a word conflict or republishes old words", () => {
  let local = {
    documents: [migrateResume(make())],
    shelves: [],
    cloud: {
      revision: 1,
      base: catalog({ documents: [migrateResume(make())], shelves: [] }),
    },
  };
  const server = { revision: 1, data: local.cloud.base };
  for (let i = 0; i < 5; i++) {
    local = {
      ...local,
      documents: [wordPosition(local.documents[0], (i % 4) + 4)],
    };
    const before = local.documents[0].position;
    local = mergeLibrary(local, server, local.documents[0].hash);
    assert.equal(local.documents[0].conflict, undefined);
    assert.equal(local.documents[0].position, before);
    assert.equal(local.documents[0].resumePage, 2);
    assert.deepEqual(local.documents[0].seen, [2, 3, 4]);
  }
  assert.equal(catalog(local).documents[0].position, 5); // legacy compatibility value, not the changing word
});
test("concurrent server page wins, but cannot move the active word or be overwritten by same-page playback", () => {
  const original = migrateResume(make());
  const base = catalog({ documents: [original], shelves: [] });
  const local = {
    documents: [bookmark(original, 4)],
    shelves: [],
    cloud: { revision: 1, base },
  };
  const remote = {
    ...base,
    documents: base.documents.map((d) => ({ ...d, resumePage: 3 })),
  };
  const merged = mergeLibrary(
    local,
    { revision: 2, data: remote },
    original.hash,
  );
  assert.equal(merged.documents[0].resumePage, 3);
  assert.equal(merged.documents[0].position, 5);
  const playing = wordPosition(merged.documents[0], 6);
  assert.equal(playing.resumePage, 3); // still in page 2; page 3 is deferred for the next opening
  const crossed = wordPosition(playing, 8);
  assert.equal(crossed.resumePage, 3);
  const manual = wordPosition(playing, 5, true);
  assert.equal(manual.resumePage, 2);
  assert.equal(mergeLibrary(merged, { revision: 1, data: base }), merged); // stale response ignored
});
test("acknowledgement keeps newer offline page changes pending and history is a union without retroactive credit", () => {
  const d = migrateResume(make());
  const base = catalog({ documents: [d], shelves: [] });
  const changed = bookmark(d, 3);
  const outgoing = catalog({ documents: [changed], shelves: [] });
  const later = bookmark(changed, 4);
  const acknowledged = {
    documents: [later],
    shelves: [],
    cloud: { revision: 2, base: outgoing },
  };
  const merged = mergeLibrary(acknowledged, {
    revision: 2,
    data: outgoing,
    presented: { [d.hash]: [[3, 5]] },
  });
  assert.equal(merged.documents[0].resumePage, 4);
  assert.equal(catalog(merged).documents[0].resumePage, 4);
  assert.deepEqual(merged.documents[0].seen, [2, 3, 4, 5]);
  assert.equal(merged.documents[0].readingStart, 2);
  const replay = wordPosition(merged.documents[0], 2, true);
  assert.deepEqual(replay.seen, merged.documents[0].seen);
  assert.equal(replay.readingStart, 2);
  assert.equal(progress(replay).presented, 4);
});
