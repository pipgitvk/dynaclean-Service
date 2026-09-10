import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

/**
 * Calculates accrued paid leaves from date_of_joining.
 * Rule: 1 leave per completed month from accrual start date up to today.
 * Returns the number of accrued days (capped at the policy allowed limit).
 */
function calcAccruedLeaves(dateOfJoining, allowedPerYear) {
  if (!dateOfJoining) return allowedPerYear;
  const start = new Date(dateOfJoining);
  const today = new Date();
  if (isNaN(start.getTime()) || start > today) return 0;

  // Count complete months elapsed
  let months =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());
  // If we haven't passed the same day-of-month yet, subtract 1
  if (today.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;

  // 1 leave per completed month, capped at policy allowed
  return Math.min(months, allowedPerYear ?? months);
}

export async function GET() {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    const username = session.username;

    // ── 1. Fetch employee profile ──────────────────────────────────────────
    const [profiles] = await conn.execute(
      `SELECT employment_status, leave_policy, date_of_joining
       FROM employee_profiles WHERE username = ? LIMIT 1`,
      [username]
    );

    let leavePolicy = {};
    let employmentStatus = "probation";
    let dateOfJoining = null;

    if (profiles.length > 0) {
      employmentStatus = profiles[0].employment_status || "probation";
      dateOfJoining = profiles[0].date_of_joining || null;
      try {
        leavePolicy = profiles[0].leave_policy
          ? JSON.parse(profiles[0].leave_policy)
          : {};
      } catch {
        leavePolicy = {};
      }
    }

    // ── 2. Leave types to evaluate ─────────────────────────────────────────
    const leaveTypes = ["sick", "paid", "casual"];

    // ── 3. For each type: count approved & pending this calendar year ──────
    const [takenRows] = await conn.execute(
      `SELECT leave_type,
              SUM(CASE WHEN status = 'approved' THEN total_days ELSE 0 END) AS taken,
              SUM(CASE WHEN status = 'pending'  THEN total_days ELSE 0 END) AS pending_days
       FROM employee_leaves
       WHERE username = ?
         AND leave_type IN ('sick','paid','casual','unpaid')
         AND YEAR(from_date) = YEAR(CURDATE())
       GROUP BY leave_type`,
      [username]
    );

    const takenMap = {};
    const pendingMap = {};
    for (const row of takenRows) {
      takenMap[row.leave_type] = Number(row.taken || 0);
      pendingMap[row.leave_type] = Number(row.pending_days || 0);
    }

    // ── 4. Build leaveSummary ──────────────────────────────────────────────
    const leaveSummary = [];

    for (const type of leaveTypes) {
      const enabled = leavePolicy[`${type}_enabled`] === true;
      if (!enabled) continue;

      const allowedRaw = Number(leavePolicy[`${type}_allowed`] || 0);

      // For paid leave: accrue 1 per month from date_of_joining
      // (sick and casual use flat annual quota)
      const allowed =
        type === "paid"
          ? calcAccruedLeaves(dateOfJoining, allowedRaw)
          : allowedRaw;

      const taken = takenMap[type] || 0;
      const pending = pendingMap[type] || 0;
      const available = Math.max(0, allowed - taken);

      leaveSummary.push({ type, enabled: true, allowed, taken, available, pending });
    }

    // ── 5. Unpaid stats ────────────────────────────────────────────────────
    const unpaidLeaves = {
      taken: takenMap["unpaid"] || 0,
      pending: pendingMap["unpaid"] || 0,
    };

    // ── 6. Accrual info for UI display ────────────────────────────────────
    let accrualInfo = null;
    if (dateOfJoining && leavePolicy.paid_enabled) {
      const start = new Date(dateOfJoining);
      const today = new Date();
      let months =
        (today.getFullYear() - start.getFullYear()) * 12 +
        (today.getMonth() - start.getMonth());
      if (today.getDate() < start.getDate()) months -= 1;
      if (months < 0) months = 0;

      accrualInfo = {
        start_date: start.toISOString().split("T")[0],
        months_completed: months,
        accrued: Math.min(months, leavePolicy.paid_allowed ?? months),
        per_month: 1,
      };
    }

    return NextResponse.json({
      success: true,
      employment_status: employmentStatus,
      leaveSummary,
      unpaidLeaves,
      accrualInfo,
    });
  } catch (error) {
    console.error("[leaves/stats]", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
