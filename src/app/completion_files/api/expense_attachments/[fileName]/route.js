import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { fileName = "" } = await params;
  const redirectedUrl = new URL(
    `/api/expense-attachments/${encodeURIComponent(fileName)}`,
    req.url,
  );

  return NextResponse.redirect(redirectedUrl, 307);
}
