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

async function loadSubmissionColumnSet(conn) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profile_submission'`,
  );
  return new Set(rows.map((r) => r.c));
}

function firstExistingColumn(columnSet, names) {
  for (const name of names) {
    if (columnSet.has(name)) return name;
  }
  return null;
}

async function syncSubmissionStatus(conn, { targetUsername, statusNext, actedBy }) {
  const subCols = await loadSubmissionColumnSet(conn);
  if (subCols.size === 0) return;

  const idCol = firstExistingColumn(subCols, ["id", "submission_id"]);
  const usernameCol = firstExistingColumn(subCols, ["username", "user_name"]);
  const statusCol = firstExistingColumn(subCols, ["approval_status", "profile_approval_status", "status"]);
  const reviewedAtCol = firstExistingColumn(subCols, ["reviewed_at", "approved_at", "action_at", "updated_at"]);
  const reviewedByCol = firstExistingColumn(subCols, ["reviewed_by", "approved_by", "hr_username", "action_by"]);

  if (!usernameCol || !statusCol) return;

  const orderBy = idCol ? ` ORDER BY \`${idCol}\` DESC` : "";
  const [existing] = await conn.execute(
    `SELECT * FROM employee_profile_submission WHERE \`${usernameCol}\` = ?${orderBy} LIMIT 1`,
    [targetUsername],
  );
  if (existing.length === 0) return;

  const setParts = [`\`${statusCol}\` = ?`];
  const vals = [statusNext];
  if (reviewedAtCol) setParts.push(`\`${reviewedAtCol}\` = NOW()`);
  if (reviewedByCol) {
    setParts.push(`\`${reviewedByCol}\` = ?`);
    vals.push(actedBy);
  }

  if (idCol && existing[0]?.[idCol] != null) {
    vals.push(existing[0][idCol]);
    await conn.execute(
      `UPDATE employee_profile_submission SET ${setParts.join(", ")} WHERE \`${idCol}\` = ? LIMIT 1`,
      vals,
    );
    return;
  }

  vals.push(targetUsername);
  await conn.execute(
    `UPDATE employee_profile_submission SET ${setParts.join(", ")} WHERE \`${usernameCol}\` = ? LIMIT 1`,
    vals,
  );
}

export async function POST(req) {
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

    const body = await req.json();
    const targetUsername = String(body?.targetUsername || "").trim();
    const approved = Boolean(body?.approved);
    if (!targetUsername) {
      return NextResponse.json({ error: "targetUsername required" }, { status: 400 });
    }

    const columnSet = await loadColumnSet(conn);
    const approvalCol = resolveDbColumn("profile_approval_status", columnSet);
    if (!approvalCol) {
      return NextResponse.json(
        { error: "profile_approval_status column missing on employee_profiles" },
        { status: 400 },
      );
    }

    const byCol = resolveDbColumn("profile_approved_by", columnSet);
    const atCol = resolveDbColumn("profile_approved_at", columnSet);

    const statusNext = approved ? "approved" : "rejected";

    const sets = [`\`${approvalCol}\` = ?`];
    const vals = [statusNext];

    if (byCol) {
      sets.push(`\`${byCol}\` = ?`);
      vals.push(username);
    }
    if (atCol) {
      sets.push(`\`${atCol}\` = NOW()`);
    }

    vals.push(targetUsername);

    const [result] = await conn.execute(
      `UPDATE employee_profiles SET ${sets.join(", ")} WHERE username = ? LIMIT 1`,
      vals,
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Profile row not found for that username" }, { status: 404 });
    }

    await syncSubmissionStatus(conn, { targetUsername, statusNext, actedBy: username });

    return NextResponse.json({ success: true, status: statusNext });
  } catch (e) {
    console.error("[employee-profile approve]", e);
    return NextResponse.json({ error: e?.sqlMessage || e?.message || "Server error" }, { status: 500 });
  }
}
