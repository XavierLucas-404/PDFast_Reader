/** Only app-owned hashed content is eligible; every retained workspace/backup is a reference. */
export function orphanedReadingFiles(
  files: readonly string[],
  snapshots: readonly {
    documents?: { hash: string }[];
    pendingDocuments?: { hash: string }[];
  }[],
) {
  const referenced = new Set(
    snapshots.flatMap((s) =>
      [...(s.documents || []), ...(s.pendingDocuments || [])].map(
        (d) => d.hash,
      ),
    ),
  );
  return files.filter((name) => {
    const match =
      /^(?:pdfast-)?([a-f0-9]{64})(?:\.pdf|(?:\.v[0-9]+)?\.words\.json)$/.exec(
        name,
      );
    return !!match && !referenced.has(match[1]);
  });
}
