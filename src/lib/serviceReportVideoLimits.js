export const MAX_VIDEO_DURATION_SEC = 45;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
/** Re-encode videos larger than this before upload. */
export const VIDEO_COMPRESS_SKIP_BELOW_BYTES = 1.5 * 1024 * 1024;
/** Try to get the compressed file under this size (mobile-friendly upload). */
export const VIDEO_TARGET_MAX_BYTES = 3 * 1024 * 1024;
export const FFMPEG_CORE_VERSION = "0.12.10";

export function videoDurationErrorMessage(durationSec) {
  const rounded = Math.round(durationSec);
  return `Video is ${rounded} seconds. Maximum allowed is ${MAX_VIDEO_DURATION_SEC} seconds.`;
}

/** Aggressive presets — smaller file = faster upload on mobile data. */
export const VIDEO_COMPRESS_PROFILES = [
  { maxWidth: 640, fps: 24, crf: 32, maxrate: "500k", bufsize: "1M" },
  { maxWidth: 480, fps: 20, crf: 34, maxrate: "350k", bufsize: "700k" },
];

export function isLikelyMobileOrSlowNetwork() {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slow =
    conn?.saveData === true ||
    conn?.effectiveType === "slow-2g" ||
    conn?.effectiveType === "2g" ||
    conn?.effectiveType === "3g";
  return mobile || slow;
}
