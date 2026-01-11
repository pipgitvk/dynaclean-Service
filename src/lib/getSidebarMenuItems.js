// lib/getSidebarMenuItems.js
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSessionPayload } from "./auth";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const allMenuItems = [
  { path: "/user-dashboard", name: "Dashboard", roles: ["ALL"], icon: "Home" },
  { path: "/user-dashboard/task-manager", name: "Task Manager", roles: ["ALL"], icon: "ClipboardList" },
  { path: "/user-dashboard/expenses", name: "Expense", roles: ["ALL"], icon: "DollarSign" },
  { path: "/user-dashboard/view_service_reports", name: "Service History", roles: ["ALL"], icon: "BookOpen" },
  { path: "/user-dashboard/order", name: "Order Process", roles: ["ALL"], icon: "ListOrdered" },
  { path: "/user-dashboard/warranty", name: "Product Console", roles: ["ADMIN", "HR_MANAGER"], icon: "ShieldCheck" },
  { path: "/user-dashboard/quotations", name: "Quotation", roles: ["ALL"], icon: "FileSignature" },
  { path: "/user-dashboard/installation-videos", name: "Installation Videos", roles: ["ALL"], icon: "PlayCircle" },
  // { path: "/user-dashboard/installation-videos/manage", name: "Manage Video Links", roles: ["ALL"], icon: "FilePlus2" },
];

export default async function getSidebarMenuItems() {
  const payload = await getSessionPayload(); // ✅ Get the full session payload
  let role = payload?.role || "GUEST";

  return allMenuItems.filter(
    (item) => item.roles.includes("ALL") || item.roles.includes(role)
  );
}
