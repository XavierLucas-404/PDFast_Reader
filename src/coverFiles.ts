import * as FS from "expo-file-system/legacy";
import type { Document } from "./core";
export const coverFolder = (owner: string | null) =>
  `pdfast-covers/${owner || "guest"}/`;
export const coverPath = (relative: string) => FS.documentDirectory + relative;
export const pageCoverFile = (
  owner: string | null,
  hash: string,
  page: number,
) => `${coverFolder(owner)}${hash}-page-${page}.jpg`;
export function artworkFile(d: Document, owner: string | null) {
  return (
    d.customCover ||
    (d.coverPage ? pageCoverFile(owner, d.hash, d.coverPage) : undefined)
  );
}
const writes = new Map<string, Promise<void>>();
export async function writeThumbnail(
  owner: string | null,
  hash: string,
  page: number,
  base64: string,
) {
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    !Number.isInteger(page) ||
    page < 1 ||
    base64.length > 4 * 1024 * 1024
  )
    throw Error("Invalid thumbnail");
  const name = pageCoverFile(owner, hash, page);
  const pending = (writes.get(name) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await FS.makeDirectoryAsync(coverPath(coverFolder(owner)), {
        intermediates: true,
      });
      const tmp = name + ".tmp";
      await FS.writeAsStringAsync(coverPath(tmp), base64, {
        encoding: FS.EncodingType.Base64,
      });
      await FS.deleteAsync(coverPath(name), { idempotent: true });
      await FS.moveAsync({ from: coverPath(tmp), to: coverPath(name) });
    });
  writes.set(name, pending);
  try {
    await pending;
    return name;
  } finally {
    if (writes.get(name) === pending) writes.delete(name);
  }
}
