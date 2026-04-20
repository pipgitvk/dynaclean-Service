import { getDbConnection } from "@/lib/db";

export async function getReportees(managerUsername) {
  if (!managerUsername) return [];
  try {
    const conn = await getDbConnection();
    const [columns] = await conn.execute(
      `SHOW COLUMNS FROM rep_list LIKE 'reporting_manager'`
    );
    if (columns.length === 0) return [];
    const [rows] = await conn.execute(
      `SELECT username FROM rep_list WHERE reporting_manager = ? AND status = 1`,
      [managerUsername]
    );
    return rows.map((r) => r.username);
  } catch {
    return [];
  }
}

export async function isReportingManagerOf(managerUsername, employeeUsername) {
  const reportees = await getReportees(managerUsername);
  return reportees.includes(employeeUsername);
}

export async function getReportingManagerForEmployee(employeeUsername) {
  if (!employeeUsername) return null;
  try {
    const conn = await getDbConnection();
    const [columns] = await conn.execute(
      `SHOW COLUMNS FROM rep_list LIKE 'reporting_manager'`
    );
    if (columns.length === 0) return null;
    const [rows] = await conn.execute(
      `SELECT reporting_manager FROM rep_list WHERE username = ? LIMIT 1`,
      [employeeUsername]
    );
    const rm = rows[0]?.reporting_manager;
    return rm && String(rm).trim() ? String(rm).trim() : null;
  } catch {
    return null;
  }
}
