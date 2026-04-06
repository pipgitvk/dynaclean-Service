"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

function normStatus(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/** Match dhynaclean_crm: blank status + reviewed_at + no rejection ⇒ treat as pending_hr_docs */
function effectiveSubmissionStatus(r) {
  const st = normStatus(r.status);
  if (
    !st &&
    r.reviewed_at &&
    (r.rejection_reason == null || String(r.rejection_reason).trim() === "")
  ) {
    return "pending_hr_docs";
  }
  return st || "pending";
}

/**
 * HR queue + (if allowed) Super Admin final queue — same flow as dhynaclean_crm
 * /api/empcrm/profile/submissions (GET pending | pending_admin, PATCH approve | reject | forward_to_admin).
 */
export default function ProfileApprovalsPage() {
  const [hrRows, setHrRows] = useState([]);
  const [adminRows, setAdminRows] = useState([]);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setHint("");
    try {
      const resHr = await fetch("/api/empcrm/profile/submissions?status=pending", {
        credentials: "include",
      });
      const dataHr = await resHr.json();
      if (!resHr.ok) throw new Error(dataHr.error || "Failed to load HR queue");
      setHrRows(dataHr.submissions || []);

      const resAd = await fetch("/api/empcrm/profile/submissions?status=pending_admin", {
        credentials: "include",
      });
      const dataAd = await resAd.json();
      if (resAd.ok) {
        setAdminRows(dataAd.submissions || []);
      } else if (resAd.status === 403) {
        setAdminRows([]);
      } else {
        setHint((h) => (h ? `${h} ` : "") + (dataAd.error || ""));
      }
    } catch (e) {
      toast.error(e?.message || "Failed to load");
      setHint(e?.message || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patchAction(submissionId, action, extra = {}) {
    try {
      const res = await fetch("/api/empcrm/profile/submissions", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast.success(data.message || "Done");
      await load();
    } catch (e) {
      toast.error(e?.message || "Action failed");
    }
  }

  function labelStatus(st) {
    const n = normStatus(st);
    if (!n && st !== 0) return "pending (or HR docs)";
    if (n === "pending") return "pending — HR review";
    if (n === "pending_hr_docs") return "pending_hr_docs — HR details";
    return n;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-4">
      <div className="rounded-xl bg-white p-4 md:p-6 shadow border border-sky-100">
        <h1 className="text-2xl font-semibold text-gray-900">Profile approvals</h1>
        <p className="text-sm text-gray-600 mt-1">
          Same flow as Dynaclean CRM: <code className="text-xs bg-gray-100 px-1 rounded">pending</code> → Approve
          employee sections → <code className="text-xs bg-gray-100 px-1 rounded">pending_hr_docs</code> → Send to Super
          Admin → <code className="text-xs bg-gray-100 px-1 rounded">pending_admin</code> → final publish.
        </p>
      </div>

      {hint && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {hint}
        </div>
      )}

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : (
        <>
          <section className="rounded-xl border border-gray-200 bg-white shadow overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">HR queue</h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Approve = first step (employee sections OK). At pending_hr_docs use Send to Super Admin — not Approve
                again.
              </p>
            </div>
            {hrRows.length === 0 ? (
              <p className="p-6 text-gray-600">No HR queue items.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-white text-left text-gray-700 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hrRows.map((r) => {
                    const st = effectiveSubmissionStatus(r);
                    const isFirst = st === "pending";
                    const isHrDocs = st === "pending_hr_docs";
                    return (
                      <tr key={r.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.username}</td>
                        <td className="px-4 py-3 text-gray-700">{labelStatus(st)}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {r.submitted_at
                            ? new Date(r.submitted_at).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 flex flex-wrap justify-end gap-2">
                          {isFirst && (
                            <button
                              type="button"
                              onClick={() => patchAction(r.id, "approve")}
                              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                            >
                              Approve employee sections
                            </button>
                          )}
                          {isHrDocs && (
                            <button
                              type="button"
                              onClick={() => patchAction(r.id, "forward_to_admin")}
                              className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800"
                            >
                              Send to Super Admin
                            </button>
                          )}
                          {(isFirst || isHrDocs) && (
                            <button
                              type="button"
                              onClick={() => {
                                const reason = prompt("Rejection reason (optional):") ?? "";
                                patchAction(r.id, "reject", { rejection_reason: reason });
                              }}
                              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Reject
                            </button>
                          )}
                          {!isFirst && !isHrDocs && (
                            <span className="text-xs text-gray-500">Use Super Admin queue or detail screen</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white shadow overflow-hidden">
            <div className="border-b border-gray-100 bg-slate-50 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">Super Admin — final publish</h2>
              <p className="text-xs text-gray-600 mt-0.5">Only Super Admin can approve from pending_admin (merge into employee_profiles).</p>
            </div>
            {adminRows.length === 0 ? (
              <p className="p-6 text-gray-600">
                No pending_admin items{hrRows.length > 0 ? " (or you are not Super Admin)." : "."}
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-white text-left text-gray-700 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminRows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.username}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {r.submitted_at
                          ? new Date(r.submitted_at).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => patchAction(r.id, "approve")}
                          className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                        >
                          Publish &amp; approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = prompt("Rejection reason (optional):") ?? "";
                            patchAction(r.id, "reject", { rejection_reason: reason });
                          }}
                          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
