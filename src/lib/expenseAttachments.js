import path from "path";

const DEFAULT_DIR = path.join(process.cwd(), "storage", "expense_attachments");
const SAFE_FILENAME_REGEX = /[^a-zA-Z0-9._-]/g;

export function getExpenseAttachmentsDir() {
  const configuredDir = process.env.EXPENSE_ATTACHMENTS_DIR?.trim();
  return configuredDir ? path.resolve(configuredDir) : DEFAULT_DIR;
}

export function sanitizeAttachmentFilename(fileName = "") {
  const baseName = path.basename(fileName);
  const sanitized = baseName.replace(SAFE_FILENAME_REGEX, "_");
  return sanitized || `attachment-${Date.now()}.bin`;
}

export function buildAttachmentFileName(originalName = "") {
  const safeName = sanitizeAttachmentFilename(originalName);
  return `${Date.now()}-${safeName}`;
}

export function buildAttachmentApiUrl(fileName = "") {
  const safeName = sanitizeAttachmentFilename(fileName);
  return `/api/expense-attachments/${encodeURIComponent(safeName)}`;
}

export function normalizeAttachmentUrl(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  // Cloudinary / any absolute URL — works on every domain (shared DB)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/api/expense-attachments/")) {
    return trimmed;
  }

  const baseName = path.basename(trimmed.split("?")[0]);
  return buildAttachmentApiUrl(baseName);
}
