// app/service-reports/page.js

import { getDbConnection } from "@/lib/db"; // DB connection utility
import ServiceTable from "@/components/services/ServiceTable"; // Import the new Table Component
import { cookies } from "next/headers";

import { getSessionPayload } from "@/lib/auth";
import { getISTCalendarDate } from "@/lib/istDateTime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ViewServiceReportsPage() {
  let serviceRecords = [];

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let role = "Unknown";

  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }

  role = payload.role;
  const user = payload.username;

  try {
    const conn = await getDbConnection();
    const sql = `
  SELECT
    sr.*,
    wp.customer_name AS customer_name_from_wp,
    wp.installed_address AS installed_address_from_wp,
    wp.email, wp.contact, wp.invoice_date, wp.product_name, wp.specification, wp.model,
    wp.site_email, wp.site_contact, wp.site_person,
    (
      SELECT GROUP_CONCAT(srp.id ORDER BY srp.id SEPARATOR ',')
      FROM service_reports srp
      WHERE srp.service_id = sr.service_id
    ) AS report_ids,
    (
      SELECT GROUP_CONCAT(srp.service_date ORDER BY srp.id SEPARATOR ',')
      FROM service_reports srp
      WHERE srp.service_id = sr.service_id
    ) AS report_dates
  FROM service_records sr
  LEFT JOIN warranty_products wp ON sr.serial_number COLLATE utf8mb4_unicode_ci = wp.serial_number
  WHERE sr.assigned_to = ?
  ORDER BY sr.service_id DESC;
`;

    const [rows] = await conn.execute(sql, [user]);

    serviceRecords = rows.map((row) => ({
      ...row,
      customer_name: row.customer_name_from_wp || "N/A",
      installed_address: row.installed_address_from_wp || "N/A",
      site_email: row.site_email || "N/A",
      site_contact: row.site_contact || "N/A",
      site_person: row.site_person || "N/A",
      // Ensure the date fields are converted to a readable string format
      completed_date: row.completed_date
        ? new Date(row.completed_date).toLocaleDateString()
        : "N/A",
      // IST calendar YYYY-MM-DD for client-side date range filter
      _filterComplaintYmd: row.complaint_date
        ? getISTCalendarDate(new Date(row.complaint_date))
        : null,
      _filterCompletedYmd: row.completed_date
        ? getISTCalendarDate(new Date(row.completed_date))
        : null,
    }));

    // conn.end();
  } catch (error) {
    console.error("Error fetching service records:", error);
    serviceRecords = [];
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className=" mx-auto">
        <h2 className="text-3xl  text-gray-800 text-center">Service Reports</h2>
        <ServiceTable serviceRecords={serviceRecords} role={role} />
      </div>
    </div>
  );
}
