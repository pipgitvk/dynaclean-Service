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
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLeaves();
    fetchStats();
  }, []);

  const fetchLeaves = async () => {
    try {
      const response = await fetch("/api/empcrm/leaves");
      const data = await response.json();
      if (data.success) {
        setLeaves(data.leaves);
      }
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
      alert("Please fill in all fields");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/empcrm/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (data.success) {
        alert("Leave application submitted successfully");
        setShowApplicationForm(false);
        const enabledLeaves = stats?.leaveSummary?.filter((l) => l.enabled && l.available > 0) || [];
        const defaultLeaveType = enabledLeaves.length > 0 ? enabledLeaves[0].type : "unpaid";
        setFormData({
          leave_type: defaultLeaveType,
          from_date: "",
          to_date: "",
          reason: "",
        });
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
    if (!confirm("Are you sure you want to delete this leave application?")) {
      return;
    }
    try {
      const response = await fetch(`/api/empcrm/leaves?id=${leaveId}`, {
        method: "DELETE",
      });
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
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
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

  const calculateTotalDays = () => {
    if (formData.from_date && formData.to_date) {
      const from = new Date(formData.from_date);
      const to = new Date(formData.to_date);
      const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  };

  const totalDays = calculateTotalDays();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            My Leave Applications
          </h1>
          <p className="text-gray-600 mt-2">Manage your leave requests and view balance</p>
        </div>
        <button
          onClick={() => setShowApplicationForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Apply for Leave
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading statistics...</div>
      ) : stats && (
        <div>
          <div className="mb-4">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${stats.employment_status === "permanent" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}`}>
              Employment Status: {stats.employment_status === "permanent" ? "Permanent" : "Probation"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.leaveSummary.map((leave) => {
              if (!leave.enabled) return null;
              const utilizationPercent = leave.allowed > 0 ? ((leave.taken / leave.allowed) * 100).toFixed(0) : 0;
              return (
                <div key={leave.type} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 capitalize">{leave.type} Leave</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.type)}`}>{leave.type}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Allowed</span>
                      <span className="text-lg font-bold text-gray-900">{leave.allowed} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />Taken
                      </span>
                      <span className="text-lg font-bold text-red-600">{leave.taken} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />Available
                      </span>
                      <span className="text-lg font-bold text-green-600">{leave.available} days</span>
                    </div>
                    {leave.pending > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-sm text-yellow-600 flex items-center gap-1">
                          <Clock className="w-4 h-4" />Pending
                        </span>
                        <span className="text-sm font-semibold text-yellow-600">{leave.pending} days</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Utilization</span>
                        <span>{utilizationPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${utilizationPercent > 80 ? "bg-red-500" : utilizationPercent > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Unpaid Leave</h3>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">unpaid</span>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">No limit - always available</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-gray-600">Taken this year</span>
                  <span className="text-lg font-bold text-gray-900">{stats.unpaidLeaves.taken} days</span>
                </div>
                {stats.unpaidLeaves.pending > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm text-yellow-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />Pending
                    </span>
                    <span className="text-sm font-semibold text-yellow-600">{stats.unpaidLeaves.pending} days</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Leave History</h2>
        {leaves.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No leave applications found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.leave_type)}`}>
                        {leave.leave_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(leave.from_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(leave.to_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{leave.days}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{leave.reason}</td>
                    <td className="px-4 py-3">{getStatusBadge(leave.status)}</td>
                    <td className="px-4 py-3">
                      {leave.status === "pending" && (
                        <button
                          onClick={() => handleDelete(leave.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
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
        )}
      </div>

      {showApplicationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Apply for Leave</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {stats?.leaveSummary?.filter((l) => l.enabled).map((leave) => (
                    <option key={leave.type} value={leave.type}>
                      {leave.type.charAt(0).toUpperCase() + leave.type.slice(1)} (Available: {leave.available})
                    </option>
                  ))}
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={formData.from_date}
                    onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={formData.to_date}
                    onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              {totalDays > 0 && (
                <p className="mb-4 text-sm text-gray-600">Total days: {totalDays}</p>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowApplicationForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}