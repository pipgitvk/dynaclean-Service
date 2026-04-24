// src/app/api/empcrm/attendance/fetch/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json(
        { message: "Unauthorized access." },
        { status: 401 }
      );
    }
    const username = payload.username;

    const db = await getDbConnection();

    const [rows] = await db.query(
      `SELECT
        date,
        checkin_time,
        checkout_time,
        break_morning_start,
        break_morning_end,
        break_lunch_start,
        break_lunch_end,
        break_evening_start,
        break_evening_end
      FROM attendance_logs
      WHERE username = ?
      ORDER BY date DESC`,
      [username]
    );

    const [holidays] = await db.query(
      `SELECT holiday_date, title, description
       FROM holidays
       ORDER BY holiday_date DESC`
    );

    // Fetch approved leaves for the user
    const [leaves] = await db.query(
      `SELECT from_date, to_date, leave_type, reason
       FROM employee_leaves
       WHERE username = ?
       AND status = 'approved'
       ORDER BY from_date DESC`,
      [username]
    );

    return NextResponse.json({ attendance: rows, holidays, leaves });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
