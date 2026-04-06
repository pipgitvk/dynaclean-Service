"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { PROFILE_FILE_FIELD_ALIASES } from "@/lib/employeeProfileColumns";

/** True once employee_profiles row exists (GET returns id). */
function hasPersistedProfileRow(saved) {
  if (!saved) return false;
  const id = saved.id;
  if (id === null || id === undefined || id === "") return false;
  return true;
}

/**
 * Editable only when no DB row yet, or HR ne reject kiya ho (dubara submit).
 * DB me data hai aur rejected nahi → read-only.
 */
function isProfileLockedFromServer(saved) {
  const st = String(getProfileApprovalStatus(saved) || "").toLowerCase();
  if (st === "rejected") return false;
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
    institution: "",
    degree: "",
    year: "",
    board: "",
    percentage: "",
  };
}

function normalizeEducationRows(arr) {
  return (Array.isArray(arr) ? arr : []).map((r, i) => ({
    id:
      r?.id != null && String(r.id).trim() !== ""
        ? String(r.id)
        : typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `edu_${i}_${Date.now()}`,
    institution: String(r?.institution ?? ""),
    degree: String(r?.degree ?? ""),
    year: String(r?.year ?? ""),
    board: String(r?.board ?? ""),
    percentage: String(r?.percentage ?? ""),
  }));
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
        if (initial.is_experienced !== undefined && initial.is_experienced !== null) {
          initial.is_experienced =
            initial.is_experienced === true ||
            initial.is_experienced === 1 ||
            initial.is_experienced === "1";
        }
        setSaved(initial);
        reset(initial);
        setEducationRows(normalizeEducationRows(parseEducationRows(initial.education_json)));
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
      toast.error("Profile save ho chuka hai. Sirf HR rejection ke baad edit kar sakte hain.");
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

    if (col("education_json")) {
      const filled = educationRows.filter(
        (r) => String(r.institution || "").trim() && String(r.degree || "").trim(),
      );
      if (filled.length === 0) {
        toast.error('At least one education entry is required. Click "Add Education".');
        return;
      }
    }

    const fd = new FormData();
    if (col("education_json")) {
      fd.append("education_json", JSON.stringify(educationRows));
    }
    const empcrmEducation = educationRows.map((r) => ({
      exam_name: String(r.degree || "").trim() || String(r.institution || "").trim(),
      board_university: String(r.board || r.institution || "").trim(),
      year_of_passing: String(r.year || "").trim(),
      grade_percentage: String(r.percentage || "").trim(),
    }));
    if (empcrmEducation.some((r) => r.exam_name || r.board_university)) {
      fd.append("education", JSON.stringify(empcrmEducation));
    }
    for (const key of Object.keys(data)) {
      const val = data[key];

      if (key === "is_experienced") {
        fd.append("is_experienced", data.is_experienced ? "1" : "0");
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

    try {
      const res = await fetch("/api/employee-profile", {
        method: "PUT",
        credentials: "include",
        body: fd,
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Save failed");
      toast.success(
        hasApprovalColumn
          ? "Profile saved — HR approval ke liye bheja gaya."
          : "Profile saved",
      );
      setStatusModal("pending");
      const reload = await fetch("/api/employee-profile", { credentials: "include" });
      const again = await reload.json();
      if (again.profile) {
        const next = { ...again.profile };
        if (next.is_experienced !== undefined && next.is_experienced !== null) {
          next.is_experienced =
            next.is_experienced === true || next.is_experienced === 1 || next.is_experienced === "1";
        }
        setSaved(next);
        reset(next);
        setEducationRows(normalizeEducationRows(parseEducationRows(next.education_json)));
      }
    } catch (e) {
      toast.error(e?.message || "Save failed");
    }
  };

  const approvalStatus = getProfileApprovalStatus(saved);
  const approvalStatusLower = String(approvalStatus || "").toLowerCase();
  const isLocked = isProfileLockedFromServer(saved);

  useEffect(() => {
    if (!saved) return;
    if (!["approved", "rejected"].includes(approvalStatusLower)) return;
    const userKey = saved.username || "self";
    const seenKey = `employee_profile_submission_seen_${userKey}`;
    let lastSeen = "";
    try {
      lastSeen = localStorage.getItem(seenKey) || "";
    } catch {
      lastSeen = "";
    }
    if (lastSeen !== approvalStatusLower) {
      setStatusModal(approvalStatusLower);
      try {
        localStorage.setItem(seenKey, approvalStatusLower);
      } catch {}
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
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-5xl mx-auto space-y-6 pb-16"
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
                  : statusModal === "pending"
                    ? "Awaiting HR approval"
                    : "Profile Rejected"}
              </h3>
              <p className="mt-4 text-base text-gray-600">
                {statusModal === "approved"
                  ? "HR ne aapka profile approve kar diya hai."
                  : statusModal === "pending"
                    ? "Your profile has been submitted and is waiting for review."
                    : "Aapka profile reject hua hai. Required changes karke dubara submit karein."}
              </p>
              <button
                type="button"
                onClick={() => setStatusModal("")}
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
            {!["approved", "rejected"].includes(approvalStatusLower) && approvalStatus}
          </div>
        )}
        {isLocked && (
          <p className="mt-2 text-sm text-gray-600">
            {/* Profile database mein save ho chuka hai — HR rejection ke alawa fields edit nahi ho sakti. */}
          </p>
        )}
      </div>

      <fieldset disabled={isLocked} className="min-w-0 border-0 p-0 m-0 space-y-6">
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
          {col("is_experienced") && (
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_experienced"
                className="rounded border-gray-300"
                {...register("is_experienced")}
              />
              <label htmlFor="is_experienced" className="text-sm font-medium text-gray-800">
                Experienced (prior work experience)
              </label>
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
          Files upload ho kar tabhi save honge jab <code className="rounded bg-white/80 px-1">employee_profiles</code> mein
          matching column ho (jaise <code className="rounded bg-white/80 px-1">pan_card_path</code>,{" "}
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

      {/* Qualification details — always visible */}
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
            Add Education
          </button>
        </div>

        <p className="text-xs text-gray-600">
          Education list tabhi save hogi jab DB mein <code className="rounded bg-white/80 px-1">education_json</code> column ho.
          Certificate files ke liye columns jaise <code className="rounded bg-white/80 px-1">cert_10th_url</code> add karein.
        </p>

        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          At least one education entry is required. Click &quot;Add Education&quot; to add a row.
        </div>
        <div className="space-y-3">
          {educationRows.map((row, idx) => (
            <div
              key={row.id}
              className="rounded-lg border border-gray-200 bg-white p-3 md:p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">Education {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeEducationRow(idx)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <FieldLabel required>Institution / School</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={row.institution}
                    onChange={(e) => updateEducationRow(idx, { institution: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel required>Degree / Course</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={row.degree}
                    onChange={(e) => updateEducationRow(idx, { degree: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Year of passing</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={row.year}
                    onChange={(e) => updateEducationRow(idx, { year: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Board / University</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={row.board}
                    onChange={(e) => updateEducationRow(idx, { board: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Percentage / CGPA</FieldLabel>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={row.percentage}
                    onChange={(e) => updateEducationRow(idx, { percentage: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-sm font-semibold text-gray-900">Certificates &amp; marksheets</p>
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
          disabled={isLocked}
          className="rounded-lg bg-green-700 px-6 py-2.5 text-sm font-medium text-white shadow hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save profile
        </button>
      </div>
      </fieldset>
    </form>
  );
}
