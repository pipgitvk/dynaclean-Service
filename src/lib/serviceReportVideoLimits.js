export const MAX_VIDEO_DURATION_SEC = 45;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function videoDurationErrorMessage(durationSec) {
  const rounded = Math.round(durationSec);
  return `Video is ${rounded} seconds. Maximum allowed is ${MAX_VIDEO_DURATION_SEC} seconds.`;
}
