// lib/getSidebarMenuItems.js
import { getSessionPayload } from "./auth";
import { getDbConnection } from "./db";

const allMenuItems = [
  { path: "/user-dashboard", name: "Dashboard", roles: ["ALL"], icon: "Home" },
  {
    path: "/user-dashboard/profile-approvals",
    name: "Profile approvals",
    roles: ["HR", "HR_MANAGER", "ADMIN", "SUPERADMIN"],
    icon: "UserCheck",
  },
  { path: "/user-dashboard/task-manager", name: "Task Manager", roles: ["ALL"], icon: "ClipboardList" },
  { path: "/user-dashboard/expenses", name: "Expense", roles: ["ALL"], icon: "DollarSign" },
  { path: "/user-dashboard/view_service_reports", name: "Service History", roles: ["ALL"], icon: "BookOpen" },
  { path: "/user-dashboard/order", name: "Order Process", roles: ["ALL"], icon: "ListOrdered" },
  { path: "/user-dashboard/warranty", name: "Product Console", roles: ["ADMIN", "HR_MANAGER"], icon: "ShieldCheck" },
  { path: "/user-dashboard/quotations", name: "Quotation", roles: ["ALL"], icon: "FileSignature" },
  { path: "/user-dashboard/installation-videos", name: "Installation Videos", roles: ["ALL"], icon: "PlayCircle" },
  {
    path: "/user-dashboard/my-profile",
    name: "My Profile",
    roles: ["ALL"],
    icon: "UserCircle",
    children: [
      { path: "/user-dashboard/my-profile", name: "Employee Profile", icon: "UserCircle" },
      { path: "/user-dashboard/leave", name: "Leaves", icon: "Calendar" },
       { path: "/user-dashboard/attendance-summary", name: "Attendance Summary", icon: "ClipboardList" },
      { path: "/user-dashboard/attendance", name: "Attendance", icon: "Clock" },
      { path: "/user-dashboard/salary", name: "My Salary", icon: "DollarSign" },
      { path: "/user-dashboard/payslips", name: "My Payslips", icon: "ScrollText" }, 
    ],
  },
];

export default async function getSidebarMenuItems() {
  const payload = await getSessionPayload();
  let role = payload?.role || "GUEST";

  if (payload?.username) {
    try {
      const conn = await getDbConnection();
      const [rows] = await conn.execute(
        `SELECT userRole FROM rep_list WHERE username = ? LIMIT 1`,
        [payload.username],
      );
      const ur = rows[0]?.userRole;
      if (ur) role = ur;
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getSidebarMenuItems] rep_list userRole:", e?.message);
      }
    }
  }

  return allMenuItems.filter(
    (item) => item.roles.includes("ALL") || item.roles.includes(role),
  );
}
