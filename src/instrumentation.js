// src/instrumentation.js
// Runs once when the Next.js server starts (Node.js runtime only)

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");

    // Auto checkout all employees who haven't checked out — runs at 6:30 PM every day
    cron.default.schedule(
      "30 18 * * *",
      async () => {
        console.log("[Auto-Checkout] Running 6:30 PM auto-checkout...");
        try {
          const { getDbConnection } = await import("@/lib/db");
          const conn = await getDbConnection();
          const now = new Date();
          const today = now.toISOString().slice(0, 10);

          const [result] = await conn.execute(
            `UPDATE attendance_logs
             SET checkout_time = ?,
                 checkout_address = 'Auto checkout at 6:30 PM'
             WHERE date = ?
               AND checkin_time IS NOT NULL
               AND checkout_time IS NULL`,
            [now, today]
          );

          console.log(
            `[Auto-Checkout] Done — ${result.affectedRows} employee(s) checked out automatically.`
          );
        } catch (err) {
          console.error("[Auto-Checkout] Error:", err.message);
        }
      },
      {
        timezone: "Asia/Kolkata",
      }
    );

    console.log("[Auto-Checkout] Cron job scheduled at 6:30 PM IST daily.");
  }
}
