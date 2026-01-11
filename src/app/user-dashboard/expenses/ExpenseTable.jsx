"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useState } from "react";
import { Eye, CreditCard } from "lucide-react";
import Modal from "./Model";

export default function ExpenseTable({ rows, role }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  // Filter rows based on the search query, from date, and to date
  const filteredRows = rows.filter((row) => {
    const totalCost =
      Number(row.TicketCost || 0) +
      Number(row.HotelCost || 0) +
      Number(row.MealsCost || 0) +
      Number(row.OtherExpenses || 0);

    const formattedDate = dayjs(row.TravelDate).format("DD MMM YYYY");

    // Check if any field matches the search query
    const matchesSearch =
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      formattedDate.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDateRange =
      (!fromDate || dayjs(row.TravelDate).isAfter(dayjs(fromDate))) &&
      (!toDate || dayjs(row.TravelDate).isBefore(dayjs(toDate)));

    return matchesSearch && matchesDateRange;
  });

  // Reset all filters
  const handleReset = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRow(null);
  };

  const handlePaymentSuccess = () => {
    // You can update state or fetch the rows again to reflect the change in the table.
    // Example: setRows(updatedRows);
    closeModal(); // Close the modal
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Search anything..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto"
        />
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-300 rounded-lg text-sm cursor-pointer w-full sm:w-auto"
        >
          Reset
        </button>
      </div>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-auto bg-white shadow rounded-lg">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr className="text-left font-semibold text-gray-700">
              <th className="p-3">ID</th>
              <th className="p-3">Date</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Total</th>
              <th className="p-3">Approved Amt</th>
              <th className="p-3">Payment Date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 divide-y divide-gray-200">
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const totalCost =
                  Number(row.TicketCost || 0) +
                  Number(row.HotelCost || 0) +
                  Number(row.MealsCost || 0) +
                  Number(row.OtherExpenses || 0);

                return (
                  <tr key={row.ID}>
                    <td className="p-3">{row.ID}</td>
                    <td className="p-3">
                      {row.TravelDate
                        ? dayjs(row.TravelDate).format("DD MMM YYYY")
                        : "-"}
                    </td>
                    <td className="p-3">{row.FromLocation}</td>
                    <td className="p-3">{row.Tolocation}</td>
                    <td className="p-3">₹{totalCost.toFixed(2)}</td>
                    <td className="p-3">
                      {Number(row.approved_amount) > 0
                        ? `₹${Number(row.approved_amount).toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="p-3">
                      {row.payment_date && row.payment_date !== "0000-00-00"
                        ? dayjs(row.payment_date).format("DD MMM YYYY")
                        : "-"}
                    </td>
                    <td className="p-3">{row.approval_status}</td>
                    <td className="p-3 flex gap-2 items-center">
                      <Link
                        href={`/user-dashboard/expenses/${row.ID}`}
                        className="text-blue-600 hover:underline"
                      >
                        <Eye size={16} />
                      </Link>
                      {(role === "ACCOUNTANT" || role === "ADMIN") && (
                        <button
                          onClick={() => {
                            if (row.approval_status !== "Approved") {
                              alert("Please Approve the expense first");
                              return; // Stop execution here
                            }
                            setSelectedRow(row); // Store the selected row
                            setIsModalOpen(true); // Open the modal
                          }}
                          className="text-green-600 hover:text-green-800 cursor-pointer"
                        >
                          <CreditCard size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="p-4 text-center text-gray-500">
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {filteredRows.length === 0 && (
          <div className="text-center text-gray-500">No entries found.</div>
        )}

        {filteredRows.map((row) => {
          const totalCost =
            Number(row.TicketCost || 0) +
            Number(row.HotelCost || 0) +
            Number(row.MealsCost || 0) +
            Number(row.OtherExpenses || 0);

          return (
            <div
              key={row.ID}
              className="border rounded-lg p-4 shadow-sm bg-white text-sm space-y-1"
            >
              <div>
                <strong>ID:</strong> {row.ID}
              </div>
              <div>
                <strong>Date:</strong>{" "}
                {row.TravelDate
                  ? dayjs(row.TravelDate).format("DD MMM YYYY")
                  : "-"}
              </div>
              <div>
                <strong>From:</strong> {row.FromLocation}
              </div>
              <div>
                <strong>To:</strong> {row.Tolocation}
              </div>
              <div>
                <strong>Total:</strong> ₹{totalCost.toFixed(2)}
              </div>
              <div>
                <strong>Approved Amt:</strong>{" "}
                {Number(row.approved_amount) > 0
                  ? `₹${Number(row.approved_amount).toFixed(2)}`
                  : "-"}
              </div>
              <div>
                <strong>Payment Date:</strong>{" "}
                {row.payment_date && row.payment_date !== "0000-00-00"
                  ? dayjs(row.payment_date).format("DD MMM YYYY")
                  : "-"}
              </div>
              <div>
                <strong>Status:</strong> {row.approval_status}
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Link
                  href={`/user-dashboard/expenses/${row.ID}`}
                  className="text-blue-600 hover:underline"
                >
                  <Eye size={16} />
                </Link>
                {(role === "ACCOUNTANT" || role === "ADMIN") && (
                  <button
                    onClick={() => {
                      if (row.approval_status !== "Approved") {
                        alert("Please Approve the expense first");
                        return; // Stop execution here
                      }
                      setSelectedRow(row); // Store the selected row
                      setIsModalOpen(true); // Open the modal
                    }}
                    className="text-green-600 hover:text-green-800 cursor-pointer"
                  >
                    <CreditCard size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        closeModal={closeModal}
        row={selectedRow}
        role={role}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
