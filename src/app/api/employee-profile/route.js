import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import { RESERVED_PROFILE_COLUMNS, resolveDbColumn, resolveFileDbColumn } from "@/lib/employeeProfileColumns";
import { uploadEmployeeProfileDocument } from "@/lib/employeeProfileStorage";
import {
  EMPCRM_DOC_KEYS,
  EMPCRM_DOC_KEY_TO_LOGICAL,
  EMPCRM_EDUCATION_MAP,
  EMPCRM_EXPERIENCE_MAP,
  EMPCRM_REFERENCE_MAP,
  mergeDocUploadsIntoProfileJson,
  parseJsonArrayField,
  loadTableColumnSet,
  syncChildTableFromJson,
} from "@/lib/empcrmProfileMerge";

const JSON_TEXT_COLUMNS = new Set(["documents_submitted", "leave_policy", "education_json"]);

/** Client cannot set these; server owns workflow columns. */
const CLIENT_BLOCKED_PROFILE_COLUMNS = new Set([
  ...RESERVED_PROFILE_COLUMNS,
  "profile_approval_status",
  "hr_approval_status",
  "profile_hr_status",
]);

const FORM_SKIP_SCALAR_KEYS = new Set([
  "joining_form_documents_prev",
  "references",
  "education",
  "experience",
]);
const PROFILE_LOCKED_STATUSES = new Set(["pending", "pending_hr_docs", "pending_admin"]);

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

function getAuthToken(req) {
  return (
    req.cookies.get("impersonation_token")?.value ||
    req.cookies.get("token")?.value ||
    null
  );
}

async function getSessionUsername(req) {
  const token = getAuthToken(req);
  if (!token) return null;
  const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  return payload?.username ?? null;
}

/**
 * employee_profiles.empId FK references rep_list(empId). Must use rep_list only —
 * UNION with emplist could return an empId that does not exist in rep_list and breaks INSERT/UPDATE.
 */
async function loadRepListEmpId(conn, username) {
  if (!username) return null;
  const [rows] = await conn.execute(`SELECT empId FROM rep_list WHERE username = ? LIMIT 1`, [
    username,
  ]);
  const v = rows[0]?.empId;
  const cleaned = v != null ? String(v).trim() : "";
  return cleaned !== "" ? cleaned : null;
}

async function loadProfileColumnNames(conn) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles'`,
  );
  return new Set(rows.map((r) => r.c));
}

async function loadSubmissionColumnNames(conn) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profile_submission'`,
  );
  return new Set(rows.map((r) => r.c));
}

function firstExistingColumn(columnSet, names) {
  for (const name of names) {
    if (columnSet.has(name)) return name;
  }
  return null;
}

async function syncSubmissionStatus(conn, { username, empId, status, actedBy }) {
  const subCols = await loadSubmissionColumnNames(conn);
  if (subCols.size === 0) return;

  const idCol = firstExistingColumn(subCols, ["id", "submission_id"]);
  const usernameCol = firstExistingColumn(subCols, ["username", "user_name"]);
  const empCol = firstExistingColumn(subCols, ["empId", "emp_id", "employee_id"]);
  const statusCol = firstExistingColumn(subCols, ["approval_status", "profile_approval_status", "status"]);
  const submittedAtCol = firstExistingColumn(subCols, ["submitted_at", "created_at", "submission_date"]);
  const reviewedAtCol = firstExistingColumn(subCols, ["reviewed_at", "approved_at", "action_at", "updated_at"]);
  const reviewedByCol = firstExistingColumn(subCols, ["reviewed_by", "approved_by", "hr_username", "action_by"]);

  if (!statusCol) return;

  const whereParts = [];
  const whereVals = [];
  if (usernameCol && username) {
    whereParts.push(`\`${usernameCol}\` = ?`);
    whereVals.push(username);
  }
  if (empCol && empId) {
    whereParts.push(`\`${empCol}\` = ?`);
    whereVals.push(empId);
  }
  if (whereParts.length === 0) return;

  const orderBy = idCol ? ` ORDER BY \`${idCol}\` DESC` : "";
  const [existing] = await conn.execute(
    `SELECT * FROM employee_profile_submission WHERE ${whereParts.join(" OR ")}${orderBy} LIMIT 1`,
    whereVals,
  );

  const setParts = [`\`${statusCol}\` = ?`];
  const setVals = [status];

  if (PROFILE_LOCKED_STATUSES.has(status) && submittedAtCol) {
    setParts.push(`\`${submittedAtCol}\` = NOW()`);
  }
  if ((status === "approved" || status === "rejected") && reviewedAtCol) {
    setParts.push(`\`${reviewedAtCol}\` = NOW()`);
  }
  if ((status === "approved" || status === "rejected") && reviewedByCol && actedBy) {
    setParts.push(`\`${reviewedByCol}\` = ?`);
    setVals.push(actedBy);
  }

  if (existing.length > 0 && idCol && existing[0]?.[idCol] != null) {
    setVals.push(existing[0][idCol]);
    await conn.execute(
      `UPDATE employee_profile_submission SET ${setParts.join(", ")} WHERE \`${idCol}\` = ? LIMIT 1`,
      setVals,
    );
    return;
  }

  const insertCols = [];
  const placeholders = [];
  const insertVals = [];

  if (usernameCol && username) {
    insertCols.push(`\`${usernameCol}\``);
    placeholders.push("?");
    insertVals.push(username);
  }
  if (empCol && empId) {
    insertCols.push(`\`${empCol}\``);
    placeholders.push("?");
    insertVals.push(empId);
  }
  insertCols.push(`\`${statusCol}\``);
  placeholders.push("?");
  insertVals.push(status);

  await conn.execute(
    `INSERT INTO employee_profile_submission (${insertCols.join(", ")}) VALUES (${placeholders.join(", ")})`,
    insertVals,
  );
}

/**
 * Keep empcrm queue table in sync as well (employee_profile_submissions, plural).
 * This is used by dhynaclean_crm-style approval flow.
 */
async function insertEmpcrmSubmissionQueueRow(
  conn,
  { username, empId, payload, uploadedFiles, submittedBy, status = "pending" },
) {
  const subCols = await loadTableColumnSet(conn, "employee_profile_submissions");
  if (subCols.size === 0) return;

  const cols = [];
  const vals = [];
  if (subCols.has("username")) {
    cols.push("`username`");
    vals.push(username);
  }
  if (subCols.has("empId")) {
    cols.push("`empId`");
    vals.push(empId ?? null);
  } else if (subCols.has("emp_id")) {
    cols.push("`emp_id`");
    vals.push(empId ?? null);
  }
  if (subCols.has("status")) {
    cols.push("`status`");
    vals.push(status);
  }
  if (subCols.has("payload")) {
    cols.push("`payload`");
    vals.push(JSON.stringify(payload || {}));
  }
  if (subCols.has("uploaded_files")) {
    cols.push("`uploaded_files`");
    vals.push(JSON.stringify(Array.isArray(uploadedFiles) ? uploadedFiles : []));
  }
  if (subCols.has("submitted_by")) {
    cols.push("`submitted_by`");
    vals.push(submittedBy || username);
  }
  if (cols.length === 0) return;

  await conn.execute(
    `INSERT INTO employee_profile_submissions (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    vals,
  );
}

/** Reassign/resubmit handling for empcrm submissions table. */
async function syncEmpcrmSubmissionQueueOnEmployeeSave(
  conn,
  { username, empId, payload, uploadedFiles, submittedBy, status = "pending" },
) {
  const subCols = await loadTableColumnSet(conn, "employee_profile_submissions");
  if (!subCols.size || !subCols.has("status")) return;

  const latestSub = await loadLatestEmpcrmSubmissionRow(conn, username, empId);
  const latestStatus = String(latestSub?.status || "").trim().toLowerCase();
  const canResubmitInPlace =
    (latestStatus === "reassign" || latestStatus === "revision_requested") &&
    subCols.has("id") &&
    latestSub?.id != null;

  if (!canResubmitInPlace) {
    await insertEmpcrmSubmissionQueueRow(conn, { username, empId, payload, uploadedFiles, submittedBy, status });
    return;
  }

  const setParts = [];
  const vals = [];
  setParts.push("`status` = ?");
  vals.push(status);
  if (subCols.has("payload")) {
    setParts.push("`payload` = ?");
    vals.push(JSON.stringify(payload || {}));
  }
  if (subCols.has("uploaded_files")) {
    setParts.push("`uploaded_files` = ?");
    vals.push(JSON.stringify(Array.isArray(uploadedFiles) ? uploadedFiles : []));
  }
  if (subCols.has("submitted_by")) {
    setParts.push("`submitted_by` = ?");
    vals.push(submittedBy || username);
  }
  if (subCols.has("submitted_at")) setParts.push("`submitted_at` = NOW()");
  if (subCols.has("reviewed_by")) setParts.push("`reviewed_by` = NULL");
  if (subCols.has("reviewed_at")) setParts.push("`reviewed_at` = NULL");
  if (subCols.has("rejection_reason")) setParts.push("`rejection_reason` = NULL");
  if (subCols.has("pending_assignee_username")) setParts.push("`pending_assignee_username` = NULL");
  vals.push(latestSub.id);

  await conn.execute(
    `UPDATE employee_profile_submissions SET ${setParts.join(", ")} WHERE id = ? LIMIT 1`,
    vals,
  );
}

function serializeRow(row) {
  if (!row) return null;
  const out = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      out[k] = `${y}-${m}-${d}`;
      continue;
    }
    if (v !== null && typeof v === "object" && !Buffer.isBuffer(v)) {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

/** Fill logical doc_* URLs on profile so MyProfileForm getSavedDocUrl sees them (data may live only in documents_submitted / joining_form_documents). */
function enrichProfileWithDocStorage(profile) {
  if (!profile || typeof profile !== "object") return;

  let docs = profile.documents_submitted;
  if (typeof docs === "string" && docs.trim()) {
    try {
      docs = JSON.parse(docs);
    } catch {
      docs = null;
    }
  }
  if (docs && typeof docs === "object" && docs.doc_paths && typeof docs.doc_paths === "object") {
    for (const [docKey, url] of Object.entries(docs.doc_paths)) {
      if (!url || typeof url !== "string") continue;
      const logical = EMPCRM_DOC_KEY_TO_LOGICAL[docKey];
      if (!logical) continue;
      const existing = profile[logical];
      if (existing != null && String(existing).trim() !== "") continue;
      profile[logical] = url;
    }
  }

  let joining = profile.joining_form_documents;
  if (typeof joining === "string" && joining.trim()) {
    try {
      joining = JSON.parse(joining);
    } catch {
      joining = null;
    }
  }
  if (Array.isArray(joining)) {
    for (const item of joining) {
      if (!item || typeof item !== "object") continue;
      const url = item.url;
      const docKey = item.docKey;
      if (!url || !docKey) continue;
      const logical = EMPCRM_DOC_KEY_TO_LOGICAL[docKey];
      if (!logical) continue;
      const existing = profile[logical];
      if (existing != null && String(existing).trim() !== "") continue;
      profile[logical] = url;
    }
  }
}

/** When education_json is empty but employee_education has rows, build JSON for the form. */
async function mergeEducationFromChildTable(conn, profile, columnSet) {
  const ejCol = resolveDbColumn("education_json", columnSet);
  if (!ejCol) return;

  const existingRaw = profile[ejCol];
  let hasContent = false;
  if (typeof existingRaw === "string" && existingRaw.trim()) {
    try {
      const arr = JSON.parse(existingRaw);
      hasContent = Array.isArray(arr) && arr.length > 0;
    } catch {
      hasContent = false;
    }
  }
  if (hasContent) return;

  const profileId = profile.id ?? profile.ID;
  if (profileId == null || profileId === "") return;

  const eduCols = await loadTableColumnSet(conn, "employee_education");
  if (!eduCols.has("profile_id")) return;

  const selectCols = ["exam_name", "board_university", "year_of_passing", "grade_percentage"].filter((c) =>
    eduCols.has(c),
  );
  if (selectCols.length === 0) return;

  const orderCol = eduCols.has("display_order")
    ? "display_order"
    : eduCols.has("id")
      ? "id"
      : null;
  const orderBy = orderCol ? ` ORDER BY \`${orderCol}\` ASC` : "";

  const [eduRows] = await conn.execute(
    `SELECT ${selectCols.map((c) => `\`${c}\``).join(", ")} FROM employee_education WHERE profile_id = ?${orderBy}`,
    [profileId],
  );
  if (!eduRows.length) return;

  const mapped = eduRows.map((r, i) => ({
    id: `edu_child_${i}`,
    institution: String(r.board_university ?? ""),
    degree: String(r.exam_name ?? ""),
    year: String(r.year_of_passing ?? ""),
    board: "",
    percentage: String(r.grade_percentage ?? ""),
  }));
  profile[ejCol] = JSON.stringify(mapped);
}

/** Latest empcrm submission row (status + reassign metadata) */
async function loadLatestEmpcrmSubmissionRow(conn, username, empId) {
  const subCols = await loadTableColumnSet(conn, "employee_profile_submissions");
  if (!subCols.size || !subCols.has("status")) return null;

  const where = [];
  const vals = [];
  if (subCols.has("username") && username) {
    where.push("username = ?");
    vals.push(username);
  }
  const subEmpCol = subCols.has("empId") ? "empId" : subCols.has("emp_id") ? "emp_id" : null;
  if (subEmpCol && empId != null && empId !== "") {
    where.push(`\`${subEmpCol}\` = ?`);
    vals.push(empId);
  }
  if (where.length === 0) return null;

  const orderCol = subCols.has("id")
    ? "id"
    : subCols.has("submitted_at")
      ? "submitted_at"
      : null;
  const orderBy = orderCol ? ` ORDER BY \`${orderCol}\` DESC` : "";
  const selectCols = ["status"];
  if (subCols.has("id")) selectCols.push("id");
  if (subCols.has("reassignment_note")) selectCols.push("reassignment_note");
  if (subCols.has("reassigned_fields")) selectCols.push("reassigned_fields");
  const [rows] = await conn.execute(
    `SELECT ${selectCols.map((c) => `\`${c}\``).join(", ")} FROM employee_profile_submissions WHERE ${where.join(" OR ")}${orderBy} LIMIT 1`,
    vals,
  );
  return rows[0] ?? null;
}

export async function GET(req) {
  try {
    const username = await getSessionUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    const empId = await loadRepListEmpId(conn, username);
    const columnSet = await loadProfileColumnNames(conn);

    if (columnSet.size === 0) {
      return NextResponse.json(
        { error: "employee_profiles table not found or has no columns" },
        { status: 500 },
      );
    }

    const hasUsername = columnSet.has("username");
    const hasEmpId = columnSet.has("empId") || columnSet.has("emp_id");
    const empCol = columnSet.has("empId") ? "empId" : columnSet.has("emp_id") ? "emp_id" : null;

    let rows = [];
    if (hasUsername && hasEmpId && empId && empCol) {
      ;[rows] = await conn.execute(
        `SELECT * FROM employee_profiles WHERE username = ? OR ${empCol} = ? LIMIT 1`,
        [username, empId],
      );
    } else if (hasUsername) {
      ;[rows] = await conn.execute(`SELECT * FROM employee_profiles WHERE username = ? LIMIT 1`, [
        username,
      ]);
    } else if (hasEmpId && empId && empCol) {
      ;[rows] = await conn.execute(
        `SELECT * FROM employee_profiles WHERE ${empCol} = ? LIMIT 1`,
        [empId],
      );
    } else {
      return NextResponse.json(
        { error: "employee_profiles must have username or empId column" },
        { status: 500 },
      );
    }

    const profile = serializeRow(rows[0] ?? null);
    if (profile) {
      enrichProfileWithDocStorage(profile);
      await mergeEducationFromChildTable(conn, profile, columnSet);
      const approvalCol = resolveDbColumn("profile_approval_status", columnSet);
      if (!approvalCol) {
        const latestSub = await loadLatestEmpcrmSubmissionRow(conn, username, empId);
        const fallbackStatus = latestSub?.status != null ? String(latestSub.status).trim() : "";
        if (fallbackStatus) {
          // Client reads this logical key first (getProfileApprovalStatus in MyProfileForm).
          profile.profile_approval_status = fallbackStatus;
        }
        if (latestSub?.id != null) profile.latest_submission_id = latestSub.id;
        if (latestSub?.reassignment_note != null) profile.reassignment_note = latestSub.reassignment_note;
        if (latestSub?.reassigned_fields != null) profile.reassigned_fields = latestSub.reassigned_fields;
      }
    }
    return NextResponse.json({ profile, username, empId, columns: [...columnSet] });
  } catch (e) {
    console.error("[employee-profile GET]", e);
    const msg = e?.sqlMessage || e?.message || "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function isFileLike(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.arrayBuffer !== "function") return false;
  if (typeof value.name !== "string") return false;
  return true;
}

function resolveScalarColumn(key, columnSet) {
  if (columnSet.has(key)) return key;
  return resolveDbColumn(key, columnSet);
}

function getProfileApprovalStatusFromRow(row, columnSet) {
  if (!row) return "";
  const tryCols = [
    resolveDbColumn("profile_approval_status", columnSet),
    resolveDbColumn("hr_approval_status", columnSet),
    resolveDbColumn("profile_hr_status", columnSet),
  ].filter((c) => c && columnSet.has(c));
  for (const col of tryCols) {
    const v = row[col];
    if (v != null && String(v).trim() !== "") return String(v).trim().toLowerCase();
  }
  return "";
}

async function fetchExistingProfileRow(conn, username, empId, columnSet) {
  const hasUsername = columnSet.has("username");
  const empCol = columnSet.has("empId") ? "empId" : columnSet.has("emp_id") ? "emp_id" : null;
  let rows = [];
  if (hasUsername && empCol && empId) {
    ;[rows] = await conn.execute(
      `SELECT * FROM employee_profiles WHERE username = ? OR ${empCol} = ? LIMIT 1`,
      [username, empId],
    );
  } else if (hasUsername) {
    ;[rows] = await conn.execute(`SELECT * FROM employee_profiles WHERE username = ? LIMIT 1`, [
      username,
    ]);
  } else if (empCol && empId) {
    ;[rows] = await conn.execute(
      `SELECT * FROM employee_profiles WHERE ${empCol} = ? LIMIT 1`,
      [empId],
    );
  } else {
    return null;
  }
  return rows[0] ?? null;
}

export async function PUT(req) {
  try {
    const username = await getSessionUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    const empId = await loadRepListEmpId(conn, username);
    const columnSet = await loadProfileColumnNames(conn);

    if (columnSet.size === 0) {
      return NextResponse.json(
        { error: "employee_profiles table not found or has no columns" },
        { status: 500 },
      );
    }

    const approvalCol = resolveDbColumn("profile_approval_status", columnSet);

    const existingRowForLock = await fetchExistingProfileRow(conn, username, empId, columnSet);
    if (existingRowForLock) {
      const st = getProfileApprovalStatusFromRow(existingRowForLock, columnSet);
      const latestSubForLock = await loadLatestEmpcrmSubmissionRow(conn, username, empId);
      const subSt = String(latestSubForLock?.status || "").trim().toLowerCase();
      const allowEdit =
        st === "rejected" ||
        subSt === "rejected" ||
        subSt === "reassign" ||
        subSt === "revision_requested";
      if (!allowEdit) {
        return NextResponse.json(
          {
            error:
              "Profile already saved. You can edit only after HR rejects/reassigns it so you can resubmit corrections.",
          },
          { status: 403 },
        );
      }
    }

    const formData = await req.formData();
    const documentsSubmittedCol = resolveDbColumn("documents_submitted", columnSet);
    const joinCol = resolveFileDbColumn("joining_form_documents", columnSet);

    const updates = {};
    const submissionUploadedFiles = [];
    const joiningFiles = [];
    const unmappedUploadedDocs = {};
    /** doc_* uploads (app.dynaclean style) → merge into joining_form_documents + documents_submitted */
    const docEmpcrmUploads = [];

    for (const [key, value] of formData.entries()) {
      if (isFileLike(value)) {
        if (!value.size) continue;
        const logicalKey = key.startsWith("file_") ? key.slice(5) : key;

        if (logicalKey.startsWith("doc_") && EMPCRM_DOC_KEYS.includes(logicalKey)) {
          const buffer = Buffer.from(await value.arrayBuffer());
          const url = await uploadEmployeeProfileDocument(buffer, value.name, username);
          docEmpcrmUploads.push({ docKey: logicalKey, url });
          submissionUploadedFiles.push(url);
          continue;
        }

        if (logicalKey === "joining_form_documents") {
          joiningFiles.push(value);
          continue;
        }
        const dbCol = resolveFileDbColumn(logicalKey, columnSet);
        const buffer = Buffer.from(await value.arrayBuffer());
        const url = await uploadEmployeeProfileDocument(buffer, value.name, username);
        if (dbCol) {
          updates[dbCol] = url;
          submissionUploadedFiles.push(url);
          continue;
        }
        if (documentsSubmittedCol) {
          unmappedUploadedDocs[logicalKey] = url;
          submissionUploadedFiles.push(url);
        }
        continue;
      }
      if (typeof value !== "string") continue;
      if (FORM_SKIP_SCALAR_KEYS.has(key)) continue;
      if (key.startsWith("doc_")) continue;

      const col = resolveScalarColumn(key, columnSet);
      if (!col || CLIENT_BLOCKED_PROFILE_COLUMNS.has(col)) continue;
      if (!columnSet.has(col)) continue;

      const trimmed = value.trim();
      const isExpCol = resolveDbColumn("is_experienced", columnSet);
      if (isExpCol && col === isExpCol) {
        updates[col] = trimmed === "1" || trimmed === "true" || trimmed === "on" ? 1 : 0;
        continue;
      }

      if (JSON_TEXT_COLUMNS.has(col) && trimmed) {
        try {
          JSON.parse(trimmed);
        } catch {
          return NextResponse.json(
            { error: `Invalid JSON for ${col}` },
            { status: 400 },
          );
        }
      }
      updates[col] = trimmed;
    }

    if (documentsSubmittedCol && Object.keys(unmappedUploadedDocs).length > 0) {
      let docJson = {};
      const raw = updates[documentsSubmittedCol];
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            docJson = parsed;
          }
        } catch {
          docJson = {};
        }
      }
      const prevProfileFiles =
        docJson.profile_files && typeof docJson.profile_files === "object" && !Array.isArray(docJson.profile_files)
          ? docJson.profile_files
          : {};
      docJson.profile_files = { ...prevProfileFiles, ...unmappedUploadedDocs };
      updates[documentsSubmittedCol] = JSON.stringify(docJson);
    }

    if (docEmpcrmUploads.length > 0 && (joinCol || documentsSubmittedCol)) {
      let joinRaw = "";
      let docRaw = "";
      if (joinCol || documentsSubmittedCol) {
        const cols = [];
        if (joinCol) cols.push(`\`${joinCol}\` AS j`);
        if (documentsSubmittedCol) cols.push(`\`${documentsSubmittedCol}\` AS d`);
        const [mergeRows] = await conn.execute(
          `SELECT ${cols.join(", ")} FROM employee_profiles WHERE username = ? LIMIT 1`,
          [username],
        );
        const row = mergeRows[0];
        joinRaw =
          updates[joinCol] !== undefined && typeof updates[joinCol] === "string"
            ? updates[joinCol]
            : row?.j != null
              ? String(row.j)
              : "";
        docRaw =
          updates[documentsSubmittedCol] !== undefined && typeof updates[documentsSubmittedCol] === "string"
            ? updates[documentsSubmittedCol]
            : row?.d != null
              ? String(row.d)
              : "";
      }
      const merged = mergeDocUploadsIntoProfileJson({
        existingJoiningRaw: joinRaw,
        existingDocumentsSubmittedRaw: docRaw,
        uploads: docEmpcrmUploads,
      });
      if (joinCol) updates[joinCol] = merged.joining_form_documents;
      if (documentsSubmittedCol) updates[documentsSubmittedCol] = merged.documents_submitted;
    }

    if (joinCol && joiningFiles.length > 0) {
      let prev = [];
      const prevRaw = formData.get("joining_form_documents_prev");
      if (typeof prevRaw === "string" && prevRaw.trim()) {
        try {
          const p = JSON.parse(prevRaw);
          prev = Array.isArray(p) ? p : [];
        } catch {
          prev = [];
        }
      }
      const uploaded = [];
      for (const f of joiningFiles) {
        const buffer = Buffer.from(await f.arrayBuffer());
        const uploadedUrl = await uploadEmployeeProfileDocument(buffer, f.name, username);
        uploaded.push(uploadedUrl);
        submissionUploadedFiles.push(uploadedUrl);
      }
      const nextStr = JSON.stringify([...prev, ...uploaded]);
      if (joinCol) {
        const cur = updates[joinCol];
        if (typeof cur === "string" && cur.trim()) {
          try {
            const arr = JSON.parse(cur);
            if (Array.isArray(arr)) {
              updates[joinCol] = JSON.stringify([...arr, ...uploaded]);
            } else {
              updates[joinCol] = nextStr;
            }
          } catch {
            updates[joinCol] = nextStr;
          }
        } else {
          updates[joinCol] = nextStr;
        }
      }
    }

    const referencesRaw = formData.get("references");
    const educationRaw = formData.get("education");
    const experienceRaw = formData.get("experience");

    const educationJsonCol = resolveDbColumn("education_json", columnSet);

    const refRows = parseJsonArrayField(referencesRaw);
    const eduRows = parseJsonArrayField(educationRaw);
    const expRows = parseJsonArrayField(experienceRaw);

    const refCols = await loadTableColumnSet(conn, "employee_references");
    const eduCols = await loadTableColumnSet(conn, "employee_education");
    const expCols = await loadTableColumnSet(conn, "employee_experience");

    const deferRefSync = refCols.size > 0 && refRows.length > 0;
    const deferEduSync = eduCols.size > 0 && eduRows.length > 0;
    const deferExpSync = expCols.size > 0 && expRows.length > 0;

    if (!deferEduSync && educationJsonCol && educationRaw && typeof educationRaw === "string" && educationRaw.trim()) {
      try {
        JSON.parse(educationRaw);
      } catch {
        return NextResponse.json({ error: "Invalid JSON for education_json" }, { status: 400 });
      }
      updates[educationJsonCol] = educationRaw.trim();
    }

    const hasUsername = columnSet.has("username");
    const empCol = columnSet.has("empId") ? "empId" : columnSet.has("emp_id") ? "emp_id" : null;
    if (updates.empId !== undefined) delete updates.empId;
    if (updates.emp_id !== undefined) delete updates.emp_id;
    if (empCol && updates[empCol] !== undefined) delete updates[empCol];

    let existing = [];
    if (hasUsername && empCol && empId) {
      ;[existing] = await conn.execute(
        `SELECT id FROM employee_profiles WHERE username = ? OR ${empCol} = ? LIMIT 1`,
        [username, empId],
      );
    } else if (hasUsername) {
      ;[existing] = await conn.execute(`SELECT id FROM employee_profiles WHERE username = ? LIMIT 1`, [
        username,
      ]);
    } else if (empCol && empId) {
      ;[existing] = await conn.execute(
        `SELECT id FROM employee_profiles WHERE ${empCol} = ? LIMIT 1`,
        [empId],
      );
    } else {
      return NextResponse.json(
        { error: "employee_profiles must have username or empId column" },
        { status: 500 },
      );
    }

    if (hasUsername) updates.username = username;
    if (existing.length === 0 && empCol && empId) {
      updates[empCol] = empId;
    }

    // employee_code is always the same as rep_list / profile empId.
    if (columnSet.has("employee_code") && empId) {
      updates.employee_code = empId;
    }

    if (approvalCol) {
      updates[approvalCol] = "pending";
    }

    const keys = Object.keys(updates).filter((k) => !RESERVED_PROFILE_COLUMNS.has(k));
    if (keys.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    if (existing.length > 0) {
      const row = existing[0];
      const setParts = keys.map((k) => `\`${k}\` = ?`).join(", ");
      const vals = keys.map((k) => updates[k]);
      if (row.id != null) {
        await conn.execute(`UPDATE employee_profiles SET ${setParts} WHERE id = ?`, [...vals, row.id]);
      } else if (hasUsername) {
        await conn.execute(`UPDATE employee_profiles SET ${setParts} WHERE username = ?`, [
          ...vals,
          username,
        ]);
      } else if (empCol && empId) {
        await conn.execute(`UPDATE employee_profiles SET ${setParts} WHERE \`${empCol}\` = ?`, [
          ...vals,
          empId,
        ]);
      }
    } else {
      if (empCol && !empId) {
        return NextResponse.json(
          {
            error:
              "Profile submit blocked: rep_list me is username ka valid empId missing hai. Pehle rep_list.empId set karein.",
          },
          { status: 400 },
        );
      }
      const insertKeys = Object.keys(updates).filter((k) => !RESERVED_PROFILE_COLUMNS.has(k));
      const placeholders = insertKeys.map(() => "?").join(", ");
      const colsSql = insertKeys.map((k) => `\`${k}\``).join(", ");
      const vals = insertKeys.map((k) => updates[k]);
      await conn.execute(`INSERT INTO employee_profiles (${colsSql}) VALUES (${placeholders})`, vals);
    }

    let profileRowId = null;
    if (hasUsername) {
      const [pidRows] = await conn.execute(`SELECT id FROM employee_profiles WHERE username = ? LIMIT 1`, [
        username,
      ]);
      profileRowId = pidRows[0]?.id != null ? Number(pidRows[0].id) : null;
    }

    if (deferRefSync) {
      await syncChildTableFromJson(
        conn,
        "employee_references",
        refCols,
        username,
        empId,
        refRows,
        EMPCRM_REFERENCE_MAP,
        profileRowId,
      );
    }
    if (deferEduSync) {
      await syncChildTableFromJson(
        conn,
        "employee_education",
        eduCols,
        username,
        empId,
        eduRows,
        EMPCRM_EDUCATION_MAP,
        profileRowId,
      );
    }
    if (deferExpSync) {
      await syncChildTableFromJson(
        conn,
        "employee_experience",
        expCols,
        username,
        empId,
        expRows,
        EMPCRM_EXPERIENCE_MAP,
        profileRowId,
      );
    }

    if (approvalCol) {
      await syncSubmissionStatus(conn, {
        username,
        empId,
        status: "pending",
        actedBy: username,
      });
    }

    // Also write into employee_profile_submissions (plural) so empcrm approval queue gets this submission.
    const [latestProfileRows] = await conn.execute(
      `SELECT * FROM employee_profiles WHERE username = ? LIMIT 1`,
      [username],
    );
    const latestProfile = serializeRow(latestProfileRows[0] ?? null) || {};
    await syncEmpcrmSubmissionQueueOnEmployeeSave(conn, {
      username,
      empId,
      submittedBy: username,
      status: "pending",
      uploadedFiles: submissionUploadedFiles,
      payload: {
        data: latestProfile,
        references: Array.isArray(refRows) ? refRows : [],
        education: Array.isArray(eduRows) ? eduRows : [],
        experience: Array.isArray(expRows) ? expRows : [],
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[employee-profile PUT]", e);
    const msg = e?.sqlMessage || e?.message || "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
