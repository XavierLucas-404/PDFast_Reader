import type { Document, ReadingSession } from "./core";
import type { Range } from "./librarySync";
export const MIN_WPM = 100,
  MAX_WPM = 1000;
export type ActivityStamp = { startedAt: string; day: string; zone: string };
export type ProgressSnapshot = {
  daily: Record<string, number>;
  undated: number;
  known: Record<string, Range[]>;
};
export function activityStamp(
  now = new Date(),
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
): ActivityStamp {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    startedAt: now.toISOString(),
    day: `${get("year")}-${get("month")}-${get("day")}`,
    zone,
  };
}
export function sameActivityDay(session: ReadingSession, stamp: ActivityStamp) {
  return session.day === stamp.day && session.zone === stamp.zone;
}
function known(ranges: Range[] | undefined, position: number) {
  return !!ranges?.some(([a, b]) => position >= a && position <= b);
}
export function dailyCounts(
  snapshot: ProgressSnapshot | undefined,
  queue: readonly ReadingSession[],
  owner?: string,
  guestDaily: Record<string, number> = {},
) {
  if (!owner) return { ...guestDaily };
  const daily = { ...snapshot?.daily };
  const pending = new Map<string, { at: string; day: string }>();
  for (const q of queue) {
    if (q.owner !== owner || !q.day || !q.startedAt) continue;
    for (const p of q.novelPositions || []) {
      if (known(snapshot?.known?.[q.hash], p)) continue;
      const key = q.hash + ":" + p,
        previous = pending.get(key);
      if (!previous || q.startedAt < previous.at)
        pending.set(key, { at: q.startedAt, day: q.day });
    }
  }
  for (const event of pending.values())
    daily[event.day] = (daily[event.day] || 0) + 1;
  return daily;
}
export function pendingLegacy(
  documents: readonly Document[],
  snapshot?: ProgressSnapshot,
) {
  return documents.reduce(
    (n, d) =>
      n +
      (d.undatedSeen || []).filter((p) => !known(snapshot?.known?.[d.hash], p))
        .length,
    0,
  );
}
const key = (date: Date) => date.toISOString().slice(0, 10);
/** Calendar arithmetic in UTC over local date labels avoids DST-length assumptions. */
export function periodData(
  daily: Record<string, number>,
  mode: "week" | "month",
  offset: number,
  today: string,
) {
  const now = new Date(today + "T12:00:00Z"),
    start = new Date(now);
  if (mode === "week") {
    start.setUTCDate(
      start.getUTCDate() - ((start.getUTCDay() + 6) % 7) + offset * 7,
    );
  } else {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() + offset);
  }
  const end = new Date(start);
  if (mode === "week") end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  const bars: { date: string; words: number; future: boolean }[] = [];
  for (
    const cursor = new Date(start);
    cursor < end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const day = key(cursor);
    bars.push({ date: day, words: daily[day] || 0, future: day > today });
  }
  const elapsed = bars.filter((b) => !b.future).length,
    total = bars.reduce((n, b) => n + (b.future ? 0 : b.words), 0);
  return {
    start: key(start),
    end: key(new Date(end.getTime() - 86400000)),
    bars,
    total,
    average: elapsed ? total / elapsed : 0,
    elapsed,
  };
}
export function cloneSession(q: ReadingSession): ReadingSession {
  return {
    ...q,
    positions: [...q.positions],
    ...(q.novelPositions ? { novelPositions: [...q.novelPositions] } : {}),
  };
}
