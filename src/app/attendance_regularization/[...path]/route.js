export const dynamic = "force-dynamic";

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

function guessMimeFromName(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function safeRelativePath(segments) {
  const parts = (Array.isArray(segments) ? segments : [segments])
    .map((part) => {
      try {
        return decodeURIComponent(String(part || ""));
      } catch {
        return String(part || "");
      }
    })
    .filter(Boolean);

  if (!parts.length || parts.some((part) => part === ".." || part.includes("\\"))) {
    return null;
  }

  return parts.join("/");
}

export async function GET(_request, { params }) {
  try {
    const resolved = await params;
    const relativePath = safeRelativePath(resolved?.path);

    if (!relativePath) {
      return NextResponse.json({ message: "Invalid path" }, { status: 400 });
    }

    const fullPath = join(
      process.cwd(),
      "public",
      "attendance_regularization",
      relativePath,
    );

    if (!existsSync(fullPath)) {
      return NextResponse.json({ message: "Attachment not found" }, { status: 404 });
    }

    const buffer = await readFile(fullPath);
    const filename = relativePath.split("/").pop() || "attachment";

    return new Response(buffer, {
      headers: {
        "Content-Type": guessMimeFromName(filename),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("attendance_regularization GET:", error);
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
