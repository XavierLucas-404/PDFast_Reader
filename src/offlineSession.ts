import type { Session } from "@supabase/supabase-js";
/** A previously stored identity enables local reading only; RPCs still use Supabase's validated session. */
export async function offlineSession(
  storage: { getItem(key: string): Promise<string | null> },
  key: string,
  error: unknown,
): Promise<Session | null> {
  const e = error as { name?: string; message?: string };
  if (
    e?.name !== "AuthRetryableFetchError" &&
    !/network request failed|failed to fetch|networkerror/i.test(
      e?.message || "",
    )
  )
    return null;
  try {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !/^[a-f0-9-]{36}$/i.test(value?.user?.id || "") ||
      typeof value.access_token !== "string" ||
      typeof value.refresh_token !== "string"
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
