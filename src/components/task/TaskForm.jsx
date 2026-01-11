"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AssignToInput from "@/components/AssigneInput/AssignToInput";

export default function TaskForm({ username }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    taskname: "",
    taskassignto: "",
    next_followup_date: "",
    task_prior: "",
    task_catg: "",
    notes: "",
  });

  const [cardFront, setCardFront] = useState(null);
  const [taskVideo, setTaskVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // Loading state

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFileChange = (e, setter) => {
    setter(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); // Set loading state to true when submitting

    const body = new FormData();
    body.append("createdby", username);
    body.append(
      "todaydate",
      new Date().toISOString().slice(0, 19).replace("T", " ")
    );

    Object.entries(formData).forEach(([key, val]) => {
      body.append(key, val);
    });

    if (cardFront) body.append("card_front", cardFront);
    if (taskVideo) body.append("task_video", taskVideo);

    try {
      const res = await fetch("/api/new-task", {
        method: "POST",
        body,
      });

      if (res.ok) {
        toast.success("✅ Task added successfully");
        router.push("/user-dashboard");
      } else {
        toast.error("❌ Failed to add task");
      }
    } catch (err) {
      console.error(err);
      toast.error("⚠️ Something went wrong");
    } finally {
      setIsLoading(false); // Set loading state back to false after submission
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 text-gray-600"
      encType="multipart/form-data"
    >
      <input type="hidden" name="createdby" value={username} />

      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">Task Name</label>
          <input
            name="taskname"
            required
            value={formData.taskname}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
        </div>

        <div className="flex-1">
          <label className="block font-semibold">Assign To</label>
          <AssignToInput
            value={formData.taskassignto}
            onChange={(val) =>
              setFormData((prev) => ({ ...prev, taskassignto: val }))
            }
          />
        </div>
      </div>

      {/* Deadline and Priority */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">Deadline (Date & Time)</label>
          <input
            type="datetime-local"
            name="next_followup_date"
            required
            value={formData.next_followup_date}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
        </div>
        <div className="flex-1">
          <label className="block font-semibold">Priority</label>
          <select
            name="task_prior"
            required
            value={formData.task_prior}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          >
            <option value="">Select</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>

      {/* Category and Description */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">Category</label>
          <select
            name="task_catg"
            required
            value={formData.task_catg}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          >
            <option value="">Select</option>
            <option value="Dispatch">Dispatch</option>
            <option value="Payment Collection">Payment Collection</option>
            <option value="Service">Service</option>
            <option value="Complaint">Complaint</option>
            <option value="Other General Task">Other General Task</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block font-semibold">Description</label>
          <textarea
            name="notes"
            required
            value={formData.notes}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
            rows={3}
          />
        </div>
      </div>

      {/* File Uploads */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">Upload Image (optional)</label>
          <input
            type="file"
            name="card_front"
            accept="image/*,.pdf"
            onChange={(e) => handleFileChange(e, setCardFront)}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
        </div>

        <div className="flex-1">
          <label className="block font-semibold">Upload Video (optional)</label>
          <input
            type="file"
            name="task_video"
            accept="video/*"
            onChange={(e) => handleFileChange(e, setTaskVideo)}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={isLoading}
          className={`bg-green-500 text-white px-6 py-2 rounded-md w-full sm:w-auto transition-all duration-200 ${
            isLoading
              ? "bg-green-300 cursor-wait pointer-events-none"
              : "hover:bg-green-700"
          }`}
        >
          {isLoading ? "Adding..." : "Add Task"}
        </button>
      </div>
    </form>
  );
}
