"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";

export default function ClientTaskTable({ initialTasks }) {
  const [search, setSearch] = useState("");
  const [filteredTasks, setFilteredTasks] = useState(initialTasks);

  useEffect(() => {
    const lower = search.toLowerCase();
    const filtered = initialTasks.filter(
      (task) =>
        task.taskname.toLowerCase().includes(lower) ||
        task.taskassignto.toLowerCase().includes(lower) ||
        task.createdby.toLowerCase().includes(lower)
    );
    setFilteredTasks(filtered);
  }, [search, initialTasks]);

  return (
    <>
      {/* Search Input */}
      <div className="mb-6 flex flex-col md:flex-row justify-between gap-4 text-gray-700">
        <input
          type="text"
          placeholder="🔍 Search task name or assignee..."
          className="border p-2 rounded-md w-full md:max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table Wrapper */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="min-w-full hidden md:table bg-white text-sm text-gray-700">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2">Task ID</th>
              <th className="px-4 py-2">Task Name</th>
              <th className="px-4 py-2">Created By</th>
              <th className="px-4 py-2">Assigned To</th>
              <th className="px-4 py-2">Reassigned</th>
              <th className="px-4 py-2">Assign Date</th>
              <th className="px-4 py-2">Deadline</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Completion</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <tr key={task.task_id} className="border-t">
                  <td className="px-4 py-2">{task.task_id}</td>
                  <td className="px-4 py-2">{task.taskname}</td>
                  <td className="px-4 py-2">{task.createdby}</td>
                  <td className="px-4 py-2">{task.first_assignto}</td>
                  <td className="px-4 py-2">{task.reassign}</td>
                  <td className="px-4 py-2">
                    {dayjs(task.followed_date).format("DD/MM/YYYY")}
                  </td>
                  <td className="px-4 py-2">
                    {dayjs(task.next_followup_date).format("DD/MM/YYYY")}
                  </td>
                  <td className="px-4 py-2">{task.status}</td>
                  <td className="px-4 py-2">
                    {task.task_completion_date
                      ? dayjs(task.task_completion_date).format("DD/MM/YYYY")
                      : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={`/user-dashboard/view-task/${task.task_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center px-4 py-6 text-gray-500">
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile view cards */}
        <div className="md:hidden space-y-4 p-2">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <div
                key={task.task_id}
                className="border rounded-lg p-4 shadow-sm bg-white"
              >
                <div className="text-sm mb-2">
                  <strong>Task ID:</strong> {task.task_id}
                </div>
                <div className="text-sm mb-2">
                  <strong>Task Name:</strong> {task.taskname}
                </div>
                <div className="text-sm mb-2">
                  <strong>Created By:</strong> {task.createdby}
                </div>
                <div className="text-sm mb-2">
                  <strong>Assigned To:</strong> {task.taskassignto}
                </div>
                <div className="text-sm mb-2">
                  <strong>Assign Date:</strong>{" "}
                  {dayjs(task.followed_date).format("DD/MM/YYYY")}
                </div>
                <div className="text-sm mb-2">
                  <strong>Deadline:</strong>{" "}
                  {dayjs(task.next_followup_date).format("DD/MM/YYYY")}
                </div>
                <div className="text-sm mb-2">
                  <strong>Status:</strong> {task.status}
                </div>
                <div className="text-sm mb-2">
                  <strong>Completion:</strong>{" "}
                  {task.task_completion_date
                    ? dayjs(task.task_completion_date).format("DD/MM/YYYY")
                    : "-"}
                </div>
                <div className="text-sm mt-2">
                  <a
                    href={`/user-dashboard/view-task/${task.task_id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    View Task →
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-6">
              No tasks found.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
