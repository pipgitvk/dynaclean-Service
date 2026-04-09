// middleware.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret"
);

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token =
    request.cookies.get("impersonation_token")?.value ||
    request.cookies.get("token")?.value;

  // 🚫 Redirect root "/" → "/login"
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ✅ If already logged in and visits "/login", redirect to user dashboard
  if (pathname === "/login" && token) {
    try {
      await jwtVerify(token, secret);
      return NextResponse.redirect(new URL("/user-dashboard", request.url));
    } catch {
      return NextResponse.next(); // invalid/expired → show login
    }
  }

  // ✅ Protect user dashboard
  if (pathname.startsWith("/user-dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/user-dashboard/:path*"],
};
