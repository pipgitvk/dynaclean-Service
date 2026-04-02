let checkinPhotoTextEnsured = false;

/**
 * Cloudinary URLs can exceed VARCHAR(255). Ensures checkin_photo exists and is TEXT.
 * If column is missing (#1054), ADD COLUMN; if it exists, MODIFY to TEXT.
 * Runs at most once per process; failures are logged (no ALTER permission on some hosts).
 */
export async function ensureCheckinPhotoColumnStoresLongUrls(conn) {
  if (checkinPhotoTextEnsured) return;
  try {
    await conn.execute(
      `ALTER TABLE attendance_logs MODIFY COLUMN checkin_photo TEXT NULL`
    );
  } catch (e) {
    const missingColumn =
      e?.errno === 1054 ||
      (typeof e?.message === "string" && e.message.includes("Unknown column") && e.message.includes("checkin_photo"));
    if (missingColumn) {
      try {
        await conn.execute(
          `ALTER TABLE attendance_logs ADD COLUMN checkin_photo TEXT NULL COMMENT 'Cloudinary check-in image URL'`
        );
      } catch (e2) {
        if (e2?.errno === 1060) {
          try {
            await conn.execute(
              `ALTER TABLE attendance_logs MODIFY COLUMN checkin_photo TEXT NULL`
            );
          } catch (e3) {
            console.warn("[attendance] MODIFY checkin_photo after duplicate:", e3?.message);
          }
        } else {
          console.warn("[attendance] ADD checkin_photo failed:", e2?.code, e2?.message);
        }
      }
    } else {
      console.warn("[attendance] MODIFY checkin_photo failed:", e?.code, e?.message);
    }
  }
  checkinPhotoTextEnsured = true;
}
