// app/orders/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import OrderTable from "./OrderTable";
import { getSessionPayload } from "@/lib/auth";

// Secret for verifying JWT
const JWT_SECRET = process.env.JWT_SECRET;

export default async function OrdersPage() {
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }

  const username = payload.username;
  if (!username) {
    return (
      <div className="text-center mt-20 text-red-600 font-semibold">
        Unauthorized access
      </div>
    );
  }

  const conn = await getDbConnection();

  // 1. Fetch the user role
  const [roleRows] = await conn.execute(
    "SELECT userRole FROM rep_list WHERE username = ?",
    [username]
  );
  const userRole = roleRows[0]?.userRole || "";

  // 2. Fetch orders based on role
  let sql = `SELECT 
                no.order_id, no.report_file, no.po_file, no.payment_proof, no.booking_url,
                no.client_name, no.contact,
                no.created_at, no.einvoice_file, no.booking_id, no.quote_number,
                qr.company_name, qr.emp_name, qr.state
            FROM 
                neworder no
            LEFT JOIN 
                quotations_records qr ON no.quote_number = qr.quote_number`;

  const params = [];

  if (!["ACCOUNTANT", "ADMIN"].includes(userRole)) {
    sql += " WHERE no.created_by = ?";
    params.push(username);
  }

  sql += " ORDER BY no.created_at DESC";

  const [orders] = await conn.execute(sql, params);

  // await conn.end();

  console.log("fetched orders:", orders);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Your Orders</h3>
        <a
          href="/user-dashboard/order/new"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          + New Order
        </a>
      </div>

      <OrderTable orders={orders} userRole={userRole} />
    </div>
  );
}
