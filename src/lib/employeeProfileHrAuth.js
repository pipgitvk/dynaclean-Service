import { getDbConnection } from "@/lib/db";

/** rep_list.userRole — JWT often only has role "user", so use DB for HR checks */
export async function getRepListUserRole(username) {
  if (!username) return "";
  const conn = await getDbConnection();
  const [rows] = await conn.execute(`SELECT userRole FROM rep_list WHERE username = ? LIMIT 1`, [
    username,
  ]);
  return rows[0]?.userRole || "";
}

export function isHrApproverRole(role) {
  return ["HR", "HR_MANAGER", "ADMIN", "SUPERADMIN"].includes(role);
}
