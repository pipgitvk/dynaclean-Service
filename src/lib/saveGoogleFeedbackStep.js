import { ensureGoogleFeedbackStepColumns } from "@/lib/ensureGoogleFeedbackStepColumns";
import {
  ensureServiceRecordsGoogleFeedbackColumns,
  normalizeGoogleFeedbackCollected,
} from "@/lib/ensureServiceRecordsGoogleFeedbackColumns";
import {
  isGoogleFeedbackCloudinaryEnabled,
  uploadGoogleFeedbackProofToCloudinary,
} from "@/lib/uploadGoogleFeedbackProof";

async function syncServiceRecordsGoogleFeedback(conn, serviceId, collected, proofFileName) {
  await ensureServiceRecordsGoogleFeedbackColumns(conn);
  const yesNo = normalizeGoogleFeedbackCollected(collected);
  await conn.execute(
    `UPDATE service_records
     SET google_feedback_collected = ?,
         google_feedback_collection = NULL,
         google_feedback_proof = ?
     WHERE service_id = ?`,
    [yesNo || null, proofFileName || null, serviceId],
  );
}

/**
 * Persists completion-step Google feedback fields on service_report_steps.
 */
export async function saveGoogleFeedbackStep(conn, serviceId, formData) {
  await ensureGoogleFeedbackStepColumns(conn);

  const collected = String(formData.get("google_feedback_collected") || "").trim().toUpperCase();
  const completionDate = String(formData.get("completion_step_date") || "").trim();
  const completedBy = String(formData.get("completed_by_engineer") || "").trim();
  if (!collected || !["YES", "NO"].includes(collected)) {
    return { ok: false, message: "Select whether Google feedback was collected." };
  }

  if (collected === "YES") {
    const file = formData.get("google_feedback_file");
    const existingProof = String(formData.get("google_feedback_existing_proof") || "").trim();
    let proofUrl = existingProof.startsWith("http") ? existingProof : "";

    if (file && typeof file !== "string" && file.size > 0) {
      if (file.size > 25 * 1024 * 1024) {
        return { ok: false, message: "Google feedback file is too large. Maximum size is 25 MB." };
      }
      if (!isGoogleFeedbackCloudinaryEnabled()) {
        return { ok: false, message: "Cloudinary is not configured." };
      }
      try {
        proofUrl = await uploadGoogleFeedbackProofToCloudinary(file, serviceId);
      } catch (err) {
        console.error("[saveGoogleFeedbackStep] Cloudinary upload failed:", err);
        return { ok: false, message: "Could not upload Google feedback file." };
      }
    }

    if (!proofUrl) {
      return { ok: false, message: "Upload the Google feedback file (PDF or image)." };
    }

    await conn.execute(
      `INSERT INTO service_report_steps (
          service_id,
          completion_step_date,
          completed_by_engineer,
          google_feedback_collected,
          google_feedback_collection,
          google_feedback_file
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          completion_step_date = VALUES(completion_step_date),
          completed_by_engineer = VALUES(completed_by_engineer),
          google_feedback_collected = VALUES(google_feedback_collected),
          google_feedback_collection = VALUES(google_feedback_collection),
          google_feedback_file = VALUES(google_feedback_file)`,
      [serviceId, completionDate || null, completedBy || null, collected, null, proofUrl],
    );
    await syncServiceRecordsGoogleFeedback(conn, serviceId, collected, proofUrl);
    return { ok: true };
  }

  await conn.execute(
    `INSERT INTO service_report_steps (
        service_id,
        completion_step_date,
        completed_by_engineer,
        google_feedback_collected,
        google_feedback_collection,
        google_feedback_file
      ) VALUES (?, ?, ?, ?, NULL, NULL)
      ON DUPLICATE KEY UPDATE
        completion_step_date = VALUES(completion_step_date),
        completed_by_engineer = VALUES(completed_by_engineer),
        google_feedback_collected = VALUES(google_feedback_collected),
        google_feedback_collection = NULL,
        google_feedback_file = NULL`,
    [serviceId, completionDate || null, completedBy || null, collected],
  );
  await syncServiceRecordsGoogleFeedback(conn, serviceId, collected, null);
  return { ok: true };
}