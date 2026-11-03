import type { Word } from "./core";
export const EXTRACTION_VERSION = 3;
export type TextItem = {
  str: string;
  hasEOL?: boolean;
  height?: number;
  width?: number;
  transform?: number[];
  dir?: string;
};
export type PageExtraction = {
  words: Word[];
  sources: number[][];
  rawCount: number;
};
export type PdfExtraction = {
  words: Word[];
  sources: number[][];
  pageCount: number;
  extractionVersion: number;
  chapterStarts?: number[];
  original?: { words: Word[]; chapterStarts: number[] };
  legacy?: { words: Word[]; sources: number[][]; chapterStarts: number[] };
};
const isLetter = /^\p{L}\p{M}*$/u;
function isText(item: object): item is TextItem {
  return "str" in item && typeof item.str === "string";
}
export function extractPage(
  input: (TextItem | object)[],
  page: number,
  version = EXTRACTION_VERSION,
): PageExtraction {
  const items = input.filter(isText).map((item) => ({ ...item }));
  let rawCount = 0;
  const raw = items.map((item) =>
    item.str
      .trim()
      .split(/\s+/u)
      .filter(Boolean)
      .map((text) => ({ text, source: rawCount++ })),
  );
  const sizes = items
    .filter((i) => i.str.trim().length > 5 && (i.height || 0) > 0)
    .map((i) => i.height!)
    .sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] || 0;
  const joined = new Map<number, { text: string; source: number }>();
  const removed = new Set<number>();
  const geometry = (item: TextItem) =>
    item.transform?.length === 6 &&
    Math.abs(item.transform[1]) < 0.01 &&
    Math.abs(item.transform[2]) < 0.01 &&
    item.dir !== "rtl";
  for (let i = 0; i < items.length; i++) {
    const cap = items[i];
    if (
      !body ||
      !geometry(cap) ||
      !isLetter.test(cap.str.trim()) ||
      (cap.height || 0) < body * 1.8 ||
      raw[i].length !== 1
    )
      continue;
    const [x, y] = cap.transform!.slice(4);
    const right = x + (cap.width || 0);
    const candidates = items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => {
        if (
          index === i ||
          joined.has(index) ||
          !raw[index].length ||
          !geometry(item) ||
          (item.height || 0) > body * 1.3 ||
          !/^\p{L}/u.test(raw[index][0].text)
        )
          return false;
        const [tx, ty] = item.transform!.slice(4);
        const gap = tx - right;
        // First body line beside the enlarged glyph, not an intervening chapter heading.
        return (
          gap >= -body * 0.15 &&
          gap <= body * 0.75 &&
          ty >= y - body * 0.2 &&
          ty <= y + cap.height! * 0.85
        );
      })
      .sort((a, b) => b.item.transform![5] - a.item.transform![5]);
    if (!candidates.length) continue;
    const first = candidates[0];
    // Multiple candidates on the highest line are ambiguous (columns/initials).
    if (
      candidates
        .slice(1)
        .some(
          (c) =>
            Math.abs(c.item.transform![5] - first.item.transform![5]) <
            body * 0.3,
        )
    )
      continue;
    // A large standalone article/conjunction cannot safely be attached to a full word.
    if (
      /^[AEIOU]$/iu.test(cap.str.trim()) &&
      [...raw[first.index][0].text].length > 2 &&
      (version < 3 ||
        /\s$/u.test(cap.str) ||
        /^\s/u.test(first.item.str) ||
        Math.abs(first.item.transform![4] - right) > body * 0.1)
    )
      continue;
    joined.set(first.index, { text: cap.str.trim(), source: raw[i][0].source });
    removed.add(i);
  }
  const words: Word[] = [];
  const sources: number[][] = [];
  for (let i = 0; i < items.length; i++) {
    if (removed.has(i)) continue;
    const item = items[i];
    const heading =
      !!body &&
      (item.height || 0) > body * 1.4 &&
      !isLetter.test(item.str.trim());
    raw[i].forEach((part, index) => {
      const cap = index === 0 ? joined.get(i) : undefined;
      words.push({
        text: (cap?.text || "") + part.text,
        page,
        paragraphEnd: !!item.hasEOL && index === raw[i].length - 1,
        ...(heading ? { heading: true } : {}),
      });
      sources.push(cap ? [cap.source, part.source] : [part.source]);
    });
  }
  return { words, sources, rawCount };
}
export function tokenize(items: (TextItem | object)[], page: number): Word[] {
  return extractPage(items, page).words;
}
