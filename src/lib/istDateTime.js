/** India Standard Time — used for attendance and other business-local timestamps in DB */

const IST = "Asia/Kolkata";

function partsToMap(parts) {
  const m = {};
  for (const p of parts) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  return m;
}

/** Calendar date YYYY-MM-DD in IST (for attendance `date` column, daily queries). */
export function getISTCalendarDate(date = new Date()) {
  const parts = partsToMap(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: IST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date)
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** MySQL DATETIME string in IST wall time (naive), avoids driver storing UTC. */
export function formatISTSqlDateTime(date = new Date()) {
  const parts = partsToMap(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: IST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date)
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Columns on `attendance_logs` that store business-local IST wall times. */
const ATTENDANCE_LOG_DATETIME_FIELDS = [
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
];

/**
 * Ensures API JSON returns IST strings instead of Date serialized as UTC (ISO).
 * Pass-through for null; string values unchanged; Date → formatISTSqlDateTime.
 */
export function normalizeAttendanceLogTimes(row) {
  if (!row) return null;
  const out = { ...row };
  for (const key of ATTENDANCE_LOG_DATETIME_FIELDS) {
    const v = out[key];
    if (v == null) continue;
    if (v instanceof Date) {
      out[key] = formatISTSqlDateTime(v);
    }
  }
  return out;
}
