// // components/user/Sidebar.jsx
// "use client";

// import clsx from "clsx";
// import Link from "next/link";

// import {
//   Home,
//   FileText,
//   Upload,
//   ClipboardList,
//   ScrollText,
//   BookOpen,
//   DollarSign,
//   FileSignature,
//   ShieldCheck,
//   ListOrdered,
//   FilePlus2,
//   PlayCircle,
// } from "lucide-react";

// // Icon map
// const iconMap = {
//   Home,
//   FileText,
//   Upload,
//   ClipboardList,
//   PlayCircle,
//   ScrollText,
//   BookOpen,
//   DollarSign,
//   FileSignature,
//   ShieldCheck,
//   ListOrdered,
//   FilePlus2,
// };

// export default function Sidebar({ isOpen, menuItems }) {
//   return (
//     <div
//       className={clsx(
//         "h-full bg-gradient-to-b from-gray-800 to-pink-200 text-white overflow-hidden transition-all duration-300 ease-in-out",
//         // "h-full bg-green-700 text-white overflow-hidden transition-all duration-300 ease-in-out",
//         isOpen ? "w-64" : "w-0"
//       )}
//       style={{
//         minWidth: isOpen ? "16rem" : "0",
//         padding: isOpen ? "1rem" : "0",
//       }}
//     >
//       {isOpen && (
//         <>
//           <h2 className="text-xl font-bold mb-4">User Dashboard</h2>
//           <ul className="space-y-2 mt-10">
//             {menuItems.map((item) => {
//               const Icon = iconMap[item.icon] || null;

//               return (
//                 <li key={item.path} className="flex items-center gap-2 m-4">
//                   {Icon && <Icon size={20} />}
//                   <Link href={item.path} className="hover:underline">
//                     {item.name}
//                   </Link>
//                 </li>
//               );
//             })}
//           </ul>
//         </>
//       )}
//     </div>
//   );
// }

// components/user/Sidebar.jsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
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
};

export default function Sidebar({ isOpen, menuItems, onCloseSidebar }) {
  const [openMenus, setOpenMenus] = useState({});

  const toggleMenu = (name) => {
    setOpenMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleLinkClick = () => {
    // Close sidebar on mobile when link is clicked
    if (window.innerWidth < 768 && onCloseSidebar) {
      onCloseSidebar();
    }
  };

  return (
    <div
      className={clsx(
        "h-full bg-gradient-to-b from-gray-800 to-pink-200 text-white overflow-hidden transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-0"
      )}
      style={{
        minWidth: isOpen ? "16rem" : "0",
        padding: isOpen ? "1rem" : "0",
      }}
    >
      {isOpen && (
        <>
          <h2 className="text-xl font-bold mb-4">User Dashboard</h2>
          <ul className="space-y-2 mt-10">
            {menuItems.map((item) => {
              const Icon = iconMap[item.icon] || null;

              // 🔹 If item has children → submenu
              if (item.children) {
                const isSubOpen = openMenus[item.name];
                return (
                  <li key={item.name} className="m-2">
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className="flex items-center gap-2 w-full hover:underline pl-2"
                    >
                      {Icon && <Icon size={20} />}
                      <span>{item.name}</span>
                      {isSubOpen ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>

                    {isSubOpen && (
                      <ul className="ml-6 mt-2 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = iconMap[child.icon] || null;
                          return (
                            <li
                              key={child.path}
                              className="flex items-center gap-2"
                            >
                              {ChildIcon && <ChildIcon size={16} />}
                              <Link
                                href={child.path}
                                className="hover:underline text-sm"
                                onClick={handleLinkClick}
                              >
                                {child.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              }

              // 🔹 Normal single item
              return (
                <li key={item.path} className="flex items-center gap-2 m-4">
                  {Icon && <Icon size={20} />}
                  <Link 
                    href={item.path} 
                    className="hover:underline"
                    onClick={handleLinkClick}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
