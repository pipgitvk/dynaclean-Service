import { parseAttendanceClockMinutes } from "@/lib/istDateTime";

function isMissingCheckoutTime(log) {
  if (log == null) return true;
  const t = log.checkout_time;
  if (t == null) return true;
  if (String(t).trim() === "") return true;
  return parseAttendanceClockMinutes(t) == null;
}

export const DEFAULT_ATTENDANCE_RULES = {
  checkin: "09:30:00",
  checkout: "18:30:00",
  gracePeriodMinutes: 15,
  halfDayCheckin: "10:00:00",
  halfDayCheckout: "18:14:00",
  break_morning_start: "11:15:00",
  break_lunch_start: "13:30:00",
  break_evening_start: "17:45:00",
  breakDurations: { morning: 15, lunch: 30, evening: 15 },
  breakGracePeriodMinutes: 5,
};

export function parseTimeToMinutes(t) {
  if (t == null || t === "") return 0;
  const s = String(t).trim();
  const parts = s.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function addMinutesToTimeString(hhmmss, deltaMin) {
  const s = String(hhmmss ?? "").trim();
  if (!s) return s;
  const base = parseTimeToMinutes(s.slice(0, 8));
  let total = base + Number(deltaMin);
  total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function getCheckinStatus(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!logTime) return null;
  const logM = parseAttendanceClockMinutes(logTime);
  if (logM == null) return null;
  const standardM = parseTimeToMinutes(r.checkin);
  const halfDayM = parseTimeToMinutes(r.halfDayCheckin);
  const graceEndM = standardM + r.gracePeriodMinutes;
  if (logM <= standardM) return "onTime";
  if (logM <= graceEndM) return "grace";
  if (halfDayM > graceEndM && logM >= halfDayM) return "halfDay";
  return "late";
}

export function getCheckoutStatus(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!logTime) return "halfDay";
  const logM = parseAttendanceClockMinutes(logTime);
  if (logM == null) return null;
  const standardM = parseTimeToMinutes(r.checkout);
  const graceStartM = standardM - r.gracePeriodMinutes;
  const halfDayM = parseTimeToMinutes(r.halfDayCheckout);
  if (logM < halfDayM) return "halfDay";
  if (logM < graceStartM) return "late";
  if (logM < standardM) return "grace";
  return "onTime";
}

export function getBreakStatus(startTime, endTime, breakType, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!startTime || !endTime) return null;
  const startM = parseAttendanceClockMinutes(startTime);
  const endM = parseAttendanceClockMinutes(endTime);
  if (startM == null || endM == null) return null;
  const durationMinutes = Math.max(0, endM - startM);
  const allowedDuration = r.breakDurations[breakType];
  const graceLimit = allowedDuration + r.breakGracePeriodMinutes;
  if (durationMinutes <= allowedDuration) return "green";
  if (durationMinutes <= graceLimit) return "yellow";
  return "red";
}

export function isHalfDayByRules(log, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!log?.checkin_time) return false;
  const inM = parseAttendanceClockMinutes(log.checkin_time);
  if (inM == null) return false;
  if (isMissingCheckoutTime(log)) return true;
  const outM = parseAttendanceClockMinutes(log.checkout_time);
  if (outM == null) return true;
  const halfInM = parseTimeToMinutes(r.halfDayCheckin);
  const halfOutM = parseTimeToMinutes(r.halfDayCheckout);
  return inM > halfInM || outM < halfOutM;
}

export function isLateDaySummary(log, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!log?.checkin_time || !log?.checkout_time) return false;
  const inM = parseAttendanceClockMinutes(log.checkin_time);
  const outM = parseAttendanceClockMinutes(log.checkout_time);
  if (inM == null || outM == null) return false;
  const standardIn = parseTimeToMinutes(r.checkin);
  const standardOut = parseTimeToMinutes(r.checkout);
  return inM > standardIn || outM < standardOut;
}
