import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, state, description, rating, service_id } = body;

    // Validate required fields
    if (!name || !state || !description || !rating || !service_id) {
      return NextResponse.json(
        { status: "error", message: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { status: "error", message: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Insert feedback into form_submissions table
    const [result] = await conn.execute(
      `INSERT INTO form_submissions (name, state, description, rating, service_id, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [name, state, description, rating, service_id]
    );

    console.log("✅ Feedback submitted successfully:", {
      id: result.insertId,
      service_id,
      name,
      state,
      rating
    });

    return NextResponse.json({
      status: "success",
      message: "Feedback submitted successfully",
      id: result.insertId
    });

  } catch (error) {
    console.error("❌ Error submitting feedback:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
