import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  getExpenseAttachmentsDir,
  sanitizeAttachmentFilename,
} from "@/lib/expenseAttachments";

function getContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

export async function GET(req, { params }) {
  try {
    const rawName = decodeURIComponent((await params).fileName || "");
    const fileName = sanitizeAttachmentFilename(rawName);
    const candidatePaths = [
      path.join(getExpenseAttachmentsDir(), fileName),
      path.join(process.cwd(), "public", "expense_attachments", fileName),
      path.join(process.cwd(), "public", "attachments", fileName),
    ];

    let fileBuffer = null;
    for (const candidatePath of candidatePaths) {
      try {
        fileBuffer = await fs.readFile(candidatePath);
        break;
      } catch {
        // Try next location.
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": getContentType(fileName),
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
