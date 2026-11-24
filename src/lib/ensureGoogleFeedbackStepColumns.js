const FEEDBACK_COLUMNS = [
  { name: "completion_step_date", ddl: "DATE NULL" },
  { name: "completed_by_engineer", ddl: "VARCHAR(255) NULL" },
  { name: "google_feedback_collected", ddl: "VARCHAR(8) NULL" },
  { name: "google_feedback_collection", ddl: "VARCHAR(64) NULL" },
  { name: "google_feedback_file", ddl: "VARCHAR(512) NULL" },
];

export async function ensureGoogleFeedbackStepColumns(conn) {
  for (const col of FEEDBACK_COLUMNS) {
    const [rows] = await conn.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'service_report_steps'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (rows.length === 0) {
      await conn.execute(
        `ALTER TABLE service_report_steps ADD COLUMN ${col.name} ${col.ddl}`,
      );
    }
  }
}