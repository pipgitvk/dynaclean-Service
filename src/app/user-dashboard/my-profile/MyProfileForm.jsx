"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PROFILE_FILE_FIELD_ALIASES } from "@/lib/employeeProfileColumns";

/** True once employee_profiles row exists (GET returns id). */
function hasPersistedProfileRow(saved) {
  if (!saved) return false;
  const id = saved.id;
  if (id === null || id === undefined || id === "") return false;
  return true;
}

/** API / UI → boolean: user is experienced (not fresher). */
function normalizeIsExperiencedBool(v) {
  return v === true || v === 1 || v === "1";
}

/** Radio group value for react-hook-form (`"1"` experienced, `"0"` fresher). */
function toFormIsExperiencedRadio(v) {
  return normalizeIsExperiencedBool(v) ? "1" : "0";
}

/**
 * Editable only when there is no DB row yet, or HR has rejected (resubmit).
 * If data exists in the DB and status is not rejected → read-only.
 */
function isProfileLockedFromServer(saved) {
  const st = String(getProfileApprovalStatus(saved) || "").toLowerCase();
  if (st === "rejected" || st === "reassign" || st === "revision_requested") return false;
  return hasPersistedProfileRow(saved);
}

/** Legacy form file field name → app.dynaclean `doc_*` key (single upload; avoids duplicate Cloudinary calls). */
const LEGACY_FILE_TO_EMPCRM_DOC = {
  pan_card: "doc_pan_card",
  voter_id: "doc_voter_id",
  aadhaar_card: "doc_aadhaar_card",
  electricity_bill: "doc_electricity_bill",
  rent_agreement: "doc_rent_agreement",
  cert_10th: "doc_10th_certificate",
  cert_12th: "doc_12th_certificate",
  diploma_cert: "doc_degree_diploma",
  tech_cert: "doc_technical_cert",
  appt_letter_prev: "doc_appt_letter_prev",
  exp_letter: "doc_exp_letter",
  relieving_letter: "doc_relieving_letter",
  salary_slips: "doc_salary_slips",
  cancelled_cheque: "doc_cancelled_cheque",
  loi_appointment: "doc_loi_appointment",
  joining_form: "doc_joining_form",
  emp_verification: "doc_emp_verification",
  code_conduct: "doc_code_conduct",
  nda: "doc_nda",
  company_policy: "doc_company_policy",
  police_verification: "doc_police_verification",
};

function hasColumn(columns, name) {
  if (!columns?.length) return false;
  const n = String(name).toLowerCase();
  return columns.some((c) => String(c).toLowerCase() === n);
}

/** True if any alias for this logical file field exists in the table */
function hasDocField(columns, logicalKey) {
  const aliases = PROFILE_FILE_FIELD_ALIASES[logicalKey];
  if (!aliases?.length) return hasColumn(columns, logicalKey);
  return aliases.some((a) => hasColumn(columns, a));
}

function getSavedDocUrl(saved, logicalKey) {
  if (!saved) return "";
  const aliases = PROFILE_FILE_FIELD_ALIASES[logicalKey];
  const list = aliases?.length ? aliases : [logicalKey];
  for (const a of list) {
    const v = saved[a];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function getProfileApprovalStatus(saved) {
  if (!saved) return "";
  return (
    saved.profile_approval_status ||
    saved.hr_approval_status ||
    saved.profile_hr_status ||
    ""
  );
}

/** Employee-side statuses before final approval */
const IN_REVIEW_STATUSES = new Set(["pending", "pending_hr_docs", "pending_admin"]);

function isInReviewStatus(statusLower) {
  return IN_REVIEW_STATUSES.has(String(statusLower || "").toLowerCase());
}

function getInReviewStatusLabel(statusLower) {
  const st = String(statusLower || "").toLowerCase();
  if (st === "pending_admin") return "Admin approval pending";
  if (st === "pending_hr_docs") return "HR details in progress";
  if (st === "pending") return "HR approval pending";
  if (st === "reassign" || st === "revision_requested") return "Corrections requested by HR";
  return "HR approval pending";
}

function getInReviewStatusModal(statusLower) {
  const st = String(statusLower || "").toLowerCase();
  if (st === "pending_admin") return "pending_admin";
  if (st === "pending_hr_docs") return "pending_hr_docs";
  return "pending";
}

function parseReassignedFieldKeys(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map((x) => String(x || "").trim()).filter(Boolean);
    } catch {}
  }
  return [];
}

const REASSIGN_KEY_TO_FORM_NAME = {
  doc_pan_card: "pan_card",
  doc_voter_id: "voter_id",
  doc_aadhaar_card: "aadhaar_card",
  doc_electricity_bill: "electricity_bill",
  doc_rent_agreement: "rent_agreement",
  doc_10th_certificate: "cert_10th",
  doc_12th_certificate: "cert_12th",
  doc_degree_diploma: "diploma_cert",
  doc_technical_cert: "tech_cert",
  doc_appt_letter_prev: "appt_letter_prev",
  doc_exp_letter: "exp_letter",
  doc_relieving_letter: "relieving_letter",
  doc_salary_slips: "salary_slips",
  doc_cancelled_cheque: "cancelled_cheque",
  doc_loi_appointment: "loi_appointment",
  doc_joining_form: "joining_form",
  doc_emp_verification: "emp_verification",
  doc_code_conduct: "code_conduct",
  doc_nda: "nda",
  doc_company_policy: "company_policy",
  doc_police_verification: "police_verification",
};

function parseEducationRows(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function newEducationRow() {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `edu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    exam_name: "",
    board_university: "",
    year_of_passing: "",
    grade_percentage: "",
  };
}

/** Align with CRM `employee_education` / submission `education[]` keys; migrate legacy form keys. */
function normalizeEducationRows(arr) {
  return (Array.isArray(arr) ? arr : []).map((r, i) => {
    const id =
      r?.id != null && String(r.id).trim() !== ""
        ? String(r.id)
        : typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `edu_${i}_${Date.now()}`;
    const exam =
      String(r?.exam_name ?? "").trim() ||
      String(r?.degree ?? "").trim() ||
      String(r?.institution ?? "").trim();
    const board =
      String(r?.board_university ?? "").trim() ||
      String(r?.board ?? "").trim() ||
      String(r?.institution ?? "").trim();
    return {
      id,
      exam_name: exam,
      board_university: board,
      year_of_passing: String(r?.year_of_passing ?? r?.year ?? ""),
      grade_percentage: String(r?.grade_percentage ?? r?.percentage ?? ""),
    };
  });
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-medium text-gray-800 mb-1">
      {children}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );
}

function hasPickedFile(fileVal) {
  return (
    fileVal instanceof FileList && fileVal.length > 0 && fileVal[0] != null && fileVal[0].size > 0
  );
}

function DocRow({ label, required, name, register, existingUrl, watch }) {
  const picked = watch ? watch(name) : undefined;
  const checked = Boolean(existingUrl) || hasPickedFile(picked);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <input type="checkbox" className="rounded border-gray-300" readOnly checked={checked} />
      <span className="flex-1 text-sm text-gray-800">
        {label}
        {required && <span className="text-red-600">*</span>}
      </span>
      <input
        type="file"
        accept="image/*,.pdf"
        className="text-xs max-w-[220px]"
        {...register(name)}
      />
      {existingUrl && (
        <a
          href={existingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline shrink-0"
        >
          View
        </a>
      )}
    </div>
  );
}

export default function MyProfileForm() {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState([]);
  const [saved, setSaved] = useState(null);
  const [educationRows, setEducationRows] = useState([]);
  const [statusModal, setStatusModal] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/employee-profile", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load profile");
        if (cancelled) return;
        setColumns(data.columns || []);
        const initial = data.profile || {
          username: data.username || "",
          empId: data.empId ?? "",
        };
        const em = data.empId ?? initial.empId ?? "";
        if (em !== "") initial.employee_code = String(em);
        const expBool = normalizeIsExperiencedBool(initial.is_experienced);
        const savedProfile = { ...initial, is_experienced: expBool };
        setSaved(savedProfile);
        reset({
          ...savedProfile,
          is_experienced: toFormIsExperiencedRadio(expBool),
        });
        setEducationRows(normalizeEducationRows(parseEducationRows(savedProfile.education_json)));
      } catch (e) {
        toast.error(e?.message || "Could not load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  useEffect(() => {
    if (!saved?.empId) return;
    if (!hasColumn(columns, "employee_code")) return;
    setValue("employee_code", String(saved.empId));
  }, [saved?.empId, columns, setValue]);

  const col = useMemo(() => (name) => hasColumn(columns, name), [columns]);
  const doc = useMemo(() => (logicalKey) => hasDocField(columns, logicalKey), [columns]);
  const hasApprovalColumn = useMemo(
    () => columns.some((c) => /profile_approval|hr_approval|profile_hr/i.test(String(c))),
    [columns],
  );

  const watchedEmploymentType = watch("is_experienced");
  const hasIsExperiencedColumn = col("is_experienced");
  useEffect(() => {
    if (!hasIsExperiencedColumn) return;
    if (normalizeIsExperiencedBool(watchedEmploymentType)) return;
    for (const name of ["appt_letter_prev", "exp_letter", "relieving_letter", "salary_slips"]) {
      setValue(name, undefined);
    }
  }, [watchedEmploymentType, hasIsExperiencedColumn, setValue]);

  const updateEducationRow = (index, patch) => {
    setEducationRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeEducationRow = (index) => {
    setEducationRows((prev) => prev.filter((_, i) => i !== index));
  };

  const billTypeFieldName = col("electricity_bill_for")
    ? "electricity_bill_for"
    : col("electricity_bill_type")
      ? "electricity_bill_type"
      : null;
  /** Always show dropdown in UI; API maps to whichever column exists */
  const billTypeRegisterName = billTypeFieldName || "electricity_bill_for";
  const hasBillTypeColumn = col("electricity_bill_for") || col("electricity_bill_type");

  const onSubmit = async (data) => {
    if (isProfileLockedFromServer(saved)) {
      toast.error("Your profile is already saved. You can edit only after HR rejects it.");
      return;
    }

    const filePicked = (fl) => fl instanceof FileList && fl.length > 0 && fl[0]?.size > 0;

    if (doc("pan_card") && !getSavedDocUrl(saved, "pan_card") && !filePicked(data.pan_card)) {
      toast.error("PAN card upload is required");
      return;
    }
    if (doc("aadhaar_card") && !getSavedDocUrl(saved, "aadhaar_card") && !filePicked(data.aadhaar_card)) {
      toast.error("Aadhaar card upload is required");
      return;
    }
    if (doc("electricity_bill") && !getSavedDocUrl(saved, "electricity_bill") && !filePicked(data.electricity_bill)) {
      toast.error("Electricity bill upload is required");
      return;
    }
    if (doc("electricity_bill") && hasBillTypeColumn) {
      const typeVal = String(data[billTypeRegisterName] || "").trim();
      const savedType = saved?.[billTypeFieldName || billTypeRegisterName];
      const hasSavedType = savedType != null && String(savedType).trim() !== "";
      if (!typeVal && !hasSavedType) {
        toast.error('Select "This bill is for" (Current or Permanent)');
        return;
      }
    }

    if (doc("cert_10th") && !getSavedDocUrl(saved, "cert_10th") && !filePicked(data.cert_10th)) {
      toast.error("10th qualification certificate is required");
      return;
    }
    if (doc("cert_12th") && !getSavedDocUrl(saved, "cert_12th") && !filePicked(data.cert_12th)) {
      toast.error("12th qualification certificate is required");
      return;
    }
    if (doc("cancelled_cheque") && !getSavedDocUrl(saved, "cancelled_cheque") && !filePicked(data.cancelled_cheque)) {
      toast.error("Cancelled cheque / bank passbook upload is required");
      return;
    }

    const isExperienced = normalizeIsExperiencedBool(data.is_experienced);
    if (isExperienced) {
      if (doc("appt_letter_prev") && !getSavedDocUrl(saved, "appt_letter_prev") && !filePicked(data.appt_letter_prev)) {
        toast.error("Previous company appointment letter is required");
        return;
      }
      if (doc("exp_letter") && !getSavedDocUrl(saved, "exp_letter") && !filePicked(data.exp_letter)) {
        toast.error("Experience letter is required");
        return;
      }
      if (doc("relieving_letter") && !getSavedDocUrl(saved, "relieving_letter") && !filePicked(data.relieving_letter)) {
        toast.error("Relieving letter is required");
        return;
      }
      if (doc("salary_slips") && !getSavedDocUrl(saved, "salary_slips") && !filePicked(data.salary_slips)) {
        toast.error("Last 3 months salary slips are required");
        return;
      }
    }

    if (col("education_json")) {
      const filled = educationRows.filter(
        (r) => String(r.exam_name || "").trim() && String(r.board_university || "").trim(),
      );
      if (filled.length === 0) {
        toast.error("Add at least one qualification — fill in Exam/Degree and Board/University.");
        return;
      }
    }

    setSubmitting(true);
    try {
    const fd = new FormData();
    if (col("education_json")) {
      fd.append(
        "education_json",
        JSON.stringify(
          educationRows.map((r) => ({
            id: r.id,
            exam_name: String(r.exam_name || "").trim(),
            board_university: String(r.board_university || "").trim(),
            year_of_passing: String(r.year_of_passing || "").trim(),
            grade_percentage: String(r.grade_percentage || "").trim(),
          })),
        ),
      );
    }
    const empcrmEducation = educationRows.map((r) => ({
      exam_name: String(r.exam_name || "").trim(),
      board_university: String(r.board_university || "").trim(),
      year_of_passing: String(r.year_of_passing || "").trim(),
      grade_percentage: String(r.grade_percentage || "").trim(),
    }));
    if (empcrmEducation.some((r) => r.exam_name || r.board_university)) {
      fd.append("education", JSON.stringify(empcrmEducation));
    }
    for (const key of Object.keys(data)) {
      const val = data[key];

      if (key === "is_experienced") {
        fd.append("is_experienced", normalizeIsExperiencedBool(val) ? "1" : "0");
        continue;
      }

      if (val instanceof FileList && val.length > 0) {
        if (val[0]?.size) {
          const docKey = LEGACY_FILE_TO_EMPCRM_DOC[key];
          if (docKey) {
            fd.append(docKey, val[0]);
          } else {
            fd.append(key, val[0]);
          }
        }
        continue;
      }

      if (val != null && typeof val !== "object") {
        fd.append(key, String(val));
      }
    }

      const res = await fetch("/api/employee-profile", {
        method: "PUT",
        credentials: "include",
        body: fd,
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Save failed");
      toast.success(
        hasApprovalColumn
          ? "Profile saved — submitted for HR approval."
          : "Profile saved",
      );
      setStatusModal("pending");
      const reload = await fetch("/api/employee-profile", { credentials: "include" });
      const again = await reload.json();
      if (again.profile) {
        const next = { ...again.profile };
        const expBool = normalizeIsExperiencedBool(next.is_experienced);
        next.is_experienced = expBool;
        setSaved(next);
        reset({
          ...next,
          is_experienced: toFormIsExperiencedRadio(expBool),
        });
        setEducationRows(normalizeEducationRows(parseEducationRows(next.education_json)));
      }
    } catch (e) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const approvalStatus = getProfileApprovalStatus(saved);
  const approvalStatusLower = String(approvalStatus || "").toLowerCase();
  const isLocked = isProfileLockedFromServer(saved);
  const showWaitingOnly = isInReviewStatus(approvalStatusLower);
  const isReassignFlow = approvalStatusLower === "reassign" || approvalStatusLower === "revision_requested";
  const reassignKeys = useMemo(() => parseReassignedFieldKeys(saved?.reassigned_fields), [saved?.reassigned_fields]);
  const allowedNamesInReassign = useMemo(() => {
    const out = new Set();
    for (const k of reassignKeys) {
      const mapped = REASSIGN_KEY_TO_FORM_NAME[k] || k;
      out.add(mapped);
    }
    // Always keep submit button context fields
    out.add("username");
    out.add("empId");
    out.add("employee_code");
    out.add("is_experienced");
    return out;
  }, [reassignKeys]);

  useEffect(() => {
    const root = formRef.current;
    if (!root) return;

    // Restore all hidden controls when not in reassign mode.
    if (!isReassignFlow) {
      root.querySelectorAll("[data-reassign-hidden='1']").forEach((el) => {
        el.style.display = "";
        el.removeAttribute("data-reassign-hidden");
      });
      return;
    }

    const controls = root.querySelectorAll("input[name], select[name], textarea[name]");
    controls.forEach((el) => {
      const name = el.getAttribute("name") || "";
      const keep = allowedNamesInReassign.has(name);
      // Hide closest form field block; fallback to element itself.
      const block = el.closest("div") || el;
      if (!keep) {
        block.style.display = "none";
        block.setAttribute("data-reassign-hidden", "1");
      } else {
        block.style.display = "";
        block.removeAttribute("data-reassign-hidden");
      }
    });
  }, [isReassignFlow, allowedNamesInReassign]);

  const closeStatusModal = () => {
    setStatusModal("");
  };

  useEffect(() => {
    if (!saved) return;
    if (isInReviewStatus(approvalStatusLower)) {
      setStatusModal(getInReviewStatusModal(approvalStatusLower));
      return;
    }
    if (approvalStatusLower === "approved" || approvalStatusLower === "rejected") {
      setStatusModal(approvalStatusLower);
    }
  }, [approvalStatusLower, saved]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-8 text-center text-gray-600 shadow">
        Loading profile…
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit)}
      className="relative max-w-5xl mx-auto space-y-6 pb-16"
    >
      {isClient &&
        statusModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-blue-200 bg-white p-8 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                {statusModal === "approved" ? "✓" : "🕒"}
              </div>
              <h3 className="text-3xl font-semibold text-gray-900">
                {statusModal === "approved"
                  ? "Profile Approved"
                  : statusModal === "rejected"
                    ? "Profile Rejected"
                    : statusModal === "pending_admin"
                      ? "Admin approval pending"
                      : "HR approval pending"}
              </h3>
              <p className="mt-4 text-base text-gray-600">
                {statusModal === "approved"
                  ? "Your profile has been fully approved."
                  : statusModal === "rejected"
                    ? "Your profile was rejected. Make the required changes and submit again."
                    : statusModal === "pending_admin"
                      ? "HR review is complete. Final Super Admin approval is pending."
                      : statusModal === "pending_hr_docs"
                        ? "Employee details are approved. HR details are being completed."
                        : "Your profile is under HR review. Please wait for final admin approval."}
              </p>
              <button
                type="button"
                onClick={closeStatusModal}
                className="mt-6 rounded-lg bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                OK
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div className="rounded-xl bg-white p-4 md:p-6 shadow-md border border-sky-100">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">My Profile</h1>
        {approvalStatus && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              approvalStatusLower === "approved"
                ? "border-green-200 bg-green-50 text-green-900"
                : approvalStatusLower === "rejected"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <span className="font-medium">HR status: </span>
            {approvalStatusLower === "approved" && "Approved"}
            {approvalStatusLower === "rejected" && "Rejected"}
            {isReassignFlow && "Corrections requested by HR"}
            {isInReviewStatus(approvalStatusLower) && getInReviewStatusLabel(approvalStatusLower)}
            {!["approved", "rejected"].includes(approvalStatusLower) &&
              !isReassignFlow &&
              !isInReviewStatus(approvalStatusLower) &&
              approvalStatus}
          </div>
        )}
        {isReassignFlow && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            HR has requested corrections. Apply the required updates and submit again.
            {saved?.reassignment_note && (
              <p className="mt-1 text-xs text-amber-800">
                <span className="font-medium">HR note:</span> {String(saved.reassignment_note)}
              </p>
            )}
          </div>
        )}
        {isLocked && !isReassignFlow && (
          <p className="mt-2 text-sm text-gray-600">
            Your profile is already saved. Fields can be edited only after HR rejects.
          </p>
        )}
      </div>

      {showWaitingOnly ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 md:p-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            🕒
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">{getInReviewStatusLabel(approvalStatusLower)}</h2>
          <p className="mt-3 text-sm text-gray-600 max-w-2xl mx-auto">
            {approvalStatusLower === "pending_admin"
              ? "HR has sent your submission for final review. Profile details will be visible after final admin approval."
              : "Your profile is under review. Profile details will stay hidden until final admin approval."}
          </p>
        </section>
      ) : (
      <fieldset
        disabled={false}
        className={`min-w-0 border-0 p-0 m-0 space-y-6 ${isLocked ? "pointer-events-none" : ""}`}
      >
      {col("is_experienced") && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 md:p-6 shadow-sm">
          <FieldLabel required>Employment Type (Select before filling details)</FieldLabel>
          <div className="mt-3 flex flex-wrap gap-3">
            <label
              className={`flex min-w-[140px] flex-1 cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 transition-colors ${
                watchedEmploymentType === "0"
                  ? "border-indigo-500 bg-white ring-1 ring-indigo-400"
                  : "border-gray-200 bg-white/90 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                value="0"
                className="border-gray-300 text-indigo-600 focus:ring-indigo-500"
                {...register("is_experienced")}
              />
              <span className="text-sm font-medium text-gray-800">Fresher</span>
            </label>
            <label
              className={`flex min-w-[140px] flex-1 cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 transition-colors ${
                watchedEmploymentType === "1"
                  ? "border-indigo-500 bg-white ring-1 ring-indigo-400"
                  : "border-gray-200 bg-white/90 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                value="1"
                className="border-gray-300 text-indigo-600 focus:ring-indigo-500"
                {...register("is_experienced")}
              />
              <span className="text-sm font-medium text-gray-800">Experienced</span>
            </label>
          </div>
        </section>
      )}

      {/* Employment */}
      <section className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 md:p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Employment details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {col("employee_code") && (
            <div>
              <FieldLabel>Employee code</FieldLabel>
              <p className="text-xs text-gray-500 mb-1">Same as empId (read-only)</p>
              <input
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                readOnly
                title="Employee code is always the same as empId"
                {...register("employee_code")}
              />
            </div>
          )}
          {col("username") && (
            <div>
              <FieldLabel required>Username</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                readOnly
                {...register("username")}
              />
            </div>
          )}
          {col("empId") && (
            <div>
              <FieldLabel>empId</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                readOnly
                {...register("empId")}
              />
            </div>
          )}
          {col("source_reference") && (
            <div>
              <FieldLabel>Source / reference</FieldLabel>
              <p className="text-xs text-gray-500 mb-1">Job portal, employee referral, etc.</p>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("source_reference")}
              />
            </div>
          )}
          {col("designation") && (
            <div>
              <FieldLabel required>Designation</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("designation")}
              />
            </div>
          )}
          {col("date_of_joining") && (
            <div>
              <FieldLabel required>Date of joining</FieldLabel>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("date_of_joining")}
              />
            </div>
          )}
          {col("work_location") && (
            <div>
              <FieldLabel>Work location</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("work_location")}
              />
            </div>
          )}
          {col("probation_period") && (
            <div>
              <FieldLabel required>Probation period</FieldLabel>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("probation_period")}
              >
                <option value="">Select</option>
                <option value="3 Months">3 Months</option>
                <option value="6 Months">6 Months</option>
                <option value="9 Months">9 Months</option>
                <option value="12 Months">12 Months</option>
              </select>
            </div>
          )}
          {col("department") && (
            <div>
              <FieldLabel required>Department</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("department")}
              />
            </div>
          )}
          {col("reporting_manager") && (
            <div>
              <FieldLabel required>Reporting manager</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("reporting_manager")}
              />
            </div>
          )}
          {col("employment_status") && (
            <div>
              <FieldLabel required>Employment status</FieldLabel>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("employment_status")}
              >
                <option value="">Select</option>
                <option value="Probation">Probation</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Notice Period">Notice Period</option>
                <option value="Exited">Exited</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Personal */}
      <section className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 md:p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Personal details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {col("name_prefix") && (
            <div>
              <FieldLabel>Name prefix</FieldLabel>
              <p className="text-xs text-gray-500 mb-1">Mr. / Ms. / Dr.</p>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("name_prefix")}
              />
            </div>
          )}
          {col("full_name") && (
            <div>
              <FieldLabel required>Full name</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("full_name")}
              />
            </div>
          )}
          {col("contact_mobile") && (
            <div>
              <FieldLabel required>Contact mobile</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("contact_mobile")}
              />
            </div>
          )}
          {col("contact_landline") && (
            <div>
              <FieldLabel>Contact landline</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("contact_landline")}
              />
            </div>
          )}
          {col("date_of_birth") && (
            <div>
              <FieldLabel required>Date of birth</FieldLabel>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("date_of_birth")}
              />
            </div>
          )}
          {col("marital_status") && (
            <div>
              <FieldLabel required>Marital status</FieldLabel>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("marital_status")}
              >
                <option value="">Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}
          {col("blood_group") && (
            <div>
              <FieldLabel>Blood group</FieldLabel>
              <input
                placeholder="e.g., B+"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("blood_group")}
              />
            </div>
          )}
          {col("email") && (
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("email")}
              />
            </div>
          )}
          {col("father_name") && (
            <div>
              <FieldLabel required>Father&apos;s name</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("father_name")}
              />
            </div>
          )}
          {col("father_phone") && (
            <div>
              <FieldLabel required>Father&apos;s phone</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("father_phone")}
              />
            </div>
          )}
          {col("mother_name") && (
            <div>
              <FieldLabel>Mother&apos;s name</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("mother_name")}
              />
            </div>
          )}
          {col("mother_phone") && (
            <div>
              <FieldLabel>Mother&apos;s phone</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("mother_phone")}
              />
            </div>
          )}
          {col("emergency_contact_name") && (
            <div>
              <FieldLabel>Emergency contact name</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("emergency_contact_name")}
              />
            </div>
          )}
          {col("emergency_contact_number") && (
            <div>
              <FieldLabel>Emergency contact number</FieldLabel>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                {...register("emergency_contact_number")}
              />
            </div>
          )}
        </div>
        {col("correspondence_address") && (
          <div>
            <FieldLabel>Correspondence address</FieldLabel>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              {...register("correspondence_address")}
            />
          </div>
        )}
        {col("permanent_address") && (
          <div>
            <FieldLabel required>Permanent address</FieldLabel>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              {...register("permanent_address")}
            />
          </div>
        )}
        {col("near_police_station") && (
          <div>
            <FieldLabel required>Near police station</FieldLabel>
            <p className="text-xs text-gray-500 mb-1">Nearest police station name (mandatory on profile)</p>
            <input
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              {...register("near_police_station")}
            />
          </div>
        )}
      </section>

      {/* Identity & address proof (KYC documents) — always visible; API saves only if columns exist */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 md:p-6 space-y-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">KYC documents</h2>
        <p className="text-xs text-gray-600">
          Uploads are only persisted when <code className="rounded bg-white/80 px-1">employee_profiles</code> has a
          matching column (for example <code className="rounded bg-white/80 px-1">pan_card_path</code>,{" "}
          <code className="rounded bg-white/80 px-1">cert_10th_url</code>).
        </p>

        <div className="rounded-lg border border-amber-300 bg-white/90 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Identity proof (mandatory)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DocRow
              label="PAN Card"
              required
              name="pan_card"
              register={register}
              watch={watch}
              existingUrl={getSavedDocUrl(saved, "pan_card")}
            />
            <DocRow
              label="Voter ID"
              name="voter_id"
              register={register}
              watch={watch}
              existingUrl={getSavedDocUrl(saved, "voter_id")}
            />
          </div>
        </div>

        <div className="rounded-lg border border-amber-300 bg-white/90 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Address proof (mandatory)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DocRow
              label="Aadhaar Card"
              required
              name="aadhaar_card"
              register={register}
              watch={watch}
              existingUrl={getSavedDocUrl(saved, "aadhaar_card")}
            />
            <div className="space-y-2">
              <DocRow
                label="Electricity Bill"
                required
                name="electricity_bill"
                register={register}
                watch={watch}
                existingUrl={getSavedDocUrl(saved, "electricity_bill")}
              />
              <div className="pl-1">
                <FieldLabel required>This bill is for</FieldLabel>
                <select
                  className="w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  {...register(billTypeRegisterName)}
                >
                  <option value="">Select Current or Permanent</option>
                  <option value="Current">Current</option>
                  <option value="Permanent">Permanent</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <DocRow
                label="Rent Agreement (if applicable)"
                name="rent_agreement"
                register={register}
                watch={watch}
                existingUrl={getSavedDocUrl(saved, "rent_agreement")}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white/90 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Other / verification</h3>
          <DocRow
            label="Police verification form"
            name="police_verification"
            register={register}
            watch={watch}
            existingUrl={getSavedDocUrl(saved, "police_verification")}
          />
        </div>
      </section>

      {/* Qualification rows — CRM employee_education fields only */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 md:p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Qualification details<span className="text-red-600">*</span>
          </h2>
          <button
            type="button"
            onClick={() => setEducationRows((prev) => [...prev, newEducationRow()])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add qualification
          </button>
        </div>

        <p className="text-xs text-gray-600">
          Per the CRM, only these four fields apply: <strong>exam name</strong>, <strong>board / university</strong>,{" "}
          <strong>year</strong>, <strong>grade %</strong>.
          {col("education_json")
            ? ""
            : " This list is saved only when the profile has an `education_json` column."}
        </p>

        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          At least one row: Exam/Degree and Board/University are required.
        </div>
        <div className="space-y-3">
          {educationRows.map((row, idx) => (
            <div
              key={row.id}
              className="rounded-lg border border-gray-200 bg-white p-3 md:p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">Qualification {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeEducationRow(idx)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <FieldLabel required>Exam / Degree</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="e.g., B.Com"
                    value={row.exam_name}
                    onChange={(e) => updateEducationRow(idx, { exam_name: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel required>Board / University</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={row.board_university}
                    onChange={(e) => updateEducationRow(idx, { board_university: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Year of passing</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="2020"
                    value={row.year_of_passing}
                    onChange={(e) => updateEducationRow(idx, { year_of_passing: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Grade / Percentage</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="75%"
                    value={row.grade_percentage}
                    onChange={(e) => updateEducationRow(idx, { grade_percentage: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-emerald-100 bg-white p-4 md:p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Qualification certificates &amp; marksheets</h2>
        <p className="text-xs text-gray-600">These uploads are linked via CRM document keys.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DocRow
            label="10th Qualification Certificate"
            required
            name="cert_10th"
            register={register}
            watch={watch}
            existingUrl={getSavedDocUrl(saved, "cert_10th")}
          />
          <DocRow
            label="12th Qualification Certificate"
            required
            name="cert_12th"
            register={register}
            watch={watch}
            existingUrl={getSavedDocUrl(saved, "cert_12th")}
          />
          <DocRow
            label="Diploma / Degree Certificate"
            name="diploma_cert"
            register={register}
            watch={watch}
            existingUrl={getSavedDocUrl(saved, "diploma_cert")}
          />
          <DocRow
            label="Relevant Technical Certification"
            name="tech_cert"
            register={register}
            watch={watch}
            existingUrl={getSavedDocUrl(saved, "tech_cert")}
          />
        </div>
      </section>

      {/* Experience / payroll supporting documents */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 md:p-6 space-y-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Bank & payroll / experience documents</h2>

        {(!col("is_experienced") || normalizeIsExperiencedBool(watchedEmploymentType)) && (
          <div className="rounded-lg border border-amber-300 bg-white/90 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Experience documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DocRow
                label="Appointment Letter (Previous Company)"
                required
                name="appt_letter_prev"
                register={register}
                watch={watch}
                existingUrl={getSavedDocUrl(saved, "appt_letter_prev")}
              />
              <DocRow
                label="Experience Letter"
                required
                name="exp_letter"
                register={register}
                watch={watch}
                existingUrl={getSavedDocUrl(saved, "exp_letter")}
              />
              <DocRow
                label="Relieving Letter"
                required
                name="relieving_letter"
                register={register}
                watch={watch}
                existingUrl={getSavedDocUrl(saved, "relieving_letter")}
              />
              <DocRow
                label="Last 3 Months Salary Slips"
                required
                name="salary_slips"
                register={register}
                watch={watch}
                existingUrl={getSavedDocUrl(saved, "salary_slips")}
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-amber-300 bg-white/90 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Bank & payroll details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DocRow
              label="Cancelled Cheque / Bank Passbook (Front)"
              required
              name="cancelled_cheque"
              register={register}
              watch={watch}
              existingUrl={getSavedDocUrl(saved, "cancelled_cheque")}
            />
          </div>
        </div>
      </section>

      {/* Banking & tax */}
      {(col("pan_number") ||
        col("aadhar_number") ||
        col("aadhaar_number") ||
        col("pf_uan") ||
        col("esic_number") ||
        col("name_as_per_bank") ||
        col("bank_name") ||
        col("ifsc_code") ||
        col("bank_account_number")) && (
        <section className="rounded-xl border border-sky-200 bg-amber-50/40 p-4 md:p-6 space-y-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Banking & tax</h2>

          <div className="rounded-lg bg-white/80 p-4 border border-gray-200 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Tax & IDs</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {col("pan_number") && (
                <div>
                  <FieldLabel required>PAN number</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase"
                    {...register("pan_number")}
                  />
                </div>
              )}
              {(col("aadhar_number") || col("aadhaar_number")) && (
                <div>
                  <FieldLabel required>Aadhaar number</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    {...register(col("aadhaar_number") ? "aadhaar_number" : "aadhar_number")}
                  />
                </div>
              )}
              {col("pf_uan") && (
                <div>
                  <FieldLabel>PF UAN</FieldLabel>
                  <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register("pf_uan")} />
                </div>
              )}
            </div>
            {col("esic_number") && (
              <div className="max-w-md">
                <FieldLabel>ESIC number</FieldLabel>
                <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register("esic_number")} />
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white/80 p-4 border border-gray-200 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Bank account</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {col("name_as_per_bank") && (
                <div>
                  <FieldLabel>Name as per bank</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    {...register("name_as_per_bank")}
                  />
                </div>
              )}
              {col("bank_name") && (
                <div>
                  <FieldLabel>Bank name</FieldLabel>
                  <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register("bank_name")} />
                </div>
              )}
              {col("ifsc_code") && (
                <div>
                  <FieldLabel>IFSC code</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase"
                    {...register("ifsc_code")}
                  />
                </div>
              )}
              {col("bank_account_number") && (
                <div>
                  <FieldLabel>Bank account number</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    {...register("bank_account_number")}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Documents & files */}
      {(col("profile_photo") ||
        col("signature") ||
        col("documents_submitted") ||
        col("leave_policy")) && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 md:p-6 space-y-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {col("profile_photo") && (
              <div>
                <FieldLabel required>Profile photo</FieldLabel>
                <input type="file" accept="image/*" className="w-full text-sm" {...register("profile_photo")} />
                {saved?.profile_photo && (
                  <a
                    href={saved.profile_photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                  >
                    View current file
                  </a>
                )}
              </div>
            )}
            {col("signature") && (
              <div>
                <FieldLabel required>Signature</FieldLabel>
                <input type="file" accept="image/*" className="w-full text-sm" {...register("signature")} />
                {saved?.signature && (
                  <a
                    href={saved.signature}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                  >
                    View current file
                  </a>
                )}
              </div>
            )}
          </div>

          {col("documents_submitted") && (
            <div>
              <FieldLabel>Documents submitted</FieldLabel>
              <p className="text-xs text-gray-500 mb-1">JSON object (document checklist)</p>
              <textarea
                rows={5}
                placeholder='{"pan": true, "aadhaar": true}'
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs"
                {...register("documents_submitted")}
              />
            </div>
          )}

          {col("leave_policy") && (
            <div>
              <FieldLabel>Leave policy</FieldLabel>
              <p className="text-xs text-gray-500 mb-1">JSON (sick / paid flags, etc.)</p>
              <textarea
                rows={5}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs"
                {...register("leave_policy")}
              />
            </div>
          )}
        </section>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={isLocked || submitting}
          className="rounded-lg bg-green-700 px-6 py-2.5 text-sm font-medium text-white shadow hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save profile"}
        </button>
      </div>
      </fieldset>
      )}

      {submitting && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[2px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-sky-200 bg-white px-8 py-6 shadow-xl">
            <Loader2 className="h-10 w-10 animate-spin text-sky-600" aria-hidden />
            <p className="text-sm font-medium text-gray-800">Saving profile…</p>
            <p className="text-xs text-gray-500 text-center max-w-xs">Please wait for confirmation.</p>
          </div>
        </div>
      )}
    </form>
  );
}
