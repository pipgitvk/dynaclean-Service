"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/user/Sidebar";
import { UserProvider } from "@/context/UserContext";

export default function UserLayoutShell({ children, menuItems }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on mobile when screen size changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    // Set initial state based on screen size
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-zinc-100 relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed md:relative z-50 md:z-auto
        transition-transform duration-300 ease-in-out
        md:transition-none
      `}>
        <Sidebar 
          isOpen={sidebarOpen} 
          menuItems={menuItems} 
          onCloseSidebar={closeSidebar}
        />
      </div>
      
      {/* Main content */}
      <div className="flex flex-col flex-1 w-full md:w-auto">
        <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <UserProvider>
          <main className="p-2 md:p-4 overflow-auto flex-1">{children}</main>
        </UserProvider>
      </div>
    </div>
  );
}
