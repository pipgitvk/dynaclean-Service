import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { jwtVerify } from "jose";
import {
  getExpenseAttachmentsDir,
  sanitizeAttachmentFilename,
} from "@/lib/expenseAttachments";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

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
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, SECRET);

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
        "Cache-Control": "private, max-age=604800, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
