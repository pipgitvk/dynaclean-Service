"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function ProfileApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employee-profile/pending-approvals", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.rows || []);
      setHint(data.message || "");
    } catch (e) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(targetUsername, approved) {
    try {
      const res = await fetch("/api/employee-profile/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername, approved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast.success(approved ? "Profile approved" : "Profile rejected");
      setRows((r) => r.filter((x) => x.username !== targetUsername));
    } catch (e) {
      toast.error(e?.message || "Action failed");
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 p-2 md:p-4">
      <div className="rounded-xl bg-white p-4 md:p-6 shadow border border-sky-100">
        <h1 className="text-2xl font-semibold text-gray-900">Profile approvals</h1>
        <p className="text-sm text-gray-600 mt-1">
          Submissions with status <code className="text-xs bg-gray-100 px-1 rounded">pending_hr</code> after
          employees save My Profile.
        </p>
      </div>

      {hint && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {hint}
        </div>
      )}

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600 rounded-xl bg-white p-6 shadow">No pending profile approvals.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Full name</th>
                <th className="px-4 py-3 font-medium">Employee code</th>
                <th className="px-4 py-3 font-medium">empId</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id ?? r.username} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.username}</td>
                  <td className="px-4 py-3 text-gray-800">{r.full_name || "—"}</td>
                  <td className="px-4 py-3">{r.employee_code || "—"}</td>
                  <td className="px-4 py-3">{r.empId ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {r.updated_at
                      ? new Date(r.updated_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => act(r.username, true)}
                      className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => act(r.username, false)}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
