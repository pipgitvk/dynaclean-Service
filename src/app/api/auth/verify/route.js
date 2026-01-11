// app/api/auth/verify/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET(request) {
  try {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { loggedIn: false, error: "No token" },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    return NextResponse.json({
      loggedIn: true,
      user: decoded,
    });
  } catch (error) {
    console.error("Token verification failed:", error);
    return NextResponse.json(
      { loggedIn: false, error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
