import { v2 as cloudinary } from "cloudinary";
import { sanitizeAttachmentFilename } from "@/lib/expenseAttachments";

let configured = false;

function ensureCloudinaryConfig() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export function isExpenseCloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

/**
 * Upload raw file bytes to Cloudinary. Returns secure_url (same on every domain).
 */
export async function uploadExpenseBufferToCloudinary(buffer, originalName = "") {
  ensureCloudinaryConfig();
  const safe = sanitizeAttachmentFilename(originalName).replace(/\.[^.]+$/, "");
  const publicIdSuffix = `${Date.now()}_${safe || "file"}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "expense_attachments",
          public_id: publicIdSuffix,
          resource_type: "auto",
          overwrite: false,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        },
      )
      .end(buffer);
  });
}
