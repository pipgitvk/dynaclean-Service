


import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { parseFormData } from "@/lib/parseForm";
import fs from "fs/promises"; // Use fs.promises for async file operations
import path from "path";


const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Helper function to save a file locally
async function saveFileLocally(file, subfolder) {
  if (!file || !file.filepath || !file.originalFilename) {
    console.warn("⚠️ File missing or invalid for local save:", file);
    throw new Error("File is missing or invalid");
  }

  // Create subfolder if it doesn't exist (e.g., 'uploads/po_files', 'uploads/payment_files')
  const targetSubfolder = path.join(UPLOAD_DIR, subfolder);
  await fs.mkdir(targetSubfolder, { recursive: true });

  const fileName = `${Date.now()}-${file.originalFilename}`; // Ensure unique filename
  const targetPath = path.join(targetSubfolder, fileName);

  try {
    // Read the file content from the temporary path and write to the target path
    const fileContent = await fs.readFile(file.filepath);
    await fs.writeFile(targetPath, fileContent);
    console.log("✅ File saved locally:", targetPath);

    // Return the relative URL path that can be accessed via the browser
    return `/uploads/${subfolder}/${fileName}`;
  } finally {
    // Clean up the temporary file created by formidable
    await fs.unlink(file.filepath).catch((err) => {
      console.error("Failed to delete temp file:", err);
    });
  }
}

function generateOrderId(todayCount) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return date + String(todayCount + 1).padStart(3, "0");
}

export async function POST(req) {
  try {
    // 1. Authenticate
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const username = payload.username;

    // 2. Parse multipart/form-data
    const { fields, files } = await parseFormData(req);
    // Normalize field values from [ 'value' ] → 'value'
    for (const key in fields) {
      if (Array.isArray(fields[key])) {
        fields[key] = fields[key][0];
      }
    }

    console.log("📦 Parsed Fields:", fields);
    console.log("📁 Parsed Files:", files);

    const {
      quote_number, client_name, phone, email,
      delivery_location, company_name, company_address,
      state, ship_to, salesRemark
    } = fields;

    // 3. Save files locally instead of uploading to Cloudinary
    let poFileUrl = "";
    if (files.poFile && files.poFile[0]) {
      poFileUrl = await saveFileLocally(files.poFile[0], "po_files");
    }

    let paymentProofUrl = "";
    if (files.paymentProof && files.paymentProof[0]) {
      paymentProofUrl = await saveFileLocally(files.paymentProof[0], "payment_files");
    }

    // 4. Insert into DB
    const conn = await getDbConnection();

    const [[{ count }]] = await conn.execute(
      "SELECT COUNT(*) AS count FROM neworder WHERE DATE(created_at) = CURDATE()"
    );
    const orderId = generateOrderId(count);

    await conn.execute(
      `INSERT INTO neworder
         (order_id, quote_number, po_file, payment_proof, client_name,
          contact, email, delivery_location, company_name, company_address,
          state, sales_status, sales_remark, ship_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, quote_number, poFileUrl, paymentProofUrl, client_name, // Use local URLs
        phone, email, delivery_location, company_name, company_address,
        state, 1, salesRemark, ship_to, username
      ]
    );

    // conn.end();
    console.log("✅ Order saved successfully:", orderId);
    return NextResponse.json({ success: true, orderId }, { status: 201 });
  } catch (err) {
    console.error("❌ Order save error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}