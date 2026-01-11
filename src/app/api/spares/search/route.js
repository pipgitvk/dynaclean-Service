// src/app/api/spares/search/route.js
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = req.nextUrl ?? new URL(req.url, "http://localhost");
  const q = (searchParams.get("q") || "").trim();

  try {
    const conn = await getDbConnection();
    const where = [];
    const params = [];
    if (q) {
      where.push("(item_name LIKE ? OR specification LIKE ? OR spare_number LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const sql = `
      SELECT id, item_name, spare_number, image
      FROM spare_list
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY item_name ASC
      LIMIT 500
    `;
    const [rows] = await conn.execute(sql, params);
    return new Response(JSON.stringify({ items: rows }), { status: 200 });
  } catch (err) {
    console.error("/api/spares/search error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}