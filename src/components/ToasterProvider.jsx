"use client";

import { Toaster } from "react-hot-toast";

/** Global toast host — top-center so success/error are visible above content. */
export default function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      containerStyle={{ top: 16 }}
      toastOptions={{
        duration: 4500,
        className: "!text-sm !shadow-lg !rounded-lg",
        style: {
          zIndex: 10050,
          maxWidth: "min(90vw, 28rem)",
        },
        success: {
          iconTheme: { primary: "#fff", secondary: "#15803d" },
          style: { background: "#f0fdf4", color: "#14532d", border: "1px solid #bbf7d0" },
        },
        error: {
          iconTheme: { primary: "#fff", secondary: "#b91c1c" },
          style: { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fecaca" },
        },
      }}
    />
  );
}
