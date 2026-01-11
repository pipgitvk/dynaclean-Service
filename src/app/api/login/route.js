

// app/api/login/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // ✅ check in rep_list table only
    const [rows] = await conn.execute(
      "SELECT * FROM rep_list WHERE LOWER(username) = LOWER(?)",
      [username.trim()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const user = rows[0];
    const dbPassword = user.password?.trim() || "";
    const inputPassword = password.trim();

    if (dbPassword !== inputPassword) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // ✅ Generate JWT (7-day expiry)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: "user" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Save token in HTTP-only cookie
    const response = NextResponse.json({
      message: "Login successful",
      role: "user",
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
