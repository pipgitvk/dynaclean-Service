import { NextResponse } from "next/server";

export async function POST() {
  // Clear cookie by setting expired date
  const res = NextResponse.json({ message: "Logged out" });
  res.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0), // expire immediately
  });
  return res;
}
