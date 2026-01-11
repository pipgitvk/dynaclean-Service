// "use client";

// export default function PdfDownloadButton({ elementId }) {
//   const handleDownload = () => {
//     const element = document.getElementById(elementId);
//     if (!element) return;

//     const printWindow = window.open("", "", "width=800,height=600");

//     // Copy Tailwind + global styles from the main document
//     const styles = Array.from(document.styleSheets)
//       .map((styleSheet) => {
//         try {
//           return Array.from(styleSheet.cssRules)
//             .map((rule) => rule.cssText)
//             .join("\n");
//         } catch (e) {
//           // some styleSheets (like from CDN) throw CORS error → skip them
//           return "";
//         }
//       })
//       .join("\n");

//     printWindow.document.write(`
//       <html>
//         <head>
//           <title>Service Report</title>
//           <style>
//             ${styles}
//           </style>
//         </head>
//         <body>
//           ${element.outerHTML}
//         </body>
//       </html>
//     `);

//     printWindow.document.close();
//     printWindow.focus();
//     printWindow.print();
//   };

//   return (
//     <div style={{ textAlign: "right", marginTop: "20px" }}>
//       <button
//         onClick={handleDownload}
//         style={{
//           backgroundColor: "#2563eb",
//           color: "white",
//           fontWeight: "bold",
//           padding: "10px 20px",
//           borderRadius: "6px",
//           cursor: "pointer",
//         }}
//       >
//         Download PDF 📥
//       </button>
//     </div>
//   );
// }

"use client";

import { useRef } from "react";

export default function PdfDownloadButton({ elementId }) {
  const handleDownload = () => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const printWindow = window.open("", "", "width=800,height=600");

    // Copy Tailwind + global styles from the main document
    const styles = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch (e) {
          // some styleSheets (like from CDN) throw CORS error → skip them
          return "";
        }
      })
      .join("\n");

    const printContent = `
      <html>
        <head>
          <title>Service Report</title>
          <style>
            ${styles}
            /* Custom print styles for the PDF */
            @media print {
              body {
                margin: 0;
                padding: 0;
                font-family: sans-serif;
                font-size: 12px;
                color: #000;
              }
              
              /* Hide elements that shouldn't be in the PDF */
              .no-print {
                display: none !important;
              }

              /* General layout and spacing adjustments */
              .min-h-screen, .flex, .items-center, .justify-center {
                min-height: auto !important;
                display: block !important;
              }

              .bg-gray-100 {
                background-color: transparent !important;
              }

              .bg-white {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                max-width: none !important;
                width: 100% !important;
              }
              
              /* Form and input styling for print */
              form {
                margin: 0;
                padding: 0;
              }

              input, textarea, select {
                border: 1px solid #ccc !important;
                padding: 2px !important;
                background-color: #f9f9f9 !important;
                display: block !important;
                width: 100% !important;
                box-shadow: none !important;
                font-size: 8px !important;
                margin-top: 4px !important;
                border-radius: 4px !important;
              }

              label {
                font-weight: bold;
                font-size: 11px;
                margin-top: 8px;
                display: block;
              }

              /* Reduce padding and spacing for a compact layout */
              .p-4, .p-2 {
                padding: 6px !important;
              }

              .space-y-4 > *:not(:last-child) {
                margin-bottom: 6px !important;
              }

              .mb-6 {
                margin-bottom: 8px !important;
              }
              
              /* Specific field adjustments */
              .mb-4 {
                margin-bottom: 6px !important;
              }
              
              /* Table styling */
              table, th, td {
                border-collapse: collapse !important;
                border: 1px solid #ddd !important;
              }
              
              th, td {
                padding: 4px 8px !important;
              }

              /* Signature styling */
              .signature-placeholder {
                display: none !important; /* Hide the empty canvas placeholder */
              }

              img {
                display: block !important;
                width: 200px !important;
                height: auto !important;
                border: 1px solid #ccc !important;
                padding: 2px !important;
                margin-top: 5px;
              }

              /* Ensure content fits on one page (if possible) */
              body > *, body > div {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div id="print-content">
            ${element.outerHTML}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div style={{ textAlign: "right", marginTop: "20px" }} className="no-print">
      <button
        onClick={handleDownload}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          fontWeight: "bold",
          padding: "10px 20px",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Download PDF 📥
      </button>
    </div>
  );
}
