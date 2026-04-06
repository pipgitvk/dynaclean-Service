/**
 * app.dynaclean–style profile merge: doc_* uploads → joining_form_documents + documents_submitted,
 * plus child-table JSON payloads for references / education / experience.
 */

export const EMPCRM_DOC_KEYS = [
  "doc_pan_card",
  "doc_voter_id",
  "doc_aadhaar_card",
  "doc_electricity_bill",
  "doc_rent_agreement",
  "doc_10th_certificate",
  "doc_12th_certificate",
  "doc_degree_diploma",
  "doc_technical_cert",
  "doc_appt_letter_prev",
  "doc_exp_letter",
  "doc_relieving_letter",
  "doc_salary_slips",
  "doc_loi_appointment",
  "doc_joining_form",
  "doc_emp_verification",
  "doc_code_conduct",
  "doc_cancelled_cheque",
  "doc_nda",
  "doc_company_policy",
  "doc_police_verification",
];

/** doc_paths / joining_form_documents docKey → MyProfileForm logical keys (getSavedDocUrl) */
export const EMPCRM_DOC_KEY_TO_LOGICAL = {
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
  doc_loi_appointment: "loi_appointment",
  doc_joining_form: "joining_form",
  doc_emp_verification: "emp_verification",
  doc_code_conduct: "code_conduct",
  doc_cancelled_cheque: "cancelled_cheque",
  doc_nda: "nda",
  doc_company_policy: "company_policy",
  doc_police_verification: "police_verification",
};

const CHILD_JSON_KEYS = new Set(["references", "education", "experience"]);

export function isChildJsonFormKey(key) {
  return CHILD_JSON_KEYS.has(String(key || ""));
}

export function parseJsonArrayField(raw) {
  if (raw == null || raw === "") return [];
  if (typeof raw !== "string") return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Merge uploaded doc_* URLs into joining array (array of { docKey, url }) and checklist object. */
export function mergeDocUploadsIntoProfileJson({
  existingJoiningRaw,
  existingDocumentsSubmittedRaw,
  uploads,
}) {
  let joining = [];
  if (typeof existingJoiningRaw === "string" && existingJoiningRaw.trim()) {
    try {
      const p = JSON.parse(existingJoiningRaw);
      joining = Array.isArray(p) ? [...p] : [];
    } catch {
      joining = [];
    }
  }

  let checklist = {};
  if (typeof existingDocumentsSubmittedRaw === "string" && existingDocumentsSubmittedRaw.trim()) {
    try {
      const p = JSON.parse(existingDocumentsSubmittedRaw);
      checklist = p && typeof p === "object" && !Array.isArray(p) ? { ...p } : {};
    } catch {
      checklist = {};
    }
  }

  const docPaths = checklist.doc_paths && typeof checklist.doc_paths === "object" && !Array.isArray(checklist.doc_paths)
    ? { ...checklist.doc_paths }
    : {};

  for (const { docKey, url } of uploads) {
    if (!docKey || !url) continue;
    joining.push({ docKey, url });
    docPaths[docKey] = url;
  }

  checklist.doc_paths = docPaths;
  return {
    joining_form_documents: JSON.stringify(joining),
    documents_submitted: JSON.stringify(checklist),
  };
}

export async function loadTableColumnSet(conn, tableName) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return new Set(rows.map((r) => r.c));
}

/**
 * Replace rows for this user in a child table (delete then insert).
 * When `profile_id` exists on the child table, pass `employee_profiles.id` (required for FKs like fk_education_profile).
 */
export async function syncChildTableFromJson(
  conn,
  tableName,
  columnSet,
  username,
  empId,
  rows,
  jsonToDb,
  profileId,
) {
  if (!columnSet.size || !rows.length) return;

  const profileIdCol = columnSet.has("profile_id") ? "profile_id" : null;
  if (profileIdCol && (profileId == null || profileId === "")) {
    throw new Error(
      "Cannot sync child rows: employee_profiles.id (profile_id) is required for this table.",
    );
  }
  const usernameCol = columnSet.has("username")
    ? "username"
    : columnSet.has("user_name")
      ? "user_name"
      : null;
  const empCol = columnSet.has("empId") ? "empId" : columnSet.has("emp_id") ? "emp_id" : null;

  if (profileIdCol && profileId != null) {
    await conn.execute(`DELETE FROM \`${tableName}\` WHERE \`${profileIdCol}\` = ?`, [profileId]);
  } else if (usernameCol) {
    await conn.execute(`DELETE FROM \`${tableName}\` WHERE \`${usernameCol}\` = ?`, [username]);
  } else if (empCol && empId != null && empId !== "") {
    await conn.execute(`DELETE FROM \`${tableName}\` WHERE \`${empCol}\` = ?`, [empId]);
  }

  for (let i = 0; i < rows.length; i++) {
    const src = rows[i] || {};
    const cols = [];
    const vals = [];

    if (profileIdCol && profileId != null) {
      cols.push(`\`${profileIdCol}\``);
      vals.push(profileId);
    }
    if (usernameCol) {
      cols.push(`\`${usernameCol}\``);
      vals.push(username);
    }
    if (empCol && empId != null && empId !== "") {
      cols.push(`\`${empCol}\``);
      vals.push(empId);
    }

    for (const [jsonKey, dbCol] of Object.entries(jsonToDb)) {
      if (!columnSet.has(dbCol)) continue;
      let v = src[jsonKey];
      if (dbCol === "display_order") v = i;
      if (dbCol === "reference_type" && (v == null || v === "")) v = "Professional";
      cols.push(`\`${dbCol}\``);
      vals.push(v ?? null);
    }

    if (cols.length === 0) continue;
    await conn.execute(
      `INSERT INTO \`${tableName}\` (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      vals,
    );
  }
}

export const EMPCRM_REFERENCE_MAP = {
  name: "reference_name",
  contact: "reference_mobile",
  address: "reference_address",
  relationship: "relationship",
  reference_type: "reference_type",
};

export const EMPCRM_EDUCATION_MAP = {
  exam_name: "exam_name",
  board_university: "board_university",
  year_of_passing: "year_of_passing",
  grade_percentage: "grade_percentage",
  display_order: "display_order",
};

export const EMPCRM_EXPERIENCE_MAP = {
  company_name: "company_name",
  designation: "designation",
  gross_salary_ctc: "gross_salary_ctc",
  period_from: "period_from",
  period_to: "period_to",
  reason_for_leaving: "reason_for_leaving",
  display_order: "display_order",
};
