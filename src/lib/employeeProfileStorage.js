import fs from "fs/promises";
import path from "path";
import {
  isExpenseCloudinaryEnabled,
  uploadEmployeeProfileBufferToCloudinary,
} from "@/lib/expenseCloudinaryUpload";
import { sanitizeAttachmentFilename } from "@/lib/expenseAttachments";

/**
 * Upload a profile document: Cloudinary when configured, else public/employees/{username}/profile_docs/
 */
export async function uploadEmployeeProfileDocument(buffer, originalName, username) {
  const safeUser = String(username || "user").replace(/[^a-zA-Z0-9._-]/g, "_");

  if (isExpenseCloudinaryEnabled()) {
    try {
      return await uploadEmployeeProfileBufferToCloudinary(buffer, originalName, safeUser);
    } catch (e) {
      console.warn("[employee-profile] Cloudinary upload failed, using local:", e?.message);
    }
  }

  const dir = path.join(process.cwd(), "public", "employees", safeUser, "profile_docs");
  await fs.mkdir(dir, { recursive: true });
  const base = sanitizeAttachmentFilename(originalName);
  const fileName = `${Date.now()}-${base}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return `/employees/${safeUser}/profile_docs/${encodeURIComponent(fileName)}`;
}
