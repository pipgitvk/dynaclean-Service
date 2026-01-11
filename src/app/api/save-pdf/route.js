import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDbConnection } from "@/lib/db";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf");
    const serviceId = formData.get("service_id");

    if (!pdfFile || !serviceId) {
      return NextResponse.json(
        { error: "PDF file and service ID are required" },
        { status: 400 }
      );
    }

    // Create PDFs directory if it doesn't exist
    const pdfDir = path.join(process.cwd(), "public", "pdfs");
    await mkdir(pdfDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Service_Report_${serviceId}_${timestamp}.pdf`;
    const filePath = path.join(pdfDir, filename);

    // Convert blob to buffer and save
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    await writeFile(filePath, buffer);

    // Update database with PDF path
    const db = await getDbConnection();
    await db.execute(
      "UPDATE service_records SET pdf_path = ? WHERE service_id = ?",
      [filename, serviceId]
    );
    // Note: Don't close the pool - it's shared across all requests

    console.log(`✅ PDF saved: ${filename}`);

    return NextResponse.json({
      status: "success",
      message: "PDF saved successfully",
      filename: filename,
    });
  } catch (error) {
    console.error("❌ Error saving PDF:", error);
    return NextResponse.json(
      { error: "Failed to save PDF" },
      { status: 500 }
    );
  }
}
