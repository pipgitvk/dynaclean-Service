import { getDbConnection } from "@/lib/db";
import { notFound } from "next/navigation";
import OrderDetailsClient from "./OrderDetailsClient";

export const dynamic = "force-dynamic";

async function fetchOrderData(orderId) {
  const conn = await getDbConnection();

  const [orderRows] = await conn.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId],
  );

  if (orderRows.length === 0) return { orderDetails: null };

  const orderDetails = orderRows[0];

  const [items] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [orderDetails.quote_number],
  );

  const [statusRows] = await conn.execute(
    "SELECT sales_status, account_status, admin_status, dispatch_status, installation_status FROM neworder WHERE order_id = ?",
    [orderId],
  );

  const statuses = statusRows[0];

  // await conn.end();

  return {
    orderDetails,
    items,
    statuses,
  };
}

export default async function Page({ params }) {
  const { order_id } = await params;
  const orderId = order_id;
  if (isNaN(orderId)) notFound();

  const { orderDetails, items, statuses } = await fetchOrderData(orderId);

  if (!orderDetails) {
    return (
      <div className="p-8 text-center text-red-600 text-xl">
        ❌ Order not found or invalid ID.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">View Order by Quotation</h1>
      <OrderDetailsClient
        orderDetails={orderDetails}
        items={items}
        statuses={statuses}
        orderId={orderId}
      />
    </div>
  );
}
