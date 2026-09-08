"use client";

import { useEffect, useState } from "react";
import { PROFILE_FILE_FIELD_ALIASES } from "@/lib/employeeProfileColumns";

// ─── Constants (same as ViewProfileModal in MyProfileForm) ───────────────────

const VIEW_SECTIONS = [
  {
    title: "Employment Details",
    fields: [
      { label: "Employee Code", key: "employee_code" },
      { label: "Username", key: "username" },
      { label: "Emp ID", key: "empId" },
      { label: "Designation", key: "designation" },
      { label: "Date of Joining", key: "date_of_joining" },
      { label: "Work Location", key: "work_location" },
      { label: "Department", key: "department" },
      { label: "Reporting Manager", key: "reporting_manager" },
      { label: "Employment Status", key: "employment_status" },
      { label: "Probation Period", key: "probation_period" },
      { label: "Source / Reference", key: "source_reference" },
      {
        label: "Employment Type",
        key: "is_experienced",
        format: (v) => (v === true || v === 1 || v === "1" ? "Experienced" : "Fresher"),
      },
    ],
  },
  {
    title: "Personal Details",
    fields: [
      { label: "Name Prefix", key: "name_prefix" },
      { label: "Full Name", key: "full_name" },
      { label: "Date of Birth", key: "date_of_birth" },
      { label: "Marital Status", key: "marital_status" },
      { label: "Blood Group", key: "blood_group" },
      { label: "Email", key: "email" },
      { label: "Contact Mobile", key: "contact_mobile" },
      { label: "Contact Landline", key: "contact_landline" },
      { label: "Father's Name", key: "father_name" },
      { label: "Father's Phone", key: "father_phone" },
      { label: "Mother's Name", key: "mother_name" },
      { label: "Mother's Phone", key: "mother_phone" },
      { label: "Emergency Contact Name", key: "emergency_contact_name" },
      { label: "Emergency Contact Number", key: "emergency_contact_number" },
      { label: "Near Police Station", key: "near_police_station" },
    ],
  },
  {
    title: "Address",
    fields: [
      { label: "Correspondence Address", key: "correspondence_address" },
      { label: "Permanent Address", key: "permanent_address" },
    ],
  },
  {
    title: "Banking & Tax",
    fields: [
      { label: "PAN Number", key: "pan_number" },
      { label: "Aadhaar Number", key: "aadhaar_number", fallback: "aadhar_number" },
      { label: "PF UAN", key: "pf_uan" },
      { label: "ESIC Number", key: "esic_number" },
      { label: "Name as per Bank", key: "name_as_per_bank" },
      { label: "Bank Name", key: "bank_name" },
      { label: "IFSC Code", key: "ifsc_code" },
      { label: "Bank Account Number", key: "bank_account_number" },
    ],
  },
];

const VIEW_DOCS = [
  { label: "PAN Card", key: "pan_card" },
  { label: "Voter ID", key: "voter_id" },
  { label: "Aadhaar Card", key: "aadhaar_card" },
  { label: "Electricity Bill", key: "electricity_bill" },
  { label: "Rent Agreement", key: "rent_agreement" },
  { label: "Police Verification", key: "police_verification" },
  { label: "10th Certificate", key: "cert_10th" },
  { label: "12th Certificate", key: "cert_12th" },
  { label: "Diploma / Degree", key: "diploma_cert" },
  { label: "Technical Certificate", key: "tech_cert" },
  { label: "Appointment Letter (Prev)", key: "appt_letter_prev" },
  { label: "Experience Letter", key: "exp_letter" },
  { label: "Relieving Letter", key: "relieving_letter" },
  { label: "Salary Slips", key: "salary_slips" },
  { label: "Cancelled Cheque / Passbook", key: "cancelled_cheque" },
  { label: "Profile Photo", key: "profile_photo" },
  { label: "Signature", key: "signature" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function parseEducationRows(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ViewProfilePage() {
  const [saved, setSaved] = useState(null);
  const [educationRows, setEducationRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee-profile", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load profile");
        const profile = data.profile || null;
        setSaved(profile);
        setEducationRows(parseEducationRows(profile?.education_json));
      } catch (e) {
        setError(e?.message || "Could not load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const val = (field) => {
    let v = saved?.[field.key];
    if ((v == null || v === "") && field.fallback) v = saved?.[field.fallback];
    if (v == null || v === "") return null;
    return field.format ? field.format(v) : String(v);
  };

  const uploadedDocs = VIEW_DOCS.filter(({ key }) => {
    const url = getSavedDocUrl(saved, key);
    return url && url.trim() !== "";
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center text-gray-500">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-8 rounded-xl bg-red-50 border border-red-200 px-6 py-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page header */}
      <div className="rounded-xl bg-white border border-sky-100 shadow-md px-6 py-5">
        <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Read-only view of your submitted profile details.</p>
      </div>

      {!saved ? (
        <div className="rounded-xl bg-white border border-gray-200 shadow px-6 py-12 text-center text-gray-500 text-sm">
          No profile data found. Please fill and submit your profile first.
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-200 shadow overflow-hidden">
          {/* Dark header strip */}
          <div className="bg-gray-900 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Profile Details (Read-only)</h2>
          </div>

          <div className="p-6 space-y-8">
            {/* Text field sections */}
            {VIEW_SECTIONS.map((section) => {
              const rows = section.fields
                .map((f) => ({ ...f, value: val(f) }))
                .filter((f) => f.value);
              if (rows.length === 0) return null;
              return (
                <div key={section.title}>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {rows.map((f) => (
                      <div
                        key={f.key}
                        className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2"
                      >
                        <p className="text-[11px] text-gray-500 mb-0.5">{f.label}</p>
                        <p className="text-sm font-medium text-gray-800 break-words">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Education rows */}
            {educationRows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">
                  Qualification Details
                </h3>
                <div className="space-y-2">
                  {educationRows.map((row, i) => (
                    <div
                      key={row.id || i}
                      className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-gray-600 mb-1">
                        Qualification {i + 1}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-800">
                        {row.exam_name && (
                          <span>
                            <span className="text-[11px] text-gray-500 block">Exam / Degree</span>
                            {row.exam_name}
                          </span>
                        )}
                        {row.board_university && (
                          <span>
                            <span className="text-[11px] text-gray-500 block">Board / University</span>
                            {row.board_university}
                          </span>
                        )}
                        {row.year_of_passing && (
                          <span>
                            <span className="text-[11px] text-gray-500 block">Year</span>
                            {row.year_of_passing}
                          </span>
                        )}
                        {row.grade_percentage && (
                          <span>
                            <span className="text-[11px] text-gray-500 block">Grade / %</span>
                            {row.grade_percentage}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Uploaded documents */}
            {uploadedDocs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">
                  Uploaded Documents
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uploadedDocs.map(({ label, key }) => {
                    const url = getSavedDocUrl(saved, key);
                    const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-green-600 text-sm">✓</span>
                          <span className="text-sm text-gray-700 truncate">{label}</span>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-md bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          {isImage ? "View Image" : "View / Download"}
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {uploadedDocs.length === 0 &&
              VIEW_SECTIONS.every(
                (s) => s.fields.map((f) => ({ ...f, value: val(f) })).filter((f) => f.value).length === 0,
              ) && (
                <p className="text-center text-gray-400 text-sm py-6">
                  No profile data to display.
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
