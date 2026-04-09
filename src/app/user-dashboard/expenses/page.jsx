"use client";

import { useCallback, useEffect, useState } from "react";
import ExpenseTable from "./ExpenseTable";

export default function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load expenses");
        setRows([]);
        setRole("");
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setRole(typeof data.role === "string" ? data.role : "");
    } catch (e) {
      console.error(e);
      setError("Could not load expenses");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Expense Entries</h1>

        <div className="flex gap-4">
          <a
            href="/user-dashboard/expenses/add"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Add Expense
          </a>
        </div>
      </div>

      {loading && (
        <p className="text-gray-600 mb-4" aria-live="polite">
          Loading expenses…
        </p>
      )}
      {error && (
        <p className="text-red-600 mb-4 bg-red-50 border border-red-200 rounded p-3" role="alert">
          {error}
        </p>
      )}

      <ExpenseTable rows={rows} role={role} onRefresh={load} />
    </div>
  );
}
