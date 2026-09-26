import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    if (!url.includes("res.cloudinary.com")) {
      return NextResponse.json({ error: "Only Cloudinary URLs are allowed" }, { status: 400 });
    }

    const decodedUrl = decodeURIComponent(url);
    const urlsToTry = [decodedUrl];

    if (decodedUrl.includes("/image/upload/") && decodedUrl.toLowerCase().endsWith(".pdf")) {
      urlsToTry.push(decodedUrl.replace("/image/upload/", "/raw/upload/"));
    }
    if (decodedUrl.includes("/raw/upload/")) {
      urlsToTry.push(decodedUrl.replace("/raw/upload/", "/image/upload/"));
    }

    let response = null;
    for (const tryUrl of urlsToTry) {
      try {
        response = await fetch(tryUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; DynacleanCRM/1.0)" },
        });
        if (response.ok) break;
      } catch {
        // try next URL
      }
    }

    if (!response || !response.ok) {
      const status = response?.status || 502;
      return NextResponse.json({ error: `Failed to fetch file: ${status}` }, { status });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const lower = decodedUrl.toLowerCase();
    let contentType = response.headers.get("content-type") || "application/octet-stream";
    if (lower.endsWith(".pdf")) contentType = "application/pdf";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (lower.endsWith(".png")) contentType = "image/png";

    const filename = decodedUrl.split("/").pop().split("?")[0] || "file";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[cloudinary-proxy] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
