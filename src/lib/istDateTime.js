/** India Standard Time — used for attendance and other business-local timestamps in DB */

const IST = "Asia/Kolkata";
export const IST_TIMEZONE = IST;

const ATTENDANCE_DB_NAIVE_IS_UTC =
  process.env.NEXT_PUBLIC_ATTENDANCE_DB_NAIVE_IS_UTC === "1";

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

/** Columns on `attendance_logs` that store UTC timestamps. */
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


export function normalizeAttendanceLogTimes(row) {
  if (!row) return null;
  const out = { ...row };
  for (const key of ATTENDANCE_LOG_DATETIME_FIELDS) {
    const v = out[key];
    if (v == null) continue;
    if (v instanceof Date) {
      if (!Number.isNaN(v.getTime())) {
        out[key] = v.toISOString();
      }
    }
  }
  return out;
}

function getISTHourMinuteFromDate(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { h, m };
}

/** True when IST wall time for `date` is at or after `hour`:`minute` (24h). */
export function isISTAtOrAfterHhMm(date = new Date(), hour, minute = 0) {
  const { h, m } = getISTHourMinuteFromDate(date);
  return h * 60 + m >= hour * 60 + minute;
}

function parseNaiveDateTimeAsUtcDate(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(
    parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10),
    parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6] ?? "0", 10)
  ));
}


export function parseAttendanceClockMinutes(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const { h, m } = getISTHourMinuteFromDate(value);
    return h * 60 + m;
  }
  const s = String(value).trim();
  const naiveUtcDate = parseNaiveDateTimeAsUtcDate(s);
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (naiveUtcDate && !hasExplicitTz) {
    const { h, m } = getISTHourMinuteFromDate(naiveUtcDate);
    return h * 60 + m;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const { h, m } = getISTHourMinuteFromDate(d);
  return h * 60 + m;
}

/**
 * Display attendance DATETIME in UI — wall-clock by default.
 */
export function formatAttendanceTimeForDisplay(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  
  const d = !hasExplicitTz ? parseNaiveDateTimeAsUtcDate(s) : new Date(value);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
