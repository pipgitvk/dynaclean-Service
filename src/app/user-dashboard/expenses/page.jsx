import { getDbConnection } from "@/lib/db";
import ExpenseTable from "./ExpenseTable";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Server Component
export default async function ExpensesPage() {
  let rows = [];
  let role = "";

  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const username =
    payload.username != null ? String(payload.username).trim() : "";
  role = payload.role != null ? String(payload.role) : "";

  const query = `SELECT ID, TravelDate, FromLocation, Tolocation,
            TicketCost, HotelCost, MealsCost, OtherExpenses,
            approved_amount, payment_date, approval_status
        FROM expenses
        WHERE username = ?
        ORDER BY TravelDate DESC;`;

  try {
    const conn = await getDbConnection();
    if (!conn || typeof conn.execute !== "function") {
      throw new Error("Database connection is not available.");
    }
    const [result] = await conn.execute(query, [username]);
    rows = Array.isArray(result) ? result : [];
  } catch (err) {
    console.error("ExpensesPage: failed to load expenses:", err);
    rows = [];
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Expense Entries</h1>

        {/* Button container with flex properties */}
        <div className="flex gap-4">
          {/* Add Expense button */}
          <a
            href="expenses/add"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Add Expense
          </a>
        </div>
      </div>

      <ExpenseTable rows={rows} role={role} />
    </div>
  );
}
