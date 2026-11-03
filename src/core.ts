export type Word = {
  text: string;
  page: number;
  paragraphEnd: boolean;
  heading?: boolean;
};
export type Document = {
  hash: string;
  title: string;
  uri: string;
  words: Word[];
  wordCount?: number;
  available?: boolean;
  conflict?: {
    remote: { position: number; readingStart: number };
    revision: number;
  };
  position: number;
  /** Local exact word; never sent as a cloud bookmark. */
  localResumeValid?: boolean;
  resumePage?: number;
  /** Compatibility value from old catalogs, not the current local word. */
  legacyPosition?: number;
  seen: number[];
  /** History predating timestamped activity; never assigned a fabricated date. */
  undatedSeen?: number[];
  baselineSyncedCount?: number;
  pageCount?: number;
  extractionVersion?: number;
  readingStart?: number;
  completed?: boolean;
  originalTitle?: string;
  customTitle?: boolean;
  shelfId?: string;
  libraryOrder?: number;
  coverPage?: number;
  customCover?: string;
  synced?: boolean;
  chapterStarts?: number[];
  chapterDetectionVersion?: number;
};
export type ReadingSession = {
  id: string;
  owner: string;
  hash: string;
  total: number;
  positions: number[];
  wpm: number;
  activeMs: number;
  startedAt?: string;
  day?: string;
  zone?: string;
  novelPositions?: number[];
};
export function delay(word: Word, wpm: number) {
  return (
    (60000 / wpm) *
    (word.paragraphEnd
      ? 2
      : /[.!?…]$/.test(word.text)
        ? 1.6
        : /[,;:]$/.test(word.text)
          ? 1.25
          : 1)
  );
}
export function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString();
}
export function nextWeek(date = new Date()) {
  return new Date(new Date(weekStart(date)).getTime() + 7 * 86400000);
}
export function rank<T extends { words: number }>(rows: T[]) {
  return [...rows]
    .sort((a, b) => b.words - a.words)
    .map((row, _, all) => ({
      ...row,
      rank: 1 + all.filter((r) => r.words > row.words).length,
    }));
}
export function eligible(wpm: number, active: boolean) {
  return active && wpm >= 100 && wpm <= 600;
}
