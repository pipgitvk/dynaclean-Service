

import "../globals.css";
import getSidebarMenuItems from "@/lib/getSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserLayoutShell";


export default async function UserDashboardLayout({ children }) {
  const menuItems = await getSidebarMenuItems(); // ✅ runs server-side

  return (
    <UserLayoutShell menuItems={menuItems}>
   
        {children}

    </UserLayoutShell>
  );
}