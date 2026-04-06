import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import { resolveDbColumn } from "@/lib/employeeProfileColumns";
import { getRepListUserRole, isHrApproverRole } from "@/lib/employeeProfileHrAuth";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

function getAuthToken(req) {
  return (
    req.cookies.get("impersonation_token")?.value ||
    req.cookies.get("token")?.value ||
    null
  );
}

async function loadColumnSet(conn) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles'`,
  );
  return new Set(rows.map((r) => r.c));
}

export async function GET(req) {
  try {
    const token = getAuthToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const username = payload?.username;
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await getDbConnection();
    const role = await getRepListUserRole(username);
    if (!isHrApproverRole(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const columnSet = await loadColumnSet(conn);
    const approvalCol = resolveDbColumn("profile_approval_status", columnSet);
    if (!approvalCol) {
      return NextResponse.json({
        rows: [],
        message:
          "Add a column such as profile_approval_status VARCHAR to employee_profiles to use HR approvals.",
      });
    }

    const [rows] = await conn.execute(
      `SELECT id, username, full_name, employee_code, empId, \`${approvalCol}\` AS profile_approval_status, updated_at
       FROM employee_profiles
       WHERE \`${approvalCol}\` = ?
       ORDER BY updated_at DESC`,
      ["pending_hr"],
    );

    return NextResponse.json({ rows });
  } catch (e) {
    console.error("[pending-approvals GET]", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
