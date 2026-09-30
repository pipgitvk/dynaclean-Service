"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronLeft, Video, X } from "lucide-react";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SEC,
  videoDurationErrorMessage,
} from "@/lib/serviceReportVideoLimits";
import { getVideoDurationSeconds } from "@/utils/videoDuration";
import {
  cancelActiveVideoCompression,
  compressServiceReportVideo,
  isVideoUploadCancelled as isCompressCancelled,
} from "@/utils/compressServiceReportVideo";
import {
  fetchServiceReportVideoUploadSignature,
  isVideoUploadCancelled as isUploadCancelled,
  saveServiceReportVideoStep,
  uploadServiceReportVideoToCloudinary,
} from "@/utils/uploadServiceReportVideoClient";

const STEP_DEFS = [
  {
    key: "video_360",
    title: "360° video of machine with serial number",
    kind: "video",
    help: `Record a full 360° walk-around of the machine. The serial number must be clearly visible. Maximum video length: ${MAX_VIDEO_DURATION_SEC} seconds.`,
  },
  {
    key: "video_problem",
    title: "Problem showing video",
    kind: "video",
    help: `Record a video that shows the problem on the machine. Maximum video length: ${MAX_VIDEO_DURATION_SEC} seconds.`,
  },
  {
    key: "video_damaged",
    title: "Damaged parts video",
    kind: "video",
    help: `Record a video of the damaged parts. Maximum video length: ${MAX_VIDEO_DURATION_SEC} seconds.`,
  },
  {
    key: "work_start",
    title: "Work start",
    kind: "start",
    help: "Start the work. The service status will change to WORKED, and the Work Completed button will appear.",
  },
  {
    key: "work_complete",
    title: "Work completed",
    kind: "complete",
    help: "Status is WORKED. Tap Work Completed when the job on the machine is finished.",
  },
  {
    key: "video_completion",
    title: "Completion video",
    kind: "video",
    help: `Record a video of the machine after the work is finished. Maximum video length: ${MAX_VIDEO_DURATION_SEC} seconds. The add report form opens after this step.`,
  },
];

function isStepDone(steps, key) {
  if (!steps) return false;
  if (key === "work_start") return Boolean(steps.work_started_at);
  if (key === "work_complete") return Boolean(steps.work_completed_at);
  return Boolean(steps[key]);
}

function firstOpenIndex(steps) {
  const index = STEP_DEFS.findIndex((step) => !isStepDone(steps, step.key));
  return index === -1 ? STEP_DEFS.length : index;
}

export default function ServiceReportStepsPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params?.service_id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyKey, setBusyKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [picked, setPicked] = useState(null);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [uploadPhase, setUploadPhase] = useState("");
  const [uploadSignature, setUploadSignature] = useState(null);
  const cancelRef = useRef(false);
  const uploadXhrRef = useRef(null);

  const reportHref = `/user-dashboard/complete-service/${serviceId}`;

  const clearPickedVideo = useCallback((previewUrl) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPicked(null);
    setUploadSignature(null);
  }, []);

  const removePickedVideo = useCallback(() => {
    clearPickedVideo(picked?.preview);
    setError("");
  }, [clearPickedVideo, picked?.preview]);

  const cancelVideoAction = useCallback(async () => {
    cancelRef.current = true;
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      uploadXhrRef.current = null;
    }
    await cancelActiveVideoCompression();
    clearPickedVideo(picked?.preview);
    setBusyKey("");
    setProgress(0);
    setUploadPhase("");
    setError("");
    cancelRef.current = false;
  }, [clearPickedVideo, picked?.preview]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/service-report-steps/${serviceId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to load steps");
      if (String(body.service?.service_type || "").trim().toUpperCase() !== "COMPLAINT") {
        router.replace(`/user-dashboard/complete-service/${serviceId}`);
        return;
      }
      setData(body);
      setActiveIndex(firstOpenIndex(body.steps));
    } catch (err) {
      setError(err.message || "Failed to load steps");
    } finally {
      setLoading(false);
    }
  }, [serviceId, router]);

  useEffect(() => {
    if (serviceId) load();
  }, [serviceId, load]);

  const openIndex = useMemo(() => firstOpenIndex(data?.steps), [data]);
  const allDone = openIndex >= STEP_DEFS.length;

  const saveAction = async (action, file, durationSec) => {
    setError("");
    cancelRef.current = false;
    setBusyKey(action);
    setProgress(file ? 1 : 0);
    setUploadPhase(file ? "compressing" : "");
    try {
      let body;
      if (file) {
        let duration = durationSec;
        if (duration == null) {
          duration = await getVideoDurationSeconds(file);
        }
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new Error("Could not read video length.");
        }
        if (duration > MAX_VIDEO_DURATION_SEC) {
          throw new Error(videoDurationErrorMessage(duration));
        }

        const compressedFile = await compressServiceReportVideo(
          file,
          setProgress,
          () => cancelRef.current,
        );
        if (cancelRef.current) return;

        setUploadPhase("uploading");
        setProgress(0);

        let signParams = uploadSignature?.step === action ? uploadSignature.params : null;
        if (!signParams) {
          signParams = await fetchServiceReportVideoUploadSignature(serviceId, action);
        }
        setUploadSignature(null);
        if (cancelRef.current) return;

        const uploaded = await uploadServiceReportVideoToCloudinary(
          compressedFile,
          signParams,
          setProgress,
          uploadXhrRef,
        );
        if (cancelRef.current) return;

        setUploadPhase("saving");
        body = await saveServiceReportVideoStep(
          serviceId,
          action,
          uploaded.secure_url,
          duration,
        );
      } else {
        const formData = new FormData();
        formData.append("action", action);
        const res = await fetch(`/api/service-report-steps/${serviceId}`, {
          method: "POST",
          body: formData,
        });
        body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || "Could not save this step.");
        }
      }

      setData(body);
      clearPickedVideo(picked?.preview);
      const next = firstOpenIndex(body.steps);
      setActiveIndex(next);
      if (action === "video_completion") {
        router.push(reportHref);
      }
    } catch (err) {
      if (isCompressCancelled(err) || isUploadCancelled(err) || cancelRef.current) {
        return;
      }
      setError(err.message || "Could not save this step.");
    } finally {
      if (!cancelRef.current) {
        setBusyKey("");
        setProgress(0);
        setUploadPhase("");
      }
      uploadXhrRef.current = null;
    }
  };

  const onPickFile = async (event, stepKey) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|3gp|mkv|m4v|avi)$/i.test(file.name)) {
      setError("Choose a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Video is too large. Maximum size is 200 MB.");
      return;
    }

    setCheckingVideo(true);
    setError("");
    try {
      const duration = await getVideoDurationSeconds(file);
      if (!Number.isFinite(duration) || duration <= 0) {
        setError("Could not read video length.");
        return;
      }
      if (duration > MAX_VIDEO_DURATION_SEC) {
        setError(videoDurationErrorMessage(duration));
        return;
      }
      setPicked({ file, preview: URL.createObjectURL(file), duration });
      setUploadSignature(null);

      if (stepKey) {
        fetchServiceReportVideoUploadSignature(serviceId, stepKey)
          .then((params) => setUploadSignature({ step: stepKey, params }))
          .catch(() => setUploadSignature(null));
      }
    } catch {
      setError("Could not read video length.");
    } finally {
      setCheckingVideo(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <Link
        href="/user-dashboard/view_service_reports?status=PENDING"
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Service Reports
      </Link>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Service report steps</h1>
        <p className="mt-1 text-sm text-gray-500">
          Complete these 6 steps on site. Each video must be {MAX_VIDEO_DURATION_SEC} seconds or shorter.
          Videos are compressed to about 2–3 MB before upload for faster mobile data transfer.
          The add report form opens after the completion video.
        </p>
        {data?.service && (
          <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <p><span className="font-medium text-gray-500">Service ID:</span> {data.service.service_id}</p>
            <p>
              <span className="font-medium text-gray-500">Status:</span>{" "}
              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                String(data.service.status).toUpperCase() === "WORKED"
                  ? "bg-amber-100 text-amber-800"
                  : String(data.service.status).toUpperCase() === "COMPLETED"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
              }`}>
                {data.service.status || "—"}
              </span>
            </p>
            <p><span className="font-medium text-gray-500">Serial:</span> {data.service.serial_number || "—"}</p>
            <p><span className="font-medium text-gray-500">Type:</span> {data.service.service_type || "—"}</p>
            <p className="sm:col-span-2">
              <span className="font-medium text-gray-500">Complaint:</span> {data.service.complaint_summary || "—"}
            </p>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading steps…</p>}
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!loading && data && (
        <ol className="space-y-3">
          {STEP_DEFS.map((step, index) => {
            const done = isStepDone(data.steps, step.key);
            const locked = index > openIndex;
            const isActiveCard = !locked && index === (activeIndex >= STEP_DEFS.length ? STEP_DEFS.length - 1 : activeIndex);

            return (
              <li key={step.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    clearPickedVideo(picked?.preview);
                    setActiveIndex(index);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    done ? "bg-green-600 text-white" : isActiveCard ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                  }`}>
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">{step.title}</span>
                    <span className="block text-xs text-gray-500">
                      {done ? "Done" : locked ? "Locked" : index === openIndex ? "Current step" : "Open"}
                    </span>
                  </span>
                </button>

                {isActiveCard && (
                  <div className="border-t border-gray-100 px-4 py-4">
                    <p className="mb-4 text-sm text-gray-600">{step.help}</p>

                    {step.kind === "video" && (
                      <div className="space-y-3">
                        {(picked?.preview || data.steps[step.key]) && (
                          <div className="relative">
                            <video
                              key={picked?.preview || data.steps[step.key]}
                              src={picked?.preview || data.steps[step.key]}
                              controls
                              className="max-h-72 w-full rounded-lg bg-black"
                            />
                            {picked?.preview && (
                              <button
                                type="button"
                                onClick={
                                  busyKey === step.key ? cancelVideoAction : removePickedVideo
                                }
                                className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white shadow hover:bg-black"
                                aria-label="Remove video"
                                title="Remove video"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-5 text-sm text-blue-800 ${
                            busyKey === step.key ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-blue-100"
                          }`}>
                            <Video className="h-5 w-5" />
                            Record video
                            <input
                              type="file"
                              accept="video/*"
                              capture="environment"
                              className="hidden"
                              disabled={busyKey === step.key}
                              onChange={(event) => onPickFile(event, step.key)}
                            />
                          </label>
                          <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-5 text-sm text-blue-800 ${
                            busyKey === step.key ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-blue-100"
                          }`}>
                            <Video className="h-5 w-5" />
                            Choose video
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              disabled={busyKey === step.key}
                              onChange={(event) => onPickFile(event, step.key)}
                            />
                          </label>
                        </div>
                        {picked?.preview && busyKey === step.key && (
                          <button
                            type="button"
                            onClick={cancelVideoAction}
                            className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                          >
                            Cancel upload
                          </button>
                        )}
                        {checkingVideo && (
                          <p className="text-sm text-gray-500">Checking video length…</p>
                        )}
                        {picked && (
                          <button
                            type="button"
                            disabled={Boolean(busyKey) || checkingVideo}
                            onClick={() => saveAction(step.key, picked.file, picked.duration)}
                            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                          >
                            {busyKey === step.key && uploadPhase === "compressing"
                              ? `Compressing ${progress}%`
                              : busyKey === step.key && uploadPhase === "saving"
                                ? "Saving…"
                                : busyKey === step.key
                                  ? `Uploading ${progress}%`
                                  : "Save video"}
                          </button>
                        )}
                        {busyKey === step.key && uploadPhase === "compressing" && (
                          <p className="text-xs text-gray-500">
                            Compressing video for faster upload… Please keep this page open.
                          </p>
                        )}
                        {busyKey === step.key && uploadPhase === "uploading" && progress > 0 && progress < 100 && (
                          <p className="text-xs text-gray-500">
                            Uploading to cloud… Please keep this page open.
                          </p>
                        )}
                        {done && step.key === "video_completion" && (
                          <button
                            type="button"
                            onClick={() => router.push(reportHref)}
                            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
                          >
                            Add Report
                          </button>
                        )}
                        {done && step.key !== "video_completion" && (
                          <button
                            type="button"
                            onClick={() => {
                              clearPickedVideo(picked?.preview);
                              setActiveIndex(index + 1);
                            }}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Next step
                          </button>
                        )}
                      </div>
                    )}

                    {step.kind === "start" && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          disabled={Boolean(busyKey) || done}
                          onClick={() => saveAction("work_start")}
                          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {done ? "Work started — status WORKED" : busyKey === "work_start" ? "Saving…" : "Start Work"}
                        </button>
                        {done && (
                          <button
                            type="button"
                            onClick={() => setActiveIndex(index + 1)}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Next step
                          </button>
                        )}
                      </div>
                    )}

                    {step.kind === "complete" && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-amber-800">Status: WORKED</p>
                        <button
                          type="button"
                          disabled={Boolean(busyKey) || done || !data.steps.work_started_at}
                          onClick={() => saveAction("work_complete")}
                          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          {done ? "Work completed" : busyKey === "work_complete" ? "Saving…" : "Work Completed"}
                        </button>
                        {done && (
                          <button
                            type="button"
                            onClick={() => setActiveIndex(index + 1)}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Next step
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {allDone && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">All 6 steps are done. Continue to the service report form.</p>
          <button
            type="button"
            onClick={() => router.push(reportHref)}
            className="mt-3 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Add Report
          </button>
        </div>
      )}
    </div>
  );
}
