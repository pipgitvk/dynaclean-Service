import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";

// Set max upload size
export const config = {
  api: {
    bodyParser: false,
  },
};

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req) {
  try {
    // ✅ Get token from cookies
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const createdby = payload.username;

    const formData = await req.formData();

    // ✅ Extract form fields
    const taskname = formData.get("taskname");
    const taskassignto = formData.get("taskassignto");
    const next_followup_date = formData.get("next_followup_date");
    const todaydate = formData.get("todaydate");
    const task_prior = formData.get("task_prior");
    const task_catg = formData.get("task_catg");
    const notes = formData.get("notes");

    // ✅ Handle file uploads
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const handleUpload = async (file, prefix) => {
      if (!file || typeof file === "string") return "";
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = file.name.split(".").pop();
      const fileName = `${prefix}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, buffer);
      return fileName;
    };

    const card_front = await handleUpload(formData.get("card_front"), "img");
    const task_video = await handleUpload(formData.get("task_video"), "video");

    // ✅ Insert into DB
    const conn = await getDbConnection();

    const [[{ max_id }]] = await conn.execute("SELECT MAX(task_id) AS max_id FROM task");
    const task_id = (max_id || 999) + 1;

    await conn.execute(
      `INSERT INTO task (task_id, taskname, createdby, taskassignto, status, next_followup_date, followed_date, notes, visiting_card, task_video, task_prior, task_catg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task_id,
        taskname,
        createdby,
        taskassignto,
        "Pending",
        next_followup_date,
        todaydate,
        notes,
        card_front,
        task_video,
        task_prior,
        task_catg,
      ]
    );

    await conn.execute(
      `INSERT INTO task_followup (task_id, createdby, taskassignto) VALUES (?, ?, ?)`,
      [task_id, createdby, taskassignto]
    );

        // await conn.end();

    // ✅ Success redirect
    return NextResponse.redirect(new URL("/user-dashboard?success=task_created", req.url));
  } catch (err) {
    console.error("❌ Task creation failed:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
