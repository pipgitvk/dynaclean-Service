// app/user-dashboard/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import AttendanceTracker from "@/components/AttendanceTracker";
import ProfilePicUploader from "./ProfilePicUploader";
import InfoBox from "@/components/InfoBox";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function UserDashboardPage() {
  const cookieStore = await cookies();
  // ✅ Prioritize impersonation_token over the regular token
  const token =
    cookieStore.get("impersonation_token")?.value ||
    cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600">Unauthorized</p>;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;

    const connection = await getDbConnection();

    // The SQL query correctly finds the user based on the username from the token
    const [rows] = await connection.execute(
      `
      SELECT username, email, empId, userRole FROM emplist WHERE username = ?
      UNION
      SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
      `,
      [username, username]
    );

    const [nrows] = await connection.execute(
      `
  SELECT
    SUM(status = 'COMPLETED') AS completed_count,
    SUM(status = 'PENDING FOR SPARES') AS pending_spares_count,
    SUM(status = 'PENDING') AS pending_count
  FROM service_records
  WHERE assigned_to = ?
  `,
      [username]
    );

    const completedCount = nrows[0].completed_count;
    const pendingSparesCount = nrows[0].pending_spares_count;
    const pendingCount = nrows[0].pending_count;

    console.log(completedCount, pendingSparesCount, pendingCount);

    const user = rows[0];

    if (!user) {
      return <p className="text-red-600">User not found</p>;
    }

    return (
      <div className="space-y-3 md:space-y-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 md:p-6 bg-white rounded-xl shadow-md">
          <ProfilePicUploader user={user} />
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-2xl md:text-4xl font-semibold text-gray-900 tracking-tight">
              Welcome, <span className="text-green-700">{user.username}</span>
            </h1>
            <p className="text-sm font-medium text-gray-500">
              Role:{" "}
              <span className="text-gray-700">
                {user.userRole === "HR" ? "HR Executive" : user.userRole}
              </span>
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <AttendanceTracker username={user.username} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <InfoBox
            title="Completed"
            number={completedCount}
            url="/user-dashboard/view_service_reports?status=COMPLETED"
            bgColor="#10b981"
          />
          <InfoBox
            title="Pending"
            number={pendingCount}
            url="/user-dashboard/view_service_reports?status=PENDING"
            bgColor="#ef4444"
          />
          <InfoBox
            title="PENDING FOR SPARES"
            number={pendingSparesCount}
            url="/user-dashboard/view_service_reports?status=PENDING FOR SPARES"
            bgColor="#e08719"
          />
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <UpcomingTasks leadSource={username} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Dashboard error:", error.message);
    return <p className="text-red-600">Failed to load dashboard</p>;
  }
}
