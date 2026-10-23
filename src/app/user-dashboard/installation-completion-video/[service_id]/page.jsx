"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Video, Play, Square, Download, Upload, FileText } from "lucide-react";
import dayjs from "dayjs";
import { generateServiceReportPDF, downloadPDF } from "@/utils/pdfGenerator";
import { isInstallationReportLayout } from "@/utils/reportLayout";
import { getCompletionFileSrc } from "@/utils/signatureUrl";

const RECORDING_DURATION = 45; // 45 seconds

function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.message || "Could not save video."));
    };
    xhr.onerror = () => reject(new Error("Could not save video."));
    xhr.send(formData);
  });
}

export default function InstallationCompletionVideoPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params?.service_id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reportFile, setReportFile] = useState(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [uploadedReportName, setUploadedReportName] = useState("");
  const [downloadingBlank, setDownloadingBlank] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const chunksRef = useRef([]);

  const reportHref = `/user-dashboard/complete-service/${serviceId}`;

  const goToReportForm = useCallback(() => {
    router.replace(reportHref);
  }, [router, reportHref]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/service-report-steps/${serviceId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to load service");
      if (String(body.service?.service_type || "").trim().toUpperCase() !== "INSTALLATION") {
        router.replace(`/user-dashboard/complete-service/${serviceId}`);
        return;
      }
      setData(body);

      const recordRes = await fetch(`/api/service-records/${serviceId}`, { cache: "no-store" });
      const recordBody = await recordRes.json();
      let hasUploadedReport = false;
      if (recordRes.ok) {
        const name = String(recordBody.record?.installation_report || "").trim();
        if (name) {
          hasUploadedReport = true;
          if (name !== "uploadFO") {
            setUploadedReportName(name);
          }
        }
      }

      const hasCompletionVideo = Boolean(body.steps?.video_completion);
      if (hasCompletionVideo || hasUploadedReport) {
        goToReportForm();
        return;
      }
    } catch (err) {
      setError(err.message || "Failed to load service");
    } finally {
      setLoading(false);
    }
  }, [serviceId, router, goToReportForm]);

  useEffect(() => {
    if (serviceId) load();
  }, [serviceId, load]);

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        setPreview(URL.createObjectURL(blob));

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= RECORDING_DURATION) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return RECORDING_DURATION;
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setError(err.message || "Could not access camera.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const onPickFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|3gp|mkv|m4v|avi)$/i.test(file.name)) {
      setError("Choose a video file.");
      event.target.value = "";
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("Video is too large. Maximum size is 200 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setRecordedBlob(file);
    setPreview(URL.createObjectURL(file));
  };

  const downloadBlankReport = async () => {
    setReportMessage("");
    setDownloadingBlank(true);
    try {
      const res = await fetch(`/api/service-records/${serviceId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load service data.");

      const record = body.record || {};
      const product = body.product || {};
      const useInstallationLayout =
        isInstallationReportLayout(record.complaint_summary) ||
        String(record.service_type || data?.service?.service_type || "")
          .trim()
          .toUpperCase() === "INSTALLATION";

      const reportData = {
        service_id: record.service_id || serviceId,
        serial_number: record.serial_number,
        complaint_summary: record.complaint_summary,
        status: record.status,
        completed_date: "",
        checklist: "",
        nature_of_complaints: "",
        observation: "",
        action_taken: "",
        replaced: "",
        to_be_replaced: "",
        service_rate: "",
        feedback: "",
        authorised_person_name: "",
        authorised_person_designation: "",
        authorised_person_mobile: "",
        customer_name: "",
        customer_designation: "",
        customer_mobile: "",
      };

      const productData = {
        product_name: product.product_name,
        model: product.model,
        customer_name: product.customer_name,
        email: product.email,
        contact: product.contact,
        customer_address: product.customer_address,
        installed_address: product.installed_address,
        installation_date: product.installation_date,
        invoice_number: product.invoice_number,
        invoice_date: product.invoice_date,
        contact_person: product.contact_person || product.site_person || "",
        site_person: product.site_person || "",
      };

      const installData = useInstallationLayout
        ? {
            installation_date: "",
            defects_on_inspection: "",
            engineer_remarks: "",
            service_rating: "",
            customer_feedback: "",
          }
        : {
            defects_on_inspection: "",
            engineer_remarks: "",
          };

      const pdf = await generateServiceReportPDF(
        reportData,
        productData,
        installData,
        [],
        { isInstallationLayout: useInstallationLayout },
      );
      const filename = `Blank_Installation_Report_${serviceId}_${dayjs().format("YYYY-MM-DD")}.pdf`;
      downloadPDF(pdf, filename);
      setReportMessage("Blank report downloaded. Fill it and upload below.");
    } catch (err) {
      setReportMessage(err.message || "Could not download blank report.");
    } finally {
      setDownloadingBlank(false);
    }
  };

  const onPickReportFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const okType =
      file.type === "application/pdf" ||
      file.type.startsWith("image/") ||
      /\.(pdf|jpg|jpeg|png|webp)$/i.test(file.name);
    if (!okType) {
      setReportMessage("Upload a PDF or image file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setReportMessage("File is too large. Maximum size is 25 MB.");
      return;
    }
    setReportMessage("");
    setReportFile(file);
  };

  const uploadFilledReport = async () => {
    if (!reportFile) return;
    setUploadingReport(true);
    setReportMessage("");
    try {
      const formData = new FormData();
      formData.append("installationFile", reportFile);
      formData.append("service_id", String(serviceId));

      const res = await fetch("/api/upload-installation", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Upload failed.");
      }
      setUploadedReportName(result.fileName || reportFile.name);
      setReportFile(null);
      setReportMessage("Report uploaded. Opening fill report form…");
      setTimeout(() => goToReportForm(), 800);
    } catch (err) {
      setReportMessage(err.message || "Could not upload report.");
    } finally {
      setUploadingReport(false);
    }
  };

  const saveVideo = async () => {
    if (!recordedBlob) return;

    setError("");
    setIsSaving(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("action", "installation_completion_video");
      formData.append("file", recordedBlob, "installation-completion.webm");

      const body = await uploadWithProgress(
        `/api/service-report-steps/${serviceId}`,
        formData,
        setUploadProgress,
      );

      setData(body);
      setTimeout(() => goToReportForm(), 800);
    } catch (err) {
      setError(err.message || "Could not save video.");
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-sm text-gray-500">Loading service...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-sm text-red-600">Service not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link
        href="/user-dashboard/view_service_reports"
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Service Reports
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          Installation Completion Video
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload the completion video or the filled installation report — when either one is done, the
          online report form opens automatically.
        </p>
        {data?.service && (
          <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <p>
              <span className="font-medium text-gray-500">Service ID:</span> {data.service.service_id}
            </p>
            <p>
              <span className="font-medium text-gray-500">Status:</span>{" "}
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                  String(data.service.status).toUpperCase() === "COMPLETED"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {data.service.status || "—"}
              </span>
            </p>
            <p>
              <span className="font-medium text-gray-500">Serial:</span> {data.service.serial_number || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-500">Type:</span> {data.service.service_type || "—"}
            </p>
            <p className="sm:col-span-2">
              <span className="font-medium text-gray-500">Machine:</span> {data.service.complaint_summary || "—"}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Installation report (PDF)</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Download the blank installation report, fill it on site, then upload the scanned PDF or photo.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={downloadBlankReport}
            disabled={downloadingBlank}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloadingBlank ? "Preparing PDF…" : "Download blank report"}
          </button>
          <label
            className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-700 hover:bg-gray-100 ${
              uploadingReport ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Upload className="h-5 w-5" />
            {reportFile ? reportFile.name : "Choose filled report (PDF or image)"}
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              disabled={uploadingReport}
              onChange={onPickReportFile}
            />
          </label>
          {reportFile && (
            <button
              type="button"
              onClick={uploadFilledReport}
              disabled={uploadingReport}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {uploadingReport ? "Uploading report…" : "Upload report"}
            </button>
          )}
          {uploadedReportName && (
            <p className="text-sm text-green-700">
              Uploaded:{" "}
              <a
                href={getCompletionFileSrc(uploadedReportName) || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                {uploadedReportName}
              </a>
            </p>
          )}
          {reportMessage && (
            <p className="text-sm text-gray-700">{reportMessage}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6">
          {isRecording || !recordedBlob ? (
            <div className="relative w-full bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto max-h-96"
              />
              {isRecording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-semibold animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full" />
                  Recording: {formatTime(recordingTime)}
                </div>
              )}
            </div>
          ) : (
            <video
              src={preview}
              controls
              className="w-full h-auto max-h-96 rounded-lg bg-black"
            />
          )}
        </div>

        {!recordedBlob ? (
          <div className="space-y-4">
            {!isRecording ? (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Play className="h-5 w-5" />
                  Start Recording (45 seconds)
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>
                <label className="w-full flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-green-300 bg-green-50 px-3 py-5 text-sm text-green-800 hover:bg-green-100">
                  <Video className="h-5 w-5" />
                  Upload Video
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={onPickFile}
                  />
                </label>
              </>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                disabled={recordingTime < 5}
                className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Square className="h-5 w-5" />
                Stop Recording ({formatTime(recordingTime)} / {formatTime(RECORDING_DURATION)})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-sm text-green-800 font-medium">✓ Video ready</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecordedBlob(null);
                setPreview(null);
                setRecordingTime(0);
              }}
              className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Choose Another
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={saveVideo}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {isSaving ? `Uploading ${uploadProgress}%` : "Save & Continue to Report"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p>• Video should show the installation is complete and ready for use</p>
        <p>• Minimum 5 seconds, maximum 45 seconds</p>
        <p>• After video or report upload, the fill report form opens automatically</p>
      </div>
    </div>
  );
}
