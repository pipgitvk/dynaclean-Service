"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
  import {
    DEFAULT_ATTENDANCE_RULES,
    getCheckinStatus as checkinStatusFromRules,
    getCheckoutStatus as checkoutStatusFromRules,
    getBreakStatus as breakStatusFromRules,
    isHalfDayByRules,
    classifyAttendanceDay,
    parseTimeToMinutes,
    isMissingCheckoutTime,
  } from "@/lib/attendanceRulesEngine";
  import { 
    formatAttendanceTimeForDisplay as formatTime,
    parseAttendanceClockMinutes,
  } from "@/lib/istDateTime";
import AttendanceRegularizeModal from "./AttendanceRegularizeModal";
import { useUser } from "@/context/UserContext";
import { Calendar, Filter, RefreshCw, Info, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

const AttendancePage = () => {
  const { user } = useUser();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Default to current month 1st to 30th/last day
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [rules, setRules] = useState(DEFAULT_ATTENDANCE_RULES);
  const [myRegRequests, setMyRegRequests] = useState([]);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regModalLog, setRegModalLog] = useState(null);
  const [regModalDateKey, setRegModalDateKey] = useState("");

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const [response, rulesRes] = await Promise.all([
        fetch("/api/empcrm/attendance/fetch"),
        fetch("/api/empcrm/attendance-rules"),
      ]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to fetch attendance logs.");
      }

      const data = await response.json();
      setLogs(data.attendance || []);
      setHolidays(data.holidays || []);
      setLeaves(data.leaves || []);

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json().catch(() => ({}));
        if (rulesData.rules) setRules(rulesData.rules);
      }
    } catch (err) {
      toast.error(err.message);
      setLogs([]);
      setHolidays([]);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshRegularization = useCallback(async () => {
    try {
      const res = await fetch("/api/empcrm/attendance/regularization?scope=mine");
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.success) setMyRegRequests(d.requests || []);
      }
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, []);

  useEffect(() => {
    if (!loading) refreshRegularization();
  }, [loading, refreshRegularization]);

  const logDateKeyForReg = (log) =>
    log?.date ? new Date(log.date).toLocaleDateString("en-CA") : "";

  const pendingRegByDate = useMemo(() => {
    const m = new Map();
    for (const r of myRegRequests) {
      if (r.status !== "pending") continue;
      let k = r.log_date;
      if (k == null) continue;
      if (typeof k === "string") k = k.slice(0, 10);
      else if (k instanceof Date) k = k.toISOString().slice(0, 10);
      else k = String(k).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) m.set(k, r);
    }
    return m;
  }, [myRegRequests]);

  const openRegularizeModal = (log) => {
    setRegModalLog(log);
    setRegModalDateKey(logDateKeyForReg(log));
    setRegModalOpen(true);
  };

  const getCheckinStatus = (logTime) => checkinStatusFromRules(logTime, rules);
  const getCheckoutStatus = (logTime) => checkoutStatusFromRules(logTime, rules);

  const getCheckinColorClass = (logTime) => {
    if (!logTime) return "text-gray-500";
    const logM = parseAttendanceClockMinutes(logTime);
    if (logM == null) return "text-gray-500";
    
    const standardM = parseTimeToMinutes(rules.checkin);
    const veryLateM = standardM + 15;

    if (logM <= standardM) return "text-green-600 font-bold";
    if (logM <= veryLateM) return "text-yellow-600 font-bold";
    return "text-red-600 font-bold";
  };

  const getRowColorClass = (log) => {
    if (log.type === "absent") return "bg-red-100/50";
    if (log.type === "holiday") return "bg-purple-50";
    if (log.type === "sunday") return "bg-gray-50";
    if (log.type === "leave") return "bg-blue-50";
    
    if (log.type === "present") {
      const logTime = log.checkin_time;
      if (!logTime) return "bg-orange-50"; // No check-in

      if (isMissingCheckoutTime(log)) {
        return "bg-yellow-100/50";
      }

      const logM = parseAttendanceClockMinutes(logTime);
      if (logM == null) return "bg-orange-50";
      
      const standardM = parseTimeToMinutes(rules.checkin);
      const veryLateM = standardM + 15;

      if (logM <= standardM) return "bg-green-100/50";
      if (logM <= veryLateM) return "bg-yellow-100/50";
      return "bg-red-100/50";
    }
    return "";
  };

  const allDates = useMemo(() => {
    const dates = [];
    const endDate = toDate ? new Date(toDate) : new Date();
    endDate.setHours(0, 0, 0, 0);

    let startDate;
    if (fromDate) {
      startDate = new Date(fromDate);
    } else if (logs.length > 0) {
      startDate = new Date(logs[logs.length - 1].date);
    } else {
      startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);
    }
    startDate.setHours(0, 0, 0, 0);

    const dateMap = new Map(
      logs.map((log) => [new Date(log.date).toLocaleDateString("en-CA"), log])
    );
    const holidayMap = new Map(
      holidays.map((h) => [new Date(h.holiday_date).toLocaleDateString("en-CA"), h])
    );
    const leaveMap = new Map();
    leaves.forEach((leave) => {
      const start = new Date(leave.from_date);
      const end = new Date(leave.to_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        leaveMap.set(d.toLocaleDateString("en-CA"), leave);
      }
    });

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateString = d.toLocaleDateString("en-CA");
      const existingLog = dateMap.get(dateString);
      const isWeekend = d.getDay() === 0;
      const holiday = holidayMap.get(dateString);
      const leave = leaveMap.get(dateString);

      if (existingLog) {
        dates.push({ ...existingLog, type: "present" });
      } else if (isWeekend) {
        dates.push({ date: d.toISOString(), type: "sunday", holidayTitle: "Sunday" });
      } else if (holiday) {
        dates.push({ date: d.toISOString(), type: "holiday", holidayTitle: holiday.title });
      } else if (leave) {
        dates.push({ date: d.toISOString(), type: "leave", leaveType: leave.leave_type });
      } else {
        dates.push({ date: d.toISOString(), type: "absent" });
      }
    }
    return dates.reverse();
  }, [logs, holidays, leaves, fromDate, toDate]);

  const summary = useMemo(() => {
    const acc = { present: 0, absent: 0, leave: 0, holiday: 0, sunday: 0, halfDay: 0, late: 0 };
    let graceHalfDaysUsed = 0;
    allDates.forEach((log) => {
      if (log.type === "present") {
        acc.present++;
        const cls = classifyAttendanceDay(log, rules, graceHalfDaysUsed);
        graceHalfDaysUsed = cls.graceHalfDaysUsed;
        if (cls.kind === "halfDay") acc.halfDay++;
        if (cls.kind === "lateDay") acc.late++;
      } else if (acc[log.type] !== undefined) {
        acc[log.type]++;
      }
    });
    return acc;
  }, [allDates, rules]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-teal-600" />
            Attendance Details
          </h1>
          <p className="text-gray-600 mt-2">Track your daily logs, leaves, and holidays</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAttendance}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {[
          { label: "Present", value: summary.present, color: "text-green-600", bg: "bg-green-50" },
          { label: "Absent", value: summary.absent, color: "text-red-600", bg: "bg-red-50" },
          { label: "Half Day", value: summary.halfDay, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Late", value: summary.late, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Leave", value: summary.leave, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Holiday", value: summary.holiday, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Sunday", value: summary.sunday, color: "text-gray-600", bg: "bg-gray-50" },
        ].map((item) => (
          <div key={item.label} className={`${item.bg} p-4 rounded-xl border border-gray-100 shadow-sm`}>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading attendance data...</td>
                </tr>
              ) : allDates.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">No records found for the selected period</td>
                </tr>
              ) : (
                allDates.map((log) => {
                  const dateKey = logDateKeyForReg(log);
                  const isPending = pendingRegByDate.has(dateKey);
                  
                  const rowColor = getRowColorClass(log);
                  
                  if (log.type === "sunday") {
                    return (
                      <tr key={log.date} className="bg-purple-50/50 hover:brightness-95 transition-all">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(log.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {user?.username || "—"}
                        </td>
                        <td colSpan="4" className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-purple-700 font-bold text-lg uppercase tracking-widest">Sunday</span>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={log.date} className={`${rowColor} hover:brightness-95 transition-all`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(log.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user?.username || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.type === "present" ? (
                          log.checkin_time && isMissingCheckoutTime(log) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Half day</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Present</span>
                          )
                        ) : log.type === "absent" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Absent</span>
                        ) : log.type === "leave" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Leave ({log.leaveType})</span>
                        ) : log.type === "holiday" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Holiday ({log.holidayTitle})</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Sunday</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${getCheckinColorClass(log.checkin_time)}`}>
                        {log.checkin_time ? formatTime(log.checkin_time) : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.checkout_time ? formatTime(log.checkout_time) : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isPending ? (
                          <span className="text-yellow-600 flex items-center gap-1 font-medium">
                            <Clock className="w-4 h-4" /> Pending Approval
                          </span>
                        ) : (
                          <button
                            onClick={() => openRegularizeModal(log)}
                            className="text-teal-600 hover:text-teal-800 font-medium transition-colors"
                          >
                            Regularize
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AttendanceRegularizeModal
        open={regModalOpen}
        log={regModalLog}
        logDateKey={regModalDateKey}
        onClose={() => setRegModalOpen(false)}
        onSubmitted={() => {
          fetchAttendance();
          refreshRegularization();
        }}
      />
    </div>
  );
};

export default AttendancePage;
