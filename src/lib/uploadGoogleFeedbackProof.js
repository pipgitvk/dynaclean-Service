import { v2 as cloudinary } from "cloudinary";

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

export function isGoogleFeedbackCloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function safeStem(name = "") {
  return String(name)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

/**
 * Upload Google feedback screenshot/PDF to Cloudinary. Returns secure_url.
 */
export async function uploadGoogleFeedbackProofToCloudinary(file, serviceId) {
  if (!isGoogleFeedbackCloudinaryEnabled()) {
    throw new Error("Cloudinary is not configured.");
  }
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0) {
    throw new Error("Invalid file.");
  }

  ensureCloudinaryConfig();
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicId = `svc${serviceId}_${Date.now()}_${safeStem(file.name) || "proof"}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `google_feedback/${serviceId}`,
          public_id: publicId,
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