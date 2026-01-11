"use client";
import Link from "next/link";
import {
  FileText,
  UploadCloud,
  FileCheck,
  ClipboardList,
  Search,
} from "lucide-react";
import { useState, useEffect } from "react";
import dayjs from "dayjs";

// Note: You need to install dayjs: `npm install dayjs` or `yarn add dayjs`

// 👻 A sleek skeleton loader for a modern feel
const SkeletonLoader = () => (
  <div className="animate-pulse space-y-4">
    {/* Search bar skeleton */}
    <div className="h-10 bg-gray-200 rounded-lg w-full mb-6"></div>

    {/* Desktop table skeleton */}
    <div className="hidden lg:block overflow-x-auto">
      <div className="bg-gray-200 h-12 rounded-t-lg"></div>
      <div className="border border-gray-200 rounded-b-lg p-4 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    </div>

    {/* Mobile card skeleton */}
    <div className="lg:hidden space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-gray-100 border rounded-xl shadow-sm p-4 space-y-2"
        >
          <div className="h-6 bg-gray-200 w-3/4 rounded"></div>
          <div className="h-4 bg-gray-200 w-1/2 rounded"></div>
          <div className="h-4 bg-gray-200 w-2/3 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

export default function OrderTable({ orders, userRole }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);

  // Filter orders based on the search query
  useEffect(() => {
    if (!orders) return; // Wait until orders data is available

    const lowercasedQuery = searchQuery.toLowerCase();
    const result = orders.filter((order) => {
      // Search across multiple fields
      return (
        order.order_id?.toLowerCase().includes(lowercasedQuery) ||
        order.client_name?.toLowerCase().includes(lowercasedQuery) ||
        order.company_name?.toLowerCase().includes(lowercasedQuery) ||
        order.contact?.toLowerCase().includes(lowercasedQuery) ||
        order.state?.toLowerCase().includes(lowercasedQuery)
      );
    });
    setFilteredOrders(result);
  }, [searchQuery, orders]);

  if (!orders) {
    return <SkeletonLoader />;
  }

  if (orders.length === 0)
    return <p className="text-gray-600">No orders submitted yet.</p>;

  return (
    <div className="space-y-6">
      {/* 🔍 Sleek Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search size={20} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by ID, client, company, etc."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out"
        />
      </div>

      {/* 👨‍💼 TABLE VIEW for large screens */}
      <div className="hidden lg:block overflow-x-auto bg-white rounded-xl shadow-lg">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-3 py-3 font-semibold text-center">#</th>
              <th className="px-3 py-3 font-semibold text-left">Order ID</th>
              <th className="px-3 py-3 font-semibold text-left">Client Name</th>
              <th className="px-3 py-3 font-semibold text-left">Company</th>
              <th className="px-3 py-3 font-semibold text-left">Contact</th>
              <th className="px-3 py-3 font-semibold text-left">Location</th>
              <th className="px-3 py-3 font-semibold text-left">Date</th>
              <th className="px-3 py-3 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((r, i) => (
                <tr
                  key={r.order_id}
                  className="hover:bg-gray-50 text-center whitespace-nowrap transition-colors duration-150"
                >
                  <td className="px-3 py-3">{i + 1}</td>
                  <td className="px-3 py-3 font-medium text-gray-800">
                    {r.order_id}
                  </td>
                  <td className="px-3 py-3 text-left">{r.client_name}</td>
                  <td className="px-3 py-3 text-left">{r.company_name}</td>
                  <td className="px-3 py-3 text-left">{r.contact}</td>
                  <td className="px-3 py-3 text-left">{r.state}</td>
                  <td className="px-3 py-3 text-left">
                    {dayjs(r.created_at).format("DD/MM/YYYY")}
                  </td>
                  <td className="px-3 py-3 space-x-2 flex items-center justify-center">
                    <ActionButtons r={r} userRole={userRole} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📱 CARD VIEW for mobile */}
      <div className="lg:hidden space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((r, i) => (
            <div
              key={r.order_id}
              className="bg-white border border-gray-200 rounded-xl shadow-md p-4 space-y-2 text-sm"
            >
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs">#{i + 1}</span>
                <span className="font-medium text-gray-800">
                  {dayjs(r.created_at).format("DD/MM/YYYY")}
                </span>
              </div>
              <div className="font-semibold text-lg text-gray-900">
                Order ID: {r.order_id}
              </div>
              <div>
                <strong>Client:</strong> {r.client_name}
              </div>
              <div>
                <strong>Company:</strong> {r.company_name}
              </div>
              <div>
                <strong>Contact:</strong> {r.contact}
              </div>
              <div>
                <strong>Location:</strong> {r.state}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 mt-2">
                <ActionButtons r={r} userRole={userRole} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500">No orders found.</p>
        )}
      </div>
    </div>
  );
}

// 🔘 Modular Action Buttons (used in both views)
function ActionButtons({ r, userRole }) {
  return (
    <>
      <Link
        href={`/user-dashboard/order/${r.order_id}`}
        title="View Sales"
        className="inline-flex items-center justify-center p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-150"
      >
        <ClipboardList size={18} />
      </Link>
    </>
  );
}
