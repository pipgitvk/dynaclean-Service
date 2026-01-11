import Link from "next/link";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getQuotations(username, { search, date_from, date_to }) {
  const conn = await getDbConnection();

 let query = `
  SELECT 
    qr.quote_number,
    qr.quote_date,
    qr.company_name,
    qr.grand_total,
    qr.emp_name AS created_by,
    c.first_name AS client_name,
    c.email,
    c.phone
  FROM quotations_records qr
  JOIN customers c ON c.customer_id = qr.customer_id
  WHERE (
    c.sales_representative = ? 
    OR c.lead_source = ? 
    OR qr.emp_name = ?
  )
`;

const values = [username, username, username];

if (search) {
  query += ` AND (
    qr.quote_number LIKE ? OR
    qr.company_name LIKE ? OR
    c.first_name LIKE ? OR
    c.email LIKE ? OR
    c.phone LIKE ? OR
    qr.emp_name LIKE ?
  )`;
  const like = `%${search}%`;
  values.push(like, like, like, like, like, like);
}

if (date_from && date_to) {
  query += ` AND qr.quote_date BETWEEN ? AND ?`;
  values.push(date_from, date_to);
}

query += ` ORDER BY qr.quote_date DESC`;


  const [rows] = await conn.execute(query, values);
  return rows;
}

export default async function QuotationPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) return null;
  const username = payload.username;

  const filters = {
    search: searchParams?.search ?? "",
    date_from: searchParams?.date_from ?? "",
    date_to: searchParams?.date_to ?? "",
  };

  const quotations = await getQuotations(username, filters);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Quotation Management</h1>
        <Link
          href="/user-dashboard/quotations/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-center"
        >
          + New Quotation
        </Link>
      </div>

      <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-white p-3 rounded shadow" method="get">
        <input
          type="text"
          name="search"
          placeholder="Search ID, client, email, phone, created by"
          defaultValue={filters.search}
          className="p-2 border rounded"
        />
        <input
          type="date"
          name="date_from"
          defaultValue={filters.date_from}
          className="p-2 border rounded"
        />
        <input
          type="date"
          name="date_to"
          defaultValue={filters.date_to}
          className="p-2 border rounded"
        />
        <button type="submit" className="p-2 bg-green-600 text-white rounded">Apply</button>
        <a href="?" className="p-2 border rounded text-center">Reset</a>
      </form>

      <div className="hidden md:block overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100 text-left text-sm text-gray-700">
            <tr>
              <th className="px-4 py-3">Quotation ID</th>
              <th className="px-4 py-3">Company Name</th>
              <th className="px-4 py-3">Client Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total Amount</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-800">
            {quotations.length > 0 ? (
              quotations.map((q) => (
                <tr key={q.quote_number} className="border-t hover:bg-gray-50 transition">
                  <td className="px-4 py-2">{q.quote_number}</td>
                  <td className="px-4 py-2">{q.company_name}</td>
                  <td className="px-4 py-2">{q.client_name || q.company_name}</td>
                  <td className="px-4 py-2">{q.email || "-"}</td>
                  <td className="px-4 py-2">{q.phone || "-"}</td>
                  <td className="px-4 py-2">{new Date(q.quote_date).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2">₹{q.grand_total}</td>
                  <td className="px-4 py-2">{q.created_by}</td>
                  <td className="px-4 py-2 text-center">
                    <Link
                      href={`/user-dashboard/quotations/${q.quote_number}`}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-gray-500 px-4 py-6 italic">
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {quotations.length > 0 ? (
          quotations.map((q) => (
            <div key={q.quote_number} className="border rounded shadow-sm p-4 bg-white space-y-2">
              <div><strong>Quotation ID:</strong> {q.quote_number}</div>
              <div><strong>Client:</strong> {q.client_name || q.company_name}</div>
              <div><strong>Email:</strong> {q.email || "-"}</div>
              <div><strong>Phone:</strong> {q.phone || "-"}</div>
              <div><strong>Date:</strong> {new Date(q.quote_date).toLocaleDateString("en-IN")}</div>
              <div><strong>Total:</strong> ₹{q.grand_total}</div>
              <div><strong>Created By:</strong> {q.created_by}</div>
              <div className="text-right">
                <Link
                  href={`/user-dashboard/quotations/${q.quote_number}`}
                  className="inline-block bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  View
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 italic">No entries found.</p>
        )}
      </div>
    </div>
  );
}
