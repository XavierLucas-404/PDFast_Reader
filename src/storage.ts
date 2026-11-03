import { orphanedReadingFiles } from "./fileRetention";
import type { ProgressSnapshot } from "./progression";
import { migrateResume } from "./resume";
import { AppError } from "./i18n";
import { restoreShelves, type Shelf } from "./shelves";
import { normalizeTitle } from "./titles";
import * as FS from "expo-file-system/legacy";
import { Document, ReadingSession, Word } from "./core";
import { uniqueShelves, totalWords } from "./librarySync";
import type { CloudState } from "./librarySync";
export type Local = {
  documents: Document[];
  queue: ReadingSession[];
  shelves: Shelf[];
  cloud?: CloudState;
  resumeMigrationVersion?: 1;
  activityVersion?: 1;
  progression?: ProgressSnapshot;
  guestDaily?: Record<string, number>;
  pendingDocuments?: Document[];
  legacySessionsImported?: boolean;
  legacyClaimImported?: boolean;
};
export const empty: Local = { documents: [], queue: [], shelves: [] };
type Snapshot = Omit<Local, "documents" | "pendingDocuments"> & {
  revision: number;
  documents: Omit<Document, "words">[];
  pendingDocuments?: Omit<Document, "words">[];
};
let writes = Promise.resolve();
const revisions = new Map<string, number>();
const savedText = new Set<string>();
export const textFile = (d: Pick<Document, "hash" | "extractionVersion">) =>
  d.extractionVersion && d.extractionVersion >= 2
    ? `${d.hash}.v${d.extractionVersion}.words.json`
    : `${d.hash}.words.json`;
const path = (name: string) => FS.documentDirectory + "pdfast-" + name;
function scope(owner?: string | null) {
  if (owner === undefined) return "state"; // Read-only migration source in the app; retained for old fixtures.
  if (owner === null) return "guest-state";
  if (!/^[a-f0-9-]{36}$/i.test(owner)) throw new AppError("errors.workspace");
  return `account-${owner}-state`;
}
async function snapshot(owner?: string | null): Promise<Snapshot | null> {
  const name = scope(owner);
  const candidates = await Promise.all(
    [0, 1].map(async (slot) => {
      try {
        const value = JSON.parse(
          await FS.readAsStringAsync(path(`${name}-${slot}.json`)),
        ) as Snapshot;
        return Number.isInteger(value.revision) &&
          Array.isArray(value.documents) &&
          Array.isArray(value.queue)
          ? value
          : null;
      } catch {
        return null;
      }
    }),
  );
  const result =
    candidates
      .filter((v): v is Snapshot => !!v)
      .sort((a, b) => b.revision - a.revision)[0] || null;
  revisions.set(name, result?.revision || 0);
  return result;
}
async function hydrate(
  document: Omit<Document, "words">,
  checkFile: boolean,
): Promise<Document> {
  let words: Word[] = [];
  try {
    words = JSON.parse(await FS.readAsStringAsync(path(textFile(document))));
    savedText.add(textFile(document));
  } catch {
    savedText.delete(textFile(document));
    /* Metadata remains usable when a file or extraction is absent. */
  }
  const uri = FS.documentDirectory + document.hash + ".pdf";
  const exists = checkFile ? (await FS.getInfoAsync(uri)).exists : true;
  const expected = document.wordCount ?? words.length;
  const available = exists && words.length > 0 && words.length === expected;
  return migrateResume({
    ...document,
    originalTitle: document.originalTitle ?? document.title,
    title: document.customTitle
      ? document.title
      : normalizeTitle(document.title),
    readingStart: document.readingStart ?? 0,
    extractionVersion: document.extractionVersion ?? 1,
    uri,
    words: available ? words : [],
    wordCount: expected,
    available,
  });
}
export async function readLocal(owner?: string | null): Promise<Local> {
  await writes.catch(() => {});
  const snap = await snapshot(owner);
  if (snap && !snap.resumeMigrationVersion) {
    const backup = path(`${scope(owner)}-resume-v1-backup.json`);
    if (!(await FS.getInfoAsync(backup)).exists)
      await FS.writeAsStringAsync(backup, JSON.stringify(snap));
  }
  let value: Local = snap
    ? {
        ...snap,
        documents: await Promise.all(
          snap.documents.map((d) => hydrate(d, owner !== undefined)),
        ),
        pendingDocuments: await Promise.all(
          (snap.pendingDocuments || []).map((d) =>
            hydrate(d, owner !== undefined),
          ),
        ),
        shelves: snap.shelves || [],
      }
    : { ...empty };
  if (owner && !value.legacySessionsImported) {
    const legacy = await snapshot();
    const old = (legacy?.queue || []).filter((q) => q.owner === owner);
    value = {
      ...value,
      legacySessionsImported: true,
      queue: [
        ...value.queue,
        ...old.filter((q) => !value.queue.some((v) => v.id === q.id)),
      ],
      pendingDocuments: [
        ...(value.pendingDocuments || []),
        ...(await Promise.all(
          (legacy?.documents || [])
            .filter(
              (d) =>
                old.some((q) => q.hash === d.hash) &&
                !value.documents.some((v) => v.hash === d.hash) &&
                !value.pendingDocuments?.some((v) => v.hash === d.hash),
            )
            .map((d) => hydrate(d, true)),
        )),
      ],
    };
    await writeLocal(value, owner);
  }
  if (owner) {
    try {
      const marker = await claimMarker();
      if (
        marker?.owner === owner &&
        (!value.legacyClaimImported || !marker.complete)
      )
        value = await claimLegacy(owner, value);
    } catch {
      /* Failed claim is retained for recovery without exposing another account. */
    }
  }
  if (!value.resumeMigrationVersion) {
    value = {
      ...value,
      resumeMigrationVersion: 1,
      documents: value.documents.map((d) => ({
        ...d,
        legacyPosition:
          value.cloud?.base.documents.find((r) => r.hash === d.hash)
            ?.position ??
          d.legacyPosition ??
          0,
      })),
    };
    await writeLocal(value, owner);
  }
  if (owner !== undefined && !value.activityVersion) {
    value = {
      ...value,
      activityVersion: 1,
      documents: value.documents.map((d) => ({
        ...d,
        undatedSeen: d.undatedSeen ?? [...d.seen],
      })),
    };
    await writeLocal(value, owner);
  }
  return restoreShelves(value);
}
export function writeLocal(value: Local, owner?: string | null) {
  const name = scope(owner);
  const revision = (revisions.get(name) || 0) + 1;
  revisions.set(name, revision);
  const documents = value.documents.map(({ words, ...metadata }) => ({
    ...metadata,
    wordCount: metadata.wordCount ?? words.length,
  }));
  const pendingDocuments = (value.pendingDocuments || []).map(
    ({ words, ...metadata }) => ({
      ...metadata,
      wordCount: metadata.wordCount ?? words.length,
    }),
  );
  const snap: Snapshot = { ...value, revision, documents, pendingDocuments };
  const text = [...value.documents, ...(value.pendingDocuments || [])].map(
    (d) => ({
      hash: d.hash,
      extractionVersion: d.extractionVersion,
      words: d.words,
    }),
  );
  writes = writes
    .catch(() => {})
    .then(async () => {
      for (const d of text)
        if (d.words.length && !savedText.has(textFile(d))) {
          await FS.writeAsStringAsync(
            path(textFile(d)),
            JSON.stringify(d.words),
          );
          savedText.add(textFile(d));
        }
      await FS.writeAsStringAsync(
        path(`${name}-${revision % 2}.json`),
        JSON.stringify(snap),
      );
    });
  return writes;
}
export async function legacyAvailable() {
  try {
    await FS.readAsStringAsync(path("legacy-claim.json"));
    return false;
  } catch {
    const old = await snapshot();
    return !!old?.documents.length;
  }
}
async function claimMarker(): Promise<
  { owner: string; complete: boolean } | undefined
> {
  for (const [name, complete] of [
    ["legacy-claim.json", true],
    ["legacy-claim-intent.json", false],
  ] as const) {
    let raw: string;
    try {
      raw = await FS.readAsStringAsync(path(name));
    } catch {
      continue;
    }
    const marker = JSON.parse(raw);
    if (!/^[a-f0-9-]{36}$/i.test(marker?.owner || ""))
      throw new AppError("errors.claimInvalid");
    return { owner: marker.owner, complete };
  }
}
let claims: Promise<unknown> = Promise.resolve();
export function claimLegacy(owner: string, current: Local): Promise<Local> {
  const task = claims.catch(() => {}).then(() => performClaim(owner, current));
  claims = task.catch(() => {});
  return task;
}
/** The durable intent reserves the chosen account before copying; originals remain untouched. */
async function performClaim(owner: string, current: Local): Promise<Local> {
  const marker = await claimMarker();
  if (marker && marker.owner !== owner) throw new AppError("errors.claimOther");
  if (!marker)
    await FS.writeAsStringAsync(
      path("legacy-claim-intent.json"),
      JSON.stringify({ owner }),
    );
  if (current.legacyClaimImported) {
    await FS.writeAsStringAsync(
      path("legacy-claim.json"),
      JSON.stringify({ owner }),
    );
    return current;
  }
  const old = await readLocal();
  const ids = new Set(current.shelves.map((s) => s.id));
  const shelves = uniqueShelves([
    ...current.shelves,
    ...old.shelves.filter((s) => !ids.has(s.id)),
  ]);
  const documents = [...current.documents];
  for (const d of old.documents) {
    const existing = documents.findIndex((v) => v.hash === d.hash);
    if (existing < 0)
      documents.push({ ...d, undatedSeen: d.undatedSeen ?? [...d.seen] });
    else {
      const current = documents[existing];
      if (
        totalWords(current) !== totalWords(d) ||
        (current.extractionVersion || 1) !== (d.extractionVersion || 1)
      )
        throw new AppError("errors.claimExtraction");
      documents[existing] = {
        ...d,
        ...current,
        uri: d.uri,
        words: d.words,
        available: d.available,
        position: d.position,
        readingStart: d.readingStart,
        seen: [...new Set([...current.seen, ...d.seen])],
        undatedSeen: [
          ...new Set([
            ...(current.undatedSeen || []),
            ...(d.undatedSeen ?? d.seen),
          ]),
        ],
        localResumeValid: d.localResumeValid,
        resumePage: d.resumePage ?? current.resumePage,
        conflict: undefined,
      };
    }
  }
  const value = { ...current, documents, shelves, legacyClaimImported: true };
  await writeLocal(value, owner);
  await FS.writeAsStringAsync(
    path("legacy-claim.json"),
    JSON.stringify({ owner }),
  );
  return value;
}
export async function clearWorkspace(owner: string) {
  const clean = {
    ...empty,
    legacySessionsImported: true,
    legacyClaimImported: true,
    activityVersion: 1 as const,
    resumeMigrationVersion: 1 as const,
  };
  await writeLocal(clean, owner);
  await writeLocal(clean, owner);
  await FS.deleteAsync(FS.documentDirectory + "pdfast-covers/" + owner + "/", {
    idempotent: true,
  });
}

/** Purges migration backups and unreferenced hashed files after remote account deletion. */
export async function purgeDeletedWorkspace(owner: string) {
  await clearWorkspace(owner);
  const files = await FS.readDirectoryAsync(FS.documentDirectory!);
  for (const name of files.filter(
    (n) =>
      n.startsWith(`pdfast-account-${owner}-`) && !/state-[01]\.json$/.test(n),
  ))
    await FS.deleteAsync(FS.documentDirectory + name, { idempotent: true });
  const marker = await claimMarker();
  if (marker?.owner === owner) {
    for (const name of files.filter((n) => /^pdfast-state.*\.json$/.test(n))) {
      const old = JSON.parse(
        await FS.readAsStringAsync(FS.documentDirectory + name),
      );
      await FS.writeAsStringAsync(
        FS.documentDirectory + name,
        JSON.stringify({
          ...old,
          documents: [],
          pendingDocuments: [],
          shelves: [],
          queue: (old.queue || []).filter(
            (q: ReadingSession) => q.owner !== owner,
          ),
        }),
      );
    }
  }
  // Preserve content if any retained snapshot is unreadable; never guess another account's references.
  const snapshots = [];
  for (const name of files.filter((n) => /^pdfast-.*state.*\.json$/.test(n))) {
    if (!(await FS.getInfoAsync(FS.documentDirectory + name)).exists) continue;
    snapshots.push(
      JSON.parse(await FS.readAsStringAsync(FS.documentDirectory + name)),
    );
  }
  for (const name of orphanedReadingFiles(files, snapshots))
    await FS.deleteAsync(FS.documentDirectory + name, { idempotent: true });
}
