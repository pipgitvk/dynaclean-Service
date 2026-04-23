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
          const { getISTCalendarDate } = await import("@/lib/istDateTime");
          const conn = await getDbConnection();
          const now = new Date();
          const today = getISTCalendarDate(now);
          const scheduledCheckoutIst = `${today} 18:30:00`;

          const [result] = await conn.execute(
            `UPDATE attendance_logs al
             JOIN rep_list rl ON al.username = rl.username
             SET al.checkout_time = ?,
                 al.checkout_address = 'Auto checkout at 6:30 PM',
                 al.checkout_latitude = IFNULL(al.checkin_latitude, 0),
                 al.checkout_longitude = IFNULL(al.checkin_longitude, 0)
             WHERE al.date = ?
               AND rl.userRole = 'SERVICE ENGINEER'
               AND al.checkin_time IS NOT NULL
               AND (al.checkout_time IS NULL OR al.checkout_time = '' OR al.checkout_time = '0000-00-00 00:00:00')`,
            [scheduledCheckoutIst, today]
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
