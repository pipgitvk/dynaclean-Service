import { getDbConnection } from "@/lib/db";

export async function ensureServiceRecordsCompletedAtColumn(conn) {
  const db = conn || (await getDbConnection());
  const [cols] = await db.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'service_records'
       AND COLUMN_NAME = 'completed_at'`,
  );

  if (cols.length === 0) {
    await db.execute(
      `ALTER TABLE service_records
       ADD COLUMN completed_at DATETIME NULL AFTER completed_date`,
    );
    await db.execute(
      `UPDATE service_records
       SET completed_at = CONCAT(completed_date, ' 12:00:00')
       WHERE UPPER(TRIM(status)) = 'COMPLETED'
         AND completed_at IS NULL
         AND completed_date IS NOT NULL`,
    );
  }

  return db;
}
