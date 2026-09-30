const CLOUDINARY_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function parseJsonResponse(xhr) {
  try {
    return JSON.parse(xhr.responseText || "{}");
  } catch {
    return {};
  }
}

/**
 * Upload a video directly to Cloudinary (browser → Cloudinary).
 * Avoids sending the full file through the Next.js server.
 */
const CANCELLED_ERROR = "VIDEO_UPLOAD_CANCELLED";

export function isVideoUploadCancelled(error) {
  return error?.code === CANCELLED_ERROR || error?.message === CANCELLED_ERROR;
}

export function uploadServiceReportVideoToCloudinary(file, signParams, onProgress, xhrRef) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (xhrRef) xhrRef.current = xhr;
    const url = `https://api.cloudinary.com/v1_1/${signParams.cloudName}/video/upload`;

    xhr.open("POST", url);
    xhr.timeout = CLOUDINARY_UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const data = parseJsonResponse(xhr);
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        resolve(data);
        return;
      }
      reject(new Error(data.error?.message || "Video upload failed. Please try again."));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading video."));
    xhr.onabort = () => {
      const error = new Error(CANCELLED_ERROR);
      error.code = CANCELLED_ERROR;
      reject(error);
    };
    xhr.ontimeout = () =>
      reject(new Error("Video upload timed out. Check your connection and try again."));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signParams.apiKey);
    formData.append("timestamp", String(signParams.timestamp));
    formData.append("signature", signParams.signature);
    formData.append("folder", signParams.folder);
    formData.append("public_id", signParams.public_id);
    xhr.send(formData);
  });
}

export async function saveServiceReportVideoStep(serviceId, action, videoUrl, duration) {
  const formData = new FormData();
  formData.append("action", action);
  formData.append("video_url", videoUrl);
  formData.append("duration", String(duration));

  const res = await fetch(`/api/service-report-steps/${serviceId}`, {
    method: "POST",
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || "Could not save this step.");
  }
  return body;
}

export async function fetchServiceReportVideoUploadSignature(serviceId, step) {
  const formData = new FormData();
  formData.append("action", "sign_upload");
  formData.append("step", step);

  const res = await fetch(`/api/service-report-steps/${serviceId}`, {
    method: "POST",
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || "Could not prepare video upload.");
  }
  return body;
}
