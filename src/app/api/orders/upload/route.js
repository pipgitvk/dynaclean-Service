import { NextResponse } from "next/server";
import { parseFormData } from "@/lib/parseFormData";
import fs from "fs";
import path from "path";
import { getDbConnection } from "@/lib/db";

// Ensure the target folder exists
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Save file to public/Order/accounts/
async function saveFileLocally(file) {
  if (!file || !file.filepath) throw new Error("Missing file");

  const uploadDir = path.join(process.cwd(), "public", "Order", "accounts");
  ensureDir(uploadDir);

  const ext = path.extname(file.originalFilename || "") || ".bin";
  const uniqueName = `${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}${ext}`;
  const destPath = path.join(uploadDir, uniqueName);

  await fs.promises.copyFile(file.filepath, destPath);

  // Return relative URL (for database usage)
  return `/Order/accounts/${uniqueName}`;
}

// Normalize file input
const getFile = (f) => (Array.isArray(f) ? f[0] : f);

// POST handler
export async function POST(req) {
  try {
    const { fields, files } = await parseFormData(req);

    const orderId = parseInt(fields.order_id);
    if (!orderId) throw new Error("Missing or invalid order_id");

    const baseAmount = parseFloat(fields.baseAmount); // Get baseAmount from form
    const taxAmt = parseFloat(fields.taxamt);
    const totalAmt = parseFloat(fields.totalamt);

    const invoiceNumber = Array.isArray(fields.invoice_number)
      ? fields.invoice_number[0]
      : fields.invoice_number;
    const dueDate = Array.isArray(fields.duedate)
      ? fields.duedate[0]
      : fields.duedate;
    const remark = Array.isArray(fields.remark)
      ? fields.remark[0]
      : fields.remark || "";

    // Save files locally (if present)
    const ewaybillPath = files.ewaybill_file
      ? await saveFileLocally(getFile(files.ewaybill_file))
      : "";
    const einvoicePath = files.einvoice_file
      ? await saveFileLocally(getFile(files.einvoice_file))
      : "";
    const reportPath = files.report_file
      ? await saveFileLocally(getFile(files.report_file))
      : "";
    const challanPath = files.deliverchallan
      ? await saveFileLocally(getFile(files.deliverchallan))
      : "";

    // DB connection
    const conn = await getDbConnection();

    // Save to DB (include baseAmount)
    await conn.execute(
      `UPDATE neworder SET 
        baseAmount = ?, 
        ewaybill_file = ?, 
        report_file = ?, 
        einvoice_file = ?, 
        deliverchallan = ?, 
        invoice_number = ?, 
        duedate = ?, 
        taxamt = ?, 
        totalamt = ?, 
        account_status = ?, 
        account_remark = ? 
      WHERE order_id = ?`,
      [
        baseAmount, // Add baseAmount to the query
        ewaybillPath,
        reportPath,
        einvoicePath,
        challanPath,
        invoiceNumber,
        dueDate,
        taxAmt,
        totalAmt,
        1, // account_status
        remark,
        orderId,
      ]
    );

    // await conn.end();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
