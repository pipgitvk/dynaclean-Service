export const COMPLETED_VISIBLE_MS = 1 * 60 * 60 * 1000;

function parseCompletedAtMs(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    const h = parseInt(m[4], 10);
    const mi = parseInt(m[5], 10);
    const sec = parseInt(m[6] ?? "0", 10);
    // Values are stored as IST wall clock (see getISTDateTimeString).
    return Date.UTC(y, mo - 1, d, h, mi, sec) - 5.5 * 60 * 60 * 1000;
  }
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Hide COMPLETED records from engineer lists after 1 hour. */
export function shouldShowServiceRecord(record, nowMs = Date.now()) {
  const status = String(record?.status || "").trim().toUpperCase();
  if (status !== "COMPLETED") return true;

  const completedAtMs = parseCompletedAtMs(record?.completed_at);
  if (completedAtMs == null) return false;

  return nowMs - completedAtMs < COMPLETED_VISIBLE_MS;
}
