const SERVICE_RECORD_COLUMNS = [
  { name: "google_feedback_collected", ddl: "VARCHAR(8) NULL COMMENT 'yes or no'" },
  { name: "google_feedback_collection", ddl: "VARCHAR(64) NULL" },
  { name: "google_feedback_proof", ddl: "VARCHAR(512) NULL COMMENT 'screenshot/PDF filename in attachments'" },
];

export async function ensureServiceRecordsGoogleFeedbackColumns(conn) {
  for (const col of SERVICE_RECORD_COLUMNS) {
    const [rows] = await conn.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'service_records'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (rows.length === 0) {
      await conn.execute(
        `ALTER TABLE service_records ADD COLUMN ${col.name} ${col.ddl}`,
      );
    }
  }
}

export function normalizeGoogleFeedbackCollected(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "YES") return "yes";
  if (v === "NO") return "no";
  return "";
}