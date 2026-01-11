"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Modal from "./Modal";

export default function ServiceTable({ serviceRecords, role }) {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus.toUpperCase());

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // Helper: format dates safely
  const formatDate = (value) => {
    if (!value) return "";
    if (value instanceof Date) return value.toDateString();
    if (!isNaN(Date.parse(value))) return new Date(value).toDateString();
    return value;
  };

  // Sort logic
  const sortedRecords = [...serviceRecords].sort((a, b) => {
    if (sortConfig.key !== null) {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  // Universal search across all fields
  const filteredRecords = sortedRecords.filter((record) => {
    if (!searchTerm.trim()) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return Object.values(record).some((value) =>
      value?.toString().toLowerCase().includes(lowerSearch)
    );
  });

  // Deduplicate by service_id first
  const uniqueRecords = Array.from(
    new Map(filteredRecords.map((r) => [r.service_id, r])).values()
  );

  // Then filter by status
  const filteredByStatus = uniqueRecords.filter((record) =>
    statusFilter ? record.status?.toUpperCase() === statusFilter : true
  );

  // Handlers
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? (
      <span className="ml-1">▲</span>
    ) : (
      <span className="ml-1">▼</span>
    );
  };

  const openDetailsModal = (record) => {
    setSelectedService(record);
    setIsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsModalOpen(false);
    setSelectedService(null);
  };

  const handleResetSearch = () => {
    setSearchTerm("");
  };

  return (
    <div className="flex justify-center items-center bg-gray-50 py-6 px-4">
      <div className="bg-white shadow-xl rounded-lg w-full overflow-hidden">
        {/* Search + Reset */}
        <div className="px-4 py-4 flex gap-2">
          <input
            type="text"
            placeholder="Search records..."
            className="p-3 w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={handleResetSearch}
            className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 px-4">
          {["COMPLETED", "PENDING FOR SPARES", "PENDING"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium text-white transition-colors duration-200 ${
                statusFilter === status
                  ? "bg-blue-600"
                  : status === "COMPLETED"
                  ? "bg-green-500 hover:bg-green-600"
                  : status === "PENDING FOR SPARES"
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {status}
            </button>
          ))}
          {statusFilter && (
            <button
              onClick={() => setStatusFilter("")}
              className="px-4 py-2 rounded-lg bg-gray-400 text-white hover:bg-gray-500 transition-colors duration-200"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Table (visible on larger screens) */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="min-w-full table-fixed text-sm text-gray-700">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th
                  onClick={() => handleSort("service_id")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Service ID {getSortIndicator("service_id")}
                </th>
                <th
                  onClick={() => handleSort("complaint_date")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Complaint Date {getSortIndicator("complaint_date")}
                </th>
                <th
                  onClick={() => handleSort("complaint_summary")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Complaint Summary {getSortIndicator("complaint_summary")}
                </th>
                <th
                  onClick={() => handleSort("installed_address")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Installed Address {getSortIndicator("installed_address")}
                </th>
                <th
                  onClick={() => handleSort("assigned_to")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Assign To {getSortIndicator("assigned_to")}
                </th>
                <th
                  onClick={() => handleSort("service_type")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Service Type {getSortIndicator("service_type")}
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Status {getSortIndicator("status")}
                </th>
                <th
                  onClick={() => handleSort("completed_date")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Complete Date {getSortIndicator("completed_date")}
                </th>
                {role === "ADMIN" && (
                  <th className="px-6 py-3 text-left">Company Cost</th>
                )}
                <th className="px-6 py-3 text-left text-sm font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredByStatus.length === 0 ? (
                <tr>
                  <td
                    colSpan={role === "ADMIN" ? 10 : 9}
                    className="px-6 py-3 text-center text-gray-500"
                  >
                    No service records found.
                  </td>
                </tr>
              ) : (
                filteredByStatus.map((record) => {
                  const hasReport = record.attachments;
                  let rowBackgroundColor = "";
                  if (record.status?.toUpperCase() === "COMPLETED")
                    rowBackgroundColor = "bg-green-50";
                  else if (
                    record.status?.toUpperCase() === "PENDING FOR SPARES"
                  )
                    rowBackgroundColor = "bg-orange-100";

                  return (
                    <tr
                      key={record.service_id}
                      className={`hover:bg-blue-50 transition-all duration-200 ${rowBackgroundColor}`}
                    >
                      <td className="px-6 py-3">{record.service_id}</td>
                      <td className="px-6 py-3">
                        {formatDate(record.complaint_date)}
                      </td>
                      <td className="px-6 py-3">{record.complaint_summary}</td>
                      <td className="px-6 py-3">{record.installed_address}</td>
                      <td className="px-6 py-3">{record.assigned_to}</td>
                      <td className="px-6 py-3">{record.service_type}</td>
                      <td className="px-6 py-3">{record.status}</td>
                      <td className="px-6 py-3">
                        {formatDate(record.completed_date)}
                      </td>

                      {role === "ADMIN" && (
                        <td className="px-6 py-3">
                          {record.company_cost ? (
                            record.company_cost
                          ) : (
                            <Link
                              href={`/user-dashboard/warranty/service-records/cost/${record.service_id}`}
                              className="inline-block px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                            >
                              Update Cost
                            </Link>
                          )}
                        </td>
                      )}

                      <td className="px-6 py-3 text-right text-sm font-medium">
                        <div className="flex flex-col space-y-2">
                          {record.status?.toUpperCase() !== "COMPLETED" ? (
                            <>
                              {role === "ADMIN" && (
                                <Link
                                  href={`/user-dashboard/assign-service/${record.service_id}`}
                                  className="inline-block px-3 py-1 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-center"
                                >
                                  Assign
                                </Link>
                              )}
                              <Link
                                href={`/user-dashboard/complete-service/${record.service_id}`}
                                className="inline-block px-3 py-1 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 text-center"
                              >
                                Complete Service
                              </Link>
                            </>
                          ) : record.final_report_path ? (
                            <a
                              href={record.final_report_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                            >
                              View Report
                            </a>
                          ) : (
                            <a
                              href={`/user-dashboard/view-service-report/${record.service_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                            >
                              View Report
                            </a>
                          )}
                          {(record.status?.toUpperCase() ===
                            "PENDING FOR SPARES" 
                            || record.status?.toUpperCase() === "COMPLETED"
                            )
                             && (
                            <Link
                              href={
                                record.quote_id
                                  ? `/user-dashboard/quotations/${record.quote_id}`
                                  : {
                                      pathname:
                                        "/user-dashboard/quotations/new",
                                      query: {
                                        serviceId: record.service_id,
                                        serialNumber: record.serial_number,
                                      },
                                    }
                              }
                              className="inline-block px-2 py-1 text-xs bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-center"
                            >
                              {" "}
                              {record.quote_id ? "View Quote" : "Quotation"}   {" "}
                            </Link>
                          )}
                          <button
                            onClick={() => openDetailsModal(record)}
                            className="inline-block px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 text-center"
                          >
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card view (visible on small screens) */}
        <div className="md:hidden p-4 space-y-4">
          {filteredByStatus.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No service records found.
            </div>
          ) : (
            filteredByStatus.map((record) => {
              const hasReport = record.attachments;
              let cardBackgroundColor = "";
              if (record.status?.toUpperCase() === "COMPLETED")
                cardBackgroundColor = "bg-green-50";
              else if (record.status?.toUpperCase() === "PENDING FOR SPARES")
                cardBackgroundColor = "bg-orange-100";

              return (
                <div
                  key={record.service_id}
                  className={`bg-white shadow-md rounded-lg p-4 space-y-2 ${cardBackgroundColor}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-blue-600">
                      Service ID: {record.service_id}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        record.status?.toUpperCase() === "COMPLETED"
                          ? "bg-green-200 text-green-800"
                          : record.status?.toUpperCase() ===
                            "PENDING FOR SPARES"
                          ? "bg-orange-200 text-orange-800"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {record.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Complaint Date:
                      </span>{" "}
                      {formatDate(record.complaint_date)}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Assigned To:
                      </span>{" "}
                      {record.assigned_to}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Service Type:
                      </span>{" "}
                      {record.service_type}
                    </p>
                  </div>
                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Summary:
                      </span>{" "}
                      {record.complaint_summary}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Address:
                      </span>{" "}
                      {record.installed_address}
                    </p>
                  </div>
                  {role === "ADMIN" && (
                    <div className="border-t border-gray-200 pt-2">
                      <p className="text-gray-500">
                        <span className="font-semibold text-gray-700">
                          Company Cost:
                        </span>{" "}
                        {record.company_cost ? (
                          record.company_cost
                        ) : (
                          <Link
                            href={`/user-dashboard/warranty/service-records/cost/${record.service_id}`}
                            className="inline-block px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                          >
                            Update Cost
                          </Link>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col space-y-2 mt-4">
                    {record.status?.toUpperCase() !== "COMPLETED" ? (
                      <>
                        {role === "ADMIN" && (
                          <Link
                            href={`/user-dashboard/assign-service/${record.service_id}`}
                            className="px-3 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-center"
                          >
                            Assign
                          </Link>
                        )}
                        <Link
                          href={`/user-dashboard/complete-service/${record.service_id}`}
                          className="px-3 py-2 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 text-center"
                        >
                          Complete Service
                        </Link>
                      </>
                    ) : record.final_report_path ? (
                      <a
                        href={record.final_report_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View Report
                      </a>
                    ) : (
                      <a
                        href={`/user-dashboard/view-service-report/${record.service_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                      >
                        View Report
                      </a>
                    )}
                    {(record.status?.toUpperCase() === "PENDING FOR SPARES" ||
                      record.status?.toUpperCase() === "COMPLETED") && (
                      <Link
                        href={
                          record.quote_id
                            ? `/user-dashboard/quotations/${record.quote_id}`
                            : {
                                pathname: "/user-dashboard/quotations/new",
                                query: {
                                  serviceId: record.service_id,
                                  serialNumber: record.serial_number,
                                },
                              }
                        }
                        className="inline-block px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-center"
                      >
                        {" "}
                        {record.quote_id ? "View Quotationss" : "Quotation"}   {" "}
                      </Link>
                    )}
                    <button
                      onClick={() => openDetailsModal(record)}
                      className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 text-center"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeDetailsModal}
        title={`Service Details (ID: ${selectedService?.service_id})`}
        selectedService={selectedService}
        baseUrl={baseUrl}
      />
    </div>
  );
}
