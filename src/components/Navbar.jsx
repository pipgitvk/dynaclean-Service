"use client";

import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";

export default function Navbar({ onToggleSidebar }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Call backend logout to clear cookie
      await fetch("/api/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="w-full h-16 bg-gray-700 shadow flex items-center justify-between px-4">
      {/* Sidebar Toggle (visible on mobile) */}
      <button
        onClick={onToggleSidebar}
        className=" text-white cursor-pointer"
        aria-label="Toggle Sidebar"
      >
        <Menu size={24} />
      </button>

      <button
        onClick={handleLogout}
        className="text-white bg-red-400 hover:bg-red-500 px-3 py-1 rounded transition"
      >
        Logout
      </button>
    </div>
  );
}
