function parseYmd(value) {
  if (!value) return null;
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addYears(date, years) {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
}

function startOfToday(today = new Date()) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

/**
 * Current leave year from leave_policy.accrual_start_date.
 * 2026-06-24 with today 2026-09-26 → 2026-06-24 inclusive, 2027-06-24 exclusive.
 */
export function getAccrualCycle(accrualStartDate, today = new Date()) {
  const start = parseYmd(accrualStartDate);
  if (!start) return null;

  const todayDate = startOfToday(today);
  if (todayDate < start) {
    return {
      cycleStart: formatYmd(start),
      cycleEnd: formatYmd(addYears(start, 1)),
      started: false,
    };
  }

  let cycleStart = start;
  while (addYears(cycleStart, 1) <= todayDate) {
    cycleStart = addYears(cycleStart, 1);
  }

  return {
    cycleStart: formatYmd(cycleStart),
    cycleEnd: formatYmd(addYears(cycleStart, 1)),
    started: true,
  };
}

function monthsAccruedInCycle(cycleStartYmd, today = new Date()) {
  const cycleStart = parseYmd(cycleStartYmd);
  const todayDate = startOfToday(today);
  if (!cycleStart || todayDate < cycleStart) return 0;

  const monthsDiff =
    (todayDate.getFullYear() - cycleStart.getFullYear()) * 12 +
    (todayDate.getMonth() - cycleStart.getMonth());

  const accrued = todayDate.getDate() >= cycleStart.getDate() ? monthsDiff + 1 : monthsDiff;
  return Math.max(0, accrued);
}

/**
 * Sick leave: full annual allowance once the accrual cycle has started.
 * Paid leave: one day per month from the accrual date, capped at the annual allowance.
 */
export function calculateAccruedLeaves({
  accrualStartDate,
  joiningDate,
  maxAllowed,
  employmentStatus,
  leaveType,
  today = new Date(),
}) {
  const annual = Number(maxAllowed) || 0;
  if (employmentStatus === "probation") return 0;

  const effectiveStart = accrualStartDate || joiningDate;
  const cycle = getAccrualCycle(effectiveStart, today);
  if (!cycle) return annual;
  if (!cycle.started) return 0;
  if (leaveType === "sick") return annual;

  const months = monthsAccruedInCycle(cycle.cycleStart, today);
  return Math.max(0, Math.min(months, annual));
}
