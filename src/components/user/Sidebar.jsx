"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ChevronDown, 
  ChevronRight,
  X,
  Home,
  FileText,
  Upload,
  ClipboardList,
  ScrollText,
  BookOpen,
  DollarSign,
  FileSignature,
  ShieldCheck,
  ListOrdered,
  FilePlus2,
  PlayCircle,
  UserCircle,
  UserCheck,
  Clock,
  Calendar,
} from "lucide-react";

// Icon map
const iconMap = {
  Home,
  FileText,
  Upload,
  ClipboardList,
  PlayCircle,
  ScrollText,
  BookOpen,
  DollarSign,
  FileSignature,
  ShieldCheck,
  ListOrdered,
  FilePlus2,
  UserCircle,
  UserCheck,
  Clock,
  Calendar,
};

export default function Sidebar({ isOpen, menuItems, onCloseSidebar }) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState({});

  const toggleMenu = (name) => {
    setOpenMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 768 && onCloseSidebar) {
      onCloseSidebar();
    }
  };

  return (
    <aside
      className={clsx(
        "h-full transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-0"
      )}
    >
      <div className="h-full min-h-full flex flex-col bg-gradient-to-b from-[#32334a] via-[#4a4b63] to-[#7c6a81] text-white shadow-2xl overflow-y-auto custom-scrollbar">
        <div className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
              DynaClean
            </h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-300 font-bold mt-1">
              User Dashboard
            </p>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={onCloseSidebar}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors md:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} className="text-gray-300" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = iconMap[item.icon] || null;
              const hasChildren = !!item.children;
              const isSubOpen = openMenus[item.name];
              const isActive = pathname === item.path || (item.children?.some(child => pathname === child.path));

              if (hasChildren) {
                return (
                  <li key={item.name} className="group">
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={clsx(
                        "flex items-center justify-between w-full px-4 py-3 text-sm font-medium transition-all duration-200 rounded-xl group-hover:bg-white/10",
                        isActive ? "bg-white/15 text-white shadow-sm" : "text-gray-100 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {Icon && <Icon size={18} className={clsx("transition-transform duration-200", isActive ? "scale-110" : "opacity-80 group-hover:opacity-100")} />}
                        <span>{item.name}</span>
                      </div>
                      {isSubOpen ? (
                        <ChevronDown size={16} className="opacity-70" />
                      ) : (
                        <ChevronRight size={16} className="opacity-70" />
                      )}
                    </button>

                    <div
                      className={clsx(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isSubOpen ? "max-h-[500px] mt-1" : "max-h-0"
                      )}
                    >
                      <ul className="ml-4 pl-4 border-l border-white/10 space-y-1 py-1">
                        {item.children.map((child) => {
                          const ChildIcon = iconMap[child.icon] || null;
                          const isChildActive = pathname === child.path;
                          return (
                            <li key={child.path}>
                              <Link
                                href={child.path}
                                onClick={handleLinkClick}
                                className={clsx(
                                  "flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all duration-200 rounded-lg group/item",
                                  isChildActive 
                                    ? "bg-white/20 text-white" 
                                    : "text-gray-200 hover:text-white hover:bg-white/5"
                                )}
                              >
                                {ChildIcon && <ChildIcon size={14} className={clsx("transition-opacity", isChildActive ? "opacity-100" : "opacity-70 group-hover/item:opacity-100")} />}
                                <span>{child.name}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              }

              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    onClick={handleLinkClick}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-xl group",
                      pathname === item.path
                        ? "bg-white/20 text-white shadow-sm ring-1 ring-white/10"
                        : "text-gray-100 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {Icon && <Icon size={18} className={clsx("transition-transform duration-200", pathname === item.path ? "scale-110" : "opacity-80 group-hover:opacity-100")} />}
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

