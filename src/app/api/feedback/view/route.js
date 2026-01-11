import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');

    const conn = await getDbConnection();

    let query = `SELECT * FROM form_submissions`;
    let params = [];

    if (serviceId) {
      query += ` WHERE service_id = ?`;
      params.push(serviceId);
    }

    query += ` ORDER BY created_at DESC`;

    const [results] = await conn.execute(query, params);

    return NextResponse.json({
      status: "success",
      data: results
    });

  } catch (error) {
    console.error("❌ Error fetching feedback:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
