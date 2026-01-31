import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const { taskId } = await params;

  const pool = await getDbConnection();
  const conn = await pool.getConnection();
  try {
    const data = await req.formData();
    const notes = data.get("notes")?.toString();
    const followed = data.get("followdate")?.toString();
    const status = data.get("status")?.toString();
    const completion = data.get("task_completion_date")?.toString() || null;

    if (!notes || !followed || !status) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO task_followup (
        taskname,
        status,
        task_deadline,
        followed_date,
        task_completion_date,
        notes,
        task_id,
        createdby,
        taskassignto
      )
      SELECT 
        taskname, 
        ?, 
        next_followup_date, 
        ?, 
        ?, 
        ?, 
        ?, 
        createdby, 
        taskassignto 
      FROM task 
      WHERE task_id = ?`,
      [status, followed, completion, notes, taskId, taskId],
    );

    await conn.execute(`UPDATE task SET status = ? WHERE task_id = ?`, [
      status,
      taskId,
    ]);

    if (status === "Completed") {
      await conn.execute(
        `UPDATE task SET status = ?, task_completion_date = ? WHERE task_id = ?`,
        [status, completion, taskId],
      );
    }

    await conn.commit();
    return NextResponse.redirect(
      new URL(`/user-dashboard?success=followup`, req.url),
    );
  } catch (e) {
    console.error("Follow-up Error:", e);

    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error("Rollback Error:", rollbackError);
    }

    return new NextResponse("Error saving follow-up", { status: 500 });
  } finally {
    console.log("Releasing connection back to pool");
  }
}
