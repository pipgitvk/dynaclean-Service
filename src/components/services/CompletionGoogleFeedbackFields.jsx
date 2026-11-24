"use client";

import dayjs from "dayjs";
import { Upload } from "lucide-react";

export function emptyGoogleFeedbackState(engineerName = "") {
  return {
    completionDate: dayjs().format("YYYY-MM-DD"),
    completedByEngineer: engineerName,
    googleFeedbackCollected: "",
    googleFeedbackFile: null,
    existingProofUrl: "",
  };
}

export function validateGoogleFeedbackState(state) {
  if (!state.googleFeedbackCollected) {
    return "Select whether Google feedback was collected.";
  }
  if (
    state.googleFeedbackCollected === "YES" &&
    !state.googleFeedbackFile &&
    !state.existingProofUrl
  ) {
    return "Upload the Google feedback file (PDF or image).";
  }
  return "";
}

export function appendGoogleFeedbackToFormData(formData, state) {
  formData.append("completion_step_date", state.completionDate || "");
  formData.append("completed_by_engineer", state.completedByEngineer || "");
  formData.append("google_feedback_collected", state.googleFeedbackCollected);
  if (state.googleFeedbackCollected === "YES") {
    if (state.googleFeedbackFile) {
      formData.append("google_feedback_file", state.googleFeedbackFile);
    } else if (state.existingProofUrl) {
      formData.append("google_feedback_existing_proof", state.existingProofUrl);
    }
  }
}

export default function CompletionGoogleFeedbackFields({
  variant = "installation",
  engineerName,
  value,
  onChange,
  disabled = false,
}) {
  const dateLabel =
    variant === "installation" ? "Installation completion date" : "Service completion date";

  const setField = (patch) => {
    onChange({ ...value, ...patch });
  };

  const showGoogleExtras = value.googleFeedbackCollected === "YES";

  return (
    <div className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {dateLabel} <span className="text-red-600">*</span>
        </label>
        <input
          type="date"
          readOnly
          disabled
          value={value.completionDate}
          className="w-full rounded-lg border border-gray-300 bg-gray-100 p-2 text-sm text-gray-700"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Completed by service engineer <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          readOnly
          disabled
          value={value.completedByEngineer || engineerName || "—"}
          className="w-full rounded-lg border border-gray-300 bg-gray-100 p-2 text-sm text-gray-700"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Google feedback collected? <span className="text-red-600">*</span>
        </label>
        <select
          value={value.googleFeedbackCollected}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            setField({
              googleFeedbackCollected: next,
              ...(next !== "YES" ? { googleFeedbackFile: null } : {}),
            });
          }}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
          required
        >
          <option value="">Select</option>
          <option value="YES">Yes</option>
          <option value="NO">No</option>
        </select>
      </div>

      {showGoogleExtras && (
        <label
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300 bg-purple-50 px-3 py-4 text-sm text-purple-900 hover:bg-purple-100 ${
            disabled ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Upload className="h-5 w-5 text-purple-700" />
          {value.googleFeedbackFile
            ? value.googleFeedbackFile.name
            : "Choose Google feedback file (PDF or image)"}
          <input
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const okType =
                file.type === "application/pdf" ||
                file.type.startsWith("image/") ||
                /\.(pdf|jpg|jpeg|png|webp)$/i.test(file.name);
              if (!okType) return;
              setField({ googleFeedbackFile: file });
            }}
          />
        </label>
      )}
    </div>
  );
}