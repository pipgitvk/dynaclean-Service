"use client";

import { useEffect } from "react";
import { Download, AlertCircle, CheckCircle, Clock, Receipt, RefreshCw, Eye, X } from "lucide-react";

export const PAYSLIP_UI = {
  navy: "bg-[#1a3a5f]",
  navyHover: "hover:bg-[#15304f]",
  accentBg: "bg-[#c6d9f1]",
  outerBorder: "border-2 border-black",
  cellBorder: "border border-black",
};

export const payslipThClass =
  "border border-white/35 px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wide";
export const payslipThRightClass = `${payslipThClass} text-right`;
export const payslipTdClass = "border border-black px-3 py-2.5 text-sm text-gray-900";
export const payslipTdRightClass = `${payslipTdClass} text-right tabular-nums`;

export function formatPayslipCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function formatPayslipMonth(monthString) {
  if (!monthString) return "";
  const [y, m] = monthString.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
    year: "numeric", month: "long",
  });
}

export function PayslipStatusCell({ status }) {
  const map = {
    paid: "bg-green-100 text-green-800 border-green-800/30",
    approved: "bg-blue-100 text-blue-800 border-blue-800/30",
    draft: "bg-yellow-100 text-yellow-800 border-yellow-800/30",
    cancelled: "bg-red-100 text-red-800 border-red-800/30",
  };
  const badge = map[status] || "bg-gray-100 text-gray-800 border-gray-800/20";
  const icon = status === "paid" ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
    : status === "approved" ? <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
    : status === "draft" ? <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
    : status === "cancelled" ? <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
    : <Clock className="w-4 h-4 text-gray-500 shrink-0" />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-medium capitalize border ${badge}`}>
      {icon}{status || "—"}
    </span>
  );
}

export function PayslipDownloadButton({ onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold text-white ${PAYSLIP_UI.navy} ${PAYSLIP_UI.navyHover} disabled:opacity-50 border border-black`}>
      <Download className="w-3.5 h-3.5" />Download
    </button>
  );
}

export function PayslipViewButton({ onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold text-[#1a3a5f] bg-white border border-black hover:bg-slate-100 disabled:opacity-50">
      <Eye className="w-3.5 h-3.5 shrink-0" />View
    </button>
  );
}

export function PayslipPreviewModal({ open, title, html, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col border-2 border-black overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-black bg-[#1a3a5f] text-white shrink-0">
          <h2 className="text-sm font-semibold truncate">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-white/15 shrink-0" aria-label="Close preview">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-auto flex-1 min-h-0 bg-slate-100">
          <iframe title="Payslip preview" className="w-full min-h-[min(80vh,900px)] border-0 block bg-white" srcDoc={html || ""} />
        </div>
      </div>
    </div>
  );
}

export function PayslipRefreshButton({ onClick, loading }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-sm text-sm font-medium border border-black bg-white text-gray-900 hover:bg-[#1a3a5f] hover:text-white disabled:opacity-50 transition-colors">
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />Refresh
    </button>
  );
}

export function PayslipRecordsShell({ title, subtitle, listTitle = "Pay slip records", toolbar, listHint, loading, empty, emptyMessage, children }) {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className={`mb-6 ${PAYSLIP_UI.outerBorder} bg-white shadow-sm overflow-hidden`}>
        <div className={`${PAYSLIP_UI.navy} text-white px-4 py-3 flex items-start gap-3`}>
          <Receipt className="w-8 h-8 shrink-0 opacity-95 mt-0.5" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-white/90 text-sm mt-1 leading-relaxed">{subtitle}</p>
          </div>
        </div>
        {toolbar ? <div className="px-4 py-3 border-b border-black bg-slate-50">{toolbar}</div> : null}
        <div className={`${PAYSLIP_UI.accentBg} border-b border-black px-4 py-2.5`}>
          <p className="text-center text-sm font-semibold text-[#1a3a5f] uppercase tracking-wide">{listTitle}</p>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="animate-spin rounded-full h-11 w-11 border-2 border-[#1a3a5f] border-t-transparent" />
            <p className="text-gray-600 text-sm mt-4">Loading records…</p>
          </div>
        ) : empty ? (
          <div className="border-t border-black">
            <div className="px-4 py-12 text-center text-gray-700 text-sm">{emptyMessage}</div>
            <p className="text-[11px] text-center text-gray-600 italic px-4 py-3 border-t border-black bg-white">
              This is a computer-generated view; payslip PDFs do not require a physical signature.
            </p>
          </div>
        ) : (
          <>
            {listHint ? <p className="text-xs text-gray-700 px-3 py-2 border-b border-black bg-white">{listHint}</p> : null}
            <div className="overflow-x-auto bg-white">{children}</div>
            <p className="text-[11px] text-center text-gray-600 italic px-4 py-3 border-t border-black bg-white">
              This is a computer-generated view; payslip PDFs do not require a physical signature.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
