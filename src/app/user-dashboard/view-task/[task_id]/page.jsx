// app/view-task/[task_id]/page.jsx
import { getDbConnection } from "@/lib/db";
import Image from "next/image";
import { notFound } from "next/navigation";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

async function getTaskDetails(taskId) {
  const connection = await getDbConnection();

  // Task
  const [taskRows] = await connection.execute(
    `SELECT * FROM task WHERE task_id = ?`,
    [taskId],
  );
  if (taskRows.length === 0) {
    // await connection.end();
    return null;
  }

  const task = taskRows[0];

  // Follow-ups
  const [followupRows] = await connection.execute(
    `SELECT followed_date, notes FROM task_followup WHERE task_id = ?`,
    [taskId],
  );

  // await connection.end();

  return { task, followups: followupRows };
}

export default async function ViewTaskPage({ params }) {
  const { task_id } = await params;
  // console.log("view task", task_id);
  const data = await getTaskDetails(task_id);

  if (!data) return notFound();

  const { task, followups } = data;
  const images = task.visiting_card?.split(",") || [];
  const videos = task.task_video?.split(",") || [];

  const formatDate = (d) =>
    d ? dayjs(d).format("DD MMM YYYY, hh:mm A") : "Not set";

  return (
    <div className=" mx-auto px-4 py-8">
      <h1 className="text-3xl  mb-6 text-gray-800">Task Details</h1>

      <div className="bg-white shadow-md rounded-xl p-6 space-y-4 text-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {/* <div>
            <strong>Task ID:</strong> {task.task_id}
          </div> */}
          <div>
            <strong>Task Name:</strong> {task.taskname}
          </div>
          <div>
            <strong>Status:</strong> {task.status}
          </div>
          <div>
            <strong>Description:</strong> {task.notes}
          </div>
          <div>
            <strong>Assigned Date:</strong> {formatDate(task.followed_date)}
          </div>
          <div>
            <strong>Assigned By:</strong> {task.createdby}
          </div>
          <div>
            <strong>Deadline:</strong> {formatDate(task.next_followup_date)}
          </div>
          <div>
            <strong>Priority:</strong> {task.task_prior}
          </div>
          <div>
            <strong>Category:</strong> {task.task_catg}
          </div>
        </div>

        {/* Media Files */}
        {(images.some((img) => img.trim()) ||
          videos.some((vid) => vid.trim())) && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">
              Media Files
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img, i) => {
                const src = `/uploads/${img.trim()}`;
                const ext = src.split(".").pop().toLowerCase();
                if (!img.trim()) return null;

                if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
                  return (
                    <Image
                      key={i}
                      src={src}
                      alt="Image"
                      width={300}
                      height={200}
                      className="rounded-lg shadow-sm object-cover w-full h-48"
                    />
                  );
                } else if (ext === "pdf") {
                  return (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      download
                      className="block bg-blue-600 text-white px-4 py-2 rounded-md text-center text-sm"
                    >
                      Download PDF
                    </a>
                  );
                }

                return null;
              })}

              {videos.map((vid, i) => {
                if (!vid.trim()) return null;

                return (
                  <video
                    key={i}
                    src={`/uploads/${vid.trim()}`}
                    controls
                    className="rounded-lg shadow-sm w-full h-48 object-cover"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Follow-up Table */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">
            Follow-up History
          </h3>
          {followups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Followed Date</th>
                    <th className="px-4 py-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.map((f, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">
                        {formatDate(f.followed_date)}
                      </td>
                      <td className="px-4 py-2">{f.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No follow-ups found.</p>
          )}
        </div>

        <div className="mt-6">
          <a
            href={`/user-dashboard/followup_task/${task_id}`}
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm"
          >
            Follow Task
          </a>
        </div>
      </div>
    </div>
  );
}
