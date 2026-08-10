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

/**
 * Build a browser-usable URL for service completion files (attachments,
 * pre_completion, after_completion, installation_report) stored in the DB.
 *
 * Handles all legacy formats:
 *   - bare filename            → /completion_files/foo.jpeg
 *   - completion_files/foo     → /completion_files/foo
 *   - /completion_files/foo    → /completion_files/foo  (strips doubled slash)
 *   - attachments/foo         → /attachments/foo     (saved via upload-installation)
 *   - /attachments/foo        → /attachments/foo
 *   - http(s):// or data:     → returned as-is
 */
export function getCompletionFileSrc(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;

  // Strip any leading slashes first so prefix checks are predictable
  let stripped = s.replace(/^\/+/, "");

  if (stripped.startsWith("attachments/")) {
    return `/${stripped}`;
  }
  if (stripped.startsWith("completion_files/")) {
    return `/${stripped}`;
  }
  // Bare filename — assume lives in completion_files folder
  return `/completion_files/${stripped}`;
}

/**
 * Same as getSignatureImageSrc but adds cache-busting query params so browsers/proxies
 * don't keep a blank/stale PNG after a new file is written with the same name.
 * @param {string|number} [responseBust] - e.g. API `fetchedAt` timestamp (preferred).
 */
export function getSignatureImageSrcNoCache(raw, responseBust) {
  const base = getSignatureImageSrc(raw);
  if (!base) return null;
  const v = encodeURIComponent(String(raw).trim());
  // Prefer API `fetchedAt`; otherwise reuse path as bust so URLs stay stable across re-renders
  const b =
    responseBust != null && responseBust !== ""
      ? String(responseBust)
      : v;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${v}&bust=${encodeURIComponent(b)}`;
}
