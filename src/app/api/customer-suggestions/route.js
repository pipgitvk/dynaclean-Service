import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function POST(req) {
  const { query } = await req.json();

   // ✅ Extract username from JWT in cookies
      const cookieStore = await cookies();
      const token = cookieStore.get("token")?.value;
      let username = "Unknown";
  
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          username = decoded.username || "Unknown";
        } catch (error) {
          console.error("JWT decode failed", error);
          return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
        }
      }
  

  if (!query || query.trim() === "") {
    return NextResponse.json([]);
  }

  try {
    const conn = await getDbConnection();

    let rows;

    if (/^\d+$/.test(query.trim())) {
      // Pure numeric input → likely customer ID
      [rows] = await conn.execute(
        `SELECT customer_id, company, address AS location, gstin, state
         FROM customers
         WHERE customer_id = ?
         LIMIT 1`,
        [query.trim()]
      );
    } else {
      // Partial search by company/gstin/state/etc
      const searchTerm = `%${query.trim()}%`;
      // [rows] = await conn.execute(
      //   `SELECT customer_id, company, address AS location, gstin, state
      //    FROM customers
      //    WHERE company LIKE ? OR address LIKE ? OR gstin LIKE ? OR state LIKE ?
      //    LIMIT 10`,
      //   [searchTerm, searchTerm, searchTerm, searchTerm]
      // );
      [rows] = await conn.execute(
  `SELECT customer_id, company, address AS location, gstin, state
   FROM customers
   WHERE (company LIKE ? OR address LIKE ? OR gstin LIKE ? OR state LIKE ?)
     AND lead_source = ?
   LIMIT 10`,
  [searchTerm, searchTerm, searchTerm, searchTerm, username]
);
    }

    const companies = rows.map((row) => ({
      customer_id: row.customer_id,
      company: row.company,
      location: row.location ?? "",
      gstin: row.gstin ?? "",
      state: row.state ?? "",
    }));

    return NextResponse.json(companies);
  } catch (err) {
    console.error("❌ MySQL error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
