let checkinPhotoTextEnsured = false;

/**
 * Cloudinary URLs can exceed VARCHAR(255). Ensures checkin_photo can store full URLs.
 * Runs at most once per process; failures are ignored (no ALTER permission on some hosts).
 */
export async function ensureCheckinPhotoColumnStoresLongUrls(conn) {
  if (checkinPhotoTextEnsured) return;
  try {
    await conn.execute(
      `ALTER TABLE attendance_logs MODIFY COLUMN checkin_photo TEXT NULL`
    );
  } catch (e) {
    console.warn("[attendance] ensureCheckinPhotoColumnStoresLongUrls:", e?.code, e?.message);
  }
  checkinPhotoTextEnsured = true;
}
