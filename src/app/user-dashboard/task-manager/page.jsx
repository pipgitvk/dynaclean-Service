import { getDbConnection } from "@/lib/db";
import ClientTaskTable from "@/components/task/ClientTaskTable";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getTasks(username) {
  const conn = await getDbConnection();

  const query = `
    SELECT 
      t.task_id, 
      t.taskname, 
      t.createdby, 
      t.taskassignto, 
      tf.reassign, 
      tf.taskassignto AS first_assignto, 
      t.followed_date, 
      t.next_followup_date, 
      t.status, 
      t.task_completion_date
    FROM 
      task t
    LEFT JOIN 
      task_followup tf ON t.task_id = tf.task_id
    WHERE 
      (t.createdby = ? OR t.taskassignto = ? OR tf.taskassignto = ? OR tf.taskassignto IS NULL)
    ORDER BY 
      t.task_id DESC
  `;

  const [rows] = await conn.execute(query, [username, username, username]);
  // await conn.end();
  return rows;
}

export default async function TaskPage() {
  let username = "Unknown";
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }
  username = payload.username;
  if (!username) {
    return <p className="text-red-600 p-4">❌ Unauthorized</p>;
  }

  let tasks;
  try {
    tasks = await getTasks(username);
  } catch (error) {
    const msg = error?.sqlMessage ?? error?.message ?? "Unknown error";
    if (process.env.NODE_ENV === "development") {
      console.warn("[task-manager]", msg);
    }
    const isDbAuth =
      error?.code === "ER_ACCESS_DENIED_ERROR" || error?.errno === 1045;
    return (
      <div className="p-6 mx-auto">
        <p className="text-red-600">Failed to load tasks.</p>
        {isDbAuth && process.env.NODE_ENV === "development" && (
          <p className="mt-2 text-sm text-gray-700">
            Database login failed. If you use a remote host (e.g. Hostinger), set{" "}
            <code className="bg-gray-100 px-1 rounded">DB_HOST</code> to that
            hostname, not localhost, and ensure{" "}
            <code className="bg-gray-100 px-1 rounded">DB_USER</code> /{" "}
            <code className="bg-gray-100 px-1 rounded">DB_PASSWORD</code> match
            that server.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">📋 My Tasks</h1>
      <ClientTaskTable initialTasks={tasks} />
    </div>
  );
}
