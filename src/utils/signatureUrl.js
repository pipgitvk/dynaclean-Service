/**
 * Build a browser-usable URL for a signature path stored in the DB.
 * Handles: bare filename, "signatures/foo.png" (avoid /signatures/signatures/),
 * absolute paths, https URLs, and data URLs.
 */
export function getSignatureImageSrc(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
  if (s.startsWith("/")) return s;
  if (s.startsWith("signatures/")) return `/${s}`;
  return `/signatures/${s}`;
}
