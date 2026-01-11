"use client";

import { useRef } from "react";
import PdfDownloadButton from "./PdfDownloadButton";

export default function ServiceContent({ serviceId, children }) {
  const contentRef = useRef();

  return (
    <div className="space-y-8">
      <div ref={contentRef}>{children}</div>

      <PdfDownloadButton
        targetRef={contentRef}
        fileName={`service-report-${serviceId}.pdf`}
      />
    </div>
  );
}
