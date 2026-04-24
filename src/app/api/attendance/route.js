// src/app/api/attendance/route.js

import { getDbConnection } from "@/lib/db";
import { ensureCheckinPhotoColumnStoresLongUrls } from "@/lib/ensureAttendanceSchema";
import {
  getISTCalendarDate,
  getISTDateTimeString,
  normalizeAttendanceLogTimes,
} from "@/lib/istDateTime";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const getReverseGeocode = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent": "DynacleanIndustriesApp/1.0 (contact@dynacleanindustries.com)",
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Nominatim API error:", response.status, errorBody);
      return "Failed to get address";
    }

    const data = await response.json();
    return data.display_name || "Address not found";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Failed to get address";
  }
};

const uploadPhotoToCloudinary = async (base64Image, username, date) => {
  const safePublicId = `${String(username).replace(/[^a-zA-Z0-9_-]/g, "_")}_${date}`;
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "attendance/checkin",
      public_id: safePublicId,
      overwrite: true,
      resource_type: "image",
      transformation: [{ width: 640, height: 480, crop: "limit", quality: "auto" }],
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const conn = await getDbConnection();
  const today = getISTCalendarDate();

  try {
    const [rows] = await conn.execute(
      "SELECT * FROM attendance_logs WHERE username = ? AND date = ?",
      [username, today]
    );

    const attendanceLog = rows.length > 0 ? normalizeAttendanceLogTimes(rows[0]) : null;

    return NextResponse.json(attendanceLog);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance data" }, { status: 500 });
  } finally {
    console.log("Database connection closed.");
  }
}

export async function POST(req) {
  const body = await req.json();
  const { username, action, latitude, longitude, checkin_photo } = body;
  const conn = await getDbConnection();
  const now = new Date();
  const today = getISTCalendarDate(now);
  const nowIstSql = getISTDateTimeString(now);

  let locationAddress = null;
  if (latitude && longitude) {
    locationAddress = await getReverseGeocode(latitude, longitude);
  }

  try {
    switch (action) {
      case "checkin": {
        if (!checkin_photo) {
          return NextResponse.json(
            { error: "Face photo is required for check-in" },
            { status: 400 }
          );
        }

        if (
          !process.env.CLOUDINARY_CLOUD_NAME ||
          !process.env.CLOUDINARY_API_KEY ||
          !process.env.CLOUDINARY_API_SECRET
        ) {
          console.error("Attendance check-in: Cloudinary env vars are not set");
          return NextResponse.json(
            { error: "Photo upload is not configured on the server. Contact administrator." },
            { status: 503 }
          );
        }

        const photoUrl = await uploadPhotoToCloudinary(checkin_photo, username, today);
        if (!photoUrl) {
          return NextResponse.json(
            {
              error:
                "Could not save your check-in photo. Please try again with better network, or contact support if this continues.",
            },
            { status: 502 }
          );
        }

        await ensureCheckinPhotoColumnStoresLongUrls(conn);
        await conn.execute(
          "INSERT INTO attendance_logs (username, date, checkin_time, checkin_latitude, checkin_longitude, checkin_address, checkin_photo) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [username, today, nowIstSql, latitude, longitude, locationAddress, photoUrl]
        );
        break;
      }

      case "break_morning":
        await conn.execute(
          "UPDATE attendance_logs SET break_morning_start = ? WHERE username = ? AND date = ?",
          [nowIstSql, username, today]
        );
        break;

      case "end_morning":
        await conn.execute(
          "UPDATE attendance_logs SET break_morning_end = ? WHERE username = ? AND date = ?",
          [nowIstSql, username, today]
        );
        break;

      case "break_lunch":
        await conn.execute(
          "UPDATE attendance_logs SET break_lunch_start = ? WHERE username = ? AND date = ?",
          [nowIstSql, username, today]
        );
        break;

      case "end_lunch":
        await conn.execute(
          "UPDATE attendance_logs SET break_lunch_end = ? WHERE username = ? AND date = ?",
          [nowIstSql, username, today]
        );
        break;

      case "break_evening":
        await conn.execute(
          "UPDATE attendance_logs SET break_evening_start = ? WHERE username = ? AND date = ?",
          [nowIstSql, username, today]
        );
        break;

      case "end_evening":
        await conn.execute(
          "UPDATE attendance_logs SET break_evening_end = ? WHERE username = ? AND date = ?",
          [nowIstSql, username, today]
        );
        break;

      case "checkout": {
        const checkoutAddress =
          locationAddress || "Auto checkout at 6:30 PM";
        await conn.execute(
          `UPDATE attendance_logs SET
             checkout_time = ?,
             checkout_latitude = COALESCE(?, checkin_latitude, 0),
             checkout_longitude = COALESCE(?, checkin_longitude, 0),
             checkout_address = ?
           WHERE username = ? AND date = ?`,
          [nowIstSql, latitude ?? null, longitude ?? null, checkoutAddress, username, today]
        );
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) {
      return NextResponse.json(
        { error: "You have already checked in today. Refresh the page to see your status." },
        { status: 409 }
      );
    }
    if (error?.code === "ER_DATA_TOO_LONG" || error?.errno === 1406) {
      console.error("Attendance: URL or value too long for column", error);
      return NextResponse.json(
        {
          error:
            "Check-in could not be saved: database field is too small for the photo link. Ask admin to set attendance_logs.checkin_photo to TEXT.",
        },
        { status: 500 }
      );
    }
    console.error("Attendance POST error:", error?.code, error?.errno, error?.message, error);
    return NextResponse.json(
      {
        error:
          "Could not save check-in. Please try again. If it keeps failing, contact support with the time of this attempt.",
      },
      { status: 500 }
    );
  } finally {
    console.log("Database connection closed.");
  }
}
