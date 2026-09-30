import {
  FFMPEG_CORE_VERSION,
  MAX_VIDEO_DURATION_SEC,
  VIDEO_COMPRESS_PROFILES,
  VIDEO_COMPRESS_SKIP_BELOW_BYTES,
  VIDEO_TARGET_MAX_BYTES,
} from "@/lib/serviceReportVideoLimits";

let ffmpegPromise = null;

const CANCELLED_ERROR = "VIDEO_UPLOAD_CANCELLED";

function throwIfCancelled(isCancelled) {
  if (isCancelled?.()) {
    const error = new Error(CANCELLED_ERROR);
    error.code = CANCELLED_ERROR;
    throw error;
  }
}

export function isVideoUploadCancelled(error) {
  return error?.code === CANCELLED_ERROR || error?.message === CANCELLED_ERROR;
}

export async function cancelActiveVideoCompression() {
  if (!ffmpegPromise) return;
  try {
    const ffmpeg = await ffmpegPromise;
    ffmpeg.terminate();
  } catch {
    // ignore terminate errors
  }
  ffmpegPromise = null;
}

function guessInputExtension(file) {
  const fromName = String(file?.name || "").match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromName && ["mp4", "mov", "webm", "3gp", "mkv", "m4v", "avi"].includes(fromName)) {
    return fromName;
  }
  const type = String(file?.type || "").toLowerCase();
  if (type.includes("quicktime")) return "mov";
  if (type.includes("webm")) return "webm";
  if (type.includes("3gpp")) return "3gp";
  if (type.includes("matroska")) return "mkv";
  return "mp4";
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

function buildFfmpegArgs(inputName, outputName, profile) {
  return [
    "-i",
    inputName,
    "-t",
    String(MAX_VIDEO_DURATION_SEC),
    "-vf",
    `scale='min(${profile.maxWidth},iw)':-2,fps=${profile.fps}`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    String(profile.crf),
    "-maxrate",
    profile.maxrate,
    "-bufsize",
    profile.bufsize,
    "-an",
    "-movflags",
    "+faststart",
    outputName,
  ];
}

async function encodeWithProfile(ffmpeg, file, profile, onProgress) {
  const progressHandler = ({ progress }) => {
    if (onProgress && Number.isFinite(progress)) {
      onProgress(Math.min(99, Math.round(progress * 100)));
    }
  };

  ffmpeg.on("progress", progressHandler);
  try {
    const { fetchFile } = await import("@ffmpeg/util");
    const inputExt = guessInputExtension(file);
    const inputName = `input.${inputExt}`;
    const outputName = `output-${profile.maxWidth}.mp4`;

    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec(buildFfmpegArgs(inputName, outputName, profile));

    const output = await ffmpeg.readFile(outputName);
    const bytes = output instanceof Uint8Array ? output : new Uint8Array(output);
    const compressed = new File(
      [bytes],
      file.name.replace(/\.[^.]+$/, "") + `-${profile.maxWidth}p.mp4`,
      { type: "video/mp4" },
    );

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore cleanup errors
    }

    return compressed;
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}

/**
 * Lightweight fallback when FFmpeg is unavailable (common on some phones).
 * Re-encodes without audio at low bitrate. Runs in roughly real time.
 */
async function compressWithMediaRecorder(file, profile, onProgress) {
  const maxWidth = profile.maxWidth;
  const videoBitsPerSecond = profile.maxWidth <= 480 ? 350_000 : 500_000;
  const fps = profile.fps;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = async () => {
      try {
        const duration = Math.min(video.duration, MAX_VIDEO_DURATION_SEC);
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
        const height = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";

        const stream = canvas.captureStream(fps);
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
        const chunks = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(objectUrl);
          const blob = new Blob(chunks, { type: mimeType });
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, "") + "-mobile.webm", {
              type: blob.type,
            }),
          );
        };

        recorder.start(250);
        video.currentTime = 0;
        await video.play();

        const tick = () => {
          if (video.ended || video.currentTime >= duration) {
            video.pause();
            recorder.stop();
            onProgress?.(99);
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);
          onProgress?.(Math.min(98, Math.round((video.currentTime / duration) * 100)));
          requestAnimationFrame(tick);
        };
        tick();
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read video for compression."));
    };
  });
}

/**
 * Compress a service-report video in the browser before Cloudinary upload.
 * Falls back to the original file only if every method fails.
 */
export async function compressServiceReportVideo(file, onProgress, isCancelled) {
  if (!file) {
    onProgress?.(100);
    return file;
  }

  throwIfCancelled(isCancelled);

  if (file.size <= VIDEO_COMPRESS_SKIP_BELOW_BYTES) {
    onProgress?.(100);
    return file;
  }

  let best = file;

  try {
    onProgress?.(1);
    const ffmpeg = await loadFfmpeg();
    throwIfCancelled(isCancelled);

    for (let index = 0; index < VIDEO_COMPRESS_PROFILES.length; index += 1) {
      throwIfCancelled(isCancelled);
      const profile = VIDEO_COMPRESS_PROFILES[index];
      const encoded = await encodeWithProfile(ffmpeg, file, profile, (value) => {
        const slice = 100 / VIDEO_COMPRESS_PROFILES.length;
        onProgress?.(Math.round(index * slice + (value / 100) * slice));
      });

      if (encoded.size < best.size) {
        best = encoded;
      }

      if (encoded.size <= VIDEO_TARGET_MAX_BYTES) {
        onProgress?.(100);
        console.info(
          `[video] compressed ${formatMb(file.size)} → ${formatMb(encoded.size)} (${profile.maxWidth}p)`,
        );
        return encoded;
      }
    }

    onProgress?.(100);
    if (best.size < file.size) {
      console.info(`[video] compressed ${formatMb(file.size)} → ${formatMb(best.size)}`);
      return best;
    }
    return file;
  } catch (ffmpegError) {
    if (isVideoUploadCancelled(ffmpegError)) throw ffmpegError;
    console.warn("[compressServiceReportVideo] ffmpeg failed, trying recorder fallback:", ffmpegError);
  }

  try {
    throwIfCancelled(isCancelled);
    const profile = VIDEO_COMPRESS_PROFILES[0];
    const recorded = await compressWithMediaRecorder(file, profile, onProgress);
    if (recorded.size < best.size) {
      console.info(`[video] recorder fallback ${formatMb(file.size)} → ${formatMb(recorded.size)}`);
      return recorded;
    }
  } catch (recorderError) {
    console.warn("[compressServiceReportVideo] recorder fallback failed:", recorderError);
  }

  onProgress?.(100);
  return best.size < file.size ? best : file;
}
