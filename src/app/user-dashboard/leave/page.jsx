"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";

export default function LeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: "unpaid",
    from_date: "",
    to_date: "",
    start_time: "",
    end_time: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [specifyTimes, setSpecifyTimes] = useState(false);

  useEffect(() => {
    fetchLeaves();
    fetchStats();
  }, []);

  const fetchLeaves = async () => {
    try {
      const response = await fetch("/api/empcrm/leaves");
      const data = await response.json();
      if (data.success) setLeaves(data.leaves);
    } catch (error) {
      console.error("Error fetching leaves:", error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/empcrm/leaves/stats");
      const data = await response.json();
      if (data.success) {
        setStats(data);
        const enabledLeaves = data.leaveSummary?.filter((l) => l.enabled && l.available > 0) || [];
        if (enabledLeaves.length > 0) {
          setFormData((prev) => ({ ...prev, leave_type: enabledLeaves[0].type }));
        }
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leave_type || !formData.from_date || !formData.to_date || !formData.reason.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);
      
      // Build from_date with start_time (if toggle is on)
      let fromDateTime = formData.from_date;
      if (specifyTimes && formData.start_time) {
        fromDateTime = `${formData.from_date}T${formData.start_time}:00`;
      }

      // Build to_date with end_time (if toggle is on)
      let toDateTime = formData.to_date;
      if (specifyTimes && formData.end_time) {
        toDateTime = `${formData.to_date}T${formData.end_time}:00`;
      }

      const response = await fetch("/api/empcrm/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_type: formData.leave_type,
          from_date: fromDateTime,
          to_date: toDateTime,
          reason: formData.reason,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Leave application submitted successfully");
        setShowApplicationForm(false);
        const enabledLeaves = stats?.leaveSummary?.filter((l) => l.enabled && l.available > 0) || [];
        setFormData({
          leave_type: enabledLeaves[0]?.type || "unpaid",
          from_date: "",
          to_date: "",
          start_time: "",
          end_time: "",
          reason: "",
        });
        setSpecifyTimes(false);
        fetchLeaves();
        fetchStats();
      } else {
        alert(data.error || "Failed to submit leave application");
      }
    } catch (error) {
      console.error("Error submitting leave:", error);
      alert("Error submitting leave application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (leaveId) => {
    if (!confirm("Are you sure you want to delete this leave application?")) return;
    try {
      const response = await fetch(`/api/empcrm/leaves?id=${leaveId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        alert("Leave application deleted successfully");
        fetchLeaves();
        fetchStats();
      } else {
        alert(data.error || "Failed to delete leave");
      }
    } catch (error) {
      console.error("Error deleting leave:", error);
      alert("Error deleting leave");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      approved: "bg-green-100 text-green-800 border-green-300",
      rejected: "bg-red-100 text-red-800 border-red-300",
    };
    const icons = {
      pending: <Clock className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || ""}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      sick: "bg-blue-100 text-blue-800",
      paid: "bg-purple-100 text-purple-800",
      casual: "bg-green-100 text-green-800",
      unpaid: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalDays =
    formData.from_date && formData.to_date
      ? Math.max(
          0,
          Math.ceil(
            (new Date(formData.to_date) - new Date(formData.from_date)) /
              (1000 * 60 * 60 * 24)
          ) + 1
        )
      : 0;

  return (
    <div className="px-3 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 shrink-0" />
            My Leave Applications
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage your leave requests and view balance</p>
        </div>
        <button
          onClick={() => setShowApplicationForm(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Apply for Leave
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading statistics…</div>
      ) : stats && (
        <div className="mb-6">
          {/* Employment status badge */}
          <div className="mb-4">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                stats.employment_status === "permanent"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              Employment Status:{" "}
              {stats.employment_status === "permanent" ? "Permanent" : "Probation"}
            </span>
          </div>

          {/* Leave balance cards — 1 col mobile, 2 col sm, 3 col md+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.leaveSummary.map((leave) => {
              if (!leave.enabled) return null;
              const utilizationPercent =
                leave.allowed > 0
                  ? Math.min(100, ((leave.taken / leave.allowed) * 100).toFixed(0))
                  : 0;
              return (
                <div
                  key={leave.type}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-800 capitalize">
                      {leave.type} Leave
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.type)}`}
                    >
                      {leave.type}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Allowed</span>
                      <span className="text-base font-bold text-gray-900">{leave.allowed} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />Taken
                      </span>
                      <span className="text-base font-bold text-red-600">{leave.taken} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-green-400" />Available
                      </span>
                      <span className="text-base font-bold text-green-600">{leave.available} days</span>
                    </div>
                    {leave.pending > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-sm text-yellow-600 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />Pending
                        </span>
                        <span className="text-sm font-semibold text-yellow-600">{leave.pending} days</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Utilization</span>
                        <span>{utilizationPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            utilizationPercent > 80
                              ? "bg-red-500"
                              : utilizationPercent > 50
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${utilizationPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Unpaid leave card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-800">Unpaid Leave</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  unpaid
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">No limit — always available</p>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm text-gray-500">Taken this year</span>
                  <span className="text-base font-bold text-gray-900">
                    {stats.unpaidLeaves.taken} days
                  </span>
                </div>
                {stats.unpaidLeaves.pending > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm text-yellow-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />Pending
                    </span>
                    <span className="text-sm font-semibold text-yellow-600">
                      {stats.unpaidLeaves.pending} days
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave History ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Leave History</h2>

        {leaves.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No leave applications found</p>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Leave Type", "From", "To", "Days", "Reason", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.leave_type)}`}>
                          {leave.leave_type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{formatDate(leave.from_date)}</td>
                      <td className="px-3 py-3 text-gray-700">{formatDate(leave.to_date)}</td>
                      <td className="px-3 py-3 text-gray-700">{leave.total_days ?? leave.days}</td>
                      <td className="px-3 py-3 text-gray-700 max-w-[180px] truncate">{leave.reason}</td>
                      <td className="px-3 py-3">{getStatusBadge(leave.status)}</td>
                      <td className="px-3 py-3">
                        {leave.status === "pending" && (
                          <button
                            onClick={() => handleDelete(leave.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards — visible only on mobile */}
            <div className="sm:hidden space-y-3">
              {leaves.map((leave) => (
                <div
                  key={leave.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.leave_type)}`}>
                      {leave.leave_type}
                    </span>
                    {getStatusBadge(leave.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">From</p>
                      <p className="font-medium text-gray-700">{formatDate(leave.from_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">To</p>
                      <p className="font-medium text-gray-700">{formatDate(leave.to_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Days</p>
                      <p className="font-medium text-gray-700">{leave.total_days ?? leave.days}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Reason</p>
                    <p className="text-sm text-gray-700">{leave.reason}</p>
                  </div>
                  {leave.status === "pending" && (
                    <button
                      onClick={() => handleDelete(leave.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Apply for Leave Modal ───────────────────────────────────────── */}
      {showApplicationForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowApplicationForm(false)}
          />
          {/* Sheet — slides up on mobile, centered modal on sm+ */}
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 max-h-[95dvh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-800">Apply for Leave</h2>
              <button
                type="button"
                onClick={() => setShowApplicationForm(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {/* Leave type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {stats?.leaveSummary?.filter((l) => l.enabled).map((leave) => (
                    <option key={leave.type} value={leave.type}>
                      {leave.type.charAt(0).toUpperCase() + leave.type.slice(1)} (Available: {leave.available})
                    </option>
                  ))}
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={formData.from_date}
                    onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={formData.to_date}
                    onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {totalDays > 0 && (
                <p className="text-sm text-blue-600 font-medium">
                  Total: {totalDays} day{totalDays > 1 ? "s" : ""}
                </p>
              )}

              {/* Toggle for Start/End Time */}
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                <label className="text-sm font-medium text-gray-700">Specify Start & End Time</label>
                <button
                  type="button"
                  onClick={() => setSpecifyTimes(!specifyTimes)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    specifyTimes ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      specifyTimes ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Start and End Time - Only show when toggle is ON */}
              {specifyTimes && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1 pb-2">
                <button
                  type="button"
                  onClick={() => setShowApplicationForm(false)}
                  className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
