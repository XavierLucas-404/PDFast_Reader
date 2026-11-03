import { AppError } from "./i18n";
// Chunked, double-buffered storage: a failed write never replaces the last session.
export interface SecretStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
export function createSecureStorage(
  store: SecretStore,
  legacy?: {
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  },
) {
  let serial: Promise<unknown> = Promise.resolve();
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = serial.then(fn);
    serial = next.catch(() => {});
    return next;
  };
  const base = (key: string) =>
    "pdfast." + key.replace(/[^a-zA-Z0-9._-]/g, "_");
  async function read(key: string) {
    const b = base(key),
      meta = await store.getItemAsync(b);
    if (!meta) return null;
    const { slot, count } = JSON.parse(meta);
    if (
      ![0, 1].includes(slot) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 1000
    )
      throw new AppError("errors.sessionInvalid");
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        store.getItemAsync(`${b}.${slot}.${i}`),
      ),
    );
    if (chunks.some((x) => x === null))
      throw new AppError("errors.sessionIncomplete");
    return chunks.join("");
  }
  async function write(key: string, value: string) {
    const b = base(key),
      old = await store.getItemAsync(b),
      previous = old ? JSON.parse(old) : null;
    const slot = previous?.slot === 0 ? 1 : 0;
    // At most 1500 UTF-8 bytes, even for surrogate pairs.
    const parts: string[] = [];
    let part = "";
    for (const char of value) {
      if (part.length + char.length > 375) {
        parts.push(part);
        part = "";
      }
      part += char;
    }
    parts.push(part);
    for (let i = 0; i < parts.length; i++)
      await store.setItemAsync(`${b}.${slot}.${i}`, parts[i]);
    await store.setItemAsync(b, JSON.stringify({ slot, count: parts.length }));
    if (previous)
      for (let i = 0; i < previous.count; i++)
        await store.deleteItemAsync(`${b}.${previous.slot}.${i}`);
  }
  return {
    getItem: (key: string) =>
      run(async () => {
        const value = await read(key);
        if (value !== null || !legacy) return value;
        const old = await legacy.getItem(key);
        if (old !== null) {
          await write(key, old);
          await legacy.removeItem(key);
        }
        return old;
      }),
    setItem: (key: string, value: string) =>
      run(async () => {
        await write(key, value);
        await legacy?.removeItem(key);
      }),
    removeItem: (key: string) =>
      run(async () => {
        const b = base(key),
          meta = await store.getItemAsync(b);
        await store.deleteItemAsync(b);
        await legacy?.removeItem(key);
        if (meta) {
          const { slot, count } = JSON.parse(meta);
          for (let i = 0; i < count; i++)
            await store.deleteItemAsync(`${b}.${slot}.${i}`);
        }
      }),
  };
}
