// Safe localStorage JSON helpers.
//
// Raw `JSON.parse(localStorage.getItem(...))` throws on corrupt entries and,
// because it is called during effects/render, can unmount the whole React
// tree. These helpers never throw — corrupt data falls back to a default.

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.warn(`[storage] Ignoring corrupt entry "${key}":`, err);
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // QuotaExceededError, private browsing, etc. — non-fatal.
    console.warn(`[storage] Failed to write "${key}":`, err);
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] Failed to remove "${key}":`, err);
  }
}
