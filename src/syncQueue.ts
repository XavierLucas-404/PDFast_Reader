import type { ReadingSession } from "./core";
/** The in-progress chunk is persisted for crash recovery but must never be uploaded live. */
export function sealedSessions(
  queue: readonly ReadingSession[],
  owner: string,
  activeId?: string,
) {
  return queue.filter(
    (session) => session.owner === owner && session.id !== activeId,
  );
}
