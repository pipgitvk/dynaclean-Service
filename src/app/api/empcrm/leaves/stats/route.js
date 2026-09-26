import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { calculateAccruedLeaves, getAccrualCycle } from "@/lib/leaveAccrual";

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
    let employmentStatus = null;
    let dateOfJoining = null;

    if (profiles.length > 0) {
      employmentStatus = profiles[0].employment_status || null;
      dateOfJoining = profiles[0].date_of_joining || null;
      try {
        const rawPolicy = profiles[0].leave_policy;
        if (!rawPolicy) leavePolicy = {};
        else if (typeof rawPolicy === "string") leavePolicy = JSON.parse(rawPolicy);
        else leavePolicy = rawPolicy;
      } catch {
        leavePolicy = {};
      }
    }

    // ── 2. Leave types to evaluate ─────────────────────────────────────────
    const leaveTypes = ["sick", "paid", "casual"];

    const accrualCycle = getAccrualCycle(
      leavePolicy.accrual_start_date || dateOfJoining,
    );
    const leaveDateFilter = accrualCycle
      ? "AND from_date >= ? AND from_date < ?"
      : "AND YEAR(from_date) = YEAR(CURDATE())";
    const leaveDateParams = accrualCycle
      ? [accrualCycle.cycleStart, accrualCycle.cycleEnd]
      : [];

    const [takenRows] = await conn.execute(
      `SELECT leave_type,
              SUM(CASE WHEN status = 'approved' THEN total_days ELSE 0 END) AS taken,
              SUM(CASE WHEN status = 'pending'  THEN total_days ELSE 0 END) AS pending_days
       FROM employee_leaves
       WHERE username = ?
         AND leave_type IN ('sick','paid','casual','unpaid')
         ${leaveDateFilter}
       GROUP BY leave_type`,
      [username, ...leaveDateParams]
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
      const allowed = calculateAccruedLeaves({
        joiningDate: dateOfJoining,
        accrualStartDate: leavePolicy.accrual_start_date,
        maxAllowed: allowedRaw,
        employmentStatus,
        leaveType: type,
      });

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

    const paidSummary = leaveSummary.find((leave) => leave.type === "paid");

    return NextResponse.json({
      success: true,
      employment_status: employmentStatus || "probation",
      accrual_start_date: leavePolicy.accrual_start_date || null,
      accrual_cycle_start: accrualCycle?.cycleStart || null,
      accrual_cycle_end: accrualCycle?.cycleEnd || null,
      leaveSummary,
      unpaidLeaves,
      accrualInfo: accrualCycle
        ? {
            start_date: leavePolicy.accrual_start_date || accrualCycle.cycleStart,
            accrued: paidSummary?.allowed || 0,
            per_month: 1,
          }
        : null,
    });
  } catch (error) {
    console.error("[leaves/stats]", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
