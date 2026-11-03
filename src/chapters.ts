import type { Word } from "./core";
import type { PageExtraction, TextItem } from "./extraction";
export const CHAPTER_DETECTION_VERSION = 2;
export const CHAPTER_PAUSE_MS = 2000;
export type ChapterBookmark = { title: string; page: number };
export type ChapterCandidate = {
  page: number;
  index: number;
  label: string;
  explicit: boolean;
  number: number | null;
  strong: boolean;
  style: string;
};
const explicit = /^(?:cap[ií]tulo|chapter)\s+\S+/iu;
// Some PDFs encode tracking/letter spacing as actual spaces ("C H A P T E R").
// Normalize only the recognized leading label, never the indexed PDF words.
const tracking = "[\\s\\u00ad\\u200b\\ufeff]*";
const trackedKeywords = [
  [..."chapter"],
  ["c", "a", "p", "[ií]", "t", "u", "l", "o"],
]
  .map((letters) => letters.join(tracking))
  .join("|");
const trackedKeyword = new RegExp(
  `^(?:${trackedKeywords})(?=[\\s\\u00ad\\u200b\\ufeff:.0-9]|$)`,
  "iu",
);
export function normalizeChapterLabel(value: string): string {
  const text = value.normalize("NFC").trim();
  const match = trackedKeyword.exec(text);
  if (!match) return text;
  const word = match[0].replace(/[\s\u00ad\u200b\ufeff]/gu, "");
  const rest = text
    .slice(match[0].length)
    .replace(/^[\s\u00ad\u200b\ufeff:.]+/u, "");
  return rest ? `${word} ${rest}` : word;
}
const isExplicit = (value: string) =>
  explicit.test(normalizeChapterLabel(value));
const singleLetter = /^\p{L}\p{M}*$/u;
const labelKey = (text: string) =>
  normalizeChapterLabel(text)
    .toLowerCase()
    .replace(/^(?:cap[ií]tulo|chapter)\s+/iu, "")
    .replace(/[.\s]+$/u, "");
function chapterNumber(text: string): number | null {
  const s = labelKey(text);
  if (/^\d{1,4}$/.test(s)) return Number(s);
  if (!/^[ivxlcdm]+$/i.test(s)) return null;
  const v: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000,
  };
  return [...s].reduce(
    (sum, c, i) => sum + (v[c] < (v[s[i + 1]] || 0) ? -v[c] : v[c]),
    0,
  );
}
/** Geometry is evidence only; ordinary headings and drop caps are never enough alone. */
export function chapterCandidates(
  input: (TextItem | object)[],
  extraction: PageExtraction,
  page: number,
): ChapterCandidate[] {
  let source = 0;
  const items = input
    .filter((v): v is TextItem => "str" in v && typeof v.str === "string")
    .map((item) => {
      const start = source;
      source += item.str.trim().split(/\s+/u).filter(Boolean).length;
      return { ...item, source: start };
    })
    .filter(
      (i) =>
        i.str.trim() &&
        i.transform?.length === 6 &&
        Math.abs(i.transform[1]) < 0.01 &&
        Math.abs(i.transform[2]) < 0.01 &&
        i.dir !== "rtl",
    );
  const sizes = items
    .filter((i) => i.str.trim().length > 5 && (i.height || 0) > 0)
    .map((i) => i.height!)
    .sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)];
  if (!body) return [];
  const bodyLines = items
    .filter((i) => i.str.trim().length > 5 && (i.height || 0) <= body * 1.3)
    .sort((a, b) => b.transform![5] - a.transform![5]);
  const first = bodyLines[0];
  if (!first) return [];
  const top = first.transform![5];
  const caps = items.filter(
    (i) =>
      singleLetter.test(i.str.trim()) &&
      (i.height || 0) >= body * 1.8 &&
      i.transform![5] <= top + body * 0.2 &&
      i.transform![5] >= top - i.height! * 0.85,
  );
  const above = items
    .filter((i) => i.transform![5] > top + body * 0.7)
    .sort(
      (a, b) =>
        b.transform![5] - a.transform![5] || a.transform![4] - b.transform![4],
    );
  const lines: (typeof above)[] = [];
  for (const item of above) {
    const line = lines.find(
      (l) => Math.abs(l[0].transform![5] - item.transform![5]) < body * 0.3,
    );
    if (line) line.push(item);
    else lines.push([item]);
  }
  return lines.flatMap((line) => {
    line.sort((a, b) => a.transform![4] - b.transform![4]);
    const label = normalizeChapterLabel(
      line.map((i) => i.str.trim()).join(" "),
    );
    if (label.split(/\s+/u).length > 8) return [];
    const isExplicit = explicit.test(label),
      number = chapterNumber(label);
    const tall = line.some((i) => (i.height || 0) > body * 1.4);
    if (!isExplicit && (number === null || !tall)) return [];
    const index = extraction.sources.findIndex((s) =>
      s.includes(line[0].source),
    );
    if (index < 0) return [];
    return [
      {
        page,
        index,
        label,
        explicit: isExplicit,
        number,
        strong: caps.length === 1 && line[0].transform![5] - top >= body * 2,
        style: `${Math.round(((line[0].height || body) / body) * 10)}:${Math.round(line[0].transform![4] / body)}`,
      },
    ];
  });
}
export function detectChapterStarts(
  words: readonly Word[],
  candidates: readonly ChapterCandidate[],
  bookmarks: readonly ChapterBookmark[],
): number[] {
  const starts = new Set<number>();
  const chapters = bookmarks.filter((b) => isExplicit(b.title));
  if (chapters.length) {
    for (const b of chapters) {
      const matches = candidates.filter(
        (c) => c.page === b.page && labelKey(c.label) === labelKey(b.title),
      );
      if (matches.length === 1) starts.add(matches[0].index);
      else if (matches.length === 0) {
        const onPage = candidates.filter((c) => c.page === b.page);
        if (onPage.length === 1) starts.add(onPage[0].index);
        else if (onPage.length === 0) {
          const first = words.findIndex((w) => w.page === b.page);
          if (first >= 0) starts.add(first);
        }
      }
    }
  } else {
    for (const c of candidates) if (c.explicit) starts.add(c.index);
    const numbered = candidates.filter(
      (c) => !c.explicit && c.number !== null && c.strong,
    );
    for (const c of numbered)
      if (
        numbered.some(
          (other) =>
            other !== c &&
            other.style === c.style &&
            ((other.page > c.page && other.number === c.number! + 1) ||
              (other.page < c.page && other.number === c.number! - 1)),
        )
      )
        starts.add(c.index);
  }
  return [...starts]
    .filter((i) => i >= 0 && i < words.length)
    .sort((a, b) => a - b);
}
/** Extra chapter dwell is separate from active presentation time used for competition. */
export function chapterWait(
  chapterStarts: readonly number[] | undefined,
  position: number,
): number {
  return chapterStarts?.includes(position + 1) ? CHAPTER_PAUSE_MS : 0;
}
export async function readChapterBookmarks(pdf: {
  getOutline: () => Promise<any[] | null>;
  getDestination: (name: string) => Promise<any>;
  getPageIndex: (ref: any) => Promise<number>;
}): Promise<ChapterBookmark[]> {
  const result: ChapterBookmark[] = [];
  let visited = 0;
  async function walk(nodes: any[], depth: number): Promise<void> {
    if (depth > 20) return;
    for (const node of nodes) {
      if (++visited > 10000) return;
      try {
        if (isExplicit(node.title || "")) {
          const dest =
            typeof node.dest === "string"
              ? await pdf.getDestination(node.dest)
              : node.dest;
          if (Array.isArray(dest) && dest[0] !== undefined) {
            const page =
              typeof dest[0] === "number"
                ? dest[0] + 1
                : (await pdf.getPageIndex(dest[0])) + 1;
            if (Number.isInteger(page) && page > 0)
              result.push({ title: node.title, page });
          }
        }
      } catch {}
      if (Array.isArray(node.items)) await walk(node.items, depth + 1);
    }
  }
  try {
    await walk((await pdf.getOutline()) || [], 0);
  } catch {}
  return result;
}
