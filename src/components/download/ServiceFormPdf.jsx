"use client";

import { useRef } from "react";

export default function ServiceReportTemplate() {
  const reportRef = useRef();

  const handleDownload = async () => {
    // Dynamically import html2pdf.js only when the button is clicked
    const html2pdf = (await import("html2pdf.js")).default;
    const element = reportRef.current;

    // Configuration options for the PDF
    const opt = {
      margin: 0.5,
      filename: "service-report.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };

    // Generate and save the PDF from the referenced element
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center justify-start">
      {/* Download Button */}
      <button
        onClick={handleDownload}
        className="mb-6 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
      >
        Download Empty PDF
      </button>

      {/* The static template content to be downloaded */}
      <div
        ref={reportRef}
        className="bg-white border border-gray-200 shadow-xl rounded-lg w-full max-w-4xl p-4"
      >
        <div className="space-y-4">
          {/* Header Section */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Service Report</h1>
            <p className="text-sm text-gray-600">
              Generated on: {new Date().toLocaleDateString()}
            </p>
          </div>

          {/* Status Section */}
          <div className="p-4 border rounded-md bg-gray-50">
            <p className="block mb-1 font-medium text-sm">
              Status: <strong></strong>
            </p>
          </div>

          {/* Completion Remarks */}
          <div>
            <p className="block mb-1 font-medium text-sm">Completion Remark:</p>
            <p className="text-sm p-2 bg-white rounded border h-20"></p>
          </div>

          {/* Completed Date */}
          <div>
            <p className="block mb-1 font-medium text-sm">
              Completed Date: <strong></strong>
            </p>
          </div>

          {/* Checklist */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3 text-sm">
              CHECKLIST (OK / NOT OK / NA)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              <p className="text-sm text-gray-700">Voltage (V):</p>
              <p className="text-sm text-gray-700">Condition of Motor:</p>
              <p className="text-sm text-gray-700">Check Squeegee blades:</p>
              <p className="text-sm text-gray-700">Amperages (Amps):</p>
              <p className="text-sm text-gray-700">Greasing Cleaned / Done:</p>
            </div>
          </div>

          {/* Service Rendered */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3 text-sm">
              SERVICE RENDERED
            </h3>
            <div className="space-y-4">
              <p className="text-sm">Nature of Complaint:</p>
              <p className="text-sm">Observation:</p>
              <p className="text-sm">Action Taken:</p>
            </div>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-sm">
                Authorized Person (Engineer)
              </h3>
              <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2 h-32 flex items-center justify-center">
                Signature
              </div>
              <p className="text-sm">Name:</p>
              <p className="text-sm">Designation:</p>
              <p className="text-sm">Mobile:</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3 text-sm">Customer</h3>
              <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2 h-32 flex items-center justify-center">
                Signature
              </div>
              <p className="text-sm">Name:</p>
              <p className="text-sm">Designation:</p>
              <p className="text-sm">Mobile:</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
