"use client";
import { useRef, useState, useEffect, useCallback } from "react";

/** Minimum face width as fraction of frame width (12% = easier check-in) */
const MIN_FACE_COVERAGE = 0.12;

const FaceCaptureModal = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceCoveragePercent, setFaceCoveragePercent] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Starting camera...");
  const [faceapiRef, setFaceapiRef] = useState(null);

  // Start camera
  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
        setStatusMsg("Loading face detection...");
      } catch {
        setStatusMsg("Camera access denied. Please allow camera permission.");
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, []);

  // Load face-api.js model after camera is ready
  useEffect(() => {
    if (!cameraReady) return;
    let cancelled = false;
    const loadModel = async () => {
      try {
        const faceapi = await import("face-api.js");
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        if (cancelled) return;
        setFaceapiRef(faceapi);
        setModelLoaded(true);
        setStatusMsg("Face your camera — align face in the frame");
      } catch {
        if (cancelled) return;
        setModelError(true);
        setModelLoaded(true);
        setStatusMsg("Position your face and tap Capture");
      }
    };
    loadModel();
    return () => { cancelled = true; };
  }, [cameraReady]);

  // Run face detection loop
  useEffect(() => {
    if (!modelLoaded || !faceapiRef || modelError) return;

    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const detection = await faceapiRef.detectSingleFace(
          video,
          new faceapiRef.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        );

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const dw = video.offsetWidth;
        const dh = video.offsetHeight;
        canvas.width = dw;
        canvas.height = dh;
        ctx.clearRect(0, 0, dw, dh);

        if (detection) {
          const { box } = detection;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const scaleX = dw / vw;
          const scaleY = dh / vh;

          // Mirror the x coordinate since video is flipped
          const mx = (vw - box.x - box.width) * scaleX;
          const my = box.y * scaleY;
          const mw = box.width * scaleX;
          const mh = box.height * scaleY;

          // Coverage = face width fraction of video width
          const coverage = box.width / vw;
          const pct = Math.round(coverage * 100);
          setFaceCoveragePercent(pct);

          const isValid = coverage >= MIN_FACE_COVERAGE;
          setFaceDetected(isValid);

          if (isValid) {
            setStatusMsg("Face detected! Tap Capture.");
          } else {
            setStatusMsg(`Move closer — face covers ${pct}% (need 12%+)`);
          }

          // Draw bounding box
          ctx.strokeStyle = isValid ? "#22c55e" : "#ef4444";
          ctx.lineWidth = 3;
          ctx.strokeRect(mx, my, mw, mh);

          // Corner accents
          const cs = 16;
          ctx.lineWidth = 5;
          ctx.strokeStyle = isValid ? "#16a34a" : "#dc2626";
          // top-left
          ctx.beginPath(); ctx.moveTo(mx, my + cs); ctx.lineTo(mx, my); ctx.lineTo(mx + cs, my); ctx.stroke();
          // top-right
          ctx.beginPath(); ctx.moveTo(mx + mw - cs, my); ctx.lineTo(mx + mw, my); ctx.lineTo(mx + mw, my + cs); ctx.stroke();
          // bottom-left
          ctx.beginPath(); ctx.moveTo(mx, my + mh - cs); ctx.lineTo(mx, my + mh); ctx.lineTo(mx + cs, my + mh); ctx.stroke();
          // bottom-right
          ctx.beginPath(); ctx.moveTo(mx + mw - cs, my + mh); ctx.lineTo(mx + mw, my + mh); ctx.lineTo(mx + mw, my + mh - cs); ctx.stroke();
        } else {
          setFaceDetected(false);
          setFaceCoveragePercent(0);
          setStatusMsg("No face detected — look at the camera");
        }
      } catch {
        // detection error — ignore and retry
      }
    };

    detectionIntervalRef.current = setInterval(detect, 400);
    return () => clearInterval(detectionIntervalRef.current);
  }, [modelLoaded, faceapiRef, modelError]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const maxEdge = 960;
    const scale = Math.min(1, maxEdge / Math.max(vw, vh));
    const outW = Math.round(vw * scale);
    const outH = Math.round(vh * scale);

    const capture = document.createElement("canvas");
    capture.width = outW;
    capture.height = outH;
    const ctx = capture.getContext("2d");

    // Mirror the capture to match what the user sees
    ctx.translate(capture.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, outW, outH);

    // Smaller payload avoids proxy/body limits and faster mobile upload
    const base64 = capture.toDataURL("image/jpeg", 0.72);

    // Stop camera stream
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);

    onCapture(base64);
  }, [onCapture]);

  const canCapture = modelError || faceDetected;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-bold text-base">Face Verification</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Camera area */}
        <div
          className="relative bg-black"
          style={{ aspectRatio: "4/3" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedData={() => {}}
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Coverage badge */}
          {faceCoveragePercent > 0 && (
            <div
              className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold shadow ${
                faceDetected ? "bg-green-500 text-white" : "bg-red-500 text-white"
              }`}
            >
              {faceCoveragePercent}%
            </div>
          )}

          {/* Loading overlay */}
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 text-white text-sm">
              Starting camera...
            </div>
          )}
        </div>

        {/* Status */}
        <div className="px-4 pt-3 pb-1">
          <p
            className={`text-center text-sm font-semibold ${
              faceDetected ? "text-green-600" : "text-gray-700"
            }`}
          >
            {statusMsg}
          </p>
          {!modelError && (
            <p className="text-center text-xs text-gray-400 mt-0.5">
              Face must be at least 12% of frame width to check in
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={capturePhoto}
            disabled={!canCapture}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition ${
              canCapture
                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {faceDetected ? "✓ Capture" : "Capture"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaceCaptureModal;
